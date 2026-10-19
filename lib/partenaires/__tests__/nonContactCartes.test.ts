/* Compléments 1.4.5 — période de non-contact (P5 : le texto du RECRUTEUR se grise, le partenaire
   n'est plus bloqué) et « mon effectif » ≠ « autre équipe » (point 10). Web et appli : le
   portail partenaire et la création d'athlète passent par les mêmes fonctions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dateLongueFr, lireNonContact, texteNonContact } from "@/lib/nonContact";
import { courrielExistant, TEXTES_DEJA_MON_EFFECTIF } from "@/lib/coach/athleteEmailAutocomplete";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("non-contact : la mention, avec la date en français", () => {
  assert.equal(dateLongueFr("2026-11-10"), "10 novembre 2026");
  assert.equal(dateLongueFr("2027-08-01"), "1 août 2027");
  assert.equal(texteNonContact("2026-11-10"), "Période de non-contact jusqu'au 10 novembre 2026");
});

test("non-contact : lireNonContact rend la fin de période, null sans période ou en échec", async () => {
  const appels: unknown[] = [];
  const faux = {
    rpc: async (nom: string, args: { p_sport: string; p_promo: number | null }) => {
      appels.push([nom, args]);
      if (args.p_sport === "panne") return { data: null, error: { message: "x" } };
      return { data: args.p_sport === "foot" && args.p_promo === 2028 ? [{ date_fin: "2026-11-10" }] : [], error: null };
    },
  } as unknown as Parameters<typeof lireNonContact>[0];
  assert.equal(await lireNonContact(faux, "foot", 2028), "2026-11-10");
  assert.equal(await lireNonContact(faux, "foot", 2030), null);
  assert.equal(await lireNonContact(faux, "panne", null), null);
  assert.deepEqual(appels[2], ["non_contact_carte", { p_sport: "panne", p_promo: null }]);
});

test("P5 : le partenaire n'est plus grisé (page et feuille d'envoi)", () => {
  for (const f of ["components/partenaire/CartesEnAttenteWeb.tsx", "components/partenaire/prospects/EnvoyerLien.tsx", "lib/partenaires/prospects.ts"]) {
    const src = lire(f);
    assert.doesNotMatch(src, /non_contact_carte|nonContact|NonContact/, f);
  }
});

test("P5 : le texto du recruteur se grise (téléphone sans courriel) avec la date de fin", () => {
  const src = lire("components/shared/CreerProspectMobile.tsx");
  for (const extrait of [
    "queryFn: () => lireNonContact(createClient(), sportAthleteId, promoNombre)",
    "const texteBloque = !!finNonContact && courriel.trim().length === 0 && telephone.trim().length > 0;",
    // Nuit du 2026-10-18 : deux boutons ; seul « Créer et inviter » (texto) se grise.
    "disabled={!valide || enCours || !boutons.inviter || texteBloque}",
    "if (!valide || enCours || !etablissement || texteBloque) return;",
    "{texteNonContact(finNonContact)}",
  ]) assert.ok(src.includes(extrait), extrait);
});

test("serveur (20261017140000) : la garde partenaire est retirée, non_contact_carte reste", () => {
  const sql = lire("supabase/migrations/20261017140000_non_contact_retrait_partenaire.sql");
  const corps = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.partenaire_prospect_lien"), sql.indexOf("end $lien$;"));
  assert.doesNotMatch(corps, /non_contact_carte|v_fin/);
  assert.doesNotMatch(sql, /drop function public.non_contact_carte/i);
  assert.match(sql, /is distinct from '8670f3dae66bff7295b1da08587a2bf0'/);
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
