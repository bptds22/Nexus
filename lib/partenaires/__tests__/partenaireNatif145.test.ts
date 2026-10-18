/* 1.4.5 — le portail PARTENAIRE dans l'appli a un rendu NATIF (demande BP : « un feeling natif, pas
   web ») : plus de barre générique, transitions iOS, en-tête natif, écrans natifs pour l'Accueil et les
   onglets, chrome natif sur la fiche. Le web ne change pas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("layout de l'appli : transitions iOS par onglet, en-tête natif des écrans « Plus »", () => {
  const l = lire("app/partenaire/layout.tsx");
  assert.ok(l.includes("<AnimatedRoute tabs={ONGLETS_PARTENAIRE}>"));
  assert.ok(l.includes('{ index: 0, matchers: ["/partenaire"], exact: true },'));
  assert.ok(l.includes("{titreEnTete && <EnTeteMobilePartenaire titre={titreEnTete} />}"));
  assert.ok(lire("app/recruteur/_components/AnimatedRoute.tsx").includes("export function AnimatedRoute({ children, tabs = TAB_PATHS }"));
  assert.ok(lire("app/globals.css").includes("html.is-capacitor [data-ecran-plus] h1.font-head { display: none; }"));
});

test("pages : l'appli rend l'écran natif, le web garde le sien", () => {
  const cas: [string, string, string][] = [
    ["app/partenaire/page.tsx", "<AccueilPartenaireMobile />", "<AccueilPartenaireWeb />"],
    ["app/partenaire/mes-athletes/page.tsx", "<MesEvaluationsMobile />", "<MesEvaluationsWeb />"],
    ["app/partenaire/prospects/page.tsx", "<MesAthletesMobile />", "<MesAthletesWeb />"],
  ];
  for (const [f, mobile, web] of cas) {
    const src = lire(f);
    assert.ok(src.includes("IS_CAPACITOR ?") && src.includes(mobile) && src.includes(web), f);
  }
  assert.ok(lire("components/partenaire/PartnerAthletesSearch.tsx").includes('<EnTeteMobilePartenaire titre="Recherche" />'));
  assert.ok(lire("app/partenaire/athletes/[id]/PageClient.tsx").includes("EnTeteMobilePartenaire"));
});

test("écrans natifs : en-tête natif, pas de confirmation native ni de spinner web", () => {
  for (const f of [
    "components/partenaire/mobile/MesEvaluationsMobile.tsx",
    "components/partenaire/mobile/MesAthletesMobile.tsx",
  ]) {
    const src = lire(f);
    assert.ok(src.includes("EnTeteMobilePartenaire"), f);
    assert.ok(src.includes("useMobileToast"), f);
    assert.ok(!src.includes("confirm(") && !src.includes("animate-spin"), f);
  }
  assert.ok(lire("components/partenaire/mobile/MesAthletesMobile.tsx").includes("ConfirmSheet"));
});
