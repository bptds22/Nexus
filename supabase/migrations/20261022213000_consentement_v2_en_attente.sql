-- ════════════════════════════════════════════════════════════════════════════
-- admin_consentement_partenaire_stats() : « en attente » et « jamais demandé »
-- (décision BP, 2026-10-22 — QG admin, lot 1)
--
-- Constat : l'écran mural affichait « en attente » = demande_parent + pas_repondu,
-- soit 167 en prod le 2026-10-22, alors que BP en compte 3. pas_repondu mêle
-- deux groupes : ceux à qui la question a été posée (une ligne existe dans
-- consentement_partenaire_v2 : « plus tard », demande au parent, push) et ceux
-- à qui elle ne l'a jamais été (aucune ligne).
--
-- Ce que fait cette migration — ADDITIVE :
--   · deux clés NOUVELLES dans le jsonb rendu :
--       en_attente     = pas de v2 valide, pas de refus, une ligne v2 existe ;
--       jamais_demande = pas de v2 valide, pas de refus, aucune ligne v2.
--     accepte_v2 + refuse_v2 + en_attente + jamais_demande = total.
--   · AUCUNE clé retirée ni changée : les appels existants lisent la même chose.
--   · CREATE OR REPLACE : même signature, même ACL, même SECURITY DEFINER.
--
-- Corps d'avant relevé en local ET en prod le 2026-10-22 : md5 a8072052…
-- Rollback : supabase/rollback/20261022213000_rollback_consentement_v2_en_attente.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.admin_consentement_partenaire_stats()') is null then
    raise exception 'NEXUS: admin_consentement_partenaire_stats() absente';
  end if;
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc
       where oid = 'public.admin_consentement_partenaire_stats()'::regprocedure)
     is distinct from 'a80720524c23f0beb1b147e36e074389' then
    raise exception 'NEXUS: admin_consentement_partenaire_stats a changé — recopier la version en place avant d''appliquer';
  end if;
  if to_regprocedure('public.consentement_partenaire_v2_valide(uuid)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'NEXUS: consentement_partenaire_v2_valide(uuid) ou is_admin() manque';
  end if;
end $$;

create or replace function public.admin_consentement_partenaire_stats()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''admin';
  end if;
  select jsonb_build_object(
    'total',              count(*),
    'accepte_v2',         count(*) filter (where x.v2),
    'refuse_v2',          count(*) filter (where not x.v2 and x.refuse_le is not null),
    'demande_parent',     count(*) filter (where not x.v2 and x.refuse_le is null and x.demande_parent_le is not null),
    'pas_repondu',        count(*) filter (where not x.v2 and x.refuse_le is null and x.demande_parent_le is null),
    'pas_repondu_v1',     count(*) filter (where not x.v2 and x.refuse_le is null and x.demande_parent_le is null and x.opt_in),
    'plus_tard_epuise',   count(*) filter (where not x.v2 and x.refuse_le is null and x.demande_parent_le is null and x.plus_tard_nb >= 3),
    'push_envoyes',       count(*) filter (where x.push_le is not null),
    'en_attente',         count(*) filter (where not x.v2 and x.refuse_le is null and x.a_ligne),
    'jamais_demande',     count(*) filter (where not x.v2 and x.refuse_le is null and not x.a_ligne)
  ) into v
  from (
    select a.partner_visibility_opt_in as opt_in,
           public.consentement_partenaire_v2_valide(a.id) as v2,
           c.refuse_le, c.demande_parent_le, coalesce(c.plus_tard_nb, 0) as plus_tard_nb, c.push_le,
           c.athlete_id is not null as a_ligne
      from public.athletes a
      join public.users u on u.id = a.user_id
      left join public.consentement_partenaire_v2 c on c.athlete_id = a.id
     where coalesce(u.onboarding_complete, false)
       and a.status in ('ACTIF', 'EN_ATTENTE')
  ) x;
  return v;
end $$;

-- ── Gardes d'après : ACL complète (jamais par inclusion), définition intacte ──
do $$
declare
  vus text[];
  f   oid := 'public.admin_consentement_partenaire_stats()'::regprocedure;
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL admin_consentement_partenaire_stats = %, attendu {authenticated,postgres,service_role}', vus;
  end if;
  if not (select prosecdef from pg_proc where oid = f)
     or (select proconfig from pg_proc where oid = f) is distinct from array['search_path=public', 'row_security=off'] then
    raise exception 'NEXUS: admin_consentement_partenaire_stats n''est plus SECURITY DEFINER ou a perdu son search_path';
  end if;
  if (select prosrc from pg_proc where oid = f) not like '%''jamais_demande''%' then
    raise exception 'NEXUS: la nouvelle clé jamais_demande manque';
  end if;
end $$;
