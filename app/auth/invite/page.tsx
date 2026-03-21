"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
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

  const pwdValid = password.length >= 8;
  const pwdMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = pwdValid && pwdMatch;

  const handleSubmit = () => {
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
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image src="/brand/White%20red%20logo%20@4x.png" alt="Nexus" width={36} height={36} className="object-contain" />
              <span className="font-head font-black text-white text-lg tracking-[0.06em] uppercase">Nexus</span>
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

            {/* Consent */}
            <p className="text-[11px] text-[#4a4d56] leading-relaxed">
              En créant ton compte, tu confirmes que ton parent ou tuteur a autorisé la publication de ton profil sur Nexus.
            </p>

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
