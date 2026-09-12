/* ═══════════════════════════════════════════════════════════════
   Mode-indicator icons + color tokens.

   Extracted VERBATIM from app/athlete/profil/page.tsx :21-43 so the
   mobile athlete editor can consume the same glyphs/colors as the
   web profile. The web page's local copies are intentionally left
   in place for this sprint (so the existing web tree doesn't churn) ;
   a follow-up cleanup can swap them to imports from here without
   any visual change.

   Mode → color :
     DIRECT  → GREEN  (athlete edits, writes immediately to athletes)
     SUGGEST → YELLOW (athlete proposes via athlete_suggestions ;
                       coach approves via apply_approved_suggestion)
     LOCKED  → RED    (coach-only, display-only for the athlete)

   ══ LE CODE COULEUR EST LA LOI — décision BP, 2026-09-11 (règle 11) ══

   La couleur n'est pas une décoration : c'est la SEULE promesse faite à
   l'athlète sur ce qui va arriver à sa saisie. Vert = c'est enregistré.
   Jaune = c'est parti chez ton entraîneur. Rouge = tu regardes, tu ne
   touches pas. Un écran qui se trompe de couleur ment sur le destin de la
   donnée, et le jeune ne l'apprend qu'au moment où ça ne marche pas.

   CE QUI EST ARRIVÉ, ET QUI EXPLIQUE POURQUOI C'EST ÉCRIT ICI. Le
   2026-09-09, les champs Physique et Sport sont passés en écriture
   DIRECTE. Le chrome, lui, est resté : crayon jaune, libellé « NOUVELLE
   VALEUR PROPOSÉE », bouton jaune — sur des champs déjà enregistrés. Deux
   jours, et personne ne l'a vu, parce que rien ne cassait. Le composant
   s'appelait encore `SuggestRow` alors qu'il n'avait plus rien à proposer.

   TROIS RÈGLES QUI EN DÉCOULENT :

   1. Tout changement de RÉGIME d'écriture d'un champ (direct ↔ proposition)
      oblige à revoir sa couleur, son libellé d'action ET le nom du composant
      qui le rend, dans le même commit. Les quatre disent la même chose.

   2. Le nom du composant porte le monde : `ChampDirectRow` écrit,
      `StarSuggestRow` / `DistinctionsSuggestRow` proposent. Un nom qui ment
      est ce qui a permis à la couleur de mentir deux jours.

   3. Un état qui ne peut pas se produire ne se rend pas. La branche
      « En attente » d'une rangée directe était morte et jaune : une
      écriture immédiate ne crée aucune ligne `athlete_suggestions`. Garder
      un chemin mort, c'est garder une couleur fausse en réserve.

   Application, étape par étape : voir STEP_MODES / STEP_ACCENTS dans
   AthleteEditWizardMobile.tsx. Aujourd'hui UNE seule étape propose
   (Évaluation) ; les cinq autres écrivent.

   ══ JAMAIS D'ACCUSÉ DE RÉCEPTION SANS STATUT SERVEUR ══════════════
   Décision BP, 2026-09-12 (règle 11). DEUXIÈME recette perdue sur cette
   même classe de mensonge — d'où l'inscription ici plutôt qu'un commentaire
   local de plus.

   Un écran de proposition n'affiche JAMAIS d'état qu'il n'a pas lu du
   serveur. Ni « Envoyé ! » posé côté client, ni pastille câblée sur le seul
   statut qu'on espère.

   Ce qui s'est passé, deux fois :
     · 2026-09-10 — « envoyée à ton coach pour approbation » sur un chemin
       dont un trigger avalait la ligne à l'instant même.
     · 2026-09-12 — pastille « ⏳ En attente » branchée sur le seul statut
       EN_ATTENTE, alors qu'AUCUNE ligne n'atteint cet état en base (le
       trigger de transition résout dans la transaction d'insertion, délai
       mesuré 0.000000 s). Rien ne s'affichait jamais. La plomberie était
       juste — la requête partait, le filtre existait — et le résultat était
       structurellement vide. Vérifier le mécanisme ne vaut pas vérifier le
       RÉSULTAT.

   La forme correcte : lire la DERNIÈRE ligne du serveur quel que soit son
   statut, et rendre ce statut tel quel — en attente / approuvée / refusée,
   motif de refus compris. L'écran devient alors juste par construction :
   le jour où la base change d'avis, l'affichage suit sans qu'on y touche.

   ══ PROPOSER NE PRÉSUPPOSE PAS D'AVOIR ÉTÉ NOTÉ ═══════════════════
   Décision BP, 2026-09-12. Un champ évaluable se propose même s'il n'a
   jamais reçu de note. La grille des 14 traits était gardée par
   `isDetailedMode` — donc visible seulement si l'entraîneur avait déjà
   noté : les nouveaux inscrits, ceux qui en ont le plus besoin, ne voyaient
   rien.

   Corollaire à ne pas relâcher : la LECTURE ne ment pas pour autant. Un
   trait jamais noté rend « — », jamais cinq étoiles vides. C'est le GESTE
   qui s'ouvre, pas la valeur qui s'invente.
═══════════════════════════════════════════════════════════════ */

export const GREEN = "#22C55E";
export const YELLOW = "#EAB308";
export const RED = "#E63946";

export function PencilIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}
