/* Invitations coach → joueur (décision BP du 2026-10-15) : aucun coach dans les messages, le
   nombre RÉEL de recruteurs, jamais arrondi vers le haut ; courriels Nexus clairs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { nombreSur, phraseRecruteurs } from "@/lib/invitations/messageRecruteurs";

const ZERO = "Ton profil d'athlète est prêt sur Nexus, là où les recruteurs de cégep cherchent leurs prochains joueurs. Réclame-le gratuitement.";
const INTERDITS = /coach|entra[iî]neur|Ton coach|Un coach/i;

test("0 recruteur (et toute valeur inconnue) : la phrase « profil prêt », sans chiffre", () => {
  for (const n of [0, null, undefined, -1, Number.NaN, "abc", "", {}, Infinity]) {
    assert.equal(phraseRecruteurs(n), ZERO, String(n));
  }
});

test("1 recruteur : singulier", () => {
  assert.equal(phraseRecruteurs(1),
    "1 recruteur de cégep suit déjà ton profil sur Nexus. Réclame-le pour qu'il voie tout ce que tu as à montrer.");
});

test("plusieurs recruteurs : pluriel, le nombre exact", () => {
  assert.equal(phraseRecruteurs(2),
    "2 recruteurs de cégep suivent déjà ton profil sur Nexus. Réclame-le pour qu'ils voient tout ce que tu as à montrer.");
  assert.equal(phraseRecruteurs(7).startsWith("7 recruteurs de cégep suivent déjà"), true);
  assert.equal(phraseRecruteurs("3").startsWith("3 recruteurs"), true);
});

test("jamais arrondi vers le haut", () => {
  assert.equal(nombreSur(2.9), 2);
  assert.equal(nombreSur(1.99), 1);
  assert.equal(nombreSur(0.7), 0);
  assert.equal(phraseRecruteurs(0.7), ZERO);
});

test("aucune phrase ne mentionne le coach", () => {
  for (const n of [0, 1, 2, 12]) assert.doesNotMatch(phraseRecruteurs(n), INTERDITS);
});

test("la copie des fonctions d'envoi est IDENTIQUE à celle de l'app", () => {
  const a = fs.readFileSync(path.resolve("lib/invitations/messageRecruteurs.ts"), "utf8");
  const b = fs.readFileSync(path.resolve("supabase/functions/_shared/messageRecruteurs.ts"), "utf8");
  assert.equal(b, a);
});

// Les gabarits Deno lisent Deno.env au chargement : on le simule, sans clé.
(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => undefined } };
// Chemins en variables : ce sont des modules Deno (extension .ts obligatoire), hors du typage Next.
const GABARIT_RECLAMATION = "../../../supabase/functions/send-invitation/email" + ".ts";
const GABARIT_EQUIPE = "../../../supabase/functions/send-team-invitation/email" + ".ts";

test("courriel de réclamation : 0, 1, plusieurs — phrase exacte, Nexus clair, aucun coach", async () => {
  const { buildBody, SUJET } = await import(GABARIT_RECLAMATION);
  assert.doesNotMatch(SUJET, INTERDITS);
  for (const n of [0, 1, 5]) {
    const { html, text } = buildBody(n, "https://nexussports.ca/claim?token=abc", "https://nexussports.ca/desabonnement?t=a.x.y");
    for (const s of [html, text]) {
      assert.ok(s.includes(phraseRecruteurs(n).replace("'", "'")), `phrase n=${n}`);
      assert.doesNotMatch(s, INTERDITS, `n=${n}`);
      assert.ok(s.includes("nexussports.ca"));
      assert.ok(s.includes("L'équipe Nexus"));
    }
    assert.ok(html.includes('href="https://nexussports.ca/claim?token=abc"'));
    // Pied LCAP : le lien de désabonnement réel, dans les deux versions.
    assert.ok(html.includes('href="https://nexussports.ca/desabonnement?t=a.x.y"'));
    assert.ok(html.includes("Ne plus recevoir ces courriels"));
    assert.ok(text.includes("Ne plus recevoir ces courriels : https://nexussports.ca/desabonnement?t=a.x.y"));
  }
  // Un ancien trigger qui enverrait encore le coach : la fonction ne le lit pas (buildBody ne le reçoit pas).
  const { text } = buildBody(undefined, "https://nexussports.ca/claim?token=x", "https://nexussports.ca/desabonnement?t=a.x.y");
  assert.ok(text.includes(ZERO));
});

test("courriel d'invitation d'équipe : aucun coach", async () => {
  const { buildBody, SUJET } = await import(GABARIT_EQUIPE);
  assert.doesNotMatch(SUJET, INTERDITS);
  const { html, text } = buildBody("Les Dragons", "École des Érables",
    { sport: "Football", ageGroup: "Juvénile", division: "D2", gender: "Masculin" },
    "https://nexussports.ca/athlete/transfert?t=ABC", "https://nexussports.ca/desabonnement?t=u.sig");
  for (const s of [html, text]) {
    assert.doesNotMatch(s, INTERDITS);
    assert.ok(s.includes("Les Dragons — École des Érables"));
    assert.ok(s.includes("nexussports.ca"));
    assert.ok(s.includes("Ne plus recevoir ces courriels"));
  }
  assert.ok(html.includes('href="https://nexussports.ca/desabonnement?t=u.sig"'));
});

test("courriel d'équipe NON nommable (collégiale : la base transmet des chaînes vides) : texte générique", async () => {
  const { buildBody } = await import(GABARIT_EQUIPE);
  // Même si des détails arrivaient malgré tout, rien ne doit les afficher sans nom d'équipe.
  const { html, text } = buildBody("", "Cégep Fictif",
    { sport: "Football", ageGroup: "Collégial", division: "D1", gender: "Masculin" },
    "https://nexussports.ca/athlete/transfert?t=ABC", "https://nexussports.ca/desabonnement?t=u.sig");
  for (const s of [html, text]) {
    assert.doesNotMatch(s, INTERDITS);
    assert.doesNotMatch(s, /C[ée]gep Fictif|Coll[ée]gial|Football|D1/);
    assert.ok(s.includes("Tu es invité à rejoindre une nouvelle équipe sur Nexus"));
    assert.ok(s.includes("Ne plus recevoir ces courriels"));
  }
});

/* RÈGLE RSEQ (décision BP du 2026-10-15) : ce que lit l'athlète ne nomme ni cégep, ni recruteur,
   ni coach. Seul argument permis : le nombre réel de recruteurs, jamais lesquels. */
const RSEQ_INTERDITS = /coach|entra[iî]neur|c[ée]gep (de|du|d')|coll[eè]ge [A-Z]/i;

test("règle RSEQ : les deux courriels ne nomment ni coach, ni cégep, ni recruteur", async () => {
  const rec = await import(GABARIT_RECLAMATION);
  const eq = await import(GABARIT_EQUIPE);
  const rendus = [
    ...[0, 1, 9].map((n) => rec.buildBody(n, "https://nexussports.ca/claim?token=t", "https://nexussports.ca/desabonnement?t=a")),
    eq.buildBody("", "", { sport: "", ageGroup: "", division: "", gender: "" },
      "https://nexussports.ca/athlete/transfert?t=T", "https://nexussports.ca/desabonnement?t=u"),
  ];
  for (const { html, text } of rendus) {
    for (const s of [html, text]) {
      assert.doesNotMatch(s, RSEQ_INTERDITS);
      // Seule adresse d'expéditeur ou de contact : celles de Nexus.
      for (const m of s.match(/[\w.+-]+@[\w.-]+/g) ?? []) assert.match(m, /@nexussports\.ca$/, m);
    }
  }
  assert.equal(rec.SUJET.match(RSEQ_INTERDITS), null);
  assert.equal(eq.SUJET.match(RSEQ_INTERDITS), null);
});

test("règle RSEQ : les fonctions d'envoi ne lisent ni coach_name, ni nom de recruteur", () => {
  for (const f of ["send-invitation/index.ts", "send-invitation/email.ts", "send-team-invitation/index.ts", "send-team-invitation/email.ts"]) {
    const src = fs.readFileSync(path.resolve("supabase/functions", f), "utf8");
    assert.doesNotMatch(src, /payload\??\.coach_name|texte\("coach_name"\)|recruiter_name|recruteur_nom|cegep_name/, f);
    // Désinscription réelle : en-tête List-Unsubscribe et refus d'envoyer sans secret.
    if (f.endsWith("index.ts")) {
      assert.match(src, /List-Unsubscribe/, f);
      assert.match(src, /DESABONNEMENT_SECRET\.length < 32/, f);
    }
  }
});
