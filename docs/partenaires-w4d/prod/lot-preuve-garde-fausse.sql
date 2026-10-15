-- LOT PROD W4d — généré par docs/partenaires-w4d/prod/construire-lot.mjs — VARIANTE DE PREUVE (empreinte fausse)
-- Fichier : supabase/migrations/20261015110727_w4d_partenaires_terminees_mes_athletes.sql — md5 51c4153ddaeadd43b6792c232f9130d3
-- Empreinte attendue des objets : 00000000000000000000000000000000
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _w4d_releve as
select txid_current() as txid,
       (select count(*) from public.partenaire_prospects) || '|' || (select count(*) from public.partenaire_prospects_issues)
       || '|' || (select count(*) from public.partenaire_prospects_rapprochements) || '|' || (select count(*) from public.partner_evaluations)
       || '|' || (select count(*) from public.partner_athlete_badges where retire_le is null) as donnees,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261015110727') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _w4d_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _w4d_releve) <> 0 then
    raise exception 'NEXUS LOT: W4d déjà présente — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT 20261015110727_w4d_partenaires_terminees_mes_athletes.sql =====
-- W4d — Partenaires : « Terminées » nommées quand c'est permis, « Mes athlètes », compteur admin
-- (base seulement). Demande BP du 2026-10-15.
--
--  · partenaire_prospects_terminees() : les issues du partenaire. Pour une carte RÉCLAMÉE (non
--    annulée), le prénom, le nom, le sport, la position, l'école et le résumé du transfert
--    (évaluation, badges transférés / sautés avec la raison) — SEULEMENT si l'athlète lui est
--    encore visible (fiche ACTIVE et is_partner_eligible_athlete) et que le partenaire est admis.
--    Sinon « réclamée — profil non visible » : ni nom, ni identifiant. Les autres issues restent
--    sans nom.
--  · partenaire_prospects_mes_issues() : même signature, même ACL ; l'identifiant de l'athlète
--    d'une carte réclamée n'est plus rendu s'il ne lui est plus visible (le bouton « Voir sa
--    fiche » de W4b ne pointe plus vers un jeune qui s'est retiré).
--  · partenaire_mes_athletes() : les athlètes que le partenaire a évalués ou badgés (badge non
--    retiré), seulement s'ils lui sont encore visibles. Un jeune qui retire sa visibilité sort de
--    la liste ; rien n'est effacé (W2).
--  · admin_prospects_candidats_en_attente() : le compteur du menu admin (candidats non décidés).
-- Aucune table nouvelle, aucun droit direct ; tout passe par ces fonctions.

do $$
begin
  if to_regprocedure('public.partenaire_prospects_terminees()') is not null
     or to_regprocedure('public.partenaire_mes_athletes()') is not null then
    raise exception 'NEXUS: W4d déjà appliquée';
  end if;
  -- La fonction redéfinie doit être EXACTEMENT celle de W4a (relevée en prod le 2026-10-15).
  if (select md5(prosrc) from pg_proc where oid = 'public.partenaire_prospects_mes_issues()'::regprocedure)
     is distinct from 'e511cd02c3c80f21809dff1f4ec87bcc' then
    raise exception 'NEXUS: partenaire_prospects_mes_issues ne correspond pas au relevé — ne pas écraser une version inconnue';
  end if;
end $$;

-- ── Visible du partenaire : une seule règle pour les trois vues ──────────────

create function public.partenaire_voit_athlete(p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    public.partenaire_admis()
    and exists (select 1 from public.athletes a where a.id = p_athlete and a.status = 'ACTIF'::public.account_status)
    and public.is_partner_eligible_athlete(p_athlete),
    false)
$$;

-- ── « Terminées » ────────────────────────────────────────────────────────────

create function public.partenaire_prospects_terminees()
returns table (
  carte_id uuid, issue text, carte_creee_le timestamptz, terminee_le timestamptz,
  profil_visible boolean, athlete_id uuid, prenom text, nom text, sport text, poste text, ecole text,
  evaluation text, badges jsonb)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select i.carte_id, i.issue, i.carte_creee_le, i.terminee_le,
         v.visible,
         case when v.visible then a.id end,
         case when v.visible then a.first_name end,
         case when v.visible then a.last_name end,
         case when v.visible then s.nom end,
         case when v.visible then po.nom end,
         case when v.visible then sc.name end,
         case when v.visible then i.transfert->>'evaluation' end,
         case when v.visible then coalesce((
           select jsonb_agg(jsonb_build_object(
                    'libelle', coalesce(pb.libelle, b.libelle),
                    'nexus', e ? 'badge_nexus',
                    'transfere', e->>'attribution' is not null,
                    'raison', e->>'raison') order by ord)
             from jsonb_array_elements(coalesce(i.transfert->'badges', '[]'::jsonb)) with ordinality as x(e, ord)
             left join public.partner_badges pb on pb.id = (e->>'badge_partenaire')::uuid
             left join public.badges b on b.id = (e->>'badge_nexus')::uuid), '[]'::jsonb) end
    from public.partenaire_prospects_issues i
    join public.media_partners mp on mp.id = i.partner_id
    left join public.athletes a
           on a.id = i.athlete_id and i.issue = 'RECLAMEE' and i.annulee_le is null
    left join public.sports s on s.id = a.sport_id
    left join public.positions po on po.id = a.position_id
    left join public.schools sc on sc.id = a.school_id
    cross join lateral (select a.id is not null and public.partenaire_voit_athlete(a.id) as visible) v
   where mp.user_id = auth.uid()
   order by i.terminee_le desc
$$;

-- W4a, même signature (ACL conservée) : l'athlète d'une réclamation seulement s'il est encore visible.
create or replace function public.partenaire_prospects_mes_issues()
returns table (carte_id uuid, issue text, athlete_id uuid, carte_creee_le timestamptz, terminee_le timestamptz)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select i.carte_id, i.issue,
         case when i.issue = 'RECLAMEE' and i.annulee_le is null
                   and public.partenaire_voit_athlete(i.athlete_id) then i.athlete_id end,
         i.carte_creee_le, i.terminee_le
    from public.partenaire_prospects_issues i
    join public.media_partners mp on mp.id = i.partner_id
   where mp.user_id = auth.uid()
   order by i.terminee_le desc
$$;

-- ── « Mes athlètes » ─────────────────────────────────────────────────────────

create function public.partenaire_mes_athletes()
returns table (
  athlete_id uuid, prenom text, nom text, sport text, ecole text,
  evaluation_id uuid, cote_globale numeric, evaluee_le timestamptz,
  badges jsonb, derniere_action timestamptz)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with mes as (
    select mp.id from public.media_partners mp where mp.user_id = auth.uid()
  ), cibles as (
    select pe.athlete_id from public.partner_evaluations pe where pe.partner_id in (select id from mes)
    union
    select pab.athlete_id from public.partner_athlete_badges pab
     where pab.partner_id in (select id from mes) and pab.retire_le is null
  )
  select a.id, a.first_name, a.last_name, s.nom, sc.name,
         ev.id, ev.cote_globale, ev.updated_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'attribution_id', pab.id,
                    'libelle', coalesce(pb.libelle, b.libelle),
                    'nexus', pab.badge_id is not null,
                    'code', b.code,
                    'icone_path', pb.icone_path,
                    'masque', pab.masque_le is not null,
                    'le', pab.created_at) order by pab.created_at desc)
             from public.partner_athlete_badges pab
             left join public.partner_badges pb on pb.id = pab.partner_badge_id
             left join public.badges b on b.id = pab.badge_id
            where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null), '[]'::jsonb),
         greatest(ev.updated_at,
                  (select max(pab.created_at) from public.partner_athlete_badges pab
                    where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null))
    from cibles c
    join public.athletes a on a.id = c.athlete_id
    left join public.sports s on s.id = a.sport_id
    left join public.schools sc on sc.id = a.school_id
    left join lateral (
      select pe.id, pe.cote_globale, pe.updated_at from public.partner_evaluations pe
       where pe.athlete_id = a.id and pe.partner_id in (select id from mes)
       order by pe.updated_at desc limit 1) ev on true
   where public.partenaire_voit_athlete(a.id)
   order by 10 desc nulls last, a.last_name, a.first_name
$$;

-- ── Compteur du menu admin ───────────────────────────────────────────────────

create function public.admin_prospects_candidats_en_attente()
returns integer
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''administrateur' using errcode = '42501';
  end if;
  return (select count(*)::int from public.prospect_partenaire_candidats(null, null));
end $$;

-- ── Droits ───────────────────────────────────────────────────────────────────

revoke all on function public.partenaire_voit_athlete(uuid) from public, anon, authenticated;
revoke all on function public.partenaire_prospects_terminees() from public, anon, authenticated;
revoke all on function public.partenaire_mes_athletes() from public, anon, authenticated;
revoke all on function public.admin_prospects_candidats_en_attente() from public, anon, authenticated;
grant execute on function public.partenaire_prospects_terminees() to authenticated;
grant execute on function public.partenaire_mes_athletes() to authenticated;
grant execute on function public.admin_prospects_candidats_en_attente() to authenticated;

-- ── Garde finale : ACL comparées EN ENTIER (règle du 2026-09-07) ─────────────

do $$
declare
  r record;
  vus text[];
  veut text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('partenaire_voit_athlete', 'partenaire_prospects_terminees', 'partenaire_mes_athletes',
                                'admin_prospects_candidats_en_attente', 'partenaire_prospects_mes_issues')
  loop
    veut := case when r.proname = 'partenaire_voit_athlete' then array['postgres', 'service_role']
                 else array['authenticated', 'postgres', 'service_role'] end;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.proname, vus, veut;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('partenaire_voit_athlete', 'partenaire_prospects_terminees', 'partenaire_mes_athletes',
                        'admin_prospects_candidats_en_attente', 'partenaire_prospects_mes_issues')) <> 5 then
    raise exception 'NEXUS: 5 fonctions W4d attendues';
  end if;
  raise notice 'NEXUS W4d : Terminées nommées si visibles, Mes athlètes, compteur admin, ACL exactes — OK';
end $$;

-- ===== FIN 20261015110727_w4d_partenaires_terminees_mes_athletes.sql =====

-- 4. Enregistrement de la version (statements = le fichier)
create temp table _w4d_texte as select $W4DMIG$-- W4d — Partenaires : « Terminées » nommées quand c'est permis, « Mes athlètes », compteur admin
-- (base seulement). Demande BP du 2026-10-15.
--
--  · partenaire_prospects_terminees() : les issues du partenaire. Pour une carte RÉCLAMÉE (non
--    annulée), le prénom, le nom, le sport, la position, l'école et le résumé du transfert
--    (évaluation, badges transférés / sautés avec la raison) — SEULEMENT si l'athlète lui est
--    encore visible (fiche ACTIVE et is_partner_eligible_athlete) et que le partenaire est admis.
--    Sinon « réclamée — profil non visible » : ni nom, ni identifiant. Les autres issues restent
--    sans nom.
--  · partenaire_prospects_mes_issues() : même signature, même ACL ; l'identifiant de l'athlète
--    d'une carte réclamée n'est plus rendu s'il ne lui est plus visible (le bouton « Voir sa
--    fiche » de W4b ne pointe plus vers un jeune qui s'est retiré).
--  · partenaire_mes_athletes() : les athlètes que le partenaire a évalués ou badgés (badge non
--    retiré), seulement s'ils lui sont encore visibles. Un jeune qui retire sa visibilité sort de
--    la liste ; rien n'est effacé (W2).
--  · admin_prospects_candidats_en_attente() : le compteur du menu admin (candidats non décidés).
-- Aucune table nouvelle, aucun droit direct ; tout passe par ces fonctions.

do $$
begin
  if to_regprocedure('public.partenaire_prospects_terminees()') is not null
     or to_regprocedure('public.partenaire_mes_athletes()') is not null then
    raise exception 'NEXUS: W4d déjà appliquée';
  end if;
  -- La fonction redéfinie doit être EXACTEMENT celle de W4a (relevée en prod le 2026-10-15).
  if (select md5(prosrc) from pg_proc where oid = 'public.partenaire_prospects_mes_issues()'::regprocedure)
     is distinct from 'e511cd02c3c80f21809dff1f4ec87bcc' then
    raise exception 'NEXUS: partenaire_prospects_mes_issues ne correspond pas au relevé — ne pas écraser une version inconnue';
  end if;
end $$;

-- ── Visible du partenaire : une seule règle pour les trois vues ──────────────

create function public.partenaire_voit_athlete(p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    public.partenaire_admis()
    and exists (select 1 from public.athletes a where a.id = p_athlete and a.status = 'ACTIF'::public.account_status)
    and public.is_partner_eligible_athlete(p_athlete),
    false)
$$;

-- ── « Terminées » ────────────────────────────────────────────────────────────

create function public.partenaire_prospects_terminees()
returns table (
  carte_id uuid, issue text, carte_creee_le timestamptz, terminee_le timestamptz,
  profil_visible boolean, athlete_id uuid, prenom text, nom text, sport text, poste text, ecole text,
  evaluation text, badges jsonb)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select i.carte_id, i.issue, i.carte_creee_le, i.terminee_le,
         v.visible,
         case when v.visible then a.id end,
         case when v.visible then a.first_name end,
         case when v.visible then a.last_name end,
         case when v.visible then s.nom end,
         case when v.visible then po.nom end,
         case when v.visible then sc.name end,
         case when v.visible then i.transfert->>'evaluation' end,
         case when v.visible then coalesce((
           select jsonb_agg(jsonb_build_object(
                    'libelle', coalesce(pb.libelle, b.libelle),
                    'nexus', e ? 'badge_nexus',
                    'transfere', e->>'attribution' is not null,
                    'raison', e->>'raison') order by ord)
             from jsonb_array_elements(coalesce(i.transfert->'badges', '[]'::jsonb)) with ordinality as x(e, ord)
             left join public.partner_badges pb on pb.id = (e->>'badge_partenaire')::uuid
             left join public.badges b on b.id = (e->>'badge_nexus')::uuid), '[]'::jsonb) end
    from public.partenaire_prospects_issues i
    join public.media_partners mp on mp.id = i.partner_id
    left join public.athletes a
           on a.id = i.athlete_id and i.issue = 'RECLAMEE' and i.annulee_le is null
    left join public.sports s on s.id = a.sport_id
    left join public.positions po on po.id = a.position_id
    left join public.schools sc on sc.id = a.school_id
    cross join lateral (select a.id is not null and public.partenaire_voit_athlete(a.id) as visible) v
   where mp.user_id = auth.uid()
   order by i.terminee_le desc
$$;

-- W4a, même signature (ACL conservée) : l'athlète d'une réclamation seulement s'il est encore visible.
create or replace function public.partenaire_prospects_mes_issues()
returns table (carte_id uuid, issue text, athlete_id uuid, carte_creee_le timestamptz, terminee_le timestamptz)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select i.carte_id, i.issue,
         case when i.issue = 'RECLAMEE' and i.annulee_le is null
                   and public.partenaire_voit_athlete(i.athlete_id) then i.athlete_id end,
         i.carte_creee_le, i.terminee_le
    from public.partenaire_prospects_issues i
    join public.media_partners mp on mp.id = i.partner_id
   where mp.user_id = auth.uid()
   order by i.terminee_le desc
$$;

-- ── « Mes athlètes » ─────────────────────────────────────────────────────────

create function public.partenaire_mes_athletes()
returns table (
  athlete_id uuid, prenom text, nom text, sport text, ecole text,
  evaluation_id uuid, cote_globale numeric, evaluee_le timestamptz,
  badges jsonb, derniere_action timestamptz)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with mes as (
    select mp.id from public.media_partners mp where mp.user_id = auth.uid()
  ), cibles as (
    select pe.athlete_id from public.partner_evaluations pe where pe.partner_id in (select id from mes)
    union
    select pab.athlete_id from public.partner_athlete_badges pab
     where pab.partner_id in (select id from mes) and pab.retire_le is null
  )
  select a.id, a.first_name, a.last_name, s.nom, sc.name,
         ev.id, ev.cote_globale, ev.updated_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'attribution_id', pab.id,
                    'libelle', coalesce(pb.libelle, b.libelle),
                    'nexus', pab.badge_id is not null,
                    'code', b.code,
                    'icone_path', pb.icone_path,
                    'masque', pab.masque_le is not null,
                    'le', pab.created_at) order by pab.created_at desc)
             from public.partner_athlete_badges pab
             left join public.partner_badges pb on pb.id = pab.partner_badge_id
             left join public.badges b on b.id = pab.badge_id
            where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null), '[]'::jsonb),
         greatest(ev.updated_at,
                  (select max(pab.created_at) from public.partner_athlete_badges pab
                    where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null))
    from cibles c
    join public.athletes a on a.id = c.athlete_id
    left join public.sports s on s.id = a.sport_id
    left join public.schools sc on sc.id = a.school_id
    left join lateral (
      select pe.id, pe.cote_globale, pe.updated_at from public.partner_evaluations pe
       where pe.athlete_id = a.id and pe.partner_id in (select id from mes)
       order by pe.updated_at desc limit 1) ev on true
   where public.partenaire_voit_athlete(a.id)
   order by 10 desc nulls last, a.last_name, a.first_name
$$;

-- ── Compteur du menu admin ───────────────────────────────────────────────────

create function public.admin_prospects_candidats_en_attente()
returns integer
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''administrateur' using errcode = '42501';
  end if;
  return (select count(*)::int from public.prospect_partenaire_candidats(null, null));
end $$;

-- ── Droits ───────────────────────────────────────────────────────────────────

revoke all on function public.partenaire_voit_athlete(uuid) from public, anon, authenticated;
revoke all on function public.partenaire_prospects_terminees() from public, anon, authenticated;
revoke all on function public.partenaire_mes_athletes() from public, anon, authenticated;
revoke all on function public.admin_prospects_candidats_en_attente() from public, anon, authenticated;
grant execute on function public.partenaire_prospects_terminees() to authenticated;
grant execute on function public.partenaire_mes_athletes() to authenticated;
grant execute on function public.admin_prospects_candidats_en_attente() to authenticated;

-- ── Garde finale : ACL comparées EN ENTIER (règle du 2026-09-07) ─────────────

do $$
declare
  r record;
  vus text[];
  veut text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('partenaire_voit_athlete', 'partenaire_prospects_terminees', 'partenaire_mes_athletes',
                                'admin_prospects_candidats_en_attente', 'partenaire_prospects_mes_issues')
  loop
    veut := case when r.proname = 'partenaire_voit_athlete' then array['postgres', 'service_role']
                 else array['authenticated', 'postgres', 'service_role'] end;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.proname, vus, veut;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('partenaire_voit_athlete', 'partenaire_prospects_terminees', 'partenaire_mes_athletes',
                        'admin_prospects_candidats_en_attente', 'partenaire_prospects_mes_issues')) <> 5 then
    raise exception 'NEXUS: 5 fonctions W4d attendues';
  end if;
  raise notice 'NEXUS W4d : Terminées nommées si visibles, Mes athlètes, compteur admin, ACL exactes — OK';
end $$;
$W4DMIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _w4d_texte' using '20261015110727', 'w4d_partenaires_terminees_mes_athletes', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _w4d_texte' using '20261015110727', 'w4d_partenaires_terminees_mes_athletes';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _w4d_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261015110727')
     is distinct from '51c4153ddaeadd43b6792c232f9130d3' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  select e.empreinte_objets, e.n_elements into v_empreinte, v_n from (
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || p.prosrc
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('partenaire_voit_athlete', 'partenaire_prospects_terminees', 'partenaire_mes_athletes',
                       'admin_prospects_candidats_en_attente', 'partenaire_prospects_mes_issues')
) t
  ) e;
  if v_empreinte is distinct from '00000000000000000000000000000000' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if (select count(*) from public.partenaire_prospects) || '|' || (select count(*) from public.partenaire_prospects_issues)
       || '|' || (select count(*) from public.partenaire_prospects_rapprochements) || '|' || (select count(*) from public.partner_evaluations)
       || '|' || (select count(*) from public.partner_athlete_badges where retire_le is null) <> (select donnees from _w4d_releve) then
    raise exception 'NEXUS LOT: une donnée partenaire a changé — tout est annulé';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, version_deja, derniere_version, pg from _w4d_releve) r),
  'apres', json_build_object(
     'donnees', (select count(*) from public.partenaire_prospects) || '|' || (select count(*) from public.partenaire_prospects_issues)
       || '|' || (select count(*) from public.partenaire_prospects_rapprochements) || '|' || (select count(*) from public.partner_evaluations)
       || '|' || (select count(*) from public.partner_athlete_badges where retire_le is null),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261015110727'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261015110727'),
     'fonctions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
                    and proname in ('partenaire_voit_athlete', 'partenaire_prospects_terminees', 'partenaire_mes_athletes',
                                    'admin_prospects_candidats_en_attente', 'partenaire_prospects_mes_issues')),
     'meme_transaction', (select txid from _w4d_releve) = txid_current())
) as resultat_lot_w4d;
