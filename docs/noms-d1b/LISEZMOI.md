# Lot D1b — fiches sans nom, nom Google à confirmer (base + web)

Branche `feat/noms-d1b`, **local seulement**. Migration `20261015103315_d1b_nom_a_confirmer.sql`
appliquée en **local** ; rien en prod (attend le GO de BP). Décisions BP du 2026-10-15.

## Ce qui change

| Où | Quoi |
|---|---|
| Base | `users.nom_a_confirmer`, `athletes.nom_a_confirmer` (défaut `false`). |
| Base | `trg_users_nom_google` (BEFORE INSERT sur `users`) : compte **Google** sans prénom ni nom → nom complet coupé (premier mot = prénom, le reste = nom), **à confirmer**. Jamais d'écrasement. `handle_new_auth_user` n'est pas redéfinie. L'appli publiée recopie ce nom dans la fiche : sans build. |
| Base | `trg_athletes_nom_a_confirmer` : une fiche créée avec ce nom est à confirmer ; **toute modification du prénom ou du nom par l'athlète** confirme (c'est la confirmation de l'appli publiée : Profil → Prénom / Nom) ; réenregistrer le même nom ne confirme pas ; personne ne lève le drapeau à la main (ni coach, ni admin par l'API, ni l'athlète). |
| Base | `recruiter_search_athletes` : une fiche sans prénom, sans nom ou à confirmer **sort de la recherche recruteur** — web ET appli publiée (même fonction). Même signature (ACL conservée, comparée en entier) ; garde : la version remplacée est exactement celle relevée en prod. |
| Base | `mon_nom_a_confirmer()` / `confirmer_mon_nom(prénom, nom)` : le bandeau. La proposition vient du compte, sinon du nom complet Google **du compte connecté**. |
| Web, espace athlète | Bandeau « Est-ce bien toi : X Y ? » (Oui / Corriger) ; fiche sans nom → champs pré-remplis + Enregistrer. « Ton profil n'apparaît pas aux recruteurs tant que ton nom n'est pas confirmé. » |
| Web, inscription athlète | L'étape 1 (prénom et nom visibles et obligatoires) **confirme** le nom au « Suivant » — sinon le bandeau redemanderait aussitôt. |
| Web, `/coach/athletes` | **Ses** athlètes restent dans sa liste, avec l'étiquette « Nom à confirmer par l'athlète » (ajustement BP 2026-10-15). Hors de sa propre liste (« à réclamer », athlètes de l'école), une fiche sans nom ou à confirmer est retirée, avec la ligne « N fiche(s) de l'école masquée(s) : … ». |
| Registre §90 | Mobile : prénom/nom dans l'inscription de l'appli, liste coach mobile, bandeau, lien des notifications. |

## Effet en prod à l'application

- Les **9 fiches sans nom** sortent de la recherche recruteur (règle « sans nom »). Aucune donnée
  n'est écrite sur elles. Elles reviennent dès que le jeune met son nom (appli : Profil ; web : bandeau).
- Aucun compte ni aucune fiche existants ne sont marqués « à confirmer » (garde de la migration).
- Le code web lit `athletes.nom_a_confirmer` : **la migration doit être en prod avant le push**.

## Preuves (local, 2026-10-15)

- `tests-d1b.sql` → `tests-d1b-resultats.txt` : **29/29**, transaction annulée, comptes créés par le
  vrai chemin (`auth.users` → `handle_new_auth_user` → `users`) : Google 2 / 3 / 1 mots, nom déjà
  présent jamais écrasé, courriel et Apple inchangés ; recherche recruteur (à confirmer, prénom seul,
  sans nom → cachées ; nom saisi → visible) ; confirmation par l'appli (modification → confirmé et
  visible ; même nom → non ; drapeau levé à la main par l'athlète, un coach ou un admin → sans effet) ;
  bandeau (états, proposition tirée du compte de l'appelant) ; « Oui » / « Corriger » ; anon refusé.
- Tests D1 rejoués avec D1b en place : 33/33.
- `outils/captures-d1b.mjs` → `captures/` + `captures-resultats.txt` : coach (sa fiche étiquetée « Nom à confirmer par l'athlète », l'étiquette disparaît après « Oui » ; fiche sans nom de l'école masquée), bandeau bureau et mobile, « Corriger », fiche sans nom (champs pré-remplis
  « Neuf / Sansnom »). Comptes jetables retirés ; aucune erreur JavaScript.
- `npm test` 453/453 (1 sauté, préexistant) ; `tsc` 176 avant comme après, aucune dans le lot ;
  `next build --webpack` OK.

## Application en prod — même méthode que D1, preuve locale faite

`prod/construire-lot.mjs` → `prod/lot-prod.sql` ; `prod/preuve-locale.txt` : garde finale fausse → tout
annulé ; envoi séparé → arrêt avant écriture ; lot réel → empreinte identique (`245230c9…`, 10 éléments),
md5 enregistré = fichier ; 2e envoi refusé ; tests 29/29 sur la base issue du lot. Gardes propres à
D1b : aucun nom de fiche ni de compte ne change, aucune fiche ni aucun compte marqués. Retrait :
`rollback-d1b.sql` (remet la recherche recruteur d'avant, md5 `c03ca63e…`).

## Textes (approuvés par BP le 2026-10-15)

À envoyer **après** l'application de D1b en prod (sinon « caché aux recruteurs » serait faux).

**Push ciblé** — les 7 comptes joignables (outil admin d'annonces, audience « user ») :
- Titre : **Ton nom manque sur ton profil**
- Texte : **Les recruteurs ne voient pas ton profil tant que ton prénom et ton nom n'y sont pas. Ajoute-les dans Profil → Prénom / Nom.**

**Notification « Conseil profil »** (`PROFILE_TIP`) — les 9 :
- Titre : **Ajoute ton prénom et ton nom**
- Message : **Ton profil est caché aux recruteurs tant que ton prénom et ton nom n'y sont pas. Va dans Profil, puis modifie Prénom et Nom.**
- Dans l'appli publiée, un clic sur cette notification ne mène nulle part (registre §90) : le texte
  dit où aller.

L'annonce push s'envoie depuis le compte admin (la fonction exige `is_admin()`) : par BP depuis
`/admin`, ou par moi sur GO avec la liste des 7 comptes.
