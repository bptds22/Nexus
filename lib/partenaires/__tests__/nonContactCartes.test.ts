/* Compléments 1.4.5 — période de non-contact sur les cartes prospect partenaire
   (point 5) et « mon effectif » ≠ « autre équipe » (point 10). Web et appli : le
   portail partenaire et la création d'athlète passent par les mêmes fonctions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dateLongueFr, lireNonContactCartes, texteNonContact } from "@/lib/partenaires/prospects";
import { courrielExistant, TEXTES_DEJA_MON_EFFECTIF } from "@/lib/coach/athleteEmailAutocomplete";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("non-contact : la mention, avec la date en français (même forme que le serveur)", () => {
  assert.equal(dateLongueFr("2026-11-10"), "10 novembre 2026");
  assert.equal(dateLongueFr("2027-08-01"), "1 août 2027");
  assert.equal(texteNonContact("2026-11-10"), "Période de non-contact jusqu'au 10 novembre 2026");
});

test("non-contact : une lecture par couple (sport, promotion), la fin rendue par carte ; échec = rien", async () => {
  const appels: unknown[] = [];
  const faux = {
    rpc: async (nom: string, args: { p_sport: string; p_promo: number | null }) => {
      appels.push([nom, args]);
      if (args.p_sport === "panne") return { data: null, error: { message: "x" } };
      return { data: args.p_sport === "foot" && args.p_promo === 2028 ? [{ date_fin: "2026-11-10" }] : [], error: null };
    },
  } as unknown as Parameters<typeof lireNonContactCartes>[0];
  const r = await lireNonContactCartes(faux, [
    { id: "a", sportId: "foot", promotion: 2028 },
    { id: "b", sportId: "foot", promotion: 2028 },
    { id: "c", sportId: "foot", promotion: 2030 },
    { id: "d", sportId: "panne", promotion: null },
  ]);
  assert.deepEqual([...r.entries()], [["a", "2026-11-10"], ["b", "2026-11-10"]]);
  assert.equal(appels.length, 3, "foot|2028 lu une seule fois");
  assert.deepEqual(appels.find((x) => (x as [string, { p_sport: string }])[1].p_sport === "panne"), ["non_contact_carte", { p_sport: "panne", p_promo: null }]);
});

test("non-contact : la page grise « Envoyer par texto » / « Nouveau lien » et la feuille grise texto et copies", () => {
  const page = lire("app/partenaire/prospects/page.tsx");
  assert.match(page, /setNonContact\(await lireNonContactCartes\(supabase, c\)\);/);
  assert.match(page, /disabled=\{occupe === c\.id \|\| !!finNonContact\}/);
  assert.match(page, /\{texteNonContact\(finNonContact\)\}/);
  assert.match(page, /nonContactJusquau=\{nonContact\.get\(lien\.carteId\) \?\? null\}/);
  const feuille = lire("components/partenaire/prospects/EnvoyerLien.tsx");
  assert.match(feuille, /const bloque = !!nonContactJusquau;/);
  assert.match(feuille, /disabled=\{bloque\} onClick=\{\(\) => void copier\("message"\)\}/);
  assert.match(feuille, /disabled=\{bloque\} onClick=\{\(\) => void copier\("lien"\)\}/);
  assert.match(feuille, /\{texteNonContact\(nonContactJusquau as string\)\}/);
});

test("serveur : la garde est dans partenaire_prospect_lien (lot 20261017010000), pas seulement au bouton", () => {
  const sql = lire("supabase/migrations/20261017010000_complements_1_4_5.sql");
  assert.match(sql, /select n\.date_fin into v_fin from public\.non_contact_carte\(v_carte\.sport_id, v_carte\.promotion\) n;/);
  assert.match(sql, /raise exception 'NEXUS: Période de non-contact jusqu''au %'/);
  // Placée AVANT la levée de réservation : un refus ne touche à rien.
  assert.ok(sql.indexOf("non_contact_carte(v_carte.sport_id") < sql.indexOf("prospect_partenaire_lever_reservation_lien(p_carte, 'NOUVEAU_LIEN')"));
});

test("mon effectif ≠ autre équipe : la règle partagée", () => {
  const base = { suggestions: [] as never[] };
  assert.equal(courrielExistant({ ...base, existsExact: false, existsMine: true }), "MON_EFFECTIF");
  assert.equal(courrielExistant({ ...base, existsExact: true, existsMine: false }), "AUTRE_EQUIPE");
  assert.equal(courrielExistant({ ...base, existsExact: false, existsMine: false }), null);
  // Une suggestion invitable passe devant (comme avant) ; base pas encore migrée : comme avant.
  assert.equal(courrielExistant({ suggestions: [{}] as never[], existsExact: true, existsMine: false }), null);
  assert.equal(TEXTES_DEJA_MON_EFFECTIF.titre, "Cet athlète est déjà dans ton effectif");
});

test("mon effectif : web et appli lisent la règle, bloquent la création, affichent le bandeau", () => {
  for (const f of ["app/coach/athletes/create/page.tsx", "components/shared/AthleteWizardMobile.tsx"]) {
    const src = lire(f);
    assert.match(src, /const existant = courrielExistant\(result\);\n\s*setAncreAilleurs\(existant === "AUTRE_EQUIPE"\);\n\s*setDejaMien\(existant === "MON_EFFECTIF"\);/, f);
    assert.match(src, /data-deja-mon-effectif/, f);
    assert.doesNotMatch(src, /setAncreAilleurs\(result\.existsExact/, f);
  }
  assert.match(lire("app/coach/athletes/create/page.tsx"), /if \(ancreAilleurs \|\| dejaMien\) \{/);
  assert.match(lire("components/shared/AthleteWizardMobile.tsx"), /if \(isCreate && dejaMien\) \{/);
});
