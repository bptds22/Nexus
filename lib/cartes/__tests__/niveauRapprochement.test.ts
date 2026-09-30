import { test } from "node:test";
import assert from "node:assert/strict";
import { niveauRapprochement, libelleNiveau, differences } from "@/lib/cartes/niveauRapprochement";

test("trois niveaux, décision BP 2026-09-30", () => {
  assert.equal(libelleNiveau(niveauRapprochement("COURRIEL")), "Correspondance confirmée par le courriel");
  assert.equal(libelleNiveau(niveauRapprochement("COURRIEL_PARENT")), "Correspondance confirmée par le courriel");
  assert.equal(libelleNiveau(niveauRapprochement("EQUIPE")), "Correspondance : même nom, même équipe");
  for (const c of ["EQUIPE_PROCHE", "ECOLE", "ECOLE_PROCHE"] as const) {
    assert.equal(libelleNiveau(niveauRapprochement(c)), "Possiblement le même athlète", c);
  }
});

test("aucun libellé « probable » ou « possible » nu", () => {
  for (const c of ["COURRIEL", "COURRIEL_PARENT", "EQUIPE", "EQUIPE_PROCHE", "ECOLE", "ECOLE_PROCHE"] as const) {
    assert.doesNotMatch(libelleNiveau(niveauRapprochement(c)), /^Correspondance (probable|possible)$/);
  }
});

const base = {
  carte_prenom: "Lea", carte_nom: "Gagno", carte_equipe: "Demo Cyclones M18", carte_promotion: 2027,
  athlete_prenom: "Léa", athlete_nom: "Gagnon", athlete_equipes: "Demo Cyclones M18", athlete_promotion: 2027,
  promotion_concorde: true,
};

test("ce qui diffère : le nom (accents et casse ignorés)", () => {
  assert.deepEqual(differences(base), ["Nom : « Lea Gagno » sur la carte, « Léa Gagnon » sur Nexus"]);
  assert.deepEqual(differences({ ...base, carte_nom: "GAGNON" }), []);
});

test("ce qui diffère : l'équipe (école sans la même équipe) et la promotion", () => {
  const d = differences({ ...base, carte_nom: "Gagnon", athlete_equipes: null, promotion_concorde: false, athlete_promotion: 2026 });
  assert.deepEqual(d, [
    "Équipe : Demo Cyclones M18 sur la carte, aucune équipe sur Nexus",
    "Promotion : 2027 sur la carte, 2026 sur Nexus",
  ]);
  assert.deepEqual(differences({ ...base, carte_nom: "Gagnon", athlete_equipes: "Autre équipe · Demo Cyclones M18" }), []);
});
