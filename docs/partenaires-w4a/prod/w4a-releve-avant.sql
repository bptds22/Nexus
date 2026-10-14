-- W4a en prod par psql — RELEVÉ AVANT, dans LA MÊME transaction que la
-- migration (psql -1 -f <ce fichier> -f <W4a> -f w4a-gardes-et-enregistrement.sql).
-- Pose les témoins de ce que W4a ne doit jamais toucher dans une table
-- temporaire ; w4a-gardes-et-enregistrement.sql les recompare APRÈS.
-- Lecture seule. Rien n'est exécuté en prod sans le GO de BP.

-- ── 0. État de départ attendu ──────────────────────────────────────────────
do $$
declare f text; attendu text; vu text;
begin
  if (select max(version) from supabase_migrations.schema_migrations) >= '20261014200739' then
    raise exception 'NEXUS: une version >= 20261014200739 existe déjà en prod — renommer W4a avant de l''appliquer';
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where name = 'w4a_prospects_partenaire') then
    raise exception 'NEXUS: W4a déjà enregistrée';
  end if;
  if to_regclass('public.partenaire_prospects') is not null
     or to_regclass('public.partenaire_prospects_rapprochements') is not null
     or to_regclass('public.partenaire_prospects_issues') is not null
     or to_regclass('public.partenaire_prospects_journal') is not null then
    raise exception 'NEXUS: tables W4a déjà présentes';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
              and (proname like 'prospect_partenaire%' or proname like 'partenaire_prospect%'
                   or proname like 'admin_prospect%'
                   or proname in ('admin_loi25_prospects_partenaires', 'purger_prospects_partenaire'))) then
    raise exception 'NEXUS: fonctions W4a déjà présentes';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.athletes'::regclass and tgname = 'trg_prospect_partenaire_sur_optin') then
    raise exception 'NEXUS: trigger d''opt-in W4a déjà présent';
  end if;
  if exists (select 1 from cron.job where jobname = 'prospects-partenaire-purge-quotidienne') then
    raise exception 'NEXUS: tâche de purge W4a déjà planifiée';
  end if;
  -- Les fonctions dont W4a dépend (W2/W3/W3b, rapprochement du lot D) : relevées en prod
  -- le 2026-10-14, identiques en local où le banc W4a a tourné. W4a n'en modifie aucune.
  for f, attendu in values
    ('public.partenaire_evaluer_athlete(uuid, numeric, jsonb)', 'f3362b983b487984d1e4af10afb554e9'),
    ('public.partenaire_attribuer_badge(uuid, uuid)', '863de0ed48c2aa7d448a2545834a9a91'),
    ('public.partenaire_attribuer_badge_nexus(uuid, uuid, uuid)', '9d5b7df467a3d9c4f55c66a9aa119d0f'),
    ('public.partenaire_peut_evaluer(uuid, uuid)', '19dad4fa398df07bbb23c1abdb029aec'),
    ('public.is_partner_eligible_athlete(uuid)', '5bfd92f0bd9ab0b26b623c9b499f7708'),
    ('public.set_my_partner_visibility(boolean, text)', '77df6f54b971a8de3816b2cd964538a5'),
    ('public.badge_refuser_doublon_partenaire()', 'e1eb1d2242710caa348325f6a72160b7'),
    ('public.badge_plafond()', '171a82c74237a5a6d9c5f50c74f44d5e'),
    ('public.ambassadeur_recalculer_paliers()', '481cf443a2db040fd840a1e229b325f2'),
    ('public.is_admin()', '3d5360775265e00e511e75f82859fb1c'),
    ('public.nom_normalise(text)', '8120de88d83de466733affec2cdeb8ad'),
    ('public.noms_proches(text, text)', '89aa4265452aeee7b5d9e2d9a1e50e15'),
    ('public.prenoms_compatibles(text, text)', '8335586298c4b18805931d32726433ca'),
    ('public.prenoms_proches(text, text)', '9c41b3cf4010a5ba84419a3597c16d33')
  loop
    -- sans les retours chariot (CR) : un corps recréé depuis un fichier CRLF en porterait
    select md5(replace(pg_get_functiondef(f::regprocedure), E'\r', '')) into vu;
    if vu is distinct from attendu then
      raise exception 'NEXUS: % n''est pas la version relevée (md5 %, attendu %)', f, vu, attendu;
    end if;
  end loop;
  -- Les 17 triggers d'athletes relevés en prod le 2026-10-14.
  select count(*)::text || ' ' || md5(string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text, ',' order by tgname))
    into vu from pg_trigger where tgrelid = 'public.athletes'::regclass and not tgisinternal;
  if vu is distinct from '17 990362efde9d6549b63118a0e7498d4a' then
    raise exception 'NEXUS: triggers d''athletes différents du relevé (%)', vu;
  end if;
  -- La migration revérifie le texte exact de cette contrainte ; on l'arrête ici plus tôt.
  if (select md5(pg_get_constraintdef(oid)) from pg_constraint
       where conrelid = 'public.athlete_notifications'::regclass and conname = 'athlete_notifications_type_check')
     is distinct from 'aecc6a63b3c4db1f99e6d8b4cba9730b' then
    raise exception 'NEXUS: athlete_notifications_type_check différente du relevé';
  end if;
  if (select extnamespace::regnamespace::text from pg_extension where extname = 'pgcrypto') is distinct from 'extensions' then
    raise exception 'NEXUS: pgcrypto attendu dans le schéma extensions (jeton du lien)';
  end if;
end $$;

-- ── 1. Témoins ─────────────────────────────────────────────────────────────
create temp table _w4a_avant on commit drop as
select
  (select string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text || ':' || md5(pg_get_triggerdef(oid)), ',' order by tgname)
     from pg_trigger where tgrelid = 'public.athletes'::regclass and not tgisinternal) as triggers_athletes,
  (select count(*)::text || ' ' || md5(string_agg(jobname || ':' || schedule || ':' || command || ':' || active::text, ',' order by jobname))
     from cron.job) as cron,
  (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || type || coalesce(read::text, '∅'), ',' order by id), ''))
     from public.athlete_notifications) as notifications,
  (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(updated_at::text, '∅'), ',' order by id), ''))
     from public.partner_evaluations) as partner_evaluations,
  (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(retire_le::text, '∅') || coalesce(masque_le::text, '∅'), ',' order by id), ''))
     from public.partner_athlete_badges) as partner_athlete_badges,
  (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(updated_at::text, '∅')
            || coalesce(partner_visibility_opt_in::text, '∅') || coalesce(partner_visibility_parental_consent::text, '∅'), ',' order by id), ''))
     from public.athletes) as athletes,
  (select count(*) from public.admin_operations) as admin_operations;

select 'relevé avant W4a pris' as etape, * from _w4a_avant;
