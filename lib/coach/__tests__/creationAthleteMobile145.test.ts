/* C1 (1.4.5) — création d'athlète par le coach, dans l'appli : champs requis visibles, validation par étape. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("C1 : les lignes affichent l'astérisque des champs requis et « Requis » quand ils manquent", () => {
  const rows = lire("components/shared/wizard/rows.tsx");
  assert.ok(rows.includes('{required && <span className="text-[#E63946] ml-0.5" aria-hidden="true">*</span>}'));
  // Les quatre lignes de saisie ou d'affichage passent par la même étiquette.
  assert.equal(rows.split("<Etiquette label={label} required={required} manquant={manquant && !value} />").length - 1, 4);
  assert.ok(rows.includes('{value || (manquant ? "Requis" : placeholder ? placeholder : "Ajouter")}'));
});

test("C1 : avancer par les puces valide les étapes d'avant (retour à la première incomplète, signalée)", () => {
  const w = lire("components/shared/AthleteWizardMobile.tsx");
  for (const extrait of [
    "const k = Array.from({ length: i }, (_, x) => x).find((x) => !canProceed(x));",
    "setEtapesSignalees((e) => new Set([...e, k]));",
    "toast.warning({ message: liste.length > 0 ? `Il manque : ${liste.join(\", \")}` : \"Champs requis manquants\" });",
    'onClick={() => { void triggerHaptic("Light"); allerAEtape(i); }}',
    "{bandeauManquants(0)}",
    "{bandeauManquants(3)}",
    "setEtapesSignalees(new Set([0, 3].filter((k) => !canProceed(k))));",
  ]) assert.ok(w.includes(extrait), extrait);
  // Chaque champ requis des étapes 1 et 4 porte `manquant` (11 lignes, 12 avec la position libre).
  assert.ok((w.split("required manquant={signale}").length - 1) >= 5);
  assert.ok((w.split("manquant={etapesSignalees.has(3)}").length - 1) >= 5);
  // Plus de puce muette : elle n'est plus `disabled`, elle explique.
  assert.ok(!w.includes("\n                  disabled={!reachable}"));
  assert.ok(!w.includes("aria-disabled={!reachable}"), "la puce reste actionnable : elle explique ce qui manque");
});
