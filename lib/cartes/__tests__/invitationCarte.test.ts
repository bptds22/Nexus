/* Le courriel d'invitation d'une carte prospect (edge function
   send-invitation-carte) : son texte, ses liens, son échappement.
   Règle RSEQ (correctif BP 2026-10-16) : ni le recruteur, ni le cégep, ni un
   coach collégial ne sont nommés — invitation comme rappels. */
import { test } from "node:test";
import assert from "node:assert/strict";

// emailLayout.ts lit Deno.env au chargement : un Deno minimal suffit ici.
(globalThis as unknown as { Deno: unknown }).Deno ??= { env: { get: () => undefined } };
// @ts-ignore TS5097 — node --experimental-strip-types EXIGE l'extension .ts.
const { buildBody, sujet, lienInscription } = await import("../../../supabase/functions/send-invitation-carte/email.ts");
// @ts-ignore TS5097
const { expediteur } = await import("../../../supabase/functions/send-invitation-carte/traiter.ts");

const base = { prenom: "Xavier", courriel: "x@exemple.test", desabonnementUrl: "https://n/desabonnement?t=i.a" };
const NEUTRE = "Un recruteur collégial s'intéresse à ton profil. Crée ton compte Nexus pour qu'il puisse te suivre.";

/** Rien qui nomme un établissement ou une personne de l'unité. */
function sansNom(s: string) {
  assert.doesNotMatch(s, /c[ée]gep (de|du|d')|Coll[èe]ge |recruteur (au|du) |coach coll[ée]gial/i);
}

test("objet et texte neutres (règle RSEQ)", () => {
  assert.equal(sujet(), "Un recruteur collégial s'intéresse à ton profil");
  const { text, html } = buildBody(base);
  assert.ok(text.includes(NEUTRE));
  assert.ok(html.includes(NEUTRE));
  assert.match(text, /\nSalut Xavier,\n/);
  assert.doesNotMatch(text, /&#39;|&amp;/, "la version texte n'a aucune entité HTML");
  assert.match(text, /C'est gratuit, et ça prend quelques minutes\./);
  assert.equal((text.match(/Créer mon profil/g) ?? []).length, 1, "un seul lien d'inscription dans le texte");
  sansNom(text); sansNom(html);
});

test("des noms passés par erreur ne sortent jamais (le gabarit ne les lit pas)", () => {
  const { text, html } = buildBody({ ...base, recruteur: "Rémi Collègue", cegep: "Cégep de Saint-Jérôme" } as typeof base);
  for (const s of [text, html]) {
    assert.doesNotMatch(s, /Rémi|Collègue|Saint-Jérôme/);
  }
});

test("lien d'inscription pré-rempli, désabonnement et adresse postale (LCAP)", () => {
  assert.equal(lienInscription("a+b@x.ca"), "https://nexussports.ca/auth?mode=signup&email=a%2Bb%40x.ca");
  const { html } = buildBody(base);
  assert.ok(html.includes("https://n/desabonnement?t=i.a"));
  assert.ok(html.includes("Basile-Routhier"));
  assert.match(html, /Tu reçois ce courriel parce qu'un recruteur collégial a indiqué ton adresse/);
});

test("sans prénom : « Salut, »", () => {
  assert.match(buildBody({ ...base, prenom: null }).text, /\nSalut,\s+Un recruteur collégial/);
});

test("une saisie contenant du HTML est échappée", () => {
  const { html } = buildBody({ ...base, prenom: "<b>X</b>" });
  assert.ok(!html.includes("<b>X</b>"));
});

test("expéditeur : « Nexus <info@nexussports.ca> », jamais au nom du recruteur", () => {
  assert.equal(expediteur(), "Nexus <info@nexussports.ca>");
});

test("rappel : « Rappel : » dans l'objet et le titre, même corps neutre, désabonnement et adresse postale", () => {
  assert.equal(sujet(true), "Rappel : Un recruteur collégial s'intéresse à ton profil");
  const { html, text } = buildBody({ ...base, rappel: true });
  assert.ok(html.includes("Rappel : Un recruteur collégial s'intéresse à ton profil"));
  assert.ok(text.includes(NEUTRE));
  assert.ok(html.includes("https://n/desabonnement?t=i.a"));
  assert.ok(html.includes("Basile-Routhier"));
  assert.match(html, /Tu reçois ce rappel parce qu'un recruteur collégial t'a invité sur Nexus/);
  sansNom(text); sansNom(html);
});

test("l'invitation ne promet plus « pas d'autre courriel » : elle annonce les rappels possibles", () => {
  const { html } = buildBody(base);
  assert.doesNotMatch(html, /pas d'autre courriel/);
  assert.match(html, /au plus 3 rappels/);
});
