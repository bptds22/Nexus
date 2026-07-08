"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../components/PlaybookBackground";
import Footer from "@/components/marketing/Footer";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Forgot Password Page
   Same visual language as auth page: dark navy, playbook bg,
   Montserrat headings, ghost buttons, red accents.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/* Recovery links land the user on /auth/reinitialiser; Supabase's
   detectSessionInUrl (PKCE ?code=) establishes the recovery session there. */
const RESET_REDIRECT_TO = "https://nexussports.ca/auth/reinitialiser";


export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fadeRef = useRef<HTMLDivElement>(null);

  /* Fire the Supabase recovery email. Anti-enumeration: we surface the
     same success state whether or not the address has an account — only a
     genuine transport failure flips the error state. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: RESET_REDIRECT_TO },
    );

    setLoading(false);
    if (resetError) {
      setError("Impossible d'envoyer le courriel pour le moment. Vérifie ta connexion et réessaie.");
      return;
    }
    setSubmitted(true);
  };

  /* Resend handler — re-fires the recovery email and replays the fade. */
  const handleResend = async () => {
    if (loading) return;
    const supabase = createClient();
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: RESET_REDIRECT_TO });
    setLoading(false);

    const el = fadeRef.current;
    if (el) {
      el.classList.remove("nx-auth-fade");
      void el.offsetWidth;
      el.classList.add("nx-auth-fade");
    }
  };

  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />

      <MarketingNav />

      {/* ══════════════════════════════════════════
          FORGOT PASSWORD CARD
      ══════════════════════════════════════════ */}
      <section className="flex-1 flex items-center justify-center relative py-16 px-6">
        <div className="relative z-10 w-full max-w-md">

          {/* Brand eyebrow */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-5">
              <span className="w-6 h-px bg-wl-red" />
              <span className={`${label} text-wl-red`}>Réinitialisation</span>
              <span className="w-6 h-px bg-wl-red" />
            </div>
            <h1 className="nx-display text-4xl sm:text-5xl font-black text-white uppercase leading-[0.92] tracking-tight">
              Mot de passe oublié?
            </h1>
            <p className="font-sans text-sm text-[#9AA3B2] mt-3 max-w-xs mx-auto leading-relaxed">
              Entre ton adresse courriel et nous t&apos;enverrons un lien pour réinitialiser ton mot de passe.
            </p>
          </div>

          {/* Card container — same style as auth card */}
          <div className="nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-8 sm:p-10">
            <div ref={fadeRef} className="nx-auth-fade">

              {!submitted ? (
                /* ── Request form ── */
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                  {/* Email input */}
                  <div>
                    <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Courriel</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="coach@ecole.qc.ca"
                      required
                      className="nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="flex items-center gap-2.5 bg-[#E63946]/[0.08] border border-[#E63946]/25 rounded px-4 py-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
                      </svg>
                      <p className="font-sans text-sm text-[#E63946]">{error}</p>
                    </div>
                  )}

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`nx-ghost-btn h-12 w-full border font-head font-black text-sm uppercase tracking-widest mt-2 ${loading ? "opacity-60 cursor-wait" : ""}`}
                  >
                    {loading ? "Envoi en cours…" : "Envoyer le lien de réinitialisation"}
                  </button>
                </form>
              ) : (
                /* ── Success state ── */
                <div className="text-center py-4">

                  {/* Checkmark icon */}
                  <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-wl-red mb-6" style={{ borderRadius: "50%" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>

                  <h2 className="nx-display text-2xl font-black text-white uppercase tracking-tight mb-3">
                    Courriel envoyé
                  </h2>
                  <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed mb-6">
                    Un lien de réinitialisation a été envoyé à{" "}
                    <span className="text-white font-medium">{email}</span>.
                    <br />
                    Vérifie ta boîte de réception.
                  </p>

                  {/* Resend button */}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className={`nx-ghost-btn h-11 px-8 border font-head font-black text-xs uppercase tracking-widest ${loading ? "opacity-60 cursor-wait" : ""}`}
                  >
                    {loading ? "Envoi en cours…" : "Renvoyer le courriel"}
                  </button>
                </div>
              )}

              {/* ── Helper text ── */}
              {submitted && (
                <p className="font-sans text-xs text-[#475569] text-center mt-5 leading-relaxed">
                  Tu ne reçois rien? Vérifie ton dossier de courriels indésirables (spam).
                </p>
              )}

              {/* ── Back to login ── */}
              <p className="font-sans text-sm text-[#9AA3B2] text-center mt-6">
                <Link
                  href="/auth"
                  className="text-[#9AA3B2] font-bold hover:text-wl-red transition-colors duration-300"
                >
                  ← Retour à la connexion
                </Link>
              </p>

            </div>
          </div>

        </div>
      </section>

      <Footer />

    </div>
  );
}
