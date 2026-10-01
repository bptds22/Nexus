import { test } from "node:test";
import assert from "node:assert/strict";
import { texteRenvoi, lienInscription, phraseRenvoi } from "@/lib/cartes/renvoiInvitation";
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
