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
import type { ProgramPageContent } from "@/components/program-page/content";

/** Identifiants RÉELS (public.schools) des deux collèges couverts par ces
 *  fixtures. Ils servent à construire les routes publiques
 *  `/college/<school_id>/<team_id>` de « L'affiche ». Ce ne sont pas des
 *  identifiants de fixture : `SchoolProgramIdentity.id` reste un slug. */
const GRASSET_ID = "05841265-fd61-466e-b431-2caa7ec06de9";
const MOMO_ID = "ee2d611c-d140-417c-bbaf-d6353a7a1229";

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

// ── Niveau-1 page content (MOCK this ticket — real bindings = Bloc 2). ─────────
// Keyed by school id. Grasset = verbatim from page-niveau1-web-v7.html; Momo =
// green variant (Collège Montmorency / Nomades).
export const programPageContent: Record<string, ProgramPageContent> = {
  "andre-grasset": {
    ticker: [
      { text: "PHÉNIX" }, { text: "ANDRÉ-GRASSET", hot: true }, { text: "DIVISION 1" },
      { text: "RSEQ", hot: true }, { text: "MONTRÉAL" }, { text: "ON MONTE", hot: true },
      { text: "RENTRÉE 2027" }, { text: "BOL D'OR", hot: true },
    ],
    stats: { teams: 13, teamsLabel: "ÉQUIPES PHÉNIX", athletes: 250, athletesLabel: "ÉTUDIANTS-ATHLÈTES", region: "AHUNTSIC · QC" },
    // Campus carousel (MOCK — image null → neutral fallback ; recruiter upload = Bloc 2).
    campusCards: [
      { image: null, titre: "Installations Phénix", legende: "Gymnase double, salle de musculation dédiée." },
      { image: null, titre: "Résidences & hébergement", legende: "Résidence à proximité, ententes de pension." },
      { image: null, titre: "Encadrement sport-études", legende: "Horaires adaptés, tuteurs, suivi académique." },
      { image: null, titre: "Plateaux partenaires", legende: "Claude-Robillard, stade de soccer, aréna." },
      { type: "video", youtubeUrl: null },
    ],
    language: "FR",
    schoolType: "PRIVÉ",
    region: "Montréal",
    address: "1001, boul. Crémazie Est · Métro Crémazie à 5 min",
    mapQuery: "Collège André-Grasset, 1001 Boulevard Crémazie Est, Montréal",
    housing: { type: "pension", note: "Résidence étudiante à proximité et ententes de pension pour les athlètes de l'extérieur de Montréal." },
    facts: [
      { title: "Installations Phénix", text: "Gymnase double, salle de musculation dédiée aux équipes, terrain extérieur." },
      { title: "Encadrement sport-études", text: "Horaires adaptés, tuteurs, suivi académique pour chaque étudiant-athlète." },
    ],
    // Sports « L'affiche » — vraies données Grasset (MOCK).
    // url = `/college/<school_id>/<team_id>` avec des uuid RÉELS lus en base.
    // Une entrée n'est câblée que si une équipe DB correspond EXACTEMENT
    // (sport + division + genre) ; sinon "" = rangée non cliquable, jamais une
    // correspondance approchée. Les quasi-correspondances sont listées dans le
    // rapport du chantier, pas devinées ici.
    sports: [
      { nom: "Football", equipes: [{ nom: "Football", division: "D1", genre: "M", url: `/college/${GRASSET_ID}/2ab40855-bf1a-4fca-be9d-3f6a4f1cc7f3` }] },
      { nom: "Soccer", equipes: [
        // DB : « Soccer intérieur » existe en M et en F, division NULL — aucune
        // équipe unique ne correspond à cette entrée M&F.
        { nom: "Soccer intérieur", division: "D2", genre: "M&F", url: "" },
        { nom: "Soccer extérieur", division: "D3", genre: "F", url: "" },
      ] },
      { nom: "Flag football", equipes: [
        { nom: "Flag féminin", division: "D2", genre: "F", url: `/college/${GRASSET_ID}/cce28a88-bb5e-47e6-8991-103f09e9cea5` },
        { nom: "Flag masculin", division: "D3", genre: "M", url: `/college/${GRASSET_ID}/73bb10ab-839c-46f6-b5c6-90cfb88bf76b` },
      ] },
      { nom: "Volleyball", equipes: [
        { nom: "Volleyball masculin", division: "D3", genre: "M", url: "" }, // aucune équipe masculine en base
        { nom: "Volleyball féminin", division: "D3", genre: "F", url: `/college/${GRASSET_ID}/b19df231-ab99-44af-aced-9dcc0860d558` },
      ] },
      { nom: "Hockey", equipes: [{ nom: "Hockey", division: "D2", genre: "M", url: "" }] },
      { nom: "Basketball", equipes: [{ nom: "Basketball", division: "D3", genre: "M", url: "" }] },
      { nom: "Cross-country", equipes: [{ nom: "Cross-country", division: null, genre: "Mixte", url: "" }] },
      { nom: "Tennis", equipes: [{ nom: "Tennis", division: null, genre: "Mixte", url: "" }] },
      // DB : le sport s'appelle « Ultimate frisbee », même équipe.
      { nom: "Ultimate", equipes: [{ nom: "Ultimate", division: null, genre: "Mixte", url: `/college/${GRASSET_ID}/113c4f7e-d86e-4ad1-9d37-f68806865e19` }] },
    ],
    sellTitle: "Plus qu'un cégep",
    sellText:
      "Au Phénix, on ne choisit pas entre <b>gagner</b> et <b>graduer</b>. Depuis 1927, André-Grasset forme des étudiants-athlètes qui dominent le RSEQ <span class=\"hl\">et</span> entrent dans leur premier choix universitaire. Petites cohortes, encadrement serré, culture d'équipe — <b>ici, tu n'es pas un numéro, tu es un Phénix.</b> Et quand tu portes le rouge, c'est pour les deux : le palmarès et le diplôme.",
    videoUrl: null,
    featuredPrograms: [
      { title: "Sciences de la nature", blurb: "Le tremplin vers médecine et génie — horaire pensé pour les entraînements." },
      { title: "Sciences humaines", blurb: "Admin, droit, psycho — les profils les plus recrutés par les universités." },
      { title: "Alliance Sport-Études", blurb: "Statut reconnu, conciliation officielle, encadrement individualisé." },
    ],
    programsList: [
      "Sciences de la nature", "Sc. humaines — Administration", "Sc. humaines — Individu", "Sc. humaines — Monde",
      "Arts, lettres et communication", "Sciences informatiques et math", "Double DEC", "Cheminement Sport-Études",
      "Soins infirmiers", "Techniques policières", "Techniques de l'informatique", "Comptabilité et gestion",
      "Éducation à l'enfance", "Physiothérapie",
    ],
    route: {
      stop1: { sl: "AUJOURD'HUI · SECONDAIRE", h4: "Ton profil Nexus", p: "Stats, vidéos, bulletins — tout ce que les coachs du Phénix veulent voir." },
      stop2: { sl: "2027–2029 · ANDRÉ-GRASSET", h4: "Tu portes le rouge", p: "Division 1, 250 étudiants-athlètes, encadrement sport-études." },
      stop3: {
        sl: "ENSUITE · U SPORTS", h4: "Tu montes encore",
        stats: [
          { count: 24, label: "RECRUTÉS DEPUIS 2020" }, { count: 9, label: "EN U SPORTS" }, { count: 92, suffix: "%", label: "DIPLOMATION" },
        ],
      },
    },
    universities: ["U. DE MONTRÉAL", "LAVAL", "McGILL", "CONCORDIA", "SHERBROOKE"],
    nexusStripText: "Des athlètes du secondaire ont rejoint le Phénix grâce à leur profil Nexus — vus, évalués, recrutés.",
    nexusRecruitedCount: 12,
    // News — saisie manuelle (MOCK — Bloc 2). url "#" = placeholder.
    news: [
      { source: "GRASSET.QC.CA", titre: "Nouveau stade extérieur inauguré", url: "#" },
      { source: "GRASSET.QC.CA", titre: "Le Phénix football champion D1", url: "#" },
      { source: "GRASSET.QC.CA", titre: "Camps de sélection hockey — dates", url: "#" },
    ],
    // MOCK viewer (Bloc 2 = vrai athlete.programmeVise) → correspond à "Techniques policières"
    viewerProgrammeVise: "Techniques policières",
    ctaTitle: "André-Grasset",
    ctaNotifyName: "Grasset",
  },

  montmorency: {
    ticker: [
      { text: "NOMADES" }, { text: "MONTMORENCY", hot: true }, { text: "DIVISION 1" },
      { text: "RSEQ", hot: true }, { text: "LAVAL" }, { text: "ON MONTE", hot: true },
      { text: "RENTRÉE 2027" }, { text: "BOL D'OR", hot: true },
    ],
    stats: { teams: 15, teamsLabel: "ÉQUIPES NOMADES", athletes: 420, athletesLabel: "ÉTUDIANTS-ATHLÈTES", region: "LAVAL-DES-RAPIDES · QUÉBEC" },
    language: "FR",
    schoolType: "PUBLIC",
    region: "Laval",
    address: "475, boul. de l'Avenir · Métro Montmorency (terminus)",
    mapQuery: "Collège Montmorency, 475 Boulevard de l'Avenir, Laval",
    housing: { type: "partner", note: "Ententes avec des résidences partenaires à distance de marche pour les athlètes de l'extérieur de Laval." },
    facts: [
      { title: "Complexe sportif", text: "Trois gymnases, piscine, salle de musculation et terrains extérieurs." },
      { title: "Encadrement sport-études", text: "Horaires adaptés, tuteurs, suivi académique pour chaque étudiant-athlète." },
    ],
    // Sports « L'affiche » — MOCK Montmorency. Même règle que Grasset :
    // uuid réel sur correspondance EXACTE sport + division + genre, sinon "".
    sports: [
      { nom: "Basketball", equipes: [
        { nom: "Basketball masculin", division: "D1", genre: "M", url: `/college/${MOMO_ID}/3953215b-c804-44b7-9b2b-5840bfd7ff4a` },
        { nom: "Basketball féminin", division: "D1", genre: "F", url: `/college/${MOMO_ID}/5c0786b0-04bd-46e6-931b-ec9d6f1cb6ae` },
      ] },
      { nom: "Soccer", equipes: [
        { nom: "Soccer masculin", division: "D1", genre: "M", url: `/college/${MOMO_ID}/c82c1e5b-49fc-4d54-8b29-f45dab8febf8` },
        { nom: "Soccer féminin", division: "D1", genre: "F", url: `/college/${MOMO_ID}/48d24c96-974f-42bb-8dab-c7b9f2a89bbc` },
      ] },
      { nom: "Volleyball", equipes: [
        // DB : Volleyball est en D2, pas en D1 — pas de correspondance exacte.
        { nom: "Volleyball masculin", division: "D1", genre: "M", url: "" },
        { nom: "Volleyball féminin", division: "D1", genre: "F", url: "" },
      ] },
      { nom: "Football", equipes: [{ nom: "Football", division: "D2", genre: "M", url: `/college/${MOMO_ID}/2132b681-1c73-4e88-ab22-92c7d40cc891` }] },
      { nom: "Cross-country", equipes: [{ nom: "Cross-country", division: null, genre: "Mixte", url: "" }] },
      // DB : Badminton est en D3, pas en D1.
      { nom: "Badminton", equipes: [{ nom: "Badminton", division: "D1", genre: "Mixte", url: "" }] },
      { nom: "Natation", equipes: [{ nom: "Natation", division: null, genre: "Mixte", url: "" }] },
      { nom: "Cheerleading", equipes: [{ nom: "Cheerleading", division: null, genre: "Mixte", url: "" }] },
      { nom: "Hockey", equipes: [{ nom: "Hockey", division: "D2", genre: "M", url: "" }] },
      { nom: "Flag football", equipes: [{ nom: "Flag football", division: "D2", genre: "F", url: `/college/${MOMO_ID}/ed2f5fc1-6cf9-4beb-a4d7-76316bbb6475` }] },
    ],
    sellTitle: "Plus qu'un cégep",
    sellText:
      "Chez les Nomades, on ne choisit pas entre <b>gagner</b> et <b>graduer</b>. À Laval, Montmorency forme des étudiants-athlètes qui dominent le RSEQ <span class=\"hl\">et</span> entrent dans leur premier choix universitaire. Grandes installations, encadrement serré, culture d'équipe — <b>ici, tu n'es pas un numéro, tu es un Nomade.</b> Et quand tu portes le vert, c'est pour les deux : le palmarès et le diplôme.",
    videoUrl: null,
    featuredPrograms: [
      { title: "Sciences de la nature", blurb: "Le tremplin vers médecine et génie — horaire pensé pour les entraînements." },
      { title: "Techniques de la santé", blurb: "Soins, réadaptation, labo — des débouchés forts et un statut sport-études." },
      { title: "Alliance Sport-Études", blurb: "Statut reconnu, conciliation officielle, encadrement individualisé." },
    ],
    programsList: [
      "Sciences de la nature", "Sc. humaines — Administration", "Sc. humaines — Monde", "Arts, lettres et communication",
      "Techniques de génie mécanique", "Double DEC", "Cheminement Sport-Études", "Soins infirmiers",
      "Techniques policières", "Techniques de l'informatique", "Comptabilité et gestion", "Éducation à l'enfance",
      "Physiothérapie", "Techniques d'éducation spécialisée",
    ],
    route: {
      stop1: { sl: "AUJOURD'HUI · SECONDAIRE", h4: "Ton profil Nexus", p: "Stats, vidéos, bulletins — tout ce que les coachs des Nomades veulent voir." },
      stop2: { sl: "2027–2029 · MONTMORENCY", h4: "Tu portes le vert", p: "Division 1, 420 étudiants-athlètes, encadrement sport-études." },
      stop3: {
        sl: "ENSUITE · U SPORTS", h4: "Tu montes encore",
        stats: [
          { count: 31, label: "RECRUTÉS DEPUIS 2020" }, { count: 11, label: "EN U SPORTS" }, { count: 90, suffix: "%", label: "DIPLOMATION" },
        ],
      },
    },
    universities: ["U. DE MONTRÉAL", "LAVAL", "McGILL", "UQAM", "SHERBROOKE"],
    nexusStripText: "Des athlètes du secondaire ont rejoint les Nomades grâce à leur profil Nexus — vus, évalués, recrutés.",
    nexusRecruitedCount: 12,
    // MOCK viewer → aucune ressemblance dans programsList → état vide du board match.
    // (Pas de `news` → section #news absente : teste le cas 0-news.)
    viewerProgrammeVise: "Danse",
    ctaTitle: "Montmorency",
    ctaNotifyName: "Momo",
  },
};
