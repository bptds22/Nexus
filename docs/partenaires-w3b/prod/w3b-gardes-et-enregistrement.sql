-- W3b en prod par psql — GARDES + ENREGISTREMENT, dans LA MÊME transaction que
-- la migration (psql -1 -f w3b-releve-avant.sql -f <W3b> -f <ce fichier>).
-- Une garde qui échoue (RAISE « NEXUS: ») annule TOUT : W3b, l'historique et
-- admin_operations. Les témoins viennent de _w3b_avant (w3b-releve-avant.sql).
-- GÉNÉRÉ par generer-gardes.mjs — la chaîne $w3b$ est la migration copiée
-- octet pour octet (LF) : ne pas éditer à la main, le md5 de garde casserait.

-- ── 1. Ce que W3b ne doit jamais toucher : comparé au relevé avant ─────────
do $$
declare
  a _w3b_avant%rowtype;
  v text;
begin
  select * into a from _w3b_avant;

  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(retire_le::text, '∅'), ',' order by id), ''))
        from public.athlete_badges) is distinct from a.athlete_badges then
    raise exception 'NEXUS: athlete_badges a bougé';
  end if;
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(
            id::text || partner_badge_id::text || athlete_id::text || coalesce(retire_le::text, '∅') || coalesce(masque_le::text, '∅'),
            ',' order by id), ''))
        from public.partner_athlete_badges) is distinct from a.poses_w3 then
    raise exception 'NEXUS: les poses W3 existantes ont bougé';
  end if;
  if (select count(*) from public.partner_badges) <> a.partner_badges then
    raise exception 'NEXUS: partner_badges a bougé';
  end if;
  -- Triggers d'athlete_badges : ceux d'avant, plus EXACTEMENT trg_badge_deja_partenaire.
  select string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text, ',' order by tgname) into v
    from pg_trigger where tgrelid = 'public.athlete_badges'::regclass and not tgisinternal
     and tgname <> 'trg_badge_deja_partenaire';
  if v is distinct from a.triggers_athlete_badges or v not like '%trg_badge_plafond:badge_plafond:O%' then
    raise exception 'NEXUS: triggers d''athlete_badges d''avant changés : %', v;
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.athlete_badges'::regclass
                  and tgname = 'trg_badge_deja_partenaire' and tgenabled = 'O'
                  and tgfoid = 'public.badge_refuser_doublon_partenaire()'::regprocedure
                  and (tgtype & 2) = 2) then  -- BEFORE
    raise exception 'NEXUS: trg_badge_deja_partenaire absent, désactivé ou pas BEFORE';
  end if;
  select string_agg(p.oid::regprocedure::text || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.oid::regprocedure::text) into v
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'ambassadeur%';
  if v is distinct from a.fonctions_ambassadeur then  -- même transaction, même texte : comparaison brute
    raise exception 'NEXUS: fonctions ambassadeur (M10) changées';
  end if;
  select string_agg(c.relname || '.' || t.tgname || ':' || t.tgfoid::regproc::text || ':' || t.tgenabled::text, ',' order by c.relname, t.tgname) into v
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and t.tgfoid::regproc::text like '%ambassadeur%';
  if v is distinct from a.triggers_ambassadeur then
    raise exception 'NEXUS: triggers ambassadeur (M10) changés : %', v;
  end if;
  if md5(replace(pg_get_functiondef('public.badge_plafond()'::regprocedure), E'\r', '')) <> '171a82c74237a5a6d9c5f50c74f44d5e' then
    raise exception 'NEXUS: badge_plafond a changé';
  end if;
  if (select count(*) from public.badges where actif and famille in ('universel', 'sport') and not requiert_contexte) <> a.badges_admissibles
     or (select count(*) from public.badge_sports) <> a.badge_sports then
    raise exception 'NEXUS: catalogue des badges changé';
  end if;
end $$;

-- ── 2. Le nouvel état ──────────────────────────────────────────────────────
do $$
declare
  f regprocedure;
  v text;
  n int;
begin
  -- Droits : liste COMPLÈTE, jamais par inclusion.
  foreach f in array array[
    'public.partenaire_badges_nexus_admissibles(uuid)'::regprocedure,
    'public.partenaire_attribuer_badge_nexus(uuid, uuid, uuid)'::regprocedure,
    'public.partenaire_attribuer_badge(uuid, uuid)'::regprocedure,
    'public.retirer_badge_partenaire(uuid)'::regprocedure,
    'public.coach_masquer_badge_partenaire(uuid, boolean)'::regprocedure,
    'public.badges_partenaires_athlete(uuid)'::regprocedure]
  loop
    select string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' order by a.grantee::regrole::text)
      into v from pg_proc p, lateral aclexplode(p.proacl) a where p.oid = f;
    if v is distinct from 'authenticated:EXECUTE,postgres:EXECUTE,service_role:EXECUTE' then
      raise exception 'NEXUS: droits % = %', f, v;
    end if;
    if not (select prosecdef from pg_proc where oid = f) then
      raise exception 'NEXUS: % n''est pas SECURITY DEFINER', f;
    end if;
  end loop;

  -- La fonction de trigger : personne ne l'appelle directement.
  select string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' order by a.grantee::regrole::text)
    into v from pg_proc p, lateral aclexplode(p.proacl) a where p.oid = 'public.badge_refuser_doublon_partenaire()'::regprocedure;
  if v is distinct from 'postgres:EXECUTE,service_role:EXECUTE' then
    raise exception 'NEXUS: droits badge_refuser_doublon_partenaire = %', v;
  end if;

  -- La table : RLS, aucune policy, aucun privilège direct, aucun trigger.
  if not (select relrowsecurity from pg_class where oid = 'public.partner_athlete_badges'::regclass) then
    raise exception 'NEXUS: RLS inactive sur partner_athlete_badges';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partner_athlete_badges') then
    raise exception 'NEXUS: policy inattendue sur partner_athlete_badges';
  end if;
  if exists (select 1 from pg_class c, lateral aclexplode(c.relacl) a
              where c.oid = 'public.partner_athlete_badges'::regclass
                and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))) then
    raise exception 'NEXUS: privilège direct sur partner_athlete_badges';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.partner_athlete_badges'::regclass and not tgisinternal) then
    raise exception 'NEXUS: trigger inattendu sur partner_athlete_badges';
  end if;

  -- Les poses W3 : toutes rattachées à leur partenaire, aucune pose Nexus encore.
  select count(*) into n from public.partner_athlete_badges where partner_id is null;
  if n <> 0 then raise exception 'NEXUS: % pose(s) sans partner_id', n; end if;
  select count(*) into n from public.partner_athlete_badges x join public.partner_badges b on b.id = x.partner_badge_id
   where b.partner_id <> x.partner_id;
  if n <> 0 then raise exception 'NEXUS: % pose(s) dont partner_id contredit le badge', n; end if;
  select count(*) into n from public.partner_athlete_badges where badge_id is not null;
  if n <> 0 then raise exception 'NEXUS: % pose(s) Nexus déjà présentes', n; end if;
end $$;

-- ── 3. Enregistrement ──────────────────────────────────────────────────────
create temp table _w3b on commit drop as
select '20261014180000'::text as version,
-- replace : un checkout Windows extrait ce fichier en CRLF ; le contenu
-- enregistré et son md5 sont ceux du blob git (LF).
replace($w3b$-- ═══════════════════════════════════════════════════════════════════════════
-- W3b — Badges NEXUS attribués par un partenaire.
--
-- LOCAL SEULEMENT (2026-10-14). Prod sur GO de BP, par psql -1 avec
-- docs/partenaires-w3b/prod/ (relevé avant + migration + gardes). Rollback :
-- supabase/rollback/20261014180000_rollback_w3b_partenaire_badges_nexus.sql
--
-- Décisions BP (2026-10-14) :
--   1. Un partenaire autorisé (partenaire_peut_evaluer() + athlète admissible
--      et ACTIF — la garde de W2/W3) peut attribuer des badges du catalogue
--      Nexus, en plus de ses propres badges (W3).
--   2. Admissibles : familles universel et sport, actifs, sans contexte
--      requis (17 badges au 2026-10-14). JAMAIS la famille honneur.
--   3. Un badge de sport ne va qu'à un athlète de ce sport : badge_sports
--      contre athletes.sport_id (même table que la taxonomie de /ma-story).
--   4. Rangés AVEC les badges partenaire (partner_athlete_badges) : hors
--      athlete_badges, donc hors plafond de 5 (badge_plafond) et hors M10.
--   6. Déjà porté (posé par le coach, ou par un partenaire) : refusé, avec un
--      message qui dit par qui. ET DANS L'AUTRE SENS (BP, suite W3b) : le coach
--      qui pose un badge déjà attribué par un partenaire est refusé, avec le
--      même message « (attribué par <partenaire>) » — trigger BEFORE sur
--      athlete_badges, qui couvre tous les chemins d'écriture (RPC du coach,
--      admin, suggestion approuvée). Le masquage par le coach reste possible.
--   7. Retrait : le partenaire qui l'a posé, ou l'admin. Masquage : le coach.
--      L'admin peut attribuer pour le compte d'un partenaire (p_partner_id).
--
-- ── SCHÉMA ──────────────────────────────────────────────────────────────────
-- partner_athlete_badges porte désormais l'un OU l'autre :
--   · partner_badge_id → un badge propre au partenaire (W3) ;
--   · badge_id         → un badge du catalogue Nexus (W3b).
-- partner_id (nouveau, NOT NULL) dit QUI l'a posé dans les deux cas : c'est
-- lui qui décide du retrait. Rempli pour les poses W3 existantes depuis
-- partner_badges.
--
-- ── FONCTIONS ───────────────────────────────────────────────────────────────
--   nouvelles : partenaire_badges_nexus_admissibles, partenaire_attribuer_badge_nexus
--   remplacées (même signature, ACL conservée) : partenaire_attribuer_badge
--     (pose aussi partner_id), retirer_badge_partenaire (propriétaire lu sur
--     partner_id)
--   DROP + CREATE : badges_partenaires_athlete — deux colonnes AJOUTÉES À LA
--     FIN (badge_code, est_nexus). Le DROP emporte l'ACL et les default
--     privileges en reposent une à anon : on révoque tout et on compare la
--     liste COMPLÈTE après (règle du 2026-09-07).
--   nouvelle fonction de trigger : badge_refuser_doublon_partenaire, sur
--     athlete_badges (trg_badge_deja_partenaire, BEFORE INSERT OR UPDATE) ;
--     badge_plafond (AFTER) n'est pas touché.
--   md5 comparés SANS les retours chariot (CR) : un fichier extrait en CRLF sous Windows et
--     passé à psql porterait des retours chariot (CR) dans le corps des fonctions.
--   inchangées et vérifiées par md5 : badge_plafond, ambassadeur_recalculer_paliers,
--     coach_masquer_badge_partenaire.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Point de départ : la version W3 en place, rien d'autre ──────────────
do $$
declare
  f text; attendu text; vu text;
begin
  for f, attendu in values
    ('public.partenaire_attribuer_badge(uuid, uuid)', 'b9b379472983ae03a046fd5af5313ded'),
    ('public.retirer_badge_partenaire(uuid)', '0e2388b927708a3efc11a21d8caf7e29'),
    ('public.badges_partenaires_athlete(uuid)', '7cd05f7cc8a9a04913aada360fb75bc2'),
    ('public.coach_masquer_badge_partenaire(uuid, boolean)', '8a61d292cfac6db385c4e825dfc549f3'),
    ('public.badge_plafond()', '171a82c74237a5a6d9c5f50c74f44d5e'),
    ('public.ambassadeur_recalculer_paliers()', '481cf443a2db040fd840a1e229b325f2')
  loop
    select md5(replace(pg_get_functiondef(f::regprocedure), E'\r', '')) into vu;
    if vu is distinct from attendu then
      raise exception 'NEXUS: % a changé depuis le relevé du 2026-10-14 (md5 %, attendu %)', f, vu, attendu;
    end if;
  end loop;
end $$;

-- ── 1. Schéma ──────────────────────────────────────────────────────────────
alter table public.partner_athlete_badges
  add column partner_id uuid references public.media_partners(id) on delete cascade,
  add column badge_id   uuid references public.badges(id);

update public.partner_athlete_badges x
   set partner_id = b.partner_id
  from public.partner_badges b
 where b.id = x.partner_badge_id;

alter table public.partner_athlete_badges alter column partner_id set not null;
alter table public.partner_athlete_badges alter column partner_badge_id drop not null;
alter table public.partner_athlete_badges
  add constraint partner_athlete_badges_un_seul_badge
  check (num_nonnulls(partner_badge_id, badge_id) = 1);

-- Un badge Nexus, une seule fois VIVANT par athlète, tous partenaires confondus.
create unique index partner_athlete_badges_nexus_vivant_key
  on public.partner_athlete_badges (badge_id, athlete_id)
  where retire_le is null and badge_id is not null;
create index partner_athlete_badges_partner_idx on public.partner_athlete_badges (partner_id);

comment on table public.partner_athlete_badges is
  'W3/W3b : badges posés par un partenaire — un badge propre (partner_badge_id) OU un badge du catalogue Nexus (badge_id). Hors athlete_badges : hors plafond de 5 (badge_plafond) et hors M10. Retrait doux ; masquage par le coach.';
comment on column public.partner_athlete_badges.partner_id is
  'W3b : le partenaire qui a posé le badge (propriétaire du retrait), pour les deux sortes de badge.';
comment on column public.partner_athlete_badges.badge_id is
  'W3b : badge du catalogue Nexus (familles universel / sport, sans contexte). NULL pour un badge propre au partenaire.';

-- ── 2. Badges Nexus qu'un partenaire peut proposer pour cet athlète ────────
-- Lecture pour le partenaire autorisé (et l'admin). `deja_par` dit qui porte
-- déjà le badge : « son coach », le nom de l'organisation, ou NULL.
create function public.partenaire_badges_nexus_admissibles(p_athlete_id uuid)
returns table (badge_id uuid, code text, libelle text, famille text, deja_par text)
language plpgsql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_sport  uuid;
  v_mp     uuid;
begin
  select a.sport_id into v_sport from public.athletes a where a.id = p_athlete_id;
  if not found then
    raise exception 'NEXUS: athlète introuvable' using errcode = 'P0002';
  end if;
  if not public.is_admin() then
    select mp.id into v_mp from public.media_partners mp where mp.user_id = auth.uid();
    if v_mp is null or not public.partenaire_peut_evaluer(v_mp, v_sport) then
      raise exception 'NEXUS: attribution non permise (permission, sport ou statut du partenaire)' using errcode = '42501';
    end if;
  end if;

  return query
  select b.id, b.code, b.libelle, b.famille,
         case
           when exists (select 1 from public.athlete_badges ab
                         where ab.athlete_id = p_athlete_id and ab.badge_id = b.id and ab.retire_le is null)
             then 'son coach'
           else (select coalesce(mp.organization_name, 'un partenaire')
                   from public.partner_athlete_badges x
                   join public.media_partners mp on mp.id = x.partner_id
                  where x.athlete_id = p_athlete_id and x.badge_id = b.id and x.retire_le is null
                  limit 1)
         end
    from public.badges b
   where b.actif
     and b.famille in ('universel', 'sport')
     and not b.requiert_contexte
     and (b.famille = 'universel'
          or exists (select 1 from public.badge_sports bs where bs.badge_id = b.id and bs.sport_id = v_sport))
   order by case b.famille when 'universel' then 0 else 1 end, b.ordre, b.libelle;
end $$;

-- ── 3. Poser un badge Nexus ────────────────────────────────────────────────
-- Le partenaire pose pour LUI (p_partner_id ignoré s'il est le sien, refusé
-- sinon). L'admin pose pour le compte d'un partenaire APPROUVÉ, qu'il nomme.
create function public.partenaire_attribuer_badge_nexus(
  p_athlete_id uuid,
  p_badge_id   uuid,
  p_partner_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_badge   public.badges%rowtype;
  v_mp      public.media_partners%rowtype;
  v_sport   uuid;
  v_sport_nom text;
  v_status  public.account_status;
  v_admin   boolean := public.is_admin();
  v_par     text;
  v_id      uuid;
begin
  -- Le partenaire
  if v_admin then
    if p_partner_id is null then
      raise exception 'NEXUS: l''admin doit nommer le partenaire pour le compte duquel il attribue' using errcode = '22023';
    end if;
    select * into v_mp from public.media_partners where id = p_partner_id;
    if not found then
      raise exception 'NEXUS: partenaire introuvable' using errcode = 'P0002';
    end if;
    if v_mp.status is distinct from 'APPROVED' then
      raise exception 'NEXUS: partenaire non approuvé' using errcode = '42501';
    end if;
  else
    select * into v_mp from public.media_partners where user_id = auth.uid();
    if not found then
      raise exception 'NEXUS: réservé aux partenaires' using errcode = '42501';
    end if;
    if p_partner_id is not null and p_partner_id is distinct from v_mp.id then
      raise exception 'NEXUS: un partenaire n''attribue qu''en son propre nom' using errcode = '42501';
    end if;
  end if;

  -- Le badge : catalogue Nexus, universel ou sport, actif, sans contexte
  select * into v_badge from public.badges where id = p_badge_id;
  if not found then
    raise exception 'NEXUS: badge introuvable' using errcode = 'P0002';
  end if;
  if v_badge.famille not in ('universel', 'sport') or v_badge.requiert_contexte or not v_badge.actif then
    raise exception 'NEXUS: le badge « % » ne peut pas être attribué par un partenaire', v_badge.libelle using errcode = '42501';
  end if;

  -- L'athlète
  select a.sport_id, a.status, s.nom into v_sport, v_status, v_sport_nom
    from public.athletes a left join public.sports s on s.id = a.sport_id
   where a.id = p_athlete_id;
  if not found then
    raise exception 'NEXUS: athlète introuvable' using errcode = 'P0002';
  end if;
  if v_status is distinct from 'ACTIF'::public.account_status then
    raise exception 'NEXUS: athlète non actif' using errcode = '42501';
  end if;
  if not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then
    raise exception 'NEXUS: athlète non éligible à la visibilité partenaire' using errcode = '42501';
  end if;
  if not v_admin and not public.partenaire_peut_evaluer(v_mp.id, v_sport) then
    raise exception 'NEXUS: attribution non permise (permission, sport ou statut du partenaire)' using errcode = '42501';
  end if;

  -- Le sport du badge : celui de l'athlète, pour tout le monde (admin compris)
  if v_badge.famille = 'sport'
     and not exists (select 1 from public.badge_sports bs where bs.badge_id = v_badge.id and bs.sport_id = v_sport) then
    raise exception 'NEXUS: le badge « % » ne s''applique pas au sport de cet athlète (%)',
      v_badge.libelle, coalesce(v_sport_nom, 'sport non renseigné') using errcode = '22023';
  end if;

  -- Déjà porté ?
  if exists (select 1 from public.athlete_badges
              where athlete_id = p_athlete_id and badge_id = p_badge_id and retire_le is null) then
    raise exception 'NEXUS: cet athlète a déjà le badge « % » (attribué par son coach)', v_badge.libelle using errcode = '23505';
  end if;
  select case when x.partner_id = v_mp.id then 'vous' else coalesce(mp.organization_name, 'un partenaire') end
    into v_par
    from public.partner_athlete_badges x join public.media_partners mp on mp.id = x.partner_id
   where x.athlete_id = p_athlete_id and x.badge_id = p_badge_id and x.retire_le is null
   limit 1;
  if v_par is not null then
    raise exception 'NEXUS: cet athlète a déjà le badge « % » (attribué par %)', v_badge.libelle, v_par using errcode = '23505';
  end if;

  begin
    insert into public.partner_athlete_badges (partner_id, badge_id, athlete_id, attribue_par)
    values (v_mp.id, p_badge_id, p_athlete_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    -- Deux poses simultanées : l'index partiel tranche, le message reste clair.
    raise exception 'NEXUS: cet athlète a déjà le badge « % »', v_badge.libelle using errcode = '23505';
  end;
  return v_id;
end $$;

-- ── 4. Poser un badge PROPRE au partenaire (W3) : pose aussi partner_id ────
-- Corps W3 inchangé, sauf l'INSERT.
create or replace function public.partenaire_attribuer_badge(p_athlete_id uuid, p_badge_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_badge   public.partner_badges%rowtype;
  v_mp      public.media_partners%rowtype;
  v_sport   uuid;
  v_status  public.account_status;
  v_admin   boolean := public.is_admin();
  v_id      uuid;
begin
  select * into v_badge from public.partner_badges where id = p_badge_id;
  if not found or not v_badge.actif then
    raise exception 'NEXUS: badge introuvable ou désactivé' using errcode = 'P0002';
  end if;
  select * into v_mp from public.media_partners where id = v_badge.partner_id;

  select a.sport_id, a.status into v_sport, v_status from public.athletes a where a.id = p_athlete_id;
  if not found then
    raise exception 'NEXUS: athlète introuvable' using errcode = 'P0002';
  end if;
  if v_status is distinct from 'ACTIF'::public.account_status then
    raise exception 'NEXUS: athlète non actif' using errcode = '42501';
  end if;
  if not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then
    raise exception 'NEXUS: athlète non éligible à la visibilité partenaire' using errcode = '42501';
  end if;

  if v_admin then
    -- L'admin pose au nom du partenaire : l'organisation doit être APPROUVÉE.
    if v_mp.status is distinct from 'APPROVED' then
      raise exception 'NEXUS: partenaire non approuvé' using errcode = '42501';
    end if;
  else
    -- Le partenaire : SES badges seulement, et la garde W2 complète.
    if v_mp.user_id is distinct from auth.uid() then
      raise exception 'NEXUS: ce badge appartient à un autre partenaire' using errcode = '42501';
    end if;
    if not public.partenaire_peut_evaluer(v_mp.id, v_sport) then
      raise exception 'NEXUS: attribution non permise (permission, sport ou statut du partenaire)' using errcode = '42501';
    end if;
  end if;

  if exists (select 1 from public.partner_athlete_badges
              where partner_badge_id = p_badge_id and athlete_id = p_athlete_id and retire_le is null) then
    raise exception 'NEXUS: ce badge est déjà attribué à cet athlète' using errcode = '23505';
  end if;

  insert into public.partner_athlete_badges (partner_id, partner_badge_id, athlete_id, attribue_par)
  values (v_badge.partner_id, p_badge_id, p_athlete_id, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- ── 5. Retirer (partenaire qui l'a posé, ou admin) : propriétaire = partner_id
create or replace function public.retirer_badge_partenaire(p_attribution_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_owner uuid;
  v_retire timestamptz;
begin
  select mp.user_id, x.retire_le into v_owner, v_retire
    from public.partner_athlete_badges x
    join public.media_partners mp on mp.id = x.partner_id
   where x.id = p_attribution_id;
  if not found then
    raise exception 'NEXUS: badge introuvable' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or v_owner is not distinct from auth.uid()) then
    raise exception 'NEXUS: seul le partenaire qui a posé ce badge, ou un admin, peut le retirer' using errcode = '42501';
  end if;
  if v_retire is not null then
    raise exception 'NEXUS: badge déjà retiré' using errcode = '22023';
  end if;
  update public.partner_athlete_badges
     set retire_le = now(), retire_par = auth.uid()
   where id = p_attribution_id;
end $$;

-- ── 6. Lecture : les deux sortes de badge, mêmes lecteurs que W3 ───────────
-- Colonnes W3 inchangées, dans le même ordre ; deux colonnes AJOUTÉES À LA FIN :
--   badge_code  — code du badge Nexus (NULL pour un badge propre) ;
--   est_nexus   — vrai pour un badge du catalogue Nexus.
drop function public.badges_partenaires_athlete(uuid);
create function public.badges_partenaires_athlete(p_athlete_id uuid)
returns table (id uuid, badge_id uuid, libelle text, icone_path text, organisation text,
               created_at timestamptz, est_masque boolean, est_le_mien boolean, peut_masquer boolean,
               badge_code text, est_nexus boolean)
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  with lecteur as (
    select
      public.is_admin() as admin,
      (public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)) as encadrement,
      public.coach_can_award_badge(p_athlete_id) as coach,
      (    public.is_admin()
        or (public.is_recruiter() and public.athlete_is_active(p_athlete_id))
        or public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)
        or exists (select 1 from public.athletes a
                    where a.id = p_athlete_id and a.user_id = auth.uid())
      ) as tout
  )
  select x.id, coalesce(b.id, n.id), coalesce(b.libelle, n.libelle), b.icone_path, mp.organization_name, x.created_at,
         (x.masque_le is not null),
         (mp.user_id is not distinct from auth.uid()),
         (lecteur.admin or lecteur.coach),
         n.code,
         (n.id is not null)
    from public.partner_athlete_badges x
    join public.media_partners mp on mp.id = x.partner_id and mp.status = 'APPROVED'
    left join public.partner_badges b on b.id = x.partner_badge_id
    left join public.badges n on n.id = x.badge_id
    cross join lecteur
   where x.athlete_id = p_athlete_id
     and x.retire_le is null
     and (b.actif or n.actif)
     and auth.uid() is not null
     and (lecteur.tout or mp.user_id = auth.uid())
     and (x.masque_le is null or lecteur.admin or lecteur.encadrement or mp.user_id = auth.uid())
   order by x.created_at
$$;

-- ── 7. Le coach ne pose pas un badge déjà attribué par un partenaire ───────
-- BEFORE INSERT OR UPDATE sur athlete_badges : refuse une pose VIVANTE (ou une
-- réactivation, ou un changement de badge) quand un partenaire porte déjà ce
-- badge vivant sur cet athlète — masqué ou non : masquer n'est pas retirer.
-- Même message que dans l'autre sens. Le plafond (AFTER) et M10 ne bougent pas.
create function public.badge_refuser_doublon_partenaire()
returns trigger
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_org text;
  v_lib text;
begin
  if new.retire_le is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.retire_le is null
     and old.badge_id = new.badge_id and old.athlete_id = new.athlete_id then
    return new;
  end if;
  select coalesce(mp.organization_name, 'un partenaire') into v_org
    from public.partner_athlete_badges x
    join public.media_partners mp on mp.id = x.partner_id
   where x.athlete_id = new.athlete_id and x.badge_id = new.badge_id and x.retire_le is null
   limit 1;
  if v_org is null then
    return new;
  end if;
  select b.libelle into v_lib from public.badges b where b.id = new.badge_id;
  raise exception 'NEXUS: cet athlète a déjà le badge « % » (attribué par %)', v_lib, v_org using errcode = '23505';
end $$;

create trigger trg_badge_deja_partenaire
  before insert or update on public.athlete_badges
  for each row execute function public.badge_refuser_doublon_partenaire();

-- ── 8. Droits d'exécution ──────────────────────────────────────────────────
revoke all on function public.partenaire_badges_nexus_admissibles(uuid) from public, anon, authenticated;
revoke all on function public.partenaire_attribuer_badge_nexus(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.badges_partenaires_athlete(uuid) from public, anon, authenticated;
grant execute on function public.partenaire_badges_nexus_admissibles(uuid) to authenticated, service_role;
grant execute on function public.partenaire_attribuer_badge_nexus(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.badges_partenaires_athlete(uuid) to authenticated, service_role;
-- Fonction de trigger : personne ne l'appelle directement.
revoke all on function public.badge_refuser_doublon_partenaire() from public, anon, authenticated;

-- ── Gates (comparaison complète, jamais par inclusion) ─────────────────────
do $$
declare
  f    regprocedure;
  vus  text[];
  veut text[] := array['authenticated', 'postgres', 'service_role'];
  n    int;
  attendu text; nom text;
begin
  foreach f in array array[
    'public.partenaire_badges_nexus_admissibles(uuid)'::regprocedure,
    'public.partenaire_attribuer_badge_nexus(uuid, uuid, uuid)'::regprocedure,
    'public.partenaire_attribuer_badge(uuid, uuid)'::regprocedure,
    'public.retirer_badge_partenaire(uuid)'::regprocedure,
    'public.coach_masquer_badge_partenaire(uuid, boolean)'::regprocedure,
    'public.badges_partenaires_athlete(uuid)'::regprocedure]
  loop
    select array_agg(x.g order by x.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(a,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as a) x
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut;
    end if;
  end loop;

  -- La table : RLS active, aucune policy, aucun privilège direct (inchangé W3).
  if not (select relrowsecurity from pg_class where oid = 'public.partner_athlete_badges'::regclass) then
    raise exception 'NEXUS: RLS inactive sur partner_athlete_badges';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partner_athlete_badges') then
    raise exception 'NEXUS: policy inattendue sur partner_athlete_badges';
  end if;
  select array_agg(g.nom || ':' || a.privilege_type order by g.nom, a.privilege_type) into vus
    from pg_class c,
         lateral aclexplode(c.relacl) a,
         lateral (select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as nom) g
   where c.oid = 'public.partner_athlete_badges'::regclass and g.nom in ('anon', 'authenticated', 'PUBLIC');
  if vus is not null then
    raise exception 'NEXUS: privilèges directs sur partner_athlete_badges : %', vus;
  end if;

  -- Chaque pose a son partenaire, et un seul badge.
  select count(*) into n from public.partner_athlete_badges where partner_id is null;
  if n <> 0 then raise exception 'NEXUS: % pose(s) sans partner_id', n; end if;
  select count(*) into n from public.partner_athlete_badges x join public.partner_badges b on b.id = x.partner_badge_id
   where b.partner_id <> x.partner_id;
  if n <> 0 then raise exception 'NEXUS: % pose(s) W3 dont partner_id contredit le badge', n; end if;

  -- La fonction de trigger : ni anon ni authenticated.
  select array_agg(x.g order by x.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(a,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as a) x
   where pr.oid = 'public.badge_refuser_doublon_partenaire()'::regprocedure;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL badge_refuser_doublon_partenaire = %, attendu {postgres,service_role}', vus;
  end if;
  -- Les triggers d'athlete_badges : les trois d'avant, plus le nouveau. Liste complète.
  select string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text, ',' order by tgname) into nom
    from pg_trigger where tgrelid = 'public.athlete_badges'::regclass and not tgisinternal;
  if nom is distinct from 'trg_athlete_badges_miroir:trg_badges_vers_distinctions:O,trg_badge_contexte_requis:badge_contexte_requis:O,'
                       || 'trg_badge_deja_partenaire:badge_refuser_doublon_partenaire:O,trg_badge_plafond:badge_plafond:O' then
    raise exception 'NEXUS: triggers d''athlete_badges inattendus : %', nom;
  end if;

  -- Ce que W3b ne doit JAMAIS toucher : le plafond, M10, le masquage.
  for nom, attendu in values
    ('public.badge_plafond()', '171a82c74237a5a6d9c5f50c74f44d5e'),
    ('public.ambassadeur_recalculer_paliers()', '481cf443a2db040fd840a1e229b325f2'),
    ('public.coach_masquer_badge_partenaire(uuid, boolean)', '8a61d292cfac6db385c4e825dfc549f3')
  loop
    if md5(replace(pg_get_functiondef(nom::regprocedure), E'\r', '')) is distinct from attendu then
      raise exception 'NEXUS: % a changé', nom;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.athlete_badges'::regclass
                  and tgfoid = 'public.badge_plafond()'::regprocedure) then
    raise exception 'NEXUS: trigger badge_plafond absent d''athlete_badges';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.partner_athlete_badges'::regclass and not tgisinternal) then
    raise exception 'NEXUS: trigger inattendu sur partner_athlete_badges';
  end if;

  raise notice 'NEXUS W3b : badges Nexus par partenaire — ACL, RLS, plafond et M10 conformes';
end $$;
$w3b$, E'\r', '')::text as contenu;

do $$
begin
  if (select md5(contenu) from _w3b) <> '3ef008c5cf636f6095e99755425935cd' then
    raise exception 'NEXUS: contenu W3b embarqué altéré (md5 %)', (select md5(contenu) from _w3b);
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'w3b_partenaire_badges_nexus', array[contenu], 'bptds22@gmail.com' from _w3b;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_W3B_PARTENAIRE_BADGES_NEXUS',
       'W3b Partenaire : badges du catalogue Nexus attribués par un partenaire (hors plafond de 5), refus du doublon dans les deux sens et du mauvais sport (GO BP)',
       jsonb_build_object(
         'nom', 'w3b_partenaire_badges_nexus',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_w3b_partenaire_badges_nexus.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_w3b_partenaire_badges_nexus.sql',
         'voie', 'psql -1 (session pooler) : relevé avant + migration + gardes dans une seule transaction',
         'md5_fichier', '3ef008c5cf636f6095e99755425935cd',
         'acl_fonctions', 'authenticated,postgres,service_role (x6)',
         'poses_w3_rattachees', (select count(*) from public.partner_athlete_badges),
         'badge_plafond_et_m10', 'inchangés (md5 et triggers comparés au relevé avant)',
         'coach_bloque', 'trg_badge_deja_partenaire (BEFORE) : le coach ne pose pas un badge déjà attribué par un partenaire'),
       (select id from public.users where email = 'bptds22@gmail.com')
  from _w3b;

select version as version_w3b_enregistree from _w3b;
