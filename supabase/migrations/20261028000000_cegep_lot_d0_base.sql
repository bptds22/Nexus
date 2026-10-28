-- NON APPLIQUÉE EN PROD. Chantier cégep, LOT D0 (GO BP 2026-10-27) : la base des universités, porte fermée.
--
--   1. schools.type accepte 'UNIVERSITE' (CHECK schools_type_check refait) ; aucune école créée ici (lot D1,
--      GO séparé).
--   2. schools.province : code de province canadienne (décision 1 : toutes les universités U SPORTS, avec leur
--      province). NOT NULL DEFAULT 'QC' — toutes les écoles actuelles sont québécoises ; une valeur par défaut
--      constante n'écrit aucune ligne (métadonnée seulement).
--   3. users.context accepte 'universitaire' (recruteur universitaire, lot D2).
--   4. rseq_watch_leagues.secteur accepte 'Universitaire' (suivi du secteur au lot D1).
--   5. Interrupteur app_settings « lancement_universitaire » = 'false' et lancement_universitaire_actif().
--   6. verrou_universites() :
--      · athletes (INSERT, UPDATE OF school_id) et team_athletes (INSERT, UPDATE OF team_id) : aucune fiche
--        athlète ne s'ancre à une université ni à une équipe universitaire — TOUJOURS, admin compris
--        (décision 7 : Nexus s'arrête au cégep).
--      · users (INSERT, UPDATE OF school_id, context, role) : un compte n'entre dans une UNIVERSITE ou dans le
--        contexte 'universitaire' que s'il est RECRUTEUR et que l'interrupteur est ON. Admin
--        (is_admin()) et appels sans session (auth.uid() NULL : service, import, postgres) passent.
--        Les coachs étaient déjà tenus dehors par porte_coach_cegep / ecole_ouverte_aux_coachs.
--      Seule l'écriture qui FAIT ENTRER dans l'état visé est regardée : une ligne qui garde ses valeurs passe.
-- Aucune ligne existante modifiée ; aucune policy ; lot A / C0 inchangés (unite_voit_cegepiens reconnaît déjà
-- UNIVERSITE ; le masquage du secondaire pour le recruteur universitaire est le lot D3).

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $garde$
begin
  if to_regprocedure('public.lancement_universitaire_actif()') is not null
     or to_regprocedure('public.verrou_universites()') is not null
     or exists (select 1 from public.app_settings where key = 'lancement_universitaire')
     or exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'schools' and column_name = 'province') then
    raise exception 'NEXUS: 20261028000000 déjà appliquée (en tout ou en partie)';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.schools'::regclass and conname = 'schools_type_check')
     is distinct from 'CHECK ((type = ANY (ARRAY[''SECONDAIRE''::text, ''CEGEP''::text, ''LIGUE_CIVILE''::text])))' then
    raise exception 'NEXUS: schools_type_check n''est pas celle relevée le 2026-10-27';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.users'::regclass and conname = 'users_context_check')
     is distinct from 'CHECK ((context = ANY (ARRAY[''scolaire''::text, ''collegial''::text, ''ligue_civile''::text])))' then
    raise exception 'NEXUS: users_context_check n''est pas celle relevée le 2026-10-27';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.rseq_watch_leagues'::regclass and conname = 'rseq_watch_leagues_secteur_chk')
     is distinct from 'CHECK ((secteur = ANY (ARRAY[''Collégial''::text, ''Secondaire''::text])))' then
    raise exception 'NEXUS: rseq_watch_leagues_secteur_chk n''est pas celle relevée le 2026-10-27';
  end if;
  if exists (select 1 from public.schools where type not in ('SECONDAIRE', 'CEGEP', 'LIGUE_CIVILE')) then
    raise exception 'NEXUS: une école d''un type inattendu existe déjà';
  end if;
end $garde$;

-- ── 1 à 4. Les types ─────────────────────────────────────────────────────────
alter table public.schools drop constraint schools_type_check;
alter table public.schools add constraint schools_type_check
  check (type = any (array['SECONDAIRE'::text, 'CEGEP'::text, 'LIGUE_CIVILE'::text, 'UNIVERSITE'::text]));

alter table public.schools add column province text not null default 'QC'
  constraint schools_province_check
  check (province = any (array['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']));
comment on column public.schools.province is
  'Lot D0 cégep : code de province canadienne (QC par défaut). Sert aux universités U SPORTS hors Québec (lot D1b).';

alter table public.users drop constraint users_context_check;
alter table public.users add constraint users_context_check
  check (context = any (array['scolaire'::text, 'collegial'::text, 'ligue_civile'::text, 'universitaire'::text]));

alter table public.rseq_watch_leagues drop constraint rseq_watch_leagues_secteur_chk;
alter table public.rseq_watch_leagues add constraint rseq_watch_leagues_secteur_chk
  check (secteur = any (array['Collégial'::text, 'Secondaire'::text, 'Universitaire'::text]));

-- ── 5. L'interrupteur ────────────────────────────────────────────────────────
insert into public.app_settings (key, value, type, description) values
  ('lancement_universitaire', 'false', 'BOOLEAN',
   'Lancement universitaire (recruteurs universitaires). false = aucun compte ne se rattache à une université ni ne prend le contexte universitaire, sauf admin (verrou en base). Passer à true seulement après la publication de la 1.4.6.');

create function public.lancement_universitaire_actif()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce((select lower(btrim(value)) = 'true' from public.app_settings where key = 'lancement_universitaire'), false);
$function$;

comment on function public.lancement_universitaire_actif() is
  'Lot D0 cégep : vrai seulement si app_settings.lancement_universitaire vaut true. Absente ou illisible → faux.';

-- ── 6. Le verrou ─────────────────────────────────────────────────────────────
create function public.verrou_universites()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_univ boolean;
begin
  if tg_table_name = 'athletes' then
    if new.school_id is null
       or (tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id) then
      return new;
    end if;
    if exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Une fiche athlète ne peut pas être rattachée à une université.'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'team_athletes' then
    if new.team_id is null
       or (tg_op = 'UPDATE' and old.team_id is not distinct from new.team_id) then
      return new;
    end if;
    if exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                where t.id = new.team_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Une fiche athlète ne peut pas être rattachée à une équipe universitaire.'
        using errcode = '42501';
    end if;
  else
    -- users : seule l'entrée dans une université ou dans le contexte universitaire est regardée.
    if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id
       and old.context is not distinct from new.context and old.role is not distinct from new.role then
      return new;
    end if;
    v_univ := new.school_id is not null
              and exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE');
    if not v_univ and new.context is distinct from 'universitaire' then
      return new;
    end if;
    if auth.uid() is null or public.is_admin() then
      return new;
    end if;
    if new.role is distinct from 'RECRUTEUR'::public.user_role then
      raise exception 'NEXUS: Seul un recruteur universitaire peut être rattaché à une université.'
        using errcode = '42501';
    end if;
    if not public.lancement_universitaire_actif() then
      raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

comment on function public.verrou_universites() is
  'Lot D0 cégep : aucune fiche athlète ancrée à une université (athletes, team_athletes) ; un compte n''entre dans une université ou le contexte universitaire que RECRUTEUR et sous lancement_universitaire ON (admin et service exemptés).';

create trigger trg_verrou_universites
  before insert or update of school_id on public.athletes
  for each row execute function public.verrou_universites();
create trigger trg_verrou_universites
  before insert or update of team_id on public.team_athletes
  for each row execute function public.verrou_universites();
create trigger trg_verrou_universites
  before insert or update of school_id, context, role on public.users
  for each row execute function public.verrou_universites();

revoke all on function public.lancement_universitaire_actif() from public, anon;
grant execute on function public.lancement_universitaire_actif() to authenticated, service_role;
revoke all on function public.verrou_universites() from public, anon, authenticated;
grant execute on function public.verrou_universites() to service_role;

-- ── GARDES D'APRÈS ───────────────────────────────────────────────────────────
do $garde$
declare
  r    record;
  vus  text[];
begin
  if (select value || '|' || type from public.app_settings where key = 'lancement_universitaire') is distinct from 'false|BOOLEAN' then
    raise exception 'NEXUS: lancement_universitaire inattendu';
  end if;
  if public.lancement_universitaire_actif() then
    raise exception 'NEXUS: l''interrupteur universitaire lit ON après l''insertion';
  end if;
  if exists (select 1 from public.schools where province is distinct from 'QC') then
    raise exception 'NEXUS: une école n''est pas QC après l''ajout de province';
  end if;
  if exists (select 1 from public.schools where type = 'UNIVERSITE') then
    raise exception 'NEXUS: une université existe après D0 (aucune ne devait être créée)';
  end if;
  for r in select * from (values
      ('public.lancement_universitaire_actif()', array['authenticated', 'postgres', 'service_role']),
      ('public.verrou_universites()',            array['postgres', 'service_role'])) as t(sig, acl) loop
    select array_agg(distinct g order by g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) a
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.acl then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.sig, vus, r.acl;
    end if;
  end loop;
  if (select count(*) from pg_trigger where tgname = 'trg_verrou_universites' and tgenabled = 'O'
         and tgrelid in ('public.athletes'::regclass, 'public.team_athletes'::regclass, 'public.users'::regclass)) <> 3 then
    raise exception 'NEXUS: les trois triggers du verrou universitaire ne sont pas en place';
  end if;
  raise notice 'NEXUS: lot D0 cégep — type UNIVERSITE, province, contexte universitaire, interrupteur OFF, verrou en place';
end $garde$;
