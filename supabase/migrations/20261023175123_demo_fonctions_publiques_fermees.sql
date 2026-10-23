-- ═══════════════════════════════════════════════════════════════════════════
-- Démo du 12 octobre : les fonctions publiques ne sont plus appelables par l'API
-- (décision BP 2026-10-23, registre §102).
--
-- Les pages /12octobre ont été retirées du site le 2026-10-23 (e2132692).
-- Leurs fonctions restaient appelables directement par l'API REST.
-- Cette migration RETIRE seulement le droit EXECUTE à anon et authenticated
-- sur les 4 fonctions. Rien n'est supprimé : fonctions, tables et données
-- restent (données Loi 25 : leur sort se décide à part, sur GO de BP).
--
-- Relevé prod 2026-10-23 (identique en local) :
--   inscrire_demo           anon, authenticated, postgres, service_role
--   demo_clic_compte        anon, authenticated, postgres, service_role
--   demo_access_demander    postgres, service_role   (déjà fermée)
--   demo_access_consulter   postgres, service_role   (déjà fermée)
-- Les deux dernières sont reprises pour que le gate APRÈS couvre les 4.
--
-- Gates : empreinte (md5 du texte des fonctions) et ACL AVANT ; ACL APRÈS
-- comparée en liste complète triée (CLAUDE.md). Une garde qui échoue annule tout.
-- Rollback : supabase/rollback/20261023174206_rollback_demo_fonctions_publiques_fermees.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Gate AVANT : empreinte + ACL ────────────────────────────────────────────
do $$
declare
  r record;
  vus text[];
  empreinte text;
begin
  for r in
    select * from (values
      ('public.inscrire_demo(text,text,text,uuid,text,uuid,text,text[],text,boolean,text,boolean,boolean,text)',
       '8dd6cb9eaec1436702ebf73b3ccadf83', array['anon','authenticated','postgres','service_role']),
      ('public.demo_clic_compte(uuid)',
       '2c1b9f9ac57af9af42e944c0244302bf', array['anon','authenticated','postgres','service_role']),
      ('public.demo_access_demander(text,text,text,uuid,text,uuid,text,boolean,boolean,text)',
       'd70ba22a2452daa448c8365677d28778', array['postgres','service_role']),
      ('public.demo_access_consulter(uuid)',
       '111a6d07bc9600a4c5f88f003d8589f4', array['postgres','service_role'])
    ) as v(sig, md5_attendu, acl_attendue)
  loop
    select md5(pg_get_functiondef(r.sig::regprocedure)) into empreinte;
    if empreinte is distinct from r.md5_attendu then
      raise exception 'NEXUS: empreinte de % = %, attendu %', r.sig, empreinte, r.md5_attendu;
    end if;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.acl_attendue then
      raise exception 'NEXUS: ACL AVANT de % = %, attendu %', r.sig, vus, r.acl_attendue;
    end if;
  end loop;
end $$;

-- ── Retrait du droit EXECUTE ────────────────────────────────────────────────
revoke execute on function public.inscrire_demo(text,text,text,uuid,text,uuid,text,text[],text,boolean,text,boolean,boolean,text)
  from public, anon, authenticated;
revoke execute on function public.demo_clic_compte(uuid)
  from public, anon, authenticated;
revoke execute on function public.demo_access_demander(text,text,text,uuid,text,uuid,text,boolean,boolean,text)
  from public, anon, authenticated;
revoke execute on function public.demo_access_consulter(uuid)
  from public, anon, authenticated;

-- ── Gate APRÈS : liste complète triée, et fonctions inchangées ──────────────
do $$
declare
  r record;
  vus text[];
  veut constant text[] := array['postgres','service_role'];
  empreinte text;
begin
  for r in
    select * from (values
      ('public.inscrire_demo(text,text,text,uuid,text,uuid,text,text[],text,boolean,text,boolean,boolean,text)', '8dd6cb9eaec1436702ebf73b3ccadf83'),
      ('public.demo_clic_compte(uuid)', '2c1b9f9ac57af9af42e944c0244302bf'),
      ('public.demo_access_demander(text,text,text,uuid,text,uuid,text,boolean,boolean,text)', 'd70ba22a2452daa448c8365677d28778'),
      ('public.demo_access_consulter(uuid)', '111a6d07bc9600a4c5f88f003d8589f4')
    ) as v(sig, md5_attendu)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL APRÈS de % = %, attendu %', r.sig, vus, veut;
    end if;
    select md5(pg_get_functiondef(r.sig::regprocedure)) into empreinte;
    if empreinte is distinct from r.md5_attendu then
      raise exception 'NEXUS: % a changé (empreinte %)', r.sig, empreinte;
    end if;
  end loop;
end $$;
