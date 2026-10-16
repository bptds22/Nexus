# Journal partenaire par fonction en base — `20261016150000` (lot mobile 1.4.5, B1, 2026-10-16)

## Pourquoi

Le portail partenaire entre dans l'appli. Le web journalisait les **vues de fiche** et les
**téléchargements de carte** par deux routes Next (`/api/partner/profile-views/log`,
`/api/partner/cards/log-download`). Une appli en export statique n'embarque **aucune route API** :
sans changement, ni la vue ni le téléchargement ne seraient tracés depuis l'appli — et c'est ce
journal que l'athlète lit (Loi 25).

La règle passe donc dans **une** fonction, appelée par le web **et** par l'appli
(`lib/partenaires/journal.ts`) :

`partenaire_journaliser(p_athlete_id uuid, p_action text, p_format text default null) → boolean`

- `VUE` → une ligne `partner_profile_views` ; `TELECHARGEMENT` + `publication|story` →
  une ligne `partner_card_downloads`.
- Gardes des routes, même ordre : session ; partenaire **APPROUVÉ de la session** (jamais un
  identifiant passé par le client) ; paramètres ; athlète admissible
  (`is_partner_eligible_athlete`). Un refus lève `NEXUS: …` et n'écrit rien.
- `SECURITY DEFINER`, `search_path = public`, `row_security = off`. ACL complète
  `{authenticated, postgres, service_role}` (gardée en fin de migration, comparaison complète).
- Aucune table, aucune policy, aucune fonction existante modifiée ; aucune donnée écrite.

Les deux routes API sont **supprimées** dans le même commit : le web appelle la fonction.
⇒ **La migration doit être en prod AVANT le push du code** (sinon le web ne journalise plus).

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261016150000_partenaire_journal.sql` | la migration (md5 `77b4533bf6e8eaee7a0a4ac5b15b3aea`, LF, sans BOM) |
| `rollback-partenaire-journal.sql` | retire la fonction (les lignes de journal restent) — hors du dossier des migrations, pour que `db reset` ne le rejoue pas |
| `tests-partenaire-journal.sql` + `tests-partenaire-journal-resultats.txt` | banc local, transaction annulée : **22 ok / 0 échec** |
| `enregistrer-local.sql` / `enregistrer-local.sh` | enregistrer la version dans l'historique LOCAL après un `psql -f` |
| `prod/empreinte-objets.sql` | empreinte de la fonction (corps + droits) et des policies des deux journaux |
| `prod/construire-lot.mjs` | construit `lot-prod.sql` et `lot-preuve-garde-fausse.sql` |
| `prod/lot-prod.sql` | **le lot de prod** — empreinte attendue `d18a6ca68ce7ec68b09a3faa47cd9d51` (8 éléments) |
| `prod/preuve-locale.sh` + `preuve-locale.txt` | preuve locale de la méthode « un seul message » |

## Preuve locale (2026-10-16)

`prod/preuve-locale.txt` : garde fausse en fin de lot → tout annulé ; instructions envoyées
séparément → arrêt avant toute écriture ; lot réel en un message → appliqué, md5 enregistré =
fichier, empreinte = `d18a6ca6…|8` ; second envoi → refusé ; banc sur la base issue du lot →
22 | 0 ; rollback puis ré-application → OK.

## Mise en prod (sur GO de BP seulement)

Par le connecteur Supabase (`execute_sql`, **pas** `apply_migration` : le lot enregistre lui-même
sa version), `prod/lot-prod.sql` **tel quel, en un seul appel**, après vérification de son md5
(`a23bd5517ac2c072c7e93b2a5a55791e`). Puis, en lecture seule : la fonction, son ACL, et l'empreinte.

⚠ L'empreinte inclut les **noms des 7 policies** de `partner_profile_views` /
`partner_card_downloads` relevés en local. Si la prod en porte d'autres, le lot s'annule de
lui-même (rien n'est écrit) : relever alors les policies de prod et reconstruire le lot.
