// Canonical team / athlete gender display map.
//
// The DB stores gender lowercase and unaccented ("masculin" / "feminin" /
// "mixte"); some imported RSEQ sources use already-accented forms or "M"/"F".
// genderLabel() renders the accented French form; unknown values (e.g.
// "Les deux") pass through unchanged. Shared so every surface — admin
// Équipes tab, onboarding team pickers — renders gender identically.

export const GENDER_DISPLAY: Record<string, string> = {
  masculin: "Masculin",
  feminin: "Féminin",
  "féminin": "Féminin",
  mixte: "Mixte",
  m: "Masculin",
  f: "Féminin",
  h: "Masculin",
};

export function genderLabel(g: string | null | undefined): string {
  if (!g) return "—";
  return GENDER_DISPLAY[g.toLowerCase()] ?? g;
}

// Options du filtre « Genre d'équipe » des recherches athlète (recruteur + coach).
// Les `value` sont les formes canoniques stockées dans teams.gender, telles que
// GENDER_DISPLAY les normalise — l'égalité du filtre se fait donc sur la valeur
// normalisée, jamais sur la chaîne brute de la DB.
//
// NB : c'est le genre de l'ÉQUIPE, pas athletes.genre (colonne à moitié vide et
// encodée de deux façons — voir le diagnostic genre du 14/07/2026).
export const TEAM_GENDER_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "Masculin", label: "Masculin" },
  { value: "Féminin", label: "Féminin" },
  { value: "Mixte", label: "Mixte" },
];

/** Ramène une valeur brute de teams.gender à sa forme canonique
 *  ("Masculin" | "Féminin" | "Mixte"). Prod et local ne contiennent aujourd'hui
 *  que ces trois formes, mais le commentaire en tête de ce fichier documente que
 *  des imports RSEQ peuvent écrire "masculin" / "M" / "f" : sans normalisation,
 *  l'égalité stricte du filtre raterait ces lignes en silence. */
export function normalizeTeamGender(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return GENDER_DISPLAY[raw.toLowerCase()] ?? raw;
}

/** Genre d'équipe d'un athlète, lu depuis l'embed `team_athletes(teams!team_id(gender))`.
 *
 *  team_athletes est une jointure 1-N : un athlète PEUT appartenir à plusieurs
 *  équipes. On retient le genre de la 1re équipe qui en déclare un. Aucun athlète
 *  n'est aujourd'hui dans 2 équipes (prod ET local), donc le cas ne se pose pas —
 *  mais si ça change, un athlète Masculin+Mixte ne matchera que "Masculin".
 *
 *  Renvoie null si l'athlète n'a AUCUNE équipe — ce qui est le cas de la très
 *  grande majorité des athlètes (2/11 rattachés en prod). Ils sortent donc des
 *  résultats dès qu'un genre est sélectionné. */
export function firstTeamGender(rel: unknown): string | null {
  if (!Array.isArray(rel)) return null;
  for (const link of rel) {
    const t = (link as Record<string, unknown>)?.teams;
    const team = Array.isArray(t) ? t[0] : t;
    const g = normalizeTeamGender((team as Record<string, unknown> | null)?.gender);
    if (g) return g;
  }
  return null;
}
