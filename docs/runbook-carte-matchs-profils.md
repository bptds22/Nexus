# Runbook — carte des matchs, lot A+ « profils Nexus dans ce match » — 2026-10-07

Branche `feat/carte-matchs-profils` (depuis `main` local `b3f1407d`, lot A).
**Rien en prod sans le GO explicite de BP.** Une migration additive :
`supabase/migrations/20261008021500_matchs_profils_nexus.sql` (version LOCALE, à
renommer à la version enregistrée par `apply_migration`, rollback compris).

## Ordre
1. **Base d'abord** : `apply_migration` de
   `20261008021500_matchs_profils_nexus.sql`, puis renommer le fichier et son
   rollback à la version enregistrée.
2. **Web ensuite** : merge, push et promotion Vercel par BP. Le lot A, déjà
   en `main`, n'appelle pas la fonction. Si le web part AVANT la base, l'appel
   échoue (404 PostgREST) et la page se tait : aucune pastille, aucun message
   d'erreur, le reste de l'écran marche. Rien ne casse, mais la fonctionnalité
   est absente.

## Avant (lecture seule, relevé prod 2026-10-07)
```sql
select to_regprocedure('public.matchs_profils_nexus(uuid[])');   -- attendu : null
```
Colonnes lues par la fonction, toutes présentes en prod : `games.id`,
`games.home_team_id`, `games.visitor_team_id`, `team_athletes.team_id`,
`team_athletes.athlete_id`, `athletes.{id, first_name, last_name, position_id,
annee_diplomation, status, date_naissance, consentement_parental}`,
`positions.{id, nom, abreviation}`, `users.role`.
Test Pro en vigueur (le même que `recruiter_pipeline_insert`) : rôle `RECRUTEUR`
+ `user_has_pro()` → `get_user_tier()` lit `subscriptions` (tier actif). Le
compte de test `nexus.recruteur@nexussports.ca` est `all_star` : il passe.

## Après
```sql
select md5(pg_get_functiondef('public.matchs_profils_nexus(uuid[])'::regprocedure)) brut,
       proacl::text acl, prosecdef, provolatile, proconfig
  from pg_proc where oid = 'public.matchs_profils_nexus(uuid[])'::regprocedure;
-- attendu : brut b94ab615cf14a4fa104f28bce1213abf (fichier appliqué tel quel,
--   relevé en local) | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--   | t | s | {search_path=public,row_security=off}
-- Le bloc DO de la migration lève si l'ACL n'est pas exactement
-- {authenticated,postgres,service_role} (liste complète triée).
```
Contrôle de non-régression : l'empreinte agrégée des autres fonctions
`public` doit être la même avant et après (la migration ne crée qu'une fonction).
```sql
select md5(string_agg(md5(pg_get_functiondef(p.oid)), '' order by p.oid::regprocedure::text))
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
   and p.proname <> 'matchs_profils_nexus';
```

## Vérification à la main (web, après promotion)
1. Compte recruteur Pro → Carte des matchs → une journée avec matchs : les
   lignes dont une équipe a des profils Nexus visibles portent « N profils
   Nexus » (+ « dont X suivi(s) ») ; aucune pastille si 0.
2. Clic sur la ligne → bulle : « PROFILS NEXUS (N) », suivis en premier avec la
   pastille « Suivi », lien vers la fiche.
3. Aucun mineur sans consentement ni aucun athlète non ACTIF dans la liste
   (la fonction les exclut en base).
4. Compte gratuit : le mur Pro, aucun appel.

## Rollback
`supabase/rollback/20261008021500_rollback_matchs_profils_nexus.sql` — `DROP` de
la fonction (testé en local : absente, puis ré-appliquée avec la même ACL).
Aucune dépendance en base ; le web se tait (aucune pastille).
