"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruiterOnboardingMobile — iter recruteur-onboarding-mobile

   Onboarding natif recruteur CÉGEP (mobile Capacitor). Dispatché par
   app/onboarding/page.tsx via IS_CAPACITOR + user.role==='recruiter'.

   Auto-suffisant : auth + user load au mount (pattern coach/athlète).
   Resume bypass : onboarding_complete déjà true → redirect direct
   /recruteur/tableau-de-bord.

   5 slides (header progress dots) :
     1. Profil      — photo + bio + sport + expérience + tél  (identique coach)
     2. CÉGEP       — SearchSheet sur schools has_collegial=true (75 CÉGEPs)
     3. Programme   — équipes du CÉGEP filtrées sport (OPTIONNEL — bouton
                       "Continuer sans" non bloquant)
     4. Responsable — 3 cartes pattern cards-restructure (owner/interim/coach)
                       + invite optionnel sous "Recruteur seulement" + gating
                       mustBeResponsable + RPRP dur owner/interim
     5. Récap       — Confirme ton profil + bouton Terminer

   finish() → supabase.rpc("finish_recruiter_onboarding", { 12 params })
   (migration 20260613000000) — atomique, enforce SCHOOL_REQUIRES_RESPONSABLE
   + RPRP_REQUIRED côté serveur. PAS de recruiter_preferences (hors-scope
   onboarding, géré via /recruteur/parametres post-onboarding).

   Pattern réutilisés (canon coach école/civil mobile) :
   - voile/fade-in mount
   - SearchSheet CÉGEP + programme
   - MobilePicker sport
   - bucket "avatars" pour photo (owner-scoped RLS)
   - mustBeResponsable conservative (hasResponsable !== true couvre loading/
     échec/orphan)
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { SearchSheet } from "@/components/mobile/SearchSheet";

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

type CegepRow = { id: string; name: string; city: string | null; region: string | null };
type ProgramRow = {
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

function programLabel(t: { name: string; division: string | null; age_group: string | null; gender: string | null }): string {
  const parts = [t.age_group, t.division, t.gender].map((v) => (v ?? "").trim()).filter((v) => v.length > 0);
  return parts.length > 0 ? parts.join(" · ") : t.name;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ═══════════════════════════════════════════════════════════════
   Composant principal
═══════════════════════════════════════════════════════════════ */

export function RecruiterOnboardingMobile() {
  const router = useRouter();
  const toast = useMobileToast();

  const [slide, setSlide] = useState<0 | 1 | 2 | 3 | 4>(0);

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

  // Slide 2 — CÉGEP
  const [selectedCegepId, setSelectedCegepId] = useState<string | null>(null);
  const [selectedCegepName, setSelectedCegepName] = useState<string>("");
  const [selectedCegepCity, setSelectedCegepCity] = useState<string>("");

  // Slide 3 — Programme (optionnel)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedProgramName, setSelectedProgramName] = useState<string>("");

  // Slide 4 — Responsable
  const [directorChoice, setDirectorChoice] = useState<DirectorChoice>(null);
  const [rprpAttested, setRprpAttested] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  // UI flags pickers
  const [openSport, setOpenSport] = useState(false);
  const [cegepSheetOpen, setCegepSheetOpen] = useState(false);
  const [programSheetOpen, setProgramSheetOpen] = useState(false);

  // Data sources sheets
  const [cegepSearch, setCegepSearch] = useState("");
  const [cegeps, setCegeps] = useState<CegepRow[]>([]);
  const [cegepsLoading, setCegepsLoading] = useState(false);

  const [programSearch, setProgramSearch] = useState("");
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [programsLoaded, setProgramsLoaded] = useState(false);
  const [programsLoading, setProgramsLoading] = useState(false);

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
        .select("first_name, last_name, role, context, onboarding_complete, phone, photo_url, sport, school_id, primary_team_id, profile_data")
        .eq("id", user.id)
        .single();

      if (cancelled) return;
      if (!profile) { router.push("/auth"); return; }

      if (profile.onboarding_complete) {
        router.replace("/recruteur/tableau-de-bord");
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

      // Pré-remplir CÉGEP si school_id existant pointe sur un CÉGEP.
      if (profile.school_id) {
        const { data: sch } = await supabase
          .from("schools")
          .select("id, name, city, region, has_collegial, type")
          .eq("id", profile.school_id)
          .maybeSingle();
        if (!cancelled && sch && ((sch.has_collegial as boolean) === true || (sch.type as string) === "CEGEP")) {
          setSelectedCegepId(sch.id as string);
          setSelectedCegepName((sch.name as string) ?? "");
          setSelectedCegepCity((sch.city as string) ?? "");
        }
      }
      // Pré-remplir programme si primary_team_id existant.
      if (profile.primary_team_id) {
        const { data: tm } = await supabase
          .from("teams")
          .select("id, name, division, age_group, gender")
          .eq("id", profile.primary_team_id)
          .maybeSingle();
        if (!cancelled && tm) {
          setSelectedProgramId(tm.id as string);
          setSelectedProgramName(programLabel({
            name: tm.name as string,
            division: (tm.division as string) ?? null,
            age_group: (tm.age_group as string) ?? null,
            gender: (tm.gender as string) ?? null,
          }));
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  /* ── Loaders ─────────────────────────────────────────────── */

  // CÉGEPs (one-shot quand sheet ouvert)
  useEffect(() => {
    if (!cegepSheetOpen || cegeps.length > 0) return;
    setCegepsLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("schools")
        .select("id, name, city, region")
        .eq("has_collegial", true)
        .order("name");
      setCegeps((data as CegepRow[]) || []);
      setCegepsLoading(false);
    })();
  }, [cegepSheetOpen, cegeps.length]);

  const visibleCegeps = useMemo(() => {
    const q = normalize(cegepSearch);
    if (!q) return cegeps.slice(0, 50);
    return cegeps.filter((c) =>
      normalize(c.name).includes(q) || (c.city && normalize(c.city).includes(q))
    ).slice(0, 50);
  }, [cegeps, cegepSearch]);

  // Programmes (équipes) du CÉGEP filtrées sport — parité école teams.
  useEffect(() => {
    if (!selectedCegepId || !sport) {
      setPrograms([]);
      setProgramsLoaded(false);
      return;
    }
    let cancelled = false;
    setProgramsLoading(true);
    setProgramsLoaded(false);
    (async () => {
      const supabase = createClient();
      const { data: sportRow } = await supabase
        .from("sports").select("id").eq("nom", sport).maybeSingle();
      if (cancelled) return;
      if (!sportRow?.id) {
        setPrograms([]); setProgramsLoaded(true); setProgramsLoading(false);
        return;
      }
      const { data: rows } = await supabase
        .from("teams")
        .select("id, name, division, age_group, gender")
        .eq("school_id", selectedCegepId)
        .eq("sport_id", sportRow.id)
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      const mapped: ProgramRow[] = ((rows as Record<string, unknown>[]) || []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        division: (r.division as string) ?? null,
        age_group: (r.age_group as string) ?? null,
        gender: (r.gender as string) ?? null,
      }));
      setPrograms(mapped);
      setProgramsLoaded(true);
      setProgramsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedCegepId, sport]);

  const visiblePrograms = useMemo(() => {
    const q = normalize(programSearch);
    if (!q) return programs;
    return programs.filter((t) =>
      normalize(t.name).includes(q) ||
      (t.division ? normalize(t.division).includes(q) : false) ||
      (t.age_group ? normalize(t.age_group).includes(q) : false)
    );
  }, [programs, programSearch]);

  // school_has_responsable — query quand CÉGEP sélectionné.
  useEffect(() => {
    if (!selectedCegepId) {
      setHasResponsable(null);
      setResponsableLoading(false);
      return;
    }
    let cancelled = false;
    setResponsableLoading(true);
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("school_has_responsable", {
        p_school_id: selectedCegepId,
      });
      if (cancelled) return;
      if (error) {
        console.error("[RecruiterOnboardingMobile] school_has_responsable:", error);
        setHasResponsable(null);
      } else {
        setHasResponsable(data === true);
      }
      setResponsableLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedCegepId]);

  // ⚠️ Gate robuste : "Recruteur seulement" dispo UNIQUEMENT si
  // hasResponsable===true confirmé. Pendant loading/échec/orphan →
  // mustBeResponsable=true → owner/interim seulement.
  const mustBeResponsable = hasResponsable !== true;
  useEffect(() => {
    if (mustBeResponsable && directorChoice === "coach") {
      setDirectorChoice(null);
      setRprpAttested(false);
      setInviteEmail("");
    }
  }, [mustBeResponsable, directorChoice]);

  /* ── Photo upload (bucket avatars, owner-scoped RLS) ────────── */
  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setPhotoUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });
    if (upErr) {
      toast.error({ message: "Échec de l'upload", detail: upErr.message });
      setPhotoUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
    setPhoto(pub.publicUrl);
    setPhotoUploading(false);
    triggerHaptic("Light");
  }, [userId, toast]);

  /* ── Validation par slide ────────────────────────────────── */
  const canProceedSlide1 = !!sport;            // bio + expérience + tél + photo optionnels
  const canProceedSlide2 = !!selectedCegepId;  // CÉGEP requis
  const canProceedSlide3 = true;               // Programme OPTIONNEL (non-bloquant)

  const inviteEmailFilled = inviteEmail.trim().length > 0;
  const inviteEmailValid = inviteEmailFilled && EMAIL_RE.test(inviteEmail.trim());

  const canProceedSlide4 = !!directorChoice && (() => {
    if (mustBeResponsable && directorChoice === "coach") return false;
    if (directorChoice === "owner" || directorChoice === "interim") return rprpAttested;
    if (directorChoice === "coach") {
      if (inviteEmailFilled && !inviteEmailValid) return false;
      return true;
    }
    return false;
  })();

  const canSubmit = canProceedSlide1 && canProceedSlide2 && canProceedSlide3 && canProceedSlide4 && !saving;

  /* ── Handlers nav ────────────────────────────────────────── */
  const handleNext = useCallback(() => {
    triggerHaptic("Light");
    if (slide === 0 && canProceedSlide1) setSlide(1);
    else if (slide === 1 && canProceedSlide2) setSlide(2);
    else if (slide === 2 && canProceedSlide3) setSlide(3);
    else if (slide === 3 && canProceedSlide4) setSlide(4);
  }, [slide, canProceedSlide1, canProceedSlide2, canProceedSlide3, canProceedSlide4]);

  const handleBack = useCallback(() => {
    triggerHaptic("Light");
    if (slide > 0) setSlide((s) => (s - 1) as 0 | 1 | 2 | 3 | 4);
  }, [slide]);

  /* ── Submit final → RPC atomique recruteur ───────────────── */
  const handleFinish = useCallback(async () => {
    if (!canSubmit || !userId || !selectedCegepId) return;
    setSaving(true);
    triggerHaptic("Light");
    const supabase = createClient();

    try {
      const expRaw = experienceYears;
      const expParsed = expRaw ? parseInt(expRaw, 10) : null;
      const expYears = Number.isFinite(expParsed) ? expParsed : null;

      // Mapper UI (3 cartes) → RPC director_choice (4 valeurs).
      const rpcChoice: "owner" | "interim" | "invite" | "coach_only" =
        directorChoice === "owner"   ? "owner"
        : directorChoice === "interim" ? "interim"
        : (directorChoice === "coach" && inviteEmailValid) ? "invite"
        : "coach_only";

      const { error } = await supabase.rpc("finish_recruiter_onboarding", {
        p_cegep_id:         selectedCegepId,
        p_primary_team_id:  selectedProgramId,
        p_sport:            sport,
        p_first_name:       firstName.trim() || null,
        p_last_name:        lastName.trim()  || null,
        p_phone:            phone.trim() || null,
        p_bio:              bio.trim() || null,
        p_experience_years: expYears,
        p_photo_url:        photo || null,
        p_director_choice:  rpcChoice,
        p_rprp_accepted:    !!rprpAttested,
        p_invite_email:     rpcChoice === "invite" ? inviteEmail.trim() : null,
      });

      if (error) {
        console.error("[RecruiterOnboardingMobile] finish_recruiter_onboarding:", error);
        const msg = error.message || "";
        let userMessage = "Erreur lors de la finalisation — réessaye.";
        if (msg.includes("SCHOOL_REQUIRES_RESPONSABLE")) {
          userMessage = "Ce CÉGEP n'a pas encore de responsable. Choisis « C'est moi » ou « Je serai intérimaire ».";
        } else if (msg.includes("RPRP_REQUIRED")) {
          userMessage = "L'attestation RPRP est obligatoire pour devenir responsable.";
        } else if (msg.includes("INVALID_CEGEP")) {
          userMessage = "CÉGEP invalide — réessaye.";
        } else if (msg.includes("INVALID_DIRECTOR_CHOICE")) {
          userMessage = "Choix de responsable invalide.";
        } else if (msg.includes("NOT_AUTHENTICATED")) {
          userMessage = "Session expirée — reconnecte-toi.";
        } else if (msg.includes("WRONG_ROLE_OR_CONTEXT")) {
          userMessage = "Ce flux est réservé aux recruteurs CÉGEP.";
        }
        toast.error({ message: userMessage, detail: error.message });
        setSaving(false);
        return;
      }

      triggerHaptic("Medium");
      router.replace("/recruteur/tableau-de-bord");
    } catch (err) {
      console.error("[RecruiterOnboardingMobile] finish() exception:", err);
      toast.error({ message: "Erreur inattendue — réessaye." });
      setSaving(false);
    }
  }, [
    canSubmit, userId, firstName, lastName, phone, photo, bio, sport, experienceYears,
    selectedCegepId, selectedProgramId,
    directorChoice, rprpAttested, inviteEmail, inviteEmailValid,
    router, toast,
  ]);

  /* ── Render ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#111317] text-white flex items-center justify-center">
        <p className="text-[14px] text-[#6b7280]">Chargement…</p>
      </div>
    );
  }

  const TOTAL_SLIDES = 5;
  const isLast = slide === TOTAL_SLIDES - 1;

  return (
    <div
      className="min-h-screen bg-[#111317] text-white flex flex-col"
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
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
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
          <Slide2Cegep
            selectedCegepName={selectedCegepName}
            selectedCegepCity={selectedCegepCity}
            onOpenCegep={() => setCegepSheetOpen(true)}
          />
        )}
        {slide === 2 && (
          <Slide3Program
            sport={sport}
            cegepName={selectedCegepName}
            selectedProgramName={selectedProgramName}
            onOpenProgram={() => setProgramSheetOpen(true)}
            cegepPicked={!!selectedCegepId}
            programsLoaded={programsLoaded}
            programsCount={programs.length}
          />
        )}
        {slide === 3 && (
          <Slide4Director
            choice={directorChoice} setChoice={setDirectorChoice}
            rprpAttested={rprpAttested} setRprpAttested={setRprpAttested}
            inviteEmail={inviteEmail} setInviteEmail={setInviteEmail}
            mustBeResponsable={mustBeResponsable}
            responsableLoading={responsableLoading}
            inviteEmailValid={inviteEmailValid}
            inviteEmailFilled={inviteEmailFilled}
          />
        )}
        {slide === 4 && (
          <Slide5Confirmation
            firstName={firstName} lastName={lastName} email={email}
            sport={sport}
            cegepName={selectedCegepName} cegepCity={selectedCegepCity}
            programName={selectedProgramName}
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
              (slide === 2 && !canProceedSlide3) ||
              (slide === 3 && !canProceedSlide4)
            }
            className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all ${
              ((slide === 0 && canProceedSlide1) ||
               (slide === 1 && canProceedSlide2) ||
               (slide === 2 && canProceedSlide3) ||
               (slide === 3 && canProceedSlide4))
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
        title="Sport recruté"
        options={SPORT_OPTIONS}
        value={sport || null}
        onChange={(v) => setSport(v ? String(v) : "")}
      />

      {/* SearchSheet CÉGEP */}
      <SearchSheet<CegepRow>
        open={cegepSheetOpen}
        onClose={() => setCegepSheetOpen(false)}
        title="Mon CÉGEP"
        searchPlaceholder="Rechercher mon CÉGEP…"
        searchValue={cegepSearch}
        onSearchChange={setCegepSearch}
        items={visibleCegeps}
        loading={cegepsLoading}
        keyOf={(c) => c.id}
        onSelect={(c) => {
          setSelectedCegepId(c.id);
          setSelectedCegepName(c.name);
          setSelectedCegepCity(c.city ?? "");
          // Reset programme si CÉGEP change.
          setSelectedProgramId(null);
          setSelectedProgramName("");
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
      />

      {/* SearchSheet programme (équipe) */}
      <SearchSheet<ProgramRow>
        open={programSheetOpen}
        onClose={() => setProgramSheetOpen(false)}
        title="Mon programme"
        searchPlaceholder="Rechercher mon programme…"
        searchValue={programSearch}
        onSearchChange={setProgramSearch}
        items={visiblePrograms}
        loading={programsLoading}
        keyOf={(t) => t.id}
        onSelect={(t) => {
          setSelectedProgramId(t.id);
          setSelectedProgramName(programLabel(t));
        }}
        emptyContent={
          <p className="text-center text-[14px] text-white/55 py-12 px-4">
            Aucun programme trouvé pour {selectedCegepName} en {sport || "ce sport"}.
          </p>
        }
        renderItem={(t, onTap) => (
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">{programLabel(t)}</p>
          </button>
        )}
        footer={
          <button
            type="button"
            onClick={() => {
              setSelectedProgramId(null);
              setSelectedProgramName("");
              setProgramSheetOpen(false);
            }}
            className="w-full h-11 rounded-2xl border border-white/[0.10] text-[14px] font-semibold text-white/70 active:bg-white/[0.04]"
          >
            Continuer sans programme
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

/* ── SLIDE 1 — Profil ────────────────────────────────────────── */

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
      <StepHeading title="Parle-nous de toi." subtitle="Ton profil recruteur — photo, sport, et un mot sur toi." />

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

      <SectionTitle>Sport recruté</SectionTitle>
      <PickerRow label="Sport" value={p.sport} placeholder="Sélectionner ton sport…" onTap={p.onOpenSport} required />

      <SectionTitle>Un mot sur toi (optionnel)</SectionTitle>
      <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-3">
        <label htmlFor="recruteur-bio" className={labelCls}>Bio courte</label>
        <textarea
          id="recruteur-bio"
          value={p.bio}
          maxLength={BIO_MAX}
          onChange={(e) => p.setBio(e.target.value)}
          placeholder="Mon CÉGEP, mes années d'expérience, le profil d'athlètes que je cherche…"
          rows={4}
          className="w-full bg-transparent text-[16px] text-white placeholder:text-white/40 outline-none resize-none"
        />
        <p className="text-[11px] text-white/40 text-right">{p.bio.length} / {BIO_MAX}</p>
      </div>

      <SectionTitle>Expérience &amp; contact (optionnel)</SectionTitle>
      <div className="space-y-3">
        <div>
          <label htmlFor="recruteur-exp" className={labelCls}>Années d&apos;expérience</label>
          <input
            id="recruteur-exp"
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
          <label htmlFor="recruteur-phone" className={labelCls}>Téléphone</label>
          <input
            id="recruteur-phone"
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

/* ── SLIDE 2 — CÉGEP ────────────────────────────────────────── */

interface Slide2Props {
  selectedCegepName: string;
  selectedCegepCity: string;
  onOpenCegep: () => void;
}

function Slide2Cegep(p: Slide2Props) {
  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="Ton CÉGEP."
        subtitle="L'établissement où tu recrutes. Tu pourras revoir tes préférences plus tard."
      />
      <SectionTitle>Mon CÉGEP</SectionTitle>
      <PickerRow
        label="CÉGEP"
        value={p.selectedCegepName}
        placeholder="Sélectionner mon CÉGEP…"
        onTap={p.onOpenCegep}
        required
      />
      {p.selectedCegepName && p.selectedCegepCity && (
        <p className="text-[12px] text-white/55 mt-1 px-1">{p.selectedCegepCity}</p>
      )}
    </div>
  );
}

/* ── SLIDE 3 — Programme (optionnel) ─────────────────────────── */

interface Slide3Props {
  sport: string;
  cegepName: string;
  selectedProgramName: string;
  onOpenProgram: () => void;
  cegepPicked: boolean;
  programsLoaded: boolean;
  programsCount: number;
}

function Slide3Program(p: Slide3Props) {
  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="Ton programme."
        subtitle="Le programme du CÉGEP où tu recrutes. Optionnel — tu peux choisir plus tard."
      />

      {p.cegepPicked && p.sport && (
        <>
          <SectionTitle>Mon programme (optionnel)</SectionTitle>
          {!p.programsLoaded ? (
            <p className="text-[12px] text-white/40 italic px-1 mt-1">Chargement des programmes…</p>
          ) : p.programsCount === 0 ? (
            <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-4">
              <p className="text-[15px] text-white/90 leading-relaxed">
                Aucun programme {p.sport} enregistré à {p.cegepName}. Tu pourras le préciser plus tard.
              </p>
            </div>
          ) : (
            <>
              <PickerRow
                label="Programme"
                value={p.selectedProgramName}
                placeholder="Sélectionner mon programme…"
                onTap={p.onOpenProgram}
              />
              <p className="text-[12px] text-white/40 italic px-1 mt-1">
                Non bloquant — tu peux continuer sans programme.
              </p>
            </>
          )}
        </>
      )}

      {!p.cegepPicked && (
        <p className="text-[12px] text-white/40 italic px-1 mt-3">
          Choisis ton CÉGEP pour voir les programmes disponibles.
        </p>
      )}
    </div>
  );
}

/* ── SLIDE 4 — Responsable (3 cartes + invite option) ────────── */

interface Slide4Props {
  choice: DirectorChoice; setChoice: (v: DirectorChoice) => void;
  rprpAttested: boolean; setRprpAttested: (v: boolean) => void;
  inviteEmail: string; setInviteEmail: (v: string) => void;
  mustBeResponsable: boolean;
  responsableLoading: boolean;
  inviteEmailValid: boolean;
  inviteEmailFilled: boolean;
}

type ResponsableCard = {
  value: Exclude<DirectorChoice, null>;
  title: string;
  desc: string;
  iconStroke: string;
  iconBgActive: string;
};
const RESPONSABLE_CARDS: ResponsableCard[] = [
  { value: "owner",   title: "C'est moi",            desc: "Je suis le responsable de programme.",                          iconStroke: "#DAB65A", iconBgActive: "bg-[#DAB65A]/15" },
  { value: "interim", title: "Je serai intérimaire", desc: "Je remplis ce rôle temporairement.",                            iconStroke: "#9CA3AF", iconBgActive: "bg-[#6B7280]/20" },
  { value: "coach",   title: "Recruteur seulement",  desc: "Je suis recruteur — un autre est ou sera responsable de programme.", iconStroke: "#3B82F6", iconBgActive: "bg-[#3B82F6]/20" },
];

function ResponsableIcon({ kind, color }: { kind: Exclude<DirectorChoice, null>; color: string }) {
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

function Slide4Director(p: Slide4Props) {
  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="Quel est ton rôle ?"
        subtitle="Ton rôle au sein du CÉGEP. Tu peux inviter le responsable de programme si quelqu'un d'autre l'est."
      />

      {/* Bannière contextuelle Loi 25 — CÉGEP orphan ou en cours vérif */}
      {p.mustBeResponsable && (
        <div className="mt-5 rounded-2xl border border-[#DAB65A]/30 bg-[#DAB65A]/[0.08] px-4 py-3.5">
          {p.responsableLoading ? (
            <p className="text-[13px] text-white/85 leading-relaxed">
              Vérification en cours… si ce CÉGEP n&apos;a pas encore de responsable sur Nexus, tu devras attester l&apos;être pour rejoindre la plateforme (Loi 25).
            </p>
          ) : (
            <p className="text-[13px] text-white/85 leading-relaxed">
              Ce CÉGEP n&apos;a pas encore de responsable sur Nexus. Pour qu&apos;un CÉGEP rejoigne la plateforme, un recruteur doit attester être responsable du programme (Loi 25). Si c&apos;est toi, choisis «&nbsp;C&apos;est moi&nbsp;» ou «&nbsp;Je serai intérimaire&nbsp;». Sinon, demande à la personne responsable de s&apos;inscrire en premier.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3 mt-6">
        {RESPONSABLE_CARDS.map((card) => {
          const active = p.choice === card.value;
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
                  <ResponsableIcon kind={card.value} color={card.iconStroke} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-white">{card.title}</p>
                  <p className="text-[13px] text-white/65 mt-0.5 leading-snug">{card.desc}</p>
                  {disabled && (
                    <p className="text-[12px] text-[#DAB65A]/80 mt-1.5 italic">
                      {p.responsableLoading ? "Vérification du responsable du CÉGEP…" : "Indisponible — CÉGEP sans responsable."}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* RPRP — owner OU interim */}
      {(p.choice === "owner" || p.choice === "interim") && (
        <div className="mt-5">
          <SectionTitle>Attestation RPRP</SectionTitle>
          <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 space-y-2">
            <p className="text-[13px] text-white/80 leading-relaxed">
              {p.choice === "interim"
                ? <>En tant que responsable intérimaire du programme, tu deviens temporairement le Responsable de la Protection des Renseignements Personnels (RPRP) sur Nexus. Si un responsable permanent s&apos;inscrit, ton rôle sera ramené à recruteur. Tu acceptes la responsabilité associée (Loi 25).</>
                : <>En tant que responsable de programme, tu deviens le Responsable de la Protection des Renseignements Personnels (RPRP) pour ce CÉGEP sur Nexus. Tu acceptes la responsabilité associée (Loi 25).</>}
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

      {/* Invite optionnel sous "Recruteur seulement" */}
      {p.choice === "coach" && (
        <div className="mt-5">
          <SectionTitle>Inviter le responsable (optionnel)</SectionTitle>
          <div>
            <label htmlFor="recruteur-invite-email" className={labelCls}>
              Courriel du responsable de programme
            </label>
            <input
              id="recruteur-invite-email"
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={p.inviteEmail}
              onChange={(e) => p.setInviteEmail(e.target.value)}
              placeholder="responsable@cegep.qc.ca"
              className={inputCls}
            />
            <p className="text-[12px] text-white/40 italic mt-1 px-1">
              {p.inviteEmailFilled && !p.inviteEmailValid
                ? "Courriel invalide."
                : "Optionnel — on lui enverra un courriel pour revendiquer le rôle de responsable. Laisse vide si tu ne sais pas."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SLIDE 5 — Confirmation / Récap (parité école slide 4) ───── */

interface Slide5Props {
  firstName: string; lastName: string; email: string;
  sport: string;
  cegepName: string; cegepCity: string;
  programName: string;
  directorChoice: DirectorChoice;
  inviteEmail: string;
  inviteEmailValid: boolean;
}

function Slide5Confirmation(p: Slide5Props) {
  // Label rôle reflète le RÔLE du recruteur connecté.
  // Coach/coach_only (= "Recruteur seulement" UI) → "Recruteur" tout court.
  const directorLabel = (() => {
    switch (p.directorChoice) {
      case "owner":   return "Responsable de programme";
      case "interim": return "Responsable intérimaire";
      case "coach":   return "Recruteur";
      default:        return "—";
    }
  })();

  // Sous-ligne "Invitation envoyée" si coach + email valide.
  const showInviteLine = p.directorChoice === "coach" && p.inviteEmailValid;

  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="Confirme ton profil."
        subtitle="Récap de ton profil. Tu pourras tout modifier plus tard."
      />

      <div className="mt-6 bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <RecapRow label="Nom" value={`${p.firstName} ${p.lastName}`.trim()} />
        <RecapRow label="Courriel" value={p.email} />
        <RecapRow label="Sport" value={p.sport} />
        <RecapRow label="CÉGEP" value={p.cegepName} sub={p.cegepCity || undefined} />
        <RecapRow label="Programme" value={p.programName || "—"} />
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
