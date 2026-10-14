-- W3b en prod par psql — RELEVÉ AVANT, dans LA MÊME transaction que la
-- migration (psql -1 -f <ce fichier> -f <W3b> -f w3b-gardes-et-enregistrement.sql).
-- Pose les témoins de ce que W3b ne doit jamais toucher dans une table
-- temporaire ; w3b-gardes-et-enregistrement.sql les recompare APRÈS.
-- Lecture seule. Rien n'est exécuté en prod sans le GO de BP.

-- ── 0. État de départ attendu ──────────────────────────────────────────────
do $$
declare f text; attendu text; vu text;
begin
  if (select max(version) from supabase_migrations.schema_migrations) >= '20261014180000' then
    raise exception 'NEXUS: une version >= 20261014180000 existe déjà en prod — renommer W3b avant de l''appliquer';
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where name = 'w3b_partenaire_badges_nexus') then
    raise exception 'NEXUS: W3b déjà enregistrée';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'partner_athlete_badges' and column_name in ('partner_id', 'badge_id')) then
    raise exception 'NEXUS: colonnes W3b déjà présentes';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
              and proname in ('partenaire_attribuer_badge_nexus', 'partenaire_badges_nexus_admissibles',
                              'badge_refuser_doublon_partenaire')) then
    raise exception 'NEXUS: fonctions W3b déjà présentes';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.athlete_badges'::regclass and tgname = 'trg_badge_deja_partenaire') then
    raise exception 'NEXUS: trigger trg_badge_deja_partenaire déjà présent';
  end if;
  -- Les fonctions que W3b remplace ou garde : celles de W3, relevées le 2026-10-14.
  for f, attendu in values
    ('public.partenaire_attribuer_badge(uuid, uuid)', 'b9b379472983ae03a046fd5af5313ded'),
    ('public.retirer_badge_partenaire(uuid)', '0e2388b927708a3efc11a21d8caf7e29'),
    ('public.badges_partenaires_athlete(uuid)', '7cd05f7cc8a9a04913aada360fb75bc2'),
    ('public.coach_masquer_badge_partenaire(uuid, boolean)', '8a61d292cfac6db385c4e825dfc549f3'),
    ('public.badge_plafond()', '171a82c74237a5a6d9c5f50c74f44d5e'),
    ('public.ambassadeur_recalculer_paliers()', '481cf443a2db040fd840a1e229b325f2')
  loop
    -- sans les retours chariot (CR) : un corps recréé depuis un fichier CRLF en porterait
    select md5(replace(pg_get_functiondef(f::regprocedure), E'\r', '')) into vu;
    if vu is distinct from attendu then
      raise exception 'NEXUS: % n''est pas la version relevée (md5 %, attendu %)', f, vu, attendu;
    end if;
  end loop;
end $$;

-- ── 1. Témoins ─────────────────────────────────────────────────────────────
create temp table _w3b_avant on commit drop as
select
  (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(retire_le::text, '∅'), ',' order by id), ''))
     from public.athlete_badges) as athlete_badges,
  -- Les poses W3 existantes : leur contenu ne doit pas bouger (seul partner_id s'ajoute).
  (select count(*)::text || ' ' || md5(coalesce(string_agg(
            id::text || partner_badge_id::text || athlete_id::text || coalesce(retire_le::text, '∅') || coalesce(masque_le::text, '∅'),
            ',' order by id), ''))
     from public.partner_athlete_badges) as poses_w3,
  (select count(*) from public.partner_badges) as partner_badges,
  (select string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text, ',' order by tgname)
     from pg_trigger where tgrelid = 'public.athlete_badges'::regclass and not tgisinternal) as triggers_athlete_badges,
  (select string_agg(p.oid::regprocedure::text || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.oid::regprocedure::text)
     from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'ambassadeur%') as fonctions_ambassadeur,
  (select string_agg(c.relname || '.' || t.tgname || ':' || t.tgfoid::regproc::text || ':' || t.tgenabled::text, ',' order by c.relname, t.tgname)
     from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal and t.tgfoid::regproc::text like '%ambassadeur%') as triggers_ambassadeur,
  (select count(*) from public.badges where actif and famille in ('universel', 'sport') and not requiert_contexte) as badges_admissibles,
  (select count(*) from public.badge_sports) as badge_sports;

select 'relevé avant W3b pris' as etape, * from _w3b_avant;
