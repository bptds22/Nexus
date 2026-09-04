-- ═══════════════════════════════════════════════════════════════
-- LOTS B3 + B4 — CORRIGER LE COURRIEL DU PARENT, ET LUI RENVOYER UN ACCÈS
--
-- Deux RPC, même gabarit que le lot A/B1 : `is_admin()` en première ligne,
-- SECURITY DEFINER, search_path épinglé, row_security off, revoke public+anon,
-- grant authenticated.
--
-- ── POURQUOI UNE RPC ALORS QUE LE LOT EST « CÔTÉ ROUTE » ─────────────────
-- B3 est le seul lot qui exige la service key : `auth.users.email` n'est
-- modifiable que par `auth.admin.updateUserById`, hors de portée du SQL. Mais
-- la service key ne doit servir QU'À ÇA. Tout le reste du geste — la ligne
-- `public.users`, l'invitation en attente, le journal — repasse par cette RPC,
-- appelée avec la SESSION DE L'ADMIN. Deux bénéfices :
--   · `is_admin()` reste le seul prédicat d'autorisation, y compris ici (une
--     RPC appelée en service_role aurait `auth.uid()` à NULL et le gate
--     tomberait — il faudrait le remplacer par un secret, donc l'affaiblir).
--   · L'invariant du journal tient : `admin_parent_actions` n'est écrite QUE
--     par des fonctions SECURITY DEFINER, jamais par un client ni par une
--     route en service_role. Le commentaire de la table le promettait déjà ;
--     il reste vrai.
--
-- ── L'ORDRE DES DEUX ÉTAGES, ET POURQUOI IL EST DANS CE SENS ─────────────
-- La route écrit `auth.users` D'ABORD, puis appelle cette RPC. C'est
-- délibéré : si le second étage échoue, l'adresse d'authentification est déjà
-- la bonne — donc la connexion et la réclamation d'invitation fonctionnent, et
-- seul l'affichage est en retard. L'ordre inverse produirait exactement la
-- panne du cas bptds17 : une fiche qui affiche la bonne adresse pendant que la
-- connexion refuse encore l'ancienne. Un affichage en retard se voit ; une
-- authentification en retard ne se voit pas.
-- La route doit donc échouer BRUYAMMENT si cette RPC rate — pas en silence.
--
-- ── CE QUE B3 NE TOUCHE PAS : `athletes.parent_email` ────────────────────
-- Le réflexe serait de « ranger » l'adresse déclarative en même temps. Deux
-- raisons de ne pas le faire, et la seconde est un piège :
--   1. Ce sont DEUX informations distinctes. `athletes.parent_email` est ce
--      que l'athlète a SAISI à l'inscription ; l'adresse du compte est ce que
--      le parent utilise vraiment. L'écran les montre côte à côte, et c'est
--      l'écart entre les deux qui révèle une faute de frappe à l'inscription
--      (vu en prod : « bdjd@gnail.con »). Écraser la déclaration détruit
--      l'information qui sert au diagnostic.
--   2. `trg_notify_parent_on_minor` est un trigger BEFORE INSERT OR UPDATE sur
--      `athletes`, qui ne s'abstient que si `parent_notified_at` est déjà posé.
--      Sur un athlète de 14-17 ans dont cette colonne est NULL, écrire
--      `parent_email` déclencherait un SECOND courriel d'invitation, émis par
--      le trigger, à l'insu de l'admin.
-- LE JOUR OÙ QUELQU'UN VOUDRA VRAIMENT L'ÉCRIRE : poser d'abord
-- `parent_notified_at` dans le MÊME UPDATE (le trigger sort en tête sur
-- `NEW.parent_notified_at is not null`), ou désactiver le trigger le temps de
-- la transaction. Ne pas découvrir ça en production.
--
-- L'INVITATION EN ATTENTE SUIT L'ADRESSE, elle. `claim_parent_invitation`
-- compare `auth.users.email` à `parent_invitations.parent_email` : laisser
-- l'invitation sur l'ancienne adresse après avoir corrigé le compte, c'est
-- garantir un `email_mismatch` à la réclamation.
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- LOT B3 — le second étage de la correction de courriel
-- ═══════════════════════════════════════════════════════════════
create or replace function public.admin_set_parent_email(
  p_parent_user_id   uuid,
  p_athlete_id       uuid,
  p_nouveau_email    text,
  p_ancien_email_auth text default null
)
 returns jsonb
 language plpgsql
 volatile
 security definer
 set search_path to 'public', 'pg_temp'
 set row_security to off
as $function$
declare
  v_admin        uuid := auth.uid();
  v_email        text := lower(trim(coalesce(p_nouveau_email, '')));
  v_ancien_pub   text;
  v_inv_id       uuid;
begin
  if not public.is_admin() then
    raise exception 'NEXUS: admin_set_parent_email — reserve a un administrateur';
  end if;

  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'reason', 'email_invalide');
  end if;

  -- Coherence : le parent doit bien etre celui de cet athlete. Sans ce
  -- controle, une faute de frappe sur un id journaliserait le geste sur la
  -- mauvaise fiche.
  if not exists (
    select 1 from public.parent_athletes
     where parent_user_id = p_parent_user_id and athlete_id = p_athlete_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'lien_introuvable');
  end if;

  select email into v_ancien_pub from public.users where id = p_parent_user_id;

  update public.users set email = v_email where id = p_parent_user_id;

  -- L'invitation en attente suit l'adresse — sinon la reclamation echouerait
  -- en email_mismatch. Il n'y en a normalement plus (un parent lie a deja
  -- reclame la sienne), mais le cas existe si l'admin a delie puis relie.
  update public.parent_invitations
     set parent_email = v_email
   where athlete_id = p_athlete_id and claimed_at is null
  -- `returning … into` sans STRICT : zero ligne laisse simplement v_inv_id a
  -- NULL, ce qui est le cas nominal (un parent lie a deja reclame la sienne).
  returning id into v_inv_id;

  insert into public.admin_parent_actions
    (admin_user_id, admin_email, athlete_id, parent_user_id, parent_email, action, details)
  values (
    v_admin,
    (select u.email from public.users u where u.id = v_admin),
    p_athlete_id,
    p_parent_user_id,
    v_email,
    'PARENT_EMAIL_CHANGED',
    jsonb_build_object(
      -- Les DEUX etages, avant et apres. C'est la seule facon de relire plus
      -- tard laquelle des deux adresses etait fausse.
      'ancien_email_public', v_ancien_pub,
      'ancien_email_auth',   p_ancien_email_auth,
      'nouveau_email',       v_email,
      'invitation_mise_a_jour', v_inv_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'ancien_email_public', v_ancien_pub,
    'ancien_email_auth',   p_ancien_email_auth,
    'nouveau_email',       v_email,
    'invitation_mise_a_jour', v_inv_id
  );
end;
$function$;

revoke all on function public.admin_set_parent_email(uuid, uuid, text, text) from public, anon;
grant execute on function public.admin_set_parent_email(uuid, uuid, text, text) to authenticated;

comment on function public.admin_set_parent_email(uuid, uuid, text, text) is
$c$Second etage de la correction de courriel d'un parent : public.users,
l'invitation en attente, et le journal. is_admin() strict.

Le PREMIER etage — auth.users.email — se fait dans la route
/api/admin/parents/[userId]/email, seul endroit qui detient la service key.
L'ordre est auth D'ABORD : si ce second etage rate, l'authentification est
deja correcte et seul l'affichage est en retard. L'inverse reproduirait le cas
bptds17 (fiche juste, connexion cassee).

NE TOUCHE PAS athletes.parent_email : c'est la DECLARATION de l'athlete, une
autre information — et l'ecrire declencherait trg_notify_parent_on_minor, donc
un second courriel d'invitation fantome.

`p_ancien_email_auth` est fourni par la route (elle seule connait la valeur
d'avant, l'ayant deja remplacee). Il ne sert QU'au journal.$c$;


-- ═══════════════════════════════════════════════════════════════
-- LOT B4 — la trace du renvoi de reinitialisation
--
-- L'ENVOI LUI-MEME N'EST PAS ICI, et n'a pas besoin de l'etre :
-- `resetPasswordForEmail` est un point d'entree auth PUBLIC, deja utilise par
-- /mot-de-passe-oublie et vivant en prod. Aucune service key, aucun SQL.
-- Ce qui manquait, c'est la TRACE : un admin qui declenche un courriel vers
-- l'adresse d'un parent ne doit pas le faire sans laisser de trace. La route
-- envoie, cette RPC journalise.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.admin_log_parent_recovery(
  p_parent_user_id uuid,
  p_athlete_id     uuid,
  p_email          text
)
 returns jsonb
 language plpgsql
 volatile
 security definer
 set search_path to 'public', 'pg_temp'
 set row_security to off
as $function$
declare
  v_admin uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'NEXUS: admin_log_parent_recovery — reserve a un administrateur';
  end if;

  if not exists (
    select 1 from public.parent_athletes
     where parent_user_id = p_parent_user_id and athlete_id = p_athlete_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'lien_introuvable');
  end if;

  insert into public.admin_parent_actions
    (admin_user_id, admin_email, athlete_id, parent_user_id, parent_email, action, details)
  values (
    v_admin,
    (select u.email from public.users u where u.id = v_admin),
    p_athlete_id,
    p_parent_user_id,
    lower(trim(coalesce(p_email, ''))),
    'PARENT_RECOVERY_SENT',
    -- « remis a la passerelle », jamais « recu » : Supabase Auth accepte la
    -- demande, la livraison ne se constate pas d'ici. Meme discipline que
    -- l'invitation du lot B1.
    jsonb_build_object('remis_a_la_passerelle', true)
  );

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.admin_log_parent_recovery(uuid, uuid, text) from public, anon;
grant execute on function public.admin_log_parent_recovery(uuid, uuid, text) to authenticated;

comment on function public.admin_log_parent_recovery(uuid, uuid, text) is
$c$Journalise le renvoi d'un courriel de reinitialisation a un parent.
is_admin() strict. L'ENVOI se fait dans la route, par resetPasswordForEmail
(point d'entree auth public, deja vivant sur /mot-de-passe-oublie) — aucune
service key requise. Cette RPC n'existe que pour la trace.$c$;


-- ── Le commentaire de la table reste exact, on le precise ───────────────
-- Il promettait « les lignes n'arrivent que par les RPC SECURITY DEFINER ».
-- C'est toujours vrai apres B3/B4 — les routes API appellent ces RPC avec la
-- session de l'admin, elles n'inserent jamais en service_role. On l'ecrit
-- noir sur blanc pour que la prochaine route ne prenne pas le raccourci.
comment on table public.admin_parent_actions is
$c$Journal des gestes ADMINISTRATIFS sur le lien parental d'un athlete
(invitation, relance, liaison, deliement, correction de courriel, renvoi de
reinitialisation).

FRONTIERE : ce journal porte le GESTE ADMIN. consent_audit_trail porte le
CONSENTEMENT, et lui seul — son CHECK a six valeurs est un vocabulaire de
consentement, on ne le dilue pas. Un deliement ecrit dans LES DEUX : une
ligne ici, et une ligne WITHDRAWN la-bas si des consentements etaient actifs.

ECRITURE : aucune policy, aucun GRANT. Les lignes n'arrivent que par les RPC
SECURITY DEFINER (admin_invite_parent, admin_set_parent_email,
admin_log_parent_recovery), dans la meme transaction que le geste — un geste
sans trace est impossible.

Y COMPRIS DEPUIS LES ROUTES API. Une route admin qui detient la service key
(B3) pourrait inserer ici directement en contournant la RLS : elle ne le fait
PAS. Elle appelle la RPC avec la SESSION DE L'ADMIN, pour que `is_admin()`
reste le seul predicat d'autorisation et que la service key ne serve qu'a ce
qu'elle seule peut faire (ecrire auth.users). Toute nouvelle route doit
suivre cette regle.

Le jeton d'invitation n'est JAMAIS journalise : c'est un porteur d'identite.$c$;

-- ── GARDE-FOU ──────────────────────────────────────────────────────────
do $$
declare
  r           record;
  n_verifiees int := 0;
begin
  for r in
    select p.oid, p.proname, p.prosecdef, p.proconfig,
           has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_execute,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute,
           p.prosrc
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('admin_set_parent_email', 'admin_log_parent_recovery')
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
      raise exception 'NEXUS: %() n''est pas executable par authenticated', r.proname;
    end if;
    if r.prosrc not like '%is_admin()%' then
      raise exception 'NEXUS: %() ne teste pas is_admin()', r.proname;
    end if;
    -- Le piege du double courriel : aucune de ces fonctions ne doit ecrire
    -- athletes.parent_email (trg_notify_parent_on_minor s'en chargerait).
    if r.prosrc ~* 'update\s+public\.athletes' then
      raise exception 'NEXUS: %() ecrit dans athletes — trg_notify_parent_on_minor emettrait un second courriel', r.proname;
    end if;
    n_verifiees := n_verifiees + 1;
  end loop;

  if n_verifiees <> 2 then
    raise exception 'NEXUS: % fonction(s) verifiee(s), 2 attendues', n_verifiees;
  end if;

  raise notice 'NEXUS: admin_set_parent_email et admin_log_parent_recovery — definer, search_path epingle, anon revoque, is_admin() present, athletes intouchee.';
end $$;
