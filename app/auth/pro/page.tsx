"use client";

import { useState } from "react";
import NexusLogo from "@/components/ui/NexusLogo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import ErrorToast, { type ErrorToastData } from "@/components/ui/ErrorToast";
import { translateAuthError } from "@/lib/utils/translateAuthError";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Pro Signup (Coach / Recruiter / Coordinator)
   Separate page from athlete-first main signup.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";
const inputClass =
  "w-full h-11 px-4 bg-[#111317] border border-white/10 rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-[#E63946] focus:outline-none transition-colors";

function EyeToggle({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-white transition-colors" tabIndex={-1} aria-label="Afficher">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d={show ? "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" : "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"} />
        {!show && <circle cx="12" cy="12" r="3" />}
        {show && <line x1="1" y1="1" x2="23" y2="23" />}
      </svg>
    </button>
  );
}

type ProRole = "scolaire" | "collegial" | "ligue_civile";

const ROLE_CARDS: { value: ProRole; title: string; subtitle: string; icon: React.ReactNode }[] = [
  {
    value: "scolaire",
    title: "Entraîneur d'école secondaire",
    subtitle: "Crée des profils pour tes athlètes et donne-leur de la visibilité auprès des recruteurs",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01"/></svg>,
  },
  {
    value: "collegial",
    title: "Recruteur CÉGEP",
    subtitle: "Trouve et recrute les meilleurs athlètes du secondaire pour ton programme sportif",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  },
  {
    value: "ligue_civile",
    title: "Ligue ou club sportif",
    subtitle: "Donne de la visibilité aux athlètes de ta ligue ou de ton club sportif",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2"/><path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2"/><path d="M6 3h12v6a6 6 0 01-12 0V3z"/><path d="M12 15v3M8 21h8"/></svg>,
  },
];

const CTA_LABELS: Record<ProRole, string> = {
  scolaire: "Créer mon compte entraîneur",
  collegial: "Créer mon compte recruteur",
  ligue_civile: "Créer mon compte",
};

export default function ProSignupPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<ProRole | "">("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [shakeFields, setShakeFields] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorToast, setErrorToast] = useState<ErrorToastData | null>(null);
  const [consentPolicy, setConsentPolicy] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);

  const pwdMeetsMin = password.length >= 8;
  const pwdMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const signupValid = firstName && lastName && email && pwdMeetsMin && !pwdMismatch && selectedRole && consentPolicy && consentData;

  const fieldErr = (filled: boolean) => submitted && !filled ? "border-[#EF4444]" : "";

  const ROLE_MAP: Record<ProRole, 'COACH' | 'RECRUTEUR'> = {
    scolaire: 'COACH',
    collegial: 'RECRUTEUR',
    ligue_civile: 'COACH',
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!signupValid) {
      setShakeFields(true);
      setTimeout(() => setShakeFields(false), 600);
      return;
    }

    const { signUp } = await import('@/lib/supabase/auth.actions');
    const role = ROLE_MAP[selectedRole as ProRole];

    // selectedRole carries the scolaire/collegial/ligue_civile
    // discriminator that the wizard reads via users.context to branch
    // coach → coach_league for civil-league onboarding. Without this
    // pass-through, the "Ligue ou club sportif" choice silently
    // collapses to école and the league branch is unreachable.
    const { error } = await signUp(
      email,
      password,
      role,
      firstName,
      lastName,
      undefined,
      selectedRole as ProRole,
    );

    if (error) {
      setErrorToast({ message: translateAuthError(error.message), showUpgrade: false });
      return;
    }

    router.push('/onboarding');
  };

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex flex-col">
      <PlaybookBackground />

      <ErrorToast data={errorToast} onDismiss={() => setErrorToast(null)} />

      {/* Logo */}
      <div className="relative z-10 pt-8 pb-4 flex justify-center">
        <NexusLogo variant="white" height={36} href="/" priority />
      </div>

      {/* Card */}
      <section className="flex-1 flex items-start justify-center relative px-4 py-8">
        <div className="relative z-10 w-full max-w-[520px]">

          {/* Back link */}
          <Link href="/auth?mode=signup" className="inline-flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-white transition-colors mb-6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            Retour à l&apos;inscription
          </Link>

          <div className="bg-[#1A1D24] border border-white/5 rounded-xl p-6 sm:p-8">
            {/* Header */}
            <h1 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Rejoins Nexus</h1>
            <p className="text-[13px] text-[#9CA3AF] mb-6 leading-relaxed">Aide tes athlètes à être visibles par les recruteurs CÉGEP du Québec.</p>

            {/* Step 1 — Role selection */}
            <div className="space-y-3 mb-6">
              {ROLE_CARDS.map((card) => {
                const isSelected = selectedRole === card.value;
                return (
                  <button key={card.value} type="button" onClick={() => setSelectedRole(card.value)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-[#E63946] bg-[rgba(230,57,70,0.06)]"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className={`shrink-0 mt-0.5 ${isSelected ? "text-[#E63946]" : "text-[#6B7280]"}`}>{card.icon}</div>
                    <div>
                      <p className={`font-head font-bold text-[13px] uppercase tracking-wide ${isSelected ? "text-white" : "text-[#9CA3AF]"}`}>{card.title}</p>
                      <p className="text-[11px] text-[#6B7280] leading-snug mt-0.5">{card.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Step 2 — Form (appears after selection) */}
            {selectedRole && (
              <div className="animate-fade-slide-down">
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className={`${label} text-[#6B7280]`}>ou par courriel</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <form onSubmit={handleSignup} className={`flex flex-col gap-4 ${shakeFields ? "animate-shake" : ""}`}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Prénom <span className="text-[#EF4444]">*</span></label>
                      <input type="text" placeholder="Jean" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={`${inputClass} ${fieldErr(!!firstName)}`} />
                    </div>
                    <div>
                      <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Nom <span className="text-[#EF4444]">*</span></label>
                      <input type="text" placeholder="Tremblay" value={lastName} onChange={(e) => setLastName(e.target.value)} className={`${inputClass} ${fieldErr(!!lastName)}`} />
                    </div>
                  </div>
                  <div>
                    <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Courriel <span className="text-[#EF4444]">*</span></label>
                    <input type="email" placeholder="coach@ecole.qc.ca" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} ${fieldErr(!!email)}`} />
                  </div>
                  <div>
                    <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Mot de passe <span className="text-[#EF4444]">*</span></label>
                    <div className="relative">
                      <input type={showPwd ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-10 ${fieldErr(pwdMeetsMin)}`} />
                      <EyeToggle show={showPwd} onClick={() => setShowPwd(!showPwd)} />
                    </div>
                    <p className={`text-xs mt-1.5 transition-colors ${pwdMeetsMin ? "text-[#22C55E]" : "text-[#6B7280]"}`}>{pwdMeetsMin ? "✓" : "•"} Minimum 8 caractères</p>
                  </div>
                  <div>
                    <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Confirmer <span className="text-[#EF4444]">*</span></label>
                    <div className="relative">
                      <input type={showConfirmPwd ? "text" : "password"} placeholder="Mot de passe" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${inputClass} pr-10 ${pwdMismatch ? "border-[#EF4444]" : ""}`} />
                      <EyeToggle show={showConfirmPwd} onClick={() => setShowConfirmPwd(!showConfirmPwd)} />
                    </div>
                    {pwdMismatch && <p className="text-xs mt-1.5 text-[#EF4444]">Les mots de passe ne correspondent pas</p>}
                  </div>

                  {/* Consent checkboxes */}
                  <div className="space-y-2 mt-1">
                    <label className={`flex items-start gap-2 cursor-pointer group ${submitted && !consentPolicy ? "animate-shake" : ""}`}>
                      <input type="checkbox" checked={consentPolicy} onChange={(e) => setConsentPolicy(e.target.checked)} className="sr-only" />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentPolicy ? "bg-[#E63946] border-[#E63946]" : submitted && !consentPolicy ? "border-[#EF4444]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                        {consentPolicy && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                      </div>
                      <span className="text-[10px] text-[#6B7280] leading-snug">J&apos;ai lu et j&apos;accepte la <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-[#E63946] hover:underline" onClick={(e) => e.stopPropagation()}>Politique de confidentialité</a> et les <a href="/conditions" target="_blank" rel="noopener noreferrer" className="text-[#E63946] hover:underline" onClick={(e) => e.stopPropagation()}>Conditions d&apos;utilisation</a> de Nexus. <span className="text-[#EF4444]">*</span></span>
                    </label>
                    <label className={`flex items-start gap-2 cursor-pointer group ${submitted && !consentData ? "animate-shake" : ""}`}>
                      <input type="checkbox" checked={consentData} onChange={(e) => setConsentData(e.target.checked)} className="sr-only" />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentData ? "bg-[#E63946] border-[#E63946]" : submitted && !consentData ? "border-[#EF4444]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                        {consentData && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                      </div>
                      <span className="text-[10px] text-[#6B7280] leading-snug">J&apos;accepte la <a href="/collecte-donnees" target="_blank" rel="noopener noreferrer" className="text-[#E63946] hover:underline" onClick={(e) => e.stopPropagation()}>collecte et le traitement de mes données</a> par Nexus aux fins décrites. <span className="text-[#EF4444]">*</span></span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer group">
                      <input type="checkbox" checked={consentMarketing} onChange={(e) => setConsentMarketing(e.target.checked)} className="sr-only" />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentMarketing ? "bg-[#E63946] border-[#E63946]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                        {consentMarketing && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                      </div>
                      <span className="text-[10px] text-[#6B7280] leading-snug">J&apos;accepte de recevoir des <a href="/communications-marketing" target="_blank" rel="noopener noreferrer" className="text-[#E63946] hover:underline" onClick={(e) => e.stopPropagation()}>communications marketing</a> de Nexus (nouvelles fonctionnalités, conseils, promotions). Maximum 2 courriels par mois. <span className="text-[10px] text-[#4a4d56]">(optionnel)</span></span>
                    </label>
                    {submitted && (!consentPolicy || !consentData) && (
                      <p className="text-[10px] text-[#EF4444]">Tu dois accepter les deux premiers consentements pour continuer.</p>
                    )}
                  </div>

                  <button type="submit" disabled={!signupValid}
                    className={`h-12 w-full rounded-lg font-head font-black text-sm uppercase tracking-widest mt-2 transition-all ${
                      signupValid
                        ? "bg-[#E63946] text-white hover:bg-[#D42B22] hover:shadow-[0_8px_28px_rgba(230,57,70,0.38)] hover:-translate-y-0.5 cursor-pointer"
                        : "bg-[#E63946]/50 text-white/50 cursor-not-allowed"
                    }`}
                  >
                    {CTA_LABELS[selectedRole as ProRole]} &rarr;
                  </button>
                </form>
              </div>
            )}

            {/* Switch to login */}
            <p className="font-sans text-sm text-[#9CA3AF] text-center mt-6">
              Déjà un compte?{" "}
              <Link href="/auth" className="text-[#9CA3AF] font-bold hover:text-[#E63946] transition-colors">Se connecter</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
