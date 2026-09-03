-- 20260902213000_rseq_detect_mapping_derive.sql
-- ============================================================================
-- VEILLE RSEQ — MAPPING_DERIVE : le pont école ↔ équipe qui bouge en silence.
--
-- DÉTECTION SEULEMENT. Comme les quatre types déjà en place, celui-ci n'écrit
-- QUE dans `rseq_sync_alerts`. Aucun UPDATE de `schools`, aucun INSERT de
-- `teams`, aucun DELETE : la règle RSEQ maison ne bouge pas d'un pouce.
--
-- ── TROIS FAMILLES, TOUTES MESURÉES AVANT D'ÊTRE ÉCRITES ───────────────────
--
--   A — ÉQUIPE PONTÉE ABSENTE DE TOUTE LIGUE DE LA SAISON.
--       On croit qu'elle joue, le calendrier RSEQ ne la mentionne nulle part.
--       Relevé au 2026-09-02 : 0 sur 312. Le détecteur est donc silencieux
--       aujourd'hui — c'est l'état sain, pas un détecteur inutile.
--
--   B — L'InstitutionId PUBLIÉ POINTE UNE AUTRE ÉCOLE que celle à laquelle
--       l'équipe est rattachée chez nous. C'est le cas qui compte : une équipe
--       qui change d'établissement sans que personne ne le voie.
--       Relevé : 0 divergence sur 311 comparables.
--
--   C — L'InstitutionId PUBLIÉ EST INCONNU DE `schools`. L'équipe est pontée
--       par son rseq_team_id, mais son établissement ne l'est pas.
--       Relevé : 1 — Collège Ellis, CEGEP présent avec 1 équipe 2026-2027 et
--       `rseq_institution_id` NULL. C'est le seul cas actif, et il est
--       actionnable : poser le pont d'école. Décision humaine, comme toujours.
--
-- ── POURQUOI DEUX FONCTIONS ET PAS UNE ─────────────────────────────────────
--   B et C ont besoin de l'InstitutionId, qui n'existe QUE dans le payload et
--   ne transite que par `p_teams` — ils vivent donc dans detect_teams, par
--   ligue. A n'a besoin que de la base et se juge sur l'ensemble de la saison :
--   il vit dans sa propre fonction, appelée une fois en fin de passe, à côté
--   de detect_familles.
--
-- ── LE GARDE-FOU QUI ÉVITE 312 FAUSSES ALERTES ─────────────────────────────
--   Si une collecte échouait en bloc (RSEQ hors ligne, GUID tous morts), la
--   saison courante n'aurait plus aucune ligue et le cas A crierait sur les
--   312 équipes d'un coup. La fonction ne fait donc rien tant que
--   `rseq_ligues_a_appeler` est vide : pas de ligue, pas de jugement.
-- ============================================================================


-- ── A ──────────────────────────────────────────────────────────────────────
create or replace function public.rseq_sync_detect_mapping(
  p_run_id uuid,
  p_saison text
) returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_n integer := 0;
begin
  -- Garde-fou : une collecte totalement muette ne doit pas condamner 312
  -- équipes. Sans ligue publiée, on ne juge rien.
  if not exists (select 1 from public.rseq_ligues_a_appeler) then
    return 0;
  end if;

  with ins as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, rseq_team_id, team_id, school_id, family_key, resume, payload)
    select
      p_run_id, 'MAPPING_DERIVE',
      t.id::text || '|absente|' || p_saison,
      t.rseq_team_id, t.id, t.school_id,
      public.rseq_family_key(sp.nom, t.division),
      coalesce(s.name, '?') || ' — ' || coalesce(sp.nom, '?') ||
      coalesce(' ' || t.gender, '') || coalesce(' ' || nullif(t.division,''), '') ||
      ' : equipe pontee mais ABSENTE de toute ligue ' || p_saison,
      jsonb_build_object(
        'cas', 'A_absente_des_ligues',
        'rseq_team_id', t.rseq_team_id,
        'ecole', s.name, 'sport', sp.nom,
        'genre', t.gender, 'division', t.division,
        'saison', p_saison
      )
    from public.teams t
    join public.schools s on s.id = t.school_id
    left join public.sports sp on sp.id = t.sport_id
    where s.type = 'CEGEP'
      and t.season = p_saison
      and t.rseq_team_id is not null
      and not exists (
        select 1 from public.games g
        where g.sector = 'Collégial' and g.season = p_saison
          and (g.home_rseq_team_id = t.rseq_team_id
            or g.visitor_rseq_team_id = t.rseq_team_id)
      )
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  )
  select coalesce((select count(*)::int from ins), 0) into v_n;

  return coalesce(v_n, 0);
end;
$$;

comment on function public.rseq_sync_detect_mapping(uuid, text) is
  'MAPPING_DERIVE cas A : equipe pontee absente de toute ligue de la saison. Detection seule, aucune ecriture hors rseq_sync_alerts.';


-- ── B et C, dans detect_teams (seul endroit ou l'InstitutionId circule) ─────
-- Le corps est repris a l'identique de 20260902090100, augmente d'une CTE.
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
    where rseq_team_id is not null
      and rseq_team_id <> '00000000-0000-0000-0000-000000000000'::uuid
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
    where not exists (
        select 1 from public.teams t where t.rseq_team_id = s.rseq_team_id
      )
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  ),
  connues as (
    select t.id as team_id, s.rseq_team_id, s.team_name, t.division as div_connue
    from src s
    join public.teams t on t.rseq_team_id = s.rseq_team_id
  ),
  familles_connues as (
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
  ),
  /* ── MAPPING_DERIVE, cas B et C ────────────────────────────────────────
     Ne concerne QUE les équipes déjà pontées : une équipe inconnue relève de
     NOUVELLE_EQUIPE, pas d'une dérive. Et seulement quand RSEQ publie un
     InstitutionId — sans lui, il n'y a rien à comparer et l'alerte de
     rattachement manquant est déjà portée par NOUVELLE_EQUIPE.

     B : l'institution publiée résout vers une AUTRE école que celle de
         l'équipe. C'est le cas grave — l'équipe a changé d'établissement.
     C : l'institution publiée n'est connue d'aucune école. L'équipe est
         pontée, son établissement ne l'est pas. */
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
       + (select count(*) from derive)
       + (select count(*) from mapping)
  into v_n;

  return coalesce(v_n, 0);
end;
$$;

comment on function public.rseq_sync_detect_teams(uuid, uuid, text, text, jsonb) is
  'Detecte nouvelles equipes, changements de division et derives de mapping (B/C). N''ecrit QUE dans rseq_sync_alerts : aucun INSERT teams, aucun UPDATE schools.';


-- Les deux couches de privileges, comme partout ailleurs dans ce chantier.
revoke execute on function public.rseq_sync_detect_mapping(uuid, text) from anon, authenticated;
revoke execute on function public.rseq_sync_detect_mapping(uuid, text) from public;
grant  execute on function public.rseq_sync_detect_mapping(uuid, text) to service_role;
