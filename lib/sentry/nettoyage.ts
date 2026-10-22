/* ═══════════════════════════════════════════════════════════════
   NETTOYAGE SENTRY — aucune donnée personnelle ne part (décision BP,
   2026-10-22, Loi 25).

   Sentry reste branché pour les erreurs, mais rien de ce qui suit ne
   doit quitter l'appareil ou le serveur : nom, courriel, IP, texte
   saisi, contenu de requête. Seul l'UUID Supabase (`user.id`) est
   permis comme identifiant.

   Les réglages `sendDefaultPii: false` + `dataCollection` des trois
   init coupent ce que le SDK collecte de lui-même. Ce fichier rattrape
   ce qu'ils laissent passer, relevé dans le SDK 10.65 :
     · les fils fetch / XHR / navigation gardent l'URL ENTIÈRE, paramètres
       compris (`?email=ilike.…`, `/auth?email=…`, `?token=…`) ;
     · les fils console gardent TOUS les arguments ;
     · les fils de clic gardent `aria-label`, `title`, `alt`, `name` —
       des noms d'athlètes et de coachs (`alt={fullName}`) ;
     · les spans gardent `url`, `http.url`, `http.query` ; les spans de
       clic (INP) gardent le sélecteur, `title` et `alt` compris ;
     · les messages d'erreur Postgres citent la valeur fautive
       (« Key (email)=(x@y.ca) already exists »).

   Pur, sans import du SDK à l'exécution : partagé par le client, le
   serveur et l'edge, et testé par `lib/sentry/__tests__/nettoyage.test.ts`.
   ═══════════════════════════════════════════════════════════════ */
import type * as Sentry from "@sentry/nextjs";
import type { Breadcrumb, ErrorEvent, Event } from "@sentry/nextjs";

/* `@sentry/nextjs` n'exporte ni `TransactionEvent` ni `DataCollection` :
   on les lit sur les options de `init`, sans dépendre de `@sentry/core`. */
type Options = NonNullable<Parameters<typeof Sentry.init>[0]>;
export type TransactionEvent = Parameters<NonNullable<Options["beforeSendTransaction"]>>[0];
export type SpanJSON = Parameters<NonNullable<Options["beforeSendSpan"]>>[0];
type DataCollection = NonNullable<Options["dataCollection"]>;

const COURRIEL = /[A-Z0-9._%+-]+(?:@|%40)[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
/* Une URL (absolue ou chemin) suivie d'une chaîne de requête ou d'un
   fragment : on garde le chemin, on jette le reste. */
const REQUETE_URL = /((?:https?:\/\/|\/)[^\s?#"'<>]*)[?#][^\s"'<>]*/g;
/* `/p/<jeton>` — le lien personnel d'un jeune (W4b/W4c). */
const JETON_P = /\/p\/[^/\s?#"'<>]+/g;
/* Postgres cite la valeur fautive : « Key (email)=(x@y.ca) »,
   « Failing row contains (…) ». */
const CLE_POSTGRES = /Key \(([^)]*)\)=\([^)]*\)/g;
const LIGNE_POSTGRES = /Failing row contains \([^)]*\)/g;
const PROFONDEUR_MAX = 12;

/** Nettoie une chaîne libre : courriels, requêtes d'URL, jetons, valeurs Postgres. */
export function nettoyerTexte(s: string): string {
  return s
    .replace(REQUETE_URL, "$1")
    .replace(JETON_P, "/p/[jeton]")
    .replace(CLE_POSTGRES, "Key ($1)=([valeur])")
    .replace(LIGNE_POSTGRES, "Failing row contains ([valeur])")
    .replace(COURRIEL, "[courriel]");
}

/** Une URL : coupée au `?` / `#`, `/p/<jeton>` masqué, courriel masqué. */
export function nettoyerUrl(url: string): string {
  return nettoyerTexte(url.split(/[?#]/)[0]);
}

/** Parcourt toutes les chaînes d'un objet (y compris les clés). */
export function nettoyerProfond<T>(valeur: T, profondeur = 0): T {
  if (typeof valeur === "string") return nettoyerTexte(valeur) as T;
  if (valeur === null || typeof valeur !== "object" || profondeur > PROFONDEUR_MAX) return valeur;
  if (Array.isArray(valeur)) {
    return valeur.map((v) => nettoyerProfond(v, profondeur + 1)) as T;
  }
  const sortie: Record<string, unknown> = {};
  for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
    sortie[nettoyerTexte(cle)] = nettoyerProfond(v, profondeur + 1);
  }
  return sortie as T;
}

/* L'identifiant anonyme, et rien d'autre (ni courriel, ni nom, ni IP). */
function reduireUtilisateur(event: Event): void {
  const id = event.user?.id;
  if (id !== undefined && id !== null && id !== "") {
    event.user = { id: String(id) };
  } else {
    delete event.user;
  }
}

/* Méthode + chemin, plus le user-agent. Ni cookies, ni corps, ni
   chaîne de requête, ni autres en-têtes. */
function nettoyerRequete(event: Event): void {
  const req = event.request;
  if (!req) return;
  const ua = req.headers?.["user-agent"] ?? req.headers?.["User-Agent"];
  event.request = {
    ...(req.method ? { method: req.method } : {}),
    ...(req.url ? { url: nettoyerUrl(req.url) } : {}),
    ...(ua ? { headers: { "user-agent": ua } } : {}),
  };
}

function nettoyerEvenement<E extends Event>(event: E): E {
  reduireUtilisateur(event);
  nettoyerRequete(event);
  delete event.server_name;
  if (event.contexts) delete event.contexts.culture;
  if (event.transaction) event.transaction = nettoyerUrl(event.transaction);
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((b) => nettoyerFil(b))
      .filter((b): b is Breadcrumb => b !== null);
  }
  /* Les variables locales des frames ne doivent jamais partir, même si
     une intégration les ajoutait un jour. */
  for (const ex of event.exception?.values ?? []) {
    for (const frame of ex.stacktrace?.frames ?? []) delete frame.vars;
  }
  const propre = nettoyerProfond(event);
  /* L'UUID passe tel quel : il ne contient ni `@` ni `?`, mais on le
     repose pour qu'aucune règle future ne l'abîme. */
  if (event.user) propre.user = event.user;
  return propre;
}

/* Un fil d'Ariane réduit à ce qui aide à diagnostiquer sans rien dire
   de la personne. */
function nettoyerFil(fil: Breadcrumb): Breadcrumb | null {
  const b: Breadcrumb = { ...fil };
  const cat = b.category ?? "";

  if (cat === "console") {
    /* Les arguments partent tous, tels quels — dont des objets d'erreur
       Supabase. On ne garde que l'étiquette du code (`[admin/parents]`). */
    const etiquette = typeof b.message === "string" ? b.message.match(/^\[[^\]]{1,80}\]/)?.[0] : undefined;
    b.message = etiquette ?? "console";
    delete b.data;
  } else if (cat.startsWith("ui.")) {
    b.message = baliseSeule(b.message ?? "");
    delete b.data;
  } else if (cat === "fetch" || cat === "xhr") {
    const d = (b.data ?? {}) as Record<string, unknown>;
    b.data = {
      ...(typeof d.method === "string" ? { method: d.method } : {}),
      ...(typeof d.url === "string" ? { url: nettoyerUrl(d.url) } : {}),
      ...(d.status_code !== undefined ? { status_code: d.status_code } : {}),
    };
  } else if (cat === "navigation") {
    const d = (b.data ?? {}) as Record<string, unknown>;
    b.data = {
      ...(typeof d.from === "string" ? { from: nettoyerUrl(d.from) } : {}),
      ...(typeof d.to === "string" ? { to: nettoyerUrl(d.to) } : {}),
    };
  }
  return nettoyerProfond(b);
}

/* Clés de span qui portent la chaîne de requête ou le fragment. */
const CLES_SPAN_A_RETIRER = /(^|\.)(query|fragment)$/;

function nettoyerDonneesSpan<D extends Record<string, unknown>>(data: D): D;
function nettoyerDonneesSpan<D extends Record<string, unknown>>(data: D | undefined): D | undefined;
function nettoyerDonneesSpan<D extends Record<string, unknown>>(data: D | undefined): D | undefined {
  if (!data) return data;
  const sortie: Record<string, unknown> = {};
  for (const [cle, v] of Object.entries(data)) {
    if (CLES_SPAN_A_RETIRER.test(cle)) continue;
    sortie[cle] = typeof v === "string" && /url|target|route|path/i.test(cle) ? nettoyerUrl(v) : v;
  }
  return sortie as D;
}

/* « div.carte > img[alt="Prénom Nom"] » → « img ». Sert aux fils de clic
   comme aux spans d'interaction (INP), qui recopient le même sélecteur. */
function baliseSeule(selecteur: string): string {
  const dernier = selecteur.split(" > ").pop() ?? "";
  return dernier.match(/^[a-zA-Z][a-zA-Z0-9-]*/)?.[0] ?? "element";
}

function nettoyerSpan<S extends { description?: string; op?: string; data?: Record<string, unknown> }>(span: S): S {
  const op = span.op ?? (span.data?.["sentry.op"] as string | undefined) ?? "";
  const propre: S = {
    ...span,
    ...(span.description
      ? { description: op.startsWith("ui.") ? baliseSeule(span.description) : nettoyerTexte(span.description) }
      : {}),
    ...(span.data ? { data: nettoyerDonneesSpan(span.data) } : {}),
  };
  return nettoyerProfond(propre);
}

/* ── Les crochets branchés dans Sentry.init ───────────────────────── */

export function beforeSend(event: ErrorEvent): ErrorEvent {
  return nettoyerEvenement(event);
}

export function beforeBreadcrumb(fil: Breadcrumb): Breadcrumb | null {
  return nettoyerFil(fil);
}

export function beforeSendTransaction(event: TransactionEvent): TransactionEvent {
  if (event.contexts?.trace?.data) {
    event.contexts.trace.data = nettoyerDonneesSpan(event.contexts.trace.data);
  }
  if (event.spans) event.spans = event.spans.map(nettoyerSpan);
  return nettoyerEvenement(event);
}

/* Les spans envoyés SEULS, hors transaction — les interactions INP du
   navigateur (`ui.interaction.click`). Relevé au test headless du
   2026-10-22 : leur `description` portait `button[title="Prénom Nom"]`.
   `beforeSendTransaction` ne les voit jamais. */
export function beforeSendSpan(span: SpanJSON): SpanJSON {
  return nettoyerSpan(span);
}

/* Réglages de collecte communs aux trois init. */
export const COLLECTE_SANS_DONNEES_PERSONNELLES: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  queryParams: false,
  stackFrameVariables: false,
};
