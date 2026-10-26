-- ════════════════════════════════════════════════════════════════════════════
-- Lot B3 cégep — ROLLBACK RÉEL EN PROD de la version @@VERSION@@. À lancer SEULEMENT sur GO BP.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-b3/generer.sh <date> rollback : le rollback y est embarqué tel
-- quel (fins de ligne LF, même texte que celui du rejeu à blanc, md5 gardé).
--
-- UNE transaction : gardes AVANT (B3 est là) → relevé des colonnes d'avant B3, par compte → rollback
-- (les 3 fonctions et les 2 vues reprennent leur définition prod du 2026-10-26 ; le rollback le vérifie
-- lui-même) → mêmes relevés, comparés → inscription (schema_migrations « rollback_cegep_lot_b3_filtres »,
-- version = l'heure UTC du lancement ; admin_operations ROLLBACK_B3_FILTRES) → COMMIT.
-- Lancer SANS -1, en postgres. Aucune donnée n'est touchée par B3 : rien d'autre à défaire.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rollback-lot-b3';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── 0. Gardes AVANT : B3 est en place ────────────────────────────────────────
do $$
begin
  if extract(isodow from now() at time zone 'America/Toronto') = 2
     or (extract(isodow from now() at time zone 'America/Toronto') = 3
         and extract(hour from now() at time zone 'America/Toronto') < 12) then
    raise exception 'NEXUS: pas de prod le mardi ni le mercredi avant midi';
  end if;
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres (propriétaire des 5 objets), pas en %', current_user;
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '@@VERSION@@' and name = 'cegep_lot_b3_filtres') then
    raise exception 'NEXUS: lot B3 @@VERSION@@ non inscrit — rien à défaire';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'ROLLBACK_B3_FILTRES') then
    raise exception 'NEXUS: le lot B3 a déjà été retiré';
  end if;
end $$;

-- Comptes sondés : tous les recruteurs et tous les partenaires admis.
create temp table _c on commit drop as
select u.id as uid, case when u.role = 'RECRUTEUR'::public.user_role then 'R' else 'P' end as genre,
       public.unite_voit_cegepiens(u.school_id) as voit_cegepiens
  from public.users u
 where u.role = 'RECRUTEUR'::public.user_role
    or (u.role = 'PARTNER'::public.user_role
        and exists (select 1 from public.media_partners mp where mp.user_id = u.id and mp.status = 'APPROVED'));
create temp table _cg on commit drop as
select a.id from public.athletes a where a.status = 'ACTIF' and public.athlete_est_cegepien(a.id);
create temp table _ath on commit drop as
select array_agg(a.id order by a.id) as ids from public.athletes a where a.status = 'ACTIF';

-- Relevé, par compte : les colonnes d'AVANT (ligne JSON moins les colonnes ajoutées) et les cégépiens rendus.
create function pg_temp.releve(p_uid uuid, p_genre text)
returns text
language plpgsql
as $$
declare v text;
  -- Lus AVANT de changer de rôle : _ath et _cg sont des tables temporaires de postgres.
  ids uuid[] := (select ids from _ath);
  cg uuid[] := (select coalesce(array_agg(id), '{}') from _cg);
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    if p_genre = 'R' then
      select 'recherche=' || count(*) || '/' || md5(coalesce(string_agg((to_jsonb(r) - 'team_age_group')::text, '|' order by r.id), ''))
             || '/' || count(*) filter (where r.id = any(cg))
             || ';cartes=' || (select count(*) || '/' || md5(coalesce(string_agg((to_jsonb(c) - 'team_school_type' - 'team_age_group')::text, '|' order by c.id), ''))
                                      || '/' || count(*) filter (where c.id = any(cg))
                                 from public.recruiter_athlete_cards(ids) c)
        into v from public.recruiter_search_athletes() r;
    else
      select 'top=' || count(*) || '/' || md5(coalesce(string_agg((to_jsonb(t) - 'school_type' - 'team_school_type' - 'team_age_group')::text, '|' order by t.id), ''))
             || ';tendances=' || (select count(*) || '/' || md5(coalesce(string_agg((to_jsonb(d) - 'school_type' - 'team_school_type' - 'team_age_group')::text, '|' order by d.id), ''))
                                    from public.trending_athletes_view d)
        into v from public.top_athletes_view t;
    end if;
    raise exception using errcode = 'NX000', message = coalesce(v, '·');
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refus=' || sqlstate || ' ' || left(sqlerrm, 120);
  end;
end $$;

create temp table _r on commit drop as
select c.uid, c.genre, c.voit_cegepiens, pg_temp.releve(c.uid, c.genre) as avant, null::text as apres from _c c;
do $$
begin
  if exists (select 1 from _r where avant like 'refus=%') then
    raise exception 'NEXUS: un relevé AVANT a été refusé : %', (select avant from _r where avant like 'refus=%' limit 1);
  end if;
end $$;
select genre, count(*) as comptes from _r group by genre order by genre;

-- ── 1. Le rollback, texte gardé par son md5 ─────────────────────────────────
create temp table _rb on commit drop as
select to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDDHH24MISS') as version,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as contenu;

select clock_timestamp() as debut_rollback;
do $rb$
begin
  if (select md5(contenu) from _rb) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(contenu) from _rb);
  end if;
  if (select version from _rb) <= '@@VERSION@@' then
    raise exception 'NEXUS: version du rollback pas après @@VERSION@@';
  end if;
  execute (select contenu from _rb);
end $rb$;
select clock_timestamp() as fin_rollback;
set local search_path = public, extensions;

-- ── 2. Gardes APRÈS : colonnes d'avant identiques pour chaque compte, aucun cégépien rendu ───
update _r set apres = pg_temp.releve(uid, genre);
do $$
declare n int;
begin
  select count(*) into n from _r where apres is distinct from avant;
  if n <> 0 then
    raise exception 'NEXUS: % compte(s) voient des colonnes d''avant différentes après le rollback', n;
  end if;
  select count(*) into n from _r
   where genre = 'R' and not voit_cegepiens
     and (split_part(split_part(apres, ';', 1), '/', 3) <> '0' or split_part(split_part(apres, ';', 2), '/', 3) <> '0');
  if n <> 0 then
    raise exception 'NEXUS: % recruteur(s) collégial(aux) reçoivent un cégépien', n;
  end if;
end $$;
select genre, count(*) as comptes, count(*) filter (where apres = avant) as identiques from _r group by genre order by genre;

-- ── 3. Inscription ───────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'rollback_cegep_lot_b3_filtres', array[contenu], 'bptds22@gmail.com' from _rb;

insert into public.admin_operations (operation, motif, details, par)
select 'ROLLBACK_B3_FILTRES',
       'Rollback du lot B3 cégep (@@VERSION@@) : les 3 fonctions recruteur et les 2 vues partenaire reprennent leur définition prod du 2026-10-26 (GO BP)',
       jsonb_build_object('version_retiree', '@@VERSION@@', 'version_rollback', version,
                          'fichier', 'supabase/rollback/@@VERSION@@_rollback_cegep_lot_b3_filtres.sql',
                          'md5_rollback', '@@MD5_ROLLBACK@@', 'comptes_verifies', (select count(*) from _r),
                          'voie', 'psql (session pooler)'),
       'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'
  from _rb;

do $$
begin
  if (select count(*) from public.admin_operations where operation = 'ROLLBACK_B3_FILTRES') <> 1 then
    raise exception 'NEXUS: ligne admin_operations ROLLBACK_B3_FILTRES absente ou en double';
  end if;
end $$;

select version as version_rollback, (select count(*) from _r) as comptes_verifies, clock_timestamp() as avant_commit from _rb;
commit;
\echo '== COMMIT fait : B3 retiré de la prod.'
