/* ═══════════════════════════════════════════════════════════════
   clubCorrespond — LA recherche de club des inscriptions (décision BP
   2026-10-15, bug NLS). Inscription coach civil web (TeamSearchOrCreate),
   athlète web (ClubPicker) et, en code, les deux inscriptions mobiles.

   Un club correspond si CHAQUE mot tapé se trouve dans son nom ou sa
   ville, OU est son sigle tiré des initiales (« nls » → « No Limits
   Showcases »). Casse et accents ignorés.

   Sigle : initiales de tous les mots du nom (« Club de soccer de Laval »
   → « cdsdl »), et aussi sans les petits mots (« csl »). Un sigle doit
   être tapé en entier (2 lettres au moins) : « nl » ne trouve pas NLS
   par son sigle.

   Création d'un club : proposée SEULEMENT après une recherche non vide
   sans aucun club correspondant, sigle compris (peutCreerClub).
═══════════════════════════════════════════════════════════════ */

import { normaliserTexte } from "@/lib/teams/teamLabel";

export interface ClubCherchable {
  name: string | null;
  city?: string | null;
}

const PETITS_MOTS = new Set(["de", "du", "des", "d", "la", "le", "les", "l", "et", "a", "au", "aux", "en", "of", "the"]);

/** Mots du nom : casse et accents ignorés, coupés sur tout ce qui n'est pas lettre ou chiffre. */
function mots(s: string | null | undefined): string[] {
  return normaliserTexte(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Sigles d'un nom : initiales de tous les mots, et sans les petits mots. */
export function siglesClub(nom: string | null | undefined): string[] {
  const m = mots(nom);
  const tous = m.map((x) => x[0]).join("");
  const sansPetits = m.filter((x) => !PETITS_MOTS.has(x)).map((x) => x[0]).join("");
  return [...new Set([tous, sansPetits])].filter((s) => s.length >= 2);
}

export function clubCorrespond(club: ClubCherchable, recherche: string): boolean {
  const tokens = normaliserTexte(recherche).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const botte = normaliserTexte([club.name, club.city].filter(Boolean).join(" "));
  const sigles = siglesClub(club.name);
  return tokens.every((t) => botte.includes(t) || sigles.includes(t.replace(/[^a-z0-9]/g, "")));
}

export function filtrerClubs<T extends ClubCherchable>(clubs: readonly T[], recherche: string): T[] {
  return clubs.filter((c) => clubCorrespond(c, recherche));
}

/** Le bouton « créer un club » : recherche tapée ET aucun club correspondant. */
export function peutCreerClub(recherche: string, clubs: readonly ClubCherchable[]): boolean {
  return recherche.trim() !== "" && filtrerClubs(clubs, recherche).length === 0;
}
