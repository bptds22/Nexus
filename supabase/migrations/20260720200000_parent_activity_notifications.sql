-- ═══════════════════════════════════════════════════════════════
-- Portal parental — Lot 1c : Activité (compteurs) + Notifications.
--
-- RÈGLE FERME : tout ce que le parent voit est ANONYME. Aucun nom de
-- recruteur / collège dans title/message/metadata. Les IDs techniques
-- (recruiter_id, athlete_id) dans metadata sont permis (debug, non affichables).
--
-- PÉRIMÈTRE : on AJOUTE des triggers SÉPARÉS. Aucun trigger/fonction
-- existant (athlète/coach/admin, favoris, pipeline) n'est modifié.
-- ═══════════════════════════════════════════════════════════════

-- ── TABLE parent_notifications (miroir d'athlete_notifications, clé parent) ──
create table if not exists public.parent_notifications (
  id             uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  athlete_id     uuid references public.athletes(id) on delete cascade,  -- quel enfant (ID technique)
  type           text not null check (type in ('CHILD_FAVORITED','CHILD_PIPELINE_STAGE','CHILD_VISIT_PLANNED')),
  title          text not null,
  message        text,
  metadata       jsonb,
  read           boolean default false,
  created_at     timestamptz default now()
);
create index if not exists idx_parent_notifications_user_created
  on public.parent_notifications (parent_user_id, created_at desc);

alter table public.parent_notifications enable row level security;

-- Parent lit / marque lu SES lignes uniquement. Pas d'INSERT parent (triggers only).
drop policy if exists "parent reads own notifications" on public.parent_notifications;
create policy "parent reads own notifications" on public.parent_notifications
  for select using (parent_user_id = auth.uid());
drop policy if exists "parent updates own notifications" on public.parent_notifications;
create policy "parent updates own notifications" on public.parent_notifications
  for update using (parent_user_id = auth.uid()) with check (parent_user_id = auth.uid());

grant select, update on public.parent_notifications to authenticated;

-- ── Libellés FR des stages pipeline (anonyme, immutable) ──
create or replace function public.pipeline_stage_label_fr(p_stage text)
returns text language sql immutable as $$
  select case p_stage
    when 'IDENTIFIE'        then 'Identifié'
    when 'CONTACTE'         then 'Contacté'
    when 'EN_DISCUSSION'    then 'En discussion'
    when 'VISITE_PLANIFIEE' then 'Visite planifiée'
    when 'ENGAGE'           then 'Engagé'
    when 'LETTRE_SIGNEE'    then 'Lettre signée'
    else coalesce(p_stage, '—')
  end;
$$;

-- ── Émission : insère 1 notif par parent lié (0 si aucun parent). ──
--    SECURITY DEFINER + REVOKE FROM PUBLIC : appelable UNIQUEMENT depuis les
--    trigger-functions (elles-mêmes DEFINER), jamais en RPC par un client
--    (sinon un recruteur pourrait forger des notifications parent).
create or replace function public.emit_parent_notification(
  p_athlete_id uuid, p_type text, p_title text, p_message text, p_metadata jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  insert into public.parent_notifications (parent_user_id, athlete_id, type, title, message, metadata)
  select pa.parent_user_id, p_athlete_id, p_type, p_title, p_message, p_metadata
  from public.parent_athletes pa
  where pa.athlete_id = p_athlete_id;
$$;
-- Supabase accorde EXECUTE aux rôles client via ALTER DEFAULT PRIVILEGES ;
-- REVOKE FROM public ne suffit pas → révoquer explicitement authenticated/anon.
-- Les trigger-functions (SECURITY DEFINER, owner postgres) gardent l'accès.
revoke all on function public.emit_parent_notification(uuid, text, text, text, jsonb) from public, authenticated, anon;

-- ── Trigger 1 : favori ajouté → CHILD_FAVORITED (anonyme) ──
create or replace function public.notify_parent_favorited()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.emit_parent_notification(
    NEW.athlete_id, 'CHILD_FAVORITED', 'Nouveau favori',
    'Un recruteur a ajouté votre enfant à ses favoris.',
    jsonb_build_object('event','favorite','recruiter_id',NEW.recruiter_id,'athlete_id',NEW.athlete_id)
  );
  return NEW;
end;
$$;
drop trigger if exists trg_notify_parent_favorited on public.recruiter_favorites;
create trigger trg_notify_parent_favorited
  after insert on public.recruiter_favorites
  for each row execute function public.notify_parent_favorited();

-- ── Trigger 2 : changement de stage → CHILD_PIPELINE_STAGE (anonyme, FR) ──
--    On skip l'INSERT à IDENTIFIE (stage d'entrée, redondant avec le favori).
create or replace function public.notify_parent_pipeline_stage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_notify boolean := false;
begin
  if TG_OP = 'INSERT' then
    v_notify := NEW.stage is distinct from 'IDENTIFIE';
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
$$;
drop trigger if exists trg_notify_parent_pipeline_stage on public.recruiter_pipeline;
create trigger trg_notify_parent_pipeline_stage
  after insert or update on public.recruiter_pipeline
  for each row execute function public.notify_parent_pipeline_stage();

-- ── Trigger 3 : visit_at posé/changé → CHILD_VISIT_PLANNED (anonyme + date) ──
--    Le WHEN garantit : uniquement sur changement réel ET valeur non nulle
--    (pas de notif sur re-save identique, ni sur annulation → null).
create or replace function public.notify_parent_visit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.emit_parent_notification(
    NEW.athlete_id, 'CHILD_VISIT_PLANNED', 'Visite planifiée',
    'Une visite a été planifiée pour votre enfant le '
      || to_char(NEW.visit_at at time zone 'America/Toronto', 'DD/MM/YYYY') || '.',
    jsonb_build_object('event','visit','visit_at',NEW.visit_at,'recruiter_id',NEW.recruiter_id,'athlete_id',NEW.athlete_id)
  );
  return NEW;
end;
$$;
drop trigger if exists trg_notify_parent_visit on public.recruiter_pipeline;
create trigger trg_notify_parent_visit
  after update of visit_at on public.recruiter_pipeline
  for each row
  when (OLD.visit_at is distinct from NEW.visit_at and NEW.visit_at is not null)
  execute function public.notify_parent_visit();

-- ── RPC COMPTEURS : activité anonyme de l'enfant (garde parent) ──
create or replace function public.get_child_activity(p_athlete_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare v_weekly jsonb;
begin
  if not public.is_parent_of(p_athlete_id) then
    return jsonb_build_object('error', 'not_parent');
  end if;

  -- Série hebdo (12 dernières semaines, ordre chronologique pour le graphe).
  select coalesce(jsonb_agg(jsonb_build_object('week_start', week_start, 'count', view_count)
                            order by week_start), '[]'::jsonb)
    into v_weekly
    from (
      select week_start, view_count
      from public.athlete_views_weekly
      where athlete_id = p_athlete_id
      order by week_start desc
      limit 12
    ) w;

  return jsonb_build_object(
    'views_total',     public.count_athlete_views(p_athlete_id),
    'favorites_total', (select count(*) from public.recruiter_favorites where athlete_id = p_athlete_id),
    'weekly',          v_weekly
  );
end;
$$;
grant execute on function public.get_child_activity(uuid) to authenticated;
