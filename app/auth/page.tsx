"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { postLoginDispatch } from "@/lib/auth/postLoginDispatch";
import { openLegalDocument } from "@/lib/legal";
import PlaybookBackground from "../components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import ErrorToast, { type ErrorToastData } from "@/components/ui/ErrorToast";
import { translateAuthError } from "@/lib/utils/translateAuthError";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { AuthMobileDispatcher } from "@/components/mobile/auth/AuthMobileDispatcher";
import { persistInitialConsents } from "@/lib/legal/persistInitialConsents";
import { usePartialSignup, resolveRoleContext } from "@/components/auth/signup/usePartialSignup";
import { RolePicker } from "@/components/auth/signup/RolePicker";
import { ConsentBlock } from "@/components/auth/signup/ConsentBlock";
import { ParentalBlock } from "@/components/auth/signup/ParentalBlock";
import { SocialButtonsAuth } from "@/components/auth/SocialButtonsAuth";

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

  /* ── Signup state — flow unifié 4 écrans (hook usePartialSignup, item 2) ── */
  // Invitation flow (?invitation_token=…) : l'email est épinglé et verrouillé
  // (l'éditer orphelinerait le token). Le hook seed l'email depuis lockedEmail.
  const invitationToken = searchParams.get("invitation_token") ?? "";
  const emailLockedByInvitation = !!invitationToken && !!searchParams.get("email");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [shakeFields, setShakeFields] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // La state machine du signup (role picker → compte → identité → parental)
  // + validation + buildSignupArgs() vit dans le hook. users.context athlète
  // (école/civil) est capté à l'écran 2 (D1) → athlète civil non régressé.
  const sf = usePartialSignup({ lockedEmail: searchParams.get("email") ?? "" });

  /* ── Sync état signup ↔ URL (?screen&role) + bouton retour navigateur ──
     Déclaré APRÈS `sf` (TDZ). Avancée d'écran → pushState ; recul/même écran →
     replaceState. Le retour navigateur (popstate) restaure l'écran cible depuis
     l'état d'historique. Sans effet sur le tab login. */
  const prevSignupScreen = useRef(0);
  useEffect(() => {
    if (mode !== "signup" || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("screen", String(sf.screen));
    if (sf.pickedRole) url.searchParams.set("role", sf.pickedRole);
    else url.searchParams.delete("role");
    if (sf.screen > prevSignupScreen.current) {
      window.history.pushState({ signupScreen: sf.screen }, "", url.toString());
    } else {
      window.history.replaceState({ signupScreen: sf.screen }, "", url.toString());
    }
    prevSignupScreen.current = sf.screen;
  }, [mode, sf.screen, sf.pickedRole]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const target = Number(e.state?.signupScreen ?? 0);
      if (mode === "signup" && target < sf.screen) {
        sf.setScreen(Math.max(0, Math.min(3, target)) as 0 | 1 | 2 | 3);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [mode, sf]);

  /* ── Login state ── */
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginSubmitted, setLoginSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validation signup entièrement portée par le hook (sf.emailValid,
  // sf.pwdValid, sf.pwdMatches, sf.canProceedScreen1/2, sf.canSubmit).

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

  /* ── Signup handler (flow unifié — écran final de chaque rôle) ── */
  const handleSignupSubmit = async () => {
    setSubmitted(true);
    if (!sf.canSubmit) {
      setShakeFields(true);
      setTimeout(() => setShakeFields(false), 600);
      return;
    }
    setLoading(true);

    // signOut préventif : évite qu'une session antérieure (stale) pilote la
    // navigation post-signup → mauvais rôle → mauvais onboarding / WrongRoutePage.
    // Cas notable : « Confirm email » ON → signUp n'ouvre pas de session, donc
    // sans ce signOut la session précédente reste active.
    await createClient().auth.signOut();

    const { signUp } = await import("@/lib/supabase/auth.actions");
    const args = sf.buildSignupArgs();

    // role/context/metadata (consents + DOB) viennent du hook.
    // invitation_token préservé (consommé par le trigger via metadata).
    const { data, error } = await signUp(
      sf.email,
      sf.password,
      args.role,
      args.firstName,
      args.lastName,
      {
        ...(invitationToken ? { invitation_token: invitationToken } : {}),
        ...args.metadata,
      },
      args.context,
    );

    if (error) {
      setErrorToast({ message: translateAuthError(error.message), showUpgrade: false });
      setLoading(false);
      return;
    }

    // UPDATE app-side best-effort de users.privacy_preferences (trace garantie
    // dans raw_user_meta_data même si l'UPDATE rate — RLS session-less edge case).
    if (data?.user?.id) {
      const persistResult = await persistInitialConsents(data.user.id, args.consents);
      if (!persistResult.ok) {
        console.warn("[signup consents] persist failed:", persistResult.error);
      }
    }

    setLoading(false);
    // Route par rôle : athlète → wizard athlète ; coach/recruteur → wizard pro.
    router.push(args.role === "ATHLETE" ? "/athlete/onboarding" : "/onboarding");
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

    /* `.trim().toLowerCase()` — aligné sur /mot-de-passe-oublie, qui trimait
       déjà. Ce formulaire-ci envoyait la valeur du champ TELLE QUELLE : une
       adresse auto-remplie ou collée avec une espace finale, ou saisie avec
       une majuscule, produit un « Invalid login credentials » indiscernable
       d'un mauvais mot de passe. GoTrue stocke les courriels en minuscules ;
       il n'y a donc aucun cas où la casse ou l'espace de saisie devrait
       décider d'une connexion.

       Deux formulaires du même écran ne normalisaient pas pareil — c'est
       l'écart qui compte, pas la ligne. */
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPassword,
    });

    if (error) {
      setErrorToast({ message: translateAuthError(error.message), showUpgrade: false });
      setLoading(false);
      return;
    }

    // Dispatch post-login = source UNIQUE de vérité (postLoginDispatch) :
    // query users + blocage DESACTIVE + redirect par rôle, AVEC la branche
    // ATHLETE incomplet → /athlete/onboarding. Avant, ce handler dupliquait
    // la logique mais sans cette branche → un athlète incomplet partait sur
    // /onboarding (wizard coach/recruteur) et tombait sur le défaut coach.
    await postLoginDispatch(supabase, data.user, router);

    setLoading(false);
  };

  /* Web : flow OAuth standard (redirect navigateur → provider → /auth/callback).
     role (connu depuis le role picker écran 0) transmis via redirectTo →
     override au callback (item 3). Absent pour le login (aucun override). */
  const handleOAuth = async (provider: "google" | "apple", role?: string, context?: string | null) => {
    const supabase = createClient();
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (context) params.set("context", context);
    const qs = params.toString();
    const redirectTo = `${window.location.origin}/auth/callback${qs ? `?${qs}` : ""}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) setToast("Connexion impossible. Réessaie.");
  };

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

                  {/* Retour (écrans > 0) — navigation state machine. */}
                  {sf.screen > 0 && (
                    <button type="button" onClick={sf.back}
                      className="flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-white transition-colors mb-4">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                      Retour
                    </button>
                  )}

                  {/* ── ÉCRAN 0 : Role picker (4 rôles) ── */}
                  {sf.screen === 0 && (
                    <>
                      <div className="text-center mb-6">
                        <h2 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-tight">Tu es ?</h2>
                        <p className="text-[13px] text-[#9CA3AF] mt-2">Choisis ton rôle pour adapter l&apos;inscription.</p>
                      </div>
                      <RolePicker onPick={sf.pickRole} />
                    </>
                  )}

                  {/* ── ÉCRAN 1 : Compte (email/pw + OAuth pour tous les rôles) ── */}
                  {sf.screen === 1 && (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="font-head font-black text-[14px] text-white uppercase tracking-tight">{T.signup.form.heading}</span>
                        <span className="text-[12px] text-[#6B7280]">{T.signup.form.headingSub}</span>
                      </div>

                      <SocialButtonsAuth
                        onOAuth={(p) => {
                          // role + context depuis le picker (écran 0). Athlète : context
                          // = undefined (choisi à l'écran 2, non transmis à l'OAuth).
                          const rc = sf.pickedRole ? resolveRoleContext(sf.pickedRole) : null;
                          handleOAuth(p, rc?.role, rc?.context);
                        }}
                        googleLabel={T.google}
                      />

                      <div className="flex items-center gap-4 my-4">
                        <div className="flex-1 h-px bg-white/5" />
                        <span className={`${label} text-[#6B7280]`}>{T.orEmail}</span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>

                      <div className="flex flex-col gap-4">
                        <div>
                          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.email} <span className="text-[#EF4444]">*</span></label>
                          <input type="email" placeholder={T.signup.form.placeholders.email} value={sf.email}
                            onChange={(e) => sf.setEmail(e.target.value)} readOnly={emailLockedByInvitation}
                            className={`${inputClass} ${emailLockedByInvitation ? "opacity-70 cursor-not-allowed" : ""}`} />
                        </div>
                        <div>
                          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.password} <span className="text-[#EF4444]">*</span></label>
                          <div className="relative">
                            <input type={showPwd ? "text" : "password"} placeholder={T.signup.form.placeholders.password} value={sf.password} onChange={(e) => sf.setPassword(e.target.value)} className={`${inputClass} pr-10`} />
                            <EyeToggle show={showPwd} onClick={() => setShowPwd(!showPwd)} />
                          </div>
                          <p className={`text-xs mt-1.5 transition-colors ${sf.pwdValid ? "text-[#22C55E]" : sf.password.length > 0 ? "text-[#E63946]" : "text-[#6B7280]"}`}>{sf.pwdValid ? "✓" : sf.password.length > 0 ? "✕" : "•"} {T.signup.form.passwordHint}</p>
                        </div>
                        <div>
                          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.confirm} <span className="text-[#EF4444]">*</span></label>
                          <div className="relative">
                            <input type={showConfirmPwd ? "text" : "password"} placeholder={T.signup.form.placeholders.password} value={sf.confirmPassword} onChange={(e) => sf.setConfirmPassword(e.target.value)} className={`${inputClass} pr-10 ${sf.confirmPassword.length > 0 && !sf.pwdMatches ? "border-[#EF4444]" : ""}`} />
                            <EyeToggle show={showConfirmPwd} onClick={() => setShowConfirmPwd(!showConfirmPwd)} />
                          </div>
                          {sf.confirmPassword.length > 0 && !sf.pwdMatches && <p className="text-xs mt-1.5 text-[#EF4444]">{T.signup.form.passwordMismatch}</p>}
                        </div>

                        <button type="button" onClick={sf.next} disabled={!sf.canProceedScreen1}
                          className={`h-14 w-full rounded-xl font-head font-black text-[14px] uppercase tracking-widest mt-2 transition-all ${sf.canProceedScreen1 ? "bg-[#E63946] text-white hover:bg-[#D42B22] cursor-pointer" : "bg-[#E63946]/50 text-white/50 cursor-not-allowed"}`}>
                          Continuer
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── ÉCRAN 2 : Identité + context/ligue conditionnels + consentements ── */}
                  {sf.screen === 2 && (
                    <div className="flex flex-col gap-4">
                      <span className="font-head font-black text-[14px] text-white uppercase tracking-tight">Toi.</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.firstName} <span className="text-[#EF4444]">*</span></label>
                          <input type="text" placeholder={T.signup.form.placeholders.firstName} value={sf.firstName} onChange={(e) => sf.setFirstName(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>{T.signup.form.labels.lastName} <span className="text-[#EF4444]">*</span></label>
                          <input type="text" placeholder={T.signup.form.placeholders.lastName} value={sf.lastName} onChange={(e) => sf.setLastName(e.target.value)} className={inputClass} />
                        </div>
                      </div>

                      <div>
                        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Date de naissance <span className="text-[#EF4444]">*</span></label>
                        {/* Loi 25 — DOB à choix libre (pas de bornes) ; le
                            blocage <14 se fait au CTA via le hook
                            (isUnderMinAge coupe canProceedScreen2/canSubmit)
                            + le message conditionnel ci-dessous. */}
                        <input type="date" value={sf.birthdate} onChange={(e) => sf.setBirthdate(e.target.value)} className={inputClass} />
                        {sf.isUnderMinAge && (
                          <p className="text-xs mt-1.5 text-[#EF4444]">L&apos;inscription est réservée aux 14 ans et plus.</p>
                        )}
                      </div>

                      {/* Athlète (D1) : context école/civil requis → users.context. */}
                      {sf.isAthlete && (
                        <div>
                          <label className={`${label} text-[#9CA3AF] mb-2 block`}>{T.signup.form.labels.context} <span className="text-[#EF4444]">*</span></label>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => sf.setAthleteContext("school")}
                              className={`py-3 px-3 rounded-lg text-[12px] font-bold transition-all text-left ${sf.athleteContext === "school" ? "bg-[#E63946] text-white" : "bg-[#111317] border border-white/10 text-[#9CA3AF] hover:border-white/20 hover:text-white"}`}>
                              {T.signup.form.context.scolaire.title}
                              <span className="block text-[10px] font-normal opacity-70 mt-0.5">{T.signup.form.context.scolaire.sub}</span>
                            </button>
                            <button type="button" onClick={() => sf.setAthleteContext("civil")}
                              className={`py-3 px-3 rounded-lg text-[12px] font-bold transition-all text-left ${sf.athleteContext === "civil" ? "bg-[#E63946] text-white" : "bg-[#111317] border border-white/10 text-[#9CA3AF] hover:border-white/20 hover:text-white"}`}>
                              {T.signup.form.context.civile.title}
                              <span className="block text-[10px] font-normal opacity-70 mt-0.5">{T.signup.form.context.civile.sub}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <ConsentBlock
                        consentPolicy={sf.consentPolicy} setConsentPolicy={sf.setConsentPolicy}
                        consentData={sf.consentData} setConsentData={sf.setConsentData}
                        consentMarketing={sf.consentMarketing} setConsentMarketing={sf.setConsentMarketing}
                        submitted={submitted}
                      />

                      {sf.needsParentalScreen ? (
                        <button type="button" onClick={sf.next} disabled={!sf.canProceedScreen2}
                          className={`h-14 w-full rounded-xl font-head font-black text-[14px] uppercase tracking-widest mt-2 transition-all ${sf.canProceedScreen2 ? "bg-[#E63946] text-white hover:bg-[#D42B22] cursor-pointer" : "bg-[#E63946]/50 text-white/50 cursor-not-allowed"}`}>
                          Continuer
                        </button>
                      ) : (
                        <button type="button" onClick={handleSignupSubmit} disabled={loading}
                          className={`h-14 w-full rounded-xl font-head font-black text-[14px] uppercase tracking-widest mt-2 transition-all ${loading ? "bg-[#E63946]/50 text-white/50 cursor-wait" : "bg-[#E63946] text-white hover:bg-[#D42B22] cursor-pointer"}`}>
                          {loading ? "Création…" : "Créer mon compte"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── ÉCRAN 3 : Parental (athlète mineur uniquement) ── */}
                  {sf.screen === 3 && (
                    <div className="flex flex-col gap-4">
                      <span className="font-head font-black text-[14px] text-white uppercase tracking-tight">Tes parents.</span>
                      <ParentalBlock
                        parentFirstName={sf.parentFirstName} setParentFirstName={sf.setParentFirstName}
                        parentLastName={sf.parentLastName} setParentLastName={sf.setParentLastName}
                        parentEmail={sf.parentEmail} setParentEmail={sf.setParentEmail}
                        parentEmailValid={sf.parentEmailValid}
                        parentRelationship={sf.parentRelationship} setParentRelationship={sf.setParentRelationship}
                        consentProfile={sf.consentProfile} setConsentProfile={sf.setConsentProfile}
                        consentVisibility={sf.consentVisibility} setConsentVisibility={sf.setConsentVisibility}
                        consentPartnerVisibility={sf.consentPartnerVisibility} setConsentPartnerVisibility={sf.setConsentPartnerVisibility}
                        submitted={submitted}
                      />
                      <button type="button" onClick={handleSignupSubmit} disabled={loading}
                        className={`h-14 w-full rounded-xl font-head font-black text-[14px] uppercase tracking-widest mt-2 transition-all ${loading ? "bg-[#E63946]/50 text-white/50 cursor-wait" : "bg-[#E63946] text-white hover:bg-[#D42B22] cursor-pointer"}`}>
                        {loading ? "Création…" : "Créer mon compte"}
                      </button>
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
                    <button type="button" onClick={() => handleOAuth("google")} className="flex items-center justify-center gap-3 h-11 w-full bg-[#111317] border border-white/10 rounded-lg text-sm text-white hover:border-white/20 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      {T.google}
                    </button>
                    {/* Apple — HIG : fond NOIR + logo Apple blanc officiel (App Review 4.8). */}
                    <button type="button" onClick={() => handleOAuth("apple")} className="flex items-center justify-center gap-3 h-11 w-full bg-black border border-white/15 rounded-lg text-sm text-white hover:border-white/30 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M17.05 20.28c-.98.95-2.05.86-3.08.42-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.42C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                      Continuer avec Apple
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
                      <button type="button" onClick={() => router.push("/mot-de-passe-oublie")} className={`${label} text-[#9CA3AF] hover:text-[#E63946] transition-colors`}>{T.login.forgot}</button>
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
