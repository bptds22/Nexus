"use client";

/* ═══════════════════════════════════════════════════════════════
   SocialButtonsMobile — iter 7.60

   UI uniquement : "Continuer avec Google" + "Continuer avec Apple".
   Aucun OAuth réel. Au tap → toast "Bientôt disponible" (canon
   T.toasts.socialPhase2 desktop). Apple Sign-In sera obligatoire
   pour l'App Store si Google est offert ; ces boutons sont prêts
   à recevoir le vrai handler quand le câblage OAuth (Google Cloud
   + Apple Developer + Supabase providers + flow Capacitor) sera
   fait dans une session dédiée.

   Logos officiels : SVG inline (G multicolore Google, Apple noir/
   blanc). Pas d'asset externe, pas de dépendance icône.

   Touch feedback : active:scale-[0.97] (canon Nexus mobile).
   Haptic Light au tap (cohérent autres CTA).
═══════════════════════════════════════════════════════════════ */

import { useMobileToast } from "@/components/mobile/MobileToast";

async function triggerHaptic() {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* no-op */ }
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.86-3.08.42-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.42C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

interface SocialButtonsMobileProps {
  /** Marge top entre le séparateur "ou" et le CTA primaire au-dessus. */
  topMargin?: number;
}

export function SocialButtonsMobile({ topMargin = 20 }: SocialButtonsMobileProps) {
  const toast = useMobileToast();

  function handleSocialTap() {
    triggerHaptic();
    toast.info({
      message: "Bientôt disponible",
      detail: "Connexion sociale — disponible en Phase 2",
    });
  }

  return (
    <>
      {/* Séparateur "ou" — ligne + texte centré, sobre */}
      <div className="flex items-center gap-3" style={{ marginTop: topMargin }} aria-hidden>
        <div className="flex-1 h-px bg-white/[0.10]" />
        <span className="text-[12px] uppercase tracking-[0.18em] text-white/40 font-semibold">
          ou
        </span>
        <div className="flex-1 h-px bg-white/[0.10]" />
      </div>

      {/* Google */}
      <button
        type="button"
        onClick={handleSocialTap}
        className="w-full h-14 mt-4 nx-mobile-radius-card bg-[#1A1D24] border border-white/[0.10] text-white font-semibold flex items-center justify-center gap-3 active:scale-[0.97] active:bg-[#22262e] transition-all"
        style={{ fontSize: 15 }}
      >
        <GoogleLogo />
        Continuer avec Google
      </button>

      {/* Apple */}
      <button
        type="button"
        onClick={handleSocialTap}
        className="w-full h-14 mt-3 nx-mobile-radius-card bg-[#1A1D24] border border-white/[0.10] text-white font-semibold flex items-center justify-center gap-3 active:scale-[0.97] active:bg-[#22262e] transition-all"
        style={{ fontSize: 15 }}
      >
        <AppleLogo />
        Continuer avec Apple
      </button>
    </>
  );
}
