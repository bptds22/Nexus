-- LOT PROD coachs nommables — généré par docs/coachs-nommables/prod/construire-lot.mjs — VARIANTE DE PREUVE (empreinte fausse)
-- Fichier : supabase/migrations/20261016040000_coachs_nommables.sql — md5 6d31a088090ba749066fdddfb5225322
-- État de départ attendu des objets : 5239d7216c96df7988a30afd914bd26c ; empreinte attendue après : 00000000000000000000000000000000
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _cn_releve as
select txid_current() as txid,
       (select count(*) from public.users) || '|' || (select count(*) from public.team_coaches)
       || '|' || (select count(*) from public.teams) || '|' || (select count(*) from public.schools)
       || '|' || (select count(*) from public.team_join_tokens) || '|' || (select count(*) from public.athletes)
       || '|' || (select md5(coalesce(string_agg(team_id::text || ':' || coach_id::text || ':' || coalesce(role, ''), ','
                                                 order by team_id, coach_id), '')) from public.team_coaches) as donnees,
       (select e.etat from (
select md5(string_agg(x, E'\n' order by x collate "C")) as etat, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|'
         || case when p.proname in ('coach_nommable', 'resolve_team_join_token')
                 then 'norm:' || md5(btrim(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
                 else md5(p.prosrc) end
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('coach_nommable', 'resolve_team_join_token',
                       'coachs_nommables_ecole', 'coachs_nommables_equipe', 'apercu_code_equipe')
) t
       ) e) as etat_objets,
       (select count(*) from public.admin_operations) as operations,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261016040000') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $gcn$
begin
  if (select txid from _cn_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _cn_releve) <> 0 then
    raise exception 'NEXUS LOT: migration coachs nommables déjà présente — rien n''est appliqué';
  end if;
  if (select etat_objets from _cn_releve) is distinct from '5239d7216c96df7988a30afd914bd26c' then
    raise exception 'NEXUS LOT: objets de départ ≠ relevé (%) — rien n''est appliqué', (select etat_objets from _cn_releve);
  end if;
end $gcn$;

-- 3. ===== DÉBUT 20261016040000_coachs_nommables.sql =====
-- Coachs nommables à l'athlète — aperçu d'un code d'équipe et choix manuel du coach (décision BP du
-- 2026-10-16, règle RSEQ, sous-lot mobile A1 ; web et mobile appellent les MÊMES fonctions).
--
-- Un coach n'est montré à un athlète que si coach_nommable() le permet (20261015125824) : compte COACH
-- d'une école SECONDAIRE ou LIGUE_CIVILE, qui n'entraîne AUCUNE équipe d'un autre type. Un coach
-- collégial qui coache AUSSI au secondaire n'est donc JAMAIS nommé. coach_nommable reste réservée au
-- serveur : le client ne lit plus users / team_coaches pour ces listes, il appelle :
--
--  · coachs_nommables_ecole(école)  : choix manuel « Mon coach » d'une école. Cégep → aucun coach
--    (coach_nommable exige une école secondaire ou civile).
--  · coachs_nommables_equipe(équipe): les coachs nommables d'une équipe secondaire ou civile, rôle
--    compris (entraîneur-chef d'abord). Équipe collégiale ou d'école inconnue → aucun.
--  · apercu_code_equipe(code)       : resolve_team_join_token tel quel + la liste « coachs » ci-dessus
--    (vide pour un code non valide). Réservée aux comptes connectés : resolve_team_join_token reste
--    la seule porte anonyme (/join), et elle ne nomme aucun coach.
--
-- Aucune donnée écrite. Aucune fonction existante modifiée.

do $$
begin
  if to_regprocedure('public.apercu_code_equipe(text)') is not null
     or to_regprocedure('public.coachs_nommables_ecole(uuid)') is not null
     or to_regprocedure('public.coachs_nommables_equipe(uuid)') is not null then
    raise exception 'NEXUS: migration déjà appliquée (coachs nommables)';
  end if;
  -- Les deux fonctions dont on dépend, telles que relevées en prod et en local le 2026-10-16
  -- (empreinte SANS commentaires ni espaces).
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.coach_nommable(uuid)'::regprocedure)
     is distinct from 'a70d5b069285a61aced0fab5a208c031' then
    raise exception 'NEXUS: coach_nommable ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.resolve_team_join_token(text)'::regprocedure)
     is distinct from '069c147d79f963aad5e97d39772bee2a' then
    raise exception 'NEXUS: resolve_team_join_token ne correspond pas au relevé';
  end if;
end $$;

-- ── Choix manuel : les coachs nommables d'une école ─────────────────────────

create function public.coachs_nommables_ecole(p_school uuid)
returns table (coach_id uuid, prenom text, nom text, photo_url text)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select u.id, u.first_name, u.last_name, u.photo_url
    from public.users u
   where auth.uid() is not null
     and u.school_id = p_school
     and u.role = 'COACH'::public.user_role
     and public.coach_nommable(u.id) is not null
   order by lower(coalesce(u.last_name, '')), lower(coalesce(u.first_name, '')), u.id
$$;

-- ── Les coachs nommables d'une équipe (rôle compris) ────────────────────────

create function public.coachs_nommables_equipe(p_team uuid)
returns table (coach_id uuid, prenom text, nom text, role text)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select tc.coach_id, u.first_name, u.last_name, tc.role
    from public.team_coaches tc
    join public.users u   on u.id = tc.coach_id
    join public.teams t   on t.id = tc.team_id
    join public.schools s on s.id = t.school_id
   where auth.uid() is not null
     and tc.team_id = p_team
     and s.type in ('SECONDAIRE', 'LIGUE_CIVILE')
     and public.coach_nommable(tc.coach_id) is not null
   order by case tc.role when 'head_coach' then 0 when 'coordinator' then 1 else 2 end,
            lower(coalesce(u.last_name, '')), lower(coalesce(u.first_name, '')), tc.coach_id
$$;

-- ── L'aperçu d'un code d'équipe, coachs déjà filtrés ────────────────────────

create function public.apercu_code_equipe(p_code text)
returns table (team_id uuid, team_name text, school_id uuid, school_name text, school_logo_url text,
               school_type text, sport_name text, season text, age_group text, division text,
               gender text, league text, is_valid boolean, coachs jsonb)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select r.team_id, r.team_name, r.school_id, r.school_name, r.school_logo_url, r.school_type,
         r.sport_name, r.season, r.age_group, r.division, r.gender, r.league, r.is_valid,
         case when r.is_valid and auth.uid() is not null then
           coalesce((select jsonb_agg(jsonb_build_object('coach_id', c.coach_id, 'prenom', c.prenom,
                                                         'nom', c.nom, 'role', c.role) order by c.ord)
                       from public.coachs_nommables_equipe(r.team_id)
                            with ordinality as c(coach_id, prenom, nom, role, ord)), '[]'::jsonb)
         else '[]'::jsonb end
    from public.resolve_team_join_token(p_code) r
$$;

-- ── Droits ───────────────────────────────────────────────────────────────────

revoke all on function public.coachs_nommables_ecole(uuid) from public, anon, authenticated;
revoke all on function public.coachs_nommables_equipe(uuid) from public, anon, authenticated;
revoke all on function public.apercu_code_equipe(text) from public, anon, authenticated;
grant execute on function public.coachs_nommables_ecole(uuid) to authenticated;
grant execute on function public.coachs_nommables_equipe(uuid) to authenticated;
grant execute on function public.apercu_code_equipe(text) to authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r record;
  vus text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('coachs_nommables_ecole', 'coachs_nommables_equipe', 'apercu_code_equipe')
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
      raise exception 'NEXUS: ACL % = %, attendu {authenticated,postgres,service_role}', r.proname, vus;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('coachs_nommables_ecole', 'coachs_nommables_equipe')
        and position('coach_nommable(' in prosrc) > 0) <> 2 then
    raise exception 'NEXUS: une liste de coachs ne passe pas par coach_nommable';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname = 'apercu_code_equipe'
        and position('coachs_nommables_equipe(' in prosrc) > 0
        and position('resolve_team_join_token(' in prosrc) > 0) <> 1 then
    raise exception 'NEXUS: apercu_code_equipe ne passe pas par resolve_team_join_token et coachs_nommables_equipe';
  end if;
  raise notice 'NEXUS coachs nommables : aperçu de code et choix manuel filtrés par coach_nommable — OK';
end $$;

-- ===== FIN 20261016040000_coachs_nommables.sql =====

-- 4. Enregistrement de la version (statements = le fichier) et du geste (admin_operations)
create temp table _cn_texte as select $CNMIG$-- Coachs nommables à l'athlète — aperçu d'un code d'équipe et choix manuel du coach (décision BP du
-- 2026-10-16, règle RSEQ, sous-lot mobile A1 ; web et mobile appellent les MÊMES fonctions).
--
-- Un coach n'est montré à un athlète que si coach_nommable() le permet (20261015125824) : compte COACH
-- d'une école SECONDAIRE ou LIGUE_CIVILE, qui n'entraîne AUCUNE équipe d'un autre type. Un coach
-- collégial qui coache AUSSI au secondaire n'est donc JAMAIS nommé. coach_nommable reste réservée au
-- serveur : le client ne lit plus users / team_coaches pour ces listes, il appelle :
--
--  · coachs_nommables_ecole(école)  : choix manuel « Mon coach » d'une école. Cégep → aucun coach
--    (coach_nommable exige une école secondaire ou civile).
--  · coachs_nommables_equipe(équipe): les coachs nommables d'une équipe secondaire ou civile, rôle
--    compris (entraîneur-chef d'abord). Équipe collégiale ou d'école inconnue → aucun.
--  · apercu_code_equipe(code)       : resolve_team_join_token tel quel + la liste « coachs » ci-dessus
--    (vide pour un code non valide). Réservée aux comptes connectés : resolve_team_join_token reste
--    la seule porte anonyme (/join), et elle ne nomme aucun coach.
--
-- Aucune donnée écrite. Aucune fonction existante modifiée.

do $$
begin
  if to_regprocedure('public.apercu_code_equipe(text)') is not null
     or to_regprocedure('public.coachs_nommables_ecole(uuid)') is not null
     or to_regprocedure('public.coachs_nommables_equipe(uuid)') is not null then
    raise exception 'NEXUS: migration déjà appliquée (coachs nommables)';
  end if;
  -- Les deux fonctions dont on dépend, telles que relevées en prod et en local le 2026-10-16
  -- (empreinte SANS commentaires ni espaces).
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.coach_nommable(uuid)'::regprocedure)
     is distinct from 'a70d5b069285a61aced0fab5a208c031' then
    raise exception 'NEXUS: coach_nommable ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.resolve_team_join_token(text)'::regprocedure)
     is distinct from '069c147d79f963aad5e97d39772bee2a' then
    raise exception 'NEXUS: resolve_team_join_token ne correspond pas au relevé';
  end if;
end $$;

-- ── Choix manuel : les coachs nommables d'une école ─────────────────────────

create function public.coachs_nommables_ecole(p_school uuid)
returns table (coach_id uuid, prenom text, nom text, photo_url text)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select u.id, u.first_name, u.last_name, u.photo_url
    from public.users u
   where auth.uid() is not null
     and u.school_id = p_school
     and u.role = 'COACH'::public.user_role
     and public.coach_nommable(u.id) is not null
   order by lower(coalesce(u.last_name, '')), lower(coalesce(u.first_name, '')), u.id
$$;

-- ── Les coachs nommables d'une équipe (rôle compris) ────────────────────────

create function public.coachs_nommables_equipe(p_team uuid)
returns table (coach_id uuid, prenom text, nom text, role text)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select tc.coach_id, u.first_name, u.last_name, tc.role
    from public.team_coaches tc
    join public.users u   on u.id = tc.coach_id
    join public.teams t   on t.id = tc.team_id
    join public.schools s on s.id = t.school_id
   where auth.uid() is not null
     and tc.team_id = p_team
     and s.type in ('SECONDAIRE', 'LIGUE_CIVILE')
     and public.coach_nommable(tc.coach_id) is not null
   order by case tc.role when 'head_coach' then 0 when 'coordinator' then 1 else 2 end,
            lower(coalesce(u.last_name, '')), lower(coalesce(u.first_name, '')), tc.coach_id
$$;

-- ── L'aperçu d'un code d'équipe, coachs déjà filtrés ────────────────────────

create function public.apercu_code_equipe(p_code text)
returns table (team_id uuid, team_name text, school_id uuid, school_name text, school_logo_url text,
               school_type text, sport_name text, season text, age_group text, division text,
               gender text, league text, is_valid boolean, coachs jsonb)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select r.team_id, r.team_name, r.school_id, r.school_name, r.school_logo_url, r.school_type,
         r.sport_name, r.season, r.age_group, r.division, r.gender, r.league, r.is_valid,
         case when r.is_valid and auth.uid() is not null then
           coalesce((select jsonb_agg(jsonb_build_object('coach_id', c.coach_id, 'prenom', c.prenom,
                                                         'nom', c.nom, 'role', c.role) order by c.ord)
                       from public.coachs_nommables_equipe(r.team_id)
                            with ordinality as c(coach_id, prenom, nom, role, ord)), '[]'::jsonb)
         else '[]'::jsonb end
    from public.resolve_team_join_token(p_code) r
$$;

-- ── Droits ───────────────────────────────────────────────────────────────────

revoke all on function public.coachs_nommables_ecole(uuid) from public, anon, authenticated;
revoke all on function public.coachs_nommables_equipe(uuid) from public, anon, authenticated;
revoke all on function public.apercu_code_equipe(text) from public, anon, authenticated;
grant execute on function public.coachs_nommables_ecole(uuid) to authenticated;
grant execute on function public.coachs_nommables_equipe(uuid) to authenticated;
grant execute on function public.apercu_code_equipe(text) to authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r record;
  vus text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('coachs_nommables_ecole', 'coachs_nommables_equipe', 'apercu_code_equipe')
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
      raise exception 'NEXUS: ACL % = %, attendu {authenticated,postgres,service_role}', r.proname, vus;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('coachs_nommables_ecole', 'coachs_nommables_equipe')
        and position('coach_nommable(' in prosrc) > 0) <> 2 then
    raise exception 'NEXUS: une liste de coachs ne passe pas par coach_nommable';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname = 'apercu_code_equipe'
        and position('coachs_nommables_equipe(' in prosrc) > 0
        and position('resolve_team_join_token(' in prosrc) > 0) <> 1 then
    raise exception 'NEXUS: apercu_code_equipe ne passe pas par resolve_team_join_token et coachs_nommables_equipe';
  end if;
  raise notice 'NEXUS coachs nommables : aperçu de code et choix manuel filtrés par coach_nommable — OK';
end $$;
$CNMIG$::text as t;
do $ecn$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _cn_texte' using '20261016040000', 'coachs_nommables', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _cn_texte' using '20261016040000', 'coachs_nommables';
  end if;
end $ecn$;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_COACHS_NOMMABLES',
       'Coachs nommables à l''athlète : aperçu de code et choix manuel du coach filtrés par coach_nommable (règle RSEQ, GO BP)',
       jsonb_build_object('version', '20261016040000', 'md5_fichier', '6d31a088090ba749066fdddfb5225322', 'etat_depart', '5239d7216c96df7988a30afd914bd26c',
                          'empreinte_objets', '00000000000000000000000000000000'),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $fcn$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _cn_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016040000')
     is distinct from '6d31a088090ba749066fdddfb5225322' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  select e.empreinte_objets, e.n_elements into v_empreinte, v_n from (
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|'
         || case when p.proname in ('coach_nommable', 'resolve_team_join_token')
                 then 'norm:' || md5(btrim(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
                 else p.prosrc end
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('coach_nommable', 'resolve_team_join_token',
                       'coachs_nommables_ecole', 'coachs_nommables_equipe', 'apercu_code_equipe')
) t
  ) e;
  if v_empreinte is distinct from '00000000000000000000000000000000' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if (select count(*) from public.users) || '|' || (select count(*) from public.team_coaches)
       || '|' || (select count(*) from public.teams) || '|' || (select count(*) from public.schools)
       || '|' || (select count(*) from public.team_join_tokens) || '|' || (select count(*) from public.athletes)
       || '|' || (select md5(coalesce(string_agg(team_id::text || ':' || coach_id::text || ':' || coalesce(role, ''), ','
                                                 order by team_id, coach_id), '')) from public.team_coaches) <> (select donnees from _cn_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _cn_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $fcn$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, etat_objets, operations, version_deja, derniere_version, pg from _cn_releve) r),
  'apres', json_build_object(
     'donnees', (select count(*) from public.users) || '|' || (select count(*) from public.team_coaches)
       || '|' || (select count(*) from public.teams) || '|' || (select count(*) from public.schools)
       || '|' || (select count(*) from public.team_join_tokens) || '|' || (select count(*) from public.athletes)
       || '|' || (select md5(coalesce(string_agg(team_id::text || ':' || coach_id::text || ':' || coalesce(role, ''), ','
                                                 order by team_id, coach_id), '')) from public.team_coaches),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261016040000'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016040000'),
     'admin_operation', (select id from public.admin_operations where operation = 'MIGRATION_COACHS_NOMMABLES' order by le desc limit 1),
     'fonctions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
                     and proname in ('coachs_nommables_ecole', 'coachs_nommables_equipe', 'apercu_code_equipe')),
     'meme_transaction', (select txid from _cn_releve) = txid_current())
) as resultat_lot_coachs_nommables;
