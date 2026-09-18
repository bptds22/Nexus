-- 20260918143401_rseq_veille_secondaire_lot1
--
-- VEILLE RSEQ — ÉLARGISSEMENT AU SECONDAIRE, LOT 1 (base de données).
-- Plan révisé validé par BP le 2026-09-18 (GO lots 1 à 4). LOCAL SEULEMENT
-- tant que BP n'a pas vu le rapport du lot 4.
--
-- ⚠️ À APPLIQUER EN PROD DANS LA MÊME FENÊTRE QUE LE REDÉPLOIEMENT DE
--    `rseq-weekly-sync` (lot 2), NI UN MARDI NI UN MERCREDI.
--    La fonction déployée aujourd'hui appelle `apply_standings`,
--    `detect_teams`, `detect_familles` et `detect_mapping` SANS `p_secteur` :
--    après ce DROP + CREATE, chacun de ces appels échoue, et la passe
--    collégiale du mercredi casse. De plus, la vue renvoie désormais les
--    ligues secondaires : l'ancienne fonction les traiterait comme collégiales.
--
--    PROCÉDURE DE MISE EN PROD — une seule fenêtre, dans cet ordre, hors mar./mer. :
--      1. cette migration ;
--      2. redéploiement de `rseq-weekly-sync` (lot 2) ;
--      3. cron (lot 3) : MODIFIER l'entrée existante (55 7 * * 3) pour qu'elle
--         passe `?secteur=Collégial` — décision BP 2026-09-18 : `?secteur=` n'a
--         PAS de valeur par défaut, le secteur reste explicite partout. Sans
--         cette modification, la passe collégiale du mercredi est refusée ;
--         puis AJOUTER la découverte (mar. 07:55 UTC) et la passe secondaire
--         (mer. 08:10 UTC).
--
-- Définitions de départ : relevées EN PROD le 2026-09-18 (pg_get_functiondef),
-- pas dans le dépôt. Cinq des fonctions locales divergeaient de la prod
-- (apply_standings, detect_teams, detect_familles, detect_mapping,
-- detect_matchs_retires) ; la prod fait foi.
--
-- ── CE QUE FAIT CETTE MIGRATION ─────────────────────────────────────────────
--  1a. Catalogue `rseq_ligues_publiees` + RPC `rseq_decouverte_upsert`.
--      Une ligue découverte sans match chargé doit exister QUELQUE PART : la
--      vue ne connaît que `games`. Pas de file, pas de bail, pas de tampon.
--  1b. Vue `rseq_ligues_a_appeler` = union (games collégial + games secondaire
--      + catalogue), DISTINCT ON (rseq_league_id) avec priorité au catalogue,
--      liste d'EXCLUSION Natation / Cross-country, Primaire exclu.
--  1c. `rseq_family_key(p_secteur, p_sport, p_division)` → « collégial|volleyball|D1 ».
--      L'ancienne version à 2 arguments est SUPPRIMÉE : un appelant oublié
--      doit planter, pas calculer des clés sans secteur.
--      `rseq_watch_leagues` gagne `secteur` ; 22 lignes recalculées ; les
--      family_key des alertes existantes reçoivent le préfixe `collégial|`.
--      Amorce des familles secondaires (attendu_vers = 1er match 2025-2026).
--  1d. `p_secteur` sur apply_standings, detect_teams, detect_familles,
--      detect_mapping (DROP + CREATE : ajouter un paramètre change la
--      signature, un CREATE seul créerait une surcharge).
--      detect_teams SECONDAIRE : une alerte NOUVELLES_EQUIPES par
--      sport × région, dédoublonnée par containment sur le payload.
--      Le collégial garde une alerte NOUVELLE_EQUIPE par équipe.
--
-- ── RÈGLE D'ACL (2026-09-07) ────────────────────────────────────────────────
-- Un DROP + CREATE emporte l'ACL, et les default privileges de Supabase
-- reposent EXECUTE pour anon + authenticated + service_role. Chaque fonction
-- touchée est donc révoquée puis regrantée, et un gate compare la liste
-- COMPLÈTE triée — relevée avant (bloc 0) et après (bloc final).
--
-- ── CORRECTIONS AU PLAN, CONSTATÉES EN PROD LE 2026-09-18 ───────────────────
--  · rseq_watch_leagues compte 22 lignes, pas 20.
--  · Seule la vue rseq_ligues_a_appeler appelle rseq_family_key ;
--    rseq_alertes_ouvertes lit la COLONNE family_key et ne bouge pas.
--  · rseq_sync_detect_matchs_retires appelle AUSSI rseq_family_key : elle est
--    réécrite ici (CREATE OR REPLACE, signature inchangée), sans quoi le DROP
--    de l'ancienne clé la casserait à l'exécution — silencieusement, puisqu'un
--    corps plpgsql ne crée aucune dépendance.


-- ════════════════════════════════════════════════════════════════════════════
-- 0. PRÉCONDITIONS ET RELEVÉ DES ACL AVANT
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  vus  text[];
  v_n  int;
  r    record;
begin
  -- ACL relevées AVANT, liste complète triée. Ce sont celles que le bloc final
  -- exige sur les nouvelles signatures : AVANT = APRÈS, par transitivité.
  for r in
    select * from (values
      ('public.rseq_family_key(text,text)',                                   array['authenticated','postgres','service_role']),
      ('public.rseq_sync_apply_standings(uuid,uuid,text,jsonb)',              array['postgres','service_role']),
      ('public.rseq_sync_detect_teams(uuid,uuid,text,text,jsonb)',            array['postgres','service_role']),
      ('public.rseq_sync_detect_familles(uuid,text)',                         array['postgres','service_role']),
      ('public.rseq_sync_detect_mapping(uuid,text)',                          array['postgres','service_role']),
      ('public.rseq_sync_detect_matchs_retires(uuid,uuid,text,uuid[])',       array['postgres','service_role'])
    ) as t(sig, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'NEXUS lot1/0 : ACL AVANT de % = %, attendu % — l''etat de depart n''est pas celui releve en prod',
        r.sig, vus, r.veut;
    end if;
  end loop;

  -- Les 22 lignes de veille sont cohérentes avec la clé à 2 arguments : on
  -- peut donc les RECALCULER avec la clé à 3 arguments sans rien perdre.
  select count(*) into v_n from public.rseq_watch_leagues
   where family_key is distinct from public.rseq_family_key(sport, division);
  if v_n <> 0 then
    raise exception 'NEXUS lot1/0 : % ligne(s) de rseq_watch_leagues incoherente(s) avec rseq_family_key', v_n;
  end if;

  -- Aucune alerte n'a déjà un préfixe de secteur (migration non rejouée).
  select count(*) into v_n from public.rseq_sync_alerts
   where family_key like '%|%|%';
  if v_n <> 0 then
    raise exception 'NEXUS lot1/0 : % alerte(s) portent deja une cle a 3 segments — migration deja passee ?', v_n;
  end if;

  -- Toutes les alertes existantes viennent de passes COLLÉGIALES : c'est ce
  -- qui autorise le préfixe `collégial|` en aveugle.
  select count(*) into v_n
    from public.rseq_sync_alerts a join public.rseq_sync_runs sr on sr.id = a.run_id
   where sr.secteur <> 'Collégial';
  if v_n <> 0 then
    raise exception 'NEXUS lot1/0 : % alerte(s) issues d''une passe non collegiale — prefixe collégial| injustifie', v_n;
  end if;

  -- Deux types d'alerte ENCODENT la family_key dans leur `cle` (index unique
  -- partiel). Relevé prod 2026-09-18 : zéro. S'il en apparaît d'ici l'apply,
  -- il faudra réécrire leur cle — on lève plutôt que de le faire à moitié.
  select count(*) into v_n from public.rseq_sync_alerts
   where type in ('CHANGEMENT_DIVISION', 'FAMILLE_ATTENDUE_ABSENTE');
  if v_n <> 0 then
    raise exception 'NEXUS lot1/0 : % alerte(s) CHANGEMENT_DIVISION / FAMILLE_ATTENDUE_ABSENTE dont la cle embarque une family_key a 2 segments', v_n;
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 1c (a). NOUVELLE CLÉ DE FAMILLE, À 3 ARGUMENTS
-- ════════════════════════════════════════════════════════════════════════════
-- Un secteur NULL rend une clé NULL, pas « |football|D3 » : une clé sans
-- secteur ne doit jamais pouvoir se confondre avec une vraie.
create function public.rseq_family_key(p_secteur text, p_sport text, p_division text)
returns text language sql immutable as $$
  select case
           when p_secteur is null then null
           else lower(p_secteur) || '|' ||
                case
                  when lower(coalesce(p_sport,'')) like 'ultimate%' then 'ultimate'
                  else lower(coalesce(p_sport,''))
                end || '|' || coalesce(nullif(p_division,''), '-')
         end;
$$;

comment on function public.rseq_family_key(text, text, text) is
  'Cle de famille stable d''une saison a l''autre : « collégial|volleyball|D1 », « secondaire|football|D3 ». '
  'Le secteur en tete : sans lui, le football D3 secondaire et collegial seraient la meme famille. '
  'ALIAS : « Ultimate » et « Ultimate frisbee » -> ultimate. Secteur NULL -> cle NULL.';

revoke all on function public.rseq_family_key(text, text, text) from public, anon;
grant execute on function public.rseq_family_key(text, text, text) to authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- 1a. CATALOGUE DES LIGUES PUBLIÉES + RPC DE DÉCOUVERTE
-- ════════════════════════════════════════════════════════════════════════════
-- Alimenté par le mode découverte de l'edge function (GetLeagueList). Une ligne
-- par GUID de ligue — les GUID changent à chaque saison, d'où `saison`.
-- Jamais de DELETE : une ligue qui disparaît de l'API est signalée
-- LIGUE_MUETTE par la passe ; l'effacer ici la ferait disparaître sans bruit.
create table public.rseq_ligues_publiees (
  rseq_league_id    uuid primary key,
  saison            text not null,
  secteur           text not null,
  sport             text not null,
  sport_code        integer,
  region            text,
  region_code       integer,
  division          text,
  category          text,
  sex_type          text,
  league_name       text,
  team_count        integer,
  is_master_league  boolean,
  school_year_id    uuid,
  premiere_vue_le   timestamptz not null default now(),
  derniere_vue_le   timestamptz not null default now()
);

create index rseq_ligues_publiees_saison_secteur_idx
  on public.rseq_ligues_publiees (saison, secteur);

comment on table public.rseq_ligues_publiees is
  'Catalogue des ligues RSEQ publiees (GetLeagueList), alimente par rseq_decouverte_upsert. '
  'Lu par la vue rseq_ligues_a_appeler, prioritaire sur games. Jamais de DELETE. '
  'RLS active, AUCUNE policy : service_role seulement.';

alter table public.rseq_ligues_publiees enable row level security;
revoke all on table public.rseq_ligues_publiees from anon, authenticated;


create function public.rseq_decouverte_upsert(p_ligues jsonb)
returns table (vues integer, nouvelles integer, modifiees integer)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_vus integer := coalesce(jsonb_array_length(p_ligues), 0);
  v_new integer := 0;
  v_maj integer := 0;
begin
  if v_vus = 0 then
    return query select 0, 0, 0;
    return;
  end if;

  with src as (
    select distinct on (x.rseq_league_id) x.*
    from jsonb_to_recordset(p_ligues) as x(
      rseq_league_id uuid, saison text, secteur text, sport text, sport_code integer,
      region text, region_code integer, division text, category text, sex_type text,
      league_name text, team_count integer, is_master_league boolean, school_year_id uuid
    )
    where x.rseq_league_id is not null
      and x.rseq_league_id <> '00000000-0000-0000-0000-000000000000'::uuid
    order by x.rseq_league_id
  ),
  avant as (
    select c.* from public.rseq_ligues_publiees c
    where c.rseq_league_id in (select rseq_league_id from src)
  ),
  up as (
    insert into public.rseq_ligues_publiees as c (
      rseq_league_id, saison, secteur, sport, sport_code, region, region_code,
      division, category, sex_type, league_name, team_count, is_master_league,
      school_year_id
    )
    select
      s.rseq_league_id, s.saison, s.secteur, s.sport, s.sport_code, s.region, s.region_code,
      s.division, s.category, s.sex_type, s.league_name, s.team_count, s.is_master_league,
      s.school_year_id
    from src s
    on conflict (rseq_league_id) do update set
      saison           = excluded.saison,
      secteur          = excluded.secteur,
      sport            = excluded.sport,
      sport_code       = excluded.sport_code,
      region           = excluded.region,
      region_code      = excluded.region_code,
      division         = excluded.division,
      category         = excluded.category,
      sex_type         = excluded.sex_type,
      league_name      = excluded.league_name,
      team_count       = excluded.team_count,
      is_master_league = excluded.is_master_league,
      school_year_id   = excluded.school_year_id,
      derniere_vue_le  = now()
    returning c.rseq_league_id, (xmax = 0) as nouvelle
  )
  select
    count(*) filter (where up.nouvelle)::int,
    count(*) filter (where not up.nouvelle and (
          a.saison, a.secteur, a.sport, a.sport_code, a.region, a.region_code,
          a.division, a.category, a.sex_type, a.league_name, a.team_count,
          a.is_master_league, a.school_year_id
        ) is distinct from (
          s.saison, s.secteur, s.sport, s.sport_code, s.region, s.region_code,
          s.division, s.category, s.sex_type, s.league_name, s.team_count,
          s.is_master_league, s.school_year_id
        ))::int
  into v_new, v_maj
  from up
  join src s on s.rseq_league_id = up.rseq_league_id
  left join avant a on a.rseq_league_id = up.rseq_league_id;

  return query select v_vus, coalesce(v_new, 0), coalesce(v_maj, 0);
end;
$$;

comment on function public.rseq_decouverte_upsert(jsonb) is
  'Upsert du catalogue rseq_ligues_publiees depuis GetLeagueList. INSERT/UPDATE seulement, jamais de DELETE. '
  'Retourne (vues, nouvelles, modifiees) — modifiees = metadonnees changees, pas un simple « revue ».';

revoke all on function public.rseq_decouverte_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.rseq_decouverte_upsert(jsonb) to service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- 1b. VUE rseq_ligues_a_appeler — UNION, DISTINCT ON, EXCLUSION
-- ════════════════════════════════════════════════════════════════════════════
-- Les 10 premières colonnes sont celles de la version précédente, dans le même
-- ordre (contrainte de CREATE OR REPLACE VIEW, et contrat de l'edge function).
-- `origine` est ajoutée en fin : 'catalogue' ou 'games'.
--
-- DISTINCT ON (rseq_league_id), catalogue d'abord : l'ancien DISTINCT portait
-- sur toutes les colonnes, et une métadonnée divergente entre games et le
-- catalogue aurait fait appeler la même ligue deux fois.
--
-- EXCLUSION plutôt que liste blanche : un sport inconnu qui arrive (le
-- basketball en octobre) entre tout seul ; s'il ne renvoie aucun match, il
-- lève LIGUE_MUETTE — ça se voit. Une liste blanche l'aurait ignoré en silence.
--
-- `with (security_invoker = true)` RESTATÉ ici (règle 10) : CREATE OR REPLACE
-- VIEW efface les reloptions que la nouvelle définition ne répète pas.
create or replace view public.rseq_ligues_a_appeler
with (security_invoker = true) as
with courante as (
  select case
           when extract(month from current_date) >= 7
             then extract(year from current_date)::int || '-' || (extract(year from current_date)::int + 1)
           else (extract(year from current_date)::int - 1) || '-' || extract(year from current_date)::int
         end as saison
),
sources as (
  select 1 as priorite, 'catalogue'::text as origine,
         c.rseq_league_id, c.saison, c.secteur as sector, c.sport, c.region,
         c.division, c.category, c.sex_type, c.league_name
  from public.rseq_ligues_publiees c
  join courante k on k.saison = c.saison
  union all
  select 2, 'games',
         g.rseq_league_id, g.season, g.sector, g.sport, g.region,
         g.division, g.category, g.sex_type, g.league_name
  from public.games g
  join courante k on k.saison = g.season
  where g.rseq_league_id is not null
)
select distinct on (s.rseq_league_id)
  s.rseq_league_id,
  s.saison,
  s.sector,
  s.sport,
  s.region,
  s.division,
  s.category,
  s.sex_type,
  s.league_name,
  public.rseq_family_key(s.sector, s.sport, s.division) as family_key,
  s.origine
from sources s
where s.sector in ('Collégial', 'Secondaire')
  and lower(coalesce(s.sport, '')) not in ('natation', 'cross-country')
order by s.rseq_league_id, s.priorite, s.league_name;

comment on view public.rseq_ligues_a_appeler is
  'Ligues RSEQ de la saison courante a interroger : collegial + secondaire, depuis games ET le catalogue '
  'rseq_ligues_publiees (prioritaire). Une ligne par ligue. Exclus : Primaire, Natation, Cross-country '
  '(liste d''EXCLUSION, pas blanche). Filtrer par `sector` : une passe par secteur.';


-- ════════════════════════════════════════════════════════════════════════════
-- 1c (b). DONNÉES : secteur sur la veille, préfixe sur les alertes
-- ════════════════════════════════════════════════════════════════════════════
alter table public.rseq_watch_leagues add column secteur text;

update public.rseq_watch_leagues
   set secteur    = 'Collégial',
       family_key = public.rseq_family_key('Collégial', sport, division),
       updated_at = now();

alter table public.rseq_watch_leagues
  alter column secteur set not null,
  add constraint rseq_watch_leagues_secteur_chk
    check (secteur in ('Collégial', 'Secondaire'));

comment on column public.rseq_watch_leagues.secteur is
  'Collégial ou Secondaire. Entre dans family_key (rseq_family_key a 3 arguments).';

-- Colonne ET payload : les deux portent la clé, les deux doivent la porter
-- au même format, sinon une recherche sur l'une ne retrouve pas l'autre.
update public.rseq_sync_alerts
   set family_key = 'collégial|' || family_key
 where family_key is not null;

update public.rseq_sync_alerts
   set payload = jsonb_set(payload, '{family_key}',
                           to_jsonb('collégial|' || (payload->>'family_key')))
 where jsonb_typeof(payload->'family_key') = 'string';


-- ════════════════════════════════════════════════════════════════════════════
-- 1c (c). AMORCE DES FAMILLES SECONDAIRES
-- ════════════════════════════════════════════════════════════════════════════
-- Familles = celles jouées la saison passée (attendu_vers = leur 1er match)
-- ∪ celles déjà publiées cette saison (games + catalogue). Même exclusion que
-- la vue. Statut et nb_ligues calculés depuis la vue, pour que la table dise
-- vrai avant la première passe ; detect_familles les tient à jour ensuite.
with saisons as (
  select s.courante,
         (split_part(s.courante, '-', 1)::int - 1) || '-' || split_part(s.courante, '-', 1) as passee
  from (select case
                 when extract(month from current_date) >= 7
                   then extract(year from current_date)::int || '-' || (extract(year from current_date)::int + 1)
                 else (extract(year from current_date)::int - 1) || '-' || extract(year from current_date)::int
               end as courante) s
),
vues as (
  select g.sport, nullif(g.division, '') as division, g.game_date, (g.season = k.passee) as passee
  from public.games g, saisons k
  where g.sector = 'Secondaire' and g.rseq_league_id is not null
    and g.season in (k.passee, k.courante)
  union all
  select c.sport, nullif(c.division, ''), null::date, false
  from public.rseq_ligues_publiees c, saisons k
  where c.secteur = 'Secondaire' and c.saison = k.courante
),
familles as (
  select public.rseq_family_key('Secondaire', v.sport, v.division) as family_key,
         min(v.sport) as sport,
         min(v.division) as division,
         min(v.game_date) filter (where v.passee) as attendu_vers
  from vues v
  where lower(coalesce(v.sport, '')) not in ('natation', 'cross-country')
  group by 1
),
publiees as (
  select family_key, count(*)::int as n
  from public.rseq_ligues_a_appeler
  where sector = 'Secondaire'
  group by family_key
)
insert into public.rseq_watch_leagues
  (family_key, secteur, sport, division, saison, statut, nb_ligues, attendu_vers, last_ok_at)
select f.family_key, 'Secondaire', f.sport, f.division, k.courante,
       case when coalesce(p.n, 0) > 0 then 'ACTIVE' else 'DORMANTE' end,
       coalesce(p.n, 0), f.attendu_vers,
       case when coalesce(p.n, 0) > 0 then now() end
from familles f
cross join saisons k
left join publiees p on p.family_key = f.family_key
on conflict (family_key) do nothing;


-- ════════════════════════════════════════════════════════════════════════════
-- 1d. p_secteur SUR LES 4 RPC (DROP + CREATE)
-- ════════════════════════════════════════════════════════════════════════════
-- Pas de valeur par défaut pour p_secteur : un défaut 'Collégial' referait
-- exactement le défaut qu'on corrige (le secteur écrit en dur), en silence,
-- pour tout appelant secondaire qui l'oublierait.

-- ── apply_standings ─────────────────────────────────────────────────────────
drop function public.rseq_sync_apply_standings(uuid, uuid, text, jsonb);

create function public.rseq_sync_apply_standings(
  p_run_id    uuid,
  p_league_id uuid,
  p_saison    text,
  p_secteur   text,
  p_standings jsonb
) returns table (vus integer, inseres integer, maj integer)
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_ins integer := 0;
  v_maj integer := 0;
  v_vus integer := coalesce(jsonb_array_length(p_standings), 0);
begin
  if p_secteur is null or p_secteur not in ('Collégial', 'Secondaire') then
    raise exception 'rseq_sync_apply_standings : secteur invalide « % »', p_secteur;
  end if;

  if v_vus = 0 then
    return query select 0, 0, 0;
    return;
  end if;

  with src as (
    select * from jsonb_to_recordset(p_standings) as x(
      rseq_standings_id uuid, rseq_team_id uuid, season_type integer,
      team_code text, team_name text, pool text, section_id uuid,
      "position" integer, position_formatted text, pool_position text,
      games_played integer, wins integer, wins_overtime integer,
      wins_shootout integer, losses integer, losses_overtime integer,
      losses_shootout integer, draws integer,
      set_wins integer, set_losses integer,
      half_wins integer, half_losses integer, half_draws integer,
      points_for integer, points_against integer,
      goals_for integer, goals_against integer,
      average numeric, average_formatted text,
      average_points numeric, average_pts_formatted text,
      diff1 numeric, diff2 numeric, diff2_formatted text, plus_minus integer,
      league_points integer, ethics_points integer, bonus_points integer,
      total_points integer, number_forfeits integer,
      set_detail jsonb, show_flags jsonb
    )
  ),
  resolu as (
    select s.*, t.id as team_id
    from src s
    left join public.teams t on t.rseq_team_id = s.rseq_team_id
  ),
  avant as (
    select st.rseq_team_id, st.season_type, st.position, st.games_played,
           st.wins, st.losses, st.draws, st.total_points
    from public.rseq_standings st
    where st.rseq_league_id = p_league_id
      and st.rseq_team_id in (select rseq_team_id from src)
  ),
  up as (
    insert into public.rseq_standings (
      rseq_league_id, rseq_team_id, rseq_standings_id, team_id,
      saison, secteur, season_type,
      team_code, team_name, pool, section_id,
      position, position_formatted, pool_position,
      games_played, wins, wins_overtime, wins_shootout,
      losses, losses_overtime, losses_shootout, draws,
      set_wins, set_losses, half_wins, half_losses, half_draws,
      points_for, points_against, goals_for, goals_against,
      average, average_formatted, average_points, average_pts_formatted,
      diff1, diff2, diff2_formatted, plus_minus,
      league_points, ethics_points, bonus_points, total_points, number_forfeits,
      set_detail, show_flags, updated_at
    )
    select
      p_league_id, r.rseq_team_id, r.rseq_standings_id, r.team_id,
      p_saison, p_secteur, coalesce(r.season_type, 1),
      r.team_code, r.team_name, r.pool, r.section_id,
      r.position, r.position_formatted, r.pool_position,
      r.games_played, r.wins, r.wins_overtime, r.wins_shootout,
      r.losses, r.losses_overtime, r.losses_shootout, r.draws,
      r.set_wins, r.set_losses, r.half_wins, r.half_losses, r.half_draws,
      r.points_for, r.points_against, r.goals_for, r.goals_against,
      r.average, r.average_formatted, r.average_points, r.average_pts_formatted,
      r.diff1, r.diff2, r.diff2_formatted, r.plus_minus,
      r.league_points, r.ethics_points, r.bonus_points, r.total_points,
      r.number_forfeits,
      coalesce(r.set_detail, '{}'::jsonb), coalesce(r.show_flags, '{}'::jsonb),
      now()
    from resolu r
    on conflict (rseq_league_id, rseq_team_id, season_type) do update set
      rseq_standings_id     = excluded.rseq_standings_id,
      team_id               = excluded.team_id,
      saison                = excluded.saison,
      team_code             = excluded.team_code,
      team_name             = excluded.team_name,
      pool                  = excluded.pool,
      section_id            = excluded.section_id,
      position              = excluded.position,
      position_formatted    = excluded.position_formatted,
      pool_position         = excluded.pool_position,
      games_played          = excluded.games_played,
      wins                  = excluded.wins,
      wins_overtime         = excluded.wins_overtime,
      wins_shootout         = excluded.wins_shootout,
      losses                = excluded.losses,
      losses_overtime       = excluded.losses_overtime,
      losses_shootout       = excluded.losses_shootout,
      draws                 = excluded.draws,
      set_wins              = excluded.set_wins,
      set_losses            = excluded.set_losses,
      half_wins             = excluded.half_wins,
      half_losses           = excluded.half_losses,
      half_draws            = excluded.half_draws,
      points_for            = excluded.points_for,
      points_against        = excluded.points_against,
      goals_for             = excluded.goals_for,
      goals_against         = excluded.goals_against,
      average               = excluded.average,
      average_formatted     = excluded.average_formatted,
      average_points        = excluded.average_points,
      average_pts_formatted = excluded.average_pts_formatted,
      diff1                 = excluded.diff1,
      diff2                 = excluded.diff2,
      diff2_formatted       = excluded.diff2_formatted,
      plus_minus            = excluded.plus_minus,
      league_points         = excluded.league_points,
      ethics_points         = excluded.ethics_points,
      bonus_points          = excluded.bonus_points,
      total_points          = excluded.total_points,
      number_forfeits       = excluded.number_forfeits,
      set_detail            = excluded.set_detail,
      show_flags            = excluded.show_flags,
      updated_at            = now()
    where
         rseq_standings.position          is distinct from excluded.position
      or rseq_standings.games_played      is distinct from excluded.games_played
      or rseq_standings.wins              is distinct from excluded.wins
      or rseq_standings.losses            is distinct from excluded.losses
      or rseq_standings.draws             is distinct from excluded.draws
      or rseq_standings.wins_overtime     is distinct from excluded.wins_overtime
      or rseq_standings.wins_shootout     is distinct from excluded.wins_shootout
      or rseq_standings.losses_overtime   is distinct from excluded.losses_overtime
      or rseq_standings.losses_shootout   is distinct from excluded.losses_shootout
      or rseq_standings.set_wins          is distinct from excluded.set_wins
      or rseq_standings.set_losses        is distinct from excluded.set_losses
      or rseq_standings.points_for        is distinct from excluded.points_for
      or rseq_standings.points_against    is distinct from excluded.points_against
      or rseq_standings.goals_for         is distinct from excluded.goals_for
      or rseq_standings.goals_against     is distinct from excluded.goals_against
      or rseq_standings.total_points      is distinct from excluded.total_points
      or rseq_standings.league_points     is distinct from excluded.league_points
      or rseq_standings.bonus_points      is distinct from excluded.bonus_points
      or rseq_standings.ethics_points     is distinct from excluded.ethics_points
      or rseq_standings.number_forfeits   is distinct from excluded.number_forfeits
      or rseq_standings.team_id           is distinct from excluded.team_id
      or rseq_standings.team_name         is distinct from excluded.team_name
      or rseq_standings.pool              is distinct from excluded.pool
      or rseq_standings.show_flags        is distinct from excluded.show_flags
      or rseq_standings.set_detail        is distinct from excluded.set_detail
    returning
      rseq_standings.id,
      rseq_standings.rseq_team_id,
      rseq_standings.season_type,
      (xmax = 0) as insere,
      rseq_standings.team_name,
      rseq_standings.position,
      rseq_standings.wins, rseq_standings.losses,
      rseq_standings.draws, rseq_standings.games_played
  ),
  j as (
    insert into public.rseq_sync_changes
      (run_id, entite, entite_id, rseq_league_id, operation, resume, avant, apres)
    select
      p_run_id, 'standing', up.id, p_league_id,
      case when up.insere then 'INSERT' else 'UPDATE' end,
      case
        when up.insere then
          'classement initial ' || coalesce(up.team_name,'?') || ' rang ' ||
          coalesce(up.position::text,'?')
        when a.position is distinct from up.position then
          coalesce(up.team_name,'?') || ' rang ' || coalesce(a.position::text,'?') ||
          ' -> ' || coalesce(up.position::text,'?')
        else
          coalesce(up.team_name,'?') || ' fiche ' ||
          coalesce(up.wins::text,'0') || '-' || coalesce(up.losses::text,'0') ||
          case when coalesce(up.draws,0) > 0 then '-' || up.draws::text else '' end
      end,
      case when up.insere then null else to_jsonb(a.*) end,
      jsonb_build_object(
        'position', up.position, 'games_played', up.games_played,
        'wins', up.wins, 'losses', up.losses, 'draws', up.draws
      )
    from up left join avant a
      on a.rseq_team_id = up.rseq_team_id
     and a.season_type  = up.season_type
    returning operation
  )
  select
    count(*) filter (where operation = 'INSERT')::int,
    count(*) filter (where operation = 'UPDATE')::int
  into v_ins, v_maj
  from j;

  return query select v_vus, coalesce(v_ins, 0), coalesce(v_maj, 0);
end;
$function$;

revoke all on function public.rseq_sync_apply_standings(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.rseq_sync_apply_standings(uuid, uuid, text, text, jsonb) to service_role;


-- ── detect_teams ────────────────────────────────────────────────────────────
-- COLLÉGIAL : inchangé — une alerte NOUVELLE_EQUIPE par équipe.
-- SECONDAIRE : une alerte NOUVELLES_EQUIPES par sport × région, les équipes en
--   liste dans payload.equipes. ~1 000 équipes déclarées, 209 connues : sans
--   agrégation, le premier passage en lèverait ~800 à traiter une par une.
--   · Plusieurs ligues d'un même sport × région tombent dans la MÊME alerte
--     ouverte : l'ON CONFLICT ajoute à la liste au lieu de rien faire.
--   · DÉDOUBLONNAGE PAR CONTAINMENT : une équipe déjà listée dans une alerte
--     NOUVELLES_EQUIPES, QUEL QUE SOIT SON STATUT, n'est plus jamais relistée.
--     Sans ça, marquer l'alerte traitée sans importer les équipes les ferait
--     toutes revenir le mercredi suivant. Index GIN partiel ci-dessous.
--   · Retour : les alertes CRÉÉES seulement. Un ajout à une alerte déjà
--     ouverte n'en crée pas une nouvelle et n'est pas compté.
drop function public.rseq_sync_detect_teams(uuid, uuid, text, text, jsonb);

create function public.rseq_sync_detect_teams(
  p_run_id     uuid,
  p_league_id  uuid,
  p_family_key text,
  p_saison     text,
  p_secteur    text,
  p_teams      jsonb
) returns integer
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_n      integer := 0;
  v_sport  text;
  v_region text;
  v_cle    text;
begin
  if p_secteur is null or p_secteur not in ('Collégial', 'Secondaire') then
    raise exception 'rseq_sync_detect_teams : secteur invalide « % »', p_secteur;
  end if;

  if coalesce(jsonb_array_length(p_teams), 0) = 0 then
    return 0;
  end if;

  if p_secteur = 'Secondaire' then
    select v.sport, v.region into v_sport, v_region
      from public.rseq_ligues_a_appeler v
     where v.rseq_league_id = p_league_id
     limit 1;
    if v_sport is null then
      select max(g.sport), max(g.region) into v_sport, v_region
        from public.games g where g.rseq_league_id = p_league_id;
    end if;
    -- Segment « sport » de la clé de famille : même alias Ultimate.
    v_cle := 'secondaire|' ||
             split_part(public.rseq_family_key(p_secteur, v_sport, null), '|', 2) || '|' ||
             coalesce(v_region, '?') || '|' || p_saison;
  end if;

  with src as (
    select distinct on (x.rseq_team_id) x.*
    from jsonb_to_recordset(p_teams) as x(
      rseq_team_id uuid, team_name text, team_code text,
      rseq_institution_id uuid, team_pseudonym text, vu_dans_teams boolean
    )
    where x.rseq_team_id is not null
      and x.rseq_team_id <> '00000000-0000-0000-0000-000000000000'::uuid
    order by x.rseq_team_id
  ),
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
    where p_secteur = 'Collégial'
      and not exists (
        select 1 from public.teams t where t.rseq_team_id = s.rseq_team_id
      )
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  ),
  nouvelles as (
    select
      jsonb_agg(jsonb_build_object(
        'rseq_team_id', s.rseq_team_id,
        'team_name', s.team_name, 'team_code', s.team_code,
        'team_pseudonym', s.team_pseudonym,
        'rseq_institution_id', s.rseq_institution_id,
        'school_id', sc.id, 'ecole', sc.name,
        'ecole_prouvee', (sc.id is not null),
        'source', case when coalesce(s.vu_dans_teams, false) then 'Teams[]' else 'matchs' end,
        'rseq_league_id', p_league_id,
        'family_key', p_family_key
      ) order by s.team_name, s.rseq_team_id) as equipes,
      count(*)::int as n
    from src s
    left join lateral (
      select x.id, x.name from public.schools x
       where x.rseq_institution_id = s.rseq_institution_id
       limit 1
    ) sc on true
    where p_secteur = 'Secondaire'
      and not exists (
        select 1 from public.teams t where t.rseq_team_id = s.rseq_team_id
      )
      and not exists (
        select 1 from public.rseq_sync_alerts a
         where a.type = 'NOUVELLES_EQUIPES'
           and a.payload @> jsonb_build_object('equipes',
                 jsonb_build_array(jsonb_build_object('rseq_team_id', s.rseq_team_id)))
      )
  ),
  agrege as (
    insert into public.rseq_sync_alerts as al
      (run_id, type, cle, resume, payload)
    select
      p_run_id, 'NOUVELLES_EQUIPES', v_cle,
      coalesce(v_sport, '?') || ' secondaire — ' || coalesce(v_region, '?') || ' : ' ||
      n.n || ' equipe(s) a importer, ' ||
      (select count(*) from jsonb_array_elements(n.equipes) e
        where (e->>'ecole_prouvee')::boolean) || ' ecole(s) prouvee(s) par InstitutionId',
      jsonb_build_object(
        'secteur', p_secteur, 'sport', v_sport, 'region', v_region,
        'saison', p_saison, 'equipes', n.equipes
      )
    from nouvelles n
    where n.n > 0
    on conflict (type, cle) where statut = 'OUVERTE' do update set
      payload = jsonb_set(al.payload, '{equipes}',
                          (al.payload->'equipes') || (excluded.payload->'equipes')),
      resume  = coalesce(v_sport, '?') || ' secondaire — ' || coalesce(v_region, '?') || ' : ' ||
                jsonb_array_length((al.payload->'equipes') || (excluded.payload->'equipes')) ||
                ' equipe(s) a importer, ' ||
                (select count(*) from jsonb_array_elements(
                   (al.payload->'equipes') || (excluded.payload->'equipes')) e
                  where (e->>'ecole_prouvee')::boolean) ||
                ' ecole(s) prouvee(s) par InstitutionId'
    returning (xmax = 0) as creee
  ),
  connues as (
    select t.id as team_id, s.rseq_team_id, s.team_name, t.division as div_connue
    from src s
    join public.teams t on t.rseq_team_id = s.rseq_team_id
  ),
  familles_connues as (
    select c.team_id, c.rseq_team_id, c.team_name,
           array_agg(distinct public.rseq_family_key(g.sector, g.sport, g.division)) as familles
    from connues c
    join public.games g
      on g.home_rseq_team_id = c.rseq_team_id
      or g.visitor_rseq_team_id = c.rseq_team_id
    where g.sector = p_secteur
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
  ),
  mapping as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, rseq_league_id, rseq_team_id, rseq_institution_id,
       family_key, team_id, school_id, resume, payload)
    select
      p_run_id, 'MAPPING_DERIVE',
      s.rseq_team_id::text || '|institution',
      p_league_id, s.rseq_team_id, s.rseq_institution_id, p_family_key,
      t.id, t.school_id,
      coalesce(s.team_name, '?') || ' — ' ||
      case
        when sc.id is null then
          'InstitutionId ' || s.rseq_institution_id::text ||
          ' INCONNU de schools ; equipe rattachee a « ' || coalesce(ec.name,'?') ||
          ' », dont le pont d''ecole est absent'
        else
          'InstitutionId pointe « ' || sc.name ||
          ' » alors que l''equipe est rattachee a « ' || coalesce(ec.name,'?') || ' »'
      end,
      jsonb_build_object(
        'cas', case when sc.id is null then 'C_institution_inconnue' else 'B_institution_divergente' end,
        'team_name', s.team_name,
        'rseq_institution_id', s.rseq_institution_id,
        'ecole_actuelle', ec.name,
        'ecole_publiee', sc.name,
        'family_key', p_family_key, 'saison', p_saison
      )
    from src s
    join public.teams t   on t.rseq_team_id = s.rseq_team_id
    left join public.schools ec on ec.id = t.school_id
    left join public.schools sc on sc.rseq_institution_id = s.rseq_institution_id
    where s.rseq_institution_id is not null
      and (sc.id is null or sc.id is distinct from t.school_id)
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  )
  select (select count(*) from inconnues)
       + (select count(*) from agrege where creee)
       + (select count(*) from derive)
       + (select count(*) from mapping)
  into v_n;

  return coalesce(v_n, 0);
end;
$function$;

revoke all on function public.rseq_sync_detect_teams(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.rseq_sync_detect_teams(uuid, uuid, text, text, text, jsonb) to service_role;

-- Le containment ci-dessus s'écrit `payload @> {"equipes":[{…}]}` précisément
-- pour que cet index serve (jsonb_path_ops ne sert que @>).
create index rseq_sync_alerts_nouvelles_equipes_gin
  on public.rseq_sync_alerts using gin (payload jsonb_path_ops)
  where type = 'NOUVELLES_EQUIPES';


-- ── detect_familles ─────────────────────────────────────────────────────────
-- Ne touche QUE les familles de son secteur : la passe secondaire ne doit pas
-- passer les familles collégiales en DORMANTE (elles sont absentes de SA
-- tranche de la vue), et réciproquement.
drop function public.rseq_sync_detect_familles(uuid, text);

create function public.rseq_sync_detect_familles(
  p_run_id  uuid,
  p_saison  text,
  p_secteur text
) returns integer
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_n integer := 0;
begin
  if p_secteur is null or p_secteur not in ('Collégial', 'Secondaire') then
    raise exception 'rseq_sync_detect_familles : secteur invalide « % »', p_secteur;
  end if;

  update public.rseq_watch_leagues w
     set nb_ligues = coalesce(v.n, 0),
         statut    = case when coalesce(v.n, 0) > 0 then 'ACTIVE' else 'DORMANTE' end,
         saison    = p_saison,
         last_ok_at = case when coalesce(v.n, 0) > 0 then now() else w.last_ok_at end,
         updated_at = now()
  from (
    select family_key, count(*)::int as n
    from public.rseq_ligues_a_appeler
    where sector = p_secteur
    group by family_key
  ) v
  where v.family_key = w.family_key
    and w.secteur = p_secteur;

  update public.rseq_watch_leagues w
     set nb_ligues = 0,
         statut = 'DORMANTE',
         updated_at = now()
   where w.secteur = p_secteur
     and not exists (
       select 1 from public.rseq_ligues_a_appeler v
        where v.sector = p_secteur and v.family_key = w.family_key
     );

  with ins as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, family_key, resume, payload)
    select
      p_run_id, 'FAMILLE_ATTENDUE_ABSENTE',
      w.family_key || '|' || p_saison,
      w.family_key,
      w.sport || coalesce(' ' || w.division, '') || ' (' || lower(w.secteur) || ')' ||
      ' n''est toujours pas publiee (la saison passee, premier match le ' ||
      coalesce(w.attendu_vers::text, '?') || ')',
      jsonb_build_object(
        'secteur', w.secteur,
        'sport', w.sport, 'division', w.division,
        'attendu_vers', w.attendu_vers, 'saison', p_saison
      )
    from public.rseq_watch_leagues w
    where w.secteur = p_secteur
      and w.statut = 'DORMANTE'
      and w.attendu_vers is not null
      and (w.attendu_vers + interval '1 year')::date <= current_date
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  )
  select coalesce((select count(*)::int from ins), 0) into v_n;

  return coalesce(v_n, 0);
end;
$function$;

revoke all on function public.rseq_sync_detect_familles(uuid, text, text) from public, anon, authenticated;
grant execute on function public.rseq_sync_detect_familles(uuid, text, text) to service_role;


-- ── detect_mapping ──────────────────────────────────────────────────────────
-- Le type d'établissement suit le secteur : CEGEP ou SECONDAIRE. Les clubs
-- civils (LIGUE_CIVILE) ne sont jamais concernés.
drop function public.rseq_sync_detect_mapping(uuid, text);

create function public.rseq_sync_detect_mapping(
  p_run_id  uuid,
  p_saison  text,
  p_secteur text
) returns integer
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_n    integer := 0;
  v_type text;
begin
  v_type := case p_secteur
              when 'Collégial'  then 'CEGEP'
              when 'Secondaire' then 'SECONDAIRE'
            end;
  if v_type is null then
    raise exception 'rseq_sync_detect_mapping : secteur invalide « % »', p_secteur;
  end if;

  if not exists (select 1 from public.rseq_ligues_a_appeler where sector = p_secteur) then
    return 0;
  end if;

  with ins as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, rseq_team_id, team_id, school_id, family_key, resume, payload)
    select
      p_run_id, 'MAPPING_DERIVE',
      t.id::text || '|absente|' || p_saison,
      t.rseq_team_id, t.id, t.school_id,
      public.rseq_family_key(p_secteur, sp.nom, t.division),
      coalesce(s.name, '?') || ' — ' || coalesce(sp.nom, '?') ||
      coalesce(' ' || t.gender, '') || coalesce(' ' || nullif(t.division,''), '') ||
      ' : equipe pontee mais ABSENTE de toute ligue ' || p_saison,
      jsonb_build_object(
        'cas', 'A_absente_des_ligues',
        'rseq_team_id', t.rseq_team_id,
        'ecole', s.name, 'sport', sp.nom,
        'genre', t.gender, 'division', t.division,
        'secteur', p_secteur,
        'saison', p_saison
      )
    from public.teams t
    join public.schools s on s.id = t.school_id
    left join public.sports sp on sp.id = t.sport_id
    where s.type = v_type
      and t.season = p_saison
      and t.rseq_team_id is not null
      and not exists (
        select 1 from public.games g
        where g.sector = p_secteur and g.season = p_saison
          and (g.home_rseq_team_id = t.rseq_team_id
            or g.visitor_rseq_team_id = t.rseq_team_id)
      )
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  )
  select coalesce((select count(*)::int from ins), 0) into v_n;

  return coalesce(v_n, 0);
end;
$function$;

revoke all on function public.rseq_sync_detect_mapping(uuid, text, text) from public, anon, authenticated;
grant execute on function public.rseq_sync_detect_mapping(uuid, text, text) to service_role;


-- ── detect_matchs_retires : signature INCHANGÉE, clé de famille à 3 args ────
-- CREATE OR REPLACE : l'ACL survit. Le gate final le vérifie quand même.
create or replace function public.rseq_sync_detect_matchs_retires(
  p_run_id    uuid,
  p_league_id uuid,
  p_saison    text,
  p_vus       uuid[]
) returns integer
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  SEUIL_MASSE constant numeric := 0.40;
  v_base      integer;
  v_manquants integer;
  v_n         integer := 0;
begin
  if p_vus is null or coalesce(array_length(p_vus, 1), 0) = 0 then
    return 0;
  end if;

  select count(*) into v_base
  from public.games g
  where g.rseq_league_id = p_league_id and g.season = p_saison;

  if v_base = 0 then
    return 0;
  end if;

  select count(*) into v_manquants
  from public.games g
  where g.rseq_league_id = p_league_id and g.season = p_saison
    and not (g.rseq_game_id = any(p_vus));

  if v_manquants = 0 then
    return 0;
  end if;

  if v_manquants::numeric / v_base > SEUIL_MASSE then
    with ins as (
      insert into public.rseq_sync_alerts
        (run_id, type, cle, rseq_league_id, family_key, resume, payload)
      select
        p_run_id, 'MATCH_RETIRE',
        p_league_id::text || '|retrait-masse|' || p_saison,
        p_league_id,
        (select public.rseq_family_key(max(g.sector), max(g.sport), max(g.division))
           from public.games g where g.rseq_league_id = p_league_id),
        'RETRAIT DE MASSE — ' || v_manquants || ' des ' || v_base ||
        ' matchs de « ' ||
        coalesce((select max(g.league_name) from public.games g
                   where g.rseq_league_id = p_league_id), p_league_id::text) ||
        ' » ne sont plus servis par l''API (' ||
        round(100.0 * v_manquants / v_base) || ' %). Ligue reorganisee, ou source en cause.',
        jsonb_build_object(
          'cas', 'retrait_de_masse',
          'manquants', v_manquants, 'base', v_base,
          'proportion', round(100.0 * v_manquants / v_base),
          'seuil_pct', 40, 'saison', p_saison
        )
      on conflict (type, cle) where statut = 'OUVERTE' do nothing
      returning 1
    )
    select coalesce((select count(*)::int from ins), 0) into v_n;

  else
    with ins as (
      insert into public.rseq_sync_alerts
        (run_id, type, cle, rseq_league_id, family_key, resume, payload)
      select
        p_run_id, 'MATCH_RETIRE',
        g.rseq_game_id::text || '|retire',
        p_league_id,
        public.rseq_family_key(g.sector, g.sport, g.division),
        'Match retire du calendrier RSEQ : ' ||
        coalesce(g.home_name_raw,'?') || ' c. ' || coalesce(g.visitor_name_raw,'?') ||
        ' le ' || coalesce(g.game_date::text,'date inconnue') ||
        ' (' || coalesce(g.league_name,'?') || ')' ||
        case when g.is_played then ' — ATTENTION : ce match etait marque JOUE'
             else '' end,
        jsonb_build_object(
          'cas', 'retrait_ponctuel',
          'rseq_game_id', g.rseq_game_id,
          'game_date', g.game_date,
          'domicile', g.home_name_raw, 'visiteur', g.visitor_name_raw,
          'etait_joue', g.is_played,
          'score', case when g.is_played
                        then g.home_score::text || '-' || g.visitor_score::text
                        else null end,
          'league_name', g.league_name,
          'manquants_dans_la_ligue', v_manquants, 'base', v_base,
          'saison', p_saison
        )
      from public.games g
      where g.rseq_league_id = p_league_id and g.season = p_saison
        and not (g.rseq_game_id = any(p_vus))
      on conflict (type, cle) where statut = 'OUVERTE' do nothing
      returning 1
    )
    select coalesce((select count(*)::int from ins), 0) into v_n;
  end if;

  return coalesce(v_n, 0);
end;
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- 1c (d). SUPPRESSION DE L'ANCIENNE CLÉ À 2 ARGUMENTS
-- ════════════════════════════════════════════════════════════════════════════
-- En dernier : la vue ne dépend plus d'elle. Sans CASCADE — si un objet en
-- dépend encore, le DROP échoue et la migration entière est annulée.
drop function public.rseq_family_key(text, text);


-- ════════════════════════════════════════════════════════════════════════════
-- GATES
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  vus   text[];
  veut  text[];
  v_n   int;
  r     record;
begin
  -- ── ACL : liste COMPLÈTE triée, jamais par inclusion ─────────────────────
  for r in
    select * from (values
      ('public.rseq_family_key(text,text,text)',                              array['authenticated','postgres','service_role']),
      ('public.rseq_decouverte_upsert(jsonb)',                                array['postgres','service_role']),
      ('public.rseq_sync_apply_standings(uuid,uuid,text,text,jsonb)',         array['postgres','service_role']),
      ('public.rseq_sync_detect_teams(uuid,uuid,text,text,text,jsonb)',       array['postgres','service_role']),
      ('public.rseq_sync_detect_familles(uuid,text,text)',                    array['postgres','service_role']),
      ('public.rseq_sync_detect_mapping(uuid,text,text)',                     array['postgres','service_role']),
      ('public.rseq_sync_detect_matchs_retires(uuid,uuid,text,uuid[])',       array['postgres','service_role'])
    ) as t(sig, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'NEXUS lot1 : ACL de % = %, attendu %', r.sig, vus, r.veut;
    end if;
  end loop;

  -- ── Une seule signature par nom : aucune surcharge résiduelle ─────────────
  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) into vus
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('rseq_family_key','rseq_decouverte_upsert','rseq_sync_apply_standings',
                       'rseq_sync_detect_teams','rseq_sync_detect_familles','rseq_sync_detect_mapping',
                       'rseq_sync_detect_matchs_retires');
  veut := array[
    'rseq_decouverte_upsert(jsonb)',
    'rseq_family_key(text,text,text)',
    'rseq_sync_apply_standings(uuid,uuid,text,text,jsonb)',
    'rseq_sync_detect_familles(uuid,text,text)',
    'rseq_sync_detect_mapping(uuid,text,text)',
    'rseq_sync_detect_matchs_retires(uuid,uuid,text,uuid[])',
    'rseq_sync_detect_teams(uuid,uuid,text,text,text,jsonb)'
  ];
  if vus is distinct from veut then
    raise exception 'NEXUS lot1 : signatures = %, attendu %', vus, veut;
  end if;

  -- ── Appelants de rseq_family_key : liste COMPLÈTE ─────────────────────────
  -- Un corps plpgsql ne crée aucune dépendance : le DROP de l'ancienne clé ne
  -- protège que la vue. Si un appelant apparaît hors de cette liste, il faut
  -- l'instruire ici, pas le découvrir un mercredi.
  select array_agg(p.proname::text order by p.proname) into vus
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname <> 'rseq_family_key'
     and p.prosrc like '%rseq_family_key%';
  veut := array['rseq_sync_detect_mapping','rseq_sync_detect_matchs_retires','rseq_sync_detect_teams'];
  if vus is distinct from veut then
    raise exception 'NEXUS lot1 : appelants de rseq_family_key = %, attendu %', vus, veut;
  end if;

  -- ── Catalogue : RLS, zéro policy, ACL complète ────────────────────────────
  if not (select relrowsecurity from pg_class where oid = 'public.rseq_ligues_publiees'::regclass) then
    raise exception 'NEXUS lot1 : RLS inactive sur rseq_ligues_publiees';
  end if;
  select count(*) into v_n from pg_policy where polrelid = 'public.rseq_ligues_publiees'::regclass;
  if v_n <> 0 then
    raise exception 'NEXUS lot1 : % policy(s) sur rseq_ligues_publiees, attendu 0', v_n;
  end if;
  select array_agg(distinct t.g order by t.g) into vus
    from pg_class c,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.rseq_ligues_publiees'::regclass;
  if vus is distinct from array['postgres','service_role'] then
    raise exception 'NEXUS lot1 : ACL de rseq_ligues_publiees = %, attendu {postgres,service_role}', vus;
  end if;

  -- ── Vue : security_invoker conservé ───────────────────────────────────────
  if not coalesce((select 'security_invoker=true' = any(reloptions) from pg_class
                    where oid = 'public.rseq_ligues_a_appeler'::regclass), false) then
    raise exception 'NEXUS lot1 : rseq_ligues_a_appeler a perdu security_invoker';
  end if;

  -- ── Vue : une ligne par ligue, rien d'exclu qui passe ─────────────────────
  select count(*) - count(distinct rseq_league_id) into v_n from public.rseq_ligues_a_appeler;
  if v_n <> 0 then
    raise exception 'NEXUS lot1 : % doublon(s) de ligue dans rseq_ligues_a_appeler', v_n;
  end if;
  select count(*) into v_n from public.rseq_ligues_a_appeler
   where sector not in ('Collégial','Secondaire')
      or lower(sport) in ('natation','cross-country')
      or family_key is null;
  if v_n <> 0 then
    raise exception 'NEXUS lot1 : % ligne(s) hors perimetre dans rseq_ligues_a_appeler', v_n;
  end if;

  -- ── Veille : chaque clé est la clé calculée de sa ligne ───────────────────
  select count(*) into v_n from public.rseq_watch_leagues
   where family_key is distinct from public.rseq_family_key(secteur, sport, division);
  if v_n <> 0 then
    raise exception 'NEXUS lot1 : % ligne(s) de rseq_watch_leagues incoherente(s)', v_n;
  end if;
  select count(*) into v_n from public.rseq_watch_leagues where secteur = 'Collégial';
  if v_n = 0 then
    raise exception 'NEXUS lot1 : plus aucune famille collegiale dans rseq_watch_leagues';
  end if;

  -- ── Alertes : plus aucune clé à 2 segments ────────────────────────────────
  select count(*) into v_n from public.rseq_sync_alerts
   where (family_key is not null and family_key not like 'collégial|%|%' and family_key not like 'secondaire|%|%')
      or (jsonb_typeof(payload->'family_key') = 'string'
          and payload->>'family_key' not like 'collégial|%|%'
          and payload->>'family_key' not like 'secondaire|%|%');
  if v_n <> 0 then
    raise exception 'NEXUS lot1 : % alerte(s) gardent une family_key sans secteur', v_n;
  end if;

  raise notice 'NEXUS lot1 : gates OK — ACL (7 fonctions), signatures uniques, appelants, catalogue, vue, veille (% familles : % collegiales, % secondaires), alertes',
    (select count(*) from public.rseq_watch_leagues),
    (select count(*) from public.rseq_watch_leagues where secteur = 'Collégial'),
    (select count(*) from public.rseq_watch_leagues where secteur = 'Secondaire');
end $$;
