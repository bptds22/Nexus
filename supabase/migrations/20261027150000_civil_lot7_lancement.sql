-- 20261027150000_civil_lot7_lancement
--
-- NON APPLIQUÉE EN PROD. Import civil soccer / futsal / basket 2026-27, LOT 7 : l'interrupteur
-- de lancement et le verrou en base (décisions BP 2026-10-27, points 1 et 3).
-- Rollback : supabase/rollback/20261027150000_rollback_civil_lot7_lancement.sql
-- Plan des lots : docs/civil-2026/LISEZMOI.md
--
-- ── POURQUOI ─────────────────────────────────────────────────────────────────
-- Les lots 3 à 5 (équipes et matchs importés) partent en prod le jour du lancement, juste
-- avant de passer l'interrupteur à ON (décision 4, pas de masque RLS). Entre les deux, et à
-- tout moment où l'interrupteur serait remis à OFF, personne ne doit pouvoir rejoindre une
-- équipe importée, quel que soit le chemin (onboarding web ou mobile, code d'adhésion,
-- invitation, ajout par un coach, transfert, PATCH direct).
--
-- ── CE QUE FAIT LE LOT ───────────────────────────────────────────────────────
--   1. app_settings « lancement_civil » = 'false' (BOOLEAN). Lu par le web via
--      lib/config/lancementCivil.ts (OFF si absent ou en erreur), éditable dans /admin/settings.
--   2. lancement_civil_actif() : vrai seulement si la valeur vaut 'true' (casse et espaces
--      ignorés). Absente, vide ou illisible → faux.
--   3. verrou_lancement_civil() : trigger BEFORE sur team_athletes et team_coaches
--      (INSERT, UPDATE OF team_id). Refuse d'y FAIRE ENTRER une équipe importée (une ligne dans
--      equipes_sources) tant que l'interrupteur est OFF. Une ligne existante qui ne change pas
--      d'équipe passe telle quelle ; une équipe créée dans l'appli n'est jamais concernée.
--
-- Aucune policy, aucune table, aucune colonne ne change.

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $garde$
begin
  if exists (select 1 from public.app_settings where key = 'lancement_civil') then
    raise exception 'NEXUS: app_settings lancement_civil existe déjà';
  end if;
  if to_regprocedure('public.lancement_civil_actif()') is not null
     or to_regprocedure('public.verrou_lancement_civil()') is not null then
    raise exception 'NEXUS: 20261027150000 déjà appliquée';
  end if;
  if to_regclass('public.equipes_sources') is null then
    raise exception 'NEXUS: préalable lot 1 (equipes_sources) absent';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_civil') then
    raise exception 'NEXUS: trigger trg_verrou_lancement_civil déjà présent';
  end if;
end $garde$;

-- ── 1. L'interrupteur ────────────────────────────────────────────────────────
insert into public.app_settings (key, value, type, description) values
  ('lancement_civil', 'false', 'BOOLEAN',
   'Lancement civil soccer / futsal / basket. false = équipes civiles importées impossibles à rejoindre (verrou en base) et destinations 18+ masquées dans Trouve ton cégep. Passer à true le jour du lancement, APRÈS les lots 3 à 5.');

-- ── 2. La lecture de l'interrupteur ──────────────────────────────────────────
create function public.lancement_civil_actif()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce((select lower(btrim(value)) = 'true' from public.app_settings where key = 'lancement_civil'), false);
$function$;

comment on function public.lancement_civil_actif() is
  'Lot 7 civil : vrai seulement si app_settings.lancement_civil vaut true. Absente ou illisible → faux.';

-- ── 3. Le verrou ─────────────────────────────────────────────────────────────
create function public.verrou_lancement_civil()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Seule l'écriture qui FAIT ENTRER dans une équipe est regardée.
  if tg_op = 'UPDATE' and old.team_id is not distinct from new.team_id then
    return new;
  end if;
  if new.team_id is not null
     and exists (select 1 from public.equipes_sources e where e.team_id = new.team_id)
     and not public.lancement_civil_actif() then
    raise exception 'NEXUS: Cette équipe sera ouverte au lancement des ligues civiles sur Nexus. Réessaie bientôt.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

comment on function public.verrou_lancement_civil() is
  'Lot 7 civil : refuse de rejoindre une équipe importée (equipes_sources) tant que lancement_civil est OFF. Trigger BEFORE sur team_athletes et team_coaches.';

create trigger trg_verrou_lancement_civil
  before insert or update of team_id on public.team_athletes
  for each row execute function public.verrou_lancement_civil();
create trigger trg_verrou_lancement_civil
  before insert or update of team_id on public.team_coaches
  for each row execute function public.verrou_lancement_civil();

revoke all on function public.lancement_civil_actif() from public, anon;
grant execute on function public.lancement_civil_actif() to authenticated, service_role;
revoke all on function public.verrou_lancement_civil() from public, anon, authenticated;
grant execute on function public.verrou_lancement_civil() to service_role;

-- ── GARDES D'APRÈS ───────────────────────────────────────────────────────────
do $garde$
declare
  r    record;
  vus  text[];
begin
  if (select value || '|' || type from public.app_settings where key = 'lancement_civil') is distinct from 'false|BOOLEAN' then
    raise exception 'NEXUS: lancement_civil inattendu';
  end if;
  if public.lancement_civil_actif() then
    raise exception 'NEXUS: l''interrupteur lit ON après l''insertion';
  end if;
  -- ACL : liste COMPLÈTE triée des bénéficiaires, jamais par inclusion
  for r in select * from (values
      ('public.lancement_civil_actif()',  array['authenticated', 'postgres', 'service_role']),
      ('public.verrou_lancement_civil()', array['postgres', 'service_role'])) as t(sig, acl) loop
    select array_agg(distinct g order by g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) a
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.acl then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.sig, vus, r.acl;
    end if;
  end loop;
  if (select count(*) from pg_trigger where tgname = 'trg_verrou_lancement_civil' and tgenabled = 'O'
         and tgrelid in ('public.team_athletes'::regclass, 'public.team_coaches'::regclass)) <> 2 then
    raise exception 'NEXUS: les deux triggers du verrou ne sont pas en place';
  end if;
  raise notice 'NEXUS: lot 7 civil — interrupteur OFF, verrou en place (% équipes importées verrouillées)',
    (select count(distinct team_id) from public.equipes_sources);
end $garde$;
