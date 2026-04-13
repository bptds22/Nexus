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
