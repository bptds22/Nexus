-- ═══════════════════════════════════════════════════════════════
-- LOTS A + B1 — VOIR ET INVITER LE PARENT DEPUIS LA FICHE ADMIN
--
-- Deux RPC. Toutes deux : `is_admin()` en PREMIÈRE ligne, SECURITY DEFINER,
-- search_path épinglé, `revoke from public, anon` puis `grant execute to
-- authenticated` — le gabarit maison (arbitrage BP, 2026-09-04, option (i)).
-- `is_admin()` et non `is_platform_admin` : une seule définition d'admin sur
-- ce chantier, y compris dans les routes API des lots B3-B4 à venir.
--
-- ── POURQUOI DES RPC PLUTÔT QUE DES REQUÊTES DIRECTES ───────────────────
-- Relevé pg_policies avant écriture (prod, 2026-09-04) :
--   parent_invitations   RLS activé, ZÉRO policy → illisible et inécrivable
--                        par tout rôle client. Les 48 invitations en attente
--                        n'apparaissent nulle part.
--   parent_athletes      l'admin a SELECT. Pas d'INSERT, pas de DELETE.
--   consent_audit_trail  l'admin a SELECT.
-- Et `auth.users.email` n'est atteignable que depuis une fonction DEFINER.
-- L'état parental complet est donc INACCESSIBLE au client : une RPC, pas un
-- select.
--
-- `row_security = off` sur les deux, comme TOUTES les fonctions parentales
-- existantes (claim_parent_invitation, is_parent_of, get_child_consents —
-- relevé pg_proc). Sans lui, une fonction DEFINER reste soumise à la RLS des
-- tables qu'elle lit, et `parent_invitations` — RLS active, zéro policy —
-- rendrait zéro ligne en silence.
--
-- ── LA SÉPARATION EXCEPTION / RÉSULTAT ──────────────────────────────────
-- Un échec de SÉCURITÉ lève (`raise exception 'NEXUS: …'`) : il ne doit pas
-- pouvoir être ignoré par un appelant qui ne lit pas le retour. Un échec
-- MÉTIER (athlète introuvable, déjà lié, courriel malformé) rend
-- `{ok:false, reason:…}` — c'est la forme de claim_parent_invitation et de
-- set_child_consent, on ne diverge pas. Le préfixe « NEXUS: » est ce qui
-- fait remonter le message jusqu'à l'écran.
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- LOT A — admin_parent_state : tout l'état parental d'un athlète
--
-- LES DEUX COURRIELS SONT RENDUS CÔTE À CÔTE, et c'est le point.
-- `claim_parent_invitation` compare `auth.users.email` à
-- `parent_invitations.parent_email` ; aucun trigger ne synchronise
-- `auth.users.email` avec `public.users.email` (dette documentée dans
-- docs/security-users-school-id-privilege-escalation-20260821.md). Une fiche
-- qui n'afficherait qu'une des deux adresses montrerait la bonne pendant que
-- le lien reste cassé — c'est exactement la saga de cette semaine. L'écran
-- les met l'une sous l'autre et signale la divergence.
--
-- CE QUE LA RPC NE FAIT PAS : elle ne DÉRIVE aucun verdict (« lien sain »,
-- « à réparer »). Elle rend les faits ; l'écran les compare. Un verdict
-- calculé ici deviendrait la seule chose que l'admin lit, et masquerait le
-- fait qui l'a produit.
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
    select email, email_confirmed_at into v_auth_email, v_auth_conf
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

comment on function public.admin_parent_state(uuid) is
$c$Etat parental complet d'un athlete, pour la fiche admin. is_admin() strict.

Existe parce que l'etat est INACCESSIBLE au client : parent_invitations a RLS
active et AUCUNE policy, et auth.users.email n'est lisible que depuis une
fonction DEFINER.

Rend `email_public` ET `email_auth` cote a cote : rien ne les synchronise, et
claim_parent_invitation compare l'adresse AUTH. N'afficher que l'une des deux
montrerait la bonne pendant que le lien reste casse.

Ne derive AUCUN verdict — que des faits. La comparaison se fait a l'ecran.$c$;


-- ═══════════════════════════════════════════════════════════════
-- LOT B1 — admin_invite_parent : inviter, ou relancer
--
-- REPREND LA MÉCANIQUE EXISTANTE, ne la réinvente pas. `notify_parent_on_minor`
-- (trigger sur athletes) fait déjà exactement ça depuis juillet : jeton
-- 2×uuid-hex, insert `parent_invitations`, secret depuis le Vault,
-- `net.http_post` vers l'edge `send-parent-notice` (ACTIVE, v11), qui envoie
-- par Resend un courriel dont le CTA pointe `/parent/claim?token=…`.
--
-- CE QUI REND LES CAS 2a ET 2b IDENTIQUES : la page `/parent/claim` branche
-- seule sur signUp ou signIn selon que le compte existe. Un seul lien couvre
-- « le parent a déjà un compte » et « il n'en a pas ». D'où : aucune edge
-- function nouvelle, aucune service key, aucun contact avec auth.users.
--
-- ── CE QUE CETTE RPC NE TOUCHE PAS, ET POURQUOI C'EST IMPORTANT ─────────
-- Elle n'écrit PAS `athletes.parent_email`. Le réflexe serait de le faire —
-- « l'admin corrige l'adresse, autant la ranger ». Ce serait un piège :
-- `trg_notify_parent_on_minor` est un trigger BEFORE INSERT OR UPDATE qui se
-- déclenche sur toute écriture de la ligne athlète, et qui ne s'abstient que
-- si `parent_notified_at` est déjà posé. Sur un athlète 14-17 ans dont cette
-- colonne est NULL, écrire `parent_email` ici enverrait un SECOND courriel,
-- émis par le trigger, en plus du nôtre. Corriger l'adresse de référence est
-- le métier du lot B3 — qui devra neutraliser ce trigger explicitement.
--
-- ── LE JETON EST RENOUVELÉ, PAS RÉUTILISÉ ───────────────────────────────
-- Une relance émet un NOUVEAU jeton et tue l'ancien lien. C'est voulu :
-- quand on relance, c'est souvent parce que l'adresse précédente était la
-- mauvaise — laisser vivre le lien parti chez le mauvais destinataire serait
-- lui laisser la possibilité de réclamer l'enfant.
--
-- ── L'INVITATION SURVIT À L'ÉCHEC D'ENVOI ───────────────────────────────
-- L'appel réseau est enveloppé : s'il échoue, la ligne d'invitation reste, le
-- jeton est rendu à l'appelant, et l'écran affiche le lien à copier. Même
-- philosophie que /api/admin/partners/create, où le mot de passe repart dans
-- la réponse quoi qu'il arrive. Sans cette enveloppe, une panne de `net`
-- annulerait la transaction entière et emporterait l'invitation.
--
-- ── « REMIS À LA PASSERELLE » N'EST PAS « REÇU » ────────────────────────
-- `net.http_post` est ASYNCHRONE : il met en file et rend un identifiant de
-- requête. On ne sait donc même pas si l'edge function a répondu 200, encore
-- moins si Resend a livré. Le retour dit `remis_a_la_passerelle`, jamais
-- `envoye`. Le mensonge inverse est celui qui a laissé un partenaire sans
-- accès pendant deux semaines.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.admin_invite_parent(
  p_athlete_id uuid,
  p_email      text,
  p_first_name text default null
)
 returns jsonb
 language plpgsql
 volatile
 security definer
 set search_path to 'public', 'pg_temp'
 set row_security to off
as $function$
declare
  v_admin   uuid := auth.uid();
  v_ath     public.athletes;
  v_email   text := lower(trim(coalesce(p_email, '')));
  v_prenom  text := nullif(trim(coalesce(p_first_name, '')), '');
  v_inv     public.parent_invitations;
  v_token   text;
  v_secret  text;
  v_action  text;
  v_req     bigint;
  v_erreur  text;
  v_url     text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-parent-notice';
begin
  if not public.is_admin() then
    raise exception 'NEXUS: admin_invite_parent — reserve a un administrateur';
  end if;

  -- Validation volontairement grossiere : un courriel ne se valide pas par
  -- regex, il se valide en y envoyant quelque chose. Ce filtre n'attrape que
  -- la faute de frappe evidente (adresse vide, espace, arobase manquante).
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'reason', 'email_invalide');
  end if;

  select * into v_ath from public.athletes where id = p_athlete_id;
  if v_ath.id is null then
    return jsonb_build_object('ok', false, 'reason', 'athlete_introuvable');
  end if;

  -- parent_athletes porte UNIQUE (athlete_id), et claim_parent_invitation
  -- refuse deja avec 'athlete_already_linked'. Inviter ici produirait un lien
  -- que le parent ne pourrait pas reclamer : on refuse en amont, avec un motif
  -- que l'ecran sait traduire.
  if exists (select 1 from public.parent_athletes where athlete_id = p_athlete_id) then
    return jsonb_build_object('ok', false, 'reason', 'deja_lie');
  end if;

  -- L'index partiel parent_invitations_one_pending impose au plus une
  -- invitation vivante : on met a jour celle qui existe, sinon on insere.
  select * into v_inv
    from public.parent_invitations
   where athlete_id = p_athlete_id and claimed_at is null
     for update;

  -- Meme fabrique de jeton que notify_parent_on_minor : 64 hex.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  if v_inv.id is null then
    insert into public.parent_invitations (token, athlete_id, parent_email)
      values (v_token, p_athlete_id, v_email)
      returning * into v_inv;
    v_action := 'PARENT_INVITED';
  else
    -- `created_at` est remis a maintenant : la colonne date le JETON COURANT,
    -- et il vient d'etre refait. L'historique des emissions precedentes vit
    -- dans admin_parent_actions, pas dans cette ligne.
    update public.parent_invitations
       set token        = v_token,
           parent_email = v_email,
           expires_at   = now() + interval '30 days',
           created_at   = now()
     where id = v_inv.id
     returning * into v_inv;
    v_action := 'PARENT_INVITE_RESENT';
  end if;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'PARENT_NOTICE_SECRET' limit 1;

  if v_secret is null then
    v_erreur := 'PARENT_NOTICE_SECRET absent du Vault';
  else
    begin
      select net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-parent-notice-secret', v_secret
        ),
        body    := jsonb_build_object(
          'parent_email',      v_email,
          -- L'edge function ne nomme JAMAIS l'enfant ; elle n'attend que le
          -- prenom du parent, pour la formule d'appel. On ne lui envoie rien
          -- de plus.
          'parent_first_name', coalesce(v_prenom, v_ath.parent_first_name),
          'claim_token',       v_token
        )
      ) into v_req;
    exception when others then
      v_req    := null;
      v_erreur := SQLERRM;
    end;
  end if;

  -- LE JOURNAL, DANS LA MEME TRANSACTION QUE LE GESTE. Jamais le jeton.
  insert into public.admin_parent_actions
    (admin_user_id, admin_email, athlete_id, parent_user_id, parent_email, action, details)
  values (
    v_admin,
    (select u.email from public.users u where u.id = v_admin),
    p_athlete_id,
    null,   -- aucun compte parent a ce stade : c'est tout l'objet de l'invitation
    v_email,
    v_action,
    jsonb_build_object(
      'invitation_id',  v_inv.id,
      'expire_le',      v_inv.expires_at,
      'prenom_parent',  coalesce(v_prenom, v_ath.parent_first_name),
      'net_request_id', v_req,
      'erreur_envoi',   v_erreur
    )
  );

  return jsonb_build_object(
    'ok',                    true,
    'action',                v_action,
    'invitation_id',         v_inv.id,
    -- Rendu a l'appelant pour que l'ecran affiche un lien copiable quand
    -- l'envoi echoue. C'est le filet, pas le chemin nominal.
    'token',                 v_token,
    'parent_email',          v_email,
    'expire_le',             v_inv.expires_at,
    'remis_a_la_passerelle', v_req is not null,
    'net_request_id',        v_req,
    'erreur_envoi',          v_erreur
  );
end;
$function$;

revoke all on function public.admin_invite_parent(uuid, text, text) from public, anon;
grant execute on function public.admin_invite_parent(uuid, text, text) to authenticated;

comment on function public.admin_invite_parent(uuid, text, text) is
$c$Emet ou renouvelle l'invitation parentale d'un athlete, et la fait partir
par Resend. is_admin() strict.

Reprend la mecanique de notify_parent_on_minor : jeton 64 hex, ligne dans
parent_invitations, secret PARENT_NOTICE_SECRET depuis le Vault, net.http_post
vers l'edge send-parent-notice. La page /parent/claim branche seule sur signUp
ou signIn — un seul lien couvre « le parent a un compte » et « il n'en a pas ».

NE TOUCHE PAS athletes.parent_email : le trigger BEFORE
trg_notify_parent_on_minor se declencherait et emettrait un SECOND courriel.
Corriger l'adresse de reference est le metier du lot B3.

Une relance RENOUVELLE le jeton et tue l'ancien lien — on relance souvent
parce que la premiere adresse etait la mauvaise.

`remis_a_la_passerelle` n'est PAS `envoye` : net.http_post est asynchrone. Le
jeton est rendu a l'appelant pour que l'ecran affiche un lien copiable si
l'envoi echoue.$c$;

-- ── GARDE-FOU ──────────────────────────────────────────────────────────
do $$
declare
  r         record;
  n_verifiees int := 0;
begin
  for r in
    select p.oid, p.proname, p.prosecdef, p.proconfig,
           has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_execute,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute,
           p.prosrc
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('admin_parent_state', 'admin_invite_parent')
  loop
    if not r.prosecdef then
      raise exception 'NEXUS: %() n''est pas SECURITY DEFINER', r.proname;
    end if;
    if r.proconfig is null or not ('search_path=public, pg_temp' = any(r.proconfig)) then
      raise exception 'NEXUS: %() n''a pas son search_path epingle', r.proname;
    end if;
    if r.anon_execute then
      raise exception 'NEXUS: %() est executable par anon', r.proname;
    end if;
    if not r.auth_execute then
      raise exception 'NEXUS: %() n''est pas executable par authenticated — l''admin ne pourra pas l''appeler', r.proname;
    end if;
    if r.prosrc not like '%is_admin()%' then
      raise exception 'NEXUS: %() ne teste pas is_admin()', r.proname;
    end if;
    n_verifiees := n_verifiees + 1;
  end loop;

  if n_verifiees <> 2 then
    raise exception 'NEXUS: % fonction(s) verifiee(s), 2 attendues', n_verifiees;
  end if;

  raise notice 'NEXUS: admin_parent_state et admin_invite_parent — definer, search_path epingle, anon revoque, is_admin() present.';
end $$;
