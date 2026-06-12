/* ═══════════════════════════════════════════════════════════════
   Shared activities utils — identity-agnostic helpers extracted
   from RecruteurActivitesMobile so both roles consume the same
   time-cohort definition + haptic call.
═══════════════════════════════════════════════════════════════ */

export type TimeGroup = "Aujourd'hui" | "Hier" | "Cette semaine" | "Ce mois-ci" | "Plus ancien";

export const TIME_GROUP_ORDER: TimeGroup[] = [
  "Aujourd'hui",
  "Hier",
  "Cette semaine",
  "Ce mois-ci",
  "Plus ancien",
];

export function getTimeGroup(iso: string, now: Date): TimeGroup {
  const d = new Date(iso);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const eventDay = new Date(d); eventDay.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 14) return "Cette semaine";
  if (diffDays < 30) return "Ce mois-ci";
  return "Plus ancien";
}

export async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}
