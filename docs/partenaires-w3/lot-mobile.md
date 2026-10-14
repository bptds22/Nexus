# W2b + W3 + C — à faire au lot mobile

Rien n'a été touché côté mobile (protocole web-d'abord). La base sert déjà
tout ce qu'il faut : les RPC ci-dessous sont celles du web, appelables telles
quelles depuis les binaires.

## W2b — ligne compacte au lieu de la section

- `components/shared/AthleteRecruiterProfileBodyMobile.tsx` — n'affiche AUCUNE
  évaluation partenaire aujourd'hui (déjà noté au lot W2,
  `docs/partenaires-w2/lot-mobile.md`). À la reprise, appliquer directement la
  règle W2b : coach évalué (`aUneCote(coteGlobale)`) → une ligne
  « Évaluation <organisation> » + étoiles + cote sous « Moyenne » (l.~2679) ;
  sinon la section complète. Attention : `coteGlobale` y vaut
  `a.overallRating || traitAvg`, précédence INVERSE du web (`traitAvg ?? overallRating`).
  Sert trois écrans : fiche recruteur (Capacitor), fiche coach
  (`viewer="coach"`), aperçu athlète (`viewer="self-preview"`).
- `components/shared/AthleteEditWizardMobile.tsx` — profil de l'athlète sous
  Capacitor : aucune section partenaire ; même règle.

## W3 — badges partenaire en fin de « Distinctions »

Lecture : `badges_partenaires_athlete(p_athlete_id)` (`lib/badges/partenaire.ts`,
`chargerBadgesPartenaires`). Affichage : `BadgePartenaireVignette`
(`components/shared/athlete/BadgesPartenaire.tsx`) — gabarit 110 px comme
DistinctionBadge `lg`.

- `AthleteRecruiterProfileBodyMobile.tsx` — `BadgesRow` / `AdaptiveBadgesRow`
  (l.~432-444, rendu l.~2413) : ajouter les badges partenaire APRÈS les
  distinctions. ⚠ La rangée mobile est calculée pour 5 badges en 3+2 : un
  6e/7e badge (partenaire, hors plafond) doit passer à la ligne sans casser
  la grille. Vue coach (`viewer="coach"`) : boutons Masquer / Réafficher.
- `AthleteEditWizardMobile.tsx` (embed `athlete_badges` l.~621) et
  `MonParcoursMobile.tsx` (BadgeVignette l.~1116) — l'athlète voit ses badges
  partenaire non masqués, lecture seule.
- `CoachAthletesMobile.tsx` (embed l.~1125) — cartes du roster coach : décider
  si les badges partenaire y figurent (le web ne les met pas sur les cartes de
  recherche ni du roster aujourd'hui).
- Aucun picker mobile (`BadgePicker`, `AthleteWizardMobile`) ne doit lire
  `partenaire_mes_badges` : les badges partenaire ne sont JAMAIS proposés au
  coach ni à l'athlète.

## C — retrait par le partenaire

- Aucun portail partenaire mobile, aucun écran admin partenaires mobile : rien
  à faire tant qu'ils n'existent pas. « Retirer mon évaluation », « Attribuer
  un badge » et « Retirer le badge » sont web seulement.
- `RecruteurRechercheMobile.tsx` appelle `useAthleteSearch` SANS
  `inclurePartenaires` : son « 4+ étoiles » ignore déjà la note partenaire,
  donc un retrait n'y change rien. Si le lot mobile l'active, le retrait sort
  l'athlète du filtre comme au web (test E8 de `tests-w3.sql`).
