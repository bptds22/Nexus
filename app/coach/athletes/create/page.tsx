"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import StepIndicator from "../../components/StepIndicator";
import TagInput from "../../components/TagInput";
import DatePicker from "../../components/DatePicker";
import SportPositionSelect from "../../components/SportPositionSelect";
import NxSelect from "../../components/NxSelect";
import { BADGE_CONFIG, BADGE_ORDER, MAX_BADGES, MAX_DETAIL_LENGTH, getSportStats, type DistinctionEntry } from "@/lib/config/badges";
import { GRAD_YEAR_OPTIONS } from "@/lib/config/gradYears";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import FormModeToggle from "../../components/FormModeToggle";
import NxIcon from "@/components/ui/NxIcon";
import { createClient } from "@/lib/supabase/client";
import PartnerVisibilityConsentCard from "@/components/shared/PartnerVisibilityConsentCard";
import ReadOnlyIfPending from "@/components/auth/ReadOnlyIfPending";
import {
  lookupInvitableByEmail,
  type AthleteEmailAutocompleteResult,
  type AthleteEmailSuggestion,
} from "@/lib/coach/athleteEmailAutocomplete";
import AthleteWizardMobile from "@/components/shared/AthleteWizardMobile";
import { saveAthleteCreate, computeCoteGlobale } from "../_data/saveAthlete";
import { inviteAnchoredAthlete } from "@/lib/queries/coach/inviteAnchoredAthlete";
import { isUnder14 } from "@/lib/legal/ageGate";
import InvitationLinkModal from "@/components/ui/InvitationLinkModal";
import { createAthleteInvitationLink } from "@/lib/queries/coach/createAthleteInvitation";
import { inviteAthleteToTeam } from "@/lib/queries/coach/teamInvite";
import { coteChanged } from "@/lib/utils/cote";
import { ConfirmSheet } from "@/components/shared/settings";
import CoteChangeConfirmContent from "@/components/shared/CoteChangeConfirmContent";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

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
    primarySport: "", primarySportDetail: "", primaryPosition: "",
    selectedTeamId: "", currentTeam: "", teamLevel: "", teamDivision: "",
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
  // Mobile-native dispatch (Capacitor) — shared mode-gated wizard.
  // Web wizard below untouched. IS_CAPACITOR is a build-time constant
  // so the conditional return is stable per build (no rules-of-hooks issue).
  if (IS_CAPACITOR) return <AthleteWizardMobile mode="create" />;
  const [form, setForm] = useState<AthleteFormData>(INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showErrors, setShowErrors] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // #48 — id de l'athlète créé (pour générer son lien de claim depuis l'écran
  // de confirmation) + état du lien token-based.
  const [createdAthleteId, setCreatedAthleteId] = useState<string | null>(null);
  const [claimLink, setClaimLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [emailInviting, setEmailInviting] = useState(false);
  const [emailInviteResult, setEmailInviteResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const router = useRouter();

  // 6.2.c-1-pivot : autocomplete partial sur le champ Courriel.
  // Le coach tape une partie de l'email; des suggestions s'affichent;
  // clic = autofill firstName + lastName + email.
  // Filtré aux athletes orphelins (school_id IS NULL) via RLS
  // "Coaches lookup orphan athletes" (migration 20260512160000).
  // Debounce 300ms + min 4 chars + max 3 résultats + rate limit
  // 10/60s gérés dans lib/coach/athleteEmailAutocomplete.
  const [emailAutocomplete, setEmailAutocomplete] = useState<AthleteEmailAutocompleteResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [linkedToExisting, setLinkedToExisting] = useState<AthleteEmailSuggestion | null>(null);
  const emailAutocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 6.2.c-2 : state pour le card invitation qui remplace le form quand
  // un athlete est sélectionné dans le dropdown autocomplete.
  const [formStateBeforeLink, setFormStateBeforeLink] = useState<AthleteFormData | null>(null);
  const [invitationTeamId, setInvitationTeamId] = useState<string | null>(null);
  /* ANCRÉ AILLEURS — jumeau du bloc d'AthleteWizardMobile. Le drapeau arrive
     SEUL, sans identité : on ne peut ni nommer l'athlète, ni créer sa fiche.
     On propose l'invitation, résolue côté serveur. */
  const [ancreAilleurs, setAncreAilleurs] = useState(false);
  const [equipeTransfert, setEquipeTransfert] = useState<string | null>(null);
  const [envoiAncre, setEnvoiAncre] = useState(false);
  const [resultatAncre, setResultatAncre] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [otherPendingCount, setOtherPendingCount] = useState<number>(0);
  const [isSubmittingInvitation, setIsSubmittingInvitation] = useState(false);

  /* Cote-A : confirmation gate. originalCote is null (new athlete, no
     prior eval) ; first-time rating IS high-impact, so create gates
     whenever newCote != null. coteConfirmedRef bypasses the gate on
     the modal's onConfirm so the save proceeds. */
  const [coteConfirmOpen, setCoteConfirmOpen] = useState(false);
  const [pendingCote, setPendingCote] = useState<{ newCote: number | null; originalCote: number | null }>({
    newCote: null,
    originalCote: null,
  });
  const coteConfirmedRef = useRef(false);

  const handleEmailChange = useCallback((newEmail: string) => {
    setForm((prev) => ({
      ...prev,
      identity: { ...prev.identity, email: newEmail },
    }));

    // Edit après autofill = rupture du lien avec le compte sélectionné
    if (linkedToExisting) {
      setLinkedToExisting(null);
    }

    if (emailAutocompleteTimerRef.current) {
      clearTimeout(emailAutocompleteTimerRef.current);
    }

    if (newEmail.trim().length < 4) {
      setEmailAutocomplete(null);
      setShowSuggestions(false);
      setAncreAilleurs(false);
      setResultatAncre(null);
      return;
    }

    emailAutocompleteTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createClient();
        // lookupInvitableByEmail — la MÊME recherche que le dialogue du roster.
        // Elle couvre une population de plus (les comptes sans coach, scolaires
        // comme civils) et surtout elle rend `existsNotInvitable`. Sans ce
        // drapeau, un courriel appartenant à un athlète ANCRÉ AILLEURS ne
        // produisait rien : ni suggestion, ni avertissement, et le coach créait
        // un doublon. C'était le cul-de-sac.
        const result = await lookupInvitableByEmail(supabase, newEmail);
        setEmailAutocomplete({ status: result.status, suggestions: result.suggestions });
        setShowSuggestions(result.status === "ok" && result.suggestions.length > 0);
        setAncreAilleurs(result.existsNotInvitable && result.suggestions.length === 0);
      } catch (err) {
        console.error("[EmailAutocomplete] lookup error:", err);
      }
    }, 300);
  }, [linkedToExisting]);

  const handleSelectSuggestion = useCallback(async (suggestion: AthleteEmailSuggestion) => {
    // 6.2.c-2 : save form state pour permettre le restore via "Choisir
    // un autre athlète". structuredClone garantit un snapshot deep, pas
    // une référence partagée.
    setFormStateBeforeLink(structuredClone(form));

    setForm((prev) => ({
      ...prev,
      identity: {
        ...prev.identity,
        firstName: suggestion.firstName,
        lastName: suggestion.lastName,
        email: suggestion.email,
      },
    }));
    setLinkedToExisting(suggestion);
    setShowSuggestions(false);
    setEmailAutocomplete(null);

    // Note : auto-select team logique déplacée dans un useEffect plus
    // bas pour éviter une référence à coachTeam dans la closure
    // (coachTeam est declared plus tard dans le component body, TDZ).

    // Check pour autres invitations PENDING sur cet athlete
    try {
      const supabase = createClient();
      const { data: otherInvitations } = await supabase
        .from("team_invitations")
        .select("id")
        .eq("athlete_id", suggestion.athleteId)
        .eq("status", "PENDING");
      setOtherPendingCount(otherInvitations?.length ?? 0);
    } catch (err) {
      console.error("[Invitation] pending count check failed:", err);
      setOtherPendingCount(0);
    }
  }, [form]);

  // 6.2.c-2 : retour au form normal, restore l'état pré-clic.
  const handleUnlinkAndRestoreForm = useCallback(() => {
    if (formStateBeforeLink) {
      setForm(formStateBeforeLink);
    }
    setLinkedToExisting(null);
    setFormStateBeforeLink(null);
    setInvitationTeamId(null);
    setOtherPendingCount(0);
  }, [formStateBeforeLink]);

  // 6.2.c-2 : INSERT team_invitations PENDING. Le trigger Flow A
  // (apply_team_invitation_acceptance) se déclenchera côté athlete
  // lors de son ACCEPTED — pas ici.
  const handleSendInvitation = useCallback(async () => {
    if (!linkedToExisting) return;
    // Athlète AVEC compte → team_invitations in-app (équipe requise).
    // Orphelin SANS compte → email de claim (pas d'équipe).
    if (linkedToExisting.hasAccount && !invitationTeamId) {
      console.error("[Invitation] Missing team", { linkedToExisting, invitationTeamId });
      return;
    }

    setIsSubmittingInvitation(true);

    try {
      const supabase = createClient();

      // ── Orphelin sans compte → email via createAthleteInvitationLink (RPC +
      //    trigger). Mêmes gardes que le CTA (owner, <14, claimed). ──────────
      if (!linkedToExisting.hasAccount) {
        const { error } = await createAthleteInvitationLink(
          supabase,
          linkedToExisting.athleteId,
          linkedToExisting.email,
        );
        if (error) {
          alert(`Erreur lors de l'envoi : ${error}`);
          setIsSubmittingInvitation(false);
          return;
        }
        setShowConfirmModal(false);
        alert(`Invitation envoyée à ${linkedToExisting.email}`);
        router.push("/coach/athletes");
        return;
      }

      // ── Athlète avec compte → team_invitations in-app (helper partagé avec
      //    le CTA roster — un seul mécanisme). ────────────────────────────────
      const res = await inviteAthleteToTeam(supabase, linkedToExisting.athleteId, invitationTeamId!);
      if (res.error) {
        console.error("[Invitation] team invite error:", res.error);
        alert(res.error);
        setIsSubmittingInvitation(false);
        return;
      }

      setShowConfirmModal(false);
      alert(`Invitation envoyée à ${linkedToExisting.firstName} ${linkedToExisting.lastName}`);
      router.push("/coach/equipes");
    } catch (err) {
      console.error("[Invitation] Unexpected error:", err);
      alert("Erreur inattendue. Réessaie plus tard.");
      setIsSubmittingInvitation(false);
    }
  }, [linkedToExisting, invitationTeamId, router]);

  useEffect(() => {
    return () => {
      if (emailAutocompleteTimerRef.current) {
        clearTimeout(emailAutocompleteTimerRef.current);
      }
    };
  }, []);

  // League context state
  const [userContext, setUserContext] = useState<string | null>(null);
  const [leagueTeamId, setLeagueTeamId] = useState<string | null>(null);
  const [leagueTeamName, setLeagueTeamName] = useState("");
  const [coachTeam, setCoachTeam] = useState<CoachTeamData>({ school: "", city: "", region: "", teams: [] });

  // 6.2.c-2 : auto-select team quand linkedToExisting change. Si le
  // coach a 1 seule team, on l'auto-sélectionne; sinon force le user
  // à choisir explicitement via le dropdown du card invitation.
  useEffect(() => {
    if (!linkedToExisting) return;
    if (coachTeam.teams.length === 1) {
      setInvitationTeamId(coachTeam.teams[0].id);
    } else {
      setInvitationTeamId(null);
    }
  }, [linkedToExisting, coachTeam.teams]);

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

        // Phase 6.2.h : civil teams now read via team_coaches junction
        // (replaces legacy league_teams.owner_id lookup).
        const { data: tcRows } = await supabase
          .from("team_coaches")
          .select("teams!team_id(id, name)")
          .eq("coach_id", authUser.id);

        const teams = (tcRows ?? [])
          .map((r) => {
            const t = (r as { teams?: unknown }).teams;
            return (Array.isArray(t) ? t[0] : t) as { id?: string; name?: string } | null;
          })
          .filter((t): t is { id: string; name: string } => !!t?.id);


        if (teams.length > 0) {
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
        // Simplified: prénom, nom, DOB, promotion. Hard-block <14 (Loi 25),
        // même gate que le self-signup — un coach ne peut pas créer un <14.
        const base = !!(d.firstName && d.lastName && d.dateOfBirth && d.gradYear) && !isUnder14(d.dateOfBirth);
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

  /* Transfert proposé à un athlète ancré ailleurs. Le courriel part tel quel
     vers la RPC, qui le résout côté serveur : le client n'obtient jamais
     l'identifiant, donc le coach n'apprend rien de plus qu'avant. N'écrit
     QUE dans team_invitations — jamais dans athlete_invitations. */
  async function envoyerTransfert() {
    const courriel = form.identity.email?.trim();
    if (!courriel || !equipeTransfert || envoiAncre) return;
    setEnvoiAncre(true);
    setResultatAncre(null);
    try {
      const r = await inviteAnchoredAthlete(createClient(), courriel, equipeTransfert);
      setResultatAncre({ ok: r.ok, msg: r.message || "Invitation envoyée — il devra l'accepter." });
    } finally {
      setEnvoiAncre(false);
    }
  }

  async function handleSubmit() {
    if (!validateStep(7)) { setShowErrors(true); return; }

    /* ANCRÉ AILLEURS → ON NE CRÉE RIEN.
       La fiche existe et appartient à un autre coach. Créer produirait le
       doublon exact que la détection cherche à éviter — et rien en base ne
       l'empêche (aucun index unique sur athletes.email). La seule action
       légitime est l'invitation, proposée à l'étape 1. */
    if (ancreAilleurs) {
      setCurrentStep(1);
      setShowErrors(true);
      return;
    }

    // Hard-stop <14 (Loi 25) — ferme le contournement par saut d'étape
    // (goToStep ne valide rien). Garantit qu'aucune row <14 n'atteint
    // saveAthleteCreate, quel que soit le chemin de navigation.
    if (isUnder14(form.identity.dateOfBirth)) { setCurrentStep(1); setShowErrors(true); return; }

    /* Cote-A intercept : originalCote is always null for a fresh create ;
       any non-null newCote represents a first-time rating (high-impact),
       so we gate. If the coach didn't rate at all (no traits, no star),
       newCote stays null → coteChanged(null, null) === false → no popup. */
    /* Cast through unknown — same local AthleteFormData vs canonical
       wizardFormShape AthleteFormData drift as the saveAthleteCreate
       call below (existing baseline error). Both shapes carry
       scouting.{traitRatings,starRating} which is all
       computeCoteGlobale reads. */
    const newCote = computeCoteGlobale(form as unknown as Parameters<typeof computeCoteGlobale>[0]);
    if (!coteConfirmedRef.current && coteChanged(newCote, null)) {
      setPendingCote({ newCote, originalCote: null });
      setCoteConfirmOpen(true);
      return;
    }
    coteConfirmedRef.current = false;

    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      alert("Session expirée. Veuillez vous reconnecter.");
      return;
    }

    // Coach's school_id is needed by the shared layer for the
    // create-only `school_id` column on the new athletes row.
    const { data: coachProfile } = await supabase
      .from("users")
      .select("id, school_id")
      .eq("id", authUser.id)
      .single();

    // Shared save layer — owns sport/position lookups, the cote
    // auto-average (previously missing on web create) and all
    // INSERTs (athletes / evaluations / team_athletes). See
    // app/coach/athletes/_data/saveAthlete.ts.
    const result = await saveAthleteCreate(supabase, form, authUser.id, {
      coachSchoolId: (coachProfile?.school_id as string | null) ?? null,
    });
    if (result.error) {
      console.error("Error creating athlete:", result.error);
      alert("Erreur lors de la création du profil: " + result.error.message);
      return;
    }

    setCompletedSteps((prev) => new Set([...prev, 7]));
    setCreatedAthleteId((result as { id?: string }).id ?? null);
    setSubmitted(true);
  }

  function handleDraft() {
    setSubmitted(true);
  }

  // #48 — génère le lien de claim de l'athlète qu'on vient de créer (même RPC
  // + même modale que la fiche athlète, via le helper partagé).
  async function handleGenerateInviteLink() {
    if (!createdAthleteId) return;
    setGeneratingLink(true);
    setLinkError(null);
    try {
      const supabase = createClient();
      const { link, error } = await createAthleteInvitationLink(supabase, createdAthleteId);
      if (error || !link) { setLinkError(error ?? "Impossible de générer le lien."); return; }
      setClaimLink(link);
    } finally {
      setGeneratingLink(false);
    }
  }

  // Action PRIMAIRE de l'écran de succès : envoie l'email de claim directement
  // (même helper que le CTA roster). Le gate <14 est mappé côté helper en
  // message neutre sans PII (ATHLETE_UNDER_14 → « ne peut pas être invité »).
  async function handleSendInviteEmail() {
    if (!createdAthleteId || !form.identity.email) return;
    setEmailInviting(true);
    setEmailInviteResult(null);
    try {
      const supabase = createClient();
      const { error } = await createAthleteInvitationLink(supabase, createdAthleteId, form.identity.email);
      if (error) { setEmailInviteResult({ ok: false, msg: error }); return; }
      setEmailInviteResult({ ok: true, msg: `Invitation envoyée à ${form.identity.email}.` });
    } finally {
      setEmailInviting(false);
    }
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
                  const filePath = `${user.id}/${Date.now()}.${fileExt}`;
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
            <DatePicker value={d.dateOfBirth} onChange={(date) => updateIdentity("dateOfBirth", date)} placeholder="Sélectionner une date" hasError={isFieldEmpty(d.dateOfBirth) || isUnder14(d.dateOfBirth)} />
            {d.dateOfBirth && isUnder14(d.dateOfBirth) && (
              <p className="text-[12px] text-[#EF4444] mt-1">L&apos;inscription est réservée aux 14 ans et plus.</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Promotion{req}</label>
            <NxSelect value={d.gradYear} onChange={(v) => updateIdentity("gradYear", v)} hasError={isFieldEmpty(d.gradYear)}
              options={GRAD_YEAR_OPTIONS} />
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
              autoComplete="off"
              placeholder="athlete@email.com" className={inputCls} />

            {/* ANCRÉ AILLEURS — un athlète existe à ce courriel mais appartient
                déjà à quelqu'un d'autre. On ne peut ni le nommer (le drapeau
                arrive sans identité) ni le créer (ce serait le doublon). La
                seule chose honnête : lui demander s'il veut venir. */}
            {ancreAilleurs && (
              <div className="mt-2 rounded-lg bg-[#1A1D24] border border-[#F59E0B]/30 p-4">
                <p className="text-[13px] font-semibold text-white">Un athlète utilise déjà ce courriel</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1 leading-relaxed">
                  Il fait partie d&apos;une autre équipe. Tu ne peux pas créer sa fiche —
                  elle existe déjà. Tu peux l&apos;inviter à rejoindre la tienne :
                  <span className="text-white"> c&apos;est lui qui décidera.</span>
                </p>
                {coachTeam.teams.length === 0 ? (
                  <p className="text-[12px] text-[#F59E0B] mt-3">
                    Aucune équipe — crées-en une dans « Mes équipes ».
                  </p>
                ) : (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <select
                      value={equipeTransfert ?? ""}
                      onChange={(e) => setEquipeTransfert(e.target.value || null)}
                      title="Équipe d'accueil"
                      className="flex-1 bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[14px] text-white focus:outline-none focus:border-[#E63946]/50"
                    >
                      <option value="">Choisir une équipe</option>
                      {coachTeam.teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void envoyerTransfert()}
                      disabled={!equipeTransfert || envoiAncre || resultatAncre?.ok}
                      className="px-4 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {envoiAncre ? "Envoi…" : "Inviter à rejoindre mon équipe"}
                    </button>
                  </div>
                )}
                {resultatAncre && (
                  <p className={`text-[12px] font-semibold mt-3 ${resultatAncre.ok ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                    {resultatAncre.ok ? "✓ " : ""}{resultatAncre.msg}
                  </p>
                )}
              </div>
            )}

            {/* 6.2.c-1-pivot : dropdown autocomplete athletes orphelins
                par email partial (ILIKE 'partial%'). Max 3 suggestions. */}
            {showSuggestions && emailAutocomplete?.suggestions && emailAutocomplete.suggestions.length > 0 && (
              <div className="mt-2 rounded-lg bg-[#1A1D24] border border-[#E63946]/30 overflow-hidden">
                <div className="px-4 py-2 text-xs text-[#9CA3AF] border-b border-[#2D3748]">
                  Comptes Nexus existants
                </div>
                {emailAutocomplete.suggestions.map((s) => (
                  <button
                    key={s.athleteId}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-4 py-3 hover:bg-[#E63946]/10 transition-colors border-b border-[#2D3748] last:border-b-0"
                  >
                    <div className="font-semibold text-white text-sm">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="text-[#9CA3AF] text-xs mt-0.5">
                      {s.email}
                      {s.sportName && ` · ${s.sportName}`}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {emailAutocomplete?.status === "rate_limited" && (
              <div className="mt-2 p-2 text-xs text-[#F59E0B]">
                Trop de recherches. Réessaie dans une minute.
              </div>
            )}

            {/* 6.2.c-1-pivot : indicateur "Lié au compte de X" après une
                sélection dans la dropdown. Clic Délier = reset. */}
            {linkedToExisting && (
              <div className="mt-2 p-3 rounded-lg bg-[#1A1D24] border border-[#E63946]/30">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <div className="flex-1 text-sm">
                    <span className="font-semibold text-white">
                      Lié au compte de {linkedToExisting.firstName} {linkedToExisting.lastName}
                    </span>
                    <span className="text-[#9CA3AF] text-xs ml-2">
                      Au submit, tu pourras envoyer une invitation.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinkedToExisting(null)}
                    className="text-[#9CA3AF] hover:text-white text-xs"
                  >
                    Délier
                  </button>
                </div>
              </div>
            )}

            <p className="text-[12px] text-[#4a4d56] mt-1.5">Tape l&apos;email — si l&apos;athlète a déjà un compte Nexus, des suggestions s&apos;afficheront. Jamais partagé aux recruteurs.</p>
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
            {infoRow("Position", sports.primaryPosition)}
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
            <NxSelect value={submission.recruitingStatus} onChange={(v) => { updateSubmission("recruitingStatus", v); }}
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
          audience="coach"
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

        {/* #48 — lien de claim pour l'athlète qu'on vient de créer (orphelin).
            Même RPC + même InvitationLinkModal que la fiche athlète. */}
        {createdAthleteId && (
          <div className="mb-6 space-y-3">
            {/* PRIMAIRE — envoyer l'invitation par courriel (action par défaut). */}
            <div>
              <button type="button" onClick={handleSendInviteEmail}
                disabled={emailInviting || !form.identity.email}
                className="inline-flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 disabled:cursor-not-allowed text-black font-head font-bold text-[12px] uppercase tracking-widest rounded-lg px-6 py-3 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></svg>
                {emailInviting ? "Envoi…" : (form.identity.email ? `Envoyer à ${form.identity.email}` : "Envoyer l'invitation par courriel")}
              </button>
              {!form.identity.email && (
                <p className="text-[12px] text-[#6b7280] mt-2">Ajoute un courriel à l&apos;athlète pour envoyer l&apos;invitation directement.</p>
              )}
              {emailInviteResult && (
                <p className={`text-[13px] font-semibold mt-2 ${emailInviteResult.ok ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                  {emailInviteResult.ok ? "✓ " : ""}{emailInviteResult.msg}
                </p>
              )}
            </div>

            {/* SECONDAIRE — lien à partager manuellement (SMS, en personne). */}
            <div>
              <button type="button" onClick={handleGenerateInviteLink} disabled={generatingLink}
                className="text-[12px] font-semibold text-[#9CA3AF] hover:text-white underline underline-offset-2 disabled:opacity-60 transition-colors">
                {generatingLink ? "Génération…" : "Ou générer un lien à partager (SMS, en personne)"}
              </button>
              {linkError && <p className="text-[12px] text-[#EF4444] mt-1">{linkError}</p>}
            </div>
          </div>
        )}

        <button type="button" onClick={() => { setSubmitted(false); setForm(INITIAL_FORM); setCurrentStep(1); setCompletedSteps(new Set()); setCreatedAthleteId(null); setClaimLink(null); setLinkError(null); }}
          className="bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-bold text-[12px] uppercase tracking-widest rounded-lg px-6 py-3 transition-colors">
          Créer un autre profil
        </button>

        {claimLink && (
          <InvitationLinkModal
            link={claimLink}
            onClose={() => setClaimLink(null)}
            description="Envoie ce lien à l'athlète. Il pourra créer son compte et compléter son profil."
          />
        )}
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

  // 6.2.c-2 : si un athlete existant est sélectionné, on remplace
  // entièrement le form par une card invitation. Le coach n'a pas à
  // créer l'identité — il envoie juste une invitation à rejoindre
  // son équipe. Le lien "Choisir un autre athlète" restore l'état
  // form pré-clic via formStateBeforeLink.
  if (linkedToExisting) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 text-[14px] text-[#6b7280] mb-8">
          <span className="font-bold text-[#8a8d96]">Nexus</span><span>/</span><span>Coach</span><span>/</span><span className="text-white">Inviter un athlète</span>
        </div>

        <div className="mb-8">
          <h1 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Inviter {linkedToExisting.firstName} {linkedToExisting.lastName}
          </h1>
          <p className="text-[15px] text-[#6b7280] mt-2">
            {linkedToExisting.hasAccount ? "Compte Nexus existant détecté" : "Profil déjà créé — invitation par courriel"}
          </p>
        </div>

        <div className="rounded-2xl bg-[#1A1D24] border border-[#E63946]/30 p-6 space-y-4">
          {/* Header avec icon + identity */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E63946]/10 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">
                {linkedToExisting.hasAccount
                  ? `${linkedToExisting.firstName} ${linkedToExisting.lastName} existe déjà sur Nexus`
                  : `${linkedToExisting.firstName} ${linkedToExisting.lastName} — profil déjà créé`}
              </h3>
              <p className="text-sm text-[#9CA3AF] mt-0.5">{linkedToExisting.email}</p>
            </div>
          </div>

          {/* Message principal */}
          <div className="bg-[#111317] rounded-lg p-4">
            <p className="text-sm text-[#c0c4cc]">
              {linkedToExisting.hasAccount
                ? "Tu dois attendre que cet athlète accepte ton invitation avant de pouvoir voir son profil et l'évaluer. Une fois qu'il accepte, il sera ajouté à ton équipe automatiquement."
                : "Cet athlète a déjà un profil chez toi mais n'a pas encore réclamé son compte. En l'invitant, il recevra un courriel avec un lien pour créer son compte et récupérer son profil."}
            </p>
          </div>

          {/* Team selector si 2+ teams (uniquement athlète avec compte → équipe) */}
          {linkedToExisting.hasAccount && coachTeam.teams.length > 1 && (
            <div>
              <label className="block text-xs font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-2">
                Inviter sur quelle équipe ?
              </label>
              <select
                value={invitationTeamId ?? ""}
                onChange={(e) => setInvitationTeamId(e.target.value || null)}
                className="w-full bg-[#111317] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-white text-[14px] focus:outline-none focus:border-[#E63946]/50"
                title="Équipe d'invitation"
              >
                <option value="">Sélectionne une équipe</option>
                {coachTeam.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Team auto-selected (1 team) */}
          {linkedToExisting.hasAccount && coachTeam.teams.length === 1 && invitationTeamId && (
            <div className="text-sm text-[#9CA3AF]">
              Équipe : <span className="text-white font-semibold">{coachTeam.teams[0].name}</span>
            </div>
          )}

          {/* Warning si autre invitation PENDING */}
          {otherPendingCount > 0 && (
            <div className="p-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30">
              <p className="text-sm text-[#F59E0B]">
                ⚠ Cet athlète a déjà {otherPendingCount === 1 ? "1 invitation" : `${otherPendingCount} invitations`} en attente d&apos;un autre coach.
                Il pourra choisir laquelle accepter.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleUnlinkAndRestoreForm}
              className="text-sm text-[#9CA3AF] hover:text-white transition-colors"
            >
              ← Choisir un autre athlète
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={linkedToExisting.hasAccount && !invitationTeamId}
              className={`px-6 py-2.5 rounded-lg font-head font-bold text-[14px] uppercase tracking-widest transition-colors ${
                !linkedToExisting.hasAccount || invitationTeamId
                  ? "bg-[#E63946] hover:bg-[#D42B22] text-white"
                  : "bg-[#2a2d36] text-[#6b7280] cursor-not-allowed"
              }`}
            >
              {linkedToExisting.hasAccount ? "Envoyer l’invitation" : "Envoyer par courriel"}
            </button>
          </div>
        </div>

        {/* Modal de confirmation */}
        {showConfirmModal && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center px-4"
            onClick={() => !isSubmittingInvitation && setShowConfirmModal(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative bg-[#1A1D24] border border-[#E63946]/30 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-2">Confirmer l&apos;invitation</h3>

              <p className="text-sm text-[#c0c4cc] mb-4">
                Envoyer une invitation à{" "}
                <span className="font-semibold text-white">
                  {linkedToExisting.firstName} {linkedToExisting.lastName}
                </span>{" "}
                ({linkedToExisting.email}) ?
              </p>

              <p className="text-xs text-[#9CA3AF] mb-6">
                {linkedToExisting.hasAccount
                  ? "Il recevra une notification et pourra accepter ou décliner."
                  : "Il recevra un courriel avec un lien pour créer son compte et récupérer son profil."}
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmittingInvitation}
                  className="px-4 py-2 rounded-lg text-sm text-[#9CA3AF] hover:text-white transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSendInvitation}
                  disabled={isSubmittingInvitation}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${
                    isSubmittingInvitation
                      ? "bg-[#2a2d36] text-[#6b7280]"
                      : "bg-[#E63946] hover:bg-[#D42B22] text-white"
                  }`}
                >
                  {isSubmittingInvitation ? "Envoi..." : "Envoyer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <ReadOnlyIfPending>
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

    {/* Cote-A : cote-change confirmation modal. Shared ConfirmSheet.
        For create, onConfirm sets coteConfirmedRef + retriggers
        handleSubmit so the save proceeds. */}
    <ConfirmSheet
      open={coteConfirmOpen}
      onClose={() => setCoteConfirmOpen(false)}
      title="Tu es sur le point de changer la cote"
      message="Confirmes-tu que c'est exact selon l'échelle Nexus ?"
      confirmLabel="Oui, continuer"
      variant="warning"
      onConfirm={() => {
        coteConfirmedRef.current = true;
        setCoteConfirmOpen(false);
        handleSubmit();
      }}
      extra={<CoteChangeConfirmContent newCote={pendingCote.newCote} originalCote={pendingCote.originalCote} />}
    />
    </ReadOnlyIfPending>
  );
}
