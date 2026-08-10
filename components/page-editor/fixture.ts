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

// FICHE et ADDRESS retirées : elles affichaient « Francophone · Privé ·
// Montréal » et « 1001, boul. Crémazie Est » — la fiche de Grasset — à tous
// les collèges. CampusSection lit désormais schools.langue/reseau/region/
// address de l'école connectée.

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

// SPORTS_AFFICHE retirée : quatre rangées de Grasset affichées à tous les
// collèges sous un bandeau « dérivé de tes équipes » qui ne dérivait rien.
// SportsAffiche.tsx interroge maintenant `teams` et passe par sportsFromTeams,
// la même fonction que la page publique.

// S8 — Généré par Nexus (plateforme, runtime).
export interface PlatformChip { ic: string; b: string; t: string }
export const PLATFORM: PlatformChip[] = [
  { ic: "👁", b: "Vues de ta page", t: "tracking runtime" },
  { ic: "❤", b: "« X athlètes suivent ce collège »", t: "agrégat cibles" },
  { ic: "🎯", b: "Strip « Recrutés via Nexus »", t: "compteur plateforme" },
  { ic: "🧭", b: "Match programme visé", t: "profil de l'athlète" },
];
/* GRASSET (fixture v2 : nom, PHÉNIX, MONTRÉAL/AHUNTSIC, 514, #A6192E, AG,
   250+ athlètes, 31 recrutés…) a été SUPPRIMÉE — plus aucun import, et une
   école réelle en dur dans un fichier partagé finit toujours par s'afficher
   chez une autre. Voir la règle en tête de pageBridge.ts. */
