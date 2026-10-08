import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatches } from "@/lib/calendar/recruitingCalendar";
import type { CalendarGame, CalendarTarget } from "@/lib/queries/recruiter/useRecruitingCalendar";

const cible = (athleteId: string, teamId: string): CalendarTarget => ({
  athleteId, identityVisible: true, fullName: `Athlète ${athleteId}`, firstName: "", lastName: "", initials: "",
  photo: "", sport: "football", sportName: "Football", position: "", graduationYear: 0, region: "", school: "",
  verified: false, hasVideo: false, stars: 0, gpa: 0, orgType: "scolaire", pipelineStage: null, listIds: [],
  teamId, teamName: `Équipe ${teamId}`,
});
let n = 0;
const match = (o: Partial<CalendarGame>): CalendarGame => ({
  id: `g${++n}`, gameDate: "2026-10-10", gameTime: "18:00", venue: "Stade", homeTeamId: "T1", visitorTeamId: "X",
  homeName: "A", visitorName: "B", competition: "Football",
  source: { nom: null, url: null, collecteLe: null } as unknown as CalendarGame["source"],
  ...o,
});

test("buildMatches : sans match ajouté, rendu inchangé (0 cible → écarté)", () => {
  const games = [match({ id: "avec" }), match({ id: "sans", homeTeamId: "Z" })];
  const v = buildMatches(games, [cible("a1", "T1")]);
  assert.deepEqual(v.map((m) => m.game.id), ["avec"]);
});

test("buildMatches : un match AJOUTÉ par l'unité reste avec 0 cible, au seuil par défaut seulement", () => {
  const games = [match({ id: "avec" }), match({ id: "ajoute", homeTeamId: "Z", ajoute: true, gameDate: "2026-10-11" })];
  const v = buildMatches(games, [cible("a1", "T1")]);
  assert.deepEqual(v.map((m) => [m.game.id, m.count]), [["avec", 1], ["ajoute", 0]]);
  assert.deepEqual(buildMatches(games, [cible("a1", "T1")], "date", 2).map((m) => m.game.id), [], "« 2+ cibles » l'écarte");
  assert.deepEqual(buildMatches(games, []).map((m) => m.game.id), ["ajoute"], "aucune cible du tout : le match ajouté reste");
});
