/* Le courriel d'invitation d'une carte prospect (edge function
   send-invitation-carte) : son texte, ses liens, son échappement. */
import { test } from "node:test";
import assert from "node:assert/strict";

// emailLayout.ts lit Deno.env au chargement : un Deno minimal suffit ici.
(globalThis as unknown as { Deno: unknown }).Deno ??= { env: { get: () => undefined } };
// @ts-ignore TS5097 — node --experimental-strip-types EXIGE l'extension .ts.
const { buildBody, sujet, lienInscription } = await import("../../../supabase/functions/send-invitation-carte/email.ts");
// @ts-ignore TS5097
const { expediteur } = await import("../../../supabase/functions/send-invitation-carte/traiter.ts");

const base = { prenom: "Xavier", recruteur: "Rémi Collègue", cegep: "Cégep de Saint-Jérôme", courriel: "x@exemple.test", desabonnementUrl: "https://n/desabonnement?t=i.a" };

test("objet et texte de BP, nommant le cégep et le recruteur", () => {
  assert.equal(sujet("Cégep de Saint-Jérôme"), "Un recruteur du Cégep de Saint-Jérôme recrute sur Nexus");
  const { text } = buildBody(base);
  assert.match(text, /Rémi Collègue, recruteur au Cégep de Saint-Jérôme, utilise Nexus comme plateforme de recrutement et suit ton parcours\./);
  assert.match(text, /Crée ton profil pour qu'il ait accès à tes infos, tes vidéos et ton évaluation : c'est ce qui facilite et maximise ton recrutement\. C'est gratuit, et ça prend quelques minutes\./);
  assert.equal((text.match(/Créer mon profil/g) ?? []).length, 1, "un seul lien d'inscription dans le texte");
});

test("lien d'inscription pré-rempli, désabonnement et adresse postale (LCAP)", () => {
  assert.equal(lienInscription("a+b@x.ca"), "https://nexussports.ca/auth?mode=signup&email=a%2Bb%40x.ca");
  const { html } = buildBody(base);
  assert.ok(html.includes("https://n/desabonnement?t=i.a"));
  assert.ok(html.includes("Basile-Routhier"));
});

test("sans recruteur connu : « Un recruteur du … »", () => {
  assert.match(buildBody({ ...base, recruteur: null }).text, /Salut Xavier,\s+Un recruteur du Cégep de Saint-Jérôme utilise Nexus comme plateforme/);
});

test("une saisie contenant du HTML est échappée", () => {
  const { html } = buildBody({ ...base, prenom: "<b>X</b>", recruteur: "A <script>" });
  assert.ok(!html.includes("<b>X</b>") && !html.includes("<script>"));
});

test("expéditeur : « Nexus <info@nexussports.ca> », jamais au nom du recruteur", () => {
  assert.equal(expediteur(), "Nexus <info@nexussports.ca>");
});
