-- Rollback de 20261016080000_lectures_sans_plafond.sql — une transaction.
-- La migration n'a fait qu'AJOUTER des fonctions de lecture (aucune donnée, aucune fonction existante modifiée) :
-- le rollback exact est de les retirer et d'effacer la version. Le code web qui les appelle (calendrier recruteur,
-- Mes listes, Mon cégep, côté coach, pages admin) doit être revenu en arrière AVANT, sinon ces écrans affichent
-- l'erreur de chargement.
begin;

drop function public.team_coaches_par_equipes(uuid[]);
drop function public.team_athletes_par_equipes(uuid[]);
drop function public.messages_par_conversations(uuid[]);
drop function public.schools_par_ids(uuid[]);
drop function public.users_par_ids(uuid[]);
drop function public.cartes_par_ids(uuid[]);
drop function public.games_des_equipes(uuid[], date);
drop function public.games_par_ids(uuid[]);
drop function public.teams_par_ids(uuid[]);
drop function public.recruiter_activity_log_par_athletes(uuid[]);
drop function public.athlete_suggestions_par_athletes(uuid[]);
drop function public.conversations_par_athletes(uuid[]);
drop function public.recruiter_athlete_views_par_athletes(uuid[]);
drop function public.recruiter_favorites_par_athletes(uuid[]);
drop function public.team_athletes_par_athletes(uuid[]);
drop function public.athletes_par_ids(uuid[]);

delete from supabase_migrations.schema_migrations where version = '20261016080000';

do $$
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in (
       'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
       'recruiter_athlete_views_par_athletes', 'conversations_par_athletes', 'athlete_suggestions_par_athletes',
       'recruiter_activity_log_par_athletes', 'teams_par_ids', 'games_par_ids', 'games_des_equipes', 'cartes_par_ids',
       'users_par_ids', 'schools_par_ids', 'messages_par_conversations', 'team_athletes_par_equipes',
       'team_coaches_par_equipes')) then
    raise exception 'NEXUS: rollback lectures sans plafond — une fonction subsiste';
  end if;
end $$;

commit;
