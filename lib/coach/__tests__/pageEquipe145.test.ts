/* C4 (1.4.5) — page d'équipe du coach : le web rattrape l'appli (droits, confirmation avant de retirer,
   erreurs dites), « Réactiver » existe enfin, plus de chargement sans fin, libellés de rôles communs,
   « + Créer » rattaché à l'équipe. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const WEB = "app/coach/equipes/[teamId]/PageClient.tsx";

test("C4 web : mêmes droits que l'appli (ajouter, rôle, retirer, informations)", () => {
  const w = lire(WEB);
  for (const extrait of [
    'canAddStaff: directorView || isReferentRole(rawRole) || rawRole === "ADMIN",',
    'canRemoveStaff: directorView || rawRole === "ADMIN",',
    "{team.canAddStaff && (",
    'canEdit={team.myRole === "ADMIN"}',
    "{team.canRemoveStaff && (retraitCoach === c.id ? (",
    '{team.myRole !== "ADMIN" ? (',
  ]) assert.ok(w.includes(extrait), extrait);
  assert.ok(!w.includes("                    canEdit\n"), "plus de rôle modifiable par tous");
});

test("C4 web : retirer un entraîneur se confirme, et chaque écriture dit son échec", () => {
  const w = lire(WEB);
  assert.ok(w.includes(">Confirmer le retrait</button>"));
  assert.ok(w.includes("onClick={() => setRetraitCoach(c.id)}"));
  for (const m of ["L'entraîneur n'a pas pu être ajouté.", "L'entraîneur n'a pas pu être retiré.", "Les informations n'ont pas pu être enregistrées.", "L'équipe n'a pas pu être désactivée.", "L'équipe n'a pas pu être réactivée."]) {
    assert.ok(w.includes(m), m);
  }
});

test("C4 : réactiver (web et appli), message au lieu du chargement sans fin", () => {
  const w = lire(WEB);
  assert.ok(w.includes('await supabase.from("teams").update({ is_active: true }).eq("id", teamId);'));
  assert.ok(w.includes("data-reactiver-equipe"));
  assert.ok(w.includes("Tu ne fais pas partie de cette équipe."));
  const m = lire("components/shared/CoachEquipeDetailMobile.tsx");
  assert.ok(m.includes("data-reactiver-equipe"));
  assert.ok(!m.includes("aux recruteurs. Réactive-la sur le web."), "le bandeau ne renvoie plus au web");
});

test("C4 : libellés de rôles communs et « + Créer » rattaché à l'équipe", () => {
  assert.ok(lire(WEB).includes("team.rawRole ? roleLabel(team.rawRole) : \"\","));
  assert.ok(!lire(WEB).includes('"Coach principal"'));
  const liste = lire("components/shared/CoachEquipesMobile.tsx");
  assert.ok(liste.includes("{roleLabel(c.role)}") && !liste.includes('"Coordo"'));
  assert.ok(lire(WEB).includes('onClick={() => poserEquipeACreer(teamId)}'));
  assert.ok(lire("components/shared/CoachEquipeDetailMobile.tsx").includes("poserEquipeACreer(teamId); router.push(\"/coach/athletes/create\");"));
  assert.ok(lire("app/coach/athletes/create/page.tsx").includes("prendreEquipeACreer(equipes.map((e) => e.id))"));
  assert.ok(lire("components/shared/AthleteWizardMobile.tsx").includes("prendreEquipeACreer(teams.map((e) => e.id))"));
});
