import type { RecruiterSettings } from "@/lib/types/models";

// NOTE : CEGEP_LIST + CegepEntry removed (no consumers; the
// `schools` table with type='CEGEP' is the authoritative list now).
// RSEQ_SPORTS + QC_REGIONS moved to lib/config/recruiterReferenceData.ts
// (they're configuration, not mock data — see that file for details).
// CEGEP_PROGRAMS below + mockRecruiterSettings remain here pending
// their own consumer audit / move.

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
