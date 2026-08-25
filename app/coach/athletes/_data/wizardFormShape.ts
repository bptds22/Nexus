/* ═══════════════════════════════════════════════════════════════
   wizardFormShape — shared shape for the coach athlete wizard
   (CREATE + EDIT). Extracted so AthleteWizardMobile and the
   desktop wizard pages can converge on one type without forking.

   The desktop /create + /modifier pages still inline this shape
   today; they can import from here later. Keeping both in sync
   is intentional — this is the source of truth.

   Notes:
   - `partnerVisibilityConsent` is CREATE-only at write time, but
     lives on the shared shape so the wizard can carry it through
     state uniformly. Edit mode never reads/writes it.
   - `evalMode === "detailed"` triggers auto-average of cote_globale
     from non-zero trait ratings in BOTH modes (fix unification).
═══════════════════════════════════════════════════════════════ */

import type { TeamHistoryEntry } from "@/lib/types/models";

import type { DistinctionEntry } from "@/lib/config/badges";

export interface AthleteFormData {
  identity: {
    identityMode: "simple" | "detailed";
    photo: string;
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    gradYear: string;
    school: string;
    city: string;
    region: string;
    phone: string;
    email: string;
    parentName: string;
    parentPhone: string;
  };
  academic: {
    academicMode: "simple" | "detailed";
    gpa: string;
    strongSubjects: string[];
    academicHonors: string[];
    /* T2 — cegep_program_labels.id[], 3 max. Remplace le couple
       (cegepType, cegepProgramDetail) dont la concatenation produisait
       « Technique — <texte libre> » : jamais un programme reel. */
    programmesVises: string[];
    openToPrivate: boolean;
    openToAnglophone: boolean;
    openToRelocate: boolean;
    cegepRegions: string[];
  };
  physical: {
    physicalMode: "simple" | "detailed";
    heightFeet: string;
    heightInches: string;
    weightLbs: string;
    wingspan: string;
    handSize: string;
    dominantHand: string;
    dominantFoot: string;
    fortyYard: string;
    verticalJump: string;
    broadJump: string;
    benchPress: string;
    shuttleAgility: string;
    sprint100m: string;
  };
  sports: {
    sportsMode: "simple" | "detailed";
    primarySport: string;
    primarySportDetail: string;
    primaryPosition: string;
    selectedTeamId: string;
    currentTeam: string;
    teamLevel: string;
    teamDivision: string;
    jerseyNumber: string;
    league: string;
    secondaryTeamId: string;
    secondaryTeam: string;
    secondaryTeamLevel: string;
    secondaryTeamDivision: string;
    secondaryLeague: string;
    recruitingLevel: string;
    openToCoaching: boolean;
    /** Parcours d'équipes — historique déclaratif (JSONB). Miroir de
     *  AthleteFormSports.parcoursEquipes (lib/types/models.ts). Le champ
     *  manquait ICI alors que les consommateurs le posaient déjà : le wizard
     *  mobile qui l'édite ne compilait pas. */
    parcoursEquipes: TeamHistoryEntry[];
  };
  scouting: {
    evalMode: "simple" | "detailed";
    starRating: number;
    traitRatings: Record<string, number>;
    badges: DistinctionEntry[];
    coachEndorsement: string;
  };
  media: {
    mediaMode: "simple" | "detailed";
    hudlLink: string;
    youtubeLink: string;
    instagramLink: string;
    highlightVideo: string;
    fullGameVideo: string;
    trainingVideo: string;
  };
  submission: {
    recruitingStatus: string;
    preferredDivision: string;
  };
  parentalConsent: boolean;
  partnerVisibilityConsent: boolean;
}

export function emptyAthleteForm(): AthleteFormData {
  return {
    identity: {
      identityMode: "simple",
      photo: "", firstName: "", lastName: "", gender: "", dateOfBirth: "", gradYear: "",
      school: "", city: "", region: "",
      phone: "", email: "",
      parentName: "", parentPhone: "",
    },
    academic: {
      academicMode: "simple",
      gpa: "", strongSubjects: [], academicHonors: [],
      programmesVises: [],
      openToPrivate: false, openToAnglophone: false, openToRelocate: false,
      cegepRegions: [],
    },
    physical: {
      physicalMode: "simple",
      heightFeet: "", heightInches: "", weightLbs: "",
      wingspan: "", handSize: "", dominantHand: "", dominantFoot: "",
      fortyYard: "", verticalJump: "", broadJump: "",
      benchPress: "", shuttleAgility: "", sprint100m: "",
    },
    sports: {
      sportsMode: "simple",
      primarySport: "", primarySportDetail: "",
      primaryPosition: "",
      selectedTeamId: "", currentTeam: "", teamLevel: "", teamDivision: "",
      jerseyNumber: "", league: "",
      secondaryTeamId: "", secondaryTeam: "", secondaryTeamLevel: "", secondaryTeamDivision: "", secondaryLeague: "",
      recruitingLevel: "", openToCoaching: false,
      parcoursEquipes: [],
    },
    scouting: {
      evalMode: "simple",
      starRating: 0,
      traitRatings: {},
      badges: [],
      coachEndorsement: "",
    },
    media: {
      mediaMode: "simple",
      hudlLink: "", youtubeLink: "", instagramLink: "",
      highlightVideo: "", fullGameVideo: "", trainingVideo: "",
    },
    submission: { recruitingStatus: "", preferredDivision: "" },
    parentalConsent: false,
    partnerVisibilityConsent: false,
  };
}
