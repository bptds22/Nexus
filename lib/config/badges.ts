/* ─────────────────────────────────────────────────────────────────
   Universal Distinction Badges — Single Source of Truth
   7 badge types that work across all sports.
───────────────────────────────────────────────────────────────── */

export interface BadgeConfig {
  icon: string;
  label: string;
  hasDetail: boolean;
}

export const BADGE_CONFIG: Record<string, BadgeConfig> = {
  captain:       { icon: "shield",  label: "Capitaine",             hasDetail: false },
  allstar:       { icon: "star",    label: "Étoile provinciale",    hasDetail: false },
  progression:   { icon: "rocket",  label: "Progression marquée",   hasDetail: false },
  team_leader:   { icon: "medal",   label: "Meneur d'équipe",       hasDetail: true  },
  league_leader: { icon: "crown",   label: "Meneur de la ligue",    hasDetail: true  },
  mvp:           { icon: "trophy",  label: "Joueur par excellence", hasDetail: false },
  custom:        { icon: "target",  label: "",                      hasDetail: true  },
};

export const BADGE_ORDER = ["captain", "allstar", "progression", "team_leader", "league_leader", "mvp", "custom"];

/** Max badges per athlete */
export const MAX_BADGES = 5;

/** Max characters for team_leader / league_leader / custom detail text */
export const MAX_DETAIL_LENGTH = 30;

/** Sport-specific stat suggestions for team_leader / league_leader dropdowns */
export const SPORT_STATS: Record<string, string[]> = {
  hockey:        ["Points", "Buts", "Passes", "+/-", "Arrêts", "Minutes de pénalité"],
  football:      ["Verges", "Touchés", "Plaqués", "Interceptions", "Sacs"],
  basketball:    ["Points", "Passes", "Rebonds", "Vols", "Blocs"],
  soccer:        ["Buts", "Passes", "Blanchissages", "Tirs cadrés"],
  volleyball:    ["Attaques", "Blocs", "Manchettes", "Aces"],
  flag_football: ["Verges", "Touchés", "Interceptions", "Sacs"],
  rugby:         ["Essais", "Plaqués", "Transformations"],
  cross_country: ["3 km", "5 km", "8 km"],
  natation:      ["50m libre", "100m libre", "200m dos", "100m brasse"],
  athletisme:    ["100m", "200m", "400m", "Saut en longueur", "Lancer du poids"],
  badminton:     ["Simples", "Doubles"],
  cheerleading:  ["Tumbling", "Stunt", "Base", "Flyer"],
};

/** Map French sport name (from sports.nom) → key used in SPORT_STATS.
 *  Also re-exported as SPORT_NAME_MAP for legacy compatibility. */
export const SPORT_NAME_TO_KEY: Record<string, string> = {
  "Football": "football",
  "Hockey": "hockey",
  "Basketball": "basketball",
  "Soccer": "soccer",
  "Volleyball": "volleyball",
  "Flag football": "flag_football",
  "Rugby": "rugby",
  "Cross-country": "cross_country",
  "Natation": "natation",
  "Athlétisme": "athletisme",
  "Badminton": "badminton",
  "Cheerleading": "cheerleading",
};

export const SPORT_NAME_MAP = SPORT_NAME_TO_KEY;

export function getSportStats(sportName: string | null | undefined): string[] {
  if (!sportName) return [];
  const key = SPORT_NAME_TO_KEY[sportName];
  if (!key) return [];
  return SPORT_STATS[key] || [];
}

/* ─────────────────────────────────────────────────────────────────
   Pont vers le catalogue de 22 badges (table `badges`).

   VOIE 1 — transitoire. Les surfaces lisent encore
   evaluations.distinctions, que le miroir en base entretient avec les
   ANCIENS codes. Les 22 fichiers de public/badges/ portent les NOUVEAUX.
   Cette table fait la jonction le temps que les appelants basculent sur
   athlete_badges (voie 2 : 15 fichiers, autre lot).

   `progression` n'a AUCUN équivalent au nouveau catalogue. Il n'est
   rapproché d'aucun code : afficher un badge que le coach n'a pas donné
   serait une erreur d'information sur un mineur montré à des recruteurs.
   Un badge absent est une lacune ; un badge faux est une faute.
   DistinctionBadge ne rend alors rien et journalise avec le marqueur
   NEXUS:.
───────────────────────────────────────────────────────────────── */
export const LEGACY_BADGE_TO_CATALOGUE: Record<string, string> = {
  captain:       "capitaine",
  allstar:       "equipe-etoiles",
  mvp:           "mvp",
  team_leader:   "leader-equipe",
  league_leader: "leader-ligue",
  custom:        "nexus-x",
  // progression : volontairement absent — voir ci-dessus.
};

/** Les 22 codes du catalogue.
 *  Source de vérité : badges-catalogue-final.json, reflété par la table
 *  public.badges. Si cette liste diverge du fichier, c'est elle qui a tort.
 *  Vérifié contre le JSON et contre la base le 2026-08-25. */
export const CATALOGUE_BADGE_CODES = [
  "capitaine", "qi", "clutch", "costaud", "disponibilite",
  "mvp", "leader-equipe", "leader-ligue", "equipe-etoiles", "nexus-x",
  "finisseur", "3-points", "insaisissable", "verrou", "fusee",
  "dans-la-mire", "vitesse", "mains-sures", "inarretable",
  "force-de-frappe", "rempart", "radar",
] as const;

const CATALOGUE_SET = new Set<string>(CATALOGUE_BADGE_CODES);

/** Chemin du SVG d'un badge, ou null si le code n'a pas d'équivalent.
 *  Accepte indifféremment un ancien code (captain) ou un code de
 *  catalogue (capitaine), ce qui évitera un second passage le jour de la
 *  voie 2. */
export function badgeSvgPath(code: string): string | null {
  const cat = LEGACY_BADGE_TO_CATALOGUE[code] ?? (CATALOGUE_SET.has(code) ? code : null);
  return cat ? `/badges/badge-${cat}.svg` : null;
}

/** A badge entry stored in evaluations.distinctions (new format) */
export interface DistinctionEntry {
  badge: string;
  detail?: string;
}

/** Parse distinctions JSONB into the object format, handling legacy string arrays */
export function parseDistinctions(raw: unknown): DistinctionEntry[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((item): DistinctionEntry | null => {
      if (typeof item === "string") return { badge: item };
      if (item && typeof item === "object" && "badge" in item) {
        const e = item as { badge: string; detail?: string };
        return { badge: e.badge, detail: e.detail };
      }
      return null;
    })
    .filter((e): e is DistinctionEntry => e !== null && !!BADGE_CONFIG[e.badge]);
}
