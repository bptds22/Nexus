/* P2/P3 (1.4.5) — « comme le recruteur » : le partenaire voit les correspondances de ses cartes et
   décide (Accepter / Refuser). Migration 20261018100000. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chargerRapprochements, libelleNiveauPartenaire, parCarte } from "@/lib/partenaires/rapprochements";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("P2/P3 : lecture et décision par les trois fonctions de la migration", async () => {
  const appels: string[] = [];
  const faux = {
    // Lecture par pages (lireTout, 2026-10-18) : rpc(…).select(…).order(…).range(…).
    rpc: (nom: string) => {
      appels.push(nom);
      const res = { data: [{ carte_id: "c1", athlete_id: "a1", prenom: "Alexis", nom: "Caron", ecole: "X", sport: "Football", promotion: 2028, photo_url: null, critere: "ETABLISSEMENT", force: "MOYENNE", deja_propose: false }], error: null, count: 1 };
      const b = { select: () => b, order: () => b, range: async () => res };
      return b;
    },
  } as unknown as Parameters<typeof chargerRapprochements>[0];
  const r = await chargerRapprochements(faux);
  assert.deepEqual(appels, ["partenaire_rapprochements"]);
  assert.equal(r[0].prenom, "Alexis");
  assert.equal(r[0].force, "MOYENNE");
  assert.deepEqual([...parCarte([...r, { ...r[0], athleteId: "a2" }]).entries()], [["c1", 2]]);
  const lib = lire("lib/partenaires/rapprochements.ts");
  assert.ok(lib.includes('supabase.rpc("partenaire_rapprochement_accepter", { p_carte: r.carteId, p_athlete: r.athleteId })'));
  assert.ok(lib.includes('supabase.rpc("partenaire_rapprochement_refuser", { p_carte: r.carteId, p_athlete: r.athleteId })'));
});

test("P2/P3 : les niveaux dans les mots du recruteur", () => {
  assert.deepEqual(libelleNiveauPartenaire("EQUIPE"), { texte: "Correspondance : même nom, même équipe", fort: true });
  assert.deepEqual(libelleNiveauPartenaire("ETABLISSEMENT"), { texte: "Correspondance : même nom, même établissement", fort: true });
  assert.deepEqual(libelleNiveauPartenaire("ECOLE_PROCHE"), { texte: "Possiblement le même athlète", fort: false });
});

test("P2/P3 : « Mes athlètes » — bandeau, lien sur la carte, fenêtre ; plus de « c'est lui qui décide »", () => {
  const page = lire("components/partenaire/CartesEnAttenteWeb.tsx");
  for (const extrait of [
    "setRapprochements(await chargerRapprochements(supabase).catch(() => []));",
    "<BandeauRapprochementsPartenaire total={rapprochements.length} onVoir={() => setFenetre({})} />",
    "<LienRapprochementCarte n={nbParCarte.get(c.id) ?? 0} onVoir={() => setFenetre({ carteId: c.id })} />",
    "<FenetreRapprochementsPartenaire",
    "onDecide={() => void charger()}",
  ]) assert.ok(page.includes(extrait), extrait);
  assert.ok(!page.includes("c&apos;est lui qui décide"));
  const ui = lire("components/partenaire/prospects/RapprochementsPartenaire.tsx");
  assert.ok(ui.includes('onClick={() => void decider(r, "accepter")} className={classesBouton("principal")}'), "Accepter en rouge");
  assert.ok(ui.includes('onClick={() => void decider(r, "refuser")} className={classesBouton("secondaire")}'));
});

test("P2/P3 : la migration ne montre que des athlètes déjà visibles du partenaire", () => {
  const sql = lire("supabase/migrations/20261018100000_rapprochement_partenaire.sql");
  assert.ok(sql.includes("where coalesce(public.is_partner_eligible_athlete(a.id), false)"));
  assert.ok(sql.includes("return public.prospect_partenaire_transferer(p_carte, p_athlete);"));
  assert.ok(sql.includes("reservee_par = auth.uid()"));
});
