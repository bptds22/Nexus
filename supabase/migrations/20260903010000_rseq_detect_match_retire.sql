-- 20260903010000_rseq_detect_match_retire.sql
-- ============================================================================
-- VEILLE RSEQ — MATCH_RETIRE : un match que la base porte et que l'API ne sert
-- plus.
--
-- MÊME ADN QUE LES CINQ AUTRES : détection seulement. La fonction n'écrit QUE
-- dans `rseq_sync_alerts`. Pas de DELETE, pas d'UPDATE de `games` — et c'est
-- une décision, pas une timidité.
--
--   UN MATCH RETIRÉ DE L'API N'EST PAS UN MATCH QUI N'A PAS EU LIEU.
--   Reprogrammation, correction de saisie, litige, refonte de section : RSEQ
--   retire des lignes pour quatre raisons au moins, et trois d'entre elles
--   décrivent un match bien réel. Supprimer sur ce signal effacerait des
--   résultats joués. On signale, tu tranches.
--
-- ── CE QUI L'A FAIT NAÎTRE ─────────────────────────────────────────────────
--   Le 2026-09-03, la passe voyait 2363 matchs quand la base en portait 2372.
--   Les 9 manquants n'étaient couverts par AUCUN détecteur — ils ne se sont
--   révélés qu'en poursuivant un écart de 8 sur une prédiction de raccrochage.
--   Huit d'entre eux forment le calendrier d'une équipe entière (Jonquière
--   féminin, soccer D2), qui n'existe donc dans aucun bloc Teams[] ni dans
--   aucun participant vivant : c'est exactement pour ça que la file en avait
--   compté 22 et non 23.
--
-- ── LE GARDE-FOU, ET LE SEUIL ──────────────────────────────────────────────
--   Une ligue entière qui disparaît de l'API n'est PAS « tous ses matchs
--   retirés » — c'est une ligue muette, et LIGUE_MUETTE la couvre déjà. Donc :
--
--     • payload sans aucun match          -> on ne juge rien, on sort.
--     • manquants > SEUIL_MASSE (40 %)    -> UNE alerte agrégée nommant la
--                                            ligue et le compte, pas N alertes.
--     • en dessous                        -> une alerte par match.
--
--   Le 40 % vient de la mesure, pas d'une intuition. Au 2026-09-03 les deux
--   seules ligues concernées perdaient 2 % (1 sur 51) et 17 % (8 sur 48) :
--   des retraits ciblés, qui méritent chacun leur ligne. Au-delà de 40 %, ce
--   n'est plus le calendrier qui bouge, c'est la source.
-- ============================================================================

create or replace function public.rseq_sync_detect_matchs_retires(
  p_run_id    uuid,
  p_league_id uuid,
  p_saison    text,
  p_vus       uuid[]
) returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  SEUIL_MASSE constant numeric := 0.40;
  v_base      integer;
  v_manquants integer;
  v_n         integer := 0;
begin
  -- Garde-fou : une ligue qui ne sert AUCUN match est muette, pas amputee.
  -- LIGUE_MUETTE s'en charge ; ici on ne juge rien.
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
    -- RETRAIT DE MASSE : une seule ligne. Nommer 30 matchs quand c'est la
    -- section qui a bouge noierait la file et dirait moins, pas plus.
    with ins as (
      insert into public.rseq_sync_alerts
        (run_id, type, cle, rseq_league_id, family_key, resume, payload)
      select
        p_run_id, 'MATCH_RETIRE',
        p_league_id::text || '|retrait-masse|' || p_saison,
        p_league_id,
        (select public.rseq_family_key(max(g.sport), max(g.division))
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
    -- RETRAIT PONCTUEL : une ligne par match, avec de quoi le reconnaitre.
    with ins as (
      insert into public.rseq_sync_alerts
        (run_id, type, cle, rseq_league_id, family_key, resume, payload)
      select
        p_run_id, 'MATCH_RETIRE',
        g.rseq_game_id::text || '|retire',
        p_league_id,
        public.rseq_family_key(g.sport, g.division),
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
$$;

comment on function public.rseq_sync_detect_matchs_retires(uuid, uuid, text, uuid[]) is
  'MATCH_RETIRE : match present en base et absent de la passe. Detection seule, JAMAIS de DELETE — un match retire de l''API n''est pas un match qui n''a pas eu lieu. Seuil 40 % : au-dela, une alerte agregee au lieu de N.';

revoke execute on function public.rseq_sync_detect_matchs_retires(uuid, uuid, text, uuid[]) from anon, authenticated;
revoke execute on function public.rseq_sync_detect_matchs_retires(uuid, uuid, text, uuid[]) from public;
grant  execute on function public.rseq_sync_detect_matchs_retires(uuid, uuid, text, uuid[]) to service_role;
