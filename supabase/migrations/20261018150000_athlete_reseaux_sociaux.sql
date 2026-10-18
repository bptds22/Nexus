-- ════════════════════════════════════════════════════════════════════════════
-- Profils de réseaux sociaux de l'athlète (retour BP, 18 oct. 2026)
--
-- « Médias & liens » n'avait que les vidéos (faits saillants, Hudl, YouTube, match complet) et
-- Instagram. On ajoute les PROFILS Facebook, TikTok et LinkedIn (BP : pas Snapchat, pas X).
-- Instagram, Hudl, YouTube restent tels quels (le filtre « Avec vidéo » des recherches s'en sert).
-- Colonnes nommées (modèle de media_partners), https:// seulement, 300 caractères au plus.
--
-- Visibilité :
--   · athlète, coachs, recruteurs : comme instagram_url (fiche ; masqué au palier gratuit à l'écran) ;
--   · PARTENAIRE (décision BP 2026-10-18) : partner_athlete_profile projette maintenant instagram_url,
--     facebook_url, tiktok_url, linkedin_url — toujours pour un athlète ACTIF qui a consenti
--     (is_partner_eligible_athlete). Le garde-fou de 20260904130334 tenait instagram_url « hors
--     lot, à décider explicitement » : c'est décidé. La fonction est recréée (type de retour élargi
--     de 4 colonnes, ajoutées EN FIN) ; corps d'avant relevé en prod = local (md5).
--   · delete_my_account efface les nouveaux liens comme les autres.
-- Rollback : supabase/rollback/20261018150000_rollback_athlete_reseaux_sociaux.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'athletes'
                and column_name in ('facebook_url', 'tiktok_url', 'linkedin_url')) then
    raise exception 'NEXUS: 20261018150000 déjà appliquée (colonnes de réseaux sociaux présentes)';
  end if;
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'delete_my_account')
     is distinct from '2c1ad094d8a3c8e76d2a6dade9c2a33e' then
    raise exception 'NEXUS: delete_my_account a changé — recopier la version en place avant d''appliquer';
  end if;
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'partner_athlete_profile')
     is distinct from '496104a74ea8d5eaeec3e6918ab34dd9' then
    raise exception 'NEXUS: partner_athlete_profile a changé — recopier la version en place avant d''appliquer';
  end if;
end $$;

alter table public.athletes
  add column facebook_url text check (char_length(facebook_url) <= 300 and facebook_url ~* '^https://'),
  add column tiktok_url   text check (char_length(tiktok_url)   <= 300 and tiktok_url   ~* '^https://'),
  add column linkedin_url text check (char_length(linkedin_url) <= 300 and linkedin_url ~* '^https://');

comment on column public.athletes.facebook_url is 'Profil Facebook de l''athlète (https://). Visible comme instagram_url, partenaire compris (BP 2026-10-18).';
comment on column public.athletes.tiktok_url   is 'Profil TikTok de l''athlète (https://). Visible comme instagram_url, partenaire compris (BP 2026-10-18).';
comment on column public.athletes.linkedin_url is 'Profil LinkedIn de l''athlète (https://). Visible comme instagram_url, partenaire compris (BP 2026-10-18).';

-- delete_my_account : les nouveaux liens s'effacent avec les autres (seul ajout : 3 lignes).
CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_athlete_id uuid;
BEGIN
  -- Garde : on supprime TOUJOURS l'appelant. Jamais de paramètre user_id.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'delete_my_account: aucun utilisateur authentifié (auth.uid() est NULL)';
  END IF;

  -- Fiche athlète liée à l'appelant. NULL pour un coach/recruteur, ou un
  -- athlète créé par un coach (jamais réclamé). Toute la branche B/C est gardée.
  SELECT id INTO v_athlete_id FROM athletes WHERE user_id = v_uid;

  -- ───────────────────────────────────────────────────────────────────────
  -- A. Audit Loi 25 : marquer la demande de suppression COMPLETED AVANT purge.
  --    Grâce à 1b, user_id passera en SET NULL au DELETE final → la ligne
  --    d'audit survit, anonymisée (scope/status/dates conservés).
  -- ───────────────────────────────────────────────────────────────────────
  UPDATE deletion_requests
     SET status = 'COMPLETED', completed_at = now(), updated_at = now()
   WHERE user_id = v_uid;

  IF v_athlete_id IS NOT NULL THEN
    -- ─────────────────────────────────────────────────────────────────────
    -- B. Appelant ATHLÈTE : purge des FK NO ACTION → athletes AVANT l'UPDATE.
    --    Débloque les FK ET évite que log_athlete_update (déclenché par le
    --    scrub de video_faits_saillants_url) insère des lignes parasites
    --    chez les recruteurs ayant favorisé (le SELECT ... FROM
    --    recruiter_favorites renverra alors 0 ligne).
    -- ─────────────────────────────────────────────────────────────────────
    DELETE FROM recruiter_favorites     WHERE athlete_id = v_athlete_id;
    DELETE FROM recruiter_notes         WHERE athlete_id = v_athlete_id;
    DELETE FROM recruiter_pipeline      WHERE athlete_id = v_athlete_id;
    DELETE FROM recruiter_athlete_views WHERE athlete_id = v_athlete_id;

    -- ─────────────────────────────────────────────────────────────────────
    -- C. ANONYMISER la fiche athlète SUR PLACE (pas de DELETE : la preuve de
    --    consentement cascade depuis athletes, il faut donc garder la ligne).
    --
    --    partner_visibility_opt_in=false neutralise emit_five_star_on_eligibility_flip
    --    (is_partner_eligible_athlete → false) → AUCUN événement newsroom, même
    --    avec date_naissance modifiée.
    --
    --    NE PAS toucher : verified*, cote_globale_entraineur, recruitment_status*,
    --    consent_id, consentement_parental* (preuve), sport_id/position_id/equipe/
    --    ligue (structurel, non-PII) — pour ne déclencher aucun trigger newsroom.
    -- ─────────────────────────────────────────────────────────────────────
    UPDATE athletes SET
      -- Identité (first/last NOT NULL → placeholder ; le reste → NULL)
      first_name = '[supprimé]',
      last_name  = '[supprimé]',
      date_naissance = NULL,
      genre = NULL,
      email = NULL,                 -- bloque aussi l'orphan-claim (RLS email match)
      telephone = NULL,
      photo_url = NULL,
      bio = NULL,
      -- Parent / tuteur
      nom_parent = NULL,
      telephone_parent = NULL,
      parent_first_name = NULL,
      parent_last_name = NULL,
      parent_email = NULL,
      parent_relationship = NULL,
      -- Identifiants / texte libre
      numero_association = NULL,
      numero_jersey = NULL,
      notes_coach = NULL,
      programme_interet = NULL,
      -- Médias / réseaux (rattachables à l'identité)
      video_faits_saillants_url = NULL,
      video_match_complet_url = NULL,
      video_entrainement_url = NULL,
      hudl_url = NULL,
      youtube_url = NULL,
      instagram_url = NULL,
      facebook_url = NULL,
      tiktok_url = NULL,
      linkedin_url = NULL,
      -- Scolaire (données personnelles)
      moyenne_generale = NULL,
      annee_diplomation = NULL,
      matieres_fortes = NULL,
      mentions_academiques = NULL,
      programme_cegep_vise = NULL,
      regions_cegep_preferees = NULL,
      -- Biométrie / mensurations / tests
      taille_pieds = NULL,
      taille_pouces = NULL,
      poids_lbs = NULL,
      envergure = NULL,
      taille_mains = NULL,
      main_dominante = NULL,
      pied_dominant = NULL,
      test_40_verges = NULL,
      saut_vertical = NULL,
      saut_longueur = NULL,
      developpe_couche = NULL,
      navette_agilite = NULL,
      sprint_100m = NULL,
      -- Liens (bloquent claim coach/athlète + détachent)
      coach_id = NULL,
      school_id = NULL,
      committed_school_id = NULL,
      user_id = NULL,               -- redondant avec le SET NULL du cascade final
      -- Visibilité partenaire (neutralise le trigger five_star + retrait Loi 25)
      partner_visibility_opt_in = false,
      partner_visibility_parental_consent = false,
      partner_visibility_opted_in_at = NULL,
      -- Statut terminal (RLS recruteur exige status='ACTIF' → exclut la recherche)
      status = 'SUPPRIME'
    WHERE id = v_athlete_id;
  END IF;

  -- ───────────────────────────────────────────────────────────────────────
  -- D. Purge des FK RESTRICT / NO ACTION → users et → auth.users qui
  --    bloqueraient le DELETE auth.users (et le cascade vers public.users).
  --    Données possédées par l'appelant → DELETE. Références « acteur » sur
  --    des enregistrements partagés/globaux (colonne nullable) → SET NULL.
  -- ───────────────────────────────────────────────────────────────────────
  -- Messagerie : messages.sender_id RESTRICT ; messages.conversation_id CASCADE.
  DELETE FROM messages      WHERE sender_id = v_uid;
  DELETE FROM conversations WHERE coach_id = v_uid OR recruiter_id = v_uid; -- cascade messages restants

  -- Évaluations / avis / suggestions / pipeline / signalements (RESTRICT → users)
  DELETE FROM evaluations         WHERE coach_id = v_uid;
  DELETE FROM coach_reviews       WHERE coach_id = v_uid OR recruiter_id = v_uid;
  DELETE FROM athlete_suggestions WHERE coach_id = v_uid OR submitted_by = v_uid;
  DELETE FROM pipeline            WHERE recruiter_id = v_uid;
  DELETE FROM reports             WHERE reported_user_id = v_uid;

  -- Requêtes dont la colonne acteur est NOT NULL → DELETE la ligne entière.
  DELETE FROM admin_transfer_requests WHERE from_user_id = v_uid OR to_user_id = v_uid;
  DELETE FROM commitment_requests     WHERE requested_by = v_uid;

  -- Références « acteur » nullable sur des enregistrements partagés → SET NULL
  -- (on NE supprime PAS le réglage global / le partenaire / la fiche d'autrui).
  UPDATE app_settings   SET updated_by  = NULL WHERE updated_by  = v_uid;
  UPDATE media_partners SET approved_by = NULL WHERE approved_by = v_uid;
  UPDATE athletes       SET recruitment_status_changed_by = NULL
                        WHERE recruitment_status_changed_by = v_uid;

  -- Recruteur : FK NO ACTION → auth.users (par recruiter_id) bloquant le DELETE.
  DELETE FROM recruiter_favorites     WHERE recruiter_id = v_uid;
  DELETE FROM recruiter_notes         WHERE recruiter_id = v_uid;
  DELETE FROM recruiter_pipeline      WHERE recruiter_id = v_uid;
  DELETE FROM recruiter_athlete_views WHERE recruiter_id = v_uid;

  -- NB : parental_consents.coach_id et consent_audit_trail.coach_id passent
  --      AUTOMATIQUEMENT en SET NULL au DELETE de public.users (1c + existant).
  --      On ne les supprime PAS : c'est la preuve de consentement des athlètes.

  -- ───────────────────────────────────────────────────────────────────────
  -- E. (Défense-en-profondeur) Scrub PII de public.users AVANT le delete.
  --    Techniquement redondant (la ligne cascade-disparaît en F), mais sûr
  --    si jamais le DELETE final était différé/empêché en aval.
  -- ───────────────────────────────────────────────────────────────────────
  UPDATE users SET
    email = 'deleted-' || v_uid::text || '@deleted.invalid',  -- NOT NULL → placeholder
    first_name = NULL,
    last_name = NULL,
    phone = NULL,
    avatar_url = NULL,
    photo_url = NULL,
    date_naissance = NULL,
    title = NULL,
    team_name = NULL,
    division = NULL,
    sport = NULL,
    region = NULL,
    profile_data = NULL,
    recruitment_preferences = NULL,
    notification_preferences = NULL,
    privacy_preferences = NULL
  WHERE id = v_uid;

  -- ───────────────────────────────────────────────────────────────────────
  -- F. Suppression du compte auth. Cascade : public.users + auth.identities +
  --    auth.sessions + tous les auth.* + les SET NULL → users restants
  --    (athletes.coach_id/user_id/verified_by, consent_audit_trail.coach_id,
  --     parental_consents.coach_id/withdrawn_by, deletion_requests.user_id, …).
  --    Le rôle postgres (owner de cette fonction) a le privilège DELETE sur
  --    auth.users (vérifié). Aucun trigger DELETE sur auth.users.
  -- ───────────────────────────────────────────────────────────────────────
  DELETE FROM auth.users WHERE id = v_uid;

END;
$function$;

do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.delete_my_account()'::regprocedure;
  if vus is distinct from array['authenticated','postgres','service_role'] then
    raise exception 'NEXUS: ACL public.delete_my_account() = %', vus;
  end if;
end $$;

-- partner_athlete_profile : 61 → 65 colonnes (réseaux sociaux en fin). Seul changement.
drop function public.partner_athlete_profile(uuid);
CREATE OR REPLACE FUNCTION public.partner_athlete_profile(p_athlete_id uuid)
 RETURNS TABLE(id uuid, first_name text, last_name text, photo_url text, numero_jersey text, age integer, genre text, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, taille_pieds integer, taille_pouces integer, poids_lbs numeric, bio text, sport_nom text, position_nom text, position_abbr text, school_name text, school_region text, school_city text, school_type text, is_civil boolean, team_name text, league_name text, distinctions jsonb, video_faits_saillants_url text, hudl_url text, youtube_url text, badges jsonb, profile_completion integer, envergure text, taille_mains text, main_dominante text, pied_dominant text, test_40_verges text, saut_vertical text, saut_longueur text, developpe_couche text, navette_agilite text, sprint_100m text, video_match_complet_url text, video_entrainement_url text, parcours_equipes jsonb, eval_id uuid, eval_grille_id uuid, eval_cote_globale numeric, vitesse_explosivite numeric, force_puissance numeric, endurance_cardio numeric, agilite_coordination numeric, vision_du_jeu numeric, sens_tactique numeric, leadership integer, discipline integer, coachabilite integer, intelligence_jeu integer, competitivite integer, esprit_equipe integer, resilience integer, attitude_mentalite integer, instagram_url text, facebook_url text, tiktok_url text, linkedin_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    a.id, a.first_name, a.last_name, a.photo_url, a.numero_jersey,
    extract(year from age(a.date_naissance))::int as age,
    a.genre, a.annee_diplomation, a.verified, a.last_profile_validation,
    -- LOT 2 : la préséance du recruteur, décidée UNE fois, côté serveur.
    coalesce(e.cote_globale, a.cote_globale_entraineur) as cote_globale,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
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
    ) as badges,
    a.profile_completion,
    a.envergure, a.taille_mains, a.main_dominante, a.pied_dominant,
    a.test_40_verges, a.saut_vertical, a.saut_longueur,
    a.developpe_couche, a.navette_agilite, a.sprint_100m,
    a.video_match_complet_url, a.video_entrainement_url,
    a.parcours_equipes,
    e.id, e.grille_id, e.cote_globale,
    e.vitesse_explosivite, e.force_puissance, e.endurance_cardio,
    e.agilite_coordination, e.vision_du_jeu, e.sens_tactique,
    e.leadership, e.discipline, e.coachabilite,
    e.intelligence_jeu, e.competitivite, e.esprit_equipe,
    e.resilience, e.attitude_mentalite,
    -- 2026-10-18 (décision BP) : les profils de réseaux sociaux sont ouverts au partenaire.
    a.instagram_url, a.facebook_url, a.tiktok_url, a.linkedin_url
  from public.athletes a
  left join public.sports    s   on s.id   = a.sport_id
  left join public.positions p   on p.id   = a.position_id
  left join public.schools   sch on sch.id = a.school_id
  -- team_athletes porte UNIQUE (athlete_id) : la jointure est 1:0..1, aucune
  -- duplication possible (verifie 2026-08-19, 0 athlete multi-equipes).
  left join public.team_athletes ta on ta.athlete_id = a.id
  left join public.teams         t  on t.id = ta.team_id
  left join lateral (
    -- L'ÉVALUATION RETENUE — même clé que selectBestEvaluation côté front
    -- (`updated_at desc`) : la divergence `created_at` d'août est corrigée.
    -- `nulls last` = le -Infinity que le frontend donne à un updated_at
    -- manquant. rapport_entraineur et notes_coach NE SONT PAS ICI, et n'y
    -- seront pas — voir LE CADRE en tête de fichier.
    select ev.id, ev.grille_id, ev.cote_globale, ev.distinctions,
           ev.vitesse_explosivite, ev.force_puissance, ev.endurance_cardio,
           ev.agilite_coordination, ev.vision_du_jeu, ev.sens_tactique,
           ev.leadership, ev.discipline, ev.coachabilite, ev.intelligence_jeu,
           ev.competitivite, ev.esprit_equipe, ev.resilience, ev.attitude_mentalite
    from public.evaluations ev
    where ev.athlete_id = a.id
    order by ev.updated_at desc nulls last, ev.created_at desc
    limit 1
  ) e on true
  where a.id = p_athlete_id
    -- W0.5 : comme top_athletes_view / trending_athletes_view, une fiche inactive
    -- (EN_ATTENTE, DESACTIVE, DIPLOME) n'est plus lisible par id.
    and a.status = 'ACTIF'
    and public.is_approved_partner(null)
    and public.is_partner_eligible_athlete(a.id);
$function$;
revoke all on function public.partner_athlete_profile(uuid) from public, anon;
grant execute on function public.partner_athlete_profile(uuid) to authenticated, service_role;

do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.partner_athlete_profile(uuid)'::regprocedure;
  if vus is distinct from array['authenticated','postgres','service_role'] then
    raise exception 'NEXUS: ACL public.partner_athlete_profile(uuid) = %', vus;
  end if;
end $$;
