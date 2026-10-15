/* Suite — lib/erreurs/messageErreurNexus.ts.

   Les messages d'entrée sont ceux que lève réellement la base (RAISE EXCEPTION
   des migrations), recopiés tels quels.

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/erreurs/__tests__/messageErreurNexus.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import { messageErreurNexus, messageCourrielDejaPris } from "@/lib/erreurs/messageErreurNexus";

test("badge déjà attribué par un partenaire : texte clair, sans préfixe ni guillemets", () => {
  assert.equal(
    messageErreurNexus("NEXUS: cet athlète a déjà le badge « Vitesse » (attribué par L'Esprit Sportif)"),
    "Cet athlète a déjà le badge Vitesse, attribué par L'Esprit Sportif.",
  );
});

test("badge déjà posé par son coach", () => {
  assert.equal(
    messageErreurNexus("NEXUS: cet athlète a déjà le badge « Leader vocal » (attribué par son coach)"),
    "Cet athlète a déjà le badge Leader vocal, attribué par son coach.",
  );
});

test("badge déjà posé, sans auteur", () => {
  assert.equal(
    messageErreurNexus("NEXUS: cet athlète a déjà le badge « MVP »"),
    "Cet athlète a déjà le badge MVP.",
  );
});

test("nom de partenaire avec parenthèses", () => {
  assert.equal(
    messageErreurNexus("NEXUS: cet athlète a déjà le badge « Vitesse » (attribué par Média (Laval))"),
    "Cet athlète a déjà le badge Vitesse, attribué par Média (Laval).",
  );
});

test("autre erreur NEXUS : majuscule et point final, rien d'autre", () => {
  assert.equal(messageErreurNexus("NEXUS: cote globale obligatoire (1 à 5)"), "Cote globale obligatoire (1 à 5).");
  assert.equal(messageErreurNexus("NEXUS: consentement requis"), "Consentement requis.");
  assert.equal(messageErreurNexus("NEXUS: badge(s) inconnu(s) au catalogue : x."), "Badge(s) inconnu(s) au catalogue : x.");
});

test("le préfixe NEXUS n'apparaît jamais dans le résultat", () => {
  for (const m of ["NEXUS: athlète introuvable", "  NEXUS:badge introuvable", "NEXUS: cet athlète a déjà le badge « A » (attribué par B)"]) {
    const r = messageErreurNexus(m);
    assert.ok(r && !r.includes("NEXUS"), `${m} → ${r}`);
  }
});

test("erreur non NEXUS ou vide : null (message générique côté appelant)", () => {
  assert.equal(messageErreurNexus('duplicate key value violates unique constraint "x"'), null);
  assert.equal(messageErreurNexus("Sport de l'équipe introuvable."), null);
  assert.equal(messageErreurNexus("NEXUS:"), null);
  assert.equal(messageErreurNexus(""), null);
  assert.equal(messageErreurNexus(null), null);
  assert.equal(messageErreurNexus(undefined), null);
});

test("courriel déjà pris par une autre fiche : message lisible, sans nommer personne (D1)", () => {
  const r = messageCourrielDejaPris('duplicate key value violates unique constraint "athletes_email_lower_btrim_uniq"');
  assert.ok(r && r.startsWith("Une fiche athlète utilise déjà ce courriel"), String(r));
  assert.ok(!r.includes("duplicate") && !r.includes("athletes_email"), r);
  assert.equal(messageCourrielDejaPris('duplicate key value violates unique constraint "autre"'), null);
  assert.equal(messageCourrielDejaPris(null), null);
});