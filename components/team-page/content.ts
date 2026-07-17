// components/team-page/content.ts
// Team page (niveau-2) — v2 : terrains photo + groupes + perfect match position.
// Besoins DÉRIVÉS du roster réel-shape (team_athletes JOIN athletes →
// position_id/position_secondaire_id/annee_diplomation). Départ = annee_fin ===
// saison. Positions = abréviations public.positions (diagnostic). Fixture MOCK
// pour la démo (Bloc 2 = requête DB). Aucune donnée inventée hors mock commenté.

import type { SocialLink } from "@/components/marketing/SocialIcons";

export type Level = "pri" | "hi" | "mid" | "full";
export const LEVEL_LABEL: Record<Level, string> = {
  pri: "Priorité",
  hi: "Besoin élevé",
  mid: "Besoin moyen",
  full: "Complet",
};

/** Un joueur du roster (shape team_athletes JOIN athletes). */
export interface RosterPlayer {
  pos: string;               // abréviation position principale (public.positions)
  pos2?: string | null;      // abréviation position secondaire (ou null)
  annee_fin: number | null;  // annee_diplomation ; null = exclu du calcul
}

/** Un groupe = une plaque terrain. `positions` = abréviations agrégées. */
export interface GroupDef {
  label: string;             // texte plaque (verbatim spec)
  positions: string[];       // abréviations public.positions
  left: number;
  top: number;
}
export interface FacetteDef {
  key: string;               // "offense" | "defense" | "specialistes" | "main"
  label: string;             // libellé toggle
  groups: GroupDef[];
}
export interface SportConfig {
  facettes: FacetteDef[];    // 1+ ; toggle si >1
  perspective: boolean;      // true → .scene ; false → .scene.flat
  asset: string | null;      // /terrains/x.jpg (PLACEHOLDER) ou null → court SVG
  court?: "basketball" | "soccer" | "volleyball"; // terrain dessiné (aucune photo spec)
  cardsOnly?: boolean;       // true → pas de TerrainStage, cards seulement
}

/** Athlète connecté (perfect match). MOCK fixture ; Bloc 2 = session. */
export interface ConnectedAthlete {
  sport: string;             // doit === team.sportNom
  pos: string;               // abréviation principale
  pos2?: string | null;      // abréviation secondaire
  posLabel: string;          // libellé lisible du poste ("demi défensif")
  posLabelPlural: string;    // pluriel ("demis défensifs")
}

/** Contenu éditorial de l'équipe (section Présentation). MOCK ; Bloc 2 =
 *  table team_content + file de modération (comme sell_text école). Champ vide
 *  → l'élément est absent (jamais un trou). */
export interface StaffMember { nom: string; role: string; }
export interface HeadCoach { nom: string; photoUrl: string | null; bio: string; }
/** Fanion de palmarès (bannière plafond de gym). type → couleur. */
export interface Pennant { titre: string; annee: number; type: "championnat" | "finale"; }
export interface TeamContent {
  // Alimente le slot `.lead` (l'accroche sous le titre, même style que la page
  // école). C'est le SEUL texte d'accroche réel dont l'équipe dispose : les
  // autres sections (calendrier, besoins, engagées) n'en ont pas et n'affichent
  // donc rien. Bloc 2 : si le coach saisit une accroche par section, l'ajouter
  // ici et la rendre en `.lead` — surtout pas de texte inventé en attendant.
  presentationText: string;  // texte libre coach (modéré Bloc 2)
  championships: number;     // fanions gagnés
  staffSince: number;        // année de mise en place du staff
  headCoach: HeadCoach;
  staff: StaffMember[];
  palmares: Pennant[];       // fanions suspendus ; [] → aucun (l'espace se resserre)
}

/** Événement calendrier (saisie coach / scraping Bloc 1). type → card / camp.
 *  Pas de score : le scraping ne les fournit pas ; passé = date révolue (atténué). */
export interface TeamEvent {
  type: "match" | "camp";
  date: string;               // ISO "YYYY-MM-DD" (comparaison lexicale, pas de fuseau)
  adversaire?: string;
  domicile: boolean;
  heure: string;
  lieu: string;
}

/** Recrue engagée (section « Déjà engagées »). MOCK ; Bloc 2 = commits DB.
 *  R2 : noms publics de mineurs → gérés par visiblePublic (consentement). */
export interface Commit {
  prenom: string;
  nom: string;
  ecoleProvenance: string;
  promo: number;
  etoiles: number;            // note standardisée 1-5 (StarRating plateforme)
  athleteId?: string;
  visiblePublic: boolean;     // consentement d'affichage public (câblage réel Bloc 2)
}

export interface TeamData {
  id: string;
  // depuis teams (AUTO)
  sportNom: string;
  division: string;
  genre: string;
  sportKey: keyof typeof SPORT_CONFIGS;
  // identité
  nom: string;
  nickname: string;
  schoolName: string;
  schoolInitial: string;       // monogramme (fallback si pas de crest)
  logoUrl?: string | null;     // crest école (PNG transparent) ; null → monogramme
  // ── Couleurs de l'équipe. La primaire éclaircie est STOCKÉE (pas dérivée) :
  // elle porte tous les accents clairs (kickers, em de titre, rôle staff…).
  // Décision produit : filter:brightness() sur la primaire donnait un rouge trop
  // cru ; la teinte claire est un choix de design, pas un calcul.
  teamColor: string;        // PRIMAIRE          (école colorPrimary)
  teamColorLt: string;      // PRIMAIRE ÉCLAIRCIE — accents/texte clair
  teamColorDark: string;    // FONCÉE            (école colorDarker)
  teamColorNeutral: string; // CLAIRE / crème    (école colorNeutral)
  // saisie coach (Bloc 1/2), mock
  coachName: string;
  recordSaison: string;
  recordLabel: string;
  playoffResult: string;
  playoffLabel: string;
  socials: SocialLink[];
  engagesCount: number;
  season: number;
  roster: RosterPlayer[];
  viewer?: ConnectedAthlete | null;
  // Mots du mur (même vocabulaire que la page école — fantômes derrière le terrain).
  wallWords: string[];
  // Photo hero full-bleed (saisie coach Bloc 1/2, PLACEHOLDER). null → fallback thémé.
  heroImage?: string | null;
  // Point focal du crop hero, format `object-position` (ex. "50% 25%", "30% 20%").
  // Absent → défaut "50% 25%" (privilégie le HAUT : les sujets sont debout, un
  // centrage vertical leur coupe la tête). Bloc 2 : hero_image.focal_x/focal_y
  // → composer ici en `${focal_x}% ${focal_y}%`.
  heroFocal?: string | null;
  // Contenu éditorial (section Présentation). null → section absente.
  content?: TeamContent | null;
  // Calendrier (section Calendrier). [] / absent → section absente.
  events?: TeamEvent[] | null;
  // Recrues engagées (section « Déjà engagées »). [] / absent → section absente.
  commits?: Commit[] | null;
}

/* ── MAPPING GROUPES par sport (§6) — abréviations public.positions ────────── */
export const SPORT_CONFIGS = {
  football: {
    perspective: true,
    asset: "/terrains/football.jpg",
    facettes: [
      {
        key: "offense", label: "Offense",
        // Slot map v2.3 : anchors exacts QUART 38/72 · PORTEURS 60/82 ; LIGNE OFF.
        // et RECEVEURS écartés pour zéro chevauchement.
        groups: [
          { label: "LIGNE OFFENSIVE", positions: ["OL", "OT", "OG", "C"], left: 52, top: 56 },
          { label: "QUART-ARRIÈRE", positions: ["QB"], left: 38, top: 72 },
          { label: "PORTEURS", positions: ["RB", "FB"], left: 60, top: 82 },
          { label: "RECEVEURS", positions: ["WR", "TE"], left: 15, top: 54 },
        ],
      },
      {
        key: "defense", label: "Défense",
        groups: [
          { label: "LIGNE DÉFENSIVE", positions: ["DL", "DE", "DT"], left: 54, top: 58 },
          { label: "SECONDEURS", positions: ["LB", "ILB", "OLB"], left: 44, top: 40 },
          { label: "DEMIS", positions: ["CB"], left: 18, top: 30 },
          { label: "MARAUDEURS", positions: ["S", "FS", "SS"], left: 66, top: 18 },
        ],
      },
      {
        key: "specialistes", label: "Spécialistes",
        // Pas dans la démo spec (2 facettes) — 3ᵉ facette imposée §6, coords écartées.
        groups: [
          { label: "RETOURNEUR", positions: ["RET"], left: 50, top: 16 },
          { label: "LONGUE REMISE", positions: ["LS"], left: 42, top: 60 },
          { label: "BOTTEUR", positions: ["K"], left: 58, top: 72 },
          { label: "BOTTEUR DÉG.", positions: ["P"], left: 46, top: 86 },
        ],
      },
    ],
  },
  flag: {
    perspective: true, // §4 : réutilise football.jpg (sans watermark) — flag = terrain football
    asset: "/terrains/football.jpg",
    facettes: [
      {
        key: "offense", label: "Offense",
        groups: [
          { label: "CENTRE", positions: ["C"], left: 50, top: 48 },
          { label: "QUART-ARRIÈRE", positions: ["QB"], left: 44, top: 64 },
          { label: "PORTEUR", positions: ["RB"], left: 64, top: 76 },
          { label: "RECEVEUR", positions: ["WR"], left: 20, top: 40 },
        ],
      },
      {
        key: "defense", label: "Défense",
        groups: [
          { label: "CHASSEUR", positions: ["RU"], left: 50, top: 44 },
          { label: "SECONDEUR", positions: ["LB"], left: 38, top: 58 },
          { label: "DEMI DÉF.", positions: ["DB"], left: 28, top: 30 },
          { label: "MARAUDEUR", positions: ["S"], left: 72, top: 30 },
        ],
      },
    ],
  },
  basketball: {
    perspective: true,
    asset: "/terrains/basketball.jpg", // photo déposée BP (PLACEHOLDER) ; court = fallback si 404
    court: "basketball",
    facettes: [
      {
        key: "main", label: "",
        groups: [
          { label: "MENEUR", positions: ["PG"], left: 50, top: 26 },
          { label: "ARRIÈRE", positions: ["SG"], left: 26, top: 38 },
          { label: "AILIER", positions: ["SF"], left: 74, top: 38 },
          { label: "AILIER FORT", positions: ["PF"], left: 36, top: 64 },
          { label: "PIVOT", positions: ["C"], left: 56, top: 70 },
        ],
      },
    ],
  },
  hockey: {
    perspective: true,
    asset: "/terrains/hockey.jpg",
    facettes: [
      {
        key: "main", label: "",
        groups: [
          { label: "CENTRE", positions: ["C"], left: 50, top: 28 },
          { label: "AILIER G", positions: ["LW"], left: 22, top: 32 },
          { label: "AILIER D", positions: ["RW"], left: 78, top: 32 },
          { label: "DÉFENSEUR G", positions: ["LD"], left: 34, top: 58 },
          { label: "DÉFENSEUR D", positions: ["RD"], left: 66, top: 58 },
          { label: "GARDIEN", positions: ["G"], left: 50, top: 84 },
        ],
      },
    ],
  },
  baseball: {
    perspective: true,
    asset: "/terrains/baseball.jpg",
    facettes: [
      {
        key: "main", label: "",
        groups: [
          { label: "CHAMP CENTRE", positions: ["CF"], left: 50, top: 16 },
          { label: "CHAMP G", positions: ["LF"], left: 22, top: 26 },
          { label: "CHAMP D", positions: ["RF"], left: 78, top: 26 },
          { label: "ARRÊT-COURT", positions: ["SS"], left: 38, top: 40 },
          { label: "2E BUT", positions: ["2B"], left: 62, top: 40 },
          { label: "3E BUT", positions: ["3B"], left: 26, top: 56 },
          { label: "1ER BUT", positions: ["1B"], left: 74, top: 56 },
          { label: "LANCEUR", positions: ["P"], left: 50, top: 62 },
          { label: "RECEVEUR", positions: ["C"], left: 50, top: 88 },
        ],
      },
    ],
  },
  // Soccer — aucune photo spec → terrain dessiné (SVG). 15 positions groupées en
  // 4 lignes (pas de coords spec ; individuel §6 serait illisible sur une pelouse).
  soccer: {
    perspective: true,
    asset: "/terrains/soccer.jpg", // photo déposée BP (PLACEHOLDER) ; court = fallback si 404
    court: "soccer",
    facettes: [
      {
        key: "main", label: "",
        groups: [
          { label: "ATTAQUANTS", positions: ["RW", "LW", "CF", "ST"], left: 50, top: 22 },
          { label: "MILIEUX", positions: ["CDM", "CM", "RM", "LM", "CAM"], left: 50, top: 46 },
          { label: "DÉFENSEURS", positions: ["CB", "RB", "LB", "RWB", "LWB"], left: 50, top: 68 },
          { label: "GARDIEN", positions: ["GK"], left: 50, top: 87 },
        ],
      },
    ],
  },
  // Volleyball — aucune photo spec → terrain dessiné (SVG). Rotation 6 zones
  // condensée en 5 plaques (filet en haut ; avant / arrière).
  volleyball: {
    perspective: true,
    asset: "/terrains/volleyball.jpg", // photo déposée BP (PLACEHOLDER) ; court = fallback si 404
    court: "volleyball",
    facettes: [
      {
        key: "main", label: "",
        groups: [
          { label: "CENTRAL", positions: ["MB"], left: 50, top: 28 },
          { label: "AILIER", positions: ["OH"], left: 24, top: 34 },
          { label: "POINTU", positions: ["OPP"], left: 76, top: 34 },
          { label: "PASSEUR", positions: ["P"], left: 62, top: 60 },
          { label: "LIBÉRO", positions: ["L", "DS"], left: 36, top: 66 },
        ],
      },
    ],
  },
} satisfies Record<string, SportConfig>;

/* ── Moteur besoins ────────────────────────────────────────────────────────── */

const levelOf = (departures: number): Level =>
  departures === 0 ? "full" : departures === 1 ? "mid" : departures === 2 ? "hi" : "pri";

export interface Plaque { label: string; left: number; top: number; level: Level; levelLabel: string; }
export interface NeedCard { label: string; level: Level; places: number; depText: string; }

/** Besoins d'une facette : plaques (toutes) + cards (besoin>0). */
export function deriveFacette(
  roster: RosterPlayer[],
  groups: readonly GroupDef[],
  season: number,
): { plaques: Plaque[]; cards: NeedCard[] } {
  const plaques: Plaque[] = [];
  const cards: NeedCard[] = [];
  for (const g of groups) {
    const inGroup = roster.filter((p) => g.positions.includes(p.pos) && p.annee_fin != null);
    const effectif = inGroup.length;
    const departures = inGroup.filter((p) => p.annee_fin === season).length;
    const level = levelOf(departures);
    plaques.push({ label: g.label, left: g.left, top: g.top, level, levelLabel: LEVEL_LABEL[level] });
    if (departures > 0) {
      cards.push({
        label: g.label, level, places: departures,
        depText: `${departures} départ${departures > 1 ? "s" : ""} sur ${effectif}`,
      });
    }
  }
  return { plaques, cards };
}

/** Joueurs sans annee_diplomation (exposé à l'éditeur coach, Bloc 1). */
export function countNoYear(roster: RosterPlayer[]): number {
  return roster.filter((p) => p.annee_fin == null).length;
}

/** Positions du roster mappées à aucun groupe du sport (R4 : "Autres", pas de crash). */
export function unmappedNeed(team: TeamData, season: number): NeedCard | null {
  const cfg = SPORT_CONFIGS[team.sportKey];
  const mapped = new Set(cfg.facettes.flatMap((f) => f.groups.flatMap((g) => g.positions)));
  const orphans = team.roster.filter((p) => p.annee_fin != null && !mapped.has(p.pos));
  if (orphans.length === 0) return null;
  const departures = orphans.filter((p) => p.annee_fin === season).length;
  if (departures === 0) return null;
  const unknownCodes = [...new Set(orphans.map((p) => p.pos))].join(", ");
  console.warn(`[TeamPage] positions non mappées (${team.sportNom}): ${unknownCodes}`);
  return {
    label: "Autres", level: levelOf(departures), places: departures,
    depText: `${departures} départ${departures > 1 ? "s" : ""} · postes ${unknownCodes}`,
  };
}

/** Perfect match position (§C/§D) — athlète connecté vs besoins de CETTE équipe.
 *  Retourne les départs ET l'effectif au poste précis (format compact « X sur N »). */
export function positionMatch(
  team: TeamData, season: number,
): { posLabel: string; posLabelPlural: string; departures: number; effectif: number } | null {
  const v = team.viewer;
  if (!v || v.sport !== team.sportNom) return null;
  const cfg = SPORT_CONFIGS[team.sportKey];
  const matchForCode = (code: string): { deps: number; eff: number } | null => {
    for (const f of cfg.facettes) {
      for (const g of f.groups) {
        if (g.positions.includes(code)) {
          const players = team.roster.filter((p) => g.positions.includes(p.pos) && p.annee_fin != null);
          const deps = players.filter((p) => p.annee_fin === season).length;
          if (deps > 0) return { deps, eff: players.length };
        }
      }
    }
    return null;
  };
  // Poste PRINCIPAL prioritaire, puis secondaire.
  const m = matchForCode(v.pos) ?? (v.pos2 ? matchForCode(v.pos2) : null);
  if (!m) return null;
  return { posLabel: v.posLabel, posLabelPlural: v.posLabelPlural, departures: m.deps, effectif: m.eff };
}

/** État de la box unique (§A) :
 *  - `match`  → athlète connecté ET son poste est un besoin ici
 *  - `none`   → athlète connecté (même sport) mais aucune ouverture à son poste
 *  - `null`   → pas d'athlète connecté / autre sport → box absente
 */
export type MatchState =
  | { kind: "match"; posLabel: string; posLabelPlural: string; departures: number; effectif: number }
  | { kind: "none" }
  | null;

export function matchState(team: TeamData, season: number): MatchState {
  const v = team.viewer;
  if (!v || v.sport !== team.sportNom) return null; // non connecté / autre sport
  const m = positionMatch(team, season);
  return m ? { kind: "match", ...m } : { kind: "none" };
}

/* ── Calendrier — parse ISO sans objet Date (pas de décalage de fuseau) ─────── */
const MOIS_ABBR = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];
export function parseEventDate(iso: string): { day: number; mon: string; year: number } {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  return { day: d, mon: MOIS_ABBR[(m - 1) % 12] ?? "", year: y };
}
/** Date du jour (ISO YYYY-MM-DD) pour comparer les événements. */
export const todayISO = (): string => new Date().toISOString().slice(0, 10);
/** Match passé = date révolue (comparaison lexicale d'ISO). Le camp n'est jamais « passé » ici. */
export const isPast = (e: TeamEvent, today: string): boolean => e.type === "match" && e.date < today;
