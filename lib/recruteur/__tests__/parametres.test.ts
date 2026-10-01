import { test } from "node:test";
import assert from "node:assert/strict";
import {
  payloadMonProfil, payloadCompte, marketingAccepte, fusionnerConsentementMarketing, messageErreurSauvegarde, messagePhoto,
} from "@/lib/recruteur/parametres";

const MAINTENANT = "2026-10-01T18:00:00.000Z";

test("Mon profil n'envoie jamais le cégep ni le sport", () => {
  const p = payloadMonProfil({ firstName: " Léa ", lastName: "Roy", title: "Recruteur", division: "Division 1", teamName: "", region: "" });
  assert.deepEqual(Object.keys(p).sort(), ["division", "first_name", "last_name", "region", "team_name", "title"]);
  assert.equal(p.first_name, "Léa");
  assert.equal(p.team_name, null);
  assert.ok(!("school_id" in p) && !("sport" in p) && !("sport_id" in p));
});

test("Compte n'envoie que nom et téléphone", () => {
  assert.deepEqual(Object.keys(payloadCompte({ firstName: "A", lastName: "B", phone: "" })).sort(), ["first_name", "last_name", "phone"]);
});

test("la bascule marketing lit la DATE, pas le booléen", () => {
  assert.equal(marketingAccepte({ consent_marketing: "2026-07-09T14:18:07.092Z" }), true);
  assert.equal(marketingAccepte({ consent_marketing: null }), false);
  assert.equal(marketingAccepte({}), false);
  assert.equal(marketingAccepte(null), false);
});

test("fusion : les autres clés et les dates d'inscription restent intactes", () => {
  const actuel = {
    consent_privacy_policy: "2026-07-01T10:00:00Z", consent_data_collection: "2026-07-01T10:00:00Z",
    consent_parental_profile: "2026-07-01T10:00:00Z", profile_visible: false,
  };
  const r = fusionnerConsentementMarketing(actuel, true, MAINTENANT);
  assert.equal(r.consent_privacy_policy, "2026-07-01T10:00:00Z");
  assert.equal(r.consent_data_collection, "2026-07-01T10:00:00Z");
  assert.equal(r.consent_parental_profile, "2026-07-01T10:00:00Z");
  assert.equal(r.profile_visible, false);
  assert.equal(r.consent_marketing, MAINTENANT);
});

test("fusion : JAMAIS de date fabriquée pour la politique ou la collecte", () => {
  const r = fusionnerConsentementMarketing({}, false, MAINTENANT);
  assert.ok(!("consent_privacy_policy" in r) && !("consent_data_collection" in r));
  const r2 = fusionnerConsentementMarketing(null, true, MAINTENANT);
  assert.ok(!("consent_privacy_policy" in r2) && !("consent_data_collection" in r2));
});

test("fusion : une acceptation existante garde SA date", () => {
  const r = fusionnerConsentementMarketing({ consent_marketing: "2026-07-09T14:18:07.092Z" }, true, MAINTENANT);
  assert.equal(r.consent_marketing, "2026-07-09T14:18:07.092Z");
});

test("fusion : retirer met la date à null (geste explicite)", () => {
  assert.equal(fusionnerConsentementMarketing({ consent_marketing: "2026-07-09T14:18:07.092Z" }, false, MAINTENANT).consent_marketing, null);
});

test("erreurs : jamais le texte brut ; un refus RLS renvoie à info@", () => {
  const m = messageErreurSauvegarde({ code: "42501", message: 'new row violates row-level security policy for table "users"' });
  assert.match(m, /info@nexussports\.ca/);
  assert.doesNotMatch(m, /row-level|policy|violates/);
  assert.match(messageErreurSauvegarde({ message: "TypeError: Failed to fetch" }), /Connexion interrompue/);
  assert.doesNotMatch(messageErreurSauvegarde({ code: "PGRST116", message: "JSON object requested" }), /JSON|PGRST/);
});

test("photo : une erreur de Storage ne s'affiche jamais brute", () => {
  assert.match(messagePhoto({ code: "UPLOAD_FAILED", message: "boom" }), /envoi de la photo a échoué/);
  assert.equal(messagePhoto({ code: "INVALID_TYPE", message: "Format non supporté — image requise (JPG, PNG…)." }), "Format non supporté — image requise (JPG, PNG…).");
});
