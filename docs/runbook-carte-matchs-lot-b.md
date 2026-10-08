# Runbook — carte des matchs, lot B (moteur de recherche + calendrier + terrains civils) — 2026-10-07

Branche `feat/carte-matchs-lot-b` (depuis `main` local `f3521708`).
**Rien en prod sans le GO explicite de BP.** La base TOUJOURS avant le web.

Quatre migrations additives (versions LOCALES, à renommer chacune à la version
enregistrée par `apply_migration`, rollback compris). La 4ᵉ et les terrains
définitifs ont été ajoutés le 2026-10-08, sur décisions de BP :

| # | Fichier | Objet |
|---|---|---|
| 1 | `20261008100000_lieux_geocodes.sql` | `lieu_normalise(text)` + table `lieux_geocodes` (lecture authenticated, aucune écriture client) |
| 2 | `20261008100100_matchs_ajoutes.sql` | table `matchs_ajoutes` + trigger qui pose l'unité et l'auteur ; RLS `acces_carte_lecture` / `acces_carte_ecriture` (+ `is_admin()` en lecture) |
| 3 | `20261008100200_matchs_recherche.sql` | RPC `matchs_recherche(p_debut, p_fin, p_sport, p_types, p_texte)` — lit 1 et 2 |
| 4 | `20261008100300_journal_matchs_ajoutes.sql` | types `MATCH_AJOUTE` / `MATCH_RETIRE` au journal (`recruiter_activity_log`, sans athlète, match dans `details`), écrits par trigger sur `matchs_ajoutes`, lisibles par l'unité (`unite_journal_select`) |

## Ordre
1. **Migrations 1, 2, 3, 4**, dans cet ordre, chacune par un `apply_migration` séparé.
2. **Terrains civils** : seulement les lignes validées par BP dans
   `scripts/carte-matchs-lot-b/terrains-civils-final.csv`. Colonne `valide_par_bp` :
   `oui` = coordonnées Nominatim gardées ; `manuel` = adresse donnée par BP,
   géocodée, ou coordonnées RSEQ reprises ; `en_attente` / `non_confirme` = NON
   écrit, le terrain reste « Lieu non précisé ». Le CSV final est produit par
   `geocoder-corrections.mjs` depuis le CSV de revue et les décisions de BP du
   2026-10-08 : 30 terrains écrits, D'Arcy McGee en attente. Le SQL est déjà
   généré (30 lignes) ; le régénérer si BP confirme D'Arcy McGee :
   `node scripts/carte-matchs-lot-b/ecrire-lieux.mjs` → `ecrire-lieux.sql`
   (transaction gardée : exactement N lignes `lieux_geocodes` + 1 ligne
   `admin_operations`, sinon rien n'est écrit), puis l'exécuter (`execute_sql`).
   Les coordonnées ne sont JAMAIS écrites dans `games`.
3. **Web** : merge, push et promotion Vercel par BP. Si le web partait avant
   la base : la carte afficherait « Les matchs n'ont pas pu être chargés » (RPC
   absente), le Calendrier resterait intact (la lecture de `matchs_ajoutes` en
   erreur est ignorée). Rien ne casse, mais la carte est vide.

## Avant (lecture seule)
```sql
select to_regprocedure('public.lieu_normalise(text)'), to_regclass('public.lieux_geocodes'),
       to_regclass('public.matchs_ajoutes'),
       to_regprocedure('public.matchs_recherche(date,date,text,text[],text)');   -- attendu : 4 × null
select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
 where e.extname = 'unaccent';                                                   -- attendu : extensions
-- Empreintes de non-régression (à refaire après) :
select count(*), md5(string_agg(md5(pg_get_functiondef(p.oid)) || coalesce(p.proacl::text,''), '' order by p.oid::regprocedure::text))
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
   and p.proname not in ('lieu_normalise','matchs_recherche','matchs_ajoutes_poser_unite','log_match_ajoute');
select count(*), md5(string_agg(c.relname||'.'||pol.polname||':'||pol.polcmd::text||':'||coalesce(pg_get_expr(pol.polqual,pol.polrelid),'')
       ||':'||coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),'')||':'||pol.polroles::text, '|' order by c.relname, pol.polname))
  from pg_policy pol join pg_class c on c.oid = pol.polrelid
 where c.relname not in ('lieux_geocodes','matchs_ajoutes')
   and not (c.relname = 'recruiter_activity_log' and pol.polname = 'unite_journal_select');
-- Migration 4 : la contrainte et la policy qu'elle redéclare (md5 relevés en prod le 2026-10-08) :
select md5(pg_get_constraintdef(oid)) from pg_constraint
 where conname = 'recruiter_activity_log_action_type_check';   -- 9b8b093043958a8365040e275d567fe2
select md5(pg_get_expr(polqual, polrelid)) from pg_policy
 where polname = 'unite_journal_select';                         -- 43ff2da3489fc56d1ecf485671198352
```
Si l'un de ces deux md5 diffère : STOP. La migration 4 redéclare la liste
complète ; si elle a bougé depuis, relire la prod avant d'appliquer.

## Après
- Chaque migration lève si son ACL n'est pas exactement celle attendue :
  `lieu_normalise` et `matchs_recherche` = `{authenticated,postgres,service_role}` ;
  `matchs_ajoutes_poser_unite` = `{postgres,service_role}` ; table
  `lieux_geocodes` : `authenticated` = `SELECT` seul ; table `matchs_ajoutes` :
  `authenticated` = `{DELETE,INSERT,SELECT}` ; `anon` : rien.
- Migration 4 : `log_match_ajoute` = `{postgres,service_role}` ; types admis par
  la contrainte = les 18 d'avant + `MATCH_AJOUTE`, `MATCH_RETIRE` (liste complète
  triée) ; gestes de `unite_journal_select` = les 9 d'avant + les deux mêmes,
  rôle `authenticated` seul.
- Les deux empreintes ci-dessus : identiques avant / après.
- Appel anonyme de `matchs_recherche` : HTTP 401, 42501.

## Mesure de performance (prod, lecture seule, 2026-10-08)
Pire cas : semaine du 13 au 19 octobre (1 263 matchs), tous sports, tous
types, sans texte, sous l'identité du compte de test. Corps de la fonction
joué en transaction lecture seule annulée (la fonction n'existait pas encore ;
les jointures sur `lieux_geocodes` et `matchs_ajoutes`, vides, omises) :
**exécution 51,2 ms, planification 6,2 ms**, 1 263 lignes.

## Vérification à la main (web, compte recruteur Pro, après promotion)
1. Carte des matchs : s'ouvre sur aujourd'hui, dans le sport de l'unité,
   Secondaire + Civil cochés ; « au » vide.
2. Une plage de 8 jours → « 7 jours au plus » ; aucun appel.
3. Un match libre : « + » → « ✓ » ; il apparaît au Calendrier, « 0 cible » ;
   « ✓ » → « + » ; il disparaît du Calendrier.
4. Un match où joue un athlète suivi : point à étoile, « ✓ » non cliquable.
5. Un match civil validé : un point sur la carte, au bon endroit.
6. Un terrain qui porte plusieurs matchs : le panneau liste « Autres matchs à ce
   terrain » ; un clic ouvre ce match.
7. Après un « + » : « Match ajouté au calendrier : … » au fil du tableau de bord
   (signé ; chez un collègue Pro de l'unité aussi) et dans Activités (filtre
   « Calendrier ») ; après « ✓ » : « Match retiré du calendrier : … ».

## Rollback (ordre inverse : 4, 3, 2, 1)
- `supabase/rollback/20261008100300_rollback_journal_matchs_ajoutes.sql` — trigger et
  fonction retirés, lignes `MATCH_*` du journal supprimées (relever le compte
  avant), contrainte et policy remises à l'identique (md5 vérifiés contre la prod).
- `supabase/rollback/20261008100200_rollback_matchs_recherche.sql` — `DROP` de la RPC.
- `supabase/rollback/20261008100100_rollback_matchs_ajoutes.sql` — `DROP` de la
  table (les matchs ajoutés par les unités partent avec : relever le compte avant).
- `supabase/rollback/20261008100000_rollback_lieux_geocodes.sql` — `DROP` de la
  table et de la fonction (le CSV revu permet de réécrire les terrains).
Testés en local : tout absent après rollback, puis ré-appliqué avec les mêmes ACL.
Rollback 4 testé seul le 2026-10-08 : contrainte et policy identiques au md5 près à
la prod, fonction et trigger absents ; ré-application : gates passés, ACL identique.
