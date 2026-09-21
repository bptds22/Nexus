-- ═══════════════════════════════════════════════════════════════════════════
-- date_naissance protégée après l'onboarding + vues partenaire restreintes aux
-- fiches ACTIF + security_barrier restauré sur trending_athletes_view.
-- Décision BP 2026-09-21 (option A du diagnostic consentement).
--
-- ── 1. LE TROU, DANS SES DEUX SENS ───────────────────────────────────────
-- `date_naissance` n'était PAS dans enforce_athlete_self_edit_perimeter :
-- l'athlète la modifiait librement après l'onboarding (web /athlete/profil,
-- mobile AthleteEditWizardMobile). Deux conséquences :
--   ↓ se déclarer adulte à /consentements, puis se rajeunir : le consentement
--     parental n'est jamais demandé. Cas réel : 58c57cb7 (2006 déclaré au
--     consentement, 2009 sur la fiche — 16 ans, sans consentement).
--   ↑ un mineur SANS consentement se vieillit à 18 ans : athlete_identity_ok()
--     passe à vrai par l'âge et son identité devient visible des recruteurs.
--     Le sens le plus grave — aucun trigger « au passage sous 18 ans » ne
--     l'aurait fermé.
-- Protéger la colonne pour l'ATHLÈTE ferme les deux sens.
--
-- LIBRE PENDANT L'ONBOARDING (users.onboarding_complete <> true) : saisir sa
-- date de naissance EST un geste d'inscription. Même frontière que la
-- décision BP du 2026-09-11 sur school_id / coach_id (volet 5 D6, non encore
-- appliqué) — mais limitée ici à date_naissance : rien d'autre ne s'ouvre.
--
-- COACH ET ADMIN la modifient toujours : la garde sort dès que l'auteur n'est
-- pas l'athlète lui-même (auth.uid() <> OLD.user_id), inchangé. Le trou
-- résiduel qu'ils ouvrent (passage sous 18 ans sans consentement par un
-- coach/admin) est l'option B, au registre (docs/fast-follow-1.4.2.md).
--
-- IS DISTINCT FROM, comme toutes les colonnes de la garde : un enregistrement
-- qui RENVOIE la date inchangée (le binaire mobile en magasin envoie un patch
-- complet) passe. Seul un vrai changement lève.
--
-- Le corps repris est celui de la PROD (relevé 2026-09-21, md5
-- 86f062fd59fd8843156ece10d8f15ece), pas celui de la base locale, qui en
-- diffère par la forme (|| au lieu de array_append) — sans changement de sens.
--
-- ── 2. VUES PARTENAIRE : status = 'ACTIF' ────────────────────────────────
-- top_athletes_view et trending_athletes_view sont DEFINER (assumé, voir
-- scripts/check-view-hardening.sql) : elles contournent la RLS de `athletes`,
-- dont la politique recruteur filtre status = 'ACTIF'. Leur seul gate était
-- is_partner_eligible_athlete() AND is_approved_partner() — aucun des deux ne
-- regarde `status`. Une fiche masquée (EN_ATTENTE, DESACTIVE, SUPPRIME) avec
-- de l'activité restait donc visible des partenaires. Le filtre s'ajoute au
-- gate ; rien d'autre ne change.
--
-- ── 3. security_barrier SUR trending_athletes_view ───────────────────────
-- Posé le 2026-07-07 (20260706120200_harden_trending_athletes_view) : empêche
-- qu'une fonction ou un opérateur fourni par l'appelant soit évalué AVANT le
-- gate. PERDU le 2026-08-17 par trending_athletes_view_genre — un CREATE OR
-- REPLACE qui ne restatait pas la clause (règle 10 du checklist). Relevé
-- 2026-09-21 : reloptions = NULL en prod. Restauré ici, et désormais contrôlé
-- par scripts/check-view-hardening.sql (colonne barriere_attendue).
--
-- top_athletes_view n'a JAMAIS porté security_barrier (reloptions NULL depuis
-- son retour en DEFINER le 2026-08-19) : laissée telle quelle, hors périmètre
-- de cette décision.
--
-- Colonnes, types et ordre reproduits À L'IDENTIQUE (CREATE OR REPLACE VIEW
-- l'exige). Définitions reprises de pg_get_viewdef en prod, identiques au
-- local (md5 b25367b3… et 69278844…).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La garde d'auto-édition ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_athlete_self_edit_perimeter()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bloquees text[] := ARRAY[]::text[];
BEGIN
  -- Pas l'athlète lui-même en écriture DIRECTE ? On ne s'en mêle pas.
  -- En INVOKER, current_user = 'authenticated' pour un UPDATE venu du client,
  -- et le propriétaire de la fonction appelante pour un chemin DEFINER.
  -- ⚠ EXCLUSION VOLONTAIRE : statut_recrutement_override n'est PAS bloquée —
  -- règle produit CLAUDE.md, l'écriture athlète y est légitime.
  IF current_user <> 'authenticated'
     OR auth.uid() IS NULL
     OR OLD.user_id IS NULL
     OR auth.uid() <> OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id   IS DISTINCT FROM OLD.user_id   THEN v_bloquees := array_append(v_bloquees, 'user_id');   END IF;
  IF NEW.coach_id  IS DISTINCT FROM OLD.coach_id  THEN v_bloquees := array_append(v_bloquees, 'coach_id');  END IF;
  IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN v_bloquees := array_append(v_bloquees, 'school_id'); END IF;
  IF NEW.status    IS DISTINCT FROM OLD.status    THEN v_bloquees := array_append(v_bloquees, 'status');    END IF;

  IF NEW.verified            IS DISTINCT FROM OLD.verified            THEN v_bloquees := array_append(v_bloquees, 'verified');            END IF;
  IF NEW.verified_at         IS DISTINCT FROM OLD.verified_at         THEN v_bloquees := array_append(v_bloquees, 'verified_at');         END IF;
  IF NEW.verified_by         IS DISTINCT FROM OLD.verified_by         THEN v_bloquees := array_append(v_bloquees, 'verified_by');         END IF;
  IF NEW.verification_method IS DISTINCT FROM OLD.verification_method THEN v_bloquees := array_append(v_bloquees, 'verification_method'); END IF;

  IF NEW.cote_globale_entraineur IS DISTINCT FROM OLD.cote_globale_entraineur THEN v_bloquees := array_append(v_bloquees, 'cote_globale_entraineur'); END IF;

  IF NEW.profile_completion IS DISTINCT FROM OLD.profile_completion THEN v_bloquees := array_append(v_bloquees, 'profile_completion'); END IF;
  IF NEW.is_showcase        IS DISTINCT FROM OLD.is_showcase        THEN v_bloquees := array_append(v_bloquees, 'is_showcase');        END IF;

  IF NEW.consentement_parental      IS DISTINCT FROM OLD.consentement_parental      THEN v_bloquees := array_append(v_bloquees, 'consentement_parental');      END IF;
  IF NEW.consentement_parental_date IS DISTINCT FROM OLD.consentement_parental_date THEN v_bloquees := array_append(v_bloquees, 'consentement_parental_date'); END IF;
  IF NEW.partner_visibility_opt_in            IS DISTINCT FROM OLD.partner_visibility_opt_in            THEN v_bloquees := array_append(v_bloquees, 'partner_visibility_opt_in');            END IF;
  IF NEW.partner_visibility_opted_in_at       IS DISTINCT FROM OLD.partner_visibility_opted_in_at       THEN v_bloquees := array_append(v_bloquees, 'partner_visibility_opted_in_at');       END IF;
  IF NEW.partner_visibility_parental_consent  IS DISTINCT FROM OLD.partner_visibility_parental_consent  THEN v_bloquees := array_append(v_bloquees, 'partner_visibility_parental_consent');  END IF;

  IF NEW.recruitment_status            IS DISTINCT FROM OLD.recruitment_status            THEN v_bloquees := array_append(v_bloquees, 'recruitment_status');            END IF;
  IF NEW.recruitment_status_changed_by IS DISTINCT FROM OLD.recruitment_status_changed_by THEN v_bloquees := array_append(v_bloquees, 'recruitment_status_changed_by'); END IF;
  IF NEW.recruitment_status_changed_at IS DISTINCT FROM OLD.recruitment_status_changed_at THEN v_bloquees := array_append(v_bloquees, 'recruitment_status_changed_at'); END IF;
  IF NEW.committed_school_id           IS DISTINCT FROM OLD.committed_school_id           THEN v_bloquees := array_append(v_bloquees, 'committed_school_id');           END IF;

  -- date_naissance : libre PENDANT l'onboarding, protégée APRÈS (2026-09-21).
  -- Ferme les deux sens du trou de consentement (voir l'en-tête). La lecture
  -- de users passe : l'auteur est ici l'athlète lui-même, et « users read
  -- own » lui rend sa propre ligne. `IS TRUE` : un onboarding_complete NULL
  -- vaut « pas fini », comme partout ailleurs (=== true côté client).
  IF NEW.date_naissance IS DISTINCT FROM OLD.date_naissance
     AND EXISTS (SELECT 1 FROM public.users u
                  WHERE u.id = OLD.user_id AND u.onboarding_complete IS TRUE) THEN
    v_bloquees := array_append(v_bloquees, 'date_naissance');
  END IF;

  IF array_length(v_bloquees, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: ces informations ne se modifient pas depuis ton profil (%). Elles sont tenues par ton entraîneur ou par Nexus.',
      array_to_string(v_bloquees, ', ');
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 2a. top_athletes_view — + status = 'ACTIF' ───────────────────────────
-- DEFINER, reloptions NULL : pas de clause WITH à restater (vérifié).
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
    a.video_faits_saillants_url,
    a.video_match_complet_url,
    a.video_entrainement_url,
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

-- ── 2b. trending_athletes_view — + status = 'ACTIF' + security_barrier ───
CREATE OR REPLACE VIEW public.trending_athletes_view
  WITH (security_barrier = true) AS
 WITH recent_views AS (
         SELECT recruiter_athlete_views.athlete_id,
            count(*) AS views_last_7d
           FROM public.recruiter_athlete_views
          WHERE recruiter_athlete_views.viewed_at >= (now() - '7 days'::interval)
          GROUP BY recruiter_athlete_views.athlete_id
        ), prior_views AS (
         SELECT recruiter_athlete_views.athlete_id,
            count(*) AS views_prior_7d
           FROM public.recruiter_athlete_views
          WHERE recruiter_athlete_views.viewed_at >= (now() - '14 days'::interval) AND recruiter_athlete_views.viewed_at < (now() - '7 days'::interval)
          GROUP BY recruiter_athlete_views.athlete_id
        ), recent_favs AS (
         SELECT recruiter_favorites.athlete_id,
            count(*) AS favs_last_7d
           FROM public.recruiter_favorites
          WHERE recruiter_favorites.created_at >= (now() - '7 days'::interval)
          GROUP BY recruiter_favorites.athlete_id
        ), prior_favs AS (
         SELECT recruiter_favorites.athlete_id,
            count(*) AS favs_prior_7d
           FROM public.recruiter_favorites
          WHERE recruiter_favorites.created_at >= (now() - '14 days'::interval) AND recruiter_favorites.created_at < (now() - '7 days'::interval)
          GROUP BY recruiter_favorites.athlete_id
        )
 SELECT a.id,
    a.first_name,
    a.last_name,
    a.photo_url,
    a.cote_globale_entraineur,
    sch.region,
    sch.name AS school_name,
    a.annee_diplomation,
    s.nom AS sport_name,
    COALESCE(rv.views_last_7d, 0::bigint) AS views_7d,
    COALESCE(pv.views_prior_7d, 0::bigint) AS views_prior_7d,
    COALESCE(rv.views_last_7d, 0::bigint) - COALESCE(pv.views_prior_7d, 0::bigint) AS views_delta,
    COALESCE(rfv.favs_last_7d, 0::bigint) AS favs_7d,
    COALESCE(pf.favs_prior_7d, 0::bigint) AS favs_prior_7d,
    COALESCE(rfv.favs_last_7d, 0::bigint) - COALESCE(pf.favs_prior_7d, 0::bigint) AS favs_delta,
    a.sport_id,
    a.position_id,
    a.genre
   FROM public.athletes a
     LEFT JOIN public.sports s ON s.id = a.sport_id
     LEFT JOIN public.schools sch ON sch.id = a.school_id
     LEFT JOIN recent_views rv ON rv.athlete_id = a.id
     LEFT JOIN prior_views pv ON pv.athlete_id = a.id
     LEFT JOIN recent_favs rfv ON rfv.athlete_id = a.id
     LEFT JOIN prior_favs pf ON pf.athlete_id = a.id
  WHERE a.status = 'ACTIF'::public.account_status
    AND public.is_partner_eligible_athlete(a.id) AND public.is_approved_partner(auth.uid());

-- ── 3. Gates — listes COMPLÈTES, jamais par inclusion (CLAUDE.md) ────────
do $$
declare
  vus  text[];
  f    record;
begin
  -- ACL de la fonction de garde : inchangée par CREATE OR REPLACE, vérifiée
  -- quand même (relevé prod 2026-09-21 : {postgres, authenticated}).
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.enforce_athlete_self_edit_perimeter()'::regprocedure;
  if vus is distinct from array['authenticated','postgres'] then
    raise exception 'NEXUS: ACL de enforce_athlete_self_edit_perimeter = %, attendu {authenticated,postgres}', vus;
  end if;

  -- La garde porte bien date_naissance, et le trigger est toujours branché.
  if position('date_naissance' in pg_get_functiondef('public.enforce_athlete_self_edit_perimeter()'::regprocedure)) = 0 then
    raise exception 'NEXUS: la garde ne protege pas date_naissance.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_athlete_self_edit_perimeter'
                   and tgrelid = 'public.athletes'::regclass and tgenabled <> 'D') then
    raise exception 'NEXUS: trg_athlete_self_edit_perimeter absent ou desactive.';
  end if;

  -- ACL des vues : CREATE OR REPLACE VIEW les conserve — vérifié en entier
  -- (relevé prod 2026-09-21 : {authenticated, postgres, service_role}).
  for f in select * from (values ('public.top_athletes_view'::regclass), ('public.trending_athletes_view'::regclass)) as t(oid)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_class c,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(c.relacl::text[]) as x) t
     where c.oid = f.oid;
    if vus is distinct from array['authenticated','postgres','service_role'] then
      raise exception 'NEXUS: ACL de % = %, attendu {authenticated,postgres,service_role}', f.oid::regclass, vus;
    end if;
  end loop;

  -- reloptions : trending = barrière seule, top = rien. Comparaison COMPLÈTE :
  -- un security_invoker apparu par erreur viderait /partenaire/tendances.
  if (select reloptions from pg_class where oid = 'public.trending_athletes_view'::regclass)
       is distinct from array['security_barrier=true'] then
    raise exception 'NEXUS: reloptions de trending_athletes_view = %, attendu {security_barrier=true}',
      (select reloptions from pg_class where oid = 'public.trending_athletes_view'::regclass);
  end if;
  if (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass) is not null then
    raise exception 'NEXUS: reloptions de top_athletes_view = %, attendu NULL (DEFINER sans barriere, assume)',
      (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass);
  end if;

  -- Le filtre status est bien dans les deux vues.
  if pg_get_viewdef('public.top_athletes_view'::regclass) !~ 'status = ''ACTIF''' then
    raise exception 'NEXUS: top_athletes_view ne filtre pas status = ACTIF.';
  end if;
  if pg_get_viewdef('public.trending_athletes_view'::regclass) !~ 'status = ''ACTIF''' then
    raise exception 'NEXUS: trending_athletes_view ne filtre pas status = ACTIF.';
  end if;

  raise notice 'NEXUS: date_naissance protegee apres onboarding ; vues partenaire restreintes a ACTIF ; security_barrier restaure sur trending.';
end $$;
