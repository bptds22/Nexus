// lib/mock/schoolPrograms.ts
//
// The 3 schools from docs/reference/wall-compare-3schools.html — Grasset
// (rouge/noir · vrai logo), Vulkins (orange/violet · monogramme V), Nomades
// (vert néon/bleu · monogramme M). Display-only fixture for /wall-test.
//
// ⚠ Vulkins & Nomades hex are NOT verified official brand colors — placeholders
// from the reference palette test; replace with the real values before any
// production use.

import type { SchoolProgramIdentity } from "@/components/program-wall/slots";

export const schoolPrograms: SchoolProgramIdentity[] = [
  {
    id: "andre-grasset",
    schoolName: "Collège André-Grasset",
    mascot: "Phénix",
    colorPrimary: "#A6192E", // Grasset red
    colorDarker: "#191414",
    colorNeutral: "#F1EBDD",
    logoUrl: "/logos/cag.png",
    city: "Montréal",
    regionTag: "AHUNTSIC · QC",
    areaCode: "514",
    initials: "AG",
    slogan: "Phénix un jour,\nPhénix toujours",
    nickname: "LE NID",
    league: "RSEQ",
    province: "QC",
    division: "D1",
  },
  {
    id: "victoriaville",
    schoolName: "Cégep de Victoriaville",
    mascot: "Vulkins",
    colorPrimary: "#E8721C", // ⚠ non vérifié — orange
    colorDarker: "#241335", // ⚠ non vérifié — violet
    colorNeutral: "#F1EBDD",
    logoUrl: null, // → monogramme V
    city: "Victoriaville",
    regionTag: "BOIS-FRANCS · QC",
    areaCode: "819",
    initials: "V",
    slogan: "L'éruption\ncommence ici",
    nickname: "LE VOLCAN",
    league: "RSEQ",
    province: "QC",
    division: "D1",
  },
  {
    id: "montmorency",
    schoolName: "Collège Montmorency",
    mascot: "Nomades",
    colorPrimary: "#79B117", // ⚠ non vérifié — vert néon
    colorDarker: "#0E1E33", // ⚠ non vérifié — bleu
    colorNeutral: "#F1EBDD",
    logoUrl: null, // → monogramme M
    city: "Laval",
    regionTag: "LAVAL-DES-RAPIDES",
    areaCode: "450",
    initials: "M",
    slogan: "Partout,\nchez nous",
    nickname: "LA TRIBU",
    league: "RSEQ",
    province: "QC",
    division: "D1",
  },
];
