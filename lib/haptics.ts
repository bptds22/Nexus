import { Capacitor } from "@capacitor/core";

/* ═══════════════════════════════════════════════════════════════
   haptics — wrapper haptique centralisé (BLOC sensory)

   No-op silencieux hors device (Capacitor.isNativePlatform() === false)
   → web/desktop intacts. try/catch autour de chaque appel : un haptic
   qui throw ne doit JAMAIS casser l'UI.

   Fonctions SÉMANTIQUES (pas techniques) → on rebrand le « feel » sans
   toucher les call-sites :
     hapticTap()     → impact Light  (CTA primaire)
     hapticSelect()  → impact Medium (changement d'état)
     hapticSuccess() → notification Success
     hapticWarning() → notification Warning
     hapticError()   → notification Error

   NB : les ~299 triggerHaptic locaux existants ne sont PAS migrés ici
   (fast-follow) — ce wrapper sert les nouveaux points sémantiques.
═══════════════════════════════════════════════════════════════ */

type Impact = "Light" | "Medium" | "Heavy";
type Notif = "Success" | "Warning" | "Error";

async function impact(style: Impact): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) return;
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle[style] });
  } catch {
    /* no-op : haptics indispo / throw → on n'impacte jamais l'UI */
  }
}

async function notify(type: Notif): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) return;
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType[type] });
  } catch {
    /* no-op */
  }
}

export const hapticTap = () => impact("Light");
export const hapticSelect = () => impact("Medium");
export const hapticSuccess = () => notify("Success");
export const hapticWarning = () => notify("Warning");
export const hapticError = () => notify("Error");
