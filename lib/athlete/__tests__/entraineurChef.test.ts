/* Point 9, option A (BP 2026-10-17) — la liste « Mon coach » disparaît des écrans
   athlète ; « Ton entraîneur-chef : X » en lecture seule, seulement s'il est
   nommable. Aucun changement en base ni à l'aiguillage des recruteurs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { entraineurChefNommable, texteEntraineurChef } from "@/lib/athlete/entraineurChef";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const c = (role: string, first_name: string | null, last_name: string | null) => ({ role, first_name, last_name });

test("la règle : le chef, puis l'intérim ; jamais un adjoint ni un coordonnateur ; liste vide = rien", () => {
  assert.equal(entraineurChefNommable([c("assistant", "Ana", "B"), c("head_coach", "Marc", "Roy")]), "Marc Roy");
  assert.equal(entraineurChefNommable([c("head_coach_interim", "Lia", "T"), c("assistant", "Ana", "B")]), "Lia T");
  assert.equal(entraineurChefNommable([c("assistant", "Ana", "B"), c("coordinator", "Zoé", "C")]), null);
  // Non nommable = absent de coachs_nommables_equipe (filtre RSEQ en base) : liste vide → rien.
  assert.equal(entraineurChefNommable([]), null);
  assert.equal(entraineurChefNommable([c("head_coach", null, " ")]), null);
  assert.equal(texteEntraineurChef("Marc Roy"), "Ton entraîneur-chef : Marc Roy");
});

test("la ligne passe par coachs_nommables_equipe (la seule porte), et ne rend rien sans chef nommable", () => {
  const comp = lire("components/athlete/EntraineurChefLecture.tsx");
  assert.match(comp, /chargerCoachsNommablesEquipe\(createClient\(\), teamId\)/);
  assert.match(comp, /if \(!nom\) return null;/);
  assert.doesNotMatch(comp, /\.from\(|\.update\(|\.insert\(/, "lecture seule, aucune écriture");
});

test("les quatre écrans : plus de liste ni de changement de coach, la ligne en lecture seule", () => {
  const web = lire("app/athlete/onboarding/page.tsx");
  assert.doesNotMatch(web, /CoachPicker|Sélectionne ton coach actuel/);
  const par = lire("app/athlete/parametres/page.tsx");
  assert.doesNotMatch(par, /CoachPicker|CivilCoachPicker|Changer de coach|Sélectionner un coach|Retirer ton coach|\.update\(\{ coach_id/);
  assert.match(par, /<EntraineurChefLecture\n\s*teamId=\{profile\?\.leagueTeamId\}/);
  const mob = lire("components/shared/AthleteOnboardingMobile.tsx");
  assert.equal((mob.match(/texteEntraineurChef\(entraineurChefNommable\(p\.teamCoaches\)!\)/g) ?? []).length, 2);
  assert.doesNotMatch(mob, /p\.onSelectCoach\(c\)|Continuer sans coach/);
  const parMob = lire("components/shared/AthleteParametresMobile.tsx");
  assert.match(parMob, /const entraineurChef = useEntraineurChef\(profile\?\.teamId\);/);
  assert.match(parMob, /\{entraineurChef && \(/);
  assert.doesNotMatch(parMob, /Tu peux sélectionner un coach depuis le web|Aucun coach assigné/);
});
