import type { RecruiterSettings } from "@/lib/types/models";

// NOTE : CEGEP_LIST + CegepEntry removed (no consumers; the
// `schools` table with type='CEGEP' is the authoritative list now).
// RSEQ_SPORTS + QC_REGIONS moved to lib/config/recruiterReferenceData.ts
// (they're configuration, not mock data — see that file for details).
// mockRecruiterSettings remains here pending its own consumer audit.

/* CEGEP_PROGRAMS SUPPRIMÉ EN T2 — 15 libellés à `id` factices
   (prog-01…prog-15) sans aucun consommateur. Le commentaire ci-dessus
   annonçait « pending consumer audit » : l'audit a eu lieu, il n'y en
   avait pas. La liste réelle est en base (cegep_programs). */

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
