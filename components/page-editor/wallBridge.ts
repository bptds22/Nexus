// components/page-editor/wallBridge.ts
//
// Pont éditeur → mur : mappe l'état S1 de l'éditeur vers le contrat
// SchoolProgramIdentity que consomme le VRAI ProgramWall (components/
// program-wall). Les 3 swatches passent par deriveWallTheme (dans le mur) ;
// les 4 champs additifs (tagline/railWordOverride/deviseWords/arrowPhrase) sont
// ceux ajoutés au contrat pour cette v2. Aucun slot inventé au-delà de ces 4.

import type { SchoolProgramIdentity } from "@/components/program-wall/slots";

export interface EditorIdentityState {
  nick: string;
  slog: string;
  tagline: string;
  prov: string;
  tick: string;
  ville: string;
  quartier: string;
  rtag: string;
  c1: string; c2: string; c3: string;
  init: string;
  vword: string;
  dev1: string; dev2: string;
  fla: string; flb: string;
  /** mots-tuiles sélectionnés, dans l'ordre (max 4) → 4 slots du mur. */
  words: string[];
  nbath: string;
  /** URL publique du logo uploadé (storage) ; null → monogramme (initiales). */
  logoUrl: string | null;
}

const PROV_CODE: Record<string, string> = { Québec: "QC", Ontario: "ON", Canada: "CA" };
export const provCode = (prov: string): string => PROV_CODE[prov] ?? "QC";

/** État éditeur → SchoolProgramIdentity. schoolName reste canonique (non
 *  éditable) ; le mot vertical passe par railWordOverride. */
export function editorToSchool(s: EditorIdentityState): SchoolProgramIdentity {
  const code = provCode(s.prov);
  const w = s.words;
  return {
    id: "editor-preview",
    schoolName: "Collège André-Grasset",
    mascot: s.nick || "—",
    colorPrimary: s.c1,
    colorDarker: s.c2,
    colorNeutral: s.c3,
    // claire custom = différente du défaut #E8C7CD → glyphes tuiles claires en claire-assombrie (#3)
    lightDefined: s.c3.trim().toLowerCase() !== "#e8c7cd",
    logoUrl: s.logoUrl ?? null, // logo uploadé (storage) ; null → monogramme (initiales)
    city: s.ville || "",
    regionTag: `${s.quartier} · ${code}`,
    areaCode: s.rtag || code,
    initials: s.init || "—",
    slogan: s.slog || null,
    nickname: null,
    // ≤4 mots sélectionnés → les 4 slots ; slot vide = défaut Nexus (resolveWall).
    customWords: { eliteWord: w[0], boldWord: w[1], allezWord: w[2], ensembleWord: w[3] },
    league: "RSEQ",
    province: code,
    division: "",
    // -- 4 champs additifs v2 --
    tagline: s.tagline,
    railWordOverride: s.vword,
    deviseWords: { first: s.dev1, second: s.dev2 },
    arrowPhrase: { before: s.fla, after: s.flb },
  };
}
