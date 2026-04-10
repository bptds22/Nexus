/* ─────────────────────────────────────────────────────────────────
   Shared profile completion calculator — single source of truth.
   Used by athlete profile, coach views, recruiter views, and DB updates.
───────────────────────────────────────────────────────────────── */

interface WeightedField {
  key: string;
  weight: number;
  /** For arrays/JSONB — check length > 0 instead of just truthy */
  isArray?: boolean;
}

const PROFILE_FIELDS: WeightedField[] = [
  { key: "first_name", weight: 5 },
  { key: "last_name", weight: 5 },
  { key: "photo_url", weight: 10 },
  { key: "date_naissance", weight: 5 },
  { key: "genre", weight: 3 },
  { key: "school_id", weight: 5 },
  { key: "annee_diplomation", weight: 5 },
  { key: "sport_id", weight: 5 },
  { key: "position_id", weight: 5 },
  { key: "numero_jersey", weight: 3 },
  { key: "taille_pieds", weight: 5 },
  { key: "poids_lbs", weight: 5 },
  { key: "video_faits_saillants_url", weight: 8 },
  { key: "hudl_url", weight: 3 },
  { key: "youtube_url", weight: 3 },
  { key: "instagram_url", weight: 2 },
  { key: "moyenne_generale", weight: 5 },
  { key: "programme_cegep_vise", weight: 3, isArray: true },
  { key: "bio", weight: 4 },
  { key: "cote_globale_entraineur", weight: 5 },
  { key: "consentement_parental", weight: 3 },
];

const TOTAL_WEIGHT = PROFILE_FIELDS.reduce((sum, f) => sum + f.weight, 0);

/**
 * Calculate profile completion percentage from raw athlete DB row.
 * Returns 0-100.
 */
export function calculateProfileCompletion(athlete: Record<string, unknown>): number {
  if (!athlete) return 0;

  const completedWeight = PROFILE_FIELDS.reduce((sum, f) => {
    const value = athlete[f.key];
    let filled = false;

    if (f.isArray) {
      filled = Array.isArray(value) && value.length > 0;
    } else if (typeof value === "number") {
      filled = value > 0;
    } else if (typeof value === "boolean") {
      filled = value === true;
    } else {
      filled = value !== null && value !== undefined && value !== "";
    }

    return sum + (filled ? f.weight : 0);
  }, 0);

  return Math.round((completedWeight / TOTAL_WEIGHT) * 100);
}

/**
 * Get list of incomplete fields with their boost values for the sidebar widget.
 */
export function getIncompleteFields(athlete: Record<string, unknown>): { label: string; boost: number }[] {
  const labels: Record<string, string> = {
    photo_url: "Ajouter une photo",
    taille_pieds: "Ajouter ta taille",
    poids_lbs: "Ajouter ton poids",
    video_faits_saillants_url: "Ajouter une vidéo",
    moyenne_generale: "Ajouter ta moyenne",
    bio: "Ajouter une bio",
    date_naissance: "Ajouter ta date de naissance",
    position_id: "Ajouter ta position",
    numero_jersey: "Ajouter ton numéro",
    hudl_url: "Ajouter ton lien Hudl",
    youtube_url: "Ajouter ton lien YouTube",
    instagram_url: "Ajouter ton Instagram",
    programme_cegep_vise: "Ajouter ton programme CÉGEP",
    consentement_parental: "Confirmer le consentement parental",
  };

  return PROFILE_FIELDS
    .filter((f) => {
      const value = athlete[f.key];
      if (f.isArray) return !Array.isArray(value) || value.length === 0;
      if (typeof value === "number") return value <= 0;
      if (typeof value === "boolean") return value !== true;
      return !value;
    })
    .filter((f) => labels[f.key])
    .map((f) => ({ label: labels[f.key], boost: f.weight }));
}
