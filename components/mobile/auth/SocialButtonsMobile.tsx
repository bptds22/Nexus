"use client";

/* ═══════════════════════════════════════════════════════════════
   SocialButtonsMobile — iter 7.60 → 7.60b

   UI uniquement : "Continuer avec Google" + "Continuer avec Apple".
   Aucun OAuth réel. Au tap → toast "Bientôt disponible" (canon
   T.toasts.socialPhase2 desktop). Apple Sign-In sera obligatoire
   pour l'App Store si Google est offert ; ces boutons sont prêts
   à recevoir le vrai handler quand le câblage OAuth (Google Cloud
   + Apple Developer + Supabase providers + flow Capacitor) sera
   fait dans une session dédiée.

   Iter 7.60b — match exact CTA :
   - Radius des 2 boutons social ALIGNÉ sur le CTA primaire rouge :
     `rounded-2xl` (16px). Welcome "Créer un compte" + Login
     "Se connecter" utilisent déjà rounded-2xl → uniformisation des
     coins sur les 3 boutons de chaque écran.
   - Égalisation visuelle Google / Apple : le glyphe Apple est
     naturellement plus étroit que le G Google. Rendu Apple à 22×22
     vs Google 20×20 (~+10%) pour matcher le POIDS optique, pas la
     taille de boîte. Conteneur uniforme 24×24 centré pour aligner
     l'axe vertical du texte.

   Logos officiels : SVG inline (G multicolore Google, Apple noir/
   blanc). Pas d'asset externe, pas de dépendance icône.

   Touch feedback : active:scale-[0.97] (canon Nexus mobile).
   Haptic Light au tap (cohérent autres CTA).
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { createClient } from "@/lib/supabase/client";
import { postLoginDispatch } from "@/lib/auth/postLoginDispatch";
import { signInWithGoogle, signInWithApple } from "@/lib/auth/social";
import { triggerHaptic } from "@/lib/haptics";
import {
  needsSignupRole,
  claimSignupRole,
  type ClaimableRole,
  type ClaimableContext,
} from "@/lib/auth/claimSignupRole";


function GoogleLogo() {
  // 20×20 = taille de référence (G remplit ~85% du viewBox).
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
  // 22×22 = +10% vs Google (20×20) pour compenser le glyphe Apple
  // naturellement plus étroit/haut. Donne un poids OPTIQUE équivalent
  // (convention iOS / Twitter / Stripe).
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.86-3.08.42-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.42C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

interface SocialButtonsMobileProps {
  /** Marge top entre le séparateur "ou" et le CTA primaire au-dessus. */
  topMargin?: number;
  /**
   * Rôle DÉJÀ choisi par l'utilisateur en amont (SignupMobile écran 0).
   * Absent sur Welcome et Login : aucun rôle n'est connu à ce stade, et on ne
   * défaute JAMAIS sur ATHLETE — un nouveau compte est alors envoyé sur
   * /inscription/role.
   */
  role?: ClaimableRole;
  /** Contexte associé au rôle (coach scolaire/civil). Ignoré pour ATHLETE. */
  context?: ClaimableContext;
}

export function SocialButtonsMobile({ topMargin = 20, role, context }: SocialButtonsMobileProps) {
  const toast = useMobileToast();
  const router = useRouter();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);

  async function handleProvider(provider: "google" | "apple") {
    if (busy) return; // anti double-tap
    triggerHaptic();
    setBusy(provider);
    try {
      if (Capacitor.isNativePlatform()) {
        // Device : flow NATIF (l'utilisateur reste dans l'app).
        // signInWithIdToken ne peut porter ni redirectTo ni raw_user_meta_data,
        // et /auth/callback (qui corrige le rôle sur web) est exclu du build
        // output:'export'. Le rôle est donc réclamé ICI, via la RPC.
        const res = provider === "google" ? await signInWithGoogle() : await signInWithApple();
        if (!res.success) {
          toast.error({ message: "Connexion impossible", detail: res.error || "Réessaie." });
          return;
        }
        if (!res.session?.user) return;

        const supabase = createClient();

        // L'autorité est la DB, jamais une heuristique client type
        // created_at ≈ last_sign_in_at : un faux positif re-rôlerait un
        // utilisateur existant. needs_signup_role() évalue le même prédicat
        // que la garde en écriture de claim_signup_role.
        const needs = await needsSignupRole(supabase);

        if (!needs) {
          // Utilisateur existant → dispatch nu. Son rôle n'est JAMAIS touché.
          await postLoginDispatch(supabase, res.session.user, router);
          return;
        }

        if (role) {
          // Rôle connu (SignupMobile) → on le réclame AVANT de dispatcher,
          // sinon computeDispatchDestination routerait sur un rôle encore faux.
          const claimed = await claimSignupRole(supabase, role, context ?? null);
          if (!claimed.ok) {
            toast.error({ message: "Connexion impossible", detail: "Rôle non enregistré. Réessaie." });
            return;
          }
          await postLoginDispatch(supabase, res.session.user, router);
          return;
        }

        // Aucun rôle connu (Welcome / Login) → interstitiel. PAS de défaut ATHLETE.
        router.replace("/inscription/role");
      } else {
        // Web : flow OAuth standard (redirect navigateur géré par Supabase).
        // Le rôle connu voyage en query param — /auth/callback l'applique en
        // service_role (maybeApplySignupRole). Sans rôle, le callback renvoie
        // lui-même sur /inscription/role. Miroir de app/auth/page.tsx:248-256.
        const supabase = createClient();
        const params = new URLSearchParams();
        if (role) params.set("role", role);
        if (role && context) params.set("context", context);
        const qs = params.toString();
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: `${window.location.origin}/auth/callback${qs ? `?${qs}` : ""}` },
        });
        if (error) toast.error({ message: "Connexion impossible", detail: error.message });
        // succès web → le navigateur redirige vers le provider puis le callback.
      }
    } catch (e) {
      toast.error({
        message: "Connexion impossible",
        detail: e instanceof Error ? e.message : "Erreur inattendue",
      });
    } finally {
      setBusy(null);
    }
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

      {/* Google — radius rounded-2xl identique au CTA primaire ; logo
          dans un conteneur 24×24 pour aligner l'axe vertical du texte. */}
      <button
        type="button"
        onClick={() => handleProvider("google")}
        disabled={busy !== null}
        className="w-full h-14 mt-4 rounded-2xl bg-[#1A1D24] border border-white/[0.10] text-white font-semibold flex items-center justify-center gap-3 active:scale-[0.97] active:bg-[#22262e] transition-all disabled:opacity-60"
        style={{ fontSize: 15 }}
      >
        <span className="inline-flex items-center justify-center w-6 h-6" aria-hidden>
          <GoogleLogo />
        </span>
        {busy === "google" ? "Connexion…" : "Continuer avec Google"}
      </button>

      {/* Apple — même radius + conteneur 24×24. Apple à 22×22 (+10%)
          pour égaliser le poids OPTIQUE vs Google 20×20. */}
      {/* Apple — conforme HIG (fond NOIR #000 + logo Apple blanc officiel,
          h-14 ≥ 44pt). Ne PAS repeindre en rouge Nexus (exigence App Review 4.8). */}
      <button
        type="button"
        onClick={() => handleProvider("apple")}
        disabled={busy !== null}
        className="w-full h-14 mt-3 rounded-2xl bg-black border border-white/[0.18] text-white font-semibold flex items-center justify-center gap-3 active:scale-[0.97] active:bg-[#111] transition-all disabled:opacity-60"
        style={{ fontSize: 15 }}
      >
        <span className="inline-flex items-center justify-center w-6 h-6" aria-hidden>
          <AppleLogo />
        </span>
        {busy === "apple" ? "Connexion…" : "Continuer avec Apple"}
      </button>
    </>
  );
}
