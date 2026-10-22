-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — LOT B1 « porte coach → cégep » + liste d'attente (décisions BP 2026-10-22).
-- TIMESTAMP PROVISOIRE.
--
-- Règle : un compte COACH ne se rattache JAMAIS à un cégep — ni users.school_id d'un cégep, ni
-- school_coaches, ni team_coaches d'une équipe de cégep, ni réclamation d'un athlète ancré cégep,
-- ni invitation qui porte un cégep, ni création d'équipe sous un cégep, ni direction d'un cégep.
-- Les recruteurs collégiaux (RECRUTEUR rattachés à leur cégep) ne sont PAS touchés : la règle ne
-- regarde que le rôle COACH.
--
-- Écoles ouvertes aux coachs : liste BLANCHE (SECONDAIRE, LIGUE_CIVILE). Un type futur
-- (UNIVERSITE, lot D) est fermé par défaut, comme le cégep.
--
-- DORMANCE : au 2026-10-22, 0 compte COACH rattaché à un cégep en prod (users.school_id,
-- school_coaches, team_coaches, athletes.coach_id, admin_claims). Les triggers ne regardent que
-- les ÉCRITURES qui FONT ENTRER dans l'état interdit : une ligne existante n'est ni modifiée ni
-- bloquée tant qu'on ne change pas la colonne qui la rattache.
--
-- Contenu :
--   1. ecole_ouverte_aux_coachs(uuid) — LA fonction de contrôle (vrai si l'école est NULL,
--      SECONDAIRE ou LIGUE_CIVILE) ;
--   2. porte_coach_cegep() — fonction de trigger unique, branchée sur 6 tables (BEFORE) :
--        users           INSERT/UPDATE OF role, school_id        (onboarding, PATCH direct, rôle)
--        school_coaches  INSERT/UPDATE OF school_id, coach_id    (onboarding, insert direct, direction)
--        team_coaches    INSERT/UPDATE OF team_id, coach_id      (rejoindre, onboarding p_team_id)
--        teams           INSERT/UPDATE OF school_id              (création d'équipe par un COACH)
--        admin_claims    INSERT/UPDATE OF school_id, user_id     (réclamation de direction)
--        athletes        INSERT/UPDATE OF coach_id               (création / réclamation d'athlète)
--      Pas de réécriture de policy (piège du lot A : EXECUTE vérifié à l'initialisation).
--      Un trigger s'exécute sans droit EXECUTE de l'appelant ; la fonction est SECURITY DEFINER.
--   3. consume_invitation_token REBASÉE SUR LE CORPS PROD (garde md5) : n'écrit plus le cégep
--      d'une invitation sur un compte COACH. Sans cela, l'inscription d'un coach invité par un
--      recruteur collégial échouerait EN ENTIER (le trigger users l'annulerait dans
--      handle_new_auth_user). L'invitation est consommée, le compte reste sans école.
--   3b. backfill_athletes_on_coach_join REBASÉE SUR LE CORPS PROD (garde md5) : ce trigger
--      (AFTER INSERT OR UPDATE sur users, tout compte COACH avec école) donne au coach tous les
--      athlètes SANS coach de son école à CHAQUE mise à jour de son profil. Pour un coach déjà
--      rattaché à un cégep (0 en prod), c'est une réclamation automatique d'athlètes de cégep :
--      la garde des athletes la refuserait et ferait échouer la sauvegarde du profil. La
--      fonction saute désormais une école fermée aux coachs.
--   4. liste_attente_gestion_collegiale + inscrire_liste_attente_collegiale(text) : « ce compte
--      veut être averti ». RLS : sa ligne ou l'admin. Écriture par la fonction seulement.
--   5. gate d'ACL en LISTE COMPLÈTE TRIÉE ; policies existantes inchangées (md5).
--
-- Message d'erreur (repris tel quel à l'écran au lot B4) :
--   NEXUS_COACH_CEGEP: Un compte coach ne peut pas être rattaché à un cégep. La gestion des
--   équipes collégiales arrive bientôt.
--
-- Rollback : supabase/rollback/20261022190000_rollback_cegep_lot_b1_porte_coach.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Gardes et relevé AVANT ──────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.ecole_ouverte_aux_coachs(uuid)') is not null
     or to_regprocedure('public.porte_coach_cegep()') is not null
     or to_regclass('public.liste_attente_gestion_collegiale') is not null then
    raise exception 'NEXUS: 20261022190000 déjà appliquée';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'NEXUS: préalable is_admin() absent';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.consume_invitation_token(text,uuid)'::regprocedure)
     is distinct from '0fb9444467a2754217a4c2f4390debc8' then
    raise exception 'NEXUS: consume_invitation_token n''est pas le corps prod relevé le 2026-10-22';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.backfill_athletes_on_coach_join()'::regprocedure)
     is distinct from '9344f99399ea5d3fa5c24c65da64f743' then
    raise exception 'NEXUS: backfill_athletes_on_coach_join n''est pas le corps prod relevé le 2026-10-22';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_porte_coach_cegep') then
    raise exception 'NEXUS: trigger trg_porte_coach_cegep déjà présent';
  end if;
end $$;

create temp table _b1_acl_avant as
select pr.oid::regprocedure::text as sig, coalesce(array_agg(t.g order by t.g), '{}') as acl
  from pg_proc pr,
       lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                  from unnest(pr.proacl::text[]) as x) t
 where pr.oid in ('public.consume_invitation_token(text,uuid)'::regprocedure,
                  'public.backfill_athletes_on_coach_join()'::regprocedure)
 group by pr.oid;

create temp table _b1_polices_avant as
select tablename, policyname, cmd, permissive, roles::text as roles,
       md5(coalesce(qual, '')) as q, md5(coalesce(with_check, '')) as w
  from pg_policies
 where schemaname = 'public'
   and tablename in ('users', 'school_coaches', 'team_coaches', 'teams', 'admin_claims', 'athletes', 'invitations');

-- ── 1. La fonction de contrôle ─────────────────────────────────────────────
create function public.ecole_ouverte_aux_coachs(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $function$
  -- Vrai si un compte COACH peut s'y rattacher : pas d'école, une école SECONDAIRE ou un club
  -- LIGUE_CIVILE. Liste blanche : CEGEP — et tout type futur — est fermé.
  -- Un identifiant inconnu rend vrai : la clé étrangère refusera l'écriture elle-même.
  select not exists (
    select 1 from public.schools s
     where s.id = p_school_id
       and s.type::text not in ('SECONDAIRE', 'LIGUE_CIVILE')
  );
$function$;

comment on function public.ecole_ouverte_aux_coachs(uuid) is
  'Lot B1 cégep : vrai si un compte COACH peut se rattacher à cette école (NULL, SECONDAIRE, LIGUE_CIVILE).';

-- ── 2. Le trigger unique ───────────────────────────────────────────────────
create function public.porte_coach_cegep()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  v_compte uuid;
  v_ecole  uuid;
  v_role   public.user_role;
begin
  -- On ne bloque que l'écriture qui FAIT ENTRER dans l'état interdit : une mise à jour qui ne
  -- touche pas la colonne de rattachement laisse passer une ligne existante telle quelle.
  case tg_table_name
    when 'users' then
      if tg_op = 'UPDATE' and old.role is not distinct from new.role
         and old.school_id is not distinct from new.school_id then
        return new;
      end if;
      v_compte := new.id;
      v_ecole  := new.school_id;
      v_role   := new.role;
    when 'school_coaches' then
      if tg_op = 'UPDATE' and old.coach_id is not distinct from new.coach_id
         and old.school_id is not distinct from new.school_id then
        return new;
      end if;
      v_compte := new.coach_id;
      v_ecole  := new.school_id;
    when 'team_coaches' then
      if tg_op = 'UPDATE' and old.coach_id is not distinct from new.coach_id
         and old.team_id is not distinct from new.team_id then
        return new;
      end if;
      v_compte := new.coach_id;
      select t.school_id into v_ecole from public.teams t where t.id = new.team_id;
    when 'teams' then
      if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id then
        return new;
      end if;
      -- Une équipe n'a pas de propriétaire : c'est l'APPELANT qui compte. Import RSEQ, service,
      -- admin et recruteur collégial ne sont pas des COACH.
      v_compte := auth.uid();
      v_ecole  := new.school_id;
    when 'admin_claims' then
      if tg_op = 'UPDATE' and old.user_id is not distinct from new.user_id
         and old.school_id is not distinct from new.school_id then
        return new;
      end if;
      v_compte := new.user_id;
      v_ecole  := new.school_id;
    when 'athletes' then
      -- Seul le geste du coach compte (création avec coach, réclamation, réassignation). Un
      -- changement d'école d'ancrage qui garde son coach n'est pas visé ici (nettoyage de l'été).
      if tg_op = 'UPDATE' and old.coach_id is not distinct from new.coach_id then
        return new;
      end if;
      v_compte := new.coach_id;
      v_ecole  := new.school_id;
    else
      raise exception 'NEXUS: porte_coach_cegep branchée sur une table inattendue (%)', tg_table_name;
  end case;

  if v_compte is null or v_ecole is null then
    return new;
  end if;
  if v_role is null then
    select u.role into v_role from public.users u where u.id = v_compte;
  end if;
  if v_role is distinct from 'COACH'::public.user_role then
    return new;
  end if;
  if public.ecole_ouverte_aux_coachs(v_ecole) then
    return new;
  end if;

  raise exception 'NEXUS_COACH_CEGEP: Un compte coach ne peut pas être rattaché à un cégep. La gestion des équipes collégiales arrive bientôt.'
    using errcode = 'P0001',
          detail  = format('table %s, opération %s', tg_table_name, tg_op),
          hint    = 'liste_attente_gestion_collegiale';
end;
$function$;

comment on function public.porte_coach_cegep() is
  'Lot B1 cégep : refuse toute écriture qui rattache un compte COACH à une école hors SECONDAIRE / LIGUE_CIVILE.';

create trigger trg_porte_coach_cegep
  before insert or update of role, school_id on public.users
  for each row when (new.role = 'COACH'::public.user_role and new.school_id is not null)
  execute function public.porte_coach_cegep();

create trigger trg_porte_coach_cegep
  before insert or update of school_id, coach_id on public.school_coaches
  for each row execute function public.porte_coach_cegep();

create trigger trg_porte_coach_cegep
  before insert or update of team_id, coach_id on public.team_coaches
  for each row execute function public.porte_coach_cegep();

create trigger trg_porte_coach_cegep
  before insert or update of school_id on public.teams
  for each row when (new.school_id is not null)
  execute function public.porte_coach_cegep();

create trigger trg_porte_coach_cegep
  before insert or update of school_id, user_id on public.admin_claims
  for each row execute function public.porte_coach_cegep();

create trigger trg_porte_coach_cegep
  before insert or update of coach_id on public.athletes
  for each row when (new.coach_id is not null and new.school_id is not null)
  execute function public.porte_coach_cegep();

-- ── 3. consume_invitation_token : corps prod + une condition ───────────────
CREATE OR REPLACE FUNCTION public.consume_invitation_token(p_token text, p_new_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation_id uuid;
  v_school_id uuid;
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NOT NULL AND v_caller != p_new_user_id THEN
    RAISE EXCEPTION 'consume_invitation_token: cannot consume for another user';
  END IF;

  UPDATE public.invitations
  SET
    status = 'CONSUMED',
    consumed_by_user_id = p_new_user_id,
    consumed_at = now()
  WHERE token = p_token
    AND status = 'PENDING'
    AND expires_at > now()
  RETURNING id, school_id INTO v_invitation_id, v_school_id;

  -- Lot B1 cégep : l'école d'une invitation n'est jamais posée sur un compte COACH si elle lui
  -- est fermée (cégep). L'invitation reste consommée ; le compte poursuit sans école.
  IF v_school_id IS NOT NULL
     AND (public.ecole_ouverte_aux_coachs(v_school_id)
          OR (SELECT u.role FROM public.users u WHERE u.id = p_new_user_id)
             IS DISTINCT FROM 'COACH'::public.user_role) THEN
    UPDATE public.users
    SET school_id = v_school_id
    WHERE id = p_new_user_id;
  END IF;

  RETURN v_invitation_id;
END;
$function$;

-- ── 3b. backfill_athletes_on_coach_join : corps prod + une garde ───────────
CREATE OR REPLACE FUNCTION public.backfill_athletes_on_coach_join()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Lot B1 cégep : pas de réclamation automatique dans une école fermée aux coachs (cégep).
  IF NOT public.ecole_ouverte_aux_coachs(NEW.school_id) THEN
    RETURN NEW;
  END IF;
  UPDATE athletes
  SET coach_id = NEW.id
  WHERE school_id = NEW.school_id AND coach_id IS NULL;
  RETURN NEW;
END;
$function$;

-- ── 4. Liste d'attente ─────────────────────────────────────────────────────
create table public.liste_attente_gestion_collegiale (
  user_id uuid primary key references public.users(id) on delete cascade,
  cree_le timestamptz not null default now(),
  source  text not null check (source ~ '^[a-z][a-z0-9_]{1,39}$')
);

comment on table public.liste_attente_gestion_collegiale is
  'Lot B1 cégep : comptes qui veulent être avertis quand la gestion des équipes collégiales ouvrira. Une ligne par compte, lue par l''admin.';

alter table public.liste_attente_gestion_collegiale enable row level security;

revoke all on table public.liste_attente_gestion_collegiale from public, anon, authenticated;
grant select on table public.liste_attente_gestion_collegiale to authenticated;

create policy "liste attente : sa ligne ou admin"
  on public.liste_attente_gestion_collegiale
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create function public.inscrire_liste_attente_collegiale(p_source text default 'bouton_m_avertir')
returns boolean
language plpgsql
volatile
security definer
set search_path = public
set row_security = off
as $function$
declare
  v_uid  uuid := auth.uid();
  v_role public.user_role;
  v_n    integer;
begin
  -- Rend vrai si la ligne vient d'être créée, faux si le compte était déjà inscrit (idempotent).
  if v_uid is null then
    raise exception 'NEXUS: aucun utilisateur authentifié' using errcode = '28000';
  end if;
  select u.role into v_role from public.users u where u.id = v_uid;
  if v_role is distinct from 'COACH'::public.user_role and v_role is distinct from 'RECRUTEUR'::public.user_role then
    raise exception 'NEXUS: la liste d''attente est réservée aux coachs et aux recruteurs collégiaux'
      using errcode = '42501';
  end if;
  if p_source is null or p_source !~ '^[a-z][a-z0-9_]{1,39}$' then
    raise exception 'NEXUS: source invalide' using errcode = '22023';
  end if;

  insert into public.liste_attente_gestion_collegiale (user_id, source)
  values (v_uid, p_source)
  on conflict (user_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$function$;

comment on function public.inscrire_liste_attente_collegiale(text) is
  'Lot B1 cégep : inscrit l''appelant (COACH ou RECRUTEUR) à la liste d''attente de la gestion collégiale. Idempotent.';

-- ── 5. ACL des nouvelles fonctions (les default privileges ont donné anon) ──
revoke all on function public.ecole_ouverte_aux_coachs(uuid) from public, anon;
grant execute on function public.ecole_ouverte_aux_coachs(uuid) to authenticated, service_role;
revoke all on function public.porte_coach_cegep() from public, anon, authenticated;
grant execute on function public.porte_coach_cegep() to service_role;
revoke all on function public.inscrire_liste_attente_collegiale(text) from public, anon;
grant execute on function public.inscrire_liste_attente_collegiale(text) to authenticated, service_role;

-- ── 6. Gates ───────────────────────────────────────────────────────────────
do $$
declare
  vus  text[];
  veut text[];
  r    record;
  n    int;
begin
  -- Fonctions rebasées : ACL identique au relevé AVANT, liste complète.
  for r in select * from _b1_acl_avant loop
    select coalesce(array_agg(t.g order by t.g), '{}') into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.acl then
      raise exception 'NEXUS: ACL de % = %, attendu % (relevé avant)', r.sig, vus, r.acl;
    end if;
  end loop;
  select count(*) into n from _b1_acl_avant;
  if n <> 2 then raise exception 'NEXUS: relevé d''ACL incomplet (% sur 2)', n; end if;

  -- Nouvelles fonctions : liste complète triée.
  for r in select * from (values
      ('public.ecole_ouverte_aux_coachs(uuid)',             array['authenticated', 'postgres', 'service_role']),
      ('public.porte_coach_cegep()',                        array['postgres', 'service_role']),
      ('public.inscrire_liste_attente_collegiale(text)',    array['authenticated', 'postgres', 'service_role'])
    ) as t(sig, acl) loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    select array_agg(x order by x) into veut from unnest(r.acl) x;
    if vus is distinct from veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.sig, vus, veut; end if;
  end loop;

  -- Réglages des fonctions.
  select count(*) into n from pg_proc pr
   where pr.oid in ('public.ecole_ouverte_aux_coachs(uuid)'::regprocedure, 'public.porte_coach_cegep()'::regprocedure,
                    'public.inscrire_liste_attente_collegiale(text)'::regprocedure)
     and pr.prosecdef and pr.proconfig @> array['search_path=public', 'row_security=off'];
  if n <> 3 then raise exception 'NEXUS: fonctions mal réglées (% sur 3)', n; end if;

  -- Table : droits complets par rôle (liste complète, jamais par inclusion).
  select array_agg(g order by g) into vus from (
    select distinct grantee || ':' || privilege_type as g
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'liste_attente_gestion_collegiale'
       and grantee in ('PUBLIC', 'anon', 'authenticated')) z;
  if vus is distinct from array['authenticated:SELECT'] then
    raise exception 'NEXUS: droits sur liste_attente_gestion_collegiale = %, attendu {authenticated:SELECT}', vus;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.liste_attente_gestion_collegiale'::regclass) then
    raise exception 'NEXUS: RLS inactive sur liste_attente_gestion_collegiale';
  end if;

  -- Triggers : exactement 6, sur les 6 tables prévues.
  select array_agg(c.relname::text order by c.relname) into vus
    from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
   where tg.tgname = 'trg_porte_coach_cegep' and not tg.tgisinternal;
  if vus is distinct from array['admin_claims', 'athletes', 'school_coaches', 'team_coaches', 'teams', 'users'] then
    raise exception 'NEXUS: triggers trg_porte_coach_cegep = %', vus;
  end if;

  -- Policies existantes : aucune n'a bougé, une seule de plus (la liste d'attente).
  select count(*) into n
    from _b1_polices_avant a
    left join pg_policies p on p.schemaname = 'public' and p.tablename = a.tablename and p.policyname = a.policyname
   where p.policyname is null or p.cmd <> a.cmd or p.permissive <> a.permissive or p.roles::text <> a.roles
      or md5(coalesce(p.qual, '')) <> a.q or md5(coalesce(p.with_check, '')) <> a.w;
  if n <> 0 then raise exception 'NEXUS: % policy(ies) existante(s) modifiée(s)', n; end if;
  select count(*) into n from pg_policies p
   where p.schemaname = 'public'
     and p.tablename in ('users', 'school_coaches', 'team_coaches', 'teams', 'admin_claims', 'athletes', 'invitations')
     and not exists (select 1 from _b1_polices_avant a where a.tablename = p.tablename and a.policyname = p.policyname);
  if n <> 0 then raise exception 'NEXUS: % policy(ies) nouvelle(s) sur les tables existantes', n; end if;

  -- Dormance : combien de comptes COACH sont DÉJÀ rattachés à une école fermée (informatif).
  select count(*) into n from public.users u
   where u.role = 'COACH' and u.school_id is not null and not public.ecole_ouverte_aux_coachs(u.school_id);
  raise notice 'NEXUS lot B1 : % compte(s) COACH déjà rattaché(s) à une école fermée aux coachs.', n;
end $$;

drop table _b1_acl_avant, _b1_polices_avant;
