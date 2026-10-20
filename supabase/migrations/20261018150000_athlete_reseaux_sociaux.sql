-- ════════════════════════════════════════════════════════════════════════════
-- 20261018150000 — Réseaux sociaux de l'athlète + consentement partenaires v2
-- (retours BP 18 et 19 oct. 2026 ; livré en 1.4.5)
--
-- 1. Profils Facebook, TikTok, LinkedIn sur athletes (https://, 300 car. max). Instagram,
--    Hudl, YouTube et les vidéos existaient déjà. L'athlète les écrit lui-même (aucune
--    garde de périmètre sur ces colonnes) ; delete_my_account les efface.
--
-- 2. Consentement partenaires, VERSION 2 (BP 2026-10-19). Le texte v2 nomme explicitement
--    les VIDÉOS et les RÉSEAUX SOCIAUX. Règle :
--      · le partenaire voit le reste de la fiche comme avant (v1 suffit, rien ne change) ;
--      · il ne voit les vidéos (5 liens) et les réseaux (4 profils) QUE si l'athlète a donné
--        un accord v2 POSTÉRIEUR à son dernier accord (is_partner_media_athlete) ;
--      · un retrait coupe tout, comme aujourd'hui (is_partner_eligible_athlete passe à faux).
--    Où vit la v2 : table consentement_partenaire_v2 (une ligne par athlète). La ligne
--    athletes n'est JAMAIS écrite pour la v2 : aucun des déclencheurs d'athletes ne part.
--    Qui la pose : un déclencheur sur consent_audit_trail. Tout accord image_partenaire
--    journalisé avec une politique v2 (2026-10-v2) vaut v2, quel que soit le chemin —
--    l'athlète (set_my_partner_visibility), le parent (set_child_consent), le lien courriel
--    (consentement_partenaire_par_jeton). Un client 1.4.4 passe une politique v1 : son
--    accord reste v1, ce qui est juste puisqu'il a lu le texte v1.
--    La preuve reste consent_audit_trail ; la table ne porte que l'état et la relance.
--
-- 3. La demande v2 (carte plein écran à l'ouverture) :
--      · consentement_partenaire_v2_etat() : faut-il l'afficher ? (pas de v2, pas de « Non »,
--        pas de demande au parent en cours, « Plus tard » < 3 fois et ≥ 3 jours depuis le dernier) ;
--      · consentement_partenaire_v2_repondre('OUI' | 'NON' | 'PLUS_TARD', politique) ;
--        « Non » ne retire RIEN (un accord v1 reste) et met fin aux relances, pour toujours ;
--      · consentement_partenaire_v2_pousser(confirmer) : UN push par athlète, jamais en heures
--        calmes (21 h – 8 h), lancé à la main après la sortie de la 1.4.5 ;
--      · admin_consentement_partenaire_stats() : compteur pour l'admin.
--
-- 4. Lecture partenaire : partner_athlete_profile (+ 3 réseaux, vidéos et réseaux masqués
--    sans v2) et top_athletes_view (vidéos masquées sans v2 ; le filtre « Avec vidéo » suit).
--
-- Corps d'avant relevés en prod le 2026-10-19 (md5 sans \r) : delete_my_account 2c1ad094…,
-- partner_athlete_profile 496104a7…, pg_get_viewdef(top_athletes_view) 1a4bd466…
-- Rollback : supabase/rollback/20261018150000_rollback_athlete_reseaux_sociaux.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'athletes'
                and column_name in ('facebook_url', 'tiktok_url', 'linkedin_url')) then
    raise exception 'NEXUS: 20261018150000 déjà appliquée (colonnes de réseaux sociaux présentes)';
  end if;
  if to_regclass('public.consentement_partenaire_v2') is not null then
    raise exception 'NEXUS: 20261018150000 déjà appliquée (consentement_partenaire_v2 présente)';
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
  if md5(pg_get_viewdef('public.top_athletes_view'::regclass)) is distinct from '1a4bd466dcad15765fb549864c852c70' then
    raise exception 'NEXUS: top_athletes_view a changé — recopier la version en place avant d''appliquer';
  end if;
  if (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass) is not null then
    raise exception 'NEXUS: top_athletes_view porte des reloptions — les restater dans le CREATE OR REPLACE';
  end if;
  if to_regprocedure('public.push_to_user(uuid, text, text, jsonb, text)') is null
     or to_regprocedure('public.push_heure_calme(timestamptz)') is null
     or to_regprocedure('public.set_my_partner_visibility(boolean, text)') is null
     or to_regprocedure('public.is_partner_eligible_athlete(uuid)') is null
     or to_regprocedure('public.emit_parent_notification(uuid, text, text, text, jsonb)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'NEXUS: une fonction attendue manque (push_to_user, push_heure_calme, set_my_partner_visibility, is_partner_eligible_athlete, emit_parent_notification, is_admin)';
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. RÉSEAUX SOCIAUX (colonnes) et delete_my_account
-- ════════════════════════════════════════════════════════════════════════════

alter table public.athletes
  add column facebook_url text check (char_length(facebook_url) <= 300 and facebook_url ~* '^https://'),
  add column tiktok_url   text check (char_length(tiktok_url)   <= 300 and tiktok_url   ~* '^https://'),
  add column linkedin_url text check (char_length(linkedin_url) <= 300 and linkedin_url ~* '^https://');


comment on column public.athletes.facebook_url is 'Profil Facebook de l''athlète (https://). Partenaire : seulement avec le consentement partenaires v2 (BP 2026-10-19).';
comment on column public.athletes.tiktok_url   is 'Profil TikTok de l''athlète (https://). Partenaire : seulement avec le consentement partenaires v2 (BP 2026-10-19).';
comment on column public.athletes.linkedin_url is 'Profil LinkedIn de l''athlète (https://). Partenaire : seulement avec le consentement partenaires v2 (BP 2026-10-19).';

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

-- ════════════════════════════════════════════════════════════════════════════
-- 2. CONSENTEMENT PARTENAIRES v2 — état par athlète
-- ════════════════════════════════════════════════════════════════════════════

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
comment on table public.consentement_partenaire_v2 is
  'Consentement partenaires v2 (vidéos + réseaux sociaux) : ÉTAT et relance, une ligne par athlète. '
  'La preuve est dans consent_audit_trail. Lecture et écriture par les fonctions SECURITY DEFINER seulement (BP 2026-10-19).';
alter table public.consentement_partenaire_v2 enable row level security;
revoke all on table public.consentement_partenaire_v2 from public, anon, authenticated;
grant all on table public.consentement_partenaire_v2 to service_role;

-- Les politiques de confidentialité dont le texte partenaires est la v2.
create function public.consentement_partenaire_politiques_v2()
returns text[]
language sql
immutable
set search_path to 'public'
as $$ select array['2026-10-v2']::text[] $$;

-- Accord v2 valide : un accord v2 au moins aussi récent que le dernier accord tout court.
-- Un retrait suivi d'un nouvel accord v1 (client 1.4.4) fait donc retomber en v1.
create function public.consentement_partenaire_v2_valide(p_athlete_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select coalesce((
    select a.partner_visibility_opt_in
           and c.accepte_le is not null
           and c.accepte_le >= coalesce(a.partner_visibility_opted_in_at, '-infinity'::timestamptz)
      from public.athletes a
      join public.consentement_partenaire_v2 c on c.athlete_id = a.id
     where a.id = p_athlete_id), false)
$$;

-- Le partenaire voit-il les vidéos et les réseaux ? Éligible (v1 suffit) ET v2 valide.
create function public.is_partner_media_athlete(p_athlete_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select coalesce(public.is_partner_eligible_athlete(p_athlete_id), false)
     and public.consentement_partenaire_v2_valide(p_athlete_id)
$$;

-- Déclencheur : tout accord image_partenaire journalisé sous une politique v2 pose la v2.
create function public.consentement_partenaire_v2_sur_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
begin
  if NEW.action = 'GRANTED'
     and NEW.metadata->>'consent_key' = 'image_partenaire'
     and NEW.metadata->>'policy_version' = any (public.consentement_partenaire_politiques_v2()) then
    insert into public.consentement_partenaire_v2 (athlete_id, accepte_le, maj_le)
    values (NEW.athlete_id, now(), now())
    on conflict (athlete_id) do update set accepte_le = now(), maj_le = now();
  end if;
  return null;
end $$;

create trigger trg_consentement_partenaire_v2_sur_audit
  after insert on public.consent_audit_trail
  for each row
  when (NEW.action = 'GRANTED' and NEW.metadata->>'consent_key' = 'image_partenaire')
  execute function public.consentement_partenaire_v2_sur_audit();

-- ── La demande à l'athlète ───────────────────────────────────────────────────

-- État pour l'athlète connecté : la carte plein écran s'affiche-t-elle ?
create function public.consentement_partenaire_v2_etat()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_uid  uuid := auth.uid();
  v_ath  public.athletes;
  v_c    public.consentement_partenaire_v2;
  v_onb  boolean;
  v_v2   boolean;
  v_14   boolean;
  v_aff  boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  select * into v_ath from public.athletes where user_id = v_uid limit 1;
  if v_ath.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into v_c from public.consentement_partenaire_v2 where athlete_id = v_ath.id;
  select coalesce(onboarding_complete, false) into v_onb from public.users where id = v_uid;

  v_v2  := public.consentement_partenaire_v2_valide(v_ath.id);
  v_14  := v_ath.date_naissance is not null and v_ath.date_naissance <= current_date - interval '14 years';
  v_aff := v_onb
           and v_ath.status in ('ACTIF', 'EN_ATTENTE')
           and not v_v2
           and v_c.refuse_le is null
           and v_c.demande_parent_le is null
           and coalesce(v_c.plus_tard_nb, 0) < 3
           and (v_c.plus_tard_le is null or now() >= v_c.plus_tard_le + interval '3 days');

  return jsonb_build_object(
    'ok',                true,
    'a_afficher',        v_aff,
    'statut',            case when v_v2 then 'V2' when v_ath.partner_visibility_opt_in then 'V1' else 'AUCUN' end,
    'refuse',            v_c.refuse_le is not null,
    'demande_parent',    v_c.demande_parent_le is not null,
    'plus_tard_nb',      coalesce(v_c.plus_tard_nb, 0),
    'peut_seul',         v_14
  );
end $$;

-- Réponse de l'athlète à la demande v2.
--   OUI       : accord v2 par set_my_partner_visibility (journalisé ; le déclencheur pose la v2).
--               Moins de 14 ans : la demande part au parent (notification), comme la demande partenaire.
--   NON       : rien n'est retiré (un accord v1 reste) ; plus jamais de relance. Journalisé (REFUSED).
--   PLUS_TARD : la carte revient après 3 jours, 3 fois au plus.
create function public.consentement_partenaire_v2_repondre(p_reponse text, p_policy_version text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $$
declare
  v_uid  uuid := auth.uid();
  v_ath  public.athletes;
  v_res  jsonb;
  v_n    int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_reponse is null or p_reponse not in ('OUI', 'NON', 'PLUS_TARD') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_value');
  end if;
  if p_policy_version is null or not (p_policy_version = any (public.consentement_partenaire_politiques_v2())) then
    return jsonb_build_object('ok', false, 'reason', 'policy_version_v2_required');
  end if;
  select count(*) into v_n from public.athletes where user_id = v_uid;
  if v_n <> 1 then
    return jsonb_build_object('ok', false, 'reason', case when v_n = 0 then 'not_found' else 'ambiguous' end);
  end if;
  select * into v_ath from public.athletes where user_id = v_uid;

  insert into public.consentement_partenaire_v2 (athlete_id) values (v_ath.id)
  on conflict (athlete_id) do nothing;

  if p_reponse = 'OUI' then
    v_res := public.set_my_partner_visibility(true, p_policy_version);
    if coalesce((v_res->>'ok')::boolean, false) then
      update public.consentement_partenaire_v2 set refuse_le = null, maj_le = now() where athlete_id = v_ath.id;
      return jsonb_build_object('ok', true, 'etat', 'ACCEPTEE');
    end if;
    if v_res->>'reason' is distinct from 'parent_required' then
      return v_res;
    end if;
    -- Moins de 14 ans : l'accord appartient au parent.
    if not exists (select 1 from public.parent_athletes pa where pa.athlete_id = v_ath.id) then
      return jsonb_build_object('ok', false, 'reason', 'parent_absent');
    end if;
    if not exists (select 1 from public.parent_notifications pn
                    where pn.athlete_id = v_ath.id and pn.type = 'CHILD_PARTNER_VISIBILITY_REQUEST' and not pn.read) then
      perform public.emit_parent_notification(
        v_ath.id, 'CHILD_PARTNER_VISIBILITY_REQUEST', 'Demande de visibilité partenaires',
        coalesce(nullif(btrim(v_ath.first_name), ''), 'Votre enfant')
          || ' aimerait partager sa carte, ses vidéos et ses réseaux sociaux avec les partenaires de Nexus. '
          || 'Votre accord est requis : rendez-vous dans Consentements.',
        jsonb_build_object('athlete_id', v_ath.id, 'route', '/parent/consentements'));
    end if;
    update public.consentement_partenaire_v2 set demande_parent_le = now(), maj_le = now() where athlete_id = v_ath.id;
    return jsonb_build_object('ok', true, 'etat', 'DEMANDE_PARENT');
  end if;

  if p_reponse = 'NON' then
    if public.consentement_partenaire_v2_valide(v_ath.id) then
      return jsonb_build_object('ok', false, 'reason', 'deja_accepte');
    end if;
    update public.consentement_partenaire_v2 set refuse_le = now(), maj_le = now() where athlete_id = v_ath.id;
    insert into public.consent_audit_trail
      (consent_id, athlete_id, coach_id, action, previous_status, new_status, ip_address, metadata)
    values (
      v_ath.consent_id, v_ath.id, null, 'REFUSED',
      case when v_ath.partner_visibility_opt_in then 'granted' else 'withdrawn' end,
      case when v_ath.partner_visibility_opt_in then 'granted' else 'withdrawn' end,
      null,
      jsonb_build_object(
        'acting_role',      'ATHLETE',
        'athlete_user_id',  v_uid,
        'consent_key',      'image_partenaire',
        'consent_version',  2,
        'portee',           'videos_reseaux',
        'policy_version',   p_policy_version));
    return jsonb_build_object('ok', true, 'etat', 'REFUSEE');
  end if;

  -- PLUS_TARD
  update public.consentement_partenaire_v2
     set plus_tard_nb = least(plus_tard_nb + 1, 3), plus_tard_le = now(), maj_le = now()
   where athlete_id = v_ath.id;
  return jsonb_build_object('ok', true, 'etat', 'PLUS_TARD');
end $$;

-- ── Le push unique de la campagne v2 ─────────────────────────────────────────
-- À lancer à la main APRÈS la sortie de la 1.4.5 (un ancien client ne sait pas afficher la carte).
--   select public.consentement_partenaire_v2_pousser(null);            → aperçu (nombre), n'envoie rien
--   select public.consentement_partenaire_v2_pousser('ENVOYER 123');   → envoie, si 123 = le nombre exact
-- Jamais en heures calmes (21 h – 8 h) : refusé. Un athlète ne reçoit ce push qu'une fois (push_le).
-- Respecte la désactivation des « Rappels » (push_preferences).
create function public.consentement_partenaire_v2_pousser(p_confirmer text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_n   int;
  v_r   record;
  v_env int := 0;
begin
  -- Exécutable par postgres et service_role seulement (ACL vérifiée en fin de fichier).
  drop table if exists _cibles_v2;
  create temp table _cibles_v2 on commit drop as
    select a.id as athlete_id, a.user_id
      from public.athletes a
      join public.users u on u.id = a.user_id
      left join public.consentement_partenaire_v2 c on c.athlete_id = a.id
     where coalesce(u.onboarding_complete, false)
       and a.status in ('ACTIF', 'EN_ATTENTE')
       and not public.consentement_partenaire_v2_valide(a.id)
       and c.refuse_le is null
       and c.demande_parent_le is null
       and coalesce(c.plus_tard_nb, 0) < 3
       and c.push_le is null
       and not exists (select 1 from public.push_preferences pp
                        where pp.user_id = a.user_id and pp.categorie = 'RAPPELS' and not pp.actif);
  select count(*) into v_n from _cibles_v2;

  if p_confirmer is null then
    return jsonb_build_object('ok', true, 'mode', 'apercu', 'cibles', v_n,
                              'heures_calmes', public.push_heure_calme(now()));
  end if;
  if p_confirmer is distinct from 'ENVOYER ' || v_n then
    raise exception 'NEXUS: confirmation attendue « ENVOYER % »', v_n;
  end if;
  if public.push_heure_calme(now()) then
    raise exception 'NEXUS: heures calmes (21 h – 8 h) — rien n''est envoyé';
  end if;

  for v_r in select * from _cibles_v2 loop
    perform public.push_to_user(
      v_r.user_id,
      'Nouveau : tes vidéos et tes réseaux',
      'Choisis si les partenaires de Nexus peuvent voir tes vidéos et tes réseaux sociaux.',
      jsonb_build_object('type', 'announcement', 'nx_type', 'CONSENTEMENT_PARTENAIRES_V2',
                         'route', '/athlete/consentement-partenaires'),
      'consentement-partenaires-v2');
    insert into public.consentement_partenaire_v2 (athlete_id, push_le, maj_le)
    values (v_r.athlete_id, now(), now())
    on conflict (athlete_id) do update set push_le = now(), maj_le = now();
    v_env := v_env + 1;
  end loop;
  return jsonb_build_object('ok', true, 'mode', 'envoi', 'envoyes', v_env);
end $$;

-- ── Compteur admin ───────────────────────────────────────────────────────────
-- Athlètes avec compte, inscription terminée, ACTIF ou EN_ATTENTE.
create function public.admin_consentement_partenaire_stats()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''admin';
  end if;
  select jsonb_build_object(
    'total',              count(*),
    'accepte_v2',         count(*) filter (where x.v2),
    'refuse_v2',          count(*) filter (where not x.v2 and x.refuse_le is not null),
    'demande_parent',     count(*) filter (where not x.v2 and x.refuse_le is null and x.demande_parent_le is not null),
    'pas_repondu',        count(*) filter (where not x.v2 and x.refuse_le is null and x.demande_parent_le is null),
    'pas_repondu_v1',     count(*) filter (where not x.v2 and x.refuse_le is null and x.demande_parent_le is null and x.opt_in),
    'plus_tard_epuise',   count(*) filter (where not x.v2 and x.refuse_le is null and x.demande_parent_le is null and x.plus_tard_nb >= 3),
    'push_envoyes',       count(*) filter (where x.push_le is not null)
  ) into v
  from (
    select a.partner_visibility_opt_in as opt_in,
           public.consentement_partenaire_v2_valide(a.id) as v2,
           c.refuse_le, c.demande_parent_le, coalesce(c.plus_tard_nb, 0) as plus_tard_nb, c.push_le
      from public.athletes a
      join public.users u on u.id = a.user_id
      left join public.consentement_partenaire_v2 c on c.athlete_id = a.id
     where coalesce(u.onboarding_complete, false)
       and a.status in ('ACTIF', 'EN_ATTENTE')
  ) x;
  return v;
end $$;

-- ── ACL : liste complète, jamais par inclusion ───────────────────────────────
revoke all on function public.consentement_partenaire_politiques_v2()            from public, anon;
revoke all on function public.consentement_partenaire_v2_valide(uuid)            from public, anon, authenticated;
revoke all on function public.is_partner_media_athlete(uuid)                     from public, anon;
revoke all on function public.consentement_partenaire_v2_sur_audit()             from public, anon, authenticated;
revoke all on function public.consentement_partenaire_v2_etat()                  from public, anon;
revoke all on function public.consentement_partenaire_v2_repondre(text, text)    from public, anon;
revoke all on function public.consentement_partenaire_v2_pousser(text)           from public, anon, authenticated;
revoke all on function public.admin_consentement_partenaire_stats()              from public, anon;
grant execute on function public.consentement_partenaire_politiques_v2()         to authenticated, service_role;
grant execute on function public.consentement_partenaire_v2_valide(uuid)         to service_role;
grant execute on function public.is_partner_media_athlete(uuid)                  to authenticated, service_role;
grant execute on function public.consentement_partenaire_v2_sur_audit()          to service_role;
grant execute on function public.consentement_partenaire_v2_etat()               to authenticated, service_role;
grant execute on function public.consentement_partenaire_v2_repondre(text, text) to authenticated, service_role;
grant execute on function public.consentement_partenaire_v2_pousser(text)        to service_role;
grant execute on function public.admin_consentement_partenaire_stats()           to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. LECTURE PARTENAIRE
-- ════════════════════════════════════════════════════════════════════════════

-- partner_athlete_profile : 61 → 65 colonnes (réseaux en fin). Vidéos et réseaux : NULL sans v2.
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
    -- 2026-10-19 (BP) : vidéos et réseaux seulement avec le consentement partenaires v2.
    case when m.ok then a.video_faits_saillants_url end,
    case when m.ok then a.hudl_url end,
    case when m.ok then a.youtube_url end,
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
    case when m.ok then a.video_match_complet_url end,
    case when m.ok then a.video_entrainement_url end,
    a.parcours_equipes,
    e.id, e.grille_id, e.cote_globale,
    e.vitesse_explosivite, e.force_puissance, e.endurance_cardio,
    e.agilite_coordination, e.vision_du_jeu, e.sens_tactique,
    e.leadership, e.discipline, e.coachabilite,
    e.intelligence_jeu, e.competitivite, e.esprit_equipe,
    e.resilience, e.attitude_mentalite,
    case when m.ok then a.instagram_url end,
    case when m.ok then a.facebook_url end,
    case when m.ok then a.tiktok_url end,
    case when m.ok then a.linkedin_url end
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
  cross join lateral (select public.consentement_partenaire_v2_valide(a.id) as ok) m
  where a.id = p_athlete_id
    -- W0.5 : comme top_athletes_view / trending_athletes_view, une fiche inactive
    -- (EN_ATTENTE, DESACTIVE, DIPLOME) n'est plus lisible par id.
    and a.status = 'ACTIF'
    and public.is_approved_partner(null)
    and public.is_partner_eligible_athlete(a.id);
$function$;
revoke all on function public.partner_athlete_profile(uuid) from public, anon;
grant execute on function public.partner_athlete_profile(uuid) to authenticated, service_role;

-- top_athletes_view : vidéos NULL sans v2 (le filtre « Avec vidéo » du partenaire suit).
-- DEFINER, reloptions NULL (gardé en tête) : aucune clause WITH à restater.
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

-- ── Gardes finales : ACL complètes, objets en place ─────────────────────────
do $$
declare
  vus  text[];
  f    record;
begin
  for f in
    select * from (values
      ('public.partner_athlete_profile(uuid)',                     array['authenticated','postgres','service_role']),
      ('public.consentement_partenaire_politiques_v2()',            array['authenticated','postgres','service_role']),
      ('public.consentement_partenaire_v2_valide(uuid)',            array['postgres','service_role']),
      ('public.is_partner_media_athlete(uuid)',                     array['authenticated','postgres','service_role']),
      ('public.consentement_partenaire_v2_sur_audit()',             array['postgres','service_role']),
      ('public.consentement_partenaire_v2_etat()',                  array['authenticated','postgres','service_role']),
      ('public.consentement_partenaire_v2_repondre(text, text)',    array['authenticated','postgres','service_role']),
      ('public.consentement_partenaire_v2_pousser(text)',           array['postgres','service_role']),
      ('public.admin_consentement_partenaire_stats()',              array['authenticated','postgres','service_role'])
    ) as t(sig, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f.sig::regprocedure;
    if vus is distinct from f.veut then
      raise exception 'NEXUS: ACL % = %, attendu %', f.sig, vus, f.veut;
    end if;
  end loop;

  select array_agg(t.g order by t.g) into vus
    from pg_class c,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.consentement_partenaire_v2'::regclass;
  if vus is distinct from array['postgres','service_role'] then
    raise exception 'NEXUS: ACL consentement_partenaire_v2 = %', vus;
  end if;
  if (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass) is not null then
    raise exception 'NEXUS: top_athletes_view a reçu des reloptions';
  end if;
end $$;
