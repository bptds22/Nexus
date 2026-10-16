/* Coachs nommables à l'athlète (décision BP du 2026-10-16, règle RSEQ) : web et mobile
   passent par les mêmes fonctions en base (migration 20261016040000) et la même couche
   client (lib/queries/athlete/coachsNommables.ts). Banc SQL : docs/coachs-nommables/. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chargerCoachsNommablesEcole, chargerCoachsNommablesEquipe, resoudreApercuCode, versCoachEcole, versCoachEquipe,
} from "@/lib/queries/athlete/coachsNommables";
import { nomsAffichablesCode } from "@/lib/invitations/apercuCodeEquipe";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Faux client : enregistre les appels rpc, rend la réponse fournie. */
function faux(reponse: { data?: unknown; error?: { message: string } | null }) {
  const appels: { fn: string; args: unknown }[] = [];
  const client = { rpc: async (fn: string, args: unknown) => { appels.push({ fn, args }); return { data: reponse.data ?? null, error: reponse.error ?? null }; } };
  return { client: client as never, appels };
}

const LIGNE = {
  team_id: "t1", team_name: "Dragons", school_id: "s1", school_name: "École X", school_logo_url: null,
  school_type: "SECONDAIRE", sport_name: "Football", season: "2026-2027", age_group: "Juvénile",
  division: "D1", gender: "Masculin", league: null, is_valid: true,
};

test("aperçu d'un code : appelle apercu_code_equipe (code normalisé) et rend l'équipe + les coachs filtrés", async () => {
  const { client, appels } = faux({ data: [{ ...LIGNE, coachs: [{ coach_id: "c1", prenom: "Marc", nom: "Roy", role: "head_coach" }] }] });
  const r = await resoudreApercuCode(client, "v9a9-b7hm");
  assert.deepEqual(appels, [{ fn: "apercu_code_equipe", args: { p_code: "V9A9B7HM" } }]);
  assert.equal(r?.teamName, "Dragons");
  assert.equal(r?.isValid, true);
  assert.deepEqual(r?.coachs, [{ coach_id: "c1", first_name: "Marc", last_name: "Roy", role: "head_coach" }]);
});

test("aperçu : code inexistant → null ; erreur → null ; coachs absents → []", async () => {
  assert.equal(await resoudreApercuCode(faux({ data: [] }).client, "ABCDEF"), null);
  assert.equal(await resoudreApercuCode(faux({ error: { message: "x" } }).client, "ABCDEF"), null);
  assert.equal(await resoudreApercuCode(faux({ data: [] }).client, ""), null);
  const r = await resoudreApercuCode(faux({ data: [{ ...LIGNE, school_type: "CEGEP", coachs: [] }] }).client, "ABCDEF");
  assert.deepEqual(r?.coachs, []);
});

test("listes : rpc coachs_nommables_ecole / _equipe ; une erreur rend [] (jamais une liste non filtrée)", async () => {
  const e = faux({ data: [{ coach_id: "c1", prenom: "Marc", nom: "Roy", photo_url: null }] });
  assert.deepEqual(await chargerCoachsNommablesEcole(e.client, "s1"), [{ id: "c1", firstName: "Marc", lastName: "Roy", photoUrl: null }]);
  assert.deepEqual(e.appels, [{ fn: "coachs_nommables_ecole", args: { p_school: "s1" } }]);
  const q = faux({ data: [{ coach_id: "c1", prenom: null, nom: "Roy", role: null }] });
  assert.deepEqual(await chargerCoachsNommablesEquipe(q.client, "t1"), [{ coach_id: "c1", first_name: null, last_name: "Roy", role: "assistant" }]);
  assert.deepEqual(q.appels, [{ fn: "coachs_nommables_equipe", args: { p_team: "t1" } }]);
  const origine = console.error; console.error = () => {};
  try {
    assert.deepEqual(await chargerCoachsNommablesEcole(faux({ error: { message: "x" } }).client, "s1"), []);
    assert.deepEqual(await chargerCoachsNommablesEquipe(faux({ error: { message: "x" } }).client, "t1"), []);
  } finally { console.error = origine; }
  assert.deepEqual(await chargerCoachsNommablesEcole(faux({}).client, ""), []);
});

test("mappers : champs absents → vides, jamais undefined", () => {
  assert.deepEqual(versCoachEcole({ coach_id: "c" }), { id: "c", firstName: "", lastName: "", photoUrl: null });
  assert.deepEqual(versCoachEquipe({ coach_id: "c" }), { coach_id: "c", first_name: null, last_name: null, role: "assistant" });
});

test("noms affichés après un code : vides pour une équipe collégiale ou inconnue", () => {
  assert.deepEqual(nomsAffichablesCode({ teamName: "Dragons", schoolName: "École X", schoolType: "SECONDAIRE" }), { equipe: "Dragons", organisation: "École X" });
  assert.deepEqual(nomsAffichablesCode({ teamName: "Lynx", schoolName: "Club L", schoolType: "LIGUE_CIVILE" }), { equipe: "Lynx", organisation: "Club L" });
  for (const t of ["CEGEP", null, ""]) {
    assert.deepEqual(nomsAffichablesCode({ teamName: "Nomades", schoolName: "Cégep Y", schoolType: t }), { equipe: "", organisation: "" }, String(t));
  }
});

test("web : CoachPicker passe par coachs_nommables_ecole, plus de lecture directe des coachs", () => {
  const src = lire("components/coach/CoachPicker.tsx");
  assert.match(src, /chargerCoachsNommablesEcole\(supabase, schoolId\)/);
  assert.doesNotMatch(src, /\.from\("users"\)/);
  assert.match(src, /if \(entete\) return null;/);
});

test("web : onboarding — « Tu as un code d'équipe ? », aperçu et noms filtrés, section coach par CoachPicker+entete", () => {
  const src = lire("app/athlete/onboarding/page.tsx");
  assert.doesNotMatch(src, /entraîneur t(&apos;|')a donné un code/);
  assert.equal((src.match(/Tu as un code d&apos;équipe \?/g) ?? []).length, 2);
  assert.match(src, /const noms = nomsAffichablesCode\(t\);/);
  assert.match(src, /apercuCodeEquipe\(codeLock\)\.titre/);
  assert.match(src, /<CoachPicker\s+schoolId=\{selectedSchoolId\}[\s\S]{0,400}entete=\{/);
});

test("JoinCodeField (web + mobile) résout par apercu_code_equipe ; /join (anonyme) garde resolve_team_join_token", () => {
  const champ = lire("components/athlete/JoinCodeField.tsx");
  assert.match(champ, /resoudreApercuCode\(createClient\(\), clean\)/);
  assert.doesNotMatch(champ, /resolveTeamJoinToken\(/);
  assert.match(lire("app/join/[code]/page.tsx"), /resolveTeamJoinToken\(createClient\(\), code\)/);
});

test("migration : trois fonctions, droits exacts (authenticated seulement), filtre par coach_nommable", () => {
  const sql = lire("supabase/migrations/20261016040000_coachs_nommables.sql");
  for (const f of ["coachs_nommables_ecole(uuid)", "coachs_nommables_equipe(uuid)", "apercu_code_equipe(text)"]) {
    assert.ok(sql.includes(`revoke all on function public.${f} from public, anon, authenticated;`), f);
    assert.ok(sql.includes(`grant execute on function public.${f} to authenticated;`), f);
  }
  assert.equal((sql.match(/public\.coach_nommable\(/g) ?? []).length >= 2, true);
  assert.doesNotMatch(sql, /to anon/);
  assert.doesNotMatch(sql, /\r/);
});
