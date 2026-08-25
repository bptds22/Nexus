-- ═══════════════════════════════════════════════════════════════
-- Supprime badges_json() et intègre son contenu dans les deux projections.
-- Corrige DEUX défauts de badges_projections_partenaire, tous deux détectés
-- sous JWT partenaire réel et invisibles en superutilisateur.
--
-- ── DÉFAUT 1 — la vue était inutilisable ─────────────────────────
--   ERROR 42501: permission denied for function badges_json
-- Raisonnement initial erroné : « la vue s'exécute avec les droits de son
-- propriétaire, donc révoquer EXECUTE ne la gêne pas ». C'est vrai des TABLES,
-- faux des FONCTIONS. Pour une vue sans security_invoker, PostgreSQL vérifie
-- l'accès aux relations sous-jacentes au nom du PROPRIÉTAIRE, mais le droit
-- EXECUTE d'une fonction au nom de L'APPELANT. Tout partenaire recevait donc
-- une erreur 42501 sur top_athletes_view.
--
-- Accorder l'EXECUTE n'était pas une option : la fonction est SECURITY DEFINER
-- avec row_security off — n'importe quel compte connecté aurait pu appeler
-- badges_json('<uuid d''un athlète quelconque>') et lire ses badges en
-- contournant toute la RLS. On supprime donc la fonction plutôt que de
-- l'ouvrir, et la logique est intégrée. Huit lignes en double valent mieux
-- qu'une surface privilégiée appelable par tous.
--
-- ── DÉFAUT 2 — les clés de tri fuyaient dans la charge utile ─────
-- `jsonb_agg(x)` sur un alias de sous-requête sérialise la LIGNE ENTIÈRE :
-- `rang` et `ordre`, qui ne servent qu'au tri, se retrouvaient dans le JSON
-- livré au partenaire. L'objet est désormais construit explicitement.
--
-- ORDRE DES OPÉRATIONS : la vue référence la fonction. On remplace donc la
-- VUE d'abord (ce qui rompt la dépendance), et seulement ensuite on supprime
-- la fonction. L'ordre inverse échoue en 2BP01.
-- ═══════════════════════════════════════════════════════════════

create or replace view public.top_athletes_view as
 SELECT a.id,
    a.first_name,
    a.last_name,
    a.cote_globale_entraineur,
    a.annee_diplomation,
    sch.region,
    a.sport_id,
    a.position_id,
    a.school_id,
    a.photo_url,
    s.nom AS sport_name,
    p.nom AS position_name,
    sch.name AS school_name,
    e.distinctions,
    a.video_faits_saillants_url,
    a.video_match_complet_url,
    a.video_entrainement_url,
    a.genre,
    ( SELECT coalesce(jsonb_agg(jsonb_build_object(
               'code', x.code, 'libelle', x.libelle, 'famille', x.famille,
               'contexte', x.contexte, 'attribue_le', x.attribue_le)
             ORDER BY x.rang, x.ordre, x.attribue_le), '[]'::jsonb)
        FROM ( SELECT b2.code, b2.libelle, b2.famille, ab.contexte,
                      ab.created_at AS attribue_le, b2.ordre,
                      CASE b2.famille WHEN 'honneur' THEN 0 WHEN 'universel' THEN 1 ELSE 2 END AS rang
                 FROM athlete_badges ab
                 JOIN badges b2 ON b2.id = ab.badge_id
                WHERE ab.athlete_id = a.id AND ab.retire_le IS NULL) x
     ) AS badges
   FROM ((((athletes a
     LEFT JOIN sports s ON ((s.id = a.sport_id)))
     LEFT JOIN positions p ON ((p.id = a.position_id)))
     LEFT JOIN schools sch ON ((sch.id = a.school_id)))
     LEFT JOIN LATERAL ( SELECT evaluations.distinctions
           FROM evaluations
          WHERE (evaluations.athlete_id = a.id)
          ORDER BY evaluations.created_at DESC
         LIMIT 1) e ON (true))
  WHERE (is_partner_eligible_athlete(a.id) AND is_approved_partner(auth.uid()))
  ORDER BY a.cote_globale_entraineur DESC;

create or replace function public.partner_athlete_profile(p_athlete_id uuid)
 returns table(id uuid, first_name text, last_name text, photo_url text,
   numero_jersey text, age integer, genre text, annee_diplomation integer,
   verified boolean, last_profile_validation timestamp with time zone,
   cote_globale numeric, taille_pieds integer, taille_pouces integer,
   poids_lbs numeric, bio text, sport_nom text, position_nom text,
   position_abbr text, school_name text, school_region text, school_city text,
   school_type text, is_civil boolean, team_name text, league_name text,
   distinctions jsonb, video_faits_saillants_url text, hudl_url text,
   youtube_url text, badges jsonb)
 language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select
    a.id, a.first_name, a.last_name, a.photo_url, a.numero_jersey,
    extract(year from age(a.date_naissance))::int as age,
    a.genre, a.annee_diplomation, a.verified, a.last_profile_validation,
    a.cote_globale_entraineur, a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.bio, s.nom, p.nom, p.abreviation, sch.name, sch.region, sch.city, sch.type,
    (a.school_id is null or sch.type = 'LIGUE_CIVILE') as is_civil,
    t.name  as team_name,
    t.league as league_name,
    e.distinctions,
    a.video_faits_saillants_url, a.hudl_url, a.youtube_url,
    ( select coalesce(jsonb_agg(jsonb_build_object(
               'code', x.code, 'libelle', x.libelle, 'famille', x.famille,
               'contexte', x.contexte, 'attribue_le', x.attribue_le)
             order by x.rang, x.ordre, x.attribue_le), '[]'::jsonb)
        from ( select b2.code, b2.libelle, b2.famille, ab.contexte,
                      ab.created_at as attribue_le, b2.ordre,
                      case b2.famille when 'honneur' then 0 when 'universel' then 1 else 2 end as rang
                 from public.athlete_badges ab
                 join public.badges b2 on b2.id = ab.badge_id
                where ab.athlete_id = a.id and ab.retire_le is null) x
    ) as badges
  from public.athletes a
  left join public.sports    s   on s.id   = a.sport_id
  left join public.positions p   on p.id   = a.position_id
  left join public.schools   sch on sch.id = a.school_id
  -- team_athletes porte UNIQUE (athlete_id) : la jointure est 1:0..1, aucune
  -- duplication possible (verifie 2026-08-19, 0 athlete multi-equipes).
  left join public.team_athletes ta on ta.athlete_id = a.id
  left join public.teams         t  on t.id = ta.team_id
  left join lateral (
    -- NOTE : `created_at desc` ici, alors que selectBestEvaluation (frontend)
    -- retient `updated_at desc`. Divergence PRÉEXISTANTE, non corrigée ici.
    -- Sans conséquence POUR LES BADGES : le miroir écrit le même jeu sur
    -- TOUTES les lignes d'un athlète.
    select ev.distinctions
    from public.evaluations ev
    where ev.athlete_id = a.id
    order by ev.created_at desc
    limit 1
  ) e on true
  where a.id = p_athlete_id
    and public.is_approved_partner(null)
    and public.is_partner_eligible_athlete(a.id);
$function$;

revoke all on function public.partner_athlete_profile(uuid) from public, anon;
grant execute on function public.partner_athlete_profile(uuid) to authenticated, service_role;

-- La dépendance est rompue : la fonction privilégiée peut disparaître.
drop function if exists public.badges_json(uuid);

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='badges_json') then
    raise exception 'NEXUS: badges_json existe encore — une dépendance subsiste';
  end if;
  raise notice 'NEXUS: badges_json supprimée, logique intégrée aux deux projections.';
end $$;