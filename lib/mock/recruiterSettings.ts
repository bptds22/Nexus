import type { RecruiterSettings } from "@/lib/types/models";

/* ══════════════════════════════════════════════════════════════
   CÉGEP LIST — 54 établissements RSEQ
══════════════════════════════════════════════════════════════ */

export interface CegepEntry {
  id: string;
  name: string;
  region: string;
  campuses?: { id: string; label: string }[];
}

export const CEGEP_LIST: CegepEntry[] = [
  { id: "ceg-01", name: "Cégep de l'Abitibi-Témiscamingue", region: "Abitibi-Témiscamingue", campuses: [{ id: "c-01a", label: "Rouyn-Noranda" }, { id: "c-01b", label: "Val-d'Or" }, { id: "c-01c", label: "Amos" }] },
  { id: "ceg-02", name: "Cégep d'Ahuntsic", region: "Montréal" },
  { id: "ceg-03", name: "Cégep André-Laurendeau", region: "Montérégie" },
  { id: "ceg-04", name: "Cégep de Baie-Comeau", region: "Côte-Nord" },
  { id: "ceg-05", name: "Cégep Beauce-Appalaches", region: "Chaudière-Appalaches" },
  { id: "ceg-06", name: "Cégep de Bois-de-Boulogne", region: "Montréal" },
  { id: "ceg-07", name: "Collège de Bois-de-Boulogne", region: "Montréal" },
  { id: "ceg-08", name: "Champlain Regional College", region: "Montérégie", campuses: [{ id: "c-08a", label: "Lennoxville" }, { id: "c-08b", label: "Saint-Lambert" }, { id: "c-08c", label: "St. Lawrence" }] },
  { id: "ceg-09", name: "Cégep de Chicoutimi", region: "Saguenay–Lac-Saint-Jean" },
  { id: "ceg-10", name: "Dawson College", region: "Montréal" },
  { id: "ceg-11", name: "Cégep de Drummondville", region: "Centre-du-Québec" },
  { id: "ceg-12", name: "Cégep Édouard-Montpetit", region: "Montérégie" },
  { id: "ceg-13", name: "Cégep François-Xavier-Garneau", region: "Capitale-Nationale" },
  { id: "ceg-14", name: "Cégep de la Gaspésie et des Îles", region: "Gaspésie–Îles-de-la-Madeleine", campuses: [{ id: "c-14a", label: "Gaspé" }, { id: "c-14b", label: "Carleton-sur-Mer" }, { id: "c-14c", label: "Îles-de-la-Madeleine" }] },
  { id: "ceg-15", name: "Cégep de Granby", region: "Montérégie" },
  { id: "ceg-16", name: "Heritage College", region: "Outaouais" },
  { id: "ceg-17", name: "John Abbott College", region: "Montréal" },
  { id: "ceg-18", name: "Cégep de Jonquière", region: "Saguenay–Lac-Saint-Jean" },
  { id: "ceg-19", name: "Cégep régional de Lanaudière", region: "Lanaudière", campuses: [{ id: "c-19a", label: "Joliette" }, { id: "c-19b", label: "L'Assomption" }, { id: "c-19c", label: "Terrebonne" }] },
  { id: "ceg-20", name: "Cégep de La Pocatière", region: "Bas-Saint-Laurent" },
  { id: "ceg-21", name: "Cégep de Lévis", region: "Chaudière-Appalaches" },
  { id: "ceg-22", name: "Cégep Limoilou", region: "Capitale-Nationale", campuses: [{ id: "c-22a", label: "Campus de Québec" }, { id: "c-22b", label: "Campus de Charlesbourg" }] },
  { id: "ceg-23", name: "Cégep Lionel-Groulx", region: "Laurentides" },
  { id: "ceg-24", name: "Cégep de Maisonneuve", region: "Montréal" },
  { id: "ceg-25", name: "Cégep Marie-Victorin", region: "Montréal" },
  { id: "ceg-26", name: "Cégep de Matane", region: "Bas-Saint-Laurent" },
  { id: "ceg-27", name: "Cégep Montmorency", region: "Laval" },
  { id: "ceg-28", name: "Cégep de l'Outaouais", region: "Outaouais" },
  { id: "ceg-29", name: "Cégep de Rimouski", region: "Bas-Saint-Laurent" },
  { id: "ceg-30", name: "Cégep de Rivière-du-Loup", region: "Bas-Saint-Laurent" },
  { id: "ceg-31", name: "Cégep de Rosemont", region: "Montréal" },
  { id: "ceg-32", name: "Cégep de Saint-Félicien", region: "Saguenay–Lac-Saint-Jean" },
  { id: "ceg-33", name: "Cégep de Saint-Hyacinthe", region: "Montérégie" },
  { id: "ceg-34", name: "Cégep Saint-Jean-sur-Richelieu", region: "Montérégie" },
  { id: "ceg-35", name: "Cégep de Saint-Jérôme", region: "Laurentides" },
  { id: "ceg-36", name: "Cégep de Saint-Laurent", region: "Montréal" },
  { id: "ceg-37", name: "Cégep de Sainte-Foy", region: "Capitale-Nationale" },
  { id: "ceg-38", name: "Cégep de Sept-Îles", region: "Côte-Nord" },
  { id: "ceg-39", name: "Cégep de Sherbrooke", region: "Estrie" },
  { id: "ceg-40", name: "Cégep de Sorel-Tracy", region: "Montérégie" },
  { id: "ceg-41", name: "Cégep de Thetford", region: "Chaudière-Appalaches" },
  { id: "ceg-42", name: "Cégep de Trois-Rivières", region: "Mauricie" },
  { id: "ceg-43", name: "Cégep de Valleyfield", region: "Montérégie" },
  { id: "ceg-44", name: "Vanier College", region: "Montréal" },
  { id: "ceg-45", name: "Cégep de Victoriaville", region: "Centre-du-Québec" },
  { id: "ceg-46", name: "Cégep du Vieux Montréal", region: "Montréal" },
  { id: "ceg-47", name: "Collège André-Grasset", region: "Montréal" },
  { id: "ceg-48", name: "Collège Jean-de-Brébeuf", region: "Montréal" },
  { id: "ceg-49", name: "Collège Laflèche", region: "Mauricie" },
  { id: "ceg-50", name: "Collège Mérici", region: "Capitale-Nationale" },
  { id: "ceg-51", name: "Collège O'Sullivan de Montréal", region: "Montréal" },
  { id: "ceg-52", name: "Collège Stanislas", region: "Montréal" },
  { id: "ceg-53", name: "Marianopolis College", region: "Montréal" },
  { id: "ceg-54", name: "Collège LaSalle", region: "Montréal" },
];

/* ══════════════════════════════════════════════════════════════
   SPORTS RSEQ — used for recruiter sport selection
══════════════════════════════════════════════════════════════ */

export const RSEQ_SPORTS = [
  "Athlétisme", "Badminton", "Baseball", "Basketball", "Cheerleading",
  "Cross-country", "Danse", "Flag football", "Escrime", "Football",
  "Futsal", "Golf", "Gymnastique", "Hockey", "Judo", "Karaté", "Natation",
  "Rugby", "Ski alpin", "Ski de fond", "Soccer", "Softball", "Tennis",
  "Tennis de table", "Ultimate frisbee", "Volleyball", "Water-polo",
];

/* ══════════════════════════════════════════════════════════════
   REGIONS ADMIN. DU QUÉBEC
══════════════════════════════════════════════════════════════ */

export const QC_REGIONS = [
  "Bas-Saint-Laurent", "Saguenay–Lac-Saint-Jean", "Capitale-Nationale",
  "Mauricie", "Estrie", "Montréal", "Outaouais", "Abitibi-Témiscamingue",
  "Côte-Nord", "Nord-du-Québec", "Gaspésie–Îles-de-la-Madeleine",
  "Chaudière-Appalaches", "Laval", "Lanaudière", "Laurentides",
  "Montérégie", "Centre-du-Québec",
];

/* ══════════════════════════════════════════════════════════════
   PROGRAMMES CÉGEP
══════════════════════════════════════════════════════════════ */

export const CEGEP_PROGRAMS = [
  { id: "prog-01", label: "Sciences de la nature" },
  { id: "prog-02", label: "Sciences humaines" },
  { id: "prog-03", label: "Arts, lettres et communication" },
  { id: "prog-04", label: "Sciences informatiques et mathématiques" },
  { id: "prog-05", label: "Histoire et civilisation" },
  { id: "prog-06", label: "Techniques policières" },
  { id: "prog-07", label: "Soins infirmiers" },
  { id: "prog-08", label: "Techniques de comptabilité et de gestion" },
  { id: "prog-09", label: "Éducation spécialisée" },
  { id: "prog-10", label: "Génie civil" },
  { id: "prog-11", label: "Génie mécanique" },
  { id: "prog-12", label: "Informatique" },
  { id: "prog-13", label: "Techniques d'éducation à l'enfance" },
  { id: "prog-14", label: "Design d'intérieur" },
  { id: "prog-15", label: "Électronique industrielle" },
];

/* ══════════════════════════════════════════════════════════════
   MOCK RECRUITER SETTINGS
══════════════════════════════════════════════════════════════ */

export const mockRecruiterSettings: RecruiterSettings = {
  accountId: "rec-001",
  firstName: "Pierre",
  lastName: "Dufour",
  email: "p.dufour@cegep-garneau.qc.ca",
  phone: "(418) 555-0147",
  avatarUrl: "",
  locale: "fr",
  cegepId: "ceg-13",
  roleTitle: "Coordonnateur sportif",
  sportIds: ["Football"],
  divisions: ["D1"],
  programIds: ["prog-01", "prog-02", "prog-06"],
  targetRegions: ["Capitale-Nationale", "Chaudière-Appalaches", "Mauricie"],
  targetGradYears: [2027, 2028],
  targetPositions: ["QB", "WR", "OL"],
  minMoyenne: 75,
  minCoteGlobale: 3.0,
  alertNewProfiles: true,
  notifications: {
    newAthleteInSport: { inApp: true, email: true },
    favoriteUpdated: { inApp: true, email: false },
    coachResponse: { inApp: true, email: true },
    scoutingReport: { inApp: true, email: false },
    letterOfIntentSigned: { inApp: true, email: true },
    profileVerified: { inApp: true, email: false },
    weeklyDigest: false,
    emailFrequency: "realtime",
  },
  visibility: {
    profileVisible: true,
    showConsultationHistory: true,
    showFullName: true,
  },
  accountStatus: "active",
};
