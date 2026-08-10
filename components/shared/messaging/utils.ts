/* ═══════════════════════════════════════════════════════════════
   Shared messaging utilities — date helpers + haptics.

   Used by MessagesListShell + MessageThreadShell + by the role
   parents that consume them (recruiter today ; coach Phase 2).
═══════════════════════════════════════════════════════════════ */

/* Ré-export : ce module exposait sa PROPRE copie de triggerHaptic, que
   21 fichiers importaient. On garde le nom et le chemin — les appelants
   ne bougent pas — mais l'implémentation vient désormais du helper unique. */
export { triggerHaptic } from "@/lib/haptics";

/** Relative time for the thread list rows ("À l'instant", "12 min",
 *  "3 h", "Hier", weekday short name, then short date). */
export function relativeTime(isoStr: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) {
    const dayNames = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
    return dayNames[d.getDay()];
  }
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

/** Date helpers used by the day separators inside a thread. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Returns the day label for the day-separator pill inside a thread. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const that = startOfDay(d);
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) {
    const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    return days[d.getDay()];
  }
  return d.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/** "HH:MM" for the timestamp under each bubble. */
export function timeOfDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", hour12: false });
}
