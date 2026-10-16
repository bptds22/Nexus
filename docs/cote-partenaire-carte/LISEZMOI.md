# Cote partenaire sur la carte, « Mes athlètes », Loi 25 et demande de visibilité (2026-10-16)

Branche `feat/partenaire-cote-filtres`, depuis `origin/main` 2943f633. Web seulement (protocole
web d'abord) ; logique partagée dans `lib/` pour l'appli 1.4.5. **UNE migration :**
`supabase/migrations/20261016170000_cote_partenaire_carte_mes_athletes.sql`, générée par
`scratchpad/gen` (gabarit + corps d'origine relevés, remplacements exacts et vérifiés).

## 1. Cote partenaire sur la carte
`lib/evaluations/coteCarte.ts` : coach d'abord ; sinon partenaire avec « Évaluation {organisation} » ;
sinon rien. Surfaces web : recherche (grille + ligne), favoris, fiche et aperçu (`PlayerCard`).
**Plusieurs partenaires : la plus récente** (confirmé BP), départagée par l'identifiant à date égale —
côté client ET dans le LATERAL de la recherche (avant : ex æquo non départagés côté serveur).
`cotes_partenaires_athletes(uuid[])` : INVOKER, délègue à `evaluations_partenaires_athlete()`.

## 2. « Mes athlètes » du partenaire
Recherche (nom, école/club, position) + « Distinctions » à choix multiple (Tout / Aucun), combinées —
`lib/partenaires/filtresMesAthletes.ts`. `partenaire_mes_athletes()` + `poste`, `poste_abr`, `badge_ref`.

## 3. Loi 25 — un retrait d'opt-in est respecté immédiatement (décision BP)
Sans opt-in actif (`is_partner_eligible_athlete` faux), plus rien du partenaire n'est visible, pour
personne d'autre que l'admin — l'athlète lui-même, son coach et le partenaire auteur compris. Les
données restent ; l'opt-in revient, tout réapparaît. Lectures resserrées (corps d'origine + la seule
condition) : `evaluations_partenaires_athlete` (fiche, section, ligne, et le lot cartes par délégation),
`badges_partenaires_athlete`, `recruiter_search_athletes` (cote partenaire, « 4+ étoiles », tri),
`partenaire_badges_nexus_admissibles` (nommait le partenaire d'un badge posé). `partenaire_mes_athletes`
l'était déjà. Inventaire : ce sont les SEULES fonctions qui lisent `partner_evaluations` /
`partner_athlete_badges` pour un non-admin ; aucune vue ne les lit ; les badges Nexus remis par un
partenaire vivent seulement dans `partner_athlete_badges`.

**Prod (lecture seule, 2026-10-16) : 0 athlète touché** — 2 athlètes portent des données partenaires
(2 évaluations, 11 badges), les deux avec opt-in actif.

Hors périmètre, signalé : les notifications DÉJÀ reçues par le jeune (« Tu as reçu le badge X de Y »,
A4a) restent dans SA cloche après un retrait — c'est son historique, pas une exposition à un tiers.

## 4. Demande de visibilité au jeune
Seul chemin réel d'une évaluation/badge partenaire sur un jeune SANS opt-in actif : la carte prospect
confirmée qui attend (`CONFIRMEE_ATTENTE_OPTIN`, W4a) — W2/W3/W3b refusent toute écriture directe.
La demande naît là (trigger sur `partenaire_prospects`, aucune fonction W4 redéfinie) :
- « {Partenaire} t'a évalué. » / « Accepte d'être visible des partenaires pour que ton évaluation
  s'affiche. » — cloche + push (file A4a, genre `VISIBILITE_PARTENAIRE`). Ni cote ni badge.
- Une demande ouverte par (jeune, partenaire) ; une 2e carte du même partenaire s'y ajoute.
- Carte sans évaluation ni badge : pas de demande (rien à rendre visible).
- A RETIRÉ son opt-in : aucune relance au retrait ; UNE demande si une nouvelle évaluation (carte)
  arrive après, tous partenaires confondus.
- **Arrimage W4** : la proposition « C'est toi ? » de la carte (PARTENAIRE_EVALUATION) est CONVERTIE
  en demande, pas doublée ; son push, s'il n'est pas parti, est annulé par la règle W4 existante. Le
  push de demande part 10 min plus tard et est ANNULÉ si le jeune a déjà accepté (dans l'écran de la
  carte). Le bandeau W4 du portail athlète reste (rappel d'écran, pas un message envoyé).
- « Accepter » → `accepter_visibilite_partenaire()` → `set_my_partner_visibility` (chemin existant) ;
  sous 14 ans → demande au parent lié (`parent_notifications`, lien Consentements), sans activer ;
  sans parent lié → message, demande gardée ouverte.
- La demande se règle seule : ACCEPTEE (paramètres, parent, carte), CADUQUE (carte disparue).

**Prod (lecture seule) : 0 jeune recevrait le message à la mise en prod** (aucune carte en attente
d'opt-in ; 2 cartes : 1 ENVOYEE, 1 RESERVEE).

## Base de données — preuves
| Fichier | Rôle |
|---|---|
| migration `20261016170000` (md5 `1ee801ea…`) | gardes md5 sans CR (= prod) sur 10 fonctions + 3 contraintes |
| rollback `20261016170000` | retour exact (md5 de chaque corps vérifié), demandes supprimées |
| `tests-cote-partenaire.sql` → `…-resultats.txt` | **104/104** |
| `prod/lot-prod.sql` (md5 `c0919992…`, 113 Ko) | une transaction ; empreinte `386e556c…` (19 éléments) |
| `prod/preuve-locale.txt` | garde fausse : tout annulé ; envoi séparé : arrêt ; 2ᵉ envoi refusé ; banc 104/0 |
| `outils/captures-*.mjs` → `captures/` | headless, comptes jetables, remise en état |

Rien en prod. Au GO : `lot-prod.sql` par le connecteur (md5 vérifié avant), vérif lecture seule,
PUIS le code.

## À brancher dans l'appli (1.4.5)
- Favoris mobile, fiche et aperçu mobiles : `coteCarteDepuisEvaluations` + `libelleCotePartenaire`.
- Recherche mobile (B3) : libellé via `libelleCotePartenaire()`.
- Mes athlètes mobile : `filtresMesAthletes.ts`.
- Cloche mobile : rendu `PARTENAIRE_VISIBILITE_DEMANDE` + bouton via `accepterVisibilitePartenaire()`
  (`lib/partenaires/demandeVisibilite.ts`) — aujourd'hui l'appli affiche « Réponds sur nexussports.ca ».
- Push : `nx_type = VISIBILITE_PARTENAIRE`, route `/athlete/notifications` (liste blanche existante).
- Écran de réponse de carte mobile (registre §85) : « parent_required » pourrait passer par la même
  demande au parent.
