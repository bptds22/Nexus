import { test } from "node:test";
import assert from "node:assert/strict";
import { heureCarte, heureQuebec, instantMatch, minutesDe } from "@/lib/calendar/heureMatch";
import { minutesDe as minutesDeCarte, heureCarte as heureCarteCarte } from "@/lib/carteMatchs/carteMatchs";
import { buildMatches } from "@/lib/calendar/recruitingCalendar";
import { buildIcs } from "@/lib/utils/buildIcs";
import type { CalendarGame, CalendarTarget } from "@/lib/queries/recruiter/useRecruitingCalendar";

test("une seule lecture de l'heure : la carte des matchs réexporte celle de heureMatch", () => {
  assert.equal(minutesDeCarte, minutesDe);
  assert.equal(heureCarteCarte, heureCarte);
});

test("lecture : 24 h (RSEQ) et 12 h AM/PM (ligues civiles), affichage en 24 h", () => {
  assert.equal(heureCarte("6:30 PM"), "18 h 30");
  assert.equal(heureCarte("8:00 pm"), "20 h 00");
  assert.equal(heureCarte("18:30"), "18 h 30");
  assert.equal(heureQuebec("12:30 pm"), "12 h 30");
  assert.equal(heureQuebec("12:15 AM"), "0 h 15");
  assert.equal(heureCarte(""), "Heure à confirmer");
});

test(".ics : « 6:30 PM » le 9 octobre = 18 h 30 à Montréal (heure d'été, UTC−4) → DTSTART 22:30 UTC", () => {
  const debut = instantMatch("2026-10-09", "6:30 PM");
  assert.ok(debut);
  assert.equal(debut!.toISOString(), "2026-10-09T22:30:00.000Z");
  assert.equal(debut!.toLocaleTimeString("fr-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" }), "18 h 30");
  const ics = buildIcs({ summary: "Myers Riders @ Bel Air Norsemen", start: debut!, end: new Date(debut!.getTime() + 2 * 3600_000) });
  assert.match(ics, /DTSTART:20261009T223000Z/);
  assert.match(ics, /DTEND:20261010T003000Z/);
});

test("instantMatch : heure normale (UTC−5) en décembre, 24 h du RSEQ, sans heure → null", () => {
  assert.equal(instantMatch("2026-12-05", "6:30 PM")!.toISOString(), "2026-12-05T23:30:00.000Z");
  assert.equal(instantMatch("2026-10-09", "18:30")!.toISOString(), "2026-10-09T22:30:00.000Z");
  assert.equal(instantMatch("2026-10-09", ""), null, "pas de minuit inventé");
  assert.equal(instantMatch("2026-10-09", "À déterminer"), null);
  assert.equal(instantMatch("09/10/2026", "6:30 PM"), null);
});

test("Calendrier : dans une journée, tri sur l'heure réelle (8:00 PM après 18:30, 1:00 PM avant 18:30)", () => {
  const cible: CalendarTarget = {
    athleteId: "a1", identityVisible: true, fullName: "A", firstName: "", lastName: "", initials: "", photo: "",
    sport: "football", sportName: "Football", position: "", graduationYear: 0, region: "", school: "", verified: false,
    hasVideo: false, stars: 0, gpa: 0, orgType: "scolaire", pipelineStage: null, listIds: [], teamId: "T1", teamName: "T1",
  };
  const g = (id: string, gameTime: string): CalendarGame => ({
    id, gameDate: "2026-10-09", gameTime, venue: "", homeTeamId: "T1", visitorTeamId: "X", homeName: "A", visitorName: "B",
    competition: "", source: { nom: null, url: null, collecteLe: null } as unknown as CalendarGame["source"],
  });
  const v = buildMatches([g("soir", "8:00 PM"), g("rseq", "18:30"), g("midi", "1:00 PM"), g("sans", "")], [cible]);
  assert.deepEqual(v.map((m) => m.game.id), ["midi", "rseq", "soir", "sans"]);
});
