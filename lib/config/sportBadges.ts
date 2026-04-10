/* ─────────────────────────────────────────────────────────────────
   Sport-Specific Leadership Badges — Single Source of Truth
   Every UI component reads from this file.
   To add a new sport: add one entry to SPORT_BADGES. Zero code changes.
───────────────────────────────────────────────────────────────── */

export type NexusSport =
  | "football"
  | "volleyball"
  | "basketball"
  | "soccer"
  | "hockey"
  | "cross_country"
  | "natation"
  | "athletisme"
  | "badminton"
  | "cheerleading"
  | "flag_football"
  | "rugby";

/** A badge option available for a given sport */
export interface BadgeOption {
  badgeId: string;
  label: string;
  icon: string;
  hasDetail: boolean;
  detailPlaceholder?: string;
}

/** A badge selected by the coach for an athlete */
export interface LeadershipBadge {
  badgeId: string;
  label: string;
  icon: string;
  detail?: string;
}

/** Max badges per athlete (no limit) */
export const MAX_BADGES = Infinity;

/** Map UI sport names (French, from form) to NexusSport keys */
export const SPORT_NAME_MAP: Record<string, NexusSport> = {
  "Football": "football",
  "Volleyball": "volleyball",
  "Basketball": "basketball",
  "Soccer": "soccer",
  "Hockey": "hockey",
  "Cross-country": "cross_country",
  "Natation": "natation",
  "Athlétisme": "athletisme",
  "Badminton": "badminton",
  "Cheerleading": "cheerleading",
  "Flag football": "flag_football",
  "Rugby": "rugby",
};

export const SPORT_BADGES: Record<NexusSport, BadgeOption[]> = {

  football: [
    { badgeId: "captain", label: "Capitaine", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "team_leader", label: "Meilleur joueur d'équipe", icon: "target", hasDetail: true, detailPlaceholder: "Ex: Plaqués, Touchés, Sacks..." },
    { badgeId: "league_leader", label: "Meilleur joueur de la ligue", icon: "chart", hasDetail: true, detailPlaceholder: "Ex: Verges par la passe..." },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  volleyball: [
    { badgeId: "captain", label: "Capitaine", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "offensive_leader", label: "Meilleur joueur offensif", icon: "trending", hasDetail: true, detailPlaceholder: "Ex: Attaques, Points..." },
    { badgeId: "defensive_leader", label: "Meilleur joueur défensif", icon: "shield", hasDetail: true, detailPlaceholder: "Ex: Blocs, Manchettes..." },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  basketball: [
    { badgeId: "captain", label: "Capitaine", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "scoring_leader", label: "Meilleur pointeur", icon: "target", hasDetail: false },
    { badgeId: "assists_leader", label: "Meilleur passeur", icon: "chart", hasDetail: false },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  soccer: [
    { badgeId: "captain", label: "Capitaine", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "goals_leader", label: "Meilleur buteur", icon: "goal", hasDetail: false },
    { badgeId: "assists_leader", label: "Meilleur passeur", icon: "target", hasDetail: false },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  hockey: [
    { badgeId: "captain", label: "Capitaine", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "points_leader", label: "Meilleur pointeur", icon: "target", hasDetail: false },
    { badgeId: "goals_leader", label: "Meilleur buteur", icon: "goal", hasDetail: false },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  cross_country: [
    { badgeId: "captain", label: "Capitaine d'équipe", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "best_time", label: "Meilleur chrono d'équipe", icon: "timer", hasDetail: true, detailPlaceholder: "Ex: 5 km, 3 km..." },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  natation: [
    { badgeId: "captain", label: "Capitaine", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "school_record", label: "Record d'école", icon: "trophy", hasDetail: true, detailPlaceholder: "Ex: 100m libre, 200m dos..." },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  athletisme: [
    { badgeId: "captain", label: "Capitaine d'équipe", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "best_mark", label: "Meilleure marque d'équipe", icon: "trophy", hasDetail: true, detailPlaceholder: "Ex: 100m, Saut en longueur..." },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  badminton: [
    { badgeId: "captain", label: "Capitaine", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "singles_leader", label: "Meilleur en simple", icon: "target", hasDetail: false },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  cheerleading: [
    { badgeId: "captain", label: "Capitaine", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "specialist", label: "Spécialiste", icon: "target", hasDetail: true, detailPlaceholder: "Ex: Tumbling, Stunt, Base..." },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  flag_football: [
    { badgeId: "captain", label: "Capitaine", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "team_leader", label: "Meilleur joueur d'équipe", icon: "target", hasDetail: true, detailPlaceholder: "Ex: Touchés, Interceptions..." },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],

  rugby: [
    { badgeId: "captain", label: "Capitaine", icon: "captain", hasDetail: false },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar", hasDetail: false },
    { badgeId: "team_leader", label: "Meilleur joueur d'équipe", icon: "target", hasDetail: true, detailPlaceholder: "Ex: Essais, Plaqués..." },
    { badgeId: "progression", label: "Progression marquée", icon: "trending", hasDetail: false },
  ],
};

/** Get badges for a sport, falling back to empty array for unknown sports */
export function getBadgesForSport(sportName: string): BadgeOption[] {
  const key = SPORT_NAME_MAP[sportName];
  if (!key) return [];
  return SPORT_BADGES[key] ?? [];
}
