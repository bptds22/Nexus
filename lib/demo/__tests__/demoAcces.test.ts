/* Accès à l'enregistrement de la démo (/12octobre → /12octobre/video) :
   courriel A (texte final de BP), avis à info@, chapitres, lecteur, et la
   réclamation des envois (un révoqué ne reçoit jamais son lien). */
import { test } from "node:test";
import assert from "node:assert/strict";

// emailLayout.ts lit Deno.env au chargement : un Deno minimal suffit ici.
(globalThis as unknown as { Deno: unknown }).Deno ??= { env: { get: () => undefined } };
// @ts-ignore TS5097 — node --experimental-strip-types EXIGE l'extension .ts.
const { courrielAcces, avisAcces, lienVideo, RESERVATION_1A1 } = await import("../../../supabase/functions/send-demo-access/email.ts");
// @ts-ignore TS5097
const { traiterDemande } = await import("../../../supabase/functions/send-demo-access/traiter.ts");
import { CHAPITRES, enSecondes, urlLecteur, estUuid, messageErreurAcces, POINTS_DEMO } from "@/lib/demo/demoAcces";
import { DEMO_12_OCTOBRE } from "@/lib/demo/demo12Octobre";

const JETON = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const base = {
  id: "11111111-2222-3333-4444-555555555555", prenom: "Julie", nom: "Côté", courriel: "julie@exemple.test",
  cegep: "Cégep de Sherbrooke", role: "RECRUTEUR", wants_1on1: false, token: JETON,
};

test("courriel A : objet, lien personnel, texte final de BP", () => {
  const c = courrielAcces(base);
  assert.equal(c.sujet, "Votre accès à la démo Nexus");
  assert.equal(lienVideo(JETON), `https://nexussports.ca/12octobre/video?t=${JETON}`);
  assert.ok(c.html.includes(`/12octobre/video?t=${JETON}`) && c.html.includes("Regarder la démo"));
  for (const bout of [
    "Bonjour Julie,",
    "Voici votre accès personnel à l'enregistrement de la démo recruteurs du 12 octobre. Nexus, c'est votre outil de recrutement — pas une banque de joueurs.",
    "En 35 minutes, vous allez voir :",
    "– Mon processus : votre pipeline, vos notes, votre cote personnelle. Il remplace votre Excel.",
    "– Le calendrier : les parties de vos cibles, quand le calendrier de leur ligue est publié.",
    "Ce lien vous est réservé ; merci de ne pas le partager.",
    "Accès complet gratuit jusqu'au 31 octobre. Vous avez déjà une liste de recrutement? Répondez à ce courriel avec votre fichier, je la migre dans votre processus avec vous.",
    "Une question? Répondez simplement à ce courriel.",
    "Bruno-Philippe\nCo-fondateur, Nexus\nnexussports.ca",
    "856, rue Basile-Routhier, Repentigny",
  ]) assert.ok(c.text.includes(bout), bout);
  assert.ok(!/deux semaines|24 heures/.test(c.html + c.text));
});

test("courriel A : la phrase 1:1 seulement si demandée", () => {
  const sans = courrielAcces(base);
  const avec = courrielAcces({ ...base, wants_1on1: true });
  assert.ok(!(sans.html + sans.text).includes(RESERVATION_1A1));
  assert.ok(avec.text.includes(`Vous avez aussi demandé une présentation 1:1 avec Nexus. Choisissez votre moment : ${RESERVATION_1A1}`));
  assert.equal(RESERVATION_1A1, DEMO_12_OCTOBRE.reservation);
});

test("courriel A : saisie échappée dans le HTML", () => {
  const c = courrielAcces({ ...base, prenom: "<b>Jo</b>" });
  assert.ok(!c.html.includes("<b>Jo</b>") && c.html.includes("&lt;b&gt;Jo&lt;/b&gt;"));
});

test("avis à info@ : format convenu + lien admin", () => {
  const a = avisAcces({ ...base, wants_1on1: true });
  assert.equal(a.sujet, "Nouvelle demande démo — Julie Côté, Cégep de Sherbrooke, julie@exemple.test, Recruteur");
  assert.ok(a.text.includes("Présentation 1:1 : oui") && a.text.includes("https://nexussports.ca/admin/demo-access"));
});

test("page et courriel : mêmes 4 points", () => {
  const c = courrielAcces(base);
  for (const p of POINTS_DEMO) assert.ok(c.text.includes(`– ${p}`), p);
});

test("chapitres : 15, en ordre, temps convertis", () => {
  assert.equal(CHAPITRES.length, 15);
  assert.equal(enSecondes("33:10"), 1990);
  assert.deepEqual(CHAPITRES.slice(0, 3).map((c) => c.secondes), [0, 90, 225]);
  for (let i = 1; i < CHAPITRES.length; i++) assert.ok(CHAPITRES[i].secondes > CHAPITRES[i - 1].secondes);
});

test("lecteur : start et autoplay seulement au saut", () => {
  assert.equal(urlLecteur("abc"), "https://www.youtube-nocookie.com/embed/abc?rel=0&modestbranding=1");
  assert.ok(urlLecteur("abc", 765, true).endsWith("&start=765&autoplay=1"));
});

test("jeton : uuid seulement ; messages d'erreur", () => {
  assert.ok(estUuid(JETON));
  assert.ok(!estUuid("1 or 1=1") && !estUuid(undefined));
  assert.match(messageErreurAcces("NEXUS: trop de tentatives, réessayez plus tard"), /Trop de tentatives/);
  assert.match(messageErreurAcces("NEXUS: courriel invalide"), /pas valide/);
});

/* ── traiterDemande, contre une base simulée ───────────────────────── */

function fausseBase(ligne: Record<string, unknown>) {
  const etat = { ...ligne };
  const client = {
    from() {
      let patch: Record<string, unknown> | null = null;
      const filtres: [string, unknown][] = [];
      const q = {
        select() { return q; },
        update(p: Record<string, unknown>) { patch = p; return q; },
        eq(c: string, v: unknown) { filtres.push([c, v]); return q; },
        async maybeSingle() {
          const ok = filtres.every(([c, v]) => etat[c] === v);
          if (!ok) return { data: null, error: null };
          if (patch) Object.assign(etat, patch);
          return { data: { ...etat, schools: { name: "Cégep de Sherbrooke" } }, error: null };
        },
        then(res: (v: unknown) => void) {
          if (patch && filtres.every(([c, v]) => etat[c] === v)) Object.assign(etat, patch);
          res({ error: null });
        },
      };
      return q;
    },
  };
  return { client, etat };
}

const LIGNE = {
  id: base.id, first_name: "Julie", last_name: "Côté", email: base.courriel, cegep_autre: null,
  role: "RECRUTEUR", wants_1on1: false, token: JETON, status: "approved", nb_demandes: 1,
  courriel_statut: "A_ENVOYER", avis_statut: "A_ENVOYER",
};

test("envoi : courriel A au demandeur, avis à info@, puis plus rien au rejeu", async () => {
  const { client, etat } = fausseBase(LIGNE);
  const envois: { to: string; subject: string }[] = [];
  const fetchSimule = (async (_u: string, init: { body: string }) => {
    envois.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const r = await traiterDemande({ supabase: client, fetch: fetchSimule, resendApiKey: "x" }, base.id);
  assert.deepEqual([r.courriel, r.avis], ["ENVOYE", "ENVOYE"]);
  assert.deepEqual(envois.map((e) => e.to), ["julie@exemple.test", "info@nexussports.ca"]);
  assert.equal(etat.courriel_statut, "ENVOYE");
  const r2 = await traiterDemande({ supabase: client, fetch: fetchSimule, resendApiKey: "x" }, base.id);
  assert.deepEqual([r2.courriel, r2.avis], ["RIEN_A_FAIRE", "RIEN_A_FAIRE"]);
  assert.equal(envois.length, 2);
});

test("envoi : un accès révoqué ne reçoit jamais son lien (l'avis part quand même)", async () => {
  const { client } = fausseBase({ ...LIGNE, status: "revoked" });
  const envois: { to: string }[] = [];
  const fetchSimule = (async (_u: string, init: { body: string }) => {
    envois.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const r = await traiterDemande({ supabase: client, fetch: fetchSimule, resendApiKey: "x" }, base.id);
  assert.equal(r.courriel, "RIEN_A_FAIRE");
  assert.deepEqual(envois.map((e) => e.to), ["info@nexussports.ca"]);
});

test("envoi : un refus de Resend marque ECHEC", async () => {
  const { client, etat } = fausseBase(LIGNE);
  const fetchSimule = (async () => new Response("non", { status: 422 })) as unknown as typeof fetch;
  const r = await traiterDemande({ supabase: client, fetch: fetchSimule, resendApiKey: "x" }, base.id);
  assert.equal(r.courriel, "ECHEC");
  assert.equal(etat.courriel_statut, "ECHEC");
  assert.match(String(etat.envoi_erreur), /Resend 422/);
});
