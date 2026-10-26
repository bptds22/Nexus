-- Lot B3 cégep — aligne la base JETABLE nexus_b3 sur la PROD (objets lus ou touchés par B3).
-- GÉNÉRÉ par scripts/cegep-lot-b3/aligner-local.py. LOCAL SEULEMENT.
\set ON_ERROR_STOP 1
do $$
begin
  if exists (select 1 from auth.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0') then
    raise exception 'NEXUS: base PROD détectée — alignement local refusé';
  end if;
end $$;
begin;
set local search_path = public, extensions;
create table public.consentement_partenaire_v2 (
  athlete_id        uuid primary key references public.athletes(id) on delete cascade,
  accepte_le        timestamptz,              -- dernier accord v2 (posé par le déclencheur d'audit)
  refuse_le         timestamptz,              -- « Non » à la demande v2 : plus jamais relancé
  plus_tard_nb      smallint not null default 0 check (plus_tard_nb between 0 and 3),
  plus_tard_le      timestamptz,              -- dernier « Plus tard »
  demande_parent_le timestamptz,              -- moins de 14 ans : demande transmise au parent
  push_le           timestamptz,              -- le push unique de la campagne v2
  maj_le            timestamptz not null default now()
);
alter table public.consentement_partenaire_v2 enable row level security;
revoke all on table public.consentement_partenaire_v2 from public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.consentement_partenaire_v2_valide(p_athlete_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select coalesce((
    select a.partner_visibility_opt_in
           and c.accepte_le is not null
           and c.accepte_le >= coalesce(a.partner_visibility_opted_in_at, '-infinity'::timestamptz)
      from public.athletes a
      join public.consentement_partenaire_v2 c on c.athlete_id = a.id
     where a.id = p_athlete_id), false)
$function$;
revoke all on function public.consentement_partenaire_v2_valide(uuid) from public, anon, authenticated;
grant execute on function public.consentement_partenaire_v2_valide(uuid) to service_role;
CREATE OR REPLACE FUNCTION public.is_partner_media_athlete(p_athlete_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select coalesce(public.is_partner_eligible_athlete(p_athlete_id), false)
     and public.consentement_partenaire_v2_valide(p_athlete_id)
$function$;
revoke all on function public.is_partner_media_athlete(uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_partner_media_athlete(uuid) to authenticated, service_role;
CREATE OR REPLACE FUNCTION public.is_approved_partner(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM media_partners
    WHERE user_id = auth.uid() AND status = 'APPROVED'
  );
$function$;

CREATE OR REPLACE VIEW public.top_athletes_view AS
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
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_faits_saillants_url END AS video_faits_saillants_url,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_match_complet_url END AS video_match_complet_url,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_entrainement_url END AS video_entrainement_url,
    a.genre,
    ( SELECT COALESCE(jsonb_agg(jsonb_build_object('code', x.code, 'libelle', x.libelle, 'famille', x.famille, 'contexte', x.contexte, 'attribue_le', x.attribue_le) ORDER BY x.rang, x.ordre, x.attribue_le), '[]'::jsonb) AS "coalesce"
           FROM ( SELECT b2.code,
                    b2.libelle,
                    b2.famille,
                    ab.contexte,
                    ab.created_at AS attribue_le,
                    b2.ordre,
                        CASE b2.famille
                            WHEN 'honneur'::text THEN 0
                            WHEN 'universel'::text THEN 1
                            ELSE 2
                        END AS rang
                   FROM public.athlete_badges ab
                     JOIN public.badges b2 ON b2.id = ab.badge_id
                  WHERE ab.athlete_id = a.id AND ab.retire_le IS NULL) x) AS badges
   FROM public.athletes a
     LEFT JOIN public.sports s ON s.id = a.sport_id
     LEFT JOIN public.positions p ON p.id = a.position_id
     LEFT JOIN public.schools sch ON sch.id = a.school_id
     LEFT JOIN LATERAL ( SELECT evaluations.distinctions
           FROM public.evaluations
          WHERE evaluations.athlete_id = a.id
          ORDER BY evaluations.created_at DESC
         LIMIT 1) e ON true
  WHERE a.status = 'ACTIF'::public.account_status
    AND public.is_partner_eligible_athlete(a.id) AND public.is_approved_partner(auth.uid())
  ORDER BY a.cote_globale_entraineur DESC;
comment on view public.top_athletes_view is $c$SECURITY DEFINER ASSUME (2026-08-19, point 5b du chantier RLS partenaire).

Passee en INVOKER le matin meme, puis remise en DEFINER le soir — deliberement.
INVOKER supposait que la RLS de `athletes` ait la bonne granularite. Elle ne
l'a pas : la RLS est par LIGNE, l'exposition est COLONNAIRE. Tant qu'une policy
partenaire existait sur athletes, les 87 colonnes des lignes visibles etaient
lisibles en PostgREST direct (email, date_naissance, nom_parent... verifie en
runtime). Cette policy est desormais SUPPRIMEE, et cette vue ne peut donc plus
etre en INVOKER : elle ne verrait plus aucune ligne.

Pour le chemin partenaire, DEFINER avec gate interne est la posture FORTE :
c'est elle qui permet de maitriser la projection.

Acces restreint par : REVOKE anon + gate is_approved_partner(auth.uid()) dans le
WHERE. Un non-partenaire authentifie lit 0 ligne.

ATTENTION — tout CREATE OR REPLACE VIEW sur cet objet efface les reloptions.
Ici l'attendu est justement l'ABSENCE de security_invoker, donc un
CREATE OR REPLACE est sans danger de ce point de vue. Mais il ferait perdre les
colonnes projetees si la definition partait d'une version anterieure : `genre`
(ajoute 2026-08-18) alimente les filtres genre des QUATRE ecrans partenaire.

Voir docs/security-definer-partner-views-investigation-20260706.md et
scripts/check-view-hardening.sql, dont l'attendu pour cette vue est DEFINER.$c$;

-- Vérifications contre les relevés prod du 2026-10-26.
do $$
begin
  if md5(pg_get_viewdef('public.top_athletes_view'::regclass)) <> 'b677336de698551f2d5b733bc7f70bab'
     or md5(pg_get_viewdef('public.trending_athletes_view'::regclass)) <> 'b45eb0030c789288a79dddbdd020d060' then
    raise exception 'NEXUS: vues locales différentes de la prod';
  end if;
  if md5(obj_description('public.top_athletes_view'::regclass, 'pg_class')) <> 'af7d280ebfb0efef9c6671ef88cab628' then
    raise exception 'NEXUS: commentaire de top_athletes_view différent de la prod';
  end if;
  if (select string_agg(proname || ':' || left(md5(prosrc), 8), ' ' order by proname) from pg_proc
       where pronamespace = 'public'::regnamespace
         and proname in ('is_approved_partner', 'is_partner_media_athlete', 'is_partner_eligible_athlete', 'peut_voir_cegepiens',
                         'athlete_est_cegepien', 'unite_voit_cegepiens', 'athlete_identity_ok', 'user_has_pro', 'is_admin',
                         'recruiter_search_athletes', 'recruiter_athlete_cards', 'recruiter_athlete_profile'))
     <> 'athlete_est_cegepien:3cd17450 athlete_identity_ok:ded602d0 is_admin:02d64a24 is_approved_partner:3d4da666 '
        'is_partner_eligible_athlete:1a196afe is_partner_media_athlete:24dec49b peut_voir_cegepiens:65353c9f '
        'recruiter_athlete_cards:ba26d8b8 recruiter_athlete_profile:0fccf321 recruiter_search_athletes:aba2e501 '
        'unite_voit_cegepiens:1a5be0be user_has_pro:17c163dc' then
    raise exception 'NEXUS: fonctions locales différentes de la prod';
  end if;
end $$;
commit;
\echo '== nexus_b3 alignée sur la prod (objets B3).'
