-- ════════════════════════════════════════════════════════════════════════════
-- Lot T (écriture de teams réservée aux coachs) — REJEU À BLANC (finit par ROLLBACK), version 20261028080000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> t (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → balayage AVANT (chaque compte réel rattaché à une école : peut-il créer, modifier,
-- supprimer une équipe de son école ?) → migration → balayage APRÈS, comparé → rollback T joué et vérifié → ROLLBACK. Chaque geste est
-- défait aussitôt (NX000). Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '600s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-lot-t';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028080000') then
    raise exception 'NEXUS: version 20261028080000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028080000' then raise exception 'NEXUS: version 20261028080000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_LOT_T_TEAMS_ECRITURE', 'ROLLBACK_LOT_T_TEAMS_ECRITURE')) then
    raise exception 'NEXUS: le lot T a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028070000') then
    raise exception 'NEXUS: préalable D5a absent';
  end if;
end $$;

-- ── Comptes réels rattachés à une école qui a au moins une équipe ────────────
create temp table _c on commit drop as
select u.id as uid, u.role::text as role,
       case when u.role = 'ATHLETE'::public.user_role then (select a.school_id from public.athletes a where a.user_id = u.id limit 1)
            else u.school_id end as ecole
  from public.users u;
delete from _c where ecole is null or not exists (select 1 from public.teams t where t.school_id = _c.ecole);
-- L'admin n'a pas d'école : on le teste sur la première école qui a des équipes (ses droits réels, avant / après).
insert into _c (uid, role, ecole)
select u.id, 'ADMIN', (select t.school_id from public.teams t join public.schools s on s.id = t.school_id
                        where s.type <> 'UNIVERSITE' order by t.school_id limit 1)
  from public.users u where u.role = 'ADMIN'::public.user_role and not exists (select 1 from _c where _c.uid = u.id);
alter table _c add column sport uuid;
update _c set sport = (select t.sport_id from public.teams t where t.school_id = _c.ecole order by t.id limit 1);
select role, count(*) as comptes_avec_ecole from _c group by role order by role;

-- Un geste : 'créer' (une équipe à son école), 'modifier' (toutes les équipes de son école, sans rien changer),
-- 'supprimer' (une équipe jetable créée en postgres pour l'essai). Rend 'oui' ou 'non'.
create function pg_temp.geste(p_uid uuid, p_quoi text) returns text language plpgsql as $$
declare v text; n int; c record; v_neuve uuid;
begin
  select * into c from _c where uid = p_uid;
  begin
    insert into public.teams (school_id, sport_id, name) values (c.ecole, c.sport, 'Lot T essai jetable') returning id into v_neuve;
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      if p_quoi = 'créer' then
        insert into public.teams (school_id, sport_id, name) values (c.ecole, c.sport, 'Lot T essai');
        v := 'oui';
      elsif p_quoi = 'modifier' then
        update public.teams set name = name where school_id = c.ecole and id <> v_neuve;
        get diagnostics n = row_count; v := case when n > 0 then 'oui' else 'non' end;
      elsif p_quoi = 'supprimer' then
        delete from public.teams where id = v_neuve;
        get diagnostics n = row_count; v := case when n > 0 then 'oui' else 'non' end;
      end if;
    exception when insufficient_privilege or check_violation or with_check_option_violation or raise_exception then
      v := 'non';
    end;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create function pg_temp.balayage() returns table (uid uuid, creer text, modifier text, supprimer text) language sql as $$
  select c.uid, pg_temp.geste(c.uid, 'créer'), pg_temp.geste(c.uid, 'modifier'), pg_temp.geste(c.uid, 'supprimer') from _c c;
$$;
create temp table _avant on commit drop as select * from pg_temp.balayage();

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _lt on commit drop as
select '20261028080000'::text as version,
       $nexus_mig$-- Lot T — écriture de teams réservée aux coachs (constat BP 2026-10-28, essai prod du même jour).
-- Les policies « Coaches create / update / delete teams » ne testent que school_id = current_user_school_id(), TO
-- public, sans rôle : un athlète (son école de fiche), un recruteur collégial (son cégep) ou tout autre compte
-- rattaché à une école peut créer, modifier ou supprimer les équipes de cette école.
-- Correctif : trois policies RESTRICTIVES (une par commande) qui exigent un compte COACH ou ADMIN. Les policies
-- permissives existantes ne bougent pas : un coach garde exactement ses droits, l'admin aussi (il n'a aucune
-- policy d'écriture permissive sur teams ; il passe par la clé service ou les RPC admin). Les fonctions SECURITY
-- DEFINER (inscription coach, RSEQ, nettoyage) et la clé service ne sont pas concernées par la RLS.
-- Écrivains légitimes dans le code : lib/queries/coach/createTeam.ts, app/coach/equipes/[teamId], onboarding du coach
-- civil, CoachEquipeDetailMobile — tous en compte COACH.

do $garde$
begin
  if md5(pg_get_functiondef('public.is_coach()'::regprocedure)) <> '8161151d6ad303c86962e31c1122f6d5' then
    raise exception 'NEXUS: lot T — is_coach() a changé depuis le relevé ; régénérer';
  end if;
end $garde$;

create policy teams_ecriture_coachs_insert on public.teams as restrictive for insert to public
  with check ((select public.is_coach()) or (select public.is_admin()));
create policy teams_ecriture_coachs_update on public.teams as restrictive for update to public
  using ((select public.is_coach()) or (select public.is_admin()))
  with check ((select public.is_coach()) or (select public.is_admin()));
create policy teams_ecriture_coachs_delete on public.teams as restrictive for delete to public
  using ((select public.is_coach()) or (select public.is_admin()));
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback du lot T : retire les trois policies restrictives d'écriture de teams (retour aux seules policies
-- « Coaches create / update / delete teams »).
drop policy teams_ecriture_coachs_insert on public.teams;
drop policy teams_ecriture_coachs_update on public.teams;
drop policy teams_ecriture_coachs_delete on public.teams;
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _lt) <> 'a407f0a53fe0c0d0e176cca7d9eab530' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _lt);
  end if;
  if (select md5(rollback) from _lt) <> '2b79ccb3f2395de50b3a1c0fb9bb6d58' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _lt);
  end if;
  execute (select contenu from _lt);
end $apply$;
set local search_path = public, extensions;

create temp table _apres on commit drop as select * from pg_temp.balayage();

-- ── Comparaison par rôle (nombre de comptes qui peuvent, avant → après) ──────
create temp table _r on commit drop as
select c.role, count(*) as comptes,
       count(*) filter (where a.creer = 'oui') as creer_avant,      count(*) filter (where p.creer = 'oui') as creer_apres,
       count(*) filter (where a.modifier = 'oui') as modifier_avant, count(*) filter (where p.modifier = 'oui') as modifier_apres,
       count(*) filter (where a.supprimer = 'oui') as supprimer_avant, count(*) filter (where p.supprimer = 'oui') as supprimer_apres,
       count(*) filter (where (a.creer, a.modifier, a.supprimer) is distinct from (p.creer, p.modifier, p.supprimer)) as comptes_changes
  from _c c join _avant a using (uid) join _apres p using (uid)
 group by c.role;
select * from _r order by role;

do $$
begin
  if exists (select 1 from _avant where creer like 'ERREUR%' or modifier like 'ERREUR%' or supprimer like 'ERREUR%')
     or exists (select 1 from _apres where creer like 'ERREUR%' or modifier like 'ERREUR%' or supprimer like 'ERREUR%') then
    raise exception 'NEXUS: un geste a échoué : %', (select coalesce(a.creer, '') || ' / ' || coalesce(a.modifier, '') || ' / ' || coalesce(a.supprimer, '')
      from _apres a where creer like 'ERREUR%' or modifier like 'ERREUR%' or supprimer like 'ERREUR%' limit 1);
  end if;
  if exists (select 1 from _c c join _avant a using (uid) join _apres p using (uid)
              where c.role in ('COACH', 'ADMIN') and (a.creer, a.modifier, a.supprimer) is distinct from (p.creer, p.modifier, p.supprimer)) then
    raise exception 'NEXUS: un coach ou un admin a perdu ou gagné un droit sur teams';
  end if;
  if exists (select 1 from _c c join _apres p using (uid)
              where c.role not in ('COACH', 'ADMIN') and 'oui' in (p.creer, p.modifier, p.supprimer)) then
    raise exception 'NEXUS: un compte non coach écrit encore dans teams';
  end if;
  raise notice 'NEXUS: VERDICT lot T — teams : seuls coachs et admins écrivent ; leurs droits réels sont identiques';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

do $rb$ begin execute (select rollback from _lt); end $rb$;
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname like 'teams_ecriture_coachs_%') then
    raise exception 'NEXUS: après rollback, une policy du lot T reste sur teams';
  end if;
  raise notice 'NEXUS: rollback lot T vérifié (policies retirées)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
