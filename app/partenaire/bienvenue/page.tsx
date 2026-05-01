"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/bienvenue — first-login welcome flow
   Two stacked sections, both required:
     1. Password reset (replace admin-issued temp password)
     2. Loi 25 / editorial-use terms acceptance

   The middleware (Phase 2.5 step 3) gates /partenaire/* routes
   behind both flags being non-NULL, so this page is the only
   reachable destination for a partner with incomplete welcome
   state.

   No sidebar — the partner layout (modified alongside this
   commit) detects pathname === '/partenaire/bienvenue' and
   renders children full-screen.
═══════════════════════════════════════════════════════════════ */

const TERMS_VERSION = "v1";

interface PartnerFlags {
  id: string;
  terms_accepted_at: string | null;
  password_reset_completed_at: string | null;
}

const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

function RuleRow({ label, status }: { label: string; status: "pending" | "ok" | "fail" }) {
  const color = status === "ok" ? "#22C55E" : status === "fail" ? "#EF4444" : "#6B7280";
  return (
    <li className="flex items-center gap-2 text-[12px]" style={{ color }}>
      {status === "ok" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
      ) : status === "fail" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
      ) : (
        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#6B7280" }} />
      )}
      <span>{label}</span>
    </li>
  );
}

function CompletedRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg px-4 py-3">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#22C55E" stroke="none">
        <circle cx="12" cy="12" r="10" />
        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="text-[14px] font-bold text-[#22C55E]">{label}</span>
    </div>
  );
}

/** Renders text with **bold** segments inline. */
function BoldRich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const TERMS_BULLETS: string[] = [
  "**Usage éditorial uniquement** — J'utiliserai les données et cartes des athlètes uniquement à des fins éditoriales et journalistiques. Je n'utiliserai pas ces données pour le recrutement, la revente, ou tout autre usage commercial non lié à la production de contenu.",
  "**Non-redistribution** — Je ne redistribuerai pas les cartes téléchargées, les données d'athlètes, ni les classements en dehors de mes propres publications éditoriales.",
  "**Respect de la vie privée des mineurs** — Je reconnais que les données des athlètes mineurs sont accessibles uniquement avec consentement parental préalable. Je m'engage à traiter ces données avec une attention particulière, conformément à la Loi 25 du Québec sur la protection des renseignements personnels.",
  "**Attribution Nexus** — Je m'engage à mentionner Nexus comme source des données et des cartes utilisées dans mes publications, lorsque cela est pertinent.",
];

export default function PartnerBienvenuePage() {
  const router = useRouter();
  const [partner, setPartner] = useState<PartnerFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Section 1 state
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdDone, setPwdDone] = useState(false);

  // Section 2 state
  const [termsChecked, setTermsChecked] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);

  const showToast = (kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth");
        return;
      }
      const { data, error } = await supabase
        .from("media_partners")
        .select("id, terms_accepted_at, password_reset_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) {
        console.error("[bienvenue] partner load:", error);
        showToast("error", "Impossible de charger le profil partenaire.");
        setLoading(false);
        return;
      }
      const flags = data as PartnerFlags;
      setPartner(flags);
      if (flags.password_reset_completed_at) setPwdDone(true);
      if (flags.terms_accepted_at && flags.password_reset_completed_at) {
        // Already complete — middleware will eventually do this,
        // but if a partner navigates here directly we still bounce.
        router.replace("/partenaire");
        return;
      }
      setLoading(false);
    })();
  }, [router]);

  // Live password validation
  const ruleLen = password.length === 0 ? "pending" : password.length >= 10 ? "ok" : "fail";
  const ruleNum = password.length === 0 ? "pending" : /\d/.test(password) ? "ok" : "fail";
  const ruleUpper = password.length === 0 ? "pending" : /[A-Z]/.test(password) ? "ok" : "fail";
  const ruleMatch = confirm.length === 0 ? "pending" : password === confirm ? "ok" : "fail";
  const allRulesOk = ruleLen === "ok" && ruleNum === "ok" && ruleUpper === "ok" && ruleMatch === "ok";

  async function handlePasswordSubmit() {
    if (!allRulesOk || savingPwd || !partner) return;
    setSavingPwd(true);
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.updateUser({ password });
    if (authErr) {
      console.error("[bienvenue] auth.updateUser:", authErr);
      showToast("error", "Erreur lors de la mise à jour du mot de passe. Veuillez réessayer.");
      setSavingPwd(false);
      return;
    }
    const nowIso = new Date().toISOString();
    const { error: dbErr } = await supabase
      .from("media_partners")
      .update({ password_reset_completed_at: nowIso })
      .eq("id", partner.id);
    if (dbErr) {
      console.error("[bienvenue] partner update password flag:", dbErr);
      showToast("error", `Mot de passe changé mais flag non enregistré : ${dbErr.message}`);
      setSavingPwd(false);
      return;
    }
    setPwdDone(true);
    setSavingPwd(false);
    setPassword("");
    setConfirm("");
    showToast("success", "Mot de passe défini.");
  }

  async function handleTermsSubmit() {
    if (!termsChecked || !pwdDone || savingTerms || !partner) return;
    setSavingTerms(true);
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("media_partners")
      .update({ terms_accepted_at: nowIso, terms_version: TERMS_VERSION })
      .eq("id", partner.id);
    if (error) {
      console.error("[bienvenue] partner update terms:", error);
      showToast("error", `Erreur lors de l'enregistrement des conditions : ${error.message}`);
      setSavingTerms(false);
      return;
    }
    router.push("/partenaire");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-6 py-12 max-w-[640px] mx-auto">
      <div className="flex justify-center mb-8">
        <NexusLogo variant="white" height={40} priority />
      </div>

      <div className="text-center mb-10">
        <h1 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">Bienvenue sur Nexus</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-2">Quelques étapes avant d&apos;accéder à votre tableau de bord</p>
      </div>

      <div className="space-y-5">
        {/* ── Section 1 — Password reset ───────────────────── */}
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="font-head text-[14px] font-black text-[#E63946] tracking-wider">1.</span>
            <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight">Nouveau mot de passe</h2>
          </div>

          {pwdDone ? (
            <CompletedRow label="Mot de passe défini ✓" />
          ) : (
            <>
              <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
                Vous vous êtes connecté avec un mot de passe temporaire. Choisissez un nouveau mot de passe sécurisé.
              </p>

              <div className="space-y-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nouveau mot de passe"
                  autoComplete="new-password"
                  className={inputCls}
                />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirmer le mot de passe"
                  autoComplete="new-password"
                  className={inputCls}
                />
              </div>

              <ul className="space-y-1.5 pl-1">
                <RuleRow label="Minimum 10 caractères" status={ruleLen} />
                <RuleRow label="Au moins 1 chiffre" status={ruleNum} />
                <RuleRow label="Au moins 1 lettre majuscule" status={ruleUpper} />
                <RuleRow label="Les mots de passe doivent correspondre" status={ruleMatch} />
              </ul>

              <button
                type="button"
                onClick={handlePasswordSubmit}
                disabled={!allRulesOk || savingPwd}
                className="w-full bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-bold py-3 rounded-lg transition-colors uppercase tracking-wider"
              >
                {savingPwd ? "Enregistrement…" : "Définir le mot de passe"}
              </button>
            </>
          )}
        </div>

        {/* ── Section 2 — Terms acceptance ─────────────────── */}
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="font-head text-[14px] font-black text-[#E63946] tracking-wider">2.</span>
            <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight">Conditions d&apos;utilisation</h2>
          </div>

          {!pwdDone ? (
            <div className="bg-[#13151a] border border-[#2D3748] rounded-lg px-4 py-6 text-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <p className="text-[13px] text-[#6B7280]">Complétez l&apos;étape 1 pour continuer</p>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
                Veuillez lire et accepter les conditions suivantes pour accéder aux données des athlètes Nexus.
              </p>

              <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5 space-y-3 text-[13px] text-[#c0c4cc] leading-relaxed">
                <p>En tant que partenaire média de Nexus, je m&apos;engage à respecter les conditions suivantes&nbsp;:</p>
                {TERMS_BULLETS.map((bullet, i) => (
                  <p key={i} className="pl-3 border-l-2 border-[#2D3748]">
                    <BoldRich text={bullet} />
                  </p>
                ))}
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={(e) => setTermsChecked(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${termsChecked ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56] group-hover:border-[#6b7280]"}`}>
                  {termsChecked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  )}
                </div>
                <span className="text-[13px] text-[#c0c4cc] leading-snug">
                  J&apos;ai lu et j&apos;accepte ces conditions d&apos;utilisation des données.
                </span>
              </label>

              <button
                type="button"
                onClick={handleTermsSubmit}
                disabled={!termsChecked || savingTerms}
                className="w-full bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-bold py-3 rounded-lg transition-colors uppercase tracking-wider"
              >
                {savingTerms ? "Enregistrement…" : "Accepter et accéder au tableau de bord"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className={`bg-[#1A1D24] border rounded-lg px-5 py-3 shadow-lg flex items-center gap-3 ${toast.kind === "success" ? "border-[#22C55E]/30" : "border-[#EF4444]/30"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={toast.kind === "success" ? "#22C55E" : "#EF4444"} strokeWidth="2.5" strokeLinecap="round">
              {toast.kind === "success" ? <path d="M20 6L9 17l-5-5" /> : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /></>}
            </svg>
            <span className="text-[13px] font-bold text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
