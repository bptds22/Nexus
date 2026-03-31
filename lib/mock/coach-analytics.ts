/* ═══════════════════════════════════════════════════════════════
   Coach Analytics — Mock data for /coach/ecole/analytics
═══════════════════════════════════════════════════════════════ */

export const coachAnalytics = {
  kpis: {
    views_30d: 166,
    views_trend: 23,
    favorites_30d: 24,
    favorites_trend: 8,
    contacts_30d: 5,
    contacts_trend: 2,
    visibility_rate: 73,
    athletes_with_views: 11,
    total_athletes: 15,
    placements_season: 2,
  },

  views_weekly: [12, 18, 15, 22, 28, 20, 35, 42, 38, 45, 52, 48],

  athlete_performance: [
    { name: "Marc-Antoine Tremblay", pos: "QB", grad: 2026, completion: 95, views: 34, trend: "up" as const, trend_pct: 42, favorites: 8, contacts: 3, status: "verified" },
    { name: "Émile Bouchard", pos: "C", grad: 2026, completion: 91, views: 28, trend: "up" as const, trend_pct: 15, favorites: 5, contacts: 2, status: "verified" },
    { name: "Jérémy Lavoie", pos: "WR", grad: 2026, completion: 85, views: 22, trend: "flat" as const, trend_pct: 2, favorites: 4, contacts: 1, status: "verified" },
    { name: "Samuel Côté", pos: "LB", grad: 2026, completion: 82, views: 18, trend: "up" as const, trend_pct: 28, favorites: 3, contacts: 1, status: "verified" },
    { name: "Thomas Leclerc", pos: "RB", grad: 2026, completion: 78, views: 16, trend: "flat" as const, trend_pct: -5, favorites: 2, contacts: 0, status: "verified" },
    { name: "Olivier Nadeau", pos: "OL", grad: 2027, completion: 75, views: 12, trend: "up" as const, trend_pct: 20, favorites: 1, contacts: 0, status: "verified" },
    { name: "William Gagnon", pos: "DL", grad: 2027, completion: 72, views: 10, trend: "down" as const, trend_pct: -18, favorites: 1, contacts: 0, status: "verified" },
    { name: "Nathan Roy", pos: "DB", grad: 2026, completion: 70, views: 8, trend: "flat" as const, trend_pct: 3, favorites: 0, contacts: 0, status: "verified" },
    { name: "Félix Bouchard", pos: "S", grad: 2027, completion: 68, views: 6, trend: "down" as const, trend_pct: -25, favorites: 0, contacts: 0, status: "verified" },
    { name: "Anthony Simard", pos: "TE", grad: 2027, completion: 65, views: 5, trend: "flat" as const, trend_pct: 0, favorites: 0, contacts: 0, status: "verified" },
    { name: "Charles Pelletier", pos: "CB", grad: 2026, completion: 62, views: 4, trend: "down" as const, trend_pct: -30, favorites: 0, contacts: 0, status: "verified" },
    { name: "Mathis Dufresne", pos: "SF", grad: 2027, completion: 60, views: 15, trend: "up" as const, trend_pct: 35, favorites: 0, contacts: 0, status: "verified" },
    { name: "Raphaël Bergeron", pos: "FW", grad: 2026, completion: 55, views: 3, trend: "down" as const, trend_pct: -40, favorites: 0, contacts: 0, status: "self_reported" },
    { name: "Zachary Ouellet", pos: "K/P", grad: 2027, completion: 45, views: 0, trend: "down" as const, trend_pct: -100, favorites: 0, contacts: 0, status: "not_verified" },
    { name: "Noah Simard", pos: "WR", grad: 2026, completion: 38, views: 1, trend: "down" as const, trend_pct: -50, favorites: 0, contacts: 0, status: "self_reported" },
  ],

  cegeps_interested: [
    { name: "CÉGEP Garneau", views: 34, sports: ["Football", "Hockey"], athletes_viewed: 8, last_access: "Il y a 2 jours" },
    { name: "CÉGEP de Jonquière", views: 22, sports: ["Football"], athletes_viewed: 5, last_access: "Il y a 1 semaine" },
    { name: "Collège Montmorency", views: 18, sports: ["Basketball", "Volleyball"], athletes_viewed: 6, last_access: "Il y a 3 jours" },
    { name: "Collège Mérici", views: 14, sports: ["Football", "Soccer"], athletes_viewed: 4, last_access: "Il y a 5 jours" },
    { name: "CÉGEP de Sainte-Foy", views: 12, sports: ["Soccer", "Volleyball"], athletes_viewed: 3, last_access: "Il y a 1 semaine" },
  ],

  funnel: {
    created: 15,
    verified: 11,
    viewed: 11,
    favorited: 8,
    contacted: 5,
    in_discussion: 3,
    visit_planned: 2,
    placed: 2,
  },

  attention_needed: [
    { name: "Zachary Ouellet", pos: "K/P", grad: 2027, type: "zero_views" as const, detail: "0 vues en 21 jours", missing: "vidéo, stats", completion: 45 },
    { name: "Noah Simard", pos: "WR", grad: 2026, type: "incomplete" as const, detail: "38% complétion", missing: "vidéo, photo, stats", completion: 38 },
    { name: "Raphaël Bergeron", pos: "FW", grad: 2026, type: "unverified" as const, detail: "Auto-déclaré depuis 32 jours", missing: "vérification coach", completion: 55 },
    { name: "Mathis Dufresne", pos: "SF", grad: 2027, type: "viewed_not_contacted" as const, detail: "15 vues, 0 contacts", missing: "vidéo, rapport détaillé", completion: 60 },
  ],

  sports_breakdown: {
    athletes: [
      { sport: "Football", count: 6, percent: 40 },
      { sport: "Hockey", count: 3, percent: 20 },
      { sport: "Basketball", count: 2, percent: 13 },
      { sport: "Volleyball", count: 2, percent: 13 },
      { sport: "Soccer", count: 2, percent: 13 },
    ],
    views: [
      { sport: "Football", views: 82, percent: 49 },
      { sport: "Hockey", views: 38, percent: 23 },
      { sport: "Basketball", views: 22, percent: 13 },
      { sport: "Volleyball", views: 14, percent: 8 },
      { sport: "Soccer", views: 10, percent: 6 },
    ],
  },
};
