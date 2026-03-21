/* ─────────────────────────────────────────────────────────────────
   Mock Search Athletes — 20 athletes for recruiter search
   Reuses coach-side profiles + adds new ones.
───────────────────────────────────────────────────────────────── */

import type { NexusSport, LeadershipBadge } from "@/lib/config/sportBadges";

export interface SearchAthlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  sport: NexusSport;
  school: string;
  region: string;
  graduationYear: number;
  niveau: "Sec. 4" | "Sec. 5";
  heightDisplay: string;
  weightDisplay: string;
  photo?: string;
  isVerified: boolean;
  badges: LeadershipBadge[];
  favorites: number;
  views: number;
  stars: number;
  hasVideo: boolean;
  isFavorited: boolean; // by current recruiter
  commitmentStatus: string;
  orgType?: "scolaire" | "ligue_civile";
  orgLevel?: "AAA" | "AA" | "A" | "Club" | "Civil";
}

export const SEARCH_ATHLETES: SearchAthlete[] = [
  {
    id: "r-001", firstName: "Marc-Antoine", lastName: "Tremblay",
    position: "QB", sport: "football", school: "É.S. Saint-Jean-Eudes",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "6'2\"", weightDisplay: "195 lbs",
    isVerified: true, badges: [{ badgeId: "captain", label: "Capitaine", icon: "captain" }, { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar" }],
    favorites: 3, views: 34, stars: 5, hasVideo: true, isFavorited: true, commitmentStatus: "ouvert",
  },
  {
    id: "r-002", firstName: "Jérémy", lastName: "Lavoie",
    position: "WR", sport: "football", school: "É.S. Saint-Jean-Eudes",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "5'11\"", weightDisplay: "175 lbs",
    isVerified: true, badges: [{ badgeId: "offensive_leader", label: "Meilleur joueur offensif", icon: "trending" }],
    favorites: 2, views: 28, stars: 4, hasVideo: true, isFavorited: true, commitmentStatus: "ouvert",
  },
  {
    id: "r-003", firstName: "Félix", lastName: "Gagnon-Roy",
    position: "LB", sport: "football", school: "É.S. Saint-Jean-Eudes",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "6'0\"", weightDisplay: "210 lbs",
    isVerified: true, badges: [{ badgeId: "team_leader", label: "Meilleur joueur d'équipe", icon: "target" }],
    favorites: 1, views: 22, stars: 4, hasVideo: true, isFavorited: true, commitmentStatus: "committed",
  },
  {
    id: "r-004", firstName: "Xavier", lastName: "Lapointe",
    position: "RB", sport: "football", school: "É.S. De Mortagne",
    region: "Montérégie", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "5'10\"", weightDisplay: "190 lbs",
    isVerified: true, badges: [{ badgeId: "progression", label: "Progression marquée", icon: "trending" }],
    favorites: 1, views: 15, stars: 3, hasVideo: true, isFavorited: true, commitmentStatus: "ouvert",
  },
  {
    id: "r-005", firstName: "Alexis", lastName: "Bouchard",
    position: "RB", sport: "football", school: "É.S. De Mortagne",
    region: "Montérégie", graduationYear: 2027, niveau: "Sec. 4",
    heightDisplay: "5'9\"", weightDisplay: "185 lbs",
    isVerified: true, badges: [],
    favorites: 0, views: 18, stars: 3, hasVideo: false, isFavorited: false, commitmentStatus: "ouvert",
  },
  {
    id: "r-006", firstName: "Samuel", lastName: "Côté",
    position: "OL", sport: "football", school: "É.S. Roger-Comtois",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "6'3\"", weightDisplay: "265 lbs",
    isVerified: true, badges: [{ badgeId: "captain", label: "Capitaine", icon: "captain" }],
    favorites: 0, views: 12, stars: 3, hasVideo: false, isFavorited: true, commitmentStatus: "ouvert",
  },
  {
    id: "r-007", firstName: "Raphaël", lastName: "Bergeron",
    position: "CB", sport: "football", school: "É.S. les Etchemins",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "5'11\"", weightDisplay: "170 lbs",
    isVerified: true, badges: [{ badgeId: "allstar", label: "Étoile provinciale", icon: "allstar" }],
    favorites: 2, views: 20, stars: 4, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
  },
  {
    id: "r-008", firstName: "William", lastName: "Pelletier",
    position: "DL", sport: "football", school: "É.S. Pointe-Lévy",
    region: "Québec", graduationYear: 2027, niveau: "Sec. 4",
    heightDisplay: "6'1\"", weightDisplay: "230 lbs",
    isVerified: true, badges: [],
    favorites: 0, views: 8, stars: 3, hasVideo: false, isFavorited: false, commitmentStatus: "ouvert",
  },
  {
    id: "r-009", firstName: "Antoine", lastName: "Dubois",
    position: "S", sport: "football", school: "É.S. de Rochebelle",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "6'0\"", weightDisplay: "180 lbs",
    isVerified: true, badges: [],
    favorites: 1, views: 14, stars: 3, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
  },
  {
    id: "r-010", firstName: "Étienne", lastName: "Fortin",
    position: "S", sport: "football", school: "É.S. de Rochebelle",
    region: "Québec", graduationYear: 2027, niveau: "Sec. 4",
    heightDisplay: "5'11\"", weightDisplay: "172 lbs",
    isVerified: false, badges: [],
    favorites: 0, views: 0, stars: 2, hasVideo: false, isFavorited: false, commitmentStatus: "ouvert",
  },
  // ── Volleyball ──
  {
    id: "r-016", firstName: "Sophie", lastName: "Bergeron",
    position: "Attaquante", sport: "volleyball", school: "É.S. De Mortagne",
    region: "Montérégie", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "5'10\"", weightDisplay: "145 lbs",
    isVerified: true, badges: [{ badgeId: "captain", label: "Capitaine", icon: "captain" }],
    favorites: 2, views: 19, stars: 4, hasVideo: true, isFavorited: false, commitmentStatus: "en_visite",
  },
  {
    id: "r-017", firstName: "Camille", lastName: "Roy",
    position: "Passeuse", sport: "volleyball", school: "É.S. les Etchemins",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "5'8\"", weightDisplay: "135 lbs",
    isVerified: true, badges: [{ badgeId: "offensive_leader", label: "Meilleur joueur offensif", icon: "trending" }],
    favorites: 1, views: 16, stars: 4, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
  },
  {
    id: "r-018", firstName: "Laurie", lastName: "Gagnon",
    position: "Libéro", sport: "volleyball", school: "É.S. Roger-Comtois",
    region: "Québec", graduationYear: 2027, niveau: "Sec. 4",
    heightDisplay: "5'6\"", weightDisplay: "125 lbs",
    isVerified: true, badges: [],
    favorites: 0, views: 7, stars: 3, hasVideo: false, isFavorited: false, commitmentStatus: "ouvert",
  },
  // ── Basketball ──
  {
    id: "r-019", firstName: "Noah", lastName: "Jean-Baptiste",
    position: "Meneur", sport: "basketball", school: "É.S. Dalbé-Viau",
    region: "Montréal", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "6'1\"", weightDisplay: "175 lbs",
    isVerified: true, badges: [{ badgeId: "captain", label: "Capitaine", icon: "captain" }, { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar" }],
    favorites: 4, views: 30, stars: 5, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
  },
  {
    id: "r-020", firstName: "Malik", lastName: "Traoré",
    position: "Pivot", sport: "basketball", school: "É.S. Lucien-Pagé",
    region: "Montréal", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "6'5\"", weightDisplay: "210 lbs",
    isVerified: true, badges: [{ badgeId: "defensive_leader", label: "Meilleur joueur défensif", icon: "shield" }],
    favorites: 3, views: 25, stars: 4, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
  },
  // ── Soccer ──
  {
    id: "r-021", firstName: "Gabriel", lastName: "Moreau",
    position: "Milieu", sport: "soccer", school: "É.S. de la Magdeleine",
    region: "Montérégie", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "5'9\"", weightDisplay: "155 lbs",
    isVerified: true, badges: [{ badgeId: "captain", label: "Capitaine", icon: "captain" }],
    favorites: 1, views: 11, stars: 4, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
  },
  {
    id: "r-022", firstName: "Léa", lastName: "Fournier",
    position: "Attaquant", sport: "soccer", school: "É.S. De Mortagne",
    region: "Montérégie", graduationYear: 2027, niveau: "Sec. 4",
    heightDisplay: "5'7\"", weightDisplay: "130 lbs",
    isVerified: true, badges: [{ badgeId: "offensive_leader", label: "Meilleur buteur", icon: "trending", detail: "22 buts" }],
    favorites: 2, views: 13, stars: 4, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
  },
  // ── Hockey ──
  {
    id: "r-023", firstName: "Olivier", lastName: "Bélanger",
    position: "Centre", sport: "hockey", school: "É.S. Saint-Jean-Eudes",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "5'11\"", weightDisplay: "180 lbs",
    isVerified: true, badges: [{ badgeId: "captain", label: "Capitaine", icon: "captain" }],
    favorites: 2, views: 17, stars: 4, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
  },
  // ── Cross-country ──
  {
    id: "r-013", firstName: "Émile", lastName: "Tanguay",
    position: "Coureur", sport: "cross_country", school: "É.S. De Mortagne",
    region: "Montérégie", graduationYear: 2027, niveau: "Sec. 4",
    heightDisplay: "5'8\"", weightDisplay: "140 lbs",
    isVerified: false, badges: [{ badgeId: "best_time", label: "Meilleur chrono d'équipe", icon: "trophy" }],
    favorites: 0, views: 0, stars: 2, hasVideo: false, isFavorited: false, commitmentStatus: "ouvert",
  },
  // ── Natation ──
  {
    id: "r-024", firstName: "Maëlle", lastName: "Lessard",
    position: "Sprint", sport: "natation", school: "É.S. Pointe-Lévy",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "5'9\"", weightDisplay: "140 lbs",
    isVerified: true, badges: [{ badgeId: "best_time", label: "Record d'école", icon: "trophy", detail: "100m libre" }],
    favorites: 1, views: 9, stars: 3, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
  },
  // ── League athletes ──
  {
    id: "r-030", firstName: "Samuel", lastName: "Bérubé",
    position: "QB", sport: "football", school: "Wildcats Lanaudière",
    region: "Lanaudière", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "6'1\"", weightDisplay: "190 lbs",
    isVerified: true, badges: [{ badgeId: "captain", label: "Capitaine", icon: "captain" }],
    favorites: 2, views: 18, stars: 4, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
    orgType: "ligue_civile", orgLevel: "AAA",
  },
  {
    id: "r-031", firstName: "Raphael", lastName: "Côté",
    position: "Centre", sport: "hockey", school: "Remparts Hockey AAA",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "5'11\"", weightDisplay: "185 lbs",
    isVerified: true, badges: [{ badgeId: "offensive_leader", label: "Meilleur pointeur", icon: "trending" }],
    favorites: 4, views: 30, stars: 5, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
    orgType: "ligue_civile", orgLevel: "AAA",
  },
  {
    id: "r-032", firstName: "Jayden", lastName: "Williams",
    position: "Pivot", sport: "basketball", school: "Club Basketball Brookwood",
    region: "Montréal", graduationYear: 2027, niveau: "Sec. 4",
    heightDisplay: "6'4\"", weightDisplay: "195 lbs",
    isVerified: false, badges: [],
    favorites: 1, views: 8, stars: 3, hasVideo: false, isFavorited: false, commitmentStatus: "ouvert",
    orgType: "ligue_civile", orgLevel: "AA",
  },
  {
    id: "r-033", firstName: "Diego", lastName: "Fernandez",
    position: "Milieu", sport: "soccer", school: "RSL Québec Academy",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    heightDisplay: "5'10\"", weightDisplay: "160 lbs",
    isVerified: true, badges: [{ badgeId: "team_leader", label: "MVP", icon: "target" }],
    favorites: 3, views: 22, stars: 4, hasVideo: true, isFavorited: false, commitmentStatus: "ouvert",
    orgType: "ligue_civile", orgLevel: "AAA",
  },
];

/* ── Sport → positions mapping ────────────────────────────── */
export const SPORT_POSITIONS: Record<string, { abbr: string; label: string }[]> = {
  football: [
    { abbr: "QB", label: "Quart-arrière" }, { abbr: "RB", label: "Porteur de ballon" },
    { abbr: "WR", label: "Receveur" }, { abbr: "TE", label: "Ailier rapproché" },
    { abbr: "OL", label: "Ligne offensive" }, { abbr: "DL", label: "Ligne défensive" },
    { abbr: "LB", label: "Secondeur" }, { abbr: "CB", label: "Demi de coin" },
    { abbr: "S", label: "Maraudeur" }, { abbr: "K/P", label: "Botteur/Punter" },
  ],
  volleyball: [
    { abbr: "Passeuse", label: "Passeur(se)" }, { abbr: "Attaquante", label: "Attaquant(e)" },
    { abbr: "Centrale", label: "Central(e)" }, { abbr: "Libéro", label: "Libéro" },
  ],
  basketball: [
    { abbr: "Meneur", label: "Meneur" }, { abbr: "Arrière", label: "Arrière" },
    { abbr: "Ailier", label: "Ailier" }, { abbr: "Pivot", label: "Pivot" },
  ],
  soccer: [
    { abbr: "Gardien", label: "Gardien" }, { abbr: "Défenseur", label: "Défenseur" },
    { abbr: "Milieu", label: "Milieu" }, { abbr: "Attaquant", label: "Attaquant" },
  ],
  hockey: [
    { abbr: "Centre", label: "Centre" }, { abbr: "Ailier gauche", label: "Ailier gauche" },
    { abbr: "Ailier droit", label: "Ailier droit" }, { abbr: "Défenseur", label: "Défenseur" },
    { abbr: "Gardien", label: "Gardien" },
  ],
};

export const REGIONS = [
  "Montréal", "Québec", "Montérégie", "Outaouais", "Saguenay",
  "Estrie", "Laurentides", "Lanaudière", "Mauricie",
];
