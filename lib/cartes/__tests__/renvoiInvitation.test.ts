import { test } from "node:test";
import assert from "node:assert/strict";
import { texteRenvoi, lienInscription, lienSms, phraseRenvoi } from "@/lib/cartes/renvoiInvitation";
import { ligneSignee } from "@/lib/historique/signature";

test("texte au nom du recruteur, avec le lien d'inscription pré-rempli", () => {
  assert.equal(
    texteRenvoi({ prenom: "Léa", recruteur: "Bastien Panier", cegep: "Cégep de Sainte-Foy", courriel: "lea+test@exemple.ca" }),
    "Salut Léa, je suis Bastien Panier du Cégep de Sainte-Foy. On utilise Nexus pour notre recrutement — crée ton profil ici : https://nexussports.ca/auth?mode=signup&email=lea%2Btest%40exemple.ca",
  );
});

test("le lien est celui du courriel automatique (adresse encodée, espaces retirés)", () => {
  assert.equal(lienInscription("  a@b.ca "), "https://nexussports.ca/auth?mode=signup&email=a%40b.ca");
});

test("morceaux absents : aucun trou, aucun crochet", () => {
  const t = texteRenvoi({ prenom: "", recruteur: null, cegep: undefined, courriel: "a@b.ca" });
  assert.equal(t, "Salut, je suis recruteur. On utilise Nexus pour notre recrutement — crée ton profil ici : https://nexussports.ca/auth?mode=signup&email=a%40b.ca");
  assert.doesNotMatch(t, /\[|\]|undefined|null|\s{2}/);
});

test("historique : « Tu as renvoyé l'invitation par ton propre canal »", () => {
  const moi = ligneSignee(true, "Bastien", phraseRenvoi(true));
  assert.equal(`${moi.sujet} ${moi.phrase}`, "Tu as renvoyé l'invitation par ton propre canal");
  const autre = ligneSignee(false, "Marie Roy", phraseRenvoi(false));
  assert.equal(`${autre.sujet} ${autre.phrase}`, "Marie Roy a renvoyé l'invitation par son propre canal");
});

test("texto de l'app (sans courriel) : lien d'inscription sans adresse", () => {
  const t = texteRenvoi({ prenom: "Léa", recruteur: "Marie Roy", cegep: "Cégep de Lévis", courriel: null });
  assert.equal(t, "Salut Léa, je suis Marie Roy du Cégep de Lévis. On utilise Nexus pour notre recrutement — crée ton profil ici : https://nexussports.ca/auth?mode=signup");
});

test("lien sms : corps encodé, « & » sur iOS, « ? » sur Android", () => {
  assert.equal(lienSms("4385550123", "Salut — ici", false), "sms:4385550123?body=Salut%20%E2%80%94%20ici");
  assert.equal(lienSms("4385550123", "a&b", true), "sms:4385550123&body=a%26b");
});

test("carte téléphone seulement (lot 2) : courriel null ou blanc → /auth?mode=signup sans email", () => {
  for (const courriel of [null, undefined, "", "   "]) {
    const t = texteRenvoi({ prenom: "Léa", recruteur: "Rémi Collègue", cegep: "Cégep X", courriel });
    assert.ok(t.endsWith("crée ton profil ici : https://nexussports.ca/auth?mode=signup"), String(courriel));
    assert.doesNotMatch(t, /email=/);
  }
});
