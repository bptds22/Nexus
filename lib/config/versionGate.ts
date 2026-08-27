/* ═══════════════════════════════════════════════════════════════
   versionGate — décider si le binaire installé a le droit de continuer.

   Deux paliers, une seule décision :
     · DUR    — version < plancher (min_version_*). Écran bloquant, non
                fermable. Exige `force_update_enabled`.
     · SOUPLE — version < version recommandée (suggested_version_*).
                Bannière fermable, jamais bloquante.
   Le DUR l'emporte : quand les deux s'appliquent, on ne montre pas une
   bannière fermable devant un mur.

   ── CE FICHIER NE TOUCHE PAS AU DOM, ET C'EST VOULU ─────────────
   `deciderVerdict` est PURE : mêmes entrées, même sortie, aucun accès
   réseau, aucun `window`. C'est ce qui la rend prouvable hors navigateur —
   les quatre scénarios (à jour / souple / dur / hors-ligne) se vérifient en
   Node contre CE code, pas contre une reconstitution.

   ── FAIL-OPEN, ET LA RAISON N'EST PAS « LE MÉTRO » ──────────────
   Un force-update n'est pas un contrôle de sécurité, c'est un contrôle
   PRODUIT. Rien n'est protégé derrière : le serveur garde ses propres
   verrous (RLS, triggers, RPC). Un client périmé qui passerait au travers
   ne devient pas dangereux, il devient mal fichu. Fermer sur une panne
   réseau punirait donc l'usager pour un incident qui ne le regarde pas,
   sans rien gagner. Même raisonnement, écrit noir sur blanc, que
   `useAthleteContactable` : « un verrou de sécurité se fermerait dans
   l'autre sens ; celui-ci non. »

   Le fail-open couvre les ERREURS, pas les verdicts connus — voir
   `verdictDurEnCache` : un blocage déjà constaté survit à la coupure.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Plateforme = "ios" | "android";

export type Verdict =
  | { type: "a-jour" }
  | { type: "souple"; installee: string; recommandee: string }
  | { type: "dur"; installee: string; requise: string; message: string };

/** Les six réglages d'`app_settings`, plus les deux surcharges d'URL
 *  facultatives. Tout est `null`-able : une clé absente ne doit jamais
 *  bloquer — c'est le cas au premier démarrage, avant que la migration de
 *  données n'ait été appliquée. */
export interface ReglagesVersion {
  actif: boolean;
  minIos: string | null;
  minAndroid: string | null;
  recommandeeIos: string | null;
  recommandeeAndroid: string | null;
  message: string | null;
  urlIos: string | null;
  urlAndroid: string | null;
}

export const REGLAGES_INERTES: ReglagesVersion = Object.freeze({
  actif: false,
  minIos: null, minAndroid: null,
  recommandeeIos: null, recommandeeAndroid: null,
  message: null, urlIos: null, urlAndroid: null,
});

export const MESSAGE_DUR_DEFAUT =
  "Cette version de Nexus n'est plus prise en charge. Installe la dernière version pour continuer.";

/* ── Comparaison ───────────────────────────────────────────────
   PAS de comparaison de chaînes : "1.4.0" > "1.10.0" en lexicographique,
   parce que '4' > '1'. On compare segment par segment, en NOMBRES.

   Rend `null` quand l'une des deux est illisible — l'appelant traite ce
   `null` comme « on ne sait pas », donc on laisse passer. Une version qu'on
   n'arrive pas à lire ne justifie pas de murer quelqu'un.

   On compare `version` (1.4.0) et JAMAIS `build` : les deux plateformes ont
   des compteurs de build désynchronisés — iOS en est à 13 quand Android en
   est à 9, pour le même 1.4.0. Le build ne veut rien dire d'un magasin à
   l'autre. */
export function comparerVersions(a: string, b: string): number | null {
  const decouper = (v: string): number[] | null => {
    const brut = v.trim();
    if (!brut) return null;
    const parts = brut.split(".");
    const nums: number[] = [];
    for (const p of parts) {
      if (!/^\d+$/.test(p)) return null;
      nums.push(Number.parseInt(p, 10));
    }
    return nums.length ? nums : null;
  };
  const va = decouper(a);
  const vb = decouper(b);
  if (!va || !vb) return null;
  /* Segments manquants = 0 : "1.4" et "1.4.0" sont la même version. */
  const n = Math.max(va.length, vb.length);
  for (let i = 0; i < n; i++) {
    const d = (va[i] ?? 0) - (vb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** `a` est-il strictement antérieur à `b` ? `false` si incomparable. */
export function estAnterieure(a: string, b: string): boolean {
  const c = comparerVersions(a, b);
  return c !== null && c < 0;
}

/* ── La décision ───────────────────────────────────────────────── */
export function deciderVerdict(
  installee: string | null | undefined,
  plateforme: Plateforme,
  r: ReglagesVersion,
): Verdict {
  /* Version inconnue (getInfo indisponible, plateforme web) : on ne peut
     rien affirmer, donc on ne bloque rien. */
  if (!installee) return { type: "a-jour" };

  const min = plateforme === "ios" ? r.minIos : r.minAndroid;
  const reco = plateforme === "ios" ? r.recommandeeIos : r.recommandeeAndroid;

  /* LE DUR D'ABORD — il l'emporte sur le souple. Sans cet ordre, un usager
     très en retard verrait une bannière fermable au lieu du mur.
     `r.actif` ne garde QUE le dur : couper l'interrupteur doit libérer le
     parc, pas éteindre aussi l'incitation douce. */
  if (r.actif && min && estAnterieure(installee, min)) {
    return {
      type: "dur",
      installee,
      requise: min,
      message: r.message?.trim() || MESSAGE_DUR_DEFAUT,
    };
  }

  if (reco && estAnterieure(installee, reco)) {
    return { type: "souple", installee, recommandee: reco };
  }

  return { type: "a-jour" };
}

/* ═══════════════════════════════════════════════════════════════
   CACHE — imposé par le MPA Capacitor.

   En Capacitor la navigation interne RECHARGE LE DOCUMENT (constaté et
   documenté dans SplashGate : une variable de module y repassait à false à
   chaque nav). Un garde monté à la racine referait donc sa requête réseau à
   CHAQUE navigation. Le verdict est mis en cache pour la session, comme
   `nx-splash-played`.

   Deux durées, deux buts opposés :
     · « à jour »  → sessionStorage. Une requête par démarrage à froid.
     · « dur »     → localStorage. Sans lui, un usager bloqué coupe le
                     réseau, relance, et passe : le fail-open sur erreur
                     deviendrait une porte de sortie. Un blocage déjà
                     constaté SURVIT à la coupure.

   Le blocage en cache retient la version à laquelle il s'appliquait. Sans
   ça, un blocage prononcé contre 1.2.3 continuerait de mordre après une
   mise à jour vers 1.5.0 — l'usager aurait fait ce qu'on lui demandait et
   resterait muré. C'est le détail qui décide si le mécanisme est
   récupérable ou non.
═══════════════════════════════════════════════════════════════ */

const CLE_SESSION_OK = "nx-version-ok";
const CLE_BLOCAGE = "nx-version-blocage";
const CLE_SOUPLE_FERMEE = "nx-version-souple-fermee";

interface BlocageEnCache {
  installee: string;
  requise: string;
  message: string;
}

/** Toute lecture de stockage est gardée : Safari en navigation privée lève
 *  sur `localStorage`, et un écran de mise à jour n'est pas un motif de
 *  planter l'app. */
function lireBrut(store: "local" | "session", cle: string): string | null {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    return s.getItem(cle);
  } catch { return null; }
}

function ecrireBrut(store: "local" | "session", cle: string, val: string): void {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    s.setItem(cle, val);
  } catch { /* no-op */ }
}

function effacerBrut(store: "local" | "session", cle: string): void {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    s.removeItem(cle);
  } catch { /* no-op */ }
}

/** Le contrôle réseau a déjà été fait ET conclu « à jour » dans CETTE
 *  session : on ne le refait pas à chaque navigation. */
export function sessionDejaValidee(): boolean {
  return lireBrut("session", CLE_SESSION_OK) === "1";
}

export function marquerSessionValidee(): void {
  ecrireBrut("session", CLE_SESSION_OK, "1");
}

/** Le blocage retenu d'une lecture précédente, s'il vise TOUJOURS la
 *  version installée aujourd'hui. Rend `null` dès que l'app a été mise à
 *  jour — le mur ne survit pas à sa propre résolution. */
export function verdictDurEnCache(installee: string | null | undefined): Verdict | null {
  if (!installee) return null;
  const brut = lireBrut("local", CLE_BLOCAGE);
  if (!brut) return null;
  try {
    const b = JSON.parse(brut) as Partial<BlocageEnCache>;
    if (!b?.installee || !b?.requise) return null;
    if (b.installee !== installee) { effacerBrut("local", CLE_BLOCAGE); return null; }
    return { type: "dur", installee: b.installee, requise: b.requise, message: b.message || MESSAGE_DUR_DEFAUT };
  } catch {
    effacerBrut("local", CLE_BLOCAGE);
    return null;
  }
}

/**
 * Range le verdict là où il doit vivre.
 *
 * Un verdict NON-dur efface le blocage retenu : c'est le seul chemin par
 * lequel un usager sort du mur. Une lecture réussie qui dit « tu es en
 * règle » doit tout défaire — sinon relever le plancher serait réversible
 * mais l'avoir abaissé ne le serait pas.
 */
export function memoriserVerdict(v: Verdict): void {
  if (v.type === "dur") {
    ecrireBrut("local", CLE_BLOCAGE, JSON.stringify({
      installee: v.installee, requise: v.requise, message: v.message,
    } satisfies BlocageEnCache));
    return;
  }
  effacerBrut("local", CLE_BLOCAGE);
  if (v.type === "a-jour") marquerSessionValidee();
}

/** La bannière souple a été fermée dans cette session. sessionStorage et
 *  non localStorage : une nouvelle session doit pouvoir réinciter, mais pas
 *  à chaque navigation — ce serait du harcèlement, le MPA rechargeant le
 *  document en permanence. */
export function soupleDejaFermee(): boolean {
  return lireBrut("session", CLE_SOUPLE_FERMEE) === "1";
}

export function fermerSouple(): void {
  ecrireBrut("session", CLE_SOUPLE_FERMEE, "1");
}

/* ── Lecture des réglages ──────────────────────────────────────
   `app_settings` est lisible par `anon` (policy « anyone can read settings »
   TO public USING true + GRANT SELECT) — vérifié en prod. Le contrôle tourne
   donc AVANT login, ce qui est nécessaire : un binaire périmé peut échouer
   au login lui-même, et le blocage doit être total.

   Une clé absente vaut `null`, jamais une erreur : au premier démarrage la
   migration de données peut ne pas être appliquée, et le gate doit alors
   être parfaitement inerte. */
export const CLES_REGLAGES = [
  "force_update_enabled",
  "min_version_ios",
  "min_version_android",
  "suggested_version_ios",
  "suggested_version_android",
  "force_update_message",
  "store_url_ios",
  "store_url_android",
] as const;

/** Convertit les lignes clé/valeur en réglages typés. Exportée pour être
 *  prouvable sans réseau. */
export function reglagesDepuisLignes(
  lignes: { key: string; value: string | null }[] | null | undefined,
): ReglagesVersion {
  const m = new Map<string, string>();
  for (const l of lignes ?? []) {
    if (l?.key && typeof l.value === "string") m.set(l.key, l.value);
  }
  const nn = (k: string): string | null => {
    const v = m.get(k)?.trim();
    return v ? v : null;
  };
  return {
    actif: m.get("force_update_enabled")?.trim().toLowerCase() === "true",
    minIos: nn("min_version_ios"),
    minAndroid: nn("min_version_android"),
    recommandeeIos: nn("suggested_version_ios"),
    recommandeeAndroid: nn("suggested_version_android"),
    message: nn("force_update_message"),
    urlIos: nn("store_url_ios"),
    urlAndroid: nn("store_url_android"),
  };
}

/**
 * Rend `null` en cas d'échec — l'appelant applique alors le fail-open,
 * tempéré par `verdictDurEnCache`.
 *
 * TYPÉ SUR `SupabaseClient`, PAS SUR UNE INTERFACE STRUCTURELLE MAISON.
 * La première version déclarait une petite interface `{ from → select → in }`
 * pour rester indépendante du SDK. TypeScript devait alors faire
 * correspondre les types PostgREST — génériques et profondément récursifs —
 * à cette forme réduite, et rendait `TS2589: Type instantiation is
 * excessively deep`. L'« indépendance » coûtait une erreur de compilation
 * pour un découplage dont personne ne profitait : il n'y a qu'un appelant,
 * et il passe un vrai client.
 */
export async function lireReglages(supabase: SupabaseClient): Promise<ReglagesVersion | null> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [...CLES_REGLAGES]);
    if (error) return null;
    return reglagesDepuisLignes(data as { key: string; value: string | null }[]);
  } catch {
    return null;
  }
}
