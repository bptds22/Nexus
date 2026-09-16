/* ═══════════════════════════════════════════════════════════════
   friendlyDbError — les QUATRE formes d'entrée.

   Le défaut du 2026-09-16 : `e instanceof Error ? e.message : String(e)`
   rendait « [object Object] » pour une erreur PostgREST, qui est un OBJET
   NU — postgrest-js ne construit une vraie PostgrestError que sous
   `.throwOnError()`, jamais utilisé ici. Conséquence la plus visible :
   le marqueur NEXUS: était détruit AVANT son test, et l'athlète lisait
   « [object Object] » au lieu du message de quota.

   Ces tests figent les quatre formes qui atteignent réellement la
   fonction. Le premier est la repro exacte du bogue.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyDbError, apresSuppression } from "@/lib/queries/shared/dbErrors";

/* FORME 1 — l'objet nu de PostgREST, porteur d'un marqueur NEXUS:.
   C'est la forme exacte que rend `const { error } = await supabase.rpc(…)`. */
test("forme 1 — objet PostgREST nu avec NEXUS: → message en clair", () => {
  const erreurPostgrest = {
    code: "P0001",
    details: null,
    hint: null,
    message: "NEXUS: tu as atteint la limite de recherches pour aujourd'hui. Reessaie demain.",
  };
  // Le piège d'origine, refige ici : ce n'est PAS une Error.
  assert.equal(erreurPostgrest instanceof Error, false);

  const sortie = friendlyDbError(erreurPostgrest).message;
  assert.equal(sortie, "tu as atteint la limite de recherches pour aujourd'hui. Reessaie demain.");
  assert.ok(!sortie.includes("[object Object]"));
  assert.ok(!sortie.startsWith("NEXUS:"), "le marqueur est retire avant l'ecran");
});

/* FORME 2 — une vraie Error. Le comportement d'avant doit être intact :
   quand rien n'est réécrit, on rend l'instance D'ORIGINE, pas une copie. */
test("forme 2 — Error classique → instance preservee", () => {
  const e = new Error("Quelque chose a casse");
  const sortie = friendlyDbError(e);
  assert.equal(sortie.message, "Quelque chose a casse");
  assert.equal(sortie, e, "l'erreur d'origine est rendue telle quelle");
});

test("forme 2 bis — Error portant NEXUS: → marqueur retire", () => {
  assert.equal(
    friendlyDbError(new Error("NEXUS: ces informations ne se modifient pas.")).message,
    "ces informations ne se modifient pas.",
  );
});

/* FORME 3 — une chaîne. Elle EST déjà le message. */
test("forme 3 — chaine → rendue telle quelle", () => {
  assert.equal(friendlyDbError("panne reseau").message, "panne reseau");
  assert.equal(friendlyDbError("NEXUS: dis-le simplement").message, "dis-le simplement");
});

/* FORME 4 — un objet SANS message. Avant : « [object Object] ». Maintenant :
   quelque chose de lisible dans un journal, tronque. */
test("forme 4 — objet sans message → JSON tronque, jamais [object Object]", () => {
  const sortie = friendlyDbError({ code: "PGRST301", hint: null }).message;
  assert.ok(!sortie.includes("[object Object]"));
  assert.ok(sortie.includes("PGRST301"), `attendu le code dans « ${sortie} »`);
  assert.ok(sortie.length <= 300);
});

test("forme 4 bis — objet cyclique → ne leve pas", () => {
  const cyclique: Record<string, unknown> = { code: "X" };
  cyclique.soi = cyclique;
  assert.doesNotThrow(() => friendlyDbError(cyclique));
});

/* ── Les chemins de reecriture doivent rester joignables depuis un objet nu ──
   C'est tout l'enjeu : avant le fix, aucun ne l'etait. */
test("objet nu — le plafond est reconnu", () => {
  const sortie = friendlyDbError({
    code: "P0001",
    message: "Maximum 8 lignes par équipe (table team_pennants)",
  }).message;
  assert.equal(sortie, "Maximum 8 fanions — retires-en un avant d'en ajouter un autre.");
});

test("objet nu — la contrainte CHECK est reecrite, sans identifiant SQL", () => {
  const sortie = friendlyDbError({
    code: "23514",
    message: 'new row violates check constraint "school_page_content_ville_check"',
  }).message;
  assert.equal(sortie, "Le nom de ville dépasse 18 caractères — raccourcis-le (par exemple « ST-AUGUSTIN »).");
  assert.ok(!sortie.includes("check constraint"));
});

test("objet nu — le refus de droits devient une invitation a se reconnecter", () => {
  assert.equal(
    friendlyDbError({ code: "42501", message: "permission denied for table athletes" }).message,
    "Ta session a expiré — reconnecte-toi pour enregistrer.",
  );
});

/* ── L'avertissement « ne recharge pas » survit au changement ── */
test("apresSuppression — l'avertissement s'ajoute au message reecrit", () => {
  const sortie = friendlyDbError(
    apresSuppression(new Error("NEXUS: l'insertion a echoue"), "Tes fanions"),
  ).message;
  assert.ok(sortie.startsWith("l'insertion a echoue"));
  assert.ok(sortie.includes("Tes fanions ne sont plus en ligne"));
  assert.ok(sortie.includes("Ne recharge pas la page"));
});
