-- 20261008135031_journal_matchs_ajoutes (APPLIQUÉE en prod le 2026-10-08 sous cette version, GO BP)
-- ═══════════════════════════════════════════════════════════════════════════
-- CARTE DES MATCHS, LOT B — 4/4 : LE « + » ET LE « ✓ » AU JOURNAL DE L'UNITÉ
-- (BP 2026-10-08, décision 1).
--
-- Deux types neufs dans recruiter_activity_log :
--   MATCH_AJOUTE — un recruteur a ajouté un match au calendrier de l'unité ;
--   MATCH_RETIRE — un recruteur l'en a retiré.
--   · SANS athlète (athlete_id null) : le geste porte sur un match. Le match
--     est dans details : game_id, domicile, visiteur, jour, heure, terrain.
--     Que des noms d'équipes et un lieu : aucun renseignement personnel.
--   · Écrits PAR TRIGGER sur matchs_ajoutes (AFTER INSERT / AFTER DELETE),
--     jamais par le client. Signés par l'ACTEUR (acteur_recruteur()), rangés
--     dans l'unité de la ligne de matchs_ajoutes.
--   · Un retrait qui n'est pas le geste d'un recruteur (cascade d'un match
--     supprimé, script service_role) ne s'écrit PAS : il ne serait le geste
--     de personne.
--   · Lisibles par l'unité comme les autres gestes partagés : les deux types
--     rejoignent la liste de la policy unite_journal_select (même condition,
--     acces_unite_pro).
--
-- La contrainte CHECK et la policy sont REDÉCLARÉES avec leur liste complète
-- (l'ancienne + les deux types) : aucun type existant ne sort.
--
-- Rollback : supabase/rollback/20261008135031_rollback_journal_matchs_ajoutes.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Les deux types admis par la contrainte (liste complète).
alter table public.recruiter_activity_log
  drop constraint recruiter_activity_log_action_type_check;
alter table public.recruiter_activity_log
  add constraint recruiter_activity_log_action_type_check
  check (action_type = any (array[
    'NOTE_ADDED', 'NOTE_UPDATED', 'LIST_CREATED', 'LIST_NOTE_ADDED',
    'ATHLETE_ADDED_TO_LIST', 'ATHLETE_REMOVED_FROM_LIST', 'PIPELINE_CHANGED',
    'FAVORITED', 'UNFAVORITED', 'PROFILE_VIEWED', 'NEW_ATHLETE',
    'PROFILE_UPDATED', 'VIDEO_ADDED', 'ATHLETE_VERIFIED', 'STATS_UPDATED',
    'REVIEW_SUBMITTED', 'COACH_REPLY', 'ADMIN_BROADCAST',
    'MATCH_AJOUTE', 'MATCH_RETIRE'
  ]::text[]));

-- 2. Lisibles par l'unité (liste complète des gestes partagés).
drop policy unite_journal_select on public.recruiter_activity_log;
create policy unite_journal_select on public.recruiter_activity_log
  for select to authenticated
  using (
    action_type = any (array[
      'PIPELINE_CHANGED', 'FAVORITED', 'UNFAVORITED', 'NOTE_ADDED', 'NOTE_UPDATED',
      'LIST_CREATED', 'LIST_NOTE_ADDED', 'ATHLETE_ADDED_TO_LIST', 'ATHLETE_REMOVED_FROM_LIST',
      'MATCH_AJOUTE', 'MATCH_RETIRE'
    ]::text[])
    and public.acces_unite_pro(unite_cegep_id, unite_sport_id)
  );

-- 3. Le trigger qui écrit.
create function public.log_match_ajoute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ligne   public.matchs_ajoutes;
  v_acteur  uuid;
  v_type    text;
begin
  if tg_op = 'INSERT' then
    v_ligne  := new;
    v_type   := 'MATCH_AJOUTE';
    v_acteur := coalesce(public.acteur_recruteur(), new.ajoute_par);
  else
    v_ligne  := old;
    v_type   := 'MATCH_RETIRE';
    v_acteur := public.acteur_recruteur();   -- un retrait sans recruteur n'est le geste de personne
  end if;

  if v_acteur is null then
    return null;
  end if;

  insert into public.recruiter_activity_log
    (recruiter_id, athlete_id, action_type, details, unite_cegep_id, unite_sport_id)
  select v_acteur, null, v_type,
         jsonb_build_object(
           'game_id',  v_ligne.game_id,
           'domicile', coalesce(th.name, g.home_name_raw, 'Équipe à confirmer'),
           'visiteur', coalesce(tv.name, g.visitor_name_raw, 'Équipe à confirmer'),
           'jour',     g.game_date,
           'heure',    g.game_time,
           'terrain',  g.venue
         ),
         v_ligne.unite_cegep_id, v_ligne.unite_sport_id
    from (select v_ligne.game_id as id) x
    left join public.games g  on g.id = x.id
    left join public.teams th on th.id = g.home_team_id
    left join public.teams tv on tv.id = g.visitor_team_id;
  return null;
end $$;

create trigger trg_log_match_ajoute
  after insert or delete on public.matchs_ajoutes
  for each row execute function public.log_match_ajoute();

revoke all on function public.log_match_ajoute() from public, anon, authenticated;

-- 4. Gates — listes complètes triées, jamais par inclusion.
do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.log_match_ajoute()'::regprocedure;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de log_match_ajoute = %, attendu {postgres,service_role}', vus;
  end if;

  select array_agg(v order by v) into vus
    from (select (regexp_matches(pg_get_constraintdef(c.oid), '''([A-Z_]+)''', 'g'))[1] as v
            from pg_constraint c
           where c.conrelid = 'public.recruiter_activity_log'::regclass
             and c.conname = 'recruiter_activity_log_action_type_check') s;
  if vus is distinct from array['ADMIN_BROADCAST', 'ATHLETE_ADDED_TO_LIST', 'ATHLETE_REMOVED_FROM_LIST',
       'ATHLETE_VERIFIED', 'COACH_REPLY', 'FAVORITED', 'LIST_CREATED', 'LIST_NOTE_ADDED', 'MATCH_AJOUTE',
       'MATCH_RETIRE', 'NEW_ATHLETE', 'NOTE_ADDED', 'NOTE_UPDATED', 'PIPELINE_CHANGED', 'PROFILE_UPDATED',
       'PROFILE_VIEWED', 'REVIEW_SUBMITTED', 'STATS_UPDATED', 'UNFAVORITED', 'VIDEO_ADDED'] then
    raise exception 'NEXUS: types admis = %', vus;
  end if;

  select array_agg(v order by v) into vus
    from (select (regexp_matches(pg_get_expr(p.polqual, p.polrelid), '''([A-Z_]+)''', 'g'))[1] as v
            from pg_policy p
           where p.polrelid = 'public.recruiter_activity_log'::regclass
             and p.polname = 'unite_journal_select') s;
  if vus is distinct from array['ATHLETE_ADDED_TO_LIST', 'ATHLETE_REMOVED_FROM_LIST', 'FAVORITED',
       'LIST_CREATED', 'LIST_NOTE_ADDED', 'MATCH_AJOUTE', 'MATCH_RETIRE', 'NOTE_ADDED', 'NOTE_UPDATED',
       'PIPELINE_CHANGED', 'UNFAVORITED'] then
    raise exception 'NEXUS: gestes lisibles par l''unité = %', vus;
  end if;

  select array_agg(r.oid::regrole::text order by r.oid::regrole::text) into vus
    from pg_policy p, unnest(p.polroles) as r(oid)
   where p.polrelid = 'public.recruiter_activity_log'::regclass and p.polname = 'unite_journal_select';
  if vus is distinct from array['authenticated'] then
    raise exception 'NEXUS: rôles de unite_journal_select = %', vus;
  end if;
end $$;
