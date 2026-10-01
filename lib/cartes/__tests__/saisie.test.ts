import { test } from "node:test";
import assert from "node:assert/strict";
import { lireTaille, lirePoids, lireCourriel, lireLien, lireNomParent, lireCourrielParent } from "@/lib/cartes/saisie";

const taille = (s: string) => { const r = lireTaille(s); return r.ok ? `${r.valeur.pieds}-${r.valeur.pouces}` : "ERR"; };
const poids = (s: string) => { const r = lirePoids(s); return r.ok ? r.valeur : "ERR"; };

test("taille : pieds et pouces sous toutes leurs formes", () => {
  for (const s of [`6'2"`, "6'2", "6’2”", "6 pi 2", "6 pi 2 po", "6-2", "6 2", "6ft 2in"]) assert.equal(taille(s), "6-2", s);
  assert.equal(taille("6'"), "6-0");
  assert.equal(taille("6"), "6-0");
  assert.equal(taille(""), "null-null");
});

test("taille : centimètres convertis", () => {
  assert.equal(taille("188 cm"), "6-2");
  assert.equal(taille("188"), "6-2");
  assert.equal(taille("175,5 cm"), "5-9");
});

test("taille : hors bornes de la base ou illisible → la règle", () => {
  for (const s of [`6'12"`, "9'0", "2'5", "70 cm", "grand", "6'2'5"]) assert.equal(taille(s), "ERR", s);
  const r = lireTaille("grand");
  assert.ok(!r.ok && /6'2" ou 188 cm/.test(r.regle));
});

test("poids : livres, lbs, kg", () => {
  assert.equal(poids("121"), 121);
  assert.equal(poids("121 lbs"), 121);
  assert.equal(poids("121lb"), 121);
  assert.equal(poids("121 livres"), 121);
  assert.equal(poids("55 kg"), 121);
  assert.equal(poids("121,4"), 121);
  assert.equal(poids(""), null);
  for (const s of ["30", "500 lbs", "lourd", "121 tonnes"]) assert.equal(poids(s), "ERR", s);
});

test("courriel et lien : la règle de la base, lien sans schéma accepté", () => {
  assert.equal(lireCourriel("a@b.co").ok, true);
  assert.equal(lireCourriel("pas-un-courriel").ok, false);
  const l = lireLien("youtube.com/watch?v=abc");
  assert.ok(l.ok && l.valeur === "https://youtube.com/watch?v=abc");
  assert.equal(lireLien("https://hudl.com/x").ok, true);
  assert.equal(lireLien("mon film").ok, false);
});

// ── Téléphone ──
import { lireTelephone, formaterTelephone } from "@/lib/cartes/saisie";
const tel = (s: string) => { const r = lireTelephone(s); return r.ok ? r.valeur : "ERR"; };

test("téléphone : format libre, normalisé à 10 chiffres, sans le 1 initial", () => {
  assert.equal(tel("(438) 555-0123"), "4385550123");
  assert.equal(tel("+1 438 555 0123"), "4385550123");
  assert.equal(tel("1-438-555-0123"), "4385550123");
  assert.equal(tel("438.555.0123"), "4385550123");
  assert.equal(tel(""), null);
  assert.equal(tel("   "), null);
});

test("téléphone : validation douce — 10 chiffres, sinon la règle", () => {
  assert.equal(tel("555-0123"), "ERR");
  assert.equal(tel("438 555 01234"), "ERR");
  const r = lireTelephone("555-0123");
  assert.ok(!r.ok && r.regle.includes("10 chiffres"));
});

test("téléphone : affiché « 438 555-0123 »", () => {
  assert.equal(formaterTelephone("4385550123"), "438 555-0123");
  assert.equal(formaterTelephone(null), "");
});

test("parent : nom libre (espaces resserrés, 120 caractères au plus), vide = rien", () => {
  assert.deepEqual(lireNomParent("  Julie   Tremblay "), { ok: true, valeur: "Julie Tremblay" });
  assert.deepEqual(lireNomParent("   "), { ok: true, valeur: null });
  assert.deepEqual(lireNomParent("a".repeat(121)), { ok: false, regle: "Nom du parent : 120 caractères au plus" });
});

test("parent : courriel, avec une règle qui nomme le champ", () => {
  assert.deepEqual(lireCourrielParent(" parent@exemple.ca "), { ok: true, valeur: "parent@exemple.ca" });
  assert.deepEqual(lireCourrielParent(""), { ok: true, valeur: null });
  assert.deepEqual(lireCourrielParent("pas-un-courriel"), { ok: false, regle: "Courriel du parent : nom@exemple.com" });
});
