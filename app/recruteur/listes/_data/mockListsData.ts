/* ─────────────────────────────────────────────────────────────────
   Mock Prospect Lists — 5 lists with athletes
   Recruiter: Pierre Dufour, CÉGEP Garneau
───────────────────────────────────────────────────────────────── */

import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";

export interface ProspectListAthlete {
  id: string;
  full_name: string;
  photo_url: string;
  jersey: string;
  sport: string;
  position: string;
  school: string;
  division: "D1" | "D2" | "D3";
  graduation_year: number;
  coach_rating: number;
  is_verified: boolean;
  pipeline_status: RecruitmentStatus;
  added_at: string;
  recruiter_note: string;
  priority: boolean;
}

export interface ProspectList {
  id: string;
  name: string;
  description: string;
  athletes: ProspectListAthlete[];
  created_at: string;
  updated_at: string;
}

/* ── List 1: QB prioritaires ──────────────────────────────────── */

const QB_PRIORITAIRES: ProspectListAthlete[] = [
  { id: "l1-001", photo_url: "", jersey: "", full_name: "Marc-Antoine Tremblay", sport: "Football", position: "QB", school: "É.S. Saint-Jean-Eudes", division: "D1", graduation_year: 2026, coach_rating: 5, is_verified: true, pipeline_status: "visite_planifiee", added_at: "2026-01-18T10:00:00", priority: false, recruiter_note: "TOP prospect — bras puissant, excellent leadership" },
  { id: "l1-002", photo_url: "", jersey: "", full_name: "Olivier Nadeau", sport: "Football", position: "QB", school: "É.S. De Mortagne", division: "D1", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "engage", added_at: "2026-01-25T14:00:00", priority: false, recruiter_note: "Engagement verbal confirmé, très motivé" },
  { id: "l1-003", photo_url: "", jersey: "", full_name: "Jacob Plante", sport: "Football", position: "QB", school: "É.S. de Rochebelle", division: "D1", graduation_year: 2026, coach_rating: 3, is_verified: true, pipeline_status: "en_discussion", added_at: "2026-02-05T09:00:00", priority: false, recruiter_note: "Bon potentiel mais hésite entre nous et Limoilou" },
  { id: "l1-004", photo_url: "", jersey: "", full_name: "Nathan Boucher", sport: "Football", position: "QB", school: "É.S. Roger-Comtois", division: "D1", graduation_year: 2026, coach_rating: 3, is_verified: true, pipeline_status: "contacte", added_at: "2026-02-20T11:00:00", priority: false, recruiter_note: "Plan B solide — intelligent, mobile" },
];

/* ── List 2: Visite mars Saguenay ─────────────────────────────── */

const VISITE_SAGUENAY: ProspectListAthlete[] = [
  { id: "l2-001", photo_url: "", jersey: "", full_name: "Alexis Gauthier", sport: "Football", position: "RB", school: "É.S. Charles-Gravel", division: "D2", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "identifie", added_at: "2026-02-28T09:00:00", priority: false, recruiter_note: "Voir au match du 12 mars" },
  { id: "l2-002", photo_url: "", jersey: "", full_name: "Samuel Bouchard-Girard", sport: "Hockey", position: "D", school: "É.S. Odyssée-des-Jeunes", division: "D1", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "contacte", added_at: "2026-02-28T09:15:00", priority: false, recruiter_note: "Coach Tremblay très élogieux" },
  { id: "l2-003", photo_url: "", jersey: "", full_name: "Félix Simard-Blackburn", sport: "Basketball", position: "PG", school: "É.S. de la Baie", division: "D2", graduation_year: 2027, coach_rating: 3, is_verified: false, pipeline_status: "identifie", added_at: "2026-02-28T09:30:00", priority: false, recruiter_note: "Profil jeune, à évaluer en personne" },
  { id: "l2-004", photo_url: "", jersey: "", full_name: "William Fortin", sport: "Football", position: "WR", school: "É.S. Charles-Gravel", division: "D2", graduation_year: 2026, coach_rating: 3, is_verified: true, pipeline_status: "identifie", added_at: "2026-03-01T10:00:00", priority: false, recruiter_note: "Rapide, 4.5s au 40 yards d'après le coach" },
  { id: "l2-005", photo_url: "", jersey: "", full_name: "Émile Tremblay", sport: "Hockey", position: "C", school: "É.S. Odyssée-des-Jeunes", division: "D1", graduation_year: 2026, coach_rating: 5, is_verified: true, pipeline_status: "en_discussion", added_at: "2026-03-01T10:15:00", priority: false, recruiter_note: "Capitaine — joueur d'impact, prioriser" },
  { id: "l2-006", photo_url: "", jersey: "", full_name: "Thomas Lavoie", sport: "Soccer", position: "ST", school: "É.S. de la Baie", division: "D2", graduation_year: 2026, coach_rating: 3, is_verified: false, pipeline_status: "identifie", added_at: "2026-03-02T08:00:00", priority: false, recruiter_note: "À confirmer avec coach Gagnon" },
];

/* ── List 3: Suggestions Coach Bergeron ────────────────────────── */

const SUGGESTIONS_BERGERON: ProspectListAthlete[] = [
  { id: "l3-001", photo_url: "", jersey: "", full_name: "Jérémy Lavoie", sport: "Football", position: "WR", school: "É.S. Saint-Jean-Eudes", division: "D1", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "en_discussion", added_at: "2026-02-10T14:00:00", priority: false, recruiter_note: "Bergeron le considère son meilleur receveur en 10 ans" },
  { id: "l3-002", photo_url: "", jersey: "", full_name: "Félix Gagnon-Roy", sport: "Football", position: "LB", school: "É.S. Saint-Jean-Eudes", division: "D1", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "en_discussion", added_at: "2026-02-10T14:15:00", priority: false, recruiter_note: "Linebacker instinctif, excellent QI football" },
  { id: "l3-003", photo_url: "", jersey: "", full_name: "Adam Rioux", sport: "Football", position: "TE", school: "É.S. Saint-Jean-Eudes", division: "D1", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "contacte", added_at: "2026-02-10T14:30:00", priority: false, recruiter_note: "6'4, 220 lbs — profil athlétique rare au TE" },
];

/* ── List 4: Relève 2027 ──────────────────────────────────────── */

const RELEVE_2027: ProspectListAthlete[] = [
  { id: "l4-001", photo_url: "", jersey: "", full_name: "Mathis Dufresne", sport: "Football", position: "LB", school: "É.S. de Rochebelle", division: "D1", graduation_year: 2027, coach_rating: 3, is_verified: true, pipeline_status: "contacte", added_at: "2026-03-01T09:00:00", priority: false, recruiter_note: "Sec. 4 — encore un an de développement" },
  { id: "l4-002", photo_url: "", jersey: "", full_name: "Alexis Bouchard", sport: "Football", position: "RB", school: "É.S. Roger-Comtois", division: "D1", graduation_year: 2027, coach_rating: 3, is_verified: true, pipeline_status: "identifie", added_at: "2026-03-01T09:15:00", priority: false, recruiter_note: "Explosif, progression marquée cette saison" },
  { id: "l4-003", photo_url: "", jersey: "", full_name: "Raphaël Bergeron", sport: "Football", position: "DL", school: "É.S. les Etchemins", division: "D1", graduation_year: 2027, coach_rating: 2, is_verified: false, pipeline_status: "identifie", added_at: "2026-03-03T10:00:00", priority: false, recruiter_note: "Brut mais physique imposant" },
  { id: "l4-004", photo_url: "", jersey: "", full_name: "Justin Lavoie", sport: "Hockey", position: "RW", school: "É.S. les Etchemins", division: "D2", graduation_year: 2027, coach_rating: 3, is_verified: false, pipeline_status: "identifie", added_at: "2026-03-03T10:15:00", priority: false, recruiter_note: "Bon patineur, à réévaluer à l'automne" },
  { id: "l4-005", photo_url: "", jersey: "", full_name: "Gabriel Fortin", sport: "Hockey", position: "C", school: "É.S. Mont-Saint-Sacrement", division: "D1", graduation_year: 2027, coach_rating: 4, is_verified: true, pipeline_status: "identifie", added_at: "2026-03-05T11:00:00", priority: false, recruiter_note: "Très technique, vision de jeu exceptionnelle" },
  { id: "l4-006", photo_url: "", jersey: "", full_name: "Noah Tremblay", sport: "Football", position: "S", school: "É.S. De Mortagne", division: "D1", graduation_year: 2027, coach_rating: 2, is_verified: false, pipeline_status: "identifie", added_at: "2026-03-07T14:00:00", priority: false, recruiter_note: "" },
  { id: "l4-007", photo_url: "", jersey: "", full_name: "Antoine Mercier", sport: "Basketball", position: "PG", school: "É.S. de la Seigneurie", division: "D2", graduation_year: 2027, coach_rating: 4, is_verified: true, pipeline_status: "identifie", added_at: "2026-03-08T09:00:00", priority: false, recruiter_note: "Meneur polyvalent, bon en transition" },
  { id: "l4-008", photo_url: "", jersey: "", full_name: "Victor Dubois", sport: "Soccer", position: "GK", school: "É.S. Roger-Comtois", division: "D3", graduation_year: 2028, coach_rating: 2, is_verified: false, pipeline_status: "identifie", added_at: "2026-03-09T16:00:00", priority: false, recruiter_note: "Très jeune — noter pour suivi dans 2 ans" },
];

/* ── List 5: Hockey D1 — besoins urgents ──────────────────────── */

const HOCKEY_D1: ProspectListAthlete[] = [
  { id: "l5-001", photo_url: "", jersey: "", full_name: "Samuel Bouchard-Girard", sport: "Hockey", position: "D", school: "É.S. Odyssée-des-Jeunes", division: "D1", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "contacte", added_at: "2026-02-15T09:00:00", priority: false, recruiter_note: "Défenseur solide, bon premier relanceur" },
  { id: "l5-002", photo_url: "", jersey: "", full_name: "Philippe Lachance", sport: "Hockey", position: "G", school: "É.S. Mont-Saint-Sacrement", division: "D1", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "engage", added_at: "2026-02-15T09:15:00", priority: false, recruiter_note: "Gardien #1 confirmé — engagement verbal" },
  { id: "l5-003", photo_url: "", jersey: "", full_name: "Nathan Girard", sport: "Hockey", position: "C", school: "É.S. Mont-Saint-Sacrement", division: "D1", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "en_discussion", added_at: "2026-02-20T10:00:00", priority: false, recruiter_note: "Centre offensif, 45 pts en 30 matchs" },
  { id: "l5-004", photo_url: "", jersey: "", full_name: "Elliot Martel", sport: "Hockey", position: "D", school: "É.S. les Etchemins", division: "D1", graduation_year: 2026, coach_rating: 3, is_verified: true, pipeline_status: "retire", added_at: "2026-02-22T11:00:00", priority: false, recruiter_note: "Parti en Ontario — retirer" },
  { id: "l5-005", photo_url: "", jersey: "", full_name: "Émile Tremblay", sport: "Hockey", position: "C", school: "É.S. Odyssée-des-Jeunes", division: "D1", graduation_year: 2026, coach_rating: 5, is_verified: true, pipeline_status: "en_discussion", added_at: "2026-03-01T08:00:00", priority: false, recruiter_note: "Capitaine, joueur franchise — PRIORITÉ ABSOLUE" },
];

/* ── Export all lists ─────────────────────────────────────────── */

export const MOCK_LISTS: ProspectList[] = [
  {
    id: "list-001",
    name: "QB prioritaires 2026",
    description: "Mes meilleurs prospects quart-arrière pour la saison prochaine",
    athletes: QB_PRIORITAIRES,
    created_at: "2026-01-15T09:00:00",
    updated_at: "2026-02-20T11:00:00",
  },
  {
    id: "list-002",
    name: "Visite mars Saguenay",
    description: "Athlètes à voir lors de ma tournée Saguenay 12-14 mars",
    athletes: VISITE_SAGUENAY,
    created_at: "2026-02-28T08:00:00",
    updated_at: "2026-03-02T08:00:00",
  },
  {
    id: "list-003",
    name: "Suggestions Coach Bergeron",
    description: "Recommandations de Coach Bergeron, É.S. Saint-Jean-Eudes",
    athletes: SUGGESTIONS_BERGERON,
    created_at: "2026-02-10T14:00:00",
    updated_at: "2026-02-10T14:30:00",
  },
  {
    id: "list-004",
    name: "Liste de relève 2027",
    description: "Jeunes à surveiller pour les saisons à venir",
    athletes: RELEVE_2027,
    created_at: "2026-03-01T09:00:00",
    updated_at: "2026-03-09T16:00:00",
  },
  {
    id: "list-005",
    name: "Hockey D1 — besoins urgents",
    description: "Défenseurs et gardiens pour combler les départs",
    athletes: HOCKEY_D1,
    created_at: "2026-02-15T08:30:00",
    updated_at: "2026-03-01T08:00:00",
  },
];

/* ── Available athletes (favorites not in a given list) ───────── */

export const AVAILABLE_ATHLETES: ProspectListAthlete[] = [
  { id: "av-001", photo_url: "", jersey: "", full_name: "William Pelletier", sport: "Football", position: "CB", school: "É.S. les Etchemins", division: "D1", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "contacte", added_at: "", priority: false, recruiter_note: "" },
  { id: "av-002", photo_url: "", jersey: "", full_name: "Xavier Lapointe", sport: "Football", position: "RB", school: "É.S. De Mortagne", division: "D1", graduation_year: 2026, coach_rating: 3, is_verified: true, pipeline_status: "visite_planifiee", added_at: "", priority: false, recruiter_note: "" },
  { id: "av-003", photo_url: "", jersey: "", full_name: "Charles Morin", sport: "Basketball", position: "SF", school: "É.S. de la Seigneurie", division: "D2", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "contacte", added_at: "", priority: false, recruiter_note: "" },
  { id: "av-004", photo_url: "", jersey: "", full_name: "Loïc Pelletier", sport: "Basketball", position: "SG", school: "É.S. Saint-Jean-Eudes", division: "D1", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "identifie", added_at: "", priority: false, recruiter_note: "" },
  { id: "av-005", photo_url: "", jersey: "", full_name: "Maxime Hébert", sport: "Basketball", position: "C", school: "É.S. de la Seigneurie", division: "D2", graduation_year: 2026, coach_rating: 4, is_verified: true, pipeline_status: "visite_planifiee", added_at: "", priority: false, recruiter_note: "" },
  { id: "av-006", photo_url: "", jersey: "", full_name: "Zachary Thibault", sport: "Football", position: "K", school: "É.S. De Mortagne", division: "D1", graduation_year: 2026, coach_rating: 3, is_verified: false, pipeline_status: "contacte", added_at: "", priority: false, recruiter_note: "" },
];
