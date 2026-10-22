-- Rollback de 20261022213000_consentement_v2_en_attente.
-- Remet le corps d'avant (recopié tel quel de 20261018150000), sans les clés
-- en_attente et jamais_demande. Même signature, l'ACL ne bouge pas.
-- Après : l'écran mural et le QG lisent ces clés absentes comme 0 — rejouer ce
-- rollback seulement avec le retour de l'app à la version d'avant.

do $$
begin
  if (select prosrc from pg_proc
       where oid = 'public.admin_consentement_partenaire_stats()'::regprocedure) not like '%''jamais_demande''%' then
    raise exception 'NEXUS: 20261022213000 absente (pas de clé jamais_demande)';
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
    'push_envoyes',       count(*) filter (where x.push_le is not null)
  ) into v
  from (
    select a.partner_visibility_opt_in as opt_in,
           public.consentement_partenaire_v2_valide(a.id) as v2,
           c.refuse_le, c.demande_parent_le, coalesce(c.plus_tard_nb, 0) as plus_tard_nb, c.push_le
      from public.athletes a
      join public.users u on u.id = a.user_id
      left join public.consentement_partenaire_v2 c on c.athlete_id = a.id
     where coalesce(u.onboarding_complete, false)
       and a.status in ('ACTIF', 'EN_ATTENTE')
  ) x;
  return v;
end $$;

do $$
declare
  vus text[];
  f   oid := 'public.admin_consentement_partenaire_stats()'::regprocedure;
begin
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = f)
     is distinct from 'a80720524c23f0beb1b147e36e074389' then
    raise exception 'NEXUS: le corps remis n''a pas l''empreinte d''origine a8072052…';
  end if;
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL admin_consentement_partenaire_stats = %', vus;
  end if;
end $$;
