/* « Ajouter à mes cibles » masqué pour un PARTENAIRE — pages école et équipe,
   web et appli, par une seule règle (lib/cibles/visibiliteBouton.ts) lue dans
   le hook partagé useSchoolTargets. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { boutonCiblesVisible } from "@/lib/cibles/visibiliteBouton";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("règle : partenaire masqué, rien avant la lecture de session, les autres inchangés", () => {
  assert.equal(boutonCiblesVisible(true, "PARTNER"), false);
  assert.equal(boutonCiblesVisible(false, null), false);
  assert.equal(boutonCiblesVisible(false, "ATHLETE"), false);
  assert.equal(boutonCiblesVisible(true, "ATHLETE"), true);
  assert.equal(boutonCiblesVisible(true, null), true); // visiteur déconnecté
  assert.equal(boutonCiblesVisible(true, "RECRUITER"), true);
});

test("hook partagé : rôle lu dans users, `visible` rendu par la règle", () => {
  const src = lire("lib/queries/schoolPage/useSchoolTargets.ts");
  assert.match(src, /\.from\("users"\)\.select\("role"\)\.eq\("id", user\.id\)\.maybeSingle\(\)/);
  assert.match(src, /visible: boutonCiblesVisible\(viewer\.resolu, viewer\.role\)/);
});

test("page école : web (Suivre + bande CTA) et appli (pilule) suivent `visible`", () => {
  const web = lire("components/program-page/ProgramPage.tsx");
  assert.match(web, /visible: ciblesVisibles, toggle: toggleTargets \} = useSchoolTargets\(/);
  assert.match(web, /followers=\{followers\} ciblesVisibles=\{ciblesVisibles\} \/>/);
  assert.match(web, /\{ciblesVisibles && <CtaCibles /);
  assert.match(lire("components/program-page/StatRows.tsx"), /\{ciblesVisibles && <div className="hfollow rv">/);
  const mob = lire("components/program-page/ProgramPageMobile.tsx");
  assert.match(mob, /visible: ciblesVisibles, toggle: toggleTargets \} = useSchoolTargets\(/);
  assert.match(mob, /\{ciblesVisibles && <PiluleCibles /);
});

test("page équipe : web (hero, besoins) et appli (besoins, pilule) suivent `visible`", () => {
  const web = lire("components/team-page/TeamPage.tsx");
  assert.match(web, /<TeamHero [^>]*ciblesVisibles=\{targets\.visible\} \/>/);
  assert.match(web, /<BesoinsWidget [^>]*ciblesVisibles=\{targets\.visible\} \/>/);
  assert.match(lire("components/team-page/TeamHero.tsx"), /\{ciblesVisibles && <>\n\s*<button type="button" className=\{`cibles/);
  assert.match(lire("components/team-page/BesoinsWidget.tsx"), /ms\?\.kind === "none" && ciblesVisibles && \(/);
  const mob = lire("components/team-page/TeamPageMobile.tsx");
  assert.match(mob, /<BesoinsMobile [^>]*ciblesVisibles=\{targets\.visible\} \/>/);
  assert.match(mob, /\{targets\.visible && <PiluleCibles /);
  assert.match(mob, /ms\?\.kind === "none" && ciblesVisibles && \(/);
});
