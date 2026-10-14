# NLS Premier League S02 — mise en prod des matchs (plan, NON exécuté)

Préparé le 2026-10-14. **Rien de ce qui suit n'a touché la prod.** Chaque
étape attend le GO de BP. **Jamais le mardi, ni le mercredi avant 5 h**
(heure de Montréal). **La base avant l'app.** Une étape qui échoue arrête le
plan : on ne passe pas à la suivante.

Connexion : connecteur MCP Supabase (`apply_migration` pour les migrations,
`execute_sql` pour les relevés et les blocs `do $$`). La voie `supabase db
push` est bloquée (registre §80).

## 0. Relevés AVANT (lecture seule)

```sql
select
  (select count(*) from teams where league = 'No Limits Showcases' and season = '2026-2027')  as equipes_nls,      -- attendu 107
  (select count(*) from teams t where t.league = 'No Limits Showcases'
     and t.id::text in (select e->>'id' from admin_operations o, jsonb_array_elements(o.details->'equipes') e
                         where o.operation = 'NLS_EQUIPES_CREEES'))                          as equipes_au_journal, -- attendu 107
  (select count(*) from games where league_name = 'No Limits Showcases')                      as matchs_nls,        -- attendu 0
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'games_source_nom_chk') as source_chk,        -- sans NLS
  (select md5(pg_get_functiondef('public.matchs_recherche(date, date, text, text[], text, uuid[], text[], boolean)'::regprocedure))) as rpc_md5, -- 56be0ec134f496a4cc256a695efa202c
  (select count(*) from lieux_geocodes where nom_normalise ~ 'dalbe|trembles|boulogne|vianney') as gymnases;         -- attendu 0
```

Relevé du 2026-10-14 : 107 / 107 / 0 / sans NLS / `56be0ec1…` / 0.

## 1. Migration — source NLS admise — APPLIQUÉE le 2026-10-14 (version prod 20261014163338)

- Fichier : `supabase/migrations/20261014163338_nls_games_source.sql`
  (md5 `8e8a38391006e86b317a619e09800cda`).
- Ajoute `'NLS'` à `games_source_nom_chk`. Aucun index : la clé naturelle d'un
  match NLS n'en a pas besoin, et `games_identite_civile` ne la contredit pas.
- Gate intégré : la contrainte doit valoir exactement la liste attendue.
- Rollback : `supabase/rollback/20261014163338_rollback_nls_games_source.sql`
  (refusé tant qu'il existe un match NLS).

## 2. Équipes — déjà en prod, on VÉRIFIE seulement

Rien à écrire. Le relevé 0 doit donner 107 équipes, toutes présentes au
journal `NLS_EQUIPES_CREEES`. Un autre compte = arrêt, à instruire avant
l'import (une équipe retirée ou ajoutée fausserait la résolution des noms).

## 3. Géocodage des 4 gymnases (6 lieux) — FAIT le 2026-10-14

1. BP valide `data/nls/gymnases-revue.csv`, colonne `valide_par_bp` :
   `oui` (point Nominatim) ou `manuel` (coordonnées corrigées dans le CSV).
   Proposition : `oui` pour Dalbé-Viau, Bois-de-Boulogne et St-Jean-Vianney ;
   **`manuel` pour Pointe-aux-Trembles**, avec le point RSEQ
   (45.68561319, -73.495074582). Nominatim y a trouvé un arrêt d'autobus à 266 m.
2. `node scripts/carte-matchs-lot-b/ecrire-lieux.mjs data/nls/gymnases-revue.csv data/nls/gymnases-ecrire.sql`
3. Exécuter le fichier : transaction gardée, exactement 6 lignes
   `lieux_geocodes` et 1 ligne `admin_operations` (`LIEUX_GEOCODES_ECRITS`).
4. Rollback : `delete from lieux_geocodes where nom_normalise in (<les 6 clés>)`,
   avec une ligne `admin_operations`.

Indépendant des matchs : la carte joint par nom de lieu, au moment de lire.

## 4. Import des 622 matchs du 14 oct. — FAIT le 2026-10-14 par psql (journal NLS_MATCHS_IMPORT lot 1, 16:40 UTC)

- **Voie : psql -1, voir `docs/nls-matchs-prod/commande-psql.md`** (gardes avant / après dans la même transaction).
- Fichier : `data/nls/matchs-2026-10-14.sql` (md5 `8b515d495fb262f4e03d65166b6248d1`),
  généré par `scripts/plan-nls-basketball-games.mjs` depuis
  `data/nls/matchs-2026-10-14.json`. Ce JSON a été lu par
  `scripts/nls-basketball/parse-exposure-pdf.py` dans `data/nls/pdf/2026-10-14/`.
- Un seul bloc `do $$`, sans `nexus.essai_local` : la garde de fenêtre est
  **active** et refuse le mardi et le mercredi avant 5 h.
- Gardes : 622 lignes sources ; équipes résolues par le journal (un nom
  inconnu = rien écrit) ; aucune collision avec `games_identite_civile` ;
  insérés = nouveaux = 622 ; base NLS 0 → 622 ; 1 ligne `admin_operations`
  `NLS_MATCHS_IMPORT` (lot_no 1, ids insérés).
- Message attendu : `nouveaux 622, modifiés 0, inchangés 0, inconnus 0, retirés 0 ; base NLS 0 -> 622 ; journal +1`.
- Relevé APRÈS : comptage par groupe (attendu : Benjamin F 43, Benjamin
  Diamond M 42, Benjamin Gold M 89, Cadet F 52, Cadet Diamond M 66, Cadet Gold
  M 88, Juvénile Diamond F 42, Juvénile Gold F 36, Juvénile Diamond M 88,
  Juvénile Gold M 76) ; 0 match sans équipe ; 0 doublon de clé.
- Rollback : `scripts/nls-basketball/matchs/rollback-lot.sql`. Il refuse si un
  recruteur a déjà ajouté un de ces matchs à son calendrier.

## 5. « Code d'affichage » : c'est une migration, pas un déploiement Vercel — APPLIQUÉE le 2026-10-14 (version prod 20261014164451)

Le nom NLS tel qu'écrit (« CB ELITE (2) CM ») est déjà en base
(`games.home_name_raw` / `visitor_name_raw`). Seule la RPC de la carte change :

- Fichier : `supabase/migrations/20261014164451_nls_carte_noms_exposure.sql`
  (md5 `b863d945bd93fca646ed150a19af853e`).
- Gate AVANT : la RPC en place doit avoir le md5 `56be0ec1…`, sinon arrêt.
  Gate APRÈS : ACL complète `{authenticated, postgres, service_role}`.
- Rollback : `supabase/rollback/20261014164451_rollback_nls_carte_noms_exposure.sql`
  (retour au md5 `56be0ec1…`, prouvé en local).

**Aucun fichier de l'app web ne change** : rien à pousser sur `main` pour
l'affichage. Les scripts (`scripts/nls-basketball/`,
`scripts/plan-nls-basketball-games.mjs`), les migrations et la doc se
commitent ensuite, sur GO.

## Ensuite, chaque mercredi (5 h ou plus tard)

1. BP enregistre les 10 PDF dans `data/nls/pdf/AAAA-MM-JJ/`.
2. `python -I scripts/nls-basketball/parse-exposure-pdf.py AAAA-MM-JJ`
3. `node --experimental-strip-types scripts/plan-nls-basketball-games.mjs --json data/nls/matchs-AAAA-MM-JJ.json`
4. Relire, puis exécuter `data/nls/matchs-AAAA-MM-JJ.sql`. Le message dit :
   nouveaux, modifiés (dont déplacés et inversions), inchangés, retirés
   (MATCH_RETIRE, jamais supprimés).
5. Un nouveau gymnase : `geocoder-gymnases.mjs` s'arrête et le nomme. Lui
   ajouter sa requête et son repère, puis faire valider par BP.
