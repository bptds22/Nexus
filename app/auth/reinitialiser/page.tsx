"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../../components/PlaybookBackground";
import Footer from "@/components/marketing/Footer";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Reset Password Page
   Reached via the email link from "Mot de passe oublié".
   User enters a new password + confirmation.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";


export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token"); // Will come from Supabase email link
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    // TODO: integrate with Supabase Auth updateUser({ password })
    setSubmitted(true);
  };

  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />

      <MarketingNav />

      {/* RESET PASSWORD CARD */}
      <section className="flex-1 flex items-center justify-center relative py-16 px-6">
        <div className="relative z-10 w-full max-w-md">

          {/* Brand eyebrow */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-5">
              <span className="w-6 h-px bg-wl-red" />
              <span className={`${label} text-wl-red`}>Sécurité du compte</span>
              <span className="w-6 h-px bg-wl-red" />
            </div>
            <h1 className="font-head text-4xl sm:text-5xl font-black text-white uppercase leading-[0.92] tracking-tight">
              {submitted ? "Mot de passe mis à jour" : "Réinitialiser mot de passe"}
            </h1>
            {!submitted && (
              <p className="font-sans text-sm text-[#9AA3B2] mt-3 max-w-xs mx-auto leading-relaxed">
                Choisis un nouveau mot de passe sécurisé pour ton compte.
              </p>
            )}
          </div>

          {/* Card */}
          <div className="nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-8 sm:p-10">
            <div className="nx-auth-fade">

              {!submitted ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                  {/* New password */}
                  <div>
                    <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors"
                    />
                    <p className={`${label} text-[#475569] mt-1.5`}>Minimum 8 caractères</p>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Confirmer le mot de passe</label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
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

                  {/* Submit */}
                  <button
                    type="submit"
                    className="h-12 w-full bg-wl-red text-white font-head font-black text-sm uppercase tracking-widest hover:bg-wl-red-hover transition-colors hover:shadow-[0_8px_28px_rgba(232,72,72,0.38)] hover:-translate-y-0.5 mt-2"
                  >
                    Réinitialiser le mot de passe
                  </button>
                </form>
              ) : (
                /* Success state */
                <div className="text-center py-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-[#10b981] mb-6" style={{ borderRadius: "50%" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>

                  <h2 className="font-head text-2xl font-black text-white uppercase tracking-tight mb-3">
                    C&apos;est fait!
                  </h2>
                  <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed mb-6">
                    Ton mot de passe a été réinitialisé avec succès.<br />
                    Tu peux maintenant te connecter avec ton nouveau mot de passe.
                  </p>

                  <Link
                    href="/auth"
                    className="inline-flex items-center justify-center h-12 px-8 bg-wl-red text-white font-head font-black text-sm uppercase tracking-widest hover:bg-wl-red-hover transition-colors hover:shadow-[0_8px_28px_rgba(232,72,72,0.38)] hover:-translate-y-0.5"
                  >
                    Se connecter →
                  </Link>
                </div>
              )}

              {/* Back to login */}
              {!submitted && (
                <p className="font-sans text-sm text-[#9AA3B2] text-center mt-6">
                  <Link href="/auth" className="text-[#9AA3B2] font-bold hover:text-wl-red transition-colors duration-300">
                    ← Retour à la connexion
                  </Link>
                </p>
              )}

            </div>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
