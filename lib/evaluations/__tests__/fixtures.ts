/* ═══════════════════════════════════════════════════════════════
   Jeu d'essai partagé des suites grilles.

   Les grilles reproduisent des lignes RÉELLES de public.evaluation_grilles
   (codes et libellés relevés en base le 2026-08-24). Elles ne sont pas
   inventées : une suite qui teste des libellés fictifs ne dirait rien du
   comportement en production.

   `slotColumns` reproduit public.evaluation_slots (1..5). Le module le lit
   en base à l'exécution ; ici on le fournit, ce qui permet aussi de vérifier
   que les groupes SUIVENT cette table plutôt qu'une copie figée.
═══════════════════════════════════════════════════════════════ */

import type { Grille, GrilleSet } from "@/lib/evaluations/grilles";

const mk = (id: string, code: string, libelles: string[]): Grille => ({
  id, code, libelle: code, sportId: null,
  slots: libelles.map((libelle) => ({ libelle, definition: null })),
  ordre: 0, actif: true,
});

export const GENERIQUE = mk("g-gen", "GENERIQUE",
  ["Compétitivité", "Esprit d'équipe", "Résilience", "Vision du jeu", "Sens tactique"]);

export const FB_QB = mk("g-qb", "FB-QB",
  ["Précision de passe", "Lecture de défensive", "Force de bras", "Gestion de la pochette", "Synchronisme"]);

export const FB_LO = mk("g-lo", "FB-LO",
  ["Protection de passe", "Blocage de zone", "Blocage individuel", "Jeu de pieds", "Technique de mains"]);

export const BB = mk("g-bb", "BB",
  ["Tir extérieur", "Finition au panier", "Création de jeu", "Défense", "Rebond"]);

/** Les 5 colonnes alimentées par les fentes, dans l'ordre de evaluation_slots. */
export const SLOT_COLUMNS = [
  "competitivite", "esprit_equipe", "resilience", "vision_du_jeu", "sens_tactique",
];

/** Référentiel complet et sain. */
export const SET: GrilleSet = {
  ok: true,
  byId: new Map([GENERIQUE, FB_QB, FB_LO, BB].map((g) => [g.id, g])),
  byCode: new Map([GENERIQUE, FB_QB, FB_LO, BB].map((g) => [g.code, g])),
  positionToGrilleId: new Map([
    ["p-qb", "g-qb"],
    ["p-ol", "g-lo"],
    ["p-meneur", "g-bb"],
  ]),
  slotColumns: SLOT_COLUMNS,
  generique: GENERIQUE,
  sportIdByNom: new Map([["Football", "s-fb"], ["Basketball", "s-bb"]]),
  // Clés composites `${sportId}::${valeur}` — voir posKey dans grilles.ts.
  positionIdBySportAbbr: new Map([
    ["s-fb::QB", "p-qb"], ["s-fb::OL", "p-ol"], ["s-bb::PG", "p-meneur"],
    // « C » existe dans les deux sports : c'est le cas qui prouve le filtre.
    ["s-fb::C", "p-ol"], ["s-bb::C", "p-bb-centre"],
  ]),
  positionIdBySportNom: new Map([
    ["s-fb::Quart-arrière", "p-qb"],
    ["s-fb::Joueur de ligne offensive", "p-ol"],
    ["s-bb::Meneur", "p-meneur"],
    ["s-fb::Centre", "p-ol"], ["s-bb::Centre", "p-bb-centre"],
  ]),
};

/** Référentiel INJOIGNABLE : table vide, RLS inattendue, base locale sans les
 *  migrations grilles. Le module doit rendre 14 libellés quand même. */
export const SET_HS: GrilleSet = {
  ...SET,
  ok: false,
  byId: new Map(), byCode: new Map(), positionToGrilleId: new Map(),
  generique: null,
};

/** Les libellés des 5 fentes d'un groupe « Sur le terrain », à plat. */
export function slotLabels(groups: { title: string; traits: { label: string }[] }[]): string {
  return groups[0].traits.slice(4).map((t) => t.label).join(" / ");
}
