/* ─────────────────────────────────────────────────────────────────
   Coach Suggestions Queue — Athlete profile change requests
───────────────────────────────────────────────────────────────── */

export interface CoachSuggestion {
  id: string;
  athlete_id: string;
  athlete_name: string;
  athlete_sport: string;
  athlete_verified: boolean;
  field: string;
  current_value: string | null;
  proposed_value: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export const COACH_SUGGESTIONS: CoachSuggestion[] = [
  // Pending (4)
  { id: "cs1", athlete_id: "ath-001", athlete_name: "Marc-Antoine Tremblay", athlete_sport: "Football", athlete_verified: true, field: "Taille", current_value: "6'2\"", proposed_value: "6'3\"", message: "J'ai grandi de 2 pouces cet été", status: "pending", submitted_at: "2026-03-15T10:30:00" },
  { id: "cs2", athlete_id: "ath-001", athlete_name: "Marc-Antoine Tremblay", athlete_sport: "Football", athlete_verified: true, field: "Moyenne générale", current_value: "82%", proposed_value: "85%", message: "Mon bulletin de janvier est sorti", status: "pending", submitted_at: "2026-03-14T14:15:00" },
  { id: "cs3", athlete_id: "ath-001", athlete_name: "Marc-Antoine Tremblay", athlete_sport: "Football", athlete_verified: true, field: "Distinction", current_value: null, proposed_value: "MVP de la ligue", message: "Gagnant du trophée MVP saison 2025-2026", status: "pending", submitted_at: "2026-03-12T09:00:00" },
  { id: "cs4", athlete_id: "ath-002", athlete_name: "Samuel Bouchard", athlete_sport: "Hockey", athlete_verified: true, field: "Poids", current_value: "175 lbs", proposed_value: "182 lbs", message: "J'ai pris du muscle cet hiver", status: "pending", submitted_at: "2026-03-16T11:00:00" },

  // Approved (3)
  { id: "cs5", athlete_id: "ath-001", athlete_name: "Marc-Antoine Tremblay", athlete_sport: "Football", athlete_verified: true, field: "Vidéo highlights", current_value: "https://youtube.com/old", proposed_value: "https://youtube.com/new-highlights-2026", message: "Nouvelle vidéo de la saison", status: "approved", submitted_at: "2026-03-08T16:00:00", reviewed_at: "2026-03-09T09:30:00" },
  { id: "cs6", athlete_id: "ath-003", athlete_name: "Émilie Gagnon", athlete_sport: "Basketball", athlete_verified: false, field: "Instagram", current_value: null, proposed_value: "@emilie.hoops", message: null, status: "approved", submitted_at: "2026-03-06T14:00:00", reviewed_at: "2026-03-06T15:00:00" },
  { id: "cs7", athlete_id: "ath-002", athlete_name: "Samuel Bouchard", athlete_sport: "Hockey", athlete_verified: true, field: "Langues", current_value: "Français", proposed_value: "Français, Anglais", message: "J'ai suivi des cours d'anglais intensifs", status: "approved", submitted_at: "2026-03-04T10:00:00", reviewed_at: "2026-03-05T08:00:00" },

  // Rejected (2)
  { id: "cs8", athlete_id: "ath-001", athlete_name: "Marc-Antoine Tremblay", athlete_sport: "Football", athlete_verified: true, field: "Position", current_value: "QB", proposed_value: "RB", message: "Je veux aussi jouer RB", status: "rejected", submitted_at: "2026-03-05T08:45:00", reviewed_at: "2026-03-06T10:00:00", rejection_reason: "Tu joues QB, on garde QB. On peut ajouter RB comme position secondaire si tu veux." },
  { id: "cs9", athlete_id: "ath-003", athlete_name: "Émilie Gagnon", athlete_sport: "Basketball", athlete_verified: false, field: "Stats clés", current_value: "12.5 PPG, 4.2 APG", proposed_value: "18.5 PPG, 7.2 APG", message: "Mes stats du dernier tournoi", status: "rejected", submitted_at: "2026-03-02T11:00:00", reviewed_at: "2026-03-03T09:00:00", rejection_reason: "Les stats officielles de la ligue montrent 12.5 PPG. On met les stats de saison, pas d'un seul tournoi." },
];
