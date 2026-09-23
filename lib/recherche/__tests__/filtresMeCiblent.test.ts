/* ═══════════════════════════════════════════════════════════════
   LOT 5 — `?me_ciblent=true`.
   C'est le lien du bloc « N athlètes ciblent ton cégep » et de la future
   tuile du tableau de bord : la clé fait partie du contrat public des liens.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLES_FILTRES, FILTRES_DEFAUT, decoderFiltres, encoderFiltres } from "@/lib/recherche/filtres-url";

test("la clé d'URL est me_ciblent, et le défaut est faux", () => {
  assert.equal(CLES_FILTRES.meCiblent, "me_ciblent");
  assert.equal(FILTRES_DEFAUT.meCiblent, false);
});

test("décodage : vrai seulement sur la chaîne exacte \"true\"", () => {
  assert.equal(decoderFiltres(new URLSearchParams("me_ciblent=true")).meCiblent, true);
  for (const q of ["", "me_ciblent=", "me_ciblent=1", "me_ciblent=on", "me_ciblent=TRUE"]) {
    assert.equal(decoderFiltres(new URLSearchParams(q)).meCiblent, false, q);
  }
});

test("encodage : posé quand actif, omis au défaut, aller-retour stable", () => {
  assert.equal(encoderFiltres({ ...FILTRES_DEFAUT, meCiblent: true }), "me_ciblent=true");
  assert.equal(encoderFiltres({ ...FILTRES_DEFAUT }), "");
  const f = { ...FILTRES_DEFAUT, meCiblent: true, hideFavorites: true };
  assert.deepEqual(decoderFiltres(new URLSearchParams(encoderFiltres(f))), f);
});
