/* ═══════════════════════════════════════════════════════════════
   Aucune donnée personnelle vers Sentry (décision BP, 2026-10-22).

   Un faux événement truffé de tout ce que le SDK laisse passer par
   défaut : courriels, `?email=`, `/auth?email=`, `/p/<jeton>`,
   `?token=`, arguments console, erreur Postgres qui cite la valeur,
   `title` / `alt` portant des noms. Après nettoyage : 0 courriel,
   0 jeton, 0 nom — et l'UUID survit.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import {
  type SpanJSON,
  type TransactionEvent,
  beforeBreadcrumb,
  beforeSend,
  beforeSendSpan,
  beforeSendTransaction,
  nettoyerUrl,
} from "@/lib/sentry/nettoyage";

const UUID = "1d06342e-a138-4a88-97ed-d8a9a102428f";
const INTERDITS = [
  "x@y.ca",
  "test@exemple.ca",
  "eleve%40ecole.qc.ca",
  "eleve@ecole.qc.ca",
  "parent@exemple.ca",
  "abc123",
  "jeton-secret-9f",
  "Mandziuk",
  "Gabriel",
  "Alexis",
  "Tremblay",
  "Prénom Nom",
  "Jean",
  "sb-access-token",
  "ilike",
];

function sansInterdit(objet: unknown, contexte: string): void {
  const texte = JSON.stringify(objet);
  for (const mot of INTERDITS) {
    assert.ok(!texte.includes(mot), `${contexte} — « ${mot} » subsiste : ${texte}`);
  }
}

function fil(b: Breadcrumb): Breadcrumb {
  const r = beforeBreadcrumb(b);
  assert.ok(r, "un fil ne doit pas être jeté");
  return r;
}

const FILS: Breadcrumb[] = [
  {
    category: "console",
    level: "error",
    message: "[onboarding] échec : x@y.ca Key (email)=(x@y.ca) already exists",
    data: { arguments: ["[onboarding] échec :", { email: "x@y.ca", first_name: "Gabriel" }], logger: "console" },
  },
  { category: "console", level: "log", message: "parent@exemple.ca connecté", data: { arguments: ["parent@exemple.ca"] } },
  {
    category: "fetch",
    type: "http",
    data: {
      method: "GET",
      url: "http://127.0.0.1:54321/rest/v1/athletes?select=id&email=ilike.eleve%40ecole.qc.ca",
      status_code: 200,
      request_body_size: 12,
    },
  },
  {
    category: "xhr",
    type: "http",
    data: { method: "GET", url: "/rest/v1/athletes?or=(first_name.ilike.%25Gabriel%25,last_name.ilike.%25Mandziuk%25)", status_code: 200 },
  },
  { category: "navigation", data: { from: "/auth?email=test@exemple.ca", to: "/p/abc123?token=jeton-secret-9f" } },
  { category: "navigation", data: { from: "/claim?token=jeton-secret-9f", to: "/parent/claim?token=jeton-secret-9f#x" } },
  { category: "ui.click", message: 'div.carte > button.nx[title="Prénom Nom"]', data: { "ui.component_name": "Carte" } },
  { category: "ui.click", message: 'body > img[alt="Alexis Tremblay"]' },
];

test("fils — console sans arguments, garde l'étiquette", () => {
  const a = fil(FILS[0]);
  assert.equal(a.message, "[onboarding]");
  assert.equal(a.data, undefined);
  assert.equal(a.level, "error");
  assert.equal(fil(FILS[1]).message, "console");
});

test("fils — fetch / XHR : URL coupée au ?, méthode et statut gardés", () => {
  const f = fil(FILS[2]);
  assert.deepEqual(f.data, { method: "GET", url: "http://127.0.0.1:54321/rest/v1/athletes", status_code: 200 });
  assert.deepEqual(fil(FILS[3]).data, { method: "GET", url: "/rest/v1/athletes", status_code: 200 });
});

test("fils — navigation : requête coupée, /p/<jeton> masqué", () => {
  assert.deepEqual(fil(FILS[4]).data, { from: "/auth", to: "/p/[jeton]" });
  assert.deepEqual(fil(FILS[5]).data, { from: "/claim", to: "/parent/claim" });
});

test("fils — clic réduit à la balise", () => {
  assert.equal(fil(FILS[6]).message, "button");
  assert.equal(fil(FILS[6]).data, undefined);
  assert.equal(fil(FILS[7]).message, "img");
});

test("fils — aucun interdit dans l'ensemble", () => {
  sansInterdit(FILS.map(fil), "fils");
});

function evenementTruffe(): ErrorEvent {
  return {
    type: undefined,
    message: "Échec pour test@exemple.ca",
    user: { id: UUID, email: "x@y.ca", username: "Gabriel Mandziuk", ip_address: "203.0.113.7" },
    server_name: "poste-de-bp",
    transaction: "/p/abc123",
    request: {
      method: "GET",
      url: "http://127.0.0.1:3000/auth?email=test@exemple.ca&token=jeton-secret-9f",
      query_string: "email=test@exemple.ca&token=jeton-secret-9f",
      cookies: { "sb-access-token": "eyJ" },
      data: { first_name: "Gabriel", email: "x@y.ca" },
      headers: { "user-agent": "HeadlessChrome", cookie: "sb-access-token=eyJ", "x-forwarded-for": "203.0.113.7" },
      env: { REMOTE_ADDR: "203.0.113.7" },
    },
    exception: {
      values: [
        {
          type: "PostgrestError",
          value: 'duplicate key value violates unique constraint "users_email_key" — Key (email)=(x@y.ca) already exists. Failing row contains (Jean, Tremblay, x@y.ca).',
          stacktrace: {
            frames: [
              { filename: "http://127.0.0.1:3000/_next/static/chunks/a.js?v=1", vars: { courriel: "x@y.ca", nom: "Mandziuk" } },
            ],
          },
        },
      ],
    },
    extra: { saisie: "Gabriel Mandziuk eleve@ecole.qc.ca", lien: "https://nexussports.ca/p/abc123" },
    tags: { page: "/auth?email=test@exemple.ca" },
    contexts: { culture: { locale: "fr-CA", timezone: "America/Toronto" } },
    breadcrumbs: FILS,
  } as ErrorEvent;
}

test("beforeSend — user réduit à {id}, requête nettoyée, 0 interdit", () => {
  const e = beforeSend(evenementTruffe());
  assert.deepEqual(e.user, { id: UUID });
  assert.deepEqual(e.request, {
    method: "GET",
    url: "http://127.0.0.1:3000/auth",
    headers: { "user-agent": "HeadlessChrome" },
  });
  assert.equal(e.server_name, undefined);
  assert.equal(e.contexts?.culture, undefined);
  assert.equal(e.transaction, "/p/[jeton]");
  assert.equal(e.exception?.values?.[0].stacktrace?.frames?.[0].vars, undefined);
  assert.match(e.exception?.values?.[0].value ?? "", /Key \(email\)=\(\[valeur\]\)/);
  assert.match(e.exception?.values?.[0].value ?? "", /Failing row contains \(\[valeur\]\)/);
  assert.equal(e.message, "Échec pour [courriel]");
  // Il reste des noms en texte libre dans `extra.saisie` : le nettoyage ne
  // devine pas un nom dans une phrase. On vérifie le courriel ; les noms
  // ne doivent simplement jamais être écrits dans `extra` par le code.
  assert.equal((e.extra as Record<string, string>).saisie, "Gabriel Mandziuk [courriel]");
  delete e.extra;
  sansInterdit(e, "beforeSend");
  // L'IP de la personne (user.ip_address, REMOTE_ADDR, x-forwarded-for) ne survit nulle part.
  assert.ok(!JSON.stringify(e).includes("203.0.113.7"), "IP subsiste");
});

test("beforeSend — sans user.id, aucun user", () => {
  const e = evenementTruffe();
  e.user = { email: "x@y.ca", ip_address: "203.0.113.7" };
  assert.equal(beforeSend(e).user, undefined);
});

test("beforeSendTransaction — spans et trace nettoyés", () => {
  const t = {
    type: "transaction",
    transaction: "/auth?email=test@exemple.ca",
    user: { id: UUID, email: "x@y.ca" },
    request: { url: "/auth?email=test@exemple.ca", headers: { cookie: "sb-access-token=eyJ" } },
    contexts: {
      trace: {
        trace_id: "t",
        span_id: "s",
        data: { "http.query": "?email=test@exemple.ca", url: "/auth?email=test@exemple.ca", "sentry.op": "pageload" },
      },
    },
    spans: [
      {
        span_id: "a",
        trace_id: "t",
        start_timestamp: 0,
        description: "GET http://127.0.0.1:54321/rest/v1/athletes?email=ilike.eleve%40ecole.qc.ca",
        data: {
          url: "http://127.0.0.1:54321/rest/v1/athletes?email=ilike.eleve%40ecole.qc.ca",
          "http.url": "http://127.0.0.1:54321/rest/v1/athletes?email=ilike.eleve%40ecole.qc.ca",
          "http.query": "?email=ilike.eleve%40ecole.qc.ca",
          "url.query": "email=ilike.eleve%40ecole.qc.ca",
          "http.fragment": "#x",
          "http.method": "GET",
        },
      },
    ],
  } as unknown as TransactionEvent;
  const r = beforeSendTransaction(t);
  assert.equal(r.transaction, "/auth");
  assert.deepEqual(r.user, { id: UUID });
  assert.deepEqual(r.contexts?.trace?.data, { url: "/auth", "sentry.op": "pageload" });
  assert.deepEqual(r.spans?.[0].data, {
    url: "http://127.0.0.1:54321/rest/v1/athletes",
    "http.url": "http://127.0.0.1:54321/rest/v1/athletes",
    "http.method": "GET",
  });
  assert.equal(r.spans?.[0].description, "GET http://127.0.0.1:54321/rest/v1/athletes");
  sansInterdit(r, "beforeSendTransaction");
});

test("nettoyerUrl — URL encodée et lien /p/", () => {
  assert.equal(nettoyerUrl("https://nexussports.ca/p/abc123"), "https://nexussports.ca/p/[jeton]");
  assert.equal(nettoyerUrl("/p/abc123/repondre?x=1"), "/p/[jeton]/repondre");
  assert.equal(nettoyerUrl("mailto:eleve%40ecole.qc.ca"), "mailto:[courriel]");
});

test("beforeSendSpan — span de clic INP réduit à la balise (fuite relevée au test headless)", () => {
  const span = {
    span_id: "b",
    trace_id: "t",
    start_timestamp: 0,
    op: "ui.interaction.click",
    description: 'body > button#cible-pii[title="Prénom Nom"]',
    data: { "sentry.op": "ui.interaction.click", "sentry.origin": "auto.http.browser.inp", url: "/p/abc123?token=jeton-secret-9f" },
  } as unknown as SpanJSON;
  const r = beforeSendSpan(span);
  assert.equal(r.description, "button");
  assert.equal(r.data?.url, "/p/[jeton]");
  sansInterdit(r, "beforeSendSpan");
});

test("beforeSendTransaction — span ui.* dans une transaction réduit à la balise", () => {
  const t = {
    type: "transaction",
    spans: [{ span_id: "c", trace_id: "t", start_timestamp: 0, op: "ui.interaction.click", description: 'img[alt="Alexis Tremblay"]', data: {} }],
  } as unknown as TransactionEvent;
  assert.equal(beforeSendTransaction(t).spans?.[0].description, "img");
});
