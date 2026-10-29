-- ════════════════════════════════════════════════════════════════════════════
-- Programme universitaire visé du cégépien (D5 Q6, décision BP 2026-10-29) — REJEU À BLANC (finit par ROLLBACK), version 20261029160000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> puv (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → empreinte des fiches AVANT → migration → empreinte APRÈS (identique : aucune fiche
-- réécrite) → essais avec un cégépien et un athlète du secondaire témoins (comptes neufs), chaque essai défait
-- aussitôt (NX000) → rollback PUV joué et vérifié → ROLLBACK. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '180s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-programme-universitaire-vise';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261029160000') then
    raise exception 'NEXUS: version 20261029160000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261029160000' then raise exception 'NEXUS: version 20261029160000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_PROGRAMME_UNIVERSITAIRE_VISE', 'ROLLBACK_PROGRAMME_UNIVERSITAIRE_VISE')) then
    raise exception 'NEXUS: ce lot a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261029150000') then
    raise exception 'NEXUS: préalable 20261029150000 (badge auto_cegep) absent';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as universitaire_on,
       public.lancement_collegial_actif() as collegial_on
  from supabase_migrations.schema_migrations;

-- ── Témoins ──────────────────────────────────────────────────────────────────
create temp table _t on commit drop as
select (select s.id from public.schools s where s.type::text = 'CEGEP' order by s.id limit 1) as cegep,
       (select s.id from public.schools s where s.type::text = 'SECONDAIRE' order by s.id limit 1) as secondaire,
       (select up.id from public.university_programs up join public.schools s on s.id = up.school_id
         where s.type::text = 'UNIVERSITE' order by up.id limit 1) as programme,
       coalesce((select l.id from public.cegep_program_labels l order by l.id limit 1), '00000000-0000-4000-8000-0000000b0c09'::uuid) as label_cegep,
       (select sp.id from public.sports sp order by sp.id limit 1) as sport,
       '00000000-0000-4000-8000-0000000b0c01'::uuid as u_cegep,
       '00000000-0000-4000-8000-0000000b0c02'::uuid as u_sec,
       public.lancement_universitaire_actif() as univ_initial,
       public.lancement_collegial_actif() as coll_initial;
alter table _t add column libelle_attendu text;
update _t set libelle_attendu = (select left(p.name || ' — ' || s.name, 200) from public.university_programs p
                                   join public.schools s on s.id = p.school_id where p.id = programme);
do $$ begin
  if exists (select 1 from _t where cegep is null or secondaire is null or programme is null or sport is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

create temp table _avant on commit drop as
select count(*) n, md5(string_agg(id::text || coalesce(profile_completion::text, '·'), ',' order by id)) empreinte
  from public.athletes;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _m on commit drop as
select '20261029160000'::text as version,
       $nexus_mig$-- ════════════════════════════════════════════════════════════════════════════
-- Programme universitaire visé du cégépien (chantier cégep, D5 Q6 — décision BP 2026-10-29).
--
-- Le cégépien (école d'ancrage CEGEP) choisit, sous lancement_universitaire ON, le programme universitaire
-- qu'il vise : un programme du catalogue (university_programs) OU un texte libre.
--
-- Données (athletes) :
--   programme_universitaire_vise_id  uuid → university_programs (on delete set null : le libellé reste)
--   programme_universitaire_vise     text — le LIBELLÉ affiché et filtré. Pour un programme du catalogue,
--                                    la base le pose elle-même (« Programme — Université ») : le recruteur
--                                    universitaire d'une autre université ne lit pas ce catalogue (D5a),
--                                    il lit ce libellé. Texte libre : espaces normalisés, 2 à 200 caractères.
-- Droits : aucune policy nouvelle. Les lignes des cégépiens ne sont lues que par l'athlète, l'admin et les
--   recruteurs dont l'unité voit les cégépiens (cegepiens_masques_recruteurs, D3) ; les recruteurs collégiaux
--   et les partenaires ne lisent pas ces lignes. La fiche partenaire ne montre aucun bloc académique.
-- Garde (trigger trg_athletes_programme_universitaire_vise, BEFORE, avant trg_profile_completion) :
--   · une NOUVELLE valeur exige lancement_universitaire ON (42501) et une école CEGEP (42501) ; un programme
--     inconnu est refusé (23503). Un retrait passe toujours (et le « set null » de la clé étrangère).
--   · un athlète qui quitte son cégep perd son programme visé.
-- Complétion : calculate_profile_completion() compte ce champ À LA PLACE du programme CÉGEP visé pour le
--   cégépien sous ON (même poids) ; règle inchangée pour tous les autres. Aucune fiche existante n'est
--   réécrite : le % se recalcule à la prochaine écriture de la fiche, comme d'habitude.
--
-- Rollback : supabase/rollback/20261029160000_rollback_programme_universitaire_vise.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'athletes'
               and column_name in ('programme_universitaire_vise', 'programme_universitaire_vise_id')) then
    raise exception 'NEXUS: 20261029160000 déjà appliquée';
  end if;
  if to_regclass('public.university_programs') is null or to_regprocedure('public.lancement_universitaire_actif()') is null then
    raise exception 'NEXUS: préalables D5a absents';
  end if;
  if to_regprocedure('nexus_prive.est_ecole_cegep(uuid)') is not null then
    raise exception 'NEXUS: nexus_prive.est_ecole_cegep existe déjà';
  end if;
end $$;
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.calculate_profile_completion()'::regprocedure)
     is distinct from '41d6dbdfd31e3f15979a2e825c194a2c' then
    raise exception 'NEXUS: calculate_profile_completion n''est pas le corps attendu';
  end if;
end $$;

alter table public.athletes
  add column programme_universitaire_vise_id uuid references public.university_programs(id) on delete set null,
  add column programme_universitaire_vise text;
alter table public.athletes
  add constraint athletes_programme_universitaire_vise_longueur
    check (programme_universitaire_vise is null or char_length(programme_universitaire_vise) between 2 and 200),
  add constraint athletes_programme_universitaire_vise_libelle
    check (programme_universitaire_vise_id is null or programme_universitaire_vise is not null);
create index athletes_programme_universitaire_vise_id_idx on public.athletes (programme_universitaire_vise_id)
  where programme_universitaire_vise_id is not null;
comment on column public.athletes.programme_universitaire_vise_id is
  'Cégépien : programme universitaire visé, choisi au catalogue (university_programs). Écrit sous lancement_universitaire ON seulement.';
comment on column public.athletes.programme_universitaire_vise is
  'Cégépien : libellé du programme universitaire visé (posé par la base pour un programme du catalogue, sinon texte libre).';

create function nexus_prive.est_ecole_cegep(p_school_id uuid)
returns boolean language sql stable security definer set search_path = public set row_security = off as $f$
  select exists (select 1 from public.schools s where s.id = p_school_id and s.type::text = 'CEGEP');
$f$;
revoke all on function nexus_prive.est_ecole_cegep(uuid) from public, anon;
grant execute on function nexus_prive.est_ecole_cegep(uuid) to authenticated, service_role;

create function public.programme_universitaire_vise_garde()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_cegep boolean := nexus_prive.est_ecole_cegep(new.school_id);
  v_nouveau boolean;
  v_libelle text;
begin
  -- Un athlète qui quitte son cégep perd son programme visé (la donnée ne vaut que pour le cégépien).
  if tg_op = 'UPDATE' and not v_cegep
     and (old.programme_universitaire_vise_id is not null or old.programme_universitaire_vise is not null)
     and new.programme_universitaire_vise_id is not distinct from old.programme_universitaire_vise_id
     and new.programme_universitaire_vise is not distinct from old.programme_universitaire_vise then
    new.programme_universitaire_vise_id := null;
    new.programme_universitaire_vise := null;
    return new;
  end if;
  -- Seule une NOUVELLE valeur est contrôlée : un retrait passe toujours.
  if tg_op = 'INSERT' then
    v_nouveau := new.programme_universitaire_vise_id is not null or new.programme_universitaire_vise is not null;
  else
    v_nouveau := (new.programme_universitaire_vise_id is not null
                    and new.programme_universitaire_vise_id is distinct from old.programme_universitaire_vise_id)
              or (new.programme_universitaire_vise is not null
                    and new.programme_universitaire_vise is distinct from old.programme_universitaire_vise);
  end if;
  if not v_nouveau then
    return new;
  end if;
  if not public.lancement_universitaire_actif() then
    raise exception using errcode = '42501', message = 'NEXUS: Le programme universitaire visé n''est pas encore ouvert.';
  end if;
  if not v_cegep then
    raise exception using errcode = '42501', message = 'NEXUS: Le programme universitaire visé est réservé aux athlètes d''un cégep.';
  end if;
  if new.programme_universitaire_vise_id is not null then
    select left(p.name || ' — ' || s.name, 200) into v_libelle
      from public.university_programs p join public.schools s on s.id = p.school_id
     where p.id = new.programme_universitaire_vise_id and s.type::text = 'UNIVERSITE';
    if v_libelle is null then
      raise exception using errcode = '23503', message = 'NEXUS: Ce programme universitaire n''existe pas.';
    end if;
    new.programme_universitaire_vise := v_libelle;
  else
    new.programme_universitaire_vise := nullif(btrim(regexp_replace(new.programme_universitaire_vise, '\s+', ' ', 'g')), '');
  end if;
  return new;
end $f$;
revoke all on function public.programme_universitaire_vise_garde() from public, anon, authenticated;
grant execute on function public.programme_universitaire_vise_garde() to service_role;

-- « trg_athletes_… » passe avant « trg_profile_completion » (ordre alphabétique des triggers BEFORE) :
-- la complétion voit la valeur normalisée.
create trigger trg_athletes_programme_universitaire_vise
  before insert or update of programme_universitaire_vise_id, programme_universitaire_vise, school_id on public.athletes
  for each row execute function public.programme_universitaire_vise_garde();

create or replace function public.calculate_profile_completion()
 returns trigger
 language plpgsql
as $function$
DECLARE
  simplified_count INTEGER := 0;
  detailed_count INTEGER := 0;
  video_bonus INTEGER := 0;
  total INTEGER;
BEGIN
  -- TIER 1: Simplified fields (12 fields = 60%)
  IF NEW.first_name IS NOT NULL AND NEW.first_name != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.last_name IS NOT NULL AND NEW.last_name != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.date_naissance IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.genre IS NOT NULL AND NEW.genre != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.annee_diplomation IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.sport_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.position_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.numero_jersey IS NOT NULL AND NEW.numero_jersey != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.school_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.taille_pieds IS NOT NULL AND NEW.taille_pieds > 0 THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.poids_lbs IS NOT NULL AND NEW.poids_lbs > 0 THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.cote_globale_entraineur IS NOT NULL AND NEW.cote_globale_entraineur > 0 THEN simplified_count := simplified_count + 1; END IF;

  -- TIER 2: Video (15%)
  IF NEW.video_faits_saillants_url IS NOT NULL AND NEW.video_faits_saillants_url != '' THEN video_bonus := 15; END IF;

  -- TIER 3: Detailed fields (10 fields = 25%)
  IF NEW.moyenne_generale IS NOT NULL AND NEW.moyenne_generale > 0 THEN detailed_count := detailed_count + 1; END IF;
  -- Programme CEGEP vise — REPLI T1 : la nouvelle colonne compte, et
  -- l'ancienne continue de compter tant qu'elle n'est pas videe (T3).
  -- Retirer la seconde branche EN MEME TEMPS que le vidage, jamais avant.
  -- Cégépien sous lancement_universitaire ON (20261029160000) : le programme UNIVERSITAIRE visé
  -- remplace le programme CÉGEP visé, que son profil ne montre plus. Sinon, règle inchangée.
  IF NEW.school_id IS NOT NULL AND public.lancement_universitaire_actif()
     AND nexus_prive.est_ecole_cegep(NEW.school_id) THEN
    IF NEW.programme_universitaire_vise IS NOT NULL AND NEW.programme_universitaire_vise != ''
    THEN detailed_count := detailed_count + 1; END IF;
  ELSIF cardinality(NEW.programmes_vises) > 0
     OR (NEW.programme_cegep_vise IS NOT NULL AND jsonb_array_length(NEW.programme_cegep_vise::jsonb) > 0)
  THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.matieres_fortes IS NOT NULL AND jsonb_array_length(NEW.matieres_fortes::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.notes_coach IS NOT NULL AND NEW.notes_coach != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.envergure IS NOT NULL AND NEW.envergure != '' THEN detailed_count := detailed_count + 1; END IF;
  IF (NEW.test_40_verges IS NOT NULL OR NEW.saut_vertical IS NOT NULL OR NEW.saut_longueur IS NOT NULL OR NEW.developpe_couche IS NOT NULL OR NEW.navette_agilite IS NOT NULL OR NEW.sprint_100m IS NOT NULL) THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.bio IS NOT NULL AND NEW.bio != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.mentions_academiques IS NOT NULL AND jsonb_array_length(NEW.mentions_academiques::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.regions_cegep_preferees IS NOT NULL AND jsonb_array_length(NEW.regions_cegep_preferees::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;

  total := ROUND((simplified_count::NUMERIC / 12) * 60) + video_bonus + ROUND((detailed_count::NUMERIC / 10) * 25);
  IF total > 100 THEN total := 100; END IF;

  NEW.profile_completion := total;

  -- (Removed in Phase A 2026-05-04: auto-verify block that flipped
  --  NEW.verified := TRUE / NEW.verification_method := 'auto' /
  --  NEW.verified_at := NOW() when total >= 60. Verification is now
  --  100% explicit human consent — no server-side auto-elevation.)

  RETURN NEW;
END;
$function$;
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.calculate_profile_completion()'::regprocedure)
     is distinct from '7ac5adb821b7f8b04bdf21617a008932' then
    raise exception 'NEXUS: nouveau corps de calculate_profile_completion inattendu';
  end if;
end $$;
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback de 20261029160000_programme_universitaire_vise : complétion d'origine (md5 41d6dbdfd31e3f15979a2e825c194a2c), trigger,
-- fonctions et colonnes retirés. Les programmes visés saisis entre l'apply et le rollback sont PERDUS.

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.calculate_profile_completion()'::regprocedure)
     is distinct from '7ac5adb821b7f8b04bdf21617a008932' then
    raise exception 'NEXUS: calculate_profile_completion n''est pas le corps de 20261029160000';
  end if;
end $$;

create or replace function public.calculate_profile_completion()
 returns trigger
 language plpgsql
as $function$
DECLARE
  simplified_count INTEGER := 0;
  detailed_count INTEGER := 0;
  video_bonus INTEGER := 0;
  total INTEGER;
BEGIN
  -- TIER 1: Simplified fields (12 fields = 60%)
  IF NEW.first_name IS NOT NULL AND NEW.first_name != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.last_name IS NOT NULL AND NEW.last_name != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.date_naissance IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.genre IS NOT NULL AND NEW.genre != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.annee_diplomation IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.sport_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.position_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.numero_jersey IS NOT NULL AND NEW.numero_jersey != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.school_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.taille_pieds IS NOT NULL AND NEW.taille_pieds > 0 THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.poids_lbs IS NOT NULL AND NEW.poids_lbs > 0 THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.cote_globale_entraineur IS NOT NULL AND NEW.cote_globale_entraineur > 0 THEN simplified_count := simplified_count + 1; END IF;

  -- TIER 2: Video (15%)
  IF NEW.video_faits_saillants_url IS NOT NULL AND NEW.video_faits_saillants_url != '' THEN video_bonus := 15; END IF;

  -- TIER 3: Detailed fields (10 fields = 25%)
  IF NEW.moyenne_generale IS NOT NULL AND NEW.moyenne_generale > 0 THEN detailed_count := detailed_count + 1; END IF;
  -- Programme CEGEP vise — REPLI T1 : la nouvelle colonne compte, et
  -- l'ancienne continue de compter tant qu'elle n'est pas videe (T3).
  -- Retirer la seconde branche EN MEME TEMPS que le vidage, jamais avant.
  IF cardinality(NEW.programmes_vises) > 0
     OR (NEW.programme_cegep_vise IS NOT NULL AND jsonb_array_length(NEW.programme_cegep_vise::jsonb) > 0)
  THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.matieres_fortes IS NOT NULL AND jsonb_array_length(NEW.matieres_fortes::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.notes_coach IS NOT NULL AND NEW.notes_coach != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.envergure IS NOT NULL AND NEW.envergure != '' THEN detailed_count := detailed_count + 1; END IF;
  IF (NEW.test_40_verges IS NOT NULL OR NEW.saut_vertical IS NOT NULL OR NEW.saut_longueur IS NOT NULL OR NEW.developpe_couche IS NOT NULL OR NEW.navette_agilite IS NOT NULL OR NEW.sprint_100m IS NOT NULL) THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.bio IS NOT NULL AND NEW.bio != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.mentions_academiques IS NOT NULL AND jsonb_array_length(NEW.mentions_academiques::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.regions_cegep_preferees IS NOT NULL AND jsonb_array_length(NEW.regions_cegep_preferees::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;

  total := ROUND((simplified_count::NUMERIC / 12) * 60) + video_bonus + ROUND((detailed_count::NUMERIC / 10) * 25);
  IF total > 100 THEN total := 100; END IF;

  NEW.profile_completion := total;

  -- (Removed in Phase A 2026-05-04: auto-verify block that flipped
  --  NEW.verified := TRUE / NEW.verification_method := 'auto' /
  --  NEW.verified_at := NOW() when total >= 60. Verification is now
  --  100% explicit human consent — no server-side auto-elevation.)

  RETURN NEW;
END;
$function$;
drop trigger trg_athletes_programme_universitaire_vise on public.athletes;
drop function public.programme_universitaire_vise_garde();
alter table public.athletes
  drop constraint athletes_programme_universitaire_vise_libelle,
  drop constraint athletes_programme_universitaire_vise_longueur,
  drop column programme_universitaire_vise,
  drop column programme_universitaire_vise_id;
drop function nexus_prive.est_ecole_cegep(uuid);
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.calculate_profile_completion()'::regprocedure)
     is distinct from '41d6dbdfd31e3f15979a2e825c194a2c' then
    raise exception 'NEXUS: corps d''origine de calculate_profile_completion non restauré';
  end if;
end $$;
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _m) <> '1952734d35c8780020e5dca5e4506355' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _m);
  end if;
  if (select md5(rollback) from _m) <> '3395bcbe25ca74eaea246351aa178f31' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _m);
  end if;
  execute (select contenu from _m);
end $apply$;
set local search_path = public, extensions;

create temp table _apres on commit drop as
select count(*) n, md5(string_agg(id::text || coalesce(profile_completion::text, '·'), ',' order by id)) empreinte,
       count(*) filter (where programme_universitaire_vise is not null or programme_universitaire_vise_id is not null) avec_programme
  from public.athletes;
select a.n as fiches_avant, p.n as fiches_apres, a.empreinte = p.empreinte as completions_identiques, p.avec_programme
  from _avant a, _apres p;

-- ── Essais (chacun défait aussitôt) ──────────────────────────────────────────
-- Prépare (en postgres) un cégépien et un athlète du secondaire témoins, puis agit EN LEUR NOM (authenticated).
create function pg_temp.essai(p_univ boolean, p_quoi text) returns text language plpgsql as $$
declare t record; v text; c0 int; c1 int; r record;
begin
  select * into t from _t;
  begin
    update public.app_settings set value = 'true' where key = 'lancement_collegial';
    update public.app_settings set value = case when p_univ then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', t.u_cegep, 'authenticated', 'authenticated', 'puv-cegep@nexus.invalid', '{}', '{}', now(), now()),
           ('00000000-0000-0000-0000-000000000000', t.u_sec, 'authenticated', 'authenticated', 'puv-sec@nexus.invalid', '{}', '{}', now(), now());
    update public.users set role = 'ATHLETE'::public.user_role, context = 'scolaire', onboarding_complete = true where id in (t.u_cegep, t.u_sec);
    insert into public.athletes (user_id, first_name, last_name, date_naissance, status, sport_id, school_id, annee_diplomation, programmes_vises)
    values (t.u_cegep, 'Témoin', 'Cégep', '2006-01-01', 'ACTIF', t.sport, t.cegep, 2027, array[t.label_cegep]),
           (t.u_sec, 'Témoin', 'Secondaire', '2008-01-01', 'ACTIF', t.sport, t.secondaire, 2027, array[t.label_cegep]);
    begin
      if p_quoi = 'cégépien choisit un programme du catalogue' then
        select profile_completion into c0 from public.athletes where user_id = t.u_cegep;
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_cegep, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise_id = t.programme, programme_universitaire_vise = 'ignoré' where user_id = t.u_cegep;
        perform set_config('role', 'postgres', true);
        select profile_completion, programme_universitaire_vise into r from public.athletes where user_id = t.u_cegep;
        v := 'libellé du catalogue ' || (r.programme_universitaire_vise = t.libelle_attendu)::text
             || ' ; complétion +' || (r.profile_completion - c0)::text;
      elsif p_quoi = 'cégépien écrit un texte libre' then
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_cegep, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise_id = null, programme_universitaire_vise = '  Médecine   vétérinaire ' where user_id = t.u_cegep;
        perform set_config('role', 'postgres', true);
        select programme_universitaire_vise into v from public.athletes where user_id = t.u_cegep;
      elsif p_quoi = 'programme inconnu' then
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_cegep, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise_id = gen_random_uuid() where user_id = t.u_cegep;
        v := 'écrit';
      elsif p_quoi = 'athlète du secondaire' then
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_sec, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise = 'Droit' where user_id = t.u_sec;
        v := 'écrit';
      elsif p_quoi = 'cégépien sous OFF' then
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_cegep, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise = 'Droit' where user_id = t.u_cegep;
        v := 'écrit';
      elsif p_quoi = 'retrait sous OFF' then
        perform set_config('role', 'postgres', true);
        update public.app_settings set value = 'true' where key = 'lancement_universitaire';
        update public.athletes set programme_universitaire_vise = 'Droit' where user_id = t.u_cegep;
        update public.app_settings set value = 'false' where key = 'lancement_universitaire';
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_cegep, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise = null where user_id = t.u_cegep;
        perform set_config('role', 'postgres', true);
        select coalesce(programme_universitaire_vise, 'vidé') into v from public.athletes where user_id = t.u_cegep;
      elsif p_quoi = 'cégépien qui quitte son cégep' then
        perform set_config('role', 'postgres', true);
        update public.athletes set programme_universitaire_vise = 'Droit' where user_id = t.u_cegep;
        update public.athletes set school_id = t.secondaire where user_id = t.u_cegep;
        select coalesce(programme_universitaire_vise, 'vidé') into v from public.athletes where user_id = t.u_cegep;
      elsif p_quoi = 'complétion du secondaire inchangée' then
        perform set_config('role', 'postgres', true);
        select profile_completion into c0 from public.athletes where user_id = t.u_sec;
        update public.athletes set programmes_vises = '{}' where user_id = t.u_sec;
        select profile_completion into c1 from public.athletes where user_id = t.u_sec;
        v := 'le programme CÉGEP visé compte ' || (c0 > c1)::text;
      end if;
    exception
      when insufficient_privilege then v := 'refusé 42501';
      when foreign_key_violation then v := 'refusé 23503';
      when check_violation then v := 'refusé 23514';
    end;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 90);
  end;
end $$;
create temp table _e on commit drop as
select o, interrupteur, geste, attendu, pg_temp.essai(interrupteur = 'ON', geste) as obtenu
  from (select x.*, row_number() over () as o from (values
    ('ON',  'cégépien choisit un programme du catalogue', 'libellé du catalogue true ; complétion +3'),
    ('ON',  'cégépien écrit un texte libre',              'Médecine vétérinaire'),
    ('ON',  'programme inconnu',                          'refusé 23503'),
    ('ON',  'athlète du secondaire',                      'refusé 42501'),
    ('OFF', 'cégépien sous OFF',                          'refusé 42501'),
    ('OFF', 'retrait sous OFF',                           'vidé'),
    ('ON',  'cégépien qui quitte son cégep',              'vidé'),
    ('ON',  'complétion du secondaire inchangée',         'le programme CÉGEP visé compte true')
  ) x(interrupteur, geste, attendu)) e;
select o, interrupteur, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?"
  from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if (select empreinte from _avant) is distinct from (select empreinte from _apres) or (select avec_programme from _apres) <> 0 then
    raise exception 'NEXUS: des fiches existantes ont bougé';
  end if;
  if public.lancement_universitaire_actif() is distinct from (select univ_initial from _t)
     or public.lancement_collegial_actif() is distinct from (select coll_initial from _t) then
    raise exception 'NEXUS: un interrupteur n''est pas revenu à son état initial';
  end if;
  if exists (select 1 from auth.users where id in (select u_cegep from _t union select u_sec from _t)) then
    raise exception 'NEXUS: compte témoin resté';
  end if;
  raise notice 'NEXUS: VERDICT programme universitaire visé — catalogue ou texte libre, ON + cégep seulement, complétion du cégépien, secondaire inchangé';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

do $rb$ begin execute (select rollback from _m); end $rb$;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'athletes'
               and column_name like 'programme_universitaire_vise%') then
    raise exception 'NEXUS: après rollback, une colonne reste';
  end if;
  raise notice 'NEXUS: rollback vérifié (colonnes, trigger et fonctions retirés, complétion d''origine par md5)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
