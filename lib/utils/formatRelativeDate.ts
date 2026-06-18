/* ═══════════════════════════════════════════════════════════════
   formatRelativeDate — iter 7.30b (promu shared)
   Helper compact iOS pour timestamps relatifs. Sortie : "à l'instant",
   "il y a X min", "il y a X h", "il y a X j" (<7 jours), puis "JJ mois"
   au-delà. Promu depuis RecruteurListeDetailMobile.tsx (Sprint 3) pour
   réutilisation par RecruteurActivitesMobile + futurs feeds mobile.
═══════════════════════════════════════════════════════════════ */

const MONTHS_FR = [
  "janv", "févr", "mars", "avr", "mai", "juin",
  "juil", "août", "sept", "oct", "nov", "déc",
] as const;

export function formatRelativeDate(iso: string): string {
  try {
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return "";
    const now = Date.now();
    const diffSec = Math.floor((now - ts) / 1000);
    if (diffSec < 60) return "à l'instant";
    if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`;
    const days = Math.floor(diffSec / 86400);
    if (days < 7) return `il y a ${days} j`;
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = MONTHS_FR[d.getMonth()];
    return `${day} ${month}`;
  } catch { return ""; }
}
