/* Avis au parent d'un 14–17 ans, consentement partenaires v2 (BP 2026-10-19).
   La base réserve l'avis avec sa PORTÉE (avis_parent_partenaires.portee) ; le courriel la dit. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// emailLayout.ts lit Deno.env au chargement : un Deno minimal suffit ici.
(globalThis as unknown as { Deno: unknown }).Deno ??= { env: { get: () => undefined } };
// @ts-expect-error TS5097 — node --experimental-strip-types EXIGE l’extension .ts.
const { buildBody, sujet } = await import("../../../supabase/functions/send-avis-parent-partenaires/email.ts");
const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const base = { prenomAthlete: "Alex", prenomParent: "Dominique", portailUrl: "https://x/parent", espaceExistant: true, desabonnementUrl: "https://x/d" };

test("avis parent : la carte (défaut) garde le texte d'avant", () => {
  const { text } = buildBody(base);
  assert.match(text, /publier la carte Nexus d’Alex — son nom, son école, sa position, sa cote et sa photo\. Aucun partenaire ne peut contacter Alex directement\./);
  assert.ok(!text.includes("vidéos"));
  assert.equal(sujet("Alex"), "Alex a autorisé la visibilité partenaires médias");
});

test("avis parent : premier accord en v2 — carte, vidéos, réseaux, et les réseaux sont publics", () => {
  const { text } = buildBody({ ...base, portee: "V2" });
  assert.match(text, /et voir ses vidéos \(faits saillants, Hudl, YouTube, match complet, entraînement\) et les liens de ses réseaux sociaux \(Instagram, Facebook, TikTok, LinkedIn\)/);
  assert.match(text, /ne leur communique jamais le courriel ni le téléphone d’Alex/);
  assert.ok(!text.includes("Aucun partenaire ne peut contacter"));
  assert.equal(sujet("Alex", "V2"), "Alex a autorisé la visibilité partenaires médias");
});

test("avis parent : extension d'un accord carte — sujet et texte propres", () => {
  const { text, html } = buildBody({ ...base, portee: "EXTENSION_V2" });
  assert.match(text, /Alex avait déjà autorisé nos partenaires médias approuvés/);
  assert.match(text, /vient d’accepter qu’ils voient aussi ses vidéos/);
  assert.match(html, /Vidéos et réseaux partagés avec les partenaires/);
  assert.equal(sujet("Alex", "EXTENSION_V2"), "Alex partage aussi ses vidéos et ses réseaux avec les partenaires médias");
  assert.equal(sujet(null, "EXTENSION_V2"), "Votre enfant partage aussi ses vidéos et ses réseaux avec les partenaires médias");
});

test("avis parent : la fonction lit la portée de l'avis ; la base la pose (V2, EXTENSION_V2)", () => {
  const index = lire("supabase/functions/send-avis-parent-partenaires/index.ts");
  assert.ok(index.includes('.select("id, athlete_id, statut, portee")'));
  assert.ok(index.includes('(avis.portee as PorteeAvis | null) ?? "CARTE"'));
  const m = lire("supabase/migrations/20261018150000_athlete_reseaux_sociaux.sql");
  assert.ok(m.includes("add column portee text not null default 'CARTE' check (portee in ('CARTE', 'V2', 'EXTENSION_V2'))"));
  assert.ok(m.includes("perform public.aviser_parent_extension_v2(NEW.athlete_id);"));
  assert.ok(m.includes("update public.avis_parent_partenaires set portee = 'V2'"));
});
