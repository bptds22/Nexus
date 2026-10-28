-- ════════════════════════════════════════════════════════════════════════════
-- Lot D1a cégep — APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc), version 20261028010000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.sh <date> <rejeu-blanc|apply> (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → ce que chaque rôle VOIT d'une université témoin AVANT (le problème) → migration →
-- ce qu'il voit APRÈS (admin seulement) → mêmes nombres d'écoles et d'équipes ordinaires avant / après →
-- inscription (schema_migrations + admin_operations) → COMMIT. L'université et l'équipe témoins sont créées DANS chaque essai et défaites aussitôt (NX000).
-- Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-cegep-d1a';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028010000') then
    raise exception 'NEXUS: version 20261028010000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028010000' then raise exception 'NEXUS: version 20261028010000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_D1A_MASQUAGE', 'ROLLBACK_CEGEP_LOT_D1A_MASQUAGE')) then
    raise exception 'NEXUS: le lot D1a a déjà laissé une trace dans admin_operations';
  end if;
  if to_regprocedure('public.verrou_universites()') is null then
    raise exception 'NEXUS: préalable D0 absent';
  end if;
end $$;
select max(version) as derniere_version from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement, jamais affichés) ────────────────────────
create temp table _t on commit drop as
select (select u.id from public.users u join public.athletes a on a.user_id = u.id where u.role = 'ATHLETE'::public.user_role order by u.id limit 1) as u_ath,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role and u.school_id is not null order by u.id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.onboarding_complete order by u.id limit 1) as u_rec,
       (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1) as u_part,
       (select u.id from public.users u where u.role = 'PARENT'::public.user_role order by u.id limit 1) as u_par,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1) as u_adm,
       (select t.sport_id from public.teams t order by t.id limit 1) as sport,
       '00000000-0000-4000-8000-00000000d1a1'::uuid as univ,
       '00000000-0000-4000-8000-00000000d1a2'::uuid as univ_team;
do $$
begin
  if exists (select 1 from _t where u_ath is null or u_coach is null or u_rec is null or u_part is null or u_par is null or u_adm is null or sport is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

create function pg_temp.prep() returns void language plpgsql as $$
begin
  insert into public.schools (id, name, type, city) select univ, 'Université témoin D1a', 'UNIVERSITE', 'Québec' from _t;
  insert into public.teams (id, school_id, sport_id, name, season, age_group)
    select univ_team, univ, sport, 'Équipe témoin D1a', '2026-2027', 'Universitaire' from _t;
end $$;
create function pg_temp.compte_equipes(p_temoin boolean) returns text language plpgsql as $$
declare n bigint;
begin
  if p_temoin then
    select count(*) into n from public.teams where id = '00000000-0000-4000-8000-00000000d1a2';
  else
    select count(*) into n from public.teams where id <> '00000000-0000-4000-8000-00000000d1a2';
  end if;
  return n::text;
exception when insufficient_privilege then
  return 'refusé';
end $$;
-- Rend ce que le rôle VOIT : « écoles univ. / équipe univ. témoin / écoles hors univ. / équipes hors univ. ».
create function pg_temp.vu(p_role text, p_uid uuid) returns text language plpgsql as $$
declare v text;
begin
  begin
    perform pg_temp.prep();
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      perform set_config('role', 'anon', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    -- Les équipes à part : un rôle qui ne peut pas lire teams du tout (anon en prod) rend « refusé ».
    v := (select count(*) from public.schools where type = 'UNIVERSITE') || ' / ' ||
         pg_temp.compte_equipes(true) || ' / ' ||
         (select count(*) from public.schools where type <> 'UNIVERSITE') || ' / ' ||
         pg_temp.compte_equipes(false);
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 80);
  end;
end $$;
create function pg_temp.matrice() returns table (role text, vu text) language sql as $$
  select 'anon (site public, visiteur)', pg_temp.vu('anon', null)
  union all select 'athlète', pg_temp.vu('authenticated', u_ath) from _t
  union all select 'parent', pg_temp.vu('authenticated', u_par) from _t
  union all select 'coach', pg_temp.vu('authenticated', u_coach) from _t
  union all select 'recruteur collégial', pg_temp.vu('authenticated', u_rec) from _t
  union all select 'partenaire', pg_temp.vu('authenticated', u_part) from _t
  union all select 'admin', pg_temp.vu('authenticated', u_adm) from _t;
$$;
-- Coût de la policy sur la lecture la plus large (recruteur : toutes les équipes), médiane de 5.
create function pg_temp.duree_recruteur() returns numeric language plpgsql as $$
declare t0 timestamptz; d numeric[] := '{}'; i int; n bigint; u uuid := (select u_rec from _t);
begin
  for i in 1..5 loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      t0 := clock_timestamp();
      select count(*) into n from public.teams;
      d := d || (extract(epoch from clock_timestamp() - t0) * 1000)::numeric;
      raise exception using errcode = 'NX000';
    exception when sqlstate 'NX000' then null;
    end;
  end loop;
  return (select percentile_cont(0.5) within group (order by x) from unnest(d) x);
end $$;
create temp table _avant on commit drop as select * from pg_temp.matrice();
select round(pg_temp.duree_recruteur(), 1) as recruteur_toutes_equipes_ms_avant;
select 'AVANT' as phase, role, vu as "univ / équipe univ / écoles / équipes" from _avant;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _d1a on commit drop as
select '20261028010000'::text as version,
       $nexus_mig$-- NON APPLIQUÉE EN PROD. Chantier cégep, LOT D1a (avant l'import D1) : les universités et leurs équipes sont
-- INVISIBLES pour tout le monde sauf l'admin, quel que soit l'écran (web, mobile 1.4.5 déjà installé, qui lit
-- la base directement).
--
-- Pourquoi : « schools public read » (true) rend toute école lisible par tous, et « Recruiters see teams »
-- rend toute équipe lisible par un recruteur. Plusieurs listes du web et du mobile lisent les écoles sans
-- filtre de type (modifier une fiche côté coach, paramètres et profil du recruteur, Mon équipe, sélecteur
-- d'école sans filterType…) : sans ce lot, les 12 universités y apparaîtraient dès l'import.
--
--   1. ids_universites() : la liste des écoles UNIVERSITE, lue SANS RLS (sinon la policy des équipes,
--      qui la consulte, serait elle-même aveuglée par celle des écoles).
--   2. Policies RESTRICTIVE « universites_masquees » en SELECT, pour tous les rôles, sur schools et teams :
--      une ligne universitaire n'est lisible que par un admin (is_admin()). La liste est calculée une
--      fois par requête (sous-requête scalaire), pas ligne par ligne.
--   Le lot D2 (recruteur universitaire) élargira ces deux policies, derrière lancement_universitaire.
-- Hors de portée de ce lot, et vérifié à part : les fonctions SECURITY DEFINER (aucune ne liste écoles ou
-- équipes sans passer par une fiche, un compte, un match ou un identifiant connu) et les pages lues avec la
-- clé service (/college : correctif web livré avant D1).
-- Aucune ligne modifiée.

do $garde$
begin
  if to_regprocedure('public.ids_universites()') is not null
     or exists (select 1 from pg_policies where policyname = 'universites_masquees') then
    raise exception 'NEXUS: 20261028010000 déjà appliquée';
  end if;
  if to_regprocedure('public.verrou_universites()') is null then
    raise exception 'NEXUS: préalable D0 (20261028000000) absent';
  end if;
end $garde$;

create function public.ids_universites()
returns uuid[]
language sql
stable
security definer
set search_path = public
set row_security = off
as $function$
  select coalesce(array_agg(s.id), '{}') from public.schools s where s.type = 'UNIVERSITE';
$function$;

comment on function public.ids_universites() is
  'Lot D1a cégep : identifiants des écoles UNIVERSITE, lus sans RLS (sert aux policies universites_masquees).';

create policy universites_masquees on public.schools
  as restrictive for select to public
  using (type <> 'UNIVERSITE' or (select public.is_admin()));

create policy universites_masquees on public.teams
  as restrictive for select to public
  using ((select public.is_admin()) or not (school_id = any ((select public.ids_universites())::uuid[])));

-- La policy des équipes s'évalue avec les droits de l'appelant : anon et authenticated doivent pouvoir
-- l'exécuter. Elle ne rend que des identifiants d'écoles, déjà lisibles par l'admin seulement.
revoke all on function public.ids_universites() from public;
grant execute on function public.ids_universites() to anon, authenticated, service_role;

do $garde$
begin
  if (select count(*) from pg_policies where policyname = 'universites_masquees' and permissive = 'RESTRICTIVE'
         and cmd = 'SELECT' and tablename in ('schools', 'teams')) <> 2 then
    raise exception 'NEXUS: les deux policies universites_masquees ne sont pas en place';
  end if;
  raise notice 'NEXUS: lot D1a cégep — universités et équipes universitaires masquées (admin seulement)';
end $garde$;
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback de 20261028010000_cegep_lot_d1a_universites_masquees : retire les deux policies et la fonction.
-- ATTENTION : s'il existe des universités en base, elles redeviennent visibles partout (voir D1-AUDIT.md).
do $garde$
begin
  if to_regprocedure('public.ids_universites()') is null then
    raise exception 'NEXUS: 20261028010000 absente, rien à annuler';
  end if;
end $garde$;

drop policy universites_masquees on public.schools;
drop policy universites_masquees on public.teams;
drop function public.ids_universites();

do $garde$
begin
  if exists (select 1 from pg_policies where policyname = 'universites_masquees') then
    raise exception 'NEXUS: rollback D1a incomplet';
  end if;
  raise notice 'NEXUS: lot D1a cégep annulé';
end $garde$;
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d1a) <> '948868d699b253dc2dee9468d5344567' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d1a);
  end if;
  if (select md5(rollback) from _d1a) <> 'e98ea7ab2355a5240c82cdb19de023c0' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _d1a);
  end if;
  execute (select contenu from _d1a);
end $apply$;
set local search_path = public, extensions;

create temp table _apres on commit drop as select * from pg_temp.matrice();
select 'APRÈS' as phase, a.role, a.vu as "univ / équipe univ / écoles / équipes",
       case when split_part(a.vu, ' / ', 3) = split_part(b.vu, ' / ', 3) and split_part(a.vu, ' / ', 4) = split_part(b.vu, ' / ', 4)
            then '=' else 'CHANGE' end as hors_univ_vs_avant
  from _apres a join _avant b using (role);

select round(pg_temp.duree_recruteur(), 1) as recruteur_toutes_equipes_ms_apres;

do $$
begin
  if exists (select 1 from _avant where vu like 'ERREUR%') or exists (select 1 from _apres where vu like 'ERREUR%') then
    raise exception 'NEXUS: un essai a échoué';
  end if;
  if exists (select 1 from _apres where role <> 'admin'
              and (split_part(vu, ' / ', 1) <> '0' or split_part(vu, ' / ', 2) not in ('0', 'refusé'))) then
    raise exception 'NEXUS: un rôle non admin voit encore l''université ou son équipe';
  end if;
  if (select split_part(vu, ' / ', 1) || '/' || split_part(vu, ' / ', 2) from _apres where role = 'admin') <> '1/1' then
    raise exception 'NEXUS: l''admin ne voit plus l''université ou son équipe';
  end if;
  if exists (select 1 from _apres a join _avant b using (role)
              where split_part(a.vu, ' / ', 3) <> split_part(b.vu, ' / ', 3) or split_part(a.vu, ' / ', 4) <> split_part(b.vu, ' / ', 4)) then
    raise exception 'NEXUS: un rôle ne voit plus les mêmes écoles ou équipes ordinaires';
  end if;
  raise notice 'NEXUS: VERDICT D1a — universités invisibles hors admin, écoles et équipes ordinaires identiques pour chaque rôle';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_d1a_universites_masquees', array[contenu], 'bptds22@gmail.com' from _d1a;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_D1A_MASQUAGE',
       'Chantier cégep, lot D1a : universités et équipes universitaires masquées hors admin (policies RESTRICTIVE), avant l''import D1 (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_d1a_universites_masquees', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_d1a_universites_masquees.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_d1a_universites_masquees.sql',
         'md5_fichier', '948868d699b253dc2dee9468d5344567', 'md5_rollback', 'e98ea7ab2355a5240c82cdb19de023c0', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _d1a;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028010000') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _d1a;
commit;
\echo '== COMMIT fait : lot D1a cégep en prod (universités masquées hors admin).'
