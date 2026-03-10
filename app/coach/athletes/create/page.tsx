"use client";

import { useState, useCallback } from "react";
import StepIndicator from "../../components/StepIndicator";
import StarRatingInput from "../../components/StarRatingInput";
import TagInput from "../../components/TagInput";

import DatePicker from "../../components/DatePicker";
import SportPositionSelect from "../../components/SportPositionSelect";
import SportStatsFields from "../../components/SportStatsFields";
import NxSelect from "../../components/NxSelect";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Coach / Créer un profil athlète
   8-step form wizard for creating a complete athlete profile.
   All mock data — no API calls, no database.
───────────────────────────────────────────────────────────────── */

/* ══════════════════════════════════════════════════════════════
   TYPE DEFINITIONS
══════════════════════════════════════════════════════════════ */

interface AthleteFormData {
  identity: {
    photo: string; // local preview URL (no upload in MVP)
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
    cegepPrograms: string[];
    cegepProgramDetail: string;
    openToPrivate: boolean;
    openToAnglophone: boolean;
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
    primarySport: string;
    primarySportDetail: string;
    secondarySport: string;
    secondarySportDetail: string;
    primaryPosition: string;
    secondaryPosition: string;
    secondarySportPosition: string;
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
  };
  stats: Record<string, string>;
  media: {
    hudlLink: string;
    youtubeLink: string;
    instagramLink: string;
    highlightVideo: string;
    fullGameVideo: string;
    trainingVideo: string;
  };
  evaluation: {
    evalMode: "simple" | "detailed";
    overallRating: number;
    // Detailed — Athletic
    speed: number;
    strength: number;
    endurance: number;
    agility: number;
    // Detailed — Sport IQ
    gameVision: number;
    tacticalSense: number;
    // Detailed — Character
    workEthic: number;
    coachability: number;
    leadership: number;
    teamSpirit: number;
    competitiveLevel: number;
    coachComments: string;
    personalityTraits: string[];
  };
  submission: {
    recruitingStatus: string;
    preferredDivision: string;
  };
}

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */

const STEPS = [
  { number: 1, name: "Identité" },
  { number: 2, name: "Académique" },
  { number: 3, name: "Physique" },
  { number: 4, name: "Sport" },
  { number: 5, name: "Stats" },
  { number: 6, name: "Médias" },
  { number: 7, name: "Évaluation" },
  { number: 8, name: "Révision" },
];

const REGIONS = [
  "Montréal", "Québec", "Laurentides", "Lanaudière", "Montérégie",
  "Outaouais", "Estrie", "Mauricie", "Saguenay", "Bas-Saint-Laurent",
  "Abitibi", "Côte-Nord", "Gaspésie",
];

const SUBJECTS = [
  "Éducation physique", "Mathématiques", "Sciences", "Français",
  "Anglais", "Histoire", "Arts", "Informatique",
];

const CEGEP_PROGRAMS = [
  "S.H. Individu", "S.H. Administration", "S.H. Arts",
  "Sciences de la nature", "Double DEC", "Techniques", "Autre",
];

const CEGEP_REGIONS = [
  "Montréal", "Québec", "Laurentides", "Lanaudière",
  "Montérégie", "Outaouais", "Estrie", "Sherbrooke",
];

const SPORTS = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball",
  "Athlétisme", "Flag football", "Rugby", "Cheerleading",
  "Natation", "Badminton", "Cross-country", "Futsal",
  "Baseball", "Ultimate frisbee", "Autre",
];

const TEAM_LEVELS = [
  "Juvénile D1", "Juvénile D2", "Juvénile D3",
  "Cadet D1", "Cadet D2", "Bantam", "Autre",
];

const PERSONALITY_TRAITS = [
  "Leader naturel", "Discipline académique", "Travaillant",
  "Compétiteur", "Implication communautaire", "Résilient",
  "Humble", "Motivateur", "Créatif", "Intensité",
];

/* ══════════════════════════════════════════════════════════════
   COACH TEAM INFO (mock — would come from auth/session)
══════════════════════════════════════════════════════════════ */

const COACH_TEAM = {
  school: "École sec. De Mortagne",
  city: "Boucherville",
  region: "Montérégie",
  teams: [
    { id: "t1", name: "Lynx Juvénile D1", level: "Juvénile D1", division: "D1", sport: "Football", league: "RSEQ", gender: "M" as const },
    { id: "t2", name: "Lynx Cadet D2", level: "Cadet D2", division: "D2", sport: "Football", league: "RSEQ", gender: "M" as const },
    { id: "t3", name: "Lynx Basketball Juvénile", level: "Juvénile D1", division: "D1", sport: "Basketball", league: "RSEQ", gender: "M" as const },
    { id: "t4", name: "Lynx Basketball Féminin", level: "Juvénile D1", division: "D1", sport: "Basketball", league: "RSEQ", gender: "F" as const },
    { id: "t5", name: "Lynx Flag Football", level: "Juvénile D1", division: "D1", sport: "Flag football", league: "RSEQ", gender: "F" as const },
  ],
};

/* ══════════════════════════════════════════════════════════════
   INITIAL STATE
══════════════════════════════════════════════════════════════ */

const INITIAL_FORM: AthleteFormData = {
  identity: {
    photo: "",
    firstName: "", lastName: "", gender: "", dateOfBirth: "", gradYear: "",
    school: COACH_TEAM.school, city: COACH_TEAM.city, region: COACH_TEAM.region,
    phone: "", email: "",
    parentName: "", parentPhone: "",
  },
  academic: {
    academicMode: "simple", gpa: "", strongSubjects: [], academicHonors: [],
    cegepPrograms: [], cegepProgramDetail: "", openToPrivate: false, openToAnglophone: false, cegepRegions: [],
  },
  physical: {
    physicalMode: "simple", heightFeet: "", heightInches: "", weightLbs: "",
    wingspan: "", handSize: "", dominantHand: "", dominantFoot: "",
    fortyYard: "", verticalJump: "", broadJump: "",
    benchPress: "", shuttleAgility: "", sprint100m: "",
  },
  sports: {
    primarySport: "", primarySportDetail: "", secondarySport: "", secondarySportDetail: "", primaryPosition: "",
    secondaryPosition: "", secondarySportPosition: "", selectedTeamId: "", currentTeam: "", teamLevel: "", teamDivision: "",
    jerseyNumber: "", league: "",
    secondaryTeamId: "", secondaryTeam: "", secondaryTeamLevel: "", secondaryTeamDivision: "", secondaryLeague: "",
    recruitingLevel: "", openToCoaching: false,
  },
  stats: { keyStatsSummary: "" },
  media: {
    hudlLink: "", youtubeLink: "", instagramLink: "",
    highlightVideo: "", fullGameVideo: "", trainingVideo: "",
  },
  evaluation: {
    evalMode: "simple", overallRating: 0,
    speed: 0, strength: 0, endurance: 0, agility: 0,
    gameVision: 0, tacticalSense: 0,
    workEthic: 0, coachability: 0,
    leadership: 0, teamSpirit: 0, competitiveLevel: 0,
    coachComments: "", personalityTraits: [],
  },
  submission: { recruitingStatus: "", preferredDivision: "" },
};

/* ══════════════════════════════════════════════════════════════
   STYLE CONSTANTS
══════════════════════════════════════════════════════════════ */

const cardCls = "bg-[#1A1D24] rounded-[14px] border border-[#1e2128] p-8";
const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[15px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "block text-[13px] font-bold tracking-[1.2px] uppercase text-[#6b7280] mb-2";
const sectionTitle = "text-[13px] font-bold tracking-[1.5px] uppercase text-[#6b7280] mb-5";
const errBorder = "border-[#E63946]";
const req = <span className="text-[#E63946]"> *</span>;

/* ══════════════════════════════════════════════════════════════
   PAGE COMPONENT
══════════════════════════════════════════════════════════════ */

export default function CreateAthletePage() {
  const [form, setForm] = useState<AthleteFormData>(INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showErrors, setShowErrors] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /* ── Updaters ──────────────────────────────────────────────── */

  const updateIdentity = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, identity: { ...prev.identity, [field]: value } }));
  }, []);

  const updateAcademic = useCallback((field: string, value: string | string[] | boolean) => {
    setForm((prev) => ({ ...prev, academic: { ...prev.academic, [field]: value } }));
  }, []);

  const updatePhysical = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, physical: { ...prev.physical, [field]: value } }));
  }, []);

  const updateSports = useCallback((field: string, value: string | string[] | boolean) => {
    setForm((prev) => ({ ...prev, sports: { ...prev.sports, [field]: value } }));
  }, []);

  const updateStat = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, stats: { ...prev.stats, [key]: value } }));
  }, []);

  const updateMedia = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, media: { ...prev.media, [field]: value } }));
  }, []);

  const updateEvaluation = useCallback((field: string, value: number | string | string[]) => {
    setForm((prev) => ({ ...prev, evaluation: { ...prev.evaluation, [field]: value } }));
  }, []);

  const updateSubmission = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, submission: { ...prev.submission, [field]: value } }));
  }, []);

  /* ── Toggle helpers ─────────────────────────────────────────── */

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
  }

  /* ── Validation ────────────────────────────────────────────── */

  function validateStep(step: number): boolean {
    switch (step) {
      case 1: {
        const d = form.identity;
        return !!(d.firstName && d.lastName && d.gender && d.dateOfBirth && d.gradYear && d.school && d.city && d.region);
      }
      case 2: return true; // all optional
      case 3: return true; // all optional
      case 4: {
        const s = form.sports;
        return !!(s.primarySport && s.primaryPosition && (s.selectedTeamId || s.currentTeam) && s.jerseyNumber);
      }
      case 5: return true;
      case 6: return true;
      case 7: {
        const ev = form.evaluation;
        const detRatings = [ev.speed, ev.strength, ev.endurance, ev.agility, ev.gameVision, ev.tacticalSense, ev.workEthic, ev.coachability, ev.leadership, ev.teamSpirit, ev.competitiveLevel];
        const hasRating = ev.evalMode === "detailed" ? detRatings.some((r) => r > 0) : ev.overallRating > 0;
        return hasRating && ev.coachComments.length > 0;
      }
      case 8: return !!form.submission.recruitingStatus;
      default: return true;
    }
  }

  function isFieldEmpty(value: string): boolean {
    return showErrors && !value;
  }

  /* ── Navigation ────────────────────────────────────────────── */

  function goNext() {
    if (!validateStep(currentStep)) {
      setShowErrors(true);
      return;
    }
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setShowErrors(false);
    if (currentStep < 8) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goPrev() {
    setShowErrors(false);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goToStep(step: number) {
    setShowErrors(false);
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit() {
    if (!validateStep(8)) { setShowErrors(true); return; }
    setCompletedSteps((prev) => new Set([...prev, 8]));
    setSubmitted(true);
  }

  function handleDraft() {
    setSubmitted(true); // same UI for now
  }

  /* ══════════════════════════════════════════════════════════════
     STEP RENDERERS
  ══════════════════════════════════════════════════════════════ */

  /* ── Step 1: Identité ─────────────────────────────────────── */
  function renderStep1() {
    const d = form.identity;
    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">
          Identité de l&apos;étudiant-athlète
        </h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Informations personnelles de base</p>

        {/* ── Photo upload ─────────────────────────── */}
        <div className="flex items-center gap-6 mb-8">
          <div className="relative group shrink-0">
            {d.photo ? (
              <img src={d.photo} alt="Photo" className="w-[100px] h-[100px] rounded-xl object-cover border-2 border-[#2a2d36]" />
            ) : (
              <div className="w-[100px] h-[100px] rounded-xl bg-[#13151a] border-2 border-dashed border-[#2a2d36] flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <input type="file" accept="image/*" className="hidden" title="Téléverser une photo"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    updateIdentity("photo", url);
                  }
                }}
              />
            </label>
          </div>
          <div>
            <p className="text-[14px] font-bold text-white">Photo de l&apos;athlète</p>
            <p className="text-[13px] text-[#4a4d56] mt-0.5">Pour la carte joueur. JPG ou PNG.</p>
            {d.photo && (
              <button type="button" onClick={() => updateIdentity("photo", "")}
                className="text-[10px] text-[#E63946] mt-1 hover:underline">
                Retirer la photo
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Prénom */}
          <div>
            <label className={labelCls}>Prénom{req}</label>
            <input type="text" value={d.firstName} onChange={(e) => updateIdentity("firstName", e.target.value)}
              placeholder="Prénom" className={`${inputCls} ${isFieldEmpty(d.firstName) ? errBorder : ""}`} />
          </div>
          {/* Nom */}
          <div>
            <label className={labelCls}>Nom{req}</label>
            <input type="text" value={d.lastName} onChange={(e) => updateIdentity("lastName", e.target.value)}
              placeholder="Nom de famille" className={`${inputCls} ${isFieldEmpty(d.lastName) ? errBorder : ""}`} />
          </div>
          {/* Genre */}
          <div>
            <label className={labelCls}>Genre{req}</label>
            <NxSelect value={d.gender} onChange={(v) => updateIdentity("gender", v)}
              hasError={isFieldEmpty(d.gender)}
              options={[
                { value: "M", label: "Masculin" },
                { value: "F", label: "Féminin" },
                { value: "X", label: "Non genré" },
              ]}
            />
          </div>
          {/* Date de naissance */}
          <div>
            <label className={labelCls}>Date de naissance{req}</label>
            <DatePicker
              value={d.dateOfBirth}
              onChange={(date) => updateIdentity("dateOfBirth", date)}
              placeholder="Sélectionner une date"
              hasError={isFieldEmpty(d.dateOfBirth)}
            />
          </div>
          {/* Grad year */}
          <div>
            <label className={labelCls}>Promotion{req}</label>
            <NxSelect value={d.gradYear} onChange={(v) => updateIdentity("gradYear", v)}
              hasError={isFieldEmpty(d.gradYear)}
              options={[2025, 2026, 2027, 2028, 2029].map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
          {/* École (auto-filled from coach team) */}
          <div>
            <label className={labelCls}>École secondaire</label>
            <div className="relative">
              <input type="text" value={d.school} readOnly aria-label="École secondaire"
                className={`${inputCls} opacity-70 cursor-not-allowed`} />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
          </div>
          {/* Ville (auto-filled from coach team) */}
          <div>
            <label className={labelCls}>Ville</label>
            <div className="relative">
              <input type="text" value={d.city} readOnly aria-label="Ville"
                className={`${inputCls} opacity-70 cursor-not-allowed`} />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
          </div>
          {/* Région (auto-filled from coach team) */}
          <div>
            <label className={labelCls}>Région</label>
            <div className="relative">
              <input type="text" value={d.region} readOnly aria-label="Région"
                className={`${inputCls} opacity-70 cursor-not-allowed`} />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
          </div>
          {/* Téléphone (Phase 2) */}
          <div className="opacity-45 pointer-events-none">
            <label className={labelCls}>
              Téléphone
              <span className="ml-2 inline-block px-1.5 py-0.5 text-[8px] font-bold tracking-[0.15em] uppercase bg-[#2a2d36]/60 text-[#6b7280] rounded border border-[#2a2d36]">Bientôt disponible</span>
            </label>
            <input type="tel" disabled placeholder="(514) 000-0000" aria-label="Téléphone"
              className="w-full bg-[#13151a] border border-dashed border-[#2a2d36] rounded-lg px-4 py-3 text-[15px] text-[#6b7280] placeholder:text-[#3a3d46] outline-none cursor-not-allowed" />
          </div>
          {/* Courriel (Phase 2) */}
          <div className="opacity-45 pointer-events-none">
            <label className={labelCls}>
              Courriel
              <span className="ml-2 inline-block px-1.5 py-0.5 text-[8px] font-bold tracking-[0.15em] uppercase bg-[#2a2d36]/60 text-[#6b7280] rounded border border-[#2a2d36]">Bientôt disponible</span>
            </label>
            <input type="email" disabled placeholder="athlete@email.com" aria-label="Courriel"
              className="w-full bg-[#13151a] border border-dashed border-[#2a2d36] rounded-lg px-4 py-3 text-[15px] text-[#6b7280] placeholder:text-[#3a3d46] outline-none cursor-not-allowed" />
          </div>
        </div>

        {/* Parent contact (Phase 2) */}
        <div className="border-t border-dashed border-[#1e2128] mt-6 pt-5 opacity-45 pointer-events-none">
          <div className="flex items-center gap-3 mb-4">
            <p className={sectionTitle} style={{ marginBottom: 0 }}>Contact parent</p>
            <span className="inline-block px-2 py-0.5 text-[8px] font-bold tracking-[0.15em] uppercase bg-[#2a2d36]/60 text-[#6b7280] rounded border border-[#2a2d36]">Bientôt disponible</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Nom du parent</label>
              <input type="text" disabled placeholder="Nom complet" aria-label="Nom du parent"
                className="w-full bg-[#13151a] border border-dashed border-[#2a2d36] rounded-lg px-4 py-3 text-[15px] text-[#6b7280] placeholder:text-[#3a3d46] outline-none cursor-not-allowed" />
            </div>
            <div>
              <label className={labelCls}>Téléphone du parent</label>
              <input type="tel" disabled placeholder="(514) 000-0000" aria-label="Téléphone du parent"
                className="w-full bg-[#13151a] border border-dashed border-[#2a2d36] rounded-lg px-4 py-3 text-[15px] text-[#6b7280] placeholder:text-[#3a3d46] outline-none cursor-not-allowed" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step 2: Académique ───────────────────────────────────── */
  function renderStep2() {
    const d = form.academic;
    const isDetailedAcad = d.academicMode === "detailed";

    /* Reusable checkbox helper */
    const checkbox = (checked: boolean, onChange: () => void, label: string) => (
      <label className="flex items-center gap-3 cursor-pointer group">
        <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a] group-hover:border-[#6b7280]"}`}>
          {checked && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          )}
        </span>
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <span className="text-[14px] text-[#e0e0e0]">{label}</span>
      </label>
    );

    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">
          Profil académique
        </h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Résultats scolaires et objectifs CÉGEP</p>

        {/* Toggle: Simple / Détaillée */}
        <div className="flex items-center gap-1 bg-[#13151a] rounded-lg p-1 mb-8 w-fit">
          <button type="button"
            onClick={() => updateAcademic("academicMode", "simple")}
            className={`px-4 py-2 rounded-md text-[12px] font-bold uppercase tracking-[0.1em] transition-all ${!isDetailedAcad ? "bg-[#E63946] text-white shadow-[0_0_8px_rgba(230,57,70,0.2)]" : "text-[#6b7280] hover:text-white"}`}>
            Simplifiée
          </button>
          <button type="button"
            onClick={() => updateAcademic("academicMode", "detailed")}
            className={`px-4 py-2 rounded-md text-[12px] font-bold uppercase tracking-[0.1em] transition-all ${isDetailedAcad ? "bg-[#E63946] text-white shadow-[0_0_8px_rgba(230,57,70,0.2)]" : "text-[#6b7280] hover:text-white"}`}>
            Détaillée
          </button>
        </div>

        <div className="space-y-6">
          {/* GPA — always shown */}
          <div className="max-w-[220px]">
            <label className={labelCls}>Moyenne générale</label>
            <div className="relative">
              <input type="number" min="0" max="100" step="0.1" value={d.gpa}
                onChange={(e) => updateAcademic("gpa", e.target.value)}
                placeholder="85" className={`${inputCls} pr-8`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-[14px]">%</span>
            </div>
          </div>

          {/* Detailed only — Matières fortes */}
          {isDetailedAcad && (
            <div>
              <p className={labelCls}>Matières fortes</p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => {
                  const selected = d.strongSubjects.includes(s);
                  return (
                    <button key={s} type="button"
                      onClick={() => updateAcademic("strongSubjects", toggleArrayItem(d.strongSubjects, s))}
                      className={`px-3.5 py-2 rounded-md text-[13px] font-bold transition-all
                        ${selected
                          ? "bg-[#E63946]/18 text-[#E63946] border border-[#E63946]/30"
                          : "bg-transparent border border-[#2a2d36] text-[#8a8d96] hover:border-[#6b7280]"
                        }`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detailed only — Mentions académiques */}
          {isDetailedAcad && (
            <div>
              <label className={labelCls}>Mentions académiques</label>
              <TagInput tags={d.academicHonors}
                onChange={(tags) => updateAcademic("academicHonors", tags)}
                placeholder="Tapez une mention + Entrée" />
            </div>
          )}

          {/* Programme CÉGEP visé — always shown */}
          <div>
            <p className={labelCls}>Programme CÉGEP visé</p>
            <div className="flex flex-wrap gap-2">
              {CEGEP_PROGRAMS.map((p) => {
                const selected = d.cegepPrograms.includes(p);
                return (
                  <button key={p} type="button"
                    onClick={() => updateAcademic("cegepPrograms", toggleArrayItem(d.cegepPrograms, p))}
                    className={`px-3.5 py-2 rounded-md text-[13px] font-bold transition-all
                      ${selected
                        ? "bg-[#3b82f6]/18 text-[#3b82f6] border border-[#3b82f6]/30"
                        : "bg-transparent border border-[#2a2d36] text-[#8a8d96] hover:border-[#6b7280]"
                      }`}>
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Conditional detail input for Techniques / Autre */}
            {(d.cegepPrograms.includes("Techniques") || d.cegepPrograms.includes("Autre")) && (
              <input
                type="text"
                value={d.cegepProgramDetail}
                onChange={(e) => updateAcademic("cegepProgramDetail", e.target.value)}
                placeholder={
                  d.cegepPrograms.includes("Techniques") && d.cegepPrograms.includes("Autre")
                    ? "Précisez le programme technique ou autre…"
                    : d.cegepPrograms.includes("Techniques")
                      ? "Précisez le programme technique…"
                      : "Précisez le programme…"
                }
                className={`${inputCls} mt-2`}
              />
            )}
          </div>

          {/* Checkboxes — privé + anglophone — always shown */}
          <div className="space-y-3">
            {checkbox(d.openToPrivate, () => updateAcademic("openToPrivate", !d.openToPrivate), "Ouvert à un CÉGEP privé")}
            {checkbox(d.openToAnglophone, () => updateAcademic("openToAnglophone", !d.openToAnglophone), "Ouvert à un CÉGEP anglophone")}
          </div>

          {/* Detailed only — Régions CÉGEP */}
          {isDetailedAcad && (
            <div>
              <p className={labelCls}>Régions CÉGEP préférées</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CEGEP_REGIONS.map((r) => {
                  const checked = d.cegepRegions.includes(r);
                  return (
                    <label key={r} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={checked}
                        onChange={() => updateAcademic("cegepRegions", toggleArrayItem(d.cegepRegions, r))}
                        className="sr-only" />
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                        ${checked ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] group-hover:border-[#6b7280]"}`}>
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                      <span className="text-[13px] text-[#e0e0e0]">{r}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Step 3: Physique ─────────────────────────────────────── */
  function renderStep3() {
    const d = form.physical;
    const isDetailedPhys = d.physicalMode === "detailed";

    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">
          Profil physique
        </h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Mensurations et tests athlétiques</p>

        {/* Toggle: Simple / Détaillée */}
        <div className="flex items-center gap-1 bg-[#13151a] rounded-lg p-1 mb-8 w-fit">
          <button type="button"
            onClick={() => updatePhysical("physicalMode", "simple")}
            className={`px-4 py-2 rounded-md text-[12px] font-bold uppercase tracking-[0.1em] transition-all ${!isDetailedPhys ? "bg-[#E63946] text-white shadow-[0_0_8px_rgba(230,57,70,0.2)]" : "text-[#6b7280] hover:text-white"}`}>
            Simplifiée
          </button>
          <button type="button"
            onClick={() => updatePhysical("physicalMode", "detailed")}
            className={`px-4 py-2 rounded-md text-[12px] font-bold uppercase tracking-[0.1em] transition-all ${isDetailedPhys ? "bg-[#E63946] text-white shadow-[0_0_8px_rgba(230,57,70,0.2)]" : "text-[#6b7280] hover:text-white"}`}>
            Détaillée
          </button>
        </div>

        {/* Mensurations */}
        <p className={sectionTitle}>Mensurations</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8">
          {/* Taille — always */}
          <div>
            <label className={labelCls}>Taille — Pieds</label>
            <NxSelect value={d.heightFeet} onChange={(v) => updatePhysical("heightFeet", v)}
              placeholder="—"
              options={[4, 5, 6, 7].map((f) => ({ value: String(f), label: `${f}'` }))}
            />
          </div>
          <div>
            <label className={labelCls}>Pouces</label>
            <NxSelect value={d.heightInches} onChange={(v) => updatePhysical("heightInches", v)}
              placeholder="—"
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i}"` }))}
            />
          </div>
          {/* Poids — always */}
          <div>
            <label className={labelCls}>Poids (lbs)</label>
            <input type="number" value={d.weightLbs} onChange={(e) => updatePhysical("weightLbs", e.target.value)}
              placeholder="185" className={inputCls} />
          </div>
          {/* Detailed only */}
          {isDetailedPhys && (
            <>
              <div>
                <label className={labelCls}>Envergure</label>
                <input type="text" value={d.wingspan} onChange={(e) => updatePhysical("wingspan", e.target.value)}
                  placeholder={'6\'4"'} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Taille des mains</label>
                <input type="text" value={d.handSize} onChange={(e) => updatePhysical("handSize", e.target.value)}
                  placeholder={'9.5"'} className={inputCls} />
              </div>
            </>
          )}
          {/* Main dominante — always */}
          <div>
            <label className={labelCls}>Main dominante</label>
            <NxSelect value={d.dominantHand} onChange={(v) => updatePhysical("dominantHand", v)}
              placeholder="—"
              options={[
                { value: "Droite", label: "Droite" },
                { value: "Gauche", label: "Gauche" },
                { value: "Ambidextre", label: "Ambidextre" },
              ]}
            />
          </div>
          {/* Detailed only */}
          {isDetailedPhys && (
            <div>
              <label className={labelCls}>Pied dominant</label>
              <NxSelect value={d.dominantFoot} onChange={(v) => updatePhysical("dominantFoot", v)}
                placeholder="—"
                options={[
                  { value: "Droit", label: "Droit" },
                  { value: "Gauche", label: "Gauche" },
                  { value: "Les deux", label: "Les deux" },
                ]}
              />
            </div>
          )}
        </div>

        {/* Tests athlétiques — detailed only */}
        {isDetailedPhys && (
          <div className="border-t border-[#1e2128] pt-5">
            <p className={sectionTitle}>Tests athlétiques (optionnel)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {[
                { key: "fortyYard", label: "40 verges", placeholder: "4.72s" },
                { key: "verticalJump", label: "Saut vertical", placeholder: '32"' },
                { key: "broadJump", label: "Saut en longueur", placeholder: '9\'2"' },
                { key: "benchPress", label: "Développé couché", placeholder: "225 × 8" },
                { key: "shuttleAgility", label: "Navette agilité", placeholder: "4.31s" },
                { key: "sprint100m", label: "Sprint 100m", placeholder: "10.9s" },
              ].map((f) => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input type="text"
                    value={d[f.key as keyof typeof d]}
                    onChange={(e) => updatePhysical(f.key, e.target.value)}
                    placeholder={f.placeholder} className={inputCls} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Step 4: Sport ────────────────────────────────────────── */
  function renderStep4() {
    const d = form.sports;
    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">
          Informations sportives
        </h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Sport, position et niveau de compétition</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <label className={labelCls}>Sport principal{req}</label>
            <NxSelect value={d.primarySport}
              onChange={(v) => { updateSports("primarySport", v); if (v !== "Autre") updateSports("primarySportDetail", ""); }}
              hasError={isFieldEmpty(d.primarySport)}
              options={SPORTS.map((s) => ({ value: s, label: s }))}
            />
            {d.primarySport === "Autre" && (
              <input type="text" value={d.primarySportDetail} onChange={(e) => updateSports("primarySportDetail", e.target.value)}
                placeholder="Précisez le sport…" className={`${inputCls} mt-2`} />
            )}
          </div>
          <div>
            <label className={labelCls}>Sport secondaire</label>
            <NxSelect value={d.secondarySport}
              onChange={(v) => {
                const val = v === "Aucun" ? "" : v;
                updateSports("secondarySport", val);
                if (val !== "Autre") updateSports("secondarySportDetail", "");
                if (!val) {
                  updateSports("secondarySportPosition", "");
                  updateSports("secondaryTeamId", "");
                  updateSports("secondaryTeam", "");
                  updateSports("secondaryTeamLevel", "");
                  updateSports("secondaryTeamDivision", "");
                  updateSports("secondaryLeague", "");
                }
              }}
              placeholder="Aucun"
              options={[{ value: "Aucun", label: "Aucun" }, ...SPORTS.map((s) => ({ value: s, label: s }))]}
            />
            {d.secondarySport === "Autre" && (
              <input type="text" value={d.secondarySportDetail} onChange={(e) => updateSports("secondarySportDetail", e.target.value)}
                placeholder="Précisez le sport…" className={`${inputCls} mt-2`} />
            )}
          </div>
          <SportPositionSelect
            sport={d.primarySport === "Autre" && d.primarySportDetail ? "Autre" : d.primarySport}
            value={d.primaryPosition}
            onChange={(v) => updateSports("primaryPosition", v)}
            label="Position principale"
            required
            hasError={isFieldEmpty(d.primaryPosition)}
          />
          <SportPositionSelect
            sport={d.primarySport === "Autre" && d.primarySportDetail ? "Autre" : d.primarySport}
            value={d.secondaryPosition}
            onChange={(v) => updateSports("secondaryPosition", v)}
            label="Position secondaire"
          />
          {d.secondarySport && d.secondarySport !== "" && (
            <SportPositionSelect
              sport={d.secondarySport === "Autre" && d.secondarySportDetail ? "Autre" : d.secondarySport}
              value={d.secondarySportPosition}
              onChange={(v) => updateSports("secondarySportPosition", v)}
              label={`Position — ${d.secondarySport === "Autre" && d.secondarySportDetail ? d.secondarySportDetail : d.secondarySport}`}
            />
          )}
          {/* Team selection — auto-fills from coach teams */}
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Équipe{req}
              {d.selectedTeamId && (() => {
                const t = COACH_TEAM.teams.find((t) => t.id === d.selectedTeamId);
                return t ? <span className="ml-1.5 text-[#E63946] normal-case tracking-normal">({t.gender === "M" ? "Masculin" : "Féminin"})</span> : null;
              })()}
            </label>
            {COACH_TEAM.teams.length === 1 ? (
              /* Single team — auto-fill, read-only */
              <div className="relative">
                <input type="text" readOnly value={COACH_TEAM.teams[0].name}
                  aria-label="Équipe"
                  className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              </div>
            ) : (
              /* Multiple teams — dropdown */
              <NxSelect
                aria-label="Équipe"
                value={d.selectedTeamId}
                onChange={(v) => {
                  const team = COACH_TEAM.teams.find((t) => t.id === v);
                  updateSports("selectedTeamId", v);
                  updateSports("currentTeam", team?.name || "");
                  updateSports("teamLevel", team?.level || "");
                  updateSports("teamDivision", team?.division || "");
                  updateSports("league", team?.league || "");
                }}
                hasError={isFieldEmpty(d.selectedTeamId)}
                placeholder="Sélectionner une équipe"
                options={COACH_TEAM.teams.map((t) => ({ value: t.id, label: `${t.name} — ${t.level}`, group: t.gender === "M" ? "Masculin" : "Féminin" }))}
              />
            )}
          </div>

          {/* Auto-filled level + division (read-only) */}
          {d.selectedTeamId && (
            <>
              <div>
                <label className={labelCls}>Niveau</label>
                <div className="relative">
                  <input type="text" readOnly value={d.teamLevel} aria-label="Niveau de l'équipe"
                    className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                </div>
              </div>
              <div>
                <label className={labelCls}>Division</label>
                <div className="relative">
                  <input type="text" readOnly value={d.teamDivision} aria-label="Division"
                    className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                </div>
              </div>
            </>
          )}
          <div>
            <label className={labelCls}>Numéro de chandail{req}</label>
            <input type="text" inputMode="numeric" value={d.jerseyNumber}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); updateSports("jerseyNumber", v); }}
              placeholder="#" className={`${inputCls} ${isFieldEmpty(d.jerseyNumber) ? errBorder : ""}`} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${d.openToCoaching ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a] group-hover:border-[#6b7280]"}`}>
                {d.openToCoaching && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                )}
              </span>
              <input type="checkbox" checked={d.openToCoaching} onChange={() => updateSports("openToCoaching", !d.openToCoaching)} className="sr-only" />
              <span className="text-[14px] text-[#e0e0e0]">Ouvert à devenir entraîneur au CÉGEP</span>
            </label>
          </div>
        </div>

        {/* League — auto-filled from team */}
        {d.selectedTeamId && d.league && (
          <div className="border-t border-[#1e2128] pt-5">
            <label className={labelCls}>Ligue</label>
            <div className="relative max-w-xs">
              <input type="text" readOnly value={d.league} aria-label="Ligue"
                className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
            </div>
          </div>
        )}

        {/* ── Secondary sport team ────────────────────────────── */}
        {d.secondarySport && d.secondarySport !== "" && (
          <div className="border-t border-[#1e2128] pt-5">
            <p className={sectionTitle}>
              Équipe — {d.secondarySport === "Autre" && d.secondarySportDetail ? d.secondarySportDetail : d.secondarySport}
              {d.secondaryTeamId && (() => {
                const t = COACH_TEAM.teams.find((t) => t.id === d.secondaryTeamId);
                return t ? <span className="ml-1.5 text-[#E63946]">({t.gender === "M" ? "Masculin" : "Féminin"})</span> : null;
              })()}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <label className={labelCls}>Équipe ({d.secondarySport === "Autre" && d.secondarySportDetail ? d.secondarySportDetail : d.secondarySport})</label>
                <NxSelect
                  aria-label="Équipe secondaire"
                  value={d.secondaryTeamId}
                  onChange={(v) => {
                    const team = COACH_TEAM.teams.find((t) => t.id === v);
                    updateSports("secondaryTeamId", v);
                    updateSports("secondaryTeam", team?.name || "");
                    updateSports("secondaryTeamLevel", team?.level || "");
                    updateSports("secondaryTeamDivision", team?.division || "");
                    updateSports("secondaryLeague", team?.league || "");
                  }}
                  placeholder="Sélectionner une équipe"
                  options={COACH_TEAM.teams.map((t) => ({ value: t.id, label: `${t.name} — ${t.level}`, group: t.gender === "M" ? "Masculin" : "Féminin" }))}
                />
              </div>

              {/* Auto-filled secondary team details */}
              {d.secondaryTeamId && (
                <>
                  <div>
                    <label className={labelCls}>Niveau</label>
                    <div className="relative">
                      <input type="text" readOnly value={d.secondaryTeamLevel} aria-label="Niveau équipe secondaire"
                        className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} />
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Division</label>
                    <div className="relative">
                      <input type="text" readOnly value={d.secondaryTeamDivision} aria-label="Division équipe secondaire"
                        className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} />
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                    </div>
                  </div>
                  {d.secondaryLeague && (
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Ligue</label>
                      <div className="relative max-w-xs">
                        <input type="text" readOnly value={d.secondaryLeague} aria-label="Ligue équipe secondaire"
                          className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} />
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Step 5: Stats ────────────────────────────────────────── */
  function renderStep5() {
    const sport = form.sports.primarySport;
    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">
          Statistiques{sport ? ` — ${sport}` : ""}
        </h2>
        <p className="text-[15px] text-[#6b7280] mb-8">
          {sport ? `Statistiques de la saison pour ${sport}` : "Sélectionnez un sport à l'étape 4 pour voir les champs spécifiques"}
        </p>

        {sport ? (
          <SportStatsFields
            sport={sport}
            stats={form.stats}
            onChange={updateStat}
          />
        ) : (
          <div className="border border-dashed border-[#2a2d36] rounded-xl p-8 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
            <p className="text-[14px] text-[#6b7280] font-medium">Aucun sport sélectionné</p>
            <p className="text-[12px] text-[#4a4d56] mt-1">Retournez à l&apos;étape 4 pour choisir un sport</p>
          </div>
        )}

        {/* Additional free-text summary (always available) */}
        <div className="mt-8 border-t border-[#1e2128] pt-6">
          <label className={labelCls}>Notes supplémentaires (optionnel)</label>
          <textarea
            value={form.stats.keyStatsSummary || ""}
            onChange={(e) => updateStat("keyStatsSummary", e.target.value)}
            placeholder="Ajoutez des précisions, des records ou statistiques non couvertes ci-dessus…"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>
    );
  }

  /* ── Step 6: Médias ───────────────────────────────────────── */
  function renderStep6() {
    const d = form.media;
    const mediaFields = [
      { key: "hudlLink", label: "Lien Hudl", placeholder: "https://www.hudl.com/..." },
      { key: "youtubeLink", label: "Lien YouTube", placeholder: "https://youtube.com/..." },
      { key: "instagramLink", label: "Lien Instagram", placeholder: "https://instagram.com/..." },
      { key: "highlightVideo", label: "Vidéo de faits saillants", placeholder: "https://..." },
      { key: "fullGameVideo", label: "Vidéo de match complet", placeholder: "https://..." },
      { key: "trainingVideo", label: "Vidéo d'entraînement", placeholder: "https://..." },
    ];
    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">
          Vidéo &amp; Médias
        </h2>
        <div className="flex items-center mb-6">
          <p className="text-[13px] text-[#6b7280]">Liens vers les vidéos et profils en ligne</p>

          {/* Tip pill — pushed right */}
          <div className="flex items-center gap-3 ml-auto bg-[#E63946]/[0.06] border border-[#E63946]/[0.12] rounded-lg px-4 py-2.5 shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
              {/* Bulb body */}
              <path d="M9 21h6" stroke="#F5C518" strokeWidth="2" strokeLinecap="round" />
              <path d="M10 20h4" stroke="#F5C518" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
              <path d="M12 2a6 6 0 014 10.5V17a1 1 0 01-1 1h-6a1 1 0 01-1-1v-4.5A6 6 0 0112 2z" fill="#F5C518" fillOpacity="0.15" stroke="#F5C518" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              {/* Filament lines */}
              <path d="M10 14h4" stroke="#F5C518" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
              {/* Glow rays */}
              <path d="M12 0v1M4.2 4.2l.7.7M0 12h1M4.2 19.8l.7-.7M19.8 4.2l-.7.7M24 12h-1M19.8 19.8l-.7-.7" stroke="#F5C518" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
            </svg>
            <span className="text-[11px] tracking-[0.04em] text-[#8a8d96]">
              <strong className="text-white font-bold">11x</strong> vues
            </span>
            <span className="w-px h-3 bg-[#2a2d36]" />
            <span className="text-[11px] tracking-[0.04em] text-[#8a8d96]">
              <strong className="text-white font-bold">3x</strong> engagements
            </span>
            <span className="w-px h-3 bg-[#2a2d36]" />
            <span className="text-[11px] tracking-[0.04em] text-[#8a8d96]">
              <strong className="text-white font-bold">80%</strong> contactés
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {mediaFields.map((f) => (
            <div key={f.key}>
              <label className={labelCls}>{f.label}</label>
              <input type="url" value={d[f.key as keyof typeof d]}
                onChange={(e) => updateMedia(f.key, e.target.value)}
                placeholder={f.placeholder} className={inputCls} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Step 7: Évaluation ───────────────────────────────────── */
  function renderStep7() {
    const d = form.evaluation;
    const isDetailed = d.evalMode === "detailed";

    // Auto-calculate overall from detailed ratings
    const detailedRatings = [d.speed, d.strength, d.endurance, d.agility, d.gameVision, d.tacticalSense, d.workEthic, d.coachability, d.leadership, d.teamSpirit, d.competitiveLevel];
    const filled = detailedRatings.filter((r) => r > 0);
    const autoAvg = filled.length > 0 ? parseFloat((filled.reduce((a, b) => a + b, 0) / filled.length).toFixed(1)) : 0;

    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">
          Évaluation du coach
        </h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Votre appréciation honnête de cet athlète</p>

        {/* Toggle: Simple / Détaillée */}
        <div className="flex items-center gap-1 bg-[#13151a] rounded-lg p-1 mb-6 w-fit">
          <button type="button"
            onClick={() => updateEvaluation("evalMode", "simple")}
            className={`px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-[0.1em] transition-all ${!isDetailed ? "bg-[#E63946] text-white shadow-[0_0_8px_rgba(230,57,70,0.2)]" : "text-[#6b7280] hover:text-white"}`}>
            Simplifiée
          </button>
          <button type="button"
            onClick={() => updateEvaluation("evalMode", "detailed")}
            className={`px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-[0.1em] transition-all ${isDetailed ? "bg-[#E63946] text-white shadow-[0_0_8px_rgba(230,57,70,0.2)]" : "text-[#6b7280] hover:text-white"}`}>
            Détaillée
          </button>
        </div>

        <div className="space-y-5">

          {/* ── Overall rating card (hero) ─────────────────── */}
          <div className={`bg-[#13151a] border rounded-xl p-6 ${showErrors && d.overallRating === 0 && !(isDetailed && autoAvg > 0) ? "border-[#E63946]/60" : "border-[#2a2d36]"}`}>
            <div className="flex flex-col items-center text-center gap-3">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">
                Cote globale<span className="text-[#E63946]"> *</span>
              </p>
              <div className="flex items-center gap-4">
                {isDetailed ? (
                  <StarRatingInput value={Math.round(autoAvg)} onChange={() => {}} gold hideScore />
                ) : (
                  <StarRatingInput value={d.overallRating} onChange={(v) => updateEvaluation("overallRating", v)} gold hideScore />
                )}
                <span className="text-[28px] font-head font-black text-white tabular-nums leading-none">
                  {isDetailed ? (autoAvg > 0 ? autoAvg : "—") : (d.overallRating || "—")}
                  <span className="text-[14px] text-[#4a4d56] font-normal"> / 5</span>
                </span>
              </div>
              {isDetailed && filled.length > 0 && (
                <p className="text-[10px] text-[#4a4d56]">
                  Moyenne auto. de {filled.length} évaluations
                </p>
              )}
            </div>
          </div>

          {/* ── Detailed mode ────────────────────────────── */}
          {isDetailed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Athletic capabilities */}
              <div className="bg-[#13151a] border border-[#2a2d36] rounded-xl p-5">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#E63946] mb-2">Capacités athlétiques</p>
                <div className="divide-y divide-[#1e2128]">
                  <StarRatingInput compact label="Vitesse" value={d.speed} onChange={(v) => updateEvaluation("speed", v)} />
                  <StarRatingInput compact label="Force" value={d.strength} onChange={(v) => updateEvaluation("strength", v)} />
                  <StarRatingInput compact label="Endurance" value={d.endurance} onChange={(v) => updateEvaluation("endurance", v)} />
                  <StarRatingInput compact label="Agilité" value={d.agility} onChange={(v) => updateEvaluation("agility", v)} />
                </div>
              </div>

              {/* Sport IQ */}
              <div className="bg-[#13151a] border border-[#2a2d36] rounded-xl p-5">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#E63946] mb-2">Intelligence sportive</p>
                <div className="divide-y divide-[#1e2128]">
                  <StarRatingInput compact label="Vision du jeu" value={d.gameVision} onChange={(v) => updateEvaluation("gameVision", v)} />
                  <StarRatingInput compact label="Sens tactique" value={d.tacticalSense} onChange={(v) => updateEvaluation("tacticalSense", v)} />
                </div>
              </div>

              {/* Character — spans full width */}
              <div className="sm:col-span-2 bg-[#13151a] border border-[#2a2d36] rounded-xl p-5">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#E63946] mb-2">Caractère</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0 divide-[#1e2128]">
                  <div className="divide-y divide-[#1e2128]">
                    <StarRatingInput compact label="Éthique de travail" value={d.workEthic} onChange={(v) => updateEvaluation("workEthic", v)} />
                    <StarRatingInput compact label="Coachabilité" value={d.coachability} onChange={(v) => updateEvaluation("coachability", v)} />
                    <StarRatingInput compact label="Leadership" value={d.leadership} onChange={(v) => updateEvaluation("leadership", v)} />
                  </div>
                  <div className="divide-y divide-[#1e2128]">
                    <StarRatingInput compact label="Esprit d'équipe" value={d.teamSpirit} onChange={(v) => updateEvaluation("teamSpirit", v)} />
                    <StarRatingInput compact label="Compétitivité" value={d.competitiveLevel} onChange={(v) => updateEvaluation("competitiveLevel", v)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Simple mode: only Cote globale above — nothing else */}

          {/* Coach comments */}
          <div className="border-t border-[#1e2128] pt-5">
            <label className={labelCls}>Commentaires du coach{req} ({d.coachComments.length}/500)</label>
            <textarea value={d.coachComments} maxLength={500}
              onChange={(e) => updateEvaluation("coachComments", e.target.value)}
              rows={4} placeholder="Décrivez les forces, les axes d'amélioration et le potentiel de cet athlète..."
              className={`${inputCls} resize-none ${showErrors && !d.coachComments ? errBorder : ""}`} />
          </div>

          {/* Personality traits */}
          <div>
            <p className={labelCls}>Traits de personnalité</p>
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_TRAITS.map((t) => {
                const selected = d.personalityTraits.includes(t);
                return (
                  <button key={t} type="button"
                    onClick={() => updateEvaluation("personalityTraits", toggleArrayItem(d.personalityTraits, t))}
                    className={`px-3.5 py-2 rounded-md text-[13px] font-bold transition-all
                      ${selected
                        ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
                        : "bg-transparent border border-[#2a2d36] text-[#8a8d96] hover:border-[#6b7280]"
                      }`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step 8: Révision ─────────────────────────────────────── */
  function renderStep8() {
    const identity = form.identity;
    const academic = form.academic;
    const physical = form.physical;
    const sports = form.sports;
    const stats = form.stats;
    const media = form.media;
    const evaluation = form.evaluation;
    const submission = form.submission;

    const summaryCard = (title: string, step: number, content: React.ReactNode) => (
      <div className="bg-[#13151a] border border-[#2a2d36] rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-bold tracking-[1.5px] uppercase text-[#8a8d96]">{title}</h3>
          <button type="button" onClick={() => goToStep(step)}
            className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#E63946] hover:text-[#c62d3a] transition-colors">
            Modifier
          </button>
        </div>
        {content}
      </div>
    );

    const infoRow = (label: string, value: string | number | undefined) => {
      if (!value) return null;
      return (
        <div className="flex justify-between py-1.5 border-b border-[#1e2128] last:border-0">
          <span className="text-[12px] text-[#6b7280]">{label}</span>
          <span className="text-[12px] text-[#e0e0e0] font-medium text-right">{value}</span>
        </div>
      );
    };

    const heightStr = physical.heightFeet && physical.heightInches
      ? `${physical.heightFeet}'${physical.heightInches}"`
      : physical.heightFeet ? `${physical.heightFeet}'` : "";

    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">
          Révision &amp; Soumission
        </h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Vérifiez les informations avant de soumettre</p>

        {/* Identity summary */}
        {summaryCard("Étudiant-athlète", 1, (
          <div>
            {infoRow("Nom", `${identity.firstName} ${identity.lastName}`)}
            {infoRow("Genre", identity.gender === "M" ? "Masculin" : identity.gender === "F" ? "Féminin" : identity.gender === "X" ? "Non genré" : "")}
            {infoRow("Date de naissance", identity.dateOfBirth)}
            {infoRow("Promotion", identity.gradYear)}
            {infoRow("École", identity.school)}
            {infoRow("Ville / Région", `${identity.city}${identity.region ? `, ${identity.region}` : ""}`)}
            {infoRow("Téléphone", identity.phone)}
            {infoRow("Courriel", identity.email)}
            {identity.parentName && infoRow("Parent", `${identity.parentName}${identity.parentPhone ? ` — ${identity.parentPhone}` : ""}`)}
          </div>
        ))}

        {/* Academic summary */}
        {summaryCard("Académique", 2, (
          <div>
            {infoRow("Moyenne", academic.gpa ? `${academic.gpa}%` : "")}
            {academic.strongSubjects.length > 0 && infoRow("Matières fortes", academic.strongSubjects.join(", "))}
            {academic.academicHonors.length > 0 && infoRow("Mentions", academic.academicHonors.join(", "))}
            {academic.cegepPrograms.length > 0 && infoRow("Programmes visés", academic.cegepPrograms.join(", ") + (academic.cegepProgramDetail ? ` (${academic.cegepProgramDetail})` : ""))}
            {academic.openToPrivate && infoRow("CÉGEP privé", "Oui")}
            {academic.cegepRegions.length > 0 && infoRow("Régions CÉGEP", academic.cegepRegions.join(", "))}
          </div>
        ))}

        {/* Physical summary */}
        {summaryCard("Physique", 3, (
          <div>
            {infoRow("Taille", heightStr)}
            {infoRow("Poids", physical.weightLbs ? `${physical.weightLbs} lbs` : "")}
            {infoRow("Envergure", physical.wingspan)}
            {infoRow("Main dominante", physical.dominantHand)}
            {infoRow("40 verges", physical.fortyYard)}
            {infoRow("Saut vertical", physical.verticalJump)}
          </div>
        ))}

        {/* Sports summary */}
        {summaryCard("Sport", 4, (
          <div>
            {infoRow("Sport principal", sports.primarySport === "Autre" && sports.primarySportDetail ? `Autre (${sports.primarySportDetail})` : sports.primarySport)}
            {infoRow("Sport secondaire", sports.secondarySport === "Autre" && sports.secondarySportDetail ? `Autre (${sports.secondarySportDetail})` : sports.secondarySport)}
            {infoRow("Position", `${sports.primaryPosition}${sports.secondaryPosition ? ` / ${sports.secondaryPosition}` : ""}`)}
            {sports.secondarySport && sports.secondarySportPosition && infoRow(`Position (${sports.secondarySport === "Autre" && sports.secondarySportDetail ? sports.secondarySportDetail : sports.secondarySport})`, sports.secondarySportPosition)}
            {infoRow("Équipe", sports.currentTeam)}
            {infoRow("Niveau", sports.teamLevel)}
            {infoRow("Chandail", sports.jerseyNumber ? `#${sports.jerseyNumber}` : "")}
            {sports.openToCoaching && infoRow("Ouvert au coaching", "Oui")}
            {sports.league && infoRow("Ligue", sports.league)}
            {sports.secondaryTeam && infoRow(`Équipe (${sports.secondarySport})`, sports.secondaryTeam)}
            {sports.secondaryTeamLevel && infoRow("Niveau (2e sport)", sports.secondaryTeamLevel)}
            {sports.secondaryLeague && infoRow("Ligue (2e sport)", sports.secondaryLeague)}
          </div>
        ))}

        {/* Stats summary */}
        {summaryCard(`Statistiques${sports.primarySport ? ` — ${sports.primarySport}` : ""}`, 5, (
          <div>
            {Object.entries(stats).filter(([k, v]) => k !== "keyStatsSummary" && k !== "customStats" && !!v).map(([k, v]) =>
              <div key={k} className="flex justify-between py-1.5 border-b border-[#1e2128] last:border-0">
                <span className="text-[12px] text-[#6b7280]">{k}</span>
                <span className="text-[12px] text-[#e0e0e0] font-medium text-right">{v}</span>
              </div>
            )}
            {stats.keyStatsSummary && infoRow("Notes", stats.keyStatsSummary)}
            {!Object.entries(stats).some(([k, v]) => k !== "keyStatsSummary" && k !== "customStats" && !!v) && !stats.keyStatsSummary && (
              <p className="text-[12px] text-[#4a4d56] italic">Aucune statistique renseignée</p>
            )}
          </div>
        ))}

        {/* Media summary */}
        {summaryCard("Médias", 6, (
          <div>
            {infoRow("Hudl", media.hudlLink)}
            {infoRow("YouTube", media.youtubeLink)}
            {infoRow("Instagram", media.instagramLink)}
            {infoRow("Faits saillants", media.highlightVideo)}
            {infoRow("Match complet", media.fullGameVideo)}
            {infoRow("Entraînement", media.trainingVideo)}
          </div>
        ))}

        {/* Evaluation summary */}
        {summaryCard("Évaluation", 7, (() => {
          const ratings = [evaluation.speed, evaluation.strength, evaluation.endurance, evaluation.agility, evaluation.gameVision, evaluation.tacticalSense, evaluation.workEthic, evaluation.coachability, evaluation.leadership, evaluation.teamSpirit, evaluation.competitiveLevel];
          const filledR = ratings.filter((r) => r > 0);
          const avg = filledR.length > 0 ? (filledR.reduce((a, b) => a + b, 0) / filledR.length).toFixed(1) : null;
          const showDetailed = evaluation.evalMode === "detailed";
          return (
            <div>
              {infoRow("Mode", showDetailed ? "Détaillée" : "Simplifiée")}
              {infoRow("Cote globale", showDetailed && avg ? `${avg}/5 (moy.)` : evaluation.overallRating ? `${evaluation.overallRating}/5` : "")}
              {showDetailed && evaluation.speed > 0 && infoRow("Vitesse", `${evaluation.speed}/5`)}
              {showDetailed && evaluation.strength > 0 && infoRow("Force", `${evaluation.strength}/5`)}
              {showDetailed && evaluation.endurance > 0 && infoRow("Endurance", `${evaluation.endurance}/5`)}
              {showDetailed && evaluation.agility > 0 && infoRow("Agilité", `${evaluation.agility}/5`)}
              {showDetailed && evaluation.gameVision > 0 && infoRow("Vision du jeu", `${evaluation.gameVision}/5`)}
              {showDetailed && evaluation.tacticalSense > 0 && infoRow("Sens tactique", `${evaluation.tacticalSense}/5`)}
              {showDetailed && evaluation.workEthic > 0 && infoRow("Éthique de travail", `${evaluation.workEthic}/5`)}
              {showDetailed && evaluation.coachability > 0 && infoRow("Coachabilité", `${evaluation.coachability}/5`)}
              {showDetailed && evaluation.leadership > 0 && infoRow("Leadership", `${evaluation.leadership}/5`)}
              {showDetailed && evaluation.teamSpirit > 0 && infoRow("Esprit d'équipe", `${evaluation.teamSpirit}/5`)}
              {showDetailed && evaluation.competitiveLevel > 0 && infoRow("Compétitivité", `${evaluation.competitiveLevel}/5`)}
              {evaluation.personalityTraits.length > 0 && infoRow("Traits", evaluation.personalityTraits.join(", "))}
              {evaluation.coachComments && (
                <div className="mt-2 p-3 bg-[#1A1D24] rounded-lg">
                  <p className="text-[11px] text-[#6b7280] mb-1 font-bold uppercase tracking-wider">Commentaires</p>
                  <p className="text-[12px] text-[#e0e0e0] italic leading-relaxed">&ldquo;{evaluation.coachComments}&rdquo;</p>
                </div>
              )}
            </div>
          );
        })())}

        {/* Submission fields */}
        <div className="border-t border-[#1e2128] mt-6 pt-5">
          <p className={sectionTitle}>Finalisation</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Statut de recrutement{req}</label>
              <NxSelect value={submission.recruitingStatus} onChange={(v) => updateSubmission("recruitingStatus", v)}
                hasError={isFieldEmpty(submission.recruitingStatus)}
                options={[
                  { value: "Ouvert aux offres", label: "Ouvert aux offres" },
                  { value: "Engagé", label: "Engagé" },
                  { value: "Indécis", label: "Indécis" },
                ]}
              />
            </div>
            <div>
              <label className={labelCls}>Division préférée</label>
              <NxSelect value={submission.preferredDivision} onChange={(v) => updateSubmission("preferredDivision", v)}
                placeholder="—"
                options={[
                  { value: "D1", label: "D1" },
                  { value: "D2", label: "D2" },
                  { value: "D3", label: "D3" },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     SUBMITTED STATE
  ══════════════════════════════════════════════════════════════ */

  if (submitted) {
    return (
      <div className="px-4 sm:px-6 py-16 max-w-xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#10b981]/15 mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight mb-2">
          Profil soumis
        </h1>
        <p className="text-[14px] text-[#8a8d96] mb-8 leading-relaxed">
          Le profil de <strong className="text-white">{form.identity.firstName} {form.identity.lastName}</strong> a été soumis avec succès.
          Il sera révisé par l&apos;administration avant d&apos;être visible aux recruteurs.
        </p>
        <button type="button" onClick={() => { setSubmitted(false); setForm(INITIAL_FORM); setCurrentStep(1); setCompletedSteps(new Set()); }}
          className="bg-[#E63946] hover:bg-[#c62d3a] text-white font-head font-bold text-[12px] uppercase tracking-widest rounded-lg px-6 py-3 transition-colors">
          Créer un autre profil
        </button>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════════════════════════ */

  const stepRenderers: Record<number, () => React.ReactNode> = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
    6: renderStep6,
    7: renderStep7,
    8: renderStep8,
  };

  return (
    <div className="px-6 sm:px-10 py-8 max-w-5xl mx-auto">

      {/* ── Breadcrumb ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-[13px] text-[#6b7280] mb-8">
        <span className="font-bold text-[#8a8d96]">Nexus</span>
        <span>/</span>
        <span>Coach</span>
        <span>/</span>
        <span className="text-white">Créer un profil</span>
      </div>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
          Créer un profil étudiant-athlète
        </h1>
        <p className="text-[15px] text-[#6b7280] mt-2">
          Remplissez chaque section pour créer un profil complet
        </p>
      </div>

      {/* ── Stepper ─────────────────────────────────────────────── */}
      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-[14px] mb-8 px-6">
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={goToStep}
        />
      </div>

      {/* ── Step content ────────────────────────────────────────── */}
      <div className="transition-opacity duration-200">
        {stepRenderers[currentStep]?.()}
      </div>

      {/* ── Validation error banner ──────────────────────────────── */}
      {showErrors && !validateStep(currentStep) && (
        <div className="mt-4 flex items-center gap-3 bg-[#E63946]/[0.08] border border-[#E63946]/25 rounded-lg px-5 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
          </svg>
          <p className="text-[13px] text-[#E63946] font-medium">
            Veuillez remplir tous les champs obligatoires (<span className="font-bold">*</span>) avant de continuer.
          </p>
        </div>
      )}

      {/* ── Bottom navigation ───────────────────────────────────── */}
      <div className="flex items-center justify-between mt-8 gap-4">
        <button type="button" onClick={goPrev} disabled={currentStep === 1}
          className={`flex items-center gap-2.5 bg-[#1A1D24] border border-[#2a2d36] text-[#e0e0e0] rounded-lg px-6 py-3.5 font-head font-bold text-[13px] uppercase tracking-widest
            transition-all duration-150
            ${currentStep === 1
              ? "opacity-40 cursor-not-allowed"
              : "hover:border-[#8a8d96] hover:bg-[#22252c] hover:-translate-x-0.5 active:scale-95 active:bg-[#2a2d36] cursor-pointer"
            }`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="transition-transform duration-150 group-hover:-translate-x-0.5">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Précédent
        </button>

        <div className="flex items-center gap-3">
          {currentStep === 8 && (
            <button type="button" onClick={handleDraft}
              className="bg-[#1A1D24] border border-[#2a2d36] text-[#e0e0e0] rounded-lg px-6 py-3.5 font-head font-bold text-[13px] uppercase tracking-widest transition-all duration-150 hover:border-[#8a8d96] hover:bg-[#22252c] active:scale-95 active:bg-[#2a2d36]">
              Brouillon
            </button>
          )}
          {currentStep < 8 ? (
            <button type="button" onClick={goNext}
              className="flex items-center gap-2.5 bg-[#E63946] text-white rounded-lg px-6 py-3.5 font-head font-bold text-[13px] uppercase tracking-widest
                transition-all duration-150 hover:bg-[#c62d3a] hover:translate-x-0.5 hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95 active:bg-[#a8222e] cursor-pointer">
              Suivant
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit}
              className="flex items-center gap-2.5 bg-[#E63946] text-white rounded-lg px-6 py-3.5 font-head font-bold text-[13px] uppercase tracking-widest
                transition-all duration-150 hover:bg-[#c62d3a] hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95 active:bg-[#a8222e] cursor-pointer">
              Soumettre le profil
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
