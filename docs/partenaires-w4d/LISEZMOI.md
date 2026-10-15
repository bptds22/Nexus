# Lot W4d — partenaires : page admin des prospects, « Terminées » nommées, « Mes athlètes »

Branche `feat/partenaires-w4d`, **local seulement**. Migration `20261015110727_w4d_partenaires_terminees_mes_athletes.sql`
appliquée en **local** ; rien en prod (attend le GO de BP). Lot de prod prêt et prouvé (`prod/`).

## Ce qui change

| Où | Quoi |
|---|---|
| Base | `partenaire_voit_athlete(id)` (interne, non appelable) : **une** règle pour les trois vues — partenaire admis (compte PARTNER, organisation APPROUVÉE), fiche ACTIVE, `is_partner_eligible_athlete`. |
| Base | `partenaire_prospects_terminees()` : les issues du partenaire ; une réclamation non annulée est nommée (prénom, nom, sport, position, école) avec le résumé du transfert (évaluation, badges transférés / sautés et raison) **seulement si** le jeune lui est visible. Sinon `profil_visible = false`, ni nom ni identifiant. Les autres issues restent sans nom. |
| Base | `partenaire_prospects_mes_issues()` (W4a, même signature, ACL conservée) : l'identifiant d'un jeune réclamé n'est plus rendu s'il ne lui est plus visible. Garde : la version remplacée est exactement celle de prod (`e511cd02…`). |
| Base | `partenaire_mes_athletes()` : les athlètes évalués ou badgés (badge non retiré) par le partenaire, visibles seulement ; cote, badges (avec l'identifiant d'attribution pour le retrait), dates. Rien n'est effacé quand un jeune se retire. |
| Base | `admin_prospects_candidats_en_attente()` : le compteur du menu admin (admin seulement). |
| Admin | `/admin/prospects-partenaires` + entrée de menu avec compteur. Rapprochements à décider (critère, force, promotion, visible du partenaire ou non ; « Proposer au jeune » / « Écarter »), cartes actives (partenaire, nom, sport, statut réel, source de réservation, échéance), issues (« Annuler la réclamation » pendant 7 jours, confirmation en deux temps), décisions passées. Tout par les fonctions W4a. |
| Partenaire | « Terminées » (`/partenaire/prospects`) : la réclamation visible est nommée avec le résumé du transfert et « Voir sa fiche » ; sinon « Réclamée — profil non visible ». |
| Partenaire | `/partenaire/mes-athletes` + entrée de menu (partenaire évaluateur) : cartes nom, sport, école, sa cote, ses badges, date ; « Voir la fiche », « Modifier l'évaluation » (même fenêtre que la fiche, W2), « Retirer » un badge (W3/W3b, confirmation en deux temps). |

## Loi 25

Aucune vue ne nomme un jeune qui n'est pas visible du partenaire ; aucune ne laisse voir un
rapprochement (le partenaire voit sa propre carte « À envoyer », jamais le candidat). Un
partenaire suspendu ne voit plus aucun nom. La règle de visibilité est en base, pas dans l'écran.

## Preuves (local, 2026-10-15)

- `tests-w4d.sql` → `tests-w4d-resultats.txt` : **52/52**, transaction annulée, rôles réels :
  partenaire, autre partenaire, coach, recruteur, athlète, admin, anon ; le jeune retire puis
  réactive sa visibilité ; partenaire suspendu ; annulation par l'admin ; badge seul puis retiré ;
  rapprochement invisible du partenaire ; ACL complètes.
- Non-régression : W2 53/53, W3 70/70, W3b 60/60, W4a 205/205. Deux constantes de test mises à
  jour pour D1/D1b (déjà en prod) : nombre de triggers sur `athletes` (18 → 20) et empreinte de la
  recherche recruteur (filtre D1b) — W4d n'y touche pas.
- `outils/captures-w4d.mjs` → `captures/` + `captures-resultats.txt` : admin (bureau + mobile),
  Terminées nommée (bureau + mobile), Mes athlètes (bureau + mobile), puis après retrait de la
  visibilité : « Réclamée — profil non visible » et liste vide, évaluation toujours en base. Deux
  athlètes ADULTES jetables (jamais Félix ni Mathis, mineurs) ; remise en état exacte ; aucune
  erreur JavaScript.
- `npm test` 453/453 (1 sauté, préexistant) ; `tsc` 176 avant comme après, aucune dans le lot ;
  `next build --webpack` OK.
- Lot de prod : `prod/preuve-locale.txt` — garde finale fausse → tout annulé ; envoi séparé → arrêt
  avant écriture ; lot réel → empreinte identique (corps ET droits) ; 2e envoi refusé ; tests 52/52
  sur la base issue du lot. Retrait : `rollback-w4d.sql`.
