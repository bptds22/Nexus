"use client";

import { useState, useEffect, Suspense } from "react";
import NexusLogo from "@/components/ui/NexusLogo";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Email Verification Page
   Shown after sign-up. User is prompted to check their inbox.
   Also handles the confirmation callback (?confirmed=true).
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";


const SOCIALS = [
  { name: "Instagram", href: "#", d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
  { name: "Facebook", href: "#", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
  { name: "YouTube", href: "#", d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
  { name: "TikTok", href: "#", d: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" },
];

export default function VerificationEmailPage() {
  return (
    <Suspense>
      <VerificationEmailContent />
    </Suspense>
  );
}

function VerificationEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const confirmed = searchParams.get("confirmed") === "true";
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  /* Resend cooldown timer */
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleResend = () => {
    if (countdown > 0) return;
    // TODO: integrate with Supabase Auth resend verification email
    setResent(true);
    setCountdown(60);
  };

  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />

      <MarketingNav />

      {/* EMAIL VERIFICATION CARD */}
      <section className="flex-1 flex items-center justify-center relative py-16 px-6">
        <div className="relative z-10 w-full max-w-md">

          {/* Brand eyebrow */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-5">
              <span className="w-6 h-px bg-wl-red" />
              <span className={`${label} text-wl-red`}>Vérification</span>
              <span className="w-6 h-px bg-wl-red" />
            </div>
            <h1 className="font-head text-4xl sm:text-5xl font-black text-white uppercase leading-[0.92] tracking-tight">
              {confirmed ? "Courriel confirmé" : "Vérifie ton courriel"}
            </h1>
          </div>

          {/* Card */}
          <div className="nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-8 sm:p-10">
            <div className="nx-auth-fade">

              {confirmed ? (
                /* ── Confirmed state ── */
                <div className="text-center py-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-[#10b981] mb-6" style={{ borderRadius: "50%" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>

                  <h2 className="font-head text-2xl font-black text-white uppercase tracking-tight mb-3">
                    Ton compte est activé!
                  </h2>
                  <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed mb-6">
                    Ton adresse courriel a été vérifiée avec succès.<br />
                    Tu peux maintenant accéder à ton espace.
                  </p>

                  <Link
                    href="/auth"
                    className="inline-flex items-center justify-center h-12 px-8 bg-wl-red text-white font-head font-black text-sm uppercase tracking-widest hover:bg-wl-red-hover transition-colors hover:shadow-[0_8px_28px_rgba(232,72,72,0.38)] hover:-translate-y-0.5"
                  >
                    Se connecter →
                  </Link>
                </div>
              ) : (
                /* ── Waiting for confirmation ── */
                <div className="text-center py-4">

                  {/* Mail icon */}
                  <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-wl-red mb-6" style={{ borderRadius: "50%" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 7l-10 7L2 7" />
                    </svg>
                  </div>

                  <h2 className="font-head text-2xl font-black text-white uppercase tracking-tight mb-3">
                    Un courriel t&apos;a été envoyé
                  </h2>
                  <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed mb-2">
                    Nous avons envoyé un lien de vérification à
                  </p>
                  {email && (
                    <p className="font-sans text-sm text-white font-medium mb-6">
                      {email}
                    </p>
                  )}
                  {!email && (
                    <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed mb-6">
                      ton adresse courriel.
                    </p>
                  )}

                  <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed mb-6">
                    Clique sur le lien dans le courriel pour activer ton compte.
                  </p>

                  {/* Resend button */}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={countdown > 0}
                    className={`nx-ghost-btn h-11 px-8 border font-head font-black text-xs uppercase tracking-widest transition-all ${
                      countdown > 0 ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {countdown > 0
                      ? `Renvoyer dans ${countdown}s`
                      : resent
                        ? "Renvoyer le courriel"
                        : "Renvoyer le courriel"
                    }
                  </button>

                  {resent && countdown > 0 && (
                    <p className="font-sans text-xs text-[#10b981] mt-3">
                      Courriel renvoyé avec succès!
                    </p>
                  )}

                  {/* Spam tip */}
                  <p className="font-sans text-xs text-[#475569] text-center mt-5 leading-relaxed">
                    Tu ne reçois rien? Vérifie ton dossier de courriels indésirables (spam).
                  </p>
                </div>
              )}

              {/* Back to login */}
              <p className="font-sans text-sm text-[#9AA3B2] text-center mt-6">
                <Link href="/auth" className="text-[#9AA3B2] font-bold hover:text-wl-red transition-colors duration-300">
                  ← Retour à la connexion
                </Link>
              </p>

            </div>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#030609]/80 border-t border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#1E2D4A]">
            <div className="flex items-center gap-3">
              <NexusLogo variant="white" height={22} href="/" className="opacity-80" />
              <span className={`${label} text-[#475569]`}>Construit pour les étudiants-athlètes québécois</span>
            </div>
            <nav className="flex items-center gap-8">
              <Link href="/confidentialite" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Confidentialité</Link>
              <Link href="/conditions" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Conditions</Link>
              <Link href="/contact" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Contact</Link>
            </nav>
            <div className="flex items-center gap-5">
              {SOCIALS.map(({ name, href, d }) => (
                <a key={name} href={href} aria-label={name} target="_blank" rel="noopener noreferrer" className="nx-social-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={d} /></svg>
                </a>
              ))}
            </div>
          </div>
          <p className={`${label} text-[#2E3D55] text-center pt-5`}>&copy; 2026 Nexus — Propulsé par <img src="/brand/logo-white-red.png" alt="WeLead" style={{height:16}} /></p>
        </div>
      </footer>
    </div>
  );
}
