"use client";

/* ═══════════════════════════════════════════════════════════════
   LoginMobile — iter 7.46 → 7.46e

   Iter 7.46e :
   - Playbook art MONTÉ DANS le dispatcher (persistant Welcome ↔ Login
     pour le slide partagé). Cet écran ne contient plus d'instance de
     PlaybookHeroArt.
   - Root devient `absolute inset-0` (parent motion.div est `fixed
     inset-0` → on évite la double position fixed).
   - Dim côté contenu géré par un gradient interne ici : opaque #111317
     en haut (header + form lisibles) → transparent en bas (où le
     playbook lifted reste visible pendant le slide).
   - Font bumps :
       Labels    11px → 13px, couleur #6b7280 → #B6BCC7
       Inputs    16px → 17px (toujours ≥16 = no-zoom iOS)
       Forgot pw 12px → 14px, couleur #6b7280 → #9CA3AF

   Logique post-login INCHANGÉE (postLoginDispatch canon DIAG 7.45 §A.3).
   Keyboard auto-hide footer conservé (iter 7.46c). Point final blanc
   conservé (7.46d).

   ⚠️ Hooks AVANT early return (canon 7.8d).
═══════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/utils/translateAuthError";
import { postLoginDispatch } from "@/lib/auth/postLoginDispatch";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { NexusLogoSvg } from "./NexusLogoSvg";
import { useSplashLogoLayoutId } from "./SplashGate";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (intensity === "Medium") {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch { /* no-op */ }
}

interface LoginMobileProps {
  /** Retour Welcome ("Pas de compte ? Commencer"). */
  onShowWelcome: () => void;
}

const KEYBOARD_VIEWPORT_THRESHOLD_PX = 520;

export function LoginMobile({ onShowWelcome }: LoginMobileProps) {
  // Hooks AVANT toute condition (canon 7.8d).
  const router = useRouter();
  const toast = useMobileToast();
  const logoLayoutId = useSplashLogoLayoutId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboardOpen(vv.height < KEYBOARD_VIEWPORT_THRESHOLD_PX);
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;
  const footerHidden = keyboardOpen || inputFocused;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    triggerHaptic("Light");
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      toast.error({
        message: "Connexion impossible",
        detail: error ? translateAuthError(error.message) : "Identifiants invalides",
      });
      setLoading(false);
      return;
    }

    triggerHaptic("Medium");
    try {
      await postLoginDispatch(supabase, data.user, router);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inattendue";
      toast.error({ message: "Erreur après connexion", detail: message });
      setLoading(false);
    }
  }

  function handleForgotPassword() {
    triggerHaptic("Light");
    toast.info({
      message: "Bientôt disponible",
      detail: "La réinitialisation par courriel arrive dans une prochaine mise à jour.",
    });
  }

  function handleBackToWelcome() {
    triggerHaptic("Light");
    onShowWelcome();
  }

  return (
    <div
      className="absolute inset-0 w-full text-white flex flex-col overflow-hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Dim côté contenu : iter 7.46f — la zone basse devient
          PLEINEMENT transparente pour laisser respirer le playbook.
          - 0%   → 48%  : opaque #111317 (header + form labels + subtitle)
          - 48%  → 70%  : transition opaque → transparent (couvre la fin
                          du form / CTA, qui ont leur propre bg solide)
          - 70%  → 100% : transparent pur (spacer + footer = playbook nu) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, #111317 0%, #111317 48%, rgba(17,19,23,0) 70%, rgba(17,19,23,0) 100%)",
        }}
      />

      {/* HEADER — logo centré + headline + subtitle */}
      <div className="relative z-10 px-6 shrink-0" style={{ paddingTop: 24 }}>
        <div className="flex justify-center">
          {/* Iter 7.47d : NexusLogoSvg wrappé en motion.div layoutId
              pour le glide morph depuis la splash. logoLayoutId vient
              du context — défini pendant la fenêtre splash + morph,
              undefined ensuite. */}
          <motion.div
            layoutId={logoLayoutId}
            transition={{ layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
          >
            <NexusLogoSvg width={91} />
          </motion.div>
        </div>
        <div className="mt-8">
          <h1
            className="font-head font-black text-white uppercase tracking-tight"
            style={{ fontSize: 28, lineHeight: 0.95 }}
          >
            Bon retour.
          </h1>
          <p className="text-[14px] text-[#9CA3AF] mt-2">
            Connecte-toi à ton compte Nexus.
          </p>
        </div>
      </div>

      {/* FORM — 32px sous le subtitle */}
      <div className="relative z-10 px-6 shrink-0" style={{ marginTop: 32 }}>
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Email row */}
          <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3">
            <label
              htmlFor="email-mobile"
              className="block uppercase mb-1"
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: "#B6BCC7",
              }}
            >
              Courriel
            </label>
            <input
              id="email-mobile"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="nom@exemple.ca"
              disabled={loading}
              className="w-full bg-transparent text-white placeholder:text-[#4a4d56] focus:outline-none disabled:opacity-60"
              style={{ fontSize: 17 }}
            />
          </div>

          {/* Password row + eye toggle */}
          <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 mt-3">
            <label
              htmlFor="password-mobile"
              className="block uppercase mb-1"
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: "#B6BCC7",
              }}
            >
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password-mobile"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full bg-transparent text-white placeholder:text-[#4a4d56] focus:outline-none pr-9 disabled:opacity-60"
                style={{ fontSize: 17 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9CA3AF] active:text-white p-1"
                tabIndex={-1}
              >
                {showPwd ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mot de passe oublié — 12px sous, droite, font bumpée 14px */}
          <div className="flex justify-end" style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[#9CA3AF] active:text-white py-1"
              style={{ fontSize: 14 }}
            >
              Mot de passe oublié ?
            </button>
          </div>

          {/* CTA Se connecter — 28px sous */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{ marginTop: 28 }}
            className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              canSubmit
                ? "bg-[#E63946] text-white active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)]"
                : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
            }`}
          >
            {loading ? (
              <>
                <span
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden
                />
                Connexion…
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>
      </div>

      {/* Spacer — le vide vit ICI */}
      <div className="relative flex-1" />

      {/* FOOTER — masqué au focus input ou clavier ouvert */}
      <div
        className="relative z-10 px-6 shrink-0"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
          opacity: footerHidden ? 0 : 1,
          visibility: footerHidden ? "hidden" : "visible",
          transition: "opacity 180ms ease, visibility 180ms ease",
        }}
        aria-hidden={footerHidden ? "true" : "false"}
      >
        <button
          type="button"
          onClick={handleBackToWelcome}
          className="w-full text-center text-[13px] text-[#9CA3AF] active:text-white py-2"
        >
          Pas de compte ?{" "}
          <span className="text-white font-bold underline underline-offset-4 decoration-1">
            Commencer
          </span>
        </button>
      </div>
    </div>
  );
}
