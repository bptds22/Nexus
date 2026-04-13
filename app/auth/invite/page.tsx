"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import Link from "next/link";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ═══════════════════════════════════════════════════════════════
   Athlete Invitation — Accept invite + set password
   Tone: "tu" (friendly, teenager-friendly, 30-second flow)
═══════════════════════════════════════════════════════════════ */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";
const inputCls = "w-full bg-[#111317] border border-white/10 rounded-lg px-4 py-3 text-[14px] text-white placeholder:text-[#6B7280] focus:border-[#E63946] outline-none transition-colors";

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="bg-[#111317] min-h-screen flex items-center justify-center text-[#6b7280]">Chargement...</div>}>
      <InviteContent />
    </Suspense>
  );
}

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const athleteName = searchParams.get("athlete") || "Marc-Antoine Tremblay";
  const coachName = searchParams.get("coach") || "Coach Bergeron";
  const schoolName = searchParams.get("school") || "Saint-Jean-Eudes";
  const firstName = athleteName.split(" ")[0];
  const lastName = athleteName.split(" ").slice(1).join(" ");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [activated, setActivated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentParental, setConsentParental] = useState(false);
  const [consentUnderstand, setConsentUnderstand] = useState(false);
  const [consentComms, setConsentComms] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const pwdValid = password.length >= 8;
  const pwdMatch = password === confirmPassword && confirmPassword.length > 0;
  const consentValid = consentPrivacy && consentParental && consentUnderstand;
  const canSubmit = pwdValid && pwdMatch && consentValid;

  const handleSubmit = () => {
    setAttemptedSubmit(true);
    if (!canSubmit) return;

    localStorage.setItem("nexus_user", JSON.stringify({
      firstName,
      lastName,
      email: "marc-antoine@gmail.com",
      role: "athlete",
      status: "active",
      onboarding_complete: true,
      institution: { name: schoolName },
      profile: { coach: coachName },
      privacy_consent: {
        privacy_policy_accepted: true,
        privacy_policy_version: "2026-04-v1",
        data_collection_accepted: true,
        parental_consent_acknowledged: true,
        consent_privacy_policy: new Date().toISOString(),
        consent_data_collection: new Date().toISOString(),
        consent_marketing: consentComms ? new Date().toISOString() : null,
        accepted_at: new Date().toISOString(),
        ip_hint: "masked",
      },
    }));

    setActivated(true);
    setTimeout(() => router.push("/athlete/dashboard"), 1500);
  };

  // Success screen
  if (activated) {
    return (
      <div className="hero-playbook bg-[#111317] min-h-screen flex items-center justify-center">
        <PlaybookBackground />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-full bg-[#22C55E]/15 flex items-center justify-center mx-auto mb-5 animate-[scaleIn_0.3s_ease-out]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h2 className="font-head text-2xl font-black text-white uppercase tracking-tight">Ton compte est activé!</h2>
          <p className="text-[14px] text-[#9CA3AF] mt-2">Redirection vers ton tableau de bord...</p>
        </div>
        <style jsx>{`
          @keyframes scaleIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex flex-col">
      <PlaybookBackground />

      <div className="flex-1 flex items-center justify-center relative py-12 px-6">
        <div className="relative z-10 w-full max-w-md">

          {/* Logo + subtitle */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <NexusLogo variant="white" height={40} priority />
            </div>
            <div className="inline-flex items-center gap-3 mb-6">
              <span className="w-6 h-px bg-[#E63946]" />
              <span className={`${label} text-[#E63946]`}>Plateforme de recrutement</span>
              <span className="w-6 h-px bg-[#E63946]" />
            </div>
          </div>

          {/* Card */}
          <div className="bg-[#1A1D24] border border-white/5 rounded-xl p-6 sm:p-8 space-y-6">

            {/* Welcome */}
            <div>
              <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
                Bienvenue sur Nexus, {firstName}!
              </h1>
              <p className="text-[14px] text-[#9CA3AF] mt-2 leading-relaxed">
                Ton coach <span className="text-white font-bold">{coachName}</span> de <span className="text-white font-bold">{schoolName}</span> t&apos;a invité à rejoindre la plateforme. Ton profil est déjà créé — il te reste juste à créer ton mot de passe.
              </p>
            </div>

            {/* What you can do */}
            <div className="bg-[#111317] border-l-[3px] border-[#3B82F6] rounded-r-lg p-4">
              <p className="text-[12px] font-bold text-white mb-2">Ce que tu pourras faire :</p>
              <ul className="space-y-1.5">
                {[
                  "Voir ton profil tel que les recruteurs le voient",
                  "Proposer des modifications à ton coach",
                  "Suivre combien de recruteurs consultent ton profil",
                  "Recevoir des notifications d'activité",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-[#9CA3AF]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" className="mt-0.5 shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Email (read-only) */}
              <div>
                <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Courriel</label>
                <input type="email" value="marc-antoine@gmail.com" readOnly className={`${inputCls} text-[#6B7280] cursor-not-allowed bg-[#0d0f13]`} />
              </div>

              {/* Password */}
              <div>
                <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Mot de passe <span className="text-[#E63946]">*</span></label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="Mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-white transition-colors" tabIndex={-1} aria-label="Afficher">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </div>
                <p className={`text-xs mt-1.5 ${pwdValid ? "text-[#22C55E]" : "text-[#6B7280]"}`}>
                  {pwdValid ? "✓" : "•"} Minimum 8 caractères
                </p>
              </div>

              {/* Confirm password */}
              <div>
                <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Confirmer le mot de passe <span className="text-[#E63946]">*</span></label>
                <div className="relative">
                  <input
                    type={showConfirmPwd ? "text" : "password"}
                    placeholder="Mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputCls} pr-10 ${confirmPassword && !pwdMatch ? "border-[#EF4444]" : ""}`}
                  />
                  <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-white transition-colors" tabIndex={-1} aria-label="Afficher">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </div>
                {confirmPassword && !pwdMatch && (
                  <p className="text-xs mt-1.5 text-[#EF4444]">Les mots de passe ne correspondent pas</p>
                )}
              </div>
            </div>

            {/* ── Loi 25 Privacy + Parental Consent ── */}
            <div className="bg-[#1A1D24] rounded-lg border-l-4 border-[#EAB308] p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
                <span className="font-head font-bold text-[13px] text-white">Protection de tes données</span>
              </div>

              {/* Checkbox 1 — Privacy policy */}
              <label className={`flex items-start gap-3 cursor-pointer group ${attemptedSubmit && !consentPrivacy ? "animate-shake" : ""}`}>
                <input type="checkbox" checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentPrivacy ? "bg-[#E63946] border-[#E63946]" : attemptedSubmit && !consentPrivacy ? "border-[#EF4444]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                  {consentPrivacy && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[11px] text-[#9CA3AF] leading-snug">J&apos;ai lu et j&apos;accepte la <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-[#E63946] hover:underline" onClick={(e) => e.stopPropagation()}>Politique de confidentialité</a> et les <a href="/conditions" target="_blank" rel="noopener noreferrer" className="text-[#E63946] hover:underline" onClick={(e) => e.stopPropagation()}>Conditions d&apos;utilisation</a> de Nexus. <span className="text-[#EF4444]">*</span></span>
              </label>

              {/* Checkbox 2 — Parental consent */}
              <label className={`flex items-start gap-3 cursor-pointer group ${attemptedSubmit && !consentParental ? "animate-shake" : ""}`}>
                <input type="checkbox" checked={consentParental} onChange={(e) => setConsentParental(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentParental ? "bg-[#E63946] border-[#E63946]" : attemptedSubmit && !consentParental ? "border-[#EF4444]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                  {consentParental && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[11px] text-[#9CA3AF] leading-snug">Je confirme que mon parent ou tuteur légal a autorisé la publication de mon profil sur Nexus et la collecte de mes données personnelles. <span className="text-[#EF4444]">*</span></span>
              </label>

              {/* Checkbox 3 — Understanding */}
              <label className={`flex items-start gap-3 cursor-pointer group ${attemptedSubmit && !consentUnderstand ? "animate-shake" : ""}`}>
                <input type="checkbox" checked={consentUnderstand} onChange={(e) => setConsentUnderstand(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentUnderstand ? "bg-[#E63946] border-[#E63946]" : attemptedSubmit && !consentUnderstand ? "border-[#EF4444]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                  {consentUnderstand && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <div>
                  <span className="text-[11px] text-[#9CA3AF] leading-snug">Je comprends que : <span className="text-[#EF4444]">*</span></span>
                  <ul className="text-[10px] text-[#6B7280] mt-1 space-y-0.5 list-disc list-inside pl-1">
                    <li>Mon profil sera visible par des recruteurs CÉGEP vérifiés</li>
                    <li>Mon coach peut modifier mon profil</li>
                    <li>Mon parent peut retirer le consentement à tout moment</li>
                    <li>Je peux demander la suppression de mon compte</li>
                  </ul>
                </div>
              </label>

              {/* Checkbox 4 — Communications marketing (optional) */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={consentComms} onChange={(e) => setConsentComms(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentComms ? "bg-[#E63946] border-[#E63946]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                  {consentComms && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[11px] text-[#6B7280] leading-snug">J&apos;accepte de recevoir des <a href="/communications-marketing" target="_blank" rel="noopener noreferrer" className="text-[#E63946] hover:underline" onClick={(e) => e.stopPropagation()}>communications marketing</a> de Nexus (nouvelles fonctionnalités, conseils, promotions). Maximum 2 courriels par mois. <span className="text-[10px] text-[#4a4d56]">(optionnel)</span></span>
              </label>

              {attemptedSubmit && !consentValid && (
                <p className="text-[11px] text-[#EF4444]">Tu dois accepter toutes les conditions requises pour continuer.</p>
              )}
            </div>

            {/* Age confirmation */}
            <p className="text-[10px] text-[#4a4d56] text-center">En activant ton compte, tu confirmes avoir au moins 13 ans.</p>

            {/* CTA */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-3.5 rounded-lg font-head font-bold text-[14px] uppercase tracking-widest transition-all ${
                canSubmit
                  ? "bg-[#E63946] text-white hover:bg-[#D42B22] hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-[0.98] cursor-pointer"
                  : "bg-[#E63946]/30 text-white/40 cursor-not-allowed"
              }`}
            >
              Activer mon compte →
            </button>

            {/* Footer links */}
            <div className="text-center space-y-2 pt-2">
              <p className="text-[12px] text-[#4a4d56]">
                Tu n&apos;es pas {athleteName}?{" "}
                <button type="button" onClick={() => { setToast("Contacte ton coach si cette invitation ne t'est pas destinée"); setTimeout(() => setToast(null), 3000); }} className="text-[#9CA3AF] hover:text-white transition-colors underline">
                  Signaler
                </button>
              </p>
              <p className="text-[13px] text-[#9CA3AF]">
                Déjà un compte?{" "}
                <Link href="/auth" className="text-[#9CA3AF] font-bold hover:text-[#E63946] transition-colors">Se connecter</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg">
            <span className="text-[13px] font-bold text-white">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
