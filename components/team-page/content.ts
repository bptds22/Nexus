// components/team-page/content.ts
// Team page (niveau-2) — v2 : terrains photo + groupes + perfect match position.
// Besoins DÉRIVÉS du roster réel-shape (team_athletes JOIN athletes →
// position_id/position_secondaire_id/annee_diplomation). Départ = annee_fin ===
// saison. Positions = abréviations public.positions (diagnostic). Fixture MOCK
// pour la démo (Bloc 2 = requête DB). Aucune donnée inventée hors mock commenté.

import type { CSSProperties } from "react";
import type { SocialLink } from "@/components/marketing/SocialIcons";

/* ── LA PALETTE DU TERRAIN — ARDOISE À TRACÉ BLANC ─────────────────────────
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  LE ROUGE EST LE VOCABULAIRE DE L'ÉCHELLE, ET RIEN D'AUTRE.              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Le terrain était tracé en rouge désaturé sur surface pâle. Deux rouges
 * cohabitaient donc à l'écran : celui des LIGNES, purement décoratif, et celui
 * de l'échelle, qui veut dire « poste urgent ». Une ligne de but et un besoin
 * critique n'ont aucune raison de partager une teinte — l'un décrit le décor,
 * l'autre appelle l'athlète à agir.
 * Le tracé passe donc au blanc translucide, et le rouge redevient exclusif à
 * l'échelle Nexus. Aucune ligne de terrain ne peut plus être lue comme un
 * signal. Ne JAMAIS réintroduire de rouge dans ces trois constantes.
 *
 * La surface passe aussi de pâle à sombre : une grande étendue claire dans une
 * page sombre, couverte de plaques claires, faisait tout se ressembler. Sur
 * ardoise, les plaques se détachent par leur propre valeur.
 *
 * Toujours AUCUNE couleur d'école : le terrain est neutre, le reste de la page
 * porte déjà l'identité du collège. */

/** Surface : ardoise, la même valeur que les cartes de la coquille. */
export const PITCH = "#1A1D24";
/** Tracé : blanc à 35 % — 3,21:1 sur l'ardoise, lisible sans dominer. */
export const PITCH_LINE = "rgba(255,255,255,0.35)";
/** Filigrane et repères : gris moyen, posé à 38 % d'opacité au point d'usage. */
export const PITCH_INK = "#6B7280";

export type Level = "pri" | "hi" | "mid" | "full";
// Libellés PUBLICS des 4 niveaux — alignés 1:1 sur l'éditeur « Page équipe »
// (COMPLET / BESOIN MOYEN / BESOIN ÉLEVÉ / URGENT). `pri` disait « Priorité » :
// le coach réglait « urgent » et l'athlète lisait autre chose.
export const LEVEL_LABEL: Record<Level, string> = {
  pri: "Urgent",
  hi: "Besoin élevé",
  mid: "Besoin moyen",
  full: "Complet",
};

/** Niveau SAISI dans l'éditeur (= team_position_needs.niveau en DB). */
export type Niveau = "complet" | "moyen" | "eleve" | "urgent";
export const NIVEAU_TO_LEVEL: Record<Niveau, Level> = {
  complet: "full", moyen: "mid", eleve: "hi", urgent: "pri",
};
export const LEVEL_TO_NIVEAU: Record<Level, Niveau> = {
  full: "complet", mid: "moyen", hi: "eleve", pri: "urgent",
};

/** Un joueur du roster (shape team_athletes JOIN athletes). */
export interface RosterPlayer {
  pos: string;               // abréviation position principale (public.positions)
  pos2?: string | null;      // abréviation position secondaire (ou null)
  annee_fin: number | null;  // annee_diplomation ; null = exclu du calcul
}

/** Un groupe = une plaque terrain. `positions` = abréviations agrégées.
 *  `key` est l'identité STABLE du slot (= team_position_needs.slot_key) : le
 *  `label` est renommable par le collège, il ne peut donc pas servir de clé, et
 *  un index de tableau casserait tous les ancrages au moindre réordonnancement.
 *  `acro` = initiales par défaut affichées SUR la plaque (l'éditeur les surcharge). */
export interface GroupDef {
  key: string;               // slug stable, unique par sport
  acro: string;              // initiales par défaut (≤3)
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
  /* Ces trois champs servent la page WEB, et elle seule. Ils avaient été
     retirés quand le terrain dessiné a remplacé la photo des DEUX côtés ; le
     web est revenu à sa photo en perspective, ils sont donc rétablis à
     l'identique. Le rendu MOBILE (TerrainStageMobile) ne les lit pas : son
     terrain est un plan 2D dessiné, choisi sur sportKey. */
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
export interface HeadCoach {
  nom: string;
  photoUrl: string | null;
  bio: string;
  /** Cadrage de la vignette, même modèle que le hero : `object-position` +
   *  `scale`. Absents → 50% 50% / 1, soit exactement le `cover` nu d'avant. */
  focal?: string | null;
  zoom?: number | null;
}

/** Style de la vignette coach — web et mobile, même fonction, deux cadres.
 *
 *  Au zoom 100 on n'émet AUCUN transform : `scale(1)` serait certes l'identité
 *  mathématique, mais il crée quand même un contexte d'empilement et promeut
 *  l'image en couche composée. Ne rien émettre est la seule façon de garantir
 *  que les photos déjà en ligne rendent au pixel près comme avant.
 *  `object-position: 50% 50%` est, lui, exactement le défaut du navigateur. */
export function coachPhotoStyle(hc: HeadCoach): CSSProperties {
  const focal = hc.focal ?? "50% 50%";
  const zoom = hc.zoom ?? 100;
  return zoom === 100
    ? { objectPosition: focal }
    : { objectPosition: focal, transform: `scale(${zoom / 100})`, transformOrigin: focal };
}
/** Fanion de palmarès (bannière plafond de gym). Le TYPE pilote la COULEUR
 *  (même forme fanion, 3 habits) : championnat = Principale · coupe =
 *  Foncée/Claire · banniere = rectangle sombre liseré (« retirée au plafond »). */
export type PennantType = "championnat" | "coupe" | "banniere";
export interface Pennant { titre: string; annee: number; type: PennantType; }
export interface TeamContent {
  // Alimente le slot `.lead` (l'accroche sous le titre, même style que la page
  // école). C'est le SEUL texte d'accroche réel dont l'équipe dispose : les
  // autres sections (calendrier, besoins, engagées) n'en ont pas et n'affichent
  // donc rien. Bloc 2 : si le coach saisit une accroche par section, l'ajouter
  // ici et la rendre en `.lead` — surtout pas de texte inventé en attendant.
  presentationText: string;  // texte libre coach (modéré Bloc 2)
  championships: number;     // fanions gagnés
  staffSince: number;        // année de mise en place du staff
  // null = aucun entraîneur-chef au staff de l'équipe → le bloc coach est absent
  // (PresentationSection le garde déjà). Jamais un nom vide affiché.
  headCoach: HeadCoach | null;
  staff: StaffMember[];
  palmares: Pennant[];       // fanions suspendus ; [] → aucun (l'espace se resserre)
}

/** Événement calendrier. `match` = AUTO (public.games, RSEQ) · `camp` = MANUEL
 *  (team_events, max 3 — mis en évidence). Les scores des matchs JOUÉS viennent
 *  de games ; absents (fixture, match à venir) → la tuile est rendue comme avant. */
export interface TeamEvent {
  type: "match" | "camp";
  date: string;               // ISO "YYYY-MM-DD" (comparaison lexicale, pas de fuseau)
  /** Intitulé saisi par le collège (camps uniquement, ≤ 40 car. en base). Vide
   *  ou absent → la tuile se replie sur « Camp de sélection ». */
  titre?: string;
  adversaire?: string;
  domicile: boolean;
  heure: string;
  lieu: string;
  scorePour?: number | null;   // score de CETTE équipe (match joué)
  scoreContre?: number | null; // score de l'adversaire
}

/** Une saison sélectionnable dans le calendrier.
 *
 *  IDENTITÉ INTER-SAISONS : `school_id + sport_id + gender`, division EXCLUE.
 *  Mesuré en base — sur les cégeps, les 30 identités présentes dans deux
 *  saisons portent toutes plus d'une division. Une équipe qui monte de D3 en
 *  D2 reste la même équipe pour qui regarde la page ; l'inclure dans la clé
 *  la couperait en deux au moment précis où l'historique devient intéressant.
 *
 *  D'où `division` ici : la pill l'affiche quand elle diffère d'une saison à
 *  l'autre, ce qui dit la promotion au lieu de la cacher. */
export interface TeamSeason {
  /** Libellé DB, ex. « 2026-2027 ». Sert de clé de sélection. */
  saison: string;
  /** L'id de la ligne `teams` de CETTE saison — les matchs y sont rattachés. */
  teamId: string;
  division: string | null;
  events: TeamEvent[];
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
  // id du collège — les cibles sont au niveau ÉCOLE (arbitrage D-1) : cibler
  // depuis une page équipe cible le cégep. Absent (fixtures) → le CTA reste
  // décoratif, aucune écriture.
  schoolId?: string | null;
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
  // Zoom du cadrage hero, en POURCENT (100 = image non zoomée). L'agrandissement
  // se fait autour du point focal — même réglage que l'éditeur. Absent → 100.
  heroZoom?: number | null;
  // Contenu éditorial (section Présentation). null → section absente.
  content?: TeamContent | null;
  // Calendrier (section Calendrier) — événements de la saison COURANTE.
  // Conservé pour les appelants qui ne fournissent pas `seasons` (mocks,
  // fixtures, aperçu éditeur) : le composant y retombe sans rien changer.
  events?: TeamEvent[] | null;
  /** Toutes les saisons de cette équipe, la plus récente en tête.
   *  Absent → le composant se rabat sur `events` et ne rend aucun sélecteur.
   *  Une seule entrée → pas de sélecteur non plus : une pill seule est du bruit. */
  seasons?: TeamSeason[] | null;
  // Recrues engagées (section « Déjà engagées »). [] / absent → section absente.
  commits?: Commit[] | null;
  // Sections masquées par le collège (team_page_content.hidden_sections) :
  // 'camps' | 'presentation' | 'besoins' | 'engagees'. La page publique SAUTE la
  // section — elle ne la grise pas. Absent → tout est visible (fixtures).
  hiddenSections?: string[] | null;
  // Besoins SAISIS par le collège (team_position_needs). null / [] → le moteur
  // dérivé du roster reste seul maître (comportement historique, fixtures
  // incluses). Une ligne existe → elle GAGNE sur le dérivé pour SON slot.
  needs?: TeamNeed[] | null;
}

/** Un slot de besoin édité par le collège (1 ligne team_position_needs).
 *  `slotKey` référence GroupDef.key — jamais un index, jamais le label. */
export interface TeamNeed {
  slotKey: string;
  facette: string;
  acronym: string;      // initiales sur la plaque (≤3)
  label: string;        // nom du groupe (≤24)
  positions: string[];  // abréviations public.positions — l'ancrage match parfait
  niveau: Niveau;
  pitch: string;        // message diffusé à l'athlète (≤80)
  hidden: boolean;      // plaque retirée du terrain (banque de l'éditeur)
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
          { key: "ol", acro: "OL", label: "LIGNE OFFENSIVE", positions: ["OL", "OT", "OG", "C"], left: 52, top: 56 },
          { key: "qb", acro: "QB", label: "QUART-ARRIÈRE", positions: ["QB"], left: 38, top: 72 },
          { key: "rb", acro: "RB", label: "PORTEURS", positions: ["RB", "FB"], left: 60, top: 82 },
          { key: "wr", acro: "WR", label: "RECEVEURS", positions: ["WR", "TE"], left: 15, top: 54 },
        ],
      },
      {
        key: "defense", label: "Défense",
        groups: [
          { key: "dl", acro: "DL", label: "LIGNE DÉFENSIVE", positions: ["DL", "DE", "DT"], left: 54, top: 58 },
          { key: "lb", acro: "LB", label: "SECONDEURS", positions: ["LB", "ILB", "OLB"], left: 44, top: 40 },
          { key: "cb", acro: "DB", label: "DEMIS", positions: ["CB"], left: 18, top: 30 },
          { key: "s", acro: "S", label: "MARAUDEURS", positions: ["S", "FS", "SS"], left: 66, top: 18 },
        ],
      },
      {
        key: "specialistes", label: "Spécialistes",
        // Pas dans la démo spec (2 facettes) — 3ᵉ facette imposée §6, coords écartées.
        groups: [
          { key: "ret", acro: "RET", label: "RETOURNEUR", positions: ["RET"], left: 50, top: 16 },
          { key: "ls", acro: "LS", label: "LONGUE REMISE", positions: ["LS"], left: 42, top: 60 },
          { key: "k", acro: "K", label: "BOTTEUR", positions: ["K"], left: 58, top: 72 },
          { key: "p", acro: "P", label: "BOTTEUR DÉG.", positions: ["P"], left: 46, top: 86 },
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
          { key: "c", acro: "C", label: "CENTRE", positions: ["C"], left: 50, top: 48 },
          { key: "qb", acro: "QB", label: "QUART-ARRIÈRE", positions: ["QB"], left: 44, top: 64 },
          { key: "rb", acro: "RB", label: "PORTEUR", positions: ["RB"], left: 64, top: 76 },
          { key: "wr", acro: "WR", label: "RECEVEUR", positions: ["WR"], left: 20, top: 40 },
        ],
      },
      {
        key: "defense", label: "Défense",
        groups: [
          { key: "ru", acro: "RU", label: "CHASSEUR", positions: ["RU"], left: 50, top: 44 },
          { key: "lb", acro: "LB", label: "SECONDEUR", positions: ["LB"], left: 38, top: 58 },
          { key: "db", acro: "DB", label: "DEMI DÉF.", positions: ["DB"], left: 28, top: 30 },
          { key: "s", acro: "S", label: "MARAUDEUR", positions: ["S"], left: 72, top: 30 },
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
          { key: "pg", acro: "PG", label: "MENEUR", positions: ["PG"], left: 50, top: 26 },
          { key: "sg", acro: "SG", label: "ARRIÈRE", positions: ["SG"], left: 26, top: 38 },
          { key: "sf", acro: "SF", label: "AILIER", positions: ["SF"], left: 74, top: 38 },
          { key: "pf", acro: "PF", label: "AILIER FORT", positions: ["PF"], left: 36, top: 64 },
          { key: "c", acro: "C", label: "PIVOT", positions: ["C"], left: 56, top: 70 },
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
          { key: "c", acro: "C", label: "CENTRE", positions: ["C"], left: 50, top: 28 },
          { key: "lw", acro: "AG", label: "AILIER G", positions: ["LW"], left: 22, top: 32 },
          { key: "rw", acro: "AD", label: "AILIER D", positions: ["RW"], left: 78, top: 32 },
          { key: "ld", acro: "DG", label: "DÉFENSEUR G", positions: ["LD"], left: 34, top: 58 },
          { key: "rd", acro: "DD", label: "DÉFENSEUR D", positions: ["RD"], left: 66, top: 58 },
          { key: "g", acro: "G", label: "GARDIEN", positions: ["G"], left: 50, top: 84 },
        ],
      },
    ],
  },
  baseball: {
    perspective: true,
    asset: "/terrains/baseball.jpg",
    // TROIS FACETTES, découpées par ZONE. Les neuf postes du baseball sont tous
    // défensifs et simultanés — il n'y a pas d'offense/défense à opposer comme
    // au football. Ils ne tiennent simplement pas ensemble en portrait : à
    // 354×430, neuf plaques de 96×80 recouvrent le terrain et se chevauchent
    // quatre fois. Les left/top ne changent PAS, ils étaient justes ; c'est
    // leur nombre simultané qui ne l'était pas.
    facettes: [
      {
        key: "batterie", label: "Batterie",
        groups: [
          { key: "p", acro: "P", label: "LANCEUR", positions: ["P"], left: 50, top: 62 },
          { key: "c", acro: "C", label: "RECEVEUR", positions: ["C"], left: 50, top: 88 },
        ],
      },
      {
        key: "avantchamp", label: "Avant-champ",
        groups: [
          // Les paires qui se touchaient sont les DIAGONALES — SS×3B et 2B×1B,
          // séparées de 12 % en largeur et 16 % en hauteur, sous les deux
          // seuils. Écarter les rangées horizontalement n'y changeait rien :
          // c'est le pas VERTICAL qui manquait. 30/70 et 18/82 dégagent les
          // paires latérales, top 40 → 64 dégage les diagonales (Δ24 ≥ 21).
          { key: "ss", acro: "SS", label: "ARRÊT-COURT", positions: ["SS"], left: 30, top: 40 },
          { key: "2b", acro: "2B", label: "2E BUT", positions: ["2B"], left: 70, top: 40 },
          { key: "3b", acro: "3B", label: "3E BUT", positions: ["3B"], left: 18, top: 64 },
          { key: "1b", acro: "1B", label: "1ER BUT", positions: ["1B"], left: 82, top: 64 },
        ],
      },
      {
        key: "champext", label: "Champ extérieur",
        groups: [
          { key: "cf", acro: "CF", label: "VOLTIGEUR CENTRE", positions: ["CF"], left: 50, top: 16 },
          { key: "lf", acro: "LF", label: "VOLTIGEUR GAUCHE", positions: ["LF"], left: 22, top: 26 },
          { key: "rf", acro: "RF", label: "VOLTIGEUR DROIT", positions: ["RF"], left: 78, top: 26 },
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
          { key: "att", acro: "ATT", label: "ATTAQUANTS", positions: ["RW", "LW", "CF", "ST"], left: 50, top: 22 },
          { key: "mil", acro: "MIL", label: "MILIEUX", positions: ["CDM", "CM", "RM", "LM", "CAM"], left: 50, top: 46 },
          { key: "def", acro: "DEF", label: "DÉFENSEURS", positions: ["CB", "RB", "LB", "RWB", "LWB"], left: 50, top: 68 },
          { key: "gk", acro: "GK", label: "GARDIEN", positions: ["GK"], left: 50, top: 87 },
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
          { key: "mb", acro: "MB", label: "CENTRAL", positions: ["MB"], left: 50, top: 28 },
          { key: "oh", acro: "OH", label: "AILIER", positions: ["OH"], left: 24, top: 34 },
          { key: "opp", acro: "OPP", label: "POINTU", positions: ["OPP"], left: 76, top: 34 },
          { key: "set", acro: "P", label: "PASSEUR", positions: ["P"], left: 62, top: 60 },
          { key: "lib", acro: "L", label: "LIBÉRO", positions: ["L", "DS"], left: 36, top: 66 },
        ],
      },
    ],
  },
} satisfies Record<string, SportConfig>;

/* ── Moteur besoins ────────────────────────────────────────────────────────── */

const levelOf = (departures: number): Level =>
  departures === 0 ? "full" : departures === 1 ? "mid" : departures === 2 ? "hi" : "pri";

export interface Plaque { acro: string; label: string; left: number; top: number; level: Level; levelLabel: string; }
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
    plaques.push({ acro: g.acro, label: g.label, left: g.left, top: g.top, level, levelLabel: LEVEL_LABEL[level] });
    if (departures > 0) {
      cards.push({
        label: g.label, level, places: departures,
        depText: `${departures} départ${departures > 1 ? "s" : ""} sur ${effectif}`,
      });
    }
  }
  return { plaques, cards };
}

/** Index des besoins saisis, par slot_key (vide = aucun besoin édité). */
export function needsBySlot(team: TeamData): Map<string, TeamNeed> {
  return new Map((team.needs ?? []).map((n) => [n.slotKey, n]));
}

/** Besoins d'une facette, ÉDITEUR PRIORITAIRE.
 *  - aucune ligne saisie pour l'équipe → strictement `deriveFacette` (le
 *    comportement historique, fixtures comprises : rien ne bouge) ;
 *  - une ligne existe pour un slot → elle gagne (initiales, nom, niveau) ;
 *  - `hidden` → la plaque disparaît du terrain (banque côté éditeur). */
export function resolveFacette(
  team: TeamData,
  groups: readonly GroupDef[],
  season: number,
): { plaques: Plaque[]; cards: NeedCard[] } {
  const manual = needsBySlot(team);
  const base = deriveFacette(team.roster, groups, season);
  if (manual.size === 0) return base;

  const plaques: Plaque[] = [];
  const cards: NeedCard[] = [];
  groups.forEach((g, i) => {
    const n = manual.get(g.key);
    if (n?.hidden) return;
    const p = base.plaques[i];
    const level = n ? NIVEAU_TO_LEVEL[n.niveau] : p.level;
    plaques.push({
      acro: (n?.acronym || g.acro),
      label: (n?.label || g.label),
      left: g.left, top: g.top,
      level, levelLabel: LEVEL_LABEL[level],
    });
    const c = base.cards.find((x) => x.label === g.label);
    if (c) cards.push({ ...c, label: n?.label || c.label, level });
  });
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
  | {
      kind: "match"; posLabel: string; posLabelPlural: string; departures: number; effectif: number;
      /** Message du collège (besoin saisi) — remplace la phrase dérivée. */
      pitch?: string;
      /** Niveau saisi → intensité visuelle du bandeau. Absent = chemin dérivé. */
      level?: Level;
    }
  | { kind: "none" }
  | null;

/** Match parfait SAISI : une plaque visible, de niveau ≥ MOYEN, dont l'ancrage
 *  contient le poste de l'athlète (principal d'abord, puis secondaire). C'est le
 *  contrat éditeur — le pitch du collège est le message diffusé. */
function manualMatch(team: TeamData, season: number): MatchState | null {
  const needs = (team.needs ?? []).filter((n) => !n.hidden && n.niveau !== "complet");
  if (needs.length === 0) return null;
  const v = team.viewer!;
  const find = (code: string) => needs.find((n) => n.positions.includes(code));
  const n = find(v.pos) ?? (v.pos2 ? find(v.pos2) : undefined);
  if (!n) return null;
  const players = team.roster.filter((p) => n.positions.includes(p.pos) && p.annee_fin != null);
  return {
    kind: "match",
    posLabel: v.posLabel, posLabelPlural: v.posLabelPlural,
    departures: players.filter((p) => p.annee_fin === season).length,
    effectif: players.length,
    pitch: n.pitch || undefined,
    level: NIVEAU_TO_LEVEL[n.niveau],
  };
}

export function matchState(team: TeamData, season: number): MatchState {
  const v = team.viewer;
  if (!v || v.sport !== team.sportNom) return null; // non connecté / autre sport
  // Besoins saisis prioritaires ; sinon moteur dérivé du roster (inchangé).
  const manual = manualMatch(team, season);
  if (manual) return manual;
  if ((team.needs ?? []).length > 0) return { kind: "none" }; // édité, mais pas à ce poste
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
