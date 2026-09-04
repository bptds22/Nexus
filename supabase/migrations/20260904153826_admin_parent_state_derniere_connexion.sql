-- ═══════════════════════════════════════════════════════════════
-- admin_parent_state — LA DERNIÈRE CONNEXION DU PARENT
--
-- ── POURQUOI CETTE COLONNE, ET PAS UNE TROISIÈME BRANCHE DE BOUTON ──────
-- Décidé après le diagnostic du 2026-09-04. L'écran propose aujourd'hui deux
-- gestes, selon qu'un compte est lié ou non :
--   · aucun compte lié → inviter / relancer  (le chemin de VOLUME : 48
--     invitations en attente contre 28 liaisons)
--   · compte lié       → réinitialisation
-- Il manque un troisième cas concevable : un parent LIÉ qui ne s'est JAMAIS
-- connecté — pour lui, renvoyer l'invitation serait plus juste qu'un reset.
--
-- MESURÉ AVANT DE CONSTRUIRE : ZÉRO parent dans ce cas sur les 28 liaisons.
-- On ne bâtit donc pas la branche. Mais on expose la DONNÉE qui la
-- déciderait, et l'écran dit « jamais connecté » si le cas se présente. Le
-- jour où le compteur bouge, la décision se prendra sur un fait affiché, pas
-- sur une intuition — et la branche s'ajoutera alors en connaissance de
-- cause.
--
-- `last_sign_in_at` vit dans `auth.users`, donc illisible par un client : il
-- fallait de toute façon passer par cette RPC DEFINER.
--
-- SEUL CHANGEMENT : une clé de plus dans l'objet `parent`. Le reste du corps
-- est identique à la version 20260904133401 — relu ligne à ligne.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.admin_parent_state(p_athlete_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
 set row_security to off
as $function$
declare
  v_ath        public.athletes;
  v_link       public.parent_athletes;
  v_pu         public.users;
  v_auth_email text;
  v_auth_conf  timestamptz;
  v_auth_seen  timestamptz;
  v_inv        public.parent_invitations;
  v_pref       jsonb;
  v_pc         public.parental_consents;
begin
  if not public.is_admin() then
    raise exception 'NEXUS: admin_parent_state — reserve a un administrateur';
  end if;

  select * into v_ath from public.athletes where id = p_athlete_id;
  if v_ath.id is null then
    return jsonb_build_object('error', 'athlete_introuvable');
  end if;

  -- UNIQUE (athlete_id) sur parent_athletes : au plus UNE ligne. L'ecran doit
  -- dire « le parent », jamais « les parents » — la base refuse le second.
  select * into v_link from public.parent_athletes where athlete_id = p_athlete_id;

  if v_link.id is not null then
    select * into v_pu from public.users where id = v_link.parent_user_id;
    select email, email_confirmed_at, last_sign_in_at
      into v_auth_email, v_auth_conf, v_auth_seen
      from auth.users where id = v_link.parent_user_id;
  end if;

  -- L'invitation VIVANTE (jamais reclamee). L'index partiel
  -- parent_invitations_one_pending garantit qu'il y en a au plus une.
  select * into v_inv
    from public.parent_invitations
   where athlete_id = p_athlete_id and claimed_at is null;

  select privacy_preferences into v_pref from public.users where id = v_ath.user_id;
  v_pref := coalesce(v_pref, '{}'::jsonb);

  if v_ath.consent_id is not null then
    select * into v_pc from public.parental_consents where id = v_ath.consent_id;
  end if;

  return jsonb_build_object(

    /* Ce que la fiche athlete porte elle-meme sur le parent — declaratif,
       saisi a l'inscription. Distinct du COMPTE parent : ces colonnes
       existent meme quand aucun compte n'a jamais ete cree. */
    'declare_sur_athlete', jsonb_build_object(
      'parent_email',        v_ath.parent_email,
      'parent_first_name',   v_ath.parent_first_name,
      'parent_last_name',    v_ath.parent_last_name,
      'nom_parent',          v_ath.nom_parent,
      'telephone_parent',    v_ath.telephone_parent,
      'parent_relationship', v_ath.parent_relationship,
      'parent_notified_at',  v_ath.parent_notified_at,
      'age',                 case when v_ath.date_naissance is null then null
                                  else extract(year from age(v_ath.date_naissance))::int end
    ),

    /* Le COMPTE parent lie, s'il existe. Les DEUX adresses cote a cote. */
    'parent', case when v_link.id is null then null else jsonb_build_object(
      'parent_user_id',      v_link.parent_user_id,
      'lie_le',              v_link.created_at,
      'first_name',          v_pu.first_name,
      'last_name',           v_pu.last_name,
      'role',                v_pu.role,
      'email_public',        v_pu.email,
      'email_auth',          v_auth_email,
      'email_confirme_le',   v_auth_conf,
      -- NULL = ne s'est JAMAIS connecte. L'ecran le dit en toutes lettres :
      -- un parent lie mais jamais entre n'a pas besoin d'une
      -- reinitialisation, il a besoin qu'on lui renvoie son invitation.
      'derniere_connexion',  v_auth_seen,
      'compte_cree_le',      v_pu.created_at
    ) end,

    /* L'invitation en attente. `expiree` est un FAIT (une date depassee),
       pas un verdict. */
    'invitation', case when v_inv.id is null then null else jsonb_build_object(
      'invitation_id', v_inv.id,
      'parent_email',  v_inv.parent_email,
      'emise_le',      v_inv.created_at,
      'expire_le',     v_inv.expires_at,
      'expiree',       v_inv.expires_at < now()
    ) end,

    /* Les invitations deja reclamees — l'historique, sans les jetons. */
    'invitations_reclamees', coalesce((
      select jsonb_agg(jsonb_build_object(
               'invitation_id', i.id, 'parent_email', i.parent_email,
               'emise_le', i.created_at, 'reclamee_le', i.claimed_at)
             order by i.claimed_at desc)
        from public.parent_invitations i
       where i.athlete_id = p_athlete_id and i.claimed_at is not null), '[]'::jsonb),

    /* Meme charge utile que get_child_consents (reservee au parent), pour
       que les deux ecrans montrent la meme chose sous les memes cles. */
    'consentements', jsonb_build_object(
      'privacy_preferences', jsonb_build_object(
        'consent_privacy_policy',              v_pref->>'consent_privacy_policy',
        'consent_data_collection',             v_pref->>'consent_data_collection',
        'consent_marketing',                   v_pref->>'consent_marketing',
        'consent_parental_profile',            v_pref->>'consent_parental_profile',
        'consent_parental_visibility',         v_pref->>'consent_parental_visibility',
        'consent_parental_partner_visibility', v_pref->>'consent_parental_partner_visibility'
      ),
      'partner_visibility', jsonb_build_object(
        'opt_in',           v_ath.partner_visibility_opt_in,
        'opted_in_at',      v_ath.partner_visibility_opted_in_at,
        'parental_consent', v_ath.partner_visibility_parental_consent
      ),
      'coach_attestation', case when v_pc.id is null then null else jsonb_build_object(
        'status',                 v_pc.status,
        'consent_profile_public', v_pc.consent_profile_public,
        'consent_photo',          v_pc.consent_photo,
        'consent_stats',          v_pc.consent_stats,
        'consent_contact',        v_pc.consent_contact,
        'attested_at',            v_pc.attested_at,
        'school_year',            v_pc.school_year
      ) end
    ),

    /* LE JOURNAL DE CONSENTEMENT. Releve prod 2026-09-04 : 5 liaisons sur 28
       en portent un. Un journal vide n'est donc PAS une anomalie — c'est le
       cas majoritaire, et l'ecran doit le dire ainsi. */
    'journal_consentement', coalesce((
      select jsonb_agg(jsonb_build_object(
               'action', c.action, 'de', c.previous_status, 'vers', c.new_status,
               'le', c.created_at, 'metadata', c.metadata)
             order by c.created_at desc)
        from public.consent_audit_trail c
       where c.athlete_id = p_athlete_id), '[]'::jsonb),

    /* LE JOURNAL ADMIN (lot B0). */
    'journal_admin', coalesce((
      select jsonb_agg(jsonb_build_object(
               'action', a.action, 'le', a.created_at,
               'par', coalesce(a.admin_email, a.admin_user_id::text),
               'parent_email', a.parent_email, 'details', a.details)
             order by a.created_at desc)
        from public.admin_parent_actions a
       where a.athlete_id = p_athlete_id), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.admin_parent_state(uuid) from public, anon;
grant execute on function public.admin_parent_state(uuid) to authenticated;

do $$
begin
  if (select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='admin_parent_state')
     not like '%derniere_connexion%' then
    raise exception 'NEXUS: admin_parent_state ne projette pas derniere_connexion';
  end if;
  raise notice 'NEXUS: admin_parent_state — derniere_connexion du parent projetee.';
end $$;
