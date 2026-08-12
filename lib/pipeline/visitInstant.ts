/* ═══════════════════════════════════════════════════════════════
   visitInstant — helpers partagés date/heure ⇄ instant ISO pour la
   visite planifiée (recruiter_pipeline.visit_at, timestamptz).

   Source unique réutilisée par :
   - StatusChangeDropdown (desktop, fiche athlète)
   - VisitDateEditor (mini date-picker mobile — sheet statut + kanban)

   `<input type="date">` donne "YYYY-MM-DD", `<input type="time">` donne
   "HH:MM". `new Date("2026-03-12T14:00")` (sans suffixe Z) est interprété
   en HEURE LOCALE par le moteur JS — exactement ce qu'on veut : le
   recruteur saisit 14h à Montréal, on stocke l'instant UTC correspondant.
   Ajouter un "Z" ici décalerait la visite de 4-5h.

   Heure absente → minuit local. VisitCalendarCard traite minuit pile comme
   « pas d'heure saisie » et n'affiche alors que la date.
═══════════════════════════════════════════════════════════════ */

/** date "YYYY-MM-DD" + time "HH:MM" (optionnelle) → instant ISO complet.
 *  Sans date → undefined (l'heure seule n'a pas de sens). */
export function combineVisitInstant(date: string, time: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Instant ISO → { date, time } en HEURE LOCALE, pour pré-remplir les
 *  inputs quand on ÉDITE une date existante. Minuit pile (heure non saisie)
 *  → time vide, symétrique de combineVisitInstant. ISO nul/invalide →
 *  champs vides. */
export function splitVisitInstant(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const time = hasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
  return { date, time };
}
