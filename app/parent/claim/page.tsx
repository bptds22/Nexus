"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/utils/translateAuthError";
import NexusLogo from "@/components/ui/NexusLogo";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ═══════════════════════════════════════════════════════════════
   Portal parental — Lot 1a. Page de claim parent AUTONOME (web only).

   Destination du lien ${APP_URL}/parent/claim?token=… ajouté à l'email
   send-parent-notice (avis 14-17). Distinct du claim ATHLÈTE (/claim).

   - Résout le token via resolve_parent_invitation (anon).
   - Token invalide/expiré/déjà utilisé/athlète déjà lié → écran d'erreur.
   - Valide → email pré-rempli + VERROUILLÉ (= parent_email de l'invitation).
   - signUp (rôle PARENT dans la metadata) → claim_parent_invitation(token)
     pose le rôle PARENT, insère parent_athletes, marque claimed_at.
   ═══════════════════════════════════════════════════════════════ */

type ResolveState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "invalid"; reason: string }
  | { kind: "valid"; parentEmail: string };

const inputCls =
  "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-white placeholder-[#4a4d56] focus:outline-none focus:border-[#E63946]/50 transition-colors";
const inputLockedCls =
  "w-full bg-[#0e1014] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#9CA3AF] cursor-not-allowed";
const labelCls =
  "block text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1.5";

const RESOLVE_MSG: Record<string, string> = {
  not_found: "Ce lien d'invitation est introuvable.",
  expired: "Ce lien a expiré. Contactez-nous pour en recevoir un nouveau.",
  already_claimed: "Ce lien a déjà été utilisé pour créer un compte parent.",
  athlete_already_linked: "Un compte parent est déjà associé à cet athlète.",
};
const CLAIM_MSG: Record<string, string> = {
  ...RESOLVE_MSG,
  email_mismatch: "Le courriel du compte ne correspond pas à l'invitation.",
  not_authenticated: "Session non établie. Réessayez de vous connecter.",
};

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

export default function ParentClaimPage() {
  return (
    <Suspense>
      <ParentClaimContent />
    </Suspense>
  );
}

function ParentClaimContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<ResolveState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Résolution du token au mount.
  useEffect(() => {
    if (!token) { setState({ kind: "missing" }); return; }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("resolve_parent_invitation", { p_token: token });
      if (cancelled) return;
      if (error) {
        console.error("[parent/claim] resolve:", error);
        setState({ kind: "invalid", reason: "not_found" });
        return;
      }
      const row = ((data as Array<{ valid: boolean; reason: string; parent_email: string | null }> | null) ?? [])[0];
      if (!row || !row.valid) {
        setState({ kind: "invalid", reason: row?.reason ?? "not_found" });
        return;
      }
      setState({ kind: "valid", parentEmail: row.parent_email ?? "" });
    })();
    return () => { cancelled = true; };
  }, [token]);

  const canSubmit =
    state.kind === "valid" &&
    acceptTerms &&
    password.length >= 8 &&
    password === confirm &&
    !submitting;

  async function handleSubmit() {
    if (state.kind !== "valid" || !canSubmit || !token) return;
    setSubmitting(true);
    setFormError(null);
    const supabase = createClient();
    try {
      // 1. Création du compte auth — rôle PARENT dans la metadata (handle_new_auth_user
      //    crée la row public.users ; claim_parent_invitation confirme le rôle).
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: state.parentEmail,
        password,
        options: { data: { role: "PARENT", first_name: "", last_name: "" } },
      });
      if (signUpError) {
        setFormError(translateAuthError(signUpError.message || "Création du compte échouée."));
        setSubmitting(false);
        return;
      }

      // 2. S'assurer d'une session (auto-confirm local ; sinon tenter un sign-in).
      let hasSession = !!signUpData.session;
      if (!hasSession) {
        const { data: sInData } = await supabase.auth.signInWithPassword({ email: state.parentEmail, password });
        hasSession = !!sInData?.session;
      }
      if (!hasSession) {
        setFormError("Compte créé. Confirmez votre courriel, puis rouvrez ce lien pour finaliser.");
        setSubmitting(false);
        return;
      }

      // 3. Claim serveur : rôle PARENT + parent_athletes + claimed_at (garde 1:1).
      const { data: claimData, error: claimError } = await supabase.rpc("claim_parent_invitation", { p_token: token });
      if (claimError) {
        setFormError("Une erreur est survenue lors de la liaison. Réessayez.");
        setSubmitting(false);
        return;
      }
      const claim = claimData as { ok: boolean; reason?: string };
      if (!claim?.ok) {
        setFormError(CLAIM_MSG[claim?.reason ?? ""] ?? "Impossible de finaliser le compte parent.");
        setSubmitting(false);
        return;
      }
      router.push("/parent");
    } catch (err) {
      console.error("[parent/claim] submit exception:", err);
      setFormError("Une erreur est survenue. Réessayez.");
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return <Shell><p className="text-sm text-[#6B7280] text-center">Vérification du lien…</p></Shell>;
  }

  if (state.kind === "missing" || state.kind === "invalid") {
    const reason = state.kind === "invalid" ? state.reason : "missing";
    return (
      <Shell>
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#EF4444]/15">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          </div>
          <h1 className="font-head text-xl font-black text-white uppercase tracking-tight">Lien invalide</h1>
          <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
            {reason === "missing" ? "Ce lien d'invitation est incomplet." : (RESOLVE_MSG[reason] ?? "Ce lien n'est plus valide.")}
          </p>
          <Link href="/auth" className="inline-block text-[13px] font-bold text-[#E63946] hover:text-white transition-colors">
            Aller à la connexion
          </Link>
        </div>
      </Shell>
    );
  }

  // Écran valide.
  return (
    <Shell>
      <div className="space-y-5">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Compte parent</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Créez votre compte pour gérer les consentements et suivre l&apos;activité liée au profil de votre enfant.
          </p>
        </div>

        <div>
          <label className={labelCls}>Courriel</label>
          <input type="email" value={state.parentEmail} readOnly aria-readonly className={inputLockedCls} />
        </div>

        <div>
          <label className={labelCls}>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Au moins 8 caractères" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Confirme le mot de passe</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          {confirm.length > 0 && password !== confirm && (
            <p className="text-[11px] text-[#EF4444] mt-1">Les mots de passe ne correspondent pas.</p>
          )}
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#E63946]" />
          <span className="text-[12px] text-[#9CA3AF] leading-snug">
            J&apos;accepte les{" "}
            <Link href="/conditions" target="_blank" className="text-[#E63946] hover:text-white">conditions d&apos;utilisation</Link>{" "}
            et la{" "}
            <Link href="/confidentialite" target="_blank" className="text-[#E63946] hover:text-white">politique de confidentialité</Link>.
          </span>
        </label>

        {formError && <p className="text-[13px] text-[#EF4444] font-semibold">{formError}</p>}

        <button type="button" onClick={handleSubmit} disabled={!canSubmit}
          className="w-full h-12 rounded-lg bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-50 disabled:cursor-not-allowed text-white font-head font-bold text-[13px] uppercase tracking-widest transition-colors">
          {submitting ? "Création…" : "Créer mon compte parent"}
        </button>
      </div>
    </Shell>
  );
}
