/* Suite — lib/recherche/journalFiltres.ts (télémétrie des filtres).

   Couvre la règle qui décide ce qui part dans `search_filter_events` :
   ce qui s'écrit, ce qui ne s'écrit jamais (le texte recherché), et ce qui
   serait refusé par le CHECK de la table.

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/recherche/__tests__/*.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import { changementsAJournaliser, LONGUEUR_MAX_VALEUR } from "../journalFiltres.ts";
import { FILTRES_DEFAUT, type FiltresRecherche } from "../filtres-url.ts";

const base = (): FiltresRecherche => ({ ...FILTRES_DEFAUT, progFilterIds: [] });

test("activer un menu écrit sa valeur", () => {
  assert.deepEqual(
    changementsAJournaliser(base(), { ...base(), sport: "football" }, FILTRES_DEFAUT),
    [["sport", "football"]],
  );
});

test("changer de valeur écrit la nouvelle", () => {
  const avant = { ...base(), promotion: "2027" };
  assert.deepEqual(
    changementsAJournaliser(avant, { ...avant, promotion: "2028" }, FILTRES_DEFAUT),
    [["promotion", "2028"]],
  );
});

test("une case cochée écrit « on »", () => {
  assert.deepEqual(
    changementsAJournaliser(base(), { ...base(), verifiedOnly: true }, FILTRES_DEFAUT),
    [["verifiedOnly", "on"]],
  );
});

test("un retour au défaut n'écrit rien — purges automatiques et reset compris", () => {
  const avant = { ...base(), sport: "football", position: "QB", verifiedOnly: true, sortBy: "name_asc" };
  assert.deepEqual(changementsAJournaliser(avant, base(), FILTRES_DEFAUT), []);
});

test("un tri non défaut s'écrit, le retour à « Meilleure cote » non", () => {
  assert.deepEqual(
    changementsAJournaliser(base(), { ...base(), sortBy: "grad_asc" }, FILTRES_DEFAUT),
    [["sortBy", "grad_asc"]],
  );
});

test("LE TEXTE RECHERCHÉ NE PART JAMAIS — seule la transition vide → rempli, en « on »", () => {
  const tape = { ...base(), search: "Gabriel Mandziuk" };
  const evts = changementsAJournaliser(base(), tape, FILTRES_DEFAUT);
  assert.deepEqual(evts, [["search", "on"]]);
  assert.ok(!JSON.stringify(evts).includes("Gabriel"));
});

test("continuer de taper n'écrit rien de plus", () => {
  const avant = { ...base(), search: "Gab" };
  assert.deepEqual(
    changementsAJournaliser(avant, { ...avant, search: "Gabriel" }, FILTRES_DEFAUT),
    [],
  );
});

test("des espaces seuls ne comptent pas comme une recherche", () => {
  assert.deepEqual(
    changementsAJournaliser(base(), { ...base(), search: "   " }, FILTRES_DEFAUT),
    [],
  );
});

test("les programmes s'écrivent comme un NOMBRE, jamais les libellés", () => {
  const evts = changementsAJournaliser(
    base(), { ...base(), progFilterIds: ["lib-uuid-1", "lib-uuid-2"] }, FILTRES_DEFAUT);
  assert.deepEqual(evts, [["progFilterIds", "2"]]);
});

test("un tableau identique par contenu (nouvelle référence) n'écrit rien", () => {
  const avant = { ...base(), progFilterIds: ["a"] };
  assert.deepEqual(
    changementsAJournaliser(avant, { ...avant, progFilterIds: ["a"] }, FILTRES_DEFAUT),
    [],
  );
});

test("plusieurs changements dans le même rendu : une paire chacun", () => {
  const evts = changementsAJournaliser(
    base(), { ...base(), orgType: "ligue_civile", leagueFilter: "lfmm" }, FILTRES_DEFAUT);
  assert.deepEqual(evts, [["orgType", "ligue_civile"], ["leagueFilter", "lfmm"]]);
});

test("une valeur trop longue est tronquée au CHECK de la table", () => {
  const [[, valeur]] = changementsAJournaliser(
    base(), { ...base(), region: "x".repeat(200) }, FILTRES_DEFAUT);
  assert.equal(valeur.length, LONGUEUR_MAX_VALEUR);
});

test("sous-ensemble de clés (roster coach) avec FILTRES_DEFAUT complet", () => {
  const coachAvant = { search: "", sport: "", minRating: "", filterNewOnly: false };
  const coachApres = { ...coachAvant, minRating: "4", filterNewOnly: true };
  assert.deepEqual(
    changementsAJournaliser(coachAvant, coachApres, FILTRES_DEFAUT),
    [["minRating", "4"], ["filterNewOnly", "on"]],
  );
});
