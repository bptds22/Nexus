"use client";

import { useState, useRef, useCallback, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ThemeToggle from "../components/ThemeToggle";
import PlaybookBackground from "../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Auth Page (Login / Sign Up)
   Same visual language as landing: dark navy, playbook bg,
   Montserrat headings, ghost buttons, red accents.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

const NAV_LINKS = [
  { label: "Comment ça marche", href: "/comment-ca-marche" },
  { label: "Coaches & Recruteurs", href: "/#roles" },
  { label: "Athlètes", href: "/#athletes" },
  { label: "Roadmap", href: "/roadmap" },
];

const SOCIALS = [
  {
    name: "Instagram",
    href: "#",
    d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    name: "Facebook",
    href: "#",
    d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    name: "Twitter / X",
    href: "#",
    d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    name: "LinkedIn",
    href: "#",
    d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
];

const ROLES = [
  { value: "coach",     label: "Entraîneur Secondaire" },
  { value: "director",  label: "Directeur Secondaire" },
  { value: "recruiter", label: "Recruteur Collégial" },
];

export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [selectedRole, setSelectedRole] = useState("");
  const fadeRef = useRef<HTMLDivElement>(null);

  /* Replay fade animation on mode switch */
  const switchMode = useCallback((next: "login" | "signup") => {
    if (next === mode) return;
    const el = fadeRef.current;
    if (el) {
      el.classList.remove("nx-auth-fade");
      void el.offsetWidth; // force reflow to reset animation
      el.classList.add("nx-auth-fade");
    }
    setMode(next);
  }, [mode]);

  /* Placeholder handlers — ready for Supabase integration */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate with Supabase Auth
  };

  return (
    <div className="hero-playbook bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />

      {/* ══════════════════════════════════════════
          NAV
      ══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-[#060A14]/92 backdrop-blur-md border-b border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/Profile%20white%20trans@4x.png"
              alt="Nexus"
              width={32}
              height={32}
              className="object-contain nx-logo-dark"
            />
            <Image
              src="/brand/Profile%20trans@4x.png"
              alt="Nexus"
              width={32}
              height={32}
              className="object-contain nx-logo-light"
            />
            <span className="font-head font-black text-white text-base tracking-[0.06em] uppercase hidden sm:block">
              Nexus
            </span>
          </Link>

          <ul className="hidden md:flex items-center gap-8 list-none">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={`${label} text-[#9AA3B2] hover:text-white transition-colors`}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button type="button" onClick={() => switchMode("login")} className={`hidden sm:block ${label} text-wl-red transition-colors px-4 h-9 leading-9 hover:drop-shadow-[0_0_8px_rgba(232,72,72,0.6)] cursor-pointer`}>
              Connexion
            </button>
            <button type="button" onClick={() => switchMode("signup")} className="nx-ghost-btn h-9 px-5 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center cursor-pointer">
              S&apos;inscrire
            </button>
          </div>

        </div>
      </nav>

      {/* ══════════════════════════════════════════
          AUTH CARD
      ══════════════════════════════════════════ */}
      <section className="flex-1 flex items-center justify-center relative py-16 px-6">
        <div className="relative z-10 w-full max-w-md">

          {/* Brand message */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-5">
              <span className="w-6 h-px bg-wl-red" />
              <span className={`${label} text-wl-red`}>Plateforme de recrutement</span>
              <span className="w-6 h-px bg-wl-red" />
            </div>
            <h1 className="font-head text-4xl sm:text-5xl font-black text-white uppercase leading-[0.92] tracking-tight">
              {mode === "login" ? "Connexion" : "Créer un compte"}
            </h1>
            <p className="font-sans text-sm text-[#9AA3B2] mt-3 max-w-xs mx-auto leading-relaxed">
              {mode === "login"
                ? "Accède à ton espace et connecte-toi avec ton réseau."
                : "Rejoins la plateforme #1 de recrutement au Québec."}
            </p>
          </div>

          {/* Auth card container */}
          <div className="nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-8 sm:p-10">

            {/* ── Mode toggle tabs ── */}
            <div className="flex mb-8 border border-[#1E2D4A]">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`flex-1 h-10 font-head font-black text-xs uppercase tracking-widest transition-colors ${
                  mode === "login"
                    ? "bg-wl-red text-white"
                    : "bg-transparent text-[#9AA3B2] hover:text-white"
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`flex-1 h-10 font-head font-black text-xs uppercase tracking-widest transition-colors ${
                  mode === "signup"
                    ? "bg-wl-red text-white"
                    : "bg-transparent text-[#9AA3B2] hover:text-white"
                }`}
              >
                Inscription
              </button>
            </div>

            {/* ── Animated form content ── */}
            <div ref={fadeRef} className="nx-auth-fade">

            {/* ── Social login buttons ── */}
            <div className="flex flex-col gap-3 mb-6">
              <button
                type="button"
                onClick={() => {/* TODO: Google OAuth */}}
                className="nx-ghost-btn nx-social-auth-btn flex items-center justify-center gap-3 h-11 w-full border font-sans text-sm"
              >
                {/* Google icon */}
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuer avec Google
              </button>

              <button
                type="button"
                onClick={() => {/* TODO: Facebook OAuth */}}
                className="nx-ghost-btn nx-social-auth-btn flex items-center justify-center gap-3 h-11 w-full border font-sans text-sm"
              >
                {/* Facebook icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Continuer avec Facebook
              </button>
            </div>

            {/* ── Separator ── */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-[#1E2D4A]" />
              <span className={`${label} text-[#475569]`}>ou par courriel</span>
              <div className="flex-1 h-px bg-[#1E2D4A]" />
            </div>

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Sign up: first + last name */}
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Prénom</label>
                    <input
                      type="text"
                      placeholder="Jean"
                      className="nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Nom</label>
                    <input
                      type="text"
                      placeholder="Tremblay"
                      className="nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Courriel</label>
                <input
                  type="email"
                  placeholder="coach@ecole.qc.ca"
                  className="nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors"
                />
              </div>

              {/* Sign up: confirm password */}
              {mode === "signup" && (
                <div>
                  <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Confirmer le mot de passe</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors"
                  />
                </div>
              )}

              {/* Sign up: role selector */}
              {mode === "signup" && (
                <div>
                  <label className={`${label} text-[#9AA3B2] mb-2.5 block`}>Ton rôle</label>
                  <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
                    {ROLES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setSelectedRole(r.value)}
                        className={
                          selectedRole === r.value
                            ? "nx-role-active flex-1 h-12 px-4 font-head font-black text-xs uppercase tracking-widest border border-wl-red bg-wl-red text-white"
                            : "nx-ghost-btn flex-1 h-12 px-4 font-head font-black text-xs uppercase tracking-widest border"
                        }
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Login: forgot password */}
              {mode === "login" && (
                <div className="flex justify-end -mt-1">
                  <Link
                    href="/mot-de-passe-oublie"
                    className={`${label} text-[#9AA3B2] hover:text-wl-red transition-colors duration-300`}
                  >
                    Mot de passe oublié?
                  </Link>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                className="h-12 w-full bg-wl-red text-white font-head font-black text-sm uppercase tracking-widest hover:bg-wl-red-hover transition-colors hover:shadow-[0_8px_28px_rgba(232,72,72,0.38)] hover:-translate-y-0.5 mt-2"
              >
                {mode === "login" ? "Se connecter →" : "Créer mon compte →"}
              </button>
            </form>

            {/* ── Mode switch link ── */}
            <p className="font-sans text-sm text-[#9AA3B2] text-center mt-6">
              {mode === "login" ? (
                <>
                  Pas encore de compte?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="text-[#9AA3B2] font-bold hover:text-wl-red transition-colors duration-300"
                  >
                    S&apos;inscrire
                  </button>
                </>
              ) : (
                <>
                  Déjà un compte?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-[#9AA3B2] font-bold hover:text-wl-red transition-colors duration-300"
                  >
                    Se connecter
                  </button>
                </>
              )}
            </p>

            </div>{/* end nx-auth-fade */}

          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="bg-[#030609]/80 border-t border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#1E2D4A]">

            <div className="flex items-center gap-3">
              <Image
                src="/brand/Profile%20white%20trans@4x.png"
                alt="Nexus"
                width={24}
                height={24}
                className="object-contain opacity-60"
              />
              <span className={`${label} text-[#475569]`}>
                Construit pour les étudiants-athlètes québécois
              </span>
            </div>

            <nav className="flex items-center gap-8">
              <Link href="/confidentialite" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Confidentialité</Link>
              <Link href="/conditions" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Conditions</Link>
              <Link href="/contact" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Contact</Link>
            </nav>

            <div className="flex items-center gap-5">
              {SOCIALS.map(({ name, href, d }) => (
                <a key={name} href={href} aria-label={name} target="_blank" rel="noopener noreferrer"
                  className="nx-social-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={d} />
                  </svg>
                </a>
              ))}
            </div>

          </div>

          <p className={`${label} text-[#2E3D55] text-center pt-5`}>&copy; 2025 Nexus</p>

        </div>
      </footer>

    </div>
  );
}
