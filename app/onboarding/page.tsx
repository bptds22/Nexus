"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import { createClient } from "@/lib/supabase/client";
import PlaybookBackground from "../components/PlaybookBackground";
import TeamSearchOrCreate, { type TeamSearchRow } from "@/components/onboarding/TeamSearchOrCreate";
import TeamCreateForm, { type TeamFormData } from "@/components/onboarding/TeamCreateForm";
import { findOrCreateLeague } from "@/lib/onboarding/findOrCreateLeague";

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
const MOCK_SCHOOLS = [
  { name: "De Mortagne", city: "Boucherville", region: "Montérégie", conference: "Sud-Ouest", sports: ["Football", "Basketball", "Soccer"] },
  { name: "Saint-Jean-Eudes", city: "Québec", region: "Québec", conference: "Nord-Est", sports: ["Football", "Hockey", "Soccer"] },
  { name: "De Rochebelle", city: "Québec", region: "Québec", conference: "Nord-Est", sports: ["Football", "Basketball", "Volleyball"] },
  { name: "Roger-Comtois", city: "Québec", region: "Québec", conference: "Nord-Est", sports: ["Football", "Basketball"] },
  { name: "Mont-Royal", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", sports: ["Football", "Soccer", "Basketball"] },
  { name: "Académie les Estacades", city: "Trois-Rivières", region: "Mauricie", conference: "Nord-Est", sports: ["Football", "Hockey"] },
  { name: "Armand-Corbeil", city: "Terrebonne", region: "Lanaudière", conference: "Sud-Ouest", sports: ["Football", "Soccer"] },
  { name: "L’Odyssée", city: "Chicoutimi", region: "Saguenay-Lac-Saint-Jean", conference: "Nord-Est", sports: ["Football", "Volleyball"] },
  { name: "Le Sommet", city: "Québec", region: "Québec", conference: "Nord-Est", sports: ["Basketball", "Volleyball"] },
  { name: "Louis-Riel", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", sports: ["Football", "Soccer", "Basketball"] },
  { name: "Curé-Antoine-Labelle", city: "Laval", region: "Laval", conference: "Sud-Ouest", sports: ["Football", "Soccer"] },
  { name: "Saint-Joseph", city: "Saint-Hyacinthe", region: "Montérégie", conference: "Sud-Ouest", sports: ["Football", "Basketball"] },
  { name: "Thérèse-Martin", city: "Joliette", region: "Lanaudière", conference: "Sud-Ouest", sports: ["Football", "Hockey"] },
  { name: "Le Tremplin", city: "Drummondville", region: "Centre-du-Québec", conference: "Nord-Est", sports: ["Hockey", "Volleyball"] },
  { name: "Pierre-Laporte", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", sports: ["Football", "Basketball", "Natation"] },
];
const MOCK_CEGEPS = [
  { name: "Garneau", city: "Québec", region: "Québec", conference: "Nord-Est", type: "Public", programs: ["Sciences nature", "Sciences humaines", "Informatique"], sports: [{ sport: "Football", division: "D1", gender: "Masculin" }, { sport: "Basketball", division: "D2", gender: "Les deux" }] },
  { name: "Sainte-Foy", city: "Québec", region: "Québec", conference: "Nord-Est", type: "Public", programs: ["Sciences nature", "Administration"], sports: [{ sport: "Football", division: "D1", gender: "Masculin" }] },
  { name: "Limoilou", city: "Québec", region: "Québec", conference: "Nord-Est", type: "Public", programs: ["Arts", "Sciences humaines"], sports: [{ sport: "Soccer", division: "D2", gender: "Les deux" }] },
  { name: "Vieux-Montréal", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", type: "Public", programs: ["Sciences nature", "Techniques"], sports: [{ sport: "Football", division: "D1", gender: "Masculin" }] },
  { name: "André-Laurendeau", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", type: "Public", programs: ["Sciences humaines", "Informatique"], sports: [{ sport: "Football", division: "D2", gender: "Masculin" }] },
  { name: "Édouard-Montpetit", city: "Longueuil", region: "Montérégie", conference: "Sud-Ouest", type: "Public", programs: ["Sciences nature", "Administration"], sports: [{ sport: "Football", division: "D1", gender: "Masculin" }, { sport: "Hockey", division: "D1", gender: "Masculin" }] },
  { name: "Sherbrooke", city: "Sherbrooke", region: "Estrie", conference: "Nord-Est", type: "Public", programs: ["Sciences nature", "Sciences humaines", "Arts"], sports: [{ sport: "Football", division: "D2", gender: "Masculin" }] },
  { name: "Jonquière", city: "Saguenay", region: "Saguenay-Lac-Saint-Jean", conference: "Nord-Est", type: "Public", programs: ["Sciences humaines", "Techniques"], sports: [{ sport: "Football", division: "D3", gender: "Masculin" }] },
  { name: "Lévis", city: "Lévis", region: "Chaudière-Appalaches", conference: "Nord-Est", type: "Public", programs: ["Sciences nature", "Administration"], sports: [{ sport: "Football", division: "D2", gender: "Masculin" }] },
  { name: "Saint-Laurent", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", type: "Public", programs: ["Sciences humaines", "Arts"], sports: [{ sport: "Soccer", division: "D1", gender: "Les deux" }] },
  { name: "Bois-de-Boulogne", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", type: "Public", programs: ["Sciences nature", "Informatique"], sports: [{ sport: "Basketball", division: "D1", gender: "Les deux" }] },
  { name: "Champlain-Lennoxville", city: "Sherbrooke", region: "Estrie", conference: "Nord-Est", type: "Public", programs: ["Sciences nature", "Sciences humaines"], sports: [{ sport: "Football", division: "D3", gender: "Masculin" }] },
];
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
  school_admin_type?: "owner" | "collaborator" | null;
  // CÉGEP admin fields (reuses is_school_admin — role infers school vs CÉGEP)
  is_also_recruiter?: boolean;
  cegep_admin_type?: "owner" | "collaborator" | null;
  // Shared
  pending_director_invite?: Record<string, unknown> | null;
  subscription?: Record<string, unknown>;
  tier?: string;
  referral_code?: string | null;
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
  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())).slice(0, 15);

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

      let onboardingRole = roleMap[profile.role] || "coach";

      // Civil-league discriminator: the signup form at /auth/pro lets
      // the user pick "Ligue ou club sportif", which is persisted as
      // users.context = 'ligue_civile'. The DB role itself is COACH
      // (no COACH_LEAGUE enum value). Upgrade to the wizard's
      // coach_league branch only when both conditions hold — a
      // hypothetical recruiter or athlete with context='ligue_civile'
      // (data drift) must not be silently re-routed into a coach flow.
      if (onboardingRole === "coach" && profile.context === "ligue_civile") {
        onboardingRole = "coach_league";
      }

      const nexusUser: NexusUser = {
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        email: profile.email,
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
    coach: 4,           // profil, école, directeur, athlète
    coach_league: 4,    // profil, ligue, coordonnateur, athlète
    recruiter: 4,       // profil, cégep, directeur, critères
    coordinator_league: 3,
  };
  const totalSteps = totalStepsMap[user?.role ?? ""] || 3;
  const progress = ((step + 1) / totalSteps) * 100;

  const [stepSaving, setStepSaving] = useState(false);
  const [, setLocalUserVersion] = useState(0);

  function canProceed(): boolean {
    if (!user) return false;

    // Read latest localStorage state — user state object lags by design
    const raw = localStorage.getItem("nexus_user");
    const localUser = raw ? JSON.parse(raw) : {};
    const role = user.role;

    // Step 1 enforcement (institution selection)
    if (step === 1) {
      if (role === "coach" || role === "recruiter") {
        const inst = localUser.institution as Record<string, unknown> | null;
        if (!inst || !inst.name) return false;
      } else if (role === "coach_league") {
        // Civil coach must (a) select or create a league AND (b) have
        // an INSERTed league_team. profile.league_team_id is the
        // persistent signal — set in localStorage by
        // LeagueCoachLeagueStep only after both league_teams +
        // league_coaches INSERTs succeed (see :2007). Pre-5.4e this
        // branch was missing entirely, letting civil coaches finish
        // onboarding with no team / no league_coaches row, breaking
        // 5.3f (athlete-side picker) and the eventual team dashboard.
        const inst = localUser.institution as Record<string, unknown> | null;
        if (!inst || !inst.name) return false;
        const profile = localUser.profile as Record<string, unknown> | null;
        if (!profile?.league_team_id) return false;
      }
      // coordinator_league intentionally ungated — separate flow,
      // tracked in post-launch-bugs.md.
    }

    // Other steps currently have no validation rules
    return true;
  }

  const next = async () => {
    if (step >= totalSteps - 1) return;
    if (!canProceed()) {
      console.log("[Onboarding] cannot proceed: validation failed at step", step);
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
        // (role === 'coach_league') has a league as institution, not
        // a school, so this whole block is intentionally school-only.
        if (step === 1 && institution.name && role === "coach") {
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

        console.log("[Onboarding] step", step, "saved to Supabase for role:", role);
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
      setSlideDir("left");
      setStep((s) => s - 1);
    }
  };

  const finish = async () => {
    save({ onboarding_complete: true });
    setUser((prev) => prev ? { ...prev, onboarding_complete: true } : prev);

    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (authUser) {
      // Get the onboarding data from localStorage
      const raw = localStorage.getItem("nexus_user");
      const localUser = raw ? JSON.parse(raw) : {};

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
      const adminUpdates: Record<string, unknown> = {};
      if (localUser.is_school_admin === true) adminUpdates.is_school_admin = true;
      const profileData = {
        bio: localUser.profile?.bio || null,
        experience_years: localUser.profile?.experience_years || null,
        admin_type: localUser.school_admin_type || localUser.cegep_admin_type || null,
        pending_director_invite: localUser.pending_director_invite || null,
      };

      // Save profile data to users table
      await supabase
        .from("users")
        .update({
          onboarding_complete: true,
          first_name: localUser.firstName || user?.firstName,
          last_name: localUser.lastName || user?.lastName,
          phone: localUser.profile?.phone || null,
          ...adminUpdates,
          profile_data: profileData,
        })
        .eq("id", authUser.id);

      // Save school to users table if coach selected one
      if (localUser.institution?.name && user?.role === "coach") {
        const { data: school } = await supabase
          .from("schools")
          .select("id")
          .eq("name", localUser.institution.name)
          .maybeSingle();

        if (school) {
          await supabase.from("users").update({ school_id: school.id }).eq("id", authUser.id);
          // Also upsert school_coaches
          await supabase.from("school_coaches").upsert({
            coach_id: authUser.id,
            school_id: school.id,
            role: "COACH",
            sport: localUser.profile?.sport_principal || null,
          }, { onConflict: "coach_id,school_id" });
        }
      }

      // Save CÉGEP to users table for recruiter
      if (localUser.institution?.name && user?.role === "recruiter") {
        const { data: cegep } = await supabase
          .from("schools")
          .select("id")
          .eq("name", localUser.institution.name)
          .maybeSingle();

        if (cegep) {
          await supabase.from("users").update({ school_id: cegep.id }).eq("id", authUser.id);
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
    }

    setShowSuccess(true);
    const dashMap: Record<string, string> = {
      coach: "/coach/tableau-de-bord",
      recruiter: "/recruteur/tableau-de-bord",
      coach_league: "/coach/tableau-de-bord",
    };
    setTimeout(() => {
      router.push(dashMap[user?.role || "coach"] || "/");
    }, 1500);
  };

  if (!user) return null;

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
  const stepLabelsMap: Record<string, string[]> = {
    coach: ["Profil", "École", "Directeur", "Confirmation"],
    recruiter: ["Profil", "CÉGEP", "Directeur", "Critères"],
    coach_league: ["Profil", "Ligue", "Coach principal", "Confirmation"],
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

          {/* Step content with slide animation */}
          <div key={`${user.role}-${step}`} className={slideDir === "right" ? "animate-slide-right" : "animate-slide-left"}>
            {user.role === "coach" && <CoachStep step={step} user={user} save={save} onFinish={finish} />}
            {user.role === "recruiter" && <RecruiterStep step={step} user={user} save={save} onFinish={finish} />}
            {user.role === "coach_league" && <LeagueCoachStep step={step} user={user} save={save} onFinish={finish} />}
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
              <button type="button" onClick={finish} className="h-11 px-6 rounded-lg bg-[#E63946] text-sm font-bold text-white hover:bg-[#D42B22] transition-colors">
                Terminer et accéder à Nexus &rarr;
              </button>
            )}
          </div>
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
   COACH ONBOARDING STEPS
═══════════════════════════════════════════════════════════════ */
function CoachStep({ step, user, save }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  const p = (user.profile || {}) as Record<string, unknown>;

  if (step === 0) return <CoachProfile profile={p} save={save} />;
  if (step === 1) return <SchoolStep user={user} save={save} />;
  if (step === 2) return <DirectorChoiceStep user={user} save={save} type="school" />;
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

  const [choice, setChoice] = useState<"self" | "invite" | "interim" | "">("");
  const [selfEmail, setSelfEmail] = useState(user.email || "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");

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

      <div className={`grid grid-cols-1 gap-4 ${type === "school" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {/* Card 1: C'EST MOI */}
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

        {/* Card 2: INVITER */}
        <button
          type="button"
          onClick={() => setChoice("invite")}
          className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center ${
            choice === "invite"
              ? "border-[#E63946] bg-[rgba(230,57,70,0.08)]"
              : "border-white/10 hover:border-white/20"
          }`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${choice === "invite" ? "bg-[#E63946]/15" : "bg-[#1A1D24]"}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <span className="font-head font-black text-[13px] uppercase tracking-[0.1em] text-white">Inviter quelqu&apos;un</span>
          <span className="text-[11px] text-[#6B7280] leading-snug">J&apos;enverrai une invitation au {roleLabel}</span>
        </button>

        {/* Card 3: JE SERAI INTÉRIMAIRE — school coaches only */}
        {type === "school" && (
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
            <span className="text-[11px] text-[#6B7280] leading-snug">Aucun directeur sportif n&apos;est en place pour l&apos;instant — je vais assumer ce rôle temporairement</span>
          </button>
        )}
      </div>

      {/* C'EST MOI expanded */}
      {choice === "self" && (
        <div className="animate-fade-slide-down bg-[#111317]/60 rounded-xl p-5 border border-white/5">
          <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
            Tu seras {isCegep ? "Recruteur" : "Entraîneur"} ET {RoleLabel} de {orgName}. Tu pourras gérer les autres {isCegep ? "recruteurs" : isLeague ? "entraîneurs" : "coachs"}, voir les stats {isCegep ? "globales de recrutement" : "de recrutement"}, et superviser {isCegep ? "le pipeline de tout le CÉGEP" : "les profils athlètes"}.
          </p>
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

      {/* INTÉRIMAIRE expanded */}
      {choice === "interim" && type === "school" && (
        <div className="animate-fade-slide-down bg-[#111317]/60 rounded-xl p-5 border border-white/5">
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
                Tu auras les pleins pouvoirs administratifs (gérer les autres entraîneurs, voir les stats de l&apos;école, approuver les profils). Si un directeur officiel s&apos;inscrit plus tard et choisit «&nbsp;C&apos;est moi&nbsp;», ton rôle sera automatiquement ramené à entraîneur et tu seras notifié.
              </p>
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

/* ── School step (shared by Coach + Director École) ── */
function SchoolStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const [schools, setSchools] = useState<{ name: string; city: string; region: string; conference: string; sports: string[] }[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [selected, setSelected] = useState<{ name: string; city: string; region: string; conference: string; sports: string[] } | null>(
    user.institution ? { name: (user.institution as Record<string, string>).name, city: (user.institution as Record<string, string>).city || "", region: (user.institution as Record<string, string>).region || "", conference: "", sports: [] } : null
  );
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customRegion, setCustomRegion] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("schools")
      .select("id, name, city, region")
      .eq("type", "SECONDAIRE")
      .order("name")
      .then(({ data, error }) => {
        console.log("Schools:", data?.length, error);
        if (data) {
          setSchools(data.map(s => ({
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
      save({ institution: { name: selected.name, city: selected.city, region: selected.region, conference: selected.conference, sports: selected.sports } });
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
            {[item.city, item.region].filter(Boolean).join(" — ") && (
              <p className="text-[10px] text-[#6B7280]">{[item.city, item.region].filter(Boolean).join(" — ")}</p>
            )}
          </div>
        )}
      />

      {/* Selected school card */}
      {selected && (
        <div className="bg-[#111317] border border-white/10 rounded-lg p-5 space-y-3">
          <h3 className="font-head font-black text-lg text-white">{selected.name}</h3>
          {[selected.city, selected.region].filter(Boolean).join(", ") && (
            <p className="text-xs text-[#9CA3AF]">{[selected.city, selected.region].filter(Boolean).join(", ")}</p>
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

      {/* Custom school */}
      {!selected && (
        <>
          <button type="button" onClick={() => setShowCustom(!showCustom)} className="text-xs text-[#9CA3AF] hover:text-white transition-colors underline">
            Mon école n&apos;est pas dans la liste
          </button>
          {showCustom && (
            <div className="space-y-3 bg-[#111317] border border-white/10 rounded-lg p-4">
              <input type="text" placeholder="Nom de l'école" value={customName} onChange={(e) => setCustomName(e.target.value)} className={inputClass} />
              <input type="text" placeholder="Ville" value={customCity} onChange={(e) => setCustomCity(e.target.value)} className={inputClass} />
              <select value={customRegion} onChange={(e) => setCustomRegion(e.target.value)} className={`${inputClass} appearance-none`}>
                <option value="">Région</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="button" onClick={() => { save({ institution: { name: customName, city: customCity, region: customRegion, conference: "", sports: [] } }); setShowCustom(false); }} className="h-10 px-6 rounded-lg bg-[#E63946] text-xs font-bold text-white hover:bg-[#D42B22] transition-colors">
                Soumettre une demande
              </button>
            </div>
          )}
        </>
      )}
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
  // LeagueCoachLeagueStep writes league_team / league_team_id directly
  // to localStorage without going through save() (see :1898-1911), so
  // those fields aren't in the React `user` prop. Read fresh from
  // localStorage to surface them in the civil recap. Same pattern as
  // next() at :380.
  const raw = typeof window !== "undefined" ? localStorage.getItem("nexus_user") : null;
  const localUser = raw ? (JSON.parse(raw) as NexusUser) : user;
  const p = (localUser.profile || {}) as Record<string, unknown>;
  const inst = (localUser.institution || {}) as Record<string, unknown>;
  const isCivil = user.role === "coach_league";

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
    const team = (p.league_team || {}) as Record<string, unknown>;
    const teamGender = team.gender as string | undefined;
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
    [inst.city, inst.region].filter(Boolean).join(", ") ? { label: "Ville", value: [inst.city, inst.region].filter(Boolean).join(", ") } : null,
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
            {item.city && <p className="text-[10px] text-[#6B7280]">{item.city}{item.region ? ` — ${item.region}` : ""}</p>}
          </div>
        )}
      />

      {selected && (
        <div className="bg-[#111317] border border-white/10 rounded-lg p-5 space-y-2">
          <h3 className="font-head font-black text-lg text-white">{selected.name}</h3>
          {(selected.city || selected.region) && (
            <p className="text-xs text-[#9CA3AF]">{[selected.city, selected.region].filter(Boolean).join(" — ")}</p>
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
  if (step === 2) return <DirectorChoiceStep user={user} save={save} type="cegep" />;
  return <RecruiterCriteria user={user} save={save} />;
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
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customSubmitted, setCustomSubmitted] = useState(false);
  const [cegeps, setCegeps] = useState<{ name: string; city: string; region: string }[]>([]);

  const inputCls = "w-full bg-[#111317] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:border-[#E63946] outline-none transition-colors";

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("schools")
      .select("name, city, region")
      .eq("has_collegial", true)
      .order("name")
      .then(({ data, error }) => {
        console.log("CÉGEPs:", data?.length, error);
        if (data) {
          setCegeps(data.map(s => ({
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

  const selectCegep = (c: { name: string; city: string; region: string }) => {
    setSelected(c.name);
    save({ institution: { name: c.name, city: c.city, region: c.region } });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Ton CÉGEP</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Associe-toi à ton CÉGEP pour commencer le recrutement.</p>
      </div>

      {!selected && !showCustom && (
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
                {[c.city, c.region].filter(Boolean).join(", ") && (
                  <p className="text-[12px] text-[#6B7280]">{[c.city, c.region].filter(Boolean).join(", ")}</p>
                )}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowCustom(true)} className="text-[12px] text-[#E63946] font-bold hover:text-[#D42B22] transition-colors">
            Mon CÉGEP n&apos;est pas dans la liste →
          </button>
        </>
      )}

      {selected && (
        <div className="bg-[#111317] border border-[#22C55E]/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-white">{selected}</p>
              <p className="text-[12px] text-[#6B7280]">{[(inst as Record<string, string>)?.city, (inst as Record<string, string>)?.region].filter(Boolean).join(", ")}</p>
            </div>
            <span className="text-[12px] font-bold text-[#22C55E]">✓ Sélectionné</span>
          </div>
          <button type="button" onClick={() => { setSelected(""); save({ institution: null }); }} className="text-[11px] text-[#6B7280] hover:text-white mt-2 transition-colors">
            Changer de CÉGEP
          </button>
        </div>
      )}

      {showCustom && !selected && (
        <div className="bg-[#111317] border border-white/5 rounded-xl p-5 space-y-3">
          <p className="text-[13px] font-bold text-white">Demander l&apos;ajout de ton CÉGEP</p>
          <input type="text" placeholder="Nom du CÉGEP" value={customName} onChange={(e) => setCustomName(e.target.value)} className={inputCls} />
          <input type="text" placeholder="Ville" value={customCity} onChange={(e) => setCustomCity(e.target.value)} className={inputCls} />
          {!customSubmitted ? (
            <button type="button" onClick={() => { setCustomSubmitted(true); if (customName) { setSelected(customName); save({ institution: { name: customName, city: customCity } }); } }} className="h-10 px-5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
              Soumettre
            </button>
          ) : (
            <p className="text-[12px] text-[#22C55E] font-bold">✓ Demande soumise (POC)</p>
          )}
          <button type="button" onClick={() => setShowCustom(false)} className="text-[11px] text-[#6B7280] hover:text-white transition-colors block">
            ← Retour à la liste
          </button>
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

/* ── League search + select (shared by coach + coordinator) ── */
type CivilLeagueRow = {
  id: string;
  name: string;
  sport_id: string | null;
  sport_name: string;
  city: string | null;
  region: string | null;
  level: string | null;
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
  // Filter on level='Civil' so this list never surfaces school-side
  // RSEQ leagues to a civil-coach onboardee. The previous version
  // selected a non-existent `sport` text column on `leagues`; the
  // schema has `sport_id uuid` FK to `sports.nom`. We embed the
  // sports name via PostgREST's relationship syntax so the UI can
  // render the human label without a second query.
  useEffect(() => {
    async function loadLeagues() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leagues")
        .select("id, name, sport_id, sports!sport_id(nom), city, region, level")
        .eq("level", "Civil")
        .order("name");
      console.log("[LeagueSelectStep] Loaded civil leagues:", data, error);
      if (data) {
        const mapped: CivilLeagueRow[] = data.map((row) => {
          const r = row as Record<string, unknown>;
          const sportRel = Array.isArray(r.sports) ? r.sports[0] : r.sports;
          const sportName = (sportRel as { nom?: string } | null)?.nom ?? "";
          return {
            id: r.id as string,
            name: r.name as string,
            sport_id: (r.sport_id as string) ?? null,
            sport_name: sportName,
            city: (r.city as string) ?? null,
            region: (r.region as string) ?? null,
            level: (r.level as string) ?? null,
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
      // Pass sport_id through so downstream team creation can
      // inherit it from the selected league rather than re-querying.
      save({
        institution: {
          id: selected.id,
          name: selected.name,
          sport_id: selected.sport_id,
          sport: selected.sport_name,
          city: selected.city,
          region: selected.region,
          level: selected.level,
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
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">{item.name}</p>
                {[item.city, item.region].filter(Boolean).join(" — ") && (
                  <p className="text-[10px] text-[#6B7280]">{[item.city, item.region].filter(Boolean).join(" — ")}</p>
                )}
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#E63946]/10 text-[9px] font-bold text-[#E63946] uppercase">{item.sport_name}</span>
            </div>
          )}
        />
      )}

      {selected && (
        <div className="bg-[#111317] border border-white/10 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="font-head font-black text-lg text-white">{selected.name}</h3>
            <span className="px-2 py-0.5 rounded-full bg-[#E63946]/10 text-[9px] font-bold text-[#E63946] uppercase border border-[#E63946]/20">{selected.sport_name}</span>
          </div>
          {[selected.city, selected.region].filter(Boolean).join(", ") && (
            <p className="text-xs text-[#9CA3AF]">{[selected.city, selected.region].filter(Boolean).join(", ")}</p>
          )}
          {selected.level && <p className="text-xs text-[#6B7280]">Niveau: {selected.level}</p>}
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
  const [mode, setMode] = useState<"search" | "create">("search");
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

  // Resume support: if the user already picked/created a team in a
  // previous session and is back at step 1 (e.g. via Précédent),
  // surface the prior choice as the selected card.
  useEffect(() => {
    if (selectedTeam) return;
    const teamData = profileData.league_team as Record<string, unknown> | undefined;
    if (!teamData?.id) return;
    setSelectedTeam({
      id: teamData.id as string,
      name: (teamData.name as string) ?? "",
      age_group: (teamData.age_group as string) ?? null,
      gender: (teamData.gender as string) ?? null,
      division: (teamData.category as string) ?? null,
      league_id: (profileData.league_id as string) ?? "",
      league_name:
        ((localUser.institution as Record<string, unknown> | null)?.name as string) ?? "",
      coach_count: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistTeamLocally(args: {
    teamId: string;
    teamName: string;
    ageGroup: string | null;
    gender: string | null;
    category: string | null;
    season: string;
    leagueId: string;
    leagueName: string;
  }) {
    save({
      institution: { id: args.leagueId, name: args.leagueName, type: "ligue_civile" },
    });
    const rawNow = localStorage.getItem("nexus_user");
    if (!rawNow) return;
    const current = JSON.parse(rawNow) as NexusUser;
    const updated = {
      ...current,
      profile: {
        ...(current.profile || {}),
        league_team: {
          id: args.teamId,
          name: args.teamName,
          age_group: args.ageGroup,
          gender: args.gender,
          category: args.category,
          season: args.season,
        },
        league_id: args.leagueId,
        league_team_id: args.teamId,
      },
    };
    localStorage.setItem("nexus_user", JSON.stringify(updated));
  }

  async function handleJoinExistingTeam(team: TeamSearchRow) {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError("Session expirée. Reconnecte-toi pour continuer.");
        return;
      }

      const { error: lcError } = await supabase.from("league_coaches").insert({
        coach_id: authUser.id,
        league_id: team.league_id,
        league_team_id: team.id,
        role: "COACH",
      });

      // 23505 = duplicate key. The UNIQUE on (league_id, league_team_id,
      // coach_id) means the user is already a coach of this team —
      // surface as success rather than an error.
      if (lcError && lcError.code !== "23505") {
        console.error("[LeagueCoachLeagueStep] join failed:", lcError);
        setError("Impossible de rejoindre l'équipe. Réessaie.");
        return;
      }

      persistTeamLocally({
        teamId: team.id,
        teamName: team.name,
        ageGroup: team.age_group,
        gender: team.gender,
        category: team.division,
        season: "2025-2026",
        leagueId: team.league_id,
        leagueName: team.league_name,
      });
      setSelectedTeam(team);
    } catch (err) {
      console.error("[LeagueCoachLeagueStep] join exception:", err);
      setError("Une erreur est survenue. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateTeam(formData: TeamFormData) {
    if (!sportId) {
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

      // 1. Find or create the league. If the autocomplete already
      //    snapped to an existing league id, skip the lookup roundtrip.
      let leagueId = formData.league_id_if_existing;
      let leagueName = formData.league_input;
      if (!leagueId) {
        const result = await findOrCreateLeague({
          name: formData.league_input,
          sportId,
        });
        leagueId = result.id;
        leagueName = result.name;
      }

      // 2. INSERT the team row (owner = current user).
      const { data: newTeam, error: ltError } = await supabase
        .from("league_teams")
        .insert({
          league_id: leagueId,
          name: formData.team_name,
          age_group: formData.age_group,
          division: null,
          gender: formData.gender,
          season: formData.season,
          sport_id: sportId,
          owner_id: authUser.id,
        })
        .select()
        .single();

      if (ltError || !newTeam) {
        console.error("[LeagueCoachLeagueStep] create team failed:", ltError);
        setError("Impossible de créer l'équipe. Réessaie.");
        return;
      }

      // 3. INSERT league_coaches with role: ADMIN (creator/owner).
      const { error: lcError } = await supabase.from("league_coaches").insert({
        coach_id: authUser.id,
        league_id: leagueId,
        league_team_id: newTeam.id,
        role: "ADMIN",
      });
      if (lcError) {
        // The team exists; coach attachment is non-critical for proceeding.
        // Log and continue — the user can be re-attached manually if needed.
        console.error("[LeagueCoachLeagueStep] league_coaches insert failed:", lcError);
      }

      persistTeamLocally({
        teamId: newTeam.id,
        teamName: formData.team_name,
        ageGroup: formData.age_group,
        gender: formData.gender,
        category: null,
        season: formData.season,
        leagueId,
        leagueName,
      });

      setSelectedTeam({
        id: newTeam.id,
        name: formData.team_name,
        age_group: formData.age_group,
        gender: formData.gender,
        division: null,
        league_id: leagueId,
        league_name: leagueName,
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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">
          {mode === "search" ? "Trouve ton équipe" : "Crée ta nouvelle équipe"}
        </h2>
        <p className="text-sm text-[#9CA3AF] mt-1">
          {mode === "search"
            ? "Cherche ton équipe parmi celles déjà inscrites, ou crée une nouvelle équipe."
            : "Remplis les détails — la ligue sera reconnue ou créée automatiquement."}
        </p>
      </div>

      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3">
          <p className="text-[12px] text-[#EF4444]">{error}</p>
        </div>
      )}

      {mode === "search" && (
        <TeamSearchOrCreate
          sportId={sportId}
          selectedTeam={selectedTeam}
          onSelect={handleJoinExistingTeam}
          onCreate={() => {
            setError(null);
            setMode("create");
          }}
        />
      )}

      {mode === "create" && (
        <TeamCreateForm
          sportId={sportId}
          sportName={sportName}
          onSubmit={handleCreateTeam}
          onCancel={() => {
            setError(null);
            setMode("search");
          }}
        />
      )}

      {submitting && <p className="text-[12px] text-[#9CA3AF]">Enregistrement en cours...</p>}
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
