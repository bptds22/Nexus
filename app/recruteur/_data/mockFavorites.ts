/* ─────────────────────────────────────────────────────────────────
   Mock Favorites — 12 athletes with recruitment pipeline statuses
───────────────────────────────────────────────────────────────── */

export type RecruitmentStatus = "identifie" | "contacte" | "en_discussion" | "visite" | "engage" | "retire";

export interface FavoriteAthlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  sport: string;
  school: string;
  region: string;
  graduationYear: number;
  niveau: "Sec. 4" | "Sec. 5";
  isVerified: boolean;
  badges: { icon: string; label: string }[];
  recruitmentStatus: RecruitmentStatus;
  favoritedDate: string;
  note?: string;
  hasVideo: boolean;
}

export const RECRUITMENT_STATUS_CONFIG: Record<RecruitmentStatus, {
  label: string; icon: string; color: string; bg: string; textColor: string; order: number;
}> = {
  engage:        { label: "Engagé",           icon: "✅", color: "#22C55E", bg: "bg-[#22C55E]/15", textColor: "text-[#22C55E]", order: 0 },
  visite:        { label: "Visite planifiée", icon: "📅", color: "#F59E0B", bg: "bg-[#F59E0B]/15", textColor: "text-[#F59E0B]", order: 1 },
  en_discussion: { label: "En discussion",    icon: "💬", color: "#3B82F6", bg: "bg-[#3B82F6]/15", textColor: "text-[#3B82F6]", order: 2 },
  contacte:      { label: "Contacté",         icon: "✉️", color: "#60A5FA", bg: "bg-[#60A5FA]/15", textColor: "text-[#60A5FA]", order: 3 },
  identifie:     { label: "Identifié",        icon: "👁️", color: "#6B7280", bg: "bg-[#6B7280]/15", textColor: "text-[#6B7280]", order: 4 },
  retire:        { label: "Retiré",           icon: "✕",  color: "#374151", bg: "bg-[#374151]/15", textColor: "text-[#374151]", order: 5 },
};

/* Valid next statuses for each status */
export const VALID_TRANSITIONS: Record<RecruitmentStatus, RecruitmentStatus[]> = {
  identifie:     ["contacte", "retire"],
  contacte:      ["en_discussion", "retire"],
  en_discussion: ["visite", "retire"],
  visite:        ["engage", "retire"],
  engage:        ["retire"],
  retire:        [],
};

export const MOCK_FAVORITES: FavoriteAthlete[] = [
  // ── 2 Engagé ──
  {
    id: "r-001", firstName: "Marc-Antoine", lastName: "Tremblay",
    position: "QB", sport: "Football", school: "É.S. Saint-Jean-Eudes",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [{ icon: "captain", label: "Capitaine" }, { icon: "allstar", label: "Étoile provinciale" }],
    recruitmentStatus: "engage", favoritedDate: "2026-01-15",
    note: "Visite confirmée le 22 mars", hasVideo: true,
  },
  {
    id: "r-014", firstName: "Thomas", lastName: "Carrier-Brault",
    position: "TE", sport: "Football", school: "É.S. Saint-Jean-Eudes",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [{ icon: "captain", label: "Capitaine" }],
    recruitmentStatus: "engage", favoritedDate: "2026-01-20", hasVideo: true,
  },
  // ── 2 Visite planifiée ──
  {
    id: "r-004", firstName: "Xavier", lastName: "Lapointe",
    position: "RB", sport: "Football", school: "É.S. De Mortagne",
    region: "Montérégie", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [{ icon: "trending", label: "Progression marquée" }],
    recruitmentStatus: "visite", favoritedDate: "2026-02-10",
    note: "Visite planifiée — 22 mars", hasVideo: true,
  },
  {
    id: "r-016", firstName: "Sophie", lastName: "Bergeron",
    position: "Attaquante", sport: "Volleyball", school: "É.S. De Mortagne",
    region: "Montérégie", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [{ icon: "captain", label: "Capitaine" }],
    recruitmentStatus: "visite", favoritedDate: "2026-02-12",
    note: "Visite planifiée — 28 mars", hasVideo: true,
  },
  // ── 3 En discussion ──
  {
    id: "r-002", firstName: "Jérémy", lastName: "Lavoie",
    position: "WR", sport: "Football", school: "É.S. Saint-Jean-Eudes",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [{ icon: "trending", label: "Meilleur joueur offensif" }],
    recruitmentStatus: "en_discussion", favoritedDate: "2026-02-15", hasVideo: true,
  },
  {
    id: "r-003", firstName: "Félix", lastName: "Gagnon-Roy",
    position: "LB", sport: "Football", school: "É.S. Saint-Jean-Eudes",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [{ icon: "target", label: "Meilleur joueur d'équipe" }],
    recruitmentStatus: "en_discussion", favoritedDate: "2026-02-18", hasVideo: true,
  },
  {
    id: "r-019", firstName: "Noah", lastName: "Jean-Baptiste",
    position: "Meneur", sport: "Basketball", school: "É.S. Dalbé-Viau",
    region: "Montréal", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [{ icon: "captain", label: "Capitaine" }, { icon: "allstar", label: "Étoile provinciale" }],
    recruitmentStatus: "en_discussion", favoritedDate: "2026-02-20", hasVideo: true,
  },
  // ── 2 Contacté ──
  {
    id: "r-007", firstName: "Raphaël", lastName: "Bergeron",
    position: "CB", sport: "Football", school: "É.S. les Etchemins",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [{ icon: "allstar", label: "Étoile provinciale" }],
    recruitmentStatus: "contacte", favoritedDate: "2026-03-01", hasVideo: true,
  },
  {
    id: "r-021", firstName: "Gabriel", lastName: "Moreau",
    position: "Milieu", sport: "Soccer", school: "É.S. de la Magdeleine",
    region: "Montérégie", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [{ icon: "captain", label: "Capitaine" }],
    recruitmentStatus: "contacte", favoritedDate: "2026-03-05", hasVideo: true,
  },
  // ── 2 Identifié ──
  {
    id: "r-009", firstName: "Antoine", lastName: "Dubois",
    position: "S", sport: "Football", school: "É.S. de Rochebelle",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [],
    recruitmentStatus: "identifie", favoritedDate: "2026-03-08", hasVideo: true,
  },
  {
    id: "r-006", firstName: "Samuel", lastName: "Côté",
    position: "OL", sport: "Football", school: "É.S. Roger-Comtois",
    region: "Québec", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [{ icon: "captain", label: "Capitaine" }],
    recruitmentStatus: "identifie", favoritedDate: "2026-03-09", hasVideo: false,
  },
  // ── 1 Retiré ──
  {
    id: "r-015", firstName: "Mathis", lastName: "Savard",
    position: "K/P", sport: "Football", school: "É.S. De Mortagne",
    region: "Montérégie", graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true, badges: [],
    recruitmentStatus: "retire", favoritedDate: "2026-01-10", hasVideo: false,
  },
];
