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
