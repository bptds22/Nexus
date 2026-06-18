"use client";

/* ═══════════════════════════════════════════════════════════════
   WelcomeMobile — iter 7.46 → 7.46e

   Iter 7.46e :
   - Le playbook art est MONTÉ DANS le dispatcher (persistant entre
     Welcome ↔ Login pour le slide partagé). Cet écran ne contient plus
     d'instance de PlaybookHeroArt.
   - Root devient `absolute inset-0` (le parent motion.div est `fixed
     inset-0` → on évite la double position fixed).
   - Le dim du playbook côté contenu (bas) est géré par un gradient
     interne ici (transparent top → #111317 bottom). Le playbook reste
     visible dans les 50% supérieurs ; le bloc contenu sur les 35%
     inférieurs bénéficie d'un fond opaque pour lisibilité.

   Logique flag/dispatch INCHANGÉE depuis 7.46. Points finaux blancs
   conservés (7.46d).
═══════════════════════════════════════════════════════════════ */

import { NexusLogoSvg } from "./NexusLogoSvg";
import { SocialButtonsMobile } from "./SocialButtonsMobile";

async function triggerHaptic(intensity: "Light" | "Medium" = "Medium") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

async function setHasLaunched(): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: "nexus_has_launched", value: "true" });
  } catch { /* no-op — fallback silent */ }
}

interface WelcomeMobileProps {
  /** Callback vers LoginMobile (transition interne sans navigation URL). */
  onShowLogin: () => void;
  /** Iter 7.50-a-bis-2a — callback vers SignupMobile (role-picker +
      3 écrans athlète natif). Remplace le router.push vers /auth?_web=1
      qui rendait le desktop dans la WebView. */
  onShowSignup: () => void;
}

export function WelcomeMobile({ onShowLogin, onShowSignup }: WelcomeMobileProps) {
  // Hooks AVANT toute condition (canon).

  async function handleCreateAccount() {
    triggerHaptic("Medium");
    await setHasLaunched();
    onShowSignup();
  }

  async function handleLogin() {
    triggerHaptic("Light");
    await setHasLaunched();
    onShowLogin();
  }

  return (
    <div
      className="absolute inset-0 text-white flex flex-col overflow-hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Dim côté contenu : transparent top (le playbook persistant du
          dispatcher reste visible) → #111317 bottom (où vit le bloc
          contenu). Iter 7.46e gradient ajusté pour combiner avec le
          playbook lifted. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(17,19,23,0) 0%, rgba(17,19,23,0) 50%, rgba(17,19,23,0.85) 78%, #111317 95%)",
        }}
      />

      {/* Spacer pour pousser le contenu en bas. */}
      <div className="relative flex-1" />

      {/* Bloc contenu — aligné gauche, padding bottom safe-area + 40px */}
      <div
        className="relative z-10 px-6 flex flex-col"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 40px)" }}
      >
        {/* Logo 32px de hauteur (width = 32 * 2.86 ≈ 91).
            Iter 7.47g : logo STATIQUE, plus de motion.div layoutId
            (le splash sort par fade simple, rien ne "voyage"). */}
        <NexusLogoSvg width={91} />

        {/* Headline — Anton ALL-CAPS, points finaux blancs (canon 7.46d).
            mt 28px = mt-7. */}
        <h1
          className="font-head font-black text-white uppercase tracking-tight mt-7"
          style={{
            fontSize: "clamp(2.5rem, 9vw, 3.5rem)",
            lineHeight: 0.95,
          }}
        >
          Le recrutement.
          <br />
          Réinventé.
        </h1>

        {/* Body — gris secondaire. mt 16px = mt-4 */}
        <p
          className="text-[#9CA3AF] mt-4 max-w-[440px]"
          style={{ fontSize: 15, lineHeight: 1.55, fontWeight: 400 }}
        >
          Connecte-toi à la plateforme qui réunit les athlètes du secondaire,
          leurs entraîneurs et les recruteurs CÉGEP du Québec.
        </p>

        {/* CTA primaire plein rouge. mt 36px = mt-9 */}
        <button
          type="button"
          onClick={handleCreateAccount}
          className="w-full h-14 mt-9 rounded-2xl bg-[#E63946] text-white font-head font-black uppercase tracking-widest active:scale-[0.97] active:bg-[#D42B22] transition-all"
          style={{
            fontSize: 14,
            letterSpacing: "0.16em",
            boxShadow: "0 8px 24px rgba(230,57,70,0.35)",
          }}
        >
          Créer un compte
        </button>

        {/* Boutons social (iter 7.60) — UI seulement, toast "Bientôt" au tap.
            Câblage OAuth réel = session infra dédiée (Google Cloud + Apple
            Developer + Supabase providers + flow Capacitor). */}
        <SocialButtonsMobile topMargin={20} />

        {/* Lien Login — centré. mt 20px = mt-5 */}
        <button
          type="button"
          onClick={handleLogin}
          className="w-full text-center text-[#9CA3AF] active:text-white transition-colors mt-5"
          style={{ fontSize: 14 }}
        >
          Déjà un compte ?{" "}
          <span className="text-white font-bold underline underline-offset-4 decoration-1">
            Se connecter
          </span>
        </button>
      </div>
    </div>
  );
}
