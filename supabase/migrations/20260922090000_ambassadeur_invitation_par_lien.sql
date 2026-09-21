-- ═══════════════════════════════════════════════════════════════════════════
-- Ambassadeur — L1 : l'INVITATION PAR LIEN remplace la recherche par nom.
-- Décisions BP 2026-09-21 (version finale) :
--   1. le parrain voit le PRÉNOM seulement de ses recrues ;
--   2. une recrue compte à la FIN DE L'INSCRIPTION = consentements passés
--      (pas l'onboarding), comptes ATHLÈTE seulement ; un moins de 14 ans,
--      refusé au consentement, n'a aucun consentement écrit → ne compte pas ;
--   3. web seulement : /i/[jeton] mène à l'inscription web ;
--   4. déclaration de secours par COURRIEL EXACT seulement, sur un compte
--      athlète existant ; recherche par nom / nom + école / approximative
--      RETIRÉE ; limite de 20 essais par jour conservée ;
--   5. /i/[jeton] n'affiche que le prénom du parrain ;
--   fenêtre d'attribution : 7 jours ; adresse ambiguë (fiche d'un athlète +
--   compte d'un autre) : refusée, motif neutre « introuvable ».
--
-- ── LE PROBLÈME DE FOND : UNE RECRUE N'A PAS ENCORE DE FICHE ────────────
-- Elle compte au CONSENTEMENT, mais la fiche `athletes` n'existe qu'à
-- l'onboarding (l'app ne l'écrit qu'à la toute fin ; 67 comptes n'en ont
-- jamais eu). ambassadeur_revendications reposait sur filleul_athlete_id.
-- → filleul_user_id (users, CASCADE) devient la clé de la recrue. Un trigger
--   le déduit de filleul_athlete_id quand seul ce dernier est fourni (chemin
--   admin historique), pour que l'index du premier arrivé vaille pour TOUS
--   les écrivains, lien comme déclaration.
--
-- ── L'HOMONYMIE (EN_ATTENTE) DISPARAÎT ───────────────────────────────────
-- Elle n'existait que par la recherche par nom. Un courriel exact désigne au
-- plus un compte ; le lien désigne le compte qui s'inscrit. Plus aucun
-- chemin n'écrit EN_ATTENTE. Prod au 2026-09-21 : 0 ligne EN_ATTENTE.
-- `candidats` reste (vide) ; ambassadeur_admin_trancher reste pour ANNULER.
--
-- ── L'APP 1.4.2 PUBLIÉE ──────────────────────────────────────────────────
-- Elle porte l'ancien formulaire (prénom, nom, courriel, école, équipe) et
-- appelle ambassadeur_revendiquer avec CETTE signature : elle est CONSERVÉE
-- (règle 3 du checklist — pas de contraction sous un binaire publié). Les
-- paramètres de nom, d'école et d'équipe sont IGNORÉS.
-- Ses messages vivent dans le binaire (MESSAGES, lib/queries/athlete/
-- ambassadeur.ts) : le serveur ne peut pas les changer, mais il choisit le
-- MOTIF. Sans courriel, il rend `introuvable` — dont le texte embarqué dit
-- « … essaie avec son courriel », ce qui est juste — et jamais plus
-- `discriminant_requis` (« Ajoute son courriel, son école ou son équipe »),
-- qui mentirait. Le motif précis part dans `motif_precis`, lu par le web.
-- mon_tableau garde la clé `nom` (chaîne vide) : l'app affiche
-- `{r.prenom} {r.nom}` et écrirait « undefined » sans elle.
--
-- ── MINIMISATION ─────────────────────────────────────────────────────────
-- Le jeton désigne le PARRAIN, jamais l'invité. Rien n'est écrit sur un
-- visiteur : le compteur de clics est un entier par parrain et par jour.
-- Le jeton ne vit PAS sur `athletes` : coachs et recruteurs y lisent des
-- lignes entières (RLS par ligne), ils le verraient.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Les liens ─────────────────────────────────────────────────────────
create table public.ambassadeur_liens (
  athlete_id   uuid primary key references public.athletes(id) on delete cascade,
  jeton        text not null unique check (jeton ~ '^[0-9a-f]{64}$'),
  cree_le      timestamptz not null default now(),
  regenere_le  timestamptz null
);

comment on table public.ambassadeur_liens is
$c$Le lien d'invitation personnel de chaque athlète : https://nexussports.ca/i/<jeton>.
Jeton : 32 octets aléatoires (pgcrypto), hexadécimal — impossible à deviner.
Stable par athlète, régénérable (l'ancien meurt aussitôt). FERMÉE à tous :
lecture et écriture passent par ambassadeur_mon_lien / _regenerer_lien /
_resoudre_lien / _lier_invitation (DEFINER).$c$;

alter table public.ambassadeur_liens enable row level security;
revoke all on public.ambassadeur_liens from anon, authenticated;

-- ── 2. Le compteur de clics — agrégé, rien sur le visiteur ───────────────
create table public.ambassadeur_liens_clics (
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  jour        date not null,
  n           int  not null default 0 check (n >= 0),
  primary key (athlete_id, jour)
);

comment on table public.ambassadeur_liens_clics is
$c$Nombre d'ouvertures de /i/<jeton> par parrain et par jour de Montréal.
Un entier, rien d'autre : ni IP, ni appareil, ni horodatage fin. Écrit par
ambassadeur_resoudre_lien, lu par le parrain (projection) et l'admin.$c$;

alter table public.ambassadeur_liens_clics enable row level security;
create policy "ambassadeur clics admin read" on public.ambassadeur_liens_clics
  for select to authenticated using (public.is_admin());
revoke all on public.ambassadeur_liens_clics from anon, authenticated;
grant select on public.ambassadeur_liens_clics to authenticated;  -- borné admin (RLS)

-- ── 3. ambassadeur_revendications : la recrue devient un COMPTE ──────────
alter table public.ambassadeur_revendications
  add column filleul_user_id uuid null references public.users(id) on delete cascade;

comment on column public.ambassadeur_revendications.filleul_user_id is
$c$Le COMPTE de la recrue. Clé de l'unicité « premier arrivé garde » depuis le
2026-09-22 : une recrue par lien n'a souvent pas encore de fiche athlète au
moment où elle compte (au consentement). filleul_athlete_id se remplit quand
la fiche existe. Jamais projeté au parrain, qui ne reçoit que le prénom.$c$;

-- Rattrapage : toute ligne qui désigne une fiche porte désormais son compte.
update public.ambassadeur_revendications r
   set filleul_user_id = a.user_id
  from public.athletes a
 where a.id = r.filleul_athlete_id
   and r.filleul_user_id is null
   and a.user_id is not null;

alter table public.ambassadeur_revendications
  alter column prenom drop not null,
  alter column nom    drop not null;

alter table public.ambassadeur_revendications
  drop constraint if exists ambassadeur_revendications_methode_check;
alter table public.ambassadeur_revendications
  add constraint ambassadeur_revendications_methode_check
  check (methode in ('courriel','nom_ecole','nom_equipe','nom_approx','admin','lien'));
-- Les méthodes par nom restent PERMISES pour l'historique (4 lignes en prod
-- au 2026-09-21) ; plus aucune fonction ne les écrit.

alter table public.ambassadeur_revendications
  drop constraint if exists ambassadeur_confirmee_coherente;
alter table public.ambassadeur_revendications
  add constraint ambassadeur_confirmee_coherente
  check (statut <> 'CONFIRMEE'
         or ((filleul_athlete_id is not null or filleul_user_id is not null)
             and confirmee_le is not null));

-- Premier arrivé garde — sur le COMPTE, tous chemins confondus.
create unique index ambassadeur_filleul_user_unique_confirme
  on public.ambassadeur_revendications (filleul_user_id)
  where statut = 'CONFIRMEE' and filleul_user_id is not null;

create unique index ambassadeur_parrain_filleul_user_unique
  on public.ambassadeur_revendications (parrain_athlete_id, filleul_user_id)
  where statut <> 'REJETEE' and filleul_user_id is not null;

-- Le compte se déduit de la fiche quand seule la fiche est fournie
-- (ambassadeur_admin_trancher écrit filleul_athlete_id seul).
create or replace function public.ambassadeur_deduire_filleul_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
begin
  if new.filleul_user_id is null and new.filleul_athlete_id is not null then
    select a.user_id into new.filleul_user_id
      from public.athletes a where a.id = new.filleul_athlete_id;
  end if;
  return new;
end;
$fn$;

revoke all on function public.ambassadeur_deduire_filleul_user() from public, anon, authenticated;

create trigger trg_ambassadeur_deduire_filleul_user
  before insert or update of filleul_athlete_id, filleul_user_id
  on public.ambassadeur_revendications
  for each row execute function public.ambassadeur_deduire_filleul_user();

-- ── 4. Le prénom d'un compte — la SEULE donnée de recrue projetée ────────
-- Fiche d'abord, puis compte, puis métadonnées d'inscription (un compte
-- Google/Apple n'a souvent de prénom que là tant que la fiche n'existe pas).
create or replace function public.ambassadeur_prenom_compte(p_user_id uuid)
  returns text
  language sql
  stable
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
  select coalesce(
    (select nullif(btrim(a.first_name), '') from public.athletes a
      where a.user_id = p_user_id order by a.created_at limit 1),
    (select nullif(btrim(u.first_name), '') from public.users u where u.id = p_user_id),
    (select coalesce(nullif(btrim(au.raw_user_meta_data->>'first_name'), ''),
                     nullif(split_part(btrim(au.raw_user_meta_data->>'full_name'), ' ', 1), ''))
       from auth.users au where au.id = p_user_id));
$fn$;

-- Interne : appelée par les fonctions DEFINER ci-dessous (propriétaire
-- postgres), jamais par un client — elle rendrait le prénom de n'importe qui.
revoke all on function public.ambassadeur_prenom_compte(uuid) from public, anon, authenticated;

-- ── 5. Mon lien / régénérer ──────────────────────────────────────────────
create or replace function public.ambassadeur_mon_lien()
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_parrain uuid;
  v_jeton   text;
begin
  if auth.uid() is null then
    raise exception 'NEXUS: tu dois etre connecte.';
  end if;
  select a.id into v_parrain from public.athletes a where a.user_id = auth.uid() limit 1;
  if v_parrain is null then
    raise exception 'NEXUS: seul un athlete a un lien d''invitation.';
  end if;

  insert into public.ambassadeur_liens (athlete_id, jeton)
  values (v_parrain, encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (athlete_id) do nothing;

  select jeton into v_jeton from public.ambassadeur_liens where athlete_id = v_parrain;
  return jsonb_build_object('jeton', v_jeton);
end;
$fn$;

create or replace function public.ambassadeur_regenerer_lien()
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_parrain uuid;
  v_jeton   text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if auth.uid() is null then
    raise exception 'NEXUS: tu dois etre connecte.';
  end if;
  select a.id into v_parrain from public.athletes a where a.user_id = auth.uid() limit 1;
  if v_parrain is null then
    raise exception 'NEXUS: seul un athlete a un lien d''invitation.';
  end if;

  -- L'ancien jeton meurt ICI : tout lien déjà partagé cesse de fonctionner.
  -- Les clics et les recrues déjà comptées restent (liés au parrain).
  insert into public.ambassadeur_liens (athlete_id, jeton)
  values (v_parrain, v_jeton)
  on conflict (athlete_id) do update set jeton = excluded.jeton, regenere_le = now();

  return jsonb_build_object('jeton', v_jeton);
end;
$fn$;

-- ── 6. Résoudre un lien — la SEULE fonction ouverte à anon ───────────────
-- Rend le prénom du parrain et rien d'autre. Un jeton inconnu, régénéré, ou
-- dont le parrain n'est plus actif (fiche masquée, compte désactivé) rend
-- { valide: false } — sans distinction : la page ne doit pas dire pourquoi.
-- p_compter = false pour les robots d'aperçu (la route en décide).
create or replace function public.ambassadeur_resoudre_lien(p_jeton text, p_compter boolean default true)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_parrain uuid;
  v_user    uuid;
  v_jour    date;
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('valide', false);
  end if;

  select l.athlete_id, a.user_id into v_parrain, v_user
    from public.ambassadeur_liens l
    join public.athletes a on a.id = l.athlete_id
    join public.users    u on u.id = a.user_id
   where l.jeton = p_jeton
     and a.status = 'ACTIF'
     and u.status = 'ACTIF';

  if v_parrain is null then
    return jsonb_build_object('valide', false);
  end if;

  if coalesce(p_compter, true) then
    v_jour := (now() at time zone 'America/Montreal')::date;
    insert into public.ambassadeur_liens_clics (athlete_id, jour, n)
    values (v_parrain, v_jour, 1)
    on conflict (athlete_id, jour) do update set n = public.ambassadeur_liens_clics.n + 1;
  end if;

  return jsonb_build_object('valide', true, 'prenom', public.ambassadeur_prenom_compte(v_user));
end;
$fn$;

-- ── 7. Attribuer — appelée par la recrue, au consentement ────────────────
-- ORDRE DES REFUS (chacun est un RETURN, rien n'est écrit) :
--   non connecté → non_athlete → consentement_requis → jeton_invalide →
--   soi_meme → compte_trop_ancien → (insertion) deja_attribue.
-- Le client appelle en silence : un refus ne bloque JAMAIS une inscription.
create or replace function public.ambassadeur_lier_invitation(p_jeton text)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_consent   text;
  v_cree      timestamptz;
  v_parrain   uuid;
  v_parrain_u uuid;
  v_fiche     uuid;
  v_id        uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motif', 'non_connecte');
  end if;

  select u.role::text,
         coalesce(au.raw_user_meta_data->>'consent_privacy_policy',
                  u.privacy_preferences->>'consent_privacy_policy'),
         au.created_at
    into v_role, v_consent, v_cree
    from public.users u join auth.users au on au.id = u.id
   where u.id = v_uid;

  -- Comptes ATHLÈTE seulement.
  if v_role is distinct from 'ATHLETE' then
    return jsonb_build_object('ok', false, 'motif', 'non_athlete');
  end if;

  -- Une recrue compte AU consentement. Un moins de 14 ans est refusé par
  -- /consentements (et le signup) AVANT toute écriture : il n'a pas de
  -- consent_privacy_policy, et tombe ici.
  if v_consent is null then
    return jsonb_build_object('ok', false, 'motif', 'consentement_requis');
  end if;

  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'motif', 'jeton_invalide');
  end if;
  select l.athlete_id, a.user_id into v_parrain, v_parrain_u
    from public.ambassadeur_liens l
    join public.athletes a on a.id = l.athlete_id
    join public.users    u on u.id = a.user_id
   where l.jeton = p_jeton and a.status = 'ACTIF' and u.status = 'ACTIF';
  if v_parrain is null then
    return jsonb_build_object('ok', false, 'motif', 'jeton_invalide');
  end if;

  if v_parrain_u = v_uid then
    return jsonb_build_object('ok', false, 'motif', 'soi_meme');
  end if;

  -- Fenêtre de 7 jours : un compte ancien ne se fait pas créditer après coup.
  if v_cree < now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'motif', 'compte_trop_ancien');
  end if;

  select a.id into v_fiche from public.athletes a where a.user_id = v_uid order by a.created_at limit 1;

  begin
    insert into public.ambassadeur_revendications (
      parrain_athlete_id, filleul_user_id, filleul_athlete_id,
      methode, statut, confirmee_le)
    values (v_parrain, v_uid, v_fiche, 'lien', 'CONFIRMEE', now())
    returning id into v_id;
  exception when unique_violation then
    -- Déjà attribuée (lien ou déclaration, premier arrivé garde).
    return jsonb_build_object('ok', false, 'motif', 'deja_attribue');
  end;

  return jsonb_build_object('ok', true, 'motif', 'attribue', 'id', v_id);
end;
$fn$;

-- ── 8. La déclaration — COURRIEL EXACT seulement, signature CONSERVÉE ────
create or replace function public.ambassadeur_revendiquer(
  p_prenom   text,
  p_nom      text,
  p_courriel text default null,
  p_ecole_id uuid default null,
  p_team_id  uuid default null)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_uid       uuid;
  v_parrain   uuid;
  v_courriel  text;
  v_jour      date;
  v_n         int;
  v_max       constant int := 20;
  v_personnes text[];
  v_cible_u   uuid;
  v_fiche     uuid;
  v_id        uuid;
begin
  -- ── 1. Identité ───────────────────────────────────────────────────────
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NEXUS: tu dois etre connecte pour declarer une recrue.';
  end if;
  select a.id into v_parrain from public.athletes a where a.user_id = v_uid limit 1;
  if v_parrain is null then
    raise exception 'NEXUS: seul un athlete peut declarer une recrue.';
  end if;

  -- ── 2. Le courriel est OBLIGATOIRE ; p_prenom, p_nom, p_ecole_id et
  -- p_team_id sont IGNORÉS (signature gardée pour l'app 1.4.2).
  -- Sans courriel : AUCUNE lecture de la base, donc pas d'essai décompté.
  -- Motif `introuvable` : le texte embarqué dans l'app dit « … essaie avec
  -- son courriel », ce qui est exact. Le web lit motif_precis.
  v_courriel := nullif(lower(btrim(coalesce(p_courriel, ''))), '');
  if v_courriel is null or length(v_courriel) > 200 or position('@' in v_courriel) = 0 then
    return jsonb_build_object('ok', false, 'motif', 'introuvable', 'motif_precis', 'courriel_requis');
  end if;

  -- ── 3. COMPTEUR — avant toute lecture des comptes (anti-énumération) ──
  -- RETURN, jamais RAISE, sur tout refus métier : un RAISE annulerait
  -- l'incrément et rendrait l'énumération gratuite (voir 20260915090300).
  v_jour := (now() at time zone 'America/Montreal')::date;
  insert into public.ambassadeur_tentatives (athlete_id, jour, n)
  values (v_parrain, v_jour, 1)
  on conflict (athlete_id, jour) do update set n = public.ambassadeur_tentatives.n + 1
  returning n into v_n;
  if v_n > v_max then
    raise exception 'NEXUS: tu as atteint la limite de recherches pour aujourd''hui. Reessaie demain.';
  end if;

  -- ── 4. Soi-même ───────────────────────────────────────────────────────
  if exists (select 1 from public.users u join auth.users au on au.id = u.id
              where u.id = v_uid
                and (lower(btrim(coalesce(u.email, ''))) = v_courriel
                  or lower(btrim(coalesce(au.email, ''))) = v_courriel))
     or exists (select 1 from public.athletes a
                 where a.id = v_parrain and lower(btrim(coalesce(a.email, ''))) = v_courriel) then
    return jsonb_build_object('ok', false, 'motif', 'soi_meme');
  end if;

  -- ── 5. Qui porte cette adresse ? — PERSONNES distinctes ───────────────
  -- Un compte (users.email / auth.users.email) OU une fiche (athletes.email,
  -- identifiée par son compte si elle en a un, sinon par elle-même). Deux
  -- personnes distinctes = adresse AMBIGUË → refusée (décision BP).
  select array_agg(distinct p) into v_personnes from (
    select u.id::text as p
      from public.users u join auth.users au on au.id = u.id
     where lower(btrim(coalesce(u.email, ''))) = v_courriel
        or lower(btrim(coalesce(au.email, ''))) = v_courriel
    union
    select coalesce(a.user_id::text, 'fiche:' || a.id::text)
      from public.athletes a
     where lower(btrim(coalesce(a.email, ''))) = v_courriel
       and a.status <> 'SUPPRIME'
  ) t;

  if coalesce(array_length(v_personnes, 1), 0) <> 1 or v_personnes[1] like 'fiche:%' then
    return jsonb_build_object('ok', false, 'motif', 'introuvable');
  end if;
  v_cible_u := v_personnes[1]::uuid;

  -- ── 6. Un compte ATHLÈTE actif, consentement passé — la même définition
  -- que le lien. Sinon, même motif neutre.
  if not exists (
       select 1 from public.users u join auth.users au on au.id = u.id
        where u.id = v_cible_u and u.role = 'ATHLETE' and u.status = 'ACTIF'
          and coalesce(au.raw_user_meta_data->>'consent_privacy_policy',
                       u.privacy_preferences->>'consent_privacy_policy') is not null) then
    return jsonb_build_object('ok', false, 'motif', 'introuvable');
  end if;

  select a.id into v_fiche from public.athletes a where a.user_id = v_cible_u order by a.created_at limit 1;

  -- ── 7. INSERT — bloc INTERNE, pour ne pas annuler le compteur ─────────
  begin
    insert into public.ambassadeur_revendications (
      parrain_athlete_id, courriel_normalise, filleul_user_id, filleul_athlete_id,
      methode, statut, confirmee_le)
    values (v_parrain, v_courriel, v_cible_u, v_fiche, 'courriel', 'CONFIRMEE', now())
    returning id into v_id;
  exception when unique_violation then
    -- Course, doublon du même parrain, ou recrue déjà comptée ailleurs :
    -- volontairement indistincts.
    return jsonb_build_object('ok', false, 'motif', 'deja_parrainee');
  end;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'statut', 'CONFIRMEE', 'motif', 'confirmee',
    'prenom', public.ambassadeur_prenom_compte(v_cible_u));
end;
$fn$;

comment on function public.ambassadeur_revendiquer(text, text, text, uuid, uuid) is
$c$Déclare une recrue PAR COURRIEL EXACT (2026-09-22). p_prenom, p_nom,
p_ecole_id et p_team_id sont ignorés — signature gardée pour l'app 1.4.2.
Cible : un compte ATHLETE actif ayant passé le consentement. Adresse portée
par deux personnes distinctes → introuvable. Limite : 20 essais par jour,
décomptés seulement quand un courriel est fourni.

Retour {ok, motif[, motif_precis][, id, statut, prenom]} :
  ok:true  confirmee        · prenom = celui de la recrue
  ok:false introuvable      · (motif_precis = courriel_requis sans courriel)
  ok:false deja_parrainee / soi_meme
Lève : pas de session, pas athlète, quota du jour dépassé.$c$;

-- ── 9. Le tableau du parrain — PRÉNOM seulement ──────────────────────────
create or replace function public.ambassadeur_mon_tableau()
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_uid       uuid;
  v_parrain   uuid;
  v_confirmes int;
  v_jour      date;
  v_restant   int;
  v_paliers   jsonb;
  v_lignes    jsonb;
  v_badge     boolean;
  v_clics     int;
  v_par_lien  int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NEXUS: tu dois etre connecte.';
  end if;

  select a.id into v_parrain from public.athletes a where a.user_id = v_uid limit 1;
  if v_parrain is null then
    raise exception 'NEXUS: seul un athlete a un tableau d''ambassadeur.';
  end if;

  select count(*) into v_confirmes
    from public.ambassadeur_revendications
   where parrain_athlete_id = v_parrain and statut = 'CONFIRMEE';

  v_jour := (now() at time zone 'America/Montreal')::date;
  select greatest(0, 20 - coalesce(max(n), 0)) into v_restant
    from public.ambassadeur_tentatives
   where athlete_id = v_parrain and jour = v_jour;

  select coalesce(jsonb_agg(palier order by palier), '[]'::jsonb) into v_paliers
    from public.ambassadeur_paliers where athlete_id = v_parrain;

  select exists (
    select 1 from public.athlete_badges ab
      join public.badges b on b.id = ab.badge_id
     where ab.athlete_id = v_parrain
       and b.code = 'ambassadeur'
       and ab.retire_le is null) into v_badge;

  select coalesce(sum(n), 0) into v_clics
    from public.ambassadeur_liens_clics
   where athlete_id = v_parrain and jour > v_jour - 30;

  select count(*) into v_par_lien
    from public.ambassadeur_revendications
   where parrain_athlete_id = v_parrain and statut = 'CONFIRMEE' and methode = 'lien';

  -- PRÉNOM SEULEMENT (décision BP 2026-09-21). Lu sur le compte de la
  -- recrue quand il est connu ; sinon (anciennes lignes sans recrue) ce que
  -- le parrain avait tapé. `nom` reste une chaîne VIDE : l'app 1.4.2 affiche
  -- `{r.prenom} {r.nom}` et écrirait « undefined » sans la clé.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',      r.id,
           'prenom',  coalesce(case when r.filleul_user_id is not null
                                    then public.ambassadeur_prenom_compte(r.filleul_user_id) end,
                               nullif(btrim(r.prenom), ''), '—'),
           'nom',     '',
           'via',     case when r.methode = 'lien' then 'lien' else 'declaration' end,
           'statut',  r.statut,
           'le',      r.created_at) order by r.created_at desc), '[]'::jsonb)
    into v_lignes
    from public.ambassadeur_revendications r
   where r.parrain_athlete_id = v_parrain;

  return jsonb_build_object(
    'confirmes',        v_confirmes,
    'paliers',          v_paliers,
    'badge_debloque',   exists (select 1 from public.ambassadeur_paliers
                                 where athlete_id = v_parrain and palier = 5),
    'badge_porte',      v_badge,
    'recherches_restantes', v_restant,
    'lien',             jsonb_build_object('clics_30j', v_clics, 'inscriptions', v_par_lien),
    'revendications',   v_lignes);
end;
$fn$;

-- ── 10. Droits ───────────────────────────────────────────────────────────
revoke all on function public.ambassadeur_mon_lien()                  from public, anon;
revoke all on function public.ambassadeur_regenerer_lien()            from public, anon;
revoke all on function public.ambassadeur_lier_invitation(text)       from public, anon;
revoke all on function public.ambassadeur_resoudre_lien(text, boolean) from public;
grant execute on function public.ambassadeur_mon_lien()                  to authenticated;
grant execute on function public.ambassadeur_regenerer_lien()            to authenticated;
grant execute on function public.ambassadeur_lier_invitation(text)       to authenticated;
grant execute on function public.ambassadeur_resoudre_lien(text, boolean) to anon, authenticated;

-- ── 11. Gates — listes COMPLÈTES triées, jamais par inclusion ────────────
do $$
declare
  vus   text[];
  f     record;
  auth3 text[] := array['authenticated','postgres','service_role'];
begin
  for f in
    select * from (values
      ('public.ambassadeur_mon_lien()'::regprocedure,                   auth3),
      ('public.ambassadeur_regenerer_lien()'::regprocedure,             auth3),
      ('public.ambassadeur_lier_invitation(text)'::regprocedure,        auth3),
      ('public.ambassadeur_resoudre_lien(text,boolean)'::regprocedure,  array['anon','authenticated','postgres','service_role']),
      ('public.ambassadeur_revendiquer(text,text,text,uuid,uuid)'::regprocedure, auth3),
      ('public.ambassadeur_mon_tableau()'::regprocedure,                auth3),
      ('public.ambassadeur_prenom_compte(uuid)'::regprocedure,          array['postgres','service_role']),
      ('public.ambassadeur_deduire_filleul_user()'::regprocedure,       array['postgres','service_role'])
    ) as t(oid, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f.oid;
    if vus is distinct from f.veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', f.oid::regprocedure, vus, f.veut;
    end if;
  end loop;

  select array_agg(t.g order by t.g) into vus
    from pg_class c, lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                                from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.ambassadeur_liens'::regclass;
  if vus is distinct from array['postgres','service_role'] then
    raise exception 'NEXUS: ACL de ambassadeur_liens = %, attendu {postgres,service_role}', vus;
  end if;

  select array_agg(t.g order by t.g) into vus
    from pg_class c, lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                                from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.ambassadeur_liens_clics'::regclass;
  if vus is distinct from auth3 then
    raise exception 'NEXUS: ACL de ambassadeur_liens_clics = %, attendu %', vus, auth3;
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'ambassadeur_liens_clics'
                and grantee = 'authenticated' and privilege_type <> 'SELECT') then
    raise exception 'NEXUS: ambassadeur_liens_clics accorde plus que SELECT a authenticated.';
  end if;

  if (select count(*) from pg_indexes where schemaname = 'public'
        and indexname in ('ambassadeur_filleul_user_unique_confirme','ambassadeur_parrain_filleul_user_unique')) <> 2 then
    raise exception 'NEXUS: index uniques sur filleul_user_id absents.';
  end if;

  raise notice 'NEXUS: invitation par lien posee — 2 tables, 6 fonctions, declaration par courriel seul, ACL exactes.';
end $$;
