"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachOnboardingMobileSchool — iter coach-3 (mi-parcours UI)

   Onboarding natif coach école (mobile Capacitor). Dispatché par
   app/onboarding/page.tsx via IS_CAPACITOR + user.role==='coach' +
   user.context !== 'ligue_civile'.

   Auto-suffisant : auth + user load au mount (pattern athlète).
   Resume bypass : si onboarding_complete déjà true → redirect direct
   /coach/tableau-de-bord (pas de re-onboard).

   4 slides (header progress dots) :
     1. Profil      — photo + bio + sport + expérience + tél
     2. École+Équipe— SearchSheet schools SECONDAIRE + team optionnelle
     3. Directeur   — 4 cartes (C'est moi / Inviter / Intérimaire / Coach
                       seulement) + RPRP attestation si claim
     4. Confirmation— récap + CTA Terminer

   ⚠️ Mi-parcours : finish() = STUB (log + redirect dashboard sans
   écriture DB). Le câblage des writes (users update, school_coaches
   UPSERT, team_coaches insert, admin_claims) viendra au sprint
   coach-3b après que BP valide le glissement UI sur émulateur.

   Pattern réutilisés (canon athlète) :
   - voile/fade-in au mount
   - SearchSheet école + équipe scolaire
   - MobilePicker sport
   - bucket "avatars" pour la photo (owner-scoped RLS)
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
import { formatTeamLabel } from "@/lib/teams/teamLabel";
import { ExistingTeamBanner } from "@/components/shared/teams/ExistingTeamBanner";
import TeamCreateForm, { type TeamFormData } from "@/components/onboarding/TeamCreateForm";

/* ── Constantes ──────────────────────────────────────────────── */

const SPORTS = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball",
  "Athlétisme", "Flag football", "Rugby", "Cheerleading",
  "Natation", "Badminton", "Cross-country", "Futsal",
  "Baseball", "Ultimate frisbee", "Autre",
];

const SPORT_OPTIONS: PickerOption[] = SPORTS.map((s) => ({ value: s, label: s }));

type DirectorChoice = "owner" | "interim" | "coach" | null;

/* ── Types ───────────────────────────────────────────────────── */

type SchoolRow = { id: string; name: string; city: string | null; region: string | null; type: string };
type ScolaireTeamRow = {
  id: string;
  name: string;
  division: string | null;
  age_group: string | null;
  gender: string | null;
  sport: string | null;
};

/* ── Helpers ─────────────────────────────────────────────────── */

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

/** Libellé d'une équipe scolaire : "Sport · Catégorie · Division · Genre"
 *  (sport en premier — le picker montre désormais tous les sports). Délègue
 *  au helper partagé pour rester aligné avec le web. */
function scolaireTeamLabel(t: {
  name: string;
  division: string | null;
  age_group: string | null;
  gender: string | null;
  sport: string | null;
}): string {
  return formatTeamLabel(t.sport, t.age_group, t.division, t.gender, t.name);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ═══════════════════════════════════════════════════════════════
   Composant principal
═══════════════════════════════════════════════════════════════ */

export function CoachOnboardingMobileSchool() {
  // Hooks AVANT toute condition (canon Rules of Hooks).
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useMobileToast();

  // 4 slides (0..3). Le step machine reste 0|1|2|3 (le coach école
  // a 5 steps web mais on fusionne école+équipe en mobile pour la
  // respiration UX).
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

  // Slide 2 — École + Équipe
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedSchoolName, setSelectedSchoolName] = useState<string>("");
  const [selectedSchoolCity, setSelectedSchoolCity] = useState<string>("");
  const [selectedSchoolRegion, setSelectedSchoolRegion] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");

  // Détection adoption (Morceau 2) : la bannière a besoin du sport_id (uuid) —
  // ce flux ne tient que le NOM du sport, on le résout ici. Client stable
  // (l'effet de détection clé sur son identité).
  const bannerSupabase = useMemo(() => createClient(), []);
  const [resolvedSportId, setResolvedSportId] = useState<string | null>(null);
  useEffect(() => {
    if (!sport) { setResolvedSportId(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await bannerSupabase.from("sports").select("id").eq("nom", sport).maybeSingle();
      if (!cancelled) setResolvedSportId((data?.id as string) ?? null);
    })();
    return () => { cancelled = true; };
  }, [sport, bannerSupabase]);

  // Slide 3 — Directeur
  const [directorChoice, setDirectorChoice] = useState<DirectorChoice>(null);
  const [rprpAttested, setRprpAttested] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  // Slide 3 — gate Loi 25 : l'école a-t-elle déjà un responsable
  // (admin_claims DIRECTEUR/INTERIM PENDING ou APPROVED) ? RPC 2a.
  // null = inconnu (loading ou échec), true = oui, false = école orpheline.
  // Re-query au change de selectedSchoolId (retour arrière + autre école).
  const [hasResponsable, setHasResponsable] = useState<boolean | null>(null);
  const [responsableLoading, setResponsableLoading] = useState(false);

  // UI flags pickers
  const [openSport, setOpenSport] = useState(false);
  const [schoolSheetOpen, setSchoolSheetOpen] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  // Création d'équipe : overlay TeamCreateForm + données en attente. La
  // création est différée au finish (RPC branche create), pas faite ici.
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [pendingCreateTeam, setPendingCreateTeam] = useState<{
    name: string; age_group: string; division: string; gender: string;
  } | null>(null);

  // Data sources sheets
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);

  const [teamSearch, setTeamSearch] = useState("");
  const [scolaireTeams, setScolaireTeams] = useState<ScolaireTeamRow[]>([]);
  const [scolaireTeamsLoaded, setScolaireTeamsLoaded] = useState(false);
  const [scolaireTeamsLoading, setScolaireTeamsLoading] = useState(false);

  // Saving / loading
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fade-in au mount (parité athlète)
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

      // Resume bypass — déjà complet → direct dashboard coach.
      if (profile.onboarding_complete) {
        router.replace("/coach/tableau-de-bord");
        return;
      }

      // Pré-remplir si déjà des bouts en DB (re-mount mid-onboarding).
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

      // Si school_id déjà set → re-fetch école name (cas re-mount).
      if (profile.school_id) {
        const { data: sch } = await supabase
          .from("schools")
          .select("id, name, city, region")
          .eq("id", profile.school_id)
          .maybeSingle();
        if (!cancelled && sch) {
          setSelectedSchoolId(sch.id as string);
          setSelectedSchoolName((sch.name as string) ?? "");
          setSelectedSchoolCity((sch.city as string) ?? "");
          setSelectedSchoolRegion((sch.region as string) ?? "");
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  /* ── Loaders ─────────────────────────────────────────────── */

  // Écoles secondaires (one-shot quand sheet ouvert)
  useEffect(() => {
    if (!schoolSheetOpen || schools.length > 0) return;
    setSchoolsLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("schools")
        .select("id, name, city, region, type")
        .eq("type", "SECONDAIRE")
        .order("name");
      setSchools((data as SchoolRow[]) || []);
      setSchoolsLoading(false);
    })();
  }, [schoolSheetOpen, schools.length]);

  const visibleSchools = useMemo(() => {
    const q = normalize(schoolSearch);
    if (!q) return schools.slice(0, 50);
    return schools.filter((s) =>
      normalize(s.name).includes(q) || (s.city && normalize(s.city).includes(q))
    ).slice(0, 50);
  }, [schools, schoolSearch]);

  // Équipes scolaires de l'école + sport sélectionnés (parité team-2 athlète).
  // RLS additive Secondary teams readable for onboarding (20260607150000) →
  // ✅ visible pour un coach mid-onboarding (school_id pas encore set).
  useEffect(() => {
    if (!selectedSchoolId) {
      setScolaireTeams([]);
      setScolaireTeamsLoaded(false);
      return;
    }
    let cancelled = false;
    setScolaireTeamsLoading(true);
    setScolaireTeamsLoaded(false);
    (async () => {
      const supabase = createClient();
      // ALL teams of the school, every sport (anti-doublon visibility) —
      // no sport_id filter. Sport name joined for the label + grouping.
      const { data: rows } = await supabase
        .from("teams")
        .select("id, name, division, age_group, gender, sports!sport_id(nom)")
        .eq("school_id", selectedSchoolId)
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      const mapped: ScolaireTeamRow[] = ((rows as Record<string, unknown>[]) || []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        division: (r.division as string) ?? null,
        age_group: (r.age_group as string) ?? null,
        gender: (r.gender as string) ?? null,
        sport: ((r.sports as { nom?: string } | null)?.nom) ?? null,
      }));
      // Sort: the coach's declared sport first (so it stands out), then
      // other sports alphabetically, then team name — same sport contiguous.
      mapped.sort((a, b) => {
        const aMine = a.sport === sport ? 0 : 1;
        const bMine = b.sport === sport ? 0 : 1;
        if (aMine !== bMine) return aMine - bMine;
        const s = (a.sport ?? "").localeCompare(b.sport ?? "");
        return s !== 0 ? s : a.name.localeCompare(b.name);
      });
      setScolaireTeams(mapped);
      setScolaireTeamsLoaded(true);
      setScolaireTeamsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedSchoolId, sport]);

  // Query school_has_responsable dès qu'une école est sélectionnée
  // (avant même d'arriver au slide 3, pour avoir le résultat prêt).
  // Re-fire au change de school (retour arrière + autre école).
  useEffect(() => {
    if (!selectedSchoolId) {
      setHasResponsable(null);
      return;
    }
    let cancelled = false;
    setResponsableLoading(true);
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("school_has_responsable", {
        p_school_id: selectedSchoolId,
      });
      if (cancelled) return;
      if (error) {
        console.error("[CoachOnboardingMobileSchool] school_has_responsable:", error);
        // Échec → null (UI affiche les 4 cartes ; la RPC finish 2b
        // rejettera quand même si l'école est orpheline. Défense en
        // profondeur.).
        setHasResponsable(null);
      } else {
        setHasResponsable(data === true);
      }
      setResponsableLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedSchoolId]);

  // ⚠️ Gate robuste (sprint school-cards-restructure, parité civil) :
  // "Entraîneur seulement" est dispo UNIQUEMENT quand on a CONFIRMÉ
  // qu'un responsable existe (hasResponsable === true). Toute autre
  // valeur (null pendant loading, null sur erreur RPC, false sur école
  // orpheline) → mustBeResponsable=true → seuls owner/interim permis.
  // Évite le trou précédent où null !== false laissait Coach actif.
  const mustBeResponsable = hasResponsable !== true;

  useEffect(() => {
    if (mustBeResponsable && directorChoice === "coach") {
      setDirectorChoice(null);
      setRprpAttested(false);
      setInviteEmail("");
    }
  }, [mustBeResponsable, directorChoice]);

  const visibleScolaireTeams = useMemo(() => {
    const q = normalize(teamSearch);
    if (!q) return scolaireTeams;
    return scolaireTeams.filter((t) =>
      normalize(t.name).includes(q) ||
      (t.sport ? normalize(t.sport).includes(q) : false) ||
      (t.division ? normalize(t.division).includes(q) : false) ||
      (t.age_group ? normalize(t.age_group).includes(q) : false)
    );
  }, [scolaireTeams, teamSearch]);

  /* ── Photo upload (bucket avatars, owner-scoped RLS) ──────── */
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
  const canProceedSlide1 = !!(sport); // bio + expérience + tél + photo optionnels
  const canProceedSlide2 = !!selectedSchoolId; // équipe optionnelle

  // Email invite optionnel sous "Coach". Vide → coach_only à la RPC.
  // Rempli mais invalide → CTA bloqué pour éviter d'envoyer un email
  // mal formé.
  const inviteEmailFilled = inviteEmail.trim().length > 0;
  const inviteEmailValid = inviteEmailFilled && EMAIL_RE.test(inviteEmail.trim());

  const canProceedSlide3 = !!directorChoice && (() => {
    // Coach jamais valide si mustBeResponsable (la carte est aussi
    // visuellement disabled — defense).
    if (mustBeResponsable && directorChoice === "coach") return false;
    // RPRP gate dur pour owner + interim (Loi 25).
    if (directorChoice === "owner" || directorChoice === "interim") return rprpAttested;
    if (directorChoice === "coach") {
      // Coach sans email = coach_only (OK). Coach avec email partiel/
      // invalide = bloqué tant que pas valide ou vidé.
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

  /* ── Submit final (iter coach-responsable-2c — RPC atomique) ───
        Appel UNIQUE à finish_coach_school_onboarding (migration 2b) qui
        remplace les 5 writes du coach-3b. La RPC enforce serveur-side :
        - SCHOOL_REQUIRES_RESPONSABLE : owner/interim obligatoire si école
          orpheline (le gate UI A est aussi en place, défense en profondeur).
        - RPRP_REQUIRED : owner/interim exige p_rprp_accepted=true.
        Toutes les écritures (users, school_coaches, team_coaches,
        admin_claims, profile_data merge) sont atomiques côté serveur.

        La photo : upload Storage déjà fait côté client au slide 1 (bucket
        avatars), on passe juste l'URL à la RPC. */
  const handleFinish = useCallback(async () => {
    if (!canSubmit) return;
    if (!userId || !selectedSchoolId) {
      toast.error({ message: "Données manquantes — réessaye." });
      return;
    }
    setSaving(true);
    triggerHaptic("Light");
    const supabase = createClient();

    try {
      const expYearsParsed = experienceYears ? parseInt(experienceYears, 10) : null;
      const expYears = Number.isFinite(expYearsParsed) ? expYearsParsed : null;

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

      const { error } = await supabase.rpc("finish_coach_school_onboarding", {
        p_school_id:        selectedSchoolId,
        p_region:           selectedSchoolRegion || null,
        p_sport:            sport,
        p_first_name:       firstName.trim() || null,
        p_last_name:        lastName.trim() || null,
        p_phone:            phone.trim() || null,
        p_bio:              bio.trim() || null,
        p_experience_years: expYears,
        p_photo_url:        photo || null,
        // Create et link mutuellement exclusifs : si une équipe est en
        // attente de création, p_team_id = null et on passe les params create
        // (la RPC crée l'équipe sous l'école + head_coach). Sinon, lien normal.
        p_team_id:          pendingCreateTeam ? null : selectedTeamId,
        p_director_choice:  rpcChoice,
        p_rprp_accepted:    !!rprpAttested,
        p_invite_email:     rpcChoice === "invite" ? inviteEmail.trim() : null,
        p_team_name:        pendingCreateTeam?.name ?? null,
        p_team_age_group:   pendingCreateTeam?.age_group ?? null,
        p_team_gender:      pendingCreateTeam?.gender ?? null,
        p_team_division:    pendingCreateTeam?.division ?? null,
      });

      if (error) {
        console.error("[CoachOnboardingMobileSchool] finish_coach_school_onboarding:", error);
        const msg = error.message || "";
        let userMessage = "Erreur lors de la finalisation — réessaye.";
        if (msg.includes("SCHOOL_REQUIRES_RESPONSABLE")) {
          userMessage = "Cette école n'a pas encore de responsable. Choisis « C'est moi » ou « Je serai intérimaire ».";
        } else if (msg.includes("RPRP_REQUIRED")) {
          userMessage = "L'attestation RPRP est obligatoire pour devenir responsable.";
        } else if (msg.includes("NOT_AUTHENTICATED")) {
          userMessage = "Session expirée — reconnecte-toi.";
        } else if (msg.includes("WRONG_ROLE_OR_CONTEXT")) {
          userMessage = "Ce flux est réservé aux coachs scolaires.";
        } else if (msg.includes("INVALID_DIRECTOR_CHOICE")) {
          userMessage = "Choix de responsable invalide.";
        } else if (msg.includes("INVALID_SPORT")) {
          userMessage = "Sport non reconnu — reviens à l'étape Profil et resélectionne ton sport.";
        }
        toast.error({ message: userMessage, detail: error.message });
        setSaving(false);
        return;
      }

      // Re-fetch currentUser → PushRegistrar voit onboarding_complete=true (posé par
      // la RPC finish_coach_school_onboarding) dans la MÊME session → registerPush().
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      triggerHaptic("Medium");
      router.replace("/coach/tableau-de-bord");
    } catch (err) {
      console.error("[CoachOnboardingMobileSchool] finish() exception:", err);
      toast.error({ message: "Erreur inattendue — réessaye." });
      setSaving(false);
    }
  }, [
    canSubmit, userId, firstName, lastName, phone, photo, bio, sport, experienceYears,
    selectedSchoolId, selectedSchoolRegion, selectedTeamId,
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
      style={{
        opacity: mounted ? 1 : 0,
        transition: "opacity 400ms ease-out",
      }}
    >
      {/* Header sticky : back + progress dots */}
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
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= slide ? "bg-[#E63946]" : "bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Contenu — scrollable */}
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
          <Slide2SchoolTeam
            sport={sport}
            selectedSchoolName={selectedSchoolName}
            selectedSchoolCity={selectedSchoolCity}
            onOpenSchool={() => setSchoolSheetOpen(true)}
            selectedTeamName={selectedTeamName}
            onOpenTeam={() => setTeamSheetOpen(true)}
            onCreateTeam={() => setCreateTeamOpen(true)}
            schoolPicked={!!selectedSchoolId}
            scolaireTeamsLoaded={scolaireTeamsLoaded}
            scolaireTeamsCount={scolaireTeams.length}
            teamKind={pendingCreateTeam ? "created" : selectedTeamId ? "joined" : null}
          />
        )}
        {slide === 2 && (
          <Slide3Director
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
            schoolName={selectedSchoolName} schoolCity={selectedSchoolCity}
            teamName={selectedTeamName}
            directorChoice={directorChoice}
            inviteEmail={inviteEmail}
            inviteEmailValid={inviteEmailValid}
          />
        )}
      </div>

      {/* Sticky bottom CTA */}
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

      {/* MobilePicker sport */}
      <MobilePicker
        open={openSport}
        onClose={() => setOpenSport(false)}
        title="Sport principal"
        options={SPORT_OPTIONS}
        value={sport || null}
        onChange={(v) => setSport(v ? String(v) : "")}
      />

      {/* SearchSheet école secondaire */}
      <SearchSheet<SchoolRow>
        open={schoolSheetOpen}
        onClose={() => setSchoolSheetOpen(false)}
        title="Mon école"
        searchPlaceholder="Rechercher mon école…"
        searchValue={schoolSearch}
        onSearchChange={setSchoolSearch}
        items={visibleSchools}
        loading={schoolsLoading}
        keyOf={(s) => s.id}
        onSelect={(s) => {
          setSelectedSchoolId(s.id);
          setSelectedSchoolName(s.name);
          setSelectedSchoolCity(s.city ?? "");
          setSelectedSchoolRegion(s.region ?? "");
          // Reset équipe si école change.
          setSelectedTeamId(null);
          setSelectedTeamName("");
        }}
        renderItem={(s, onTap) => (
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">{s.name}</p>
            {s.city && (
              <p className="text-[13px] text-white/55 truncate">{s.city}</p>
            )}
          </button>
        )}
      />

      {/* SearchSheet équipe scolaire (optionnelle) */}
      <SearchSheet<ScolaireTeamRow>
        open={teamSheetOpen}
        onClose={() => setTeamSheetOpen(false)}
        title="Mon équipe"
        searchPlaceholder="Rechercher mon équipe…"
        searchValue={teamSearch}
        onSearchChange={setTeamSearch}
        items={visibleScolaireTeams}
        loading={scolaireTeamsLoading}
        keyOf={(t) => t.id}
        onSelect={(t) => {
          setSelectedTeamId(t.id);
          setSelectedTeamName(scolaireTeamLabel(t));
        }}
        emptyContent={
          <p className="text-center text-[14px] text-white/55 py-12 px-4">
            Aucune équipe trouvée pour {selectedSchoolName}.
          </p>
        }
        renderItem={(t, onTap) => (
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">{scolaireTeamLabel(t)}</p>
          </button>
        )}
        footer={
          <div className="space-y-2">
            {/* Créer mon équipe — carte au format des cartes d'équipe du
                sheet (parité web : option de création présentée comme une
                carte, bordure rouge pointillée pour signaler l'ajout). */}
            <button
              type="button"
              onClick={() => { setTeamSheetOpen(false); setCreateTeamOpen(true); }}
              className="w-full text-left p-3 bg-[#1A1D24] border border-dashed border-[#E63946]/40 rounded-2xl active:bg-[#22262e] transition-colors"
            >
              <p className="text-[16px] font-semibold text-white">+ Créer mon équipe</p>
              <p className="text-[13px] text-white/55">Mon équipe n&apos;est pas listée</p>
            </button>
            {/* Continuer sans équipe — clear TOUT état d'équipe en attente :
                la sélection à rejoindre (selectedTeamId/Name) ET une création
                différée (pendingCreateTeam). Sinon le finish partirait quand
                même avec la branche create (p_team_name) ou le lien. "Sans
                équipe" = finish avec p_team_id NULL et aucune branche create. */}
            <button
              type="button"
              onClick={() => {
                setSelectedTeamId(null);
                setSelectedTeamName("");
                setPendingCreateTeam(null);
                setTeamSheetOpen(false);
              }}
              className="w-full h-11 rounded-2xl border border-white/[0.10] text-[14px] font-semibold text-white/70 active:bg-white/[0.04]"
            >
              Continuer sans équipe
            </button>
          </div>
        }
      />

      {/* Overlay création d'équipe — réutilise TeamCreateForm (verrouillé sur
          l'école). À la soumission, on diffère au finish (RPC branche create)
          via pendingCreateTeam ; pas d'écriture DB ici. */}
      {createTeamOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#111317] overflow-y-auto"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="px-4 py-6 max-w-md mx-auto">
            <TeamCreateForm
              sportId=""
              sportName={sport}
              lockedSchoolId={selectedSchoolId ?? undefined}
              lockedSchoolName={selectedSchoolName}
              lockedLabel="École"
              renderAdoption={(a) => (
                <ExistingTeamBanner
                  supabase={bannerSupabase}
                  schoolId={selectedSchoolId}
                  sportId={resolvedSportId}
                  ageGroup={a.ageGroup}
                  gender={a.gender}
                  division={a.division}
                  onAdopt={(t) => {
                    // Adopter = sélection locale de l'équipe existante (le
                    // rattachement réel se fait au finish, RPC branche LINK).
                    setPendingCreateTeam(null);
                    setSelectedTeamId(t.id);
                    setSelectedTeamName(
                      formatTeamLabel(sport, t.ageGroup ?? "", t.division ?? "", t.gender ?? "", t.name),
                    );
                    setCreateTeamOpen(false);
                  }}
                />
              )}
              onCancel={() => setCreateTeamOpen(false)}
              onSubmit={(data: TeamFormData) => {
                setPendingCreateTeam({
                  name: data.team_name,
                  age_group: data.age_group,
                  division: data.division,
                  gender: data.gender,
                });
                setSelectedTeamId(null);
                setSelectedTeamName(
                  formatTeamLabel(sport, data.age_group, data.division, data.gender, data.team_name),
                );
                setCreateTeamOpen(false);
              }}
            />
          </div>
        </div>
      )}
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

/* ── SLIDE 1 — Profil ─────────────────────────────────────────── */

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
      <StepHeading
        title="Parle-nous de toi."
        subtitle="Ton profil coach — photo, sport, et un mot sur toi."
      />

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
          <p className="text-[14px] text-white/80">
            {p.photo ? "Photo téléchargée" : "Aucune photo"}
          </p>
          <label className="inline-flex items-center mt-2 h-11 px-4 rounded-2xl bg-white/[0.06] active:bg-white/[0.10] text-[14px] font-semibold text-white cursor-pointer min-w-[44px]">
            <input
              type="file"
              accept="image/*"
              onChange={p.onPhotoChange}
              className="sr-only"
              disabled={p.photoUploading}
            />
            {p.photoUploading ? "Téléchargement…" : (p.photo ? "Changer" : "Choisir une photo")}
          </label>
        </div>
      </div>

      <SectionTitle>Sport principal</SectionTitle>
      <PickerRow
        label="Sport"
        value={p.sport}
        placeholder="Sélectionner ton sport…"
        onTap={p.onOpenSport}
        required
      />

      <SectionTitle>Un mot sur toi (optionnel)</SectionTitle>
      <div className={`bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-3`}>
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

/* ── SLIDE 2 — École + Équipe ────────────────────────────────── */

interface Slide2Props {
  sport: string;
  selectedSchoolName: string;
  selectedSchoolCity: string;
  onOpenSchool: () => void;
  selectedTeamName: string;
  onOpenTeam: () => void;
  // Ouvre l'overlay de création (même que le footer du sheet) — utilisé
  // par le cas 0 équipe où le sheet n'est jamais ouvert.
  onCreateTeam: () => void;
  schoolPicked: boolean;
  scolaireTeamsLoaded: boolean;
  scolaireTeamsCount: number;
  // "created" (pendingCreateTeam) vs "joined" (équipe existante) vs null —
  // pilote la copie de confirmation. Pure présentation.
  teamKind: "joined" | "created" | null;
}

function Slide2SchoolTeam(p: Slide2Props) {
  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="Ton école et ton équipe."
        subtitle="L'établissement où tu entraînes. Tu pourras ajouter d'autres équipes plus tard."
      />

      <SectionTitle>Mon école</SectionTitle>
      <PickerRow
        label="École secondaire"
        value={p.selectedSchoolName}
        placeholder="Sélectionner mon école…"
        onTap={p.onOpenSchool}
        required
      />
      {p.selectedSchoolName && p.selectedSchoolCity && (
        <p className="text-[12px] text-white/55 mt-1 px-1">{p.selectedSchoolCity}</p>
      )}

      {/* Section ÉQUIPE — visible une fois école + sport set. Cas C
          identique à l'athlète (pas d'équipe → message statique, non
          bloquant). */}
      {p.schoolPicked && p.sport && (
        <>
          <SectionTitle>Mon équipe (optionnel)</SectionTitle>
          {!p.scolaireTeamsLoaded ? (
            <p className="text-[12px] text-white/40 italic px-1 mt-1">
              Chargement des équipes…
            </p>
          ) : p.scolaireTeamsCount === 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] text-white/55 px-1 leading-relaxed">
                Aucune équipe enregistrée pour {p.sport} à cette école. Crée la tienne ci-dessous.
              </p>
              {p.selectedTeamName ? (
                <div className="flex items-start gap-2 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-2xl px-3 py-2.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5"/></svg>
                  <p className="text-[13px] text-[#22C55E] font-semibold">
                    {p.teamKind === "created" ? "Tu as créé" : "Tu as rejoint"} {p.selectedTeamName}. Tu peux continuer.
                  </p>
                </div>
              ) : (
                /* Carte "Créer" — même format que celle du footer du sheet ;
                   ouvre le MÊME overlay (pendingCreateTeam), pas de form dupliqué. */
                <button
                  type="button"
                  onClick={p.onCreateTeam}
                  className="w-full text-left p-3 bg-[#1A1D24] border border-dashed border-[#E63946]/40 rounded-2xl active:bg-[#22262e] transition-colors"
                >
                  <p className="text-[16px] font-semibold text-white">+ Créer mon équipe</p>
                  <p className="text-[13px] text-white/55">Aucune équipe listée — crée la tienne.</p>
                </button>
              )}
            </div>
          ) : (
            <>
              <PickerRow
                label="Équipe"
                value={p.selectedTeamName}
                placeholder="Sélectionner mon équipe…"
                onTap={p.onOpenTeam}
              />
              {p.selectedTeamName ? (
                <div className="mt-2 flex items-start gap-2 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-2xl px-3 py-2.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5"/></svg>
                  <p className="text-[13px] text-[#22C55E] font-semibold">
                    {p.teamKind === "created" ? "Tu as créé" : "Tu as rejoint"} {p.selectedTeamName}. Tu peux continuer.
                  </p>
                </div>
              ) : (
                <p className="text-[12px] text-white/40 italic px-1 mt-1">
                  Non bloquant — tu peux continuer sans équipe.
                </p>
              )}
            </>
          )}
        </>
      )}

      {!p.schoolPicked && (
        <p className="text-[12px] text-white/40 italic px-1 mt-3">
          Choisis ton école pour voir les équipes disponibles.
        </p>
      )}
    </div>
  );
}

/* ── SLIDE 3 — Directeur sportif (3 cartes + RPRP / invite optionnel) ──── */

interface Slide3Props {
  choice: DirectorChoice; setChoice: (v: DirectorChoice) => void;
  rprpAttested: boolean; setRprpAttested: (v: boolean) => void;
  inviteEmail: string; setInviteEmail: (v: string) => void;
  mustBeResponsable: boolean;
  responsableLoading: boolean;
  inviteEmailValid: boolean;
  inviteEmailFilled: boolean;
}

/* 3 cartes de RÔLE (sprint school-cards-restructure, parité civil).
   "Inviter quelqu'un" n'est plus une carte — c'est un champ optionnel
   sous "Entraîneur seulement". Le coach reste juste "Entraîneur"
   même s'il invite un directeur sportif (le rôle reflète le coach
   connecté, pas la décision sur le responsable). */
type DirectorCard = {
  value: Exclude<DirectorChoice, null>;
  title: string;
  desc: string;
  iconStroke: string;
  iconBgActive: string;
};

const DIRECTOR_CARDS: DirectorCard[] = [
  { value: "owner",   title: "C'est moi",            desc: "Je suis le responsable de sports de l'école.",          iconStroke: "#DAB65A", iconBgActive: "bg-[#DAB65A]/15" },
  { value: "interim", title: "Je serai intérimaire", desc: "Je remplis ce rôle temporairement.",                iconStroke: "#9CA3AF", iconBgActive: "bg-[#6B7280]/20" },
  { value: "coach",   title: "Entraîneur seulement", desc: "Je suis coach — un autre est ou sera responsable de sports.", iconStroke: "#3B82F6", iconBgActive: "bg-[#3B82F6]/20" },
];

function DirectorIcon({ kind, color }: { kind: Exclude<DirectorChoice, null>; color: string }) {
  const common = {
    width: 26, height: 26, viewBox: "0 0 24 24", fill: "none" as const,
    stroke: color, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "owner":
      // Couronne (web L1171-1173 : path + 3 cercles)
      return (
        <svg {...common}>
          <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" />
          <circle cx="5" cy="6" r="2" />
          <circle cx="12" cy="3" r="2" />
          <circle cx="19" cy="6" r="2" />
        </svg>
      );
    case "interim":
      // Horloge (web L1213-1216)
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "coach":
      // Personne (web L1239-1242 : silhouette utilisateur)
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

function Slide3Director(p: Slide3Props) {
  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="Quel est ton rôle ?"
        subtitle="Ton rôle au sein de l'école. Tu peux inviter le responsable de sports si quelqu'un d'autre l'est."
      />

      {/* Bannière contextuelle Loi 25 (école sans responsable, ou en cours
          de vérification). */}
      {p.mustBeResponsable && (
        <div className="mt-5 rounded-2xl border border-[#DAB65A]/30 bg-[#DAB65A]/[0.08] px-4 py-3.5">
          {p.responsableLoading ? (
            <p className="text-[13px] text-white/85 leading-relaxed">
              Vérification en cours… si cette école n&apos;a pas encore de responsable sur Nexus, tu devras attester l&apos;être pour rejoindre la plateforme (Loi 25).
            </p>
          ) : (
            <p className="text-[13px] text-white/85 leading-relaxed">
              Cette école n&apos;a pas encore de responsable sur Nexus. Pour qu&apos;une école rejoigne la plateforme, un coach doit attester être responsable du programme (Loi 25). Si c&apos;est toi, choisis «&nbsp;C&apos;est moi&nbsp;» ou «&nbsp;Je serai intérimaire&nbsp;». Sinon, demande à la personne responsable de s&apos;inscrire en premier.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3 mt-6">
        {DIRECTOR_CARDS.map((card) => {
          const active = p.choice === card.value;
          // "Entraîneur seulement" désactivé tant qu'on n'a pas CONFIRMÉ
          // un responsable existant sur l'école.
          const disabled = p.mustBeResponsable && card.value === "coach";
          return (
            <button
              key={card.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                triggerHaptic("Light");
                p.setChoice(card.value);
              }}
              className={`w-full text-left px-4 py-4 rounded-2xl border-2 transition-colors ${
                disabled
                  ? "bg-[#1A1D24]/40 border-white/[0.04] opacity-40 cursor-not-allowed"
                  : active
                    ? "bg-[#E63946]/12 border-[#E63946]/50"
                    : "bg-[#1A1D24] border-white/[0.06] active:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  disabled
                    ? "bg-[#1A1D24]"
                    : active ? card.iconBgActive : "bg-[#1A1D24]"
                }`}>
                  <DirectorIcon kind={card.value} color={card.iconStroke} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-white">{card.title}</p>
                  <p className="text-[13px] text-white/65 mt-0.5 leading-snug">{card.desc}</p>
                  {disabled && (
                    <p className="text-[12px] text-[#DAB65A]/80 mt-1.5 italic">
                      {p.responsableLoading ? "Vérification du responsable de l'école…" : "Indisponible — école sans responsable."}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Suppléments conditionnels */}
      {(p.choice === "owner" || p.choice === "interim") && (
        <div className="mt-5">
          <SectionTitle>Attestation RPRP</SectionTitle>
          <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 space-y-2">
            <p className="text-[13px] text-white/80 leading-relaxed">
              En tant que responsable de sports, tu deviens le Responsable de la Protection des Renseignements Personnels (RPRP) pour ton école sur Nexus. Tu acceptes la responsabilité associée (Loi 25).
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

      {/* Invite optionnel sous "Entraîneur seulement" sélectionné. Le
          coach reste juste "Entraîneur" ; l'email invite est un BONUS
          pour pré-onboarder le directeur sportif. Vide → coach_only. */}
      {p.choice === "coach" && (
        <div className="mt-5">
          <SectionTitle>Inviter le responsable de sports (optionnel)</SectionTitle>
          <div>
            <label htmlFor="coach-invite-email" className={labelCls}>
              Courriel du responsable de sports
            </label>
            <input
              id="coach-invite-email"
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={p.inviteEmail}
              onChange={(e) => p.setInviteEmail(e.target.value)}
              placeholder="responsable@ecole.qc.ca"
              className={inputCls}
            />
            <p className="text-[12px] text-white/40 italic mt-1 px-1">
              {p.inviteEmailFilled && !p.inviteEmailValid
                ? "Courriel invalide."
                : "Optionnel — on lui enverra un courriel pour revendiquer le rôle de responsable de sports. Laisse vide si tu ne sais pas."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SLIDE 4 — Confirmation / Récap ──────────────────────────── */

interface Slide4Props {
  firstName: string; lastName: string; email: string;
  sport: string;
  schoolName: string; schoolCity: string;
  teamName: string;
  directorChoice: DirectorChoice;
  inviteEmail: string;
  inviteEmailValid: boolean;
}

function Slide4Confirmation(p: Slide4Props) {
  // Label reflète le RÔLE du coach connecté, pas la décision sur le
  // responsable. "Entraîneur" reste "Entraîneur" même avec une invitation.
  const directorLabel = (() => {
    switch (p.directorChoice) {
      case "owner":   return "Responsable de sports";
      case "interim": return "Responsable de sports intérimaire";
      case "coach":   return "Entraîneur";
      default:        return "—";
    }
  })();

  // Ligne "Invitation envoyée" uniquement si Coach + email valide.
  const showInviteLine = p.directorChoice === "coach" && p.inviteEmailValid;

  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="On est presque prêt."
        subtitle="Récap de ton profil. Tu pourras tout modifier plus tard."
      />

      <div className="mt-6 bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <RecapRow label="Nom" value={`${p.firstName} ${p.lastName}`.trim()} />
        <RecapRow label="Courriel" value={p.email} />
        <RecapRow label="Sport" value={p.sport} />
        <RecapRow label="École" value={p.schoolName} sub={p.schoolCity || undefined} />
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
