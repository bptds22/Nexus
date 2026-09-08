-- 20260908024711_recruiter_search_athletes_revoke_anon
--
-- APPLIQUEE en PROD le 2026-09-07 via MCP apply_migration, sur GO de BP.
-- Nom de fichier aligne sur la version REELLE assignee par MCP.
--
-- ── LE DEFAUT ────────────────────────────────────────────────────────────────
-- La migration 20260908015840 a recree `recruiter_search_athletes` par
-- DROP + CREATE. Le DROP emporte l'ACL ; je l'ai reposee explicitement
-- (revoke PUBLIC, grant authenticated + service_role) — mais Supabase pose un
-- ALTER DEFAULT PRIVILEGES sur le schema public qui accorde EXECUTE a
-- `anon, authenticated, service_role` sur TOUTE fonction creee. `anon` est
-- donc revenu par la porte des DEFAULT PRIVILEGES, pas par la mienne.
--
--   ACL avant l'apply : {postgres, authenticated, service_role}
--   ACL apres l'apply : {postgres, ANON, authenticated, service_role}
--
-- Le gate DO $$ de la migration ne l'a pas vu : il verifiait que PUBLIC
-- n'etait pas revenu et que les deux roles attendus etaient la — jamais que
-- l'ACL etait EXACTEMENT celle d'avant. Une liste blanche verifiee par
-- inclusion laisse entrer ce qu'elle n'a pas nomme. Le gate ci-dessous
-- compare la liste COMPLETE, triee.
--
-- ── PORTEE REELLE : posture, pas fuite ───────────────────────────────────────
-- La fonction ouvre sur
--     IF NOT public.is_recruiter() THEN RAISE EXCEPTION ... 42501
-- et `is_recruiter()` lit auth.uid(), nul pour un appelant anonyme. Un anon
-- qui l'appelle recoit donc une exception, pas une ligne. AUCUNE donnee n'a
-- ete exposee. Ce qui est en cause, c'est la surface : une fonction
-- SECURITY DEFINER ne doit pas etre invocable par un role qui n'a aucune
-- raison de l'appeler, et l'ACL d'origine disait exactement cela.
--
-- Norme de la famille, relevee le 2026-09-07 — aucune de ces fonctions
-- n'accorde EXECUTE a anon :
--     get_coach_athletes          {postgres, authenticated, service_role}
--     partner_athlete_profile     {postgres, authenticated, service_role}
--     recruiter_athlete_cards     {postgres, authenticated, service_role}
--     recruiter_athlete_profile   {postgres, authenticated, service_role}
--
-- ⚠ HORS PERIMETRE, A CONSIGNER : `count_coach_athletes` porte
-- {=X/postgres, postgres, anon, authenticated, service_role} — PUBLIC **et**
-- anon. Anterieur a ce chantier, non touche ici. A instruire separement.

revoke execute on function public.recruiter_search_athletes(
  text, uuid, integer, boolean, boolean, numeric, numeric,
  boolean, boolean, boolean, boolean, text, integer, uuid[], boolean
) from anon;

-- ── GATE — compare l'ACL COMPLETE, plus seulement par inclusion ──────────────
do $$
declare
  f    regprocedure := 'public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean)'::regprocedure;
  vus  text[];
  veut text[] := array['authenticated','postgres','service_role'];
begin
  select array_agg(g order by g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;

  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de recruiter_search_athletes = %, attendu %', vus, veut;
  end if;

  raise notice 'NEXUS: ACL exacte restauree — %', vus;
end $$;
