-- Relevé W0 (lecture seule). Lancer avant ET après les migrations 20261013094801–094804.
\pset footer off
\echo '== 1. Triggers sur media_partners'
select tgname, tgenabled from pg_trigger
 where tgrelid = 'public.media_partners'::regclass and not tgisinternal order by 1;

\echo '== 2. Policies media_partners'
select policyname, cmd, roles::text, qual, with_check from pg_policies
 where schemaname = 'public' and tablename = 'media_partners' order by 1;

\echo '== 3. anon : SELECT de table sur media_partners ?'
select count(*) as select_table_anon from information_schema.table_privileges
 where table_schema = 'public' and table_name = 'media_partners'
   and grantee in ('anon','PUBLIC') and privilege_type = 'SELECT';

\echo '== 4. anon : colonnes lisibles de media_partners'
select array_agg(a.attname::text order by a.attname::text) as colonnes_anon
  from pg_attribute a
 where a.attrelid = 'public.media_partners'::regclass and a.attnum > 0 and not a.attisdropped
   and has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT');

\echo '== 5. ACL (liste complète triée)'
select p.oid::regprocedure as fonction,
       (select array_agg(t.g order by t.g)
          from (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                  from unnest(p.proacl::text[]) x) t) as acl
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('is_partner_eligible_athlete','partner_athlete_profile','media_partners_garde_colonnes')
 order by 1;

\echo '== 6. partner_athlete_profile filtre-t-il ACTIF ?'
select position($$a.status = 'ACTIF'$$ in pg_get_functiondef('public.partner_athlete_profile'::regproc)) > 0 as filtre_actif;

\echo '== 7. Athlètes éligibles partenaire NON actifs (ceux que W0.5 retire de la RPC)'
select a.status::text, count(*) from public.athletes a
 where public.is_partner_eligible_athlete(a.id) group by 1 order by 1;
