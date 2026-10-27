-- 20261027210000_cegep_lot_c0_base
--
-- NON APPLIQUÉE EN PROD. Chantier cégep, LOT C0 (base seulement, GO BP 2026-10-27) : avant d'ouvrir
-- l'inscription des cégépiens, fermer les écritures d'un recruteur collégial vers un cégépien, et
-- poser l'interrupteur « lancement_collegial » avec son verrou.
-- Rollback : supabase/rollback/20261027210000_rollback_cegep_lot_c0_base.sql
--
-- ── RÈGLE BP (2026-10-27) ────────────────────────────────────────────────────
-- Un recruteur collégial ne peut NI mettre un cégépien en favori, NI dans son pipeline, NI lui écrire
-- ou ouvrir un fil à son sujet. C'est la règle de lecture du lot A (20261026030400), appliquée aux
-- écritures : un compte RECRUTEUR dont l'école ne voit pas les cégépiens (unite_voit_cegepiens : seul
-- un futur type UNIVERSITE les voit) ne touche à aucun athlète ancré à un cégep. Admin, partenaires,
-- coachs, athlètes et parents : inchangés.
-- Exception future (NON implémentée ici, et rien ne l'empêche) : le « coach collégial » écrira à SES
-- joueurs par le lien coach ↔ équipe (team_coaches), dans des fils SANS recruteur (ATHLETE_COACH) —
-- ces fils ne sont pas touchés par ce lot.
--
-- ── FAILLES FERMÉES (diagnostic lot C, 2026-10-27, policies prod relues) ─────
--   A. conversations_insert (RECRUTEUR_COACH) ne regarde ni l'athlète ni le coach ;
--   B. recruiter_favorites_insert et recruiter_pipeline_insert n'ont aucun garde : un favori par UUID
--      ouvre le fil direct RECRUTEUR_ATHLETE (qui n'exige qu'un favori + is_athlete_contactable) ;
--   C. les avis qui suivent (notify_athlete_favorited, notify_parent_favorited, fav_insert_to_pipeline,
--      notify_first_recruiter_contact, aviser_parent_contact_recruteur → courriel au parent) partaient
--      sans filtre. Ce sont des déclencheurs AFTER INSERT : l'écriture refusée, rien ne part.
-- Relevé prod avant (2026-10-27) : 25 recruteurs collégiaux, 1 cégépien ; 0 favori, 0 pipeline,
-- 0 fil, 0 message entre eux. Rien n'est effacé (nettoyage de l'été, D5 du lot A).
--
-- ── CONTENU ──────────────────────────────────────────────────────────────────
--   1. compte_voit_cegepiens(uuid) : la règle du lot A (« NOT is_recruiter() OR peut_voir_cegepiens() »)
--      appliquée à un COMPTE donné et non à l'appelant — un fil RECRUTEUR_COACH peut être ouvert par le
--      coach : c'est le recruteur DU FIL qui compte. Vrai pour tout compte qui n'est pas RECRUTEUR.
--   2. Policies RESTRICTIVE « cegepiens_ecriture_recruteurs », FOR INSERT TO authenticated, sur
--      recruiter_favorites, recruiter_pipeline (recruiter_id, athlete_id) et conversations
--      (recruiter_id, athlete_id ; un fil sans recruteur ou sans athlète passe). TO authenticated et
--      jamais TO public (piège du lot A : EXECUTE vérifié à l'initialisation, anon refusé).
--   3. is_athlete_contactable(uuid) rebasée sur le corps prod (garde md5) : faux pour un recruteur
--      collégial face à un cégépien. Même signature, même ACL. Sert la policy du fil direct et
--      aviser_parent_contact_recruteur (qui n'avise alors personne).
--   4. app_settings « lancement_collegial » = 'false' (BOOLEAN) et lancement_collegial_actif() :
--      vrai seulement pour « true » (casse et espaces ignorés) ; absente ou illisible → faux.
--   5. verrou_lancement_collegial() : trigger BEFORE sur athletes (INSERT, UPDATE OF school_id) et
--      team_athletes (INSERT, UPDATE OF team_id). Tant que l'interrupteur est OFF, refuse un NOUVEL
--      ancrage à une école CEGEP et un NOUVEAU rattachement à une équipe de cégep. Une ligne qui ne
--      change pas d'école ni d'équipe passe telle quelle (le cégépien déjà ancré n'est pas touché).
-- Aucune table, aucune colonne ; aucune policy existante modifiée.

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $garde$
begin
  if to_regprocedure('public.compte_voit_cegepiens(uuid)') is not null
     or to_regprocedure('public.lancement_collegial_actif()') is not null
     or to_regprocedure('public.verrou_lancement_collegial()') is not null
     or exists (select 1 from public.app_settings where key = 'lancement_collegial')
     or exists (select 1 from pg_policies where policyname = 'cegepiens_ecriture_recruteurs') then
    raise exception 'NEXUS: 20261027210000 déjà appliquée';
  end if;
  if to_regprocedure('public.athlete_est_cegepien(uuid)') is null
     or to_regprocedure('public.unite_voit_cegepiens(uuid)') is null
     or to_regprocedure('public.peut_voir_cegepiens()') is null then
    raise exception 'NEXUS: préalable lot A (fonctions-règles cégépiens) absent';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.is_athlete_contactable(uuid)'::regprocedure)
     is distinct from 'fe2ea3e93c6ed4036d249b7d406d3e56' then
    raise exception 'NEXUS: is_athlete_contactable n''est pas le corps prod relevé le 2026-10-27';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_collegial') then
    raise exception 'NEXUS: trigger trg_verrou_lancement_collegial déjà présent';
  end if;
end $garde$;

-- ── 1. La règle, sur un compte ───────────────────────────────────────────────
create function public.compte_voit_cegepiens(p_compte uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $function$
  -- Même règle que la lecture du lot A (« NOT is_recruiter() OR peut_voir_cegepiens() »), sur
  -- p_compte au lieu de auth.uid() : faux seulement pour un RECRUTEUR dont l'école ne voit pas les
  -- cégépiens. Compte inconnu ou NULL → vrai (aucune règle à appliquer).
  select not exists (
    select 1 from public.users u
     where u.id = p_compte
       and u.role = 'RECRUTEUR'::public.user_role
       and not public.unite_voit_cegepiens(u.school_id)
  );
$function$;

comment on function public.compte_voit_cegepiens(uuid) is
  'Lot C0 cégep : faux seulement pour un RECRUTEUR dont l''école ne voit pas les cégépiens (règle du lot A, appliquée à un compte donné).';

-- ── 2. Les écritures fermées ─────────────────────────────────────────────────
create policy cegepiens_ecriture_recruteurs on public.recruiter_favorites
  as restrictive for insert to authenticated
  with check (public.compte_voit_cegepiens(recruiter_id) or not public.athlete_est_cegepien(athlete_id));

create policy cegepiens_ecriture_recruteurs on public.recruiter_pipeline
  as restrictive for insert to authenticated
  with check (public.compte_voit_cegepiens(recruiter_id) or not public.athlete_est_cegepien(athlete_id));

create policy cegepiens_ecriture_recruteurs on public.conversations
  as restrictive for insert to authenticated
  with check (recruiter_id is null or athlete_id is null
              or public.compte_voit_cegepiens(recruiter_id) or not public.athlete_est_cegepien(athlete_id));

-- ── 3. is_athlete_contactable (corps prod + la règle) ────────────────────────
create or replace function public.is_athlete_contactable(p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select not public.is_messaging_blacked_out(p_athlete)
     -- Lot C0 cégep : un recruteur collégial ne contacte pas un cégépien.
     and (public.compte_voit_cegepiens(auth.uid()) or not public.athlete_est_cegepien(p_athlete));
$function$;

-- ── 4. L'interrupteur ────────────────────────────────────────────────────────
insert into public.app_settings (key, value, type, description) values
  ('lancement_collegial', 'false', 'BOOLEAN',
   'Lancement collégial (inscription des cégépiens). false = aucun nouvel ancrage à un cégep ni rattachement à une équipe de cégep (verrou en base). Passer à true seulement après la publication de la 1.4.6.');

create function public.lancement_collegial_actif()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce((select lower(btrim(value)) = 'true' from public.app_settings where key = 'lancement_collegial'), false);
$function$;

comment on function public.lancement_collegial_actif() is
  'Lot C0 cégep : vrai seulement si app_settings.lancement_collegial vaut true. Absente ou illisible → faux.';

-- ── 5. Le verrou ─────────────────────────────────────────────────────────────
create function public.verrou_lancement_collegial()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_table_name = 'athletes' then
    -- Seul un NOUVEL ancrage est regardé : une ligne qui garde son école passe.
    if new.school_id is null
       or (tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id) then
      return new;
    end if;
    if exists (select 1 from public.schools s where s.id = new.school_id and s.type::text = 'CEGEP')
       and not public.lancement_collegial_actif() then
      raise exception 'NEXUS: Les cégeps ne sont pas encore ouverts sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
  else
    if new.team_id is null
       or (tg_op = 'UPDATE' and old.team_id is not distinct from new.team_id) then
      return new;
    end if;
    if exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                where t.id = new.team_id and s.type::text = 'CEGEP')
       and not public.lancement_collegial_actif() then
      raise exception 'NEXUS: Les cégeps ne sont pas encore ouverts sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

comment on function public.verrou_lancement_collegial() is
  'Lot C0 cégep : refuse un nouvel ancrage à un cégep (athletes.school_id) et un nouveau rattachement à une équipe de cégep (team_athletes) tant que lancement_collegial est OFF.';

create trigger trg_verrou_lancement_collegial
  before insert or update of school_id on public.athletes
  for each row execute function public.verrou_lancement_collegial();
create trigger trg_verrou_lancement_collegial
  before insert or update of team_id on public.team_athletes
  for each row execute function public.verrou_lancement_collegial();

revoke all on function public.compte_voit_cegepiens(uuid) from public, anon;
grant execute on function public.compte_voit_cegepiens(uuid) to authenticated, service_role;
revoke all on function public.lancement_collegial_actif() from public, anon;
grant execute on function public.lancement_collegial_actif() to authenticated, service_role;
revoke all on function public.verrou_lancement_collegial() from public, anon, authenticated;
grant execute on function public.verrou_lancement_collegial() to service_role;

-- ── GARDES D'APRÈS ───────────────────────────────────────────────────────────
do $garde$
declare
  r    record;
  vus  text[];
begin
  if (select value || '|' || type from public.app_settings where key = 'lancement_collegial') is distinct from 'false|BOOLEAN' then
    raise exception 'NEXUS: lancement_collegial inattendu';
  end if;
  if public.lancement_collegial_actif() then
    raise exception 'NEXUS: l''interrupteur lit ON après l''insertion';
  end if;
  -- ACL : liste COMPLÈTE triée des bénéficiaires, jamais par inclusion
  for r in select * from (values
      ('public.compte_voit_cegepiens(uuid)',  array['authenticated', 'postgres', 'service_role']),
      ('public.is_athlete_contactable(uuid)', array['authenticated', 'postgres', 'service_role']),
      ('public.lancement_collegial_actif()',  array['authenticated', 'postgres', 'service_role']),
      ('public.verrou_lancement_collegial()', array['postgres', 'service_role'])) as t(sig, acl) loop
    select array_agg(distinct g order by g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) a
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.acl then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.sig, vus, r.acl;
    end if;
  end loop;
  if (select count(*) from pg_policies where policyname = 'cegepiens_ecriture_recruteurs'
         and permissive = 'RESTRICTIVE' and cmd = 'INSERT' and roles::text = '{authenticated}'
         and tablename in ('recruiter_favorites', 'recruiter_pipeline', 'conversations')) <> 3 then
    raise exception 'NEXUS: les 3 policies RESTRICTIVE ne sont pas en place';
  end if;
  if (select count(*) from pg_trigger where tgname = 'trg_verrou_lancement_collegial' and tgenabled = 'O'
         and tgrelid in ('public.athletes'::regclass, 'public.team_athletes'::regclass)) <> 2 then
    raise exception 'NEXUS: les deux triggers du verrou ne sont pas en place';
  end if;
  raise notice 'NEXUS: lot C0 cégep — écritures recruteur collégial → cégépien fermées, interrupteur OFF, verrou en place';
end $garde$;
