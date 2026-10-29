/* Critères automatiques de Mon parcours (point 5, BP 2026-10-29) : les règles pures. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { instagramPresent, chiffresRemplis, videoRecente, profilVerifie, programmeUniversitaireChoisi, lireFaits, FAITS_VIDES }
  from "@/lib/athlete/criteresParcours";

test("Instagram présent : un lien non vide", () => {
  assert.equal(instagramPresent("https://instagram.com/x"), true);
  assert.equal(instagramPresent("   "), false);
  assert.equal(instagramPresent(null), false);
});

test("chiffres : au moins 2 tests physiques remplis", () => {
  assert.equal(chiffresRemplis(["4.8", null, "", undefined, null, null]), false);
  assert.equal(chiffresRemplis(["4.8", "30", null, null, null, null]), true);
  assert.equal(chiffresRemplis([" ", "  ", null, null, null, null]), false);
});

test("vidéo de moins de 12 mois : lien ET date de mise à jour récente", () => {
  const maintenant = new Date("2026-10-29T12:00:00Z");
  assert.equal(videoRecente("https://youtu.be/a", "2026-01-01T00:00:00Z", maintenant), true);
  assert.equal(videoRecente("https://youtu.be/a", "2025-10-30T00:00:00Z", maintenant), true);
  assert.equal(videoRecente("https://youtu.be/a", "2025-10-28T00:00:00Z", maintenant), false);
  assert.equal(videoRecente("https://youtu.be/a", null, maintenant), false);
  assert.equal(videoRecente("", "2026-10-01T00:00:00Z", maintenant), false);
  assert.equal(videoRecente("https://youtu.be/a", "pas une date", maintenant), false);
});

test("profil vérifié : crochet ET validation du mois pas expirée", () => {
  const apresLe15 = new Date(2026, 9, 29, 12);
  const avantLe15 = new Date(2026, 9, 10, 12);
  assert.equal(profilVerifie(true, new Date(2026, 9, 2).toISOString(), apresLe15), true);
  assert.equal(profilVerifie(true, new Date(2026, 8, 20).toISOString(), apresLe15), false);
  assert.equal(profilVerifie(true, new Date(2026, 8, 20).toISOString(), avantLe15), true);
  assert.equal(profilVerifie(false, new Date(2026, 9, 2).toISOString(), apresLe15), false);
  assert.equal(profilVerifie(true, null, apresLe15), false);
});

test("programme universitaire visé : catalogue ou texte libre", () => {
  assert.equal(programmeUniversitaireChoisi("uuid", null), true);
  assert.equal(programmeUniversitaireChoisi(null, "Médecine vétérinaire"), true);
  assert.equal(programmeUniversitaireChoisi(null, null), false);
});

test("faits de la base : toute forme inattendue vaut « tout faux »", () => {
  assert.deepEqual(lireFaits(null), FAITS_VIDES);
  assert.deepEqual(lireFaits("x"), FAITS_VIDES);
  assert.deepEqual(lireFaits({ repondu_recruteur: true, echange_recruteur_universitaire: "oui", visite: true }),
    { repondu_recruteur: true, echange_recruteur_universitaire: false, visite: true });
});
