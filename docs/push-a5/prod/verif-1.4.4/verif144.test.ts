// Le code client de la 1.4.4 (origin/release/1.4.4:lib/push/pushIntent.ts, copié tel quel) face aux pushs A5.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parsePushData, resolveDestination } from "./pushIntent144.ts";

// Payloads produits par la base A5 ; send-push les passe en strings (FCM v1) : on fait de même.
const lignes = fs.readFileSync(new URL("./payloads.txt", import.meta.url), "utf8").trim().split("\n");
const fake = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) } as never;

for (const l of lignes) {
  const [genre, json] = [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)];
  const data = Object.fromEntries(Object.entries(JSON.parse(json)).map(([k, v]) => [k, String(v)]));
  test(`1.4.4 — push A5 ${genre} : intention « announcement », accueil du jeune`, async () => {
    const i = parsePushData(data);
    assert.equal(i?.kind, "announcement");
    assert.equal(await resolveDestination(fake, "ATHLETE", i!), "/athlete");
  });
  test(`1.4.4 — ${genre} : même intention qu'un push A4a (sans nx_type ni route)`, () => {
    const { nx_type, route, ...a4a } = data;
    void nx_type; void route;
    assert.deepEqual({ ...parsePushData(a4a), ts: 0 }, { ...parsePushData(data), ts: 0 });
  });
}
