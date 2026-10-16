/* Sous-lot mobile A1 — recherche de club (déjà sur main, fix/inscription-club-d-abord) :
   les deux inscriptions mobiles passent par lib/clubs/clubCorrespond, chargent TOUS
   les clubs civils (sinon « nls » pourrait tomber hors de la page chargée), et
   « + Créer un nouveau club » n'apparaît qu'après une recherche sans résultat. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filtrerClubs, peutCreerClub } from "@/lib/clubs/clubCorrespond";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const COACH = "components/shared/CoachOnboardingMobileCivil.tsx";
const ATHLETE = "components/shared/AthleteOnboardingMobile.tsx";

test("« nls » trouve No Limits Showcases parmi ~270 clubs, et ne propose pas de créer", () => {
  const clubs = Array.from({ length: 270 }, (_, i) => ({ name: `Club ${i}`, city: "Laval" }));
  clubs.splice(180, 0, { name: "No Limits Showcases", city: "Montréal" });
  assert.deepEqual(filtrerClubs(clubs, "nls").map((c) => c.name), ["No Limits Showcases"]);
  assert.equal(peutCreerClub("nls", clubs), false);
  assert.equal(peutCreerClub("", clubs), false);
  assert.equal(peutCreerClub("club qui n'existe pas", clubs), true);
});

test("mobile coach civil : recherche commune, bouton de création gardé par peutCreerClub", () => {
  const src = lire(COACH);
  assert.match(src, /filtrerClubs\(clubs, clubSearch\)/);
  assert.match(src, /footer=\{!clubsLoading && peutCreerClub\(clubSearch, clubs\) \?/);
  assert.equal((src.match(/\+ Créer un nouveau club/g) ?? []).length, 1, "un seul bouton, celui du footer gardé");
});

test("mobile athlète : recherche commune (nom, ville, sigle)", () => {
  assert.match(lire(ATHLETE), /filtrerClubs\(civilClubs, clubSearch\)/);
});

test("les deux écrans chargent tous les clubs civils, sans limite de page", () => {
  for (const f of [COACH, ATHLETE]) {
    const src = lire(f);
    const bloc = /\.eq\("type", "LIGUE_CIVILE"\)\s*\n\s*\.order\("name"\);/;
    assert.match(src, bloc, f);
  }
});
