"use client";

/* ═══════════════════════════════════════════════════════════════
   /consentements — Interstitiel post-auth / pré-onboarding (BLOC 3A)

   Collecte rôle (+context), date de naissance + age-gate parental, et
   les 3 consentements Loi 25 (+ 2 parentaux si mineur). Au submit :
     1. RPC set_initial_role_and_context (role+context en DB)
     2. updateUser(metadata) — consents + parent PII + date_naissance + role/context
     3. refreshSession() — le JWT prend le nouveau role (guard athlète)
     4. persistInitialConsents — users.privacy_preferences
     5. postLoginDispatch — redirect par rôle

   ⚠️ BLOC 3A : écran NON branché dans les flux (pas de gate). Accessible
   en visitant /consentements directement pour test isolé. Le gate vient
   au bloc 3B.

   Copie consentements répliquée de SignupMobile (écrans 2 + 3).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isAdult, isUnder14 } from "@/lib/legal/ageGate";
import { openLegalDocument } from "@/lib/legal";
import {
  buildConsentMetadata,
  persistInitialConsents,
  type InitialConsentFlags,
  type ParentPII,
} from "@/lib/legal/persistInitialConsents";
import { postLoginDispatch } from "@/lib/auth/postLoginDispatch";
import { hapticSuccess } from "@/lib/haptics";

type Role = "ATHLETE" | "COACH" | "RECRUTEUR";
type Ctx = "scolaire" | "ligue_civile" | "collegial";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RELATIONS = ["Père", "Mère", "Tuteur légal", "Autre"];

/* ── Styles charte ───────────────────────────────────────────── */
const card = "bg-[#1A1D24] border border-white/[0.06] rounded-2xl";
const labelCls = "block text-[12px] font-bold tracking-wider uppercase text-[#6b7280] mb-1";
const inputCls = "w-full bg-[#111317] border border-white/10 rounded-xl px-4 py-3 text-[16px] text-white placeholder:text-white/35 outline-none focus:border-[#E63946]/50";
const sectionH = "font-head text-[13px] font-black uppercase tracking-tight text-white/70 mt-7 mb-3 flex items-center gap-2";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className={sectionH}>
      <span className="w-0.5 h-3 bg-[#E63946] rounded-full" />
      {children}
    </h2>
  );
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer min-h-[44px] py-1.5">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border transition-colors ${checked ? "bg-[#E63946] border-[#E63946]" : "bg-transparent border-white/25"}`}
        aria-checked={checked}
        role="checkbox"
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        )}
      </button>
      <span className="text-[13px] text-white/80 leading-snug">{children}</span>
    </label>
  );
}

export default function ConsentementsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form state
  const [role, setRole] = useState<Role | null>(null);
  const [context, setContext] = useState<Ctx | null>(null);
  const [birthdate, setBirthdate] = useState("");
  // DOB verrouillée = lue depuis la row de l'orphelin lié (athletes.date_naissance),
  // source de vérité. La décision du bloc parental (isMinor) en dérive — JAMAIS
  // d'une saisie ni d'une metadata polluable (Loi 25).
  const [dobLocked, setDobLocked] = useState(false);

  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentRelationship, setParentRelationship] = useState("");

  const [consentPolicy, setConsentPolicy] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentProfile, setConsentProfile] = useState(false);
  const [consentVisibility, setConsentVisibility] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      // Approche C — role/context sont DÉJÀ assignés en amont (callback OAuth
      // via service_role, ou signUp email/pw). On les LIT depuis le profil au
      // lieu de les redemander → pas de role picker, pas de RPC
      // set_initial_role_and_context (qui lèverait ROLE_ALREADY_SET).
      if (u) {
        const { data: profile } = await supabase
          .from("users")
          .select("role, context")
          .eq("id", u.id)
          .maybeSingle();
        if (profile?.role) setRole(profile.role as Role);
        if (profile?.context) setContext(profile.context as Ctx);

        // Source de vérité DOB : la row de l'orphelin lié (par email au signup).
        // Si présente → prefill + verrou ; la décision parentale (isMinor) en
        // dérive, jamais d'une saisie. Absente (self-signup) → comportement
        // actuel (saisissable).
        const { data: ath } = await supabase
          .from("athletes")
          .select("date_naissance")
          .eq("user_id", u.id)
          .maybeSingle();
        if (ath?.date_naissance) {
          setBirthdate(ath.date_naissance as string);
          setDobLocked(true);
        }
      }
      setAuthLoading(false);
    })();
  }, []);

  // Loi 25 — hard-block self-signup sous 14 ans. Cet écran est le point de saisie
  // de la DOB sur le chemin OAUTH (le flow email la collecte dans SignupMobile /
  // usePartialSignup, qui portent déjà le gate). Sans ce contrôle ici, un <14 qui
  // s'inscrit via Google/Apple contourne entièrement le blocage — web ET mobile.
  //
  // S'ajoute SOUS le seuil 18 : les 14-17 gardent le bloc parental (isMinor),
  // seuls les <14 sont refusés.
  //
  // Vaut AUSSI pour la DOB verrouillée (fiche orpheline créée par un coach) :
  // l'attestation d'un coach ne remplace pas le consentement parental légal sous
  // 14 ans. Un hard-block avec une porte dérobée n'est pas un hard-block — un
  // athlète <14 créé par un coach ne peut donc pas réclamer son compte, et c'est
  // le comportement voulu.
  const birthdateUnder14 = isUnder14(birthdate);
  const isMinor = birthdate.length > 0 && !isAdult(birthdate);
  const parentEmailValid = EMAIL_RE.test(parentEmail.trim());

  const canSubmit = useMemo(() => {
    // Approche C — role/context déjà en DB : le gate ne porte que sur DOB +
    // consentements (+ parental si mineur).
    if (!birthdate) return false;
    if (birthdateUnder14) return false;   // Loi 25 — hard-block <14, sans exception
    if (!consentPolicy || !consentData) return false;
    if (isMinor) {
      if (!parentFirstName.trim() || !parentLastName.trim() || !parentEmailValid) return false;
      if (!consentProfile || !consentVisibility) return false;
    }
    return true;
  }, [birthdate, birthdateUnder14, consentPolicy, consentData, isMinor, parentFirstName, parentLastName, parentEmailValid, consentProfile, consentVisibility]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting || !user || !role) return;
    // Loi 25 — aucune écriture pour un <14 (garde défensive en plus du blocage du
    // CTA via canSubmit/birthdateUnder14). Miroir de SignupMobile:287.
    if (isUnder14(birthdate)) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    try {
      // Approche C — PAS de RPC set_initial_role_and_context : role/context sont
      // déjà en DB (callback OAuth / signUp). On capte consentements + DOB
      // (+ parental si mineur), puis dispatch. Redemander le rôle lèverait
      // ROLE_ALREADY_SET.
      const flags: InitialConsentFlags = {
        policy: consentPolicy,
        data: consentData,
        marketing: consentMarketing,
        ...(isMinor
          ? { parentalProfile: consentProfile, parentalVisibility: consentVisibility }
          : {}),
      };
      const parent: ParentPII | undefined = isMinor
        ? {
            firstName: parentFirstName.trim(),
            lastName: parentLastName.trim(),
            email: parentEmail.trim(),
            relationship: parentRelationship || undefined,
          }
        : undefined;

      await supabase.auth.updateUser({
        data: {
          ...buildConsentMetadata(flags, parent),
          date_naissance: birthdate,
          // Sync rôle (+ context si présent) dans le JWT — le guard athlète lit
          // user_metadata.role. Valeurs issues du profil (déjà assignées).
          role,
          ...(context ? { context } : {}),
        },
      });

      // 3. refreshSession — le JWT prend le nouveau role (guard athlète lit le JWT)
      await supabase.auth.refreshSession();

      // 4. privacy_preferences — INVARIANT ANTI-BOUCLE : si l'écriture échoue,
      // le consent reste absent en base → le gate (postLoginDispatch / onboarding)
      // re-pousserait /consentements → boucle. On bloque le dispatch et on
      // demande de réessayer plutôt que de risquer le ping-pong.
      const persisted = await persistInitialConsents(user.id, flags);
      if (!persisted.ok) {
        setError("Échec d'enregistrement, réessaie.");
        setSubmitting(false);
        return;
      }

      // Succès confirmé (RPC + persist OK) → feedback haptique avant le redirect.
      hapticSuccess();

      // 5. redirect par rôle (source unique)
      await postLoginDispatch(supabase, user, router);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue.");
      setSubmitting(false);
    }
  }, [canSubmit, submitting, user, role, context, consentPolicy, consentData, consentMarketing, isMinor, consentProfile, consentVisibility, parentFirstName, parentLastName, parentEmail, parentRelationship, birthdate, router]);

  /* ── Render ──────────────────────────────────────────────── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#111317] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#111317] flex items-center justify-center px-6 text-center">
        <p className="text-[15px] text-white/70">Tu dois être connecté pour accéder à cette page.</p>
      </div>
    );
  }

  return (
    // App-shell LOCAL : /consentements est sous le root layout (pas de <main>
    // scrollable des portails). Sous ios.scrollEnabled:false la WebView ne
    // scrolle pas → on recrée le conteneur scroll interne (height:100dvh +
    // overflow-y:auto), même pattern que le shell mobile. Le CTA est pinné
    // hors-scroll (flex column) pour rester toujours atteignable.
    <div className="bg-[#111317] text-white flex flex-col overflow-x-hidden" style={{ height: "100dvh" }}>
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
      <div className="max-w-md mx-auto px-6 pt-6 pb-6">
        <h1 className="font-head font-black uppercase tracking-tight text-white" style={{ fontSize: 26, lineHeight: 0.95 }}>
          Quelques infos.
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-2 leading-snug">
          On confirme tes consentements avant de continuer.
        </p>

        {/* Date de naissance */}
        <SectionTitle>Date de naissance</SectionTitle>
        <input
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          readOnly={dobLocked}
          aria-readonly={dobLocked}
          className={`${inputCls}${dobLocked ? " opacity-60 cursor-not-allowed" : ""}`}
        />
        {/* Loi 25 — hard-block <14. Formulation IDENTIQUE aux autres surfaces
            (SignupMobile:1018, app/auth/page.tsx). Une seule phrase, partout. */}
        {birthdate && birthdateUnder14 && (
          <p className="text-[12px] text-[#EF4444] mt-2 px-1">
            L&apos;inscription est réservée aux 14 ans et plus.
          </p>
        )}
        {/* DOB verrouillée (fiche créée par un coach) : la date n'est pas
            modifiable ici, l'utilisateur doit savoir qu'il n'a aucune action
            corrective à tenter sur cet écran. */}
        {birthdateUnder14 && dobLocked && (
          <p className="text-[12px] text-[#9CA3AF] mt-1 px-1">
            Cette date provient de ta fiche. Contacte ton entraîneur si elle est erronée.
          </p>
        )}

        {/* Seuil 18 — bloc parental. Masqué sous 14 ans : le compte est refusé,
            demander un consentement parental n'aurait aucun sens (et laisserait
            croire qu'une saisie débloque la situation). */}
        {isMinor && !birthdateUnder14 && (
          <p className="text-[12px] text-[#F59E0B] mt-2 px-1">
            Tu as moins de 18 ans : l&apos;accord d&apos;un parent ou tuteur est requis (Loi 25).
          </p>
        )}

        {/* 4. Bloc parental (mineur) */}
        {isMinor && !birthdateUnder14 && (
          <>
            <SectionTitle>Tes parents</SectionTitle>
            <div className="space-y-3">
              <div>
                <label htmlFor="c-parent-first" className={labelCls}>Prénom du parent</label>
                <input id="c-parent-first" value={parentFirstName} onChange={(e) => setParentFirstName(e.target.value)} className={inputCls} placeholder="Prénom" />
              </div>
              <div>
                <label htmlFor="c-parent-last" className={labelCls}>Nom du parent</label>
                <input id="c-parent-last" value={parentLastName} onChange={(e) => setParentLastName(e.target.value)} className={inputCls} placeholder="Nom" />
              </div>
              <div>
                <label htmlFor="c-parent-email" className={labelCls}>Courriel du parent</label>
                <input id="c-parent-email" type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className={inputCls} placeholder="parent@exemple.ca" />
                {parentEmail && !parentEmailValid && (
                  <p className="text-[12px] text-[#EF4444] mt-1 px-1">Format de courriel invalide.</p>
                )}
              </div>
              <div>
                <label htmlFor="c-parent-rel" className={labelCls}>Lien de parenté (optionnel)</label>
                <select
                  id="c-parent-rel"
                  value={parentRelationship}
                  onChange={(e) => setParentRelationship(e.target.value)}
                  className={`${inputCls} appearance-none`}
                >
                  <option value="">Sélectionner…</option>
                  {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <SectionTitle>Consentement parental</SectionTitle>
            <div className={`${card} px-4 py-3 space-y-1`}>
              <Checkbox checked={consentProfile} onChange={setConsentProfile}>
                Je confirme que mon parent ou tuteur légal autorise la création de mon profil athlète sur Nexus.
              </Checkbox>
              <Checkbox checked={consentVisibility} onChange={setConsentVisibility}>
                Mon parent ou tuteur légal consent à ce que mes informations sportives et académiques soient visibles par les recruteurs des CÉGEP.
              </Checkbox>
            </div>
          </>
        )}

        {/* 5. Consentements Loi 25 */}
        <SectionTitle>Consentements</SectionTitle>
        <div className={`${card} px-4 py-3 space-y-1`}>
          <Checkbox checked={consentPolicy} onChange={setConsentPolicy}>
            J&apos;ai lu et j&apos;accepte la{" "}
            <button type="button" onClick={() => openLegalDocument("confidentialite")} className="text-[#E63946] underline underline-offset-2">Politique de confidentialité</button>
            {" "}et les{" "}
            <button type="button" onClick={() => openLegalDocument("conditions")} className="text-[#E63946] underline underline-offset-2">Conditions d&apos;utilisation</button>
            {" "}de Nexus.
          </Checkbox>
          <Checkbox checked={consentData} onChange={setConsentData}>
            J&apos;accepte la{" "}
            <button type="button" onClick={() => openLegalDocument("collecteDonnees")} className="text-[#E63946] underline underline-offset-2">collecte et le traitement de mes données</button>
            {" "}par Nexus aux fins décrites.
          </Checkbox>
          <Checkbox checked={consentMarketing} onChange={setConsentMarketing}>
            J&apos;accepte de recevoir des communications marketing de Nexus (max 2 courriels par mois).{" "}
            <span className="text-white/40">(optionnel)</span>
          </Checkbox>
        </div>

      </div>
      </div>

      {/* Footer CTA — pinné au bas RÉEL de l'écran (pas de tab bar sur cet
          écran), HORS du conteneur scroll → toujours atteignable. padding-bottom
          = home indicator iOS (env(safe-area-inset-bottom)), pas d'offset tab-bar. */}
      <div
        className="bg-[#111317]/95 backdrop-blur-md border-t border-white/[0.06]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="max-w-md mx-auto px-6 pt-3">
          {error && (
            <p className="text-[13px] text-[#EF4444] mb-3 text-center">{error}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full h-14 rounded-2xl bg-[#E63946] text-white font-head font-black text-[14px] uppercase tracking-widest active:scale-[0.97] active:bg-[#D42B22] transition-all disabled:opacity-40 disabled:active:scale-100"
          >
            {submitting ? "Enregistrement…" : "Continuer"}
          </button>
        </div>
      </div>
    </div>
  );
}
