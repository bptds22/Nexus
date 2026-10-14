-- W3 en prod par psql — RELEVÉ AVANT, dans LA MÊME transaction que la
-- migration (psql -1 -f <ce fichier> -f <W3> -f w3-gardes-et-enregistrement.sql).
-- Pose les témoins de ce que W3 ne doit jamais toucher dans une table
-- temporaire ; w3-gardes-et-enregistrement.sql les recompare APRÈS la
-- migration. Le relevé est pris à l'instant de l'application : une évaluation
-- de coach saisie entre la préparation et le GO ne fait pas échouer la garde.

-- ── 0. État de départ attendu ──────────────────────────────────────────────
do $$
begin
  if (select max(version) from supabase_migrations.schema_migrations) >= '20261014142700' then
    raise exception 'NEXUS: une version >= 20261014142700 existe déjà en prod — renommer W3 avant de l''appliquer';
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where name = 'w3_partenaire_badges_retrait') then
    raise exception 'NEXUS: W3 déjà enregistrée';
  end if;
  if to_regclass('public.partner_badges') is not null
     or to_regclass('public.partner_athlete_badges') is not null
     or to_regclass('public.partner_evaluation_retraits') is not null then
    raise exception 'NEXUS: tables W3 déjà présentes';
  end if;
  if exists (select 1 from storage.buckets where id = 'partner-badges') then
    raise exception 'NEXUS: bucket partner-badges déjà présent';
  end if;
  if (select string_agg(md5(pg_get_functiondef(p.oid)), ',') from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.proname = 'recruiter_search_athletes')
     is distinct from 'c15481a07a3b98e3ae72f8917763a45a' then
    raise exception 'NEXUS: recruiter_search_athletes n''est pas celle de W2 (md5 c15481a0…)';
  end if;
end $$;

-- ── 1. Témoins ─────────────────────────────────────────────────────────────
create temp table _w3_avant on commit drop as
select
  (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || cote_globale::text || updated_at::text, ',' order by id), ''))
     from public.evaluations) as evaluations,
  (select md5(coalesce(string_agg(id::text || ':' || coalesce(cote_globale_entraineur::text, '∅'), ',' order by id), ''))
     from public.athletes) as cotes_coach,
  (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(retire_le::text, '∅'), ',' order by id), ''))
     from public.athlete_badges) as athlete_badges,
  (select count(*) from public.partner_evaluations) as partner_evaluations,
  md5(pg_get_functiondef('public.badge_plafond()'::regprocedure)) as badge_plafond,
  md5(pg_get_functiondef('public.calc_cote_globale()'::regprocedure)) as calc_cote_globale,
  (select string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text, ',' order by tgname)
     from pg_trigger where tgrelid = 'public.athlete_badges'::regclass and not tgisinternal) as triggers_athlete_badges,
  -- M10 : la pose automatique du badge Ambassadeur vit dans
  -- ambassadeur_recalculer_paliers() (trigger trg_ambassadeur_paliers).
  (select string_agg(p.oid::regprocedure::text || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.oid::regprocedure::text)
     from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'ambassadeur%') as fonctions_ambassadeur,
  (select string_agg(c.relname || '.' || t.tgname || ':' || t.tgfoid::regproc::text || ':' || t.tgenabled::text, ',' order by c.relname, t.tgname)
     from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal and t.tgfoid::regproc::text like '%ambassadeur%') as triggers_ambassadeur,
  (select string_agg(p.oid::regprocedure::text || '=' || coalesce(p.proacl::text, ''), ',' order by p.oid::regprocedure::text)
     from pg_proc p where p.pronamespace = 'public'::regnamespace
      and p.proname in ('partenaire_evaluer_athlete', 'partenaire_evaluation_contexte',
                        'evaluations_partenaires_athlete', 'recruiter_search_athletes')) as acl_w2;

select 'relevé avant W3 pris' as etape, * from _w3_avant;
