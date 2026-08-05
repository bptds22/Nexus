/* ═══════════════════════════════════════════════════════════════
   teamLabel — description canonique d'une équipe, partagée par TOUTES les
   surfaces du portail athlète.

   POURQUOI. Les listes d'équipes n'affichaient que « nom · sport · saison ».
   Deux équipes du même nom dans la même école — « Dragons » Cadet D1 Masculin
   et « Dragons » Juvénile D2 Féminin — étaient rigoureusement indistinguables :
   l'athlète choisissait au hasard, et se retrouvait dans le mauvais alignement
   sans qu'aucun écran ne puisse lui signaler l'erreur.

   La base porte pourtant tout ce qu'il faut : division, gender, age_group,
   league. Ce module les met en forme, une fois, pour que chaque picker,
   chaque carte de confirmation et chaque modale de transfert disent
   exactement la même chose.

   RÈGLE DES CHAMPS VIDES. Un champ NULL ou vide DISPARAÎT — pas de « — »,
   pas de « null », pas de séparateur orphelin. Une équipe civile sans
   age_group ne doit pas afficher un trou là où une équipe scolaire affiche
   « Cadet ».
═══════════════════════════════════════════════════════════════ */

import { genderLabel } from "@/lib/config/gender";

/** Forme minimale attendue. Toutes les surfaces ne sélectionnent pas les
 *  mêmes colonnes — d'où l'optionalité généralisée plutôt qu'un type strict
 *  que chaque appelant devrait satisfaire au prix d'un SELECT plus large. */
export interface TeamLike {
  name?: string | null;
  sport?: string | null;
  age_group?: string | null;
  division?: string | null;
  gender?: string | null;
  season?: string | null;
  league?: string | null;
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Ligne de détails SOUS le nom de l'équipe :
 *   « Basketball · Cadet · D1 · Masculin · 2025-2026 · RSEQ »
 *
 * Ordre choisi du plus discriminant au moins discriminant : deux équipes
 * d'une même école se distinguent d'abord par le sport, puis la catégorie
 * d'âge, puis la division, puis le genre. La saison et la ligue ferment la
 * ligne — utiles à confirmer, jamais à départager.
 *
 * `gender` passe par genderLabel() : la base stocke « masculin » en
 * minuscules non accentuées, les imports RSEQ « Masculin » ou « M ».
 */
export function teamDetails(t: TeamLike): string {
  const genre = clean(t.gender) ? genderLabel(clean(t.gender)) : "";
  return [
    clean(t.sport),
    clean(t.age_group),
    clean(t.division),
    genre === "—" ? "" : genre,
    clean(t.season),
    clean(t.league),
  ].filter(Boolean).join(" · ");
}

/** Une seule chaîne, nom compris — pour les contextes sans place pour deux
 *  lignes (toasts, messages d'erreur, `<title>`). */
export function teamFullLabel(t: TeamLike): string {
  const d = teamDetails(t);
  const n = clean(t.name) || "Équipe";
  return d ? `${n} — ${d}` : n;
}

/**
 * Idem, mais préfixé de l'école ou du club, pour les surfaces où l'équipe
 * peut venir de n'importe quelle organisation (transfert, résolution de code).
 * Volontairement neutre : « école » et « club » partagent la table `schools`,
 * et un athlète de ligue civile ne doit jamais lire le mot « école ».
 */
export function teamWithOrg(t: TeamLike, orgName?: string | null): string {
  return [clean(orgName), teamDetails(t)].filter(Boolean).join(" · ");
}
