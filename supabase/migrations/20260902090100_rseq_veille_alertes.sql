-- 20260902090100_rseq_veille_alertes.sql
-- ============================================================================
-- VEILLE RSEQ HEBDOMADAIRE — LOT B : détection de dérive + file de revue.
--
-- LA RÈGLE RSEQ MAISON, ÉCRITE DANS LE CODE
--   • Jamais de DELETE.
--   • Jamais d'INSERT dans `schools`. Une équipe rattachée à une institution
--     inconnue lève une alerte qui NOMME l'institution ; la décision de créer
--     l'école reste humaine, et rien ici ne peut la prendre.
--   • L'INSERT d'équipe est permis AVEC dédup — mais pas par cette migration :
--     aucune fonction ci-dessous n'écrit dans `teams`. Les détections vont
--     dans `rseq_sync_alerts`, que tu traites. Rien n'est appliqué tout seul.
--
-- POURQUOI UNE FILE PLUTÔT QU'UNE APPLICATION AUTOMATIQUE
--   Une nouvelle équipe au calendrier RSEQ peut être : une vraie nouvelle
--   équipe, une équipe existante renommée, un doublon de section, ou une
--   erreur de saisie RSEQ. Les quatre se ressemblent dans le payload. Seul
--   un humain tranche.
--
-- DÉDUP DES ALERTES — condition de l'idempotence.
--   Sans dédup, chaque passage relèverait les 24 mêmes équipes inconnues et
--   la file serait inutilisable en trois semaines. L'index unique partiel
--   ci-dessous fait qu'une alerte OUVERTE ne peut pas exister en double :
--   le second passage insère 0 alerte. Une alerte traitée puis re-détectée
--   (le problème est revenu) peut, elle, se rouvrir.
-- ============================================================================


-- ── 1. La file de revue ────────────────────────────────────────────────────
create table if not exists public.rseq_sync_alerts (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid references public.rseq_sync_runs(id) on delete set null,

  -- 'NOUVELLE_EQUIPE'          : au calendrier RSEQ, absente de `teams`.
  -- 'CHANGEMENT_DIVISION'      : équipe pontée dont la famille de ligue change.
  -- 'LIGUE_MUETTE'             : GUID connu qui ne répond plus (saison neuve ?).
  -- 'FAMILLE_ATTENDUE_ABSENTE' : famille dormante qui aurait dû reparaître.
  type           text not null,

  -- Clé de dédup : identifie LE problème, pas l'occurrence.
  cle            text not null,

  -- 'OUVERTE' | 'TRAITEE' | 'IGNOREE'
  statut         text not null default 'OUVERTE',

  rseq_league_id     uuid,
  rseq_team_id       uuid,
  rseq_institution_id uuid,
  family_key         text,
  -- Résolus quand on peut, pour t'éviter une requête de plus.
  school_id      uuid references public.schools(id) on delete set null,
  team_id        uuid references public.teams(id) on delete set null,

  resume         text not null,
  payload        jsonb not null default '{}'::jsonb,

  created_at     timestamptz not null default now(),
  traite_le      timestamptz,
  traite_par     uuid references public.users(id) on delete set null,
  note           text
);

comment on table public.rseq_sync_alerts is
  'File de revue de la veille RSEQ. Rien n''est applique automatiquement : chaque ligne attend une decision humaine.';

-- Une seule alerte OUVERTE par problème. C'est ce qui rend le second passage
-- silencieux.
create unique index if not exists rseq_sync_alerts_ouverte_uidx
  on public.rseq_sync_alerts (type, cle) where statut = 'OUVERTE';

create index if not exists rseq_sync_alerts_statut_idx
  on public.rseq_sync_alerts (statut, type, created_at desc);

alter table public.rseq_sync_alerts enable row level security;
-- Aucune policy : service-role (edge function) et admin SQL. La file n'est pas
-- une surface applicative — si elle le devient un jour, ce sera une policy
-- explicite, pas un oubli.


-- ── 2. Détection au niveau des équipes d'une ligue ─────────────────────────
-- Appelée une fois par ligue, avec le bloc `Teams[]` du payload (le SEUL
-- bloc du payload qui porte l'InstitutionId, donc le rattachement école).
--
-- Deux détections :
--   a) NOUVELLE_EQUIPE     — TeamId absent de teams.rseq_team_id.
--   b) CHANGEMENT_DIVISION — équipe pontée dont la famille de ligue diffère
--      de celle où on la connaissait (saison passée, ou plus tôt cette
--      saison). Les GUID changeant chaque année, la comparaison porte sur la
--      FAMILLE (sport|division), pas sur le leagueId brut : comparer des
--      GUID d'une saison à l'autre ne dirait rien.
--
-- CORRIGÉ LE 2026-09-02 — LA PREMIÈRE VERSION ÉTAIT AVEUGLE.
--   Elle ne lisait que `Teams[]`, en le prenant pour le registre des
--   participants d'une ligue. Il ne l'est pas : sur « Soccer C M D2
--   Nord-Est », Teams[] annonce 5 équipes quand les 52 matchs de la même
--   ligue en font jouer 12. Sur les 38 ligues collégiales : 312 lignes
--   Teams[] pour 334 participants réels. Le détecteur aurait levé ZÉRO
--   alerte sur les 22 équipes manquantes — celles-là mêmes qu'on cherche.
--
--   `p_teams` reçoit donc désormais l'UNION calculée par equipesADetecter()
--   (voir _shared/rseqWhitelist.ts), avec un drapeau `vu_dans_teams` :
--     • true  — l'équipe vient de Teams[], son InstitutionId est connu et
--               l'école se résout toute seule.
--     • false — l'équipe n'est connue que par les matchs : nom et code
--               seulement. AUCUN InstitutionId n'existe pour elle, nulle
--               part dans le payload. L'alerte le DIT, au lieu de laisser
--               croire à un rattachement qui n'a pas été prouvé.
--   L'UUID nul (gabarits « 3e position », « Gagnant SF01 ») est écarté en
--   amont par equipesADetecter, et re-écarté ici par ceinture et bretelles.
create or replace function public.rseq_sync_detect_teams(
  p_run_id     uuid,
  p_league_id  uuid,
  p_family_key text,
  p_saison     text,
  p_teams      jsonb
) returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_n integer := 0;
begin
  if coalesce(jsonb_array_length(p_teams), 0) = 0 then
    return 0;
  end if;

  with src as (
    select * from jsonb_to_recordset(p_teams) as x(
      rseq_team_id uuid, team_name text, team_code text,
      rseq_institution_id uuid, team_pseudonym text, vu_dans_teams boolean
    )
    -- Ceinture et bretelles : le gabarit de tableau n'est pas une equipe.
    where rseq_team_id is not null
      and rseq_team_id <> '00000000-0000-0000-0000-000000000000'::uuid
  ),
  -- (a) inconnues au bataillon
  inconnues as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, rseq_league_id, rseq_team_id, rseq_institution_id,
       family_key, school_id, resume, payload)
    select
      p_run_id, 'NOUVELLE_EQUIPE', s.rseq_team_id::text,
      p_league_id, s.rseq_team_id, s.rseq_institution_id, p_family_key,
      sc.id,
      coalesce(s.team_name, '?') || ' (' || coalesce(s.team_code,'?') || ') — ' ||
      case
        when sc.id is not null then 'ecole PROUVEE par InstitutionId : ' || sc.name
        when s.rseq_institution_id is not null then 'INSTITUTION INCONNUE ' || s.rseq_institution_id::text
        -- Le cas majoritaire des 22 : l'equipe joue, mais RSEQ ne la declare
        -- dans aucun Teams[]. Il n'existe alors AUCUN InstitutionId a
        -- rapprocher. On l'ecrit noir sur blanc plutot que de deviner.
        else 'RATTACHEMENT A ETABLIR A LA MAIN — absente de Teams[], aucun InstitutionId publie'
      end,
      jsonb_build_object(
        'team_name', s.team_name, 'team_code', s.team_code,
        'team_pseudonym', s.team_pseudonym,
        'rseq_institution_id', s.rseq_institution_id,
        'vu_dans_teams', coalesce(s.vu_dans_teams, false),
        'source', case when coalesce(s.vu_dans_teams, false) then 'Teams[]' else 'matchs' end,
        'ecole_prouvee', (sc.id is not null),
        'family_key', p_family_key, 'saison', p_saison
      )
    from src s
    left join public.schools sc on sc.rseq_institution_id = s.rseq_institution_id
    where not exists (
        select 1 from public.teams t where t.rseq_team_id = s.rseq_team_id
      )
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  ),
  -- (b) équipes pontées dont la famille de ligue a bougé
  connues as (
    select t.id as team_id, s.rseq_team_id, s.team_name, t.division as div_connue
    from src s
    join public.teams t on t.rseq_team_id = s.rseq_team_id
  ),
  familles_connues as (
    -- La ou les familles où cette équipe apparaissait déjà, toutes saisons
    -- confondues, D'APRÈS les matchs déjà en base.
    select c.team_id, c.rseq_team_id, c.team_name,
           array_agg(distinct public.rseq_family_key(g.sport, g.division)) as familles
    from connues c
    join public.games g
      on g.home_rseq_team_id = c.rseq_team_id
      or g.visitor_rseq_team_id = c.rseq_team_id
    where g.sector = 'Collégial'
      and g.rseq_league_id is distinct from p_league_id
    group by c.team_id, c.rseq_team_id, c.team_name
  ),
  derive as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, rseq_league_id, rseq_team_id, family_key,
       team_id, resume, payload)
    select
      p_run_id, 'CHANGEMENT_DIVISION',
      f.rseq_team_id::text || '|' || p_family_key,
      p_league_id, f.rseq_team_id, p_family_key, f.team_id,
      coalesce(f.team_name,'?') || ' apparait en « ' || p_family_key ||
      ' », connue en « ' || array_to_string(f.familles, ', ') || ' »',
      jsonb_build_object(
        'familles_connues', f.familles,
        'famille_courante', p_family_key,
        'saison', p_saison
      )
    from familles_connues f
    where not (p_family_key = any(f.familles))
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  )
  select (select count(*) from inconnues) + (select count(*) from derive)
  into v_n;

  return coalesce(v_n, 0);
end;
$$;

comment on function public.rseq_sync_detect_teams(uuid, uuid, text, text, jsonb) is
  'Detecte nouvelles equipes et changements de division. N''ecrit QUE dans rseq_sync_alerts : aucun INSERT teams, aucun INSERT schools.';


-- ── 3. Ligue muette ────────────────────────────────────────────────────────
-- Appelée par l'edge function quand un GUID connu répond 404, renvoie un
-- payload vide, ou échoue deux fois. C'est le filet contre le changement
-- annuel de GUID : il ne DÉCOUVRE pas la nouvelle ligue, mais il garantit
-- qu'on ne sert pas du périmé en silence.
create or replace function public.rseq_sync_signal_ligue_muette(
  p_run_id    uuid,
  p_league_id uuid,
  p_saison    text,
  p_motif     text
) returns integer
language sql
set search_path = public, pg_temp
as $$
  with ins as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, rseq_league_id, family_key, resume, payload)
    select
      p_run_id, 'LIGUE_MUETTE',
      p_league_id::text || '|' || p_saison,
      p_league_id,
      (select v.family_key from public.rseq_ligues_a_appeler v
        where v.rseq_league_id = p_league_id limit 1),
      'ligue ' || coalesce(
        (select v.league_name from public.rseq_ligues_a_appeler v
          where v.rseq_league_id = p_league_id limit 1), p_league_id::text)
        || ' ne repond plus : ' || coalesce(p_motif, 'motif inconnu'),
      jsonb_build_object('motif', p_motif, 'saison', p_saison)
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  )
  select coalesce((select count(*)::int from ins), 0);
$$;


-- ── 4. Familles dormantes qui auraient dû reparaître ───────────────────────
-- « Le détecteur doit voir large » : les 4 familles dormantes (Badminton D2,
-- Badminton D3, Soccer intérieur, Soccer intérieur D3) n'ont AUCUN GUID à
-- appeler. On ne peut donc pas les sonder — on peut seulement remarquer
-- qu'elles ne sont pas revenues alors que la date où elles démarraient la
-- saison passée est dépassée.
--
-- C'est ce qui aurait crié pour le badminton et le soccer intérieur cet
-- automne, et pour les D1 collégiales absentes de 2025-2026.
create or replace function public.rseq_sync_detect_familles(
  p_run_id uuid,
  p_saison text
) returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_n integer := 0;
begin
  -- Rafraîchir le statut des familles d'après ce qui est publié aujourd'hui.
  update public.rseq_watch_leagues w
     set nb_ligues = coalesce(v.n, 0),
         statut    = case when coalesce(v.n, 0) > 0 then 'ACTIVE' else 'DORMANTE' end,
         saison    = p_saison,
         last_ok_at = case when coalesce(v.n, 0) > 0 then now() else w.last_ok_at end,
         updated_at = now()
  from (
    select family_key, count(*)::int as n
    from public.rseq_ligues_a_appeler group by family_key
  ) v
  where v.family_key = w.family_key;

  -- Les familles qu'AUCUNE ligue publiée ne couvre cette saison.
  update public.rseq_watch_leagues w
     set nb_ligues = 0,
         statut = 'DORMANTE',
         updated_at = now()
   where not exists (
     select 1 from public.rseq_ligues_a_appeler v where v.family_key = w.family_key
   );

  with ins as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, family_key, resume, payload)
    select
      p_run_id, 'FAMILLE_ATTENDUE_ABSENTE',
      w.family_key || '|' || p_saison,
      w.family_key,
      w.sport || coalesce(' ' || w.division, '') ||
      ' n''est toujours pas publiee (la saison passee, premier match le ' ||
      coalesce(w.attendu_vers::text, '?') || ')',
      jsonb_build_object(
        'sport', w.sport, 'division', w.division,
        'attendu_vers', w.attendu_vers, 'saison', p_saison
      )
    from public.rseq_watch_leagues w
    where w.statut = 'DORMANTE'
      and w.attendu_vers is not null
      -- L'ancre est une date de la saison PASSÉE : on la reporte sur la
      -- saison courante avant de comparer.
      and (w.attendu_vers + interval '1 year')::date <= current_date
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  )
  select coalesce((select count(*)::int from ins), 0) into v_n;

  return coalesce(v_n, 0);
end;
$$;


-- ── 5. La vue que tu liras ─────────────────────────────────────────────────
-- La file ouverte, triée par ce qui mérite un coup d'œil en premier.
create or replace view public.rseq_alertes_ouvertes
with (security_invoker = true) as
select
  a.created_at::date            as vue_le,
  a.type,
  a.resume,
  a.family_key,
  s.name                        as ecole,
  a.rseq_team_id,
  a.rseq_institution_id,
  a.id                          as alerte_id
from public.rseq_sync_alerts a
left join public.schools s on s.id = a.school_id
where a.statut = 'OUVERTE'
order by
  case a.type
    when 'LIGUE_MUETTE'             then 1
    when 'FAMILLE_ATTENDUE_ABSENTE' then 2
    when 'CHANGEMENT_DIVISION'      then 3
    else 4
  end,
  a.created_at desc;

comment on view public.rseq_alertes_ouvertes is
  'File de revue RSEQ, ouverte, triee par urgence. Les ligues muettes d''abord : elles signifient qu''on sert peut-etre du perime.';


-- ── 6. Droits ──────────────────────────────────────────────────────────────
revoke all on function public.rseq_sync_detect_teams(uuid, uuid, text, text, jsonb) from public;
revoke all on function public.rseq_sync_signal_ligue_muette(uuid, uuid, text, text) from public;
revoke all on function public.rseq_sync_detect_familles(uuid, text) from public;
grant execute on function public.rseq_sync_detect_teams(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.rseq_sync_signal_ligue_muette(uuid, uuid, text, text) to service_role;
grant execute on function public.rseq_sync_detect_familles(uuid, text) to service_role;
