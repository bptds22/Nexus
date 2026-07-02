// lib/mock/schoolPrograms.ts
//
// Seed data for <ProgramWall> — 6 real Quebec CÉGEP programs (real team names),
// with palettes deliberately chosen to STRESS the theming, not just easy ones.
// Colors are approximations of each program's identity, tuned to probe the
// derivation + ink-flip across the full range.
//
// Stress cases baked in:
//   • Limoilou Titans   — DARK secondary (near-black) → c2-as-text-on-dark risk
//   • Montmorency       — MUDDY: primary & secondary share hue (both teal)
//   • Sainte-Foy        — LIGHT-ON-LIGHT: light primary + cream secondary
//   • Vieux-Montréal    — the one with a real logo file (logoUrl set)
//   • Rive-Nord         — the validated v2 navy/gold baseline
//   • Trois-Rivières    — strong-contrast control (deep indigo / orange)
//
// Nullable coverage: several have null slogan / established / logoUrl so the
// graceful-fallback paths are exercised by real rows.

import type { SchoolProgramIdentity } from "@/lib/types/models";

export const schoolPrograms: SchoolProgramIdentity[] = [
  // 1 — baseline (validated in v2). Full data.
  {
    id: "rive-nord",
    schoolName: "Cégep de la Rive-Nord",
    mascot: "LYNX",
    city: "REPENTIGNY",
    initial: "R",
    slogan: "Ici, tu fais partie de quelque chose",
    established: "2004",
    league: "RSEQ",
    colorPrimary: "#12233F", // navy
    colorSecondary: "#E3B341", // gold
    logoUrl: null,
  },

  // 2 — HARD: dark secondary (near-black). Also all-nullable-optionals stripped
  //     to prove a minimal row still looks full.
  {
    id: "limoilou",
    schoolName: "Cégep Limoilou",
    mascot: "TITANS",
    city: "QUÉBEC",
    initial: "L",
    slogan: null,
    established: null,
    league: "RSEQ",
    colorPrimary: "#C8102E", // red
    colorSecondary: "#141414", // near-black  ← dark-secondary stress
    logoUrl: null,
  },

  // 3 — HARD: muddy — primary & secondary within the same (teal) hue.
  {
    id: "montmorency",
    schoolName: "Collège Montmorency",
    mascot: "NOMADES",
    city: "LAVAL",
    initial: "M",
    slogan: "Toujours en mouvement",
    established: null, // → pattern tile
    league: "RSEQ",
    colorPrimary: "#0E7C7B", // teal
    colorSecondary: "#14514F", // dark teal ← low separation from primary
    logoUrl: null,
  },

  // 4 — HARD: light-on-light + minimal data (no slogan, no established, no logo).
  {
    id: "sainte-foy",
    schoolName: "Cégep de Sainte-Foy",
    mascot: "DYNAMIQUES",
    city: "QUÉBEC",
    initial: "S",
    slogan: null,
    established: null,
    league: "RSEQ",
    colorPrimary: "#7FB3D5", // light blue
    colorSecondary: "#EDE6D6", // cream ← light-on-light stress
    logoUrl: null,
  },

  // 5 — the one WITH a real logo file (drop/replace at public/logos/).
  {
    id: "vieux-montreal",
    schoolName: "Cégep du Vieux Montréal",
    mascot: "SPARTIATES",
    city: "MONTRÉAL",
    initial: "V",
    slogan: "La force du collectif",
    established: "1968",
    league: "RSEQ",
    colorPrimary: "#5B2B82", // purple
    colorSecondary: "#F2A900", // gold
    logoUrl: "/logos/spartiates.svg",
  },

  // 6 — strong-contrast control (should be the "easy" premium look).
  {
    id: "trois-rivieres",
    schoolName: "Cégep de Trois-Rivières",
    mascot: "DIABLOS",
    city: "TROIS-RIVIÈRES",
    initial: "T",
    slogan: "On joue avec le feu",
    established: "1968",
    league: "RSEQ",
    colorPrimary: "#1B1B3A", // deep indigo
    colorSecondary: "#FF6B35", // orange
    logoUrl: null,
  },
];
