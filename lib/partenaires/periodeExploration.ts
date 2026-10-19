/* ═══════════════════════════════════════════════════════════════
   periodeExploration — les pastilles de période de Newsroom et Tendances
   (BP 2026-10-18, 6.5) : Cette semaine · Ce mois · Saison.

   Le paramètre d'adresse reste `range` (compatible avec les liens d'avant) :
     7d → Cette semaine, 30d → Ce mois, saison → depuis le 1er août de la
     saison en cours ; `all` (ancien « Tout ») reste lu, sans pastille.
═══════════════════════════════════════════════════════════════ */

export type ClePeriode = "7d" | "30d" | "saison" | "all";

export const PASTILLES_PERIODE: readonly { cle: Exclude<ClePeriode, "all">; label: string }[] = [
  { cle: "7d", label: "Cette semaine" },
  { cle: "30d", label: "Ce mois" },
  { cle: "saison", label: "Saison" },
];

export function lirePeriode(v: string | undefined | null, defaut: ClePeriode = "30d"): ClePeriode {
  return v === "7d" || v === "30d" || v === "saison" || v === "all" ? v : defaut;
}

/** Début de la saison : le 1er août (heure locale) de l'année sportive en cours. */
export function debutSaison(maintenant = new Date()): Date {
  const annee = maintenant.getMonth() >= 7 ? maintenant.getFullYear() : maintenant.getFullYear() - 1;
  return new Date(annee, 7, 1);
}

/** Borne basse de la période, en ISO ; null = sans borne (« all »). */
export function debutPeriode(p: ClePeriode, maintenant = new Date()): string | null {
  if (p === "7d") return new Date(maintenant.getTime() - 7 * 86_400_000).toISOString();
  if (p === "30d") return new Date(maintenant.getTime() - 30 * 86_400_000).toISOString();
  if (p === "saison") return debutSaison(maintenant).toISOString();
  return null;
}

export function libellePeriode(p: ClePeriode): string {
  return PASTILLES_PERIODE.find((x) => x.cle === p)?.label ?? "Tout";
}
