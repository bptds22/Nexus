/* ═══════════════════════════════════════════════════════════════
   partnerFilters — vocabulaire PARTAGÉ des filtres du portail
   partenaire, et le tri post-fetch.

   Les quatre écrans partenaire (/athletes, /classements,
   /tendances, /newsroom) doivent proposer le MÊME jeu d'options,
   avec les MÊMES libellés. Ce module est la source unique : trois
   copies divergeaient déjà avant qu'il existe.

   Module .ts neutre (pas de "use client") : consommé par les
   barres de filtres clientes ET par les pages serveur.
═══════════════════════════════════════════════════════════════ */

/* ── TRI ─────────────────────────────────────────────────────── */

/** Les 5 options de /partenaire/athletes, libellés inclus. */
export const PARTNER_SORT_OPTIONS = [
  { value: "cote_desc", label: "Trier: Meilleure cote" },
  { value: "cote_asc", label: "Trier: Cote croissante" },
  { value: "grad_asc", label: "Trier: Graduation proche" },
  { value: "grad_desc", label: "Trier: Graduation éloignée" },
  { value: "name_asc", label: "Trier: Nom A-Z" },
] as const;

export type PartnerSortKey = (typeof PARTNER_SORT_OPTIONS)[number]["value"];

export const DEFAULT_PARTNER_SORT: PartnerSortKey = "cote_desc";

/** Un param d'URL trafiqué ne doit pas produire un tri fantôme. */
export function isPartnerSortKey(v: string | null | undefined): v is PartnerSortKey {
  return !!v && PARTNER_SORT_OPTIONS.some((o) => o.value === v);
}

/* ── TRI — cas particulier de /newsroom ──────────────────────────
   Le fil d'actualité est CHRONOLOGIQUE par nature : il se lit du plus récent
   au plus ancien, et son filtre de période (7 j / 30 j / Tout) n'a de sens que
   sous cet ordre. Lui imposer « Meilleure cote » par défaut, comme sur les
   trois autres écrans, changerait ce qu'est l'écran.
   On lui donne donc les 5 options communes PLUS une 6e, « Plus récent », qui
   est son défaut et correspond à l'ordre déjà rendu par le serveur
   (`occurred_at DESC`). C'est un sur-ensemble, pas une divergence : les 5
   options partagées sont là, avec les mêmes libellés. */
export const NEWSROOM_RECENT_SORT = "recent";

export const NEWSROOM_SORT_OPTIONS = [
  { value: NEWSROOM_RECENT_SORT, label: "Trier: Plus récent" },
  ...PARTNER_SORT_OPTIONS,
] as const;

export const DEFAULT_NEWSROOM_SORT = NEWSROOM_RECENT_SORT;

/** Forme minimale requise pour trier — chaque écran fournit son accesseur. */
export type SortableAthlete = {
  cote_globale_entraineur?: number | string | null;
  annee_diplomation?: number | null;
  last_name?: string | null;
};

/* PostgREST rend les colonnes `numeric` en chaîne JSON ("5.00"), pas en
   nombre. Comparer sans convertir trierait lexicographiquement — "10" avant
   "9". On convertit systématiquement, ce qui reste correct si un jour la
   colonne arrive déjà en number. */
function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/* Une cote ABSENTE n'est pas une cote de zéro, et une promotion absente n'est
   pas l'an zéro : les valeurs nulles sortent EN DERNIER dans les deux sens de
   tri. Volontairement plus strict que PostgREST, dont le défaut place les
   NULL en tête sur un `.order(desc)` — c'est ce défaut qui avait fait ouvrir
   /classements sur 22 athlètes non évalués. */
function cmpNullable(a: number | null, b: number | null, asc: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return asc ? a - b : b - a;
}

/**
 * Trie une liste DÉJÀ constituée, sans en changer la composition.
 *
 * C'est le point central du tri partenaire : sur /classements comme sur
 * /tendances et /newsroom, la liste est coupée côté serveur (`.limit()`) par
 * un critère qui DÉFINIT l'écran — la cote pour un classement, le delta pour
 * les tendances, la chronologie pour le fil. Trier côté serveur AVANT la
 * coupe changerait la COMPOSITION de la liste : « Nom A-Z » + `.limit(25)`
 * rendrait les 25 premiers alphabétiquement, pas le top 25 réordonné.
 *
 * En triant APRÈS la coupe, l'appartenance reste définie par l'écran et seul
 * l'ORDRE D'AFFICHAGE suit le choix de l'utilisateur.
 *
 * Le tri de `Array.prototype.sort` est stable (garanti par la spec depuis
 * ES2019) : à valeur égale, les ex æquo conservent leur rang d'origine — donc
 * l'ordre du critère de l'écran reste visible sous le tri choisi.
 */
export function sortPartnerRows<T>(
  rows: T[],
  key: PartnerSortKey,
  pick: (row: T) => SortableAthlete,
): T[] {
  const out = [...rows];
  out.sort((ra, rb) => {
    const a = pick(ra);
    const b = pick(rb);
    switch (key) {
      case "cote_desc":
        return cmpNullable(toNum(a.cote_globale_entraineur), toNum(b.cote_globale_entraineur), false);
      case "cote_asc":
        return cmpNullable(toNum(a.cote_globale_entraineur), toNum(b.cote_globale_entraineur), true);
      case "grad_asc":
        return cmpNullable(toNum(a.annee_diplomation), toNum(b.annee_diplomation), true);
      case "grad_desc":
        return cmpNullable(toNum(a.annee_diplomation), toNum(b.annee_diplomation), false);
      case "name_asc": {
        const na = a.last_name ?? "";
        const nb = b.last_name ?? "";
        if (!na && !nb) return 0;
        if (!na) return 1;
        if (!nb) return -1;
        // Comparaison FR : « Éthier » se range avec les E, pas après le Z.
        return na.localeCompare(nb, "fr", { sensitivity: "base" });
      }
      default:
        return 0;
    }
  });
  return out;
}

/* ── ORGANISME ───────────────────────────────────────────────── */

/** `scolaire` = rattaché à une école ; `ligue_civile` = sans école. */
export const ORG_TYPE_OPTIONS = [
  { value: "scolaire", label: "École secondaire" },
  { value: "ligue_civile", label: "Ligue civile" },
] as const;

export const ORG_TYPE_PLACEHOLDER = "Tous les organismes";

export function isOrgType(v: string | null | undefined): v is "scolaire" | "ligue_civile" {
  return v === "scolaire" || v === "ligue_civile";
}

/* ── COTE MINIMALE ───────────────────────────────────────────── */

export const COTE_MIN_OPTIONS = [
  { value: "3", label: "Cote min: 3+" },
  { value: "3.5", label: "Cote min: 3.5+" },
  { value: "4", label: "Cote min: 4+" },
  { value: "4.5", label: "Cote min: 4.5+" },
] as const;

export const COTE_MIN_PLACEHOLDER = "Cote min: aucune";

/** Un param trafiqué donnerait NaN, et `.gte(col, NaN)` fait ÉCHOUER la
    requête PostgREST — l'écran tomberait à vide sans message. */
export function parseCoteMin(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
