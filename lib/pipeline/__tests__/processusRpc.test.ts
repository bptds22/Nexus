/* Mon processus — correctif urgent du 2026-10-16 (décision BP) : cartes et dernières notes lues par
   fonctions en base (une valeur jsonb : ni identifiants dans l'adresse, ni plafond de 1000 lignes), notes
   en seconde lecture avec indicateur, aucune erreur en silence, rendu mobile par tranches.
   Banc SQL : docs/processus-rpc/tests-processus-rpc.sql. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { lireCartes, lireDernieresNotesProcessus } from "@/lib/cartes/carteProspect";
import { appliquerDernieresNotes, notesParLigne } from "@/lib/pipeline/dernieresNotes";
import { tailleSuivante, TRANCHE_AFFICHAGE, PREMIERE_TRANCHE } from "@/lib/pipeline/tranches";
import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** Faux client : enregistre les appels rpc ; refuse toute lecture .from() (plus de liste d'ids dans l'adresse). */
function faux(reponse: { data?: unknown; error?: { message: string } | null }) {
  const appels: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => { appels.push({ fn, args }); return { data: reponse.data ?? null, error: reponse.error ?? null }; },
    from: () => { throw new Error("lecture .from() interdite ici"); },
  };
  return { client: client as never, appels };
}

const LIGNE = { id: "c1", prenom: "Léa", nom: "Roy", teams: null, positions: null, etablissement: null };

test("lireCartes : processus_cartes (une valeur), mêmes filtres ; 5 000 cartes rendues telles quelles", async () => {
  const beaucoup = Array.from({ length: 5000 }, (_, i) => ({ ...LIGNE, id: `c${i}` }));
  const { client, appels } = faux({ data: beaucoup });
  const r = await lireCartes(client, { cegepId: "cg", sportId: "sp", toutLeCegep: false });
  assert.equal(r.length, 5000);
  assert.deepEqual(appels, [{ fn: "processus_cartes", args: { p_cegep_id: "cg", p_sport_id: "sp", p_tout_le_cegep: false } }]);
  await lireCartes(client, { cegepId: null, sportId: null, toutLeCegep: true });
  assert.deepEqual(appels[1].args, { p_cegep_id: null, p_sport_id: null, p_tout_le_cegep: true });
});

test("lireCartes : une erreur est LEVÉE, jamais une liste vide ; réponse non tableau = erreur", async () => {
  await assert.rejects(lireCartes(faux({ error: { message: "boom" } }).client, { cegepId: "cg", sportId: null }), { message: "boom" });
  await assert.rejects(lireCartes(faux({ data: { pas: "un tableau" } }).client, { cegepId: "cg", sportId: null }), /inattendue/);
});

test("lireDernieresNotesProcessus : processus_dernieres_notes ; erreur levée ; parties absentes → {}", async () => {
  const note = { content: "Vu au match", created_at: "2026-10-15T20:00:00+00:00", auteur: "r1" };
  const { client, appels } = faux({ data: { cartes: { c1: note }, dossiers: null } });
  const r = await lireDernieresNotesProcessus(client, { cegepId: "cg", sportId: "sp" });
  assert.deepEqual(r, { cartes: { c1: note }, dossiers: {} });
  assert.deepEqual(appels, [{ fn: "processus_dernieres_notes", args: { p_cegep_id: "cg", p_sport_id: "sp", p_tout_le_cegep: false } }]);
  await assert.rejects(lireDernieresNotesProcessus(faux({ error: { message: "414" } }).client, { cegepId: "cg", sportId: null }), { message: "414" });
  await assert.rejects(lireDernieresNotesProcessus(faux({ data: null }).client, { cegepId: "cg", sportId: null }), /inattendue/);
});

const carte = (id: string) => ({ id, pipeline_id: id, carte: { prenom: "x" } }) as unknown as PipelineKanbanCard;
const dossier = (id: string) => ({ id, pipeline_id: id }) as unknown as PipelineKanbanCard;
const nom = (id: string | null) => (id === "r1" ? "Marc Roy" : "Recruteur");

test("notes en chargement : marque « chargement » sur chaque carte, JAMAIS derniere_note = null (aucune note)", () => {
  const r = appliquerDernieresNotes([carte("c1"), dossier("a1")], undefined, "chargement", nom);
  for (const c of r) { assert.equal(c.derniere_note_etat, "chargement"); assert.equal(c.derniere_note, undefined); }
});

test("notes en erreur sans notes reçues : marque « erreur »", () => {
  const r = appliquerDernieresNotes([carte("c1")], undefined, "erreur", nom);
  assert.equal(r[0].derniere_note_etat, "erreur");
  assert.equal(r[0].derniere_note, undefined);
});

test("notes reçues : carte par la table des cartes, dossier par celle des dossiers ; sans note → null ; auteur nommé", () => {
  const n = { content: "Bon bras", created_at: "2026-10-15T20:00:00+00:00", auteur: "r1" };
  const r = appliquerDernieresNotes([carte("c1"), dossier("a1"), carte("c2")],
    { cartes: { c1: n }, dossiers: { a1: { ...n, content: "Rapide" } } }, "pret", nom);
  assert.deepEqual(r[0].derniere_note, { content: "Bon bras", created_at: n.created_at, auteur: "Marc Roy" });
  assert.equal(r[1].derniere_note?.content, "Rapide");
  assert.equal(r[2].derniere_note, null);
  for (const c of r) assert.equal(c.derniere_note_etat, undefined);
  // Même identifiant dans l'autre table : jamais croisé (une carte ne prend pas la note d'un dossier).
  const croise = appliquerDernieresNotes([carte("x")], { cartes: {}, dossiers: { x: n } }, "pret", nom);
  assert.equal(croise[0].derniere_note, null);
});

test("notes déjà reçues + rechargement en échec : les notes restent affichées (pas de marque)", () => {
  const n = { content: "Bon bras", created_at: "2026-10-15T20:00:00+00:00", auteur: null };
  const r = appliquerDernieresNotes([carte("c1")], { cartes: { c1: n }, dossiers: {} }, "pret", nom);
  assert.equal(r[0].derniere_note?.auteur, "Recruteur");
  assert.equal(r[0].derniere_note_etat, undefined);
});

test("export : toutes les notes de chaque ligne, dans l'ordre reçu, signées", () => {
  const out = notesParLigne({
    dossiers: [{ id: "a1", content: "un", created_at: "2026-01-01", auteur: "r1" }],
    cartes: [{ id: "c1", content: "deux", created_at: "2026-01-02", auteur: null }, { id: "c1", content: "trois", created_at: "2026-01-03", auteur: "r1" }],
  }, nom, (d) => d);
  assert.deepEqual(out, { a1: ["2026-01-01 — Marc Roy — un"], c1: ["2026-01-02 — Recruteur — deux", "2026-01-03 — Marc Roy — trois"] });
  assert.deepEqual(notesParLigne({ dossiers: null, cartes: null }, nom, (d) => d), {});
});

test("tranches mobiles : +50 à chaque fois, jamais au-delà du total ; tout finit affiché", () => {
  assert.equal(TRANCHE_AFFICHAGE, 50);
  assert.equal(PREMIERE_TRANCHE, 20);
  assert.equal(tailleSuivante(50, 952), 100);
  assert.equal(tailleSuivante(950, 952), 952);
  let n = TRANCHE_AFFICHAGE, pas = 0;
  while (n < 5000) { n = tailleSuivante(n, 5000); pas++; }
  assert.equal(n, 5000);
  assert.equal(pas, 99);
});

test("plus aucune lecture d'ids dans l'adresse pour le processus (hook, export)", () => {
  const hook = lire("lib/queries/recruiter/useProcessusUnite.ts");
  assert.doesNotMatch(hook, /\.in\("(athlete_id|carte_id)"/);
  assert.doesNotMatch(hook, /lireDernieresNotesCartes/);
  assert.match(hook, /lireDernieresNotesProcessus\(/);
  assert.doesNotMatch(hook, /catch \(e\)/, "plus de try/catch qui avale l'erreur des cartes");
  const page = lire("app/recruteur/pipeline/page.tsx");
  assert.doesNotMatch(page, /\.from\("cartes_prospect_notes"\)/);
  assert.doesNotMatch(page, /\.from\("recruiter_notes"\)[\s\S]{0,120}\.in\("athlete_id"/);
  assert.match(page, /processus_notes_export/);
  const cartes = lire("lib/cartes/carteProspect.ts");
  assert.doesNotMatch(cartes, /\.in\("carte_id"/);
});

test("écrans : erreur affichée avec « Réessayer » (web, mobile, tableau de bord) ; indicateur de note ; mobile par tranches", () => {
  const page = lire("app/recruteur/pipeline/page.tsx");
  assert.match(page, /<ErreurChargement message=\{MESSAGES_PROCESSUS\.cartes\(!!donneesUnite\)\} onReessayer=\{reessayerUnite\} \/>/);
  assert.match(page, /<ErreurChargement message=\{MESSAGES_PROCESSUS\.notes\} onReessayer=\{notesUnite\.reessayer\} \/>/);
  assert.match(page, /derniere_note_etat === "chargement"/);
  const mobile = lire("components/shared/RecruteurPipelineMobile.tsx");
  assert.match(mobile, /<ListeParTranches/);
  assert.match(mobile, /items=\{activeStageCards\}/);
  assert.equal((mobile.match(/<ErreurChargement /g) ?? []).length, 2);
  // Le mobile n'affiche aucune note : pas de seconde lecture (pipeline et tableau de bord).
  assert.match(mobile, /avecNotes: false/);
  assert.match(lire("components/shared/RecruteurDashboardMobile.tsx"), /useProcessusUnite\(\{ enabled: canUsePipeline, avecNotes: false \}\)/);
  // Les cartes partent en parallèle des lectures de l'unité (plus d'attente en série).
  assert.match(lire("lib/queries/recruiter/useProcessusUnite.ts"), /\[\[pipe, grades, auteurs\], \[lignesCartes, sportsRes\]\] = await Promise\.all/);
  assert.match(lire("components/shared/RecruteurDashboardMobile.tsx"), /<ErreurChargement message=\{MESSAGES_PROCESSUS\.cartes/);
  assert.match(lire("components/shared/ErreurChargement.tsx"), />\s*Réessayer\s*</);
});

test("migration : quatre fonctions, droits exacts, une seule valeur jsonb, accès reproduit et gardé", () => {
  const sql = lire("supabase/migrations/20261016060000_processus_cartes_rpc.sql");
  const sigs = ["processus_cartes(uuid, uuid, boolean)", "processus_dernieres_notes_cartes(uuid, uuid, boolean)",
    "processus_dernieres_notes(uuid, uuid, boolean)", "processus_notes_export(uuid[], uuid[])"];
  for (const f of sigs) {
    assert.ok(sql.includes(`revoke all on function public.${f} from public, anon, authenticated;`), f);
    assert.ok(sql.includes(`grant execute on function public.${f} to authenticated;`), f);
  }
  assert.equal((sql.match(/^returns jsonb$/gm) ?? []).length, 4);
  assert.doesNotMatch(sql, /to anon/);
  assert.equal((sql.match(/as materialized/g) ?? []).length, 4, "accès évalué une fois par unité");
  assert.match(sql, /policies de lecture des cartes ≠ relevé/);
  assert.equal(createHash("md5").update(sql).digest("hex").length, 32);
});
