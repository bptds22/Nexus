-- ════════════════════════════════════════════════════════════════════════════
-- « Retiré » garde le dossier (retour BP, 18 oct. 2026)
--
-- Avant : retirer un athlète SUPPRIMAIT ses lignes du processus (unite_retirer_du_processus) et
-- retirer une carte prospect la SUPPRIMAIT. Un collègue pouvait donc le « redécouvrir » et le
-- recruter une 2e fois.
-- Maintenant : « Retiré » est une ÉTAPE (RETIRE), comme « Lettre signée », en fin de processus.
-- Le dossier reste visible à l'unité avec la RAISON du retrait et une note :
--   PAS_INTERESSE (l'athlète n'est pas intéressé), NIVEAU (pas le niveau recherché), AUTRE.
--
-- Ce qui change :
--   1. RETIRE admis par les deux listes d'étapes (recruiter_pipeline, cartes_prospect).
--   2. Table retraits_processus (raison, note, qui, quand) — accès par fonctions seulement.
--   3. unite_retirer(athlète, sport, raison, note) et carte_retirer(carte, raison, note) ;
--      unite_retraits() pour l'affichage. unite_retirer_du_processus (suppression) reste en place,
--      plus appelée par l'appli.
--   4. Ménage : un dossier qui QUITTE « Retiré » (remis dans le processus) perd sa raison.
--   5. Rien ne sort de l'unité :
--      · parents : aucune notification « Retiré » (notify_parent_pipeline_stage) ; un retour dans
--        le processus se traite comme une nouvelle entrée ;
--      · coachs : coach_pipeline_for_my_athletes ne montre pas les dossiers retirés ;
--      · athlète : recruteurs_suivant_athlete ne compte pas un recruteur qui l'a retiré.
--      · statut global de l'athlète : rang_etape('RETIRE') = 0 (inchangé) → un athlète retiré
--        partout redevient OUVERT, comme avant avec la suppression.
--   6. pipeline_stage_label_fr('RETIRE') = 'Retiré'.
--
-- Gardes : empreintes md5 des 4 fonctions remplacées (relevées en prod ET en local le 18 oct.,
-- identiques), définitions des deux contraintes, ACL complètes après.
-- Rollback : supabase/rollback/20261018140000_rollback_retrait_garde_la_carte.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  f text; attendu text; vu text;
begin
  if to_regclass('public.retraits_processus') is not null then
    raise exception 'NEXUS: 20261018140000 déjà appliquée (retraits_processus existe)';
  end if;
  for f, attendu in select * from (values
    ('notify_parent_pipeline_stage',   'cf621b667eb47a7d411c8bf604db506a'),
    ('pipeline_stage_label_fr',        '7339b0f64d5a4a83f7179bb551c7c20b'),
    ('coach_pipeline_for_my_athletes', '0b3150c2a03c7908823671a3c2f54f16'),
    ('recruteurs_suivant_athlete',     'ab50b9b850b34ee34090650ae5e9828a')) v(f, attendu)
  loop
    select md5(replace(prosrc, E'\r', '')) into vu from pg_proc
     where pronamespace = 'public'::regnamespace and proname = f;
    if vu is distinct from attendu then
      raise exception 'NEXUS: % a changé (empreinte %, attendu %) — recopier la version en place', f, vu, attendu;
    end if;
  end loop;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'chk_recruiter_pipeline_stage'))
     not like '%''LETTRE_SIGNEE''%' or pg_get_constraintdef((select oid from pg_constraint where conname = 'chk_recruiter_pipeline_stage')) like '%RETIRE%'
  or pg_get_constraintdef((select oid from pg_constraint where conname = 'cartes_prospect_etape_check'))
     not like '%''LETTRE_SIGNEE''%' or pg_get_constraintdef((select oid from pg_constraint where conname = 'cartes_prospect_etape_check')) like '%RETIRE%' then
    raise exception 'NEXUS: listes d''étapes inattendues — vérifier avant d''appliquer';
  end if;
end $$;

-- ── 1. Listes d'étapes ────────────────────────────────────────────────────
alter table public.recruiter_pipeline drop constraint chk_recruiter_pipeline_stage;
alter table public.recruiter_pipeline add constraint chk_recruiter_pipeline_stage
  check (stage::text = any (array['IDENTIFIE','CONTACTE','EN_DISCUSSION','VISITE_PLANIFIEE','ENGAGE','LETTRE_SIGNEE','RETIRE']));
alter table public.cartes_prospect drop constraint cartes_prospect_etape_check;
alter table public.cartes_prospect add constraint cartes_prospect_etape_check
  check (etape = any (array['IDENTIFIE','CONTACTE','EN_DISCUSSION','VISITE_PLANIFIEE','ENGAGE','LETTRE_SIGNEE','RETIRE']));

-- ── 2. Raison du retrait ──────────────────────────────────────────────────
create table public.retraits_processus (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid references public.athletes(id) on delete cascade,
  carte_id        uuid references public.cartes_prospect(id) on delete cascade,
  unite_cegep_id  uuid,
  unite_sport_id  uuid,
  recruiter_id    uuid references auth.users(id) on delete cascade,
  raison          text not null check (raison in ('PAS_INTERESSE', 'NIVEAU', 'AUTRE')),
  note            text check (char_length(note) <= 500),
  retire_par      uuid references auth.users(id) on delete set null,
  retire_le       timestamptz not null default now(),
  constraint retraits_une_cible check (num_nonnulls(athlete_id, carte_id) = 1),
  constraint retraits_portee check (
    (carte_id is not null and unite_cegep_id is null and unite_sport_id is null and recruiter_id is null)
    or (athlete_id is not null and unite_cegep_id is not null and unite_sport_id is not null and recruiter_id is null)
    or (athlete_id is not null and unite_cegep_id is null and unite_sport_id is null and recruiter_id is not null)
  )
);
create unique index retraits_carte on public.retraits_processus (carte_id) where carte_id is not null;
create unique index retraits_unite on public.retraits_processus (athlete_id, unite_cegep_id, unite_sport_id)
  where athlete_id is not null and unite_cegep_id is not null;
create unique index retraits_prive on public.retraits_processus (athlete_id, recruiter_id)
  where athlete_id is not null and recruiter_id is not null;
alter table public.retraits_processus enable row level security;   -- aucune policy : fonctions seulement
revoke all on public.retraits_processus from public, anon, authenticated;
comment on table public.retraits_processus is
  'Raison du retrait d''un dossier (étape RETIRE) : PAS_INTERESSE, NIVEAU, AUTRE + note. Portée de l''unité. '
  'Accès par unite_retirer() / carte_retirer() / unite_retraits() seulement.';

-- ── 3. Retirer un athlète (pour toute l'unité) ────────────────────────────
-- Écrit UNE ligne (la plus avancée, la mienne d'abord) : la synchronisation d'unité recopie l'étape
-- sur les lignes des collègues, et le journal n'a qu'une entrée signée. La date de visite et la
-- relance tombent (le dossier n'est plus actif).
create function public.unite_retirer(p_athlete_id uuid, p_sport_id uuid, p_raison text, p_note text)
returns integer
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_moi uuid := auth.uid();
  v_c uuid; v_s uuid;
  v_id uuid; v_unite uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_moi is null then raise exception 'NEXUS: authentification requise' using errcode = '42501'; end if;
  if p_raison is null or p_raison not in ('PAS_INTERESSE', 'NIVEAU', 'AUTRE') then
    raise exception 'NEXUS: choisis la raison du retrait';
  end if;
  if char_length(v_note) > 500 then raise exception 'NEXUS: note trop longue (500 caractères au plus)'; end if;
  select u.school_id, coalesce(p_sport_id, u.sport_id) into v_c, v_s from public.users u where u.id = v_moi;

  select p.id, p.unite_cegep_id into v_id, v_unite
    from public.recruiter_pipeline p
   where p.athlete_id = p_athlete_id
     and ((p.unite_cegep_id = v_c and p.unite_sport_id = v_s and public.acces_unite_pro(p.unite_cegep_id, p.unite_sport_id))
          or (p.unite_cegep_id is null and p.recruiter_id = v_moi and public.user_has_pro()))
   order by (p.recruiter_id = v_moi) desc, public.rang_etape(p.stage) desc, p.moved_at desc nulls last
   limit 1;
  if v_id is null then raise exception 'NEXUS: cet athlète n''est pas dans le processus de ton unité'; end if;

  update public.recruiter_pipeline
     set stage = 'RETIRE', moved_at = now(), visit_at = null, next_action_at = null, next_action_note = null
   where id = v_id;

  if v_unite is not null then
    insert into public.retraits_processus as r (athlete_id, unite_cegep_id, unite_sport_id, raison, note, retire_par, retire_le)
    values (p_athlete_id, v_c, v_s, p_raison, v_note, v_moi, now())
    on conflict (athlete_id, unite_cegep_id, unite_sport_id) where athlete_id is not null and unite_cegep_id is not null
    do update set raison = excluded.raison, note = excluded.note, retire_par = excluded.retire_par, retire_le = now();
  else
    insert into public.retraits_processus as r (athlete_id, recruiter_id, raison, note, retire_par, retire_le)
    values (p_athlete_id, v_moi, p_raison, v_note, v_moi, now())
    on conflict (athlete_id, recruiter_id) where athlete_id is not null and recruiter_id is not null
    do update set raison = excluded.raison, note = excluded.note, retire_par = excluded.retire_par, retire_le = now();
  end if;
  return 1;
end $$;

-- ── 4. Retirer une carte prospect (elle n'est plus supprimée) ─────────────
create function public.carte_retirer(p_carte_id uuid, p_raison text, p_note text)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then raise exception 'NEXUS: authentification requise' using errcode = '42501'; end if;
  if p_raison is null or p_raison not in ('PAS_INTERESSE', 'NIVEAU', 'AUTRE') then
    raise exception 'NEXUS: choisis la raison du retrait';
  end if;
  if char_length(v_note) > 500 then raise exception 'NEXUS: note trop longue (500 caractères au plus)'; end if;
  if not public.carte_ecriture_ok(p_carte_id) then raise exception 'NEXUS: carte hors de ton unité'; end if;
  if not exists (select 1 from public.cartes_prospect where id = p_carte_id and fusionnee_le is null) then
    raise exception 'NEXUS: carte introuvable';
  end if;

  update public.cartes_prospect
     set etape = 'RETIRE', visite_le = null, relance_le = null, relance_note = null
   where id = p_carte_id;

  insert into public.retraits_processus as r (carte_id, raison, note, retire_par, retire_le)
  values (p_carte_id, p_raison, v_note, auth.uid(), now())
  on conflict (carte_id) where carte_id is not null
  do update set raison = excluded.raison, note = excluded.note, retire_par = excluded.retire_par, retire_le = now();
end $$;

-- ── 5. Lire les raisons (affichage du processus) ──────────────────────────
create function public.unite_retraits()
returns table (athlete_id uuid, carte_id uuid, raison text, note text, retire_par uuid, retire_par_nom text, retire_le timestamptz)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select r.athlete_id, r.carte_id, r.raison, r.note, r.retire_par,
         nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), r.retire_le
    from public.retraits_processus r
    left join public.users u on u.id = r.retire_par
   where (r.unite_cegep_id is not null and public.acces_unite_pro(r.unite_cegep_id, r.unite_sport_id))
      or (r.recruiter_id = auth.uid())
      or (r.carte_id is not null and public.carte_lecture_ok(r.carte_id))
$$;

-- ── 6. Ménage : remis dans le processus (ou supprimé) → la raison tombe ───
create function public.retraits_menage_pipeline()
returns trigger language plpgsql security definer
set search_path = public
set row_security = off
as $$
begin
  if old.stage is distinct from 'RETIRE' or (tg_op = 'UPDATE' and new.stage = 'RETIRE') then
    return null;
  end if;
  if old.unite_cegep_id is not null then
    if not exists (select 1 from public.recruiter_pipeline p
                    where p.athlete_id = old.athlete_id and p.unite_cegep_id = old.unite_cegep_id
                      and p.unite_sport_id = old.unite_sport_id and p.stage = 'RETIRE') then
      delete from public.retraits_processus
       where athlete_id = old.athlete_id and unite_cegep_id = old.unite_cegep_id and unite_sport_id = old.unite_sport_id;
    end if;
  else
    delete from public.retraits_processus where athlete_id = old.athlete_id and recruiter_id = old.recruiter_id;
  end if;
  return null;
end $$;

create function public.retraits_menage_carte()
returns trigger language plpgsql security definer
set search_path = public
set row_security = off
as $$
begin
  if old.etape = 'RETIRE' and new.etape is distinct from 'RETIRE' then
    delete from public.retraits_processus where carte_id = old.id;
  end if;
  return null;
end $$;

create trigger retraits_menage after update of stage or delete on public.recruiter_pipeline
  for each row execute function public.retraits_menage_pipeline();
create trigger retraits_menage after update of etape on public.cartes_prospect
  for each row execute function public.retraits_menage_carte();

-- ── 7. Rien ne sort de l'unité ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_parent_pipeline_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_notify boolean := false;
begin
  -- Lot B1 : pas de notification pour une ligne sœur recopiée.
  if coalesce(current_setting('nexus.sync_unite', true), '') = 'on' then
    return NEW;
  end if;
  -- 2026-10-18 : un retrait (RETIRE) reste dans l'unité — jamais annoncé au parent.
  if NEW.stage = 'RETIRE' then
    return NEW;
  end if;
  if TG_OP = 'INSERT' then
    v_notify := NEW.stage is distinct from 'IDENTIFIE';
    -- Lot B1 : un collègue qui rejoint un dossier déjà à cette étape ne fait
    -- pas progresser le dossier de l'enfant.
    if v_notify and NEW.unite_cegep_id is not null and exists (
         select 1 from public.recruiter_pipeline s
          where s.unite_cegep_id = NEW.unite_cegep_id
            and s.unite_sport_id = NEW.unite_sport_id
            and s.athlete_id = NEW.athlete_id
            and s.id <> NEW.id
            and public.rang_etape(s.stage) >= public.rang_etape(NEW.stage)) then
      v_notify := false;
    end if;
  elsif TG_OP = 'UPDATE' then
    -- Retour dans le processus après un retrait : comme une nouvelle entrée.
    if OLD.stage = 'RETIRE' then
      v_notify := NEW.stage is distinct from 'IDENTIFIE';
    else
      v_notify := OLD.stage is distinct from NEW.stage;
    end if;
  end if;
  if v_notify then
    perform public.emit_parent_notification(
      NEW.athlete_id, 'CHILD_PIPELINE_STAGE', 'Progression du dossier',
      'Le dossier de votre enfant a progressé : ' || public.pipeline_stage_label_fr(NEW.stage) || '.',
      jsonb_build_object('event','stage','stage',NEW.stage,'recruiter_id',NEW.recruiter_id,'athlete_id',NEW.athlete_id)
    );
  end if;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pipeline_stage_label_fr(p_stage text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_stage
    when 'IDENTIFIE'        then 'Identifié'
    when 'CONTACTE'         then 'Contacté'
    when 'EN_DISCUSSION'    then 'En discussion'
    when 'VISITE_PLANIFIEE' then 'Visite planifiée'
    when 'ENGAGE'           then 'Engagé'
    when 'LETTRE_SIGNEE'    then 'Lettre signée'
    when 'RETIRE'           then 'Retiré'
    else coalesce(p_stage, '—')
  end;
$function$;

CREATE OR REPLACE FUNCTION public.coach_pipeline_for_my_athletes(p_athlete_ids uuid[] DEFAULT NULL::uuid[], p_stages text[] DEFAULT NULL::text[])
 RETURNS TABLE(athlete_id uuid, recruiter_id uuid, stage text, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select p.athlete_id, p.recruiter_id, p.stage::text, p.updated_at
    from public.recruiter_pipeline p
   where public.is_coach()
     -- 2026-10-18 : un dossier retiré par un cégep ne se montre pas au coach.
     and p.stage::text <> 'RETIRE'
     and (p_athlete_ids is null or p.athlete_id = any(p_athlete_ids))
     and (p_stages      is null or p.stage::text = any(p_stages))
     and (
           exists (select 1 from public.athletes a
                    where a.id = p.athlete_id and a.coach_id = auth.uid())
        or p.athlete_id in (select s.athlete_id from public.get_coach_athletes(true) s)
     );
$function$;

CREATE OR REPLACE FUNCTION public.recruteurs_suivant_athlete(p_athlete uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select count(distinct r.recruteur)::int
    from (
      select f.recruiter_id as recruteur from public.recruiter_favorites f where f.athlete_id = p_athlete
      union
      -- 2026-10-18 : un recruteur qui a RETIRÉ l'athlète ne le suit plus.
      select p.recruiter_id from public.recruiter_pipeline p where p.athlete_id = p_athlete and p.stage <> 'RETIRE'
      union
      -- Carte prospect fusionnée avec CETTE fiche (rapprochement accepté) : son auteur la suit.
      select c.cree_par
        from public.fusions_cartes fc
        join public.cartes_prospect c on c.id = fc.carte_id
       where fc.athlete_id = p_athlete and fc.etat in ('ACTIVE', 'DEFINITIVE')
      union
      select fc.acteur
        from public.fusions_cartes fc
       where fc.athlete_id = p_athlete and fc.etat in ('ACTIVE', 'DEFINITIVE')
    ) r
    join public.users u on u.id = r.recruteur
   where u.role = 'RECRUTEUR'::public.user_role
     and u.status = 'ACTIF'::public.account_status
$function$;

-- ── 8. ACL : poser, puis vérifier la liste COMPLÈTE triée (CLAUDE.md) ─────
revoke all on function public.unite_retirer(uuid, uuid, text, text)   from public, anon, authenticated;
revoke all on function public.carte_retirer(uuid, text, text)         from public, anon, authenticated;
revoke all on function public.unite_retraits()                        from public, anon, authenticated;
revoke all on function public.retraits_menage_pipeline()              from public, anon, authenticated;
revoke all on function public.retraits_menage_carte()                 from public, anon, authenticated;
grant execute on function public.unite_retirer(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.carte_retirer(uuid, text, text)       to authenticated, service_role;
grant execute on function public.unite_retraits()                      to authenticated, service_role;

do $$
declare
  f regprocedure; veut text[]; vus text[];
begin
  for f, veut in
    select * from (values
      ('public.unite_retirer(uuid,uuid,text,text)'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.carte_retirer(uuid,text,text)'::regprocedure,      array['authenticated','postgres','service_role']),
      ('public.unite_retraits()'::regprocedure,                   array['authenticated','postgres','service_role']),
      ('public.retraits_menage_pipeline()'::regprocedure,         array['postgres','service_role']),
      ('public.retraits_menage_carte()'::regprocedure,            array['postgres','service_role']),
      -- Remplacées par CREATE OR REPLACE : leur ACL d'avant doit être intacte.
      ('public.notify_parent_pipeline_stage()'::regprocedure,     array['anon','authenticated','postgres','PUBLIC','service_role']),
      ('public.pipeline_stage_label_fr(text)'::regprocedure,      array['anon','authenticated','postgres','PUBLIC','service_role']),
      ('public.coach_pipeline_for_my_athletes(uuid[],text[])'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.recruteurs_suivant_athlete(uuid)'::regprocedure,   array['postgres','service_role'])
    ) v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut; end if;
  end loop;

  select array_agg(distinct t.g order by t.g) into vus
    from pg_class c,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.retraits_processus'::regclass;
  if exists (select 1 from unnest(vus) g where g not in ('postgres','service_role')) then
    raise exception 'NEXUS: ACL retraits_processus = %', vus;
  end if;
end $$;
