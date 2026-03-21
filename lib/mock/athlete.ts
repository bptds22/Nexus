/* ─────────────────────────────────────────────────────────────────
   Athlete Portal — Mock Data (POC)
   Marc-Antoine Tremblay, QB, É.S. Saint-Jean-Eudes
───────────────────────────────────────────────────────────────── */

export const athleteUser = {
  id: "ath-001",
  firstName: "Marc-Antoine",
  lastName: "Tremblay",
  email: "marc-antoine@gmail.com",
  school: "É.S. Saint-Jean-Eudes",
  city: "Québec",
  sport: "Football",
  position: "QB",
  division: "D1",
  graduation_year: 2026,
  is_verified: true,
  profile_completeness: 78,
  coach_name: "Coach Bergeron",
  parental_consent: { given: true, date: "2025-09-15" },
};

export const athleteStats = {
  views_this_month: 34,
  views_last_month: 25,
  views_total: 156,
  unique_recruiters_viewed: 12,
  favorites_count: 3,
  profile_completeness: 78,
  views_weekly: [8, 12, 15, 10, 22, 18, 25, 34],
  recruiter_regions: [
    { region: "Capitale-Nationale", count: 2 },
    { region: "Montréal", count: 1 },
  ],
  profile_rank_sport: "top_30",
};

export interface AthleteActivityItem {
  id: string;
  type: "profile_viewed" | "new_favorite" | "coach_update" | "suggestion_approved" | "suggestion_rejected" | "milestone" | "completion_reminder";
  message: string;
  time: string;
  read: boolean;
}

export const athleteActivity: AthleteActivityItem[] = [
  { id: "1", type: "profile_viewed", message: "Un recruteur de la région Capitale-Nationale a consulté ton profil", time: "Il y a 2h", read: false },
  { id: "2", type: "new_favorite", message: "Un recruteur t'a ajouté à ses favoris", time: "Il y a 5h", read: false },
  { id: "3", type: "coach_update", message: "Ton coach a mis à jour ton rapport d'entraîneur", time: "Hier", read: true },
  { id: "4", type: "suggestion_approved", message: "Ton coach a approuvé ta suggestion : Vidéo highlights mise à jour", time: "Il y a 2 jours", read: true },
  { id: "5", type: "suggestion_rejected", message: "Ton coach a rejeté ta suggestion : Position QB → RB. Raison : \"Tu joues QB, on garde QB\"", time: "Il y a 3 jours", read: true },
  { id: "6", type: "milestone", message: "Félicitations! Ton profil a dépassé 150 vues au total!", time: "Il y a 5 jours", read: true },
  { id: "7", type: "completion_reminder", message: "Ton profil est à 78%. Ajoute une vidéo de match complet pour atteindre 86%!", time: "Il y a 1 semaine", read: true },
];

export interface AthleteSuggestion {
  id: string;
  field: string;
  current_value: string | null;
  proposed_value: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export const athleteSuggestions: AthleteSuggestion[] = [
  { id: "s1", field: "Taille", current_value: "6'2\"", proposed_value: "6'3\"", message: "J'ai grandi de 2 pouces cet été", status: "pending", submitted_at: "2026-03-15" },
  { id: "s2", field: "Moyenne générale", current_value: "82%", proposed_value: "85%", message: "Mon bulletin de janvier est sorti", status: "pending", submitted_at: "2026-03-14" },
  { id: "s3", field: "Distinction", current_value: null, proposed_value: "MVP de la ligue", message: "Gagnant du trophée MVP saison 2025-2026", status: "pending", submitted_at: "2026-03-12" },
  { id: "s4", field: "Vidéo highlights", current_value: "https://youtube.com/old", proposed_value: "https://youtube.com/new-highlights-2026", message: "Nouvelle vidéo de la saison", status: "approved", submitted_at: "2026-03-08", reviewed_at: "2026-03-09" },
  { id: "s5", field: "Position", current_value: "QB", proposed_value: "RB", message: "Je veux aussi jouer RB", status: "rejected", submitted_at: "2026-03-05", reviewed_at: "2026-03-06", rejection_reason: "Tu joues QB, on garde QB. On peut ajouter RB comme position secondaire si tu veux." },
];

export interface AthleteNotification {
  id: string;
  type: "profile_viewed" | "new_favorite" | "suggestion_approved" | "coach_update" | "suggestion_rejected" | "milestone" | "completion_reminder";
  message: string;
  time: string;
  read: boolean;
}

export const athleteNotifications: AthleteNotification[] = [
  { id: "n1", type: "profile_viewed", message: "Un recruteur de la région Capitale-Nationale a consulté ton profil", time: "2026-03-18T14:30:00", read: false },
  { id: "n2", type: "new_favorite", message: "Un recruteur t'a ajouté à ses favoris", time: "2026-03-18T09:15:00", read: false },
  { id: "n3", type: "suggestion_approved", message: "Ton coach a approuvé ta suggestion : Vidéo highlights mise à jour", time: "2026-03-17T16:00:00", read: false },
  { id: "n4", type: "coach_update", message: "Ton coach a mis à jour ton rapport d'entraîneur", time: "2026-03-16T11:20:00", read: true },
  { id: "n5", type: "suggestion_rejected", message: "Ton coach a rejeté ta suggestion : Position QB → RB", time: "2026-03-15T08:45:00", read: true },
  { id: "n6", type: "profile_viewed", message: "Un recruteur de la région Montréal a consulté ton profil", time: "2026-03-14T17:30:00", read: true },
  { id: "n7", type: "milestone", message: "Félicitations! Ton profil a dépassé 150 vues au total!", time: "2026-03-13T12:00:00", read: true },
  { id: "n8", type: "completion_reminder", message: "Ton profil est à 78%. Ajoute une vidéo de match complet pour atteindre 86%!", time: "2026-03-10T09:00:00", read: true },
];

/* ── Profile improvement checklist ───────────────────────────── */

export interface ProfileChecklistItem {
  label: string;
  boost: number;
  done: boolean;
  section?: string;
}

export const profileChecklist: ProfileChecklistItem[] = [
  { label: "Photo de profil", boost: 8, done: true },
  { label: "Identité complète", boost: 10, done: true },
  { label: "Profil physique", boost: 10, done: true },
  { label: "Sport et position", boost: 8, done: true },
  { label: "Évaluation coach", boost: 15, done: true, section: "coach" },
  { label: "Rapport entraîneur", boost: 12, done: true, section: "coach" },
  { label: "Vidéo de match complet", boost: 8, done: false, section: "media" },
  { label: "Médias et liens complets", boost: 7, done: false, section: "media" },
  { label: "Profil académique", boost: 10, done: true },
  { label: "Stats clés détaillées", boost: 12, done: false, section: "stats" },
];
