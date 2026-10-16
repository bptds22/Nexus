/* A7 de la 1.4.5 — propositions de rapprochement dans l'APPLI : voir, accepter
   (fusion, lot E), refuser. Même fournisseur, même logique et même bloc de
   proposition que le web ; seule la présentation change (feuille du bas). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("composant partagé : une logique, deux présentations", () => {
  const src = lire("components/recruteur/cartes/Rapprochements.tsx");
  assert.match(src, /variante = "modale"/);
  assert.match(src, /const Fenetre = variante === "feuille" \? FeuilleRapprochements : FenetreRapprochements;/);
  // Refuser / Accepter n'existent qu'une fois, dans le hook commun.
  assert.equal((src.match(/refuserRapprochement\(createClient\(\), r\.id\)/g) ?? []).length, 1);
  assert.equal((src.match(/await onAccepter\(r\)/g) ?? []).length, 1);
  assert.equal((src.match(/const a = useActionsRapprochement\(onAccepter\);/g) ?? []).length, 2);
  // La feuille : portée sur document.body, défilable, boutons tactiles.
  assert.match(src, /createPortal\(\s*<div className="fixed inset-0 z-\[90\]"/);
  assert.match(src, /<Proposition key=\{r\.id\} r=\{r\} a=\{a\} tactile \/>/);
});

test("appli : fournisseur Pro de l'unité, fusion par fusionnerCarte, bandeau et lien de carte", () => {
  const src = lire("components/shared/RecruteurPipelineMobile.tsx");
  assert.match(src, /<FournisseurRapprochements\s+actif=\{modeUnite && !isFreeDemoMode\}\s+variante="feuille"/);
  assert.match(src, /fusionnerCarte\(createClient\(\), r\.carte_id, r\.athlete_id\)/);
  assert.match(src, /if \(!erreur && selectedCard\?\.id === r\.carte_id\) handleSheetClose\(\);/);
  assert.match(src, /void invaliderTableauBlanc\(queryClient\);/);
  assert.match(src, /<BandeauRapprochements className="mx-4 mt-2" \/>/);
  assert.match(src, /\{carte && <LienRapprochementCarte carteId=\{card\.id\}/);
  // L'annulation de fusion (7 jours) vit dans l'Historique du dossier, déjà monté.
  assert.match(src, /OngletHistoriquePanneau/);
});

test("web inchangé : même fournisseur, modale par défaut", () => {
  const src = lire("app/recruteur/pipeline/page.tsx");
  assert.match(src, /<FournisseurRapprochements\s+actif=\{modeUnite && !isFreeDemoMode\}\s+onAccepter=/);
  assert.doesNotMatch(src, /variante="feuille"/);
});
