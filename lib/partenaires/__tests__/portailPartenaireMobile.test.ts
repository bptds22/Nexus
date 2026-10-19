/* B1 de la 1.4.5 — le portail partenaire dans l'APPLI : navigation, retrait des
   blocages « web seulement », garde d'accès refaite côté client, journal par
   fonction en base, fiche (évaluation, badges, carte). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { doitPasserParBienvenue, portailDuRole, ROUTE_BIENVENUE } from "@/lib/partenaires/accesPartenaire";
import { entreeVisible } from "@/lib/partenaires/navigation";
import { matchDynamicRoute } from "@/lib/platform/mobileRoutes";
import { isTabBarHidden } from "@/app/_components/mobile/tabBarVisibility";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/* ── Règles partagées ──────────────────────────────────────── */

test("bienvenue : conditions acceptées ET mot de passe posé, sinon l'écran de bienvenue", () => {
  assert.equal(doitPasserParBienvenue({ terms_accepted_at: "2026-10-01", password_reset_completed_at: "2026-10-01" }), false);
  assert.equal(doitPasserParBienvenue({ terms_accepted_at: null, password_reset_completed_at: "2026-10-01" }), true);
  assert.equal(doitPasserParBienvenue({ terms_accepted_at: "2026-10-01", password_reset_completed_at: null }), true);
  assert.equal(ROUTE_BIENVENUE, "/partenaire/bienvenue");
});

test("autre rôle : renvoyé à son portail, comme avant", () => {
  assert.equal(portailDuRole("COACH"), "/coach/tableau-de-bord");
  assert.equal(portailDuRole("RECRUTEUR"), "/recruteur/tableau-de-bord");
  assert.equal(portailDuRole("ATHLETE"), "/athlete/dashboard");
  assert.equal(portailDuRole("ADMIN"), "/admin/dashboard");
  assert.equal(portailDuRole("PARENT"), "/");
});

test("navigation : Mes athlètes et Mes prospects seulement si le partenaire peut évaluer", () => {
  assert.equal(entreeVisible("/partenaire/mes-athletes", true), true);
  assert.equal(entreeVisible("/partenaire/mes-athletes", false), false);
  assert.equal(entreeVisible("/partenaire/prospects", null), false);
  assert.equal(entreeVisible("/partenaire/newsroom", false), true);
});

test("fiche partenaire : route dynamique de l'appli (shell placeholder)", () => {
  const m = matchDynamicRoute("/partenaire/athletes/1d06342e-a138-4a88-97ed-d8a9a102428f/");
  assert.equal(m?.placeholderPath, "/partenaire/athletes/placeholder/");
  assert.equal(m?.paramKey, "id");
  assert.equal(m?.realId, "1d06342e-a138-4a88-97ed-d8a9a102428f");
});

test("barre d'onglets : masquée sur l'écran de bienvenue, visible ailleurs", () => {
  assert.equal(isTabBarHidden("partenaire", "/partenaire/bienvenue"), true);
  assert.equal(isTabBarHidden("partenaire", "/partenaire"), false);
  assert.equal(isTabBarHidden("partenaire", "/partenaire/mes-athletes"), false);
});

/* ── Les blocages retirés ──────────────────────────────────── */

test("blocages retirés : build, layout, registre des routes exclues", () => {
  const build = lire("scripts/build-mobile.mjs");
  assert.doesNotMatch(build, /^\s*'app\/partenaire\/\*\*\/page\.tsx',/m);
  // Ce qui reste web seulement, à dessein : le profil public et le lien /p/.
  assert.match(build, /'app\/partenaires\/\\\\\[id\\\\\]\/page\.tsx'/);
  assert.match(build, /'app\/p\/\\\\\[jeton\\\\\]\/page\.tsx'/);
  const layout = lire("app/partenaire/layout.tsx");
  assert.doesNotMatch(layout, /notFound\(\)/);
  const registre = lire("lib/build/mobile-excluded-routes.ts");
  assert.doesNotMatch(registre, /^\s*'\/partenaire',/m);
});

test("aucune page du portail n'est un composant serveur (l'export statique les refuse)", () => {
  const pages: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(join(process.cwd(), d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) parcourir(p);
      else if (e.name === "page.tsx") pages.push(p);
    }
  };
  parcourir("app/partenaire");
  assert.equal(pages.length, 13); // + /partenaire/depistage (2026-10-19)
  for (const p of pages) {
    const src = lire(p);
    assert.doesNotMatch(src, /lib\/supabase\/server/, p);
    assert.doesNotMatch(src, /export default async function/, p);
    assert.doesNotMatch(src, /searchParams: Promise/, p);
  }
  for (const p of ["newsroom", "tendances", "classements", "telechargements", "athletes"]) {
    assert.match(lire(`app/partenaire/${p}/page.tsx`), /return <PageChargee rendre=\{rendre\} \/>;/, p);
  }
});

/* ── Navigation et garde ───────────────────────────────────── */

test("barre d'onglets et panneau Plus : le rôle partenaire existe", () => {
  const tab = lire("app/_components/mobile/MobileTabBar.tsx");
  assert.match(tab, /partenaire: PARTENAIRE_TABS,/);
  assert.match(tab, /TABS_BY_ROLE\.partenaire\.filter\(\(t\) => entreeVisible\(t\.href, peutEvaluer\)\)/);
  assert.match(tab, /if \(tab\.exact\) return normalizedPath === tab\.href;/);
  const plus = lire("app/_components/mobile/MorePanel.tsx");
  for (const href of ["/partenaire/newsroom", "/partenaire/tendances", "/partenaire/classements", "/partenaire/carte-matchs", "/partenaire/telechargements", "/partenaire/profil"]) {
    assert.ok(plus.includes(`href: "${href}"`), href);
  }
  assert.match(lire("app/partenaire/_components/PartnerSidebar.tsx"), /entreeVisible\(item\.href, partner\?\.peut_evaluer\)/);
  assert.match(lire("app/college/layout.tsx"), /PARTNER: "partenaire",/);
});

test("garde d'accès : la même règle au middleware (web) et au layout (web ET appli)", () => {
  const mw = lire("middleware.ts");
  assert.match(mw, /if \(doitPasserParBienvenue\(partner\)\) \{/);
  const layout = lire("app/partenaire/layout.tsx");
  assert.match(layout, /lireAccesPartenaire\(createClient\(\), pathname\)/);
  assert.match(layout, /else router\.replace\(ROUTE_BIENVENUE\);/);
  assert.match(layout, /<MobileTabBar role="partenaire" \/>/);
});

/* ── Journal et fiche ──────────────────────────────────────── */

test("journal : fonction en base, plus de route API", () => {
  assert.equal(existsSync(join(process.cwd(), "app/api/partner/profile-views/log/route.ts")), false);
  assert.equal(existsSync(join(process.cwd(), "app/api/partner/cards/log-download/route.ts")), false);
  const journal = lire("lib/partenaires/journal.ts");
  assert.match(journal, /rpc\("partenaire_journaliser", \{ p_athlete_id: athleteId, p_action: "VUE" \}\)/);
  assert.match(journal, /p_action: "TELECHARGEMENT", p_format: format/);
  const mig = lire("supabase/migrations/20261016150000_partenaire_journal.sql");
  assert.match(mig, /security definer/);
  assert.match(mig, /mp\.user_id = auth\.uid\(\) and mp\.status = 'APPROVED'/);
  assert.match(mig, /is_partner_eligible_athlete\(p_athlete_id\)/);
});

test("fiche : id par useDynamicParam, journal avant la carte, carte par la feuille de partage", () => {
  const src = lire("app/partenaire/athletes/[id]/PageClient.tsx");
  assert.match(src, /const id = useDynamicParam\("id"\);/);
  assert.doesNotMatch(src, /fetch\("\/api\/partner/);
  assert.match(src, /void journaliserVue\(supabase, id\);/);
  const i = src.indexOf("journaliserTelechargement(supabase, id, format)");
  const j = src.indexOf("await toPng(node, options)");
  assert.ok(i > 0 && j > i, "le téléchargement est journalisé AVANT la capture");
  assert.match(src, /enregistrerImage\(\{ dataUrl, nomFichier: filename/);
  // Évaluation et badges : les mêmes composants que le web.
  assert.match(src, /<ActionsPartenaireFiche/);
  assert.match(src, /<EvaluerAthleteModal/);
  assert.match(src, /<AthleteRecruiterProfileBody athleteId=\{id\} viewerMode="partner" \/>/);
});

test("enregistrerImage : une seule branche native, partagée avec Mon parcours", () => {
  const lib = lire("lib/partage/enregistrerImage.ts");
  assert.match(lib, /Filesystem\.writeFile\(/);
  assert.match(lib, /Share\.share\(\{ title: opts\.titre, files: \[ecrit\.uri\]/);
  const mp = lire("components/shared/MonParcoursMobile.tsx");
  assert.doesNotMatch(mp, /import\("@capacitor\/filesystem"\)/);
  assert.match(mp, /await enregistrerImage\(\{/);
});
