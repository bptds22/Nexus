/* ═══════════════════════════════════════════════════════════════
   Plantage fiche → Recherche (iPhone, 2026-10-18) — reproduction.
   Le cache TanStack passe par JSON (sessionStorage) : une Map y devient
   {}. Réhydratée, elle faisait planter la Recherche (recruteur ET
   partenaire). Correctif : estPersistable() dans QueryProvider.
═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, dehydrate, hydrate } from "@tanstack/query-core";
import { estPersistable } from "@/lib/queries/persistance";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const CLE = ["badges-partenaires-lot", ["a1", "a2"]];

/** Le trajet du persister : dehydrate → JSON (sessionStorage) → hydrate dans un nouveau client. */
function allerRetour(filtre?: (data: unknown) => boolean) {
  const avant = new QueryClient();
  avant.setQueryData(CLE, new Map([["a1", [{ id: "b1" }]]]));
  const json = JSON.stringify(dehydrate(avant, filtre ? { shouldDehydrateQuery: (q) => filtre(q.state.data) } : undefined));
  const apres = new QueryClient();
  hydrate(apres, JSON.parse(json));
  return apres.getQueryData(CLE);
}

test("reproduction : sans filtre, la Map revient en {} et la fusion des paquets plante", () => {
  const rehydrate = allerRetour();
  assert.deepEqual(rehydrate, {});
  assert.ok(!(rehydrate instanceof Map));
  // L'ancienne fusion (PartenaireCartesProvider) : for…of sur {} → TypeError, l'écran tombe.
  assert.throws(() => { for (const kv of rehydrate as unknown as Map<string, unknown>) void kv; }, TypeError);
});

test("correctif : une Map / un Set ne se persiste pas, il se relit au serveur", () => {
  assert.equal(allerRetour(estPersistable), undefined);
  assert.equal(estPersistable(new Map()), false);
  assert.equal(estPersistable(new Set(["x"])), false);
  assert.equal(estPersistable({ lignes: [{ ids: new Set() }] }), false);
  assert.equal(estPersistable([{ id: "a", badges: [{ x: 1 }] }]), true);
  assert.equal(estPersistable(null), true);
  assert.equal(estPersistable("texte"), true);
});

test("câblage : QueryProvider filtre, la fusion ignore un paquet qui n'est pas une Map", () => {
  assert.ok(lire("app/_providers/QueryProvider.tsx").includes("&& estPersistable(q.state.data)"));
  assert.ok(lire("components/shared/PartenaireCartesProvider.tsx").includes("if (m instanceof Map)"));
});

test("filet de sécurité : app/error.tsx et global-error rendent EcranErreur avec « Recharger »", () => {
  const ecran = lire("components/shared/EcranErreur.tsx");
  assert.ok(ecran.includes("Recharger"));
  assert.ok(ecran.includes("console.error"));
  assert.ok(lire("app/error.tsx").includes("<EcranErreur onReessayer={reset} />"));
  assert.ok(lire("app/global-error.tsx").includes("<EcranErreur />"));
  assert.ok(!lire("app/global-error.tsx").includes("NextError"));
});

test("fenêtre Retirer : jamais « Aussi en favori chez . » quand le nom du collègue manque", () => {
  const src = lire("components/recruteur/unite/useBasculeFavori.tsx");
  assert.ok(src.includes('const collegues = nomsCollegues.map((n) => (n ?? "").trim()).filter(Boolean);'));
  assert.ok(src.includes("if (collegues.length > 0) {"));
});
