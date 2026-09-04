-- ═══════════════════════════════════════════════════════════════
-- CORRECTIF B3 — une adresse déjà prise doit rendre un MOTIF, pas un 23505
--
-- Trouvé en sondant la prod, avant toute mise à l'écran : `public.users.email`
-- porte une contrainte UNIQUE (`users_email_key`). Corriger un parent vers une
-- adresse déjà utilisée par un autre compte faisait remonter
--   ERROR 23505: duplicate key value violates unique constraint "users_email_key"
-- jusqu'à l'écran, sous forme de message Postgres brut.
--
-- ── POURQUOI ÇA COMPTE PLUS QUE « UN MESSAGE MOCHE » ────────────────────
-- La route B3 écrit `auth.users` AVANT d'appeler cette fonction. Les deux
-- tables ont chacune leur unicité sur le courriel, mais elles ne sont pas
-- toujours d'accord : une ligne `public.users` peut porter une adresse
-- qu'`auth.users` n'a pas (compte créé côté applicatif, casse différente,
-- utilisateur auth supprimé sans nettoyage). Dans ce cas l'étage 1 PASSE et
-- l'étage 2 explose — c'est-à-dire exactement la désynchronisation que tout
-- ce lot existe pour empêcher, atteinte par le seul chemin qu'on n'avait pas
-- fermé.
--
-- Le contrôle est donc fait AVANT la première écriture, sur les DEUX tables,
-- et il rend `{ok:false, reason:'email_deja_utilise'}` — un motif que l'écran
-- sait traduire, et que la route sait distinguer d'une panne.
--
-- Le contrôle exclut le parent lui-même : réécrire une adresse par sa propre
-- valeur n'est pas un doublon. (La route refuse déjà ce cas en amont avec un
-- 409, mais la fonction ne doit pas dépendre de son appelant pour être juste.)
--
-- Cas réel rencontré : bptds17@gmail.com est le compte d'un ATHLETE
-- (ea4e9c49-…), pas celui du parent. Sans ce garde-fou, l'admin aurait vu un
-- message Postgres et n'aurait pas su que l'adresse appartenait à quelqu'un.
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
  v_occupant     text;
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

  -- ADRESSE DEJA PRISE — controle AVANT la premiere ecriture, sur les DEUX
  -- tables. Voir l'en-tete : l'etage auth de la route est deja passe quand on
  -- arrive ici, donc echouer a moitie serait pire que refuser.
  select coalesce(
           (select 'un compte ' || u.role::text from public.users u
             where lower(u.email) = v_email and u.id <> p_parent_user_id limit 1),
           (select 'un compte d''authentification' from auth.users au
             where lower(au.email) = v_email and au.id <> p_parent_user_id limit 1)
         ) into v_occupant;

  if v_occupant is not null then
    return jsonb_build_object(
      'ok', false, 'reason', 'email_deja_utilise', 'occupant', v_occupant);
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

do $$
begin
  if (select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='admin_set_parent_email')
     not like '%email_deja_utilise%' then
    raise exception 'NEXUS: admin_set_parent_email ne controle pas le doublon de courriel';
  end if;
  raise notice 'NEXUS: admin_set_parent_email — doublon de courriel refuse avec un motif, avant toute ecriture.';
end $$;
