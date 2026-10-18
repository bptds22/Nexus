/* B2 de la 1.4.5 — Mes prospects dans l'APPLI : la page du web (créer/modifier,
   case 14 ans, x/50, révoquer, supprimer, Terminées), avec ce que l'appli exige —
   lien sur le domaine public, « Envoyer par texto » par la feuille de partage
   native, règle clavier du formulaire. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adresseLien, messageTexto, LIMITE_CARTES } from "@/lib/partenaires/prospects";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("le lien du texto : domaine public, jamais l'adresse locale de la WebView", () => {
  const page = lire("app/partenaire/prospects/page.tsx");
  assert.match(page, /setLien\(\{ carteId, adresse: adresseLien\(adressePublique\(\), jeton\), evalue \}\);/);
  assert.doesNotMatch(page, /window\.location\.origin/);
  const adr = lire("lib/partage/adressePublique.ts");
  assert.match(adr, /process\.env\.NEXT_PUBLIC_APP_URL/);
  assert.match(adr, /if \(IS_CAPACITOR \|\| typeof window === "undefined"\) return DOMAINE_PUBLIC;/);
  // Le message garde sa forme : signé, le lien dedans.
  const m = messageTexto("Club Test", adresseLien("https://nexussports.ca", "ab".repeat(32)));
  assert.match(m, /^Salut! Club Test t'a évalué et t'invite à voir ton évaluation sur Nexus : https:\/\/nexussports\.ca\/p\/(ab){32}\n— Club Test$/);
});

test("« Envoyer par texto » dans l'appli : feuille de partage native, message entier, repli sur la copie", () => {
  const src = lire("components/partenaire/prospects/EnvoyerLien.tsx");
  assert.match(src, /\{IS_CAPACITOR && \(\s*<button type="button" onClick=\{\(\) => void envoyerAppli\(\)\}/);
  assert.match(src, /partagerTexte\(\{ texte: message, titre: "Envoyer le lien" \}\)/);
  // Le sms: et le partage navigateur restent au web (P5 : plus de période de non-contact côté partenaire).
  assert.match(src, /\{!IS_CAPACITOR && tactile && \(/);
  assert.match(src, /\{!IS_CAPACITOR && partage && \(/);
  const lib = lire("lib/partage/partagerLien.ts");
  assert.match(lib, /await Share\.share\(\{ title: titre, text: texte, dialogTitle: titre \}\);/);
  assert.match(lib, /return \(await copier\(texte\)\) \? "copie" : "echec";/);
});

test("formulaire de carte : remonter ET plafonner au-dessus du clavier (appli), jamais de bottom inline", () => {
  const src = lire("components/partenaire/prospects/FormulaireCarte.tsx");
  assert.match(src, /const geometrieClavier = useSheetKeyboardGeometry\("100vh"\);/);
  assert.match(src, /style=\{IS_CAPACITOR \? \{ \.\.\.geometrieClavier, paddingTop: "env\(safe-area-inset-top\)" \} : undefined\}/);
  assert.doesNotMatch(src, /bottom:\s*0/);
  // La case 14 ans part bien à la RPC.
  assert.match(src, /atteste/);
});

test("ce que la page fait déjà, identique dans l'appli : x/50, révoquer, supprimer, Terminées", () => {
  assert.equal(LIMITE_CARTES, 50);
  const page = lire("app/partenaire/prospects/page.tsx");
  assert.match(page, /\{cartes\.length\} \/ \{LIMITE_CARTES\}/);
  assert.match(page, /await revoquerLien\(createClient\(\), carteId\);/);
  assert.match(page, /await supprimerCarte\(createClient\(\), carteId\);/);
  assert.match(page, /chargerCartesTerminees/);
  assert.doesNotMatch(page, /window\.confirm|confirm\(/);
});

test("texto : sans évaluation sur la carte, il invite sans « t'a évalué » (web et appli)", () => {
  const adr = adresseLien("https://nexussports.ca", "ab".repeat(32));
  assert.equal(messageTexto("Club Test", adr, false), `Salut! Club Test t'invite sur Nexus : ${adr}\n— Club Test`);
  assert.doesNotMatch(messageTexto("Club Test", adr, false), /évalu/);
  // Avec évaluation : le texte d'aujourd'hui, inchangé (c'est aussi le défaut).
  assert.equal(messageTexto("Club Test", adr, true), messageTexto("Club Test", adr));
  const page = lire("app/partenaire/prospects/page.tsx");
  assert.match(page, /const evalue = cartes\.find\(\(c\) => c\.id === carteId\)\?\.coteGlobale != null;/);
  assert.match(page, /<EnvoyerLien organisation=\{partenaire\.organizationName\} adresse=\{lien\.adresse\} evalue=\{lien\.evalue\}/);
  assert.match(lire("components/partenaire/prospects/EnvoyerLien.tsx"), /const message = messageTexto\(organisation, adresse, evalue\);/);
});
