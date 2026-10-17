/* Carte des matchs dans l'appli (§77) — recruteur ET partenaire. Un seul
   composant (components/carte-matchs/CarteMatchs.tsx), la même logique que le
   web ; seule la hauteur réserve la barre d'onglets sous Capacitor. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hauteurSousOnglets, ZONE_ONGLETS } from "@/lib/mobile/zoneOnglets";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("hauteur : le web garde son calcul à l'identique, l'appli retire la barre d'onglets", () => {
  assert.equal(hauteurSousOnglets(212.4, false), "calc(100dvh - 212px)");
  assert.equal(hauteurSousOnglets(-5, false), "calc(100dvh - 0px)");
  assert.equal(hauteurSousOnglets(212.4, true), "calc(100dvh - 212px - calc(env(safe-area-inset-bottom) + 88px))");
  // La même zone que les layouts de l'appli réservent sous leur contenu.
  assert.equal(ZONE_ONGLETS, "calc(env(safe-area-inset-bottom) + 88px)");
  for (const l of ["app/recruteur/layout.tsx", "app/partenaire/layout.tsx"]) {
    assert.ok(lire(l).includes(`"${ZONE_ONGLETS}"`), l);
  }
});

test("composant partagé : hauteur par la règle, sous Capacitor seulement", () => {
  const src = lire("components/carte-matchs/CarteMatchs.tsx");
  assert.match(src, /const IS_CAPACITOR = process\.env\.NEXT_PUBLIC_CAPACITOR_BUILD === "true";/);
  assert.match(src, /setHauteur\(hauteurSousOnglets\(top, IS_CAPACITOR\)\);/);
  assert.doesNotMatch(src, /setHauteur\(`calc\(100dvh/);
});

test("recruteur : plus de renvoi au Calendrier dans l'appli, même porte Pro que le web", () => {
  const src = lire("app/recruteur/carte-matchs/page.tsx");
  assert.doesNotMatch(src, /IS_CAPACITOR/);
  assert.doesNotMatch(src, /router\.replace\("\/recruteur\/calendrier"\)/);
  assert.match(src, /<FeatureGate feature="recruiting_calendar" requiredTier="pro">\s*<CarteMatchs mode="recruteur" \/>\s*<\/FeatureGate>/);
});

test("menu « Plus » recruteur : Carte des matchs après Calendrier, sans verrou", () => {
  const src = lire("app/_components/mobile/MorePanel.tsx");
  const cal = src.indexOf('{ key: "calendrier", label: "Calendrier", href: "/recruteur/calendrier"');
  const carte = src.indexOf('{ key: "carte-matchs", label: "Carte des matchs", href: "/recruteur/carte-matchs", icon: Icons.calendar }');
  assert.ok(cal > 0 && carte > cal, "après Calendrier");
  assert.doesNotMatch(src.slice(carte, src.indexOf("\n", carte)), /requiredTier/);
  // Le partenaire garde la sienne.
  assert.match(src, /\{ key: "carte-matchs", label: "Carte des matchs", href: "\/partenaire\/carte-matchs", icon: Icons\.calendar \}/);
});
