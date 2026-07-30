// components/page-editor/fixture.ts
//
// Mock fixture + catalogues Nexus pour l'éditeur « Ma page » v2 (Bloc 1).
// TOUTES les valeurs viennent du gabarit docs/reference/editeur-page-cegep-mock.html
// (Collège André-Grasset, spec v2 89207d72). Zéro donnée inventée. State local
// only — aucune écriture DB (Bloc 2).

/* ── S1 — tuiles-mots (catalogue 14, ALLEZ/ENSEMBLE/ÉLITE/BOL D'OR en tête) ── */
export const WORDS = [
  "ALLEZ", "ENSEMBLE", "ÉLITE", "BOL D'OR", "LA TRIBU", "DEPUIS 1927", "GO GO GO",
  "CHAMPIONS", "LA FAMILLE", "LA MEUTE", "TOUJOURS PLUS", "UNIS", "LA RELÈVE", "ICI ON GAGNE",
];

/* ── S3 — suggestions de cartes campus (clic → carte pré-titrée) ── */
export const SUGG = [
  "Installations", "Résidences & hébergement", "Encadrement sport-études",
  "Plateaux partenaires", "Vie étudiante", "Cafétéria", "Clinique physio",
  "Salle vidéo & tactique", "Salle de musculation", "Bibliothèque",
];

export interface HousingItem { v: string; l: string }
export const HOUSING: HousingItem[] = [
  { v: "campus", l: "Résidence étudiante sur campus" },
  { v: "partner", l: "Résidence partenaire à proximité" },
  { v: "pension", l: "Ententes de pension (familles)" },
  { v: "none", l: "Aucun hébergement offert" },
];

// Fiche campus — seedée par Nexus, non éditable (correction via mailto).
export const FICHE: [string, string][] = [
  ["Langue", "Francophone"], ["Statut", "Privé"], ["Région", "Montréal"],
];
export const ADDRESS = { line1: "1001, boul. Crémazie Est", line2: "Montréal (Québec) H2M 1M3" };

export const DEC = [
  "Sciences de la nature", "Sciences humaines", "Sciences, lettres et arts",
  "Soins infirmiers", "Techniques policières", "Techniques de l'informatique",
  "Techniques d'éducation spécialisée", "Techniques de comptabilité et gestion",
  "Techniques de physiothérapie", "Arts, lettres et communication",
  "Administration générale", "Génie mécanique",
];

export const ENC = [
  "Alliance Sport-Études", "Tuteurs dédiés", "Horaires adaptés",
  "Suivi académique personnalisé", "Conciliation examens-compétitions",
];

export const UNIS = [
  "Université de Montréal", "Université Laval", "McGill", "Concordia", "UQAM",
  "Sherbrooke", "UQTR", "UQAC", "Bishop's", "ÉTS",
];

export const PROVINCES = ["Québec", "Ontario", "Canada"];

// S2 — L'affiche : DÉRIVÉE des équipes (seed RSEQ). Statique/verrouillé ici.
export interface AfficheRow { sport: string; pills: string[] }
export const SPORTS_AFFICHE: AfficheRow[] = [
  { sport: "FOOTBALL", pills: ["D1", "M", "1 ÉQUIPE"] },
  { sport: "HOCKEY", pills: ["D2", "M", "1 ÉQUIPE"] },
  { sport: "FLAG FOOTBALL", pills: ["D2 · D3", "F · M", "2 ÉQUIPES"] },
  { sport: "VOLLEYBALL", pills: ["D3", "M · F", "2 ÉQUIPES"] },
];

// S8 — Généré par Nexus (plateforme, runtime).
export interface PlatformChip { ic: string; b: string; t: string }
export const PLATFORM: PlatformChip[] = [
  { ic: "👁", b: "Vues de ta page", t: "tracking runtime" },
  { ic: "❤", b: "« X athlètes suivent ce collège »", t: "agrégat cibles" },
  { ic: "🎯", b: "Strip « Recrutés via Nexus »", t: "compteur plateforme" },
  { ic: "🧭", b: "Match programme visé", t: "profil de l'athlète" },
];

/* ── Fixture Grasset (valeurs initiales du gabarit v2) ────────────────────── */
export const GRASSET = {
  schoolName: "Collège André-Grasset",
  statEquipes: 13,
  identity: {
    nick: "PHÉNIX",
    slog: "Phénix un jour, Phénix toujours",
    tagline: "élite collégiale",
    prov: "Québec",
    tick: "",
    ville: "MONTRÉAL",
    quartier: "AHUNTSIC",
    rtag: "514",
    c1: "#A6192E", c2: "#5A0E1B", c3: "#E8C7CD",
    init: "AG",
    vword: "GRASSET",
    dev1: "FIER", dev2: "FORT",
    fla: "D'ICI", flb: "POUR ICI",
    words: [0, 1, 2, 3] as number[],
    nbath: "250+",
  },
  about: {
    title: "Plus qu'un cégep",
    text:
      "Chez les Phénix, tu rejoins une famille qui gagne sur le terrain et en classe. Encadrement complet, installations pro, et une tradition d'excellence depuis 1927.",
  },
  campusCard: { t: "Installations Phénix", x: "Gymnase double, salle de musculation dédiée." },
  // pfree (mot du programme) SUPPRIMÉ v3 : aucun slot sur la page. Bloc 2 :
  // parcours_free_text ne va PAS au schéma.
  parcours: {
    pniv: "Division 1",
    recrutes: 31,
    pus: "11",
    pdip: "90",
    pusa: "3",
    enc: [0, 2] as number[],
    unis: [0, 1, 2] as number[],
  },
  news: [{ t: "Les Phénix champions du Bol d'Or", u: "https://rds.ca/article" }],
  // programsStar SUPPRIMÉ v3 : ★ « en vedette » retiré (Bloc 2 : featured hors schéma).
  programsOn: [0, 1, 5] as number[],
};
