/* ═══════════════════════════════════════════════════════════════
   Retiré sur la fiche (BP 2026-10-18, nuit) : on peut toujours retirer,
   retiré = plus en favori, remettre en favori sort de Retiré, statut et
   détail visibles, « Changer le statut » à côté du statut.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estHorsProcessus, retirerDossier, sortirDeRetire } from "@/lib/retraits/retraits";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** Faux client : enregistre les appels, refuse unite_retirer une fois si demandé. */
function fauxClient(opts: { horsProcessus?: boolean; erreurFavori?: boolean } = {}) {
  const appels: { fn: string; args: Record<string, unknown> }[] = [];
  let refus = !!opts.horsProcessus;
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      appels.push({ fn, args });
      if (fn === "unite_retirer" && refus) {
        refus = false;
        return { data: null, error: { code: "P0001", message: "NEXUS: cet athlète n'est pas dans le processus de ton unité" } };
      }
      if (fn === "unite_retirer_favori" && opts.erreurFavori) return { data: null, error: { code: "XX", message: "boom" } };
      return { data: 1, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, appels };
}

test("hors processus : le dossier s'ouvre (Identifié) puis se retire, et le cœur part", async () => {
  const { client, appels } = fauxClient({ horsProcessus: true });
  const err = await retirerDossier(client, { id: "a1", carte: false, raison: "ERREUR", note: " pas scouté " });
  assert.equal(err, null);
  assert.deepEqual(appels.map((a) => a.fn), ["unite_retirer", "unite_ecrire_dossier", "unite_retirer", "unite_retirer_favori"]);
  assert.deepEqual(appels[1].args, { p_athlete_id: "a1", p_champs: { stage: "IDENTIFIE" } });
  assert.equal(appels[2].args.p_note, "pas scouté");
});

test("dossier existant : un seul retrait, puis le cœur ; un échec du cœur n'annule pas le retrait", async () => {
  const { client, appels } = fauxClient({ erreurFavori: true });
  const err = await retirerDossier(client, { id: "a2", carte: false, raison: "NIVEAU" });
  assert.equal(err, null);
  assert.deepEqual(appels.map((a) => a.fn), ["unite_retirer", "unite_retirer_favori"]);
});

test("carte prospect : carte_retirer seul, aucun cœur", async () => {
  const { client, appels } = fauxClient();
  await retirerDossier(client, { id: "c1", carte: true, raison: "AUTRE" });
  assert.deepEqual(appels.map((a) => a.fn), ["carte_retirer"]);
});

test("sortir de Retiré = première étape (Identifié)", async () => {
  const { client, appels } = fauxClient();
  assert.equal(await sortirDeRetire(client, "a3"), null);
  assert.deepEqual(appels, [{ fn: "unite_ecrire_dossier", args: { p_athlete_id: "a3", p_champs: { stage: "IDENTIFIE" } } }]);
  assert.equal(estHorsProcessus({ message: "NEXUS: cet athlète n'est pas dans le processus de ton unité" }), true);
  assert.equal(estHorsProcessus({ message: "autre" }), false);
});

test("« Aussi en favori chez » : les vrais noms (unite_auteurs), jamais de nom vide", () => {
  const src = lire("components/recruteur/unite/useBasculeFavori.tsx");
  assert.ok(src.includes('const collegues = nomsCollegues.map((n) => (n ?? "").trim()).filter(Boolean);'));
  assert.ok(lire("lib/queries/recruiter/useFavorisUnite.ts").includes(".filter((id) => id !== moi).map(nom)"));
});

test("remettre en favori un retiré le sort de Retiré", () => {
  const src = lire("components/recruteur/unite/useBasculeFavori.tsx");
  // BP 2026-10-19 : une fenêtre dit qu'il a été retiré (raison lue AVANT, la base l'efface ensuite), puis confirme.
  assert.ok(src.includes('if (avant?.etape !== "RETIRE") return definirFavori(queryClient, athleteId, true);'));
  assert.ok(src.includes("const retrait = await lireRetrait(athleteId);"));
  assert.ok(src.includes('testId="fenetre-remettre-favori"'));
  assert.ok(src.includes("sortirDeRetire(createClient(), athleteId)"));
});

test("fiche web : Retiré nommé, Changer le statut à côté, hors processus permis, relance d'unité", () => {
  const web = lire("components/shared/AthleteRecruiterProfileBody.tsx");
  assert.ok(web.includes('RETIRE: "Retiré",'));
  assert.ok(web.includes("declencheur={<DeclencheurStatut libelle={libelleStatut} />}"));
  assert.ok(web.includes('currentStatus="none"'));
  assert.ok(web.includes('if (newStatus === "retire") setIsFavorited(false);'));
  assert.ok(web.includes('myPipelineStage.toUpperCase() !== "RETIRE" && ('));
  assert.ok(web.includes("<RelanceFiche athleteId={id} className=\"h-full\" modeUnite lienProcessus />"));
  const dd = lire("app/recruteur/_components/StatusChangeDropdown.tsx");
  assert.ok(!dd.includes('if (currentStatus === "none") return null;'));
  assert.ok(dd.includes("Le remettre à l'étape"));
});

test("fiche appli : bouton à côté du statut, détail du retrait, Le remettre, relance d'unité", () => {
  const app = lire("components/shared/AthleteRecruiterProfileBodyMobile.tsx");
  assert.ok(app.includes('RETIRE: "Retiré",'));
  assert.ok(app.includes('{upper === "RETIRE" && <LigneRetrait id={id} carte={false}'));
  assert.equal(app.split("<BoutonChangerStatut onOuvrir=").length - 1, 2);
  assert.ok(app.includes("Le remettre"));
  assert.ok(app.includes("relire(onRetirer({ raison: raisonRetrait, note: noteRetrait }));"));
  assert.ok(app.includes("<RelanceFiche athleteId={id} modeUnite lienProcessus />"));
  assert.ok(!app.includes('pipelineStatus !== "none" && (\n          <div className="mt-4 flex justify-center">'));
});

test("relance : la phrase ne contredit plus le champ, lien vers Mon processus", () => {
  const src = lire("components/shared/RelanceFiche.tsx");
  assert.ok(!src.includes('"La note de relance se saisit dans Mon processus."'));
  assert.ok(src.includes("Même date que dans Mon processus."));
  assert.ok(src.includes('href="/recruteur/pipeline"'));
});
