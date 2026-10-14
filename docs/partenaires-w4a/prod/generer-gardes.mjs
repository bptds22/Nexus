// docs/partenaires-w4a/prod/generer-gardes.mjs
// Génère w4a-gardes-et-enregistrement.sql : les gardes APRÈS migration, puis
// l'enregistrement (schema_migrations, version FIXE 20261014200739 + ligne
// admin_operations). La migration y est embarquée OCTET POUR OCTET (fins de
// ligne LF, comme le blob git) dans une chaîne dollar-quotée, avec son md5.
// Ne pas éditer le .sql produit à la main : régénérer.
//
//   node docs/partenaires-w4a/prod/generer-gardes.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "..", "..", "..");
const VERSION = "20261014200739";
const NOM = "w4a_prospects_partenaire";
const MIGRATION = path.join(RACINE, "supabase", "migrations", `${VERSION}_${NOM}.sql`);

const contenu = readFileSync(MIGRATION, "utf8").replace(/\r\n/g, "\n");
if (contenu.includes("$w4a$")) throw new Error("la migration contient le délimiteur $w4a$");
const md5 = createHash("md5").update(contenu, "utf8").digest("hex");

const gardes = `-- W4a en prod par psql — GARDES + ENREGISTREMENT, dans LA MÊME transaction que
-- la migration (psql -1 -f w4a-releve-avant.sql -f <W4a> -f <ce fichier>).
-- Une garde qui échoue (RAISE « NEXUS: ») annule TOUT : W4a, l'historique et
-- admin_operations. Les témoins viennent de _w4a_avant (w4a-releve-avant.sql).
-- GÉNÉRÉ par generer-gardes.mjs — la chaîne $w4a$ est la migration copiée
-- octet pour octet (LF) : ne pas éditer à la main, le md5 de garde casserait.

-- ── 1. Ce que W4a ne doit jamais toucher : comparé au relevé avant ─────────
do $$
declare
  a _w4a_avant%rowtype;
  f text; attendu text; v text;
begin
  select * into a from _w4a_avant;

  -- Fonctions dont W4a dépend : inchangées (md5 sans CR, valeurs prod du 2026-10-14).
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
    if md5(replace(pg_get_functiondef(f::regprocedure), E'\\r', '')) is distinct from attendu then
      raise exception 'NEXUS: % a changé pendant W4a', f;
    end if;
  end loop;

  -- Triggers d'athletes : ceux d'avant à l'identique, plus EXACTEMENT celui d'opt-in.
  select string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text || ':' || md5(pg_get_triggerdef(oid)), ',' order by tgname)
    into v from pg_trigger where tgrelid = 'public.athletes'::regclass and not tgisinternal
     and tgname <> 'trg_prospect_partenaire_sur_optin';
  if v is distinct from a.triggers_athletes then
    raise exception 'NEXUS: triggers d''athletes d''avant changés';
  end if;

  -- Tâches cron : celles d'avant à l'identique, plus EXACTEMENT la purge W4a.
  if (select count(*)::text || ' ' || md5(string_agg(jobname || ':' || schedule || ':' || command || ':' || active::text, ',' order by jobname))
        from cron.job where jobname <> 'prospects-partenaire-purge-quotidienne') is distinct from a.cron then
    raise exception 'NEXUS: tâches cron d''avant changées';
  end if;

  -- Données : rien d'écrit par la migration.
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || type || coalesce(read::text, '∅'), ',' order by id), ''))
        from public.athlete_notifications) is distinct from a.notifications then
    raise exception 'NEXUS: athlete_notifications a bougé';
  end if;
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(updated_at::text, '∅'), ',' order by id), ''))
        from public.partner_evaluations) is distinct from a.partner_evaluations then
    raise exception 'NEXUS: partner_evaluations a bougé';
  end if;
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(retire_le::text, '∅') || coalesce(masque_le::text, '∅'), ',' order by id), ''))
        from public.partner_athlete_badges) is distinct from a.partner_athlete_badges then
    raise exception 'NEXUS: partner_athlete_badges a bougé';
  end if;
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(updated_at::text, '∅')
            || coalesce(partner_visibility_opt_in::text, '∅') || coalesce(partner_visibility_parental_consent::text, '∅'), ',' order by id), ''))
        from public.athletes) is distinct from a.athletes then
    raise exception 'NEXUS: athletes a bougé';
  end if;
  if (select count(*) from public.admin_operations) <> a.admin_operations then
    raise exception 'NEXUS: admin_operations a bougé avant l''enregistrement';
  end if;
end $$;

-- ── 2. Le nouvel état ──────────────────────────────────────────────────────
do $$
declare
  r record;
  vus text[];
  veut text[];
  n int := 0;
begin
  -- 29 fonctions, droits : liste COMPLÈTE, jamais par inclusion.
  for r in select p.oid, p.proname, p.prosecdef from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and (p.proname like 'prospect_partenaire%' or p.proname like 'partenaire_prospect%'
                   or p.proname like 'admin_prospect%'
                   or p.proname in ('admin_loi25_prospects_partenaires', 'purger_prospects_partenaire'))
  loop
    n := n + 1;
    veut := case
      when r.proname = 'prospect_partenaire_resoudre' then array['anon', 'authenticated', 'postgres', 'service_role']
      when r.proname in ('prospect_partenaire_peut_transferer', 'prospect_partenaire_journaliser',
                         'prospect_partenaire_normaliser_evaluation', 'prospect_partenaire_terminer',
                         'prospect_partenaire_contenu', 'prospect_partenaire_transferer',
                         'prospect_partenaire_candidats', 'prospect_partenaire_proposer',
                         'prospect_partenaire_proposer_auto', 'prospect_partenaire_sur_optin',
                         'purger_prospects_partenaire') then array['postgres', 'service_role']
      else array['authenticated', 'postgres', 'service_role'] end;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.proname, vus, veut;
    end if;
    -- Toutes SECURITY DEFINER, sauf la normalisation (calcul pur, serveur seulement).
    if r.prosecdef is distinct from (r.proname <> 'prospect_partenaire_normaliser_evaluation') then
      raise exception 'NEXUS: SECURITY DEFINER inattendu sur %', r.proname;
    end if;
  end loop;
  if n <> 29 then
    raise exception 'NEXUS: 29 fonctions W4a attendues, % trouvées', n;
  end if;

  -- 4 tables : RLS active, aucune politique, aucun droit direct, vides.
  select count(*) into n from pg_class c
   where c.oid in ('public.partenaire_prospects'::regclass, 'public.partenaire_prospects_rapprochements'::regclass,
                   'public.partenaire_prospects_issues'::regclass, 'public.partenaire_prospects_journal'::regclass)
     and c.relrowsecurity
     and not exists (select 1 from unnest(coalesce(c.relacl, '{}'::aclitem[])) a
                      where split_part(a::text, '=', 1) in ('anon', 'authenticated', ''));
  if n <> 4 then
    raise exception 'NEXUS: une table W4a est sans RLS ou lisible par anon/authenticated/PUBLIC';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename like 'partenaire_prospects%') then
    raise exception 'NEXUS: aucune politique attendue sur les tables W4a';
  end if;
  if (select count(*) from public.partenaire_prospects) + (select count(*) from public.partenaire_prospects_rapprochements)
     + (select count(*) from public.partenaire_prospects_issues) + (select count(*) from public.partenaire_prospects_journal) <> 0 then
    raise exception 'NEXUS: tables W4a non vides après migration';
  end if;

  -- Le trigger d'opt-in : texte exact (AFTER UPDATE OF …, WHEN l'opt-in DEVIENT actif), actif.
  if (select pg_get_triggerdef(oid) || ':' || tgenabled::text from pg_trigger
       where tgrelid = 'public.athletes'::regclass and tgname = 'trg_prospect_partenaire_sur_optin')
     is distinct from $t$CREATE TRIGGER trg_prospect_partenaire_sur_optin AFTER UPDATE OF partner_visibility_opt_in, partner_visibility_parental_consent ON public.athletes FOR EACH ROW WHEN ((new.partner_visibility_opt_in AND ((old.partner_visibility_opt_in IS DISTINCT FROM new.partner_visibility_opt_in) OR (old.partner_visibility_parental_consent IS DISTINCT FROM new.partner_visibility_parental_consent)))) EXECUTE FUNCTION prospect_partenaire_sur_optin():O$t$ then
    raise exception 'NEXUS: trigger d''opt-in absent ou différent';
  end if;

  -- La purge : une seule tâche, 08:50 UTC, active.
  if (select count(*) from cron.job where jobname = 'prospects-partenaire-purge-quotidienne'
        and schedule = '50 8 * * *' and command = 'select public.purger_prospects_partenaire()' and active) <> 1 then
    raise exception 'NEXUS: tâche de purge W4a absente, en double ou différente';
  end if;

  -- La contrainte des notifications : l'ancienne liste + PARTENAIRE_EVALUATION, rien d'autre.
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.athlete_notifications'::regclass and conname = 'athlete_notifications_type_check')
     is distinct from $c$CHECK ((type = ANY (ARRAY['PROFILE_VIEWED'::text, 'ADDED_TO_FAVORITES'::text, 'SUGGESTION_APPROVED'::text, 'SUGGESTION_REJECTED'::text, 'COACH_REPORT_UPDATED'::text, 'COACH_VERIFIED'::text, 'COACH_MODIFIED_PROFILE'::text, 'COACH_DISTINCTION_ADDED'::text, 'COACH_EVALUATION_UPDATED'::text, 'PROFILE_MILESTONE'::text, 'PROFILE_TIP'::text, 'ADMIN_BROADCAST'::text, 'TEAM_INVITATION'::text, 'SCHOOL_CLAIM_REJECTED'::text, 'COACH_CLAIMED'::text, 'AMBASSADEUR_PALIER_3'::text, 'AMBASSADEUR_PALIER_5'::text, 'PARTENAIRE_EVALUATION'::text])))$c$ then
    raise exception 'NEXUS: athlete_notifications_type_check inattendue';
  end if;
end $$;

-- ── 3. Enregistrement ──────────────────────────────────────────────────────
create temp table _w4a on commit drop as
select '${VERSION}'::text as version,
-- replace : un checkout Windows extrait ce fichier en CRLF ; le contenu
-- enregistré et son md5 sont ceux du blob git (LF).
replace($w4a$${contenu}$w4a$, E'\\r', '')::text as contenu;

do $$
begin
  if (select md5(contenu) from _w4a) <> '${md5}' then
    raise exception 'NEXUS: contenu W4a embarqué altéré (md5 %)', (select md5(contenu) from _w4a);
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, '${NOM}', array[contenu], 'bptds22@gmail.com' from _w4a;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_W4A_PROSPECTS_PARTENAIRE',
       'W4a Partenaire : cartes prospects, lien d''inscription à jeton, attente d''opt-in, rapprochements admin, export Loi 25 (GO BP)',
       jsonb_build_object(
         'nom', '${NOM}',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_${NOM}.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_${NOM}.sql',
         'voie', 'psql -1 (session pooler) : relevé avant + migration + gardes dans une seule transaction',
         'md5_fichier', '${md5}',
         'tables', '4 (RLS, aucune politique, aucun droit direct)',
         'fonctions', '29 — ACL complètes : 1 anon+authenticated, 17 authenticated, 11 serveur seulement',
         'trigger', 'trg_prospect_partenaire_sur_optin (AFTER UPDATE OF opt-in, WHEN opt-in devient actif, erreurs attrapées)',
         'cron', 'prospects-partenaire-purge-quotidienne 50 8 * * *',
         'contrainte', 'athlete_notifications_type_check + PARTENAIRE_EVALUATION',
         'inchanges', '14 fonctions W2/W3/W3b/lot D (md5), 17 triggers athletes, tâches cron, données'),
       (select id from public.users where email = 'bptds22@gmail.com')
  from _w4a;

select version as version_w4a_enregistree from _w4a;
`;
writeFileSync(path.join(ICI, "w4a-gardes-et-enregistrement.sql"), gardes, "utf8");
console.log(`w4a-gardes-et-enregistrement.sql — migration embarquée, md5 ${md5}`);
