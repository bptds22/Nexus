-- 20260929153755_acl_set_child_consent — APPLIQUÉE EN PROD le 2026-09-29 (GO BP)
--
-- Registre §51 : set_child_consent(uuid, text, boolean, text) était exécutable
-- par `anon` et `PUBLIC` en prod (ACL relevée : {anon, authenticated, postgres,
-- PUBLIC, service_role}). Sans conséquence aujourd'hui — la fonction commence
-- par is_parent_of(), un anonyme reçoit `not_parent` — mais c'est exactement
-- la forme que la règle des gates d'ACL interdit.
--
-- Seul appelant : le portail parent (/parent/consentements), derrière une
-- garde de session ; aucune route /parent dans l'app mobile. Rien ne casse.
--
-- REVOKE seul : la fonction n'est ni supprimée ni recréée, son corps ne bouge
-- pas. Gate en LISTE COMPLÈTE, jamais par inclusion.

revoke execute on function public.set_child_consent(uuid, text, boolean, text) from public, anon;

do $$
declare
  vus text[];
  veut text[] := array['authenticated', 'postgres', 'service_role'];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.set_child_consent(uuid, text, boolean, text)'::regprocedure;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de set_child_consent = %, attendu %', vus, veut;
  end if;
end $$;
