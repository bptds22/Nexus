"use client";

import { use, useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadAthleteRaw, buildFormFromRaw } from "../../_data/loadAthleteFromSupabase";
import { BADGE_CONFIG, BADGE_ORDER, MAX_BADGES, MAX_DETAIL_LENGTH, getSportStats, type DistinctionEntry } from "@/lib/config/badges";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import StepIndicator from "../../../components/StepIndicator";
import TagInput from "../../../components/TagInput";
import DatePicker from "../../../components/DatePicker";
import SportPositionSelect from "../../../components/SportPositionSelect";
import NxSelect from "../../../components/NxSelect";
import FormModeToggle from "../../../components/FormModeToggle";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import SchoolSelect from "@/components/ui/SchoolSelect";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   MODIFIER — Coach Edit View (7-Step Form Wizard)
   Same format as "Créer un profil", pre-filled with existing data.
   Scouting report model (sport-agnostic).
═══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   TYPE DEFINITIONS
══════════════════════════════════════════════════════════════ */

interface AthleteFormData {
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
    cegepType: "dec_general" | "technique" | "";
    cegepProgramDetail: string;
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
  scouting: {
    evalMode: "simple" | "detailed";
    starRating: number;
    traitRatings: Record<string, number>;
    badges: DistinctionEntry[];
    coachEndorsement: string;
  };
  parentalConsent: boolean;
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
}

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */

const STEPS = [
  { number: 1, name: "Identité" },
  { number: 2, name: "Académique" },
  { number: 3, name: "Physique" },
  { number: 4, name: "Sport" },
  { number: 5, name: "Évaluation" },
  { number: 6, name: "Médias" },
  { number: 7, name: "Révision" },
];

const SUBJECTS = [
  "Éducation physique", "Mathématiques", "Sciences", "Français",
  "Anglais", "Histoire", "Arts", "Informatique",
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

interface CoachTeamData {
  school: string;
  city: string;
  region: string;
  teams: { id: string; name: string; level: string; division: string; sport: string; league: string; gender: "M" | "F" }[];
}

/* ══════════════════════════════════════════════════════════════
   HELPERS — build form data from existing profile
══════════════════════════════════════════════════════════════ */

function emptyForm(): AthleteFormData {
  return {
    identity: { identityMode: "simple", photo: "", firstName: "", lastName: "", gender: "", dateOfBirth: "", gradYear: "", school: "", city: "", region: "", phone: "", email: "", parentName: "", parentPhone: "" },
    academic: { academicMode: "simple", gpa: "", strongSubjects: [], academicHonors: [], cegepType: "", cegepProgramDetail: "", openToPrivate: false, openToAnglophone: false, openToRelocate: false, cegepRegions: [] },
    physical: { physicalMode: "simple", heightFeet: "", heightInches: "", weightLbs: "", wingspan: "", handSize: "", dominantHand: "", dominantFoot: "", fortyYard: "", verticalJump: "", broadJump: "", benchPress: "", shuttleAgility: "", sprint100m: "" },
    sports: { sportsMode: "simple", primarySport: "", primarySportDetail: "", secondarySport: "", secondarySportDetail: "", primaryPosition: "", secondaryPosition: "", secondarySportPosition: "", selectedTeamId: "", currentTeam: "", teamLevel: "", teamDivision: "", jerseyNumber: "", league: "", secondaryTeamId: "", secondaryTeam: "", secondaryTeamLevel: "", secondaryTeamDivision: "", secondaryLeague: "", recruitingLevel: "", openToCoaching: false },
    scouting: { evalMode: "simple", starRating: 0, traitRatings: {}, badges: [], coachEndorsement: "" },
    media: { mediaMode: "simple", hudlLink: "", youtubeLink: "", instagramLink: "", highlightVideo: "", fullGameVideo: "", trainingVideo: "" },
    submission: { recruitingStatus: "", preferredDivision: "" },
    parentalConsent: false,
  };
}

/* ══════════════════════════════════════════════════════════════
   STYLE CONSTANTS
══════════════════════════════════════════════════════════════ */

const cardCls = "bg-[#1A1D24] rounded-[14px] border border-[#1e2128] p-8";
const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[15px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "block text-[14px] font-bold tracking-[1.2px] uppercase text-[#6b7280] mb-2";
const sectionTitle = "text-[14px] font-bold tracking-[1.5px] uppercase text-[#6b7280] mb-5";
const errBorder = "border-[#E63946]";
const req = <span className="text-[#E63946]"> *</span>;

function mapStepParam(param: string | null): number {
  if (param === "missing") return 3;
  const n = Number(param);
  return n >= 1 && n <= 7 ? n : 1;
}

/* ══════════════════════════════════════════════════════════════
   PAGE COMPONENT
══════════════════════════════════════════════════════════════ */

export default function ModifierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <ModifierContent id={id} />
    </Suspense>
  );
}

function ModifierContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AthleteFormData>(emptyForm);
  const [currentStep, setCurrentStep] = useState(mapStepParam(stepParam));
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showErrors, setShowErrors] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Recruitment status fields ──
  const [recruitmentStatus, setRecruitmentStatus] = useState<string>("OUVERT");
  const [committedSchoolId, setCommittedSchoolId] = useState<string>("");
  const [openToOffers, setOpenToOffers] = useState<boolean | null>(null);
  const [schoolsList, setSchoolsList] = useState<{ id: string; name: string }[]>([]);
  const [coachTeam, setCoachTeam] = useState<CoachTeamData>({ school: "", city: "", region: "", teams: [] });

  useEffect(() => {
    // Fetch schools for committed school selector + coach's teams
    const supabase = createClient();
    supabase.from("schools").select("id, name").order("name").then(({ data: schoolsData }) => {
      if (schoolsData) setSchoolsList(schoolsData);
    });

    // Load coach's school + teams from equipes table
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("users")
        .select("school_id, schools!school_id(name, city, region)")
        .eq("id", user.id)
        .single();
      if (!profile?.school_id) return;
      const schoolRel = (profile as any).schools;
      const school = Array.isArray(schoolRel) ? schoolRel[0] : schoolRel;

      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, division, league, age_group, season, sport_id, sports!sport_id(nom)")
        .eq("school_id", profile.school_id)
        .eq("is_active", true);

      console.log("[Modifier] Loaded teams:", teams?.length);

      setCoachTeam({
        school: school?.name || "",
        city: school?.city || "",
        region: school?.region || "",
        teams: (teams || []).map((t: any) => {
          const sportRel = t.sports;
          const sport = Array.isArray(sportRel) ? sportRel[0] : sportRel;
          const level = [t.age_group, t.division].filter(Boolean).join(" ");
          return {
            id: t.id,
            name: t.name || "",
            level: level || "",
            division: t.division || "",
            sport: sport?.nom || "",
            league: t.league || "RSEQ",
            gender: "M" as "M" | "F",
          };
        }),
      });

      // Load athlete's current team assignment
      const { data: currentTeamAssignment } = await supabase
        .from("team_athletes")
        .select("team_id")
        .eq("athlete_id", id)
        .maybeSingle();
      console.log("[Modifier] Current team assignment:", currentTeamAssignment);
      if (currentTeamAssignment?.team_id) {
        const matchedTeam = (teams || []).find((t: any) => t.id === currentTeamAssignment.team_id);
        if (matchedTeam) {
          const sportRel = (matchedTeam as any).sports;
          const sport = Array.isArray(sportRel) ? sportRel[0] : sportRel;
          const level = [(matchedTeam as any).age_group, (matchedTeam as any).division].filter(Boolean).join(" ");
          setForm((prev) => ({
            ...prev,
            sports: {
              ...prev.sports,
              selectedTeamId: matchedTeam.id,
              currentTeam: matchedTeam.name || "",
              teamLevel: level || "",
              teamDivision: (matchedTeam as any).division || "",
              league: (matchedTeam as any).league || "RSEQ",
            },
          }));
        }
      }

    })();

    loadAthleteRaw(id).then(({ data, error }) => {
      if (error || !data) {
        console.log("Modifier: failed to load:", error);
        setLoading(false);
        return;
      }
      const raw = data as Record<string, unknown>;
      console.log("Modifier raw data:", JSON.stringify({
        numero_jersey: raw.numero_jersey,
        programme: raw.programme_cegep_vise,
        ouvert_prive: raw.ouvert_cegep_prive,
        ouvert_anglo: raw.ouvert_cegep_anglophone,
        pret_demenager: raw.pret_changer_region,
        cote: raw.cote_globale_entraineur,
        notes: raw.notes_coach,
      }));
      // Build form directly from raw DB data — preserves all values
      const formFromDB = buildFormFromRaw(raw) as unknown as AthleteFormData;
      setForm(formFromDB);

      // Load recruitment status fields from athlete record
      console.log('Recruitment status fields:', { recruitment_status: raw.recruitment_status, committed_school_id: raw.committed_school_id, open_to_offers: raw.open_to_offers });
      if (raw.recruitment_status) setRecruitmentStatus(raw.recruitment_status as string);
      if (raw.committed_school_id) setCommittedSchoolId(raw.committed_school_id as string);
      if (raw.open_to_offers != null) setOpenToOffers(raw.open_to_offers as boolean);

      setLoading(false);
    });
  }, [id]);

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

  const updateMedia = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, media: { ...prev.media, [field]: value } }));
  }, []);

  const updateSubmission = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, submission: { ...prev.submission, [field]: value } }));
  }, []);

  const updateScouting = useCallback((field: string, value: string | number | DistinctionEntry[] | Record<string, number>) => {
    setForm((prev) => ({ ...prev, scouting: { ...prev.scouting, [field]: value } }));
  }, []);

  /* ── Badge helpers ─────────────────────────────────────────── */

  function toggleBadge(badgeKey: string) {
    const badges = form.scouting.badges;
    const idx = badges.findIndex((b) => b.badge === badgeKey);
    if (idx >= 0) {
      updateScouting("badges", badges.filter((_, i) => i !== idx));
    } else if (badges.length < MAX_BADGES) {
      updateScouting("badges", [...badges, { badge: badgeKey }]);
    }
  }

  function updateBadgeDetail(badgeKey: string, detail: string) {
    const next: DistinctionEntry[] = form.scouting.badges.map((b) =>
      b.badge === badgeKey ? { ...b, detail: detail || undefined } : b
    );
    updateScouting("badges", next);
  }

  /* ── Toggle helpers ─────────────────────────────────────────── */

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
  }

  /* ── Validation ────────────────────────────────────────────── */

  function validateStep(step: number): boolean {
    switch (step) {
      case 1: {
        const d = form.identity;
        const base = !!(d.firstName && d.lastName && d.dateOfBirth && d.gradYear);
        if (d.identityMode === "detailed") return base && !!(d.gender && d.school);
        return base;
      }
      case 2: return true;
      case 3: return true;
      case 4: {
        const s = form.sports;
        const base = !!(s.primarySport && s.primaryPosition && s.jerseyNumber);
        if (s.sportsMode === "detailed") return base && !!(s.selectedTeamId || s.currentTeam);
        return base;
      }
      case 5: return true;
      case 6: return true;
      case 7: return true;
      default: return true;
    }
  }

  function isFieldEmpty(value: string): boolean { return showErrors && !value; }

  /* ── Navigation ────────────────────────────────────────────── */

  function goNext() {
    if (!validateStep(currentStep)) { setShowErrors(true); return; }
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setShowErrors(false);
    if (currentStep < 7) { setCurrentStep(currentStep + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  function goPrev() {
    setShowErrors(false);
    if (currentStep > 1) { setCurrentStep(currentStep - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  function goToStep(step: number) {
    setShowErrors(false); setCurrentStep(step); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleQuickSave() {
    setSaving(true);
    const ok = await saveToSupabase();
    setSaving(false);
    if (ok) {
      setSaved(true);
    }
  }

  async function handleSave() {
    if (!validateStep(7)) { setShowErrors(true); return; }
    const ok = await saveToSupabase();
    if (ok) {
      setCompletedSteps((prev) => new Set([...prev, 7]));
      setSaved(true);
    }
  }

  async function saveToSupabase(): Promise<boolean> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { console.log("handleSave: no user"); return false; }

    // Auto-calculate cote_globale from trait ratings if in detailed mode
    let coteGlobale = form.scouting.starRating || null;
    if (form.scouting.evalMode === "detailed") {
      const traitValues = Object.values(form.scouting.traitRatings).filter((v) => v > 0);
      if (traitValues.length > 0) {
        coteGlobale = parseFloat((traitValues.reduce((a, b) => a + b, 0) / traitValues.length).toFixed(2));
      }
    }

    // ── PERSONAL INFO ──
    const personalData = {
      first_name: form.identity.firstName,
      last_name: form.identity.lastName,
      date_naissance: form.identity.dateOfBirth || null,
      genre: form.identity.gender || null,
      annee_diplomation: form.identity.gradYear ? parseInt(form.identity.gradYear) : null,
      email: form.identity.email || null,
      photo_url: form.identity.photo || null,
    };
    console.log("Saving personal:", personalData);

    // ── ACADEMIC ──
    const academicData = {
      moyenne_generale: form.academic.gpa ? parseFloat(form.academic.gpa) : null,
      matieres_fortes: form.academic.strongSubjects || [],
      mentions_academiques: form.academic.academicHonors || [],
      programme_cegep_vise: form.academic.cegepType ? [form.academic.cegepType === "technique" && form.academic.cegepProgramDetail ? form.academic.cegepProgramDetail : form.academic.cegepType === "dec_general" ? "DEC général" : form.academic.cegepType] : [],
      ouvert_cegep_prive: form.academic.openToPrivate,
      ouvert_cegep_anglophone: form.academic.openToAnglophone,
      pret_changer_region: form.academic.openToRelocate,
      regions_cegep_preferees: form.academic.cegepRegions || [],
    };
    console.log("Saving academic:", academicData);

    // ── PHYSICAL ──
    const physicalData = {
      taille_pieds: form.physical.heightFeet ? parseInt(form.physical.heightFeet) : null,
      taille_pouces: form.physical.heightInches ? parseInt(form.physical.heightInches) : null,
      poids_lbs: form.physical.weightLbs ? parseFloat(form.physical.weightLbs) : null,
      envergure: form.physical.wingspan || null,
      taille_mains: form.physical.handSize || null,
      main_dominante: form.physical.dominantHand || null,
      pied_dominant: form.physical.dominantFoot || null,
      test_40_verges: form.physical.fortyYard || null,
      saut_vertical: form.physical.verticalJump || null,
      saut_longueur: form.physical.broadJump || null,
      developpe_couche: form.physical.benchPress || null,
      navette_agilite: form.physical.shuttleAgility || null,
      sprint_100m: form.physical.sprint100m || null,
    };
    console.log("Saving physical:", physicalData);

    // ── SPORT — look up UUIDs from names ──
    let sportId = null;
    let positionId = null;
    if (form.sports.primarySport) {
      const { data: sportRow } = await supabase.from("sports").select("id").eq("nom", form.sports.primarySport).maybeSingle();
      sportId = sportRow?.id || null;
      console.log("Sport save:", { dropdownValue: form.sports.primarySport, sport_id: sportId });
    }
    if (form.sports.primaryPosition) {
      const { data: posRow } = await supabase.from("positions").select("id").eq("abreviation", form.sports.primaryPosition).maybeSingle();
      if (!posRow) {
        // Try matching by full name
        const { data: posRow2 } = await supabase.from("positions").select("id").eq("nom", form.sports.primaryPosition).maybeSingle();
        positionId = posRow2?.id || null;
      } else {
        positionId = posRow.id;
      }
      console.log("Position save:", { dropdownValue: form.sports.primaryPosition, position_id: positionId });
    }

    // ── SECONDARY SPORT/POSITION ──
    let sportSecondaireId = null;
    let positionSecondaireId = null;
    if (form.sports.secondarySport && form.sports.secondarySport !== "Aucun") {
      const { data: secSportRow } = await supabase.from("sports").select("id").eq("nom", form.sports.secondarySport).maybeSingle();
      sportSecondaireId = secSportRow?.id || null;
      console.log("Secondary sport save:", { dropdownValue: form.sports.secondarySport, sport_secondaire_id: sportSecondaireId });
    }
    // Secondary position = same sport, different position (e.g. OG / LB)
    if (form.sports.secondaryPosition && sportId) {
      const { data: secPosRow } = await supabase.from("positions").select("id").eq("abreviation", form.sports.secondaryPosition).eq("sport_id", sportId).maybeSingle();
      positionSecondaireId = secPosRow?.id || null;
      console.log("Secondary position save:", { dropdownValue: form.sports.secondaryPosition, position_secondaire_id: positionSecondaireId });
    }

    const sportData: Record<string, unknown> = {
      numero_jersey: form.sports.jerseyNumber ? parseInt(form.sports.jerseyNumber) : null,
      ouvert_entraineur_cegep: form.sports.openToCoaching,
    };
    if (sportId) sportData.sport_id = sportId;
    if (positionId) sportData.position_id = positionId;
    sportData.sport_secondaire_id = sportSecondaireId;
    sportData.position_secondaire_id = positionSecondaireId;
    console.log("Saving sport (full):", JSON.stringify(sportData));

    // ── EVALUATION ──
    const evalData = {
      cote_globale_entraineur: coteGlobale,
      notes_coach: form.scouting.coachEndorsement || null,
    };
    console.log("Saving evaluation:", evalData);

    // ── MEDIA ──
    const mediaData = {
      video_faits_saillants_url: form.media.highlightVideo || null,
      hudl_url: form.media.hudlLink || null,
      youtube_url: form.media.youtubeLink || null,
      instagram_url: form.media.instagramLink || null,
      video_match_complet_url: form.media.fullGameVideo || null,
      video_entrainement_url: form.media.trainingVideo || null,
    };
    console.log("Saving media:", mediaData);

    // ── CONSENT ──
    const consentData = {
      consentement_parental: form.parentalConsent,
      consentement_parental_date: form.parentalConsent ? new Date().toISOString() : null,
    };

    // ── RECRUITMENT OVERRIDE ──
    const overrideValue = form.submission.recruitingStatus || null;
    const overrideData: Record<string, unknown> = {
      statut_recrutement_override: overrideValue,
      recrutement_override_at: overrideValue ? new Date().toISOString() : null,
    };

    // ── RECRUITMENT STATUS ──
    console.log('Saving recruitment status:', { recruitmentStatus, committedSchoolId, openToOffers });
    const recruitmentData: Record<string, unknown> = {
      recruitment_status: recruitmentStatus,
      committed_school_id: recruitmentStatus === 'RECRUTE' ? committedSchoolId || null : null,
      open_to_offers: recruitmentStatus === 'RECRUTE' ? openToOffers : null,
      recruitment_status_changed_by: user.id,
      recruitment_status_changed_at: new Date().toISOString(),
    };

    // Merge all into one update
    const updateData = {
      ...personalData,
      ...academicData,
      ...physicalData,
      ...sportData,
      ...evalData,
      ...mediaData,
      ...consentData,
      ...overrideData,
      ...recruitmentData,
    };

    console.log("FULL UPDATE PAYLOAD:", JSON.stringify(updateData));
    const { error } = await supabase.from("athletes").update(updateData).eq("id", id);
    console.log("Save result:", error ? error.message : "SUCCESS");

    if (error) {
      console.error("Save failed:", error.message);
      alert("Erreur lors de la sauvegarde: " + error.message);
      return false;
    }

    // ── UPSERT evaluations table ──
    const tr = form.scouting.traitRatings;
    console.log("Trait ratings from form:", JSON.stringify(tr));

    // Map UI trait keys → DB columns (keys match directly)
    const vitesse_explosivite = tr.vitesse_explosivite || null;
    const force_puissance = tr.force_puissance || null;
    const endurance_cardio = tr.endurance_cardio || null;
    const agilite_coordination = tr.agilite_coordination || null;
    const vision_du_jeu = tr.vision_du_jeu || null;
    const sens_tactique = tr.sens_tactique || null;
    const leadership = tr.leadership || null;
    const discipline = tr.discipline || null;
    const coachabilite = tr.coachabilite || null;
    const intelligence_jeu = tr.intelligence_jeu || null;
    const competitivite = tr.competitivite || null;
    const esprit_equipe = tr.esprit_equipe || null;
    const resilience = tr.resilience || null;
    const attitude_mentalite = tr.attitude_mentalite || null;

    // Distinctions — save full object array (new format)
    const distinctionsToSave = form.scouting.badges.filter((b) => b && b.badge);
    console.log("Distinctions to save:", distinctionsToSave);
    console.log("Saving jersey:", form.sports.jerseyNumber);

    const evalRecord = {
      coach_id: user.id,
      athlete_id: id,
      cote_globale: coteGlobale,
      vitesse_explosivite,
      force_puissance,
      endurance_cardio,
      agilite_coordination,
      vision_du_jeu,
      sens_tactique,
      leadership,
      discipline,
      coachabilite,
      intelligence_jeu,
      competitivite,
      esprit_equipe,
      resilience,
      attitude_mentalite,
      distinctions: distinctionsToSave,
      rapport_entraineur: form.scouting.coachEndorsement || null,
    };
    console.log("Saving evaluation:", JSON.stringify(evalRecord));
    const { error: evalError } = await supabase
      .from("evaluations")
      .upsert(evalRecord, { onConflict: "coach_id,athlete_id" });
    console.log("Evaluation upsert result:", evalError ? evalError.message : "SUCCESS");

    // ── SAVE team assignment ──
    const selectedTeamId = form.sports.selectedTeamId;
    if (selectedTeamId) {
      // Remove any existing assignment, then insert the new one
      await supabase.from("team_athletes").delete().eq("athlete_id", id);
      const { error: teamErr } = await supabase.from("team_athletes").insert({
        team_id: selectedTeamId,
        athlete_id: id,
        jersey_number: form.sports.jerseyNumber || null,
      });
      console.log("Team assignment result:", teamErr ? teamErr.message : "SUCCESS");
    } else {
      // No team selected — remove any existing assignment
      await supabase.from("team_athletes").delete().eq("athlete_id", id);
    }

    return true;
  }

  /* ══════════════════════════════════════════════════════════════
     STEP RENDERERS
  ══════════════════════════════════════════════════════════════ */

  /* ── Step 1: Identité ─────────────────────────────────────── */
  function renderStep1() {
    const d = form.identity;
    const isDetailed = d.identityMode === "detailed";

    const RECRUITMENT_STATUS_OPTIONS = [
      { value: "OUVERT", label: "Ouvert" },
      { value: "EN_PROCESSUS", label: "En processus" },
      { value: "RECRUTE", label: "Recruté" },
      { value: "RETIRE", label: "Retiré" },
    ];

    return (
      <>
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Identité de l&apos;étudiant-athlète</h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Informations personnelles de base</p>

        <FormModeToggle mode={d.identityMode} onChange={(m) => updateIdentity("identityMode", m)} />

        <div className="flex items-center gap-6 mb-8">
          <div className="relative group shrink-0">
            {d.photo ? (
              <img src={d.photo} alt="Photo" className="w-[100px] h-[100px] rounded-xl object-cover border-2 border-[#2a2d36]" />
            ) : (
              <div className="w-[100px] h-[100px] rounded-xl bg-[#13151a] border-2 border-dashed border-[#2a2d36] flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
              <input type="file" accept="image/*" className="hidden" title="Téléverser une photo" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                updateIdentity("photo", URL.createObjectURL(f));
                const supabase = (await import("@/lib/supabase/client")).createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const fileExt = f.name.split('.').pop();
                const filePath = `athletes/${user.id}/${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, f, { upsert: true });
                if (uploadError) { console.error("Photo upload error:", JSON.stringify(uploadError), uploadError.message, uploadError.statusCode); return; }
                const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
                updateIdentity("photo", urlData.publicUrl);
              }} />
            </label>
          </div>
          <div>
            <p className="text-[14px] font-bold text-white">Photo de l&apos;athlète</p>
            <p className="text-[14px] text-[#4a4d56] mt-0.5">Pour la carte joueur. JPG ou PNG.</p>
            {d.photo && <button type="button" onClick={() => updateIdentity("photo", "")} className="text-[12px] text-[#E63946] mt-1 hover:underline">Retirer la photo</button>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div><label className={labelCls}>Prénom{req}</label><input type="text" value={d.firstName} onChange={(e) => updateIdentity("firstName", e.target.value)} placeholder="Prénom" className={`${inputCls} ${isFieldEmpty(d.firstName) ? errBorder : ""}`} /></div>
          <div><label className={labelCls}>Nom{req}</label><input type="text" value={d.lastName} onChange={(e) => updateIdentity("lastName", e.target.value)} placeholder="Nom de famille" className={`${inputCls} ${isFieldEmpty(d.lastName) ? errBorder : ""}`} /></div>
          <div><label className={labelCls}>Date de naissance{req}</label><DatePicker value={d.dateOfBirth} onChange={(date) => updateIdentity("dateOfBirth", date)} placeholder="Sélectionner une date" hasError={isFieldEmpty(d.dateOfBirth)} /></div>
          <div><label className={labelCls}>Promotion{req}</label><NxSelect value={d.gradYear} onChange={(v) => updateIdentity("gradYear", v)} hasError={isFieldEmpty(d.gradYear)} options={[2025, 2026, 2027, 2028, 2029].map((y) => ({ value: String(y), label: String(y) }))} /></div>
        </div>

        {isDetailed && (
          <div className="border-t border-[#1e2128] mt-6 pt-5">
            <p className={sectionTitle}>Détails additionnels</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div><label className={labelCls}>Genre{req}</label><NxSelect value={d.gender} onChange={(v) => updateIdentity("gender", v)} hasError={isDetailed && isFieldEmpty(d.gender)} options={[{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }, { value: "X", label: "Non genré" }]} /></div>
              <div><label className={labelCls}>École secondaire</label><div className="relative"><input type="text" value={d.school} readOnly aria-label="École secondaire" className={`${inputCls} !bg-[#0d0f13] opacity-70 cursor-not-allowed`} /><svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div></div>
              <div><label className={labelCls}>Ville</label><div className="relative"><input type="text" value={d.city} readOnly aria-label="Ville" className={`${inputCls} !bg-[#0d0f13] opacity-70 cursor-not-allowed`} /><svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div></div>
              <div><label className={labelCls}>Région</label><div className="relative"><input type="text" value={d.region} readOnly aria-label="Région" className={`${inputCls} !bg-[#0d0f13] opacity-70 cursor-not-allowed`} /><svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div></div>
              <div><label className={labelCls}>Téléphone</label><input type="tel" value={d.phone} onChange={(e) => updateIdentity("phone", e.target.value)} placeholder="(514) 000-0000" aria-label="Téléphone" className={inputCls} /></div>
              <div><label className={labelCls}>Courriel</label><input type="email" value={d.email} onChange={(e) => updateIdentity("email", e.target.value)} placeholder="athlete@email.com" aria-label="Courriel" className={inputCls} /></div>
            </div>
            <div className="border-t border-[#1e2128] mt-6 pt-5">
              <p className={sectionTitle}>Contact parent</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div><label className={labelCls}>Nom du parent</label><input type="text" value={d.parentName} onChange={(e) => updateIdentity("parentName", e.target.value)} placeholder="Nom complet" aria-label="Nom du parent" className={inputCls} /></div>
                <div><label className={labelCls}>Téléphone du parent</label><input type="tel" value={d.parentPhone} onChange={(e) => updateIdentity("parentPhone", e.target.value)} placeholder="(514) 000-0000" aria-label="Téléphone du parent" className={inputCls} /></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Statut de recrutement ── */}
      <div className={`${cardCls} mt-6`}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Statut de recrutement</h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Situation actuelle de l&apos;athlète dans le processus de recrutement</p>

        <div className="space-y-6">
          <div>
            <label className={labelCls}>Statut de recrutement</label>
            <select
              title="Statut de recrutement"
              value={recruitmentStatus}
              onChange={(e) => {
                const val = e.target.value;
                setRecruitmentStatus(val);
                if (val !== "RECRUTE") {
                  setCommittedSchoolId("");
                  setOpenToOffers(null);
                }
              }}
              className={inputCls}
            >
              {RECRUITMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {recruitmentStatus === "RECRUTE" && (
            <div className="border-t border-[#1e2128] pt-5 space-y-6">
              <div>
                <label className={labelCls}>CÉGEP d&apos;engagement</label>
                <SchoolSelect
                  value={committedSchoolId || null}
                  onChange={(id) => setCommittedSchoolId(id)}
                  filterType="CEGEP"
                  placeholder="Rechercher un CÉGEP..."
                />
              </div>

              <div>
                <label className={labelCls}>Ouvert à d&apos;autres offres?</label>
                <div className="flex items-center gap-3 mt-1">
                  {([{ value: true, label: "Oui" }, { value: false, label: "Non" }] as const).map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setOpenToOffers(opt.value)}
                      className={`px-5 py-2.5 rounded-lg border text-[14px] font-bold transition-colors ${openToOffers === opt.value ? "border-[#E63946] bg-[#E63946]/10 text-[#E63946]" : "border-[#2a2d36] text-[#8a8d96] hover:border-[#6b7280]"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  /* ── Step 2: Académique ───────────────────────────────────── */
  function renderStep2() {
    const d = form.academic;
    const isDetailedAcad = d.academicMode === "detailed";
    const checkbox = (checked: boolean, onChange: () => void, label: string) => (
      <label className="flex items-center gap-3 cursor-pointer group">
        <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a] group-hover:border-[#6b7280]"}`}>
          {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
        </span>
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <span className="text-[14px] text-[#e0e0e0]">{label}</span>
      </label>
    );

    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Profil académique</h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Résultats scolaires et objectifs CÉGEP</p>

        <FormModeToggle mode={d.academicMode} onChange={(m) => updateAcademic("academicMode", m)} />

        <div className="space-y-6">
          <div className="max-w-[220px]">
            <label className={labelCls}>Moyenne générale</label>
            <div className="relative"><input type="number" min="0" max="100" step="0.1" value={d.gpa} onChange={(e) => updateAcademic("gpa", e.target.value)} placeholder="85" className={`${inputCls} pr-8`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-[14px]">%</span></div>
          </div>

          {isDetailedAcad && (
            <div>
              <p className={labelCls}>Matières fortes</p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => { const selected = d.strongSubjects.includes(s); return (<button key={s} type="button" onClick={() => updateAcademic("strongSubjects", toggleArrayItem(d.strongSubjects, s))} className={`px-3.5 py-2 rounded-md text-[14px] font-bold transition-all ${selected ? "bg-[#E63946]/18 text-[#E63946] border border-[#E63946]/30" : "bg-transparent border border-[#2a2d36] text-[#8a8d96] hover:border-[#6b7280]"}`}>{s}</button>); })}
              </div>
            </div>
          )}

          {isDetailedAcad && (
            <div><label className={labelCls}>Mentions académiques</label><TagInput tags={d.academicHonors} onChange={(tags) => updateAcademic("academicHonors", tags)} placeholder="Tapez une mention + Entrée" /></div>
          )}

          <div>
            <p className={labelCls}>Programme CÉGEP visé</p>
            <div className="flex items-center gap-3 mt-1">
              {([{ value: "dec_general" as const, label: "DEC général (préuniversitaire)" }, { value: "technique" as const, label: "Programme technique" }]).map((opt) => (
                <label key={opt.value} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${d.cegepType === opt.value ? "border-[#3b82f6] bg-[#3b82f6]/10 text-white" : "border-[#2a2d36] text-[#8a8d96] hover:border-[#6b7280]"}`}>
                  <input type="radio" name="cegepType" value={opt.value} checked={d.cegepType === opt.value} onChange={() => updateAcademic("cegepType", opt.value)} className="sr-only" />
                  <span className="text-[14px] font-bold">{opt.label}</span>
                </label>
              ))}
            </div>
            {d.cegepType === "technique" && <input type="text" value={d.cegepProgramDetail} onChange={(e) => updateAcademic("cegepProgramDetail", e.target.value)} placeholder="Précisez le programme technique (ex: Techniques policières, Soins infirmiers…)" className={`${inputCls} mt-3`} />}
          </div>

          <div className="space-y-3">
            {checkbox(d.openToPrivate, () => updateAcademic("openToPrivate", !d.openToPrivate), "Ouvert à un CÉGEP privé")}
            {checkbox(d.openToAnglophone, () => updateAcademic("openToAnglophone", !d.openToAnglophone), "Ouvert à un CÉGEP anglophone")}
            {checkbox(d.openToRelocate, () => updateAcademic("openToRelocate", !d.openToRelocate), "Prêt à changer de région")}
          </div>

          {isDetailedAcad && (
            <div>
              <p className={labelCls}>Régions CÉGEP préférées</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CEGEP_REGIONS.map((r) => { const checked = d.cegepRegions.includes(r); return (<label key={r} className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={checked} onChange={() => updateAcademic("cegepRegions", toggleArrayItem(d.cegepRegions, r))} className="sr-only" /><span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] group-hover:border-[#6b7280]"}`}>{checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}</span><span className="text-[14px] text-[#e0e0e0]">{r}</span></label>); })}
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
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Profil physique</h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Mensurations et tests athlétiques</p>
        <FormModeToggle mode={d.physicalMode} onChange={(m) => updatePhysical("physicalMode", m)} />
        <p className={sectionTitle}>Mensurations</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8">
          <div><label className={labelCls}>Taille — Pieds</label><NxSelect value={d.heightFeet} onChange={(v) => updatePhysical("heightFeet", v)} placeholder="—" options={[4, 5, 6, 7].map((f) => ({ value: String(f), label: `${f}'` }))} /></div>
          <div><label className={labelCls}>Pouces</label><NxSelect value={d.heightInches} onChange={(v) => updatePhysical("heightInches", v)} placeholder="—" options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i}"` }))} /></div>
          <div><label className={labelCls}>Poids (lbs)</label><input type="number" value={d.weightLbs} onChange={(e) => updatePhysical("weightLbs", e.target.value)} placeholder="185" className={inputCls} /></div>
          {isDetailedPhys && (<><div><label className={labelCls}>Envergure</label><input type="text" value={d.wingspan} onChange={(e) => updatePhysical("wingspan", e.target.value)} placeholder={'6\'4"'} className={inputCls} /></div><div><label className={labelCls}>Taille des mains</label><input type="text" value={d.handSize} onChange={(e) => updatePhysical("handSize", e.target.value)} placeholder={'9.5"'} className={inputCls} /></div></>)}
          <div><label className={labelCls}>Main dominante</label><NxSelect value={d.dominantHand} onChange={(v) => updatePhysical("dominantHand", v)} placeholder="—" options={[{ value: "Droite", label: "Droite" }, { value: "Gauche", label: "Gauche" }, { value: "Ambidextre", label: "Ambidextre" }]} /></div>
          {isDetailedPhys && (<div><label className={labelCls}>Pied dominant</label><NxSelect value={d.dominantFoot} onChange={(v) => updatePhysical("dominantFoot", v)} placeholder="—" options={[{ value: "Droit", label: "Droit" }, { value: "Gauche", label: "Gauche" }, { value: "Les deux", label: "Les deux" }]} /></div>)}
        </div>
        {isDetailedPhys && (
          <div className="border-t border-[#1e2128] pt-5">
            <p className={sectionTitle}>Tests athlétiques (optionnel)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {[{ key: "fortyYard", label: "40 verges", placeholder: "4.72s" }, { key: "verticalJump", label: "Saut vertical", placeholder: '32"' }, { key: "broadJump", label: "Saut en longueur", placeholder: '9\'2"' }, { key: "benchPress", label: "Développé couché", placeholder: "225 × 8" }, { key: "shuttleAgility", label: "Navette agilité", placeholder: "4.31s" }, { key: "sprint100m", label: "Sprint 100m", placeholder: "10.9s" }].map((f) => (
                <div key={f.key}><label className={labelCls}>{f.label}</label><input type="text" value={d[f.key as keyof typeof d]} onChange={(e) => updatePhysical(f.key, e.target.value)} placeholder={f.placeholder} className={inputCls} /></div>
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
    const isDetailed = d.sportsMode === "detailed";
    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Informations sportives</h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Sport, position et niveau de compétition</p>

        <FormModeToggle mode={d.sportsMode} onChange={(m) => updateSports("sportsMode", m)} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div><label className={labelCls}>Sport principal{req}</label><NxSelect value={d.primarySport} onChange={(v) => { updateSports("primarySport", v); if (v !== "Autre") updateSports("primarySportDetail", ""); }} hasError={isFieldEmpty(d.primarySport)} options={SPORTS.map((s) => ({ value: s, label: s }))} />{d.primarySport === "Autre" && <input type="text" value={d.primarySportDetail} onChange={(e) => updateSports("primarySportDetail", e.target.value)} placeholder="Précisez le sport…" className={`${inputCls} mt-2`} />}</div>
          <SportPositionSelect sport={d.primarySport === "Autre" && d.primarySportDetail ? "Autre" : d.primarySport} value={d.primaryPosition} onChange={(v) => updateSports("primaryPosition", v)} label="Position principale" required hasError={isFieldEmpty(d.primaryPosition)} />
          <div><label className={labelCls}>Numéro de chandail{req}</label><input type="text" inputMode="numeric" value={d.jerseyNumber} onChange={(e) => updateSports("jerseyNumber", e.target.value.replace(/\D/g, ""))} placeholder="#" className={`${inputCls} ${isFieldEmpty(d.jerseyNumber) ? errBorder : ""}`} /></div>
          <SportPositionSelect sport={d.primarySport === "Autre" && d.primarySportDetail ? "Autre" : d.primarySport} value={d.secondaryPosition} onChange={(v) => updateSports("secondaryPosition", v)} label="Position secondaire" />
        </div>

        {isDetailed && (
          <div className="border-t border-[#1e2128] mt-2 pt-5">
            <p className={sectionTitle}>Détails additionnels</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div><label className={labelCls}>Sport secondaire</label><NxSelect value={d.secondarySport} onChange={(v) => { const val = v === "Aucun" ? "" : v; updateSports("secondarySport", val); if (val !== "Autre") updateSports("secondarySportDetail", ""); if (!val) { updateSports("secondarySportPosition", ""); updateSports("secondaryTeamId", ""); updateSports("secondaryTeam", ""); updateSports("secondaryTeamLevel", ""); updateSports("secondaryTeamDivision", ""); updateSports("secondaryLeague", ""); } }} placeholder="Aucun" options={[{ value: "Aucun", label: "Aucun" }, ...SPORTS.map((s) => ({ value: s, label: s }))]} />{d.secondarySport === "Autre" && <input type="text" value={d.secondarySportDetail} onChange={(e) => updateSports("secondarySportDetail", e.target.value)} placeholder="Précisez le sport…" className={`${inputCls} mt-2`} />}</div>
              {d.secondarySport && d.secondarySport !== "" && (
                <SportPositionSelect sport={d.secondarySport === "Autre" && d.secondarySportDetail ? "Autre" : d.secondarySport} value={d.secondarySportPosition} onChange={(v) => updateSports("secondarySportPosition", v)} label={`Position — ${d.secondarySport === "Autre" && d.secondarySportDetail ? d.secondarySportDetail : d.secondarySport}`} />
              )}

              <div className="sm:col-span-2">
                <label className={labelCls}>Équipe{req}{d.selectedTeamId && (() => { const t = coachTeam.teams.find((t) => t.id === d.selectedTeamId); return t ? <span className="ml-1.5 text-[#E63946] normal-case tracking-normal">({t.gender === "M" ? "Masculin" : "Féminin"})</span> : null; })()}</label>
                <NxSelect aria-label="Équipe" value={d.selectedTeamId} onChange={(v) => { const team = coachTeam.teams.find((t) => t.id === v); updateSports("selectedTeamId", v); updateSports("currentTeam", team?.name || ""); updateSports("teamLevel", team?.level || ""); updateSports("teamDivision", team?.division || ""); updateSports("league", team?.league || ""); }} placeholder="Sélectionner une équipe" options={coachTeam.teams.map((t) => ({ value: t.id, label: `${t.name}${t.level ? ` — ${t.level}` : ""}` }))} />
              </div>

              {d.selectedTeamId && (<>
                <div><label className={labelCls}>Niveau</label><div className="relative"><input type="text" readOnly value={d.teamLevel} aria-label="Niveau" className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} /><svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div></div>
                <div><label className={labelCls}>Division</label><div className="relative"><input type="text" readOnly value={d.teamDivision} aria-label="Division" className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} /><svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div></div>
              </>)}
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${d.openToCoaching ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a] group-hover:border-[#6b7280]"}`}>{d.openToCoaching && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}</span>
                  <input type="checkbox" checked={d.openToCoaching} onChange={() => updateSports("openToCoaching", !d.openToCoaching)} className="sr-only" />
                  <span className="text-[14px] text-[#e0e0e0]">Ouvert à devenir entraîneur au CÉGEP</span>
                </label>
              </div>
            </div>
            {d.selectedTeamId && d.league && (
              <div className="border-t border-[#1e2128] pt-5"><label className={labelCls}>Ligue</label><div className="relative max-w-xs"><input type="text" readOnly value={d.league} aria-label="Ligue" className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} /><svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div></div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── Step 5: Évaluation (Badges + Coach Endorsement) ────────── */
  function renderStep5() {
    const sc = form.scouting;
    const isDetailed = sc.evalMode === "detailed";
    const sportName = form.sports.primarySport;
    const sportStats = getSportStats(sportName);
    const selectedMap = new Map(sc.badges.map((b) => [b.badge, b]));
    const totalDistinctions = sc.badges.length;
    const atMax = totalDistinctions >= MAX_BADGES;

    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Évaluation du coach</h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Leadership et recommandation de l&apos;entraîneur</p>

        <FormModeToggle mode={sc.evalMode} onChange={(m) => updateScouting("evalMode", m)} />

        {/* ── Detailed: 11 trait ratings ──────────── */}
        {isDetailed && (() => {
          const TRAIT_GROUPS = [
            { title: "Capacités athlétiques", traits: [
              { key: "vitesse_explosivite", label: "Vitesse / Explosivité" },
              { key: "force_puissance", label: "Force / Puissance" },
              { key: "endurance_cardio", label: "Endurance / Cardio" },
              { key: "agilite_coordination", label: "Agilité / Coordination" },
            ]},
            { title: "Intelligence sportive", traits: [
              { key: "vision_du_jeu", label: "Vision du jeu" },
              { key: "sens_tactique", label: "Sens tactique" },
            ]},
            { title: "Caractère", traits: [
              { key: "leadership", label: "Leadership" },
              { key: "discipline", label: "Discipline / Éthique de travail" },
              { key: "coachabilite", label: "Coachabilité" },
              { key: "intelligence_jeu", label: "Intelligence de jeu" },
              { key: "competitivite", label: "Compétitivité" },
              { key: "esprit_equipe", label: "Esprit d'équipe" },
              { key: "resilience", label: "Résilience" },
              { key: "attitude_mentalite", label: "Attitude / Mentalité" },
            ]},
          ];
          const allRated = Object.values(sc.traitRatings).filter((v) => v > 0);
          const autoAvg = allRated.length > 0 ? allRated.reduce((a, b) => a + b, 0) / allRated.length : 0;
          return (
            <div className="mb-8 space-y-4">
              {/* Auto-calculated cote globale */}
              <div className="bg-[#13151a] border border-[#2a2d36] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">Cote globale (moyenne auto)</p>
                  <p className="text-[28px] font-head font-black text-[#F59E0B] leading-none mt-1">{autoAvg > 0 ? autoAvg.toFixed(1) : "—"}<span className="text-[14px] text-[#6b7280] font-normal ml-1">/ 5</span></p>
                </div>
                <div className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => (
                  <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill={autoAvg >= i + 1 ? "#F59E0B" : autoAvg >= i + 0.5 ? "#F59E0B" : "#374151"} stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}</div>
              </div>
              {TRAIT_GROUPS.map((group) => (
                <div key={group.title} className="bg-[#13151a] border border-[#2a2d36] rounded-xl p-5">
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">{group.title}</p>
                  <div className="space-y-1">
                    {group.traits.map((trait) => {
                      const val = sc.traitRatings[trait.key] || 0;
                      return (
                        <div key={trait.key} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                          <span className="text-[13px] text-[#c8c8cc]">{trait.label}</span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }, (_, i) => (
                              <button key={i} type="button" title={`${i + 1} étoile${i > 0 ? "s" : ""}`} className="w-6 h-6 cursor-pointer hover:scale-110 transition-transform"
                                onClick={() => updateScouting("traitRatings", { ...sc.traitRatings, [trait.key]: val === i + 1 ? 0 : i + 1 })}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill={val >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              </button>
                            ))}
                            <span className="text-[12px] font-bold text-[#6b7280] w-8 text-right">{val > 0 ? `${val}/5` : "—"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Star Rating (simplified — always visible) ──────────── */}
        {!isDetailed && (
        <div className="mb-8">
          <p className={sectionTitle}>Cote de l&apos;entraîneur</p>
          <p className="text-[12px] text-[#6b7280] mb-4 -mt-3">
            Évalue le potentiel global de cet athlète. Clique pour attribuer une note, clique à gauche d&apos;une étoile pour un demi-point.
          </p>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }, (_, i) => {
              const starIndex = i + 1;
              const filled = sc.starRating >= starIndex;
              const half = !filled && sc.starRating >= starIndex - 0.5;
              return (
                <button key={i} type="button" className="relative w-8 h-8 cursor-pointer group"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const isLeftHalf = x < rect.width / 2;
                    const value = isLeftHalf ? starIndex - 0.5 : starIndex;
                    updateScouting("starRating", sc.starRating === value ? 0 : value);
                  }}>
                  <svg className="absolute inset-0 w-8 h-8" viewBox="0 0 24 24" fill="#2D3748" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {filled && (
                    <svg className="absolute inset-0 w-8 h-8" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  )}
                  {half && (
                    <svg className="absolute inset-0 w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="none">
                      <defs>
                        <clipPath id={`half-m-${i}`}>
                          <rect x="0" y="0" width="12" height="24" />
                        </clipPath>
                      </defs>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F59E0B" clipPath={`url(#half-m-${i})`} />
                    </svg>
                  )}
                </button>
              );
            })}
            <span className="ml-3 text-[15px] font-bold text-white">
              {sc.starRating > 0 ? `${sc.starRating} / 5` : "—"}
            </span>
          </div>
        </div>
        )}

        {/* ── Distinctions (Sport-specific badges + custom) ──── */}
        <div className="mb-8">
          <p className={sectionTitle}>Distinctions</p>
          <p className="text-[12px] text-[#6b7280] mb-1 -mt-3">
            Sélectionne les reconnaissances qui s&apos;appliquent à cet athlète cette saison.
          </p>
          <p className="text-[11px] text-[#4a4d56] mb-4 italic">
            Maximum de 5 distinctions affichées sur le profil
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BADGE_ORDER.map((key) => {
              const cfg = BADGE_CONFIG[key];
              const entry = selectedMap.get(key);
              const isSelected = !!entry;
              const isDisabled = !isSelected && atMax;
              return (
                <div key={key}
                  className={`border rounded-lg transition-all ${isSelected ? "border-[#E63946]/40 bg-[#E63946]/[0.06]" : "border-[#2a2d36]"} ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}>
                  <button type="button"
                    onClick={() => !isDisabled && toggleBadge(key)}
                    disabled={isDisabled}
                    className="w-full flex flex-col items-center gap-2 px-3 py-4 text-center">
                    <DistinctionBadge badge={key} detail={entry?.detail} size="sm" />
                    <span className={`text-[12px] font-bold ${isSelected ? "text-white" : "text-[#8a8d96]"}`}>
                      {key === "custom" ? "Personnalisée" : cfg.label}
                    </span>
                  </button>

                  {isSelected && cfg.hasDetail && (
                    <div className="px-3 pb-3 space-y-2">
                      {(key === "team_leader" || key === "league_leader") && sportStats.length > 0 && (
                        <select
                          aria-label="Statistique"
                          value={sportStats.includes(entry?.detail || "") ? entry?.detail || "" : ""}
                          onChange={(e) => updateBadgeDetail(key, e.target.value)}
                          className={`${inputCls} text-[13px]`}
                        >
                          <option value="">— Choisir une stat —</option>
                          {sportStats.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      <input type="text"
                        value={entry?.detail || ""}
                        onChange={(e) => updateBadgeDetail(key, e.target.value.slice(0, MAX_DETAIL_LENGTH))}
                        maxLength={MAX_DETAIL_LENGTH}
                        placeholder={key === "custom" ? "Titre de la distinction" : "Précise (ex: Points)"}
                        className={`${inputCls} text-[13px]`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[12px] text-[#4a4d56] mt-3">
            {totalDistinctions} / {MAX_BADGES} sélectionnée{totalDistinctions !== 1 ? "s" : ""}
          </p>
        </div>

        {/* ── Rapport de l'entraîneur ──────────────── */}
        <div className="mb-8 border-t border-[#1e2128] pt-6">
          <p className={sectionTitle}>Rapport de l&apos;entraîneur</p>
          <p className="text-[12px] text-[#6b7280] mb-3 -mt-3">Décris cet athlète aux recruteurs. Parle de son caractère, ses forces et ses performances marquantes.</p>
          <textarea
            value={sc.coachEndorsement}
            onChange={(e) => updateScouting("coachEndorsement", e.target.value)}
            maxLength={1000}
            rows={8}
            placeholder="Ex: Joueur le plus discipliné de mon roster. Meneur de l'équipe en plaqués avec 67 cette saison. Leadership exceptionnel, capitaine depuis 2 ans..."
            className={`${inputCls} resize-y min-h-[200px]`}
          />
          <p className="text-[12px] text-[#4a4d56] text-right mt-1 tabular-nums">{sc.coachEndorsement.length} / 1000</p>
          {!sc.coachEndorsement && (
            <div className="mt-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg p-3">
              <p className="text-[12px] text-[#F59E0B] font-bold">Le rapport de l&apos;entraîneur est la section la plus consultée par les recruteurs. C&apos;est ta recommandation personnelle.</p>
            </div>
          )}
        </div>

      </div>
    );
  }

  /* ── Step 6: Médias ───────────────────────────────────────── */
  function renderStep6() {
    const d = form.media;
    const isDetailed = d.mediaMode === "detailed";
    const detailedFields = [
      { key: "hudlLink", label: "Lien Hudl", placeholder: "https://www.hudl.com/..." },
      { key: "youtubeLink", label: "Lien YouTube", placeholder: "https://youtube.com/..." },
      { key: "instagramLink", label: "Lien Instagram", placeholder: "https://instagram.com/..." },
      { key: "fullGameVideo", label: "Vidéo de match complet", placeholder: "https://..." },
      { key: "trainingVideo", label: "Vidéo d'entraînement", placeholder: "https://..." },
    ];
    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Vidéo &amp; Médias</h2>
        <p className="text-[14px] text-[#6b7280] mb-6">Liens vers les vidéos et profils en ligne</p>

        <FormModeToggle mode={d.mediaMode} onChange={(m) => updateMedia("mediaMode", m)} />

        <div className="space-y-6">
          <div>
            <label className={labelCls}>Vidéo de faits saillants</label>
            <input type="url" value={d.highlightVideo} onChange={(e) => updateMedia("highlightVideo", e.target.value)} placeholder="https://..." className={inputCls} />
            {!d.highlightVideo && (
              <div className="mt-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg p-3">
                <p className="text-[12px] text-[#F59E0B] font-bold">Les profils avec vidéo reçoivent 3x plus d&apos;engagement de la part des recruteurs.</p>
              </div>
            )}
          </div>
        </div>

        {isDetailed && (
          <div className="border-t border-[#1e2128] mt-6 pt-5">
            <p className={sectionTitle}>Liens additionnels</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {detailedFields.map((f) => (<div key={f.key}><label className={labelCls}>{f.label}</label><input type="url" value={d[f.key as keyof typeof d]} onChange={(e) => updateMedia(f.key, e.target.value)} placeholder={f.placeholder} className={inputCls} /></div>))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Step 7: Révision ─────────────────────────────────────── */
  function renderStep7() {
    const { identity, academic, physical, sports, scouting, media, submission } = form;

    const summaryCard = (title: string, step: number, content: React.ReactNode) => (
      <div className="bg-[#13151a] border border-[#2a2d36] rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-bold tracking-[1.5px] uppercase text-[#8a8d96]">{title}</h3>
          <button type="button" onClick={() => goToStep(step)} className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#E63946] hover:text-[#D42B22] transition-colors">Modifier</button>
        </div>
        {content}
      </div>
    );

    const infoRow = (label: string, value: string | number | undefined) => {
      if (!value) return null;
      return (<div className="flex justify-between py-1.5 border-b border-[#1e2128] last:border-0"><span className="text-[12px] text-[#6b7280]">{label}</span><span className="text-[12px] text-[#e0e0e0] font-medium text-right">{value}</span></div>);
    };

    const heightStr = physical.heightFeet && physical.heightInches ? `${physical.heightFeet}'${physical.heightInches}"` : physical.heightFeet ? `${physical.heightFeet}'` : "";

    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Révision &amp; Enregistrement</h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Vérifiez les informations avant d&apos;enregistrer</p>

        {summaryCard("Étudiant-athlète", 1, (<div>{infoRow("Nom", `${identity.firstName} ${identity.lastName}`)}{infoRow("Genre", identity.gender === "M" ? "Masculin" : identity.gender === "F" ? "Féminin" : "")}{infoRow("Date de naissance", identity.dateOfBirth)}{infoRow("Promotion", identity.gradYear)}{infoRow("École", identity.school)}</div>))}

        {summaryCard("Académique", 2, (<div>{infoRow("Moyenne", academic.gpa ? `${academic.gpa}%` : "")}{infoRow("Programme visé", academic.cegepType === "dec_general" ? "DEC général" : academic.cegepType === "technique" ? `Technique${academic.cegepProgramDetail ? ` — ${academic.cegepProgramDetail}` : ""}` : "")}{academic.openToPrivate && infoRow("CÉGEP privé", "Oui")}{academic.openToRelocate && infoRow("Prêt à changer de région", "Oui")}</div>))}

        {summaryCard("Physique", 3, (<div>{infoRow("Taille", heightStr)}{infoRow("Poids", physical.weightLbs ? `${physical.weightLbs} lbs` : "")}{infoRow("Main dominante", physical.dominantHand)}{infoRow("40 verges", physical.fortyYard)}</div>))}

        {summaryCard("Sport", 4, (<div>{infoRow("Sport principal", sports.primarySport)}{infoRow("Position", `${sports.primaryPosition}${sports.secondaryPosition ? ` / ${sports.secondaryPosition}` : ""}`)}{infoRow("Équipe", sports.currentTeam)}{infoRow("Niveau", sports.teamLevel)}</div>))}

        {summaryCard("Évaluation", 5, (<div>
          {infoRow("Distinctions", scouting.badges.length > 0 ? scouting.badges.map((b) => {
            const cfg = BADGE_CONFIG[b.badge];
            const label = b.badge === "custom" ? (b.detail || "Distinction") : cfg?.label || b.badge;
            return b.badge !== "custom" && b.detail ? `${label} — ${b.detail}` : label;
          }).join(", ") : "")}
          {scouting.coachEndorsement && (<div className="mt-2 p-3 bg-[#1A1D24] rounded-lg"><p className="text-[12px] text-[#6b7280] mb-1 font-bold uppercase tracking-wider">Rapport</p><p className="text-[12px] text-[#e0e0e0] italic leading-relaxed">&ldquo;{scouting.coachEndorsement.slice(0, 150)}{scouting.coachEndorsement.length > 150 ? "…" : ""}&rdquo;</p></div>)}
        </div>))}

        {summaryCard("Médias", 6, (<div>{infoRow("Hudl", media.hudlLink)}{infoRow("YouTube", media.youtubeLink)}{infoRow("Instagram", media.instagramLink)}</div>))}

        <div className="border-t border-[#1e2128] mt-6 pt-5">
          <div className="bg-[#1A1D24] border border-[#2A2D35] rounded-lg p-4">
            <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-semibold mb-3">Statut de recrutement</p>
            <RecruitmentStatusBadge
              status={recruitmentStatus as GlobalRecruitmentStatus}
              size="md"
            />
            {recruitmentStatus === "RECRUTE" && (
              <>
                <p className="text-[14px] text-[#d1d5db] mt-2">
                  Engagé à: {schoolsList.find(s => s.id === committedSchoolId)?.name || "Non spécifié"}
                </p>
                <p className="text-[12px] text-[#6b7280] mt-1">
                  Ouvert aux offres: {openToOffers === true ? "Oui" : openToOffers === false ? "Non" : "Non spécifié"}
                </p>
              </>
            )}
            {recruitmentStatus === "RETIRE" && (
              <p className="text-[14px] text-[#6b7280] mt-2">Athlète retiré du recrutement</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     SAVED STATE
  ══════════════════════════════════════════════════════════════ */

  if (saved) {
    return (
      <div className="px-4 sm:px-6 py-16 max-w-xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#22C55E]/15 mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight mb-2">Profil enregistré</h1>
        <p className="text-[14px] text-[#8a8d96] mb-8 leading-relaxed">Le profil de <strong className="text-white">{form.identity.firstName} {form.identity.lastName}</strong> a été mis à jour avec succès.</p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/coach/athletes" className="bg-[#1A1D24] border border-[#2a2d36] text-[#e0e0e0] rounded-lg px-6 py-3 font-head font-bold text-[12px] uppercase tracking-widest transition-colors hover:border-[#8a8d96]">Retour au roster</Link>
          <Link href={`/coach/athletes/${id}`} className="bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-bold text-[12px] uppercase tracking-widest rounded-lg px-6 py-3 transition-colors">Voir le profil</Link>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════════════════════════ */

  const stepRenderers: Record<number, () => React.ReactNode> = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4, 5: renderStep5, 6: renderStep6, 7: renderStep7 };

  if (loading) return <div className="px-6 sm:px-10 py-20 text-center text-[#6B7280] text-sm">Chargement du profil...</div>;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-[14px] text-[#6b7280] mb-8">
        <span className="font-bold text-[#8a8d96]">Nexus</span><span>/</span><Link href="/coach/athletes" className="hover:text-white transition-colors">Mes Athlètes</Link><span>/</span><span className="text-white">Modifier le profil</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">Modifier — {form.identity.firstName} {form.identity.lastName}</h1>
          <p className="text-[15px] text-[#6b7280] mt-2">Mettez à jour les informations de cet athlète</p>
        </div>
        <Link href={`/coach/athletes/${id}`} className="flex items-center gap-2 text-[14px] font-bold text-[#9CA3AF] hover:text-white transition-colors self-start">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          Voir l&apos;aperçu recruteur
        </Link>
      </div>

      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-[14px] mb-8 px-6">
        <StepIndicator steps={STEPS} currentStep={currentStep} completedSteps={completedSteps} onStepClick={goToStep} />
      </div>

      <div className="transition-opacity duration-200">{stepRenderers[currentStep]?.()}</div>

      {showErrors && !validateStep(currentStep) && (
        <div className="mt-4 flex items-center gap-3 bg-[#E63946]/[0.08] border border-[#E63946]/25 rounded-lg px-5 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
          <p className="text-[14px] text-[#E63946] font-medium">Veuillez remplir tous les champs obligatoires (<span className="font-bold">*</span>) avant de continuer.</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-8 gap-4">
        <button type="button" onClick={goPrev} disabled={currentStep === 1}
          className={`flex items-center gap-2.5 bg-[#1A1D24] border border-[#2a2d36] text-[#e0e0e0] rounded-lg px-6 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest transition-all duration-150 ${currentStep === 1 ? "opacity-40 cursor-not-allowed" : "hover:border-[#8a8d96] hover:bg-[#22252c] hover:-translate-x-0.5 active:scale-95 cursor-pointer"}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
          Précédent
        </button>
        <div className="flex items-center gap-3">
          {currentStep < 7 ? (
            <>
              <button type="button" onClick={handleQuickSave} disabled={saving}
                className="flex items-center gap-2 border border-[#E63946] text-[#E63946] bg-transparent rounded-lg px-5 py-3.5 font-head font-bold text-[13px] uppercase tracking-widest transition-all duration-150 hover:bg-[#E63946]/10 active:scale-95 cursor-pointer disabled:opacity-50">
                {saving ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></svg>
                )}
                Enregistrer
              </button>
              <button type="button" onClick={goNext}
                className="flex items-center gap-2.5 bg-[#E63946] text-white rounded-lg px-6 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest transition-all duration-150 hover:bg-[#D42B22] hover:translate-x-0.5 hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95 cursor-pointer">
                Suivant <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
              </button>
            </>
          ) : (
            <button type="button" onClick={handleSave}
              className="flex items-center gap-2.5 bg-[#E63946] text-white rounded-lg px-6 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest transition-all duration-150 hover:bg-[#D42B22] hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95 cursor-pointer">
              Enregistrer les modifications <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
