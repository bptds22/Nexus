/* ═══════════════════════════════════════════════════════════════
   Shared dashboard utilities (helpers + small components).
   Consumed by CoachDashboardMobile + RecruteurDashboardMobile.
═══════════════════════════════════════════════════════════════ */

import type { ActivityEvent } from "@/lib/types/activityEvents";

const MONTHS_FR = [
  "JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE",
];
const DAYS_FR = [
  "DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI",
];

export function frenchDateUppercase(d: Date): string {
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

export function getInitials(name?: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  const f = parts[0]?.[0] ?? "";
  const l = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (f + l).toUpperCase() || "—";
}

export function activityVerb(activity: ActivityEvent): string {
  switch (activity.type) {
    case "coach_replied":          return "Réponse reçue";
    case "recruiter_favorited":    return activity.iconColor === "#6B7280" ? "Retiré des favoris" : "Ajouté aux favoris";
    case "profile_verified":       return "Profil vérifié";
    case "profile_viewed":         return "A consulté ton profil";
    case "video_added":            return "Vidéo ajoutée";
    case "profile_updated_bulk":   return "Profil mis à jour";
    case "scouting_report_updated":return "Note ajoutée";
    case "status_engage":          return "Changement de statut";
    default:                       return "Activité";
  }
}

/* Ré-export : ce module exposait sa PROPRE copie de triggerHaptic, que
   21 fichiers importaient. On garde le nom et le chemin — les appelants
   ne bougent pas — mais l'implémentation vient désormais du helper unique. */
export { triggerHaptic } from "@/lib/haptics";
