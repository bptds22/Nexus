-- Rollback de 20261018140000 : « Retiré » redevient une suppression (côté base), les 4 fonctions
-- reprennent leur corps EXACT d'avant (empreintes vérifiées après), les listes d'étapes perdent RETIRE.
-- REFUSE si un dossier ou une carte est à l'étape RETIRE, ou si une raison existe : aucune donnée
-- n'est réécrite ni effacée en silence — à traiter à la main avant.
do $$
begin
  if to_regclass('public.retraits_processus') is null then
    raise exception 'NEXUS: 20261018140000 absente — rien à défaire';
  end if;
  if exists (select 1 from public.recruiter_pipeline where stage = 'RETIRE')
  or exists (select 1 from public.cartes_prospect where etape = 'RETIRE')
  or exists (select 1 from public.retraits_processus) then
    raise exception 'NEXUS: des dossiers retirés existent — rollback refusé, rien n''est touché';
  end if;
end $$;

drop trigger retraits_menage on public.recruiter_pipeline;
drop trigger retraits_menage on public.cartes_prospect;
drop function public.retraits_menage_carte();
drop function public.retraits_menage_pipeline();
drop function public.unite_retraits();
drop function public.carte_retirer(uuid, text, text);
drop function public.unite_retirer(uuid, uuid, text, text);
drop table public.retraits_processus;

alter table public.recruiter_pipeline drop constraint chk_recruiter_pipeline_stage;
alter table public.recruiter_pipeline add constraint chk_recruiter_pipeline_stage
  check (stage::text = any (array['IDENTIFIE','CONTACTE','EN_DISCUSSION','VISITE_PLANIFIEE','ENGAGE','LETTRE_SIGNEE']));
alter table public.cartes_prospect drop constraint cartes_prospect_etape_check;
alter table public.cartes_prospect add constraint cartes_prospect_etape_check
  check (etape = any (array['IDENTIFIE','CONTACTE','EN_DISCUSSION','VISITE_PLANIFIEE','ENGAGE','LETTRE_SIGNEE']));

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
    v_notify := OLD.stage is distinct from NEW.stage;
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
$function$

;

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
    else coalesce(p_stage, '—')
  end;
$function$

;

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
     and (p_athlete_ids is null or p.athlete_id = any(p_athlete_ids))
     and (p_stages      is null or p.stage::text = any(p_stages))
     and (
           exists (select 1 from public.athletes a
                    where a.id = p.athlete_id and a.coach_id = auth.uid())
        or p.athlete_id in (select s.athlete_id from public.get_coach_athletes(true) s)
     );
$function$

;

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
      select p.recruiter_id from public.recruiter_pipeline p where p.athlete_id = p_athlete
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
$function$

;

do $$
declare
  f text; attendu text; vu text;
begin
  for f, attendu in select * from (values
    ('notify_parent_pipeline_stage',   'cf621b667eb47a7d411c8bf604db506a'),
    ('pipeline_stage_label_fr',        '7339b0f64d5a4a83f7179bb551c7c20b'),
    ('coach_pipeline_for_my_athletes', '0b3150c2a03c7908823671a3c2f54f16'),
    ('recruteurs_suivant_athlete',     'ab50b9b850b34ee34090650ae5e9828a')) v(f, attendu)
  loop
    select md5(replace(prosrc, E'\r', '')) into vu from pg_proc
     where pronamespace = 'public'::regnamespace and proname = f;
    if vu is distinct from attendu then
      raise exception 'NEXUS: rollback — % ne retrouve pas son corps d''avant (%, attendu %)', f, vu, attendu;
    end if;
  end loop;
end $$;
