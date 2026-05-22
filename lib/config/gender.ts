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
