"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../../components/PlaybookBackground";
import Footer from "@/components/marketing/Footer";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/utils/translateAuthError";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Email Verification Page
   Shown after sign-up. User is prompted to check their inbox.
   Also handles the confirmation callback (?confirmed=true).
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";


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
  const [sending, setSending] = useState(false);
  const [resendError, setResendError] = useState("");

  /* Resend cooldown timer */
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  /* ── Renvoi RÉEL du courriel de confirmation ──────────────────────
     CE QUI ÉTAIT LÀ AVANT (2026-09-16) : un `// TODO` suivi de
     `setResent(true); setCountdown(60);`. Le bouton n'appelait RIEN et
     affichait « Courriel renvoyé avec succès! » en vert. Le pire des
     cas : l'utilisateur qui n'a jamais reçu son courriel recevait la
     confirmation d'un envoi qui n'a jamais eu lieu, et n'avait aucune
     raison de chercher ailleurs.

     D'où les deux règles qui tiennent cette fonction :
     1. le vert et le compte à rebours ne se posent QU'APRÈS un retour
        sans erreur — un `return` sec sur le chemin d'erreur, jamais un
        `finally` qui les poserait dans les deux cas ;
     2. sans `?email=`, on ne part pas « à vide » : Supabase répondrait
        sur une adresse absente et on afficherait un succès tout aussi
        faux. Le bouton est désactivé et on renvoie vers la connexion.

     `type: "signup"` et non `"email_change"` : c'est le courriel de
     confirmation d'inscription. Anti-énumération : `resend` ne dit pas
     si l'adresse existe, et translateAuthError neutralise de toute
     façon « user already registered ». */
  const handleResend = async () => {
    if (countdown > 0 || sending || !email) return;
    setSending(true);
    setResendError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) {
        setResendError(translateAuthError(error.message));
        return;
      }
      setResent(true);
      setCountdown(60);
    } catch (e) {
      // Panne réseau : `resend` lève au lieu de rendre { error }.
      setResendError(translateAuthError(e instanceof Error ? e.message : String(e)));
    } finally {
      setSending(false);
    }
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
                    disabled={countdown > 0 || sending || !email}
                    className={`nx-ghost-btn h-11 px-8 border font-head font-black text-xs uppercase tracking-widest transition-all ${
                      countdown > 0 || sending || !email ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {sending
                      ? "Envoi…"
                      : countdown > 0
                        ? `Renvoyer dans ${countdown}s`
                        : "Renvoyer le courriel"
                    }
                  </button>

                  {/* Le vert n'apparaît QUE derrière un retour sans erreur. */}
                  {resent && countdown > 0 && (
                    <p className="font-sans text-xs text-[#10b981] mt-3">
                      Courriel renvoyé avec succès!
                    </p>
                  )}

                  {resendError && (
                    <p className="font-sans text-xs text-[#EF4444] mt-3">
                      {resendError}
                    </p>
                  )}

                  {/* Pas d'adresse dans l'URL : on dit POURQUOI le bouton est
                      inerte plutôt que de le laisser deviner. */}
                  {!email && (
                    <p className="font-sans text-xs text-[#9AA3B2] mt-3 leading-relaxed">
                      Nous n&apos;avons pas ton adresse sous la main.{" "}
                      <Link href="/auth" className="font-bold text-white hover:text-wl-red transition-colors">
                        Connecte-toi
                      </Link>{" "}
                      pour recevoir un nouveau lien.
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

      <Footer />
    </div>
  );
}
