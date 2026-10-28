-- ════════════════════════════════════════════════════════════════════════════
-- Lot D3d cégep — APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc), version 20261028060000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> d3d (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → migration → essais avec un recruteur universitaire témoin (compte neuf, interrupteur
-- ON, conversations avec un athlète et un coach réels), chaque essai défait aussitôt : ce que lit chaque appelant
-- par ecoles_recruteurs() et par la lecture directe de schools → inscription (schema_migrations + admin_operations) → COMMIT. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-cegep-d3d';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028060000') then
    raise exception 'NEXUS: version 20261028060000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028060000' then raise exception 'NEXUS: version 20261028060000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_D3D', 'ROLLBACK_CEGEP_LOT_D3D')) then
    raise exception 'NEXUS: le lot D3d a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028050000') then
    raise exception 'NEXUS: préalable D3c absent';
  end if;
  if to_regprocedure('public.ecoles_recruteurs(uuid[])') is not null then
    raise exception 'NEXUS: ecoles_recruteurs existe déjà';
  end if;
  if public.lancement_universitaire_actif() then
    raise exception 'NEXUS: lancement_universitaire est ON — D3d se pose interrupteur OFF';
  end if;
end $$;
select max(version) as derniere_version from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement) ─────────────────────────────────────────
create temp table _t on commit drop as
select (select s.id from public.schools s where s.type = 'UNIVERSITE' order by s.name limit 1) as univ,
       (select a.user_id from public.athletes a join public.users u on u.id = a.user_id
         where u.role = 'ATHLETE'::public.user_role and not public.is_messaging_blacked_out(a.id) order by a.id limit 1) as u_ath,
       (select a.id from public.athletes a join public.users u on u.id = a.user_id
         where u.role = 'ATHLETE'::public.user_role and not public.is_messaging_blacked_out(a.id) order by a.id limit 1) as a_ath,
       (select a.user_id from public.athletes a join public.users u on u.id = a.user_id
         where u.role = 'ATHLETE'::public.user_role order by a.id desc limit 1) as u_ath_autre,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role and u.school_id is not null order by u.id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role and u.school_id is not null order by u.id desc limit 1) as u_coach_autre,
       (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.onboarding_complete order by u.id limit 1) as u_rec,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1) as u_adm,
       (select a.id from public.athletes a order by a.id limit 1) as a_quelconque,
       '00000000-0000-4000-8000-0000000d3d01'::uuid as neuf;
do $$
begin
  if exists (select 1 from _t where univ is null or u_ath is null or u_ath_autre is null or u_coach is null
                or u_coach_autre is null or u_rec is null or u_adm is null)
     or (select u_ath = u_ath_autre or u_coach = u_coach_autre from _t) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _d3d on commit drop as
select '20261028060000'::text as version,
       $nexus_mig$-- Lot D3d cégep — le nom de l'école d'un recruteur, montré à qui lui parle (décision BP 2026-10-28, Q4).
-- Les universités restent masquées en base (policies universites_masquees, D1a) : un athlète ou un coach ne lit
-- pas l'école UNIVERSITE d'un recruteur universitaire, et ses messages afficheraient un nom vide. Cette fonction
-- rend l'école des recruteurs avec qui l'appelant a une conversation — et seulement eux, comme le permettent déjà
-- les policies de lecture de conversations (coach : coach_id / coach_b_id ; athlète : sa fiche, RECRUTEUR_ATHLETE).
-- Tout type d'école, pour un appel unique côté web ; aucune autre colonne de l'école n'est rendue.

create function public.ecoles_recruteurs(p_recruteurs uuid[])
  returns table (recruiter_id uuid, school_id uuid, school_name text)
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select u.id, s.id, s.name
    from public.users u
    join public.schools s on s.id = u.school_id
   where u.id = any (coalesce(p_recruteurs, '{}'::uuid[]))
     and u.role = 'RECRUTEUR'::public.user_role
     and auth.uid() is not null
     and (public.is_admin()
          or exists (select 1 from public.conversations c
                      where c.recruiter_id = u.id
                        and (c.coach_id = auth.uid() or c.coach_b_id = auth.uid()
                             or (c.conversation_type = 'RECRUTEUR_ATHLETE'::public.conversation_type
                                 and exists (select 1 from public.athletes a
                                              where a.id = c.athlete_id and a.user_id = auth.uid())))));
$function$;
revoke all on function public.ecoles_recruteurs(uuid[]) from public, anon;
grant execute on function public.ecoles_recruteurs(uuid[]) to authenticated, service_role;
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback du lot D3d cégep : retire ecoles_recruteurs().
drop function public.ecoles_recruteurs(uuid[]);
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d3d) <> '1096e63c01caaf1c2e2e423ce3761b64' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d3d);
  end if;
  if (select md5(rollback) from _d3d) <> '54545b11854ef2c166c1793601648e47' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _d3d);
  end if;
  execute (select contenu from _d3d);
end $apply$;
set local search_path = public, extensions;

-- ── Essais ───────────────────────────────────────────────────────────────────
-- Recruteur universitaire témoin, deux conversations (un athlète, un coach), interrupteur ON.
create function pg_temp.prep() returns void language plpgsql as $$
begin
  update public.app_settings set value = 'true' where key = 'lancement_universitaire';
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', neuf, 'authenticated', 'authenticated', 'd3d-temoin@nexus.invalid',
         '{}', '{}', now(), now() from _t;
  update public.users u set role = 'RECRUTEUR'::public.user_role, context = 'universitaire', school_id = t.univ,
         onboarding_complete = true, role_claimed_at = now()
    from _t t where u.id = t.neuf;
  insert into public.conversations (recruiter_id, athlete_id, conversation_type)
    select neuf, a_ath, 'RECRUTEUR_ATHLETE'::public.conversation_type from _t where a_ath is not null;
  insert into public.conversations (recruiter_id, coach_id, athlete_id, conversation_type)
    select neuf, u_coach, a_quelconque, 'RECRUTEUR_COACH'::public.conversation_type from _t;
end $$;
-- Ce que lit l'appelant : « fonction : <n lignes>/<nom universitaire rendu> · lecture directe : <n> ».
create function pg_temp.lit(p_role text, p_uid uuid) returns text language plpgsql as $$
declare v_neuf uuid := (select neuf from _t); v_univ uuid := (select univ from _t); n_f int; nom_ok boolean; n_d int; v text;
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
    begin
      select count(*), bool_or(school_id = v_univ and school_name is not null) into n_f, nom_ok
        from public.ecoles_recruteurs(array[v_neuf]);
      v := 'fonction ' || n_f || '/' || coalesce(nom_ok, false);
    exception when insufficient_privilege then v := 'fonction refusée';
    end;
    begin
      select count(*) into n_d from public.schools where id = v_univ;
      v := v || ' · lecture directe ' || n_d;
    exception when insufficient_privilege then v := v || ' · lecture directe refusée';
    end;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create temp table _m on commit drop as
select 1 as o, 'athlète en conversation avec lui' as appelant, pg_temp.lit('authenticated', u_ath) as lu from _t
union all select 2, 'autre athlète', pg_temp.lit('authenticated', u_ath_autre) from _t
union all select 3, 'coach en conversation avec lui', pg_temp.lit('authenticated', u_coach) from _t
union all select 4, 'autre coach', pg_temp.lit('authenticated', u_coach_autre) from _t
union all select 5, 'recruteur collégial', pg_temp.lit('authenticated', u_rec) from _t
union all select 6, 'le recruteur universitaire lui-même', pg_temp.lit('authenticated', neuf) from _t
union all select 7, 'anon (site public)', pg_temp.lit('anon', null) from _t
union all select 8, 'admin', pg_temp.lit('authenticated', u_adm) from _t;
select appelant, lu as "ecoles_recruteurs · lecture directe de l'université" from _m order by o;

do $$
begin
  if exists (select 1 from _m where lu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if (select a_ath from _t) is not null and (select lu from _m where o = 1) <> 'fonction 1/true · lecture directe 0' then
    raise exception 'NEXUS: l''athlète en conversation ne reçoit pas le nom de l''université : %', (select lu from _m where o = 1);
  end if;
  if (select lu from _m where o = 3) <> 'fonction 1/true · lecture directe 0' then
    raise exception 'NEXUS: le coach en conversation ne reçoit pas le nom de l''université : %', (select lu from _m where o = 3);
  end if;
  if exists (select 1 from _m where o in (2, 4, 5) and lu <> 'fonction 0/false · lecture directe 0') then
    raise exception 'NEXUS: un appelant sans conversation reçoit le nom ou lit l''université';
  end if;
  if (select lu from _m where o = 7) not like 'fonction refusée%' then
    raise exception 'NEXUS: anon peut appeler ecoles_recruteurs';
  end if;
  if (select lu from _m where o = 6) <> 'fonction 0/false · lecture directe 1' then
    raise exception 'NEXUS: le recruteur universitaire ne lit plus sa propre université : %', (select lu from _m where o = 6);
  end if;
  if (select lu from _m where o = 8) <> 'fonction 1/true · lecture directe 1' then
    raise exception 'NEXUS: l''admin : %', (select lu from _m where o = 8);
  end if;
  raise notice 'NEXUS: VERDICT D3d — nom de l''université rendu aux seuls participants d''une conversation ; base toujours masquée';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

do $$
begin
  if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_d3d_nom_ecole_recruteurs', array[contenu], 'bptds22@gmail.com' from _d3d;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_D3D',
       'Chantier cégep, lot D3d : ecoles_recruteurs() — le nom de l''école d''un recruteur pour qui lui parle (Q4), universités toujours masquées en base (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_d3d_nom_ecole_recruteurs', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_d3d_nom_ecole_recruteurs.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_d3d_nom_ecole_recruteurs.sql',
         'md5_fichier', '1096e63c01caaf1c2e2e423ce3761b64', 'md5_rollback', '54545b11854ef2c166c1793601648e47', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _d3d;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028060000') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _d3d;
commit;
\echo '== COMMIT fait : lot D3d cégep en prod (ecoles_recruteurs, interrupteur OFF).'
