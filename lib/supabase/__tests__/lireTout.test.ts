/* Lectures sans plafond — correctif du 2026-10-16 (décision BP : aucun plafond, aucune erreur en silence).
   lireTout lit toutes les pages et vérifie le total ; fetchAllRows lève ses erreurs ; les lecteurs
   « stricts » lèvent, les lecteurs « tolérants » (mobile, badges) gardent leur contrat mais lisent tout.
   Banc SQL : docs/lectures-sans-plafond/tests-lectures-sans-plafond.sql ; preuve HTTP (PostgREST réel) :
   docs/lectures-sans-plafond/preuve-http.test.ts. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lireTout, idsUniques } from "@/lib/supabase/lireTout";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { lireCoachAthleteScope, loadCoachAthleteScope } from "@/lib/queries/coach/getCoachAthletes";
import { lireCoachPipeline, fetchCoachPipeline } from "@/lib/pipeline/pipelineVues";
import { lireCartesParIds } from "@/lib/cartes/carteProspect";
import { fetchRecruiterAthleteCards } from "@/lib/queries/shared/recruiterAthleteCards";

/** Une « table » de n lignes servie par pages, comme PostgREST (max-rows = 1000). */
function pages<T>(lignes: T[], max = 1000) {
  const vues: [number, number][] = [];
  const page = async (de: number, a: number) => {
    vues.push([de, a]);
    return { data: lignes.slice(de, Math.min(a + 1, de + max)), error: null, count: lignes.length };
  };
  return { page, vues };
}

test("lireTout : 2 500 lignes → 3 pages, tout est rendu, dans l'ordre", async () => {
  const lignes = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
  const { page, vues } = pages(lignes);
  const r = await lireTout<{ id: number }>(page);
  assert.equal(r.length, 2500);
  assert.deepEqual(vues, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.deepEqual(r.map((x) => x.id), lignes.map((x) => x.id));
});

test("lireTout : sous une page, un seul appel", async () => {
  const { page, vues } = pages([{ id: 1 }, { id: 2 }]);
  assert.equal((await lireTout(page)).length, 2);
  assert.equal(vues.length, 1);
});

test("lireTout : une erreur à n'importe quelle page est LEVÉE, jamais une liste partielle", async () => {
  let n = 0;
  const page = async () => (++n === 2
    ? { data: null, error: { message: "boom" }, count: null }
    : { data: Array.from({ length: 1000 }, (_, i) => ({ i })), error: null, count: 2500 });
  await assert.rejects(lireTout(page), { message: "boom" });
});

test("lireTout : sans total exact, refus (on ne sait pas si c'est complet)", async () => {
  await assert.rejects(lireTout(async () => ({ data: [{ a: 1 }], error: null, count: null })), /total absent/);
});

test("lireTout : page vide avant le total annoncé = erreur (des lignes ont disparu entre deux pages)", async () => {
  let n = 0;
  const page = async () => (++n === 1
    ? { data: Array.from({ length: 1000 }, (_, i) => ({ i })), error: null, count: 1500 }
    : { data: [], error: null, count: 1500 });
  await assert.rejects(lireTout(page), /1000 lignes lues sur 1500/);
});

test("lireTout : réponse qui n'est pas une liste = erreur", async () => {
  await assert.rejects(lireTout(async () => ({ data: { pas: "liste" }, error: null, count: 1 })), /pas une liste/);
});

test("idsUniques : sans doublon ni vide", () => {
  assert.deepEqual(idsUniques(["a", null, "b", "a", undefined, ""]), ["a", "b"]);
});

test("fetchAllRows : une erreur est LEVÉE (avant : journalisée, liste partielle rendue)", async () => {
  let n = 0;
  const build = async () => (++n === 1
    ? { data: Array.from({ length: 1000 }, (_, i) => ({ i })), error: null }
    : { data: null, error: { message: "coupure" } });
  await assert.rejects(fetchAllRows(build, "test"), /\[test\] coupure/);
});

/** Faux client supabase-js : enregistre la chaîne d'appels, sert des pages d'un jeu de lignes par fonction. */
function client(lignesPar: Record<string, unknown[]>, erreurPar: Record<string, string> = {}) {
  const appels: { fn: string; args: unknown; ordres: string[]; plages: [number, number][]; options?: unknown }[] = [];
  const constructeur = (fn: string, args: unknown, options?: unknown) => {
    const appel = { fn, args, ordres: [] as string[], plages: [] as [number, number][], options };
    appels.push(appel);
    const b = {
      select: () => b,
      eq: () => b,
      order: (col: string) => { appel.ordres.push(col); return b; },
      range: (de: number, a: number) => {
        appel.plages.push([de, a]);
        if (erreurPar[fn]) return Promise.resolve({ data: null, error: { message: erreurPar[fn] }, count: null });
        const toutes = lignesPar[fn] ?? [];
        return Promise.resolve({ data: toutes.slice(de, Math.min(a + 1, de + 1000)), error: null, count: toutes.length });
      },
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: lignesPar[fn] ?? null, error: erreurPar[fn] ? { message: erreurPar[fn] } : null }).then(ok),
    };
    return b;
  };
  return {
    client: { rpc: (fn: string, args: unknown, options?: unknown) => constructeur(fn, args, options), from: (t: string) => constructeur(t, null) } as never,
    appels,
  };
}

test("lireCoachAthleteScope : TOUT le périmètre (1 500 athlètes = 2 pages), trié par athlete_id, count exact", async () => {
  const rows = Array.from({ length: 1500 }, (_, i) => ({ athlete_id: `a${i}`, relation: "TEAM", status: "ACTIF" }));
  const { client: c, appels } = client({ get_coach_athletes: rows });
  const r = await lireCoachAthleteScope(c, { includePending: false });
  assert.equal(r.ids.length, 1500);
  assert.equal(appels.length, 2);
  assert.deepEqual(appels[0].args, { p_include_pending: false });
  assert.deepEqual(appels[0].ordres, ["athlete_id"]);
  assert.deepEqual(appels[0].options, { count: "exact" });
});

test("lireCoachAthleteScope lève ; loadCoachAthleteScope garde son contrat (périmètre vide, journalisé)", async () => {
  const { client: c } = client({}, { get_coach_athletes: "jwt expired" });
  await assert.rejects(lireCoachAthleteScope(c), { message: "jwt expired" });
  const erreurOriginale = console.error;
  console.error = () => {};
  try {
    const r = await loadCoachAthleteScope(c);
    assert.deepEqual(r.ids, []);
  } finally {
    console.error = erreurOriginale;
  }
});

test("lireCoachPipeline : toutes les lignes, clé de tri (athlete_id, recruiter_id) ; fetchCoachPipeline tolérant", async () => {
  const rows = Array.from({ length: 1200 }, (_, i) => ({ athlete_id: `a${i}`, recruiter_id: "r", stage: "IDENTIFIE", updated_at: null }));
  const { client: c, appels } = client({ coach_pipeline_for_my_athletes: rows });
  assert.equal((await lireCoachPipeline(c, { athleteIds: ["a1"] })).length, 1200);
  assert.deepEqual(appels[0].ordres, ["athlete_id", "recruiter_id"]);
  const { client: enPanne } = client({}, { coach_pipeline_for_my_athletes: "boom" });
  await assert.rejects(lireCoachPipeline(enPanne), { message: "boom" });
  const erreurOriginale = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await fetchCoachPipeline(enPanne), []);
  } finally {
    console.error = erreurOriginale;
  }
});

test("fetchRecruiterAthleteCards : identifiants dans le corps, toutes les pages (2 000 cartes)", async () => {
  const ids = Array.from({ length: 2000 }, (_, i) => `a${i}`);
  const rows = ids.map((id) => ({ id, identity_visible: true }));
  const { client: c, appels } = client({ recruiter_athlete_cards: rows });
  const cartes = await fetchRecruiterAthleteCards(c, ids);
  assert.equal(cartes.size, 2000);
  assert.equal(appels.length, 2);
  assert.deepEqual(appels[0].args, { p_athlete_ids: ids });
  assert.deepEqual(appels[0].ordres, ["id"]);
});

test("lireCartesParIds : cartes_par_ids (une valeur, ids dans le corps) ; erreur levée", async () => {
  const ids = Array.from({ length: 900 }, (_, i) => `c${i}`);
  const rows = ids.map((id) => ({ id, prenom: "x", nom: "y", teams: null, positions: null, etablissement: null }));
  const appels: { fn: string; args: unknown }[] = [];
  const c = { rpc: async (fn: string, args: unknown) => { appels.push({ fn, args }); return { data: rows, error: null }; } } as never;
  assert.equal((await lireCartesParIds(c, ids)).length, 900);
  assert.deepEqual(appels, [{ fn: "cartes_par_ids", args: { p_ids: ids } }]);
  const enPanne = { rpc: async () => ({ data: null, error: { message: "414" } }) } as never;
  await assert.rejects(lireCartesParIds(enPanne, ids), { message: "414" });
  assert.deepEqual(await lireCartesParIds(c, []), []);
});
