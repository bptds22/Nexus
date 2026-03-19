/* ─────────────────────────────────────────────────────────────────
   Mock Recruiter Profile — Pierre Dufour
───────────────────────────────────────────────────────────────── */

export interface RecruiterProfileData {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  cegep: string;
  teamName: string;
  division: "Division 1" | "Division 2" | "Division 3";
  sport: string;
  region: string;
  email: string;
  phone: string;
  photo?: string;
  isVerified: boolean;
}

export const RECRUITER_PROFILE: RecruiterProfileData = {
  id: "rec_001",
  firstName: "Pierre",
  lastName: "Dufour",
  title: "Coordonnateur recrutement",
  cegep: "CÉGEP Garneau",
  teamName: "Élans",
  division: "Division 1",
  sport: "Football",
  region: "Québec, QC",
  email: "p.dufour@cegep-garneau.qc.ca",
  phone: "418-555-0142",
  isVerified: true,
};
