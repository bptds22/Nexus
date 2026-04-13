/* ─────────────────────────────────────────────────────────────────
   Profile completion — richer per-section calculator.
   Weights sum to exactly 100. Sections map to DOM ids on the
   athlete/coach/recruiter profile pages for scroll-to-section.
───────────────────────────────────────────────────────────────── */

export type CompletionSection =
  | "identity"
  | "physical"
  | "sport"
  | "academic"
  | "evaluation"
  | "media";

/** Who can actually fill this field. Athletes only see suggestions for
 *  items they can act on ('athlete' or 'both'). Coaches see everything. */
export type CompletionRole = "athlete" | "coach" | "both";

export interface AthleteLike {
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
  date_naissance?: string | null;
  genre?: string | null;
  telephone?: string | null;
  school_id?: string | null;
  league_team_id?: string | null;
  equipe_id?: string | null;
  annee_diplomation?: number | null;
  sport_id?: string | null;
  position_id?: string | null;
  numero_jersey?: string | null;
  taille_pieds?: number | null;
  taille_pouces?: number | null;
  poids_lbs?: number | string | null;
  main_dominante?: string | null;
  pied_dominant?: string | null;
  video_faits_saillants_url?: string | null;
  video_match_complet_url?: string | null;
  video_entrainement_url?: string | null;
  hudl_url?: string | null;
  youtube_url?: string | null;
  instagram_url?: string | null;
  moyenne_generale?: number | string | null;
  programme_cegep_vise?: unknown;
  matieres_fortes?: unknown;
  regions_cegep_preferees?: unknown;
  cote_globale_entraineur?: number | string | null;
  [key: string]: unknown;
}

export interface EvalLike {
  cote_globale?: number | string | null;
  rapport_entraineur?: string | null;
  distinctions?: unknown;
  [key: string]: unknown;
}

export interface TeamLike {
  id?: string | null;
}

export interface CompletionCheck {
  key: string;
  label: string;
  weight: number;
  section: CompletionSection;
  role: CompletionRole;
  check: (a: AthleteLike, e: EvalLike | null, t: TeamLike | null) => boolean;
}

const nonEmptyArr = (v: unknown) => Array.isArray(v) && v.length > 0;
const nonEmptyStr = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const numPos = (v: unknown) => {
  if (v == null) return false;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0;
};

export const COMPLETION_CHECKS: CompletionCheck[] = [
  // IDENTITY — 16
  { key: "photo", label: "Photo de profil", weight: 5, section: "identity", role: "athlete",
    check: (a) => nonEmptyStr(a.photo_url) },
  { key: "date_naissance", label: "Date de naissance", weight: 3, section: "identity", role: "athlete",
    check: (a) => nonEmptyStr(a.date_naissance) },
  { key: "genre", label: "Genre", weight: 2, section: "identity", role: "athlete",
    check: (a) => nonEmptyStr(a.genre) },
  { key: "promotion", label: "Année de graduation", weight: 3, section: "identity", role: "athlete",
    check: (a) => numPos(a.annee_diplomation) },
  { key: "telephone", label: "Téléphone", weight: 3, section: "identity", role: "athlete",
    check: (a) => nonEmptyStr(a.telephone) },

  // PHYSICAL — 14
  { key: "height", label: "Taille", weight: 5, section: "physical", role: "athlete",
    check: (a) => numPos(a.taille_pieds) && (numPos(a.taille_pouces) || a.taille_pouces === 0) },
  { key: "weight", label: "Poids", weight: 5, section: "physical", role: "athlete",
    check: (a) => numPos(a.poids_lbs) },
  { key: "main_dominante", label: "Main dominante", weight: 2, section: "physical", role: "athlete",
    check: (a) => nonEmptyStr(a.main_dominante) },
  { key: "pied_dominant", label: "Pied dominant", weight: 2, section: "physical", role: "athlete",
    check: (a) => nonEmptyStr(a.pied_dominant) },

  // SPORT — 17
  { key: "sport_id", label: "Sport principal", weight: 5, section: "sport", role: "both",
    check: (a) => nonEmptyStr(a.sport_id) },
  { key: "position_id", label: "Position principale", weight: 5, section: "sport", role: "both",
    check: (a) => nonEmptyStr(a.position_id) },
  { key: "numero_jersey", label: "Numéro de chandail", weight: 3, section: "sport", role: "both",
    check: (a) => nonEmptyStr(a.numero_jersey) },
  { key: "team", label: "Équipe / ligue", weight: 4, section: "sport", role: "coach",
    check: (a, _e, t) =>
      !!(t && t.id) || nonEmptyStr(a.league_team_id) || nonEmptyStr(a.equipe_id) },

  // ACADEMIC — 13
  { key: "moyenne", label: "Moyenne générale", weight: 5, section: "academic", role: "athlete",
    check: (a) => numPos(a.moyenne_generale) },
  { key: "programme_cegep", label: "Programme CÉGEP visé", weight: 3, section: "academic", role: "athlete",
    check: (a) => nonEmptyArr(a.programme_cegep_vise) },
  { key: "matieres_fortes", label: "Matières fortes", weight: 2, section: "academic", role: "athlete",
    check: (a) => nonEmptyArr(a.matieres_fortes) },
  { key: "regions_cegep", label: "Régions CÉGEP préférées", weight: 3, section: "academic", role: "athlete",
    check: (a) => nonEmptyArr(a.regions_cegep_preferees) },

  // EVALUATION — 18
  { key: "cote_globale", label: "Cote globale (évaluation coach)", weight: 8, section: "evaluation", role: "coach",
    check: (a, e) => numPos(e?.cote_globale) || numPos(a.cote_globale_entraineur) },
  { key: "rapport", label: "Rapport de l'entraîneur", weight: 5, section: "evaluation", role: "coach",
    check: (_a, e) => nonEmptyStr(e?.rapport_entraineur) },
  { key: "distinctions", label: "Distinctions", weight: 5, section: "evaluation", role: "coach",
    check: (_a, e) => nonEmptyArr(e?.distinctions) },

  // MEDIA — 22
  { key: "highlight", label: "Vidéo faits saillants", weight: 8, section: "media", role: "athlete",
    check: (a) => nonEmptyStr(a.video_faits_saillants_url) },
  { key: "video_match", label: "Vidéo match complet", weight: 5, section: "media", role: "athlete",
    check: (a) => nonEmptyStr(a.video_match_complet_url) },
  { key: "video_entrainement", label: "Vidéo d'entraînement", weight: 3, section: "media", role: "athlete",
    check: (a) => nonEmptyStr(a.video_entrainement_url) },
  { key: "hudl", label: "Lien Hudl", weight: 2, section: "media", role: "athlete",
    check: (a) => nonEmptyStr(a.hudl_url) },
  { key: "youtube", label: "Lien YouTube", weight: 2, section: "media", role: "athlete",
    check: (a) => nonEmptyStr(a.youtube_url) },
  { key: "instagram", label: "Lien Instagram", weight: 2, section: "media", role: "athlete",
    check: (a) => nonEmptyStr(a.instagram_url) },
];

// Sanity: 16 + 14 + 17 + 13 + 18 + 22 = 100.

export interface CompletionResult {
  percentage: number;
  missing: { key: string; label: string; weight: number; section: CompletionSection; role: CompletionRole }[];
  checks: { key: string; label: string; weight: number; section: CompletionSection; role: CompletionRole; filled: boolean }[];
}

export function calculateCompletion(
  athlete: AthleteLike | null | undefined,
  evaluation: EvalLike | null | undefined,
  team: TeamLike | null | undefined,
): CompletionResult {
  if (!athlete) {
    return { percentage: 0, missing: [], checks: [] };
  }
  const e = evaluation ?? null;
  const t = team ?? null;

  let earned = 0;
  const checks = COMPLETION_CHECKS.map((c) => {
    const filled = !!c.check(athlete, e, t);
    if (filled) earned += c.weight;
    return { key: c.key, label: c.label, weight: c.weight, section: c.section, role: c.role, filled };
  });

  const missing = checks
    .filter((c) => !c.filled)
    .map(({ key, label, weight, section, role }) => ({ key, label, weight, section, role }))
    .sort((a, b) => b.weight - a.weight);

  return { percentage: Math.round(earned), missing, checks };
}

/** Same percentage (uses all checks) but the `missing` list is filtered to
 *  items actionable by the given role. Athletes see only items they can fill;
 *  coaches see everything. */
export function calculateCompletionForRole(
  athlete: AthleteLike | null | undefined,
  evaluation: EvalLike | null | undefined,
  team: TeamLike | null | undefined,
  role: CompletionRole,
): CompletionResult {
  const result = calculateCompletion(athlete, evaluation, team);
  if (role === "coach") return result;
  const filtered = result.missing.filter((m) => m.role === role || m.role === "both");
  return { ...result, missing: filtered };
}

/** Stable DOM id per section — pages expose these on their section wrappers. */
export const SECTION_IDS: Record<CompletionSection, string> = {
  identity: "section-identity",
  physical: "section-physical",
  sport: "section-sport",
  academic: "section-academic",
  evaluation: "section-evaluation",
  media: "section-media",
};
