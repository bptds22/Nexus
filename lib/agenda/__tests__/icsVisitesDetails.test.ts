/* Flux d'agenda : les détails d'une visite (BP 2026-10-18) — lieu, lien Zoom, responsable,
   note — suivent l'événement dans Google Agenda et Outlook. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  champsVisiteAgenda, genererIcs, indexerDetailsAgenda,
  type DetailsVisiteAgenda, type EvenementAgenda,
} from "@/lib/agenda/ics";

const ORIGINE = "https://nexussports.ca";
const MAINTENANT = new Date("2026-10-18T18:00:00Z");
const visite: EvenementAgenda = { type: "VISITE", cible: "athlete", cible_id: "a1", nom: "Léa Roy", jour: null, instant: "2026-10-22T18:00:00Z", note: null };
const enPersonne: DetailsVisiteAgenda = {
  cible: "athlete", cible_id: "a1", format: "EN_PERSONNE", adresse: "175 rue Principale, Granby; porte 2",
  lien: null, responsable: "Marc Tremblay", note: "Avec les parents",
};
const deplier = (ics: string) => ics.replace(/\r\n /g, "");

test("en personne : LOCATION échappée, description Format / Responsable / Note, URL du dossier", () => {
  const ics = deplier(genererIcs([visite], ORIGINE, MAINTENANT, { detailsVisites: indexerDetailsAgenda([enPersonne]) }));
  assert.match(ics, /LOCATION:175 rue Principale\\, Granby\\; porte 2\r\n/);
  assert.match(ics, /DESCRIPTION:Avec les parents\\n\\nDossier : https:\/\/nexussports\.ca\/recruteur\/pipeline\?athlete=a1\r\n/);
  assert.match(ics, /URL:https:\/\/nexussports\.ca\/recruteur\/pipeline\?athlete=a1\r\n/);
});

test("Zoom : LOCATION et URL = le lien de la rencontre ; une carte se retrouve par sa clé", () => {
  const carte: EvenementAgenda = { ...visite, cible: "carte", cible_id: "c9" };
  const zoom: DetailsVisiteAgenda = { ...enPersonne, cible: "carte", cible_id: "c9", format: "ZOOM", adresse: "ignorée", lien: "https://zoom.us/j/123?pwd=a,b", responsable: null, note: null };
  const ics = deplier(genererIcs([carte, visite], ORIGINE, MAINTENANT, { detailsVisites: indexerDetailsAgenda([zoom]) }));
  assert.match(ics, /LOCATION:https:\/\/zoom\.us\/j\/123\?pwd=a\\,b\r\n/);
  assert.match(ics, /URL:https:\/\/zoom\.us\/j\/123\?pwd=a,b\r\n/);
  assert.match(ics, /DESCRIPTION:Dossier/);
  assert.doesNotMatch(ics, /ignorée/);
  // L'athlète a1 n'a pas de détails ici : son événement reste comme avant.
  assert.equal((ics.match(/LOCATION:/g) ?? []).length, 1);
});

test("sans détails : événement identique à avant ; une relance ne reçoit jamais de détails", () => {
  const avant = genererIcs([visite], ORIGINE, MAINTENANT);
  assert.equal(genererIcs([visite], ORIGINE, MAINTENANT, { detailsVisites: new Map() }), avant);
  const relance: EvenementAgenda = { type: "RELANCE", cible: "athlete", cible_id: "a1", nom: "Léa Roy", jour: "2026-10-20", instant: null, note: null };
  const ics = genererIcs([relance], ORIGINE, MAINTENANT, { detailsVisites: indexerDetailsAgenda([enPersonne]) });
  assert.doesNotMatch(ics, /LOCATION:|Format :/);
});

test("lien non https ignoré ; adresse longue pliée à 75 octets", () => {
  assert.deepEqual(champsVisiteAgenda({ ...enPersonne, format: "ZOOM", lien: "http://x" }).url, null);
  const longue = { ...enPersonne, adresse: "É".repeat(80) };
  const ics = genererIcs([visite], ORIGINE, MAINTENANT, { detailsVisites: indexerDetailsAgenda([longue]) });
  for (const l of ics.split("\r\n")) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  assert.match(deplier(ics), new RegExp(`LOCATION:${"É".repeat(80)}\r\n`));
});

test("route : les détails sont lus en plus, une erreur ne casse pas le flux", () => {
  const src = readFileSync(join(process.cwd(), "app/api/agenda/[fichier]/route.ts"), "utf8");
  assert.ok(src.includes('supabase.rpc("agenda_visites_details", { p_jeton: jeton } as never)'));
  assert.ok(src.includes("detailsVisites: indexerDetailsAgenda(details.error ? [] : ((details.data ?? []) as DetailsVisiteAgenda[]))"));
  assert.ok(!src.includes('return erreur("détails"'));
});
