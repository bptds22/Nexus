"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import StepIndicator from "../../components/StepIndicator";
import TagInput from "../../components/TagInput";
import DatePicker from "../../components/DatePicker";
import SportPositionSelect from "../../components/SportPositionSelect";
import NxSelect from "../../components/NxSelect";
import { BADGE_CONFIG, BADGE_ORDER, MAX_BADGES, MAX_DETAIL_LENGTH, getSportStats, type DistinctionEntry } from "@/lib/config/badges";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import FormModeToggle from "../../components/FormModeToggle";
import NxIcon from "@/components/ui/NxIcon";
import { createClient } from "@/lib/supabase/client";
import PartnerVisibilityConsentCard from "@/components/shared/PartnerVisibilityConsentCard";
import { lookupAthleteByEmail, type AthleteEmailLookupResult } from "@/lib/coach/athleteEmailLookup";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Coach / Créer un profil athlète
   7-step form wizard. Scouting report model (sport-agnostic).
───────────────────────────────────────────────────────────────── */

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

const REGIONS = [
  "Montréal", "Québec", "Laurentides", "Lanaudière", "Montérégie",
  "Outaouais", "Estrie", "Mauricie", "Saguenay", "Bas-Saint-Laurent",
  "Abitibi", "Côte-Nord", "Gaspésie",
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

const CHARACTER_TRAITS: { key: string; label: string; iconName: string }[] = [
  { key: "leadership", label: "Leadership", iconName: "leadership" },
  { key: "discipline", label: "Discipline / Éthique de travail", iconName: "discipline" },
  { key: "coachability", label: "Coachabilité", iconName: "coachability" },
  { key: "game_iq", label: "Intelligence de jeu", iconName: "gameIQ" },
  { key: "competitiveness", label: "Compétitivité", iconName: "competitiveness" },
  { key: "teamwork", label: "Esprit d'équipe", iconName: "teamwork" },
  { key: "resilience", label: "Résilience / Gestion de la pression", iconName: "resilience" },
  { key: "attitude", label: "Attitude / Mentalité", iconName: "attitude" },
];

/* ══════════════════════════════════════════════════════════════
   INITIAL STATE
══════════════════════════════════════════════════════════════ */

const INITIAL_FORM: AthleteFormData = {
  identity: {
    identityMode: "simple",
    photo: "",
    firstName: "", lastName: "", gender: "", dateOfBirth: "", gradYear: "",
    school: "", city: "", region: "",
    phone: "", email: "",
    parentName: "", parentPhone: "",
  },
  academic: {
    academicMode: "simple", gpa: "", strongSubjects: [], academicHonors: [],
    cegepType: "", cegepProgramDetail: "", openToPrivate: false, openToAnglophone: false, openToRelocate: false, cegepRegions: [],
  },
  physical: {
    physicalMode: "simple", heightFeet: "", heightInches: "", weightLbs: "",
    wingspan: "", handSize: "", dominantHand: "", dominantFoot: "",
    fortyYard: "", verticalJump: "", broadJump: "",
    benchPress: "", shuttleAgility: "", sprint100m: "",
  },
  sports: {
    sportsMode: "simple",
    primarySport: "", primarySportDetail: "", secondarySport: "", secondarySportDetail: "", primaryPosition: "",
    secondaryPosition: "", secondarySportPosition: "", selectedTeamId: "", currentTeam: "", teamLevel: "", teamDivision: "",
    jerseyNumber: "", league: "",
    secondaryTeamId: "", secondaryTeam: "", secondaryTeamLevel: "", secondaryTeamDivision: "", secondaryLeague: "",
    recruitingLevel: "", openToCoaching: false,
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

/* ══════════════════════════════════════════════════════════════
   STYLE CONSTANTS
══════════════════════════════════════════════════════════════ */

const cardCls = "bg-[#1A1D24] rounded-[14px] border border-[#1e2128] p-8";
const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[15px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "block text-[14px] font-bold tracking-[1.2px] uppercase text-[#6b7280] mb-2";
const sectionTitle = "text-[14px] font-bold tracking-[1.5px] uppercase text-[#6b7280] mb-5";
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

  // 6.2.c-1 : email lookup state pour détection en temps réel d'un
  // athlete existant. Debounce 500ms + rate limit 10/60s gérés dans
  // le helper lib/coach/athleteEmailLookup. Le modal de branching
  // "Inviter ou créer profil" viendra en 6.2.c-2.
  const [emailLookup, setEmailLookup] = useState<AthleteEmailLookupResult | null>(null);
  const emailLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEmailChange = useCallback((newEmail: string) => {
    // 6.2.c-1-debug-2 DIAGNOSTIC LOGS (all to be removed once BP
    // identifies the blocking step — see commit body).
    console.log("[EmailLookup] handleEmailChange triggered:", newEmail);

    setForm((prev) => ({
      ...prev,
      identity: { ...prev.identity, email: newEmail },
    }));
    console.log("[EmailLookup] STEP 1 — form state updated, email length:", newEmail.length);

    if (emailLookupTimerRef.current) {
      clearTimeout(emailLookupTimerRef.current);
      console.log("[EmailLookup] STEP 2 — previous timer cleared");
    } else {
      console.log("[EmailLookup] STEP 2 — no previous timer");
    }

    if (!newEmail.trim() || newEmail.trim().length < 5) {
      console.log("[EmailLookup] STEP 3 — EARLY RETURN (email too short or empty)");
      setEmailLookup(null);
      return;
    }
    console.log("[EmailLookup] STEP 3 — passed length check, scheduling debounce");

    emailLookupTimerRef.current = setTimeout(async () => {
      console.log("[EmailLookup] STEP 4 — debounce fired, calling lookupAthleteByEmail");
      try {
        const supabase = createClient();
        const result = await lookupAthleteByEmail(supabase, newEmail);
        console.log("[EmailLookup] STEP 4 — lookup returned:", result);
        setEmailLookup(result);
        console.log("[EmailLookup] STEP 4 — setEmailLookup called");
      } catch (err) {
        console.error("[EmailLookup] STEP 4 — lookup ERROR:", err);
      }
    }, 500);
    console.log("[EmailLookup] STEP 4 — debounce scheduled (500ms)");
  }, []);

  useEffect(() => {
    return () => {
      if (emailLookupTimerRef.current) {
        clearTimeout(emailLookupTimerRef.current);
      }
    };
  }, []);

  // League context state
  const [userContext, setUserContext] = useState<string | null>(null);
  const [leagueTeamId, setLeagueTeamId] = useState<string | null>(null);
  const [leagueTeamName, setLeagueTeamName] = useState("");
  const [coachTeam, setCoachTeam] = useState<CoachTeamData>({ school: "", city: "", region: "", teams: [] });

  // Detect league context on mount
  useEffect(() => {
    async function detectContext() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: userProfile } = await supabase
        .from("users")
        .select("context, school_id, schools!school_id(name, city, region)")
        .eq("id", authUser.id)
        .single();

      console.log("[CreateAthlete] User context:", userProfile?.context);

      // Load coach's school + teams
      if (userProfile?.school_id) {
        const schoolRel = (userProfile as any).schools;
        const school = Array.isArray(schoolRel) ? schoolRel[0] : schoolRel;
        const schoolName = school?.name || "";
        const cityName = school?.city || "";
        const regionName = school?.region || "";

        const { data: teams } = await supabase
          .from("teams")
          .select("id, name, division, league, age_group, season, sport_id, sports!sport_id(nom)")
          .eq("school_id", userProfile.school_id)
          .eq("is_active", true);

        console.log("[CreateAthlete] Loaded teams:", teams?.length);

        setCoachTeam({
          school: schoolName,
          city: cityName,
          region: regionName,
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

        // Set school info on the form
        setForm((prev) => ({
          ...prev,
          identity: { ...prev.identity, school: schoolName, city: cityName, region: regionName },
        }));
      }

      if (userProfile?.context === "ligue_civile") {
        setUserContext("ligue_civile");

        const { data: teams } = await supabase
          .from("league_teams")
          .select("id, name, league_id, leagues(name, city, region)")
          .eq("owner_id", authUser.id);

        console.log("[CreateAthlete] League teams for user:", teams);

        if (teams && teams.length > 0) {
          setLeagueTeamId(teams[0].id);
          setLeagueTeamName(teams[0].name || "");
        }
      }
    }
    detectContext();
  }, []);

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
        // Simplified: prénom, nom, DOB, promotion
        const base = !!(d.firstName && d.lastName && d.dateOfBirth && d.gradYear);
        if (d.identityMode === "detailed") return base && !!(d.gender && d.school && d.city && d.region);
        return base;
      }
      case 2: return true;
      case 3: return true;
      case 4: {
        const s = form.sports;
        // Sport, position, jersey, and team are required in both modes
        return !!(s.primarySport && s.jerseyNumber && (s.selectedTeamId || s.currentTeam));
      }
      case 5: return true;
      case 6: return true;
      case 7: return form.parentalConsent;
      default: return true;
    }
  }

  function isFieldEmpty(value: string): boolean {
    return showErrors && !value;
  }

  /* ── Navigation ────────────────────────────────────────────── */

  function goNext() {
    if (!validateStep(currentStep)) { setShowErrors(true); return; }
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setShowErrors(false);
    if (currentStep < 7) {
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

  async function handleSubmit() {
    if (!validateStep(7)) { setShowErrors(true); return; }

    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      alert("Session expirée. Veuillez vous reconnecter.");
      return;
    }

    // Get coach's school_id
    const { data: coachProfile } = await supabase
      .from("users")
      .select("id, school_id")
      .eq("id", authUser.id)
      .single();

    // Get sport_id from sports table
    const { data: sportData } = await supabase
      .from("sports")
      .select("id")
      .eq("nom", form.sports.primarySport)
      .single();

    // Get position_id from positions table
    const { data: positionData } = await supabase
      .from("positions")
      .select("id")
      .eq("abreviation", form.sports.primaryPosition)
      .eq("sport_id", sportData?.id)
      .maybeSingle();

    // Get secondary position_id (same sport, different position)
    let secondaryPositionId = null;
    if (form.sports.secondaryPosition && sportData?.id) {
      const { data: secPosData } = await supabase
        .from("positions")
        .select("id")
        .eq("abreviation", form.sports.secondaryPosition)
        .eq("sport_id", sportData.id)
        .maybeSingle();
      secondaryPositionId = secPosData?.id || null;
    }

    // Secondary sport lookup
    let sportSecondaireId = null;
    if (form.sports.secondarySport && form.sports.secondarySport !== "Aucun") {
      const { data: secSportRow } = await supabase.from("sports").select("id").eq("nom", form.sports.secondarySport).maybeSingle();
      sportSecondaireId = secSportRow?.id || null;
      console.log("Secondary sport lookup:", form.sports.secondarySport, "→", sportSecondaireId);
    }

    // Build athlete record
    const athleteRecord = {
      coach_id: authUser.id,
      school_id: leagueTeamId ? null : (coachProfile?.school_id || null),
      league_team_id: leagueTeamId || null,

      // Identity
      first_name: form.identity.firstName,
      last_name: form.identity.lastName,
      date_naissance: form.identity.dateOfBirth || null,
      genre: form.identity.gender || null,
      photo_url: form.identity.photo || null,
      email: form.identity.email || null,
      telephone: form.identity.phone || null,
      nom_parent: form.identity.parentName || null,
      telephone_parent: form.identity.parentPhone || null,
      annee_diplomation: form.identity.gradYear ? parseInt(form.identity.gradYear) : null,
      consentement_parental: form.parentalConsent,
      consentement_parental_date: form.parentalConsent ? new Date().toISOString() : null,
      ...(form.parentalConsent && form.partnerVisibilityConsent ? {
        partner_visibility_parental_consent: true,
        partner_visibility_opt_in: true,
        partner_visibility_opted_in_at: new Date().toISOString(),
      } : {}),

      // Academic
      moyenne_generale: (() => {
        const val = form.academic.gpa ? parseFloat(form.academic.gpa) : null;
        if (val !== null && (val < 0 || val > 100)) return null;
        return val;
      })(),
      matieres_fortes: form.academic.strongSubjects || [],
      mentions_academiques: form.academic.academicHonors || [],
      programme_cegep_vise: (() => {
        const type = form.academic.cegepType;
        if (type === "dec_general") return ["DEC général"];
        if (type === "technique" && form.academic.cegepProgramDetail) return ["Technique — " + form.academic.cegepProgramDetail];
        if (type === "technique") return ["Programme technique"];
        return [];
      })(),
      ouvert_cegep_prive: form.academic.openToPrivate,
      ouvert_cegep_anglophone: form.academic.openToAnglophone,
      pret_changer_region: form.academic.openToRelocate,
      regions_cegep_preferees: form.academic.cegepRegions || [],

      // Physical
      taille_pieds: form.physical.heightFeet ? parseInt(form.physical.heightFeet) : null,
      taille_pouces: form.physical.heightInches ? parseInt(form.physical.heightInches) : null,
      poids_lbs: form.physical.weightLbs ? parseFloat(form.physical.weightLbs) : null,
      main_dominante: form.physical.dominantHand || null,
      pied_dominant: form.physical.dominantFoot || null,
      envergure: form.physical.wingspan || null,
      taille_mains: form.physical.handSize || null,
      test_40_verges: form.physical.fortyYard || null,
      saut_vertical: form.physical.verticalJump || null,
      saut_longueur: form.physical.broadJump || null,
      sprint_100m: form.physical.sprint100m || null,
      developpe_couche: form.physical.benchPress || null,
      navette_agilite: form.physical.shuttleAgility || null,

      // Sports
      sport_id: sportData?.id || null,
      position_id: positionData?.id || null,
      sport_secondaire_id: sportSecondaireId,
      position_secondaire_id: secondaryPositionId,
      numero_jersey: form.sports.jerseyNumber || null,
      ouvert_entraineur_cegep: form.sports.openToCoaching,

      // Media
      video_faits_saillants_url: form.media.highlightVideo || null,
      hudl_url: form.media.hudlLink || null,
      youtube_url: form.media.youtubeLink || null,
      instagram_url: form.media.instagramLink || null,
      video_match_complet_url: form.media.fullGameVideo || null,
      video_entrainement_url: form.media.trainingVideo || null,

      // Evaluation
      cote_globale_entraineur: form.scouting.starRating || null,
      notes_coach: form.scouting.coachEndorsement || null,

      // Recruitment override
      statut_recrutement_override: form.submission.recruitingStatus || null,
      recrutement_override_at: form.submission.recruitingStatus ? new Date().toISOString() : null,

      // Status
      status: "ACTIF",
      verified: false,
      profile_completion: 0,
    };

    console.log("Academic honors being saved:", form.academic.academicHonors);

    const { data: newAthlete, error } = await supabase
      .from("athletes")
      .insert(athleteRecord)
      .select("id")
      .single();

    if (error) {
      console.error("Error creating athlete:", error);
      alert("Erreur lors de la création du profil: " + error.message);
      return;
    }

    // Always save evaluation record — both simple and detailed modes
    if (newAthlete?.id) {
      const ratings = form.scouting.traitRatings || {};
      const hasDetailedRatings = form.scouting.evalMode === "detailed" && Object.keys(ratings).length > 0;

      const evalRecord: Record<string, unknown> = {
        coach_id: authUser.id,
        athlete_id: newAthlete.id,
        cote_globale: form.scouting.starRating || null,
        distinctions: (form.scouting.badges || []).filter((b) => b && b.badge),
        rapport_entraineur: form.scouting.coachEndorsement || null,
      };

      if (hasDetailedRatings) {
        Object.assign(evalRecord, {
          // Capacités athlétiques
          vitesse_explosivite: ratings.vitesse_explosivite || null,
          force_puissance: ratings.force_puissance || null,
          endurance_cardio: ratings.endurance_cardio || null,
          agilite_coordination: ratings.agilite_coordination || null,
          // Intelligence sportive
          vision_du_jeu: ratings.vision_du_jeu || null,
          sens_tactique: ratings.sens_tactique || null,
          // Caractère
          leadership: ratings.leadership || null,
          discipline: ratings.discipline || null,
          coachabilite: ratings.coachabilite || null,
          intelligence_jeu: ratings.intelligence_jeu || null,
          competitivite: ratings.competitivite || null,
          esprit_equipe: ratings.esprit_equipe || null,
          resilience: ratings.resilience || null,
          attitude_mentalite: ratings.attitude_mentalite || null,
        });
      }

      const { error: evalError } = await supabase.from("evaluations").insert(evalRecord);
      if (evalError) {
        console.error("Evaluation insert error:", JSON.stringify(evalError));
      } else {
        console.log("Evaluation saved for athlete:", newAthlete.id);
      }

      // ── Insert team_athletes assignment if a team was selected ──
      const selectedTeamId = form.sports.selectedTeamId;
      console.log("[Create] Attempting team_athletes insert:", { team_id: selectedTeamId, athlete_id: newAthlete.id });
      if (selectedTeamId) {
        const { error: teamErr } = await supabase.from("team_athletes").insert({
          team_id: selectedTeamId,
          athlete_id: newAthlete.id,
          jersey_number: form.sports.jerseyNumber || null,
          joined_at: new Date().toISOString(),
        });
        if (teamErr) {
          console.error("[Create] team_athletes insert failed:", teamErr);
        } else {
          console.log("[Create] team_athletes insert SUCCESS:", { team_id: selectedTeamId, athlete_id: newAthlete.id });
        }
      } else {
        console.log("[Create] No team selected — skipping team_athletes insert");
      }
    }

    setCompletedSteps((prev) => new Set([...prev, 7]));
    setSubmitted(true);
  }

  function handleDraft() {
    setSubmitted(true);
  }

  /* ══════════════════════════════════════════════════════════════
     STEP RENDERERS
  ══════════════════════════════════════════════════════════════ */

  /* ── Step 1: Identité ─────────────────────────────────────── */
  function renderStep1() {
    const d = form.identity;
    const isDetailed = d.identityMode === "detailed";
    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">
          Identité de l&apos;étudiant-athlète
        </h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Informations personnelles de base</p>

        <FormModeToggle mode={d.identityMode} onChange={(m) => updateIdentity("identityMode", m)} />

        <div className="flex items-center gap-6 mb-8">
          <div className="relative group shrink-0">
            {d.photo ? (
              <img src={d.photo} alt="Photo" className="w-[100px] h-[100px] rounded-xl object-cover border-2 border-[#2a2d36]" />
            ) : (
              <div className="w-[100px] h-[100px] rounded-xl bg-[#13151a] border-2 border-dashed border-[#2a2d36] flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
              </svg>
              <input type="file" accept="image/*" className="hidden" title="Téléverser une photo"
                onChange={async (e) => {
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
            {d.photo && (
              <button type="button" onClick={() => updateIdentity("photo", "")} className="text-[12px] text-[#E63946] mt-1 hover:underline">Retirer la photo</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Prénom{req}</label>
            <input type="text" value={d.firstName} onChange={(e) => updateIdentity("firstName", e.target.value)}
              placeholder="Prénom" className={`${inputCls} ${isFieldEmpty(d.firstName) ? errBorder : ""}`} />
          </div>
          <div>
            <label className={labelCls}>Nom{req}</label>
            <input type="text" value={d.lastName} onChange={(e) => updateIdentity("lastName", e.target.value)}
              placeholder="Nom de famille" className={`${inputCls} ${isFieldEmpty(d.lastName) ? errBorder : ""}`} />
          </div>
          <div>
            <label className={labelCls}>Date de naissance{req}</label>
            <DatePicker value={d.dateOfBirth} onChange={(date) => updateIdentity("dateOfBirth", date)} placeholder="Sélectionner une date" hasError={isFieldEmpty(d.dateOfBirth)} />
          </div>
          <div>
            <label className={labelCls}>Promotion{req}</label>
            <NxSelect value={d.gradYear} onChange={(v) => updateIdentity("gradYear", v)} hasError={isFieldEmpty(d.gradYear)}
              options={[2025, 2026, 2027, 2028, 2029].map((y) => ({ value: String(y), label: String(y) }))} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Courriel de l&apos;athlète
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.15em] uppercase bg-[#2a2d36]/60 text-[#6b7280] rounded border border-[#2a2d36]">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                Non visible aux recruteurs
              </span>
            </label>
            <input type="email" value={d.email} onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="athlete@email.com" className={inputCls} />

            {/* 6.2.c-1 : banner inline si un athlete existant matche
                cet email. Le modal de branching au submit viendra en
                6.2.c-2 — pour le moment le coach voit l'info mais le
                submit reste comportement legacy (création profil). */}
            {emailLookup?.found && emailLookup.athlete && (
              <div className="mt-2 p-3 rounded-lg bg-[#1A1D24] border border-[#E63946]/30">
                <div className="flex items-start gap-3">
                  <div className="text-[#E63946] mt-0.5 shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-semibold text-white">
                      Compte existant détecté : {emailLookup.athlete.firstName} {emailLookup.athlete.lastName}
                    </div>
                    <div className="text-[#9CA3AF] mt-0.5 text-xs">
                      {emailLookup.athlete.sportName && `Sport : ${emailLookup.athlete.sportName}`}
                      {emailLookup.athlete.sportName && emailLookup.athlete.schoolName && " · "}
                      {emailLookup.athlete.schoolName}
                    </div>
                    <div className="text-[#6b7280] mt-1 text-xs italic">
                      Au submit, tu pourras choisir d&apos;envoyer une invitation à rejoindre ton équipe.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {emailLookup?.reason === "rate_limited" && (
              <div className="mt-2 p-2 text-xs text-[#F59E0B]">
                Trop de vérifications. Réessaie dans une minute.
              </div>
            )}

            <p className="text-[12px] text-[#4a4d56] mt-1.5">Si l&apos;athlète a déjà un compte Nexus, tu pourras l&apos;inviter à rejoindre ton équipe au submit. Jamais partagé aux recruteurs.</p>
          </div>
        </div>

        {isDetailed && (
          <div className="border-t border-[#1e2128] mt-6 pt-5">
            <p className={sectionTitle}>Détails additionnels</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className={labelCls}>Genre{req}</label>
                <NxSelect value={d.gender} onChange={(v) => updateIdentity("gender", v)} hasError={isDetailed && isFieldEmpty(d.gender)}
                  options={[{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }, { value: "X", label: "Non genré" }]} />
              </div>
              <div>
                <label className={labelCls}>École secondaire</label>
                <div className="relative">
                  <input type="text" value={d.school} readOnly aria-label="École secondaire" className={`${inputCls} !bg-[#0d0f13] opacity-70 cursor-not-allowed`} />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                </div>
              </div>
              <div>
                <label className={labelCls}>Ville</label>
                <div className="relative">
                  <input type="text" value={d.city} readOnly aria-label="Ville" className={`${inputCls} !bg-[#0d0f13] opacity-70 cursor-not-allowed`} />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                </div>
              </div>
              <div>
                <label className={labelCls}>Région</label>
                <div className="relative">
                  <input type="text" value={d.region} readOnly aria-label="Région" className={`${inputCls} !bg-[#0d0f13] opacity-70 cursor-not-allowed`} />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                </div>
              </div>
              <div>
                <label className={labelCls}>Téléphone</label>
                <input type="tel" value={form.identity.phone} onChange={(e) => updateIdentity("phone", e.target.value)} placeholder="(514) 000-0000" aria-label="Téléphone" className={inputCls} />
              </div>
            </div>

            <div className="border-t border-[#1e2128] mt-6 pt-5">
              <p className={sectionTitle}>Contact parent</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Nom du parent</label>
                  <input type="text" value={form.identity.parentName} onChange={(e) => updateIdentity("parentName", e.target.value)} placeholder="Nom complet" aria-label="Nom du parent" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Téléphone du parent</label>
                  <input type="tel" value={form.identity.parentPhone} onChange={(e) => updateIdentity("parentPhone", e.target.value)} placeholder="(514) 000-0000" aria-label="Téléphone du parent" className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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
            <div className="relative">
              <input type="number" min="0" max="100" step="0.1" value={d.gpa} onChange={(e) => updateAcademic("gpa", e.target.value)} placeholder="85" className={`${inputCls} pr-8`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-[14px]">%</span>
            </div>
          </div>

          {isDetailedAcad && (
            <div>
              <p className={labelCls}>Matières fortes</p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => {
                  const selected = d.strongSubjects.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => updateAcademic("strongSubjects", toggleArrayItem(d.strongSubjects, s))}
                      className={`px-3.5 py-2 rounded-md text-[14px] font-bold transition-all ${selected ? "bg-[#E63946]/18 text-[#E63946] border border-[#E63946]/30" : "bg-transparent border border-[#2a2d36] text-[#8a8d96] hover:border-[#6b7280]"}`}>{s}</button>
                  );
                })}
              </div>
            </div>
          )}

          {isDetailedAcad && (
            <div>
              <label className={labelCls}>Mentions académiques</label>
              <TagInput tags={d.academicHonors} onChange={(tags) => updateAcademic("academicHonors", tags)} placeholder="Tapez une mention + Entrée" />
            </div>
          )}

          <div>
            <p className={labelCls}>Programme CÉGEP visé</p>
            <div className="flex items-center gap-3 mt-1">
              {([
                { value: "dec_general" as const, label: "DEC général (préuniversitaire)" },
                { value: "technique" as const, label: "Programme technique" },
              ]).map((opt) => (
                <label key={opt.value} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${d.cegepType === opt.value ? "border-[#3b82f6] bg-[#3b82f6]/10 text-white" : "border-[#2a2d36] text-[#8a8d96] hover:border-[#6b7280]"}`}>
                  <input type="radio" name="cegepType" value={opt.value} checked={d.cegepType === opt.value} onChange={() => updateAcademic("cegepType", opt.value)} className="sr-only" />
                  <span className="text-[14px] font-bold">{opt.label}</span>
                </label>
              ))}
            </div>
            {d.cegepType === "technique" && (
              <input type="text" value={d.cegepProgramDetail} onChange={(e) => updateAcademic("cegepProgramDetail", e.target.value)}
                placeholder="Précisez le programme technique (ex: Techniques policières, Soins infirmiers…)" className={`${inputCls} mt-3`} />
            )}
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
                {CEGEP_REGIONS.map((r) => {
                  const checked = d.cegepRegions.includes(r);
                  return (
                    <label key={r} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={checked} onChange={() => updateAcademic("cegepRegions", toggleArrayItem(d.cegepRegions, r))} className="sr-only" />
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] group-hover:border-[#6b7280]"}`}>
                        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                      </span>
                      <span className="text-[14px] text-[#e0e0e0]">{r}</span>
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
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Profil physique</h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Mensurations et tests athlétiques</p>

        <FormModeToggle mode={d.physicalMode} onChange={(m) => updatePhysical("physicalMode", m)} />

        <p className={sectionTitle}>Mensurations</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8">
          <div>
            <label className={labelCls}>Taille — Pieds</label>
            <NxSelect value={d.heightFeet} onChange={(v) => updatePhysical("heightFeet", v)} placeholder="—"
              options={[4, 5, 6, 7].map((f) => ({ value: String(f), label: `${f}'` }))} />
          </div>
          <div>
            <label className={labelCls}>Pouces</label>
            <NxSelect value={d.heightInches} onChange={(v) => updatePhysical("heightInches", v)} placeholder="—"
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i}"` }))} />
          </div>
          <div>
            <label className={labelCls}>Poids (lbs)</label>
            <input type="number" value={d.weightLbs} onChange={(e) => updatePhysical("weightLbs", e.target.value)} placeholder="185" className={inputCls} />
          </div>
          {isDetailedPhys && (
            <>
              <div><label className={labelCls}>Envergure</label><input type="text" value={d.wingspan} onChange={(e) => updatePhysical("wingspan", e.target.value)} placeholder={'6\'4"'} className={inputCls} /></div>
              <div><label className={labelCls}>Taille des mains</label><input type="text" value={d.handSize} onChange={(e) => updatePhysical("handSize", e.target.value)} placeholder={'9.5"'} className={inputCls} /></div>
            </>
          )}
          <div>
            <label className={labelCls}>Main dominante</label>
            <NxSelect value={d.dominantHand} onChange={(v) => updatePhysical("dominantHand", v)} placeholder="—"
              options={[{ value: "Droite", label: "Droite" }, { value: "Gauche", label: "Gauche" }, { value: "Ambidextre", label: "Ambidextre" }]} />
          </div>
          {isDetailedPhys && (
            <div>
              <label className={labelCls}>Pied dominant</label>
              <NxSelect value={d.dominantFoot} onChange={(v) => updatePhysical("dominantFoot", v)} placeholder="—"
                options={[{ value: "Droit", label: "Droit" }, { value: "Gauche", label: "Gauche" }, { value: "Les deux", label: "Les deux" }]} />
            </div>
          )}
        </div>

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
                  <input type="text" value={d[f.key as keyof typeof d]} onChange={(e) => updatePhysical(f.key, e.target.value)} placeholder={f.placeholder} className={inputCls} />
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
    const isDetailed = d.sportsMode === "detailed";
    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Informations sportives</h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Sport, position et niveau de compétition</p>

        <FormModeToggle mode={d.sportsMode} onChange={(m) => updateSports("sportsMode", m)} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <label className={labelCls}>Sport principal{req}</label>
            <NxSelect value={d.primarySport} onChange={(v) => { updateSports("primarySport", v); if (v !== "Autre") updateSports("primarySportDetail", ""); }}
              hasError={isFieldEmpty(d.primarySport)} options={SPORTS.map((s) => ({ value: s, label: s }))} />
            {d.primarySport === "Autre" && <input type="text" value={d.primarySportDetail} onChange={(e) => updateSports("primarySportDetail", e.target.value)} placeholder="Précisez le sport…" className={`${inputCls} mt-2`} />}
          </div>
          <SportPositionSelect sport={d.primarySport === "Autre" && d.primarySportDetail ? "Autre" : d.primarySport} value={d.primaryPosition} onChange={(v) => updateSports("primaryPosition", v)} label="Position principale" required hasError={isFieldEmpty(d.primaryPosition)} />
          <div>
            <label className={labelCls}>Numéro de chandail{req}</label>
            <input type="text" inputMode="numeric" value={d.jerseyNumber} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); updateSports("jerseyNumber", v); }} placeholder="#" className={`${inputCls} ${isFieldEmpty(d.jerseyNumber) ? errBorder : ""}`} />
          </div>
          <SportPositionSelect sport={d.primarySport === "Autre" && d.primarySportDetail ? "Autre" : d.primarySport} value={d.secondaryPosition} onChange={(v) => updateSports("secondaryPosition", v)} label="Position secondaire" />

          {/* Équipe — always visible (Simplifiée + Détaillée) */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Équipe{req}</label>
            <NxSelect aria-label="Équipe" value={d.selectedTeamId}
              onChange={(v) => { const team = coachTeam.teams.find((t) => t.id === v); updateSports("selectedTeamId", v); updateSports("currentTeam", team?.name || ""); updateSports("teamLevel", team?.level || ""); updateSports("teamDivision", team?.division || ""); updateSports("league", team?.league || ""); }}
              hasError={isFieldEmpty(d.selectedTeamId)}
              placeholder={coachTeam.teams.length === 0 ? "Aucune équipe — créez-en une dans Mes équipes" : "Sélectionner une équipe"}
              options={coachTeam.teams.map((t) => ({ value: t.id, label: `${t.name}${t.level ? ` — ${t.level}` : ""}` }))} />
          </div>
        </div>

        {isDetailed && (
          <div className="border-t border-[#1e2128] mt-2 pt-5">
            <p className={sectionTitle}>Détails additionnels</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className={labelCls}>Sport secondaire</label>
                <NxSelect value={d.secondarySport}
                  onChange={(v) => {
                    const val = v === "Aucun" ? "" : v;
                    updateSports("secondarySport", val);
                    if (val !== "Autre") updateSports("secondarySportDetail", "");
                    if (!val) { updateSports("secondarySportPosition", ""); updateSports("secondaryTeamId", ""); updateSports("secondaryTeam", ""); updateSports("secondaryTeamLevel", ""); updateSports("secondaryTeamDivision", ""); updateSports("secondaryLeague", ""); }
                  }}
                  placeholder="Aucun" options={[{ value: "Aucun", label: "Aucun" }, ...SPORTS.map((s) => ({ value: s, label: s }))]} />
                {d.secondarySport === "Autre" && <input type="text" value={d.secondarySportDetail} onChange={(e) => updateSports("secondarySportDetail", e.target.value)} placeholder="Précisez le sport…" className={`${inputCls} mt-2`} />}
              </div>
              {d.secondarySport && d.secondarySport !== "" && (
                <SportPositionSelect sport={d.secondarySport === "Autre" && d.secondarySportDetail ? "Autre" : d.secondarySport} value={d.secondarySportPosition} onChange={(v) => updateSports("secondarySportPosition", v)}
                  label={`Position — ${d.secondarySport === "Autre" && d.secondarySportDetail ? d.secondarySportDetail : d.secondarySport}`} />
              )}

              {d.selectedTeamId && (
                <>
                  <div><label className={labelCls}>Niveau</label><div className="relative"><input type="text" readOnly value={d.teamLevel} aria-label="Niveau de l'équipe" className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} /><svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div></div>
                  <div><label className={labelCls}>Division</label><div className="relative"><input type="text" readOnly value={d.teamDivision} aria-label="Division" className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} /><svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div></div>
                </>
              )}
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${d.openToCoaching ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a] group-hover:border-[#6b7280]"}`}>
                    {d.openToCoaching && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </span>
                  <input type="checkbox" checked={d.openToCoaching} onChange={() => updateSports("openToCoaching", !d.openToCoaching)} className="sr-only" />
                  <span className="text-[14px] text-[#e0e0e0]">Ouvert à devenir entraîneur au CÉGEP</span>
                </label>
              </div>
            </div>

            {d.selectedTeamId && d.league && (
              <div className="border-t border-[#1e2128] pt-5">
                <label className={labelCls}>Ligue</label>
                <div className="relative max-w-xs">
                  <input type="text" readOnly value={d.league} aria-label="Ligue" className={`${inputCls} !bg-[#0d0f13] cursor-not-allowed opacity-80`} />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                </div>
              </div>
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
    const atMax = sc.badges.length >= MAX_BADGES;

    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">
          Évaluation du coach
        </h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Leadership et recommandation de l&apos;entraîneur</p>

        <FormModeToggle mode={sc.evalMode} onChange={(m) => updateScouting("evalMode", m)} />

        {/* ── Star Rating (simplified) ──────────────── */}
        {!isDetailed && (
        <div className="mb-8">
          <p className={sectionTitle}>Cote globale de l&apos;entraîneur</p>
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
                        <clipPath id={`half-${i}`}>
                          <rect x="0" y="0" width="12" height="24" />
                        </clipPath>
                      </defs>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F59E0B" clipPath={`url(#half-${i})`} />
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

        {/* ── Character Traits Rating (detailed only) ── */}
        {isDetailed && (
        <div className="mb-8">
          <p className={sectionTitle}>Évaluation par caractéristique</p>
          <p className="text-[12px] text-[#6b7280] mb-5 -mt-3">
            Évalue chaque caractéristique de l&apos;athlète individuellement. Clique sur les étoiles pour noter de 1 à 5.
          </p>
          <div className="space-y-1">
            {CHARACTER_TRAITS.map((trait) => {
              const rating = sc.traitRatings[trait.key] || 0;
              return (
                <div key={trait.key}
                  className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-[#13151a]/60 border border-[#2a2d36]/50 hover:border-[#3a3d46]/60 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <NxIcon name={trait.iconName} size={15} className="shrink-0 text-[#8a8d96]" />
                    <span className="text-[14px] font-bold text-[#c8c8cc] truncate">{trait.label}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: 5 }, (_, i) => {
                      const starVal = i + 1;
                      const isFilled = rating >= starVal;
                      return (
                        <button key={i} type="button"
                          title={`${starVal} étoile${starVal > 1 ? "s" : ""}`}
                          className="w-6 h-6 cursor-pointer transition-transform hover:scale-110"
                          onClick={() => {
                            const newVal = rating === starVal ? 0 : starVal;
                            updateScouting("traitRatings", { ...sc.traitRatings, [trait.key]: newVal });
                          }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill={isFilled ? "#F59E0B" : "#2D3748"} stroke="none">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                      );
                    })}
                    <span className="ml-2 text-[13px] font-bold text-[#6b7280] w-8 text-right tabular-nums">
                      {rating > 0 ? `${rating}/5` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {(() => {
            const rated = Object.values(sc.traitRatings).filter((v) => v > 0);
            if (rated.length === 0) return null;
            const avg = rated.reduce((a, b) => a + b, 0) / rated.length;
            return (
              <div className="mt-4 flex items-center justify-end gap-2">
                <span className="text-[12px] text-[#6b7280] font-bold uppercase tracking-wider">Moyenne</span>
                <span className="text-[16px] font-black text-[#F59E0B]">{avg.toFixed(1)}</span>
                <span className="text-[12px] text-[#6b7280]">/ 5</span>
              </div>
            );
          })()}
        </div>
        )}

        {/* ── Distinctions (Sport-specific badges) ──── */}
        <div className="mb-8">
          <p className={sectionTitle}>Distinctions</p>
          <p className="text-[12px] text-[#6b7280] mb-4 -mt-3">
            Sélectionne les reconnaissances qui s&apos;appliquent à cet athlète cette saison.
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
            {sc.badges.length} / {MAX_BADGES} sélectionnée{sc.badges.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* ── Rapport de l'entraîneur ──────────────── */}
        <div className="mb-8 border-t border-[#1e2128] pt-6">
          <p className={sectionTitle}>Rapport de l&apos;entraîneur</p>
          <p className="text-[12px] text-[#6b7280] mb-3 -mt-3">
            Décris cet athlète aux recruteurs. Parle de son caractère, ses forces et ses performances marquantes.
          </p>
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
              <p className="text-[12px] text-[#F59E0B] font-bold">
                Le rapport de l&apos;entraîneur est la section la plus consultée par les recruteurs. C&apos;est ta recommandation personnelle.
              </p>
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
        <div className="flex items-center mb-6">
          <p className="text-[14px] text-[#6b7280]">Liens vers les vidéos et profils en ligne</p>
          <div className="flex items-center gap-3 ml-auto bg-[#E63946]/[0.06] border border-[#E63946]/[0.12] rounded-lg px-4 py-2.5 shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path d="M9 21h6" stroke="#F5C518" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 2a6 6 0 014 10.5V17a1 1 0 01-1 1h-6a1 1 0 01-1-1v-4.5A6 6 0 0112 2z" fill="#F5C518" fillOpacity="0.15" stroke="#F5C518" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[12px] text-[#8a8d96]"><strong className="text-white font-bold">11x</strong> vues</span>
            <span className="w-px h-3 bg-[#2a2d36]" />
            <span className="text-[12px] text-[#8a8d96]"><strong className="text-white font-bold">3x</strong> engagements</span>
            <span className="w-px h-3 bg-[#2a2d36]" />
            <span className="text-[12px] text-[#8a8d96]"><strong className="text-white font-bold">80%</strong> contactés</span>
          </div>
        </div>

        <FormModeToggle mode={d.mediaMode} onChange={(m) => updateMedia("mediaMode", m)} />

        {/* Simplified: highlight video only */}
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

        {/* Detailed: all other media links */}
        {isDetailed && (
          <div className="border-t border-[#1e2128] mt-6 pt-5">
            <p className={sectionTitle}>Liens additionnels</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {detailedFields.map((f) => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input type="url" value={d[f.key as keyof typeof d]} onChange={(e) => updateMedia(f.key, e.target.value)} placeholder={f.placeholder} className={inputCls} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Step 7: Révision ─────────────────────────────────────── */
  function renderStep7() {
    const identity = form.identity;
    const academic = form.academic;
    const physical = form.physical;
    const sports = form.sports;
    const scouting = form.scouting;
    const media = form.media;
    const submission = form.submission;

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
      return (
        <div className="flex justify-between py-1.5 border-b border-[#1e2128] last:border-0">
          <span className="text-[12px] text-[#6b7280]">{label}</span>
          <span className="text-[12px] text-[#e0e0e0] font-medium text-right">{value}</span>
        </div>
      );
    };

    const heightStr = physical.heightFeet && physical.heightInches ? `${physical.heightFeet}'${physical.heightInches}"` : physical.heightFeet ? `${physical.heightFeet}'` : "";

    return (
      <div className={cardCls}>
        <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">Révision &amp; Soumission</h2>
        <p className="text-[15px] text-[#6b7280] mb-8">Vérifiez les informations avant de soumettre</p>

        {summaryCard("Étudiant-athlète", 1, (
          <div>
            {infoRow("Nom", `${identity.firstName} ${identity.lastName}`)}
            {infoRow("Genre", identity.gender === "M" ? "Masculin" : identity.gender === "F" ? "Féminin" : identity.gender === "X" ? "Non genré" : "")}
            {infoRow("Date de naissance", identity.dateOfBirth)}
            {infoRow("Promotion", identity.gradYear)}
            {infoRow("École", identity.school)}
            {infoRow("Ville / Région", `${identity.city}${identity.region ? `, ${identity.region}` : ""}`)}
          </div>
        ))}

        {summaryCard("Académique", 2, (
          <div>
            {infoRow("Moyenne", academic.gpa ? `${academic.gpa}%` : "")}
            {academic.strongSubjects.length > 0 && infoRow("Matières fortes", academic.strongSubjects.join(", "))}
            {infoRow("Programme visé", academic.cegepType === "dec_general" ? "DEC général" : academic.cegepType === "technique" ? `Technique${academic.cegepProgramDetail ? ` — ${academic.cegepProgramDetail}` : ""}` : "")}
            {academic.openToPrivate && infoRow("CÉGEP privé", "Oui")}
            {academic.openToAnglophone && infoRow("CÉGEP anglophone", "Oui")}
            {academic.openToRelocate && infoRow("Prêt à changer de région", "Oui")}
          </div>
        ))}

        {summaryCard("Physique", 3, (
          <div>
            {infoRow("Taille", heightStr)}
            {infoRow("Poids", physical.weightLbs ? `${physical.weightLbs} lbs` : "")}
            {infoRow("Main dominante", physical.dominantHand)}
            {infoRow("40 verges", physical.fortyYard)}
          </div>
        ))}

        {summaryCard("Sport", 4, (
          <div>
            {infoRow("Sport principal", sports.primarySport)}
            {infoRow("Position", `${sports.primaryPosition}${sports.secondaryPosition ? ` / ${sports.secondaryPosition}` : ""}`)}
            {infoRow("Équipe", sports.currentTeam)}
            {infoRow("Niveau", sports.teamLevel)}
            {infoRow("Chandail", sports.jerseyNumber ? `#${sports.jerseyNumber}` : "")}
          </div>
        ))}

        {summaryCard("Évaluation", 5, (
          <div>
            {infoRow("Distinctions", scouting.badges.length > 0 ? scouting.badges.map((b) => {
              const cfg = BADGE_CONFIG[b.badge];
              const label = b.badge === "custom" ? (b.detail || "Distinction") : cfg?.label || b.badge;
              return b.badge !== "custom" && b.detail ? `${label} — ${b.detail}` : label;
            }).join(", ") : "")}
            {scouting.coachEndorsement && (
              <div className="mt-2 p-3 bg-[#1A1D24] rounded-lg">
                <p className="text-[12px] text-[#6b7280] mb-1 font-bold uppercase tracking-wider">Rapport</p>
                <p className="text-[12px] text-[#e0e0e0] italic leading-relaxed">&ldquo;{scouting.coachEndorsement.slice(0, 150)}{scouting.coachEndorsement.length > 150 ? "…" : ""}&rdquo;</p>
              </div>
            )}
          </div>
        ))}

        {summaryCard("Médias", 6, (
          <div>
            {infoRow("Hudl", media.hudlLink)}
            {infoRow("YouTube", media.youtubeLink)}
            {infoRow("Instagram", media.instagramLink)}
            {infoRow("Faits saillants", media.highlightVideo)}
            {infoRow("Match complet", media.fullGameVideo)}
          </div>
        ))}

        <div className="border-t border-[#1e2128] mt-6 pt-5">
          <p className={sectionTitle}>Finalisation</p>
          <div>
            <label className={labelCls}>Statut de recrutement{req}</label>
            <NxSelect value={submission.recruitingStatus} onChange={(v) => { console.log("Recruitment status selected:", v); updateSubmission("recruitingStatus", v); }}
              options={[{ value: "OUVERT", label: "Ouvert aux offres" }, { value: "ENGAGE", label: "Engagé / Committé" }, { value: "FERME", label: "Fermé / Non disponible" }]} />
          </div>
        </div>

        {/* ── Parental Consent ─────────────────────────────── */}
        <div className="bg-[#1A1D24] border-l-4 border-[#EAB308] rounded-r-xl p-5 mt-6">
          <div className="flex items-start gap-3 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <div>
              <h3 className="font-head text-lg font-black text-white uppercase tracking-tight">Consentement parental requis</h3>
              <p className="text-[13px] text-[#9CA3AF] mt-1.5 leading-relaxed">
                Conformément à la Loi 25 sur la protection des renseignements personnels, tu dois obtenir le consentement écrit d&apos;un parent ou tuteur légal avant de publier le profil d&apos;un athlète mineur sur Nexus.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                form.parentalConsent ? "bg-[#E63946] border-[#E63946]" : "border-[#E63946] bg-transparent"
              }`}
              onClick={() => setForm((prev) => ({ ...prev, parentalConsent: !prev.parentalConsent }))}
            >
              {form.parentalConsent && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              )}
            </div>
            <span className="text-[13px] text-white font-semibold leading-snug group-hover:text-[#E63946] transition-colors" onClick={() => setForm((prev) => ({ ...prev, parentalConsent: !prev.parentalConsent }))}>
              Je confirme avoir obtenu le consentement parental écrit pour la publication de ce profil sur Nexus.
            </span>
          </label>

          <div className="mt-3 pl-8">
            <p className="text-[11px] text-[#6b7280]">Le formulaire signé doit être conservé à l&apos;école.</p>
            <button type="button" onClick={() => { setForm((prev) => prev); /* toast handled at page level */ }} className="text-[11px] font-bold text-[#E63946] hover:text-[#D42B22] mt-1 transition-colors">
              Télécharger le formulaire type (PDF)
            </button>
          </div>
        </div>

        <PartnerVisibilityConsentCard
          checked={form.partnerVisibilityConsent}
          onChange={(next) => setForm((prev) => ({ ...prev, partnerVisibilityConsent: next }))}
        />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     SUBMITTED STATE
  ══════════════════════════════════════════════════════════════ */

  if (submitted) {
    return (
      <div className="px-4 sm:px-6 py-16 max-w-xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#22C55E]/15 mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight mb-2">Profil soumis</h1>
        <p className="text-[14px] text-[#8a8d96] mb-8 leading-relaxed">
          Le profil de <strong className="text-white">{form.identity.firstName} {form.identity.lastName}</strong> a été soumis avec succès. Il sera révisé par l&apos;administration avant d&apos;être visible aux recruteurs.
        </p>
        <button type="button" onClick={() => { setSubmitted(false); setForm(INITIAL_FORM); setCurrentStep(1); setCompletedSteps(new Set()); }}
          className="bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-bold text-[12px] uppercase tracking-widest rounded-lg px-6 py-3 transition-colors">
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
  };

  return (
    <div className="px-6 sm:px-10 py-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-[14px] text-[#6b7280] mb-8">
        <span className="font-bold text-[#8a8d96]">Nexus</span><span>/</span><span>Coach</span><span>/</span><span className="text-white">Créer un profil</span>
      </div>

      <div className="mb-8">
        <h1 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">Créer un profil étudiant-athlète</h1>
        <p className="text-[15px] text-[#6b7280] mt-2">Remplissez chaque section pour créer un profil complet</p>
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
          {currentStep === 7 && (
            <button type="button" onClick={handleDraft}
              className="bg-[#1A1D24] border border-[#2a2d36] text-[#e0e0e0] rounded-lg px-6 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest transition-all duration-150 hover:border-[#8a8d96] hover:bg-[#22252c] active:scale-95">Brouillon</button>
          )}
          {currentStep < 7 ? (
            <button type="button" onClick={goNext}
              className="flex items-center gap-2.5 bg-[#E63946] text-white rounded-lg px-6 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest transition-all duration-150 hover:bg-[#D42B22] hover:translate-x-0.5 hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95 cursor-pointer">
              Suivant
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit}
              disabled={!form.parentalConsent}
              title={!form.parentalConsent ? "Tu dois confirmer le consentement parental" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-6 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest transition-all duration-150 ${
                form.parentalConsent
                  ? "bg-[#E63946] text-white hover:bg-[#D42B22] hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95 cursor-pointer"
                  : "bg-[#E63946]/40 text-white/50 cursor-not-allowed"
              }`}>
              Soumettre le profil
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
