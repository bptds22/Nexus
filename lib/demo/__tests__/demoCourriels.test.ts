/* Démo du 12 octobre — les courriels (edge function send-demo-inscription) :
   texte selon le choix, liens, échappement, .ics conforme. */
import { test } from "node:test";
import assert from "node:assert/strict";

// emailLayout.ts lit Deno.env au chargement : un Deno minimal suffit ici.
(globalThis as unknown as { Deno: unknown }).Deno ??= { env: { get: () => undefined } };
// @ts-ignore TS5097 — node --experimental-strip-types EXIGE l'extension .ts.
const { confirmation, avis, DEMO } = await import("../../../supabase/functions/send-demo-inscription/email.ts");
// @ts-ignore TS5097
const { ics, lienGoogleAgenda, URL_ICS, EVENEMENT } = await import("../../../supabase/functions/send-demo-inscription/evenement.ts");
import { DEMO_12_OCTOBRE } from "@/lib/demo/demo12Octobre";

const base = {
  id: "11111111-2222-3333-4444-555555555555", prenom: "Julie", nom: "Côté", courriel: "julie@exemple.test",
  cegep: "Cégep de Sherbrooke", sport: "Football", role: "RECRUTEUR", interets: ["OUTILS", "AUTRE"],
  interet_autre: "Statistiques", veut_compte: true, presentation_1a1: false, nb_soumissions: 1,
};

test("page et courriels : mêmes liens, même date", () => {
  assert.equal(DEMO.meet, DEMO_12_OCTOBRE.meet);
  assert.equal(DEMO.reservation, DEMO_12_OCTOBRE.reservation);
  assert.equal(DEMO.libelle, DEMO_12_OCTOBRE.libelle);
});

test("DIRECT : lien Meet, date, .ics joint", () => {
  const c = confirmation({ ...base, participation: "DIRECT" });
  assert.match(c.sujet, /lundi 12 octobre, 12 h/);
  assert.ok(c.html.includes("https://meet.google.com/myi-efqn-kes"));
  assert.ok(c.text.includes("lundi 12 octobre 2026, de 12 h à 13 h (heure de Montréal)"));
  assert.ok(c.html.includes("deux semaines"));
  assert.ok(c.ics);
});

test("ENREGISTREMENT : l'enregistrement après le 12, pas de .ics", () => {
  const c = confirmation({ ...base, participation: "ENREGISTREMENT" });
  assert.ok(c.text.includes("enregistrement de la démo par courriel après le 12 octobre"));
  assert.equal(c.ics, null);
});

test("1:1 cumulable : le rappel du lien s'ajoute au direct comme à l'enregistrement", () => {
  const sansD = confirmation({ ...base, participation: "DIRECT" });
  const avecD = confirmation({ ...base, participation: "DIRECT", presentation_1a1: true });
  assert.ok(!sansD.html.includes("calendar.app.google"));
  assert.ok(avecD.html.includes("présentation 1:1 avec Nexus") && avecD.html.includes("https://calendar.app.google/RUBKQe4k5ySpa6Be8"));
  assert.ok(avecD.text.includes("https://calendar.app.google/RUBKQe4k5ySpa6Be8"));
  assert.ok(avecD.ics, "le .ics reste joint au direct");
  const avecE = confirmation({ ...base, participation: "ENREGISTREMENT", presentation_1a1: true });
  assert.ok(avecE.html.includes("présentation 1:1 avec Nexus") && avecE.html.includes("Choisir un moment"));
});

test("jamais « Bruno-Philippe » dans les confirmations", () => {
  for (const participation of ["DIRECT", "ENREGISTREMENT"] as const) {
    for (const presentation_1a1 of [false, true]) {
      const c = confirmation({ ...base, participation, presentation_1a1 });
      assert.ok(!/Bruno/.test(c.html + c.text), `${participation}/${presentation_1a1}`);
    }
  }
});

test("saisie échappée dans le HTML", () => {
  const c = confirmation({ ...base, prenom: "<script>x</script>", participation: "DIRECT" });
  assert.ok(!c.html.includes("<script>x</script>"));
  assert.ok(c.html.includes("&lt;script&gt;"));
  const a = avis({ ...base, nom: "<b>", participation: "DIRECT" });
  assert.ok(!a.html.includes("<b>"));
});

test("avis à info@ : tout ce qu'il a répondu", () => {
  const a = avis({ ...base, participation: "ENREGISTREMENT", presentation_1a1: true });
  for (const attendu of ["Julie Côté", "julie@exemple.test", "Cégep de Sherbrooke", "Football", "Recruteur",
    "Les outils de recrutement · Autre : Statistiques", "Recevoir l'enregistrement", "Présentation 1:1 : Oui"]) {
    assert.ok(a.text.includes(attendu), attendu);
  }
  assert.match(a.sujet, /\+ 1:1\)$/);
});

test(".ics : RFC 5545 — CRLF, 16 h–17 h UTC (12 h–13 h HAE), lignes ≤ 75 octets, lien Meet", () => {
  const s = ics({ uid: `demo-2026-10-12-${base.id}@nexussports.ca`, participant: { nom: "Julie Côté", courriel: "julie@exemple.test" }, maintenant: new Date("2026-09-29T20:00:00Z") });
  assert.ok(s.endsWith("\r\n"));
  assert.ok(!/[^\r]\n/.test(s), "que des CRLF");
  const lignes = s.split("\r\n").filter(Boolean);
  for (const l of lignes) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  assert.ok(lignes.includes("DTSTART:20261012T160000Z"));
  assert.ok(lignes.includes("DTEND:20261012T170000Z"));
  assert.ok(lignes.includes("DTSTAMP:20260929T200000Z"));
  assert.ok(lignes.includes(`UID:demo-2026-10-12-${base.id}@nexussports.ca`));
  const deplie = s.replace(/\r\n /g, "");
  assert.ok(deplie.includes("LOCATION:https://meet.google.com/myi-efqn-kes"));
  assert.ok(deplie.includes("SUMMARY:Nexus — Démo recruteurs"));
  // 12 h à Montréal le 12 octobre 2026 = 16 h UTC.
  assert.equal(new Date("2026-10-12T16:00:00Z").toLocaleString("fr-CA", { timeZone: "America/Montreal", hour: "2-digit", hour12: false }), "12 h");
});

test(".ics : METHOD:REQUEST, ORGANIZER info@, l'inscrit en ATTENDEE sans demande de réponse", () => {
  const s = ics({ uid: "u@nexussports.ca", participant: { nom: 'Julie "JC" Côté', courriel: "julie@exemple.test" } });
  const lignes = s.replace(/\r\n /g, "").split("\r\n");
  assert.ok(lignes.includes("METHOD:REQUEST"));
  assert.ok(lignes.includes("ORGANIZER;CN=Nexus:mailto:info@nexussports.ca"));
  assert.ok(lignes.includes('ATTENDEE;CN="Julie  JC  Côté";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:julie@exemple.test'));
  assert.ok(lignes.includes("STATUS:CONFIRMED") && lignes.includes("SEQUENCE:0"));
  const pub = ics({ uid: EVENEMENT.uidPublic });
  assert.ok(!pub.includes("ATTENDEE"), "le .ics public n'a pas de participant");
  assert.ok(pub.includes("UID:demo-2026-10-12@nexussports.ca"));
});

test("Google Agenda : événement pré-rempli (titre, 16 h–17 h UTC, America/Toronto, Meet en description et en lieu)", () => {
  const u = new URL(lienGoogleAgenda());
  assert.equal(u.origin + u.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(u.searchParams.get("action"), "TEMPLATE");
  assert.equal(u.searchParams.get("text"), "Nexus — Démo recruteurs");
  assert.equal(u.searchParams.get("dates"), "20261012T160000Z/20261012T170000Z");
  assert.equal(u.searchParams.get("ctz"), "America/Toronto");
  assert.equal(u.searchParams.get("location"), "https://meet.google.com/myi-efqn-kes");
  assert.ok(u.searchParams.get("details")?.includes("https://meet.google.com/myi-efqn-kes"));
});

test("courriel « en direct » : boutons Google Agenda et Apple / Outlook ; pas pour l'enregistrement", () => {
  const d = confirmation({ ...base, participation: "DIRECT" });
  assert.ok(d.html.includes(">Google Agenda</a>") && d.html.includes(">Apple / Outlook</a>"));
  assert.ok(d.html.includes(`href="${URL_ICS}"`) && URL_ICS === "https://nexussports.ca/12octobre/demo-nexus.ics");
  assert.ok(d.html.includes("calendar.google.com/calendar/render?action=TEMPLATE"));
  assert.ok(d.text.includes(URL_ICS) && d.text.includes("calendar.google.com/calendar/render"));
  const e = confirmation({ ...base, participation: "ENREGISTREMENT" });
  assert.ok(!e.html.includes("Google Agenda") && !e.html.includes("Apple / Outlook"));
});
