// docs/partenaires-w3b/prod/generer-gardes.mjs
// Génère w3b-gardes-et-enregistrement.sql : les gardes APRÈS migration, puis
// l'enregistrement (schema_migrations, version FIXE 20261014180000 + ligne
// admin_operations). La migration y est embarquée OCTET POUR OCTET (fins de
// ligne LF, comme le blob git) dans une chaîne dollar-quotée, avec son md5.
// Ne pas éditer le .sql produit à la main : régénérer.
//
//   node docs/partenaires-w3b/prod/generer-gardes.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "..", "..", "..");
const VERSION = "20261014180000";
const NOM = "w3b_partenaire_badges_nexus";
const MIGRATION = path.join(RACINE, "supabase", "migrations", `${VERSION}_${NOM}.sql`);

const contenu = readFileSync(MIGRATION, "utf8").replace(/\r\n/g, "\n");
if (contenu.includes("$w3b$")) throw new Error("la migration contient le délimiteur $w3b$");
const md5 = createHash("md5").update(contenu, "utf8").digest("hex");

const gardes = `-- W3b en prod par psql — GARDES + ENREGISTREMENT, dans LA MÊME transaction que
-- la migration (psql -1 -f w3b-releve-avant.sql -f <W3b> -f <ce fichier>).
-- Une garde qui échoue (RAISE « NEXUS: ») annule TOUT : W3b, l'historique et
-- admin_operations. Les témoins viennent de _w3b_avant (w3b-releve-avant.sql).
-- GÉNÉRÉ par generer-gardes.mjs — la chaîne $w3b$ est la migration copiée
-- octet pour octet (LF) : ne pas éditer à la main, le md5 de garde casserait.

-- ── 1. Ce que W3b ne doit jamais toucher : comparé au relevé avant ─────────
do $$
declare
  a _w3b_avant%rowtype;
  v text;
begin
  select * into a from _w3b_avant;

  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(retire_le::text, '∅'), ',' order by id), ''))
        from public.athlete_badges) is distinct from a.athlete_badges then
    raise exception 'NEXUS: athlete_badges a bougé';
  end if;
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(
            id::text || partner_badge_id::text || athlete_id::text || coalesce(retire_le::text, '∅') || coalesce(masque_le::text, '∅'),
            ',' order by id), ''))
        from public.partner_athlete_badges) is distinct from a.poses_w3 then
    raise exception 'NEXUS: les poses W3 existantes ont bougé';
  end if;
  if (select count(*) from public.partner_badges) <> a.partner_badges then
    raise exception 'NEXUS: partner_badges a bougé';
  end if;
  -- Triggers d'athlete_badges : ceux d'avant, plus EXACTEMENT trg_badge_deja_partenaire.
  select string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text, ',' order by tgname) into v
    from pg_trigger where tgrelid = 'public.athlete_badges'::regclass and not tgisinternal
     and tgname <> 'trg_badge_deja_partenaire';
  if v is distinct from a.triggers_athlete_badges or v not like '%trg_badge_plafond:badge_plafond:O%' then
    raise exception 'NEXUS: triggers d''athlete_badges d''avant changés : %', v;
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.athlete_badges'::regclass
                  and tgname = 'trg_badge_deja_partenaire' and tgenabled = 'O'
                  and tgfoid = 'public.badge_refuser_doublon_partenaire()'::regprocedure
                  and (tgtype & 2) = 2) then  -- BEFORE
    raise exception 'NEXUS: trg_badge_deja_partenaire absent, désactivé ou pas BEFORE';
  end if;
  select string_agg(p.oid::regprocedure::text || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.oid::regprocedure::text) into v
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'ambassadeur%';
  if v is distinct from a.fonctions_ambassadeur then  -- même transaction, même texte : comparaison brute
    raise exception 'NEXUS: fonctions ambassadeur (M10) changées';
  end if;
  select string_agg(c.relname || '.' || t.tgname || ':' || t.tgfoid::regproc::text || ':' || t.tgenabled::text, ',' order by c.relname, t.tgname) into v
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and t.tgfoid::regproc::text like '%ambassadeur%';
  if v is distinct from a.triggers_ambassadeur then
    raise exception 'NEXUS: triggers ambassadeur (M10) changés : %', v;
  end if;
  if md5(replace(pg_get_functiondef('public.badge_plafond()'::regprocedure), E'\\r', '')) <> '171a82c74237a5a6d9c5f50c74f44d5e' then
    raise exception 'NEXUS: badge_plafond a changé';
  end if;
  if (select count(*) from public.badges where actif and famille in ('universel', 'sport') and not requiert_contexte) <> a.badges_admissibles
     or (select count(*) from public.badge_sports) <> a.badge_sports then
    raise exception 'NEXUS: catalogue des badges changé';
  end if;
end $$;

-- ── 2. Le nouvel état ──────────────────────────────────────────────────────
do $$
declare
  f regprocedure;
  v text;
  n int;
begin
  -- Droits : liste COMPLÈTE, jamais par inclusion.
  foreach f in array array[
    'public.partenaire_badges_nexus_admissibles(uuid)'::regprocedure,
    'public.partenaire_attribuer_badge_nexus(uuid, uuid, uuid)'::regprocedure,
    'public.partenaire_attribuer_badge(uuid, uuid)'::regprocedure,
    'public.retirer_badge_partenaire(uuid)'::regprocedure,
    'public.coach_masquer_badge_partenaire(uuid, boolean)'::regprocedure,
    'public.badges_partenaires_athlete(uuid)'::regprocedure]
  loop
    select string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' order by a.grantee::regrole::text)
      into v from pg_proc p, lateral aclexplode(p.proacl) a where p.oid = f;
    if v is distinct from 'authenticated:EXECUTE,postgres:EXECUTE,service_role:EXECUTE' then
      raise exception 'NEXUS: droits % = %', f, v;
    end if;
    if not (select prosecdef from pg_proc where oid = f) then
      raise exception 'NEXUS: % n''est pas SECURITY DEFINER', f;
    end if;
  end loop;

  -- La fonction de trigger : personne ne l'appelle directement.
  select string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' order by a.grantee::regrole::text)
    into v from pg_proc p, lateral aclexplode(p.proacl) a where p.oid = 'public.badge_refuser_doublon_partenaire()'::regprocedure;
  if v is distinct from 'postgres:EXECUTE,service_role:EXECUTE' then
    raise exception 'NEXUS: droits badge_refuser_doublon_partenaire = %', v;
  end if;

  -- La table : RLS, aucune policy, aucun privilège direct, aucun trigger.
  if not (select relrowsecurity from pg_class where oid = 'public.partner_athlete_badges'::regclass) then
    raise exception 'NEXUS: RLS inactive sur partner_athlete_badges';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partner_athlete_badges') then
    raise exception 'NEXUS: policy inattendue sur partner_athlete_badges';
  end if;
  if exists (select 1 from pg_class c, lateral aclexplode(c.relacl) a
              where c.oid = 'public.partner_athlete_badges'::regclass
                and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))) then
    raise exception 'NEXUS: privilège direct sur partner_athlete_badges';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.partner_athlete_badges'::regclass and not tgisinternal) then
    raise exception 'NEXUS: trigger inattendu sur partner_athlete_badges';
  end if;

  -- Les poses W3 : toutes rattachées à leur partenaire, aucune pose Nexus encore.
  select count(*) into n from public.partner_athlete_badges where partner_id is null;
  if n <> 0 then raise exception 'NEXUS: % pose(s) sans partner_id', n; end if;
  select count(*) into n from public.partner_athlete_badges x join public.partner_badges b on b.id = x.partner_badge_id
   where b.partner_id <> x.partner_id;
  if n <> 0 then raise exception 'NEXUS: % pose(s) dont partner_id contredit le badge', n; end if;
  select count(*) into n from public.partner_athlete_badges where badge_id is not null;
  if n <> 0 then raise exception 'NEXUS: % pose(s) Nexus déjà présentes', n; end if;
end $$;

-- ── 3. Enregistrement ──────────────────────────────────────────────────────
create temp table _w3b on commit drop as
select '${VERSION}'::text as version,
-- replace : un checkout Windows extrait ce fichier en CRLF ; le contenu
-- enregistré et son md5 sont ceux du blob git (LF).
replace($w3b$${contenu}$w3b$, E'\\r', '')::text as contenu;

do $$
begin
  if (select md5(contenu) from _w3b) <> '${md5}' then
    raise exception 'NEXUS: contenu W3b embarqué altéré (md5 %)', (select md5(contenu) from _w3b);
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, '${NOM}', array[contenu], 'bptds22@gmail.com' from _w3b;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_W3B_PARTENAIRE_BADGES_NEXUS',
       'W3b Partenaire : badges du catalogue Nexus attribués par un partenaire (hors plafond de 5), refus du doublon dans les deux sens et du mauvais sport (GO BP)',
       jsonb_build_object(
         'nom', '${NOM}',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_${NOM}.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_${NOM}.sql',
         'voie', 'psql -1 (session pooler) : relevé avant + migration + gardes dans une seule transaction',
         'md5_fichier', '${md5}',
         'acl_fonctions', 'authenticated,postgres,service_role (x6)',
         'poses_w3_rattachees', (select count(*) from public.partner_athlete_badges),
         'badge_plafond_et_m10', 'inchangés (md5 et triggers comparés au relevé avant)',
         'coach_bloque', 'trg_badge_deja_partenaire (BEFORE) : le coach ne pose pas un badge déjà attribué par un partenaire'),
       (select id from public.users where email = 'bptds22@gmail.com')
  from _w3b;

select version as version_w3b_enregistree from _w3b;
`;
writeFileSync(path.join(ICI, "w3b-gardes-et-enregistrement.sql"), gardes, "utf8");
console.log(`w3b-gardes-et-enregistrement.sql — migration embarquée, md5 ${md5}`);
