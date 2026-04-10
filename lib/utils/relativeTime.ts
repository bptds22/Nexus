/** French relative time formatting — no dependencies */

export function relativeTimeFr(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD === 1) return "Hier";
  if (diffD < 7) {
    const day = new Date(date).toLocaleDateString("fr-CA", { weekday: "long" });
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
  if (diffD < 14) return "Il y a 1 semaine";
  if (diffD < 30) return `Il y a ${Math.floor(diffD / 7)} semaines`;
  if (diffD < 60) return "Il y a 1 mois";
  return `Il y a ${Math.floor(diffD / 30)} mois`;
}
