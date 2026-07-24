// components/program-wall/slots.ts
//
// The ProgramWall is a FROZEN 10×5 slot map (see ProgramWall.tsx for the fixed
// structure — the layout is NEVER modified per school). This file owns:
//   • the v2 data contract (SchoolProgramIdentity)
//   • the named auto-fit functions (rail / kraft-city / type-l2)
//   • the league/province swap helpers
//   • resolveWall(): SchoolProgramIdentity → the ~14 variable bindings the fixed
//     structure reads. Everything else on the wall is constant Nexus copy.
//
// NOTE: the v2 type lives here (not lib/types/models.ts, which is out of scope);
// the wall + mock import it from here.

import type { WallTheme } from "./theme";

/* ------------------------------------------------------------ data contract -- */

export interface SchoolProgramIdentity {
  id: string;
  /** CANONICAL (schools table) — not coach-editable. Drives type-block + menu. */
  schoolName: string;
  /** name-card hero mascot. */
  mascot: string;
  colorPrimary: string; // "Couleur principale"
  colorDarker: string; // "Couleur foncée"
  colorNeutral: string; // "Couleur claire"
  /** SVG recommended; null → monogram (initials) on cream card + menu chip. */
  logoUrl: string | null;
  city: string;
  /** REQUIRED — kraft banner (e.g. "AHUNTSIC · QC"). */
  regionTag: string;
  /** kraft big number; null → falls back estYear → initials. */
  areaCode: string | null;
  /** auto from schoolName, editable (Grasset = "AG"). Initials tile + monogram. */
  initials: string;
  /** ≤40 chars / 2 lines; null → slogan card becomes a pattern. */
  slogan: string | null;
  /** under-card ("LE NID") ≤12 chars; null → hidden. */
  nickname: string | null;
  /** ≤12 chars each; Nexus defaults. */
  customWords?: Partial<{
    boldWord: string;
    eliteWord: string;
    allezWord: string;
    ensembleWord: string;
  }>;
  /* -- v2 éditeur « Ma page » : 4 slots ADDITIFS, tous optionnels. Absents =>
     resolveWall retombe EXACTEMENT sur le comportement gelé d'avant (byte-
     identique). Ne jamais rendre requis — les mocks existants ne les fournissent
     pas et doivent rester inchangés. -- */
  /** mention sous le type-block (.l3) ; défaut "élite collégiale". */
  tagline?: string;
  /** mot du rail vertical ; défaut = shortName(schoolName). */
  railWordOverride?: string;
  /** devise kraft (2 mots) ; défaut "FIER" · "FORT" → "FIER · FORT". */
  deviseWords?: { first: string; second: string };
  /** phrase flèche kraft ; défaut "D'ICI" ➔ "POUR ICI". */
  arrowPhrase?: { before: string; after: string };
  /** AUTO — swaps league logo, fleur↔maple, QUÉBEC↔CANADA accent. */
  league: "RSEQ" | "USPORTS";
  /** AUTO — provinceMotifFor(): 'QC'→fleur (only one implemented). */
  province: string;
  /** AUTO from teams table — never asked. */
  division: string;
}

/* ------------------------------------------------------------- fit functions -- */
// Reverse-engineered from the reference's 3 data points, encoded as named rules.
// (rail 65/len, kraft min(2.9,27/len), type-l2 min(2.5,26/maxLineLen)).

/** vertical rail word — 9.4cqw for short names, shrinks so 13-char fits. */
export const railFont = (len: number): string =>
  `${Math.min(9.4, 65 / Math.max(1, len)).toFixed(2)}cqw`;

/** kraft city wordmark — capped 2.9cqw, shrinks past ~9 chars. */
export const cityFont = (len: number): string =>
  `${Math.min(2.9, 27 / Math.max(1, len)).toFixed(2)}cqw`;

/** type-block school name — capped 2.5cqw, shrinks by longest line. */
export const typeL2Font = (maxLineLen: number): string =>
  `${Math.min(2.5, 26 / Math.max(1, maxLineLen)).toFixed(2)}cqw`;

/* ----------------------------------------------------------------- helpers -- */

const PREFIX_RE = /^(Collège|Cégep)\s+(?:de\s+la\s+|de\s+|du\s+|des\s+|d['’]\s*)?/i;

/** "COLLÈGE" / "CÉGEP" from the canonical schoolName first word. */
function typePrefix(schoolName: string): string {
  const first = schoolName.trim().split(/\s+/)[0] ?? "";
  return first.toUpperCase();
}

/** schoolName minus its type prefix → the type-block body, split into lines
 *  (break kept after a hyphen, mirroring "André-<br>Grasset"). */
function nameBodyLines(schoolName: string): string[] {
  const body = schoolName.replace(PREFIX_RE, "").trim();
  const hy = body.indexOf("-");
  if (hy > 0 && body.length > 9) {
    return [body.slice(0, hy + 1), body.slice(hy + 1)];
  }
  return [body];
}

/** last space/hyphen token — the rail word (André-Grasset → Grasset). */
function shortName(schoolName: string): string {
  const body = schoolName.replace(PREFIX_RE, "").trim();
  return body.split(/[\s-]+/).filter(Boolean).pop() ?? schoolName;
}

/** 'QC' → the fleur-de-lys motif (only province implemented). Extensible. */
export function provinceMotifFor(province: string): "fleur" | "maple" {
  return province.toUpperCase() === "QC" ? "fleur" : "maple";
}

/** league → real logo file + provincial nuance. */
export function leagueLogoFor(league: SchoolProgramIdentity["league"]): string {
  return league === "USPORTS" ? "/logos/usports.png" : "/logos/rseq.png";
}

/* --------------------------------------------------------------- resolver -- */

export interface ResolvedWall {
  typeL1: string;
  typeL2Lines: string[];
  typeL2Font: string;
  railWord: string;
  railFont: string;
  cityUpper: string;
  cityFont: string;
  regionTag: string;
  areaCode: string;
  initials: string;
  hasLogo: boolean;
  logoUrl: string | null;
  monogram: string;
  nameCard: string;
  sloganLines: string[] | null;
  nickname: string | null;
  tagline: string;
  devise: string;
  arrowPhrase: string;
  eliteWord: string;
  boldWord: string;
  allezWord: string;
  ensembleWord: string;
  provinceMotif: "fleur" | "maple";
  leagueLogo: string;
  foamFilter: string;
}

/** Everything the fixed structure needs, resolved once per school. */
export function resolveWall(
  s: SchoolProgramIdentity,
  theme: WallTheme,
): ResolvedWall {
  const l2Lines = nameBodyLines(s.schoolName);
  const maxLine = Math.max(...l2Lines.map((l) => l.length));
  // railWordOverride absent/vide => shortName(schoolName) (comportement gelé).
  const rail =
    s.railWordOverride && s.railWordOverride.trim()
      ? s.railWordOverride
      : shortName(s.schoolName);
  const cw = s.customWords ?? {};
  const areaCode = s.areaCode ?? s.initials;

  return {
    typeL1: typePrefix(s.schoolName),
    typeL2Lines: l2Lines,
    typeL2Font: typeL2Font(maxLine),
    railWord: rail,
    railFont: railFont(rail.length),
    cityUpper: s.city.toUpperCase(),
    cityFont: cityFont(s.city.length),
    regionTag: s.regionTag,
    areaCode,
    initials: s.initials,
    hasLogo: !!s.logoUrl,
    logoUrl: s.logoUrl,
    monogram: s.initials,
    nameCard: s.mascot.toUpperCase(),
    sloganLines: s.slogan ? s.slogan.split(/\n|<br\s*\/?>/i) : null,
    nickname: s.nickname,
    // Fallbacks byte-identiques aux constantes gelées de ProgramWall.tsx.
    tagline: s.tagline ?? "élite collégiale",
    devise: s.deviseWords
      ? `${s.deviseWords.first} · ${s.deviseWords.second}`
      : "FIER · FORT",
    arrowPhrase: s.arrowPhrase
      ? `${s.arrowPhrase.before} ➔ ${s.arrowPhrase.after}`
      : "D'ICI ➔ POUR ICI",
    eliteWord: cw.eliteWord ?? "ÉLITE",
    boldWord: cw.boldWord ?? "BOL D'OR",
    allezWord: cw.allezWord ?? "ALLEZ",
    ensembleWord: cw.ensembleWord ?? "ENSEMBLE",
    provinceMotif: provinceMotifFor(s.province),
    leagueLogo: leagueLogoFor(s.league),
    foamFilter: theme.foamFilter,
  };
}
