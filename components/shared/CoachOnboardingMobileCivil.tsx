"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachOnboardingMobileCivil — iter civil-2c-mobile

   Onboarding natif coach civil (mobile Capacitor). Dispatché par
   app/onboarding/page.tsx via IS_CAPACITOR + user.role==='coach' +
   user.context === 'ligue_civile'.

   Auto-suffisant : auth + user load au mount (pattern athlète/école).
   Resume bypass : onboarding_complete déjà true → redirect direct
   /coach/tableau-de-bord.

   4 slides (header progress dots) :
     1. Profil      — photo + bio + sport + expérience + tél  (identique école)
     2. Club+Équipe — Club LIGUE_CIVILE (existant ou créé) + équipe
                       (existante ou créée). Équipe OBLIGATOIRE (parité
                       wizard web civil — validateInstitution L418-420
                       force `profile.team_id`).
     3. Responsable — 2 cartes (C'est moi / Inviter). Pas d'intérim ni
                       coach_only au civil — la RPC rejette (DIAG civil).
                       Gate hasResponsable + RPRP obligatoire pour owner.
     4. Confirmation— récap + Terminer.

   finish() → supabase.rpc("finish_coach_civil_onboarding", { 19 params })
   (migration 20260611100000) — atomique, enforce SCHOOL_REQUIRES_RESPONSABLE
   + RPRP_REQUIRED côté serveur.

   Pattern réutilisés (canon athlète + école mobile) :
   - voile/fade-in mount
   - SearchSheet club + team
   - MobilePicker sport
   - bucket "avatars" pour photo (owner-scoped RLS)
   - slide horizontal entre écrans
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload/uploadImage";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { SearchSheet } from "@/components/mobile/SearchSheet";
import { AGE_OPTIONS, DIVISION_OPTIONS, AUTRE_VALUE } from "@/lib/config/civilVocab";
import { TeamCreateFormBlock, type TeamFormValues } from "@/components/shared/teams/TeamCreateFormBlock";

/* ── Constantes ──────────────────────────────────────────────── */

const SPORTS = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball",
  "Athlétisme", "Flag football", "Rugby", "Cheerleading",
  "Natation", "Badminton", "Cross-country", "Futsal",
  "Baseball", "Ultimate frisbee", "Autre",
];
const SPORT_OPTIONS: PickerOption[] = SPORTS.map((s) => ({ value: s, label: s }));

type Gender = "Masculin" | "Féminin" | "Mixte";
const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "Masculin", label: "Masculin" },
  { value: "Féminin",  label: "Féminin" },
  { value: "Mixte",    label: "Mixte" },
];

const AGE_PICKER_OPTIONS: PickerOption[] = AGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const DIVISION_PICKER_OPTIONS: PickerOption[] = DIVISION_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

type DirectorChoice = "owner" | "interim" | "coach" | null;
type ClubMode = "pick" | "create";
type TeamMode = "pick" | "create";

/* ── Types ───────────────────────────────────────────────────── */

type CivilClubRow = { id: string; name: string; city: string | null; region: string | null };
type CivilTeamRow = {
  id: string;
  name: string;
  division: string | null;
  age_group: string | null;
  gender: string | null;
};

/* ── Helpers (duplicats parité école) ─────────────────────────── */

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

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function normalize(s: string): string {
  return stripAccents(s).toLowerCase().trim();
}

function civilTeamLabel(t: { name: string; division: string | null; age_group: string | null; gender: string | null }): string {
  const parts = [t.age_group, t.division, t.gender].map((v) => (v ?? "").trim()).filter((v) => v.length > 0);
  return parts.length > 0 ? parts.join(" · ") : t.name;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ═══════════════════════════════════════════════════════════════
   Composant principal
═══════════════════════════════════════════════════════════════ */

export function CoachOnboardingMobileCivil() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useMobileToast();

  const [slide, setSlide] = useState<0 | 1 | 2 | 3>(0);

  // Auth + context
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");

  // Slide 1 — Profil
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [bio, setBio] = useState("");
  const [sport, setSport] = useState<string>("");
  const [experienceYears, setExperienceYears] = useState<string>("");
  const [phone, setPhone] = useState("");

  // Slide 2 — Club + Équipe
  const [clubMode, setClubMode] = useState<ClubMode>("pick");
  // Existing club picked
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [selectedClubName, setSelectedClubName] = useState<string>("");
  const [selectedClubCity, setSelectedClubCity] = useState<string>("");
  const [selectedClubRegion, setSelectedClubRegion] = useState<string>("");
  // New club to create
  const [newClubName, setNewClubName] = useState("");
  const [newClubCity, setNewClubCity] = useState("");
  const [newClubRegion, setNewClubRegion] = useState("");

  const [teamMode, setTeamMode] = useState<TeamMode>("pick");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");
  // New team to create
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamAgeGroup, setNewTeamAgeGroup] = useState("");
  const [newTeamAgeOther, setNewTeamAgeOther] = useState("");
  const [newTeamDivision, setNewTeamDivision] = useState("");
  const [newTeamDivisionOther, setNewTeamDivisionOther] = useState("");
  const [newTeamGender, setNewTeamGender] = useState<Gender | "">("");

  // Slide 3 — Responsable
  const [directorChoice, setDirectorChoice] = useState<DirectorChoice>(null);
  const [rprpAttested, setRprpAttested] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  // UI flags pickers
  const [openSport, setOpenSport] = useState(false);
  const [openAge, setOpenAge] = useState(false);
  const [openDivision, setOpenDivision] = useState(false);
  const [clubSheetOpen, setClubSheetOpen] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);

  // Data sources sheets
  const [clubSearch, setClubSearch] = useState("");
  const [clubs, setClubs] = useState<CivilClubRow[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);

  const [teamSearch, setTeamSearch] = useState("");
  const [civilTeams, setCivilTeams] = useState<CivilTeamRow[]>([]);
  const [civilTeamsLoaded, setCivilTeamsLoaded] = useState(false);
  const [civilTeamsLoading, setCivilTeamsLoading] = useState(false);

  // Responsable detection
  const [hasResponsable, setHasResponsable] = useState<boolean | null>(null);
  const [responsableLoading, setResponsableLoading] = useState(false);

  // Saving / loading
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fade-in au mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── Init : auth + pré-remplissage + resume bypass ───────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      if (cancelled) return;

      setUserId(user.id);
      if (user.email) setEmail(user.email);

      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, role, context, onboarding_complete, phone, photo_url, sport, school_id, profile_data")
        .eq("id", user.id)
        .single();

      if (cancelled) return;
      if (!profile) { router.push("/auth"); return; }

      if (profile.onboarding_complete) {
        router.replace("/coach/tableau-de-bord");
        return;
      }

      if (profile.first_name) setFirstName(profile.first_name);
      if (profile.last_name) setLastName(profile.last_name);
      if (profile.phone) setPhone(profile.phone);
      if (profile.photo_url) setPhoto(profile.photo_url);
      if (profile.sport) setSport(profile.sport);
      const pd = (profile.profile_data ?? {}) as Record<string, unknown>;
      if (typeof pd.bio === "string") setBio(pd.bio);
      if (typeof pd.experience_years === "number" || typeof pd.experience_years === "string") {
        setExperienceYears(String(pd.experience_years));
      }

      // Re-mount mid-flow : si school_id existant pointe sur un club civil,
      // pré-remplir comme "existant".
      if (profile.school_id) {
        const { data: sch } = await supabase
          .from("schools")
          .select("id, name, city, region, type")
          .eq("id", profile.school_id)
          .maybeSingle();
        if (!cancelled && sch && (sch.type as string) === "LIGUE_CIVILE") {
          setClubMode("pick");
          setSelectedClubId(sch.id as string);
          setSelectedClubName((sch.name as string) ?? "");
          setSelectedClubCity((sch.city as string) ?? "");
          setSelectedClubRegion((sch.region as string) ?? "");
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  /* ── Loaders ─────────────────────────────────────────────── */

  // Clubs civils (one-shot quand sheet ouvert)
  useEffect(() => {
    if (!clubSheetOpen || clubs.length > 0) return;
    setClubsLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("schools")
        .select("id, name, city, region")
        .eq("type", "LIGUE_CIVILE")
        .order("name");
      setClubs((data as CivilClubRow[]) || []);
      setClubsLoading(false);
    })();
  }, [clubSheetOpen, clubs.length]);

  const visibleClubs = useMemo(() => {
    const q = normalize(clubSearch);
    if (!q) return clubs.slice(0, 50);
    return clubs.filter((c) =>
      normalize(c.name).includes(q) || (c.city && normalize(c.city).includes(q))
    ).slice(0, 50);
  }, [clubs, clubSearch]);

  // Équipes du club civil sélectionné + sport (parité école avec teams_onboarding_readable).
  useEffect(() => {
    if (!selectedClubId || !sport || clubMode !== "pick") {
      setCivilTeams([]);
      setCivilTeamsLoaded(false);
      return;
    }
    let cancelled = false;
    setCivilTeamsLoading(true);
    setCivilTeamsLoaded(false);
    (async () => {
      const supabase = createClient();
      const { data: sportRow } = await supabase
        .from("sports").select("id").eq("nom", sport).maybeSingle();
      if (cancelled) return;
      if (!sportRow?.id) {
        setCivilTeams([]); setCivilTeamsLoaded(true); setCivilTeamsLoading(false);
        return;
      }
      const { data: rows } = await supabase
        .from("teams")
        .select("id, name, division, age_group, gender")
        .eq("school_id", selectedClubId)
        .eq("sport_id", sportRow.id)
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      const mapped: CivilTeamRow[] = ((rows as Record<string, unknown>[]) || []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        division: (r.division as string) ?? null,
        age_group: (r.age_group as string) ?? null,
        gender: (r.gender as string) ?? null,
      }));
      setCivilTeams(mapped);
      setCivilTeamsLoaded(true);
      setCivilTeamsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedClubId, sport, clubMode]);

  const visibleCivilTeams = useMemo(() => {
    const q = normalize(teamSearch);
    if (!q) return civilTeams;
    return civilTeams.filter((t) =>
      normalize(t.name).includes(q) ||
      (t.division ? normalize(t.division).includes(q) : false) ||
      (t.age_group ? normalize(t.age_group).includes(q) : false)
    );
  }, [civilTeams, teamSearch]);

  // school_has_responsable — query uniquement si club EXISTANT choisi.
  // Si club CRÉÉ : pas de query (par construction hasResponsable=false).
  useEffect(() => {
    if (clubMode === "create") {
      setHasResponsable(false);
      setResponsableLoading(false);
      return;
    }
    if (!selectedClubId) {
      setHasResponsable(null);
      setResponsableLoading(false);
      return;
    }
    let cancelled = false;
    setResponsableLoading(true);
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("school_has_responsable", {
        p_school_id: selectedClubId,
      });
      if (cancelled) return;
      if (error) {
        console.error("[CoachOnboardingMobileCivil] school_has_responsable:", error);
        setHasResponsable(null);
      } else {
        setHasResponsable(data === true);
      }
      setResponsableLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clubMode, selectedClubId]);

  // ⚠️ Gate robuste (sprint civil-cards-restructure) :
  // "Coach" est dispo UNIQUEMENT quand on a CONFIRMÉ qu'un responsable
  // existe (hasResponsable === true). Toute autre valeur (null pendant
  // loading, null sur erreur RPC, false sur club orphan, ou clubMode
  // 'create') → mustBeResponsable=true → seuls owner/interim permis.
  // Évite le bug précédent où null !== false laissait Coach actif pendant
  // le chargement/échec.
  const mustBeResponsable = clubMode === "create" || hasResponsable !== true;

  useEffect(() => {
    if (mustBeResponsable && directorChoice === "coach") {
      setDirectorChoice(null);
      setInviteEmail("");
    }
  }, [mustBeResponsable, directorChoice]);

  // Club CRÉÉ → teamMode forcé sur "create" (pas d'équipes existantes).
  useEffect(() => {
    if (clubMode === "create") {
      setTeamMode("create");
      setSelectedTeamId(null);
      setSelectedTeamName("");
    }
  }, [clubMode]);

  /* ── Photo upload (bucket avatars) ─────────────────────────── */
  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setPhotoUploading(true);
    const res = await uploadImage(file, { pathBase: `${userId}/${Date.now()}` });
    if (!res.ok) {
      toast.error({ message: "Échec de l'upload", detail: res.message });
      setPhotoUploading(false);
      return;
    }
    setPhoto(res.publicUrl);
    setPhotoUploading(false);
    triggerHaptic("Light");
  }, [userId, toast]);

  /* ── Validation par slide ────────────────────────────────── */
  const canProceedSlide1 = !!sport;

  // Slide 2 : club + équipe TOUS DEUX requis (parité web civil).
  const clubReady =
    (clubMode === "pick" && !!selectedClubId)
    || (clubMode === "create" && newClubName.trim().length > 0);

  // Équipe : si pick → selectedTeamId obligatoire ; si create → 4 champs valides.
  const teamCreateAgeFinal = newTeamAgeGroup === AUTRE_VALUE ? newTeamAgeOther.trim() : newTeamAgeGroup;
  const teamCreateDivFinal = newTeamDivision === AUTRE_VALUE ? newTeamDivisionOther.trim() : newTeamDivision;
  const teamCreateValid =
    newTeamName.trim().length > 0
    && teamCreateAgeFinal.length > 0
    && teamCreateDivFinal.length > 0
    && newTeamGender !== "";

  const teamReady =
    (teamMode === "pick" && !!selectedTeamId)
    || (teamMode === "create" && teamCreateValid);

  const canProceedSlide2 = clubReady && teamReady;

  // Email invite : optionnel sous "Coach". Vide → coach_only à la RPC.
  // Rempli → doit être valide pour activer le CTA (sinon on bloque pour
  // éviter d'envoyer un email mal formé).
  const inviteEmailFilled = inviteEmail.trim().length > 0;
  const inviteEmailValid = inviteEmailFilled && EMAIL_RE.test(inviteEmail.trim());

  const canProceedSlide3 = !!directorChoice && (() => {
    // Coach n'est jamais valide si mustBeResponsable (defense ; la carte
    // est aussi visuellement disabled).
    if (mustBeResponsable && directorChoice === "coach") return false;
    // RPRP gate dur pour owner + interim.
    if (directorChoice === "owner" || directorChoice === "interim") return rprpAttested;
    if (directorChoice === "coach") {
      // Coach sans email = coach_only (OK). Coach avec email partiel/invalide
      // = bloqué tant que l'email n'est pas valide ou vidé.
      if (inviteEmailFilled && !inviteEmailValid) return false;
      return true;
    }
    return false;
  })();

  const canSubmit = canProceedSlide1 && canProceedSlide2 && canProceedSlide3 && !saving;

  /* ── Handlers nav ────────────────────────────────────────── */
  const handleNext = useCallback(() => {
    triggerHaptic("Light");
    if (slide === 0 && canProceedSlide1) setSlide(1);
    else if (slide === 1 && canProceedSlide2) setSlide(2);
    else if (slide === 2 && canProceedSlide3) setSlide(3);
  }, [slide, canProceedSlide1, canProceedSlide2, canProceedSlide3]);

  const handleBack = useCallback(() => {
    triggerHaptic("Light");
    if (slide > 0) setSlide((s) => (s - 1) as 0 | 1 | 2 | 3);
  }, [slide]);

  /* ── Submit final → RPC atomique civil ─────────────────────── */
  const handleFinish = useCallback(async () => {
    if (!canSubmit || !userId) return;
    setSaving(true);
    triggerHaptic("Light");
    const supabase = createClient();

    try {
      const expRaw = experienceYears;
      const expParsed = expRaw ? parseInt(expRaw, 10) : null;
      const expYears = Number.isFinite(expParsed) ? expParsed : null;

      const ageFinal   = newTeamAgeGroup === AUTRE_VALUE ? newTeamAgeOther.trim() : newTeamAgeGroup;
      const divFinal   = newTeamDivision === AUTRE_VALUE ? newTeamDivisionOther.trim() : newTeamDivision;

      // Mapper UI choice (3 cartes) → RPC director_choice (4 valeurs) :
      //   owner   → 'owner'
      //   interim → 'interim'
      //   coach + email valide → 'invite' (avec p_invite_email)
      //   coach (vide / invalide) → 'coach_only'
      const rpcChoice: "owner" | "interim" | "invite" | "coach_only" =
        directorChoice === "owner"   ? "owner"
        : directorChoice === "interim" ? "interim"
        : (directorChoice === "coach" && inviteEmailValid) ? "invite"
        : "coach_only";

      const { error } = await supabase.rpc("finish_coach_civil_onboarding", {
        // Club : soit existant, soit création
        p_club_id:          clubMode === "pick" ? selectedClubId : null,
        p_club_name:        clubMode === "create" ? newClubName.trim() : null,
        p_club_city:        clubMode === "create" ? (newClubCity.trim() || null) : null,
        p_club_region:      clubMode === "create" ? (newClubRegion.trim() || null) : (selectedClubRegion || null),
        // Profil
        p_sport:            sport,
        p_first_name:       firstName.trim() || null,
        p_last_name:        lastName.trim()  || null,
        p_phone:            phone.trim() || null,
        p_bio:              bio.trim() || null,
        p_experience_years: expYears,
        p_photo_url:        photo || null,
        // Équipe : soit existante, soit création
        p_team_id:          teamMode === "pick" ? selectedTeamId : null,
        p_team_name:        teamMode === "create" ? newTeamName.trim() : null,
        p_team_age_group:   teamMode === "create" ? ageFinal : null,
        p_team_gender:      teamMode === "create" ? (newTeamGender || null) : null,
        p_team_division:    teamMode === "create" ? divFinal : null,
        // Responsable (mapping UI 3 cartes → RPC 4 choix)
        p_director_choice:  rpcChoice,
        p_rprp_accepted:    !!rprpAttested,
        p_invite_email:     rpcChoice === "invite" ? inviteEmail.trim() : null,
      });

      if (error) {
        console.error("[CoachOnboardingMobileCivil] finish_coach_civil_onboarding:", error);
        const msg = error.message || "";
        let userMessage = "Erreur lors de la finalisation — réessaye.";
        if (msg.includes("SCHOOL_REQUIRES_RESPONSABLE")) {
          userMessage = "Ce club n'a pas encore de responsable. Choisis « C'est moi ».";
        } else if (msg.includes("RPRP_REQUIRED")) {
          userMessage = "L'attestation RPRP est obligatoire pour devenir responsable.";
        } else if (msg.includes("INVALID_CLUB")) {
          userMessage = "Données du club invalides — vérifie le nom.";
        } else if (msg.includes("INVALID_SPORT")) {
          userMessage = "Sport invalide — réessaye.";
        } else if (msg.includes("INVALID_DIRECTOR_CHOICE")) {
          userMessage = "Choix de responsable invalide.";
        } else if (msg.includes("NOT_AUTHENTICATED")) {
          userMessage = "Session expirée — reconnecte-toi.";
        } else if (msg.includes("WRONG_ROLE_OR_CONTEXT")) {
          userMessage = "Ce flux est réservé aux coachs de ligue civile.";
        }
        toast.error({ message: userMessage, detail: error.message });
        setSaving(false);
        return;
      }

      // Re-fetch currentUser → PushRegistrar voit onboarding_complete=true (posé par
      // la RPC finish_coach_civil_onboarding) dans la MÊME session → registerPush().
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      triggerHaptic("Medium");
      router.replace("/coach/tableau-de-bord");
    } catch (err) {
      console.error("[CoachOnboardingMobileCivil] finish() exception:", err);
      toast.error({ message: "Erreur inattendue — réessaye." });
      setSaving(false);
    }
  }, [
    canSubmit, userId, firstName, lastName, phone, photo, bio, sport, experienceYears,
    clubMode, selectedClubId, selectedClubRegion, newClubName, newClubCity, newClubRegion,
    teamMode, selectedTeamId, newTeamName, newTeamAgeGroup, newTeamAgeOther,
    newTeamDivision, newTeamDivisionOther, newTeamGender,
    directorChoice, rprpAttested, inviteEmail,
    router, toast, queryClient,
  ]);

  /* ── Render ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#111317] text-white flex items-center justify-center">
        <p className="text-[14px] text-[#6b7280]">Chargement…</p>
      </div>
    );
  }

  const TOTAL_SLIDES = 4;
  const isLast = slide === TOTAL_SLIDES - 1;

  return (
    <div
      className="h-[100dvh] overflow-x-hidden bg-[#111317] text-white flex flex-col"
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 400ms ease-out" }}
    >
      {/* Header sticky */}
      <div
        className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center px-4 py-2 gap-2 min-h-[64px]">
          <button
            type="button"
            onClick={handleBack}
            disabled={slide === 0}
            aria-label="Retour"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0 disabled:opacity-30"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/40">
              Étape {slide + 1} sur {TOTAL_SLIDES}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i <= slide ? "bg-[#E63946]" : "bg-white/15"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)", overscrollBehavior: "contain" }}
      >
        {slide === 0 && (
          <Slide1Profile
            firstName={firstName} lastName={lastName} email={email}
            photo={photo} photoUploading={photoUploading} onPhotoChange={handlePhotoChange}
            bio={bio} setBio={setBio}
            sport={sport}
            onOpenSport={() => setOpenSport(true)}
            experienceYears={experienceYears} setExperienceYears={setExperienceYears}
            phone={phone} setPhone={setPhone}
          />
        )}
        {slide === 1 && (
          <Slide2ClubTeam
            sport={sport}
            clubMode={clubMode}
            onClubModeChange={(m) => {
              setClubMode(m);
              if (m === "create") {
                setSelectedClubId(null);
                setSelectedClubName("");
                setSelectedClubCity("");
                setSelectedClubRegion("");
              } else {
                setNewClubName(""); setNewClubCity(""); setNewClubRegion("");
              }
              // Reset équipe quand club change.
              setSelectedTeamId(null); setSelectedTeamName("");
            }}
            selectedClubName={selectedClubName}
            selectedClubCity={selectedClubCity}
            onOpenClub={() => setClubSheetOpen(true)}
            newClubName={newClubName} setNewClubName={setNewClubName}
            newClubCity={newClubCity} setNewClubCity={setNewClubCity}
            newClubRegion={newClubRegion} setNewClubRegion={setNewClubRegion}
            teamMode={teamMode}
            onTeamModeChange={setTeamMode}
            selectedTeamName={selectedTeamName}
            onOpenTeam={() => setTeamSheetOpen(true)}
            civilTeamsLoaded={civilTeamsLoaded}
            civilTeamsCount={civilTeams.length}
            newTeamName={newTeamName} setNewTeamName={setNewTeamName}
            newTeamAgeGroup={newTeamAgeGroup} setNewTeamAgeGroup={setNewTeamAgeGroup}
            newTeamAgeOther={newTeamAgeOther} setNewTeamAgeOther={setNewTeamAgeOther}
            newTeamDivision={newTeamDivision} setNewTeamDivision={setNewTeamDivision}
            newTeamDivisionOther={newTeamDivisionOther} setNewTeamDivisionOther={setNewTeamDivisionOther}
            newTeamGender={newTeamGender} setNewTeamGender={setNewTeamGender}
            onOpenAge={() => setOpenAge(true)}
            onOpenDivision={() => setOpenDivision(true)}
          />
        )}
        {slide === 2 && (
          <Slide3Responsable
            clubMode={clubMode}
            choice={directorChoice} setChoice={setDirectorChoice}
            rprpAttested={rprpAttested} setRprpAttested={setRprpAttested}
            inviteEmail={inviteEmail} setInviteEmail={setInviteEmail}
            mustBeResponsable={mustBeResponsable}
            responsableLoading={responsableLoading}
            inviteEmailValid={inviteEmailValid}
            inviteEmailFilled={inviteEmailFilled}
          />
        )}
        {slide === 3 && (
          <Slide4Confirmation
            firstName={firstName} lastName={lastName} email={email}
            sport={sport}
            clubName={clubMode === "create" ? newClubName : selectedClubName}
            clubCity={clubMode === "create" ? newClubCity : selectedClubCity}
            teamName={
              teamMode === "create"
                ? `${newTeamName} · ${teamCreateAgeFinal} · ${teamCreateDivFinal} · ${newTeamGender}`
                : selectedTeamName
            }
            directorChoice={directorChoice}
            inviteEmail={inviteEmail}
            inviteEmailValid={inviteEmailValid}
          />
        )}
      </div>

      {/* Sticky CTA */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 bg-[#111317]/95 backdrop-blur-md border-t border-white/[0.06] px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        {!isLast ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={
              (slide === 0 && !canProceedSlide1) ||
              (slide === 1 && !canProceedSlide2) ||
              (slide === 2 && !canProceedSlide3)
            }
            className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all ${
              ((slide === 0 && canProceedSlide1) ||
               (slide === 1 && canProceedSlide2) ||
               (slide === 2 && canProceedSlide3))
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
            disabled={!canSubmit}
            className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              canSubmit
                ? "bg-[#E63946] text-white active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)]"
                : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                Enregistrement…
              </>
            ) : (
              "Terminer et accéder à Nexus"
            )}
          </button>
        )}
      </div>

      {/* MobilePickers */}
      <MobilePicker
        open={openSport}
        onClose={() => setOpenSport(false)}
        title="Sport principal"
        options={SPORT_OPTIONS}
        value={sport || null}
        onChange={(v) => setSport(v ? String(v) : "")}
      />
      <MobilePicker
        open={openAge}
        onClose={() => setOpenAge(false)}
        title="Catégorie d'âge"
        options={AGE_PICKER_OPTIONS}
        value={newTeamAgeGroup || null}
        onChange={(v) => setNewTeamAgeGroup(v ? String(v) : "")}
      />
      <MobilePicker
        open={openDivision}
        onClose={() => setOpenDivision(false)}
        title="Division"
        options={DIVISION_PICKER_OPTIONS}
        value={newTeamDivision || null}
        onChange={(v) => setNewTeamDivision(v ? String(v) : "")}
      />

      {/* SearchSheet club civil */}
      <SearchSheet<CivilClubRow>
        open={clubSheetOpen}
        onClose={() => setClubSheetOpen(false)}
        title="Mon club"
        searchPlaceholder="Rechercher mon club…"
        searchValue={clubSearch}
        onSearchChange={setClubSearch}
        items={visibleClubs}
        loading={clubsLoading}
        keyOf={(c) => c.id}
        onSelect={(c) => {
          setClubMode("pick");
          setSelectedClubId(c.id);
          setSelectedClubName(c.name);
          setSelectedClubCity(c.city ?? "");
          setSelectedClubRegion(c.region ?? "");
          setSelectedTeamId(null);
          setSelectedTeamName("");
          setTeamMode("pick");
        }}
        renderItem={(c, onTap) => (
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">{c.name}</p>
            {c.city && <p className="text-[13px] text-white/55 truncate">{c.city}</p>}
          </button>
        )}
        footer={
          <button
            type="button"
            onClick={() => { setClubMode("create"); setClubSheetOpen(false); }}
            className="w-full h-11 rounded-2xl bg-[#E63946]/15 border border-[#E63946]/30 text-[14px] font-bold text-[#E63946] active:bg-[#E63946]/25"
          >
            + Créer un nouveau club
          </button>
        }
      />

      {/* SearchSheet équipe civile (mode pick) */}
      <SearchSheet<CivilTeamRow>
        open={teamSheetOpen}
        onClose={() => setTeamSheetOpen(false)}
        title="Mon équipe"
        searchPlaceholder="Rechercher mon équipe…"
        searchValue={teamSearch}
        onSearchChange={setTeamSearch}
        items={visibleCivilTeams}
        loading={civilTeamsLoading}
        keyOf={(t) => t.id}
        onSelect={(t) => {
          setTeamMode("pick");
          setSelectedTeamId(t.id);
          setSelectedTeamName(civilTeamLabel(t));
        }}
        emptyContent={
          <p className="text-center text-[14px] text-white/55 py-12 px-4">
            Aucune équipe trouvée pour {selectedClubName} en {sport || "ce sport"}.
          </p>
        }
        renderItem={(t, onTap) => (
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">{civilTeamLabel(t)}</p>
          </button>
        )}
        footer={
          <button
            type="button"
            onClick={() => { setTeamMode("create"); setTeamSheetOpen(false); }}
            className="w-full h-11 rounded-2xl bg-[#E63946]/15 border border-[#E63946]/30 text-[14px] font-bold text-[#E63946] active:bg-[#E63946]/25"
          >
            + Créer une nouvelle équipe
          </button>
        }
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sous-composants par slide
═══════════════════════════════════════════════════════════════ */

const inputCls = "w-full bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 text-[17px] text-white placeholder:text-white/40 outline-none focus:border-[#E63946]/40";
const labelCls = "block uppercase mb-1 text-[13px] font-bold tracking-[0.18em] text-[#B6BCC7]";

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1
        className="font-head font-black text-white uppercase tracking-tight"
        style={{ fontSize: 26, lineHeight: 0.95 }}
      >
        {title}
      </h1>
      <p className="text-[14px] text-[#9CA3AF] mt-2 leading-snug">{subtitle}</p>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-head text-[13px] font-black uppercase tracking-tight text-white/70 flex items-center gap-2 mt-6 mb-3">
      <span className="w-0.5 h-3 bg-[#E63946] rounded-full" />
      {children}
    </h2>
  );
}

function PickerRow({
  label, value, placeholder, onTap, required,
}: {
  label: string;
  value: string;
  placeholder: string;
  onTap: () => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}{required && <span className="text-[#E63946] ml-0.5">*</span>}
      </label>
      <button
        type="button"
        onClick={onTap}
        className="w-full flex items-center justify-between bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 active:bg-[#22262e] transition-colors text-left min-h-[52px]"
      >
        <span className={`text-[16px] truncate ${value ? "text-white" : "text-white/40"}`}>
          {value || placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" className="flex-shrink-0 ml-2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}

/* ── SLIDE 1 — Profil (identique école) ────────────────────────── */

interface Slide1Props {
  firstName: string; lastName: string; email: string;
  photo: string | null;
  photoUploading: boolean;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bio: string; setBio: (v: string) => void;
  sport: string;
  onOpenSport: () => void;
  experienceYears: string; setExperienceYears: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
}

function Slide1Profile(p: Slide1Props) {
  const initials = `${(p.firstName?.[0] ?? "").toUpperCase()}${(p.lastName?.[0] ?? "").toUpperCase()}`;
  const BIO_MAX = 300;
  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading title="Parle-nous de toi." subtitle="Ton profil coach — photo, sport, et un mot sur toi." />

      <SectionTitle>Ta photo (optionnel)</SectionTitle>
      <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4">
        <div className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440] border border-white/[0.06]">
          {p.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo} alt="Photo" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[28px] font-black text-white/60">{initials || "?"}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-white/80">{p.photo ? "Photo téléchargée" : "Aucune photo"}</p>
          <label className="inline-flex items-center mt-2 h-11 px-4 rounded-2xl bg-white/[0.06] active:bg-white/[0.10] text-[14px] font-semibold text-white cursor-pointer min-w-[44px]">
            <input type="file" accept="image/*" onChange={p.onPhotoChange} className="sr-only" disabled={p.photoUploading} />
            {p.photoUploading ? "Téléchargement…" : (p.photo ? "Changer" : "Choisir une photo")}
          </label>
        </div>
      </div>

      <SectionTitle>Sport principal</SectionTitle>
      <PickerRow label="Sport" value={p.sport} placeholder="Sélectionner ton sport…" onTap={p.onOpenSport} required />

      <SectionTitle>Un mot sur toi (optionnel)</SectionTitle>
      <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-3">
        <label htmlFor="coach-bio" className={labelCls}>Bio courte</label>
        <textarea
          id="coach-bio"
          value={p.bio}
          maxLength={BIO_MAX}
          onChange={(e) => p.setBio(e.target.value)}
          placeholder="Mon parcours, mes philosophies d'entraîneur…"
          rows={4}
          className="w-full bg-transparent text-[16px] text-white placeholder:text-white/40 outline-none resize-none"
        />
        <p className="text-[11px] text-white/40 text-right">{p.bio.length} / {BIO_MAX}</p>
      </div>

      <SectionTitle>Expérience &amp; contact (optionnel)</SectionTitle>
      <div className="space-y-3">
        <div>
          <label htmlFor="coach-exp" className={labelCls}>Années d&apos;expérience</label>
          <input
            id="coach-exp"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            value={p.experienceYears}
            onChange={(e) => p.setExperienceYears(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
            placeholder="5"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="coach-phone" className={labelCls}>Téléphone</label>
          <input
            id="coach-phone"
            type="tel"
            inputMode="tel"
            value={p.phone}
            onChange={(e) => p.setPhone(e.target.value)}
            placeholder="(514) 555-0123"
            autoComplete="tel"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}

/* ── SLIDE 2 — Club + Équipe (delta civil) ────────────────────── */

interface Slide2Props {
  sport: string;
  clubMode: ClubMode;
  onClubModeChange: (m: ClubMode) => void;
  selectedClubName: string;
  selectedClubCity: string;
  onOpenClub: () => void;
  newClubName: string; setNewClubName: (v: string) => void;
  newClubCity: string; setNewClubCity: (v: string) => void;
  newClubRegion: string; setNewClubRegion: (v: string) => void;
  teamMode: TeamMode;
  onTeamModeChange: (m: TeamMode) => void;
  selectedTeamName: string;
  onOpenTeam: () => void;
  civilTeamsLoaded: boolean;
  civilTeamsCount: number;
  newTeamName: string; setNewTeamName: (v: string) => void;
  newTeamAgeGroup: string; setNewTeamAgeGroup: (v: string) => void;
  newTeamAgeOther: string; setNewTeamAgeOther: (v: string) => void;
  newTeamDivision: string; setNewTeamDivision: (v: string) => void;
  newTeamDivisionOther: string; setNewTeamDivisionOther: (v: string) => void;
  newTeamGender: Gender | ""; setNewTeamGender: (v: Gender | "") => void;
  onOpenAge: () => void;
  onOpenDivision: () => void;
}

function Slide2ClubTeam(p: Slide2Props) {
  const clubChosen =
    (p.clubMode === "pick" && p.selectedClubName.length > 0)
    || (p.clubMode === "create" && p.newClubName.trim().length > 0);

  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="Ton club et ton équipe."
        subtitle="Choisis un club existant ou crée-le. Tu pourras ajouter d'autres équipes plus tard."
      />

      {/* ── Mon club ── */}
      <SectionTitle>Mon club</SectionTitle>
      {p.clubMode === "pick" ? (
        <>
          <PickerRow
            label="Club civil"
            value={p.selectedClubName}
            placeholder="Sélectionner mon club…"
            onTap={p.onOpenClub}
            required
          />
          {p.selectedClubName && p.selectedClubCity && (
            <p className="text-[12px] text-white/55 mt-1 px-1">{p.selectedClubCity}</p>
          )}
          <button
            type="button"
            onClick={() => p.onClubModeChange("create")}
            className="text-[13px] font-bold text-[#E63946] mt-2 active:opacity-70"
          >
            + Créer un nouveau club
          </button>
        </>
      ) : (
        <div className="space-y-3 bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-4">
          <div>
            <label htmlFor="new-club-name" className={labelCls}>Nom du club <span className="text-[#E63946]">*</span></label>
            <input
              id="new-club-name"
              type="text"
              value={p.newClubName}
              onChange={(e) => p.setNewClubName(e.target.value)}
              placeholder="Ex: Phénix de Mascouche"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="new-club-city" className={labelCls}>Ville (optionnel)</label>
            <input
              id="new-club-city"
              type="text"
              value={p.newClubCity}
              onChange={(e) => p.setNewClubCity(e.target.value)}
              placeholder="Ex: Mascouche"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="new-club-region" className={labelCls}>Région (optionnel)</label>
            <input
              id="new-club-region"
              type="text"
              value={p.newClubRegion}
              onChange={(e) => p.setNewClubRegion(e.target.value)}
              placeholder="Ex: Lanaudière"
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={() => p.onClubModeChange("pick")}
            className="text-[13px] font-bold text-[#9CA3AF] active:opacity-70"
          >
            ← Choisir un club existant
          </button>
        </div>
      )}

      {/* ── Mon équipe ── (visible une fois club ready + sport set) */}
      {clubChosen && p.sport && (
        <>
          <SectionTitle>Mon équipe</SectionTitle>
          {p.teamMode === "pick" && p.clubMode === "pick" ? (
            <>
              {!p.civilTeamsLoaded ? (
                <p className="text-[12px] text-white/40 italic px-1 mt-1">Chargement des équipes…</p>
              ) : p.civilTeamsCount === 0 ? (
                <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-4">
                  <p className="text-[15px] text-white/90 leading-relaxed">
                    Aucune équipe enregistrée pour {p.sport} dans ce club.
                  </p>
                </div>
              ) : (
                <PickerRow
                  label="Équipe"
                  value={p.selectedTeamName}
                  placeholder="Sélectionner mon équipe…"
                  onTap={p.onOpenTeam}
                  required
                />
              )}
              <button
                type="button"
                onClick={() => p.onTeamModeChange("create")}
                className="text-[13px] font-bold text-[#E63946] mt-2 active:opacity-70"
              >
                + Créer une nouvelle équipe
              </button>
            </>
          ) : (
            <div className="space-y-3 bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-4">
              {/* Run 2 : inline form remplacée par le bloc partagé
                  TeamCreateFormBlock — sport/league/season cachés (le
                  sport est défini globalement au slide 1, la ligue
                  dérive du club choisi, la saison reste au défaut RPC).
                  Le bloc gère son propre état + ses MobilePickers ; on
                  bridge vers les 6 setters existants du parent via
                  onChange pour que la validation (canProceedSlide2) et
                  l'envoi RPC (handleFinish) restent inchangés. */}
              <TeamCreateFormBlock
                sports={[]}
                variant="mobile"
                hideSport
                hideLeague
                hideSeason
                initialValues={{
                  name: p.newTeamName,
                  ageGroup: p.newTeamAgeGroup,
                  ageOther: p.newTeamAgeOther,
                  division: p.newTeamDivision,
                  divisionOther: p.newTeamDivisionOther,
                  gender: p.newTeamGender,
                }}
                onChange={(v: TeamFormValues) => {
                  p.setNewTeamName(v.name);
                  p.setNewTeamAgeGroup(v.ageGroup);
                  p.setNewTeamAgeOther(v.ageOther);
                  p.setNewTeamDivision(v.division);
                  p.setNewTeamDivisionOther(v.divisionOther);
                  p.setNewTeamGender(v.gender as Gender | "");
                }}
              />
              {p.clubMode === "pick" && (
                <button
                  type="button"
                  onClick={() => p.onTeamModeChange("pick")}
                  className="text-[13px] font-bold text-[#9CA3AF] active:opacity-70"
                >
                  ← Choisir une équipe existante
                </button>
              )}
            </div>
          )}
        </>
      )}

      {!clubChosen && (
        <p className="text-[12px] text-white/40 italic px-1 mt-3">
          Choisis ou crée ton club pour ajouter ton équipe.
        </p>
      )}
    </div>
  );
}

/* ── SLIDE 3 — Responsable (2 cartes : owner / invite) ────────── */

interface Slide3Props {
  clubMode: ClubMode;
  choice: DirectorChoice; setChoice: (v: DirectorChoice) => void;
  rprpAttested: boolean; setRprpAttested: (v: boolean) => void;
  inviteEmail: string; setInviteEmail: (v: string) => void;
  mustBeResponsable: boolean;
  responsableLoading: boolean;
  inviteEmailValid: boolean;
  inviteEmailFilled: boolean;
}

type CivilCard = {
  value: Exclude<DirectorChoice, null>;
  title: string;
  desc: string;
  iconStroke: string;
  iconBgActive: string;
};
// 3 cartes de RÔLE (sprint civil-cards-restructure). "Inviter" n'est plus
// une carte — c'est un champ optionnel sous "Coach". Le coach reste juste
// "Coach" même s'il invite quelqu'un d'autre à être responsable (le rôle
// reflète le coach connecté, pas la décision sur le responsable).
const CIVIL_CARDS: CivilCard[] = [
  { value: "owner",   title: "Responsable du club",     desc: "Je suis le responsable du club.",                          iconStroke: "#DAB65A", iconBgActive: "bg-[#DAB65A]/15" },
  { value: "interim", title: "Responsable intérimaire", desc: "Je remplis ce rôle temporairement.",                       iconStroke: "#9CA3AF", iconBgActive: "bg-[#6B7280]/20" },
  { value: "coach",   title: "Coach",                   desc: "Je suis coach — un autre est ou sera responsable du club.", iconStroke: "#3B82F6", iconBgActive: "bg-[#3B82F6]/20" },
];

function CivilIcon({ kind, color }: { kind: Exclude<DirectorChoice, null>; color: string }) {
  const common = {
    width: 26, height: 26, viewBox: "0 0 24 24", fill: "none" as const,
    stroke: color, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "owner":
      return (
        <svg {...common}>
          <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" />
          <circle cx="5" cy="6" r="2" />
          <circle cx="12" cy="3" r="2" />
          <circle cx="19" cy="6" r="2" />
        </svg>
      );
    case "interim":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "coach":
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return null;
  }
}

function Slide3Responsable(p: Slide3Props) {
  const newClubMode = p.clubMode === "create";

  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="Quel est ton rôle ?"
        subtitle="Ton rôle au sein du club. Tu peux inviter le responsable si quelqu'un d'autre l'est."
      />

      {/* Bannière contextuelle Loi 25 (club créé ou existant sans responsable) */}
      {p.mustBeResponsable && (
        <div className="mt-5 rounded-2xl border border-[#DAB65A]/30 bg-[#DAB65A]/[0.08] px-4 py-3.5">
          {newClubMode ? (
            <p className="text-[13px] text-white/85 leading-relaxed">
              En créant ce club sur Nexus, tu en deviens le responsable (Loi 25). Coche l&apos;attestation RPRP pour continuer.
            </p>
          ) : p.responsableLoading ? (
            <p className="text-[13px] text-white/85 leading-relaxed">
              Vérification en cours… si ce club n&apos;a pas encore de responsable sur Nexus, tu devras attester l&apos;être pour rejoindre la plateforme (Loi 25).
            </p>
          ) : (
            <p className="text-[13px] text-white/85 leading-relaxed">
              Ce club n&apos;a pas encore de responsable sur Nexus. Pour qu&apos;un club rejoigne la plateforme, un coach doit attester être responsable du programme (Loi 25). Si c&apos;est toi, choisis «&nbsp;Responsable du club&nbsp;» ou «&nbsp;Responsable intérimaire&nbsp;». Sinon, demande à la personne responsable de s&apos;inscrire en premier.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3 mt-6">
        {CIVIL_CARDS.map((card) => {
          const active = p.choice === card.value;
          // "Coach" désactivé tant qu'on n'a pas CONFIRMÉ un responsable
          // existant sur le club.
          const disabled = p.mustBeResponsable && card.value === "coach";
          return (
            <button
              key={card.value}
              type="button"
              disabled={disabled}
              onClick={() => { if (disabled) return; triggerHaptic("Light"); p.setChoice(card.value); }}
              className={`w-full text-left px-4 py-4 rounded-2xl border-2 transition-colors ${
                disabled
                  ? "bg-[#1A1D24]/40 border-white/[0.04] opacity-40 cursor-not-allowed"
                  : active
                    ? "bg-[#E63946]/12 border-[#E63946]/50"
                    : "bg-[#1A1D24] border-white/[0.06] active:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${active && !disabled ? card.iconBgActive : "bg-[#1A1D24]"}`}>
                  <CivilIcon kind={card.value} color={card.iconStroke} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-white">{card.title}</p>
                  <p className="text-[13px] text-white/65 mt-0.5 leading-snug">{card.desc}</p>
                  {disabled && (
                    <p className="text-[12px] text-[#DAB65A]/80 mt-1.5 italic">
                      {newClubMode
                        ? "Indisponible — tu crées le club, tu en deviens le responsable."
                        : p.responsableLoading
                          ? "Vérification du responsable du club…"
                          : "Indisponible — club sans responsable."}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* RPRP — owner OU interim (parité école / RPC 4-choix) */}
      {(p.choice === "owner" || p.choice === "interim") && (
        <div className="mt-5">
          <SectionTitle>Attestation RPRP</SectionTitle>
          <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 space-y-2">
            <p className="text-[13px] text-white/80 leading-relaxed">
              {p.choice === "interim"
                ? <>En tant que responsable intérimaire du club, tu deviens temporairement le Responsable de la Protection des Renseignements Personnels (RPRP) sur Nexus. Si un responsable permanent s&apos;inscrit, ton rôle sera ramené à coach. Tu acceptes la responsabilité associée (Loi 25).</>
                : <>En tant que responsable du club, tu deviens le Responsable de la Protection des Renseignements Personnels (RPRP) pour ce club sur Nexus. Tu acceptes la responsabilité associée (Loi 25).</>}
            </p>
            <label className="flex items-start gap-3 cursor-pointer min-h-[44px] py-1.5">
              <input
                type="checkbox"
                checked={p.rprpAttested}
                onChange={(e) => p.setRprpAttested(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                p.rprpAttested ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56]"
              }`}>
                {p.rprpAttested && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
              <span className="text-[14px] text-white/85 leading-snug flex-1">
                J&apos;atteste avoir pris connaissance et j&apos;accepte les responsabilités RPRP. <span className="text-[#EF4444]">*</span>
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Invite optionnel sous "Coach" sélectionné. Le coach reste juste
          "Coach" ; l'email invite est un BONUS pour pré-onboarder le
          responsable du club. Vide → coach_only à la RPC. */}
      {p.choice === "coach" && (
        <div className="mt-5">
          <SectionTitle>Inviter le responsable (optionnel)</SectionTitle>
          <div>
            <label htmlFor="civil-invite-email" className={labelCls}>
              Courriel du responsable du club
            </label>
            <input
              id="civil-invite-email"
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={p.inviteEmail}
              onChange={(e) => p.setInviteEmail(e.target.value)}
              placeholder="responsable@club.qc.ca"
              className={inputCls}
            />
            <p className="text-[12px] text-white/40 italic mt-1 px-1">
              {p.inviteEmailFilled && !p.inviteEmailValid
                ? "Courriel invalide."
                : "Optionnel — on lui enverra un courriel pour qu'il revendique le rôle de responsable. Laisse vide si tu ne sais pas."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SLIDE 4 — Confirmation ───────────────────────────────────── */

interface Slide4Props {
  firstName: string; lastName: string; email: string;
  sport: string;
  clubName: string; clubCity: string;
  teamName: string;
  directorChoice: DirectorChoice;
  inviteEmail: string;
  inviteEmailValid: boolean;
}

function Slide4Confirmation(p: Slide4Props) {
  // Label reflète le RÔLE du coach connecté, pas la décision sur le
  // responsable. "Coach" reste "Coach" même avec une invitation envoyée.
  const directorLabel = (() => {
    switch (p.directorChoice) {
      case "owner":   return "Responsable du club";
      case "interim": return "Responsable intérimaire";
      case "coach":   return "Coach";
      default:        return "—";
    }
  })();

  // Ligne "Invitation envoyée" affichée uniquement si Coach + email valide.
  const showInviteLine = p.directorChoice === "coach" && p.inviteEmailValid;

  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading title="On est presque prêt." subtitle="Récap de ton profil. Tu pourras tout modifier plus tard." />

      <div className="mt-6 bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <RecapRow label="Nom" value={`${p.firstName} ${p.lastName}`.trim()} />
        <RecapRow label="Courriel" value={p.email} />
        <RecapRow label="Sport" value={p.sport} />
        <RecapRow label="Club" value={p.clubName} sub={p.clubCity || undefined} />
        <RecapRow label="Équipe" value={p.teamName || "—"} />
        <RecapRow label="Rôle" value={directorLabel} sub={showInviteLine ? `Invitation envoyée à ${p.inviteEmail.trim()}` : undefined} />
      </div>
    </div>
  );
}

function RecapRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40">{label}</span>
      <span className="text-[15px] font-semibold text-white">{value || "—"}</span>
      {sub && <span className="text-[12px] text-white/55">{sub}</span>}
    </div>
  );
}
