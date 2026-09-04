-- ═══════════════════════════════════════════════════════════════
-- CORRECTIF B3 — LE PRÉ-VOL ARRIVE AVANT L'ÉCRITURE, ET UN ÉCHEC SE JOURNALISE
--
-- Constaté à l'écran, en prod, session admin réelle :
--   « Échec de la mise à jour de l'authentification : Error updating user »
-- Message générique de GoTrue, aucune cause, aucun geste possible pour
-- l'admin. Deux fautes distinctes derrière ce seul symptôme.
--
-- ── FAUTE 1 — LE CONTRÔLE DE DOUBLON ÉTAIT AU MAUVAIS ÉTAGE ─────────────
-- `admin_set_parent_email` contrôlait déjà l'unicité sur les DEUX tables…
-- mais elle est l'ÉTAGE 2, appelée APRÈS que la route a écrit `auth.users`.
-- Un doublon fait donc échouer l'étage 1 en premier, et le contrôle soigné de
-- l'étage 2 ne s'exécute jamais. Un garde-fou placé après la porte qu'il
-- devait garder.
-- D'où `admin_email_occupe` : la MÊME logique, appelable AVANT toute écriture.
-- Elle ne remplace pas celle de l'étage 2 — deux appelants, deux moments, et
-- l'étage 2 doit rester juste même si un futur appelant oublie le pré-vol.
--
-- Relevé prod 2026-09-04 (cas qui a produit la panne) : bptds17@gmail.com
-- existe dans `auth.users` ET dans `public.users`, id
-- ea4e9c49-8178-4bcc-b89b-9d753efbf566, rôle ATHLETE. GoTrue refusait donc
-- l'UPDATE — correctement — mais en rendant un 500 générique au lieu d'un
-- conflit nommé.
--
-- POURQUOI UNE RPC PLUTÔT QUE `listUsers` CÔTÉ ROUTE. L'API admin de
-- supabase-js n'expose pas de filtre par courriel : `listUsers({page,
-- perPage})` pagine 218 comptes aujourd'hui, davantage demain, et le filtre
-- GoTrue `?filter=` n'est pas typé — il faudrait une requête HTTP à la main.
-- Une lecture SQL indexée sur `auth.users` est exacte, immédiate, et ne se
-- dégrade pas avec le nombre de comptes. La fonction est DEFINER, donc elle
-- lit `auth` là où le client ne peut pas.
--
-- ── FAUTE 2 — UN ÉCHEC NE LAISSAIT AUCUNE TRACE ─────────────────────────
-- Le journal ne portait que les gestes RÉUSSIS. Un admin qui tente une
-- correction et se heurte à un mur ne laissait rien : ni la tentative, ni
-- l'adresse visée, ni la raison. C'est précisément le diagnostic qu'on vient
-- de devoir refaire à la main.
-- `PARENT_EMAIL_CHANGE_FAILED` entre donc au vocabulaire, et
-- `admin_log_parent_email_failure` l'écrit avec l'étape et le message brut du
-- serveur.
--
-- POURQUOI CETTE SEULE VALEUR D'ÉCHEC, et pas six. C'est le seul geste du
-- chantier dont une étape peut échouer APRÈS l'autorisation, en laissant le
-- système à moitié écrit. L'invitation (B1) garde sa ligne même quand l'envoi
-- rate — `details.erreur_envoi` porte déjà la cause. Le renvoi (B4) échoue
-- avant d'avoir rien changé. Ajouter des valeurs « au cas où » diluerait un
-- vocabulaire dont la valeur tient à ce qu'il est court.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Le vocabulaire s'ouvre d'UNE valeur ──────────────────────────────
alter table public.admin_parent_actions
  drop constraint if exists admin_parent_actions_action_check;

alter table public.admin_parent_actions
  add constraint admin_parent_actions_action_check check (action in (
    'PARENT_INVITED',
    'PARENT_INVITE_RESENT',
    'PARENT_LINKED',
    'PARENT_UNLINKED',
    'PARENT_EMAIL_CHANGED',
    'PARENT_EMAIL_CHANGE_FAILED',  -- tentative refusee ou plantee, avec la cause
    'PARENT_RECOVERY_SENT'
  ));


-- ── 2. LE PRÉ-VOL ───────────────────────────────────────────────────────
create or replace function public.admin_email_occupe(
  p_email            text,
  p_exclure_user_id  uuid default null
)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
 set row_security to off
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id    uuid;
  v_role  text;
  v_src   text;
begin
  if not public.is_admin() then
    raise exception 'NEXUS: admin_email_occupe — reserve a un administrateur';
  end if;

  if v_email = '' then
    return jsonb_build_object('occupe', false);
  end if;

  -- public.users d'abord : c'est la source qui porte un ROLE, donc celle qui
  -- rend le message le plus utile a l'admin (« un compte ATHLETE »).
  select u.id, u.role::text, 'public.users'
    into v_id, v_role, v_src
    from public.users u
   where lower(u.email) = v_email
     and (p_exclure_user_id is null or u.id <> p_exclure_user_id)
   limit 1;

  if v_id is null then
    select au.id, null, 'auth.users'
      into v_id, v_role, v_src
      from auth.users au
     where lower(au.email) = v_email
       and (p_exclure_user_id is null or au.id <> p_exclure_user_id)
     limit 1;
  end if;

  -- Troisieme source : une identite peut theoriquement porter une adresse que
  -- auth.users n'a plus. Releve prod 2026-09-04 : 0 cas sur 218 comptes — le
  -- controle est donc gratuit aujourd'hui, et c'est le seul moment ou on peut
  -- l'ajouter sans que quelqu'un doive d'abord se cogner dessus.
  if v_id is null then
    select i.user_id, null, 'auth.identities'
      into v_id, v_role, v_src
      from auth.identities i
     where lower(i.identity_data->>'email') = v_email
       and (p_exclure_user_id is null or i.user_id <> p_exclure_user_id)
     limit 1;
  end if;

  if v_id is null then
    return jsonb_build_object('occupe', false);
  end if;

  return jsonb_build_object(
    'occupe',  true,
    'user_id', v_id,
    'role',    v_role,
    'source',  v_src,
    -- Phrase prete a afficher : l'ecran n'a pas a recomposer le message, et
    -- les deux appelants (route et etage 2) disent donc la meme chose.
    'libelle', 'un compte' || coalesce(' ' || v_role, '') || ' (' || v_id::text || ')'
  );
end;
$function$;

revoke all on function public.admin_email_occupe(text, uuid) from public, anon;
grant execute on function public.admin_email_occupe(text, uuid) to authenticated;

comment on function public.admin_email_occupe(text, uuid) is
$c$Pre-vol : ce courriel appartient-il deja a quelqu'un ? Regarde
public.users (qui porte le role), puis auth.users, puis auth.identities.
is_admin() strict.

Existe parce que le controle d'unicite de admin_set_parent_email est a
l'ETAGE 2, donc APRES que la route a ecrit auth.users : un doublon faisait
echouer l'etage 1 avec le 500 generique de GoTrue (« Error updating user »)
sans que le controle soigne ne s'execute jamais.

Une lecture SQL indexee, pas listUsers : l'API admin n'expose pas de filtre
par courriel et paginerait 218 comptes.$c$;


-- ── 3. LA TRACE D'UN ÉCHEC ──────────────────────────────────────────────
create or replace function public.admin_log_parent_email_failure(
  p_parent_user_id uuid,
  p_athlete_id     uuid,
  p_email_vise     text,
  p_etape          text,
  p_erreur         text
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
    raise exception 'NEXUS: admin_log_parent_email_failure — reserve a un administrateur';
  end if;

  insert into public.admin_parent_actions
    (admin_user_id, admin_email, athlete_id, parent_user_id, parent_email, action, details)
  values (
    v_admin,
    (select u.email from public.users u where u.id = v_admin),
    p_athlete_id,
    p_parent_user_id,
    lower(trim(coalesce(p_email_vise, ''))),
    'PARENT_EMAIL_CHANGE_FAILED',
    jsonb_build_object(
      -- `etape` distingue les deux moitiés : 'prevol' (rien n'a bouge),
      -- 'auth' (rien n'a bouge non plus, GoTrue a refuse), 'public' (auth EST
      -- passe, la ligne publique non — le seul cas ou le systeme est a moitie
      -- ecrit, et donc celui qu'on doit pouvoir retrouver).
      'etape',       p_etape,
      -- Le message BRUT du serveur, jamais reformule : c'est lui qui portait
      -- le diagnostic qu'on a perdu.
      'erreur',      p_erreur,
      'email_vise',  lower(trim(coalesce(p_email_vise, '')))
    )
  );

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.admin_log_parent_email_failure(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.admin_log_parent_email_failure(uuid, uuid, text, text, text) to authenticated;

comment on function public.admin_log_parent_email_failure(uuid, uuid, text, text, text) is
$c$Journalise une correction de courriel qui n'a PAS abouti, avec l'etape
('prevol' | 'auth' | 'public') et le message brut du serveur. is_admin()
strict.

Le journal ne portait que les gestes reussis : une tentative qui se heurte a
un mur ne laissait ni l'adresse visee ni la raison. `etape = 'public'` est le
cas grave — auth a change, la ligne publique non.$c$;


-- ── GARDE-FOU ──────────────────────────────────────────────────────────
do $$
declare
  r           record;
  n_verifiees int := 0;
begin
  -- La nouvelle valeur doit etre acceptee, et une valeur inventee refusee.
  begin
    insert into public.admin_parent_actions (athlete_id, action)
    values ('00000000-0000-0000-0000-000000000000', 'PARENT_EMAIL_CHANGE_FAILED');
    raise exception 'NEXUS: l''insert de controle aurait du echouer sur la cle etrangere athlete_id';
  exception
    when foreign_key_violation then null;  -- attendu : le CHECK a laisse passer
    when check_violation then
      raise exception 'NEXUS: PARENT_EMAIL_CHANGE_FAILED refuse par le CHECK — le vocabulaire n''a pas ete elargi';
  end;

  for r in
    select p.proname, p.prosecdef, p.proconfig, p.prosrc,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('admin_email_occupe', 'admin_log_parent_email_failure')
  loop
    if not r.prosecdef then raise exception 'NEXUS: %() n''est pas SECURITY DEFINER', r.proname; end if;
    if r.proconfig is null or not ('search_path=public, pg_temp' = any(r.proconfig)) then
      raise exception 'NEXUS: %() n''a pas son search_path epingle', r.proname; end if;
    if r.anon_execute then raise exception 'NEXUS: %() est executable par anon', r.proname; end if;
    if not r.auth_execute then raise exception 'NEXUS: %() n''est pas executable par authenticated', r.proname; end if;
    if r.prosrc not like '%is_admin()%' then raise exception 'NEXUS: %() ne teste pas is_admin()', r.proname; end if;
    n_verifiees := n_verifiees + 1;
  end loop;

  if n_verifiees <> 2 then
    raise exception 'NEXUS: % fonction(s) verifiee(s), 2 attendues', n_verifiees;
  end if;

  raise notice 'NEXUS: pre-vol et journal d''echec en place — vocabulaire elargi a PARENT_EMAIL_CHANGE_FAILED.';
end $$;
