-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — LOT B2 « données » : catégorie « Collégial » (décisions BP 2026-10-26).
-- NON APPLIQUÉE EN PROD. Apply par la voie psql, sur GO BP seulement.
--
-- 1. rseq_proposition_equipe : une équipe collégiale proposée par la veille RSEQ porte
--    age_group = 'Collégial' au lieu de NULL (seule la ligne v_age change ; corps prod gardé
--    par md5(prosrc) avant remplacement). Sans ce correctif, chaque alerte NOUVELLE_EQUIPE
--    traitée crée une équipe sans catégorie, et la règle de dédoublonnage n° 2 (même école +
--    sport + catégorie + division + sexe + saison) cesse de reconnaître les équipes
--    « Collégial » existantes.
-- 2. Les 256 équipes rattachées à une école de type CEGEP, age_group NULL, passent en
--    « Collégial ». Garde : schools.type = 'CEGEP' ET age_group IS NULL, compte exact 256 et
--    empreinte exacte de l'ensemble (md5 des id triés, relevé prod 2026-10-26). JAMAIS de
--    filtre par nom : « Cégep régional de Lanaudière à L'Assomption » (CEGEP) en fait partie,
--    « Collège de l'Assomption » (SECONDAIRE) n'est pas touché.
--    Ne fait partir aucun déclencheur : sur teams, trg_porte_coach_cegep regarde
--    UPDATE OF school_id et teams_resync_athlete_sport_id_trg UPDATE OF sport_id.
-- 3. Une ligne admin_operations CATEGORIE_COLLEGIALE_256 avec la liste des id.
--
-- Hors lot (décisions BP) : Champlain Cavaliers, Champlain Regional College, les 194 alertes
-- cégep ouvertes, les athlètes au cégep tapé à la main.
--
-- Rollback : supabase/rollback/20261026140000_rollback_cegep_lot_b2_categorie_collegial.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Gardes ────────────────────────────────────────────────────────────────
do $$
declare n int; e text;
begin
  if (select md5(prosrc) from pg_proc
       where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '70b3e97e6039c381f27a86b836bd2c8a' then
    raise exception 'NEXUS: rseq_proposition_equipe n''est pas le corps prod relevé le 2026-10-26';
  end if;
  select count(*), md5(string_agg(t.id::text, ',' order by t.id)) into n, e
    from public.teams t join public.schools s on s.id = t.school_id
   where s.type::text = 'CEGEP' and t.age_group is null;
  if n <> 256 or e is distinct from '8d08926f78d851bf9bbd3003c5b52ec9' then
    raise exception 'NEXUS: % équipe(s) CEGEP sans catégorie (empreinte %), attendu 256 (8d08926f…)', n, e;
  end if;
end $$;

-- ── 1. rseq_proposition_equipe : collégial → « Collégial » ──────────────────
create or replace function public.rseq_proposition_equipe(
  p_rseq_team_id uuid, p_institution uuid, p_team_name text, p_league_id uuid, p_saison text, p_secteur text)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_sport text; v_cat text; v_div text; v_sexe text; v_ligue text;
  v_sport_nexus text; v_sport_id uuid;
  v_n_ecoles int; v_ecole uuid; v_ecole_nom text;
  v_age text; v_gender text; v_league text;
  v_deja uuid; v_doublon uuid; v_doublon_nom text; v_cotes int; v_decision text;
begin
  select l.sport, l.category, l.division, l.sex_type, l.league_name
    into v_sport, v_cat, v_div, v_sexe, v_ligue
    from public.rseq_ligues_a_appeler l where l.rseq_league_id = p_league_id limit 1;
  if v_sport is null then
    select g.sport, g.category, g.division, g.sex_type, g.league_name
      into v_sport, v_cat, v_div, v_sexe, v_ligue
      from public.games g where g.rseq_league_id = p_league_id limit 1;
  end if;

  v_sport_nexus := case v_sport when 'Ultimate' then 'Ultimate frisbee' else v_sport end;
  select s.id into v_sport_id from public.sports s where s.nom = v_sport_nexus;

  select count(*), min(sc.id::text)::uuid, min(sc.name) into v_n_ecoles, v_ecole, v_ecole_nom
    from public.schools sc
   where p_institution is not null and sc.rseq_institution_id = p_institution
     and sc.type = case p_secteur when 'Collégial' then 'CEGEP' else 'SECONDAIRE' end;
  if v_n_ecoles <> 1 then v_ecole := null; v_ecole_nom := null; end if;

  v_gender := case v_sexe when 'Garçons' then 'Masculin' when 'Filles' then 'Féminin' else nullif(v_sexe, '') end;
  -- Lot B2 (2026-10-26) : une équipe collégiale porte la catégorie « Collégial », comme les 398 déjà en base.
  v_age    := case when p_secteur = 'Collégial' then 'Collégial' else nullif(v_cat, '') end;
  v_div    := nullif(v_div, '');
  v_league := case when p_secteur = 'Collégial' and v_ligue is not null then v_ligue || ' (' || p_saison || ')' end;

  select t.id into v_deja from public.teams t where t.rseq_team_id = p_rseq_team_id;
  if v_ecole is not null and v_sport_id is not null then
    select t.id, t.name into v_doublon, v_doublon_nom
      from public.teams t
     where t.school_id = v_ecole and t.sport_id = v_sport_id and t.season = p_saison
       and coalesce(t.age_group, '') = coalesce(v_age, '')
       and regexp_replace(lower(coalesce(t.division, '')), '^division\s*', 'd')
         = regexp_replace(lower(coalesce(v_div, '')), '^division\s*', 'd')
       and coalesce(t.gender, '') = coalesce(v_gender, '')
     order by t.created_at limit 1;
  end if;
  select (select count(*) from public.games where home_team_id is null and home_rseq_team_id = p_rseq_team_id)
       + (select count(*) from public.games where visitor_team_id is null and visitor_rseq_team_id = p_rseq_team_id)
    into v_cotes;

  v_decision := case
    when v_deja is not null    then 'deja_en_base'
    when v_sport_id is null    then 'sport_absent'
    when v_ecole is null       then 'ecole_introuvable'
    when v_doublon is not null then 'doublon'
    else 'a_creer' end;

  return jsonb_build_object(
    'decision', v_decision, 'rseq_team_id', p_rseq_team_id, 'nom', p_team_name, 'saison', p_saison,
    'secteur', p_secteur, 'school_id', v_ecole, 'ecole', v_ecole_nom, 'ecoles_candidates', v_n_ecoles,
    'sport', v_sport_nexus, 'sport_id', v_sport_id, 'age_group', v_age, 'division', v_div, 'gender', v_gender,
    'league', v_league, 'equipe_existante', v_deja, 'doublon_team_id', v_doublon, 'doublon_nom', v_doublon_nom,
    'cotes_a_relier', v_cotes,
    'confiance', case when v_ecole is not null then 'haute (InstitutionId)' else 'introuvable' end);
end;
$function$;

-- ── 2. Les 256 équipes → « Collégial » ──────────────────────────────────────
do $$
declare v_ids uuid[]; n int;
begin
  select array_agg(t.id order by t.id) into v_ids
    from public.teams t join public.schools s on s.id = t.school_id
   where s.type::text = 'CEGEP' and t.age_group is null;

  update public.teams t set age_group = 'Collégial'
   where t.id = any(v_ids) and t.age_group is null;
  get diagnostics n = row_count;
  if n <> 256 then
    raise exception 'NEXUS: % équipe(s) mise(s) à jour, attendu 256 — rien écrit', n;
  end if;
  if exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
              where s.type::text = 'CEGEP' and t.age_group is null) then
    raise exception 'NEXUS: il reste une équipe CEGEP sans catégorie — rien écrit';
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CATEGORIE_COLLEGIALE_256',
          'Lot B2 cégep : équipes d''école CEGEP sans catégorie passées en « Collégial » (décision BP 2026-10-26)',
          jsonb_build_object('equipes', n, 'age_group_avant', null, 'age_group_apres', 'Collégial',
                             'empreinte_ids', md5(array_to_string(v_ids, ',')),
                             'team_ids', to_jsonb(v_ids)),
          auth.uid());
end $$;
