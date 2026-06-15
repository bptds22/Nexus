"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteWizardMobile — Coach Athlete CREATE + EDIT (unified)

   Native-feel profile editor (NOT a web wizard).

   Navigation model
   ────────────────
   - Chip header is the ONLY way to jump between sections (free-jump
     in edit ; reachableSlides gating still applies on create's
     forward jumps, back is always free).
   - NO "Continuer" button. ONE persistent bottom button on every
     slide : "Enregistrer" (edit) / "Créer le profil" (create).
   - Tapping it opens a SUMMARY POPUP (bottom sheet, portaled) :
       edit   → shows ONLY the diff vs the baseline loaded at mount.
       create → shows a full grouped summary + a "Champs requis
                manquants" block ; the consent toggle lives there.
   - Step 7 (Révision) is gone. The popup replaces it. Parental +
     partner-visibility consent on create are surfaced inside the
     popup (legally required → blocks confirm until set).

   Field rendering
   ───────────────
   - Sections are CARDS containing inline ROWS (label LEFT, value
     RIGHT, hairline divider). Text rows use tap-to-edit-inline.
     Picker/date/search rows show a chevron and open MobilePicker /
     SearchSheet.
   - No more Simplifié/Détaillé toggle on steps 1-4, 6. Advanced
     fields appear under a "Détails supplémentaires" divider in a
     second card and carry a small DÉTAILLÉ tag on their label.
     ⚠️ Detailed-only required fields (gender, school, city/region,
     team) are NOW REQUIRED unconditionally (they're always visible).
     canProceed reflects this.
   - Step 5 (Évaluation) KEEPS its Simplifié | Détaillé toggle
     because it changes save semantics (cote_globale auto-average).
   - Step 1 carries a small footer note that plants the green/yellow/
     red permission color seed (cosmetic, matches athlete edit page).

   Untouched
   ─────────
   - saveAthlete.ts (cote auto-average, consent guard, verbs).
   - The athlete edit page, profile, onboarding wizards.
   - field classifications, suggestion flow — deferred.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { MobileWheelPicker } from "@/components/mobile/MobileWheelPicker";
import { SearchSheet } from "@/components/mobile/SearchSheet";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { isValidationDue, isValidationExpired, formatDeadlineFr } from "@/lib/utils/profileValidation";
import { SESSION_KEY_PREFIX } from "@/lib/platform/mobileRoutes";
import PartnerVisibilityConsentCard from "@/components/shared/PartnerVisibilityConsentCard";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import {
  Card,
  InlineEditRow,
  PickerRow,
  DateRow,
  ReadOnlyRow,
  ToggleRow,
  ChipsBlock,
  TagInputRow,
  MediaUrlRow,
  DetailedTag,
} from "@/components/shared/wizard/rows";
import { labelCls, valueCls } from "@/components/shared/wizard/tokens";
import {
  BADGE_CONFIG, BADGE_ORDER, MAX_BADGES, MAX_DETAIL_LENGTH,
  getSportStats,
  type DistinctionEntry,
} from "@/lib/config/badges";
import { POSITIONS } from "@/lib/sports-data";
import {
  autocompleteOrphanAthletesByEmail,
  type AthleteEmailAutocompleteResult,
  type AthleteEmailSuggestion,
} from "@/lib/coach/athleteEmailAutocomplete";
import { loadAthleteRaw, buildFormFromRaw } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import {
  emptyAthleteForm,
  type AthleteFormData,
} from "@/app/coach/athletes/_data/wizardFormShape";
import {
  saveAthleteCreate,
  saveAthleteEdit,
} from "@/app/coach/athletes/_data/saveAthlete";

/* ── Haptics helper (matches onboarding shells) ─────────────── */
async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (intensity === "Medium") {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch { /* no-op */ }
}

/* ── Constantes ───────────────────────────────────────────────── */

const SPORTS = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball",
  "Athlétisme", "Flag football", "Rugby", "Cheerleading",
  "Natation", "Badminton", "Cross-country", "Futsal",
  "Baseball", "Ultimate frisbee", "Autre",
];

const SUBJECTS = [
  "Éducation physique", "Mathématiques", "Sciences", "Français",
  "Anglais", "Histoire", "Arts", "Informatique",
];

const CEGEP_REGIONS = [
  "Montréal", "Québec", "Laurentides", "Lanaudière",
  "Montérégie", "Outaouais", "Estrie", "Sherbrooke",
];

const TRAIT_GROUPS: { title: string; traits: { key: string; label: string }[] }[] = [
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

const RECRUITMENT_STATUS_OPTIONS: PickerOption[] = [
  { value: "OUVERT", label: "Ouvert" },
  { value: "EN_PROCESSUS", label: "En processus" },
  { value: "RECRUTE", label: "Recruté" },
  { value: "RETIRE", label: "Retiré" },
];

const RECRUITING_OVERRIDE_OPTIONS: PickerOption[] = [
  { value: "", label: "— Aucune —" },
  { value: "IDENTIFIE", label: "Identifié" },
  { value: "CONTACTE", label: "Contacté" },
  { value: "EN_DISCUSSION", label: "En discussion" },
  { value: "VISITE_PLANIFIEE", label: "Visite planifiée" },
  { value: "ENGAGE", label: "Engagé" },
  { value: "LETTRE_SIGNEE", label: "Lettre signée" },
];

/* ── Tokens ─────────────────────────────────────────────────── */
// labelCls + valueCls moved to components/shared/wizard/tokens (Sprint A).
// Imported above ; still consumed by DualPickerRow below.

/* ── Types ───────────────────────────────────────────────────── */

type SchoolRow = { id: string; name: string; city: string | null; region: string | null };
type CoachTeam = {
  id: string; name: string; level: string; division: string;
  sport: string; league: string; gender: "M" | "F";
};
type CoachContext = {
  schoolId: string | null;
  school: string;
  city: string;
  region: string;
  teams: CoachTeam[];
};

export interface AthleteWizardMobileProps {
  mode: "create" | "edit";
  /** Required when mode="edit". */
  athleteId?: string;
}

const TOTAL_SLIDES = 6;
const SLIDE_LABELS = ["Identité", "Académique", "Physique", "Sport", "Évaluation", "Médias"];

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */

export default function AthleteWizardMobile({ mode, athleteId }: AthleteWizardMobileProps) {
  const router = useRouter();
  const toast = useMobileToast();
  const isCreate = mode === "create";
  const isEdit = mode === "edit";

  /* ── Core state ──────────────────────────────────────────── */
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [form, setForm] = useState<AthleteFormData>(emptyAthleteForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [mounted, setMounted] = useState(false);

  /* ── Coach context + schools/teams ───────────────────────── */
  const [coach, setCoach] = useState<CoachContext>({ schoolId: null, school: "", city: "", region: "", teams: [] });
  const [cegepSchools, setCegepSchools] = useState<SchoolRow[]>([]);

  /* ── Edit-only recruitment block state ───────────────────── */
  const [recruitmentStatus, setRecruitmentStatus] = useState("OUVERT");
  const [committedSchoolId, setCommittedSchoolId] = useState("");
  const [committedSchoolName, setCommittedSchoolName] = useState("");
  const openToOffersRef = useRef<boolean | null>(null);
  const consentBaselineRef = useRef<boolean>(false);

  /* ── Diff baseline (edit). Captured from the DB-built form so
     the save-summary popup can show "only what changed". */
  const baselineFormRef = useRef<AthleteFormData>(emptyAthleteForm());

  /* ── Summary popup (replaces Step 7) ─────────────────────── */
  const [showSummarySheet, setShowSummarySheet] = useState(false);

  /* ── CREATE-only : orphan-email autocomplete + invite flow ─ */
  const [emailAutocomplete, setEmailAutocomplete] = useState<AthleteEmailAutocompleteResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [linkedToExisting, setLinkedToExisting] = useState<AthleteEmailSuggestion | null>(null);
  const [invitationTeamId, setInvitationTeamId] = useState<string | null>(null);
  const [isSubmittingInvitation, setIsSubmittingInvitation] = useState(false);
  const emailAutocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Picker / sheet open state ───────────────────────────── */
  const [openSportPicker, setOpenSportPicker] = useState(false);
  const [openSecondarySportPicker, setOpenSecondarySportPicker] = useState(false);
  const [openGenderPicker, setOpenGenderPicker] = useState(false);
  const [openPromoPicker, setOpenPromoPicker] = useState(false);
  // Height ft/in are now driven by a single MobileWheelPicker — old
  // openHeightFtPicker / openHeightInPicker states removed.
  const [openDominantHandPicker, setOpenDominantHandPicker] = useState(false);
  const [openDominantFootPicker, setOpenDominantFootPicker] = useState(false);
  const [openPrimaryPosPicker, setOpenPrimaryPosPicker] = useState(false);
  const [openSecondaryPosPicker, setOpenSecondaryPosPicker] = useState(false);
  const [openRecruitmentStatusPicker, setOpenRecruitmentStatusPicker] = useState(false);
  const [openRecruitingOverridePicker, setOpenRecruitingOverridePicker] = useState(false);
  const [openCegepPicker, setOpenCegepPicker] = useState(false);
  const [openTeamPicker, setOpenTeamPicker] = useState(false);
  const [openInviteTeamPicker, setOpenInviteTeamPicker] = useState(false);
  const [openCegepTypePicker, setOpenCegepTypePicker] = useState(false);
  const [openHeightWheel, setOpenHeightWheel] = useState(false);
  const [openWeightWheel, setOpenWeightWheel] = useState(false);

  /* ── Distinction popup (replaces the old under-grid detail blocks) ─
     `openDistinctionSheet` holds the badge key currently being edited,
     or null. */
  const [openDistinctionSheet, setOpenDistinctionSheet] = useState<string | null>(null);

  /* ── Unit mode (UI-side only — storage stays imperial via converters
     at the wheel's onCommit boundary). Persisted to localStorage so the
     user's preference survives navigation. */
  const [unitMode, setUnitMode] = useState<"imperial" | "metric">("imperial");
  useEffect(() => {
    try {
      const v = localStorage.getItem("nx_wizard_unit_mode");
      if (v === "metric" || v === "imperial") setUnitMode(v);
    } catch { /* no-op */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("nx_wizard_unit_mode", unitMode); } catch { /* no-op */ }
  }, [unitMode]);

  /* ── Monthly re-validation state (edit only). Captured from the raw
     athlete at load time ; informational banner on Step 1. */
  const [validationState, setValidationState] = useState<{
    verified: boolean;
    last_profile_validation: string | null;
  }>({ verified: false, last_profile_validation: null });

  const [cegepSearch, setCegepSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");

  /* ── Mount fade ─────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 16);
    return () => clearTimeout(t);
  }, []);

  /* ── Load coach context + (edit) athlete pre-fill ────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("school_id, schools!school_id(name, city, region)")
        .eq("id", user.id)
        .single();

      const schoolId = (profile?.school_id as string | null) ?? null;
      const schoolRel = (profile as { schools?: unknown } | null)?.schools;
      const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string; city?: string; region?: string } | null;

      let teams: CoachTeam[] = [];
      if (schoolId) {
        const { data: teamsRows } = await supabase
          .from("teams")
          .select("id, name, division, league, age_group, season, sport_id, sports!sport_id(nom)")
          .eq("school_id", schoolId)
          .eq("is_active", true);
        teams = (teamsRows ?? []).map((t) => {
          const sportRel = (t as { sports?: unknown }).sports;
          const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
          const level = [(t as { age_group?: string }).age_group, (t as { division?: string }).division].filter(Boolean).join(" ");
          return {
            id: (t as { id: string }).id,
            name: ((t as { name?: string }).name) || "",
            level: level || "",
            division: ((t as { division?: string }).division) || "",
            sport: sport?.nom || "",
            league: ((t as { league?: string }).league) || "RSEQ",
            gender: "M" as "M" | "F",
          };
        });
      }

      if (cancelled) return;
      setCoach({
        schoolId,
        school: school?.name || "",
        city: school?.city || "",
        region: school?.region || "",
        teams,
      });

      // Pre-seed coach school on form (read-only chip on Identité card)
      setForm((prev) => ({
        ...prev,
        identity: {
          ...prev.identity,
          school: school?.name || prev.identity.school,
          city: school?.city || prev.identity.city,
          region: school?.region || prev.identity.region,
        },
      }));

      if (isEdit) {
        const { data: cegepRows } = await supabase
          .from("schools")
          .select("id, name, city, region")
          .eq("type", "CEGEP")
          .order("name");
        if (!cancelled && cegepRows) setCegepSchools(cegepRows as SchoolRow[]);
      }

      if (isEdit) {
        if (!athleteId || athleteId === "placeholder") {
          if (!cancelled) {
            toast.error({ message: "Impossible de charger l'athlète — rouvre depuis sa fiche" });
            setLoading(false);
          }
          return;
        }
        const { data, error } = await loadAthleteRaw(athleteId);
        if (error || !data) {
          if (!cancelled) {
            toast.error({ message: "Impossible de charger l'athlète" });
            setLoading(false);
          }
          return;
        }
        const raw = data as Record<string, unknown>;
        const formFromDB = buildFormFromRaw(raw) as unknown as AthleteFormData;
        const finalForm: AthleteFormData = { ...formFromDB, partnerVisibilityConsent: false };
        if (cancelled) return;
        setForm(finalForm);
        baselineFormRef.current = finalForm;

        if (raw.recruitment_status) setRecruitmentStatus(raw.recruitment_status as string);
        if (raw.committed_school_id) setCommittedSchoolId(raw.committed_school_id as string);
        const cs = raw.committed_school as { name?: string } | { name?: string }[] | null;
        const csObj = Array.isArray(cs) ? cs[0] : cs;
        if (csObj?.name) setCommittedSchoolName(csObj.name);
        openToOffersRef.current = (raw.open_to_offers as boolean | null) ?? null;
        consentBaselineRef.current = !!(raw.consentement_parental);

        // Monthly re-validation banner inputs (Step 1, informational)
        setValidationState({
          verified: !!(raw.verified),
          last_profile_validation: (raw.last_profile_validation as string) || null,
        });

        const taRel = raw.team_athletes as unknown;
        const ta = (Array.isArray(taRel) ? taRel[0] : taRel) as { team_id?: string } | null;
        const currentTeamId = ta?.team_id;
        if (currentTeamId) {
          const matched = teams.find((t) => t.id === currentTeamId);
          if (matched) {
            setForm((prev) => {
              const next: AthleteFormData = {
                ...prev,
                sports: {
                  ...prev.sports,
                  selectedTeamId: matched.id,
                  currentTeam: matched.name,
                  teamLevel: matched.level,
                  teamDivision: matched.division,
                  league: matched.league,
                },
              };
              // Update baseline too so the team auto-selection isn't shown as a diff.
              baselineFormRef.current = next;
              return next;
            });
          }
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, athleteId]);

  /* ── Email autocomplete (CREATE only) ────────────────────── */
  const handleEmailChange = useCallback((newEmail: string) => {
    setForm((prev) => ({ ...prev, identity: { ...prev.identity, email: newEmail } }));
    if (!isCreate) return;
    if (linkedToExisting) setLinkedToExisting(null);
    if (emailAutocompleteTimerRef.current) clearTimeout(emailAutocompleteTimerRef.current);
    if (newEmail.trim().length < 4) {
      setEmailAutocomplete(null);
      setShowSuggestions(false);
      return;
    }
    emailAutocompleteTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createClient();
        const result = await autocompleteOrphanAthletesByEmail(supabase, newEmail);
        setEmailAutocomplete(result);
        setShowSuggestions(result.status === "ok" && result.suggestions.length > 0);
      } catch (err) {
        console.error("[EmailAutocomplete] lookup error:", err);
      }
    }, 300);
  }, [isCreate, linkedToExisting]);

  useEffect(() => () => {
    if (emailAutocompleteTimerRef.current) clearTimeout(emailAutocompleteTimerRef.current);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: AthleteEmailSuggestion) => {
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
    if (coach.teams.length === 1) setInvitationTeamId(coach.teams[0].id);
    triggerHaptic("Light");
  }, [coach.teams]);

  const handleSendInvitation = useCallback(async () => {
    if (!linkedToExisting || !invitationTeamId) return;
    setIsSubmittingInvitation(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("team_invitations").insert({
        team_id: invitationTeamId,
        athlete_id: linkedToExisting.athleteId,
        invited_by_coach_id: user.id,
        status: "PENDING",
        expires_at: expiresAt,
      });
      if (error) {
        toast.error({ message: "Erreur lors de l'envoi", detail: error.message });
        setIsSubmittingInvitation(false);
        return;
      }
      triggerHaptic("Medium");
      toast.success({ message: `Invitation envoyée à ${linkedToExisting.firstName}` });
      router.push("/coach/athletes");
    } catch (err) {
      console.error("[Invitation] Unexpected error:", err);
      toast.error({ message: "Erreur inattendue" });
      setIsSubmittingInvitation(false);
    }
  }, [linkedToExisting, invitationTeamId, router, toast]);

  /* ── Photo upload ─────────────────────────────────────────── */
  const handlePhotoChange = useCallback(async (file: File | null) => {
    if (!file) return;
    setPhotoUploading(true);
    const local = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, identity: { ...prev.identity, photo: local } }));
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhotoUploading(false); return; }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) {
        console.error("Photo upload error:", upErr);
        toast.error({ message: "Échec du téléversement de la photo" });
        setPhotoUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((prev) => ({ ...prev, identity: { ...prev.identity, photo: urlData.publicUrl } }));
    } finally {
      setPhotoUploading(false);
    }
  }, [toast]);

  /* ── Updaters ─────────────────────────────────────────────── */
  const updateIdentity = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, identity: { ...prev.identity, [field]: value } }));
  }, []);
  const updateAcademic = useCallback((field: string, value: string | string[] | boolean) => {
    setForm((prev) => ({ ...prev, academic: { ...prev.academic, [field]: value } }));
  }, []);
  const updatePhysical = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, physical: { ...prev.physical, [field]: value } }));
  }, []);
  const updateSports = useCallback((field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, sports: { ...prev.sports, [field]: value } }));
  }, []);
  const updateMedia = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, media: { ...prev.media, [field]: value } }));
  }, []);
  const updateScouting = useCallback(
    (field: string, value: string | number | DistinctionEntry[] | Record<string, number>) => {
      setForm((prev) => ({ ...prev, scouting: { ...prev.scouting, [field]: value } }));
    },
    [],
  );
  const updateSubmission = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, submission: { ...prev.submission, [field]: value } }));
  }, []);

  /* ── Badges ─────────────────────────────────────────────── */
  function toggleBadge(badgeKey: string) {
    const cur = form.scouting.badges;
    const idx = cur.findIndex((b) => b.badge === badgeKey);
    if (idx >= 0) {
      updateScouting("badges", cur.filter((_, i) => i !== idx));
    } else if (cur.length < MAX_BADGES) {
      updateScouting("badges", [...cur, { badge: badgeKey }]);
    }
  }
  function updateBadgeDetail(badgeKey: string, detail: string) {
    const next: DistinctionEntry[] = form.scouting.badges.map((b) =>
      b.badge === badgeKey ? { ...b, detail: detail || undefined } : b
    );
    updateScouting("badges", next);
  }
  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
  }

  /* ── Validation (no mode gates : detailed-only required fields
     are now always required because they're always visible) ──── */
  const canProceed = useCallback((currentSlide: number): boolean => {
    const step = currentSlide + 1;
    switch (step) {
      case 1: {
        const d = form.identity;
        const base = !!(d.firstName && d.lastName && d.dateOfBirth && d.gradYear && d.gender && d.school);
        return isCreate ? base && !!d.city && !!d.region : base;
      }
      case 4: {
        const s = form.sports;
        return !!(s.primarySport && s.primaryPosition && s.jerseyNumber && (s.selectedTeamId || s.currentTeam));
      }
      default: return true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isCreate]);

  /* ── Missing-required list for the create summary popup ──── */
  const missingRequiredAll = useCallback((): string[] => {
    const missing: string[] = [];
    const i = form.identity;
    if (!i.firstName) missing.push("Prénom");
    if (!i.lastName) missing.push("Nom");
    if (!i.dateOfBirth) missing.push("Date de naissance");
    if (!i.gradYear) missing.push("Promotion");
    if (!i.gender) missing.push("Genre");
    if (!i.school) missing.push("École");
    if (isCreate) {
      if (!i.city) missing.push("Ville");
      if (!i.region) missing.push("Région");
    }
    const s = form.sports;
    if (!s.primarySport) missing.push("Sport principal");
    if (!s.primaryPosition) missing.push("Position principale");
    if (!s.jerseyNumber) missing.push("Numéro");
    if (!s.selectedTeamId && !s.currentTeam) missing.push("Équipe");
    if (isCreate && !form.parentalConsent) missing.push("Consentement parental");
    return missing;
  }, [form, isCreate]);

  /* ── Diff (edit summary) ─────────────────────────────────── */
  const computeDiff = useCallback((): { label: string; old: string; new: string }[] => {
    const rows: { label: string; old: string; new: string }[] = [];
    const f = form, b = baselineFormRef.current;
    const push = (label: string, fv: unknown, bv: unknown) => {
      const a = fv == null || fv === "" ? "" : String(fv);
      const c = bv == null || bv === "" ? "" : String(bv);
      if (a !== c) rows.push({ label, old: c || "—", new: a || "—" });
    };
    push("Prénom", f.identity.firstName, b.identity.firstName);
    push("Nom", f.identity.lastName, b.identity.lastName);
    push("Date de naissance", f.identity.dateOfBirth, b.identity.dateOfBirth);
    push("Promotion", f.identity.gradYear, b.identity.gradYear);
    push("Genre", f.identity.gender, b.identity.gender);
    push("Téléphone", f.identity.phone, b.identity.phone);
    push("Courriel", f.identity.email, b.identity.email);
    push("Nom du parent", f.identity.parentName, b.identity.parentName);
    push("Téléphone parent", f.identity.parentPhone, b.identity.parentPhone);
    push("Photo", f.identity.photo, b.identity.photo);

    push("Moyenne", f.academic.gpa, b.academic.gpa);
    push("Programme CÉGEP", f.academic.cegepType, b.academic.cegepType);
    push("Programme — détail", f.academic.cegepProgramDetail, b.academic.cegepProgramDetail);
    push("CÉGEP privé", f.academic.openToPrivate, b.academic.openToPrivate);
    push("CÉGEP anglophone", f.academic.openToAnglophone, b.academic.openToAnglophone);
    push("Prêt à changer de région", f.academic.openToRelocate, b.academic.openToRelocate);
    push("Matières fortes", (f.academic.strongSubjects || []).join(", "), (b.academic.strongSubjects || []).join(", "));
    push("Mentions", (f.academic.academicHonors || []).join(", "), (b.academic.academicHonors || []).join(", "));
    push("Régions préférées", (f.academic.cegepRegions || []).join(", "), (b.academic.cegepRegions || []).join(", "));

    push("Taille (pi)", f.physical.heightFeet, b.physical.heightFeet);
    push("Taille (po)", f.physical.heightInches, b.physical.heightInches);
    push("Poids", f.physical.weightLbs, b.physical.weightLbs);
    push("Envergure", f.physical.wingspan, b.physical.wingspan);
    push("Taille mains", f.physical.handSize, b.physical.handSize);
    push("Main dominante", f.physical.dominantHand, b.physical.dominantHand);
    push("Pied dominant", f.physical.dominantFoot, b.physical.dominantFoot);
    push("40 verges", f.physical.fortyYard, b.physical.fortyYard);
    push("Saut vertical", f.physical.verticalJump, b.physical.verticalJump);
    push("Saut en longueur", f.physical.broadJump, b.physical.broadJump);
    push("Développé couché", f.physical.benchPress, b.physical.benchPress);
    push("Navette agilité", f.physical.shuttleAgility, b.physical.shuttleAgility);
    push("Sprint 100m", f.physical.sprint100m, b.physical.sprint100m);

    push("Sport principal", f.sports.primarySport, b.sports.primarySport);
    push("Position", f.sports.primaryPosition, b.sports.primaryPosition);
    push("Position secondaire", f.sports.secondaryPosition, b.sports.secondaryPosition);
    push("Sport secondaire", f.sports.secondarySport, b.sports.secondarySport);
    push("Numéro", f.sports.jerseyNumber, b.sports.jerseyNumber);
    push("Équipe", f.sports.currentTeam, b.sports.currentTeam);
    push("Ouvert entraîneur CÉGEP", f.sports.openToCoaching, b.sports.openToCoaching);

    push("Cote étoile", f.scouting.starRating, b.scouting.starRating);
    push("Rapport coach", f.scouting.coachEndorsement, b.scouting.coachEndorsement);
    push("Distinctions", f.scouting.badges.map((x) => x.badge).join(","), b.scouting.badges.map((x) => x.badge).join(","));
    // Trait deltas — collapse into a single "Traits modifiés"
    const traitChanges = Object.keys({ ...f.scouting.traitRatings, ...b.scouting.traitRatings })
      .filter((k) => (f.scouting.traitRatings[k] || 0) !== (b.scouting.traitRatings[k] || 0));
    if (traitChanges.length > 0) {
      rows.push({ label: "Traits modifiés", old: "", new: `${traitChanges.length} changement${traitChanges.length > 1 ? "s" : ""}` });
    }

    push("Vidéo faits saillants", f.media.highlightVideo, b.media.highlightVideo);
    push("Hudl", f.media.hudlLink, b.media.hudlLink);
    push("YouTube", f.media.youtubeLink, b.media.youtubeLink);
    push("Instagram", f.media.instagramLink, b.media.instagramLink);
    push("Match complet", f.media.fullGameVideo, b.media.fullGameVideo);
    push("Entraînement", f.media.trainingVideo, b.media.trainingVideo);

    push("Statut (override)", f.submission.recruitingStatus, b.submission.recruitingStatus);

    return rows;
  }, [form]);

  /* ── Navigation — back arrow EXITs the wizard ────────────────
     Previously this decremented `slide`, so at non-first steps it
     stepped through pages instead of exiting. Chips are now the
     only step-to-step nav ; the back arrow is exit-only.

     • CREATE → /coach/athletes (roster)
     • EDIT   → /coach/athletes/<athleteId> via the canonical
                Capacitor stash-then-push-placeholder pattern
                (matches the "Modifier le profil" CTA in the
                profile body). Without the stash, the placeholder
                shell would receive id="placeholder" and the
                profile load would fail. */
  const goBack = useCallback(() => {
    triggerHaptic("Light");
    if (isCreate) {
      router.push("/coach/athletes");
      return;
    }
    if (athleteId) {
      try {
        sessionStorage.setItem(`${SESSION_KEY_PREFIX}id`, athleteId);
      } catch { /* no-op : sessionStorage may be unavailable in some webviews */ }
      router.push("/coach/athletes/placeholder/");
    } else {
      router.push("/coach/athletes");
    }
  }, [isCreate, athleteId, router]);

  /* ── Submit (called from summary popup confirm) ──────────── */
  const handleFinish = useCallback(async () => {
    const missing = missingRequiredAll();
    if (isCreate && missing.length > 0) {
      toast.warning({ message: "Champs requis manquants" });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error({ message: "Session expirée — reconnecte-toi" });
      setSaving(false);
      return;
    }

    const result = isCreate
      ? await saveAthleteCreate(supabase, form, user.id, { coachSchoolId: coach.schoolId })
      : await saveAthleteEdit(supabase, athleteId!, form, user.id, {
          consentBaseline: consentBaselineRef.current,
          openToOffers: openToOffersRef.current,
          recruitmentStatus,
          committedSchoolId,
        });
    if (result.error) {
      toast.error({
        message: isCreate ? "Erreur lors de la création" : "Erreur lors de la sauvegarde",
        detail: result.error.message,
      });
      setSaving(false);
      return;
    }
    const savedId = result.id ?? athleteId ?? "";

    triggerHaptic("Medium");
    toast.success({ message: isCreate ? "Profil créé" : "Profil enregistré" });
    setSaving(false);
    setShowSummarySheet(false);
    router.push(isCreate ? "/coach/athletes" : `/coach/athletes/${savedId}`);
  }, [
    isCreate, form, athleteId, recruitmentStatus, committedSchoolId, coach.schoolId,
    router, toast, missingRequiredAll,
  ]);

  /* ── Chip-row navigation hooks (top-level, never below an
     early return — prior rules-of-hooks fix) ──────────────── */
  const reachableSlides = useMemo(() => {
    if (isEdit) return Array(TOTAL_SLIDES).fill(true);
    return Array.from({ length: TOTAL_SLIDES }, (_, i) =>
      Array.from({ length: i }, (_, k) => canProceed(k)).every(Boolean)
    );
  }, [isEdit, canProceed]);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [slide]);

  /* ── Derived picker option sets ─────────────────────────── */
  const primaryPositions = useMemo(() => {
    const sport = form.sports.primarySport;
    const list = (sport && POSITIONS[sport]) ? POSITIONS[sport] : [];
    return list.map((p) => ({ value: p.abbr, label: `${p.abbr} — ${p.label}` }));
  }, [form.sports.primarySport]);

  const visibleCegep = useMemo(() => {
    const q = cegepSearch.trim().toLowerCase();
    if (!q) return cegepSchools.slice(0, 60);
    return cegepSchools.filter((s) =>
      s.name.toLowerCase().includes(q) || (s.city || "").toLowerCase().includes(q)
    ).slice(0, 60);
  }, [cegepSchools, cegepSearch]);

  const visibleTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return coach.teams;
    return coach.teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [coach.teams, teamSearch]);

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111317] text-white flex items-center justify-center">
        <p className="text-[14px] text-[#6b7280]">Chargement…</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#111317] text-white flex flex-col"
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 400ms ease-out" }}
    >
      {/* Sticky header — row1 (back + title), row2 (chip row) */}
      <div
        className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center px-4 pt-2 gap-2 min-h-[56px]">
          <button type="button" onClick={goBack} aria-label="Retour"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/40">
              Étape {slide + 1} / {TOTAL_SLIDES}
            </p>
            <p className="text-[15px] font-bold text-white truncate">
              {isCreate ? "Créer un profil" : `Modifier${form.identity.firstName ? " — " + form.identity.firstName : ""}`}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto px-4 pt-1 pb-3 nx-no-scrollbar">
          <div className="flex items-center gap-2">
            {SLIDE_LABELS.map((label, i) => {
              const isCurrent = i === slide;
              const reachable = i <= slide || isEdit || reachableSlides[i];
              const done = i < slide && canProceed(i);
              const chipCls = isCurrent
                ? "bg-[#E63946] text-white"
                : done
                  ? "bg-white/[0.10] text-white border border-white/[0.10]"
                  : reachable
                    ? "bg-[#1A1D24] text-white/70 border border-white/[0.06] active:bg-white/[0.04]"
                    : "bg-[#1A1D24] text-white/30 border border-white/[0.06] cursor-not-allowed";
              return (
                <button key={i} type="button"
                  ref={isCurrent ? activeChipRef : null}
                  onClick={() => { if (reachable) { setDirection(i > slide ? 1 : -1); setSlide(i); } }}
                  disabled={!reachable}
                  className={`px-4 py-2 rounded-full text-[12px] font-bold uppercase tracking-[0.14em] whitespace-nowrap transition-colors ${chipCls}`}>
                  {i + 1}. {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Inline style sheet : hide scrollbars on the chip-row and the
          page scroll (canon : native feel, no Chrome WebView scrollbar). */}
      <style>{`
        .nx-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .nx-no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
      `}</style>

      {/* Scrollable content with slide transition.
          paddingBottom clears the tab bar (~64px + safe-area) + the
          lifted CTA bar (~80px : 56h button + 24 py-3) + a 12px gap. */}
      <div className="flex-1 overflow-y-auto nx-no-scrollbar"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 168px)" }}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div key={slide} custom={direction}
            initial={(d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 })}
            animate={{ x: 0, opacity: 1 }}
            exit={(d: number) => ({ x: d > 0 ? -50 : 50, opacity: 0 })}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="px-4 py-5">
            {slide === 0 && renderStep1()}
            {slide === 1 && renderStep2()}
            {slide === 2 && renderStep3()}
            {slide === 3 && renderStep4()}
            {slide === 4 && renderStep5()}
            {slide === 5 && renderStep6()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Persistent bottom save button → opens summary popup.
          Portaled to document.body so a transform ancestor (the slide
          AnimatePresence wrapper above) can't trap its fixed position.

          ⚠️ Stacked ABOVE the MobileTabBar (z-40, height ~64px +
          safe-area) so both remain visible : the CTA's `bottom` is
          lifted by the tab-bar height + safe-area. The safe-area is
          accounted for in `bottom` ; the CTA's own padding is just a
          fixed gap (12px top + 12px bottom). */}
      {mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-x-0 z-[50] bg-[#111317]/95 backdrop-blur-md border-t border-white/[0.06] px-4 py-3"
          style={{
            bottom: "calc(64px + env(safe-area-inset-bottom))",
          }}
        >
          <button type="button"
            onClick={() => { triggerHaptic("Light"); setShowSummarySheet(true); }}
            className="w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest bg-[#E63946] text-white active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)] transition-all">
            {isCreate ? "Créer le profil" : "Enregistrer"}
          </button>
        </div>,
        document.body,
      )}

      {/* ═══ Pickers ═══ */}
      <MobilePicker open={openSportPicker} onClose={() => setOpenSportPicker(false)}
        title="Sport principal"
        options={SPORTS.map((s) => ({ value: s, label: s }))}
        value={form.sports.primarySport || null}
        onChange={(v) => updateSports("primarySport", v ? String(v) : "")} />
      <MobilePicker open={openSecondarySportPicker} onClose={() => setOpenSecondarySportPicker(false)}
        title="Sport secondaire"
        options={[{ value: "", label: "Aucun" }, ...SPORTS.map((s) => ({ value: s, label: s }))]}
        value={form.sports.secondarySport || ""}
        onChange={(v) => updateSports("secondarySport", v ? String(v) : "")} />
      <MobilePicker open={openGenderPicker} onClose={() => setOpenGenderPicker(false)}
        title="Genre"
        options={[{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }, { value: "X", label: "Non genré" }]}
        value={form.identity.gender || null}
        onChange={(v) => updateIdentity("gender", v ? String(v) : "")} />
      <MobilePicker open={openPromoPicker} onClose={() => setOpenPromoPicker(false)}
        title="Promotion"
        options={[2025, 2026, 2027, 2028, 2029].map((y) => ({ value: String(y), label: String(y) }))}
        value={form.identity.gradYear || null}
        onChange={(v) => updateIdentity("gradYear", v ? String(v) : "")} />
      {/* Old flat MobilePickers for height ft/in removed — height is now
          driven by the MobileWheelPicker instance below (3-col imperial
          or 1-col metric, with unit toggle). */}
      <MobilePicker open={openDominantHandPicker} onClose={() => setOpenDominantHandPicker(false)}
        title="Main dominante"
        options={[{ value: "Droite", label: "Droite" }, { value: "Gauche", label: "Gauche" }, { value: "Ambidextre", label: "Ambidextre" }]}
        value={form.physical.dominantHand || null}
        onChange={(v) => updatePhysical("dominantHand", v ? String(v) : "")} />
      <MobilePicker open={openDominantFootPicker} onClose={() => setOpenDominantFootPicker(false)}
        title="Pied dominant"
        options={[{ value: "Droit", label: "Droit" }, { value: "Gauche", label: "Gauche" }, { value: "Les deux", label: "Les deux" }]}
        value={form.physical.dominantFoot || null}
        onChange={(v) => updatePhysical("dominantFoot", v ? String(v) : "")} />
      <MobilePicker open={openPrimaryPosPicker} onClose={() => setOpenPrimaryPosPicker(false)}
        title="Position principale" options={primaryPositions}
        value={form.sports.primaryPosition || null}
        onChange={(v) => updateSports("primaryPosition", v ? String(v) : "")} />
      <MobilePicker open={openSecondaryPosPicker} onClose={() => setOpenSecondaryPosPicker(false)}
        title="Position secondaire" options={primaryPositions}
        value={form.sports.secondaryPosition || null}
        onChange={(v) => updateSports("secondaryPosition", v ? String(v) : "")} />
      <MobilePicker open={openRecruitmentStatusPicker} onClose={() => setOpenRecruitmentStatusPicker(false)}
        title="Statut de recrutement" options={RECRUITMENT_STATUS_OPTIONS}
        value={recruitmentStatus}
        onChange={(v) => {
          const next = v ? String(v) : "OUVERT";
          setRecruitmentStatus(next);
          if (next !== "RECRUTE") { setCommittedSchoolId(""); setCommittedSchoolName(""); }
        }} />
      <MobilePicker open={openRecruitingOverridePicker} onClose={() => setOpenRecruitingOverridePicker(false)}
        title="Statut (override)" options={RECRUITING_OVERRIDE_OPTIONS}
        value={form.submission.recruitingStatus || ""}
        onChange={(v) => updateSubmission("recruitingStatus", v ? String(v) : "")} />
      <MobilePicker open={openCegepTypePicker} onClose={() => setOpenCegepTypePicker(false)}
        title="Programme CÉGEP visé"
        options={[
          { value: "", label: "Non précisé" },
          { value: "dec_general", label: "DEC général" },
          { value: "technique", label: "Programme technique" },
        ]}
        value={form.academic.cegepType || ""}
        onChange={(v) => updateAcademic("cegepType", v ? String(v) : "")} />

      <SearchSheet<SchoolRow> open={openCegepPicker} onClose={() => setOpenCegepPicker(false)}
        title="CÉGEP d'engagement" searchPlaceholder="Rechercher un CÉGEP…"
        searchValue={cegepSearch} onSearchChange={setCegepSearch}
        items={visibleCegep} keyOf={(s) => s.id}
        onSelect={(s) => { setCommittedSchoolId(s.id); setCommittedSchoolName(s.name); }}
        renderItem={(s, onTap) => (
          <button type="button" onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors">
            <p className="text-[16px] font-semibold text-white truncate">{s.name}</p>
            {s.city && <p className="text-[13px] text-white/55 truncate">{s.city}</p>}
          </button>
        )} />

      <SearchSheet<CoachTeam> open={openTeamPicker} onClose={() => setOpenTeamPicker(false)}
        title="Équipe" searchPlaceholder="Rechercher une équipe…"
        searchValue={teamSearch} onSearchChange={setTeamSearch}
        items={visibleTeams} keyOf={(t) => t.id}
        onSelect={(t) => {
          updateSports("selectedTeamId", t.id);
          updateSports("currentTeam", t.name);
          updateSports("teamLevel", t.level);
          updateSports("teamDivision", t.division);
          updateSports("league", t.league);
        }}
        emptyContent={
          <p className="text-center text-[14px] text-white/55 py-10 px-4">
            Aucune équipe — crée-en une dans Mes équipes.
          </p>
        }
        renderItem={(t, onTap) => (
          <button type="button" onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors">
            <p className="text-[16px] font-semibold text-white truncate">{t.name}</p>
            {t.level && <p className="text-[13px] text-white/55 truncate">{t.level}</p>}
          </button>
        )} />

      <SearchSheet<CoachTeam> open={openInviteTeamPicker} onClose={() => setOpenInviteTeamPicker(false)}
        title="Inviter sur quelle équipe ?" searchPlaceholder="Rechercher…"
        searchValue={teamSearch} onSearchChange={setTeamSearch}
        items={visibleTeams} keyOf={(t) => t.id}
        onSelect={(t) => setInvitationTeamId(t.id)}
        renderItem={(t, onTap) => (
          <button type="button" onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors">
            <p className="text-[16px] font-semibold text-white truncate">{t.name}</p>
            {t.level && <p className="text-[13px] text-white/55 truncate">{t.level}</p>}
          </button>
        )} />

      {/* ═══ Wheel pickers — Taille + Poids ═══════════════════════
          Imperial mode : 3-col / 1-col wheel that writes back to
          taille_pieds + taille_pouces + poids_lbs (storage stays
          imperial). Metric mode : 1-col cm / kg wheel, with onCommit
          converting back to imperial. saveAthlete.ts UNCHANGED. */}
      <MobileWheelPicker
        open={openHeightWheel}
        onClose={() => setOpenHeightWheel(false)}
        title="Taille"
        headerExtra={
          <UnitToggle
            mode={unitMode}
            onChange={setUnitMode}
            options={[{ value: "imperial", label: "pi/po" }, { value: "metric", label: "cm" }]}
          />
        }
        columns={
          unitMode === "imperial"
            ? [
                {
                  key: "ft",
                  label: "Pieds",
                  options: [4, 5, 6, 7].map((v) => ({ value: String(v), label: `${v}'` })),
                  value: form.physical.heightFeet || "5",
                },
                {
                  key: "in",
                  label: "Pouces",
                  options: Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i}"` })),
                  value: form.physical.heightInches || "10",
                },
              ]
            : [
                {
                  key: "cm",
                  label: "Centimètres",
                  options: Array.from({ length: 106 }, (_, i) => ({
                    value: String(120 + i),
                    label: `${120 + i} cm`,
                  })),
                  value: (() => {
                    const ft = parseInt(form.physical.heightFeet || "0");
                    const inches = parseInt(form.physical.heightInches || "0");
                    if (!ft && !inches) return "175";
                    return String(Math.round((ft * 12 + inches) * 2.54));
                  })(),
                },
              ]
        }
        onCommit={(values) => {
          if (unitMode === "imperial") {
            const [ft, inches] = values as [string, string];
            updatePhysical("heightFeet", ft || "");
            updatePhysical("heightInches", inches || "");
          } else {
            // cm → ft + in
            const cm = parseInt(String(values[0] ?? "0"));
            if (!cm) {
              updatePhysical("heightFeet", "");
              updatePhysical("heightInches", "");
              return;
            }
            const totalIn = Math.round(cm / 2.54);
            const ft = Math.floor(totalIn / 12);
            const inches = totalIn % 12;
            updatePhysical("heightFeet", String(ft));
            updatePhysical("heightInches", String(inches));
          }
        }}
      />

      <MobileWheelPicker
        open={openWeightWheel}
        onClose={() => setOpenWeightWheel(false)}
        title="Poids"
        headerExtra={
          <UnitToggle
            mode={unitMode}
            onChange={setUnitMode}
            options={[{ value: "imperial", label: "lbs" }, { value: "metric", label: "kg" }]}
          />
        }
        columns={
          unitMode === "imperial"
            ? [
                {
                  key: "lbs",
                  label: "Livres",
                  options: Array.from({ length: 271 }, (_, i) => ({
                    value: String(80 + i),
                    label: `${80 + i} lbs`,
                  })),
                  value: (() => {
                    const v = parseFloat(form.physical.weightLbs || "0");
                    return v > 0 ? String(Math.round(v)) : "180";
                  })(),
                },
              ]
            : [
                {
                  key: "kg",
                  label: "Kilogrammes",
                  options: Array.from({ length: 141 }, (_, i) => ({
                    value: String(40 + i),
                    label: `${40 + i} kg`,
                  })),
                  value: (() => {
                    const lbs = parseFloat(form.physical.weightLbs || "0");
                    if (!lbs) return "82";
                    return String(Math.round(lbs / 2.20462));
                  })(),
                },
              ]
        }
        onCommit={(values) => {
          if (unitMode === "imperial") {
            const lbs = String(values[0] ?? "");
            updatePhysical("weightLbs", lbs);
          } else {
            const kg = parseFloat(String(values[0] ?? "0"));
            if (!kg) { updatePhysical("weightLbs", ""); return; }
            const lbs = Math.round(kg * 2.20462 * 10) / 10;
            updatePhysical("weightLbs", String(lbs));
          }
        }}
      />

      {/* ═══ Distinction detail popup (replaces under-grid blocks) ═══ */}
      <DistinctionDetailSheet
        badgeKey={openDistinctionSheet}
        entry={openDistinctionSheet
          ? form.scouting.badges.find((b) => b.badge === openDistinctionSheet) ?? null
          : null}
        sportStats={openDistinctionSheet
          ? ((openDistinctionSheet === "team_leader" || openDistinctionSheet === "league_leader")
              ? getSportStats(form.sports.primarySport)
              : [])
          : []}
        onChange={(detail) => openDistinctionSheet && updateBadgeDetail(openDistinctionSheet, detail)}
        onRemove={() => {
          if (!openDistinctionSheet) return;
          toggleBadge(openDistinctionSheet);
          setOpenDistinctionSheet(null);
        }}
        onClose={() => setOpenDistinctionSheet(null)}
      />

      {/* Summary popup — replaces Step 7. */}
      <SummarySheet
        open={showSummarySheet}
        onClose={() => setShowSummarySheet(false)}
        isCreate={isCreate}
        form={form}
        diff={isEdit ? computeDiff() : []}
        missingRequired={isCreate ? missingRequiredAll() : []}
        onConfirm={handleFinish}
        saving={saving}
        onJumpToSlide={(i) => { setShowSummarySheet(false); setDirection(i > slide ? 1 : -1); setSlide(i); }}
        onToggleConsent={() => setForm((prev) => ({ ...prev, parentalConsent: !prev.parentalConsent }))}
        onTogglePartner={(next) => setForm((prev) => ({ ...prev, partnerVisibilityConsent: next }))}
      />
    </div>
  );

  /* ════════════════════════════════════════════════════════════
     STEP RENDERERS
  ════════════════════════════════════════════════════════════ */

  function renderStep1() {
    const d = form.identity;
    const due = isEdit && isValidationDue(validationState);
    const expired = isEdit && isValidationExpired(validationState);
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
            Identité<span className="text-[#E63946]">*</span>
          </h2>
          <p className="text-[13px] text-white/55 mt-1">
            Informations personnelles de base
            <span className="ml-1 text-white/35">· * étape avec champs requis</span>
          </p>
        </div>

        {/* Monthly re-validation banner (edit only, informational — no
            confirm button : it's the athlete's action). Reuses the
            canonical 15-of-month gate from lib/utils/profileValidation. */}
        {expired && (
          <div className="p-4 rounded-2xl bg-[#E63946]/10 border border-[#E63946]/30">
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="text-[13px] font-bold text-[#E63946]">
                  Profil non confirmé — le badge vérifié est désactivé
                </p>
                <p className="text-[12px] text-white/55 mt-1 leading-snug">
                  L&apos;athlète doit confirmer ses informations pour réactiver son badge.
                </p>
              </div>
            </div>
          </div>
        )}
        {due && !expired && (
          <div className="p-4 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/30">
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="text-[13px] font-bold text-[#F59E0B]">Confirmation mensuelle requise</p>
                <p className="text-[12px] text-white/55 mt-1 leading-snug">
                  Confirme que tes informations sont toujours à jour avant le {formatDeadlineFr()}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Photo hero — card-with-fade (mirrors the recruiter Mon processus
            / athlete card treatment : photo fills the card, a soft gradient
            fades to the card color at the bottom so the prompt text reads
            cleanly over it ; works for both filled and empty states. */}
        <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-[#1A1D24] border border-white/[0.06]">
          {d.photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          )}
          {/* Fade overlay — opaque card color at the bottom, transparent at
              ~70% up. Same recipe as components/shared/RecruteurDashboardMobile
              athlete cards. */}
          <div
            className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
            style={{ background: "linear-gradient(to top, #1A1D24 0%, rgba(26,29,36,0.92) 30%, rgba(26,29,36,0.55) 55%, transparent 80%)" }}
          />
          {/* Bottom prompt + actions */}
          <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-6 flex items-end justify-between gap-3">
            <p className="text-[13px] text-white font-semibold leading-tight">
              {photoUploading
                ? "Téléversement…"
                : d.photo
                  ? "Tape pour changer"
                  : "Ajouter une photo · Tape pour choisir"}
            </p>
            {d.photo && (
              <button type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateIdentity("photo", ""); }}
                className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider text-[#E63946] border border-[#E63946]/30 active:bg-[#E63946]/15">
                Retirer
              </button>
            )}
          </div>
          {/* Tap layer — clicking anywhere on the card opens the file
              picker. Sits above the gradient + below the Retirer button. */}
          <label className="absolute inset-0 cursor-pointer">
            <input type="file" accept="image/*" className="sr-only"
              title="Téléverser une photo"
              aria-label="Téléverser une photo"
              onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {/* Essentials */}
        <Card>
          <InlineEditRow label="Prénom" value={d.firstName}
            onSave={(v) => updateIdentity("firstName", v)} required />
          <InlineEditRow label="Nom" value={d.lastName}
            onSave={(v) => updateIdentity("lastName", v)} required />
          <DateRow label="Date de naissance" value={d.dateOfBirth}
            onChange={(v) => updateIdentity("dateOfBirth", v)} required />
          <PickerRow label="Promotion"
            value={d.gradYear}
            onTap={() => setOpenPromoPicker(true)} required />
          <PickerRow label="Genre"
            value={d.gender === "M" ? "Masculin" : d.gender === "F" ? "Féminin" : d.gender === "X" ? "Non genré" : ""}
            onTap={() => setOpenGenderPicker(true)} required />
        </Card>

        {/* CREATE-only email + orphan autocomplete (essential card) */}
        {isCreate && (
          <Card>
            <InlineEditRow label="Courriel" value={d.email}
              onSave={(v) => handleEmailChange(v)}
              placeholder="athlete@email.com"
              type="email" />
          </Card>
        )}
        {isCreate && showSuggestions && emailAutocomplete?.suggestions && emailAutocomplete.suggestions.length > 0 && (
          <div className="rounded-2xl bg-[#1A1D24] border border-[#E63946]/30 overflow-hidden">
            <div className="px-4 py-2 text-[11px] text-white/55 border-b border-white/[0.08]">
              Comptes Nexus existants
            </div>
            {emailAutocomplete.suggestions.map((s) => (
              <button key={s.athleteId} type="button"
                onClick={() => handleSelectSuggestion(s)}
                className="w-full text-left px-4 py-3 active:bg-[#E63946]/10 border-b border-white/[0.06] last:border-b-0">
                <p className="text-[14px] font-semibold text-white">{s.firstName} {s.lastName}</p>
                <p className="text-[12px] text-white/55">{s.email}{s.sportName ? ` · ${s.sportName}` : ""}</p>
              </button>
            ))}
          </div>
        )}
        {isCreate && linkedToExisting && (
          <div className="p-3 rounded-2xl bg-[#1A1D24] border border-[#E63946]/30">
            <div className="flex items-start gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white">
                  Lié à {linkedToExisting.firstName} {linkedToExisting.lastName}
                </p>
                <p className="text-[12px] text-white/55 mt-0.5">Envoie une invitation à rejoindre ton équipe.</p>
                <div className="mt-3 flex flex-col gap-2">
                  <PickerRow inline
                    label=""
                    value={invitationTeamId
                      ? coach.teams.find((t) => t.id === invitationTeamId)?.name ?? "Équipe sélectionnée"
                      : ""}
                    placeholder="Choisir une équipe"
                    onTap={() => coach.teams.length > 1 ? setOpenInviteTeamPicker(true) : null} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setLinkedToExisting(null)}
                      className="flex-1 h-11 rounded-2xl border border-white/[0.10] text-[13px] font-bold text-white/70 active:bg-white/[0.04]">
                      Délier
                    </button>
                    <button type="button" onClick={handleSendInvitation}
                      disabled={!invitationTeamId || isSubmittingInvitation}
                      className={`flex-1 h-11 rounded-2xl text-[13px] font-bold ${
                        invitationTeamId && !isSubmittingInvitation
                          ? "bg-[#E63946] text-white active:bg-[#D42B22]"
                          : "bg-white/[0.06] text-white/40 cursor-not-allowed"
                      }`}>
                      {isSubmittingInvitation ? "Envoi…" : "Inviter"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Affiliation (school) + advanced details */}
        <AdvancedDivider />
        <Card>
          <ReadOnlyRow label="École secondaire" value={d.school} detailed required />
          <ReadOnlyRow label="Ville" value={d.city} detailed required={isCreate} />
          <ReadOnlyRow label="Région" value={d.region} detailed required={isCreate} />
          <InlineEditRow label="Téléphone" value={d.phone}
            onSave={(v) => updateIdentity("phone", v)}
            placeholder="(514) 000-0000"
            type="tel" detailed />
          <InlineEditRow label="Nom du parent" value={d.parentName}
            onSave={(v) => updateIdentity("parentName", v)}
            placeholder="Nom complet" detailed />
          <InlineEditRow label="Téléphone parent" value={d.parentPhone}
            onSave={(v) => updateIdentity("parentPhone", v)}
            placeholder="(514) 000-0000"
            type="tel" detailed />
        </Card>

        {/* Recruitment status (EDIT only) */}
        {isEdit && (
          <Card>
            <PickerRow label="Statut de recrutement"
              value={RECRUITMENT_STATUS_OPTIONS.find((o) => o.value === recruitmentStatus)?.label ?? recruitmentStatus}
              onTap={() => setOpenRecruitmentStatusPicker(true)} />
            {recruitmentStatus === "RECRUTE" && (
              <PickerRow label="CÉGEP d'engagement"
                value={committedSchoolName}
                placeholder="Rechercher un CÉGEP…"
                onTap={() => setOpenCegepPicker(true)} />
            )}
          </Card>
        )}

        {/* Permission-color legend removed — coach edits everything
            directly ; the color system is athlete-side only. */}
      </div>
    );
  }

  function renderStep2() {
    const d = form.academic;
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Académique</h2>
          <p className="text-[13px] text-white/55 mt-1">Résultats scolaires et objectifs CÉGEP</p>
        </div>

        <Card>
          <InlineEditRow label="Moyenne générale (%)"
            value={d.gpa}
            onSave={(v) => updateAcademic("gpa", v)}
            placeholder="85"
            type="number" numericMode="decimal" />
          <PickerRow label="Programme CÉGEP visé"
            value={d.cegepType === "dec_general" ? "DEC général" : d.cegepType === "technique" ? "Programme technique" : ""}
            onTap={() => setOpenCegepTypePicker(true)} />
          {d.cegepType === "technique" && (
            <InlineEditRow label="Détail du programme"
              value={d.cegepProgramDetail}
              onSave={(v) => updateAcademic("cegepProgramDetail", v)}
              placeholder="Ex: Techniques policières" />
          )}
        </Card>

        <Card>
          <ToggleRow label="Ouvert à un CÉGEP privé"
            checked={d.openToPrivate}
            onToggle={() => updateAcademic("openToPrivate", !d.openToPrivate)} />
          <ToggleRow label="Ouvert à un CÉGEP anglophone"
            checked={d.openToAnglophone}
            onToggle={() => updateAcademic("openToAnglophone", !d.openToAnglophone)} />
          <ToggleRow label="Prêt à changer de région"
            checked={d.openToRelocate}
            onToggle={() => updateAcademic("openToRelocate", !d.openToRelocate)} />
        </Card>

        <AdvancedDivider />

        <Card>
          <ChipsBlock label="Matières fortes" detailed>
            {SUBJECTS.map((s) => {
              const sel = d.strongSubjects.includes(s);
              return (
                <button key={s} type="button"
                  onClick={() => updateAcademic("strongSubjects", toggleArrayItem(d.strongSubjects, s))}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-colors ${
                    sel ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
                        : "bg-transparent border border-white/[0.10] text-white/65"
                  }`}>
                  {s}
                </button>
              );
            })}
          </ChipsBlock>

          <ChipsBlock label="Régions CÉGEP préférées" detailed>
            {CEGEP_REGIONS.map((r) => {
              const sel = d.cegepRegions.includes(r);
              return (
                <button key={r} type="button"
                  onClick={() => updateAcademic("cegepRegions", toggleArrayItem(d.cegepRegions, r))}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-colors ${
                    sel ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
                        : "bg-transparent border border-white/[0.10] text-white/65"
                  }`}>
                  {r}
                </button>
              );
            })}
          </ChipsBlock>

          <TagInputRow label="Mentions académiques"
            values={d.academicHonors}
            onChange={(arr) => updateAcademic("academicHonors", arr)}
            placeholder="Ex: Tableau d'honneur"
            detailed />
        </Card>
      </div>
    );
  }

  function renderStep3() {
    const d = form.physical;
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Physique</h2>
          <p className="text-[13px] text-white/55 mt-1">Mensurations et tests athlétiques</p>
        </div>

        <Card>
          <PickerRow label="Taille"
            value={formatHeightDisplay(d.heightFeet, d.heightInches, unitMode)}
            onTap={() => setOpenHeightWheel(true)} />
          <PickerRow label="Poids"
            value={formatWeightDisplay(d.weightLbs, unitMode)}
            onTap={() => setOpenWeightWheel(true)} />
          <PickerRow label="Main dominante"
            value={d.dominantHand}
            onTap={() => setOpenDominantHandPicker(true)} />
        </Card>

        <AdvancedDivider />

        <Card>
          <InlineEditRow label="Envergure" value={d.wingspan}
            onSave={(v) => updatePhysical("wingspan", v)}
            placeholder={`6'4"`} detailed numericMode="numeric" />
          <InlineEditRow label="Taille des mains" value={d.handSize}
            onSave={(v) => updatePhysical("handSize", v)}
            placeholder={`9.5"`} detailed numericMode="decimal" />
          <PickerRow label="Pied dominant" value={d.dominantFoot}
            onTap={() => setOpenDominantFootPicker(true)} detailed />
        </Card>

        <Card>
          <InlineEditRow label="40 verges" value={d.fortyYard}
            onSave={(v) => updatePhysical("fortyYard", v)}
            placeholder="4.72s" detailed numericMode="decimal" />
          <InlineEditRow label="Saut vertical" value={d.verticalJump}
            onSave={(v) => updatePhysical("verticalJump", v)}
            placeholder={`32"`} detailed numericMode="decimal" />
          <InlineEditRow label="Saut en longueur" value={d.broadJump}
            onSave={(v) => updatePhysical("broadJump", v)}
            placeholder={`9'2"`} detailed numericMode="decimal" />
          <InlineEditRow label="Développé couché" value={d.benchPress}
            onSave={(v) => updatePhysical("benchPress", v)}
            placeholder="225 × 8" detailed numericMode="decimal" />
          <InlineEditRow label="Navette agilité" value={d.shuttleAgility}
            onSave={(v) => updatePhysical("shuttleAgility", v)}
            placeholder="4.31s" detailed numericMode="decimal" />
          <InlineEditRow label="Sprint 100m" value={d.sprint100m}
            onSave={(v) => updatePhysical("sprint100m", v)}
            placeholder="10.9s" detailed numericMode="decimal" />
        </Card>
      </div>
    );
  }

  function renderStep4() {
    const s = form.sports;
    const sport = s.primarySport;
    const isCustomSport = sport === "Autre" || (!!sport && !POSITIONS[sport]);
    const teamLabel = s.selectedTeamId
      ? (coach.teams.find((t) => t.id === s.selectedTeamId)?.name ?? s.currentTeam ?? "")
      : "";

    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
            Sport<span className="text-[#E63946]">*</span>
          </h2>
          <p className="text-[13px] text-white/55 mt-1">
            Sport, position et équipe
            <span className="ml-1 text-white/35">· * étape avec champs requis</span>
          </p>
        </div>

        <Card>
          <PickerRow label="Sport principal" value={s.primarySport}
            onTap={() => setOpenSportPicker(true)} required />
          {s.primarySport === "Autre" && (
            <InlineEditRow label="Précise le sport" value={s.primarySportDetail}
              onSave={(v) => updateSports("primarySportDetail", v)}
              placeholder="Précise le sport…" />
          )}
          {isCustomSport ? (
            <InlineEditRow label="Position principale" value={s.primaryPosition}
              onSave={(v) => updateSports("primaryPosition", v)}
              placeholder="Saisis la position…" required />
          ) : (
            <PickerRow label="Position principale" value={s.primaryPosition}
              onTap={() => s.primarySport ? setOpenPrimaryPosPicker(true) : null}
              placeholder={s.primarySport ? "Sélectionner" : "Choisis un sport d'abord"} required />
          )}
          <InlineEditRow label="Numéro" value={s.jerseyNumber}
            onSave={(v) => updateSports("jerseyNumber", v.replace(/\D/g, ""))}
            placeholder="#" type="number" numericMode="numeric" required />
          <PickerRow label="Équipe" value={teamLabel}
            onTap={() => coach.teams.length > 0 ? setOpenTeamPicker(true) : null}
            placeholder={coach.teams.length === 0 ? "Aucune équipe — crée-en une" : "Sélectionner"} required />
          {s.teamLevel && (
            <ReadOnlyRow label="Niveau" value={s.teamLevel} />
          )}
        </Card>

        <AdvancedDivider />

        <Card>
          {isCustomSport ? (
            <InlineEditRow label="Position secondaire" value={s.secondaryPosition}
              onSave={(v) => updateSports("secondaryPosition", v)}
              placeholder="Saisis la position secondaire…" detailed />
          ) : (
            <PickerRow label="Position secondaire" value={s.secondaryPosition}
              onTap={() => s.primarySport ? setOpenSecondaryPosPicker(true) : null}
              placeholder="Aucune" detailed />
          )}
          <PickerRow label="Sport secondaire" value={s.secondarySport}
            onTap={() => setOpenSecondarySportPicker(true)}
            placeholder="Aucun" detailed />
          <ToggleRow label="Ouvert à devenir entraîneur CÉGEP"
            checked={s.openToCoaching}
            onToggle={() => updateSports("openToCoaching", !s.openToCoaching)}
            detailed />
        </Card>
      </div>
    );
  }

  function renderStep5() {
    const sc = form.scouting;
    const isDet = sc.evalMode === "detailed";
    const sportStats = getSportStats(form.sports.primarySport);
    const selectedMap = new Map(sc.badges.map((b) => [b.badge, b]));
    const atMax = sc.badges.length >= MAX_BADGES;
    const ratedTraits = Object.values(sc.traitRatings).filter((v) => v > 0);
    const autoAvg = ratedTraits.length > 0 ? ratedTraits.reduce((a, b) => a + b, 0) / ratedTraits.length : 0;
    /* Mirrors apply_approved_suggestion's "Impossible d'appliquer une
       cote globale plate : l'évaluation détaillée est active" guard at
       the UI level. When detailed trait data exists, the simple-mode
       cote is rendered READ-ONLY at the auto-average ; the coach can't
       hand-edit it. To change the cote, they must enter detailed mode
       and adjust the traits — same rule the DB trigger enforces on the
       athlete-suggestion path. */
    const hasDetailedTraits = ratedTraits.length > 0;

    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Évaluation</h2>
          <p className="text-[13px] text-white/55 mt-1">Cote, distinctions, rapport</p>
        </div>

        {/* Behavior-changing toggle (kept) */}
        <div className="flex items-center gap-1 bg-[#1A1D24] rounded-2xl p-1 w-fit">
          {(["simple", "detailed"] as const).map((opt) => (
            <button key={opt} type="button"
              onClick={() => updateScouting("evalMode", opt)}
              className={`px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-[0.12em] transition-colors ${
                sc.evalMode === opt ? "bg-[#E63946] text-white" : "text-white/55"
              }`}>
              {opt === "simple" ? "Simplifié" : "Détaillé"}
            </button>
          ))}
        </div>

        {!isDet && hasDetailedTraits && (
          /* Detailed-data-exists branch : the cote is the auto-average
             of the 14 trait columns and CANNOT be hand-edited from
             simple mode (UI-level mirror of apply_approved_suggestion's
             "Cote globale" guard). The coach modifies the cote by
             entering detailed mode and adjusting the traits. */
          <Card>
            <div className="px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                Cote globale (moy. auto)
              </p>
              <div className="mt-2 flex items-center gap-3">
                <p className="text-[28px] font-head font-black text-[#F59E0B] leading-none">
                  {autoAvg > 0 ? autoAvg.toFixed(1) : "—"}
                  <span className="text-[12px] text-white/45 font-normal ml-1">/ 5</span>
                </p>
                <StarRow value={Math.round(autoAvg)} onChange={() => { /* read-only */ }} size={20} />
              </div>
              <p className="text-[12px] text-white/55 mt-3">
                Évaluation détaillée active — la cote est calculée à partir des critères. Pour la
                modifier, passe en mode <strong className="text-white/85">Détaillé</strong> et ajuste
                les critères.
              </p>
              <button
                type="button"
                onClick={() => updateScouting("evalMode", "detailed")}
                className="mt-3 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#E63946]/15 border border-[#E63946]/30 text-[#E63946] text-[12px] font-bold uppercase tracking-[0.12em] active:bg-[#E63946]/25"
              >
                Modifier les critères
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </Card>
        )}

        {!isDet && !hasDetailedTraits && (
          /* No traits yet — keep the editable manual StarRow exactly as
             before. Coach sets a flat cote in simple mode without any
             detailed data to clash with. */
          <Card>
            <div className="px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                Cote de l&apos;entraîneur
              </p>
              <p className="text-[12px] text-white/55 mt-0.5">
                Demi-étoiles supportées (tape la moitié gauche pour .5).
              </p>
              <div className="mt-3 flex items-center gap-3">
                <StarRow
                  value={sc.starRating}
                  onChange={(n) => updateScouting("starRating", n)}
                  size={32}
                  allowHalf
                />
                <span className="text-[14px] font-bold text-white">
                  {sc.starRating > 0 ? `${sc.starRating} / 5` : "—"}
                </span>
              </div>
            </div>
          </Card>
        )}

        {isDet && (
          <>
            <Card>
              <div className="flex items-center justify-between px-4 py-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Cote globale (moy. auto)</p>
                  <p className="text-[28px] font-head font-black text-[#F59E0B] leading-none mt-1">
                    {autoAvg > 0 ? autoAvg.toFixed(1) : "—"}
                    <span className="text-[12px] text-white/45 font-normal ml-1">/ 5</span>
                  </p>
                </div>
                <StarRow value={Math.round(autoAvg)} onChange={() => { /* visual */ }} size={20} />
              </div>
            </Card>

            {TRAIT_GROUPS.map((group) => (
              <Card key={group.title}>
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">{group.title}</p>
                </div>
                {group.traits.map((t) => {
                  const val = sc.traitRatings[t.key] || 0;
                  return (
                    <div key={t.key} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] last:border-0">
                      <span className="text-[13px] text-white/90">{t.label}</span>
                      <StarRow value={val}
                        onChange={(n) => updateScouting("traitRatings", { ...sc.traitRatings, [t.key]: n })}
                        size={20} />
                    </div>
                  );
                })}
              </Card>
            ))}
          </>
        )}

        {/* Distinctions */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45 mb-2">
            Distinctions ({sc.badges.length}/{MAX_BADGES})
          </p>
          <div className="grid grid-cols-3 gap-2">
            {BADGE_ORDER.map((key) => {
              const cfg = BADGE_CONFIG[key];
              const entry = selectedMap.get(key);
              const isSelected = !!entry;
              const isDisabled = !isSelected && atMax;
              const detailBearing = cfg.hasDetail || key === "custom";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (isDisabled) return;
                    if (isSelected) {
                      // Selected + detail-bearing → open popup to edit.
                      // Selected + non-detail → toggle off.
                      if (detailBearing) setOpenDistinctionSheet(key);
                      else toggleBadge(key);
                    } else {
                      // Newly selected. Add the entry first, then for
                      // detail-bearing badges open the popup immediately
                      // so the coach fills in the title/stat right away.
                      toggleBadge(key);
                      if (detailBearing) setOpenDistinctionSheet(key);
                    }
                  }}
                  disabled={isDisabled}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border ${
                    isSelected ? "border-[#E63946]/40 bg-[#E63946]/[0.06]" : "border-white/[0.08] bg-[#1A1D24]"
                  } ${isDisabled ? "opacity-40" : ""}`}
                >
                  <DistinctionBadge badge={key} detail={entry?.detail} size="sm" />
                  <span className={`text-[11px] font-bold text-center ${isSelected ? "text-white" : "text-white/65"}`}>
                    {key === "custom" ? (entry?.detail || "Personnalisée") : cfg.label}
                  </span>
                  {isSelected && detailBearing && entry?.detail && key !== "custom" && (
                    <span className="text-[10px] text-white/55 text-center leading-tight">
                      {entry.detail}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Old under-grid "Détail — X" dropdown/input blocks removed
              — replaced by the DistinctionDetailSheet popup that opens
              on tap. Stored shape (evaluations.distinctions JSONB) is
              byte-identical. */}
        </div>

        {/* Rapport — card-styled, native textarea (no web-form border) */}
        <Card>
          <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
              Rapport de l&apos;entraîneur
            </p>
            <p className="text-[12px] text-white/55 mt-0.5 leading-snug">
              Décris cet athlète aux recruteurs — caractère, forces, performances marquantes.
            </p>
          </div>
          <textarea
            className="w-full bg-transparent text-[15px] text-white leading-relaxed resize-none min-h-[180px] focus:outline-none px-4 py-3 placeholder:text-white/30"
            value={sc.coachEndorsement}
            onChange={(e) => updateScouting("coachEndorsement", e.target.value)}
            maxLength={1000}
            placeholder="Ex: joueur le plus discipliné de mon roster, leader naturel, première étape au camp…" />
          <div className="px-4 pb-3 pt-1 flex items-center justify-between">
            <span className="text-[11px] text-white/45">
              {sc.coachEndorsement.length === 0 ? "Vide" : `${sc.coachEndorsement.length === 1000 ? "Maximum atteint" : "En cours"}`}
            </span>
            <span className="text-[11px] text-white/45 tabular-nums">
              {sc.coachEndorsement.length} / 1000
            </span>
          </div>
        </Card>
      </div>
    );
  }

  function renderStep6() {
    const m = form.media;
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Médias</h2>
          <p className="text-[13px] text-white/55 mt-1">Vidéos et profils en ligne</p>
        </div>

        <Card>
          <MediaUrlRow label="Vidéo faits saillants" value={m.highlightVideo}
            onSave={(v) => updateMedia("highlightVideo", v)}
            placeholder="https://…" />
        </Card>

        {!m.highlightVideo && (
          <div className="p-3 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
            <p className="text-[12px] text-[#F59E0B] font-bold">
              Les profils avec vidéo reçoivent 3× plus d&apos;engagement.
            </p>
          </div>
        )}

        <AdvancedDivider />

        <Card>
          <MediaUrlRow label="Hudl" value={m.hudlLink}
            onSave={(v) => updateMedia("hudlLink", v)}
            placeholder="https://hudl.com/…" detailed />
          <MediaUrlRow label="YouTube" value={m.youtubeLink}
            onSave={(v) => updateMedia("youtubeLink", v)}
            placeholder="https://youtube.com/…" detailed />
          <MediaUrlRow label="Instagram" value={m.instagramLink}
            onSave={(v) => updateMedia("instagramLink", v)}
            placeholder="https://instagram.com/…" detailed />
          <MediaUrlRow label="Match complet" value={m.fullGameVideo}
            onSave={(v) => updateMedia("fullGameVideo", v)}
            placeholder="https://…" detailed />
          <MediaUrlRow label="Entraînement" value={m.trainingVideo}
            onSave={(v) => updateMedia("trainingVideo", v)}
            placeholder="https://…" detailed />
        </Card>
      </div>
    );
  }
}

/* ═══════════════════════════════════════════════════════════════
   ROW PRIMITIVES + STAR + SUMMARY SHEET
═══════════════════════════════════════════════════════════════ */

// Card + DetailedTag moved to components/shared/wizard/rows (Sprint A).
// Imported at the top of this file ; behavior unchanged.

function RequiredDot() {
  return <span className="text-[#E63946] ml-0.5">*</span>;
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function AdvancedDivider() {
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="w-0.5 h-3 bg-[#E63946] rounded-full" />
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
        Détails supplémentaires
      </span>
    </div>
  );
}

/* PermissionSeedFooter removed — coach edits everything directly ;
   the green/yellow/red permission language is athlete-side only. */

// InlineEditRow + PickerRow + DateRow moved to
// components/shared/wizard/rows (Sprint A). Imported at the top.

function DualPickerRow({
  label, ftValue, inValue, onTapFt, onTapIn,
}: {
  label: string;
  ftValue: string;
  inValue: string;
  onTapFt: () => void;
  onTapIn: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] last:border-0">
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-4">
        <button type="button" onClick={onTapFt}>
          <span className={`${valueCls} ${ftValue ? "" : "text-white/30 font-normal"}`}>{ftValue || "—"}</span>
        </button>
        <button type="button" onClick={onTapIn}>
          <span className={`${valueCls} ${inValue ? "" : "text-white/30 font-normal"}`}>{inValue || "—"}</span>
        </button>
      </div>
    </div>
  );
}

// ReadOnlyRow + ToggleRow + ChipsBlock + TagInputRow moved to
// components/shared/wizard/rows (Sprint A). Imported at the top.

/* ═══════════════════════════════════════════════════════════════
   Unit toggle + height/weight display helpers
═══════════════════════════════════════════════════════════════ */

function UnitToggle<T extends string>({
  mode, onChange, options,
}: {
  mode: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 bg-[#13151a] rounded-2xl p-1 w-fit mx-auto">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
            mode === opt.value ? "bg-[#E63946] text-white" : "text-white/55"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function formatHeightDisplay(ft: string, inches: string, unitMode: "imperial" | "metric"): string {
  const ftN = parseInt(ft || "0");
  const inN = parseInt(inches || "0");
  if (!ft && !inches) return "";
  if (unitMode === "imperial") {
    if (ft && inches) return `${ftN}'${inN}"`;
    if (ft) return `${ftN}'`;
    return `${inN}"`;
  }
  // metric — display only ; storage stays in pi/po
  const cm = Math.round((ftN * 12 + inN) * 2.54);
  return cm > 0 ? `${cm} cm` : "";
}

function formatWeightDisplay(lbs: string, unitMode: "imperial" | "metric"): string {
  const lbsN = parseFloat(lbs || "0");
  if (!lbsN) return "";
  if (unitMode === "imperial") {
    return `${Number.isInteger(lbsN) ? lbsN.toFixed(0) : lbsN.toFixed(1)} lbs`;
  }
  const kg = Math.round(lbsN / 2.20462);
  return `${kg} kg`;
}

/* ═══════════════════════════════════════════════════════════════
   Distinction detail popup — bottom sheet replacing the old
   under-grid "Détail — X" dropdowns. Live-previews the badge as
   the coach types ; tappable stat chips for team_leader /
   league_leader. Writes to evaluations.distinctions JSONB via the
   existing updateBadgeDetail (no new save path, no custom_distinctions
   write).
═══════════════════════════════════════════════════════════════ */

function getLiveBadgeLabel(badgeKey: string, detail: string | undefined): string {
  const cfg = BADGE_CONFIG[badgeKey];
  if (!cfg) return detail || "";
  if (badgeKey === "custom") return detail || "Distinction";
  if (cfg.hasDetail && detail) return `${cfg.label} — ${detail}`;
  return cfg.label;
}

function DistinctionDetailSheet({
  badgeKey, entry, sportStats, onChange, onRemove, onClose,
}: {
  badgeKey: string | null;
  entry: DistinctionEntry | null;
  sportStats: string[];
  onChange: (detail: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !badgeKey || !entry) return null;
  if (typeof document === "undefined") return null;

  const cfg = BADGE_CONFIG[badgeKey];
  const draft = entry.detail || "";
  const livePreview = getLiveBadgeLabel(badgeKey, draft);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70]"
        style={{
          background: "rgba(0,0,0,0.6)",
          animation: "nx-modal-fade 200ms ease-out forwards",
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[70] bg-[#1A1D24] rounded-t-2xl flex flex-col"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          maxHeight: "85vh",
          animation: "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Live badge preview */}
        <div className="flex flex-col items-center gap-3 px-5 pt-3 pb-4 shrink-0">
          <DistinctionBadge badge={badgeKey} detail={draft || undefined} size="lg" />
          <p className="text-[14px] font-bold text-white text-center leading-tight">
            {livePreview}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {/* Tappable stat chips for team_leader / league_leader */}
          {sportStats.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/55 mb-2">
                Statistique
              </p>
              <div className="flex flex-wrap gap-2">
                {sportStats.map((s) => {
                  const sel = draft === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onChange(s)}
                      className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-colors ${
                        sel
                          ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
                          : "bg-transparent border border-white/[0.10] text-white/65 active:bg-white/[0.04]"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-white/45 mt-1.5">
                Ou tape ton propre titre ci-dessous.
              </p>
            </div>
          )}

          {/* Title / detail input */}
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/55 mb-2">
            {badgeKey === "custom" ? "Titre de la distinction" : "Précise"}
          </p>
          <input
            type="text"
            value={draft}
            onChange={(e) => onChange(e.target.value.slice(0, MAX_DETAIL_LENGTH))}
            maxLength={MAX_DETAIL_LENGTH}
            aria-label={badgeKey === "custom" ? "Titre" : "Détail"}
            placeholder={badgeKey === "custom" ? "Ex: Meilleur passeur RSEQ" : "Ex: Points"}
            autoFocus
            className="w-full bg-[#13151a] border border-white/[0.06] rounded-2xl px-4 py-3 text-[15px] text-white placeholder:text-white/30 focus:border-[#E63946]/40 outline-none"
          />
          <p className="text-right text-[11px] text-white/45 mt-1 tabular-nums">
            {draft.length} / {MAX_DETAIL_LENGTH}
          </p>

          {!cfg && (
            <p className="text-[12px] text-white/45 mt-2">
              Badge inconnu — la valeur sera quand même sauvegardée.
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-4 pt-2 pb-2 shrink-0 border-t border-white/[0.06] flex gap-3">
          <button
            type="button"
            onClick={onRemove}
            className="flex-1 h-12 rounded-2xl border border-white/[0.10] text-[13px] font-bold uppercase tracking-widest text-white/70 active:bg-white/[0.04]"
          >
            Retirer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl text-[13px] font-bold uppercase tracking-widest bg-[#E63946] text-white active:bg-[#D42B22] shadow-[0_4px_16px_rgba(230,57,70,0.35)]"
          >
            Terminé
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

// MediaUrlRow moved to components/shared/wizard/rows (Sprint A).
// Imported at the top.

function StarRow({
  value, onChange, size = 26, allowHalf = false,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  /** If true, tapping the LEFT half of a star sets the .5 value
   *  (e.g. tapping the left half of the 4th star sets 3.5). */
  allowHalf?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const starIndex = i + 1;
        const filled = value >= starIndex;
        const half = !filled && value >= starIndex - 0.5;
        const clipId = `nx-halfstar-${i}-${size}`;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              if (allowHalf) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const next = x < rect.width / 2 ? starIndex - 0.5 : starIndex;
                onChange(value === next ? 0 : next);
              } else {
                onChange(value === starIndex ? 0 : starIndex);
              }
            }}
            className="active:scale-90 transition-transform relative"
            style={{ width: size, height: size }}
            aria-label={`${starIndex} étoile${starIndex > 1 ? "s" : ""}`}
          >
            {/* Empty background */}
            <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 24 24"
              fill="#374151" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {filled && (
              <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 24 24"
                fill="#F59E0B" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            )}
            {half && (
              <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 24 24"
                fill="none" stroke="none">
                <defs>
                  <clipPath id={clipId}>
                    <rect x="0" y="0" width="12" height="24" />
                  </clipPath>
                </defs>
                <polygon
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  fill="#F59E0B"
                  clipPath={`url(#${clipId})`}
                />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══ Summary sheet ═══════════════════════════════════════════ */

interface SummarySheetProps {
  open: boolean;
  onClose: () => void;
  isCreate: boolean;
  form: AthleteFormData;
  diff: { label: string; old: string; new: string }[];
  missingRequired: string[];
  onConfirm: () => void;
  saving: boolean;
  onJumpToSlide: (i: number) => void;
  onToggleConsent: () => void;
  onTogglePartner: (next: boolean) => void;
}

function SummarySheet({
  open, onClose, isCreate, form, diff, missingRequired,
  onConfirm, saving, onJumpToSlide, onToggleConsent, onTogglePartner,
}: SummarySheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open) return null;

  const missingFieldToSlide = (field: string): number => {
    const step1 = ["Prénom", "Nom", "Date de naissance", "Promotion", "Genre", "École", "Ville", "Région"];
    const step4 = ["Sport principal", "Position principale", "Numéro", "Équipe"];
    if (step1.includes(field)) return 0;
    if (step4.includes(field)) return 3;
    return 0;
  };

  const canConfirmCreate = missingRequired.length === 0 && form.parentalConsent;
  const canConfirmEdit = !saving;
  const canConfirm = isCreate ? canConfirmCreate : canConfirmEdit;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80] bg-black/60"
        onClick={onClose}
        style={{ animation: "nx-modal-fade 200ms ease-out forwards" }} />
      <div
        className="fixed inset-x-0 bottom-0 z-[80] bg-[#111317] rounded-t-2xl flex flex-col"
        style={{
          maxHeight: "88vh",
          paddingBottom: "env(safe-area-inset-bottom)",
          animation: "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <div className="flex justify-center py-2 shrink-0">
          <div className="w-9 h-1 rounded-full bg-white/[0.18]" />
        </div>

        <div className="px-5 pb-3 shrink-0 flex items-center justify-between">
          <h2 className="font-head text-[18px] font-black text-white uppercase tracking-tight">
            {isCreate ? "Créer le profil" : "Modifications"}
          </h2>
          <button type="button" onClick={onClose}
            className="w-10 h-10 rounded-full active:bg-white/[0.05] flex items-center justify-center"
            aria-label="Fermer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {/* CREATE → grouped summary */}
          {isCreate && (
            <CreateSummary form={form}
              onToggleConsent={onToggleConsent}
              onTogglePartner={onTogglePartner} />
          )}

          {/* EDIT → diff or "no changes" */}
          {!isCreate && (
            <div className="space-y-2">
              {diff.length === 0 ? (
                <p className="text-[14px] text-white/55 text-center py-8">Aucune modification.</p>
              ) : (
                diff.map((row, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-[#1A1D24] border border-white/[0.06]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/45 mb-1">{row.label}</p>
                    <p className="text-[13px] text-white/55 line-through">{row.old}</p>
                    <p className="text-[14px] font-semibold text-white mt-0.5">{row.new}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CREATE → missing required block */}
          {isCreate && missingRequired.length > 0 && (
            <div className="mt-4 p-4 rounded-2xl bg-[#E63946]/10 border border-[#E63946]/30">
              <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-[#E63946] mb-2">
                Champs requis manquants
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingRequired.map((f) => (
                  <button key={f} type="button"
                    onClick={() => onJumpToSlide(missingFieldToSlide(f))}
                    className="px-3 py-1.5 rounded-full text-[12px] font-bold bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30 active:bg-[#E63946]/25">
                    {f}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/55 mt-3">
                Tape un champ pour aller le compléter. Le profil ne sera pas créé tant qu&apos;il en manque.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-2 shrink-0 border-t border-white/[0.06] flex items-center gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 h-12 rounded-2xl border border-white/[0.10] text-[14px] font-bold uppercase tracking-widest text-white/70 active:bg-white/[0.04]">
            Annuler
          </button>
          <button type="button"
            onClick={onConfirm}
            disabled={!canConfirm || saving}
            className={`flex-1 h-12 rounded-2xl text-[14px] font-bold uppercase tracking-widest transition-all ${
              canConfirm && !saving
                ? "bg-[#E63946] text-white active:bg-[#D42B22] shadow-[0_4px_16px_rgba(230,57,70,0.35)]"
                : "bg-white/[0.06] text-white/40 cursor-not-allowed"
            }`}>
            {saving ? "Enregistrement…" : isCreate ? "Créer le profil" : "Oui, enregistrer"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function CreateSummary({
  form, onToggleConsent, onTogglePartner,
}: {
  form: AthleteFormData;
  onToggleConsent: () => void;
  onTogglePartner: (next: boolean) => void;
}) {
  const sections: { title: string; rows: { label: string; value: string }[] }[] = [
    {
      title: "Identité",
      rows: [
        { label: "Nom", value: `${form.identity.firstName} ${form.identity.lastName}`.trim() },
        { label: "Date de naissance", value: form.identity.dateOfBirth },
        { label: "Promotion", value: form.identity.gradYear },
        { label: "Genre", value: form.identity.gender === "M" ? "Masculin" : form.identity.gender === "F" ? "Féminin" : form.identity.gender === "X" ? "Non genré" : "" },
        { label: "École", value: form.identity.school },
        { label: "Ville", value: form.identity.city },
        { label: "Région", value: form.identity.region },
        { label: "Courriel", value: form.identity.email },
        { label: "Téléphone", value: form.identity.phone },
      ],
    },
    {
      title: "Académique",
      rows: [
        { label: "Moyenne", value: form.academic.gpa ? `${form.academic.gpa}%` : "" },
        { label: "Programme", value:
          form.academic.cegepType === "dec_general" ? "DEC général"
          : form.academic.cegepType === "technique" ? `Technique${form.academic.cegepProgramDetail ? ` — ${form.academic.cegepProgramDetail}` : ""}`
          : "" },
        { label: "Matières fortes", value: (form.academic.strongSubjects || []).join(", ") },
        { label: "Régions préférées", value: (form.academic.cegepRegions || []).join(", ") },
      ],
    },
    {
      title: "Physique",
      rows: [
        { label: "Taille", value: form.physical.heightFeet && form.physical.heightInches ? `${form.physical.heightFeet}'${form.physical.heightInches}"` : "" },
        { label: "Poids", value: form.physical.weightLbs ? `${form.physical.weightLbs} lbs` : "" },
        { label: "Main dominante", value: form.physical.dominantHand },
      ],
    },
    {
      title: "Sport",
      rows: [
        { label: "Sport principal", value: form.sports.primarySport },
        { label: "Position", value: `${form.sports.primaryPosition}${form.sports.secondaryPosition ? ` / ${form.sports.secondaryPosition}` : ""}` },
        { label: "Numéro", value: form.sports.jerseyNumber },
        { label: "Équipe", value: form.sports.currentTeam },
      ],
    },
    {
      title: "Évaluation",
      rows: [
        { label: "Mode", value: form.scouting.evalMode === "detailed" ? "Détaillé" : "Simplifié" },
        { label: "Cote étoile", value: form.scouting.starRating ? String(form.scouting.starRating) : "" },
        { label: "Distinctions", value: form.scouting.badges.map((b) => BADGE_CONFIG[b.badge]?.label || b.badge).join(", ") },
      ],
    },
    {
      title: "Médias",
      rows: [
        { label: "Faits saillants", value: form.media.highlightVideo },
        { label: "Hudl", value: form.media.hudlLink },
        { label: "YouTube", value: form.media.youtubeLink },
      ],
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map((sec) => {
        const filled = sec.rows.filter((r) => r.value);
        if (filled.length === 0) return null;
        return (
          <div key={sec.title} className="p-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45 mb-3">{sec.title}</p>
            <div className="space-y-1.5">
              {filled.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 py-1 border-b border-white/[0.04] last:border-0">
                  <span className="text-[12px] text-white/55">{row.label}</span>
                  <span className="text-[13px] text-white font-semibold text-right truncate ml-2">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Consents (CREATE only — legally required) */}
      <div className="p-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06]">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45 mb-3">Consentements</p>
        <p className="text-[12px] text-white/55 mb-3">
          Le consentement parental est requis (Loi 25) avant de créer le profil.
        </p>
        <button type="button" onClick={onToggleConsent}
          className={`w-full flex items-center gap-3 p-3 rounded-2xl border ${
            form.parentalConsent ? "border-[#E63946]/40 bg-[#E63946]/[0.06]" : "border-white/[0.06]"
          }`}>
          <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
            form.parentalConsent ? "bg-[#E63946] border-[#E63946]" : "border-white/[0.18]"
          }`}>
            {form.parentalConsent && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </span>
          <span className="text-[14px] text-white text-left">Consentement parental confirmé *</span>
        </button>
        <div className="mt-3">
          <PartnerVisibilityConsentCard
            audience="coach"
            checked={form.partnerVisibilityConsent}
            onChange={onTogglePartner} />
        </div>
      </div>
    </div>
  );
}
