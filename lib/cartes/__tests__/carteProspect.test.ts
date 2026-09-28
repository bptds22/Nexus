import { test } from "node:test";
import assert from "node:assert/strict";
import { expireLe, joursAvantPurge, bientotPurgee, estCarte, AVIS_JOURS } from "@/lib/cartes/carteProspect";
import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";

const JOUR = 86400000;

test("l'échéance de purge est 12 mois après la dernière activité", () => {
  assert.equal(expireLe("2026-01-15T12:00:00.000Z").slice(0, 10), "2027-01-15");
});

test("jours avant la purge : positifs avant, négatifs après", () => {
  const maintenant = Date.parse("2026-06-01T00:00:00Z");
  assert.equal(joursAvantPurge(new Date(maintenant + 10 * JOUR).toISOString(), maintenant), 10);
  assert.ok(joursAvantPurge(new Date(maintenant - 2 * JOUR).toISOString(), maintenant) < 0);
});

const carte = (derniereActivite: string) => ({
  id: "c", carte: { expireLe: expireLe(derniereActivite) },
}) as unknown as PipelineKanbanCard;

test("avis : une carte entre dans les 30 derniers jours, pas avant", () => {
  const maintenant = Date.now();
  const il_y_a = (jours: number) => new Date(maintenant - jours * JOUR).toISOString();
  assert.equal(bientotPurgee(carte(il_y_a(365 - AVIS_JOURS + 5)), maintenant), true);
  assert.equal(bientotPurgee(carte(il_y_a(200)), maintenant), false);
});

test("un dossier d'athlète Nexus n'est jamais une carte, ni bientôt purgé", () => {
  const dossier = { id: "a" } as PipelineKanbanCard;
  assert.equal(estCarte(dossier), false);
  assert.equal(bientotPurgee(dossier), false);
});
