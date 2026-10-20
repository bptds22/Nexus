-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep, LOT A — preuves PAR RÔLE. Base locale JETABLE seulement
-- (après scripts/cegep-lot-a-fixtures-locales.sql).
--
-- Chaque cellule est une SONDE : la requête tourne sous `role authenticated` (ou anon,
-- service_role) avec `request.jwt.claims` du compte — jamais en superuser — dans une
-- sous-transaction TOUJOURS annulée : fusionner_carte et match_notes_lier n'écrivent rien.
--
-- Lecture d'une cellule : « C » = le cégépien (ou futur cégépien) est rendu, « S » = l'athlète
-- du secondaire est rendu, « - » = rien. Valeurs non-uuid recopiées telles quelles
-- (G1:2* = match G1, 2 profils Nexus, étoile « cible »). « refus 42501 » = l'appel est refusé.
--
-- Colonnes : R recruteur collégial Pro (cégep X) · N recruteur sans école · A admin ·
--            P partenaire · K coach de S et C · anon.
-- Ligne service_role : fonctions sans appelant authentifié (agenda par jeton, candidats).
--
-- La lecture REST directe se prouve à part (vrai PostgREST, vrai JWT) :
--   GET /rest/v1/athletes?select=id,first_name&id=in.(<S>,<C>)  — JWT HS256 du compte, voir rapport.
-- ════════════════════════════════════════════════════════════════════════════

\pset pager off
\pset null '·'

create or replace function pg_temp.sonde(p_uid uuid, p_role text, p_sql text, p_prep text default null)
returns text
language plpgsql
as $$
declare
  v text;
  v_sql text := p_sql;
begin
  -- :SEC avant :S (préfixe commun).
  v_sql := replace(v_sql, ':SEC','(select id from public.schools where type = ''SECONDAIRE'' and name = ''Académie Antoine-Manseau'')');
  v_sql := replace(v_sql, ':C',  '''c0ce0a00-0000-4000-8000-0000000000a2''::uuid');
  v_sql := replace(v_sql, ':S',  '''c0ce0a00-0000-4000-8000-0000000000a1''::uuid');
  v_sql := replace(v_sql, ':G1', '''c0ce0a00-0000-4000-8000-0000000000c1''::uuid');
  v_sql := replace(v_sql, ':G2', '''c0ce0a00-0000-4000-8000-0000000000c2''::uuid');
  v_sql := replace(v_sql, ':Y',  '(select id from public.schools where type = ''CEGEP'' and name = ''Cégep Beauce-Appalaches'')');
  v_sql := replace(v_sql, ':E1', '''c0ce0a00-0000-4000-8000-0000000000e1''::uuid');
  v_sql := replace(v_sql, ':F1', '''c0ce0a00-0000-4000-8000-0000000000f1''::uuid');
  begin
    perform set_config('request.jwt.claims',
      case when p_uid is null then '{"role":"' || p_role || '"}'
           else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
    perform set_config('role', p_role, true);
    -- Préparation éventuelle, sous le même rôle, annulée avec la sonde.
    if p_prep is not null then
      execute replace(p_prep, ':E1', '''c0ce0a00-0000-4000-8000-0000000000e1''::uuid');
    end if;
    execute format($q$
      select coalesce(string_agg(x, ',' order by x), '-')
        from (select distinct
                     case v::text
                       when 'c0ce0a00-0000-4000-8000-0000000000a2' then 'C'
                       when 'c0ce0a00-0000-4000-8000-0000000000a1' then 'S'
                       else case when v::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' then null else v::text end
                     end as x
                from (%s) q(v)) z
       where x is not null $q$, v_sql) into v;
    raise exception using errcode = 'NX000', message = v;   -- annule tout effet de bord
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refus ' || sqlstate;
  end;
end $$;

-- Comptes de la distribution.
\set R '''c0ce0a00-0000-4000-8000-000000000001'''
\set N '''c0ce0a00-0000-4000-8000-000000000002'''
\set A '''c0ce0a00-0000-4000-8000-000000000003'''
\set P '''c0ce0a00-0000-4000-8000-000000000004'''
\set K '''c0ce0a00-0000-4000-8000-000000000005'''

with surfaces(ordre, surface, q) as (values
  ( 1, 'athletes (lecture directe)',          $$select id from public.athletes where id in (:C, :S)$$),
  ( 2, 'team_athletes (lecture directe)',     $$select athlete_id from public.team_athletes where athlete_id in (:C, :S)$$),
  ( 3, 'athlete_badges (lecture directe)',    $$select athlete_id from public.athlete_badges where athlete_id in (:C, :S)$$),
  ( 4, 'evaluations (lecture directe)',       $$select athlete_id from public.evaluations where athlete_id in (:C, :S)$$),
  ( 5, 'recruiter_search_athletes()',         $$select id from public.recruiter_search_athletes()$$),
  ( 6, 'recruiter_search_athletes(texte)',    $$select id from public.recruiter_search_athletes(p_search => 'Fixture')$$),
  ( 7, 'recruiter_athlete_profile',           $$select id from public.recruiter_athlete_profile(:C) union all select id from public.recruiter_athlete_profile(:S)$$),
  ( 8, 'recruiter_athlete_cards',             $$select id from public.recruiter_athlete_cards(array[:C, :S])$$),
  ( 9, 'athletes_targeting_my_cegep',         $$select athlete_id from public.athletes_targeting_my_cegep()$$),
  (10, 'matchs_profils_nexus',                $$select athlete_id from public.matchs_profils_nexus(array[:G1, :G2])$$),
  (11, 'depistage_profils_match',             $$select athlete_id from public.depistage_profils_match(:G1) union all select athlete_id from public.depistage_profils_match(:G2)$$),
  (12, 'matchs_recherche (G1 coll., G2 sec.)',$$select case when id = :G1 then 'G1:' else 'G2:' end || nb_profils || case when cible then '*' else '' end
                                                 from public.matchs_recherche(current_date, current_date + 10) where id in (:G1, :G2)$$),
  (13, 'rapprochements_unite',                $$select athlete_id from public.rapprochements_unite()$$),
  (14, 'rapprochements_refuses_unite',        $$select athlete_id from public.rapprochements_refuses_unite()$$),
  (15, 'fusionner_carte(carte1, C)',          $$select case when public.fusionner_carte(:E1, :C) is not null then 'fusion-ok' end$$),
  (16, 'athletes_nom_proche',                 $$select id from public.athletes_nom_proche('Cedric', 'Cegepienne', :Y) union all select id from public.athletes_nom_proche('Samuel', 'Secondaires', :SEC)$$),
  (17, 'athlete_nexus_par_courriel',          $$select id from public.athlete_nexus_par_courriel('lota.cedric@fixture-cegep.test') union all select id from public.athlete_nexus_par_courriel('lota.samuel@fixture-cegep.test')$$),
  (18, 'match_notes_lier(n° 7 → C)',          $$select 'lien:' || public.match_notes_lier(:F1, 'A', '7', null, :C, null)$$),
  (19, 'matchs_profils_partenaire(G1)',       $$select (regexp_matches(public.matchs_profils_partenaire(:G1)::text, '[0-9a-f]{8}-[0-9a-f-]{27}', 'g'))[1]$$),
  (20, 'top_athletes_view (partenaire)',      $$select id from public.top_athletes_view where id in (:C, :S)$$),
  (21, 'admin_prospects_rapprochements',      $$select athlete_id from public.admin_prospects_rapprochements()$$)
)
select ordre as "#", surface,
       pg_temp.sonde(:R, 'authenticated', q) as "R collégial",
       pg_temp.sonde(:N, 'authenticated', q) as "N sans école",
       pg_temp.sonde(:A, 'authenticated', q) as "A admin",
       pg_temp.sonde(:P, 'authenticated', q) as "P partenaire",
       pg_temp.sonde(:K, 'authenticated', q) as "K coach",
       case when ordre <= 4 then pg_temp.sonde(null, 'anon', q) end as "anon"
  from surfaces
 order by ordre;

-- Fonctions sans appelant authentifié (ACL postgres/service_role).
select 'agenda_flux(jeton de R)' as surface,
       pg_temp.sonde(null, 'service_role',
         $$select cible_id from public.agenda_flux('jeton-fixture-lot-a') where cible = 'athlete'$$) as "service_role"
union all
select 'rapprochement_candidats(carte1)',
       pg_temp.sonde(null, 'service_role',
         $$select athlete_id from public.rapprochement_candidats(null, :E1)$$,
         -- La paire déjà proposée est exclue des candidats : on retire la proposition le temps de la sonde.
         $$delete from public.rapprochements where carte_id = :E1$$);

-- Ancrage de C au moment de la preuve.
select 'C ancré sur : ' || s.type || ' — ' || s.name as etat
  from public.athletes a join public.schools s on s.id = a.school_id
 where a.id = 'c0ce0a00-0000-4000-8000-0000000000a2';
