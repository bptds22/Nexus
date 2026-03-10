/* ─────────────────────────────────────────────────────────────────
   Sports Data — single source of truth for positions per sport.
   Used by SportPositionSelect + SportStatsFields.
───────────────────────────────────────────────────────────────── */

export interface PositionEntry {
  abbr: string;
  label: string;
  group?: string; // optgroup label for grouped sports
}

export const POSITIONS: Record<string, PositionEntry[]> = {

  "Football": [
    // Attaque
    { abbr: "QB",  label: "Quart-arrière",                    group: "Attaque" },
    { abbr: "RB",  label: "Porteur de ballon",                group: "Attaque" },
    { abbr: "FB",  label: "Demi inséré",                      group: "Attaque" },
    { abbr: "WR",  label: "Receveur éloigné",                 group: "Attaque" },
    { abbr: "TE",  label: "Ailier rapproché",                 group: "Attaque" },
    { abbr: "OL",  label: "Joueur de ligne offensive",        group: "Attaque" },
    { abbr: "C",   label: "Centre",                           group: "Attaque" },
    { abbr: "OT",  label: "Bloqueur offensif",                group: "Attaque" },
    { abbr: "OG",  label: "Garde offensif",                   group: "Attaque" },
    // Défense
    { abbr: "DL",  label: "Joueur de ligne défensive",        group: "Défense" },
    { abbr: "DE",  label: "Ailier défensif",                  group: "Défense" },
    { abbr: "DT",  label: "Plaqueur défensif",                group: "Défense" },
    { abbr: "LB",  label: "Secondeur",                        group: "Défense" },
    { abbr: "ILB", label: "Secondeur intérieur",              group: "Défense" },
    { abbr: "OLB", label: "Secondeur extérieur",              group: "Défense" },
    { abbr: "CB",  label: "Demi de coin",                     group: "Défense" },
    { abbr: "S",   label: "Maraudeur",                        group: "Défense" },
    { abbr: "FS",  label: "Demi de sûreté",                   group: "Défense" },
    { abbr: "SS",  label: "Maraudeur rapproché",              group: "Défense" },
    // Unités spéciales
    { abbr: "K",   label: "Botteur",                          group: "Unités spéciales" },
    { abbr: "P",   label: "Botteur de dégagement",            group: "Unités spéciales" },
    { abbr: "LS",  label: "Spécialiste des longues remises",  group: "Unités spéciales" },
    { abbr: "RET", label: "Retourneur",                       group: "Unités spéciales" },
  ],

  "Basketball": [
    { abbr: "PG", label: "Meneur" },
    { abbr: "SG", label: "Arrière" },
    { abbr: "SF", label: "Ailier" },
    { abbr: "PF", label: "Ailier fort" },
    { abbr: "C",  label: "Centre" },
  ],

  "Soccer": [
    // Gardien
    { abbr: "GK",  label: "Gardien de but",    group: "Gardien" },
    // Défense
    { abbr: "CB",  label: "Défenseur central",  group: "Défense" },
    { abbr: "LB",  label: "Arrière gauche",     group: "Défense" },
    { abbr: "RB",  label: "Arrière droit",      group: "Défense" },
    { abbr: "LWB", label: "Latéral gauche",     group: "Défense" },
    { abbr: "RWB", label: "Latéral droit",      group: "Défense" },
    // Milieu
    { abbr: "CDM", label: "Milieu défensif",    group: "Milieu" },
    { abbr: "CM",  label: "Milieu central",     group: "Milieu" },
    { abbr: "CAM", label: "Milieu offensif",    group: "Milieu" },
    { abbr: "LM",  label: "Milieu gauche",      group: "Milieu" },
    { abbr: "RM",  label: "Milieu droit",       group: "Milieu" },
    // Attaque
    { abbr: "LW",  label: "Ailier gauche",      group: "Attaque" },
    { abbr: "RW",  label: "Ailier droit",       group: "Attaque" },
    { abbr: "CF",  label: "Avant-centre",       group: "Attaque" },
    { abbr: "ST",  label: "Attaquant",          group: "Attaque" },
  ],

  "Hockey": [
    { abbr: "G",  label: "Gardien de but" },
    { abbr: "LD", label: "Défenseur gauche" },
    { abbr: "RD", label: "Défenseur droit" },
    { abbr: "C",  label: "Centre" },
    { abbr: "LW", label: "Ailier gauche" },
    { abbr: "RW", label: "Ailier droit" },
  ],

  "Volleyball": [
    { abbr: "P",   label: "Passeur" },
    { abbr: "L",   label: "Libéro" },
    { abbr: "OH",  label: "Attaquant extérieur" },
    { abbr: "OPP", label: "Attaquant opposé" },
    { abbr: "MB",  label: "Attaquant centre" },
    { abbr: "DS",  label: "Spécialiste défensif" },
  ],

  "Athlétisme": [
    { abbr: "SPR",  label: "Sprinter (100m, 200m)" },
    { abbr: "MID",  label: "Demi-fond (400m, 800m)" },
    { abbr: "DIST", label: "Fond (1500m+)" },
    { abbr: "HRD",  label: "Haies" },
    { abbr: "HJ",   label: "Saut en hauteur" },
    { abbr: "LJ",   label: "Saut en longueur" },
    { abbr: "TJ",   label: "Triple saut" },
    { abbr: "PV",   label: "Saut à la perche" },
    { abbr: "SP",   label: "Lancer du poids" },
    { abbr: "DT",   label: "Lancer du disque" },
    { abbr: "JT",   label: "Lancer du javelot" },
    { abbr: "MUL",  label: "Épreuves combinées" },
    { abbr: "REL",  label: "Relais" },
  ],

  "Flag football": [
    { abbr: "QB", label: "Quart-arrière" },
    { abbr: "RB", label: "Porteur de ballon" },
    { abbr: "WR", label: "Receveur" },
    { abbr: "C",  label: "Centre" },
    { abbr: "RU", label: "Rusher" },
    { abbr: "DB", label: "Demi défensif" },
    { abbr: "S",  label: "Maraudeur" },
    { abbr: "LB", label: "Secondeur" },
  ],

  "Rugby": [
    { abbr: "LHP", label: "Pilier gauche" },
    { abbr: "HK",  label: "Talonneur" },
    { abbr: "THP", label: "Pilier droit" },
    { abbr: "LK",  label: "Deuxième ligne" },
    { abbr: "FL",  label: "Flanker" },
    { abbr: "N8",  label: "Numéro 8" },
    { abbr: "SH",  label: "Demi de mêlée" },
    { abbr: "FH",  label: "Demi d'ouverture" },
    { abbr: "IC",  label: "Centre intérieur" },
    { abbr: "OC",  label: "Centre extérieur" },
    { abbr: "WG",  label: "Ailier" },
    { abbr: "FB",  label: "Arrière" },
  ],

  "Cheerleading": [
    { abbr: "FLY",  label: "Voltigeur(se)" },
    { abbr: "BASE", label: "Base" },
    { abbr: "BACK", label: "Arrière (spotteur)" },
    { abbr: "TUM",  label: "Tumbler (acrobate)" },
  ],

  "Natation": [
    { abbr: "FREE",   label: "Style libre" },
    { abbr: "BACK",   label: "Dos" },
    { abbr: "BREAST", label: "Brasse" },
    { abbr: "FLY",    label: "Papillon" },
    { abbr: "IM",     label: "Quatre nages" },
    { abbr: "DIST",   label: "Distance" },
  ],

  "Badminton": [
    { abbr: "SGL", label: "Simple" },
    { abbr: "DBL", label: "Double" },
    { abbr: "MIX", label: "Double mixte" },
  ],

  "Cross-country": [
    { abbr: "SHORT", label: "Courte distance" },
    { abbr: "LONG",  label: "Longue distance" },
  ],

  "Futsal": [
    { abbr: "GK",  label: "Gardien" },
    { abbr: "FIX", label: "Fixo (défenseur)" },
    { abbr: "ALA", label: "Aile" },
    { abbr: "PIV", label: "Pivot (attaquant)" },
  ],

  "Baseball": [
    { abbr: "P",  label: "Lanceur" },
    { abbr: "C",  label: "Receveur" },
    { abbr: "1B", label: "Premier but" },
    { abbr: "2B", label: "Deuxième but" },
    { abbr: "3B", label: "Troisième but" },
    { abbr: "SS", label: "Arrêt-court" },
    { abbr: "LF", label: "Voltigeur gauche" },
    { abbr: "CF", label: "Voltigeur centre" },
    { abbr: "RF", label: "Voltigeur droit" },
    { abbr: "DH", label: "Frappeur désigné" },
  ],

  "Ultimate frisbee": [
    { abbr: "HND", label: "Handler (passeur)" },
    { abbr: "CUT", label: "Cutter (receveur)" },
    { abbr: "HYB", label: "Hybride" },
  ],
};

/* ── Helper: get unique groups for a sport ───────────────────── */

export function getPositionGroups(sport: string): string[] {
  const positions = POSITIONS[sport];
  if (!positions) return [];
  const groups = positions
    .map((p) => p.group)
    .filter((g): g is string => !!g);
  return [...new Set(groups)];
}

/* ── Helper: check if a sport uses optgroups ─────────────────── */

export function sportHasGroups(sport: string): boolean {
  return getPositionGroups(sport).length > 0;
}
