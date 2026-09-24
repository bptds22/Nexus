-- ═══════════════════════════════════════════════════════════════════════════
-- Journal des exports CSV du pipeline recruteur (lot B — décision BP 2026-09-24)
--
-- « Journalisation de chaque export : qui, quand, combien de lignes. »
-- Un export fait SORTIR de la plateforme des données d'athlètes, majoritairement
-- mineurs (Loi 25) : on garde une trace, en AJOUT SEULEMENT.
--
-- Pourquoi une table dédiée et pas une existante :
--   · recruiter_activity_log — CHECK sur action_type (liste fermée), lisible
--     par le coach et l'admin cégep, et SUPPRIMABLE par le recruteur (policy
--     FOR ALL) : une trace que son auteur efface n'en est pas une ;
--   · search_filter_events — CHECK sur surface et filtre, purgée à 180 j,
--     et c'est de la télémétrie de filtres, pas un journal d'audit.
--
-- Qui écrit : le recruteur lui-même, pour lui-même, s'il est Pro (le bouton
--   est désactivé en démo ; user_has_pro() le garantit aussi en base).
-- Qui lit  : l'admin plateforme seulement.
-- Personne ne modifie ni ne supprime (aucun privilège UPDATE / DELETE).
-- Le compte supprimé emporte ses lignes (ON DELETE CASCADE) — suppression
-- de compte Loi 25.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.pipeline_exports (
  id           uuid        primary key default gen_random_uuid(),
  recruiter_id uuid        not null default auth.uid() references public.users(id) on delete cascade,
  nb_lignes    integer     not null check (nb_lignes >= 0),
  created_at   timestamptz not null default now()
);

create index pipeline_exports_recruiter_created_idx
  on public.pipeline_exports (recruiter_id, created_at desc);

alter table public.pipeline_exports enable row level security;

create policy pipeline_exports_insert_own
  on public.pipeline_exports for insert to authenticated
  with check (
    recruiter_id = (select auth.uid())
    and public.is_recruiter()
    and public.user_has_pro()
  );

create policy pipeline_exports_select_admin
  on public.pipeline_exports for select to authenticated
  using (public.is_admin());

-- Les default privileges de Supabase accordent TOUT à anon, authenticated et
-- service_role sur une table créée dans public. On retire ce qui n'a pas lieu
-- d'être : rien pour anon ni PUBLIC ; INSERT + SELECT seulement pour
-- authenticated (la RLS filtre ensuite).
revoke all on public.pipeline_exports from anon, public;
revoke all on public.pipeline_exports from authenticated;
grant insert, select on public.pipeline_exports to authenticated;

-- ── Gate d'ACL : COMPARAISON COMPLÈTE, jamais par inclusion (règle 2026-09-07)
-- 1. La liste triée des bénéficiaires est exactement celle attendue.
-- 2. authenticated a exactement INSERT + SELECT.
do $$
declare
  beneficiaires text[];
  droits_auth   text[];
begin
  select array_agg(distinct g order by g) into beneficiaires
    from (
      select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as g
        from pg_class c, lateral aclexplode(c.relacl) a
       where c.oid = 'public.pipeline_exports'::regclass
    ) t;
  if beneficiaires is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL pipeline_exports = %, attendu {authenticated,postgres,service_role}', beneficiaires;
  end if;

  select array_agg(a.privilege_type order by a.privilege_type) into droits_auth
    from pg_class c, lateral aclexplode(c.relacl) a
   where c.oid = 'public.pipeline_exports'::regclass
     and a.grantee = 'authenticated'::regrole;
  if droits_auth is distinct from array['INSERT', 'SELECT'] then
    raise exception 'NEXUS: droits authenticated sur pipeline_exports = %, attendu {INSERT,SELECT}', droits_auth;
  end if;
end $$;
