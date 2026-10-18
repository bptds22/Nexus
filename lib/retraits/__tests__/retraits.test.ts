/* ═══════════════════════════════════════════════════════════════
   retraits — « Retiré » ne supprime plus rien (BP 2026-10-18).
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RAISONS_RETRAIT, NOTE_RETRAIT_MAX, MESSAGE_MISE_A_JOUR,
  cleRetrait, estRaison, fonctionAbsente, libelleRaison, messageRetrait, resumeRetrait, versRetraits,
} from "@/lib/retraits/retraits";
import { messageRetraitProcessus, MESSAGE_RETRAIT_CARTE } from "@/lib/pipeline/messagesUnite";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("quatre raisons, dans l'ordre de BP, codes alignés sur la base", () => {
  assert.deepEqual(RAISONS_RETRAIT.map((r) => r.code), ["PAS_INTERESSE", "NIVEAU", "ERREUR", "AUTRE"]);
  assert.deepEqual(RAISONS_RETRAIT.map((r) => r.libelle), ["Pas intéressé", "Pas le niveau", "Erreur / pas scouté", "Autre"]);
  assert.equal(NOTE_RETRAIT_MAX, 500);
  assert.equal(estRaison("NIVEAU"), true);
  assert.equal(estRaison("engage_ailleurs"), false);
  assert.equal(libelleRaison("PAS_INTERESSE"), "Pas intéressé");
  assert.equal(libelleRaison("???"), "Retiré");
  // La migration accepte exactement ces codes.
  const sql = lire("supabase/migrations/20261018140000_retrait_garde_la_carte.sql");
  assert.ok(sql.includes("raison in ('PAS_INTERESSE', 'NIVEAU', 'ERREUR', 'AUTRE')"));
});

test("résumé de carte : raison · note · par qui, quand", () => {
  const r = { raison: "NIVEAU", note: "Pas assez rapide pour le D1", retireParNom: "Julie", retireLe: "2026-10-18T15:00:00Z" };
  const txt = resumeRetrait(r);
  assert.ok(txt.startsWith("Pas le niveau · Pas assez rapide pour le D1 · par Julie, "), txt);
  assert.ok(/18/.test(txt));
  assert.equal(resumeRetrait({ raison: "AUTRE", note: "  ", retireParNom: null, retireLe: "pas une date" }), "Autre");
});

test("lecture groupée : clé athlète / carte distincte", () => {
  const m = versRetraits([
    { athlete_id: "x", carte_id: null, raison: "NIVEAU", note: null, retire_par_nom: "Julie", retire_le: "2026-10-18" },
    { athlete_id: null, carte_id: "x", raison: "PAS_INTERESSE", note: "Université", retire_par_nom: null, retire_le: "2026-10-18" },
    { athlete_id: null, carte_id: null, raison: "AUTRE" },
  ]);
  assert.equal(m.size, 2);
  assert.equal(m.get(cleRetrait("x", false))?.raison, "NIVEAU");
  assert.equal(m.get(cleRetrait("x", true))?.note, "Université");
  assert.equal(versRetraits(null).size, 0);
});

test("messages : NEXUS sans préfixe ; fonction absente → mise à jour requise (jamais de suppression)", () => {
  assert.equal(messageRetrait({ message: "NEXUS: choisis la raison du retrait" }), "choisis la raison du retrait");
  assert.equal(fonctionAbsente({ code: "PGRST202", message: "Could not find the function public.unite_retirer" }), true);
  assert.equal(messageRetrait({ code: "PGRST202", message: "x" }), MESSAGE_MISE_A_JOUR);
  assert.equal(messageRetrait({ message: "autre chose" }), "Le retrait n'a pas pu être enregistré. Réessaie.");
  assert.ok(!MESSAGE_RETRAIT_CARTE.includes("supprimée"));
  assert.ok(MESSAGE_RETRAIT_CARTE.includes("Retiré"));
  assert.ok(messageRetraitProcessus(["Marie"], true).includes("passe dans « Retiré » pour toute l'unité"));
});

test("plus aucun appel client à la suppression pour « Retiré » (web, appli, fiche)", () => {
  for (const f of [
    "app/recruteur/pipeline/page.tsx",
    "components/shared/RecruteurPipelineMobile.tsx",
    "lib/queries/recruiter/useRemoveFromPipeline.ts",
    "lib/pipeline/persistPipelineStage.ts",
  ]) {
    const src = lire(f);
    assert.ok(!src.includes('rpc("unite_retirer_du_processus"'), f);
    assert.ok(!/retirerCarte\(/.test(src), f);
  }
  assert.ok(lire("lib/retraits/retraits.ts").includes('rpc("carte_retirer"'));
  assert.ok(lire("lib/retraits/retraits.ts").includes('rpc("unite_retirer"'));
  // La raison remplace l'ancien champ libre jamais enregistré.
  assert.ok(!lire("app/recruteur/pipeline/page.tsx").includes("Raison du retrait (optionnel)"));
  assert.ok(!lire("app/recruteur/_components/StatusChangeDropdown.tsx").includes("Optionnel — sélectionner"));
});

test("affichage : colonne / onglet « Retiré » avec la raison ; hors étapes actives dans l'appli", () => {
  const web = lire("app/recruteur/pipeline/page.tsx");
  assert.ok(web.includes('{card.status === "retire" && <LigneRetrait id={card.id} carte={estCarte(card)} className="mt-1" />}'));
  assert.ok(lire("app/recruteur/pipeline/_data/mockKanbanData.ts").includes('{ id: "retire",           label: "Retiré"'));
  const app = lire("components/shared/RecruteurPipelineMobile.tsx");
  assert.ok(app.includes('const RETIRE: StageConfig = { key: "RETIRE", lower: "retire", label: "Retiré"'));
  assert.ok(app.includes("const ONGLETS: StageConfig[] = [...STAGES, RETIRE];"));
  assert.ok(app.includes("const canSwipeRight = activeStageIndex >= 0 && activeStageIndex < STAGES.length - 1;"));
  // Les raisons se rechargent avec tout le tableau blanc.
  assert.ok(lire("lib/queries/tableauBlanc.ts").includes('"retraits-unite"'));
});

test("favori retiré : le dossier passe en « Retiré » avec une raison, jamais supprimé", () => {
  const src = lire("components/recruteur/unite/useBasculeFavori.tsx");
  assert.ok(!src.includes('rpc("unite_retirer_du_processus"'));
  assert.ok(src.includes("retirerDossier(createClient(), { id: athleteId, carte: false, raison, note })"));
  assert.ok(src.includes("<ChoixRaisonRetrait raison={raison} onRaison={setRaison} note={note} onNote={setNote} />"));
});

test("carte des matchs : un retiré n'est plus « suivi »", () => {
  const sql = lire("supabase/migrations/20261018140000_retrait_garde_la_carte.sql");
  assert.ok(sql.includes("where r.athlete_id = s.athlete_id and r.stage = 'RETIRE'"));
  assert.ok(sql.includes("and cp.etape <> 'RETIRE'"));
});
