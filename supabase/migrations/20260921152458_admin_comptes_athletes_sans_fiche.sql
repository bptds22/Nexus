-- ═══════════════════════════════════════════════════════════════════════════
-- Relance des inscriptions inachevées — le volet BASE, en une migration :
--   1. relances_inscription          le journal (jamais deux fois)
--   2. courriel_desabonnements       le registre LCAP
--   3. comptes_athletes_sans_fiche_base()   LA définition, service_role
--   4. admin_comptes_athletes_sans_fiche()  l'écran /admin/athletes
--   5. relance_inscription_cibles()         les destinataires, service_role
--
-- ── LE CONSTAT (diagnostic du 2026-09-21) ────────────────────────────────
-- /admin/athletes ne lisait que `athletes`. Or 67 comptes de rôle ATHLETE n'y
-- ont AUCUNE ligne : 34 n'ont jamais passé /consentements, 33 l'ont passé
-- puis ont quitté l'onboarding avant toute sauvegarde. L'app n'écrit la fiche
-- qu'à la TOUTE FIN (AthleteOnboardingMobile) : un abandon dans l'app ne
-- laisse aucune trace dans `athletes`. L'écran affichait donc ~130 profils
-- quand la plateforme comptait ~189 comptes athlètes.
--
-- ── UNE SEULE DÉFINITION, DEUX LECTEURS ─────────────────────────────────
-- L'écran admin et la fonction d'envoi doivent parler des MÊMES comptes. Si
-- chacun avait sa requête, « doublon probable » ou « consentement passé »
-- finiraient par diverger, et on relancerait quelqu'un que l'écran disait
-- exclu. D'où une fonction de base (3), lue par l'enveloppe admin (4) et par
-- la liste des destinataires (5). La base n'a PAS de garde : elle n'est
-- exécutable que par service_role (et par son propriétaire, pour les deux
-- enveloppes DEFINER).
--
-- ── POURQUOI DEFINER ─────────────────────────────────────────────────────
-- Le fournisseur d'auth, la dernière connexion et les métadonnées de
-- consentement vivent dans `auth.users`, illisible par un client. Même motif
-- que admin_parent_state (20260904153826).
--
-- ── « CONSENTEMENT PASSÉ » = LA DÉFINITION DE needsConsent() ─────────────
-- consent_privacy_policy non nul dans raw_user_meta_data OU dans
-- users.privacy_preferences — exactement lib/auth/needsConsent.ts.
--
-- ── LE JOURNAL DES RELANCES ──────────────────────────────────────────────
-- RÉSERVER PUIS ENVOYER. La ligne est écrite AVANT l'appel Resend (statut
-- RESERVE), puis passe ENVOYE (avec l'id Resend) ou ECHEC. L'index unique
-- partiel exclut ECHEC : un envoi raté peut être retenté, un envoi réussi ou
-- en cours ne peut PAS être doublé, même par deux exécutions concurrentes.
-- C'est la leçon de email_sent_at (posé après un POST async, donc marqueur
-- de TENTATIVE et non de livraison) : ici le statut dit lequel des deux.
-- `campagne` fait partie de la clé : une v2 délibérée reste possible.
--
-- Une ligne restée RESERVE (plantage entre la réservation et l'appel)
-- BLOQUE la personne : c'est voulu — on ne sait pas si le courriel est
-- parti. Pour la libérer, la passer à ECHEC à la main ; la fonction d'envoi
-- transmet une clé d'idempotence à Resend, donc un nouvel essai dans les
-- 24 h ne doublerait pas un envoi qui aurait réellement abouti.
--
-- ── LE REGISTRE DE DÉSABONNEMENT (LCAP) ──────────────────────────────────
-- Un désabonnement vaut pour TOUTES les communications de ce type, pas pour
-- une campagne : c'est ce que la personne demande, et ce que la LCAP exige.
-- Écrit par la route /api/desabonnement (service_role, après vérification
-- d'un jeton signé), lu par l'admin et par relance_inscription_cibles().
--
-- Aucune adresse n'est copiée : user_id suffit. ON DELETE CASCADE : un
-- compte supprimé emporte ce qu'on sait de lui (droit à l'effacement).
--
-- CE FICHIER N'ENVOIE RIEN. Aucun cron.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Le journal ────────────────────────────────────────────────────────
create table public.relances_inscription (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  campagne    text not null check (length(campagne) between 1 and 64),
  statut      text not null default 'RESERVE'
                check (statut in ('RESERVE','ENVOYE','ECHEC')),
  resend_id   text null,
  erreur      text null,
  reserve_le  timestamptz not null default now(),
  envoye_le   timestamptz null,
  constraint relances_envoye_coherent
    check (statut <> 'ENVOYE' or envoye_le is not null)
);

comment on table public.relances_inscription is
$c$Journal des relances courriel « inscription inachevée ». Une ligne est
RÉSERVÉE avant l'appel Resend, puis passe ENVOYE ou ECHEC.

L'index relances_une_par_campagne (partiel, statut <> 'ECHEC') est la règle
« jamais deux fois la même personne pour la même campagne ». Un ECHEC libère
la place pour un nouvel essai. Une ligne RESERVE bloquée se libère en la
passant à ECHEC à la main.

Écriture : service_role seulement (la fonction d'envoi). Lecture : admin.$c$;

create unique index relances_une_par_campagne
  on public.relances_inscription (user_id, campagne)
  where statut <> 'ECHEC';

alter table public.relances_inscription enable row level security;

create policy "relances inscription admin read" on public.relances_inscription
  for select to authenticated using (public.is_admin());

-- pg_default_acl accorde ALL à anon et authenticated sur toute table neuve.
revoke all on public.relances_inscription from anon, authenticated;
grant select on public.relances_inscription to authenticated;  -- borné admin (RLS)

-- ── 2. Le registre de désabonnement ──────────────────────────────────────
create table public.courriel_desabonnements (
  user_id       uuid primary key references public.users(id) on delete cascade,
  desabonne_le  timestamptz not null default now(),
  -- 'lien'   : clic sur « Ne plus recevoir ces courriels », puis confirmation
  -- 'un_clic': en-tête List-Unsubscribe-Post (bouton natif Gmail / Apple Mail)
  -- 'admin'  : demande reçue par courriel ou autrement, consignée à la main
  source        text not null check (source in ('lien','un_clic','admin'))
);

comment on table public.courriel_desabonnements is
$c$Registre LCAP : les comptes qui ne veulent plus recevoir de courriels de
relance ou de marketing. UNE ligne par compte — le désabonnement vaut pour
tout ce type de communication, pas pour une campagne.

La LCAP exige un mécanisme fonctionnel au moins 60 jours après l'envoi et
un effet dans les 10 jours ouvrables : ici, l'effet est immédiat (la liste
des destinataires l'exclut à la prochaine lecture).

Écriture : service_role (route /api/desabonnement, jeton HMAC vérifié).
Lecture : admin.$c$;

alter table public.courriel_desabonnements enable row level security;

create policy "desabonnements admin read" on public.courriel_desabonnements
  for select to authenticated using (public.is_admin());

revoke all on public.courriel_desabonnements from anon, authenticated;
grant select on public.courriel_desabonnements to authenticated;  -- borné admin (RLS)

-- ── 3. La définition — service_role seulement ────────────────────────────
create or replace function public.comptes_athletes_sans_fiche_base()
  returns table (
    user_id                uuid,
    email                  text,
    prenom                 text,
    nom                    text,
    fournisseur            text,
    inscrit_le             timestamptz,
    derniere_connexion     timestamptz,
    consentement_passe     boolean,
    consentement_le        text,
    consentement_marketing boolean,
    age                    int,
    doublon_probable       boolean,
    desabonne              boolean
  )
  language sql
  stable
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to off
as $fn$
  with base as (
    select
      u.id,
      au.email::text                                        as email,
      coalesce(nullif(btrim(u.first_name), ''),
               nullif(btrim(au.raw_user_meta_data->>'first_name'), ''),
               nullif(split_part(btrim(au.raw_user_meta_data->>'full_name'), ' ', 1), '')) as prenom,
      coalesce(nullif(btrim(u.last_name), ''),
               nullif(btrim(au.raw_user_meta_data->>'last_name'), ''),
               nullif(regexp_replace(btrim(au.raw_user_meta_data->>'full_name'), '^\S+\s*', ''), '')) as nom,
      au.raw_app_meta_data->>'provider'                     as fournisseur,
      au.created_at                                         as inscrit_le,
      au.last_sign_in_at                                    as derniere_connexion,
      coalesce(au.raw_user_meta_data->>'consent_privacy_policy',
               u.privacy_preferences->>'consent_privacy_policy')  as consent_pp,
      coalesce(au.raw_user_meta_data->>'consent_marketing',
               u.privacy_preferences->>'consent_marketing')       as consent_mkt,
      -- Validée avant le cast : une métadonnée mal formée ne doit pas faire
      -- tomber l'écran admin ni la fonction d'envoi.
      case when au.raw_user_meta_data->>'date_naissance' ~ '^\d{4}-\d{2}-\d{2}$'
           then (au.raw_user_meta_data->>'date_naissance')::date end as dob
    from public.users u
    join auth.users au on au.id = u.id
    where u.role = 'ATHLETE'
      and not exists (select 1 from public.athletes a where a.user_id = u.id)
  )
  select
    b.id,
    b.email,
    b.prenom,
    b.nom,
    b.fournisseur,
    b.inscrit_le,
    b.derniere_connexion,
    b.consent_pp is not null,
    b.consent_pp,
    b.consent_mkt is not null,
    case when b.dob is null then null else extract(year from age(b.dob))::int end,
    -- Même personne déjà présente avec une fiche active sous un AUTRE compte :
    -- même nom normalisé ET même date de naissance. Exclue de la relance —
    -- la relancer l'inviterait à créer un doublon.
    (b.dob is not null and b.prenom is not null and b.nom is not null and exists (
       select 1 from public.athletes a
        where a.user_id is not null
          and a.status = 'ACTIF'
          and a.date_naissance = b.dob
          and public.nexus_normaliser_nom(a.first_name) = public.nexus_normaliser_nom(b.prenom)
          and public.nexus_normaliser_nom(a.last_name)  = public.nexus_normaliser_nom(b.nom))),
    exists (select 1 from public.courriel_desabonnements d where d.user_id = b.id)
  from base b;
$fn$;

comment on function public.comptes_athletes_sans_fiche_base() is
$c$LA définition d'un compte ATHLETE sans fiche, lue par l'écran admin ET par
la liste des destinataires. Sans garde : exécutable par service_role
seulement. Ne jamais l'ouvrir à authenticated — elle rend des courriels.$c$;

revoke all on function public.comptes_athletes_sans_fiche_base() from public, anon, authenticated;
grant execute on function public.comptes_athletes_sans_fiche_base() to service_role;

-- ── 4. L'écran admin ─────────────────────────────────────────────────────
create or replace function public.admin_comptes_athletes_sans_fiche()
  returns table (
    user_id                uuid,
    email                  text,
    prenom                 text,
    nom                    text,
    fournisseur            text,
    inscrit_le             timestamptz,
    derniere_connexion     timestamptz,
    consentement_passe     boolean,
    consentement_le        text,
    consentement_marketing boolean,
    age                    int,
    doublon_probable       boolean,
    desabonne              boolean,
    relance_statut         text,
    relance_le             timestamptz
  )
  language plpgsql
  stable
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to off
as $fn$
begin
  if not public.is_admin() then
    raise exception 'NEXUS: admin_comptes_athletes_sans_fiche — reserve a un administrateur';
  end if;

  return query
  select b.user_id, b.email, b.prenom, b.nom, b.fournisseur, b.inscrit_le,
         b.derniere_connexion, b.consentement_passe, b.consentement_le,
         b.consentement_marketing, b.age, b.doublon_probable, b.desabonne,
         r.statut,
         coalesce(r.envoye_le, r.reserve_le)
    from public.comptes_athletes_sans_fiche_base() b
    -- UN ENVOI RÉUSSI PRIME, puis un envoi en cours, puis un échec. Trier sur
    -- la seule date laissait un ECHEC plus récent (ou simultané — vu en
    -- recette) masquer un ENVOYE : l'écran aurait dit « échec » à propos
    -- d'une personne déjà relancée, invitant à la relancer une seconde fois.
    left join lateral (
      select ri.statut, ri.envoye_le, ri.reserve_le
        from public.relances_inscription ri
       where ri.user_id = b.user_id
       order by case ri.statut when 'ENVOYE' then 0 when 'RESERVE' then 1 else 2 end,
                ri.reserve_le desc
       limit 1) r on true
   order by b.inscrit_le desc;
end;
$fn$;

comment on function public.admin_comptes_athletes_sans_fiche() is
$c$Comptes de rôle ATHLETE sans aucune ligne dans `athletes` — l'inscription
inachevée que /admin/athletes ne voyait pas. Réservée à is_admin(). Lit
comptes_athletes_sans_fiche_base() et y ajoute l'état de relance.$c$;

revoke all on function public.admin_comptes_athletes_sans_fiche() from public, anon;
grant execute on function public.admin_comptes_athletes_sans_fiche() to authenticated;

-- ── 5. Les destinataires — service_role seulement ────────────────────────
-- Les cinq exclusions sont celles de docs/relance-inscription-inachevee.md :
-- consentement jamais passé (aucun indice d'âge), doublon probable,
-- désabonné, sans adresse, et déjà relancé (ou en cours) pour CETTE campagne.
create or replace function public.relance_inscription_cibles(p_campagne text)
  returns table (
    user_id     uuid,
    email       text,
    prenom      text,
    fournisseur text,
    inscrit_le  timestamptz
  )
  language sql
  stable
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to off
as $fn$
  select b.user_id, b.email, b.prenom, b.fournisseur, b.inscrit_le
    from public.comptes_athletes_sans_fiche_base() b
   where b.consentement_passe
     and not b.doublon_probable
     and not b.desabonne
     and nullif(btrim(b.email), '') is not null
     and not exists (
           select 1 from public.relances_inscription ri
            where ri.user_id = b.user_id
              and ri.campagne = p_campagne
              and ri.statut <> 'ECHEC')
   order by b.inscrit_le;
$fn$;

comment on function public.relance_inscription_cibles(text) is
$c$Les comptes à relancer pour une campagne. Exclut : consentement jamais
passé, doublon probable, désabonné, sans adresse, déjà relancé (ou réservé)
pour cette campagne. Exécutable par service_role seulement.$c$;

revoke all on function public.relance_inscription_cibles(text) from public, anon, authenticated;
grant execute on function public.relance_inscription_cibles(text) to service_role;

-- ── 6. Gates — listes COMPLÈTES triées, jamais par inclusion (CLAUDE.md) ─
do $$
declare
  vus   text[];
  admin text[] := array['authenticated','postgres','service_role'];
  svc   text[] := array['postgres','service_role'];
  f     record;
begin
  for f in
    select * from (values
      ('public.admin_comptes_athletes_sans_fiche()'::regprocedure, admin),
      ('public.comptes_athletes_sans_fiche_base()'::regprocedure,  svc),
      ('public.relance_inscription_cibles(text)'::regprocedure,     svc)
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

  for f in
    select * from (values
      ('public.relances_inscription'::regclass),
      ('public.courriel_desabonnements'::regclass)
    ) as t(oid)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_class c,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(c.relacl::text[]) as x) t
     where c.oid = f.oid;
    if vus is distinct from admin then
      raise exception 'NEXUS: ACL de % = %, attendu %', f.oid::regclass, vus, admin;
    end if;
  end loop;

  -- anon ne doit RIEN avoir sur les tables, et authenticated QUE la lecture.
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public'
                and table_name in ('relances_inscription','courriel_desabonnements')
                and (grantee = 'anon'
                     or (grantee = 'authenticated' and privilege_type <> 'SELECT'))) then
    raise exception 'NEXUS: une table de relance accorde plus que SELECT a authenticated, ou quelque chose a anon.';
  end if;

  raise notice 'NEXUS: volet base de la relance pose — 2 tables, 3 fonctions, ACL exactes.';
end $$;
