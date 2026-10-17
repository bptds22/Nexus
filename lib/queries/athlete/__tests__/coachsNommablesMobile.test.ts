/* Coachs nommables — côté MOBILE (onboarding athlète) : même porte que le web
   (coachs_nommables_equipe), section « Mon coach » absente pour une école non secondaire. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("mobile : coachs d'équipe par coachs_nommables_equipe, section « Mon coach » gardée par ecoleNommable", () => {
  const src = lire("components/shared/AthleteOnboardingMobile.tsx");
  assert.match(src, /chargerCoachsNommablesEquipe\(createClient\(\), selectedTeamId\)/);
  assert.doesNotMatch(src, /\.from\("team_coaches"\)/);
  // Point 9, option A (BP 2026-10-17) : l'entraîneur-chef en lecture seule remplace la liste « Mon coach ».
  assert.match(src, /\{p\.selectedTeamId && p\.ecoleNommable && p\.teamCoachesLoaded && entraineurChefNommable\(p\.teamCoaches\) && \(/);
  assert.doesNotMatch(src, /<SectionTitle>Mon coach<\/SectionTitle>|Continuer sans coach/);
  assert.match(src, /setEcoleNommable\(equipeNommable\(t\.schoolType\)\)/);
  assert.match(src, /const noms = nomsAffichablesCode\(t\);/);
});
