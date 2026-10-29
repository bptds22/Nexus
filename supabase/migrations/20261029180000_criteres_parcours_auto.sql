-- ════════════════════════════════════════════════════════════════════════════
-- Critères automatiques de « Quand le cégep cogne » / « Quand l'université cogne » (chantier cégep, point 5 —
-- liste validée par BP le 2026-10-29, AVEC la règle « vidéo de moins de 12 mois », cote R manuelle).
--
-- 1. athletes.video_faits_saillants_maj_le (timestamptz) — date de la dernière mise à jour de la vidéo de faits
--    saillants. Posée par la BASE seulement (trigger trg_athletes_video_faits_saillants_date, BEFORE) :
--      · lien posé ou changé → now() ; lien retiré → null ; sinon la date d'avant est gardée, quoi que le
--        client envoie (personne ne peut antidater ni rajeunir sa vidéo).
--    Rattrapage des vidéos existantes : on ne connaît pas leur vraie date (aucun historique). Elles reçoivent
--    la date de cette migration : elles comptent comme « récentes » pendant 12 mois, puis l'athlète devra
--    remettre son lien à jour. Le rattrapage n'écrit QUE cette colonne et garde updated_at (drapeau local
--    nexus.mirror_write, le même que le miroir des évaluations) : aucun athlète ne remonte dans les listes
--    « mis à jour récemment », aucune activité recruteur n'est journalisée (le lien ne change pas).
-- 2. public.mes_criteres_parcours() — jsonb, pour l'athlète CONNECTÉ seulement (auth.uid()) :
--      repondu_recruteur                  il a écrit au moins un message dans une conversation recruteur ↔ athlète ;
--      echange_recruteur_universitaire    idem, avec un recruteur rattaché à une université ;
--      visite                             une visite est enregistrée à son nom (visites_details, unité ou privée).
--    DEFINER : l'athlète ne lit ni la fiche du recruteur ni visites_details ; la fonction ne rend que trois
--    booléens sur ses propres données. Aucun interrupteur ici : la page n'affiche ces critères que sous
--    lancement_universitaire ON pour le cégépien (règle parcoursUniversitaireActif), et la liste du secondaire
--    ne dépend d'aucun interrupteur.
-- Mobile 1.4.5 : ne lit ni la colonne ni la fonction ; ses écritures de fiche passent par le même trigger.
--
-- Rollback : supabase/rollback/20261029180000_rollback_criteres_parcours_auto.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'athletes'
               and column_name = 'video_faits_saillants_maj_le') then
    raise exception 'NEXUS: 20261029180000 déjà appliquée';
  end if;
  if to_regprocedure('public.mes_criteres_parcours()') is not null
     or to_regprocedure('public.athletes_video_faits_saillants_date()') is not null then
    raise exception 'NEXUS: une fonction de 20261029180000 existe déjà';
  end if;
  if to_regclass('public.visites_details') is null then
    raise exception 'NEXUS: préalable visites_details absent';
  end if;
  if to_regprocedure('public.preserve_athlete_denorm_si_miroir()') is null then
    raise exception 'NEXUS: préalable preserve_athlete_denorm_si_miroir absent (garde de updated_at au rattrapage)';
  end if;
end $$;

alter table public.athletes add column video_faits_saillants_maj_le timestamptz;
comment on column public.athletes.video_faits_saillants_maj_le is
  'Date de la dernière mise à jour de video_faits_saillants_url, posée par la base (trigger). Vidéos d''avant le 2026-10-29 : date de la migration 20261029180000.';

-- Rattrapage : les vidéos déjà présentes, sans toucher updated_at.
select set_config('nexus.mirror_write', 'on', true);
update public.athletes set video_faits_saillants_maj_le = now()
 where nullif(btrim(video_faits_saillants_url), '') is not null;
select set_config('nexus.mirror_write', '', true);

create function public.athletes_video_faits_saillants_date()
returns trigger language plpgsql set search_path = public as $f$
begin
  if tg_op = 'INSERT' or new.video_faits_saillants_url is distinct from old.video_faits_saillants_url then
    new.video_faits_saillants_maj_le := case when nullif(btrim(new.video_faits_saillants_url), '') is null then null else now() end;
  else
    new.video_faits_saillants_maj_le := old.video_faits_saillants_maj_le;
  end if;
  return new;
end $f$;
create trigger trg_athletes_video_faits_saillants_date
  before insert or update on public.athletes
  for each row execute function public.athletes_video_faits_saillants_date();

create function public.mes_criteres_parcours()
returns jsonb language sql stable security definer set search_path = public set row_security = off as $f$
  with moi as (select a.id from public.athletes a where a.user_id = auth.uid() limit 1),
  repondu as (
    select c.recruiter_id from public.conversations c
      join public.messages m on m.conversation_id = c.id
     where c.athlete_id = (select id from moi) and c.conversation_type = 'RECRUTEUR_ATHLETE'
       and m.sender_id = auth.uid() and m.retracted_at is null
  )
  select case when (select id from moi) is null then null else jsonb_build_object(
    'repondu_recruteur', exists (select 1 from repondu),
    'echange_recruteur_universitaire', exists (
      select 1 from repondu r join public.users u on u.id = r.recruiter_id
        join public.schools s on s.id = u.school_id where s.type::text = 'UNIVERSITE'),
    'visite', exists (select 1 from public.visites_details v where v.athlete_id = (select id from moi))
  ) end
$f$;
revoke all on function public.mes_criteres_parcours() from public, anon;
grant execute on function public.mes_criteres_parcours() to authenticated, service_role;
comment on function public.mes_criteres_parcours() is
  'Critères automatiques de Mon parcours pour l''athlète connecté : a répondu à un recruteur, a échangé avec un recruteur universitaire, visite enregistrée.';
