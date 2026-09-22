/* ═══════════════════════════════════════════════════════════════
   Calendrier RSEQ relayé par Nexus — garde-fous du relais et lien de carte.
   GUID et nom de ligue RÉELS (ligue « Volleyball C F D2 Sud-Ouest »,
   relevée en base le 2026-09-22).
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NEXUS_CALENDRIER_RSEQ,
  estGuid,
  nomFichierCalendrier,
  ressembleAXlsx,
  slugLigue,
  urlCalendrierRseq,
} from "@/lib/calendar/rseqCalendrier";
import { sourceDuMatch } from "@/lib/calendar/sourceMatch";

const LIGUE = "beb8b2c0-e453-4553-a003-62e120e6e9db";
const NOM = "Volleyball C F D2 Sud-Ouest (2026-2027)";

test("estGuid : le GUID canonique seulement", () => {
  assert.equal(estGuid(LIGUE), true);
  assert.equal(estGuid(LIGUE.toUpperCase()), true);
  for (const v of [
    null, undefined, "", "abc",
    `{${LIGUE}}`, ` ${LIGUE}`, `${LIGUE} `, `${LIGUE}&x=1`,
    `${LIGUE}/../../evil`, "https://evil.example/x.xlsx",
    LIGUE.replace(/-/g, ""), `${LIGUE}0`,
  ]) {
    assert.equal(estGuid(v), false, String(v));
  }
});

test("slugLigue : ASCII, tirets, 60 caractères, rien qui casse un en-tête", () => {
  assert.equal(slugLigue(NOM), "volleyball-c-f-d2-sud-ouest-2026-2027");
  assert.equal(slugLigue("Équipe « Élite » ; x\"y\r\nSet-Cookie: a"), "equipe-elite-x-y-set-cookie-a");
  assert.equal(slugLigue(null), "");
  assert.equal(slugLigue("   "), "");
  const long = slugLigue("a".repeat(50) + " " + "b".repeat(50));
  assert.ok(long.length <= 60 && !long.endsWith("-"), long);
});

test("nomFichierCalendrier : nom de ligue, sinon début du GUID", () => {
  assert.equal(nomFichierCalendrier(LIGUE, NOM), "calendrier-rseq-volleyball-c-f-d2-sud-ouest-2026-2027.xlsx");
  assert.equal(nomFichierCalendrier(LIGUE, null), "calendrier-rseq-beb8b2c0.xlsx");
  assert.equal(nomFichierCalendrier(LIGUE, "«»"), "calendrier-rseq-beb8b2c0.xlsx");
});

test("urlCalendrierRseq : URL ABSOLUE vers nexussports.ca, jamais vers le RSEQ", () => {
  const u = new URL(urlCalendrierRseq(LIGUE, NOM));
  assert.equal(`${u.origin}${u.pathname}`, NEXUS_CALENDRIER_RSEQ);
  assert.equal(u.origin, "https://nexussports.ca");
  assert.equal(u.searchParams.get("leagueId"), LIGUE);
  assert.equal(u.searchParams.get("ligue"), "volleyball-c-f-d2-sud-ouest-2026-2027");
  assert.equal(new URL(urlCalendrierRseq(LIGUE)).searchParams.has("ligue"), false);
});

test("ressembleAXlsx : signature ZIP « PK\\x03\\x04 » seulement", () => {
  assert.equal(ressembleAXlsx(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14])), true);
  assert.equal(ressembleAXlsx(new TextEncoder().encode('{"Message":"An error has occurred."}')), false);
  assert.equal(ressembleAXlsx(new TextEncoder().encode("<!doctype html>")), false);
  assert.equal(ressembleAXlsx(new Uint8Array([0x50, 0x4b])), false);
});

test("sourceDuMatch RSEQ : le lien passe par la route Nexus", () => {
  const s = sourceDuMatch({ source_nom: "RSEQ", rseq_league_id: LIGUE, league_name: NOM, collecte_le: "2026-09-21T12:00:00Z" });
  assert.equal(s.url, urlCalendrierRseq(LIGUE, NOM));
  assert.ok(!s.url!.includes("rseq.ca"), s.url!);
  assert.equal(s.telecharge, true);
  assert.equal(s.libelle, "Calendrier officiel RSEQ");
});

test("sourceDuMatch RSEQ sans GUID valide : source affichée, aucun lien", () => {
  const s = sourceDuMatch({ source_nom: "RSEQ", rseq_league_id: "pas-un-guid" });
  assert.equal(s.url, null);
  assert.equal(s.nom, "RSEQ");
});

test("sourceDuMatch civil : inchangé, l'URL stockée en nouvel onglet", () => {
  const s = sourceDuMatch({ source_nom: "LFMM", source_url: "https://www.lfmm.ca/calendrier" });
  assert.equal(s.url, "https://www.lfmm.ca/calendrier");
  assert.equal(s.telecharge, false);
});
