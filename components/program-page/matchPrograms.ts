// components/program-page/matchPrograms.ts
// Perfect-match S5 — resemblance (keyword/fuzzy) between the athlete's aimed
// program (viewerProgrammeVise) and the college's program list. NOT strict
// equality: shared significant tokens count as similar. Pure function, no data
// invented — operates only on the fixture program strings (Bloc 2: same shape).

export interface ProgramMatch {
  /** exact resemblance (same program) or null */
  exact: string | null;
  /** 0..n resembling programs (excludes exact), best overlap first */
  similaires: string[];
}

const STOP = new Set([
  "de", "des", "du", "la", "le", "les", "et", "en", "au", "aux", "a", "l", "d", "un", "une", "the",
]);

/** Accent-insensitive normaliser (shared with the S5 program search).
 *  NFD + strip combining diacritics + lowercase, puis non-alphanum → espace. */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (combining diacritics)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Resemblance match. Empty vise → no board (caller guards). */
export function matchPrograms(vise: string, programs: string[]): ProgramMatch {
  const nv = norm(vise);
  const viseTokens = new Set(tokens(vise));
  if (!nv || viseTokens.size === 0) return { exact: null, similaires: [] };

  let exact: string | null = null;
  const scored: { p: string; score: number }[] = [];

  for (const p of programs) {
    if (norm(p) === nv) {
      exact = p;
      continue;
    }
    const shared = tokens(p).filter((w) => viseTokens.has(w)).length;
    if (shared > 0) scored.push({ p, score: shared });
  }

  scored.sort((a, b) => b.score - a.score);

  // No exact string, but a program shares ALL aimed tokens → treat as exact.
  if (!exact && scored.length > 0 && scored[0].score === viseTokens.size) {
    exact = scored.shift()!.p;
  }

  return { exact, similaires: scored.map((s) => s.p).slice(0, 3) };
}
