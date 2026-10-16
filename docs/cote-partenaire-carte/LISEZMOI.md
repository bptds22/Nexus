# Cote partenaire sur la carte du joueur + filtres « Mes athlètes » (2026-10-16)

Branche `feat/partenaire-cote-filtres`, depuis `origin/main` 2943f633. Web seulement (protocole
web d'abord) ; logique partagée dans `lib/` pour l'appli 1.4.5.

## 1. Cote partenaire sur la carte

Règle unique — `lib/evaluations/coteCarte.ts` :
- le coach a évalué → sa cote, exactement comme avant ;
- sinon, une évaluation partenaire lisible → ses étoiles **+ « Évaluation {organisation} »**, jamais seules ;
- sinon → étoiles vides, aucun libellé.

Surfaces web : recherche (grille + ligne), Mes favoris (grille + ligne, filtre « cote » et tri sur
la cote affichée, comme la recherche), fiche recruteur et aperçu (`PlayerCard`, une seule lecture W2
partagée avec la ligne compacte et la section partenaire existantes).

**Visibilité : aucun nouvel accès.** `cotes_partenaires_athletes(uuid[])` est `SECURITY INVOKER` et
appelle `evaluations_partenaires_athlete()` (W2) athlète par athlète : elle rend exactement ce que
l'appelant lit déjà sur la fiche, sans les critères. Banc : égalité stricte avec W2 pour recruteur,
coach, athlète, autre athlète, partenaire (la sienne seulement), admin ; anon refusé.

⚠️ **Constat sur la règle W2 en place (non modifiée ici)** : W2 ne revérifie PAS l'opt-in à la
lecture. Un partenaire ne peut évaluer qu'un athlète admissible (opt-in, 14 ans ou accord parental),
mais si l'athlète **retire** ensuite sa visibilité, le recruteur lit toujours la cote (essai C4).
C'est vrai aujourd'hui pour la recherche et la fiche ; la carte hérite de la même règle. Pour
« rien sans opt-in » au sens strict, il faut ajouter `is_partner_eligible_athlete()` à la lecture W2
ET au LATERAL de `recruiter_search_athletes` — décision BP, lot séparé.

### Plusieurs partenaires — règle PROPOSÉE : la plus récente

Codée aujourd'hui parce que c'est déjà celle de la recherche en prod (LATERAL W2 : filtre « 4+ » et
tri). En attente du OK de BP ; changer = `retenirCotePartenaire()` + ce LATERAL, ensemble.

Pourquoi la plus récente plutôt qu'une moyenne :
1. **Une cote, un nom.** La carte dit « Évaluation {organisation} ». Une moyenne de deux
   organisations n'a pas d'auteur : il faudrait « Évaluation A et B (moyenne) », un chiffre que
   personne n'a donné.
2. **Cohérence carte / filtre / tri** : la recherche filtre et trie déjà sur la plus récente.
3. **Échelles différentes** : deux organisations ne notent pas pareil ; les moyenner mélange des barèmes.
4. Le détail ne se perd pas : la fiche montre déjà **toutes** les évaluations partenaires, chacune nommée.

Limite assumée : la plus récente n'est pas forcément la meilleure source. Prod au 2026-10-16 :
2 évaluations partenaires, 2 athlètes, **aucun cas multi-partenaires** — la règle ne change rien
aujourd'hui.

## 2. « Mes athlètes » du partenaire

`lib/partenaires/filtresMesAthletes.ts` (logique pure) :
- recherche par mots, accents ignorés : prénom, nom, école/club, position (nom ou abréviation) ;
- « Distinctions » : choix multiple parmi les badges **réellement remis** (badges propres + badges
  Nexus attribués, non retirés), avec « Tout » / « Aucun » ; un athlète passe s'il porte au moins un
  badge coché ; aucun coché = filtre inactif ; « Tout » exclut les athlètes seulement évalués ;
- recherche ET distinctions se combinent. La page n'avait pas d'autre filtre jusqu'ici.

`partenaire_mes_athletes()` : DROP + CREATE (RETURNS TABLE change), + `poste`, `poste_abr` en fin de
table, + `badge_ref` dans chaque badge. Corps W4d inchangé sinon, ACL reposée et comparée en entier.

## Base de données

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261016170000_cote_partenaire_carte_mes_athletes.sql` | gardes md5 (= prod), 2 fonctions, ACL |
| `supabase/rollback/20261016170000_rollback_…sql` | retour à W4d, prouvé (md5 71a92e78 restauré) |
| `tests-cote-partenaire.sql` → `…-resultats.txt` | banc, 32/32 |
| `prod/lot-prod.sql` (md5 cbd84b97…) | lot une transaction ; empreinte 96eee4fb… |
| `prod/preuve-locale.txt` | garde fausse annule tout ; envoi séparé arrêté ; 2ᵉ envoi refusé |
| `outils/captures-cote-partenaire.mjs` → `captures/` | headless, comptes adultes jetables, remise en état |

**Rien en prod.** Ordre au GO : lot-prod.sql par le connecteur (md5 vérifié avant), vérif lecture
seule, PUIS le code. Le code dégrade proprement sans la migration (la page Mes athlètes marche,
sans position ni filtre fin ; les cartes sans lot affichent la cote du coach) mais ne doit pas
partir avant.

## À brancher dans l'appli (1.4.5)

- `RecruteurFavorisMobile` : `useCotesPartenaires` + `coteCarteDepuisEvaluations` + libellé.
- `AthleteRecruiterProfileBodyMobile` (fiche et aperçu athlète `/athlete/profil/apercu`) : la carte
  via `coteCarteDepuisEvaluations` sur `useEvaluationsPartenaires`.
- Recherche mobile (B3) : déjà sur `coteAffichee()`, qui délègue maintenant à `coteCarte()` — même
  sortie ; passer le texte à `libelleCotePartenaire()` pour dire « Évaluation … ».
- Mes athlètes mobile (CC2) : `filtrerMesAthletes`, `optionsDistinctions`, `resumeDistinctions`,
  `toutesLesDistinctions` — aucune copie de logique.
