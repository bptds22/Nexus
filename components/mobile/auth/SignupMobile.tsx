"use client";

/* ═══════════════════════════════════════════════════════════════
   SignupMobile — iter 7.50-a-bis-2a
   Signup natif athlète + role-picker mobile.

   Flow (1 phase "signup" dans AuthMobileDispatcher) :
     ÉCRAN 0 — Role picker (4 cartes)
       • Athlète          → step 1 du flow athlète interne
       • Entraîneur école → router.push("/auth/pro?role=scolaire")
       • Coach ligue/club → router.push("/auth/pro?role=ligue_civile")
       • Recruteur CÉGEP  → router.push("/auth/pro?role=collegial")

     ÉCRAN 1 — Crée ton compte (athlète)
       email + password + confirme password (show/hide eye chacun) +
       social UI (toast "Bientôt") + lien "Déjà un compte → login".
       Validation : email regex + password >= 8 + confirm === password.

     ÉCRAN 2 — Qui es-tu (athlète)
       firstName* + lastName* + courriel éditable* (pré-rempli depuis
       écran 1, l'utilisateur peut corriger). Le nom qui ira sur la
       carte joueur. PAS de téléphone (réduit, capté en onboarding).

     ÉCRAN 3 — L'accord d'un parent (Loi 25)
       Intro "tu as moins de 18 ans" + parent firstName* + lastName* +
       email* + lien de parenté (MobilePicker, optionnel) + 2 checkboxes
       parentales OBLIGATOIRES (création profil + visibilité recruteurs
       CÉGEP) + acceptation politique confidentialité implicite via
       notice CTA. PAS de carte partenaire (sortie du flow →
       /athlete/parametres). sport+context captés à l'onboarding
       écran équipe.

   Au submit (écran 3) :
     - buildConsentMetadata étendu (7.50-a-bis-1) stash dans
       raw_user_meta_data : 2 consents parentaux + parent PII (email,
       relationship — prénom/nom à null car non collectés) + 3 consents
       génériques (policy/data/marketing).
     - persistInitialConsents étendu écrit dans users.privacy_preferences.
     - signUp(email, password, "ATHLETE", firstName, lastName, metadata)
       sans context — il sera capté à l'onboarding écran équipe.
     - router.push("/athlete/onboarding") → dispatch IS_CAPACITOR →
       AthleteOnboardingMobile (qui a ENCORE son écran 1 consents
       jusqu'au sous-sprint 2b → double capture temporaire ASSUMÉE
       et sûre — préserve la fenêtre Loi 25).

   ⚠️ Hooks AVANT toute condition (canon Rules of Hooks).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/utils/translateAuthError";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { SocialButtonsMobile } from "./SocialButtonsMobile";
import { NexusLogoSvg } from "./NexusLogoSvg";
import {
  buildConsentMetadata,
  persistInitialConsents,
} from "@/lib/legal/persistInitialConsents";
import { LegalSheetMobile, type LegalDocKey } from "@/components/legal/LegalSheetMobile";
import PartnerVisibilityConsentCard from "@/components/shared/PartnerVisibilityConsentCard";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (intensity === "Medium") {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch { /* no-op */ }
}

const RELATION_OPTIONS: PickerOption[] = [
  { value: "Père", label: "Père" },
  { value: "Mère", label: "Mère" },
  { value: "Tuteur légal", label: "Tuteur légal" },
  { value: "Autre", label: "Autre" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Iter age-gate §A — calcule si l'utilisateur est majeur (Québec : 18 ans).
 *  Compare année + mois + jour (pas juste l'année). Retourne false si la
 *  string est vide, mal formée, ou la date future. ISO "YYYY-MM-DD". */
function isAdult(birthdate: string, today: Date = new Date()): boolean {
  if (!birthdate) return false;
  const [yStr, mStr, dStr] = birthdate.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  if (!y || !m || !d) return false;
  let age = today.getFullYear() - y;
  // Anniversaire pas encore atteint cette année → retirer 1 an.
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age -= 1;
  return age >= 18;
}

interface SignupMobileProps {
  /** Retour vers Welcome. */
  onShowWelcome: () => void;
  /** Bascule vers Login (lien "Déjà un compte ?"). */
  onShowLogin: () => void;
}

export function SignupMobile({ onShowWelcome, onShowLogin }: SignupMobileProps) {
  // Hooks AVANT toute condition (canon).
  const router = useRouter();
  const toast = useMobileToast();

  // 0 = role picker ; 1 = compte ; 2 = Toi (identité + âge + consents
  // génériques) ; 3 = Tes parents (consents parentaux + partner).
  // Iter signup-reorg — annule la fusion du sprint polish-2 : on REVIENT
  // à 2 sections distinctes Toi / Tes parents pour pouvoir ensuite (sprint
  // suivant après recon âge) gater conditionnellement l'écran parents
  // selon l'âge. Les 3 consents génériques (policy/data/marketing) sont
  // DÉPLACÉS de l'écran 1 vers l'écran 2 → écran 1 reste propre (compte
  // + sociaux).
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  // Form state athlète
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Iter signup-reorg — date de naissance (athletes.date_naissance existe
  // déjà en DB). Stocké au format ISO "YYYY-MM-DD" (input type=date).
  // Stash dans raw_user_meta_data au signup ; relu et écrit dans
  // athletes.date_naissance au submit onboarding (cf parentSlice b3).
  // ⚠️ Pour ce sprint : on CAPTE seulement, l'écran parents reste
  // affiché pour tous (gating "18+ = pas de parents" différé au sprint
  // suivant après recon âge complet).
  const [birthdate, setBirthdate] = useState("");
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentRelationship, setParentRelationship] = useState<string>("");
  // Iter 7.50-a-bis-2a-fix-2 — consents génériques explicites (au lieu de
  // hardcodés). Loi 25 : policy/data obligatoires, marketing optionnel.
  const [consentPolicy, setConsentPolicy] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentProfile, setConsentProfile] = useState(false);
  const [consentVisibility, setConsentVisibility] = useState(false);
  // Iter signup-polish-2 — partner visibility OPTIONNEL (Loi 25, jamais
  // bloquant). Default false. Pas dans le gate CTA. La persistance suit
  // le slot `parentalPartnerVisibility` déjà câblé dans buildConsentMetadata
  // + persistInitialConsents. Au submit onboarding, le timestamp DU SIGNUP
  // sera traduit en athletes.partner_visibility_* (cf AthleteOnboardingMobile).
  const [consentPartnerVisibility, setConsentPartnerVisibility] = useState(false);
  const [openRelation, setOpenRelation] = useState(false);
  // Iter 7.50-a-bis (legal-2) — bottom sheet pour les 3 docs légaux.
  // null = sheet fermé. State au niveau parent → le formulaire conserve
  // tous ses champs quand on ouvre/ferme le sheet.
  const [legalSheet, setLegalSheet] = useState<LegalDocKey | null>(null);

  const [saving, setSaving] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  // Iter signup-polish-2 §D — voile #111317 anti-flash à la fin du submit,
  // joué AVANT router.replace pour masquer le saut PlaybookHeroArt →
  // PlaybookBackground du layout athlète. 400ms forwards.
  const [entering, setEntering] = useState(false);

  // Validation par écran (athlète)
  const emailValid = EMAIL_RE.test(email.trim());
  const pwdValid = password.length >= 8;
  const pwdMatches = confirmPassword.length > 0 && confirmPassword === password;
  // Iter 7.50-a-bis-2a-fix-2 — policy + data obligatoires gatent l'écran 1
  // (Loi 25, en plus de la confirmation password). marketing reste libre.
  // Iter signup-reorg — Step 1 (compte) : email + pwd + confirm. PAS de
  // consents ici (déplacés écran 2). Sociaux visibles sur l'écran propre.
  const canProceedStep1 = emailValid && pwdValid && pwdMatches;
  const parentEmailValid = EMAIL_RE.test(parentEmail.trim());
  // Iter signup-reorg — Step 2 (Toi) : prénom + nom + email (revalidé)
  // + date de naissance + 2 consents génériques required (policy/data).
  // Marketing reste optionnel hors gate.
  const canProceedStep2 = canProceedStep1
    && firstName.trim().length > 0
    && lastName.trim().length > 0
    && emailValid
    && birthdate.length > 0
    && consentPolicy && consentData;
  // Iter age-gate §B — utilisateur majeur (18+) calculé depuis birthdate.
  // Réévalué à chaque render : si l'utilisateur revient à l'écran 2 et
  // change sa date, le flow se rebranche tout seul.
  const userIsAdult = isAdult(birthdate);
  // Iter age-gate §B — canSubmit :
  //   - Majeur : canProceedStep2 suffit. Pas de parent_* requis, pas de
  //     consentement parental requis (Loi 25 : consentement adulte =
  //     consent_policy + consent_data déjà cochés à l'écran 2).
  //   - Mineur : ancien flow (parent_* + 2 consents parentaux). Partner
  //     consent reste optionnel hors gate.
  const canSubmit = userIsAdult
    ? (canProceedStep2 && !saving)
    : (canProceedStep2
        && parentFirstName.trim().length > 0
        && parentLastName.trim().length > 0
        && parentEmailValid
        && consentProfile && consentVisibility
        && !saving);

  /* ── Role-picker handlers ────────────────────────────────── */

  const handlePickAthlete = useCallback(() => {
    triggerHaptic("Light");
    setStep(1);
  }, []);

  const handlePickPro = useCallback((role: "scolaire" | "collegial" | "ligue_civile") => {
    triggerHaptic("Light");
    // ⚠️ TODO interne — placeholder web : signup natif pro (école /
    // ligue civile / recruteur) à venir dans un sprint futur. Pour
    // l'instant on route vers /auth/pro pré-sélectionné (mini-fix
    // 7.50-a-bis-2a : useEffect lit ?role=X et coche la carte).
    router.push(`/auth/pro?role=${role}`);
  }, [router]);

  /* ── Navigation athlète ──────────────────────────────────── */

  const handleNext = useCallback(() => {
    triggerHaptic("Light");
    if (step === 1 && canProceedStep1) setStep(2);
    // Iter age-gate §B — Step 2 → Step 3 UNIQUEMENT si mineur. Pour un
    // majeur, le CTA passe sur "Créer mon compte" et appelle handleSubmit
    // directement (cf gating §CTA plus bas).
    else if (step === 2 && canProceedStep2 && !userIsAdult) setStep(3);
  }, [step, canProceedStep1, canProceedStep2, userIsAdult]);

  const handleBack = useCallback(() => {
    triggerHaptic("Light");
    if (step === 0) { onShowWelcome(); return; }
    setStep((s) => (s - 1) as 0 | 1 | 2);
  }, [step, onShowWelcome]);

  /* ── Submit final (écran 3) ──────────────────────────────── */

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    triggerHaptic("Light");
    setSaving(true);

    const { signUp } = await import("@/lib/supabase/auth.actions");

    // Iter age-gate §C — branche selon majorité :
    //   - Majeur (userIsAdult) : NE PAS passer parentalProfile/Visibility
    //     /PartnerVisibility ni parent PII. raw_user_meta_data ne reçoit
    //     QUE les 3 consents génériques (policy/data/marketing) + date
    //     de naissance. AthleteOnboardingMobile lira l'absence de
    //     consent_parental_profile/visibility comme un "compte adulte"
    //     et laissera athletes.consentement_parental à false (default DB,
    //     NOT NULL OK), parent_* à null. Aucune fausse trace de
    //     consentement parental.
    //   - Mineur : ancien flow inchangé (consents parentaux + parent PII).
    const consentMeta = userIsAdult
      ? buildConsentMetadata({
          policy: consentPolicy,
          data: consentData,
          marketing: consentMarketing,
        })
      : buildConsentMetadata(
          {
            policy: consentPolicy,
            data: consentData,
            marketing: consentMarketing,
            parentalProfile: consentProfile,
            parentalVisibility: consentVisibility,
            parentalPartnerVisibility: consentPartnerVisibility,
          },
          {
            firstName: parentFirstName.trim(),
            lastName: parentLastName.trim(),
            email: parentEmail.trim(),
            relationship: parentRelationship,
          },
        );

    // ⚠️ context (scolaire/civil) NON capturé au signup — capté à
    // l'onboarding écran 2 (sport+école/équipe). signUp() accepte
    // context optionnel (8e arg) ; on omet, le wizard d'onboarding
    // le déduit ou propose un picker plus tard.
    // Iter signup-reorg — birthdate stashée dans raw_user_meta_data sous
    // la clé `date_naissance` (= nom de la colonne DB). Relue au submit
    // onboarding (AthleteOnboardingMobile parentSlice b3) et écrite dans
    // athletes.date_naissance. Format ISO "YYYY-MM-DD" tel quel.
    const { data, error } = await signUp(
      email.trim(),
      password,
      "ATHLETE",
      firstName.trim(),
      lastName.trim(),
      {
        ...consentMeta,
        ...(birthdate ? { date_naissance: birthdate } : {}),
      },
    );

    if (error) {
      toast.error({
        message: "Inscription impossible",
        detail: translateAuthError(error.message),
      });
      setSaving(false);
      return;
    }

    // Iter 7.53 + 7.50-a-bis-1 — UPDATE app-side best-effort
    // users.privacy_preferences. Non-bloquant : trace garantie dans
    // raw_user_meta_data via consentMeta même si l'UPDATE rate.
    if (data?.user?.id) {
      // Iter age-gate §C — même branche que consentMeta : adulte n'envoie
      // PAS de flags parentaux (helper ne les écrit pas en cas d'absence).
      const persistResult = await persistInitialConsents(data.user.id, userIsAdult
        ? {
            policy: consentPolicy,
            data: consentData,
            marketing: consentMarketing,
          }
        : {
            policy: consentPolicy,
            data: consentData,
            marketing: consentMarketing,
            parentalProfile: consentProfile,
            parentalVisibility: consentVisibility,
            parentalPartnerVisibility: consentPartnerVisibility,
          });
      if (!persistResult.ok) {
        console.warn("[SignupMobile] persistInitialConsents:", persistResult.error);
      }
    }

    triggerHaptic("Medium");

    // Iter signup-polish-2 §D — voile #111317 anti-flash JOUÉ AVANT le
    // router.replace pour masquer le saut de shell (PlaybookHeroArt du
    // signup → PlaybookBackground du athlete layout). 400ms fade in,
    // puis route change. AthleteOnboardingMobile fade-in son contenu
    // sur le même budget → recouvrement propre.
    setEntering(true);
    setTimeout(() => {
      router.replace("/athlete/onboarding");
    }, 400);
  }, [
    canSubmit, email, password, firstName, lastName, birthdate, userIsAdult,
    parentFirstName, parentLastName, parentEmail, parentRelationship,
    consentPolicy, consentData, consentMarketing,
    consentProfile, consentVisibility, consentPartnerVisibility,
    router, toast,
  ]);

  const footerHidden = inputFocused;

  /* ─── Render ─────────────────────────────────────────────── */

  return (
    <div
      className="absolute inset-0 w-full text-white flex flex-col overflow-hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Dim côté contenu : opaque en haut (header lisible), souffle
          progressif vers le bas (playbook respire derrière le footer). */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, #111317 0%, #111317 52%, rgba(17,19,23,0) 78%, rgba(17,19,23,0) 100%)",
        }}
      />

      {/* Header — back + logo + step indicator */}
      <div className="relative z-10 px-4 pt-2 shrink-0 flex items-center gap-2 min-h-[64px]">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Retour"
          className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] flex-shrink-0"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 flex justify-center">
          <NexusLogoSvg width={68} />
        </div>
        {/* Progress dots — 3 dots si mineur, 2 si majeur (iter age-gate).
            On évalue userIsAdult LIVE : si l'utilisateur change sa date
            au step 2, le 3e dot apparaît/disparaît dynamiquement. */}
        <div className="w-11 flex items-center justify-end gap-1 flex-shrink-0">
          {step >= 1 && (userIsAdult ? [1, 2] : [1, 2, 3]).map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                s <= step ? "bg-[#E63946]" : "bg-white/15"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Contenu */}
      {step === 0 && <RolePicker onPickAthlete={handlePickAthlete} onPickPro={handlePickPro} />}
      {step === 1 && (
        <Step1Account
          email={email} setEmail={setEmail}
          password={password} setPassword={setPassword}
          confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
          showPwd={showPwd} setShowPwd={setShowPwd}
          showConfirmPwd={showConfirmPwd} setShowConfirmPwd={setShowConfirmPwd}
          emailValid={emailValid} pwdValid={pwdValid} pwdMatches={pwdMatches}
          onShowLogin={onShowLogin}
          setInputFocused={setInputFocused}
        />
      )}
      {step === 2 && (
        <Step2You
          firstName={firstName} setFirstName={setFirstName}
          lastName={lastName} setLastName={setLastName}
          email={email} setEmail={setEmail} emailValid={emailValid}
          birthdate={birthdate} setBirthdate={setBirthdate}
          consentPolicy={consentPolicy} setConsentPolicy={setConsentPolicy}
          consentData={consentData} setConsentData={setConsentData}
          consentMarketing={consentMarketing} setConsentMarketing={setConsentMarketing}
          onOpenLegal={(key) => setLegalSheet(key)}
          setInputFocused={setInputFocused}
        />
      )}
      {step === 3 && (
        <Step3Parent
          parentFirstName={parentFirstName} setParentFirstName={setParentFirstName}
          parentLastName={parentLastName} setParentLastName={setParentLastName}
          parentEmail={parentEmail} setParentEmail={setParentEmail}
          parentEmailValid={parentEmailValid}
          parentRelationship={parentRelationship}
          onOpenRelation={() => setOpenRelation(true)}
          consentProfile={consentProfile} setConsentProfile={setConsentProfile}
          consentVisibility={consentVisibility} setConsentVisibility={setConsentVisibility}
          consentPartnerVisibility={consentPartnerVisibility}
          setConsentPartnerVisibility={setConsentPartnerVisibility}
          setInputFocused={setInputFocused}
        />
      )}

      {/* Sticky CTA bottom (sauf step 0 — le picker a son propre CTA inline) */}
      {step >= 1 && (
        <div
          className="relative z-10 px-6 shrink-0"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
            paddingTop: 16,
            opacity: footerHidden ? 0 : 1,
            visibility: footerHidden ? "hidden" : "visible",
            transition: "opacity 180ms ease, visibility 180ms ease",
          }}
          aria-hidden={footerHidden ? "true" : "false"}
        >
          {/* Iter age-gate §B — CTA logic :
              - Step 1 : "Continuer" gated sur canProceedStep1.
              - Step 2 MINEUR : "Continuer" gated sur canProceedStep2 (→ step 3).
              - Step 2 MAJEUR : "Créer mon compte" gated sur canSubmit (submit
                direct, écran parents sauté).
              - Step 3 : "Créer mon compte" gated sur canSubmit.
              On bascule en mode submit-button dès step 2 si majeur OU step 3. */}
          {(step < 2) || (step === 2 && !userIsAdult) ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all ${
                (step === 1 ? canProceedStep1 : canProceedStep2)
                  ? "bg-[#E63946] text-white active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)]"
                  : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
              }`}
            >
              Continuer
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  canSubmit
                    ? "bg-[#E63946] text-white active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)]"
                    : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
                }`}
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                    Création…
                  </>
                ) : (
                  "Créer mon compte"
                )}
              </button>
            </>
          )}
        </div>
      )}

      <MobilePicker
        open={openRelation}
        onClose={() => setOpenRelation(false)}
        title="Lien de parenté"
        options={RELATION_OPTIONS}
        value={parentRelationship || null}
        onChange={(v) => setParentRelationship(v ? String(v) : "")}
      />

      {/* Iter 7.50-a-bis (legal-2) — bottom sheet pour les 3 docs
          légaux. Le portal vers document.body fait que le sheet
          s'affiche par-dessus le signup ; quand on le ferme, le
          formulaire récupère son focus avec tous les champs intacts
          (le state SignupMobile n'a pas bougé). */}
      <LegalSheetMobile
        docKey={legalSheet}
        onClose={() => setLegalSheet(null)}
      />

      {/* Iter signup-polish-2 §D — voile #111317 anti-flash. Fade in
          0→1 sur 400ms après submit, juste avant router.replace. Masque
          le saut entre le shell signup (PlaybookHeroArt + gradient) et
          le shell athlete (PlaybookBackground + sidebar). Z-80 :
          au-dessus du contenu, sous d'éventuels modaux système. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "#111317",
          opacity: entering ? 1 : 0,
          transition: "opacity 400ms ease-out",
          zIndex: 80,
        }}
        aria-hidden
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ÉCRAN 0 — Role picker (4 cartes)
═══════════════════════════════════════════════════════════════ */

interface RolePickerProps {
  onPickAthlete: () => void;
  onPickPro: (role: "scolaire" | "collegial" | "ligue_civile") => void;
}

interface RoleCard {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onTap: () => void;
}

function RolePicker({ onPickAthlete, onPickPro }: RolePickerProps) {
  const cards: RoleCard[] = [
    {
      key: "athlete",
      title: "Athlète",
      subtitle: "Tu es un athlète du secondaire et tu veux te faire recruter.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7" r="4" />
          <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
        </svg>
      ),
      onTap: onPickAthlete,
    },
    {
      key: "scolaire",
      title: "Entraîneur d'école secondaire",
      subtitle: "Tu coaches une équipe scolaire et veux donner de la visibilité à tes athlètes.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 22V12h6v10" />
        </svg>
      ),
      onTap: () => onPickPro("scolaire"),
    },
    {
      key: "ligue_civile",
      title: "Coach ligue ou club civil",
      subtitle: "Tu coaches dans une ligue ou un club hors scolaire (ligue civile).",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
          <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
          <path d="M6 3h12v6a6 6 0 0 1-12 0V3z" />
          <path d="M12 15v3M8 21h8" />
        </svg>
      ),
      onTap: () => onPickPro("ligue_civile"),
    },
    {
      key: "collegial",
      title: "Recruteur CÉGEP",
      subtitle: "Tu recrutes pour un programme sportif collégial.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      ),
      onTap: () => onPickPro("collegial"),
    },
  ];

  return (
    <div className="relative z-10 flex-1 px-6 pt-4 overflow-y-auto">
      <h1
        className="font-head font-black text-white uppercase tracking-tight"
        style={{ fontSize: 28, lineHeight: 0.95 }}
      >
        Tu es ?
      </h1>
      <p className="text-[14px] text-[#9CA3AF] mt-2">
        Choisis ton rôle pour adapter l&apos;inscription.
      </p>

      <div className="space-y-3 mt-6">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.onTap}
            className="w-full text-left bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] active:bg-[#22262e] transition-all"
            style={{ minHeight: 72 }}
          >
            <span className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center text-white flex-shrink-0">
              {c.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-semibold text-white">{c.title}</span>
              <span className="block text-[13px] text-white/55 mt-0.5 leading-snug">{c.subtitle}</span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round" className="flex-shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-white/30 text-center mt-6 mb-4 italic">
        Les inscriptions coach / recruteur passent encore par notre formulaire web (signup natif pro à venir).
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ÉCRAN 1 — Crée ton compte (email + password + social)
═══════════════════════════════════════════════════════════════ */

const inputCls = "w-full bg-transparent text-white placeholder:text-[#4a4d56] focus:outline-none disabled:opacity-60";
const fieldCls = "bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3";
const labelCls = "block uppercase mb-1 text-[13px] font-bold tracking-[0.18em] text-[#B6BCC7]";

// Iter signup-reorg — Step 1 (compte) : props épurées. Les 3 consents
// génériques (policy/data/marketing) sont passés à Step2You désormais.
interface Step1Props {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  confirmPassword: string; setConfirmPassword: (v: string) => void;
  showPwd: boolean; setShowPwd: (v: boolean) => void;
  showConfirmPwd: boolean; setShowConfirmPwd: (v: boolean) => void;
  emailValid: boolean; pwdValid: boolean; pwdMatches: boolean;
  onShowLogin: () => void;
  setInputFocused: (v: boolean) => void;
}

function Step1Account(p: Step1Props) {
  return (
    <div className="relative z-10 flex-1 px-6 pt-4 overflow-y-auto">
      <h1 className="font-head font-black text-white uppercase tracking-tight" style={{ fontSize: 28, lineHeight: 0.95 }}>
        Crée ton compte.
      </h1>
      <p className="text-[14px] text-[#9CA3AF] mt-2">
        Email + mot de passe — c&apos;est tout pour l&apos;instant.
      </p>

      <div className="space-y-3 mt-6">
        <div className={fieldCls}>
          <label htmlFor="signup-email" className={labelCls}>Courriel</label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={p.email}
            onChange={(e) => p.setEmail(e.target.value)}
            onFocus={() => p.setInputFocused(true)}
            onBlur={() => p.setInputFocused(false)}
            placeholder="nom@exemple.ca"
            className={inputCls}
            style={{ fontSize: 17 }}
          />
        </div>

        <div className={fieldCls}>
          <label htmlFor="signup-pwd" className={labelCls}>Mot de passe (min. 8)</label>
          <div className="relative">
            <input
              id="signup-pwd"
              type={p.showPwd ? "text" : "password"}
              autoComplete="new-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={p.password}
              onChange={(e) => p.setPassword(e.target.value)}
              onFocus={() => p.setInputFocused(true)}
              onBlur={() => p.setInputFocused(false)}
              placeholder="••••••••"
              className={`${inputCls} pr-9`}
              style={{ fontSize: 17 }}
            />
            <button
              type="button"
              onClick={() => p.setShowPwd(!p.showPwd)}
              aria-label={p.showPwd ? "Masquer" : "Afficher"}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9CA3AF] active:text-white p-1"
              tabIndex={-1}
            >
              {p.showPwd ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className={fieldCls}>
          <label htmlFor="signup-pwd-confirm" className={labelCls}>Confirme ton mot de passe</label>
          <div className="relative">
            <input
              id="signup-pwd-confirm"
              type={p.showConfirmPwd ? "text" : "password"}
              autoComplete="new-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={p.confirmPassword}
              onChange={(e) => p.setConfirmPassword(e.target.value)}
              onFocus={() => p.setInputFocused(true)}
              onBlur={() => p.setInputFocused(false)}
              placeholder="••••••••"
              className={`${inputCls} pr-9`}
              style={{ fontSize: 17 }}
            />
            <button
              type="button"
              onClick={() => p.setShowConfirmPwd(!p.showConfirmPwd)}
              aria-label={p.showConfirmPwd ? "Masquer" : "Afficher"}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9CA3AF] active:text-white p-1"
              tabIndex={-1}
            >
              {p.showConfirmPwd ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Hints validation */}
        {p.email && !p.emailValid && (
          <p className="text-[12px] text-[#EF4444] -mt-1 px-1">Format de courriel invalide.</p>
        )}
        {p.password.length > 0 && !p.pwdValid && (
          <p className="text-[12px] text-[#EF4444] -mt-1 px-1">Minimum 8 caractères.</p>
        )}
        {p.confirmPassword.length > 0 && !p.pwdMatches && (
          <p className="text-[12px] text-[#EF4444] -mt-1 px-1">Les mots de passe ne correspondent pas.</p>
        )}
      </div>

      {/* Iter signup-reorg — bloc Consentements DÉPLACÉ vers l'écran 2
          (Toi) pour épurer cet écran 1 (compte + sociaux uniquement). */}
      <SocialButtonsMobile topMargin={24} />

      <button
        type="button"
        onClick={p.onShowLogin}
        className="w-full text-center text-[14px] text-[#9CA3AF] active:text-white py-3 mt-6"
      >
        Déjà un compte ?{" "}
        <span className="text-white font-bold underline underline-offset-4 decoration-1">
          Se connecter
        </span>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ÉCRAN 2 — Toi & tes parents (fusion identité + parent + consents)
   Iter signup-polish-2 §A — ex-Step2Identity (identité athlète) +
   ex-Step3Parent (parent + consents Loi 25) regroupés sur un seul
   écran scrollable. 3 sections via SectionTitle (parité signup-polish-1) :
     1. Toi          — prénom* / nom* / courriel*
     2. Tes parents  — prénom parent* / nom parent* / courriel parent* / relation
     3. Consentement parental — 2 cases required + PartnerVisibilityConsentCard (opt)
   Le partner consent ne gate JAMAIS le CTA (cf canSubmit) — Loi 25.

   Iter signup-reorg — splittés à nouveau :
   - Step2You      : Toi (prénom/nom/email + ÂGE + 3 consents génériques)
   - Step3Parent   : Tes parents (parent_* + 2 consents + PartnerVisibility)
═══════════════════════════════════════════════════════════════ */

interface Step2YouProps {
  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  email: string; setEmail: (v: string) => void; emailValid: boolean;
  birthdate: string; setBirthdate: (v: string) => void;
  consentPolicy: boolean; setConsentPolicy: (v: boolean) => void;
  consentData: boolean; setConsentData: (v: boolean) => void;
  consentMarketing: boolean; setConsentMarketing: (v: boolean) => void;
  onOpenLegal: (key: LegalDocKey) => void;
  setInputFocused: (v: boolean) => void;
}

function Step2You(p: Step2YouProps) {
  return (
    <div className="relative z-10 flex-1 px-6 pt-4 overflow-y-auto">
      <h1 className="font-head font-black text-white uppercase tracking-tight" style={{ fontSize: 28, lineHeight: 0.95 }}>
        Toi.
      </h1>
      <p className="text-[14px] text-[#9CA3AF] mt-2 leading-snug">
        Le nom qui ira sur ta carte joueur + ta date de naissance.
      </p>

      <div className="space-y-3 mt-6">
        <div className={fieldCls}>
          <label htmlFor="signup-first" className={labelCls}>Prénom</label>
          <input
            id="signup-first"
            type="text"
            autoComplete="given-name"
            value={p.firstName}
            onChange={(e) => p.setFirstName(e.target.value)}
            onFocus={() => p.setInputFocused(true)}
            onBlur={() => p.setInputFocused(false)}
            placeholder="Ton prénom"
            className={inputCls}
            style={{ fontSize: 17 }}
          />
        </div>

        <div className={fieldCls}>
          <label htmlFor="signup-last" className={labelCls}>Nom</label>
          <input
            id="signup-last"
            type="text"
            autoComplete="family-name"
            value={p.lastName}
            onChange={(e) => p.setLastName(e.target.value)}
            onFocus={() => p.setInputFocused(true)}
            onBlur={() => p.setInputFocused(false)}
            placeholder="Ton nom"
            className={inputCls}
            style={{ fontSize: 17 }}
          />
        </div>

        <div className={fieldCls}>
          <label htmlFor="signup-email-confirm" className={labelCls}>Ton courriel</label>
          <input
            id="signup-email-confirm"
            type="email"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="email"
            value={p.email}
            onChange={(e) => p.setEmail(e.target.value)}
            onFocus={() => p.setInputFocused(true)}
            onBlur={() => p.setInputFocused(false)}
            placeholder="nom@exemple.ca"
            className={inputCls}
            style={{ fontSize: 17 }}
          />
        </div>
        {p.email && !p.emailValid && (
          <p className="text-[12px] text-[#EF4444] -mt-1 px-1">Format de courriel invalide.</p>
        )}

        {/* Iter signup-reorg — date de naissance (input type=date natif).
            Stockée au format ISO "YYYY-MM-DD" → écrite dans
            athletes.date_naissance au submit onboarding. */}
        <div className={fieldCls}>
          <label htmlFor="signup-birthdate" className={labelCls}>Date de naissance</label>
          <input
            id="signup-birthdate"
            type="date"
            value={p.birthdate}
            onChange={(e) => p.setBirthdate(e.target.value)}
            onFocus={() => p.setInputFocused(true)}
            onBlur={() => p.setInputFocused(false)}
            className={inputCls}
            style={{ fontSize: 17 }}
            // Pas de min/max — l'utilisateur peut être < 14 (mineur,
            // parents requis) ou 18+ (adulte). Le gating "18+ = pas de
            // parents" sera câblé au sprint suivant.
          />
        </div>
      </div>

      {/* ── Consentements (déplacés depuis l'écran 1 — iter signup-reorg) ── */}
      <h2 className="font-head text-[13px] font-black uppercase tracking-tight text-white/70 mt-7 mb-3 flex items-center gap-2">
        <span className="w-0.5 h-3 bg-[#E63946] rounded-full" />
        Consentements
      </h2>

      <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 space-y-1">
        <ConsentCheckbox
          checked={p.consentPolicy}
          onChange={p.setConsentPolicy}
          required
        >
          J&apos;ai lu et j&apos;accepte la{" "}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.onOpenLegal("confidentialite"); }}
            className="text-[#E63946] underline underline-offset-2"
          >
            Politique de confidentialité
          </button>
          {" "}et les{" "}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.onOpenLegal("conditions"); }}
            className="text-[#E63946] underline underline-offset-2"
          >
            Conditions d&apos;utilisation
          </button>
          {" "}de Nexus.
        </ConsentCheckbox>

        <ConsentCheckbox
          checked={p.consentData}
          onChange={p.setConsentData}
          required
        >
          J&apos;accepte la{" "}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.onOpenLegal("collecte-donnees"); }}
            className="text-[#E63946] underline underline-offset-2"
          >
            collecte et le traitement de mes données
          </button>
          {" "}par Nexus aux fins décrites.
        </ConsentCheckbox>

        <ConsentCheckbox
          checked={p.consentMarketing}
          onChange={p.setConsentMarketing}
        >
          J&apos;accepte de recevoir des communications marketing de Nexus (max 2 courriels par mois).{" "}
          <span className="text-white/40">(optionnel)</span>
        </ConsentCheckbox>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ÉCRAN 3 — Tes parents (Loi 25)
   Iter signup-reorg — re-séparé de Toi pour pouvoir gater conditionnel-
   lement par âge dans un sprint suivant. Pour l'instant : affiché pour
   tous les nouveaux signups athlète.
═══════════════════════════════════════════════════════════════ */

interface Step3ParentProps {
  parentFirstName: string; setParentFirstName: (v: string) => void;
  parentLastName: string; setParentLastName: (v: string) => void;
  parentEmail: string; setParentEmail: (v: string) => void;
  parentEmailValid: boolean;
  parentRelationship: string;
  onOpenRelation: () => void;
  consentProfile: boolean; setConsentProfile: (v: boolean) => void;
  consentVisibility: boolean; setConsentVisibility: (v: boolean) => void;
  consentPartnerVisibility: boolean;
  setConsentPartnerVisibility: (v: boolean) => void;
  setInputFocused: (v: boolean) => void;
}

function Step3Parent(p: Step3ParentProps) {
  return (
    <div className="relative z-10 flex-1 px-6 pt-4 overflow-y-auto">
      <h1 className="font-head font-black text-white uppercase tracking-tight" style={{ fontSize: 26, lineHeight: 0.95 }}>
        Tes parents.
      </h1>
      <p className="text-[14px] text-[#9CA3AF] mt-2 leading-snug">
        Tu as moins de 18 ans : on a besoin de l&apos;accord d&apos;un parent ou d&apos;un tuteur (Loi 25).
      </p>

      <div className="space-y-3 mt-6">
        <div className={fieldCls}>
          <label htmlFor="signup-parent-first" className={labelCls}>Prénom du parent</label>
          <input
            id="signup-parent-first"
            type="text"
            autoComplete="off"
            value={p.parentFirstName}
            onChange={(e) => p.setParentFirstName(e.target.value)}
            onFocus={() => p.setInputFocused(true)}
            onBlur={() => p.setInputFocused(false)}
            placeholder="Prénom"
            className={inputCls}
            style={{ fontSize: 17 }}
          />
        </div>

        <div className={fieldCls}>
          <label htmlFor="signup-parent-last" className={labelCls}>Nom du parent</label>
          <input
            id="signup-parent-last"
            type="text"
            autoComplete="off"
            value={p.parentLastName}
            onChange={(e) => p.setParentLastName(e.target.value)}
            onFocus={() => p.setInputFocused(true)}
            onBlur={() => p.setInputFocused(false)}
            placeholder="Nom"
            className={inputCls}
            style={{ fontSize: 17 }}
          />
        </div>

        <div className={fieldCls}>
          <label htmlFor="signup-parent-email" className={labelCls}>Courriel du parent</label>
          <input
            id="signup-parent-email"
            type="email"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={p.parentEmail}
            onChange={(e) => p.setParentEmail(e.target.value)}
            onFocus={() => p.setInputFocused(true)}
            onBlur={() => p.setInputFocused(false)}
            placeholder="parent@exemple.ca"
            className={inputCls}
            style={{ fontSize: 17 }}
          />
        </div>
        {p.parentEmail && !p.parentEmailValid && (
          <p className="text-[12px] text-[#EF4444] -mt-1 px-1">Format de courriel invalide.</p>
        )}

        <button
          type="button"
          onClick={p.onOpenRelation}
          className="w-full flex items-center justify-between bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 active:bg-[#22262e] transition-colors text-left min-h-[52px]"
        >
          <div className="flex-1 min-w-0">
            <span className={labelCls}>Lien de parenté (optionnel)</span>
            <span className={`block text-[16px] truncate ${p.parentRelationship ? "text-white" : "text-white/40"}`}>
              {p.parentRelationship || "Sélectionner…"}
            </span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" className="flex-shrink-0 ml-2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <h2 className="font-head text-[13px] font-black uppercase tracking-tight text-white/70 mt-7 mb-3 flex items-center gap-2">
        <span className="w-0.5 h-3 bg-[#E63946] rounded-full" />
        Consentement parental
      </h2>

      <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 space-y-1">
        <ParentalCheckbox
          checked={p.consentProfile}
          onChange={p.setConsentProfile}
          label="Je confirme que mon parent ou tuteur légal autorise la création de mon profil athlète sur Nexus."
        />
        <ParentalCheckbox
          checked={p.consentVisibility}
          onChange={p.setConsentVisibility}
          label="Mon parent ou tuteur légal consent à ce que mes informations sportives et académiques soient visibles par les recruteurs des CÉGEP."
        />
      </div>

      <div className="mt-4">
        <PartnerVisibilityConsentCard
          checked={p.consentPartnerVisibility}
          onChange={p.setConsentPartnerVisibility}
          audience="athlete"
        />
      </div>
    </div>
  );
}

function ParentalCheckbox({
  checked, onChange, label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer min-h-[44px] py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
        checked ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56]"
      }`}>
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
      <span className="text-[14px] text-white/85 leading-snug flex-1">
        {label}
        <span className="text-[#EF4444] ml-0.5">*</span>
      </span>
    </label>
  );
}

/* Iter 7.50-a-bis-2a-fix-2 — ConsentCheckbox accepte du JSX (boutons
   cliquables vers la politique), pas juste une string comme la
   ParentalCheckbox. Touch target 44px via min-h. Astérisque rouge si
   `required`. */
function ConsentCheckbox({
  checked, onChange, required, children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer min-h-[44px] py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
        checked ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56]"
      }`}>
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
      <span className="text-[13px] text-white/85 leading-snug flex-1">
        {children}
        {required && <span className="text-[#EF4444] ml-0.5">*</span>}
      </span>
    </label>
  );
}
