"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import PlaybookBackground from "../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Auth Page (Login / Sign Up)
   Full signup flow with role selection, validation, localStorage save.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";
const inputClass =
  "w-full h-11 px-4 bg-[#111317] border border-white/10 rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-[#E63946] focus:outline-none transition-colors";

const NAV_LINKS = [
  { label: "Comment ça marche", href: "/comment-ca-marche" },
  { label: "Coaches & Recruteurs", href: "/#roles" },
  { label: "Athlètes", href: "/#athletes" },
  { label: "Roadmap", href: "/roadmap" },
];

const SOCIALS = [
  { name: "Instagram", href: "#", d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
  { name: "Facebook", href: "#", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
  { name: "Twitter / X", href: "#", d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
  { name: "LinkedIn", href: "#", d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
];

const ROLES = [
  {
    value: "coach",
    label: "Entraîneur secondaire",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    value: "director_school",
    label: "Directeur secondaire",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    value: "director_cegep",
    label: "Directeur collégial",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      </svg>
    ),
  },
  {
    value: "recruiter",
    label: "Recruteur collégial",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
];

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
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const fadeRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  /* ── Signup state ── */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [shakeFields, setShakeFields] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /* ── Login state ── */
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginSubmitted, setLoginSubmitted] = useState(false);

  const pwdMeetsMin = password.length >= 8;
  const pwdMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const signupValid = firstName && lastName && email && pwdMeetsMin && !pwdMismatch && selectedRole;

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
  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!signupValid) {
      setShakeFields(true);
      setTimeout(() => setShakeFields(false), 600);
      return;
    }
    const user = {
      firstName,
      lastName,
      email,
      role: selectedRole,
      status: (selectedRole === "recruiter" || selectedRole === "coach") ? "pending_validation" : "active",
      onboarding_complete: false,
      institution: null,
      profile: {},
      search_criteria: null,
      team_needs: null,
      first_athlete: null,
    };
    localStorage.setItem("nexus_user", JSON.stringify(user));
    if (selectedRole === "recruiter" || selectedRole === "coach") {
      router.push("/auth/pending");
    } else {
      router.push("/onboarding");
    }
  };

  /* ── Login handler ── */
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSubmitted(true);
    if (!loginEmail || !loginPassword) {
      setShakeFields(true);
      setTimeout(() => setShakeFields(false), 600);
      return;
    }
    const stored = localStorage.getItem("nexus_user");
    if (!stored) {
      setToast("Créez un compte d’abord");
      return;
    }
    const user = JSON.parse(stored);
    if (user.onboarding_complete) {
      const dashMap: Record<string, string> = {
        coach: "/coach/tableau-de-bord",
        director_school: "/directeur-ecole/dashboard",
        director_cegep: "/directeur-cegep/dashboard",
        recruiter: "/recruteur/tableau-de-bord",
      };
      router.push(dashMap[user.role] || "/");
    } else {
      router.push("/onboarding");
    }
  };

  const socialToast = () => setToast("Connexion sociale — disponible en Phase 2");

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

      {/* ══════════ NAV ══════════ */}
      <nav className="sticky top-0 z-50 bg-[#111317]/92 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/brand/Profile%20white%20trans@4x.png" alt="Nexus" width={32} height={32} className="object-contain" />
            <span className="font-head font-black text-white text-base tracking-[0.06em] uppercase hidden sm:block">Nexus</span>
          </Link>
          <ul className="hidden md:flex items-center gap-8 list-none">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={`${label} text-[#9CA3AF] hover:text-white transition-colors`}>{l.label}</Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => switchMode("login")} className={`hidden sm:block ${label} text-[#E63946] transition-colors px-4 h-9 leading-9 hover:drop-shadow-[0_0_8px_rgba(230,57,70,0.6)] cursor-pointer`}>Connexion</button>
            <button type="button" onClick={() => switchMode("signup")} className="nx-ghost-btn h-9 px-5 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center cursor-pointer">S&apos;inscrire</button>
          </div>
        </div>
      </nav>

      {/* ══════════ AUTH CARD ══════════ */}
      <section className="flex-1 flex items-center justify-center relative py-16 px-6">
        <div className="relative z-10 w-full max-w-md">
          {/* Brand message */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-5">
              <span className="w-6 h-px bg-[#E63946]" />
              <span className={`${label} text-[#E63946]`}>Plateforme de recrutement</span>
              <span className="w-6 h-px bg-[#E63946]" />
            </div>
            <h1 className="font-head text-4xl sm:text-5xl font-black text-white uppercase leading-[0.92] tracking-tight">
              {mode === "login" ? "Connexion" : "Créer un compte"}
            </h1>
            <p className="font-sans text-sm text-[#9CA3AF] mt-3 max-w-xs mx-auto leading-relaxed">
              {mode === "login"
                ? "Accède à ton espace et connecte-toi avec ton réseau."
                : "Rejoins la plateforme #1 de recrutement au Québec."}
            </p>
          </div>

          {/* Auth card container */}
          <div className="bg-[#1A1D24] border border-white/5 rounded-xl p-8 sm:p-10">
            {/* Mode toggle tabs */}
            <div className="flex mb-8 border border-white/5 rounded-lg overflow-hidden">
              <button type="button" onClick={() => switchMode("login")} className={`flex-1 h-10 font-head font-black text-xs uppercase tracking-widest transition-colors ${mode === "login" ? "bg-[#E63946] text-white" : "bg-transparent text-[#9CA3AF] hover:text-white"}`}>Connexion</button>
              <button type="button" onClick={() => switchMode("signup")} className={`flex-1 h-10 font-head font-black text-xs uppercase tracking-widest transition-colors ${mode === "signup" ? "bg-[#E63946] text-white" : "bg-transparent text-[#9CA3AF] hover:text-white"}`}>Inscription</button>
            </div>

            {/* Animated form content */}
            <div ref={fadeRef} className="nx-auth-fade">

              {/* ══════════ INSCRIPTION ══════════ */}
              {mode === "signup" && (
                <>
                  {/* Social login */}
                  <div className="flex flex-col gap-3 mb-6">
                    <button type="button" onClick={socialToast} className="flex items-center justify-center gap-3 h-11 w-full bg-[#111317] border border-white/10 rounded-lg text-sm text-white hover:border-white/20 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Continuer avec Google
                    </button>
                    <button type="button" onClick={socialToast} className="flex items-center justify-center gap-3 h-11 w-full bg-[#111317] border border-white/10 rounded-lg text-sm text-white hover:border-white/20 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      Continuer avec Facebook
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className={`${label} text-[#6B7280]`}>ou par courriel</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* Signup form */}
                  <form onSubmit={handleSignup} className={`flex flex-col gap-4 ${shakeFields ? "animate-shake" : ""}`}>
                    {/* Prénom + Nom */}
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

                    {/* Email */}
                    <div>
                      <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Courriel <span className="text-[#EF4444]">*</span></label>
                      <input type="email" placeholder="coach@ecole.qc.ca" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} ${fieldErr(!!email)}`} />
                    </div>

                    {/* Password */}
                    <div>
                      <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Mot de passe <span className="text-[#EF4444]">*</span></label>
                      <div className="relative">
                        <input type={showPwd ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-10 ${fieldErr(pwdMeetsMin)}`} />
                        <EyeToggle show={showPwd} onClick={() => setShowPwd(!showPwd)} />
                      </div>
                      <p className={`text-xs mt-1.5 transition-colors ${pwdMeetsMin ? "text-[#22C55E]" : "text-[#6B7280]"}`}>
                        {pwdMeetsMin ? "✓" : "•"} Minimum 8 caractères
                      </p>
                    </div>

                    {/* Confirm password */}
                    <div>
                      <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Confirmer le mot de passe <span className="text-[#EF4444]">*</span></label>
                      <div className="relative">
                        <input type={showConfirmPwd ? "text" : "password"} placeholder="Mot de passe" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${inputClass} pr-10 ${pwdMismatch ? "border-[#EF4444]" : ""}`} />
                        <EyeToggle show={showConfirmPwd} onClick={() => setShowConfirmPwd(!showConfirmPwd)} />
                      </div>
                      {pwdMismatch && (
                        <p className="text-xs mt-1.5 text-[#EF4444]">Les mots de passe ne correspondent pas</p>
                      )}
                    </div>

                    {/* Role selection — 2x2 grid */}
                    <div>
                      <label className={`${label} text-[#9CA3AF] mb-2.5 block`}>Ton rôle <span className="text-[#EF4444]">*</span></label>
                      <div className={`grid grid-cols-2 gap-3 ${submitted && !selectedRole ? "animate-shake" : ""}`}>
                        {ROLES.map((r) => {
                          const isSelected = selectedRole === r.value;
                          return (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => setSelectedRole(r.value)}
                              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all text-center ${
                                isSelected
                                  ? "border-[#E63946] bg-[rgba(230,57,70,0.1)] text-white"
                                  : "border-white/10 text-[#9CA3AF] hover:border-white/20 hover:text-white"
                              }`}
                            >
                              <span className={isSelected ? "text-[#E63946]" : "text-[#6B7280]"}>{r.icon}</span>
                              <span className="font-head font-black text-[10px] uppercase tracking-[0.15em] leading-tight">{r.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recruiter warning */}
                    {selectedRole === "recruiter" && (
                      <div className="flex gap-3 p-4 bg-[#1A1D24] border-l-4 border-[#EAB308] rounded-r-lg">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <p className="text-xs text-[#9CA3AF] leading-relaxed">
                          Ton compte devra être validé par un administrateur avant d&apos;accéder à la plateforme. Tu recevras un courriel de confirmation.
                        </p>
                      </div>
                    )}

                    {/* CTA */}
                    <button
                      type="submit"
                      disabled={false}
                      className={`h-12 w-full rounded-lg font-head font-black text-sm uppercase tracking-widest mt-2 transition-all ${
                        signupValid
                          ? "bg-[#E63946] text-white hover:bg-[#D42B22] hover:shadow-[0_8px_28px_rgba(230,57,70,0.38)] hover:-translate-y-0.5 cursor-pointer"
                          : "bg-[#E63946]/50 text-white/50 cursor-not-allowed"
                      }`}
                    >
                      Créer mon compte &rarr;
                    </button>
                  </form>

                  {/* Switch to login */}
                  <p className="font-sans text-sm text-[#9CA3AF] text-center mt-6">
                    Déjà un compte?{" "}
                    <button type="button" onClick={() => switchMode("login")} className="text-[#9CA3AF] font-bold hover:text-[#E63946] transition-colors">Se connecter</button>
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
                      Continuer avec Google
                    </button>
                    <button type="button" onClick={socialToast} className="flex items-center justify-center gap-3 h-11 w-full bg-[#111317] border border-white/10 rounded-lg text-sm text-white hover:border-white/20 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      Continuer avec Facebook
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className={`${label} text-[#6B7280]`}>ou par courriel</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* Login form */}
                  <form onSubmit={handleLogin} className={`flex flex-col gap-4 ${shakeFields ? "animate-shake" : ""}`}>
                    <div>
                      <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Courriel</label>
                      <input type="email" placeholder="coach@ecole.qc.ca" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className={`${inputClass} ${loginFieldErr(!!loginEmail)}`} />
                    </div>
                    <div>
                      <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Mot de passe</label>
                      <div className="relative">
                        <input type={showLoginPwd ? "text" : "password"} placeholder="Mot de passe" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={`${inputClass} pr-10 ${loginFieldErr(!!loginPassword)}`} />
                        <EyeToggle show={showLoginPwd} onClick={() => setShowLoginPwd(!showLoginPwd)} />
                      </div>
                    </div>
                    <div className="flex justify-end -mt-1">
                      <button type="button" onClick={() => setToast("Disponible en Phase 2")} className={`${label} text-[#9CA3AF] hover:text-[#E63946] transition-colors`}>Mot de passe oublié?</button>
                    </div>
                    <button type="submit" className="h-12 w-full bg-[#E63946] text-white rounded-lg font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] transition-all hover:shadow-[0_8px_28px_rgba(230,57,70,0.38)] hover:-translate-y-0.5 mt-2 cursor-pointer">
                      Se connecter &rarr;
                    </button>
                  </form>

                  {/* Switch to signup */}
                  <p className="font-sans text-sm text-[#9CA3AF] text-center mt-6">
                    Pas de compte?{" "}
                    <button type="button" onClick={() => switchMode("signup")} className="text-[#9CA3AF] font-bold hover:text-[#E63946] transition-colors">S&apos;inscrire</button>
                  </p>
                </>
              )}

            </div>{/* end nx-auth-fade */}
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="bg-[#111317]/80 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Image src="/brand/Profile%20white%20trans@4x.png" alt="Nexus" width={24} height={24} className="object-contain opacity-60" />
              <span className={`${label} text-[#6B7280]`}>Construit pour les étudiants-athlètes québécois</span>
            </div>
            <nav className="flex items-center gap-8">
              <Link href="/confidentialite" className={`${label} text-[#6B7280] hover:text-[#9CA3AF] transition-colors`}>Confidentialité</Link>
              <Link href="/conditions" className={`${label} text-[#6B7280] hover:text-[#9CA3AF] transition-colors`}>Conditions</Link>
              <Link href="/contact" className={`${label} text-[#6B7280] hover:text-[#9CA3AF] transition-colors`}>Contact</Link>
            </nav>
            <div className="flex items-center gap-5">
              {SOCIALS.map(({ name, href, d }) => (
                <a key={name} href={href} aria-label={name} target="_blank" rel="noopener noreferrer" className="nx-social-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={d} /></svg>
                </a>
              ))}
            </div>
          </div>
          <p className={`${label} text-[#6B7280]/40 text-center pt-5`}>&copy; 2025 Nexus</p>
        </div>
      </footer>
    </div>
  );
}
