"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signUp } from "@/lib/supabase/auth.actions";
import { isUnder14 } from "@/lib/legal/ageGate";
import { translateAuthError } from "@/lib/utils/translateAuthError";
import NexusLogo from "@/components/ui/NexusLogo";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ═══════════════════════════════════════════════════════════════
   #48 sous-unité 2-athlète — Page de claim AUTONOME.

   Destination du lien ${APP_URL}/claim?token=… généré par le coach.
   - Résout le token via resolve_athlete_invitation (anon-exécutable).
   - Token invalide/expiré/consommé → écran d'erreur, pas de formulaire.
   - Valide → écran d'acceptation : email pré-rempli + VERROUILLÉ,
     prénom en accueil, date de naissance OBLIGATOIRE, branche 14+/<14.
   - Signup MINIMAL (auth.signUp) ; métadonnées stockées (claim_token,
     date_naissance, parent_email si <14, consentements).
   - NE LIE PAS encore l'orphelin (athletes.user_id) — sous-unité 3.
   - Web uniquement (mobile à aligner plus tard).
═══════════════════════════════════════════════════════════════ */

interface ClaimRow {
  athlete_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  date_naissance: string | null;
  status: string;
  expires_at: string;
  is_valid: boolean;
}

type ResolveState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "valid"; row: ClaimRow };

const MINOR_THRESHOLD = 14;

const inputCls =
  "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-white placeholder-[#4a4d56] focus:outline-none focus:border-[#E63946]/50 transition-colors";
const inputLockedCls =
  "w-full bg-[#0e1014] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#9CA3AF] cursor-not-allowed";
const labelCls =
  "block text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1.5";

/* ── Shell — défini AU NIVEAU MODULE (référence STABLE). Auparavant déclaré
   dans le render de ClaimContent : recréé à chaque frappe → React démontait/
   remontait tout le formulaire → l'input password perdait le focus après 1
   caractère. Ne dépend que de `children` + des imports module. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex flex-col relative">
      <PlaybookBackground />
      <div className="relative z-10 pt-8 pb-2 flex justify-center">
        <NexusLogo variant="white" height={36} priority />
      </div>
      <div className="relative z-10 flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-[480px] bg-[#1A1D24] border border-white/5 rounded-xl p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense>
      <ClaimContent />
    </Suspense>
  );
}

function ClaimContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<ResolveState>({ kind: "loading" });

  // ── Form state ──────────────────────────────────────────────
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Résolution du token au mount ────────────────────────────
  useEffect(() => {
    if (!token) {
      setState({ kind: "missing" });
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("resolve_athlete_invitation", { p_token: token });
      if (cancelled) return;
      if (error) {
        console.error("[claim] resolve_athlete_invitation:", error);
        setState({ kind: "invalid" });
        return;
      }
      const rows = (data as ClaimRow[] | null) ?? [];
      const row = rows[0];
      if (!row || !row.is_valid) {
        setState({ kind: "invalid" });
        return;
      }
      // DOB de l'orphelin = source de vérité : pré-remplie (et verrouillée au
      // rendu si présente). Propagée à la metadata au submit (date_naissance).
      if (row.date_naissance) setBirthDate(row.date_naissance);
      setState({ kind: "valid", row });
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ── Âge / branche mineur ────────────────────────────────────
  const age = (() => {
    if (!birthDate) return null;
    const dob = new Date(birthDate);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) a--;
    return a;
  })();
  const isMinor = age !== null && age < MINOR_THRESHOLD;

  const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const canSubmit =
    age !== null && age >= 0 &&
    !isUnder14(birthDate) &&            // gate <14 (cas orphelin SANS DOB saisie)
    acceptTerms &&
    password.length >= 8 &&
    password === confirm &&
    (!isMinor || emailValid(parentEmail)) &&
    !submitting;

  async function handleSubmit() {
    if (state.kind !== "valid" || !canSubmit || !token) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const { row } = state;
      // claim_token (PAS invitation_token) : on évite le consume générique ;
      // la liaison réelle de l'orphelin se fera en sous-unité 3.
      const result = await signUp(
        row.email,
        password,
        "ATHLETE",
        row.first_name ?? "",
        row.last_name ?? "",
        {
          claim_token: token,
          date_naissance: birthDate,
          ...(isMinor ? { parent_email: parentEmail.trim(), parental_consent_pending: true } : {}),
          consent_terms: true,
          consent_marketing: acceptMarketing,
        },
      );
      if ("error" in result && result.error) {
        setFormError(translateAuthError(result.error.message || "Création du compte échouée."));
        setSubmitting(false);
        return;
      }
      // Liaison orphelin = sous-unité 3. Pour l'instant on prépare le terrain :
      // redirection vers l'onboarding athlète.
      router.push("/athlete/onboarding");
    } catch (err) {
      console.error("[claim] signup exception:", err);
      setFormError("Une erreur est survenue. Réessaie.");
      setSubmitting(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────────
  if (state.kind === "loading") {
    return (
      <Shell>
        <p className="text-sm text-[#6B7280] text-center">Vérification du lien…</p>
      </Shell>
    );
  }

  // ── Erreur : token manquant / invalide / expiré / consommé ──
  if (state.kind === "missing" || state.kind === "invalid") {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#EF4444]/15">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          </div>
          <h1 className="font-head text-xl font-black text-white uppercase tracking-tight">Lien invalide</h1>
          <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
            {state.kind === "missing"
              ? "Ce lien d'invitation est incomplet."
              : "Ce lien n'est plus valide — il a peut-être expiré ou déjà été utilisé."}
          </p>
          <Link href="/auth" className="inline-block text-[13px] font-bold text-[#E63946] hover:text-white transition-colors">
            Aller à la connexion
          </Link>
        </div>
      </Shell>
    );
  }

  // ── Écran d'acceptation (token valide) ──────────────────────
  const { row } = state;
  return (
    <Shell>
      <div className="space-y-5">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
            Bienvenue{row.first_name ? ` ${row.first_name}` : ""} 👋
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Ton entraîneur a préparé ton profil. Crée ton compte pour le compléter.
          </p>
        </div>

        {/* Email verrouillé (clé de l'orphelin) */}
        <div>
          <label className={labelCls}>Courriel</label>
          <input type="email" value={row.email} readOnly aria-readonly className={inputLockedCls} />
        </div>

        {/* Date de naissance — obligatoire, branche l'âge */}
        <div>
          <label className={labelCls}>Date de naissance</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            readOnly={!!row.date_naissance}
            aria-readonly={!!row.date_naissance}
            className={row.date_naissance ? inputLockedCls : inputCls}
          />
          {age !== null && age >= 0 && (
            <p className="text-[11px] text-[#6b7280] mt-1">{age} ans</p>
          )}
        </div>

        {/* Branche <14 : email parental obligatoire */}
        {isMinor && (
          <div className="bg-[#F59E0B]/[0.06] border border-[#F59E0B]/20 rounded-lg p-4 space-y-2">
            <p className="text-[12px] font-bold text-[#F59E0B]">Tu as moins de 14 ans</p>
            <p className="text-[12px] text-[#FCD34D] leading-snug">
              Le consentement d&apos;un parent ou tuteur est obligatoire. Indique son courriel — il devra confirmer ton inscription.
            </p>
            <div>
              <label className={labelCls}>Courriel du parent / tuteur</label>
              <input
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="parent@exemple.com"
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* Mot de passe (14+ : l'athlète ; <14 : défini dans le contexte parental) */}
        <div>
          <label className={labelCls}>Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Au moins 8 caractères"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Confirme le mot de passe</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
          />
          {confirm.length > 0 && password !== confirm && (
            <p className="text-[11px] text-[#EF4444] mt-1">Les mots de passe ne correspondent pas.</p>
          )}
        </div>

        {/* Consentements (le plus tôt possible) */}
        <div className="space-y-2.5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#E63946]" />
            <span className="text-[12px] text-[#9CA3AF] leading-snug">
              J&apos;accepte les{" "}
              <Link href="/conditions" target="_blank" className="text-[#E63946] hover:text-white">conditions d&apos;utilisation</Link>{" "}
              et la{" "}
              <Link href="/confidentialite" target="_blank" className="text-[#E63946] hover:text-white">politique de confidentialité</Link>.
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={acceptMarketing} onChange={(e) => setAcceptMarketing(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#E63946]" />
            <span className="text-[12px] text-[#9CA3AF] leading-snug">
              J&apos;accepte de recevoir des communications marketing (optionnel).
            </span>
          </label>
        </div>

        {formError && (
          <p className="text-[13px] text-[#EF4444] font-semibold">{formError}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full h-12 rounded-lg bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-50 disabled:cursor-not-allowed text-white font-head font-bold text-[13px] uppercase tracking-widest transition-colors"
        >
          {submitting ? "Création…" : "Créer mon compte"}
        </button>

        {!isMinor && age === null && (
          <p className="text-[11px] text-[#6b7280] text-center">Indique ta date de naissance pour continuer.</p>
        )}
      </div>
    </Shell>
  );
}
