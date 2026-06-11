"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteWizardMobile — Coach Athlete CREATE + EDIT (unified)

   ONE component, mode-gated. Replaces the mobile drift between
   the desktop /coach/athletes/create and /coach/athletes/[id]/modifier
   pages — both lands here on Capacitor.

   - 7 slides : Identité · Académique · Physique · Sport ·
     Évaluation · Médias · Révision
   - Shell cloned from CoachOnboardingMobileSchool.tsx (sticky
     header + step label + progress dots + scrollable + fixed CTA
     + safe-area)
   - AnimatePresence cross-slide transition (x:50→0→-50, opacity)
   - Pickers : MobilePicker (sport/gender/promo/dominant hand…),
     SearchSheet (école engagée CÉGEP, équipe coach)
   - useMobileToast + triggerHaptic on advance/finish

   Mode gates :
   - CREATE-only : Step 1 orphan-email autocomplete + claim/invite,
     Step 7 PartnerVisibilityConsentCard, parental-consent submit gate,
     create-only athletes cols (coach_id, school_id, telephone,
     nom_parent, telephone_parent, status='ACTIF', verified=false,
     profile_completion, partner_visibility_*)
   - EDIT-only : Step 1 « Statut de recrutement » card,
     recruitment_status block in submit (recruitment_status,
     committed_school_id, recruitment_status_changed_by/_at)

   Fixes applied during unification :
   1. COTE AUTO-AVERAGE in detailed mode runs in BOTH modes (Create
      was missing it)
   2. CONSENT GUARD : in EDIT, consentement_parental writes ONLY when
      the user explicitly toggles it this session — never silently
      flips a stored TRUE back to false on save.

   Never touches `verified` (Create sets verified=false once at
   INSERT; Edit doesn't write it). open_to_offers : preserve the
   raw value from load and write it back unchanged in EDIT — no UI.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { SearchSheet } from "@/components/mobile/SearchSheet";
import { useMobileToast } from "@/components/mobile/MobileToast";
import PartnerVisibilityConsentCard from "@/components/shared/PartnerVisibilityConsentCard";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import {
  BADGE_CONFIG, BADGE_ORDER, MAX_BADGES, MAX_DETAIL_LENGTH,
  getSportStats, parseDistinctions,
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

/* ── Constantes (alignées sur desktop wizard) ────────────────── */

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

/* ── Tokens canon ───────────────────────────────────────────── */
const inputCls = "w-full bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-[#E63946]/40 transition-colors";
const labelCls = "block uppercase mb-1.5 text-[12px] font-bold tracking-[0.18em] text-[#B6BCC7]";
const sectionLabel = "uppercase text-[11px] font-bold tracking-[0.2em] text-white/45 mt-6 mb-2";
const pickerBtnCls = "w-full text-left bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 text-[16px] text-white active:bg-white/[0.03] transition-colors flex items-center justify-between";

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

const TOTAL_SLIDES = 7;
const SLIDE_LABELS = ["Identité", "Académique", "Physique", "Sport", "Évaluation", "Médias", "Révision"];

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
  // open_to_offers : LEGACY — we preserve raw value, no UI.
  const openToOffersRef = useRef<boolean | null>(null);

  /* ── Consent baseline (Loi 25 guard) ─────────────────────
     Stored value at load time. The shared save layer diffs the form's
     current `parentalConsent` against this baseline and only writes
     the consent cols when they differ — a stored TRUE is never
     silently flipped back to FALSE. */
  const consentBaselineRef = useRef<boolean>(false);

  /* ── CREATE-only : orphan-email autocomplete + invite flow ─ */
  const [emailAutocomplete, setEmailAutocomplete] = useState<AthleteEmailAutocompleteResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [linkedToExisting, setLinkedToExisting] = useState<AthleteEmailSuggestion | null>(null);
  const [invitationTeamId, setInvitationTeamId] = useState<string | null>(null);
  const [isSubmittingInvitation, setIsSubmittingInvitation] = useState(false);
  const emailAutocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Picker open state ──────────────────────────────────── */
  const [openSportPicker, setOpenSportPicker] = useState(false);
  const [openSecondarySportPicker, setOpenSecondarySportPicker] = useState(false);
  const [openGenderPicker, setOpenGenderPicker] = useState(false);
  const [openPromoPicker, setOpenPromoPicker] = useState(false);
  const [openHeightFtPicker, setOpenHeightFtPicker] = useState(false);
  const [openHeightInPicker, setOpenHeightInPicker] = useState(false);
  const [openDominantHandPicker, setOpenDominantHandPicker] = useState(false);
  const [openDominantFootPicker, setOpenDominantFootPicker] = useState(false);
  const [openPrimaryPosPicker, setOpenPrimaryPosPicker] = useState(false);
  const [openSecondaryPosPicker, setOpenSecondaryPosPicker] = useState(false);
  const [openRecruitmentStatusPicker, setOpenRecruitmentStatusPicker] = useState(false);
  const [openRecruitingOverridePicker, setOpenRecruitingOverridePicker] = useState(false);
  const [openCegepPicker, setOpenCegepPicker] = useState(false);
  const [openTeamPicker, setOpenTeamPicker] = useState(false);
  const [openInviteTeamPicker, setOpenInviteTeamPicker] = useState(false);

  /* ── Sheet search input values ──────────────────────────── */
  const [cegepSearch, setCegepSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");

  /* ─────────────────────────────────────────────────────────
     MOUNT FADE (matches onboarding shells)
  ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 16);
    return () => clearTimeout(t);
  }, []);

  /* ─────────────────────────────────────────────────────────
     LOAD coach context (always) + athlete pre-fill (edit only)
  ───────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Coach school + teams
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

      // School info onto form (read-only chip on Step 1 detailed)
      setForm((prev) => ({
        ...prev,
        identity: {
          ...prev.identity,
          school: school?.name || prev.identity.school,
          city: school?.city || prev.identity.city,
          region: school?.region || prev.identity.region,
        },
      }));

      // CEGEP list — only needed for EDIT committed-school picker.
      if (isEdit) {
        const { data: cegepRows } = await supabase
          .from("schools")
          .select("id, name, city, region")
          .eq("type", "CEGEP")
          .order("name");
        if (!cancelled && cegepRows) setCegepSchools(cegepRows as SchoolRow[]);
      }

      // EDIT pre-fill
      if (isEdit && athleteId) {
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
        if (cancelled) return;
        // buildFormFromRaw doesn't carry partnerVisibilityConsent — default false
        setForm({ ...formFromDB, partnerVisibilityConsent: false });

        if (raw.recruitment_status) setRecruitmentStatus(raw.recruitment_status as string);
        if (raw.committed_school_id) setCommittedSchoolId(raw.committed_school_id as string);
        const cs = raw.committed_school as { name?: string } | { name?: string }[] | null;
        const csObj = Array.isArray(cs) ? cs[0] : cs;
        if (csObj?.name) setCommittedSchoolName(csObj.name);
        openToOffersRef.current = (raw.open_to_offers as boolean | null) ?? null;
        consentBaselineRef.current = !!(raw.consentement_parental);

        // Resolve athlete's current team assignment
        const taRel = raw.team_athletes as unknown;
        const ta = (Array.isArray(taRel) ? taRel[0] : taRel) as { team_id?: string } | null;
        const currentTeamId = ta?.team_id;
        if (currentTeamId) {
          const matched = teams.find((t) => t.id === currentTeamId);
          if (matched) {
            setForm((prev) => ({
              ...prev,
              sports: {
                ...prev.sports,
                selectedTeamId: matched.id,
                currentTeam: matched.name,
                teamLevel: matched.level,
                teamDivision: matched.division,
                league: matched.league,
              },
            }));
          }
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, athleteId]);

  /* ─────────────────────────────────────────────────────────
     EMAIL AUTOCOMPLETE (CREATE only)
  ───────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────
     PHOTO UPLOAD
  ───────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────
     UPDATERS
  ───────────────────────────────────────────────────────── */
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

  /* ── Badges ────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────
     VALIDATION
  ───────────────────────────────────────────────────────── */
  function canProceed(currentSlide: number): boolean {
    const step = currentSlide + 1;
    switch (step) {
      case 1: {
        const d = form.identity;
        const base = !!(d.firstName && d.lastName && d.dateOfBirth && d.gradYear);
        if (d.identityMode === "detailed") {
          // Create requires city/region too; Edit only gender/school
          return base && !!d.gender && !!d.school && (isCreate ? !!d.city && !!d.region : true);
        }
        return base;
      }
      case 4: {
        const s = form.sports;
        if (isCreate) {
          return !!(s.primarySport && s.jerseyNumber && (s.selectedTeamId || s.currentTeam));
        }
        const base = !!(s.primarySport && s.primaryPosition && s.jerseyNumber);
        return s.sportsMode === "detailed" ? base && !!(s.selectedTeamId || s.currentTeam) : base;
      }
      case 7:
        // CREATE only — Loi 25 parental consent gate
        return isCreate ? form.parentalConsent : true;
      default:
        return true;
    }
  }

  /* ─────────────────────────────────────────────────────────
     NAVIGATION
  ───────────────────────────────────────────────────────── */
  const goBack = useCallback(() => {
    if (slide === 0) { router.back(); return; }
    setDirection(-1);
    setSlide((s) => s - 1);
    triggerHaptic("Light");
  }, [slide, router]);

  const goNext = useCallback(() => {
    if (!canProceed(slide)) {
      toast.warning({ message: "Champs requis manquants" });
      return;
    }
    if (slide >= TOTAL_SLIDES - 1) return;
    setDirection(1);
    setSlide((s) => s + 1);
    triggerHaptic("Light");
  }, [slide, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─────────────────────────────────────────────────────────
     SUBMIT (mode-gated verbs)
  ───────────────────────────────────────────────────────── */
  const handleFinish = useCallback(async () => {
    if (!canProceed(TOTAL_SLIDES - 1)) {
      toast.warning({ message: isCreate ? "Consentement parental requis" : "Champs requis manquants" });
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

    // Shared save layer — owns the cote auto-average + the consent
    // guard. See app/coach/athletes/_data/saveAthlete.ts.
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
    router.push(isCreate ? "/coach/athletes" : `/coach/athletes/${savedId}`);
  }, [
    canProceed, isCreate, form, athleteId, recruitmentStatus,
    committedSchoolId, coach.schoolId, router, toast,
  ]);

  /* ─────────────────────────────────────────────────────────
     DERIVED — picker options
  ───────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────
     RENDER : SHELL
  ───────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#111317] text-white flex items-center justify-center">
        <p className="text-[14px] text-[#6b7280]">Chargement…</p>
      </div>
    );
  }

  const isLast = slide === TOTAL_SLIDES - 1;
  const canFinish = canProceed(TOTAL_SLIDES - 1);

  /* ── Chip-row navigation (Fix 3) ─────────────────────────────
     Free-jump in EDIT (every chip reachable). In CREATE, allow
     jumping BACK at will and AHEAD only if all prior steps pass
     canProceed. Memo over `form` so the chip enables don't recompute
     per chip render. */
  const reachableSlides = useMemo(() => {
    if (isEdit) return Array(TOTAL_SLIDES).fill(true);
    return Array.from({ length: TOTAL_SLIDES }, (_, i) =>
      Array.from({ length: i }, (_, k) => canProceed(k)).every(Boolean)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, form]);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [slide]);

  return (
    <div
      className="min-h-screen bg-[#111317] text-white flex flex-col"
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 400ms ease-out" }}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Row 1 — back + compact title */}
        <div className="flex items-center px-4 pt-2 gap-2 min-h-[56px]">
          <button
            type="button"
            onClick={goBack}
            aria-label="Retour"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0"
          >
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
        {/* Row 2 — horizontal-scroll chip row (Fix 3, replaces passive dots).
            Tap any reachable chip to jump. Locked-ahead chips (CREATE only)
            stay dimmed and non-tappable. The active chip auto-centers via
            scrollIntoView (useEffect on `slide`). */}
        <div
          className="overflow-x-auto px-4 pt-1 pb-3"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex items-center gap-1.5">
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
                <button
                  key={i}
                  type="button"
                  ref={isCurrent ? activeChipRef : null}
                  onClick={() => { if (reachable) { setDirection(i > slide ? 1 : -1); setSlide(i); } }}
                  disabled={!reachable}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] whitespace-nowrap transition-colors ${chipCls}`}
                >
                  {i + 1}. {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scrollable content with slide transition */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 104px)" }}
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={slide}
            custom={direction}
            initial={(d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 })}
            animate={{ x: 0, opacity: 1 }}
            exit={(d: number) => ({ x: d > 0 ? -50 : 50, opacity: 0 })}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="px-4 py-5"
          >
            {slide === 0 && renderStep1()}
            {slide === 1 && renderStep2()}
            {slide === 2 && renderStep3()}
            {slide === 3 && renderStep4()}
            {slide === 4 && renderStep5()}
            {slide === 5 && renderStep6()}
            {slide === 6 && renderStep7()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Fixed bottom CTA */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 bg-[#111317]/95 backdrop-blur-md border-t border-white/[0.06] px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        {!isLast ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canProceed(slide)}
            className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all ${
              canProceed(slide)
                ? "bg-[#E63946] text-white active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)]"
                : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
            }`}
          >
            Continuer
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            disabled={!canFinish || saving}
            className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              canFinish && !saving
                ? "bg-[#E63946] text-white active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)]"
                : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                Enregistrement…
              </>
            ) : isCreate ? (
              "Créer le profil"
            ) : (
              "Enregistrer"
            )}
          </button>
        )}
      </div>

      {/* ═══════════ Pickers (portal to body) ═══════════════════ */}
      <MobilePicker
        open={openSportPicker}
        onClose={() => setOpenSportPicker(false)}
        title="Sport principal"
        options={SPORTS.map((s) => ({ value: s, label: s }))}
        value={form.sports.primarySport || null}
        onChange={(v) => updateSports("primarySport", v ? String(v) : "")}
      />
      <MobilePicker
        open={openSecondarySportPicker}
        onClose={() => setOpenSecondarySportPicker(false)}
        title="Sport secondaire"
        options={[{ value: "", label: "Aucun" }, ...SPORTS.map((s) => ({ value: s, label: s }))]}
        value={form.sports.secondarySport || ""}
        onChange={(v) => updateSports("secondarySport", v ? String(v) : "")}
      />
      <MobilePicker
        open={openGenderPicker}
        onClose={() => setOpenGenderPicker(false)}
        title="Genre"
        options={[
          { value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }, { value: "X", label: "Non genré" },
        ]}
        value={form.identity.gender || null}
        onChange={(v) => updateIdentity("gender", v ? String(v) : "")}
      />
      <MobilePicker
        open={openPromoPicker}
        onClose={() => setOpenPromoPicker(false)}
        title="Promotion"
        options={[2025, 2026, 2027, 2028, 2029].map((y) => ({ value: String(y), label: String(y) }))}
        value={form.identity.gradYear || null}
        onChange={(v) => updateIdentity("gradYear", v ? String(v) : "")}
      />
      <MobilePicker
        open={openHeightFtPicker}
        onClose={() => setOpenHeightFtPicker(false)}
        title="Pieds"
        options={[4, 5, 6, 7].map((f) => ({ value: String(f), label: `${f}'` }))}
        value={form.physical.heightFeet || null}
        onChange={(v) => updatePhysical("heightFeet", v ? String(v) : "")}
      />
      <MobilePicker
        open={openHeightInPicker}
        onClose={() => setOpenHeightInPicker(false)}
        title="Pouces"
        options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i}"` }))}
        value={form.physical.heightInches || null}
        onChange={(v) => updatePhysical("heightInches", v ? String(v) : "")}
      />
      <MobilePicker
        open={openDominantHandPicker}
        onClose={() => setOpenDominantHandPicker(false)}
        title="Main dominante"
        options={[{ value: "Droite", label: "Droite" }, { value: "Gauche", label: "Gauche" }, { value: "Ambidextre", label: "Ambidextre" }]}
        value={form.physical.dominantHand || null}
        onChange={(v) => updatePhysical("dominantHand", v ? String(v) : "")}
      />
      <MobilePicker
        open={openDominantFootPicker}
        onClose={() => setOpenDominantFootPicker(false)}
        title="Pied dominant"
        options={[{ value: "Droit", label: "Droit" }, { value: "Gauche", label: "Gauche" }, { value: "Les deux", label: "Les deux" }]}
        value={form.physical.dominantFoot || null}
        onChange={(v) => updatePhysical("dominantFoot", v ? String(v) : "")}
      />
      <MobilePicker
        open={openPrimaryPosPicker}
        onClose={() => setOpenPrimaryPosPicker(false)}
        title="Position principale"
        options={primaryPositions}
        value={form.sports.primaryPosition || null}
        onChange={(v) => updateSports("primaryPosition", v ? String(v) : "")}
      />
      <MobilePicker
        open={openSecondaryPosPicker}
        onClose={() => setOpenSecondaryPosPicker(false)}
        title="Position secondaire"
        options={primaryPositions}
        value={form.sports.secondaryPosition || null}
        onChange={(v) => updateSports("secondaryPosition", v ? String(v) : "")}
      />
      <MobilePicker
        open={openRecruitmentStatusPicker}
        onClose={() => setOpenRecruitmentStatusPicker(false)}
        title="Statut de recrutement"
        options={RECRUITMENT_STATUS_OPTIONS}
        value={recruitmentStatus}
        onChange={(v) => {
          const next = v ? String(v) : "OUVERT";
          setRecruitmentStatus(next);
          if (next !== "RECRUTE") {
            setCommittedSchoolId("");
            setCommittedSchoolName("");
          }
        }}
      />
      <MobilePicker
        open={openRecruitingOverridePicker}
        onClose={() => setOpenRecruitingOverridePicker(false)}
        title="Statut (override)"
        options={RECRUITING_OVERRIDE_OPTIONS}
        value={form.submission.recruitingStatus || ""}
        onChange={(v) => updateSubmission("recruitingStatus", v ? String(v) : "")}
      />

      {/* SearchSheet — CÉGEP d'engagement (EDIT only) */}
      <SearchSheet<SchoolRow>
        open={openCegepPicker}
        onClose={() => setOpenCegepPicker(false)}
        title="CÉGEP d'engagement"
        searchPlaceholder="Rechercher un CÉGEP…"
        searchValue={cegepSearch}
        onSearchChange={setCegepSearch}
        items={visibleCegep}
        keyOf={(s) => s.id}
        onSelect={(s) => {
          setCommittedSchoolId(s.id);
          setCommittedSchoolName(s.name);
        }}
        renderItem={(s, onTap) => (
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">{s.name}</p>
            {s.city && <p className="text-[13px] text-white/55 truncate">{s.city}</p>}
          </button>
        )}
      />

      {/* SearchSheet — Équipe du coach */}
      <SearchSheet<CoachTeam>
        open={openTeamPicker}
        onClose={() => setOpenTeamPicker(false)}
        title="Équipe"
        searchPlaceholder="Rechercher une équipe…"
        searchValue={teamSearch}
        onSearchChange={setTeamSearch}
        items={visibleTeams}
        keyOf={(t) => t.id}
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
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">{t.name}</p>
            {t.level && <p className="text-[13px] text-white/55 truncate">{t.level}</p>}
          </button>
        )}
      />

      {/* SearchSheet — Équipe pour l'invitation (CREATE-only, linked flow) */}
      <SearchSheet<CoachTeam>
        open={openInviteTeamPicker}
        onClose={() => setOpenInviteTeamPicker(false)}
        title="Inviter sur quelle équipe ?"
        searchPlaceholder="Rechercher…"
        searchValue={teamSearch}
        onSearchChange={setTeamSearch}
        items={visibleTeams}
        keyOf={(t) => t.id}
        onSelect={(t) => setInvitationTeamId(t.id)}
        renderItem={(t, onTap) => (
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">{t.name}</p>
            {t.level && <p className="text-[13px] text-white/55 truncate">{t.level}</p>}
          </button>
        )}
      />
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     STEP RENDERERS (inline siblings — Slide pattern)
  ═══════════════════════════════════════════════════════════ */

  function ModeToggle({ mode: m, onChange }: { mode: "simple" | "detailed"; onChange: (m: "simple" | "detailed") => void }) {
    return (
      <div className="flex items-center gap-1 bg-[#1A1D24] rounded-2xl p-1 w-fit mb-4">
        {(["simple", "detailed"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-[0.12em] transition-colors ${
              m === opt ? "bg-[#E63946] text-white" : "text-white/55"
            }`}
          >
            {opt === "simple" ? "Simplifié" : "Détaillé"}
          </button>
        ))}
      </div>
    );
  }

  function StarRow({ value, onChange, size = 26 }: { value: number; onChange: (n: number) => void; size?: number }) {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => {
          const filled = value >= i + 1;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(value === i + 1 ? 0 : i + 1)}
              className="active:scale-90 transition-transform"
              aria-label={`${i + 1} étoile`}
            >
              <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#F59E0B" : "#374151"} stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          );
        })}
      </div>
    );
  }

  /* ─── Step 1 : Identité ───────────────────────────────── */
  function renderStep1() {
    const d = form.identity;
    const isDetailed = d.identityMode === "detailed";
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Identité</h2>
          <p className="text-[13px] text-white/55 mt-1">Informations personnelles de base</p>
        </div>
        <ModeToggle mode={d.identityMode} onChange={(m) => updateIdentity("identityMode", m)} />

        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {d.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.photo} alt="" className="w-[88px] h-[88px] rounded-2xl object-cover border border-white/[0.06]" />
            ) : (
              <div className="w-[88px] h-[88px] rounded-2xl bg-[#1A1D24] border border-dashed border-white/[0.12] flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/0 active:bg-black/40 rounded-2xl cursor-pointer">
              <input type="file" accept="image/*" className="sr-only"
                onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-white">Photo</p>
            <p className="text-[12px] text-white/50">{photoUploading ? "Téléversement…" : "Tape pour ajouter"}</p>
            {d.photo && (
              <button type="button" onClick={() => updateIdentity("photo", "")} className="mt-1 text-[12px] text-[#E63946] font-bold">
                Retirer
              </button>
            )}
          </div>
        </div>

        <div>
          <label className={labelCls}>Prénom *</label>
          <input className={inputCls} value={d.firstName} onChange={(e) => updateIdentity("firstName", e.target.value)} placeholder="Prénom" />
        </div>
        <div>
          <label className={labelCls}>Nom *</label>
          <input className={inputCls} value={d.lastName} onChange={(e) => updateIdentity("lastName", e.target.value)} placeholder="Nom" />
        </div>
        <div>
          <label className={labelCls}>Date de naissance *</label>
          <input type="date" className={inputCls} value={d.dateOfBirth} onChange={(e) => updateIdentity("dateOfBirth", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Promotion *</label>
          <button type="button" className={pickerBtnCls} onClick={() => setOpenPromoPicker(true)}>
            <span className={d.gradYear ? "" : "text-white/40"}>{d.gradYear || "Sélectionner"}</span>
            <ChevronDown />
          </button>
        </div>

        {/* CREATE-only : email + orphan autocomplete */}
        {isCreate && (
          <div>
            <label className={labelCls}>
              Courriel de l&apos;athlète
              <span className="ml-2 text-[10px] font-bold tracking-[0.15em] uppercase text-white/40">· Non visible aux recruteurs</span>
            </label>
            <input
              type="email"
              className={inputCls}
              value={d.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              autoComplete="off"
              placeholder="athlete@email.com"
            />
            {showSuggestions && emailAutocomplete?.suggestions && emailAutocomplete.suggestions.length > 0 && (
              <div className="mt-2 rounded-2xl bg-[#1A1D24] border border-[#E63946]/30 overflow-hidden">
                <div className="px-4 py-2 text-[11px] text-white/55 border-b border-white/[0.08]">
                  Comptes Nexus existants
                </div>
                {emailAutocomplete.suggestions.map((s) => (
                  <button
                    key={s.athleteId}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-4 py-3 active:bg-[#E63946]/10 border-b border-white/[0.06] last:border-b-0"
                  >
                    <p className="text-[14px] font-semibold text-white">{s.firstName} {s.lastName}</p>
                    <p className="text-[12px] text-white/55">{s.email}{s.sportName ? ` · ${s.sportName}` : ""}</p>
                  </button>
                ))}
              </div>
            )}
            {linkedToExisting && (
              <div className="mt-3 p-3 rounded-2xl bg-[#1A1D24] border border-[#E63946]/30">
                <div className="flex items-start gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white">
                      Lié à {linkedToExisting.firstName} {linkedToExisting.lastName}
                    </p>
                    <p className="text-[12px] text-white/55 mt-0.5">Envoie une invitation à rejoindre ton équipe.</p>
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => coach.teams.length > 1 ? setOpenInviteTeamPicker(true) : null}
                        className={pickerBtnCls}
                      >
                        <span className={invitationTeamId ? "" : "text-white/40"}>
                          {invitationTeamId
                            ? coach.teams.find((t) => t.id === invitationTeamId)?.name ?? "Équipe sélectionnée"
                            : "Choisir une équipe"}
                        </span>
                        <ChevronDown />
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setLinkedToExisting(null)}
                          className="flex-1 h-11 rounded-2xl border border-white/[0.10] text-[13px] font-bold text-white/70 active:bg-white/[0.04]"
                        >
                          Délier
                        </button>
                        <button
                          type="button"
                          onClick={handleSendInvitation}
                          disabled={!invitationTeamId || isSubmittingInvitation}
                          className={`flex-1 h-11 rounded-2xl text-[13px] font-bold ${
                            invitationTeamId && !isSubmittingInvitation
                              ? "bg-[#E63946] text-white active:bg-[#D42B22]"
                              : "bg-white/[0.06] text-white/40 cursor-not-allowed"
                          }`}
                        >
                          {isSubmittingInvitation ? "Envoi…" : "Inviter"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isDetailed && (
          <>
            <p className={sectionLabel}>Détails additionnels</p>
            <div>
              <label className={labelCls}>Genre *</label>
              <button type="button" className={pickerBtnCls} onClick={() => setOpenGenderPicker(true)}>
                <span className={d.gender ? "" : "text-white/40"}>
                  {d.gender === "M" ? "Masculin" : d.gender === "F" ? "Féminin" : d.gender === "X" ? "Non genré" : "Sélectionner"}
                </span>
                <ChevronDown />
              </button>
            </div>
            <div>
              <label className={labelCls}>École secondaire</label>
              <input className={`${inputCls} opacity-70`} value={d.school} readOnly />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ville</label>
                <input className={`${inputCls} opacity-70`} value={d.city} readOnly />
              </div>
              <div>
                <label className={labelCls}>Région</label>
                <input className={`${inputCls} opacity-70`} value={d.region} readOnly />
              </div>
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input type="tel" inputMode="tel" className={inputCls} value={d.phone} onChange={(e) => updateIdentity("phone", e.target.value)} placeholder="(514) 000-0000" />
            </div>
            <p className={sectionLabel}>Contact parent</p>
            <div>
              <label className={labelCls}>Nom du parent</label>
              <input className={inputCls} value={d.parentName} onChange={(e) => updateIdentity("parentName", e.target.value)} placeholder="Nom complet" />
            </div>
            <div>
              <label className={labelCls}>Téléphone du parent</label>
              <input type="tel" inputMode="tel" className={inputCls} value={d.parentPhone} onChange={(e) => updateIdentity("parentPhone", e.target.value)} placeholder="(514) 000-0000" />
            </div>
          </>
        )}

        {/* EDIT-only : Statut de recrutement card */}
        {isEdit && (
          <div className="mt-6 p-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06]">
            <p className="text-[14px] font-bold text-white">Statut de recrutement</p>
            <p className="text-[12px] text-white/55 mt-1 mb-3">Situation actuelle de l&apos;athlète dans le processus.</p>
            <button type="button" className={pickerBtnCls} onClick={() => setOpenRecruitmentStatusPicker(true)}>
              <span>{RECRUITMENT_STATUS_OPTIONS.find((o) => o.value === recruitmentStatus)?.label ?? recruitmentStatus}</span>
              <ChevronDown />
            </button>
            {recruitmentStatus === "RECRUTE" && (
              <div className="mt-3">
                <label className={labelCls}>CÉGEP d&apos;engagement</label>
                <button type="button" className={pickerBtnCls} onClick={() => setOpenCegepPicker(true)}>
                  <span className={committedSchoolName ? "" : "text-white/40"}>
                    {committedSchoolName || "Rechercher un CÉGEP…"}
                  </span>
                  <ChevronDown />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── Step 2 : Académique ─────────────────────────────── */
  function renderStep2() {
    const d = form.academic;
    const isDet = d.academicMode === "detailed";
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Académique</h2>
          <p className="text-[13px] text-white/55 mt-1">Résultats scolaires et objectifs CÉGEP</p>
        </div>
        <ModeToggle mode={d.academicMode} onChange={(m) => updateAcademic("academicMode", m)} />

        <div>
          <label className={labelCls}>Moyenne générale</label>
          <div className="relative">
            <input
              type="number" inputMode="decimal" step="0.1" min="0" max="100"
              className={`${inputCls} pr-10`}
              value={d.gpa}
              onChange={(e) => updateAcademic("gpa", e.target.value)}
              placeholder="85"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-[14px]">%</span>
          </div>
        </div>

        {isDet && (
          <div>
            <p className={labelCls}>Matières fortes</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => {
                const selected = d.strongSubjects.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateAcademic("strongSubjects", toggleArrayItem(d.strongSubjects, s))}
                    className={`px-3.5 py-2 rounded-xl text-[13px] font-bold ${
                      selected
                        ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
                        : "bg-transparent border border-white/[0.10] text-white/65"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className={labelCls}>Programme CÉGEP visé</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "dec_general" as const, label: "DEC général" },
              { value: "technique" as const, label: "Technique" },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateAcademic("cegepType", opt.value)}
                className={`px-3 py-3 rounded-2xl text-[13px] font-bold border ${
                  d.cegepType === opt.value
                    ? "border-[#E63946] bg-[#E63946]/10 text-white"
                    : "border-white/[0.10] text-white/65"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {d.cegepType === "technique" && (
            <input
              className={`${inputCls} mt-3`}
              value={d.cegepProgramDetail}
              onChange={(e) => updateAcademic("cegepProgramDetail", e.target.value)}
              placeholder="Précisez (ex: Techniques policières)"
            />
          )}
        </div>

        <div className="space-y-2">
          {[
            { key: "openToPrivate", label: "Ouvert à un CÉGEP privé" },
            { key: "openToAnglophone", label: "Ouvert à un CÉGEP anglophone" },
            { key: "openToRelocate", label: "Prêt à changer de région" },
          ].map((opt) => {
            const checked = d[opt.key as "openToPrivate" | "openToAnglophone" | "openToRelocate"];
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => updateAcademic(opt.key, !checked)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border ${
                  checked ? "border-[#E63946]/40 bg-[#E63946]/[0.06]" : "border-white/[0.06] bg-[#1A1D24]"
                }`}
              >
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                  checked ? "bg-[#E63946] border-[#E63946]" : "border-white/[0.18]"
                }`}>
                  {checked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  )}
                </span>
                <span className="text-[14px] text-white">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {isDet && (
          <div>
            <p className={labelCls}>Régions CÉGEP préférées</p>
            <div className="flex flex-wrap gap-2">
              {CEGEP_REGIONS.map((r) => {
                const selected = d.cegepRegions.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => updateAcademic("cegepRegions", toggleArrayItem(d.cegepRegions, r))}
                    className={`px-3 py-2 rounded-xl text-[13px] font-bold ${
                      selected
                        ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
                        : "bg-transparent border border-white/[0.10] text-white/65"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─── Step 3 : Physique ───────────────────────────────── */
  function renderStep3() {
    const d = form.physical;
    const isDet = d.physicalMode === "detailed";
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Physique</h2>
          <p className="text-[13px] text-white/55 mt-1">Mensurations et tests athlétiques</p>
        </div>
        <ModeToggle mode={d.physicalMode} onChange={(m) => updatePhysical("physicalMode", m)} />

        <p className={sectionLabel}>Mensurations</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Pieds</label>
            <button type="button" className={pickerBtnCls} onClick={() => setOpenHeightFtPicker(true)}>
              <span className={d.heightFeet ? "" : "text-white/40"}>{d.heightFeet ? `${d.heightFeet}'` : "—"}</span>
              <ChevronDown />
            </button>
          </div>
          <div>
            <label className={labelCls}>Pouces</label>
            <button type="button" className={pickerBtnCls} onClick={() => setOpenHeightInPicker(true)}>
              <span className={d.heightInches ? "" : "text-white/40"}>{d.heightInches ? `${d.heightInches}"` : "—"}</span>
              <ChevronDown />
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>Poids (lbs)</label>
          <input type="number" inputMode="numeric" className={inputCls} value={d.weightLbs} onChange={(e) => updatePhysical("weightLbs", e.target.value)} placeholder="185" />
        </div>
        <div>
          <label className={labelCls}>Main dominante</label>
          <button type="button" className={pickerBtnCls} onClick={() => setOpenDominantHandPicker(true)}>
            <span className={d.dominantHand ? "" : "text-white/40"}>{d.dominantHand || "—"}</span>
            <ChevronDown />
          </button>
        </div>

        {isDet && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Envergure</label>
                <input className={inputCls} value={d.wingspan} onChange={(e) => updatePhysical("wingspan", e.target.value)} placeholder={`6'4"`} />
              </div>
              <div>
                <label className={labelCls}>Taille mains</label>
                <input className={inputCls} value={d.handSize} onChange={(e) => updatePhysical("handSize", e.target.value)} placeholder={`9.5"`} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Pied dominant</label>
              <button type="button" className={pickerBtnCls} onClick={() => setOpenDominantFootPicker(true)}>
                <span className={d.dominantFoot ? "" : "text-white/40"}>{d.dominantFoot || "—"}</span>
                <ChevronDown />
              </button>
            </div>

            <p className={sectionLabel}>Tests athlétiques (optionnel)</p>
            {[
              { key: "fortyYard", label: "40 verges", placeholder: "4.72s" },
              { key: "verticalJump", label: "Saut vertical", placeholder: `32"` },
              { key: "broadJump", label: "Saut en longueur", placeholder: `9'2"` },
              { key: "benchPress", label: "Développé couché", placeholder: "225 × 8" },
              { key: "shuttleAgility", label: "Navette agilité", placeholder: "4.31s" },
              { key: "sprint100m", label: "Sprint 100m", placeholder: "10.9s" },
            ].map((f) => (
              <div key={f.key}>
                <label className={labelCls}>{f.label}</label>
                <input
                  className={inputCls}
                  value={d[f.key as keyof typeof d] as string}
                  onChange={(e) => updatePhysical(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  /* ─── Step 4 : Sport ──────────────────────────────────── */
  function renderStep4() {
    const s = form.sports;
    const isDet = s.sportsMode === "detailed";
    const teamLabel = s.selectedTeamId
      ? (coach.teams.find((t) => t.id === s.selectedTeamId)?.name ?? s.currentTeam ?? "—")
      : "";
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Sport</h2>
          <p className="text-[13px] text-white/55 mt-1">Sport, position et équipe</p>
        </div>
        <ModeToggle mode={s.sportsMode} onChange={(m) => updateSports("sportsMode", m)} />

        <div>
          <label className={labelCls}>Sport principal *</label>
          <button type="button" className={pickerBtnCls} onClick={() => setOpenSportPicker(true)}>
            <span className={s.primarySport ? "" : "text-white/40"}>{s.primarySport || "Sélectionner"}</span>
            <ChevronDown />
          </button>
          {s.primarySport === "Autre" && (
            <input
              className={`${inputCls} mt-2`}
              value={s.primarySportDetail}
              onChange={(e) => updateSports("primarySportDetail", e.target.value)}
              placeholder="Précisez le sport…"
            />
          )}
        </div>

        <div>
          <label className={labelCls}>Position principale {isCreate ? "" : "*"}</label>
          {/* Fix 1 — Free-text fallback for "Autre" or unmapped sports
              (POSITIONS lookup empty → MobilePicker would have zero
              options, trapping EDIT validation). Mirrors the desktop
              SportPositionSelect.tsx fallback. */}
          {(() => {
            const sport = form.sports.primarySport;
            const isCustomSport = sport === "Autre" || (!!sport && !POSITIONS[sport]);
            if (isCustomSport) {
              return (
                <input
                  type="text"
                  className={inputCls}
                  value={s.primaryPosition}
                  onChange={(e) => updateSports("primaryPosition", e.target.value)}
                  placeholder="Saisis la position…"
                  aria-label="Position principale"
                />
              );
            }
            return (
              <button type="button" className={pickerBtnCls} onClick={() => setOpenPrimaryPosPicker(true)} disabled={!s.primarySport}>
                <span className={s.primaryPosition ? "" : "text-white/40"}>
                  {s.primaryPosition || (s.primarySport ? "Sélectionner" : "Choisis un sport d'abord")}
                </span>
                <ChevronDown />
              </button>
            );
          })()}
        </div>

        <div>
          <label className={labelCls}>Numéro de chandail *</label>
          <input
            type="text" inputMode="numeric"
            className={inputCls}
            value={s.jerseyNumber}
            onChange={(e) => updateSports("jerseyNumber", e.target.value.replace(/\D/g, ""))}
            placeholder="#"
          />
        </div>

        {/* Équipe — always visible on mobile (matches Create), optional on Edit */}
        <div>
          <label className={labelCls}>Équipe {isCreate ? "*" : ""}</label>
          <button type="button" className={pickerBtnCls} onClick={() => setOpenTeamPicker(true)} disabled={coach.teams.length === 0}>
            <span className={teamLabel ? "" : "text-white/40"}>
              {teamLabel || (coach.teams.length === 0 ? "Aucune équipe — crée-en une" : "Sélectionner")}
            </span>
            <ChevronDown />
          </button>
          {s.teamLevel && <p className="text-[11px] text-white/45 mt-1.5">Niveau : {s.teamLevel}</p>}
        </div>

        {isDet && (
          <>
            <p className={sectionLabel}>Position secondaire</p>
            {/* Same free-text fallback as primary (Fix 1). */}
            {(() => {
              const sport = form.sports.primarySport;
              const isCustomSport = sport === "Autre" || (!!sport && !POSITIONS[sport]);
              if (isCustomSport) {
                return (
                  <input
                    type="text"
                    className={inputCls}
                    value={s.secondaryPosition}
                    onChange={(e) => updateSports("secondaryPosition", e.target.value)}
                    placeholder="Saisis la position secondaire (optionnel)…"
                    aria-label="Position secondaire"
                  />
                );
              }
              return (
                <button type="button" className={pickerBtnCls} onClick={() => setOpenSecondaryPosPicker(true)} disabled={!s.primarySport}>
                  <span className={s.secondaryPosition ? "" : "text-white/40"}>{s.secondaryPosition || "Aucune"}</span>
                  <ChevronDown />
                </button>
              );
            })()}

            <p className={sectionLabel}>Sport secondaire</p>
            <button type="button" className={pickerBtnCls} onClick={() => setOpenSecondarySportPicker(true)}>
              <span className={s.secondarySport ? "" : "text-white/40"}>{s.secondarySport || "Aucun"}</span>
              <ChevronDown />
            </button>

            <button
              type="button"
              onClick={() => updateSports("openToCoaching", !s.openToCoaching)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border ${
                s.openToCoaching ? "border-[#E63946]/40 bg-[#E63946]/[0.06]" : "border-white/[0.06] bg-[#1A1D24]"
              }`}
            >
              <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                s.openToCoaching ? "bg-[#E63946] border-[#E63946]" : "border-white/[0.18]"
              }`}>
                {s.openToCoaching && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                )}
              </span>
              <span className="text-[14px] text-white text-left">Ouvert à devenir entraîneur au CÉGEP</span>
            </button>
          </>
        )}
      </div>
    );
  }

  /* ─── Step 5 : Évaluation ─────────────────────────────── */
  function renderStep5() {
    const sc = form.scouting;
    const isDet = sc.evalMode === "detailed";
    const sportStats = getSportStats(form.sports.primarySport);
    const selectedMap = new Map(sc.badges.map((b) => [b.badge, b]));
    const atMax = sc.badges.length >= MAX_BADGES;

    const ratedTraits = Object.values(sc.traitRatings).filter((v) => v > 0);
    const autoAvg = ratedTraits.length > 0 ? ratedTraits.reduce((a, b) => a + b, 0) / ratedTraits.length : 0;

    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Évaluation</h2>
          <p className="text-[13px] text-white/55 mt-1">Cote, distinctions, rapport</p>
        </div>
        <ModeToggle mode={sc.evalMode} onChange={(m) => updateScouting("evalMode", m)} />

        {!isDet && (
          <div className="p-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06]">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/45">Cote de l&apos;entraîneur</p>
            <div className="mt-3 flex items-center gap-3">
              <StarRow value={sc.starRating} onChange={(n) => updateScouting("starRating", n)} size={28} />
              <span className="text-[14px] font-bold text-white">{sc.starRating > 0 ? `${sc.starRating} / 5` : "—"}</span>
            </div>
          </div>
        )}

        {isDet && (
          <>
            <div className="p-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Cote globale (moy. auto)</p>
                <p className="text-[28px] font-head font-black text-[#F59E0B] leading-none mt-1">
                  {autoAvg > 0 ? autoAvg.toFixed(1) : "—"}
                  <span className="text-[12px] text-white/45 font-normal ml-1">/ 5</span>
                </p>
              </div>
              <StarRow value={Math.round(autoAvg)} onChange={() => { /* visual */ }} size={20} />
            </div>

            {TRAIT_GROUPS.map((group) => (
              <div key={group.title} className="p-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06]">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45 mb-3">{group.title}</p>
                <div className="space-y-2">
                  {group.traits.map((t) => {
                    const val = sc.traitRatings[t.key] || 0;
                    return (
                      <div key={t.key} className="flex items-center justify-between gap-3">
                        <span className="text-[13px] text-white/90">{t.label}</span>
                        <StarRow
                          value={val}
                          onChange={(n) => updateScouting("traitRatings", { ...sc.traitRatings, [t.key]: n })}
                          size={20}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Distinctions */}
        <div>
          <p className={sectionLabel}>Distinctions ({sc.badges.length}/{MAX_BADGES})</p>
          <div className="grid grid-cols-3 gap-2">
            {BADGE_ORDER.map((key) => {
              const cfg = BADGE_CONFIG[key];
              const entry = selectedMap.get(key);
              const isSelected = !!entry;
              const isDisabled = !isSelected && atMax;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => !isDisabled && toggleBadge(key)}
                  disabled={isDisabled}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border ${
                    isSelected ? "border-[#E63946]/40 bg-[#E63946]/[0.06]" : "border-white/[0.08] bg-[#1A1D24]"
                  } ${isDisabled ? "opacity-40" : ""}`}
                >
                  <DistinctionBadge badge={key} detail={entry?.detail} size="sm" />
                  <span className={`text-[11px] font-bold text-center ${isSelected ? "text-white" : "text-white/65"}`}>
                    {key === "custom" ? "Personnalisée" : cfg.label}
                  </span>
                </button>
              );
            })}
          </div>

          {sc.badges.filter((b) => BADGE_CONFIG[b.badge]?.hasDetail || b.badge === "custom").map((b) => {
            const cfg = BADGE_CONFIG[b.badge];
            return (
              <div key={b.badge} className="mt-2">
                <label className={labelCls}>Détail — {cfg?.label || b.badge}</label>
                {(b.badge === "team_leader" || b.badge === "league_leader") && sportStats.length > 0 && (
                  <select
                    aria-label="Statistique"
                    value={sportStats.includes(b.detail || "") ? b.detail || "" : ""}
                    onChange={(e) => updateBadgeDetail(b.badge, e.target.value)}
                    className={`${inputCls} mb-2`}
                  >
                    <option value="">— Choisir une stat —</option>
                    {sportStats.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                )}
                <input
                  className={inputCls}
                  value={b.detail || ""}
                  onChange={(e) => updateBadgeDetail(b.badge, e.target.value.slice(0, MAX_DETAIL_LENGTH))}
                  maxLength={MAX_DETAIL_LENGTH}
                  placeholder={b.badge === "custom" ? "Titre" : "Précise (ex: Points)"}
                />
              </div>
            );
          })}
        </div>

        {/* Rapport */}
        <div>
          <p className={sectionLabel}>Rapport de l&apos;entraîneur</p>
          <textarea
            className={`${inputCls} resize-y min-h-[160px]`}
            value={sc.coachEndorsement}
            onChange={(e) => updateScouting("coachEndorsement", e.target.value)}
            maxLength={1000}
            placeholder="Joueur le plus discipliné de mon roster…"
          />
          <p className="text-right text-[11px] text-white/45 mt-1 tabular-nums">{sc.coachEndorsement.length} / 1000</p>
        </div>
      </div>
    );
  }

  /* ─── Step 6 : Médias ─────────────────────────────────── */
  function renderStep6() {
    const m = form.media;
    const isDet = m.mediaMode === "detailed";
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Médias</h2>
          <p className="text-[13px] text-white/55 mt-1">Vidéos et profils en ligne</p>
        </div>
        <ModeToggle mode={m.mediaMode} onChange={(mm) => updateMedia("mediaMode", mm)} />

        <div>
          <label className={labelCls}>Vidéo de faits saillants</label>
          <input type="url" inputMode="url" className={inputCls} value={m.highlightVideo} onChange={(e) => updateMedia("highlightVideo", e.target.value)} placeholder="https://…" />
          {!m.highlightVideo && (
            <div className="mt-2 p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
              <p className="text-[12px] text-[#F59E0B] font-bold">Les profils avec vidéo reçoivent 3× plus d&apos;engagement.</p>
            </div>
          )}
        </div>

        {isDet && (
          <>
            <p className={sectionLabel}>Liens additionnels</p>
            {[
              { key: "hudlLink", label: "Hudl", placeholder: "https://hudl.com/…" },
              { key: "youtubeLink", label: "YouTube", placeholder: "https://youtube.com/…" },
              { key: "instagramLink", label: "Instagram", placeholder: "https://instagram.com/…" },
              { key: "fullGameVideo", label: "Match complet", placeholder: "https://…" },
              { key: "trainingVideo", label: "Entraînement", placeholder: "https://…" },
            ].map((f) => (
              <div key={f.key}>
                <label className={labelCls}>{f.label}</label>
                <input
                  type="url" inputMode="url"
                  className={inputCls}
                  value={m[f.key as keyof typeof m] as string}
                  onChange={(e) => updateMedia(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  /* ─── Step 7 : Révision ───────────────────────────────── */
  function renderStep7() {
    const i = form.identity;
    const a = form.academic;
    const p = form.physical;
    const s = form.sports;
    const sc = form.scouting;
    const heightStr = i ? (p.heightFeet && p.heightInches ? `${p.heightFeet}'${p.heightInches}"` : p.heightFeet ? `${p.heightFeet}'` : "—") : "—";

    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Révision</h2>
          <p className="text-[13px] text-white/55 mt-1">Vérifie avant d&apos;enregistrer</p>
        </div>

        <SummaryCard title="Identité" onEdit={() => setSlide(0)}>
          <SummaryRow label="Nom" value={`${i.firstName} ${i.lastName}`} />
          <SummaryRow label="Promotion" value={i.gradYear} />
          <SummaryRow label="École" value={i.school} />
        </SummaryCard>

        <SummaryCard title="Académique" onEdit={() => setSlide(1)}>
          <SummaryRow label="Moyenne" value={a.gpa ? `${a.gpa}%` : ""} />
          <SummaryRow label="Programme" value={
            a.cegepType === "dec_general" ? "DEC général"
              : a.cegepType === "technique" ? `Technique${a.cegepProgramDetail ? ` — ${a.cegepProgramDetail}` : ""}`
              : ""
          } />
        </SummaryCard>

        <SummaryCard title="Physique" onEdit={() => setSlide(2)}>
          <SummaryRow label="Taille" value={heightStr} />
          <SummaryRow label="Poids" value={p.weightLbs ? `${p.weightLbs} lbs` : ""} />
        </SummaryCard>

        <SummaryCard title="Sport" onEdit={() => setSlide(3)}>
          <SummaryRow label="Sport" value={s.primarySport} />
          <SummaryRow label="Position" value={`${s.primaryPosition}${s.secondaryPosition ? ` / ${s.secondaryPosition}` : ""}`} />
          <SummaryRow label="Équipe" value={coach.teams.find((t) => t.id === s.selectedTeamId)?.name ?? s.currentTeam} />
        </SummaryCard>

        <SummaryCard title="Évaluation" onEdit={() => setSlide(4)}>
          <SummaryRow label="Distinctions" value={
            sc.badges.length > 0
              ? sc.badges.map((b) => {
                  const cfg = BADGE_CONFIG[b.badge];
                  const label = b.badge === "custom" ? (b.detail || "Distinction") : cfg?.label || b.badge;
                  return b.badge !== "custom" && b.detail ? `${label} — ${b.detail}` : label;
                }).join(", ")
              : ""
          } />
          {sc.coachEndorsement && (
            <p className="text-[12px] text-white/70 italic leading-relaxed mt-2">
              &ldquo;{sc.coachEndorsement.slice(0, 160)}{sc.coachEndorsement.length > 160 ? "…" : ""}&rdquo;
            </p>
          )}
        </SummaryCard>

        {/* EDIT-only : statut override */}
        {isEdit && (
          <div className="p-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Statut (override recruteur)</p>
            <button type="button" className={`${pickerBtnCls} mt-2`} onClick={() => setOpenRecruitingOverridePicker(true)}>
              <span className={form.submission.recruitingStatus ? "" : "text-white/40"}>
                {RECRUITING_OVERRIDE_OPTIONS.find((o) => o.value === (form.submission.recruitingStatus || ""))?.label ?? "—"}
              </span>
              <ChevronDown />
            </button>
          </div>
        )}

        {/* CONSENT — surfaced both modes, write logic gated by consentExplicitlySet for edit */}
        <div className="p-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06]">
          <p className="text-[14px] font-bold text-white">Consentement parental</p>
          <p className="text-[12px] text-white/55 mt-1 mb-3">
            {isCreate
              ? "Requis avant d'inviter un athlète mineur (Loi 25)."
              : "Coche uniquement si tu veux modifier cette valeur."}
          </p>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, parentalConsent: !prev.parentalConsent }))}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl border ${
              form.parentalConsent ? "border-[#E63946]/40 bg-[#E63946]/[0.06]" : "border-white/[0.06]"
            }`}
          >
            <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
              form.parentalConsent ? "bg-[#E63946] border-[#E63946]" : "border-white/[0.18]"
            }`}>
              {form.parentalConsent && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              )}
            </span>
            <span className="text-[14px] text-white text-left">
              Consentement parental confirmé
            </span>
          </button>
        </div>

        {/* CREATE-only : Partner visibility */}
        {isCreate && (
          <PartnerVisibilityConsentCard
            audience="coach"
            checked={form.partnerVisibilityConsent}
            onChange={(next) => setForm((prev) => ({ ...prev, partnerVisibilityConsent: next }))}
          />
        )}
      </div>
    );
  }
}

/* ── Small subcomponents ───────────────────────────────────── */

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SummaryCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">{title}</p>
        <button type="button" onClick={onEdit} className="text-[12px] font-bold uppercase tracking-wider text-[#E63946]">Modifier</button>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[12px] text-white/55">{label}</span>
      <span className="text-[12px] text-white font-semibold text-right truncate ml-2">{value}</span>
    </div>
  );
}
