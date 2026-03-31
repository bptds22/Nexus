"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ═══════════════════════════════════════════════════════════════
   Admin Invitation — Director accepts invite + creates account
   Handles BOTH school (type=school) and CÉGEP (type=cegep).
   Tone: "vous" (formal — addressed to a director/administrator)
═══════════════════════════════════════════════════════════════ */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";
const inputCls = "w-full bg-[#111317] border border-white/10 rounded-lg px-4 py-3 text-[14px] text-white placeholder:text-[#6B7280] focus:border-[#E63946] outline-none transition-colors";

export default function InviteAdminPage() {
  return (
    <Suspense fallback={<div className="bg-[#111317] min-h-screen flex items-center justify-center text-[#6b7280]">Chargement...</div>}>
      <InviteAdminContent />
    </Suspense>
  );
}

function InviteAdminContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Determine type: school (default) or cegep
  const inviteType = searchParams.get("type") === "cegep" ? "cegep" : "school";
  const isCegep = inviteType === "cegep";

  // Params adapt to type
  const institutionName = isCegep
    ? (searchParams.get("cegep") || "CÉGEP Garneau")
    : (searchParams.get("school") || "De Mortagne");
  const inviterName = isCegep
    ? (searchParams.get("recruiter") || "Pierre Dufour")
    : (searchParams.get("coach") || "Patrick Tremblay");
  const emailParam = searchParams.get("email") || (isCegep ? "directeur@cegep.qc.ca" : "directeur@ecole.qc.ca");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [alsoActive, setAlsoActive] = useState(false); // also coach (school) or also recruiter (cegep)
  const [activated, setActivated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentResponsibility, setConsentResponsibility] = useState(false);
  const [consentComms, setConsentComms] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const pwdValid = password.length >= 8;
  const pwdMatch = password === confirmPassword && confirmPassword.length > 0;
  const consentValid = consentPrivacy && consentResponsibility;
  const canSubmit = firstName && lastName && pwdValid && pwdMatch && consentValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!canSubmit) return;

    const privacyData = {
      privacy_policy_accepted: true, privacy_policy_version: "2026-03-v1",
      data_collection_accepted: true, data_responsibility_acknowledged: true,
      communications_opted_in: consentComms, accepted_at: new Date().toISOString(), ip_hint: "masked",
    };

    if (isCegep) {
      localStorage.setItem("nexus_user", JSON.stringify({
        firstName, lastName, email: emailParam,
        role: "recruiter", status: "active", onboarding_complete: true,
        is_cegep_admin: true, is_also_recruiter: alsoActive, cegep_admin_type: "owner",
        institution: { name: institutionName }, profile: { title },
        subscription: { tier: "free", status: "active", billing_cycle: null, current_period_end: null, trial_days_remaining: null, cancel_at_period_end: false },
        tier: "free", privacy_consent: privacyData,
      }));
    } else {
      localStorage.setItem("nexus_user", JSON.stringify({
        firstName, lastName, email: emailParam,
        role: "coach", status: "active", onboarding_complete: true,
        is_school_admin: true, is_also_coach: alsoActive, school_admin_type: "owner",
        institution: { name: institutionName }, profile: { title },
        subscription: { tier: "free", status: "active", billing_cycle: null, current_period_end: null, trial_days_remaining: null, cancel_at_period_end: false },
        tier: "free", privacy_consent: privacyData,
      }));
    }

    setActivated(true);
    setTimeout(() => router.push(isCegep ? "/recruteur/tableau-de-bord" : "/coach/tableau-de-bord"), 1500);
  };

  // Feature lists per type
  const features = isCegep
    ? [
        "Tableau de bord complet de votre CÉGEP",
        "Supervision de tous les recruteurs",
        "Pipeline de recrutement global et statistiques",
        "Recrues confirmées et résultats de saison",
        "Gestion des accès et invitations",
        "Le tout gratuitement — aucun abonnement requis",
      ]
    : [
        "Tableau de bord complet de votre école",
        "Supervision de tous les entraîneurs et athlètes",
        "Statistiques de recrutement et placements",
        "Gestion des accès et invitations",
        "Le tout gratuitement — aucun abonnement requis",
      ];

  const checkboxLabel = isCegep
    ? "Je suis aussi recruteur — je veux gérer mon propre pipeline d'athlètes en plus de superviser le CÉGEP"
    : "Je suis aussi entraîneur — je veux créer mes propres profils d'athlètes en plus de superviser l'école";

  const inviteBody = isCegep
    ? `vous invite à superviser le programme de recrutement sportif de votre CÉGEP sur Nexus.`
    : `vous invite à superviser le programme sportif de votre école sur Nexus.`;

  const successText = isCegep
    ? "Vous avez accès à toutes les fonctionnalités de gestion de CÉGEP."
    : "Vous avez accès à toutes les fonctionnalités de gestion d'école.";

  /* ── Success screen ── */
  if (activated) {
    return (
      <div className="hero-playbook bg-[#111317] min-h-screen flex items-center justify-center">
        <PlaybookBackground />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-full bg-[#DAB65A]/15 flex items-center justify-center mx-auto mb-5 animate-[scaleIn_0.3s_ease-out]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" /><circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" />
            </svg>
          </div>
          <h2 className="font-head text-2xl font-black text-white uppercase tracking-tight">Votre compte directeur est activé!</h2>
          <p className="text-[14px] text-[#9CA3AF] mt-2">{successText}</p>
        </div>
        <style jsx>{`
          @keyframes scaleIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex items-center justify-center relative px-4 py-12">
      <PlaybookBackground />

      <div className="relative z-10 w-full max-w-[520px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-3 mb-2">
            <Image src="/brand/White%20red%20logo%20@4x.png" alt="Nexus" width={36} height={36} className="object-contain" />
            <span className="font-head font-black text-white text-lg tracking-[0.06em] uppercase">Nexus</span>
          </Link>
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#6b7280]">Plateforme de recrutement</p>
        </div>

        {/* Card */}
        <div className="bg-[#1A1D24] border border-white/5 rounded-xl p-6 sm:p-8">
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight mb-2">
            Bienvenue sur Nexus!
          </h1>
          <p className="text-[14px] text-[#9CA3AF] leading-relaxed mb-6">
            <span className="text-white font-semibold">{inviterName}</span> {isCegep ? "du" : "de"} <span className="text-white font-semibold">{institutionName}</span> {inviteBody}
          </p>

          {/* Info card */}
          <div className="bg-[#111317] rounded-xl p-4 mb-6 border-l-2 border-[#DAB65A]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#DAB65A]/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" /><circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-white mb-2">En tant que directeur sportif, vous aurez accès à :</p>
                <ul className="space-y-1.5">
                  {features.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                      <span className="text-[12px] text-[#9CA3AF]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Courriel</label>
              <input type="email" value={emailParam} readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Prénom <span className="text-[#EF4444]">*</span></label>
                <input type="text" placeholder="Marie" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Nom <span className="text-[#EF4444]">*</span></label>
                <input type="text" placeholder="Tremblay" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Titre / Poste</label>
              <input type="text" placeholder={isCegep ? "Ex: Coordonnateur des sports" : "Ex: Directeur des services aux élèves et du sport"} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Mot de passe <span className="text-[#EF4444]">*</span></label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} placeholder="Minimum 8 caractères" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-white transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={showPwd ? "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" : "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"} />{!showPwd && <circle cx="12" cy="12" r="3" />}{showPwd && <line x1="1" y1="1" x2="23" y2="23" />}</svg>
                </button>
              </div>
              <p className={`text-xs mt-1.5 transition-colors ${pwdValid ? "text-[#22C55E]" : "text-[#6B7280]"}`}>
                {pwdValid ? "✓" : "•"} Minimum 8 caractères
              </p>
            </div>

            <div>
              <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Confirmer le mot de passe <span className="text-[#EF4444]">*</span></label>
              <div className="relative">
                <input type={showConfirmPwd ? "text" : "password"} placeholder="Confirmer" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-white transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={showConfirmPwd ? "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" : "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"} />{!showConfirmPwd && <circle cx="12" cy="12" r="3" />}{showConfirmPwd && <line x1="1" y1="1" x2="23" y2="23" />}</svg>
                </button>
              </div>
              {confirmPassword.length > 0 && !pwdMatch && (
                <p className="text-xs text-[#EF4444] mt-1">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            {/* Also coach/recruiter checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group py-2">
              <input type="checkbox" checked={alsoActive} onChange={(e) => setAlsoActive(e.target.checked)} className="sr-only" />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${alsoActive ? "bg-[#E63946] border-[#E63946]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                {alsoActive && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <span className="text-[13px] text-[#9CA3AF] leading-snug">{checkboxLabel}</span>
            </label>

            {/* ── Loi 25 Privacy Consent (Director) ── */}
            <div className="bg-[#1A1D24] rounded-lg border border-white/10 p-4 space-y-3">
              {/* Checkbox 1 — Privacy + terms */}
              <label className={`flex items-start gap-3 cursor-pointer group ${attemptedSubmit && !consentPrivacy ? "animate-shake" : ""}`}>
                <input type="checkbox" checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentPrivacy ? "bg-[#E63946] border-[#E63946]" : attemptedSubmit && !consentPrivacy ? "border-[#EF4444]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                  {consentPrivacy && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[11px] text-[#9CA3AF] leading-snug">J&apos;ai lu et j&apos;accepte la <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-[#E63946] hover:underline" onClick={(e) => e.stopPropagation()}>Politique de confidentialité</a> et les <a href="/conditions" target="_blank" rel="noopener noreferrer" className="text-[#E63946] hover:underline" onClick={(e) => e.stopPropagation()}>Conditions d&apos;utilisation</a> de Nexus, conformément à la Loi 25. <span className="text-[#EF4444]">*</span></span>
              </label>

              {/* Checkbox 2 — Data responsibility */}
              <label className={`flex items-start gap-3 cursor-pointer group ${attemptedSubmit && !consentResponsibility ? "animate-shake" : ""}`}>
                <input type="checkbox" checked={consentResponsibility} onChange={(e) => setConsentResponsibility(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentResponsibility ? "bg-[#E63946] border-[#E63946]" : attemptedSubmit && !consentResponsibility ? "border-[#EF4444]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                  {consentResponsibility && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[11px] text-[#9CA3AF] leading-snug">En tant que directeur sportif, je comprends que j&apos;aurai accès aux données d&apos;athlètes mineurs et que je m&apos;engage à respecter la confidentialité de ces informations. <span className="text-[#EF4444]">*</span></span>
              </label>

              {/* Checkbox 3 — Communications (optional) */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={consentComms} onChange={(e) => setConsentComms(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentComms ? "bg-[#E63946] border-[#E63946]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                  {consentComms && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[11px] text-[#6B7280] leading-snug">J&apos;accepte de recevoir des communications de Nexus concernant les mises à jour et les nouvelles fonctionnalités. <span className="text-[10px]">(optionnel)</span></span>
              </label>

              {attemptedSubmit && !consentValid && (
                <p className="text-[11px] text-[#EF4444]">Vous devez accepter la politique de confidentialité pour continuer.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full h-12 rounded-lg font-head font-black text-sm uppercase tracking-widest transition-all ${
                canSubmit
                  ? "bg-[#E63946] text-white hover:bg-[#D42B22] hover:shadow-[0_8px_28px_rgba(230,57,70,0.38)] hover:-translate-y-0.5 cursor-pointer"
                  : "bg-[#2D3748] text-[#6B7280] cursor-not-allowed"
              }`}
            >
              Activer mon compte directeur →
            </button>
          </form>

          <p className="text-center text-[11px] text-[#4a4d56] mt-4">
            Vous n&apos;êtes pas le directeur {isCegep ? "du" : "de"} {institutionName}?{" "}
            <button type="button" onClick={() => { setToast(`Contactez ${isCegep ? "le recruteur" : "le coach"} qui vous a invité`); setTimeout(() => setToast(null), 3000); }} className="text-[#6B7280] underline hover:text-white transition-colors">
              En savoir plus
            </button>
          </p>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
