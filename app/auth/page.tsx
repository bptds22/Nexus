"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { openLegalDocument } from "@/lib/legal";
import PlaybookBackground from "../components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import ErrorToast, { type ErrorToastData } from "@/components/ui/ErrorToast";
import { translateAuthError } from "@/lib/utils/translateAuthError";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { AuthMobileDispatcher } from "@/components/mobile/auth/AuthMobileDispatcher";
import {
  persistInitialConsents,
  buildConsentMetadata,
} from "@/lib/legal/persistInitialConsents";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Auth Page (Login / Sign Up)
   Full signup flow with role selection, validation, localStorage save.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";
const inputClass =
  "w-full h-11 px-4 bg-[#111317] border border-white/10 rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-[#E63946] focus:outline-none transition-colors";

/* ── Toast component ── */
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed top-6 right-6 z-[200] bg-[#1A1D24] border border-white/10 rounded-lg px-5 py-3 text-sm text-white shadow-lg flex items-center gap-3 animate-slide-in">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      {message}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthRouter />
    </Suspense>
  );
}

/* Iter 7.46 — dispatcher Capacitor (Welcome / Login mobile / session
   passthrough). Desktop reste rigoureusement inchangé via le fallback
   <AuthContent />. */
function AuthRouter() {
  if (!IS_CAPACITOR) return <AuthContent />;
  return <AuthMobileDispatcher desktopFallback={<AuthContent />} />;
}

function AuthContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const T = t.auth;
  const router = useRouter();
  // Phase 2 athlete claim: presence of ?email=… implies the visitor
  // landed via a coach-shared signup link, so default to signup mode.
  const initialMode = (searchParams.get("mode") === "signup" || searchParams.get("email")) ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const fadeRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<ErrorToastData | null>(null);

  /* ── Referral code capture ── */
  const [referralCode, setReferralCode] = useState<string | null>(null);
  useEffect(() => {
    const urlRef = searchParams.get("ref");
    const storedRef = localStorage.getItem("nexus_referral_code");
    const code = urlRef || storedRef || null;
    if (code) {
      localStorage.setItem("nexus_referral_code", code);
      setReferralCode(code);
    }
  }, [searchParams]);

  /* ── Signup state ── */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Phase 2 athlete claim: prefill signup email from ?email=… so the
  // coach-shared claim link lands ready to submit. Soft prefill —
  // the user can edit before signing up. For invitation flow
  // (?invitation_token=…), the email field locks since the invitation
  // pinned that email and editing would orphan the token.
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const invitationToken = searchParams.get("invitation_token") ?? "";
  const emailLockedByInvitation = !!invitationToken && !!searchParams.get("email");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [shakeFields, setShakeFields] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Context discriminator (scolaire | ligue_civile) — wired to
  // users.context via signUp's 7th arg, mirroring the /auth/pro
  // flow shipped in 5.1. The athlete onboarding wizard reads this
  // at load to branch step 1 between the school path (existing) and
  // the league_team selection path (5.3b). Without it civil
  // athletes default to the school path and get stuck on the
  // selectedSchoolId requirement.
  const [selectedContext, setSelectedContext] = useState<"" | "scolaire" | "ligue_civile">("");
  const [showAthleteForm, setShowAthleteForm] = useState(false);
  const [consentPolicy, setConsentPolicy] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  /* ── Login state ── */
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginSubmitted, setLoginSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const pwdMeetsMin = password.length >= 8;
  // #45 — indicateur 3 états : vide = neutre (gris), non vide & <8 = erreur
  // (rouge), >=8 = valide (vert). N'affecte pas signupValid (politique 8 min
  // inchangée), juste la couleur/le marqueur du hint.
  const pwdTooShort = password.length > 0 && !pwdMeetsMin;
  const pwdMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const baseValid = firstName && lastName && email && pwdMeetsMin && !pwdMismatch;
  const signupValid = baseValid && selectedContext && consentPolicy && consentData;

  /* Replay fade animation on mode switch */
  const switchMode = useCallback(
    (next: "login" | "signup") => {
      if (next === mode) return;
      const el = fadeRef.current;
      if (el) {
        el.classList.remove("nx-auth-fade");
        void el.offsetWidth;
        el.classList.add("nx-auth-fade");
      }
      setMode(next);
    },
    [mode]
  );

  /* ── Signup handler ── */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!signupValid) {
      setShakeFields(true);
      setTimeout(() => setShakeFields(false), 600);
      return;
    }
    setLoading(true);

    const { signUp } = await import("@/lib/supabase/auth.actions");

    // Iter 7.53 (dette Loi 25) — consents transmis via extraMetadata pour
    // traçabilité auth.users.raw_user_meta_data (preuve légale, garantie
    // même si l'UPDATE app-side ci-dessous échoue). DIAG 7.45 §B.3.
    const consentMeta = buildConsentMetadata({
      policy: consentPolicy,
      data: consentData,
      marketing: consentMarketing,
    });

    // selectedContext is guaranteed non-empty here because
    // signupValid (checked above) requires it. The cast narrows
    // the union from "" | "scolaire" | "ligue_civile" → the two
    // signUp accepts for athletes (collegial is recruiter-only).
    const { data, error } = await signUp(
      email,
      password,
      "ATHLETE",
      firstName,
      lastName,
      {
        // sport retiré du signup (Groupe 2-A) — saisi à l'onboarding.
        ...(invitationToken ? { invitation_token: invitationToken } : {}),
        ...consentMeta,
      },
      selectedContext as "scolaire" | "ligue_civile",
    );

    if (error) {
      setErrorToast({ message: translateAuthError(error.message), showUpgrade: false });
      setLoading(false);
      return;
    }

    // Iter 7.53 — UPDATE app-side best-effort de users.privacy_preferences.
    // COALESCE anti-écrasement intégré (helper). Si l'UPDATE rate (RLS
    // session-less edge case), la trace reste dans raw_user_meta_data.
    if (data?.user?.id) {
      const persistResult = await persistInitialConsents(data.user.id, {
        policy: consentPolicy,
        data: consentData,
        marketing: consentMarketing,
      });
      if (!persistResult.ok) {
        // Non-bloquant : log uniquement, l'utilisateur poursuit.
        console.warn("[signup consents] persist failed:", persistResult.error);
      }
    }

    setLoading(false);
    router.push("/athlete/onboarding");
  };

  /* ── Login handler ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSubmitted(true);
    if (!loginEmail || !loginPassword) {
      setShakeFields(true);
      setTimeout(() => setShakeFields(false), 600);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      setErrorToast({ message: translateAuthError(error.message), showUpgrade: false });
      setLoading(false);
      return;
    }

    // Check if onboarding is complete
    const { data: profile } = await supabase
      .from("users")
      .select("role, onboarding_complete, status")
      .eq("id", data.user.id)
      .single();

    // Block deactivated accounts (SUPER_ADMIN exempt)
    if (profile?.status === "DESACTIVE" && profile?.role !== "SUPER_ADMIN") {
      await supabase.auth.signOut();
      router.replace("/compte-desactive");
      setLoading(false);
      return;
    }

    // Use profile from DB, fallback to auth metadata
    const role = profile?.role || (data.user.user_metadata?.role as string);
    const onboardingComplete = profile?.onboarding_complete;

    // If we couldn't load profile at all, use metadata role to route

    // Only redirect to onboarding if profile explicitly exists with onboarding_complete = false
    if (profile && !onboardingComplete) {
      router.push("/onboarding");
      setLoading(false);
      return;
    }

    // Route to correct portal
    if (role === "COACH") {
      router.push("/coach");
    } else if (role === "RECRUTEUR") {
      router.push("/recruteur");
    } else if (role === "ATHLETE") {
      router.push("/athlete");
    } else if (role === "ADMIN") {
      router.push("/admin");
    } else if (role === "PARTNER") {
      router.push("/partenaire");
    } else {
      router.push("/onboarding");
    }

    setLoading(false);
  };

  const socialToast = () => setToast(T.toasts.socialPhase2);

  /* ── Eye toggle icon ── */
  const EyeToggle = ({ show, onClick }: { show: boolean; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-white transition-colors" tabIndex={-1}>
      {show ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
      )}
    </button>
  );

  const fieldErr = (filled: boolean) =>
    submitted && !filled ? "border-[#EF4444]" : "";
  const loginFieldErr = (filled: boolean) =>
    loginSubmitted && !filled ? "border-[#EF4444]" : "";

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex flex-col">
      <PlaybookBackground />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <ErrorToast data={errorToast} onDismiss={() => setErrorToast(null)} />

      <MarketingNav />

      {/* ══════════ AUTH CARD ══════════ */}
      <section className="flex-1 flex items-center justify-center relative py-16 px-6">
        <div className="relative z-10 w-full max-w-md">
          {/* Brand message */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-5">
              <span className="w-6 h-px bg-[#E63946]" />
              <span className={`${label} text-[#E63946]`}>{T.eyebrow}</span>
              <span className="w-6 h-px bg-[#E63946]" />
            </div>
            <h1 className="font-head text-4xl sm:text-5xl font-black text-white uppercase leading-[0.92] tracking-tight">
              {mode === "login" ? T.titleLogin : T.titleSignup}
            </h1>
            <p className="font-sans text-sm text-[#9CA3AF] mt-3 max-w-xs mx-auto leading-relaxed">
              {mode === "login" ? T.subtitleLogin : T.subtitleSignup}
            </p>
          </div>

          {/* Auth card container */}
          <div className="bg-[#1A1D24] border border-white/5 rounded-xl p-8 sm:p-10">
            {/* Mode toggle tabs */}
            <div className="flex mb-8 border border-white/5 rounded-lg overflow-hidden">
              <button type="button" onClick={() => switchMode("login")} className={`flex-1 h-10 font-head font-black text-xs uppercase tracking-widest transition-colors ${mode === "login" ? "bg-[#E63946] text-white" : "bg-transparent text-[#9CA3AF] hover:text-white"}`}>{T.tabs.login}</button>
              <button type="button" onClick={() => switchMode("signup")} className={`flex-1 h-10 font-head font-black text-xs uppercase tracking-widest transition-colors ${mode === "signup" ? "bg-[#E63946] text-white" : "bg-transparent text-[#9CA3AF] hover:text-white"}`}>{T.tabs.signup}</button>
            </div>

            {/* Animated form content */}
            <div ref={fadeRef} className="nx-auth-fade">

              {/* ══════════ INSCRIPTION ══════════ */}
              {mode === "signup" && (
                <>
                  {/* Referral banner */}
                  {referralCode && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[#22C55E]/5 border-l-2 border-[#22C55E] mb-5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" className="shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
                      <span className="text-[12px] text-[#22C55E] font-bold">{T.referralBanner}</span>
                    </div>
                  )}

                  {/* ── CHOICE VIEW (no form visible) ── */}
                  {!showAthleteForm && (
                    <>
                      {/* Athlete hero */}
                      <div className="text-center mb-6">
                        <h2 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mt-2 leading-tight">{T.signup.choice.title}</h2>
                        <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed max-w-[400px] mx-auto">{T.signup.choice.lede}</p>
                      </div>

                      {/* Big athlete CTA */}
                      <button type="button" onClick={() => { setShowAthleteForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                        className="w-full h-14 rounded-xl bg-[#E63946] text-white font-head font-black text-[14px] uppercase tracking-widest hover:bg-[#D42B22] hover:shadow-[0_8px_28px_rgba(230,57,70,0.38)] hover:-translate-y-0.5 transition-all cursor-pointer"
                      >
                        {T.signup.choice.cta}
                      </button>

                      {/* Separator */}
                      <div className="flex items-center gap-3 mt-8 mb-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className={`${label} text-[#6B7280]`}>{T.signup.choice.notAthlete}</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>

                      {/* 3 secondary pro cards */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { title: T.signup.choice.coach.title, sub: T.signup.choice.coach.sub, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/></svg> },
                          { title: T.signup.choice.civilLeague.title, sub: T.signup.choice.civilLeague.sub, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2"/><path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2"/><path d="M6 3h12v6a6 6 0 01-12 0V3z"/><path d="M12 15v3M8 21h8"/></svg> },
                          { title: T.signup.choice.recruiter.title, sub: T.signup.choice.recruiter.sub, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> },
                        ].map((c) => (
                          <Link key={c.title} href="/auth/pro"
                            className="flex flex-col items-center gap-1.5 py-4 px-3 rounded-lg border border-white/10 text-[#9CA3AF] hover:border-[#E63946]/50 hover:bg-[#E63946]/5 hover:text-white transition-all text-center"
                          >
                            <span className="text-[#6B7280]">{c.icon}</span>
                            <span className="font-head font-bold text-[10px] uppercase tracking-[0.1em]">{c.title}</span>
                            <span className="text-[9px] text-[#6B7280] leading-tight">{c.sub}</span>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}

                  {/* ── ATHLETE FORM (revealed after CTA click) ── */}
                  {showAthleteForm && (
                    <div ref={formRef}>
                      {/* Back to choice */}
                      <button type="button" onClick={() => setShowAthleteForm(false)}
                        className="flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-white transition-colors mb-4"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                        {T.signup.form.back}
                      </button>

                      {/* Compact hero reminder */}
                      <div className="flex items-center gap-2 mb-5">
                        <span className="font-head font-black text-[14px] text-white uppercase tracking-tight">{T.signup.form.heading}</span>
                        <span className="text-[12px] text-[#6B7280]">{T.signup.form.headingSub}</span>
                      </div>

                      {/* Social login */}
                      <button type="button" onClick={socialToast} className="flex items-center justify-center gap-3 h-11 w-full bg-[#111317] border border-white/10 rounded-lg text-sm text-white hover:border-white/20 transition-colors mb-4">
                        <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        {T.google}
                      </button>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex-1 h-px bg-white/5" />
                        <span className={`${label} text-[#6B7280]`}>{T.orEmail}</span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>

                      {/* Athlete form */}
                      <form onSubmit={handleSignup} className={`flex flex-col gap-4 ${shakeFields ? "animate-shake" : ""}`}>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.firstName} <span className="text-[#EF4444]">*</span></label>
                            <input type="text" placeholder={T.signup.form.placeholders.firstName} value={firstName} onChange={(e) => setFirstName(e.target.value)} className={`${inputClass} ${fieldErr(!!firstName)}`} />
                          </div>
                          <div>
                            <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.lastName} <span className="text-[#EF4444]">*</span></label>
                            <input type="text" placeholder={T.signup.form.placeholders.lastName} value={lastName} onChange={(e) => setLastName(e.target.value)} className={`${inputClass} ${fieldErr(!!lastName)}`} />
                          </div>
                        </div>
                        <div>
                          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.email} <span className="text-[#EF4444]">*</span></label>
                          <input
                            type="email"
                            placeholder={T.signup.form.placeholders.email}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            readOnly={emailLockedByInvitation}
                            className={`${inputClass} ${fieldErr(!!email)} ${emailLockedByInvitation ? "opacity-70 cursor-not-allowed" : ""}`}
                          />
                        </div>
                        <div>
                          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.password} <span className="text-[#EF4444]">*</span></label>
                          <div className="relative">
                            <input type={showPwd ? "text" : "password"} placeholder={T.signup.form.placeholders.password} value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-10 ${fieldErr(pwdMeetsMin)}`} />
                            <EyeToggle show={showPwd} onClick={() => setShowPwd(!showPwd)} />
                          </div>
                          <p
                            aria-live="polite"
                            {...(pwdTooShort ? { role: "alert" } : {})}
                            className={`text-xs mt-1.5 transition-colors ${pwdMeetsMin ? "text-[#22C55E]" : pwdTooShort ? "text-[#E63946]" : "text-[#6B7280]"}`}
                          >{pwdMeetsMin ? "✓" : pwdTooShort ? "✕" : "•"} {T.signup.form.passwordHint}</p>
                        </div>
                        <div>
                          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.confirm} <span className="text-[#EF4444]">*</span></label>
                          <div className="relative">
                            <input type={showConfirmPwd ? "text" : "password"} placeholder={T.signup.form.placeholders.password} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${inputClass} pr-10 ${pwdMismatch ? "border-[#EF4444]" : ""}`} />
                            <EyeToggle show={showConfirmPwd} onClick={() => setShowConfirmPwd(!showConfirmPwd)} />
                          </div>
                          {pwdMismatch && <p className="text-xs mt-1.5 text-[#EF4444]">{T.signup.form.passwordMismatch}</p>}
                        </div>

                        {/* Context chooser — école secondaire vs ligue civile.
                            Drives users.context which the onboarding wizard
                            reads to branch step 1 (school path vs league_team
                            path). */}
                        <div>
                          <label className={`${label} text-[#9CA3AF] mb-2 block`}>{T.signup.form.labels.context} <span className="text-[#EF4444]">*</span></label>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setSelectedContext("scolaire")}
                              className={`py-3 px-3 rounded-lg text-[12px] font-bold transition-all text-left ${
                                selectedContext === "scolaire"
                                  ? "bg-[#E63946] text-white"
                                  : "bg-[#111317] border border-white/10 text-[#9CA3AF] hover:border-white/20 hover:text-white"
                              }`}>
                              {T.signup.form.context.scolaire.title}
                              <span className="block text-[10px] font-normal opacity-70 mt-0.5">{T.signup.form.context.scolaire.sub}</span>
                            </button>
                            <button type="button" onClick={() => setSelectedContext("ligue_civile")}
                              className={`py-3 px-3 rounded-lg text-[12px] font-bold transition-all text-left ${
                                selectedContext === "ligue_civile"
                                  ? "bg-[#E63946] text-white"
                                  : "bg-[#111317] border border-white/10 text-[#9CA3AF] hover:border-white/20 hover:text-white"
                              }`}>
                              {T.signup.form.context.civile.title}
                              <span className="block text-[10px] font-normal opacity-70 mt-0.5">{T.signup.form.context.civile.sub}</span>
                            </button>
                          </div>
                        </div>

                        {/* Sport picker retiré du signup (Groupe 2-A) : le sport
                            est saisi et stocké à l'onboarding (athletes.sport_id).
                            Le trigger handle_new_auth_user ignore déjà metadata.sport. */}

                        {/* Consent checkboxes */}
                        <div className="space-y-2 mt-1">
                          <label className={`flex items-start gap-2 cursor-pointer group ${submitted && !consentPolicy ? "animate-shake" : ""}`}>
                            <input type="checkbox" checked={consentPolicy} onChange={(e) => setConsentPolicy(e.target.checked)} className="sr-only" />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentPolicy ? "bg-[#E63946] border-[#E63946]" : submitted && !consentPolicy ? "border-[#EF4444]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                              {consentPolicy && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                            </div>
                            <span className="text-[10px] text-[#6B7280] leading-snug">{T.signup.form.consent.policy.before}<button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegalDocument("confidentialite"); }} className="text-[#E63946] hover:underline">{T.signup.form.consent.policy.privacy}</button>{T.signup.form.consent.policy.and}<button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegalDocument("conditions"); }} className="text-[#E63946] hover:underline">{T.signup.form.consent.policy.terms}</button>{T.signup.form.consent.policy.after} <span className="text-[#EF4444]">*</span></span>
                          </label>
                          <label className={`flex items-start gap-2 cursor-pointer group ${submitted && !consentData ? "animate-shake" : ""}`}>
                            <input type="checkbox" checked={consentData} onChange={(e) => setConsentData(e.target.checked)} className="sr-only" />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentData ? "bg-[#E63946] border-[#E63946]" : submitted && !consentData ? "border-[#EF4444]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                              {consentData && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                            </div>
                            <span className="text-[10px] text-[#6B7280] leading-snug">{T.signup.form.consent.data.before}<button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegalDocument("collecteDonnees"); }} className="text-[#E63946] hover:underline">{T.signup.form.consent.data.link}</button>{T.signup.form.consent.data.after} <span className="text-[#EF4444]">*</span></span>
                          </label>
                          <label className="flex items-start gap-2 cursor-pointer group">
                            <input type="checkbox" checked={consentMarketing} onChange={(e) => setConsentMarketing(e.target.checked)} className="sr-only" />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentMarketing ? "bg-[#E63946] border-[#E63946]" : "border-[#6B7280] group-hover:border-white/30"}`}>
                              {consentMarketing && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                            </div>
                            <span className="text-[10px] text-[#6B7280] leading-snug">{T.signup.form.consent.marketing.before}<a href="/communications-marketing" target="_blank" rel="noopener noreferrer" className="text-[#E63946] hover:underline" onClick={(e) => e.stopPropagation()}>{T.signup.form.consent.marketing.link}</a>{T.signup.form.consent.marketing.after} <span className="text-[10px] text-[#4a4d56]">{T.signup.form.consent.marketing.optional}</span></span>
                          </label>
                          {submitted && (!consentPolicy || !consentData) && (
                            <p className="text-[10px] text-[#EF4444]">{T.signup.form.consent.error}</p>
                          )}
                        </div>

                        <button type="submit" disabled={!signupValid}
                          className={`h-14 w-full rounded-xl font-head font-black text-[14px] uppercase tracking-widest mt-2 transition-all ${
                            signupValid
                              ? "bg-[#E63946] text-white hover:bg-[#D42B22] hover:shadow-[0_8px_28px_rgba(230,57,70,0.38)] hover:-translate-y-0.5 cursor-pointer"
                              : "bg-[#E63946]/50 text-white/50 cursor-not-allowed"
                          }`}
                        >
                          {T.signup.form.submit}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Switch to login */}
                  <p className="font-sans text-sm text-[#9CA3AF] text-center mt-6">
                    {T.signup.switchToLogin.prompt}{" "}
                    <button type="button" onClick={() => switchMode("login")} className="text-[#9CA3AF] font-bold hover:text-[#E63946] transition-colors">{T.signup.switchToLogin.cta}</button>
                  </p>
                </>
              )}

              {/* ══════════ CONNEXION ══════════ */}
              {mode === "login" && (
                <>
                  {/* Social login */}
                  <div className="flex flex-col gap-3 mb-6">
                    <button type="button" onClick={socialToast} className="flex items-center justify-center gap-3 h-11 w-full bg-[#111317] border border-white/10 rounded-lg text-sm text-white hover:border-white/20 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      {T.google}
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className={`${label} text-[#6B7280]`}>{T.orEmail}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* Login form */}
                  <form onSubmit={handleLogin} className={`flex flex-col gap-4 ${shakeFields ? "animate-shake" : ""}`}>
                    <div>
                      <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.email}</label>
                      <input type="email" placeholder={T.login.placeholderEmail} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className={`${inputClass} ${loginFieldErr(!!loginEmail)}`} />
                    </div>
                    <div>
                      <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.password}</label>
                      <div className="relative">
                        <input type={showLoginPwd ? "text" : "password"} placeholder={T.login.placeholderPassword} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={`${inputClass} pr-10 ${loginFieldErr(!!loginPassword)}`} />
                        <EyeToggle show={showLoginPwd} onClick={() => setShowLoginPwd(!showLoginPwd)} />
                      </div>
                    </div>
                    <div className="flex justify-end -mt-1">
                      <button type="button" onClick={() => setToast(T.toasts.forgotPhase2)} className={`${label} text-[#9CA3AF] hover:text-[#E63946] transition-colors`}>{T.login.forgot}</button>
                    </div>
                    <button type="submit" disabled={loading} className={`h-12 w-full rounded-lg font-head font-black text-sm uppercase tracking-widest mt-2 transition-all ${loading ? "bg-[#E63946]/50 text-white/50 cursor-wait" : "bg-[#E63946] text-white hover:bg-[#D42B22] hover:shadow-[0_8px_28px_rgba(230,57,70,0.38)] hover:-translate-y-0.5 cursor-pointer"}`}>
                      {loading ? T.login.loading : T.login.submit}
                    </button>
                  </form>

                  {/* Switch to signup — athlete CTA */}
                  <button type="button" onClick={() => switchMode("signup")} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E63946]/5 border border-[#E63946]/20 mt-6 hover:bg-[#E63946]/10 transition-colors text-left">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span className="text-[11px] text-[#9CA3AF]">{T.login.switchToSignup.prompt} <span className="text-[#E63946] font-bold">{T.login.switchToSignup.cta}</span></span>
                  </button>

                </>
              )}

            </div>{/* end nx-auth-fade */}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
