/* ─────────────────────────────────────────────────────────────────
   Mock Kanban Pipeline Data — 35 athletes across 7 columns
   Recruiter: Pierre Dufour, CÉGEP Garneau
───────────────────────────────────────────────────────────────── */

import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";

export interface PipelineKanbanCard {
  id: string;
  pipeline_id: string;          // recruiter_pipeline.id
  full_name: string;
  photo_url: string;
  sport: string;
  position: string;
  school: string;
  region: string;
  division: "D1" | "D2" | "D3";
  graduation_year: number;
  coach_rating: number;
  profile_completeness: number;
  is_verified: boolean;
  has_video: boolean;
  jersey: string;
  status: RecruitmentStatus;
  days_in_status: number;
  notes: string;
  last_activity: string;
  flagged: boolean;
  next_action_at: string | null;
  next_action_note: string | null;
  moved_at: string | null;
}

export const KANBAN_COLUMNS: {
  id: RecruitmentStatus;
  label: string;
  color: string;
  phase: "auto" | "commitment" | "exit";
  isAuto: boolean;
}[] = [
  { id: "identifie",        label: "Identifié",           color: "#6B7280", phase: "auto",       isAuto: true },
  { id: "contacte",         label: "Contacté",            color: "#6B7280", phase: "auto",       isAuto: true },
  { id: "en_discussion",    label: "En discussion",       color: "#E63946", phase: "commitment", isAuto: false },
  { id: "visite_planifiee", label: "Visite planifiée",    color: "#E63946", phase: "commitment", isAuto: false },
  { id: "engage",           label: "Engagé",              color: "#E63946", phase: "commitment", isAuto: false },
  { id: "lettre_signee",    label: "Lettre signée",       color: "#E63946", phase: "commitment", isAuto: false },
  { id: "retire",           label: "Retiré",              color: "#6B7280", phase: "exit",       isAuto: false },
];

export const MOCK_KANBAN: PipelineKanbanCard[] = [
  /* ── IDENTIFIÉ (12) ─────────────────────────────────────────── */
  { id: "k-001", photo_url: "", region: "", full_name: "Alexis Bouchard",       sport: "Football",   position: "RB",  school: "É.S. Roger-Comtois",      division: "D1", graduation_year: 2027, coach_rating: 3, profile_completeness: 72, is_verified: true,  has_video: true, jersey: "",  status: "identifie", days_in_status: 5,  notes: "",                                                          last_activity: "Ajouté aux favoris il y a 5 jours", pipeline_id: "k-001", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-002", photo_url: "", region: "", full_name: "Raphaël Bergeron",      sport: "Football",   position: "DL",  school: "É.S. les Etchemins",      division: "D1", graduation_year: 2027, coach_rating: 2, profile_completeness: 45, is_verified: false, has_video: false, jersey: "", status: "identifie", days_in_status: 3,  notes: "",                                                          last_activity: "Ajouté aux favoris il y a 3 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-003", photo_url: "", region: "", full_name: "Samuel Côté",           sport: "Football",   position: "OL",  school: "É.S. Roger-Comtois",      division: "D1", graduation_year: 2026, coach_rating: 3, profile_completeness: 68, is_verified: true,  has_video: false, jersey: "", status: "identifie", days_in_status: 2,  notes: "Capitaine de son équipe",                                   last_activity: "Ajouté aux favoris il y a 2 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-004", photo_url: "", region: "", full_name: "Antoine Mercier",       sport: "Basketball", position: "PG",  school: "É.S. de la Seigneurie",   division: "D2", graduation_year: 2026, coach_rating: 4, profile_completeness: 81, is_verified: true,  has_video: true, jersey: "",  status: "identifie", days_in_status: 7,  notes: "",                                                          last_activity: "Ajouté aux favoris il y a 7 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-005", photo_url: "", region: "", full_name: "Gabriel Fortin",        sport: "Hockey",     position: "C",   school: "É.S. Mont-Saint-Sacrement", division: "D1", graduation_year: 2027, coach_rating: 4, profile_completeness: 76, is_verified: true,  has_video: true, jersey: "",  status: "identifie", days_in_status: 1,  notes: "",                                                          last_activity: "Ajouté aux favoris il y a 1 jour", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-006", photo_url: "", region: "", full_name: "William Ouellet",       sport: "Football",   position: "WR",  school: "É.S. de Rochebelle",      division: "D1", graduation_year: 2026, coach_rating: 3, profile_completeness: 55, is_verified: false, has_video: true, jersey: "",  status: "identifie", days_in_status: 12, notes: "",                                                          last_activity: "Ajouté aux favoris il y a 12 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-007", photo_url: "", region: "", full_name: "Émile Gagnon",          sport: "Soccer",     position: "MF",  school: "É.S. Joseph-François-Perrault", division: "D2", graduation_year: 2026, coach_rating: 3, profile_completeness: 63, is_verified: true, has_video: false, jersey: "", status: "identifie", days_in_status: 18, notes: "",                                                          last_activity: "Ajouté aux favoris il y a 18 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-008", photo_url: "", region: "", full_name: "Noah Tremblay",         sport: "Football",   position: "S",   school: "É.S. De Mortagne",        division: "D1", graduation_year: 2027, coach_rating: 2, profile_completeness: 41, is_verified: false, has_video: false, jersey: "", status: "identifie", days_in_status: 9,  notes: "",                                                          last_activity: "Ajouté aux favoris il y a 9 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-009", photo_url: "", region: "", full_name: "Loïc Pelletier",        sport: "Basketball", position: "SG",  school: "É.S. Saint-Jean-Eudes",   division: "D1", graduation_year: 2026, coach_rating: 4, profile_completeness: 88, is_verified: true,  has_video: true, jersey: "",  status: "identifie", days_in_status: 4,  notes: "Recommandé par Coach Bergeron",                             last_activity: "Ajouté aux favoris il y a 4 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-010", photo_url: "", region: "", full_name: "Justin Lavoie",         sport: "Hockey",     position: "RW",  school: "É.S. les Etchemins",      division: "D2", graduation_year: 2027, coach_rating: 3, profile_completeness: 52, is_verified: false, has_video: true, jersey: "",  status: "identifie", days_in_status: 6,  notes: "",                                                          last_activity: "Ajouté aux favoris il y a 6 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-011", photo_url: "", region: "", full_name: "Mathieu Bélanger",      sport: "Football",   position: "CB",  school: "É.S. de Rochebelle",      division: "D1", graduation_year: 2026, coach_rating: 3, profile_completeness: 70, is_verified: true,  has_video: false, jersey: "", status: "identifie", days_in_status: 32, notes: "",                                                          last_activity: "Ajouté aux favoris il y a 32 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-012", photo_url: "", region: "", full_name: "Victor Dubois",         sport: "Soccer",     position: "GK",  school: "É.S. Roger-Comtois",      division: "D3", graduation_year: 2027, coach_rating: 2, profile_completeness: 38, is_verified: false, has_video: false, jersey: "", status: "identifie", days_in_status: 15, notes: "",                                                          last_activity: "Ajouté aux favoris il y a 15 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },

  /* ── CONTACTÉ (8) ───────────────────────────────────────────── */
  { id: "k-013", photo_url: "", region: "", full_name: "William Pelletier",     sport: "Football",   position: "CB",  school: "É.S. les Etchemins",      division: "D1", graduation_year: 2026, coach_rating: 4, profile_completeness: 82, is_verified: true,  has_video: true, jersey: "",  status: "contacte",  days_in_status: 3,  notes: "Premier contact envoyé au coach Gagnon",                    last_activity: "Message envoyé il y a 3 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-014", photo_url: "", region: "", full_name: "Mathis Dufresne",       sport: "Football",   position: "LB",  school: "É.S. de Rochebelle",      division: "D1", graduation_year: 2027, coach_rating: 3, profile_completeness: 65, is_verified: true,  has_video: true, jersey: "",  status: "contacte",  days_in_status: 1,  notes: "",                                                          last_activity: "Message envoyé il y a 1 jour", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-015", photo_url: "", region: "", full_name: "Charles Morin",         sport: "Basketball", position: "SF",  school: "É.S. de la Seigneurie",   division: "D2", graduation_year: 2026, coach_rating: 4, profile_completeness: 78, is_verified: true,  has_video: true, jersey: "",  status: "contacte",  days_in_status: 5,  notes: "Très bon dossier académique",                               last_activity: "Message envoyé il y a 5 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-016", photo_url: "", region: "", full_name: "Étienne Simard",        sport: "Hockey",     position: "D",   school: "É.S. Mont-Saint-Sacrement", division: "D1", graduation_year: 2026, coach_rating: 3, profile_completeness: 71, is_verified: true,  has_video: true, jersey: "",  status: "contacte",  days_in_status: 8,  notes: "",                                                          last_activity: "Message envoyé il y a 8 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-017", photo_url: "", region: "", full_name: "Adam Rioux",            sport: "Football",   position: "TE",  school: "É.S. Saint-Jean-Eudes",   division: "D1", graduation_year: 2026, coach_rating: 4, profile_completeness: 85, is_verified: true,  has_video: true, jersey: "",  status: "contacte",  days_in_status: 16, notes: "Relancer le coach — pas de réponse encore",                  last_activity: "Message envoyé il y a 16 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-018", photo_url: "", region: "", full_name: "Félix-Antoine Roy",     sport: "Soccer",     position: "ST",  school: "É.S. Joseph-François-Perrault", division: "D2", graduation_year: 2027, coach_rating: 3, profile_completeness: 60, is_verified: true, has_video: false, jersey: "", status: "contacte",  days_in_status: 2,  notes: "",                                                          last_activity: "Message envoyé il y a 2 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-019", photo_url: "", region: "", full_name: "Zachary Thibault",      sport: "Football",   position: "K",   school: "É.S. De Mortagne",        division: "D1", graduation_year: 2026, coach_rating: 3, profile_completeness: 58, is_verified: false, has_video: false, jersey: "", status: "contacte",  days_in_status: 11, notes: "",                                                          last_activity: "Message envoyé il y a 11 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-020", photo_url: "", region: "", full_name: "Alexandre Lessard",     sport: "Hockey",     position: "LW",  school: "É.S. les Etchemins",      division: "D2", graduation_year: 2027, coach_rating: 4, profile_completeness: 74, is_verified: true,  has_video: true, jersey: "",  status: "contacte",  days_in_status: 4,  notes: "À surveiller pour le combine de mars",                      last_activity: "Message envoyé il y a 4 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },

  /* ── EN DISCUSSION (5) ──────────────────────────────────────── */
  { id: "k-021", photo_url: "", region: "", full_name: "Jérémy Lavoie",         sport: "Football",   position: "WR",  school: "É.S. Saint-Jean-Eudes",   division: "D1", graduation_year: 2026, coach_rating: 4, profile_completeness: 90, is_verified: true,  has_video: true, jersey: "",  status: "en_discussion", days_in_status: 2,  notes: "Excellent QI football. À surveiller pour le combine de mars.", last_activity: "Coach a répondu il y a 2 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-022", photo_url: "", region: "", full_name: "Félix Gagnon-Roy",      sport: "Football",   position: "LB",  school: "É.S. Saint-Jean-Eudes",   division: "D1", graduation_year: 2026, coach_rating: 4, profile_completeness: 84, is_verified: true,  has_video: true, jersey: "",  status: "en_discussion", days_in_status: 1,  notes: "Le coach dit qu'il hésite entre nous et Garneau.",          last_activity: "Coach a répondu il y a 1 jour", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-023", photo_url: "", region: "", full_name: "Benjamin Caron",        sport: "Basketball", position: "PF",  school: "É.S. de la Seigneurie",   division: "D2", graduation_year: 2026, coach_rating: 5, profile_completeness: 92, is_verified: true,  has_video: true, jersey: "",  status: "en_discussion", days_in_status: 6,  notes: "Très intéressé par notre programme sport-études",           last_activity: "Coach a répondu il y a 6 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-024", photo_url: "", region: "", full_name: "Nathan Girard",         sport: "Hockey",     position: "C",   school: "É.S. Mont-Saint-Sacrement", division: "D1", graduation_year: 2026, coach_rating: 4, profile_completeness: 79, is_verified: true,  has_video: true, jersey: "",  status: "en_discussion", days_in_status: 10, notes: "Le père veut visiter le campus avant de décider",           last_activity: "Coach a répondu il y a 10 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-025", photo_url: "", region: "", full_name: "Jacob Plante",          sport: "Football",   position: "QB",  school: "É.S. de Rochebelle",      division: "D1", graduation_year: 2026, coach_rating: 3, profile_completeness: 75, is_verified: true,  has_video: true, jersey: "",  status: "en_discussion", days_in_status: 20, notes: "Attente d'une décision depuis 3 semaines",                  last_activity: "Coach a répondu il y a 20 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },

  /* ── VISITE PLANIFIÉE (3) ───────────────────────────────────── */
  { id: "k-026", photo_url: "", region: "", full_name: "Xavier Lapointe",       sport: "Football",   position: "RB",  school: "É.S. De Mortagne",        division: "D1", graduation_year: 2026, coach_rating: 3, profile_completeness: 86, is_verified: true,  has_video: true, jersey: "",  status: "visite_planifiee", days_in_status: 2,  notes: "Visite prévue le 22 mars — préparer le tour du campus",     last_activity: "Visite confirmée il y a 2 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-027", photo_url: "", region: "", full_name: "Marc-Antoine Tremblay", sport: "Football",   position: "QB",  school: "É.S. Saint-Jean-Eudes",   division: "D1", graduation_year: 2026, coach_rating: 5, profile_completeness: 95, is_verified: true,  has_video: true, jersey: "",  status: "visite_planifiee", days_in_status: 1,  notes: "TOP prospect — priorité absolue",                           last_activity: "Visite confirmée il y a 1 jour", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-028", photo_url: "", region: "", full_name: "Maxime Hébert",         sport: "Basketball", position: "C",   school: "É.S. de la Seigneurie",   division: "D2", graduation_year: 2026, coach_rating: 4, profile_completeness: 83, is_verified: true,  has_video: true, jersey: "",  status: "visite_planifiee", days_in_status: 5,  notes: "Intéressé par le programme de sciences de la nature",       last_activity: "Visite confirmée il y a 5 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },

  /* ── ENGAGÉ (2) ─────────────────────────────────────────────── */
  { id: "k-029", photo_url: "", region: "", full_name: "Olivier Nadeau",        sport: "Football",   position: "QB",  school: "É.S. De Mortagne",        division: "D1", graduation_year: 2026, coach_rating: 4, profile_completeness: 91, is_verified: true,  has_video: true, jersey: "",  status: "engage", days_in_status: 5,  notes: "Engagement verbal confirmé — en attente de la lettre",      last_activity: "Engagement verbal il y a 5 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-030", photo_url: "", region: "", full_name: "Philippe Lachance",     sport: "Hockey",     position: "G",   school: "É.S. Mont-Saint-Sacrement", division: "D1", graduation_year: 2026, coach_rating: 4, profile_completeness: 87, is_verified: true,  has_video: true, jersey: "",  status: "engage", days_in_status: 3,  notes: "Excellent gardien — rencontre avec les parents la semaine prochaine", last_activity: "Engagement verbal il y a 3 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },

  /* ── LETTRE SIGNÉE (1) ──────────────────────────────────────── */
  { id: "k-031", photo_url: "", region: "", full_name: "Thomas Carrier-Brault", sport: "Football",   position: "TE",  school: "É.S. Saint-Jean-Eudes",   division: "D1", graduation_year: 2026, coach_rating: 4, profile_completeness: 96, is_verified: true,  has_video: true, jersey: "",  status: "lettre_signee", days_in_status: 10, notes: "Lettre signée le 28 février — bienvenue au programme!",      last_activity: "Lettre signée il y a 10 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },

  /* ── RETIRÉ (4) ─────────────────────────────────────────────── */
  { id: "k-032", photo_url: "", region: "", full_name: "Noah Simard",           sport: "Football",   position: "WR",  school: "É.S. De Mortagne",        division: "D1", graduation_year: 2026, coach_rating: 3, profile_completeness: 69, is_verified: true,  has_video: true, jersey: "",  status: "retire", days_in_status: 4,  notes: "Engagé au CÉGEP du Vieux Montréal",                         last_activity: "Retiré il y a 4 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-033", photo_url: "", region: "", full_name: "Léo Bédard",            sport: "Soccer",     position: "CB",  school: "É.S. Joseph-François-Perrault", division: "D2", graduation_year: 2026, coach_rating: 2, profile_completeness: 48, is_verified: false, has_video: false, jersey: "", status: "retire", days_in_status: 12, notes: "Pas de réponse du coach après 3 relances",                  last_activity: "Retiré il y a 12 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-034", photo_url: "", region: "", full_name: "Arnaud Cloutier",       sport: "Football",   position: "OL",  school: "É.S. de Rochebelle",      division: "D1", graduation_year: 2027, coach_rating: 3, profile_completeness: 55, is_verified: false, has_video: false, jersey: "", status: "retire", days_in_status: 8,  notes: "Ne correspond pas à nos besoins cette saison",              last_activity: "Retiré il y a 8 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
  { id: "k-035", photo_url: "", region: "", full_name: "Elliot Martel",         sport: "Hockey",     position: "D",   school: "É.S. les Etchemins",      division: "D2", graduation_year: 2026, coach_rating: 3, profile_completeness: 61, is_verified: true,  has_video: true, jersey: "",  status: "retire", days_in_status: 21, notes: "L'athlète a choisi un programme en Ontario",                last_activity: "Retiré il y a 21 jours", pipeline_id: "", flagged: false, next_action_at: null, next_action_note: null, moved_at: null },
];

/* ── Helpers ─────────────────────────────────────────────────── */

export function getCardsBySport(sport: string): PipelineKanbanCard[] {
  if (!sport) return MOCK_KANBAN;
  return MOCK_KANBAN.filter((c) => c.sport === sport);
}

export function getCardsByStatus(cards: PipelineKanbanCard[], status: RecruitmentStatus): PipelineKanbanCard[] {
  return cards.filter((c) => c.status === status);
}

export const PIPELINE_SPORTS = ["Football", "Basketball", "Hockey", "Soccer"];
