"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import { createClient } from "@/lib/supabase/client";
import PlaybookBackground from "../components/PlaybookBackground";
import TeamSearchOrCreate, { type TeamSearchRow } from "@/components/onboarding/TeamSearchOrCreate";
import TeamCreateForm, { type TeamFormData } from "@/components/onboarding/TeamCreateForm";
import { findOrCreateSchool } from "@/lib/onboarding/findOrCreateSchool";
import { getCurrentSeason } from "@/lib/utils/season";
import { genderLabel } from "@/lib/config/gender";
import { CoachOnboardingMobileSchool } from "@/components/shared/CoachOnboardingMobileSchool";
import { CoachOnboardingMobileCivil } from "@/components/shared/CoachOnboardingMobileCivil";
import { RecruiterOnboardingMobile } from "@/components/shared/RecruiterOnboardingMobile";

// Canonical Nexus support inbox for user-driven contact (school-not-found, etc.).
const NEXUS_CONTACT_EMAIL = "support@nexussports.ca";

// Iter coach-3 — dispatch IS_CAPACITOR (mobile natif) plus bas dans
// OnboardingPage, après le load de `user` (les hooks doivent rester en
// amont du return conditionnel — Rules of Hooks).
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Onboarding Wizard
   Multi-step, role-adaptive. All data → localStorage.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";
const inputClass =
  "w-full h-11 px-4 bg-[#111317] border border-white/10 rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-[#E63946] focus:outline-none transition-colors";

/* ── Shared data ── */
const SPORTS = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball",
  "Athlétisme", "Flag football", "Rugby", "Cheerleading",
  "Natation", "Badminton", "Cross-country", "Futsal",
  "Baseball", "Ultimate frisbee", "Golf", "Tennis",
  "Ski alpin", "Ski de fond", "Judo", "Handball", "Water-polo",
];
const REGIONS = ["Montréal", "Québec", "Saguenay-Lac-Saint-Jean", "Estrie", "Outaouais", "Mauricie", "Laurentides", "Lanaudière", "Montérégie", "Chaudière-Appalaches", "Laval", "Centre-du-Québec", "Bas-Saint-Laurent", "Abitibi-Témiscamingue", "Côte-Nord", "Nord-du-Québec", "Gaspésie"];

// School-card city + region — never renders "X, X" when city == region (or
// region is blank). `sep` covers the two separators the pickers use.
function cityRegion(city?: string | null, region?: string | null, sep = ", "): string {
  const c = (city || "").trim();
  const r = (region || "").trim();
  if (!c) return r;
  if (!r || r.toLowerCase() === c.toLowerCase()) return c;
  return `${c}${sep}${r}`;
}
const FOOTBALL_POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K/P"];
const GRAD_YEARS = [2025, 2026, 2027, 2028, 2029];

/* ── Types ── */
interface NexusUser {
  firstName: string;
  lastName: string;
  email: string;
  context?: string;
  role: string;
  status: string;
  onboarding_complete: boolean;
  institution: Record<string, unknown> | null;
  profile: Record<string, unknown>;
  search_criteria: Record<string, unknown> | null;
  team_needs: Record<string, unknown> | null;
  first_athlete: Record<string, unknown> | null;
  // School admin fields
  is_school_admin?: boolean;
  is_also_coach?: boolean;
  school_admin_type?: "owner" | "interim" | null;
  // CÉGEP admin fields (reuses is_school_admin — role infers school vs CÉGEP).
  // CÉGEP now mirrors school: "owner" (DIRECTEUR) | "interim" (INTERIM) | null.
  // The interim path lets a recruiter stand in temporarily until the
  // permanent CÉGEP director claims — auto-demoted by the existing
  // apply_admin_claim_approval cascade when DIRECTEUR is approved.
  is_also_recruiter?: boolean;
  cegep_admin_type?: "owner" | "interim" | null;
  // Shared
  pending_director_invite?: Record<string, unknown> | null;
  // Loi 25 — explicit RPRP consent at director onboarding. Required to
  // proceed when school_admin_type or cegep_admin_type is set to
  // 'owner'/'interim'. finish() converts this into profile_data.rprp_accepted_at
  // (timestamp) so the admin RPRP tab can show the real consent date.
  rprp_consent?: boolean;
  subscription?: Record<string, unknown>;
  tier?: string;
  referral_code?: string | null;
  // Recruiter onboarding — single CÉGEP program (teams row) the
  // recruiter primarily works with. Stored in localStorage during the
  // Programme step; finish() writes id to users.primary_team_id.
  primary_team?: {
    id: string;
    name: string;
    age_group: string | null;
    gender: string | null;
    division: string | null;
  } | null;
}

/* ═══════════════════════════════════════════════════════════════
   PHOTO UPLOAD — reusable across onboarding steps
═══════════════════════════════════════════════════════════════ */
function PhotoUpload({ photoUrl, onUploaded, sublabel = "Optionnel — visible par les recruteurs" }: { photoUrl: string; onUploaded: (url: string) => void; sublabel?: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");

    // Validate
    if (f.size > 5 * 1024 * 1024) { setError("Fichier trop volumineux (max 5 Mo)"); return; }
    if (!["image/jpeg", "image/png"].includes(f.type)) { setError("Format accepté : JPG ou PNG"); return; }

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext = f.name.split(".").pop() || "jpg";
    const path = `onboarding/${user.id}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
    if (upErr) { console.error("[Photo upload]", upErr); setError("Erreur lors du téléversement"); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    onUploaded(urlData.publicUrl);

    // Also save to users table
    await supabase.from("users").update({ photo_url: urlData.publicUrl }).eq("id", user.id);
    setUploading(false);
  }

  return (
    <div>
      <label className="flex items-center gap-4 cursor-pointer group">
        <div className="relative w-16 h-16 rounded-full shrink-0 overflow-hidden">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#111317] border-2 border-dashed border-white/10 flex items-center justify-center group-hover:border-[#E63946]/40 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-[#E63946] transition-colors">
            {photoUrl ? "Changer la photo" : "Photo de profil"}
          </p>
          <p className="text-[10px] text-[#6B7280]">{sublabel}</p>
        </div>
        <input type="file" accept="image/jpeg,image/png" className="hidden" title="Photo de profil" onChange={handleFile} />
      </label>
      {error && <p className="text-[10px] text-[#EF4444] mt-1 ml-20">{error}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP INDICATOR
═══════════════════════════════════════════════════════════════ */
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((stepLabel, i) => {
        const completed = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            {i > 0 && (
              <div className={`w-12 sm:w-20 h-0.5 ${completed ? "bg-[#22C55E]" : "bg-[#6B7280]/30"}`} />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                completed ? "bg-[#22C55E] text-white" : active ? "bg-[#E63946] text-white" : "border-2 border-[#6B7280] text-[#6B7280]"
              }`}>
                {completed ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`hidden sm:block text-[9px] font-bold uppercase tracking-wider ${active ? "text-white" : "text-[#6B7280]"}`}>
                {stepLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SEARCHABLE DROPDOWN
═══════════════════════════════════════════════════════════════ */
function SearchableDropdown<T extends { name: string }>({
  items,
  value,
  onChange,
  placeholder,
  renderItem,
}: {
  items: T[];
  value: string;
  onChange: (item: T | null) => void;
  placeholder: string;
  renderItem?: (item: T) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-\s]+/g, " ").toLowerCase().trim();
  const filtered = items.filter((i) => norm(i.name).includes(norm(query))).slice(0, 15);

  return (
    <div className="relative">
      <div className="relative">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input
          type="text"
          placeholder={placeholder}
          value={value || query}
          onChange={(e) => { setQuery(e.target.value); onChange(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className={`${inputClass} pl-10`}
        />
      </div>
      {open && query.length > 0 && filtered.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-[#1A1D24] border border-white/10 rounded-lg max-h-60 overflow-y-auto shadow-xl animate-fade-slide-down">
          {filtered.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => { onChange(item); setQuery(""); setOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
            >
              {renderItem ? renderItem(item) : item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PILL TOGGLE
═══════════════════════════════════════════════════════════════ */
function PillToggle({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const isOn = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              isOn ? "bg-[rgba(230,57,70,0.1)] border border-[#E63946] text-white" : "bg-[#1A1D24] border border-white/10 text-[#9CA3AF] hover:border-white/20"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN WIZARD
═══════════════════════════════════════════════════════════════ */
export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<NexusUser | null>(null);
  const [step, setStep] = useState(0);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const [showSuccess, setShowSuccess] = useState(false);

  /* ── Load user from Supabase Auth ── */
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.replace("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!profile) {
        router.replace("/auth");
        return;
      }

      if (profile.onboarding_complete) {
        if (profile.role === "COACH") router.replace("/coach/tableau-de-bord");
        else if (profile.role === "RECRUTEUR") router.replace("/recruteur/tableau-de-bord");
        else if (profile.role === "PARTNER") router.replace("/partenaire");
        else router.replace("/");
        return;
      }

      // Defense-in-depth: PARTNER role should never see this wizard
      // (admin onboards partners; users.onboarding_complete is set
      // true at creation). If they somehow land here with an
      // incomplete flag, bounce to the partner portal.
      if (profile.role === "PARTNER") {
        router.replace("/partenaire");
        return;
      }

      // Map DB role to onboarding role
      const roleMap: Record<string, string> = {
        COACH: "coach",
        RECRUTEUR: "recruiter",
      };

      const onboardingRole = roleMap[profile.role] || "coach";

      // Civil-league discriminator: the signup form at /auth/pro lets
      // the user pick "Ligue ou club sportif", which is persisted as
      // users.context = 'ligue_civile'. The DB role itself is COACH
      // (no COACH_LEAGUE enum value). Phase 6.2 dropped the
      // coach_league pseudo-role — the civil branch now triggers
      // off `context === 'ligue_civile'` directly so we don't carry
      // two parallel ways to spell "civil coach" through the wizard.
      const nexusUser: NexusUser = {
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        email: profile.email,
        context: profile.context || undefined,
        role: onboardingRole,
        status: profile.status,
        onboarding_complete: profile.onboarding_complete || false,
        institution: null,
        profile: {},
        search_criteria: null,
        team_needs: null,
        first_athlete: null,
      };

      // Also keep localStorage in sync for the wizard steps
      localStorage.setItem("nexus_user", JSON.stringify(nexusUser));
      setUser(nexusUser);
    };

    loadUser();
  }, [router]);

  /* ── Save to localStorage (no state update to avoid re-render loops) ── */
  const save = useCallback((updates: Partial<NexusUser>) => {
    const raw = localStorage.getItem("nexus_user");
    if (!raw) return;
    const current = JSON.parse(raw) as NexusUser;
    const next = { ...current, ...updates };
    localStorage.setItem("nexus_user", JSON.stringify(next));
    setLocalUserVersion((v) => v + 1);
  }, []);

  const totalStepsMap: Record<string, number> = {
    // School-coach flow is 5 steps (profil, école, équipe, directeur,
    // confirmation) — équipe was added May 2026 between école and
    // directeur. The civil-coach flow stays at 4 (profil, ligue+team
    // merged, coach principal, confirmation) since the team selection
    // is already embedded in the LeagueCoachLeagueStep.
    coach: 4, // see isCivilCoachLabel branch below — school gets +1
    recruiter: 4,       // profil, cégep, programme, directeur (sprint recruteur-finish-web-rpc — critères retiré, géré post-onboarding via /recruteur/parametres)
    coordinator_league: 3,
  };
  const isCivilCoachFlow = user?.role === "coach" && user?.context === "ligue_civile";
  const totalSteps = user?.role === "coach"
    ? (isCivilCoachFlow ? 4 : 5)
    : (totalStepsMap[user?.role ?? ""] || 3);
  const progress = ((step + 1) / totalSteps) * 100;

  const [stepSaving, setStepSaving] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);
  const [, setLocalUserVersion] = useState(0);

  // Single source of truth for "did the user complete the institution
  // step?" — called from canProceed() (gates step 1 → step 2), finish()
  // (defensive guard against localStorage tampering / race conditions),
  // and the Terminer button's disabled state. Returns the user-facing
  // error message so callers don't reinvent the wording.
  function validateInstitution(): { ok: boolean; error: string } {
    if (!user) return { ok: false, error: "Session expirée." };
    const raw = localStorage.getItem("nexus_user");
    const localUser = raw ? JSON.parse(raw) : {};
    const role = user.role;
    const context = (user.context ?? localUser.context) as string | undefined;
    const isCivilCoach = role === "coach" && context === "ligue_civile";
    const inst = localUser.institution as Record<string, unknown> | null;

    if (isCivilCoach) {
      // Civil coach must (a) select or create a league (as a
      // LIGUE_CIVILE school) AND (b) have an INSERTed team.
      // profile.team_id is the persistent signal — set in
      // localStorage by LeagueCoachLeagueStep only after both
      // schools + teams + school_coaches + team_coaches INSERTs
      // succeed.
      if (!inst || !inst.name) {
        return { ok: false, error: "Sélectionne une ligue pour continuer." };
      }
      const profile = localUser.profile as Record<string, unknown> | null;
      if (!profile?.team_id) {
        return { ok: false, error: "Sélectionne ou crée une équipe pour continuer." };
      }
      return { ok: true, error: "" };
    }
    if (role === "coach") {
      if (!inst || !inst.name) {
        return { ok: false, error: "Sélectionne une école pour continuer." };
      }
      return { ok: true, error: "" };
    }
    if (role === "recruiter") {
      if (!inst || !inst.name) {
        return { ok: false, error: "Sélectionne un CÉGEP pour continuer." };
      }
      return { ok: true, error: "" };
    }
    // coordinator_league intentionally ungated — separate flow,
    // tracked in post-launch-bugs.md.
    return { ok: true, error: "" };
  }

  function canProceed(): boolean {
    if (!user) return false;
    // Step 0 (Profil) for coach role: require sport_principal. Without
    // it the wizard advances but LeagueCoachLeagueStep at step 1 hits
    // a dead-end — sportName="" → sportId null → red "ton sport
    // principal n'a pas été reconnu" error screen with no inline
    // recovery. School coaches with null sport also leave users.sport
    // null, which hides their athletes from sport-scoped recruiter
    // searches. Gate at the source.
    if (step === 0 && user.role === "coach") {
      const raw = typeof window !== "undefined" ? localStorage.getItem("nexus_user") : null;
      const localUser = raw ? JSON.parse(raw) : {};
      const profile = localUser.profile as Record<string, unknown> | null;
      const sportPrincipal = profile?.sport_principal;
      return typeof sportPrincipal === "string" && sportPrincipal.trim().length > 0;
    }
    if (step === 1) return validateInstitution().ok;
    // School-coach step 2 (SchoolCoachTeamStep) is intentionally
    // ungated — team selection is optional. The card click writes
    // profile.team_id directly; advancing without a pick is fine.
    // Recruiter step 2 (RecruiterProgramStep) is likewise ungated —
    // primary_team is optional; finish() only writes it when set.
    //
    // Coach école step 3 (DirectorChoiceStep type="school") — sprint
    // coach-responsable-3 : RPRP est désormais GATE DUR (parité
    // mobile + decision Loi 25). Si l'utilisateur a choisi devenir
    // responsable (owner / interim, sans invite), rprp_consent === true
    // est obligatoire pour continuer. Civil (context==='ligue_civile')
    // et recruteur CÉGEP ne sont pas touchés ici.
    if (step === 3 && user?.role === "coach") {
      const raw = typeof window !== "undefined" ? localStorage.getItem("nexus_user") : null;
      const localUser = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      if (localUser.context !== "ligue_civile") {
        const adminType = localUser.school_admin_type;
        const isActualClaim = (adminType === "owner" || adminType === "interim") && !localUser.pending_director_invite;
        if (isActualClaim && localUser.rprp_consent !== true) return false;
      }
    }
    // Sprint recruteur-finish-web-rpc : recruteur step 3 = DirectorChoiceStep
    // type="cegep". Gate RPRP dur pour owner/interim (parité école + civil).
    if (step === 3 && user?.role === "recruiter") {
      const raw = typeof window !== "undefined" ? localStorage.getItem("nexus_user") : null;
      const localUser = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const adminType = localUser.cegep_admin_type;
      const isActualClaim = (adminType === "owner" || adminType === "interim") && !localUser.pending_director_invite;
      if (isActualClaim && localUser.rprp_consent !== true) return false;
    }
    // Sprint cards-restructure-web : civil coach step 2 = DirectorChoiceStep
    // type="league". Gate RPRP dur pour owner/interim (parité école step 3
    // + parité mobile civil).
    if (step === 2 && user?.role === "coach") {
      const raw = typeof window !== "undefined" ? localStorage.getItem("nexus_user") : null;
      const localUser = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      if (localUser.context === "ligue_civile") {
        const adminType = localUser.school_admin_type;
        const isActualClaim = (adminType === "owner" || adminType === "interim") && !localUser.pending_director_invite;
        if (isActualClaim && localUser.rprp_consent !== true) return false;
      }
    }
    return true;
  }

  const next = async () => {
    if (step >= totalSteps - 1) return;
    if (!canProceed()) {
      return;
    }

    setStepSaving(true);
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const raw = localStorage.getItem("nexus_user");
        const localUser = raw ? JSON.parse(raw) : {};
        const profileData = localUser.profile || {};
        const institution = localUser.institution || {};
        const role = user?.role || "";

        // Step 0 for coach/recruiter = Profile step
        if (step === 0) {
          const { error } = await supabase.from("users").update({
            first_name: localUser.firstName || null,
            last_name: localUser.lastName || null,
            phone: profileData.phone || null,
            photo_url: profileData.photo_url || null,
            sport: profileData.sport_principal || null,
            profile_data: {
              bio: profileData.bio || null,
              experience_years: profileData.experience_years || null,
            },
          }).eq("id", authUser.id);
          if (error) { console.error("[Onboarding] step 0 save error:", error); setStepSaving(false); return; }
        }

        // Step 1 = School/CÉGEP selection. Civil-coach onboarding
        // (context === 'ligue_civile') has a LIGUE_CIVILE school as
        // institution; the school_coaches + team_coaches INSERTs
        // happen inside LeagueCoachLeagueStep, not here. This block
        // is intentionally for the SECONDAIRE school-coach path.
        // institution.name is guaranteed present by canProceed() at L418.
        const isCivilCoachStep1 = role === "coach" && localUser.context === "ligue_civile";
        if (step === 1 && role === "coach" && !isCivilCoachStep1) {
          // Find the school_id from schools table
          const { data: schoolRow } = await supabase.from("schools").select("id").eq("name", institution.name).maybeSingle();
          if (schoolRow) {
            // Save school_id to users table
            await supabase.from("users").update({ school_id: schoolRow.id, region: institution.region || null }).eq("id", authUser.id);

            // Upsert into school_coaches for the school-coach flow.
            await supabase.from("school_coaches").upsert({
              coach_id: authUser.id,
              school_id: schoolRow.id,
              role: "COACH",
              sport: profileData.sport_principal || null,
            }, { onConflict: "coach_id,school_id" }).then(({ error: scErr }) => {
              if (scErr) console.error("[Onboarding] school_coaches upsert:", scErr);
            });
          }
        }

      }
    } catch (err) {
      console.error("[Onboarding] step save error:", err);
      setStepSaving(false);
      return;
    }
    setStepSaving(false);

    setSlideDir("right");
    setStep((s) => s + 1);
  };

  const prev = () => {
    if (step > 0) {
      setNavError(null);
      setSlideDir("left");
      setStep((s) => s - 1);
    }
  };

  const finish = async () => {
    // Defense-in-depth: even though canProceed() gates step 1 → step 2,
    // the Terminer button could be hit if institution was cleared from
    // localStorage between step 1 and the final step (dev tools, race
    // condition, future programmatic navigation). Without this guard,
    // finish() would silently skip the L546/L566 school_id save and
    // leave users.school_id = NULL — the orphan state this fix addresses.
    const valid = validateInstitution();
    if (!valid.ok) {
      setNavError(valid.error || "Sélection d'établissement requise.");
      return;
    }
    setNavError(null);

    save({ onboarding_complete: true });
    setUser((prev) => prev ? { ...prev, onboarding_complete: true } : prev);

    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (authUser) {
      // Get the onboarding data from localStorage
      const raw = localStorage.getItem("nexus_user");
      const localUser = raw ? JSON.parse(raw) : {};

      // ═══════════════════════════════════════════════════════════════
      // Sprint coach-responsable-3 — Coach école (context !==
      // 'ligue_civile') passe par la RPC atomique
      // finish_coach_school_onboarding (migration 20260610110000).
      //
      // Sprint cards-restructure-web — Coach civil (context ===
      // 'ligue_civile') passe par finish_coach_civil_onboarding (migration
      // 20260612000000). Le club + l'équipe ont déjà été créés/joints au
      // step 1 par LeagueCoachLeagueStep ; on passe leurs IDs à la RPC
      // qui UPSERT idempotemment school_coaches (role='COACH') + insère
      // admin_claims si owner/interim. claim_civil_league_admin() n'est
      // plus appelée (à dropper au sprint civil-2b-rpc-drop).
      //
      // Recruteur CÉGEP retombe dans le legacy path ci-dessous.
      // ═══════════════════════════════════════════════════════════════
      const isSchoolCoach = user?.role === "coach" && localUser.context !== "ligue_civile";
      const isCivilCoach  = user?.role === "coach" && localUser.context === "ligue_civile";
      const isRecruiter   = user?.role === "recruiter";

      if (isRecruiter) {
        // Sprint recruteur-finish-web-rpc — câblage atomique sur la RPC
        // finish_recruiter_onboarding (migration 20260613000000). Remplace
        // les writes legacy (users update + admin_claims CÉGEP). PAS de
        // recruiter_preferences (retiré de l'onboarding — géré post-
        // onboarding via /recruteur/parametres).
        const instName = (localUser.institution as { name?: string } | undefined)?.name;
        if (!instName) {
          setNavError("CÉGEP introuvable — réessaye.");
          return;
        }
        const { data: cegepRow } = await supabase
          .from("schools")
          .select("id")
          .eq("name", instName)
          .maybeSingle();
        if (!cegepRow) {
          setNavError("CÉGEP introuvable — réessaye.");
          return;
        }

        const recruiterChoice: "owner" | "interim" | "invite" | "coach_only" = (() => {
          if (localUser.pending_director_invite) return "invite";
          if (localUser.cegep_admin_type === "interim") return "interim";
          if (localUser.cegep_admin_type === "owner")   return "owner";
          return "coach_only";
        })();

        const recExpRaw = localUser.profile?.experience_years;
        const recExpParsed = typeof recExpRaw === "number"
          ? recExpRaw
          : typeof recExpRaw === "string" && recExpRaw.trim() !== ""
            ? parseInt(recExpRaw, 10)
            : null;
        const recExpYears = Number.isFinite(recExpParsed) ? (recExpParsed as number) : null;

        const recPrimaryTeamId = (localUser.primary_team as { id?: string } | undefined)?.id ?? null;

        const { error: recErr } = await supabase.rpc("finish_recruiter_onboarding", {
          p_cegep_id:         cegepRow.id as string,
          p_primary_team_id:  recPrimaryTeamId,
          p_sport:            localUser.profile?.sport_principal || null,
          p_first_name:       localUser.firstName || user?.firstName || null,
          p_last_name:        localUser.lastName  || user?.lastName  || null,
          p_phone:            localUser.profile?.phone || null,
          p_bio:              localUser.profile?.bio || null,
          p_experience_years: recExpYears,
          p_photo_url:        localUser.profile?.photo_url || null,
          p_director_choice:  recruiterChoice,
          p_rprp_accepted:    localUser.rprp_consent === true,
          p_invite_email:     recruiterChoice === "invite"
            ? ((localUser.pending_director_invite as { email?: string } | null)?.email || null)
            : null,
        });

        if (recErr) {
          console.error("[Onboarding] finish_recruiter_onboarding:", recErr);
          const msg = recErr.message || "";
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
          setNavError(userMessage);
          return;
        }
        // RPC OK — short-circuit le legacy path (users update + admin_claims
        // CÉGEP + recruiter_preferences). Fall-through au setShowSuccess +
        // redirect en bas de finish().
      } else if (isCivilCoach) {
        // Club + équipe déjà persistés par LeagueCoachLeagueStep :
        //   localUser.institution.id = schools.id (LIGUE_CIVILE)
        //   localUser.profile.team_id = teams.id
        const civilClubId = (localUser.institution as { id?: string } | undefined)?.id;
        const civilTeamId = localUser.profile?.team_id as string | undefined;
        if (!civilClubId) {
          setNavError("Club introuvable — réessaye.");
          return;
        }

        // director_choice dérivé du localStorage (même mapping que l'école
        // RPC) : pending_invite → invite ; admin_type=interim → interim ;
        // admin_type=owner sans invite → owner ; sinon coach_only.
        const civilChoice: "owner" | "interim" | "invite" | "coach_only" = (() => {
          if (localUser.pending_director_invite) return "invite";
          if (localUser.school_admin_type === "interim") return "interim";
          if (localUser.school_admin_type === "owner")   return "owner";
          return "coach_only";
        })();

        const civilExpRaw = localUser.profile?.experience_years;
        const civilExpParsed = typeof civilExpRaw === "number"
          ? civilExpRaw
          : typeof civilExpRaw === "string" && civilExpRaw.trim() !== ""
            ? parseInt(civilExpRaw, 10)
            : null;
        const civilExpYears = Number.isFinite(civilExpParsed) ? (civilExpParsed as number) : null;

        const { error: civilErr } = await supabase.rpc("finish_coach_civil_onboarding", {
          // Club existant (déjà persisté au step 1)
          p_club_id:          civilClubId,
          p_club_name:        null,
          p_club_city:        null,
          p_club_region:      null,
          // Profil
          p_sport:            localUser.profile?.sport_principal || null,
          p_first_name:       localUser.firstName || user?.firstName || null,
          p_last_name:        localUser.lastName  || user?.lastName  || null,
          p_phone:            localUser.profile?.phone || null,
          p_bio:              localUser.profile?.bio || null,
          p_experience_years: civilExpYears,
          p_photo_url:        localUser.profile?.photo_url || null,
          // Équipe existante (déjà persistée au step 1)
          p_team_id:          civilTeamId || null,
          p_team_name:        null,
          p_team_age_group:   null,
          p_team_gender:      null,
          p_team_division:    null,
          // Responsable
          p_director_choice:  civilChoice,
          p_rprp_accepted:    localUser.rprp_consent === true,
          p_invite_email:     civilChoice === "invite"
            ? ((localUser.pending_director_invite as { email?: string } | null)?.email || null)
            : null,
        });

        if (civilErr) {
          console.error("[Onboarding] finish_coach_civil_onboarding:", civilErr);
          const msg = civilErr.message || "";
          let userMessage = "Erreur lors de la finalisation — réessaye.";
          if (msg.includes("SCHOOL_REQUIRES_RESPONSABLE")) {
            userMessage = "Ce club n'a pas encore de responsable. Choisis « C'est moi » ou « Je serai intérimaire ».";
          } else if (msg.includes("RPRP_REQUIRED")) {
            userMessage = "L'attestation RPRP est obligatoire pour devenir responsable.";
          } else if (msg.includes("INVALID_CLUB")) {
            userMessage = "Données du club invalides — vérifie le nom.";
          } else if (msg.includes("INVALID_DIRECTOR_CHOICE")) {
            userMessage = "Choix de responsable invalide.";
          } else if (msg.includes("NOT_AUTHENTICATED")) {
            userMessage = "Session expirée — reconnecte-toi.";
          } else if (msg.includes("WRONG_ROLE_OR_CONTEXT")) {
            userMessage = "Ce flux est réservé aux coachs de ligue civile.";
          }
          setNavError(userMessage);
          return;
        }
        // RPC OK — short-circuit le legacy path (claim_civil_league_admin
        // + school_coaches upsert + recruteur). Fall-through au
        // setShowSuccess + redirect.
      } else if (isSchoolCoach) {
        const instName = (localUser.institution as { name?: string } | undefined)?.name;
        if (!instName) {
          setNavError("École introuvable — réessaye.");
          return;
        }
        const { data: schoolRow } = await supabase
          .from("schools")
          .select("id")
          .eq("name", instName)
          .maybeSingle();
        if (!schoolRow) {
          setNavError("École introuvable — réessaye.");
          return;
        }

        const directorChoice: "owner" | "interim" | "invite" | "coach_only" = (() => {
          if (localUser.pending_director_invite) return "invite";
          if (localUser.school_admin_type === "interim") return "interim";
          if (localUser.school_admin_type === "owner") return "owner";
          return "coach_only";
        })();

        const expRaw = localUser.profile?.experience_years;
        const expYearsParsed = typeof expRaw === "number"
          ? expRaw
          : typeof expRaw === "string" && expRaw.trim() !== ""
            ? parseInt(expRaw, 10)
            : null;
        const expYears = Number.isFinite(expYearsParsed) ? (expYearsParsed as number) : null;

        const { error: rpcErr } = await supabase.rpc("finish_coach_school_onboarding", {
          p_school_id:        schoolRow.id as string,
          p_region:           (localUser.institution as { region?: string } | undefined)?.region || null,
          p_sport:            localUser.profile?.sport_principal || null,
          p_first_name:       localUser.firstName || user?.firstName || null,
          p_last_name:        localUser.lastName  || user?.lastName  || null,
          p_phone:            localUser.profile?.phone || null,
          p_bio:              localUser.profile?.bio || null,
          p_experience_years: expYears,
          p_photo_url:        localUser.profile?.photo_url || null,
          p_team_id:          localUser.profile?.team_id || null,
          p_director_choice:  directorChoice,
          p_rprp_accepted:    localUser.rprp_consent === true,
          p_invite_email:     directorChoice === "invite"
            ? ((localUser.pending_director_invite as { email?: string } | null)?.email || null)
            : null,
        });

        if (rpcErr) {
          console.error("[Onboarding] finish_coach_school_onboarding:", rpcErr);
          const msg = rpcErr.message || "";
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
            userMessage = "Choix de directeur invalide.";
          }
          setNavError(userMessage);
          return;
        }
        // RPC OK — short-circuit les writes legacy (users / school_coaches /
        // team_coaches / admin_claims / civil RPC / recruiter). On tombe
        // directement sur setShowSuccess + redirect en bas de finish().
      } else {

      // Persist DirectorChoiceStep choices made at step 2.
      //
      // Pre-5.4d, the wizard wrote is_school_admin / school_admin_type /
      // pending_director_invite to localStorage but finish() never
      // moved them to the DB — every coach who picked "C'est moi"
      // landed on the dashboard with is_school_admin still false.
      //
      // is_school_admin is the canonical admin flag for school + CÉGEP
      // + league contexts per CLAUDE.md (school vs CÉGEP inferred from
      // role). Only set to true when the user actively chose — leave
      // unset (undefined → not in update) when they skipped step 2 so
      // we don't stomp prior state with a false default.
      //
      // school_admin_type ("owner" / "interim") and the full
      // pending_director_invite object live in profile_data JSONB
      // since neither has a dedicated column. Rewriting profile_data
      // here also wipes orphan keys (e.g. pre-5.4a sports_secondaires
      // from legacy wizard completions) — see post-launch-bugs P3.
      // Item 11-Security: a school coach who picks Directeur/Interim
      // (school_admin_type set + role=coach + context!=ligue_civile)
      // must go through admin_claims PENDING review before
      // is_school_admin = true is granted. Civil coach path remains
      // out of scope for the claim workflow.
      //
      // Item 11-Recruteur: a CÉGEP recruteur who picks Directeur
      // (cegep_admin_type='owner') goes through the same PENDING
      // review. CÉGEP has no Interim equivalent (out of scope).
      const isSchoolCoachAdminClaim =
        user?.role === "coach"
        && localUser.context !== "ligue_civile"
        && (localUser.school_admin_type === "owner" || localUser.school_admin_type === "interim");

      const isRecruiterCegepClaim =
        user?.role === "recruiter"
        && (localUser.cegep_admin_type === "owner" || localUser.cegep_admin_type === "interim");

      const isAdminClaim = isSchoolCoachAdminClaim || isRecruiterCegepClaim;

      // Loi 25 — capture the RPRP designation decision when the user is the
      // actual director ("self"/"interim", not "invite": the invitee will
      // decide during their own onboarding). Non-blocking — declining
      // doesn't stop onboarding, it just records the decline so the admin
      // tab + dashboard alert can surface unassigned-RPRP establishments.
      //
      // The two timestamps are mutually exclusive: every director-path
      // write sets exactly one of accepted/declined and clears the other,
      // so an admin reader never sees both at once and the user can change
      // their stance later via /coach/settings (not yet built — same JSONB
      // keys will apply). Non-director paths (coach_only/recruteur_only/
      // invite) write neither key — both stay null/undefined.
      const adminTypeValue = (localUser.school_admin_type || localUser.cegep_admin_type || null) as
        | "owner" | "interim" | null;
      const isInviteFlow = !!localUser.pending_director_invite;
      const isActualDirector = !!adminTypeValue && !isInviteFlow;
      const nowIso = new Date().toISOString();
      const rprpAcceptedAt = isActualDirector && localUser.rprp_consent === true ? nowIso : null;
      const rprpDeclinedAt = isActualDirector && localUser.rprp_consent !== true ? nowIso : null;

      const profileData = {
        bio: localUser.profile?.bio || null,
        experience_years: localUser.profile?.experience_years || null,
        admin_type: adminTypeValue,
        pending_director_invite: localUser.pending_director_invite || null,
        rprp_accepted_at: rprpAcceptedAt,
        rprp_declined_at: rprpDeclinedAt,
      };

      // Save profile data to users table
      await supabase
        .from("users")
        .update({
          onboarding_complete: true,
          first_name: localUser.firstName || user?.firstName,
          last_name: localUser.lastName || user?.lastName,
          phone: localUser.profile?.phone || null,
          profile_data: profileData,
        })
        .eq("id", authUser.id);

      // Sprint civil-rpc-drop : ancien appel à claim_civil_league_admin()
      // retiré. La fonction est DROPPED (migration 20260612200000) et le
      // chemin civil est désormais géré par finish_coach_civil_onboarding
      // (cf. branche isCivilCoach plus haut). Ce legacy else ne fire plus
      // que pour le recruteur, dont les chemins ne déclenchaient jamais
      // ce gate (`is_school_admin && !isAdminClaim` faux pour tous les
      // chemins recruteur : self/interim/invite posent toujours
      // cegep_admin_type → isRecruiterCegepClaim → isAdminClaim=true).

      // Save school to users table — institution.name guaranteed
      // present by the validateInstitution() guard at top of finish().
      // Civil coach path also hits this and is idempotent: LIGUE_CIVILE
      // pseudo-school + school_coaches INSERT already happened inside
      // LeagueCoachLeagueStep; this re-upsert is harmless via onConflict.
      if (user?.role === "coach") {
        const { data: school } = await supabase
          .from("schools")
          .select("id")
          .eq("name", localUser.institution.name)
          .maybeSingle();

        if (school) {
          await supabase.from("users").update({ school_id: school.id }).eq("id", authUser.id);
          await supabase.from("school_coaches").upsert({
            coach_id: authUser.id,
            school_id: school.id,
            role: "COACH",
            sport: localUser.profile?.sport_principal || null,
          }, { onConflict: "coach_id,school_id" });

          // Item 11-Security: file the admin_claims row when a school
          // coach claimed Directeur or Interim during DirectorChoiceStep.
          // The user lands on the dashboard with is_school_admin = false
          // (defer until APPROVED) and the PendingAdminClaimBanner
          // surfaces the review state. Trigger lives in a follow-up
          // migration; for now nothing flips is_school_admin on its own.
          if (isSchoolCoachAdminClaim) {
            const claimType = localUser.school_admin_type === "owner" ? "DIRECTEUR" : "INTERIM";
            const { error: claimErr } = await supabase
              .from("admin_claims")
              .insert({
                user_id: authUser.id,
                school_id: school.id,
                claim_type: claimType,
                status: "PENDING",
              });
            if (claimErr) console.error("[Onboarding] admin_claims insert:", claimErr);
          }
        }
      }

      // Save CÉGEP to users table for recruiter — institution.name
      // guaranteed present by the validateInstitution() guard.
      if (user?.role === "recruiter") {
        const { data: cegep } = await supabase
          .from("schools")
          .select("id")
          .eq("name", localUser.institution.name)
          .maybeSingle();

        if (cegep) {
          // Atomic update — school_id always written; primary_team_id
          // only added to the payload when the recruiter picked a
          // program in RecruiterProgramStep. Skipping it leaves the
          // column at its NULL default (FK + ON DELETE SET NULL on
          // teams already handles cleanup if the row vanishes later).
          const updatePayload: { school_id: string; primary_team_id?: string | null } = {
            school_id: cegep.id,
          };
          const selectedProgramId = (localUser.primary_team as { id?: string } | undefined)?.id ?? null;
          if (selectedProgramId) {
            updatePayload.primary_team_id = selectedProgramId;
          }
          await supabase.from("users").update(updatePayload).eq("id", authUser.id);

          // Item 11-Recruteur: file the admin_claims row when a
          // recruteur claimed Directeur OR Intérimaire for the CÉGEP.
          // claim_type is derived from cegep_admin_type — mirrors the
          // school-coach block. Trigger flips is_school_admin +
          // profile_data.admin_type ('owner' for DIRECTEUR / 'interim'
          // for INTERIM) on APPROVED. The existing demotion cascade
          // is school_id-scoped and role-agnostic — when a CÉGEP
          // DIRECTEUR claim is approved later, any sitting recruiter-
          // interim at the same CÉGEP is auto-demoted.
          if (isRecruiterCegepClaim) {
            const claimType = localUser.cegep_admin_type === "owner" ? "DIRECTEUR" : "INTERIM";
            const { error: claimErr } = await supabase
              .from("admin_claims")
              .insert({
                user_id: authUser.id,
                school_id: cegep.id,
                claim_type: claimType,
                status: "PENDING",
              });
            if (claimErr) console.error("[Onboarding] admin_claims insert (recruteur):", claimErr);
          }
        }
      }

      // users.context is now written at signup (auth/pro/page.tsx via
      // signUp()'s context parameter). Removed redundant write here to
      // maintain single source of truth — having two writers (signup +
      // wizard finish) means they could diverge if one is modified
      // without the other.

      // Save recruiter preferences if recruiter
      if (user?.role === "recruiter" && localUser.search_criteria) {
        const sc = localUser.search_criteria;
        await supabase
          .from("recruiter_preferences")
          .upsert({
            recruiter_id: authUser.id,
            divisions: sc.divisions || [],
            regions_preferees: sc.regions || [],
            graduation_years: sc.grad_years || [],
            moyenne_min: sc.min_gpa || 50,
          });
      }
      } // close else (legacy path)
    }

    setShowSuccess(true);
    const dashMap: Record<string, string> = {
      coach: "/coach/tableau-de-bord",
      recruiter: "/recruteur/tableau-de-bord",
    };
    setTimeout(() => {
      router.push(dashMap[user?.role || "coach"] || "/");
    }, 1500);
  };

  if (!user) return null;

  // Iter coach-3 / civil-2c-mobile — dispatch natif coach (mobile Capacitor).
  // Inséré APRÈS `if (!user) return null;` pour garantir que les 15+ hooks
  // au-dessus de OnboardingPage sont toujours appelés (Rules of Hooks).
  // Sur web (IS_CAPACITOR=false) le wizard web reste inchangé.
  //   - École  (context !== 'ligue_civile') → CoachOnboardingMobileSchool
  //   - Civil  (context === 'ligue_civile') → CoachOnboardingMobileCivil
  // Recruteur reste sur le wizard web (sprint recruteur natif futur).
  if (IS_CAPACITOR && user.role === "coach" && user.context === "ligue_civile") {
    return <CoachOnboardingMobileCivil />;
  }
  if (IS_CAPACITOR && user.role === "coach" && user.context !== "ligue_civile") {
    return <CoachOnboardingMobileSchool />;
  }
  // Iter recruteur-onboarding-mobile — dispatch natif recruteur (5 slides,
  // RPC finish_recruiter_onboarding).
  if (IS_CAPACITOR && user.role === "recruiter") {
    return <RecruiterOnboardingMobile />;
  }

  if (showSuccess) {
    return (
      <div className="bg-[#111317] min-h-screen flex items-center justify-center">
        <div className="text-center animate-scale-fade-in">
          <div className="w-20 h-20 rounded-full bg-[#22C55E] flex items-center justify-center mx-auto mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h2 className="font-head text-2xl font-black text-white uppercase">Ton compte est prêt!</h2>
          <p className="text-sm text-[#9CA3AF] mt-2">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  /* ── Step labels per role ── */
  // Coach labels swap step 1 + step 2 wording based on user.context.
  // The shape stays identical so the wizard's totalSteps + step
  // navigation logic doesn't care whether the user is school or
  // civil — only the rendered strings change.
  const isCivilCoachLabel = user.role === "coach" && user.context === "ligue_civile";
  const coachLabels = isCivilCoachLabel
    ? ["Profil", "Ligue", "Coach principal", "Confirmation"]
    : ["Profil", "École", "Équipe", "Directeur", "Confirmation"];
  const stepLabelsMap: Record<string, string[]> = {
    coach: coachLabels,
    recruiter: ["Profil", "CÉGEP", "Programme", "Directeur", "Critères"],
    coordinator_league: ["Profil", "Ligue", "Invitations"],
  };
  const stepLabels = stepLabelsMap[user.role] || ["1", "2", "3"];

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex flex-col relative">
      <PlaybookBackground />

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-[#1A1D24]">
        <div className="h-full bg-[#E63946] transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
      </div>

      {/* Logo */}
      <div className="relative z-10 pt-8 pb-2 flex justify-center">
        <NexusLogo variant="white" height={36} priority />
      </div>

      {/* Wizard card */}
      <div className="relative z-10 flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-[640px] bg-[#1A1D24] border border-white/5 rounded-xl p-6 sm:p-8">
          <StepIndicator steps={stepLabels} current={step} />

          {/* Step content with slide animation. Coach role splits
              on user.context: 'ligue_civile' triggers LeagueCoachStep
              (école/ligue picker + team creation), everything else
              falls into the school-coach CoachStep. */}
          <div key={`${user.role}-${step}`} className={slideDir === "right" ? "animate-slide-right" : "animate-slide-left"}>
            {user.role === "coach" && user.context !== "ligue_civile" && <CoachStep step={step} user={user} save={save} onFinish={finish} />}
            {user.role === "coach" && user.context === "ligue_civile" && <LeagueCoachStep step={step} user={user} save={save} onFinish={finish} />}
            {user.role === "recruiter" && <RecruiterStep step={step} user={user} save={save} onFinish={finish} />}
            {user.role === "coordinator_league" && <LeagueCoordinatorStep step={step} user={user} save={save} onFinish={finish} />}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
            {step > 0 ? (
              <button type="button" onClick={prev} className="h-11 px-6 rounded-lg border border-white/10 text-sm font-bold text-white hover:border-white/20 transition-colors">
                &larr; Précédent
              </button>
            ) : <div />}
            {step < totalSteps - 1 ? (
              <button type="button" onClick={next} disabled={stepSaving || !canProceed()} className="h-11 px-8 rounded-lg bg-[#E63946] text-sm font-bold text-white hover:bg-[#D42B22] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {stepSaving ? "Enregistrement..." : "Suivant →"}
              </button>
            ) : (
              <button type="button" onClick={finish} disabled={!validateInstitution().ok} className="h-11 px-6 rounded-lg bg-[#E63946] text-sm font-bold text-white hover:bg-[#D42B22] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Terminer et accéder à Nexus &rarr;
              </button>
            )}
          </div>
          {navError && (
            <div className="mt-4 text-[13px] text-[#EF4444] text-right" role="alert">
              {navError}
            </div>
          )}
        </div>
      </div>

      {/* Animations CSS */}
      <style jsx global>{`
        @keyframes slide-right { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slide-left { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes scale-fade-in { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
        @keyframes fade-slide-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-4px); } }
        @keyframes slide-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-slide-right { animation: slide-right 200ms ease-out; }
        .animate-slide-left { animation: slide-left 200ms ease-out; }
        .animate-scale-fade-in { animation: scale-fade-in 400ms ease-out; }
        .animate-fade-slide-down { animation: fade-slide-down 200ms ease-out; }
        .animate-shake { animation: shake 400ms ease-out; }
        .animate-slide-in { animation: slide-in 300ms ease-out; }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RPRP CONSENT CHECKBOX + DECLINE NOTICE — Loi 25 designation
   Rendered inside DirectorChoiceStep when the user picks "self" or "interim".
   Non-blocking: the director can proceed unchecked. finish() records
   profile_data.rprp_accepted_at when checked, rprp_declined_at when not —
   mutually exclusive (each write clears the opposite key). The admin RPRP
   tab + dashboard alert surface declines.
═══════════════════════════════════════════════════════════════ */
function RprpConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <span
        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          checked ? "bg-[#E63946] border-[#E63946]" : "border-[#6B7280] group-hover:border-white/30"
        }`}
        aria-hidden="true"
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
        aria-label="J'accepte d'être désigné(e) responsable de la protection des renseignements personnels"
      />
      <span className="text-[12px] text-[#c8c8cc] leading-relaxed">
        J&apos;accepte d&apos;être désigné(e) responsable de la protection des renseignements personnels (RPRP) pour mon établissement, conformément à la Loi 25.
      </span>
    </label>
  );
}

function RprpDeclineNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="text-[11px] text-[#F59E0B] leading-snug">
        Tu continues sans accepter le rôle de RPRP. Ton établissement n&apos;aura pas de responsable désigné et un administrateur sera avisé.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COACH ONBOARDING STEPS
═══════════════════════════════════════════════════════════════ */
function CoachStep({ step, user, save }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  const p = (user.profile || {}) as Record<string, unknown>;

  // School-coach flow: 5 steps total (profil, école, équipe, directeur,
  // confirmation). The new Équipe step at index 2 surfaces existing teams
  // under the coach's school + sport and lets them join one without a
  // create path. Team selection is optional — the wizard advances even
  // with no match.
  if (step === 0) return <CoachProfile profile={p} save={save} />;
  if (step === 1) return <SchoolStep user={user} save={save} />;
  if (step === 2) return <SchoolCoachTeamStep user={user} save={save} />;
  if (step === 3) return <DirectorChoiceStep user={user} save={save} type="school" />;
  return <CoachConfirmation user={user} />;
}

/* ═══════════════════════════════════════════════════════════════
   DIRECTOR / COORDINATOR CHOICE STEP
   "C'est moi" or "Inviter quelqu'un"
   Used by school coach (Step 3) and league coach (Step 3).
═══════════════════════════════════════════════════════════════ */

function DirectorChoiceStep({ user, save, type }: { user: NexusUser; save: (u: Partial<NexusUser>) => void; type: "school" | "league" | "cegep" }) {
  const isLeague = type === "league";
  const isCegep = type === "cegep";
  const isSchool = type === "school";
  // Civil-coach onboarding flow uses "coach principal" terminology
  // (the team's senior coach), not "coordonnateur" (which describes
  // the separate `coordinator_league` role onboarded via
  // LeagueCoordinatorStep). Keep `isLeague` as the discriminator —
  // any future cegep/league admin variants stay co-located here.
  const roleLabel = isLeague ? "coach principal" : "directeur sportif";
  const RoleLabel = isLeague ? "Coach principal" : "Directeur sportif";
  const orgName = user.institution
    ? (user.institution as Record<string, string>)?.name || "ton organisation"
    : "ton organisation";

  // Sprint cards-restructure-web : ajout du value 'coach' pour school+league
  // (remplace les cartes invite + coach_only par une seule carte avec email
  // invite optionnel). cegep garde le pattern existant.
  const [choice, setChoice] = useState<"self" | "invite" | "interim" | "coach_only" | "recruteur_only" | "coach" | "">("");
  const [selfEmail, setSelfEmail] = useState(user.email || "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  // Loi 25 — RPRP designation consent. Required when the user is becoming
  // director or interim. Cleared (false) when switching to a non-director
  // choice so the gate stays accurate if they toggle back. canProceed() at
  // step 2 reads user.rprp_consent.
  const [rprpConsent, setRprpConsent] = useState<boolean>(!!user.rprp_consent);

  // Item 11: query the selected school's existing admin state so the
  // wizard can hide options that are already taken. CÉGEP path keeps
  // this admin-state pre-check (hasPermanent/hasInterim hide cards).
  //
  // School path — sprint coach-responsable-3 : a basculé sur la RPC
  // school_has_responsable (admin_claims PENDING + APPROVED, plus
  // seulement APPROVED via is_school_admin). Cf. hasResponsable state
  // ci-dessous. League path : pas de pre-check.
  const [schoolAdminState, setSchoolAdminState] = useState<{ hasPermanent: boolean; hasInterim: boolean; loading: boolean }>({ hasPermanent: false, hasInterim: false, loading: true });

  // CÉGEP uniquement (school est sur hasResponsable, league skip).
  useEffect(() => {
    if (!isCegep || !user.institution) {
      setSchoolAdminState({ hasPermanent: false, hasInterim: false, loading: false });
      return;
    }
    const inst = user.institution as Record<string, unknown>;
    const instName = inst?.name as string | undefined;
    if (!instName) {
      setSchoolAdminState({ hasPermanent: false, hasInterim: false, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: school } = await supabase.from("schools").select("id").eq("name", instName).maybeSingle();
      if (cancelled) return;
      if (!school) {
        setSchoolAdminState({ hasPermanent: false, hasInterim: false, loading: false });
        return;
      }
      const { data: admins } = await supabase
        .from("users")
        .select("profile_data")
        .eq("school_id", school.id)
        .eq("is_school_admin", true);
      if (cancelled) return;
      const hasPermanent = !!admins?.some((a) => {
        const pd = a.profile_data as Record<string, unknown> | null;
        return pd?.admin_type === "owner";
      });
      const hasInterim = !!admins?.some((a) => {
        const pd = a.profile_data as Record<string, unknown> | null;
        return pd?.admin_type === "interim";
      });
      setSchoolAdminState({ hasPermanent, hasInterim, loading: false });
    })();
    return () => { cancelled = true; };
  }, [isCegep, user.institution]);

  // Sprint coach-responsable-3 / cards-restructure-web — gate cartes
  // école+league basé sur school_has_responsable (RPC 2a). Couvre PENDING
  // + APPROVED. null = inconnu (loading/échec), true = oui, false = orphan.
  // Sprint recruteur-finish-web-rpc : cegep rejoint le pattern 3 cartes.
  const isSchoolOrLeague = isSchool || isLeague;
  const isCardsContext = isSchool || isLeague || isCegep;
  const [hasResponsable, setHasResponsable] = useState<boolean | null>(null);
  const [responsableLoading, setResponsableLoading] = useState(false);
  useEffect(() => {
    if (!isCardsContext || !user.institution) {
      setHasResponsable(null);
      setResponsableLoading(false);
      return;
    }
    const inst = user.institution as Record<string, unknown>;
    const instName = inst?.name as string | undefined;
    const instId   = inst?.id as string | undefined;
    if (!instName && !instId) {
      setHasResponsable(null);
      setResponsableLoading(false);
      return;
    }
    let cancelled = false;
    setResponsableLoading(true);
    (async () => {
      const supabase = createClient();
      // Civil : LeagueCoachLeagueStep stash déjà institution.id.
      // École : seulement institution.name → lookup schools by name.
      let schoolId: string | null = instId || null;
      if (!schoolId && instName) {
        const { data: school } = await supabase.from("schools").select("id").eq("name", instName).maybeSingle();
        if (cancelled) return;
        schoolId = (school?.id as string) || null;
      }
      if (!schoolId) {
        setHasResponsable(null);
        setResponsableLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("school_has_responsable", { p_school_id: schoolId });
      if (cancelled) return;
      if (error) {
        console.error("[DirectorChoiceStep] school_has_responsable:", error);
        setHasResponsable(null);
      } else {
        setHasResponsable(data === true);
      }
      setResponsableLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isCardsContext, user.institution]);

  // mustBeResponsable : Coach autorisé UNIQUEMENT si hasResponsable===true
  // confirmé. Couvre loading (null), échec RPC (null), orphan (false), club
  // créé (false). Reset choice si mustBeResponsable bascule et 'coach' était
  // sélectionné. Parité mobile civil-cards-restructure + school-cards-restructure
  // + recruteur-onboarding-mobile (cegep depuis recruteur-finish-web-rpc).
  const mustBeResponsable = isCardsContext && hasResponsable !== true;
  useEffect(() => {
    if (mustBeResponsable && (choice === "coach" || choice === "invite" || choice === "coach_only")) {
      setChoice("");
      setInviteEmail("");
      setRprpConsent(false);
    }
  }, [mustBeResponsable, choice]);

  // Show* : structure 3 cartes pour school+league+cegep (self/interim/coach).
  // Le cegep a rejoint le pattern depuis recruteur-finish-web-rpc (3e carte
  // libellée "Recruteur seulement" — voir render). recruteur_only retiré
  // (carte legacy remplacée par showCoach).
  const showSelf = true;     // Toujours visible (les 3 contextes)
  const showInvite = false;  // Retiré (carte legacy, remplacée par invite optionnel sous coach)
  const showInterim = true;  // Toujours visible (les 3 contextes — civil-parity-rpc accepte interim)
  const showCoachOnly = false; // Retiré (carte legacy)
  const showRecruteurOnly = false; // Retiré (remplacée par showCoach avec label "Recruteur seulement" pour cegep)
  const showCoach = isCardsContext; // 3e carte unifiée — label change selon contexte (Entraîneur / Coach / Recruteur)

  const disableCoach = mustBeResponsable;

  // Anciennes cartes "invite" + "coach_only" retirées de school+league
  // (showInvite=false, showCoachOnly=false). Markup conservé pour ne pas
  // toucher cegep ; ces deux constants restent à false pour le markup mort.
  const disableInvite = false;
  const disableCoachOnly = false;

  const inputCls = "w-full bg-[#111317] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:border-[#E63946] outline-none transition-colors";
  const labelCls = "block text-[10px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";

  useEffect(() => {
    const adminKey = "is_school_admin";
    const coachKey = isCegep ? "is_also_recruiter" : "is_also_coach";
    const typeKey = isCegep ? "cegep_admin_type" : "school_admin_type";
    if (choice === "self") {
      save({ [adminKey]: true, [coachKey]: true, [typeKey]: "owner" });
    } else if (choice === "invite" && inviteEmail) {
      save({
        [adminKey]: true,
        [coachKey]: true,
        [typeKey]: "owner",
        pending_director_invite: { email: inviteEmail, firstName: inviteFirstName, lastName: inviteLastName, message: inviteMessage, sent_at: new Date().toISOString(), type: isCegep ? "cegep" : type },
      });
    } else if (choice === "interim") {
      save({
        [adminKey]: true,
        [coachKey]: true,
        [typeKey]: "interim",
      });
    } else if (choice === "coach_only") {
      // Item 11: explicit "Entraîneur seulement" — clear any prior
      // admin flags the user may have toggled on/off in this step.
      // Also clear rprp_consent — they're no longer becoming director,
      // so the consent doesn't apply and shouldn't carry over to finish().
      save({
        [adminKey]: false,
        [coachKey]: true,
        [typeKey]: null,
        pending_director_invite: null,
        rprp_consent: false,
      });
    } else if (choice === "coach") {
      // Sprint cards-restructure-web + recruteur-finish-web-rpc : 3e carte
      // unifiée school+league+cegep. Optionnellement avec un email invite
      // (rempli + valide → stash pending_director_invite ; sinon équivalent
      // coach_only). Le finish() dérive director_choice via la présence
      // d'invite vs coach_only — même mapping que l'école RPC.
      const EMAIL_RE_LOCAL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const inviteOk = !!inviteEmail && EMAIL_RE_LOCAL.test(inviteEmail.trim());
      save({
        [adminKey]: false,
        [coachKey]: true,
        [typeKey]: null,
        pending_director_invite: inviteOk
          ? {
              email: inviteEmail.trim(),
              firstName: inviteFirstName,
              lastName: inviteLastName,
              message: inviteMessage,
              sent_at: new Date().toISOString(),
              type: isCegep ? "cegep" : isLeague ? "league" : "school",
            }
          : null,
        rprp_consent: false,
      });
    } else if (choice === "recruteur_only") {
      // Item 11-Recruteur: explicit "Recruteur seulement" — no admin
      // claim filed. The optional invite sub-form below can populate
      // pending_director_invite without setting any admin flag.
      const invite = inviteEmail
        ? { email: inviteEmail, firstName: inviteFirstName, lastName: inviteLastName, message: inviteMessage, sent_at: new Date().toISOString(), type: "cegep" as const }
        : null;
      save({
        [adminKey]: false,
        [coachKey]: true,
        [typeKey]: null,
        pending_director_invite: invite,
        rprp_consent: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, selfEmail, inviteEmail, inviteFirstName, inviteLastName, inviteMessage]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Qui est le {roleLabel}?</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">
          Chaque {isCegep ? "CÉGEP" : isLeague ? "ligue" : "école"} sur Nexus a besoin d&apos;un responsable. Le {roleLabel} supervise les {isCegep ? "recruteurs" : isLeague ? "entraîneurs" : "coachs"} et {isCegep ? "les résultats de recrutement" : "approuve les profils"}.
        </p>
      </div>

      {/* Loading state — CÉGEP uniquement (school+league : la carte Coach
          est juste disabled pendant le chargement de school_has_responsable,
          pas de blocking spinner). */}
      {(isCegep && schoolAdminState.loading) ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
      <>
      {/* Sprint cards-restructure-web — Loi 25 : bannière contextuelle si
          mustBeResponsable (école/club orphan, ou en cours de vérification). */}
      {mustBeResponsable && (
        <div className="bg-[#DAB65A]/[0.08] border border-[#DAB65A]/30 rounded-lg px-4 py-3 text-[13px] text-white/85 leading-relaxed">
          {responsableLoading ? (
            <>Vérification en cours… si {isCegep ? "ce CÉGEP" : isLeague ? "ce club" : "cette école"} n&apos;a pas encore de responsable sur Nexus, tu devras attester l&apos;être pour rejoindre la plateforme (Loi 25).</>
          ) : (
            <>{isCegep ? "Ce CÉGEP" : isLeague ? "Ce club" : "Cette école"} n&apos;a pas encore de responsable sur Nexus. Pour qu&apos;{isCegep ? "un CÉGEP" : isLeague ? "un club" : "une école"} rejoigne la plateforme, un {isCegep ? "recruteur" : "coach"} doit attester être responsable du programme (Loi 25). Si c&apos;est toi, choisis «&nbsp;C&apos;est moi&nbsp;» ou «&nbsp;Je serai intérimaire&nbsp;». Sinon, demande à la personne responsable de s&apos;inscrire en premier.</>
          )}
        </div>
      )}

      {/* Status hint when admin slot is already filled — CÉGEP only
          (école est gérée par la bannière orpheline + admin_claims). */}
      {isCegep && schoolAdminState.hasPermanent && (
        <div className="bg-[#1A1D24]/60 border border-white/[0.06] rounded-lg px-4 py-3 text-[12px] text-[#9CA3AF]">
          Un directeur sportif est déjà en place pour {orgName}. Tu peux rejoindre l&apos;équipe comme recruteur.
        </div>
      )}
      {isCegep && !schoolAdminState.hasPermanent && schoolAdminState.hasInterim && (
        <div className="bg-[#1A1D24]/60 border border-white/[0.06] rounded-lg px-4 py-3 text-[12px] text-[#9CA3AF]">
          Un directeur intérimaire est en place. Si tu deviens directeur permanent, il sera rétrogradé automatiquement.
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${({
        1: "sm:grid-cols-1",
        2: "sm:grid-cols-2",
        3: "sm:grid-cols-3",
        4: "sm:grid-cols-4",
      } as Record<number, string>)[[showSelf, showInvite, showInterim, showCoachOnly, showRecruteurOnly, showCoach].filter(Boolean).length || 1]}`}>
        {/* Card 1: C'EST MOI */}
        {showSelf && (
        <button
          type="button"
          onClick={() => setChoice("self")}
          className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center ${
            choice === "self"
              ? "border-[#E63946] bg-[rgba(230,57,70,0.08)]"
              : "border-white/10 hover:border-white/20"
          }`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${choice === "self" ? "bg-[#DAB65A]/15" : "bg-[#1A1D24]"}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" /><circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" />
            </svg>
          </div>
          <span className="font-head font-black text-[13px] uppercase tracking-[0.1em] text-white">C&apos;est moi</span>
          <span className="text-[11px] text-[#6B7280] leading-snug">Je supervise le {isCegep ? "programme de recrutement de mon CÉGEP" : `programme sportif de mon ${isLeague ? "club" : "école"}`}</span>
        </button>
        )}

        {/* Card 2: INVITER */}
        {showInvite && (
        <button
          type="button"
          disabled={disableInvite}
          onClick={() => { if (disableInvite) return; setChoice("invite"); }}
          className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center ${
            disableInvite
              ? "border-white/[0.04] bg-[#1A1D24]/40 opacity-40 cursor-not-allowed"
              : choice === "invite"
                ? "border-[#E63946] bg-[rgba(230,57,70,0.08)]"
                : "border-white/10 hover:border-white/20"
          }`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${choice === "invite" && !disableInvite ? "bg-[#E63946]/15" : "bg-[#1A1D24]"}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <span className="font-head font-black text-[13px] uppercase tracking-[0.1em] text-white">Inviter quelqu&apos;un</span>
          <span className="text-[11px] text-[#6B7280] leading-snug">
            {disableInvite ? "Indisponible — école sans responsable." : <>J&apos;enverrai une invitation au {roleLabel}</>}
          </span>
        </button>
        )}

        {/* Card 3: JE SERAI INTÉRIMAIRE — school coaches only, only when no admin exists yet */}
        {showInterim && (
          <button
            type="button"
            onClick={() => setChoice("interim")}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center ${
              choice === "interim"
                ? "border-[#E63946] bg-[rgba(230,57,70,0.08)]"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${choice === "interim" ? "bg-[#6B7280]/20" : "bg-[#1A1D24]"}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <span className="font-head font-black text-[13px] uppercase tracking-[0.1em] text-white">Je serai intérimaire</span>
            <span className="text-[11px] text-[#6B7280] leading-snug">
              {isCegep
                ? "Aucun directeur sportif n'est en place au CÉGEP — je vais assumer ce rôle temporairement"
                : "Aucun directeur sportif n'est en place pour l'instant — je vais assumer ce rôle temporairement"}
            </span>
          </button>
        )}

        {/* Card 4: ENTRAÎNEUR SEULEMENT — Item 11 */}
        {showCoachOnly && (
          <button
            type="button"
            disabled={disableCoachOnly}
            onClick={() => { if (disableCoachOnly) return; setChoice("coach_only"); }}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center ${
              disableCoachOnly
                ? "border-white/[0.04] bg-[#1A1D24]/40 opacity-40 cursor-not-allowed"
                : choice === "coach_only"
                  ? "border-[#E63946] bg-[rgba(230,57,70,0.08)]"
                  : "border-white/10 hover:border-white/20"
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${choice === "coach_only" && !disableCoachOnly ? "bg-[#3B82F6]/20" : "bg-[#1A1D24]"}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="font-head font-black text-[13px] uppercase tracking-[0.1em] text-white">Entraîneur seulement</span>
            <span className="text-[11px] text-[#6B7280] leading-snug">
              {disableCoachOnly ? "Indisponible — école sans responsable." : "Pas de responsabilité administrative pour l'instant — je m'occupe juste de mes athlètes"}
            </span>
          </button>
        )}

        {/* Card 5: RECRUTEUR SEULEMENT — Item 11-Recruteur */}
        {showRecruteurOnly && (
          <button
            type="button"
            onClick={() => setChoice("recruteur_only")}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center ${
              choice === "recruteur_only"
                ? "border-[#E63946] bg-[rgba(230,57,70,0.08)]"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${choice === "recruteur_only" ? "bg-[#3B82F6]/20" : "bg-[#1A1D24]"}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="font-head font-black text-[13px] uppercase tracking-[0.1em] text-white">Recruteur seulement</span>
            <span className="text-[11px] text-[#6B7280] leading-snug">Pas de responsabilité administrative pour l&apos;instant — je m&apos;occupe juste de mon recrutement</span>
          </button>
        )}

        {/* Card 6 (NEW): COACH — school+league. Remplace ENTRAÎNEUR SEULEMENT
            + INVITER (invite devient un champ optionnel sous cette carte). */}
        {showCoach && (
          <button
            type="button"
            disabled={disableCoach}
            onClick={() => { if (disableCoach) return; setChoice("coach"); }}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center ${
              disableCoach
                ? "border-white/[0.04] bg-[#1A1D24]/40 opacity-40 cursor-not-allowed"
                : choice === "coach"
                  ? "border-[#E63946] bg-[rgba(230,57,70,0.08)]"
                  : "border-white/10 hover:border-white/20"
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${choice === "coach" && !disableCoach ? "bg-[#3B82F6]/20" : "bg-[#1A1D24]"}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="font-head font-black text-[13px] uppercase tracking-[0.1em] text-white">
              {isCegep ? "Recruteur seulement" : isLeague ? "Coach" : "Entraîneur seulement"}
            </span>
            <span className="text-[11px] text-[#6B7280] leading-snug">
              {disableCoach
                ? (responsableLoading ? `Vérification du responsable…` : `Indisponible — ${isCegep ? "CÉGEP" : isLeague ? "club" : "école"} sans responsable.`)
                : <>Je suis {isCegep ? "recruteur" : isLeague ? "coach" : "entraîneur"} — un autre est ou sera {roleLabel}.</>}
            </span>
          </button>
        )}
      </div>
      </>
      )}

      {/* C'EST MOI expanded */}
      {choice === "self" && (
        <div className="animate-fade-slide-down space-y-4 bg-[#111317]/60 rounded-xl p-5 border border-white/5">
          <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
            Tu seras {isCegep ? "Recruteur" : "Entraîneur"} ET {RoleLabel} de {orgName}. Tu pourras gérer les autres {isCegep ? "recruteurs" : isLeague ? "entraîneurs" : "coachs"}, voir les stats {isCegep ? "globales de recrutement" : "de recrutement"}, et superviser {isCegep ? "le pipeline de tout le CÉGEP" : "les profils athlètes"}.
          </p>
          <RprpConsentCheckbox checked={rprpConsent} onChange={(v) => { setRprpConsent(v); save({ rprp_consent: v }); }} />
          {!rprpConsent && <RprpDeclineNotice />}
        </div>
      )}

      {/* INVITER expanded */}
      {choice === "invite" && (
        <div className="animate-fade-slide-down space-y-4 bg-[#111317]/60 rounded-xl p-5 border border-white/5">
          <div>
            <label className={labelCls}>Courriel du {roleLabel} <span className="text-[#EF4444]">*</span></label>
            <input type="email" placeholder={isLeague ? "coach@ligue.qc.ca" : `${roleLabel}@ecole.qc.ca`} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Prénom</label>
              <input type="text" placeholder="Prénom" value={inviteFirstName} onChange={(e) => setInviteFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nom</label>
              <input type="text" placeholder="Nom" value={inviteLastName} onChange={(e) => setInviteLastName(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Message personnalisé</label>
            <textarea
              maxLength={300}
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Bonjour, je vous invite à rejoindre Nexus pour superviser notre programme sportif."
              className={`${inputCls} h-20 resize-none`}
            />
            <p className="text-[10px] text-[#4a4d56] text-right mt-1">{inviteMessage.length}/300</p>
          </div>
          <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
            Le {roleLabel} recevra un lien pour créer son compte gratuit. En attendant, tu seras temporairement {isCegep ? "Admin CÉGEP" : isLeague ? "coach principal" : "Admin École"}.
          </p>
        </div>
      )}

      {/* COACH expanded (school+league+cegep) — invite email optionnel.
          Pour cegep, on parle de "responsable de programme" via roleLabel
          (déjà adapté en haut du composant). */}
      {choice === "coach" && isCardsContext && (
        <div className="animate-fade-slide-down space-y-3 bg-[#111317]/60 rounded-xl p-5 border border-white/5">
          <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
            Tu seras {isCegep ? "recruteur" : isLeague ? "coach" : "entraîneur"} sur Nexus. Tu peux optionnellement inviter le {roleLabel} par courriel — on lui enverra un lien pour qu&apos;il revendique le rôle.
          </p>
          <div>
            <label className={labelCls}>Courriel du {roleLabel} (optionnel)</label>
            <input
              type="email"
              placeholder={isCegep ? "responsable@cegep.qc.ca" : isLeague ? "responsable@club.qc.ca" : `${roleLabel}@ecole.qc.ca`}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className={inputCls}
            />
            <p className="text-[10px] text-[#6B7280] mt-1">
              {inviteEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())
                ? "Courriel invalide."
                : "Laisse vide si tu ne sais pas qui contacter."}
            </p>
          </div>
        </div>
      )}

      {/* INTÉRIMAIRE expanded — école, CÉGEP, et league (civil-parity-rpc). */}
      {choice === "interim" && (type === "school" || type === "cegep" || type === "league") && (
        <div className="animate-fade-slide-down space-y-4 bg-[#111317]/60 rounded-xl p-5 border border-white/5">
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="text-[12px] text-[#c8c8cc] leading-relaxed font-bold">
                Tu seras Directeur intérimaire jusqu&apos;à l&apos;arrivée d&apos;un directeur permanent.
              </p>
              <p className="text-[11px] text-[#9CA3AF] leading-relaxed mt-2">
                {isCegep
                  ? <>Tu auras les pleins pouvoirs administratifs (gérer les autres recruteurs du CÉGEP, voir les stats globales de recrutement, superviser le pipeline). Si un directeur officiel s&apos;inscrit plus tard et choisit «&nbsp;C&apos;est moi&nbsp;», ton rôle sera automatiquement ramené à recruteur et tu seras notifié.</>
                  : <>Tu auras les pleins pouvoirs administratifs (gérer les autres entraîneurs, voir les stats de l&apos;école, approuver les profils). Si un directeur officiel s&apos;inscrit plus tard et choisit «&nbsp;C&apos;est moi&nbsp;», ton rôle sera automatiquement ramené à entraîneur et tu seras notifié.</>}
              </p>
            </div>
          </div>
          <RprpConsentCheckbox checked={rprpConsent} onChange={(v) => { setRprpConsent(v); save({ rprp_consent: v }); }} />
          {!rprpConsent && <RprpDeclineNotice />}
        </div>
      )}

      {/* RECRUTEUR SEULEMENT expanded — Item 11-Recruteur */}
      {choice === "recruteur_only" && isCegep && (
        <div className="animate-fade-slide-down space-y-4 bg-[#111317]/60 rounded-xl p-5 border border-white/5">
          <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
            Tu auras accès au recrutement sur Nexus sans rôle administratif. Tu pourras chercher des athlètes, créer ton pipeline, et contacter les coachs.
          </p>

          {/* Optional director invite sub-CTA */}
          <div className="pt-4 border-t border-white/5">
            <div className="flex items-start gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <div>
                <p className="text-[12px] text-white font-bold">Tu veux inviter ton directeur sportif ?</p>
                <p className="text-[11px] text-[#6B7280] mt-0.5 leading-snug">Optionnel — on enverra une invite dès que les comptes seront approuvés.</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Courriel du directeur</label>
                <input type="email" placeholder="directeur@cegep.qc.ca" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Prénom</label>
                  <input type="text" placeholder="Prénom" value={inviteFirstName} onChange={(e) => setInviteFirstName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nom</label>
                  <input type="text" placeholder="Nom" value={inviteLastName} onChange={(e) => setInviteLastName(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CoachProfile({ profile, save }: { profile: Record<string, unknown>; save: (u: Partial<NexusUser>) => void }) {
  const [bio, setBio] = useState((profile.bio as string) || "");
  const [sport, setSport] = useState((profile.sport_principal as string) || "");
  const [experience, setExperience] = useState((profile.experience_years as number) || 0);
  const [phone, setPhone] = useState((profile.phone as string) || "");
  const [photoUrl, setPhotoUrl] = useState((profile.photo_url as string) || "");

  useEffect(() => {
    save({ profile: { ...profile, bio, sport_principal: sport, experience_years: experience, phone, photo_url: photoUrl } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bio, sport, experience, phone, photoUrl]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Parle-nous de toi</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Ces informations seront visibles par les recruteurs qui consultent tes athlètes.</p>
      </div>

      <PhotoUpload photoUrl={photoUrl} onUploaded={setPhotoUrl} sublabel="Optionnel — visible par les recruteurs" />

      {/* Bio */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Bio courte</label>
        <textarea
          maxLength={300}
          rows={3}
          placeholder="Ex: Entraîneur-chef football depuis 8 ans à l'école De Mortagne. Spécialiste développement des quarts-arrières."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={`${inputClass} h-auto py-3 resize-none`}
        />
        <p className="text-[10px] text-[#6B7280] text-right mt-1">{bio.length}/300</p>
      </div>

      {/* Sport principal */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Sport principal</label>
        <select value={sport} onChange={(e) => setSport(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
          <option value="">Sélectionner...</option>
          {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Experience + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Années d&apos;expérience</label>
          <input type="number" min="1" max="40" value={experience || ""} onChange={(e) => setExperience(parseInt(e.target.value) || 0)} className={inputClass} />
        </div>
        <div>
          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Téléphone (opt.)</label>
          <input type="text" placeholder="514-555-1234" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
      </div>
    </div>
  );
}

/* ── Establishment-not-found block — replaces the old custom-school form.
   Message + mailto: to Nexus + an on-screen confirmation #. It saves NOTHING,
   so a user who can't find their school cannot complete onboarding
   (validateInstitution gates next/finish on a non-empty institution name). */
function randomCode(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ── Team-join helpers (shared by SchoolCoachTeamStep + LeagueCoachLeagueStep) ──
   These were previously component-local inside LeagueCoachLeagueStep. Lifted
   to module scope so the new school-coach team step can call the exact same
   INSERT pair (school_coaches role=COACH + team_coaches role=assistant,
   23505 tolerated) and write the identical localStorage shape. State
   management (setSubmitting/setError/setSelectedTeam) stays at each
   callsite — these helpers are pure side-effect + result. */

interface PersistTeamLocallyArgs {
  teamId: string;
  teamName: string;
  ageGroup: string | null;
  gender: string | null;
  category: string | null;
  season: string;
  schoolId: string;
  // school_name retained for callsite symmetry — not persisted directly
  // since institution.name already carries it.
  schoolName?: string;
}

// Writes profile.team + profile.team_id + profile.school_id to
// localStorage. Does NOT touch institution — callers manage that via
// save({ institution: ... }) when they need to overwrite it (civil flow
// promotes the LIGUE_CIVILE pseudo-school here; school flow leaves
// SchoolStep's prior write intact).
function persistTeamLocally(args: PersistTeamLocallyArgs) {
  const rawNow = typeof window !== "undefined" ? localStorage.getItem("nexus_user") : null;
  if (!rawNow) return;
  const current = JSON.parse(rawNow) as NexusUser;
  const updated = {
    ...current,
    profile: {
      ...(current.profile || {}),
      team: {
        id: args.teamId,
        name: args.teamName,
        age_group: args.ageGroup,
        gender: args.gender,
        category: args.category,
        season: args.season,
      },
      school_id: args.schoolId,
      team_id: args.teamId,
    },
  };
  localStorage.setItem("nexus_user", JSON.stringify(updated));
}

// Module-level join helper. Performs ONLY the two INSERTs (school_coaches
// role=COACH, team_coaches role=assistant) with 23505 tolerated on both.
// State (submitting / error / selectedTeam) and localStorage persistence
// are the caller's responsibility — keep this pure so both the civil and
// school flows can wrap it identically.
async function joinExistingTeam(
  team: TeamSearchRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return { ok: false, error: "Session expirée. Reconnecte-toi pour continuer." };
    }

    const { error: scError } = await supabase.from("school_coaches").insert({
      coach_id: authUser.id,
      school_id: team.school_id,
      role: "COACH",
    });
    if (scError && scError.code !== "23505") {
      console.error("[joinExistingTeam] school_coaches insert failed:", scError);
      return { ok: false, error: "Impossible de rejoindre l'équipe. Réessaie." };
    }

    const { error: tcError } = await supabase.from("team_coaches").insert({
      coach_id: authUser.id,
      team_id: team.id,
      role: "assistant",
    });
    if (tcError && tcError.code !== "23505") {
      console.error("[joinExistingTeam] team_coaches insert failed:", tcError);
      return { ok: false, error: "Impossible de rejoindre l'équipe. Réessaie." };
    }

    return { ok: true };
  } catch (err) {
    console.error("[joinExistingTeam] exception:", err);
    return { ok: false, error: "Une erreur est survenue. Réessaie." };
  }
}

function SchoolNotFound({ kind }: { kind: "ecole" | "cegep" }) {
  const isCegep = kind === "cegep";
  // One confirmation # per onboarding session — also the email subject.
  const confirmId = useMemo(
    () => `NEXUS-${isCegep ? "CEGEP" : "ECOLE"}-${randomCode(4)}`,
    [isCegep],
  );
  const noun = isCegep ? "CÉGEP" : "école";
  const heading = `Ton ${noun} n'est pas dans la liste?`;
  const message = isCegep
    ? "Envoie-nous ses infos — on l'ajoute rapidement. Tu devras recommencer l'inscription une fois le CÉGEP ajouté (rien n'est sauvegardé d'ici là)."
    : "Envoie-nous ses infos — on l'ajoute rapidement. Tu devras recommencer l'inscription une fois l'école ajoutée (rien n'est sauvegardé d'ici là).";
  const body =
    `Demande d'ajout — ${confirmId}\n\n` +
    "Nom de l'établissement :\n" +
    "Adresse :\n" +
    "Ville :\n" +
    "Région :\n" +
    "Type (secondaire / cégep) :\n" +
    "Mon courriel (pour le suivi) :\n";
  const mailtoHref =
    `mailto:${NEXUS_CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent(`${confirmId} — Demande d'ajout d'établissement`)}` +
    `&body=${encodeURIComponent(body)}`;

  return (
    <div className="bg-[#111317] border border-white/10 rounded-lg p-4 space-y-3">
      <p className="text-[13px] font-bold text-white">{heading}</p>
      <p className="text-[12px] text-[#9CA3AF] leading-relaxed">{message}</p>
      <a
        href={mailtoHref}
        className="inline-flex h-10 items-center px-5 rounded-lg bg-[#E63946] text-xs font-bold text-white hover:bg-[#D42B22] transition-colors"
      >
        Envoyer les infos à Nexus
      </a>
      <p className="text-[11px] text-[#6B7280]">
        Numéro de demande : <span className="font-mono text-[#9CA3AF]">{confirmId}</span>
      </p>
    </div>
  );
}

/* ── School step (shared by Coach + Director École) ──
   Persists the school's id alongside name/city/region in localUser.institution
   so the downstream SchoolCoachTeamStep can query teams.school_id without a
   second roundtrip. The id field was added in May 2026 — code that reads
   institution should tolerate it being absent on legacy in-flight sessions. */
type SchoolRow = { id: string; name: string; city: string; region: string; conference: string; sports: string[] };
function SchoolStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [selected, setSelected] = useState<SchoolRow | null>(
    user.institution
      ? {
          id: ((user.institution as Record<string, unknown>).id as string) || "",
          name: (user.institution as Record<string, string>).name,
          city: (user.institution as Record<string, string>).city || "",
          region: (user.institution as Record<string, string>).region || "",
          conference: "",
          sports: [],
        }
      : null
  );

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("schools")
      .select("id, name, city, region")
      .eq("type", "SECONDAIRE")
      .order("name")
      .then(({ data, error }) => {
        if (data) {
          setSchools(data.map(s => ({
            id: s.id,
            name: s.name,
            city: s.city || "",
            region: s.region || "",
            conference: "",
            sports: [],
          })));
        }
        setSchoolsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selected) {
      save({ institution: { id: selected.id, name: selected.name, city: selected.city, region: selected.region, conference: selected.conference, sports: selected.sports } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (schoolsLoading) return <p className="text-sm text-[#6B7280]">Chargement des écoles...</p>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Associe-toi à ton école secondaire</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Tes athlètes seront automatiquement liés à cette école.</p>
      </div>

      <SearchableDropdown
        items={schools}
        value={selected?.name || ""}
        onChange={(item) => setSelected(item)}
        placeholder="Rechercher ton école..."
        renderItem={(item) => (
          <div>
            <p className="font-bold">{item.name}</p>
            {cityRegion(item.city, item.region, " — ") && (
              <p className="text-[10px] text-[#6B7280]">{cityRegion(item.city, item.region, " — ")}</p>
            )}
          </div>
        )}
      />

      {/* Selected school card */}
      {selected && (
        <div className="bg-[#111317] border border-white/10 rounded-lg p-5 space-y-3">
          <h3 className="font-head font-black text-lg text-white">{selected.name}</h3>
          {cityRegion(selected.city, selected.region) && (
            <p className="text-xs text-[#9CA3AF]">{cityRegion(selected.city, selected.region)}</p>
          )}
          {selected.conference && <p className="text-xs text-[#6B7280]">Conférence RSEQ: {selected.conference}</p>}
          <div className="flex flex-wrap gap-2">
            {selected.sports.map((s) => (
              <span key={s} className="px-3 py-1 rounded-full bg-[rgba(230,57,70,0.1)] border border-[#E63946]/20 text-[10px] font-bold text-[#E63946] uppercase tracking-wider">{s}</span>
            ))}
          </div>
          <p className="text-xs text-[#22C55E] font-bold flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            C&apos;est mon école
          </p>
        </div>
      )}

      {/* School not in the list — message + mailto to Nexus, saves nothing */}
      {!selected && <SchoolNotFound kind="ecole" />}
    </div>
  );
}

/* ── School-coach team step (between SchoolStep and DirectorChoiceStep) ──
   Mirrors the civil UmbrellaStep: lists existing teams for the coach's
   school + sport, lets them join one. No create path — school coaches
   only join existing teams (admin onboards new teams out-of-band). When
   no teams match, the step renders the empty-state copy and the coach
   can still advance (selection is optional). */
function SchoolCoachTeamStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  // Read fresh localStorage so we see SchoolStep's id write even when
  // the React `user` prop is stale (same pattern as LeagueCoachLeagueStep).
  const raw = typeof window !== "undefined" ? localStorage.getItem("nexus_user") : null;
  const localUser = raw ? (JSON.parse(raw) as NexusUser) : user;
  const inst = (localUser.institution || {}) as Record<string, unknown>;
  const schoolNameFromLocal = (inst.name as string) || "";
  // SchoolStep now stores id alongside name (May 2026). For sessions that
  // started before that change, fall back to a one-shot lookup by name.
  const schoolIdFromLocal = (inst.id as string) || "";
  const profileData = (localUser.profile || {}) as Record<string, unknown>;
  const sportName = (profileData.sport_principal as string) || "";

  const [schoolId, setSchoolId] = useState<string>(schoolIdFromLocal);
  const [sportId, setSportId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedTeam, setJoinedTeam] = useState<TeamSearchRow | null>(null);

  // Resolve sport_principal (name) → sport_id (uuid). Mirrors the
  // resolution in LeagueCoachLeagueStep — same query, same fallback.
  // Also resolves the school id if SchoolStep didn't persist it (legacy
  // in-flight sessions).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (sportName) {
        const { data } = await supabase.from("sports").select("id").eq("nom", sportName).maybeSingle();
        if (!cancelled) setSportId((data?.id as string) ?? null);
      }
      if (!schoolId && schoolNameFromLocal) {
        const { data } = await supabase.from("schools").select("id").eq("name", schoolNameFromLocal).maybeSingle();
        if (!cancelled) setSchoolId((data?.id as string) ?? "");
      }
      if (!cancelled) setResolving(false);
    })();
    return () => { cancelled = true; };
  }, [sportName, schoolNameFromLocal, schoolId]);

  // Resume support — if the coach already joined a team in a prior
  // session (profile.team_id set), surface it as the confirmed pick.
  useEffect(() => {
    if (joinedTeam) return;
    const teamData = profileData.team as Record<string, unknown> | undefined;
    if (!teamData?.id) return;
    setJoinedTeam({
      id: teamData.id as string,
      name: (teamData.name as string) ?? "",
      age_group: (teamData.age_group as string) ?? null,
      gender: (teamData.gender as string) ?? null,
      division: (teamData.category as string) ?? null,
      league: null,
      school_id: schoolId,
      school_name: schoolNameFromLocal,
      coach_count: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePick(team: TeamSearchRow) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await joinExistingTeam(team);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // School flow keeps the SECONDAIRE institution write from
      // SchoolStep — no institution override needed. We still bump
      // localUserVersion via save({}) so anything reading profile.team
      // re-renders.
      persistTeamLocally({
        teamId: team.id,
        teamName: team.name,
        ageGroup: team.age_group,
        gender: team.gender,
        category: team.division,
        season: getCurrentSeason(),
        schoolId: team.school_id,
        schoolName: team.school_name,
      });
      save({});
      setJoinedTeam(team);
    } finally {
      setSubmitting(false);
    }
  }

  if (resolving) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-[#6B7280]">Chargement des équipes…</p>
      </div>
    );
  }

  if (!sportName || !sportId) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-[#EF4444]">
          Erreur : ton sport principal n&apos;a pas été reconnu. Reviens à l&apos;étape Profil
          et sélectionne un sport.
        </p>
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-[#EF4444]">
          Erreur : ton école n&apos;a pas été reconnue. Reviens à l&apos;étape École
          et sélectionne ton établissement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Choisis ton équipe</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">
          Si elle est déjà sur Nexus, sélectionne-la. Sinon, tu pourras la créer plus tard avec l&apos;aide de notre équipe.
        </p>
      </div>

      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3">
          <p className="text-[12px] text-[#EF4444]">{error}</p>
        </div>
      )}

      {/* Read-only sport scope header — mirrors the civil umbrella's
          "Club : X" line and the recruiter step's "Sport : X". A school
          coach has ONE declared sport (canProceed gates step 0 on
          sport_principal for role==="coach"), and joining a team in
          another sport would mismatch the coach's profile. Display
          only — NOT a picker. sportName is guaranteed non-empty here
          because the guard at line ~1777 already redirected to an
          error screen if it couldn't resolve. */}
      <div className="bg-[#111317]/60 border border-white/[0.06] rounded-lg p-3 text-[12px] text-[#9CA3AF]">
        Ton sport : <span className="text-white font-bold">{sportName}</span>
      </div>

      <UmbrellaStep
        schoolId={schoolId}
        schoolName={schoolNameFromLocal}
        sportId={sportId}
        onSelect={handlePick}
        scopeLabel="École"
        showBack={false}
        emptyMessage="Aucune équipe trouvée pour cette école. Contacte-nous pour ajouter ton équipe."
      />

      {joinedTeam && (
        <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg p-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <p className="text-[12px] text-[#22C55E] font-bold">
            Tu as rejoint {joinedTeam.name}. Tu peux continuer.
          </p>
        </div>
      )}

      {submitting && <p className="text-[12px] text-[#9CA3AF]">Enregistrement en cours...</p>}
    </div>
  );
}

/* ── Coach confirmation (step 3) ── */
type ConfirmationRow = { label: string; value: string };

function ConfirmationSection({ title, rows }: { title?: string; rows: ConfirmationRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      {title && <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF] mb-2">{title}</h3>}
      <div className="bg-[#111317] border border-white/10 rounded-xl overflow-hidden">
        {rows.map((row, i) => (
          <div key={i} className={`flex items-center justify-between px-5 py-3.5 ${i < rows.length - 1 ? "border-b border-white/5" : ""}`}>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B7280]">{row.label}</span>
            <span className="text-sm text-white font-medium text-right">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachConfirmation({ user }: { user: NexusUser }) {
  // LeagueCoachLeagueStep writes team / team_id directly to
  // localStorage without going through save() (see persistTeamLocally),
  // so those fields aren't in the React `user` prop. Read fresh from
  // localStorage to surface them in the civil recap. Same pattern as
  // next() at :380.
  const raw = typeof window !== "undefined" ? localStorage.getItem("nexus_user") : null;
  const localUser = raw ? (JSON.parse(raw) as NexusUser) : user;
  const p = (localUser.profile || {}) as Record<string, unknown>;
  const inst = (localUser.institution || {}) as Record<string, unknown>;
  // Civil branch derives from context (not a separate pseudo-role) —
  // post-Phase 6.2 the wizard collapses coach_league into
  // `role === 'coach' && context === 'ligue_civile'`.
  const isCivil = user.role === "coach" && (user.context === "ligue_civile" || localUser.context === "ligue_civile");

  const profilRows: ConfirmationRow[] = [
    { label: "Nom", value: `${user.firstName} ${user.lastName}` },
    { label: "Courriel", value: user.email },
    p.sport_principal ? { label: "Sport principal", value: p.sport_principal as string } : null,
    p.experience_years ? { label: "Expérience", value: `${p.experience_years} ans` } : null,
    p.phone ? { label: "Téléphone", value: p.phone as string } : null,
  ].filter(Boolean) as ConfirmationRow[];

  // Affiliation rows differ between civil (ligue + équipe metadata) and
  // école (school + region + conference). The "Coach principal" / role
  // sub-line — derived from school_admin_type + pending_director_invite
  // written by DirectorChoiceStep — is shown only for civil per the
  // 5.4b spec. École keeps its existing single-block layout.
  if (isCivil) {
    // Phase 6.2: civil team metadata is now stored in localStorage
    // under profile.team (was profile.league_team in the legacy
    // model). LeagueCoachLeagueStep writes both keys for now
    // — see persistTeamLocally — but new code reads only `team`.
    const team = (p.team || p.league_team || {}) as Record<string, unknown>;
    // gender is stored lowercase no-accent ("masculin"/"feminin"/
    // "mixte"). Capitalize + restore accent for human display.
    const teamGenderRaw = team.gender as string | undefined;
    const GENDER_DISPLAY: Record<string, string> = {
      masculin: "Masculin",
      feminin: "Féminin",
      mixte: "Mixte",
    };
    const teamGender = teamGenderRaw ? GENDER_DISPLAY[teamGenderRaw] ?? teamGenderRaw : undefined;
    const teamCategory = team.category as string | undefined;
    const genreDivision = [teamGender, teamCategory].filter(Boolean).join(" / ");

    const affiliationRows: ConfirmationRow[] = [
      inst.name ? { label: "Ligue", value: inst.name as string } : null,
      team.name ? { label: "Équipe", value: team.name as string } : null,
      team.age_group ? { label: "Catégorie d'âge", value: team.age_group as string } : null,
      genreDivision ? { label: "Genre / Division", value: genreDivision } : null,
      team.season ? { label: "Saison", value: team.season as string } : null,
    ].filter(Boolean) as ConfirmationRow[];

    const invite = localUser.pending_director_invite as Record<string, unknown> | null;
    const adminType = (localUser as unknown as Record<string, unknown>).school_admin_type as string | undefined;
    let coachPrincipalValue: string | null = null;
    if (invite?.email) coachPrincipalValue = `Invitation envoyée à ${invite.email}`;
    else if (adminType === "owner") coachPrincipalValue = "C'est moi";
    const roleRows: ConfirmationRow[] = coachPrincipalValue
      ? [{ label: "Coach principal", value: coachPrincipalValue }]
      : [];

    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-head text-xl font-black text-white uppercase">Confirme ton profil</h2>
          <p className="text-sm text-[#9CA3AF] mt-1">Vérifie que tout est correct avant de continuer.</p>
        </div>

        <ConfirmationSection title="Profil" rows={profilRows} />
        <ConfirmationSection title="Affiliation" rows={affiliationRows} />
        <ConfirmationSection title="Rôle" rows={roleRows} />

        {typeof p.bio === "string" && p.bio && (
          <div className="bg-[#111317] border border-white/10 rounded-xl px-5 py-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B7280] block mb-2">Bio</span>
            <p className="text-sm text-[#9CA3AF] leading-relaxed italic">&ldquo;{p.bio}&rdquo;</p>
          </div>
        )}

        <div className="flex items-center gap-3 p-4 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <p className="text-xs text-[#22C55E] font-bold">Tout est bon? Clique sur Terminer pour accéder à ton tableau de bord.</p>
        </div>
      </div>
    );
  }

  // École flat layout — unchanged from pre-5.4b shape (sports_secondaires
  // row already removed in 5.4a).
  const ecoleRows: ConfirmationRow[] = [
    ...profilRows,
    inst.name ? { label: "École", value: inst.name as string } : null,
    cityRegion(inst.city as string, inst.region as string) ? { label: "Ville", value: cityRegion(inst.city as string, inst.region as string) } : null,
    inst.conference ? { label: "Conférence RSEQ", value: inst.conference as string } : null,
  ].filter(Boolean) as ConfirmationRow[];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Confirme ton profil</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Vérifie que tout est correct avant de continuer.</p>
      </div>

      <ConfirmationSection rows={ecoleRows} />

      {typeof p.bio === "string" && p.bio && (
        <div className="bg-[#111317] border border-white/10 rounded-xl px-5 py-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B7280] block mb-2">Bio</span>
          <p className="text-sm text-[#9CA3AF] leading-relaxed italic">&ldquo;{p.bio}&rdquo;</p>
        </div>
      )}

      <div className="flex items-center gap-3 p-4 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        <p className="text-xs text-[#22C55E] font-bold">Tout est bon? Clique sur Terminer pour accéder à ton tableau de bord.</p>
      </div>
    </div>
  );
}

/* ── Director profile (shared — used by league coordinator onboarding) ── */
function DirectorProfile({ user, save, subtitle }: { user: NexusUser; save: (u: Partial<NexusUser>) => void; subtitle: string }) {
  const p = (user.profile || {}) as Record<string, unknown>;
  const [titre, setTitre] = useState((p.titre as string) || "");
  const [phone, setPhone] = useState((p.phone as string) || "");

  useEffect(() => {
    save({ profile: { ...p, titre, phone } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titre, phone]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Parle-nous de toi</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">{subtitle}</p>
      </div>

      {/* Photo */}
      <PhotoUpload photoUrl="" onUploaded={() => {}} sublabel="Optionnel" />

      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Titre / Poste</label>
        <input type="text" placeholder="Ex: Directeur des services aux élèves et du sport" value={titre} onChange={(e) => setTitre(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Téléphone (optionnel)</label>
        <input type="text" placeholder="418-555-1234" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </div>
    </div>
  );
}

/* ── CÉGEP step ── */
function CegepStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const [cegeps, setCegeps] = useState<{ id: string; name: string; city: string; region: string }[]>([]);
  const [cegepsLoading, setCegepsLoading] = useState(true);
  const [selected, setSelected] = useState<{ id: string; name: string; city: string; region: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("schools").select("id, name, city, region").eq("type", "CEGEP").order("name").then(({ data }) => {
      if (data) {
        setCegeps(data);
        // Pre-select if user already has institution
        if (user.institution) {
          const instName = (user.institution as Record<string, string>)?.name;
          const found = data.find((c) => c.name === instName);
          if (found) setSelected(found);
        }
      }
      setCegepsLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected) {
      save({ institution: { name: selected.name, city: selected.city, region: selected.region } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (cegepsLoading) return <p className="text-sm text-[#6B7280]">Chargement des CÉGEPs...</p>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Configure ton établissement</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Associe-toi à ton CÉGEP pour gérer tes recruteurs.</p>
      </div>

      <SearchableDropdown
        items={cegeps}
        value={selected?.name || ""}
        onChange={(item) => setSelected(item)}
        placeholder="Rechercher ton CÉGEP..."
        renderItem={(item) => (
          <div>
            <p className="font-bold">{item.name}</p>
            {cityRegion(item.city, item.region, " — ") && <p className="text-[10px] text-[#6B7280]">{cityRegion(item.city, item.region, " — ")}</p>}
          </div>
        )}
      />

      {selected && (
        <div className="bg-[#111317] border border-white/10 rounded-lg p-5 space-y-2">
          <h3 className="font-head font-black text-lg text-white">{selected.name}</h3>
          {cityRegion(selected.city, selected.region, " — ") && (
            <p className="text-xs text-[#9CA3AF]">{cityRegion(selected.city, selected.region, " — ")}</p>
          )}
          <p className="text-xs text-[#22C55E] font-bold flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            CÉGEP sélectionné
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Invite step (shared by directors) ── */
function InviteStep({ role }: { role: string; onFinish: () => void }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  const addEmail = () => {
    if (currentEmail && emails.length < 10 && currentEmail.includes("@")) {
      setEmails([...emails, currentEmail]);
      setCurrentEmail("");
    }
  };

  const removeEmail = (i: number) => setEmails(emails.filter((_, idx) => idx !== i));

  const copyLink = () => {
    navigator.clipboard.writeText("https://nexus-brown-zeta.vercel.app/auth?mode=signup");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">
          Invite tes {role === "coach" ? "entraîneurs" : "recruteurs"}
        </h2>
        <p className="text-sm text-[#9CA3AF] mt-1">
          {role === "recruteur"
            ? "Ils auront accès à la base de données d’athlètes une fois validés par un admin."
            : "Ils pourront créer des profils athlètes pour ton école."}
        </p>
      </div>

      {/* Email input */}
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="courriel@exemple.ca"
          value={currentEmail}
          onChange={(e) => setCurrentEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
          className={`${inputClass} flex-1`}
        />
        <button type="button" onClick={addEmail} className="h-11 px-4 rounded-lg bg-[#E63946] text-xs font-bold text-white hover:bg-[#D42B22] transition-colors shrink-0">
          Ajouter
        </button>
      </div>

      {/* Email pills */}
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {emails.map((em, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111317] border border-white/10 text-xs text-white">
              {em}
              <button type="button" onClick={() => removeEmail(i)} className="text-[#6B7280] hover:text-[#EF4444] transition-colors">&times;</button>
            </span>
          ))}
        </div>
      )}

      {emails.length > 0 && (
        <button type="button" onClick={() => setToast("Invitations envoyées (POC)")} className="h-10 px-6 rounded-lg bg-[#E63946] text-xs font-bold text-white hover:bg-[#D42B22] transition-colors">
          Envoyer les invitations ({emails.length})
        </button>
      )}

      {toast && (
        <p className="text-xs text-[#22C55E] font-bold">{toast}</p>
      )}

      {/* Share link */}
      <div className="border-t border-white/5 pt-5 space-y-2">
        <p className="text-xs text-[#9CA3AF]">Ou partage ce lien d&apos;inscription</p>
        <div className="flex gap-2">
          <input type="text" readOnly value="https://nexus-brown-zeta.vercel.app/auth?mode=signup" className={`${inputClass} text-[#6B7280] flex-1`} />
          <button type="button" onClick={copyLink} className="h-11 px-4 rounded-lg border border-white/10 text-xs font-bold text-white hover:border-white/20 transition-colors shrink-0">
            {copied ? "✓ Copié!" : "Copier"}
          </button>
        </div>
      </div>

      {role === "recruteur" && (
        <p className="text-[10px] text-[#6B7280] italic">
          Les recruteurs invités devront quand même être validés par un administrateur Nexus avant d&apos;accéder à la plateforme.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RECRUITER ONBOARDING STEPS
═══════════════════════════════════════════════════════════════ */
function RecruiterStep({ step, user, save }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  if (step === 0) return <RecruiterProfile user={user} save={save} />;
  if (step === 1) return <RecruiterCegepStep user={user} save={save} />;
  // Step 2 = Programme. Optional — canProceed() defaults to true here.
  // Recruiters pick a single team (program) under their CÉGEP. The
  // pick lives in localStorage as `primary_team` until finish() writes
  // it to users.primary_team_id.
  if (step === 2) return <RecruiterProgramStep user={user} save={save} />;
  // Sprint recruteur-finish-web-rpc — step 3 = DirectorChoiceStep cegep
  // (3 cartes pattern unifié) ; le step Critères a été retiré. Le composant
  // RecruiterCriteria reste pour /recruteur/parametres (post-onboarding).
  return <DirectorChoiceStep user={user} save={save} type="cegep" />;
}

/* ── Recruiter profile ── */
function RecruiterProfile({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const p = (user.profile || {}) as Record<string, unknown>;
  const [bio, setBio] = useState((p.bio as string) || "");
  const [sport, setSport] = useState((p.sport_principal as string) || "");
  const [experience, setExperience] = useState((p.experience_years as number) || 0);
  const [phone, setPhone] = useState((p.phone as string) || "");

  useEffect(() => {
    save({ profile: { ...p, bio, sport_principal: sport, experience_years: experience, phone } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bio, sport, experience, phone]);

  const cegepName = (user.institution as Record<string, unknown>)?.name as string || null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Bienvenue sur Nexus!</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Les coachs verront ces informations quand tu les contacteras.</p>
      </div>

      {cegepName && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span className="text-xs font-bold text-[#22C55E]">Tu recrutes pour : {cegepName}</span>
        </div>
      )}

      {/* Photo */}
      <PhotoUpload photoUrl="" onUploaded={() => {}} sublabel="Optionnel" />

      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Bio courte</label>
        <textarea maxLength={300} rows={3} placeholder="Ex: Recruteur football au CÉGEP Garneau depuis 5 ans. Je cherche des joueurs de ligne et des demis défensifs." value={bio} onChange={(e) => setBio(e.target.value)} className={`${inputClass} h-auto py-3 resize-none`} />
        <p className="text-[10px] text-[#6B7280] text-right mt-1">{bio.length}/300</p>
      </div>

      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Sport principal recruté</label>
        <select value={sport} onChange={(e) => setSport(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
          <option value="">Sélectionner...</option>
          {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Années d&apos;expérience</label>
          <input type="number" min="1" max="40" value={experience || ""} onChange={(e) => setExperience(parseInt(e.target.value) || 0)} className={inputClass} />
        </div>
        <div>
          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Téléphone (opt.)</label>
          <input type="text" placeholder="418-555-1234" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
      </div>
    </div>
  );
}

/* ── Recruiter search criteria ── */
/* ── Recruiter CÉGEP selection ── */

function RecruiterCegepStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const inst = user.institution as Record<string, string> | null;
  const [selected, setSelected] = useState(inst?.name || "");
  const [search, setSearch] = useState("");
  // CÉGEP rows now carry `id` so the downstream RecruiterProgramStep
  // can query teams.school_id without a second roundtrip — mirrors the
  // SchoolStep parity refactor (May 2026). Legacy in-flight sessions
  // may have institution without id; the program step handles that.
  const [cegeps, setCegeps] = useState<{ id: string; name: string; city: string; region: string }[]>([]);

  const inputCls = "w-full bg-[#111317] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:border-[#E63946] outline-none transition-colors";

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("schools")
      .select("id, name, city, region")
      .eq("has_collegial", true)
      .order("name")
      .then(({ data, error }) => {
        if (data) {
          setCegeps(data.map(s => ({
            id: s.id,
            name: s.name,
            city: s.city || "",
            region: s.region || "",
          })));
        }
      });
  }, []);

  const filtered = cegeps.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.city.toLowerCase().includes(search.toLowerCase())
  );

  const selectCegep = (c: { id: string; name: string; city: string; region: string }) => {
    setSelected(c.name);
    save({ institution: { id: c.id, name: c.name, city: c.city, region: c.region } });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Ton CÉGEP</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Associe-toi à ton CÉGEP pour commencer le recrutement.</p>
      </div>

      {!selected && (
        <>
          <input
            type="text"
            placeholder="Rechercher un CÉGEP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputCls}
          />
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => selectCegep(c)}
                className="w-full text-left bg-[#111317] border border-white/5 rounded-lg px-4 py-3 hover:border-[#E63946]/30 transition-colors"
              >
                <p className="text-[14px] font-bold text-white">{c.name}</p>
                {cityRegion(c.city, c.region) && (
                  <p className="text-[12px] text-[#6B7280]">{cityRegion(c.city, c.region)}</p>
                )}
              </button>
            ))}
          </div>
          <SchoolNotFound kind="cegep" />
        </>
      )}

      {selected && (
        <div className="bg-[#111317] border border-[#22C55E]/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-white">{selected}</p>
              <p className="text-[12px] text-[#6B7280]">{cityRegion((inst as Record<string, string>)?.city, (inst as Record<string, string>)?.region)}</p>
            </div>
            <span className="text-[12px] font-bold text-[#22C55E]">✓ Sélectionné</span>
          </div>
          <button type="button" onClick={() => { setSelected(""); save({ institution: null }); }} className="text-[11px] text-[#6B7280] hover:text-white mt-2 transition-colors">
            Changer de CÉGEP
          </button>
        </div>
      )}

    </div>
  );
}

/* ── Recruiter Programme step (between CÉGEP and Directeur) ──
   Reuses UmbrellaStep to surface every team under the recruiter's
   CÉGEP — no sport filter (recruiters span all sports). The pick is
   stored in local state as primary_team; finish() writes it to
   users.primary_team_id alongside the school_id write. Selection is
   OPTIONAL — the recruiter can advance without picking. No DB write
   happens during the step (recruiters are neither coaches nor
   directors — school_coaches / team_coaches are off-limits here). */
function RecruiterProgramStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  // Read fresh localStorage so we see RecruiterCegepStep's id write
  // even when the React `user` prop is stale (same pattern as
  // SchoolCoachTeamStep).
  const raw = typeof window !== "undefined" ? localStorage.getItem("nexus_user") : null;
  const localUser = raw ? (JSON.parse(raw) as NexusUser) : user;
  const inst = (localUser.institution || {}) as Record<string, unknown>;
  const cegepNameFromLocal = (inst.name as string) || "";
  // RecruiterCegepStep now stores id alongside name. Legacy in-flight
  // sessions that pre-date that change fall back to a one-shot lookup
  // by name below.
  const cegepIdFromLocal = (inst.id as string) || "";

  // Pre-fill the sport filter from the recruiter's profile step
  // (sport_principal). NOT hard-gated: canProceed() at the top of this
  // file only enforces sport_principal for coaches (step 0 && role===coach).
  // A recruiter can land here with profileSportName="" if they skipped
  // the profile sport selector — in that case sportId stays "" and the
  // list defaults to all sports (UmbrellaStep skips .eq("sport_id", ...)
  // when sportId === "").
  const profileData = (localUser.profile || {}) as Record<string, unknown>;
  const profileSportName = (profileData.sport_principal as string) || "";

  const [cegepId, setCegepId] = useState<string>(cegepIdFromLocal);
  const [sportId, setSportId] = useState<string>("");
  const [sportOptions, setSportOptions] = useState<{ id: string; nom: string }[]>([]);
  const [resolving, setResolving] = useState<boolean>(true);
  const [selected, setSelected] = useState<NexusUser["primary_team"]>(
    (localUser.primary_team ?? null) as NexusUser["primary_team"]
  );

  // Fetch the sports list (picker options + name → id seed) and, when
  // missing, fall back to looking up CÉGEP id by name (legacy resume).
  // Both run in one effect so `resolving` flips once everything is ready
  // and UmbrellaStep mounts with the right sportId on first render
  // (avoids the all-sports-then-filtered flash).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();

      // Sports list — always needed (picker + seed lookup).
      const sportsRes = await supabase.from("sports").select("id, nom").order("nom");
      if (cancelled) return;
      const opts = (sportsRes.data ?? []) as { id: string; nom: string }[];
      setSportOptions(opts);
      if (profileSportName) {
        // RecruiterProfile (line ~2228) writes the FR sport name (e.g.
        // "Football") from the SPORTS constant. Match by exact nom; if
        // no match (typo / stale schema / empty), sportId stays "" and
        // the picker shows "Tous les sports" — no hard error.
        const match = opts.find((s) => s.nom === profileSportName);
        if (match) setSportId(match.id);
      }

      // CÉGEP id fallback for pre-id-persistence sessions.
      if (!cegepId && cegepNameFromLocal) {
        const { data } = await supabase
          .from("schools")
          .select("id")
          .eq("name", cegepNameFromLocal)
          .maybeSingle();
        if (cancelled) return;
        setCegepId((data?.id as string) ?? "");
      }

      setResolving(false);
    })();
    return () => { cancelled = true; };
  }, [cegepId, cegepNameFromLocal, profileSportName]);

  function handlePick(team: TeamSearchRow) {
    // Toggle off if the same card is clicked twice; otherwise swap.
    const isSame = selected?.id === team.id;
    const next = isSame
      ? null
      : {
          id: team.id,
          name: team.name,
          age_group: team.age_group,
          gender: team.gender,
          division: team.division,
        };
    setSelected(next);
    save({ primary_team: next });
  }

  if (resolving) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-[#6B7280]">Chargement des programmes…</p>
      </div>
    );
  }

  if (!cegepId) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-[#EF4444]">
          Erreur : votre CÉGEP n&apos;a pas été reconnu. Revenez à l&apos;étape CÉGEP
          et sélectionnez votre établissement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Sélectionnez votre programme principal</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">
          Le programme avec lequel vous travaillez le plus. Vous pourrez en consulter d&apos;autres dans la plateforme. (Optionnel — vous pouvez passer cette étape.)
        </p>
      </div>

      {/* Sport filter picker. Value = sportId state, seeded from
          profile.sport_principal on mount. Recruiter can switch to
          browse other sports — purely a search scope, doesn't alter
          their declared sport. Empty value = "Tous les sports"; the
          UmbrellaStep contract treats sportId === "" as no filter
          (parity with the SchoolCoachTeamStep / civil flow patterns,
          but the recruiter is the only consumer that ever sends ""). */}
      <div>
        <label htmlFor="recruiter-program-sport" className={`${label} text-[#9CA3AF] mb-1.5 block`}>Sport</label>
        <select
          id="recruiter-program-sport"
          value={sportId}
          onChange={(e) => setSportId(e.target.value)}
          className={`${inputClass} appearance-none cursor-pointer`}
          aria-label="Filtrer les programmes par sport"
        >
          <option value="">Tous les sports</option>
          {sportOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>
        <p className="text-[11px] text-[#6B7280] mt-1.5">
          Pré-rempli depuis votre profil — changez-le pour parcourir les programmes d&apos;un autre sport.
        </p>
      </div>

      <UmbrellaStep
        schoolId={cegepId}
        schoolName={cegepNameFromLocal}
        sportId={sportId}
        onSelect={handlePick}
        scopeLabel="CÉGEP"
        showBack={false}
        emptyMessage="Aucun programme trouvé pour ce CÉGEP. Contactez-nous pour l'ajouter."
        cardCtaText="Sélectionner →"
        selectedTeamId={selected?.id ?? null}
      />

      {selected && (
        <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg p-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <p className="text-[12px] text-[#22C55E] font-bold">
            Programme sélectionné : {selected.name}.
          </p>
        </div>
      )}
    </div>
  );
}

function RecruiterCriteria({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const sc = (user.search_criteria || {}) as Record<string, unknown>;
  const [positions, setPositions] = useState<string[]>((sc.positions as string[]) || []);
  const [divisions, setDivisions] = useState<string[]>((sc.divisions as string[]) || []);
  const [regions, setRegions] = useState<string[]>((sc.regions as string[]) || [...REGIONS]);
  const [gradYears, setGradYears] = useState<number[]>((sc.grad_years as number[]) || [2026, 2027]);
  const [minGpa, setMinGpa] = useState((sc.min_gpa as number) || 70);

  const sportPrincipal = ((user.profile || {}) as Record<string, unknown>).sport_principal as string || "Football";
  const positionOptions = sportPrincipal === "Football" ? FOOTBALL_POSITIONS : ["Joueur", "Gardien", "Ailier", "Centre", "Défenseur"];
  const [availableDivisions, setAvailableDivisions] = useState<string[]>(["D1", "D2", "D3"]);

  useEffect(() => {
    if (!sportPrincipal || sportPrincipal === "Football") {
      setAvailableDivisions(["D1", "D2", "D3"]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("ligues")
      .select("division, sports!inner(nom)")
      .eq("sports.nom", sportPrincipal)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const divs = [...new Set(data.map((l: Record<string, unknown>) => l.division as string).filter(Boolean))];
          setAvailableDivisions(divs.length > 0 ? divs : ["D1", "D2", "D3"]);
        }
      });
  }, [sportPrincipal]);

  useEffect(() => {
    save({ search_criteria: { positions, divisions, regions, grad_years: gradYears, min_gpa: minGpa } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, divisions, regions, gradYears, minGpa]);

  const toggleArr = <T,>(arr: T[], val: T, set: (a: T[]) => void) => {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Qu&apos;est-ce que tu cherches?</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">On utilisera ces critères pour te montrer les athlètes les plus pertinents.</p>
      </div>

      {/* Positions — linked to sport */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Positions recherchées — {sportPrincipal}</label>
        <PillToggle options={positionOptions} selected={positions} onToggle={(v) => toggleArr(positions, v, setPositions)} />
      </div>

      {/* Divisions */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Divisions</label>
        <div className="flex gap-3">
          {availableDivisions.map((d) => (
            <label key={d} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={divisions.includes(d)} onChange={() => toggleArr(divisions, d, setDivisions)} className="accent-[#E63946] w-4 h-4" />
              <span className="text-sm text-white">{d}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Regions */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Régions préférées</label>
        <PillToggle options={REGIONS} selected={regions} onToggle={(v) => toggleArr(regions, v, setRegions)} />
      </div>

      {/* Grad years */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Année de graduation ciblée</label>
        <div className="flex gap-3">
          {GRAD_YEARS.map((y) => (
            <label key={y} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={gradYears.includes(y)} onChange={() => toggleArr(gradYears, y, setGradYears)} className="accent-[#E63946] w-4 h-4" />
              <span className="text-sm text-white">{y}</span>
            </label>
          ))}
        </div>
      </div>

      {/* GPA slider */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Moyenne générale minimum: <span className="text-white">{minGpa}%</span></label>
        <input type="range" min="50" max="90" step="5" value={minGpa} onChange={(e) => setMinGpa(parseInt(e.target.value))} className="w-full accent-[#E63946]" />
        <div className="flex justify-between text-[9px] text-[#6B7280]"><span>50%</span><span>90%</span></div>
      </div>

    </div>
  );
}

/* ── Recruiter team needs ── */
function RecruiterNeeds({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const tn = (user.team_needs || {}) as Record<string, unknown>;
  const [rows, setRows] = useState<{ position: string; count: number; priority: string }[]>(
    (tn.positions_needed as { position: string; count: number; priority: string }[]) || []
  );
  const [notes, setNotes] = useState((tn.notes as string) || "");

  const sportPrincipal = ((user.profile || {}) as Record<string, unknown>).sport_principal as string || "Football";
  const positionOptions = sportPrincipal === "Football" ? FOOTBALL_POSITIONS : ["Joueur", "Gardien", "Ailier", "Centre", "Défenseur"];

  useEffect(() => {
    save({ team_needs: { positions_needed: rows, notes } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, notes]);

  const addRow = () => {
    if (rows.length < 10) setRows([...rows, { position: "", count: 1, priority: "Moyenne" }]);
  };

  const updateRow = (i: number, key: string, val: string | number) => {
    setRows(rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  };

  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Des postes à combler cette saison?</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Dis-nous quels postes tu dois remplir — on t&apos;enverra des suggestions.</p>
      </div>

      {/* Position rows */}
      {rows.map((row, i) => (
        <div key={i} className="flex items-end gap-2 bg-[#111317] border border-white/10 rounded-lg p-3">
          <div className="flex-1">
            <label className={`${label} text-[#9CA3AF] mb-1 block`}>Position</label>
            <select value={row.position} onChange={(e) => updateRow(i, "position", e.target.value)} className={`${inputClass} appearance-none text-xs`}>
              <option value="">Sélectionner</option>
              {positionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="w-16">
            <label className={`${label} text-[#9CA3AF] mb-1 block`}>Nb</label>
            <input type="number" min="1" max="5" value={row.count} onChange={(e) => updateRow(i, "count", parseInt(e.target.value) || 1)} className={`${inputClass} text-xs text-center`} />
          </div>
          <div className="w-28">
            <label className={`${label} text-[#9CA3AF] mb-1 block`}>Priorité</label>
            <div className="flex gap-1">
              {["Haute", "Moyenne", "Basse"].map((p) => {
                const colors: Record<string, string> = { Haute: "#EF4444", Moyenne: "#EAB308", Basse: "#6B7280" };
                return (
                  <button key={p} type="button" onClick={() => updateRow(i, "priority", p)} className={`flex-1 h-8 rounded text-[8px] font-bold uppercase transition-colors ${row.priority === p ? `text-white` : "text-[#6B7280] bg-transparent"}`} style={row.priority === p ? { backgroundColor: `${colors[p]}20`, color: colors[p], border: `1px solid ${colors[p]}40` } : { border: "1px solid rgba(255,255,255,0.05)" }}>
                    {p[0]}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" onClick={() => removeRow(i)} className="h-11 w-8 flex items-center justify-center text-[#6B7280] hover:text-[#EF4444] transition-colors">
            &times;
          </button>
        </div>
      ))}

      {rows.length < 10 && (
        <button type="button" onClick={addRow} className="text-xs text-[#E63946] hover:text-white transition-colors font-bold flex items-center gap-1">
          <span className="text-lg leading-none">+</span> Ajouter un poste
        </button>
      )}

      {/* Notes */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Notes internes</label>
        <textarea rows={3} placeholder="Ex: Besoin urgent d&apos;un QB pour remplacer notre finissant. Budget de bourse disponible." value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} h-auto py-3 resize-none`} />
      </div>

      <button type="button" onClick={() => {}} className="text-xs text-[#6B7280] hover:text-white transition-colors underline">
        Passer cette étape
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEAGUE DATA + SHARED COMPONENTS
═══════════════════════════════════════════════════════════════ */

const LEAGUE_LEVELS = ["AAA", "AA", "A", "Club", "Civil"];
const TEAM_CATEGORIES = ["U15", "U16", "U17", "U18", "Juvénile", "Cadet", "Midget", "Senior", "Autre"];

/* ── League search + select (shared by coach + coordinator) ──
   Phase 6.2: civil leagues now live in the unified `schools` table
   with type='LIGUE_CIVILE'. There is no sport_id on schools — a
   civil league school can host teams across multiple sports through
   the teams table. */
type CivilLeagueRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
};

function LeagueSelectStep({ user, save, onRequestNew }: {
  user: NexusUser;
  save: (u: Partial<NexusUser>) => void;
  onRequestNew: () => void;
}) {
  const [leagues, setLeagues] = useState<CivilLeagueRow[]>([]);
  const [selected, setSelected] = useState<CivilLeagueRow | null>(null);
  const [loadingLeagues, setLoadingLeagues] = useState(true);

  // Load civil leagues from Supabase on mount.
  //
  // Filter on type='LIGUE_CIVILE' (unified schools table) so this
  // list never surfaces school-side RSEQ leagues to a civil-coach
  // onboardee. Sport is no longer an attribute of the league — it's
  // captured at the team level.
  useEffect(() => {
    async function loadLeagues() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, city, region")
        .eq("type", "LIGUE_CIVILE")
        .order("name");
      if (data) {
        const mapped: CivilLeagueRow[] = data.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: r.id as string,
            name: r.name as string,
            city: (r.city as string) ?? null,
            region: (r.region as string) ?? null,
          };
        });
        setLeagues(mapped);
      }
      setLoadingLeagues(false);
    }
    loadLeagues();
  }, []);

  // Restore selection from user.institution if available
  useEffect(() => {
    if (leagues.length > 0 && user.institution) {
      const inst = user.institution as Record<string, unknown>;
      const match = leagues.find((l) => l.id === inst?.id || l.name === inst?.name);
      if (match) setSelected(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagues]);

  useEffect(() => {
    if (selected) {
      // Phase 6.2: a "league" is now just a schools row with
      // type='LIGUE_CIVILE'. No sport on the institution — sport is
      // captured per team.
      save({
        institution: {
          id: selected.id,
          name: selected.name,
          city: selected.city,
          region: selected.region,
          type: "ligue_civile",
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <>
      {loadingLeagues ? (
        <div className="text-center py-4 text-sm text-[#6B7280]">Chargement des ligues...</div>
      ) : leagues.length === 0 ? (
        <div className="text-center py-4 space-y-2">
          <p className="text-sm text-[#6B7280]">Aucune ligue trouvée dans la base de données.</p>
          <button type="button" onClick={onRequestNew} className="text-xs text-[#E63946] hover:text-white transition-colors underline">
            Créer une nouvelle ligue
          </button>
        </div>
      ) : (
        <SearchableDropdown
          items={leagues}
          value={selected?.name || ""}
          onChange={(item) => setSelected(item)}
          placeholder="Rechercher ta ligue ou ton club..."
          renderItem={(item) => (
            <div>
              <p className="font-bold">{item.name}</p>
              {cityRegion(item.city, item.region, " — ") && (
                <p className="text-[10px] text-[#6B7280]">{cityRegion(item.city, item.region, " — ")}</p>
              )}
            </div>
          )}
        />
      )}

      {selected && (
        <div className="bg-[#111317] border border-white/10 rounded-lg p-5 space-y-3">
          <h3 className="font-head font-black text-lg text-white">{selected.name}</h3>
          {cityRegion(selected.city, selected.region) && (
            <p className="text-xs text-[#9CA3AF]">{cityRegion(selected.city, selected.region)}</p>
          )}
          <p className="text-xs text-[#22C55E] font-bold flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            C&apos;est ma ligue
          </p>
        </div>
      )}

      {!selected && !loadingLeagues && leagues.length > 0 && (
        <button type="button" onClick={onRequestNew} className="text-xs text-[#9CA3AF] hover:text-white transition-colors underline">
          Ma ligue n&apos;est pas dans la liste
        </button>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEAGUE COACH ONBOARDING (3 steps)
═══════════════════════════════════════════════════════════════ */
function LeagueCoachStep({ step, user, save }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  const p = (user.profile || {}) as Record<string, unknown>;
  if (step === 0) return <CoachProfile profile={p} save={save} />;
  if (step === 1) return <LeagueCoachLeagueStep user={user} save={save} />;
  if (step === 2) return <DirectorChoiceStep user={user} save={save} type="league" />;
  return <CoachConfirmation user={user} />;
}

function LeagueCoachLeagueStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  // Read fresh localStorage to pick up profile updates from step 0 —
  // the wizard's save() helper writes localStorage but never calls
  // setUser, so `user` from props is stale (see the comment at :355).
  const raw = typeof window !== "undefined" ? localStorage.getItem("nexus_user") : null;
  const localUser = raw ? (JSON.parse(raw) as NexusUser) : user;
  const profileData = (localUser.profile || {}) as Record<string, unknown>;
  const sportName = (profileData.sport_principal as string) || "";

  const [sportId, setSportId] = useState<string | null>(null);
  const [sportLoading, setSportLoading] = useState(true);
  // Working sport — single source of truth shared by ALL three
  // consumers (team search, umbrella, create form). Seeded once from
  // the Profil-resolved sportId; the in-step <select> writes back
  // here via onSportChange so changing it scopes EVERYTHING (team
  // results + umbrella's teams-under-this-club + the sport_id a new
  // team is created with). Lifting state to the parent closes the
  // old propagation gap where a local-to-search selector reached
  // only the team query, leaving the umbrella + create stuck on the
  // Profil sportId. Never written back to users.sport /
  // sport_principal — finish() still reads the declared sport.
  const [workingSportId, setWorkingSportId] = useState<string>("");
  // Create flow is two sub-steps after the merged search: umbrella →
  // create. The merged team+club search (mode='search') already
  // surfaces matching clubs alongside matching teams — picking a club
  // routes straight to umbrella (existing teams under that club) with
  // an inline create CTA when the coach's team isn't listed. Locked
  // club id/name flow into both umbrella (as query scope) and
  // TeamCreateForm (as locked props).
  const [mode, setMode] = useState<"search" | "umbrella" | "create">("search");
  const [lockedSchoolId, setLockedSchoolId] = useState<string | null>(null);
  const [lockedSchoolName, setLockedSchoolName] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<TeamSearchRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the sport NAME from step 0 to its uuid for downstream
  // team/league queries. step 0 saves users.sport as a name string,
  // not an id, so the lookup happens here.
  useEffect(() => {
    if (!sportName) {
      setSportLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .from("sports")
      .select("id")
      .eq("nom", sportName)
      .maybeSingle()
      .then(({ data }) => {
        setSportId((data?.id as string) ?? null);
        setSportLoading(false);
      });
  }, [sportName]);

  // Seed workingSportId once when the Profil resolution lands. After
  // that, the selector takes over — re-running this effect on
  // sportId change would clobber the coach's choice if they switched
  // mid-flow and then back-navigated. Gate on workingSportId being
  // empty so the seed fires exactly once per mount.
  useEffect(() => {
    if (sportId && !workingSportId) {
      setWorkingSportId(sportId);
    }
  }, [sportId, workingSportId]);

  // Resume support: if the user already picked/created a team in a
  // previous session and is back at step 1 (e.g. via Précédent),
  // surface the prior choice as the selected card.
  useEffect(() => {
    if (selectedTeam) return;
    // Phase 6.2: profile.team replaces profile.league_team and the
    // anchor is now profile.school_id (LIGUE_CIVILE schools row id).
    // Fall back to the legacy key for any in-flight sessions.
    const teamData = (profileData.team ?? profileData.league_team) as Record<string, unknown> | undefined;
    if (!teamData?.id) return;
    setSelectedTeam({
      id: teamData.id as string,
      name: (teamData.name as string) ?? "",
      age_group: (teamData.age_group as string) ?? null,
      gender: (teamData.gender as string) ?? null,
      division: (teamData.category as string) ?? null,
      league: (teamData.league as string) ?? null,
      school_id: ((profileData.school_id ?? profileData.league_id) as string) ?? "",
      school_name:
        ((localUser.institution as Record<string, unknown> | null)?.name as string) ?? "",
      coach_count: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Thin civil-flow wrapper around the module-level joinExistingTeam +
  // persistTeamLocally helpers. The INSERT pair (school_coaches role=COACH
  // + team_coaches role=assistant, 23505 tolerated) is identical to the
  // pre-lift behavior. Only the local component state (submitting/error/
  // selected) and the civil-specific institution promotion (LIGUE_CIVILE
  // pseudo-school) stay here.
  async function handleJoinExistingTeam(team: TeamSearchRow) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await joinExistingTeam(team);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Phase 6.2: institution is now a LIGUE_CIVILE schools row.
      // Promoted via save() so the wizard's localUserVersion ticks.
      save({
        institution: { id: team.school_id, name: team.school_name, type: "ligue_civile" },
      });
      persistTeamLocally({
        teamId: team.id,
        teamName: team.name,
        ageGroup: team.age_group,
        gender: team.gender,
        category: team.division,
        season: getCurrentSeason(),
        schoolId: team.school_id,
        schoolName: team.school_name,
      });
      setSelectedTeam(team);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateTeam(formData: TeamFormData) {
    // Working sport drives the new team's sport_id — closes the
    // propagation gap where the create INSERT used the Profil-
    // resolved sportId even when the coach had switched the in-step
    // selector to a different sport.
    const effectiveSportId = workingSportId || sportId;
    if (!effectiveSportId) {
      setError("Sport non résolu. Reviens à l'étape 1.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError("Session expirée. Reconnecte-toi pour continuer.");
        return;
      }

      // 1. Find or create the league (a schools row with
      //    type='LIGUE_CIVILE'). Reuse the existing id if the
      //    autocomplete already snapped to one.
      let schoolId = formData.league_id_if_existing;
      let schoolName = formData.league_input;
      if (!schoolId) {
        const result = await findOrCreateSchool(
          supabase,
          formData.league_input,
          "LIGUE_CIVILE",
        );
        schoolId = result.id;
        schoolName = result.name;
      }

      // 1.b — Sync users.school_id BEFORE the teams INSERT.
      //
      // RLS "Coaches create teams" requires
      //   school_id IN (SELECT users.school_id WHERE id=auth.uid())
      // For école coaches users.school_id was already set in step 1
      // save (cf. :458-461). Civil coaches don't go through that path
      // — their school_id is determined here, at team creation time.
      // Without this UPDATE, the next INSERT into `teams` would fail
      // RLS silently (pre-existing oeuf-poule discovered in 6.2.a
      // manual tests).
      const { error: userUpdateError } = await supabase
        .from("users")
        .update({ school_id: schoolId })
        .eq("id", authUser.id);
      if (userUpdateError) {
        console.error("[LeagueCoachLeagueStep] users.school_id sync failed:", userUpdateError);
        setError("Impossible de finaliser l'inscription. Réessaie.");
        return;
      }

      // 2. INSERT the team row. Phase 6.2: teams.school_id replaces
      //    league_teams.league_id. teams.division IS a real column
      //    (text, nullable) — the form collects it from the locked
      //    civilVocab list (with an "Autre" free-text fallback that's
      //    substituted upstream in TeamCreateForm). DIRECTEUR ownership
      //    is captured via school_coaches.role per D5, separate path.
      const { data: newTeam, error: ltError } = await supabase
        .from("teams")
        .insert({
          school_id: schoolId,
          name: formData.team_name,
          age_group: formData.age_group,
          division: formData.division,
          gender: formData.gender,
          season: formData.season,
          sport_id: effectiveSportId,
        })
        .select()
        .single();

      if (ltError || !newTeam) {
        console.error("[LeagueCoachLeagueStep] create team failed:", ltError);
        setError("Impossible de créer l'équipe. Réessaie.");
        return;
      }

      // 3. INSERT school_coaches (institution level, role='COACH').
      //    Sprint cards-restructure-web : plus jamais DIRECTEUR direct ici
      //    (l'auto-promotion est fermée — le claim DIRECTEUR/INTERIM passe
      //    par admin_claims modéré via la RPC finish_coach_civil_onboarding
      //    appelée au finish()). L'UPSERT à finish() est idempotent.
      const { error: scError } = await supabase.from("school_coaches").insert({
        coach_id: authUser.id,
        school_id: schoolId,
        role: "COACH",
      });
      if (scError && scError.code !== "23505") {
        // Non-critical for proceeding; the team exists and the
        // creator can be re-attached manually. Log but continue.
        console.error("[LeagueCoachLeagueStep] school_coaches insert failed:", scError);
      }

      const { error: tcError } = await supabase.from("team_coaches").insert({
        coach_id: authUser.id,
        team_id: newTeam.id,
        role: "head_coach",
      });
      if (tcError) {
        console.error("[LeagueCoachLeagueStep] team_coaches insert failed:", tcError);
      }

      // Phase 6.2: institution is now a LIGUE_CIVILE schools row.
      // Promoted via save() so the wizard's localUserVersion ticks
      // (matches the pre-lift behavior, when persistTeamLocally did
      // the institution write internally).
      save({
        institution: { id: schoolId, name: schoolName, type: "ligue_civile" },
      });
      persistTeamLocally({
        teamId: newTeam.id,
        teamName: formData.team_name,
        ageGroup: formData.age_group,
        gender: formData.gender,
        category: null,
        season: formData.season,
        schoolId,
        schoolName,
      });

      setSelectedTeam({
        id: newTeam.id,
        name: formData.team_name,
        age_group: formData.age_group,
        gender: formData.gender,
        division: formData.division,
        league: null,
        school_id: schoolId,
        school_name: schoolName,
        coach_count: 1,
      });
      setMode("search");
    } catch (err) {
      console.error("[LeagueCoachLeagueStep] create exception:", err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sportLoading) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-[#6B7280]">Chargement...</p>
      </div>
    );
  }

  if (!sportId) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-[#EF4444]">
          Erreur: ton sport principal n&apos;a pas été reconnu. Reviens à l&apos;étape précédente
          et sélectionne un sport.
        </p>
      </div>
    );
  }

  const heading: Record<typeof mode, { title: string; subtitle: string }> = {
    search:    { title: "Trouve ton équipe", subtitle: "Cherche ton équipe ou ton club. Joins une équipe existante ou crée la tienne sous un club connu." },
    umbrella:  { title: "Équipes existantes", subtitle: "Voici les équipes déjà inscrites sous ce club. Si la tienne y figure, joins-la. Sinon, crée-la." },
    create:    { title: "Crée ta nouvelle équipe", subtitle: "Remplis les détails — la nouvelle équipe sera rattachée au club choisi." },
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">{heading[mode].title}</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">{heading[mode].subtitle}</p>
      </div>

      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3">
          <p className="text-[12px] text-[#EF4444]">{error}</p>
        </div>
      )}

      {mode === "search" && (
        <TeamSearchOrCreate
          sportId={workingSportId || sportId}
          onSportChange={setWorkingSportId}
          selectedTeam={selectedTeam}
          onSelect={handleJoinExistingTeam}
          onSelectClub={(id, name) => {
            // Club picked from the merged search results → lock and
            // jump straight to the umbrella. Reuses the existing
            // umbrella + locked-create path entirely.
            setLockedSchoolId(id);
            setLockedSchoolName(name);
            setError(null);
            setMode("umbrella");
          }}
          onCreate={() => {
            // Empty-state "Crée ta nouvelle équipe" — no team and no
            // club matched. Lock the typed search input as the new
            // club's name (no id yet) and skip straight to create.
            // handleCreateTeam will findOrCreateSchool() on submit.
            // Falls back to empty name if the search input is empty,
            // in which case TeamCreateForm's required-field gating
            // will catch it.
            setLockedSchoolId(null);
            setLockedSchoolName("");
            setError(null);
            setMode("create");
          }}
        />
      )}

      {mode === "umbrella" && lockedSchoolId && (
        <UmbrellaStep
          schoolId={lockedSchoolId}
          schoolName={lockedSchoolName}
          sportId={workingSportId || sportId}
          onSelect={handleJoinExistingTeam}
          onCreate={() => {
            setError(null);
            setMode("create");
          }}
          onBack={() => {
            // Back from the umbrella returns to the merged search.
            // The locked club state stays around so we can still
            // route back into umbrella if the coach picks the same
            // club again — but it's not consulted by mode='search'.
            setError(null);
            setMode("search");
          }}
        />
      )}

      {mode === "create" && (
        <TeamCreateForm
          sportId={workingSportId || sportId}
          sportName={sportName}
          onSubmit={handleCreateTeam}
          onCancel={() => {
            setError(null);
            // From an existing-club lock, back goes to umbrella;
            // from a name-only / empty-state lock there's no
            // umbrella to return to, so back goes to search.
            setMode(lockedSchoolId ? "umbrella" : "search");
          }}
          lockedSchoolId={lockedSchoolId ?? undefined}
          lockedSchoolName={lockedSchoolName || undefined}
        />
      )}

      {submitting && <p className="text-[12px] text-[#9CA3AF]">Enregistrement en cours...</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UMBRELLA STEP — destination for both an existing-team join and
   a locked-club create. Reached either from a TEAM card pick in
   the merged search (which goes through handleJoinExistingTeam
   directly, not through here) or from a CLUB card pick in the
   merged search (locked id+name flow into this component).

   Renders existing teams under the locked club for the chosen
   sport, deduped by (name, age_group, division, gender). The
   encouraged path : if the coach's team is here, they join it
   via the same handleJoinExistingTeam used by the cross-club
   search. Only if their team isn't listed do they fall through
   to the create form.

   RLS : "Civil league teams are publicly discoverable" allows
   authenticated users to SELECT teams where the parent school
   has type='LIGUE_CIVILE'. No coupling to current_user_school_id.

   Empty schoolId (the "no team and no club matched" name-only
   path) skips
   the query entirely — the umbrella renders the empty state with
   the "pas dans la liste" CTA leading straight to create.
═══════════════════════════════════════════════════════════════ */
function UmbrellaStep({
  schoolId,
  schoolName,
  sportId,
  onSelect,
  onCreate,
  onBack,
  emptyMessage,
  scopeLabel = "Club",
  showBack = true,
  cardCtaText = "C'est mon équipe →",
  selectedTeamId,
}: {
  schoolId: string;
  schoolName: string;
  // Empty string disables sport filtering — the recruiter Programme
  // step passes "" to surface every team at the CÉGEP regardless of
  // sport (a recruiter spans all sports). Coach flows always pass a
  // real sport_id.
  sportId: string;
  onSelect: (team: TeamSearchRow) => void;
  // Optional — when absent, the "Mon équipe n'est pas dans la liste"
  // create CTA row is hidden. School-coach flow uses this to disable
  // ad-hoc team creation (school coaches only join existing teams).
  onCreate?: () => void;
  onBack?: () => void;
  // Custom empty-state copy. Defaults to the civil flow's wording.
  emptyMessage?: string;
  // Override the "Club: <name>" header label (school flow says "École").
  scopeLabel?: string;
  // Hide the back link entirely (school-coach flow is a single step).
  showBack?: boolean;
  // Card footer CTA — coach contexts use "C'est mon équipe →"
  // (tutoiement), recruiter Programme uses "Sélectionner →".
  cardCtaText?: string;
  // When set, the matching card is highlighted as currently selected.
  // Used by the recruiter Programme step (selection stays visible
  // without dismissing the grid). Coach flows leave this undefined.
  selectedTeamId?: string | null;
}) {
  const [teams, setTeams] = useState<TeamSearchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) {
      setTeams([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      // sportId === "" means "any sport at this school" — the recruiter
      // Programme step uses this to surface every team at the CÉGEP
      // regardless of sport. Coach flows always pass a real sport_id.
      let query = supabase
        .from("teams")
        .select("id, name, age_group, gender, division, league, school_id, team_coaches(coach_id)")
        .eq("school_id", schoolId);
      if (sportId) {
        query = query.eq("sport_id", sportId);
      }
      const { data, error: queryError } = await query.order("name");
      if (cancelled) return;
      if (queryError) {
        console.error("[UmbrellaStep] teams fetch failed:", queryError);
        setTeams([]);
        setLoading(false);
        return;
      }
      // Dedup by (name, age_group, division, gender) — same team
      // across multiple seasons collapses to one card. Keep the
      // first occurrence (alphabetical from ORDER BY).
      const seen = new Set<string>();
      const deduped: TeamSearchRow[] = [];
      for (const r of (data ?? []) as Array<{
        id: string; name: string; age_group: string | null; gender: string | null;
        division: string | null; league: string | null; school_id: string;
        team_coaches: { coach_id: string }[] | null;
      }>) {
        const key = `${r.name}${r.age_group ?? ""}${r.division ?? ""}${r.gender ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push({
          id: r.id,
          name: r.name,
          age_group: r.age_group,
          gender: r.gender,
          division: r.division,
          league: r.league,
          school_id: r.school_id,
          school_name: schoolName,
          coach_count: r.team_coaches?.length ?? 0,
        });
      }
      setTeams(deduped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [schoolId, sportId, schoolName]);

  return (
    <div className="space-y-3">
      <div className="bg-[#111317]/60 border border-white/[0.06] rounded-lg p-3 text-[12px] text-[#9CA3AF]">
        {scopeLabel} : <span className="text-white font-bold">{schoolName}</span>
      </div>

      {loading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="bg-[#111317] border border-white/5 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-2/3 mb-2" />
              <div className="h-3 bg-white/5 rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && teams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {teams.map((team) => {
            const genderText = team.gender ? genderLabel(team.gender) : null;
            const isSelected = selectedTeamId === team.id;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => onSelect(team)}
                className={`text-left bg-[#111317] border rounded-lg p-4 transition-colors ${
                  isSelected
                    ? "border-[#E63946]"
                    : "border-white/10 hover:border-[#E63946]/40"
                }`}
              >
                <p className="font-bold text-white text-sm truncate">{team.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {team.division && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/70 uppercase border border-white/10">
                      {team.division}
                    </span>
                  )}
                  {team.age_group && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/70 uppercase border border-white/10">
                      {team.age_group}
                    </span>
                  )}
                  {genderText && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/70 uppercase border border-white/10">
                      {genderText}
                    </span>
                  )}
                </div>
                {team.league && (
                  <p className="text-[11px] text-[#9CA3AF] mt-2 truncate">{team.league}</p>
                )}
                <p className="text-[11px] text-[#22C55E] font-bold mt-3">
                  {isSelected ? "✓ Sélectionné" : cardCtaText}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {!loading && teams.length === 0 && (
        <div className="bg-[#111317] border border-white/5 rounded-lg p-4 text-[12px] text-[#9CA3AF]">
          {emptyMessage ?? "Aucune équipe n'est inscrite sous ce club pour ce sport."}
        </div>
      )}

      {onCreate && (
        <div className="bg-[#111317] border border-white/5 rounded-lg p-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-white font-bold">Mon équipe n&apos;est pas dans la liste</p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              Crée ta nouvelle équipe — elle sera rattachée à ce club.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="shrink-0 h-10 px-4 rounded-lg bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold transition-colors"
          >
            Créer une équipe
          </button>
        </div>
      )}

      {showBack && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-3 text-[12px] text-[#9CA3AF] hover:text-white transition-colors"
        >
          ← Retour à la recherche
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEAGUE COORDINATOR ONBOARDING (3 steps)
═══════════════════════════════════════════════════════════════ */
function LeagueCoordinatorStep({ step, user, save, onFinish }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  if (step === 0) return <DirectorProfile user={user} save={save} subtitle="En tant que coordonnateur, tu supervises les entraîneurs et les athlètes de ta ligue." />;
  if (step === 1) return <CoordinatorLeagueStep user={user} save={save} />;
  return <InviteStep role="coach" onFinish={onFinish} />;
}

function CoordinatorLeagueStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const [mode, setMode] = useState<"existing" | "create" | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [newGender, setNewGender] = useState("");

  const handleCreate = () => {
    save({
      institution: {
        name: newName, sport: newSport, city: newCity, region: newRegion,
        level: newLevel, website: newWebsite, categories: newCategories,
        gender: newGender, type: "ligue_civile", created_by_coordinator: true,
      },
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Configure ta ligue ou ton club</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Associe-toi à une ligue existante ou crée la tienne.</p>
      </div>

      {/* Two option cards */}
      {!mode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => setMode("existing")} className="flex flex-col items-center gap-3 p-6 rounded-xl border border-white/10 hover:border-[#E63946]/30 transition-all text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <span className="font-head font-black text-xs text-white uppercase tracking-wider">Ma ligue existe déjà</span>
            <span className="text-[9px] text-[#6B7280]">Recherche et réclame ta ligue</span>
          </button>
          <button type="button" onClick={() => setMode("create")} className="flex flex-col items-center gap-3 p-6 rounded-xl border border-white/10 hover:border-[#E63946]/30 transition-all text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span className="font-head font-black text-xs text-white uppercase tracking-wider">Créer ma ligue</span>
            <span className="text-[9px] text-[#6B7280]">Configure une nouvelle organisation</span>
          </button>
        </div>
      )}

      {/* Existing league search */}
      {mode === "existing" && (
        <div className="space-y-4 animate-fade-slide-down">
          <button type="button" onClick={() => setMode(null)} className="text-xs text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Retour
          </button>
          <LeagueSelectStep user={user} save={save} onRequestNew={() => setMode("create")} />
          {/* Ownership notice */}
          {!!(user.institution as Record<string, unknown>)?.name && (
            <div className="bg-[#111317] border-l-4 border-[#DAB65A] rounded-r-lg p-4 flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#DAB65A" stroke="none" className="mt-0.5 shrink-0">
                <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" />
                <circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" />
              </svg>
              <p className="text-sm text-[#DAB65A] font-bold">Tu seras le coordonnateur principal de cette ligue</p>
            </div>
          )}
        </div>
      )}

      {/* Create new league */}
      {mode === "create" && (
        <div className="space-y-4 animate-fade-slide-down">
          <button type="button" onClick={() => setMode(null)} className="text-xs text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Retour
          </button>

          <input type="text" placeholder="Nom de la ligue / du club" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />

          <div>
            <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Sport principal</label>
            <select title="Sport principal" value={newSport} onChange={(e) => setNewSport(e.target.value)} className={`${inputClass} appearance-none`}>
              <option value="">Sélectionner...</option>
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Ville" value={newCity} onChange={(e) => setNewCity(e.target.value)} className={inputClass} />
            <select title="Région" value={newRegion} onChange={(e) => setNewRegion(e.target.value)} className={`${inputClass} appearance-none`}>
              <option value="">Région</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Niveau principal</label>
            <div className="flex flex-wrap gap-2">
              {LEAGUE_LEVELS.map((l) => (
                <button key={l} type="button" onClick={() => setNewLevel(l)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${newLevel === l ? "bg-[rgba(230,57,70,0.1)] border border-[#E63946] text-white" : "bg-[#1A1D24] border border-white/10 text-[#9CA3AF] hover:border-white/20"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <input type="url" placeholder="Site web (optionnel)" value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} className={inputClass} />

          <div>
            <label className={`${label} text-[#9CA3AF] mb-2 block`}>Catégories offertes</label>
            <div className="flex flex-wrap gap-2">
              {TEAM_CATEGORIES.filter((c) => c !== "Autre").map((cat) => {
                const isOn = newCategories.includes(cat);
                return (
                  <button key={cat} type="button" onClick={() => setNewCategories(isOn ? newCategories.filter((c) => c !== cat) : [...newCategories, cat])} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isOn ? "bg-[rgba(230,57,70,0.1)] border border-[#E63946] text-white" : "bg-[#1A1D24] border border-white/10 text-[#9CA3AF] hover:border-white/20"}`}>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Genre</label>
            <div className="flex gap-2">
              {["Masculin", "Féminin", "Les deux"].map((g) => (
                <button key={g} type="button" onClick={() => setNewGender(g)} className={`flex-1 h-11 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${newGender === g ? "bg-[rgba(230,57,70,0.1)] border border-[#E63946] text-white" : "bg-[#111317] border border-white/10 text-[#9CA3AF] hover:border-white/20"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <button type="button" disabled={!newName || !newSport} onClick={handleCreate} className="w-full h-11 rounded-lg bg-[#E63946] text-sm font-bold text-white hover:bg-[#D42B22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Créer ma ligue
          </button>

          {!!(user.institution as Record<string, unknown>)?.created_by_coordinator && (
            <div className="bg-[#111317] border-l-4 border-[#22C55E] rounded-r-lg p-4 flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              <p className="text-xs text-[#22C55E] font-bold">Ligue créée! Continue pour inviter tes entraîneurs.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
