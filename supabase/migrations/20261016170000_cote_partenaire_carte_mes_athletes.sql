-- Cote partenaire sur la carte du joueur + filtres de « Mes athlètes » (demande BP du 2026-10-16).
--
--  · cotes_partenaires_athletes(uuid[]) : les évaluations partenaires d'un LOT d'athlètes, pour les
--    cartes (favoris, fiche, aperçu). AUCUNE règle nouvelle : la fonction est SECURITY INVOKER et
--    appelle, athlète par athlète, evaluations_partenaires_athlete() (W2), qui arbitre déjà qui lit
--    quoi. Elle ne rend que ce que l'appelant obtiendrait déjà en l'appelant lui-même une fois par
--    athlète — moins les critères, dont une carte n'a pas besoin. Pas de nouvel accès.
--  · partenaire_mes_athletes() : DROP + CREATE (le RETURNS TABLE change). Deux colonnes à la fin,
--    poste et poste_abr (la position, pour la recherche) ; dans chaque badge, badge_ref (l'identifiant
--    du badge du catalogue — badges.id pour un badge Nexus, partner_badges.id pour un badge propre —
--    pour le filtre « Distinctions »). Corps IDENTIQUE à W4d sinon ; même règle de visibilité
--    (partenaire_voit_athlete). L'ACL est reposée et comparée EN ENTIER (règle du 2026-09-07).

do $$
begin
  if to_regprocedure('public.cotes_partenaires_athletes(uuid[])') is not null then
    raise exception 'NEXUS: cotes_partenaires_athletes existe déjà — lot déjà appliqué ?';
  end if;
  -- Les fonctions dont on dépend ou qu'on remplace doivent être EXACTEMENT celles relevées
  -- (local = prod, relevé du 2026-10-16).
  if (select md5(prosrc) from pg_proc where oid = 'public.partenaire_mes_athletes()'::regprocedure)
     is distinct from '71a92e788d13bc85ee8d9d9baa675e30' then
    raise exception 'NEXUS: partenaire_mes_athletes ne correspond pas au relevé — ne pas écraser une version inconnue';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.evaluations_partenaires_athlete(uuid)'::regprocedure)
     is distinct from '33d0544f27a8b62fa9e21902f2e62310' then
    raise exception 'NEXUS: evaluations_partenaires_athlete ne correspond pas au relevé — la règle de lecture a changé';
  end if;
end $$;

-- ── 1. Cotes partenaires d'un lot d'athlètes ─────────────────────────────────
create function public.cotes_partenaires_athletes(p_athlete_ids uuid[])
returns table (id uuid, athlete_id uuid, organisation text, cote_globale numeric, updated_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, i.athlete_id, e.organisation, e.cote_globale, e.updated_at
    from (select distinct x as athlete_id from unnest(coalesce(p_athlete_ids, '{}'::uuid[])) as x where x is not null) i
    cross join lateral public.evaluations_partenaires_athlete(i.athlete_id) e
$$;

comment on function public.cotes_partenaires_athletes(uuid[]) is
  'Cartes : évaluations partenaires (organisation, cote, date) d''un lot d''athlètes. INVOKER : délègue à evaluations_partenaires_athlete(), aucune règle propre.';

revoke all on function public.cotes_partenaires_athletes(uuid[]) from public, anon, authenticated;
grant execute on function public.cotes_partenaires_athletes(uuid[]) to authenticated, service_role;

-- ── 2. « Mes athlètes » : la position et la référence des badges ─────────────
drop function public.partenaire_mes_athletes();

create function public.partenaire_mes_athletes()
returns table (
  athlete_id uuid, prenom text, nom text, sport text, ecole text,
  evaluation_id uuid, cote_globale numeric, evaluee_le timestamptz,
  badges jsonb, derniere_action timestamptz,
  poste text, poste_abr text)
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
                    'badge_ref', coalesce(pab.badge_id, pab.partner_badge_id),
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
                    where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null)),
         po.nom, po.abreviation
    from cibles c
    join public.athletes a on a.id = c.athlete_id
    left join public.sports s on s.id = a.sport_id
    left join public.schools sc on sc.id = a.school_id
    left join public.positions po on po.id = a.position_id
    left join lateral (
      select pe.id, pe.cote_globale, pe.updated_at from public.partner_evaluations pe
       where pe.athlete_id = a.id and pe.partner_id in (select id from mes)
       order by pe.updated_at desc limit 1) ev on true
   where public.partenaire_voit_athlete(a.id)
   order by 10 desc nulls last, a.last_name, a.first_name
$$;

comment on function public.partenaire_mes_athletes() is
  'W4d + filtres (2026-10-16) : athlètes évalués ou badgés par le partenaire appelant, s''ils lui sont encore visibles. poste/poste_abr et badges[].badge_ref pour la recherche et le filtre Distinctions.';

revoke all on function public.partenaire_mes_athletes() from public, anon, authenticated;
grant execute on function public.partenaire_mes_athletes() to authenticated, service_role;

-- ── Gardes : ACL comparées EN ENTIER, signatures uniques ──────────────────────
do $$
declare
  f    regprocedure;
  vus  text[];
  veut text[] := array['authenticated', 'postgres', 'service_role'];
begin
  foreach f in array array[
    'public.cotes_partenaires_athletes(uuid[])'::regprocedure,
    'public.partenaire_mes_athletes()'::regprocedure]
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut;
    end if;
  end loop;
  if (select prosecdef from pg_proc where oid = 'public.cotes_partenaires_athletes(uuid[])'::regprocedure) then
    raise exception 'NEXUS: cotes_partenaires_athletes doit rester SECURITY INVOKER';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes')) <> 2 then
    raise exception 'NEXUS: surcharge inattendue';
  end if;
  raise notice 'NEXUS cote partenaire / Mes athlètes : fonctions et ACL exactes — OK';
end $$;
