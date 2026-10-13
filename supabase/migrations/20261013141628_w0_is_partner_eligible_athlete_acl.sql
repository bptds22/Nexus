-- ═══════════════════════════════════════════════════════════════════════════
-- W0.4 — is_partner_eligible_athlete : plus d'exécution par anon ni PUBLIC.
--
-- Avant (relevé local 2026-10-13) :
--   {=X/postgres, postgres, anon, authenticated, service_role}
-- → n'importe quel visiteur anonyme pouvait sonder l'état opt-in partenaire
-- (et la règle d'âge) de n'importe quel uuid d'athlète.
--
-- Qui en a besoin :
--   authenticated — appels directs du portail partenaire
--     (app/partenaire/athletes/[id]/PageClient.tsx, app/api/partner/*/route.ts),
--     policy « Approved partners read eligible newsroom events » (TO public,
--     évaluée sous le rôle appelant), et le trigger INVOKER
--     emit_commitment_newsroom_event() qui tourne sous l'auteur de l'UPDATE.
--   service_role  — routes serveur.
--   Les objets DEFINER (vues partenaires, partner_athlete_profile,
--   partner_newsroom_events, partner_card_downloads_list,
--   matchs_profils_partenaire, emit_five_star_*, delete_my_account) tournent
--   sous postgres et n'ont pas besoin du grant.
--
-- Effet de bord assumé : un SELECT anonyme sur newsroom_events, qui rendait
-- 0 ligne, rend désormais « permission denied for function ». Aucun écran
-- ne lit cette table en anonyme (relevé 2026-10-13).
-- ═══════════════════════════════════════════════════════════════════════════

revoke all on function public.is_partner_eligible_athlete(uuid) from public, anon;
grant execute on function public.is_partner_eligible_athlete(uuid) to authenticated, service_role;

-- Gate ACL : liste complète triée (CLAUDE.md, 2026-09-07), jamais par inclusion.
do $$
declare
  f oid := 'public.is_partner_eligible_athlete(uuid)'::regprocedure;
  vus text[];
  veut text[] := array['authenticated', 'postgres', 'service_role'];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL = %, attendu %', vus, veut;
  end if;
end $$;
