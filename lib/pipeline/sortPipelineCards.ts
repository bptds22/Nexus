/* ═══════════════════════════════════════════════════════════════
   sortPipelineCards — LA règle de tri du pipeline, pour les deux surfaces
   (Lot 2 ; fondation du Lot 1b)

   AVANT CE FICHIER, le tri n'existait qu'à un seul endroit : inline dans
   `activeStageCards` de RecruteurPipelineMobile. Le web n'en avait AUCUN —
   les colonnes rendaient l'ordre de `moved_at desc` sorti de la requête, et
   les cartes flaggées ne remontaient pas. Deux surfaces, deux comportements,
   pour la même donnée.

   ── LA RÈGLE, EN UNE PHRASE ────────────────────────────────────────────
   LE MODE DE TRI COURANT, ET RIEN D'AUTRE.

   ── LE DRAPEAU NE PRÉEMPTE PLUS (arbitrage BP, 2026-09-04) ─────────────
   Jusqu'à ce jour, `flagged` passait AVANT le mode : les cartes épinglées
   remontaient en tête quoi qu'on demande. La règle s'est retournée contre
   elle-même le jour du test : une carte notée D mais épinglée restait en
   tête d'une colonne triée par MEILLEUR GRADE, et le tri paraissait cassé
   alors qu'il obéissait.

   Le fond du problème : choisir « Meilleur grade » est une demande
   EXPLICITE, et une préemption implicite qui la contredit ne s'explique pas
   à l'écran. Le grade absorbe désormais la priorisation — l'UI recruteur du
   drapeau a été retirée le même jour (toggle du panneau, point rouge des
   cartes). Laisser la préemption sans son interrupteur aurait produit le
   pire des cas : un ordre imposé par une donnée que plus personne ne voit
   ni ne contrôle.

   La colonne `flagged` reste en base — le portail admin la lit
   (app/admin/pipeline/[id]/PageClient.tsx). Son sort final et le nettoyage
   du mobile se décident au lot mobile. Voir docs/post-launch-bugs.md.

   ── POURQUOI UNE INTERFACE STRUCTURELLE ET PAS PipelineKanbanCard ──────
   L'entrée est décrite par ses champs, pas par le type du kanban : le tri ne
   lit que six propriétés et n'a aucune raison de dépendre d'un type qui en
   porte trente. Le Lot 1b pourra l'appeler sur une autre forme de carte sans
   toucher à ce fichier. Tous les champs sont optionnels — une carte sans
   `grade` n'est pas gradée.

   ── LE TRI EST PUR ─────────────────────────────────────────────────────
   La fonction rend un NOUVEAU tableau. `Array.prototype.sort` mute en place,
   et une carte du cache TanStack triée en place mute le cache lui-même. Le
   mobile faisait déjà `.slice()` avant de trier ; ici c'est la fonction qui
   s'en charge, pour que l'appelant ne puisse plus l'oublier.
═══════════════════════════════════════════════════════════════ */

import { gradeRank, type Grade } from "@/lib/config/grades";

export type PipelineSortMode =
  | "moved_at_desc"
  | "rating_desc"
  | "graduation_asc"
  | "name_asc"
  | "grade_desc"
  | "next_action_asc";

export const DEFAULT_PIPELINE_SORT: PipelineSortMode = "moved_at_desc";

/** Libellés partagés par la barre de filtres web et le menu ⋮ mobile — pour
 *  qu'un mode ajouté ici apparaisse des deux côtés sans se rappeler du second. */
export const PIPELINE_SORT_OPTIONS: { value: PipelineSortMode; label: string }[] = [
  { value: "moved_at_desc",  label: "Dernière activité" },
  { value: "grade_desc",     label: "Meilleur grade" },
  { value: "rating_desc",    label: "Meilleure cote" },
  { value: "graduation_asc", label: "Promotion proche" },
  { value: "next_action_asc", label: "Relance la plus proche" },
  { value: "name_asc",       label: "Nom A-Z" },
];

/** Les seuls champs que le tri lit. Tout est optionnel — voir l'en-tête. */
export interface SortablePipelineCard {
  grade?: Grade | null;
  coach_rating?: number;
  graduation_year?: number;
  full_name?: string;
  moved_at?: string | null;
  /** `recruiter_pipeline.next_action_at` — une DATE (pas un timestamp), donc
   *  pas de fuseau à arbitrer : « aujourd'hui » est le même jour pour tout le
   *  monde. `null` = aucune relance posée. */
  next_action_at?: string | null;
}

/** Le repli commun : dernière activité d'abord. Sert de mode par défaut ET de
 *  départage quand un autre mode laisse deux cartes à égalité. */
function compareByMovedAt(a: SortablePipelineCard, b: SortablePipelineCard): number {
  const at = a.moved_at ? new Date(a.moved_at).getTime() : 0;
  const bt = b.moved_at ? new Date(b.moved_at).getTime() : 0;
  return bt - at;
}

function compareByMode(
  a: SortablePipelineCard,
  b: SortablePipelineCard,
  mode: PipelineSortMode,
): number {
  switch (mode) {
    // `grade_desc` = MEILLEUR grade d'abord, comme `rating_desc` rend la
    // meilleure cote d'abord. Le comparateur est croissant SUR LE RANG parce
    // que A+ vaut 0 et D vaut 6 : « meilleur » et « plus petit » coïncident.
    // gradeRank() range les non-gradés APRÈS les D — « pas encore jugé »
    // n'est pas « jugé mauvais ». Et il départage à grade égal, sinon une
    // colonne de dix B+ retomberait dans l'ordre arbitraire du tableau.
    case "grade_desc": {
      const diff = gradeRank(a.grade) - gradeRank(b.grade);
      return diff !== 0 ? diff : compareByMovedAt(a, b);
    }
    case "rating_desc":
      return (b.coach_rating ?? 0) - (a.coach_rating ?? 0);
    // `|| 9999` et non `?? 9999` : une année 0 (carte mock, champ jamais
    // renseigné) doit tomber en fin de liste comme une année absente.
    case "graduation_asc":
      return (a.graduation_year || 9999) - (b.graduation_year || 9999);
    case "name_asc":
      return (a.full_name || "").localeCompare(b.full_name || "");
    /* Croissant : la relance la plus proche d'abord, donc les DÉPASSÉES en
       tête — c'est l'ordre d'une liste d'actions, pas d'un agenda. Ce qui est
       en retard est ce qui presse le plus.

       Les cartes SANS relance tombent à la fin, jamais mêlées aux autres :
       `Infinity` et non une date lointaine arbitraire, pour qu'aucune relance
       réelle ne puisse un jour passer derrière elles. À égalité de date, on
       départage par dernière activité comme les autres modes — sinon dix
       relances du même jour retomberaient dans l'ordre arbitraire du tableau. */
    case "next_action_asc": {
      const at = a.next_action_at ? new Date(a.next_action_at).getTime() : Infinity;
      const bt = b.next_action_at ? new Date(b.next_action_at).getTime() : Infinity;
      if (at !== bt) return at - bt;
      return compareByMovedAt(a, b);
    }
    case "moved_at_desc":
    default:
      return compareByMovedAt(a, b);
  }
}

/** Le mode courant, sans préemption. Rend un nouveau tableau. */
export function sortPipelineCards<T extends SortablePipelineCard>(
  cards: T[],
  mode: PipelineSortMode = DEFAULT_PIPELINE_SORT,
): T[] {
  return cards.slice().sort((a, b) => compareByMode(a, b, mode));
}
