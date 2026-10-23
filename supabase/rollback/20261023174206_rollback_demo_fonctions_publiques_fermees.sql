-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK de 20261023174206_demo_fonctions_publiques_fermees.sql
-- Rend EXECUTE à anon et authenticated sur inscrire_demo et demo_clic_compte,
-- les deux seules qui l'avaient avant. demo_access_demander et
-- demo_access_consulter étaient déjà fermées : on n'y rend rien.
-- À n'exécuter que sur GO de BP.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Gate AVANT : l'état laissé par la migration ─────────────────────────────
do $$
declare
  r record;
  vus text[];
  veut constant text[] := array['postgres','service_role'];
begin
  for r in
    select * from (values
      ('public.inscrire_demo(text,text,text,uuid,text,uuid,text,text[],text,boolean,text,boolean,boolean,text)'),
      ('public.demo_clic_compte(uuid)'),
      ('public.demo_access_demander(text,text,text,uuid,text,uuid,text,boolean,boolean,text)'),
      ('public.demo_access_consulter(uuid)')
    ) as v(sig)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL AVANT rollback de % = %, attendu %', r.sig, vus, veut;
    end if;
  end loop;
end $$;

grant execute on function public.inscrire_demo(text,text,text,uuid,text,uuid,text,text[],text,boolean,text,boolean,boolean,text)
  to anon, authenticated;
grant execute on function public.demo_clic_compte(uuid)
  to anon, authenticated;

-- ── Gate APRÈS : retour exact à l'état du 2026-10-23 avant migration ────────
do $$
declare
  r record;
  vus text[];
begin
  for r in
    select * from (values
      ('public.inscrire_demo(text,text,text,uuid,text,uuid,text,text[],text,boolean,text,boolean,boolean,text)',
       array['anon','authenticated','postgres','service_role']),
      ('public.demo_clic_compte(uuid)', array['anon','authenticated','postgres','service_role']),
      ('public.demo_access_demander(text,text,text,uuid,text,uuid,text,boolean,boolean,text)', array['postgres','service_role']),
      ('public.demo_access_consulter(uuid)', array['postgres','service_role'])
    ) as v(sig, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL APRÈS rollback de % = %, attendu %', r.sig, vus, r.veut;
    end if;
  end loop;
end $$;
