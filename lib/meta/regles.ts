/* ═══════════════════════════════════════════════════════════════
   Meta Pixel + Conversions API — règles PURES (aucun import navigateur
   ni serveur), partagées par le client, la route /api/meta/evenement et
   les tests.

   Trois verrous, dans cet ordre :
   1. CONSENTEMENT — rien ne part sans le cookie nexus_consent=granted.
   2. AUCUNE DONNÉE PERSONNELLE — nos utilisateurs sont en partie mineurs.
      user_data ne porte QUE ip, user agent, _fbp, _fbc. Pas de courriel,
      nom, téléphone, date de naissance, école ni identifiant, haché ou non.
   3. AUCUN IDENTIFIANT DANS L'URL — le pixel navigateur envoie l'URL de la
      page (paramètre dl) avec CHAQUE événement. Une URL qui porte un UUID
      (/recruteur/athletes/<id>, /12octobre/merci?id=…) ou un jeton
      (/claim?token=…, /i/<jeton>) serait un identifiant transmis à Meta.
   4. AUCUN ATHLÈTE (décision BP 2026-10-07) — les athlètes sont en
      majorité mineurs : aucun événement de conversion pour le rôle
      athlète (ni parent), et le pixel ne se charge pas du tout sur les
      pages qui s'adressent à eux.
      D'où : PageView seulement sur des routes publiques listées, et tout
      événement navigateur refusé si l'URL n'est pas « propre ». Le serveur,
      lui, n'envoie que origine + chemin, sans requête.
═══════════════════════════════════════════════════════════════ */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

export const CONSENT_COOKIE = "nexus_consent";
export const CONSENT_STORAGE_KEY = "nexus_consent";
export type ConsentValue = "granted" | "denied";

/** Cookie posé par /auth/callback pour une inscription OAuth : le rôle seul. */
export const INSCRIPTION_COOKIE = "nx_meta_inscription";

/** Événements autorisés à passer par la route serveur — liste FERMÉE. */
export const EVENEMENTS = ["CompleteRegistration", "Lead"] as const;
export type EvenementMeta = (typeof EVENEMENTS)[number];

/** content_name autorisés — liste FERMÉE, jamais de texte libre vers Meta.
 *  « athlete » n'y est PAS, volontairement (verrou 4) : ne pas le rajouter. */
export const ROLES_META = ["coach", "recruiter"] as const;
export type RoleMeta = (typeof ROLES_META)[number];
export const LEAD_DEMO = "demo_12_octobre";

/** Rôles du formulaire /12octobre qui déclenchent un Lead : personnel de
 *  cégep seulement. « AUTRE » ou vide (un athlète peut remplir le
 *  formulaire) → aucun Lead. */
export const ROLES_DEMO_LEAD = ["RECRUTEUR", "ENTRAINEUR_CHEF", "DIRECTEUR_SPORTS"] as const;

export function leadDemoAutorise(role: string | null | undefined): boolean {
  return (ROLES_DEMO_LEAD as readonly string[]).includes(role ?? "");
}

export function roleMeta(role: string | null | undefined): RoleMeta | null {
  switch (role) {
    case "COACH": return "coach";
    case "RECRUTEUR": return "recruiter";
    default: return null;
  }
}

/**
 * Routes PUBLIQUES où le bandeau s'affiche et où PageView part. Exactes,
 * sauf les entrées terminées par « /* » (préfixe). Les portails connectés
 * (coach, recruteur, athlète, admin…) n'y sont pas : leurs URL portent des
 * identifiants, et la mesure publicitaire n'a rien à y faire.
 */
const ROUTES_PUBLIQUES = [
  "/",
  "/auth",
  "/auth/pro",
  "/12octobre",
  "/tarifs",
  "/comment-ca-marche",
  "/a-propos",
  "/aide",
  "/contact",
  "/guide-recrutement",
  "/roadmap",
  "/pour-les-coachs",
  "/pour-les-parents",
  "/pour-les-recruteurs",
  "/confidentialite",
  "/conditions",
  "/collecte-donnees",
];

function normaliser(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function estRoutePublique(pathname: string): boolean {
  return ROUTES_PUBLIQUES.includes(normaliser(pathname));
}

/** Pages qui s'adressent aux athlètes : le pixel n'y est JAMAIS chargé
 *  (verrou 4). Les portails /athlete/* ne sont déjà pas publics. */
const PAGES_ATHLETES = ["/pour-les-etudiant-athlete", "/claim"];

/**
 * Vrai si fbevents.js peut être chargé sur cette page : route publique, et
 * pas une page pour athlètes. /auth?role=athlete (choix « athlète » du
 * sélecteur de rôle, reflété dans l'URL) compte comme page pour athlètes.
 */
export function pixelPermisSurPage(pathname: string, search = ""): boolean {
  const p = normaliser(pathname);
  if (PAGES_ATHLETES.includes(p) || p.startsWith("/athlete")) return false;
  if (p === "/auth" && new URLSearchParams(search).get("role") === "athlete") return false;
  return estRoutePublique(p);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/** 16+ caractères mêlant lettres ET chiffres = probable jeton. Un slug de
 *  mots (« pour-les-etudiant-athlete ») n'a pas de chiffre et passe. */
const JETON = /^(?=.*\d)(?=.*[A-Za-z])[A-Za-z0-9_-]{16,}$/;
/** Seules clés de requête tolérées dans une URL envoyée par le pixel. */
const CLE_REQUETE_OK = /^(utm_[a-z_]+|fbclid)$/;

/**
 * Vrai si l'URL peut partir telle quelle dans un événement du pixel
 * navigateur : aucun UUID ni jeton dans le chemin, et une requête limitée
 * aux paramètres de campagne. Faux à la moindre incertitude.
 */
export function urlSansIdentifiant(href: string): boolean {
  let u: URL;
  try { u = new URL(href); } catch { return false; }
  for (const segment of u.pathname.split("/")) {
    if (UUID.test(segment) || JETON.test(segment)) return false;
  }
  for (const cle of u.searchParams.keys()) {
    if (!CLE_REQUETE_OK.test(cle)) return false;
  }
  return !u.hash || u.hash === "#";
}

/** event_source_url côté serveur : origine + chemin, jamais de requête. */
export function urlSourceAssainie(href: string | null | undefined, origineAttendue: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href);
    if (u.origin !== origineAttendue) return null;
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

export interface EntreeCapi {
  evenement: EvenementMeta;
  eventId: string;
  contentName: RoleMeta | typeof LEAD_DEMO;
  eventSourceUrl: string;
  ip: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
  testEventCode?: string | null;
  maintenant?: number;
}

/**
 * Corps envoyé à graph.facebook.com/{pixel}/events. user_data est construit
 * CHAMP PAR CHAMP à partir de la liste blanche : il n'existe aucun chemin
 * par lequel une autre clé y entrerait.
 */
export function construireCorpsCapi(e: EntreeCapi) {
  const userData: Record<string, string> = {};
  if (e.ip) userData.client_ip_address = e.ip;
  if (e.userAgent) userData.client_user_agent = e.userAgent;
  if (e.fbp) userData.fbp = e.fbp;
  if (e.fbc) userData.fbc = e.fbc;

  return {
    data: [
      {
        event_name: e.evenement,
        event_time: Math.floor((e.maintenant ?? Date.now()) / 1000),
        event_id: e.eventId,
        action_source: "website" as const,
        event_source_url: e.eventSourceUrl,
        user_data: userData,
        custom_data: { content_name: e.contentName },
      },
    ],
    ...(e.testEventCode ? { test_event_code: e.testEventCode } : {}),
  };
}

const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function eventIdValide(v: unknown): v is string {
  return typeof v === "string" && EVENT_ID.test(v);
}
