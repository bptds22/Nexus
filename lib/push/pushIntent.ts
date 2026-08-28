/* ═══════════════════════════════════════════════════════════════
   pushIntent — l'intention de navigation portée par un tap sur une
   notification, et sa traduction en chemin selon le RÔLE de l'usager.

   Phase 6 du push. Trois raisons d'exister séparément du listener :

   1. Le payload ne dit PAS qui est le destinataire — il ne porte que
      `type` + un id. C'est le client qui sait qui est connecté, donc
      la destination se calcule ici, pas côté serveur. Aucun changement
      à notify_on_message ni à send-announcement.
   2. L'intention doit survivre à un démarrage à froid : elle est écrite
      dans @capacitor/preferences (natif, survit à la mort du process),
      et non dans sessionStorage — vidé précisément au cold start, le
      piège de ce chantier. Preferences est déjà le patron maison
      (`nexus_has_launched` dans AuthMobileDispatcher).
   3. Deux consommateurs la lisent — PushDeepLinkConsumer (app vivante)
      et postLoginDispatch (cold start / login). `takePendingIntent`
      lit ET efface, pour qu'une intention ne parte jamais deux fois.

   TTL de 5 minutes : un tap d'avant-hier ne doit pas détourner le
   lancement d'aujourd'hui.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

const KEY = "nexus_push_intent";
const TTL_MS = 5 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PushIntent =
  | { kind: "message"; conversationId: string; ts: number }
  | { kind: "announcement"; ts: number };

/* ── Chemins par rôle ─────────────────────────────────────────────
   Les inbox sont celles que les listes utilisent déjà (Stratégie A,
   query-param) : AthleteMessagesMobile, CoachDemandesMobile,
   RecruteurMessagesMobile poussent exactement ces URLs. Aucune route
   nouvelle n'est créée par ce lot.
   ADMIN et PARTNER n'ont pas d'écran de fil : ils retombent sur leur
   portail, jamais sur une URL qui n'existe pas. */
const INBOX_BY_ROLE: Record<string, string> = {
  ATHLETE: "/athlete/messages",
  COACH: "/coach/demandes",
  RECRUTEUR: "/recruteur/messages",
};

const HOME_BY_ROLE: Record<string, string> = {
  ATHLETE: "/athlete",
  COACH: "/coach",
  RECRUTEUR: "/recruteur",
  ADMIN: "/admin",
  PARTNER: "/partenaire",
};

/**
 * Traduit le `data` d'une notification en intention, ou null.
 *
 * Tout ce qui n'est pas reconnu retourne null — un type inconnu, un
 * data absent, un id qui n'est pas un uuid. C'est la garantie « rien
 * ne casse » : sans intention, aucun chemin nouveau ne s'active et le
 * comportement reste celui d'aujourd'hui.
 *
 * FCM v1 impose des valeurs de data en string — d'où les typeof.
 */
export function parsePushData(data: unknown): PushIntent | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const type = typeof d.type === "string" ? d.type : "";

  if (type === "message") {
    const id = typeof d.conversation_id === "string" ? d.conversation_id : "";
    if (!UUID_RE.test(id)) return null;
    return { kind: "message", conversationId: id, ts: Date.now() };
  }
  if (type === "announcement") {
    // L'annonce n'a pas de destination propre en v1 : l'accueil du
    // portail suffit. announcement_id voyage mais n'est pas utilisé —
    // il le sera le jour où il y aura un écran à ouvrir.
    return { kind: "announcement", ts: Date.now() };
  }
  return null;
}

/* NE PAS renvoyer l'objet Preferences depuis une fonction async.
   Le plugin Capacitor est un Proxy qui fabrique une méthode pour TOUTE
   propriété qu'on lui demande — `then` compris. `return Preferences`
   dans une async le rend donc « thenable » : le runtime appelle
   Preferences.then(...) et lève « "Preferences.then()" is not
   implemented on android ». Mesuré sur émulateur le 2026-08-27.
   L'import dynamique reste inline dans chaque fonction. */

/** Dépose l'intention. Appelé par le listener, AVANT toute navigation. */
export async function savePendingIntent(intent: PushIntent): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: KEY, value: JSON.stringify(intent) });
    // Trace volontaire : sans elle, le chemin qui RÉUSSIT est muet, et une
    // passe de vérification ne peut pas distinguer « déposé » de « jamais
    // exécuté ». C'est ce trou qui a failli masquer le bug du 2026-08-27.
    console.log("[push] intention déposée:", intent.kind);
  } catch (err) {
    console.error("[push] savePendingIntent", err);
  }
}

/**
 * Lit ET efface l'intention en attente. Retourne null si absente,
 * illisible, ou périmée (> 5 min).
 *
 * Lire-et-effacer dans le même appel est délibéré : deux consommateurs
 * existent (app vivante / boot), et seul le premier arrivé doit servir.
 */
export async function takePendingIntent(): Promise<PushIntent | null> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return null;
    await Preferences.remove({ key: KEY });

    const parsed = JSON.parse(value) as PushIntent;
    if (!parsed || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > TTL_MS) return null;
    if (parsed.kind === "message" && !UUID_RE.test(parsed.conversationId)) return null;
    if (parsed.kind !== "message" && parsed.kind !== "announcement") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Traduit une intention en chemin, pour un rôle donné.
 *
 * Pour un fil, une SONDE de participation précède la navigation :
 * `select id from conversations where id = …` sous le JWT de l'usager.
 * La RLS ne renvoie rien s'il n'est pas participant — vieux jeton,
 * autre compte sur le même téléphone, fil supprimé. On retombe alors
 * sur l'inbox de son rôle : pas d'erreur, pas d'écran vide, pas de
 * fil d'un autre. Une requête, aucun objet serveur nouveau.
 *
 * Retourne null si le rôle est inconnu — l'appelant garde sa
 * destination d'origine.
 */
export async function resolveDestination(
  supabase: SupabaseClient,
  role: string,
  intent: PushIntent,
): Promise<string | null> {
  const home = HOME_BY_ROLE[role] ?? null;
  if (intent.kind === "announcement") return home;

  const inbox = INBOX_BY_ROLE[role];
  if (!inbox) return home; // ADMIN / PARTNER : pas de messagerie

  try {
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", intent.conversationId)
      .maybeSingle();
    return data ? `${inbox}?id=${intent.conversationId}` : inbox;
  } catch {
    // Réseau capricieux : l'inbox se recharge toute seule, un fil non
    // résolu resterait bloqué. On dégrade vers la liste.
    return inbox;
  }
}
