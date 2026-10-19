/* ═══════════════════════════════════════════════════════════════
   Libellés du mode match — UNE seule source (BP, nuit du 2026-10-18).

   « Game On » devient « Dépistage » (onglet, barre latérale, titres) et
   « Dépister ce match » (le bouton sur la fiche d'un match : carte des
   matchs, calendrier, tableau de bord). Changer un nom ici le change
   partout. La route reste /recruteur/game-on (aucune URL ne bouge).
═══════════════════════════════════════════════════════════════ */

export const DEPISTAGE = {
  /** L'onglet de la barre du bas (appli) et la barre latérale (web). */
  onglet: "Dépistage",
  /** Le titre de l'écran. */
  titre: "Dépistage",
  /** Le sous-titre du tableau de bord. */
  sousTitre: "Tes notes de match, même sans réseau",
  /** Le bouton qui ouvre une séance sur un match connu. */
  bouton: "Dépister ce match",
  /** Le bouton qui renvoie à la carte des matchs (ses filtres existants). */
  trouver: "Trouver un match",
  /** Migration absente en prod. */
  bientot: "Le dépistage arrive bientôt",
} as const;

/** La route de l'écran (inchangée depuis « Game On »). */
export const ROUTE_DEPISTAGE = "/recruteur/game-on";

/** Lien « Dépister ce match » : le match et ses deux équipes voyagent dans l'URL. */
export function lienDepister(m: { gameId: string; equipeA: string; equipeB: string; lieu?: string | null }): string {
  const p = new URLSearchParams({ match: m.gameId, a: m.equipeA, b: m.equipeB });
  if (m.lieu) p.set("lieu", m.lieu);
  return `${ROUTE_DEPISTAGE}?${p.toString()}`;
}

/** Lecture des paramètres d'un lien « Dépister ce match » ; null si le match manque. */
export function lireDepister(p: { get(k: string): string | null } | null | undefined):
  { gameId: string; equipeA: string; equipeB: string; lieu: string | null } | null {
  const gameId = p?.get("match")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) return null;
  return {
    gameId,
    equipeA: (p?.get("a") ?? "").trim().slice(0, 120) || "Équipe A",
    equipeB: (p?.get("b") ?? "").trim().slice(0, 120) || "Adversaire",
    lieu: (p?.get("lieu") ?? "").trim().slice(0, 300) || null,
  };
}
