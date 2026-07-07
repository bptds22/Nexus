"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import NexusLogo from "@/components/ui/NexusLogo";
import { createClient } from "@/lib/supabase/client";
import { needsConsent } from "@/lib/auth/needsConsent";
import { genderLabel } from "@/lib/config/gender";
import { GRAD_YEAR_OPTIONS, DEFAULT_GRAD_YEAR } from "@/lib/config/gradYears";
import { calculateProfileCompletion } from "@/lib/utils/calculateProfileCompletion";
import SportPositionSelect from "@/app/coach/components/SportPositionSelect";
import DatePicker from "@/app/coach/components/DatePicker";
import SchoolSelect from "@/components/ui/SchoolSelect";
import CoachPicker from "@/components/coach/CoachPicker";
import PartnerVisibilityConsentCard from "@/components/shared/PartnerVisibilityConsentCard";
import ClaimProfileModal, { type OrphanProfile } from "@/components/auth/ClaimProfileModal";
import { AthleteOnboardingMobile } from "@/components/shared/AthleteOnboardingMobile";
import { SUBJECTS, HONORS, CEGEP_REGIONS, programmeCegepArray } from "@/lib/config/academicOptions";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

const SPORTS = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball",
  "Athlétisme", "Flag football", "Rugby", "Cheerleading",
  "Natation", "Badminton", "Cross-country", "Futsal",
  "Baseball", "Ultimate frisbee", "Autre",
];
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Athlete Onboarding — Same fields as coach create form,
   adapted for athlete self-registration.
   Steps: 1. Identité  2. Académique  3. Physique  4. Sport & Médias
───────────────────────────────────────────────────────────────── */

const STEPS = [
  { number: 1, name: "Identité" },
  { number: 2, name: "Académique" },
  { number: 3, name: "Physique" },
  { number: 4, name: "Sport & Médias" },
];

// CEGEP_REGIONS, SUBJECTS, HONORS are imported from @/lib/config/academicOptions
// so the athlete-onboarding pill grids stay in sync with the athlete-profile
// editor's chip blocks (one source for the option labels stored as JSONB
// values in athletes.{matieres_fortes,mentions_academiques,regions_cegep_preferees}).

const cardCls = "bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6 sm:p-8";
const inputCls = "w-full h-11 px-4 bg-[#111317] border border-[#2D3748] rounded-lg text-[14px] text-white placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5 block";
const sectionTitle = "text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4 flex items-center gap-2";

/* ─────────────────────────────────────────────────────────────────
   ClubPicker — civil-context CLUB tier (parity with mobile
   AthleteOnboardingMobile.tsx clubs picker).

   Civil athletes first pick their CLUB (a schools row with
   type='LIGUE_CIVILE'), then optionally a team within it. The club
   is the anchor written to athletes.school_id at submit — so an
   athlete whose club has no Nexus team is still anchored to the club
   (the case the old team-only aggregate could not express).

   Query is sport-AGNOSTIC (mobile parity): all 266 LIGUE_CIVILE
   schools, filtered client-side by name/city. Sport only scopes the
   TEAM tier (CivilTeamPicker), not the club.

   Opt-out via "Continuer sans club" → school_id stays NULL (a
   legitimate skip; the athlete can associate later).
───────────────────────────────────────────────────────────────── */
type CivilClubRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
};

function ClubPicker({
  selectedClubId,
  onSelect,
  onContinueWithoutClub,
}: {
  selectedClubId: string | null;
  onSelect: (club: CivilClubRow) => void;
  onContinueWithoutClub: () => void;
}) {
  const [clubs, setClubs] = useState<CivilClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadClubs() {
      setLoading(true);
      const supabase = createClient();
      // Mobile parity (AthleteOnboardingMobile clubs loader): every
      // LIGUE_CIVILE school, no sport filter. Client-side search below.
      const { data } = await supabase
        .from("schools")
        .select("id, name, city, region")
        .eq("type", "LIGUE_CIVILE")
        .order("name");
      if (!cancelled) {
        setClubs((data as CivilClubRow[]) ?? []);
        setLoading(false);
      }
    }
    loadClubs();
    return () => { cancelled = true; };
  }, []);

  const q = search.trim().toLowerCase();
  const visible = (q.length > 0
    ? clubs.filter((c) =>
        c.name.toLowerCase().includes(q)
        || (c.city ? c.city.toLowerCase().includes(q) : false),
      )
    : clubs
  ).slice(0, 50);

  if (skipped) {
    return (
      <p className="text-[13px] text-[#9CA3AF] italic">
        Tu pourras associer ton club plus tard depuis ton profil.
      </p>
    );
  }

  if (loading) {
    return <p className="text-[13px] text-[#6b7280]">Chargement des clubs...</p>;
  }

  if (clubs.length === 0) {
    return (
      <div className="bg-[#13151a] border border-[#2D3748] rounded-lg px-4 py-5">
        <p className="text-[13px] text-[#9CA3AF] mb-1">Aucun club civil trouvé.</p>
        <p className="text-[12px] text-[#6b7280] mb-4">Continue — tu pourras t&apos;associer plus tard.</p>
        <button
          type="button"
          onClick={() => { setSkipped(true); onContinueWithoutClub(); }}
          className="h-10 px-5 rounded-lg border border-[#E63946]/40 text-[12px] font-bold text-[#E63946] hover:bg-[#E63946]/10 transition-colors"
        >
          Continuer sans club →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher ton club..."
        className={inputCls}
      />
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {visible.map((c) => {
          const isSelected = selectedClubId === c.id;
          const meta = [c.city, c.region].filter(Boolean).join(" · ");
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className={`w-full text-left rounded-lg px-4 py-3 transition-colors border ${
                isSelected
                  ? "bg-[#E63946]/10 border-[#E63946]"
                  : "bg-[#13151a] border-[#2D3748] hover:border-[#4a4d56]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white truncate">{c.name}</p>
                  {meta && <p className="text-[11px] text-[#6b7280] truncate">{meta}</p>}
                </div>
                {isSelected && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="text-[12px] text-[#6b7280] px-1 py-2">Aucun club ne correspond à « {search} ».</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => { setSkipped(true); onContinueWithoutClub(); }}
        className="text-[12px] text-[#6b7280] hover:text-[#E63946] transition-colors underline"
      >
        Mon club n&apos;est pas listé — continuer sans club
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   CivilTeamPicker — civil-context replacement for the school block.

   Phase 6.2: ported to the unified model. Civil leagues now live in
   `schools` (type='LIGUE_CIVILE') and civil teams live in `teams`
   anchored on those schools. The picker aggregates every team
   across civil-league schools for the athlete's sport.

   The athlete picks one or opts out via "Continuer sans équipe" —
   no athlete-side team creation (teams are created by coaches).

   School (league) name is displayed as a subtitle to disambiguate
   when two coaches name their teams identically across different
   civil-league organizations.
───────────────────────────────────────────────────────────────── */
type CivilTeamRow = {
  id: string;
  name: string;
  age_group: string | null;
  division: string | null;
  school_id: string;
  school_name: string;
};

function CivilTeamPicker({
  sportName,
  selectedTeamId,
  onSelect,
  onContinueWithoutTeam,
}: {
  sportName: string;
  selectedTeamId: string | null;
  onSelect: (team: CivilTeamRow) => void;
  onContinueWithoutTeam: () => void;
}) {
  const [teams, setTeams] = useState<CivilTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadTeams() {
      setLoading(true);
      const supabase = createClient();

      // Resolve sport_id from name. Fail-soft: if the sport doesn't
      // exist (e.g., user picked "Autre" at signup), surface as
      // empty list — the "Continuer sans équipe" CTA still works.
      const { data: sportRow } = await supabase
        .from("sports")
        .select("id")
        .eq("nom", sportName)
        .maybeSingle();
      if (!sportRow?.id) {
        if (!cancelled) { setTeams([]); setLoading(false); }
        return;
      }

      // Aggregate ALL civil teams for this sport across every
      // LIGUE_CIVILE school. Phase 6.2: teams now live in `teams`
      // anchored on `schools`; the sport_id filter is server-side.
      const { data: rows } = await supabase
        .from("teams")
        .select("id, name, age_group, division, school_id, schools!school_id(name, type)")
        .eq("sport_id", sportRow.id)
        .order("name");
      if (!rows) { if (!cancelled) { setTeams([]); setLoading(false); } return; }

      const filtered: CivilTeamRow[] = [];
      for (const raw of rows as Record<string, unknown>[]) {
        const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
        const s = schoolRel as { name?: string; type?: string } | null;
        if (s?.type !== "LIGUE_CIVILE") continue;
        filtered.push({
          id: raw.id as string,
          name: raw.name as string,
          age_group: (raw.age_group as string) ?? null,
          division: (raw.division as string) ?? null,
          school_id: raw.school_id as string,
          school_name: s.name ?? "",
        });
      }

      if (!cancelled) { setTeams(filtered); setLoading(false); }
    }
    if (sportName) loadTeams();
    else { setTeams([]); setLoading(false); }
    return () => { cancelled = true; };
  }, [sportName]);

  const visible = search.trim().length > 0
    ? teams.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase().trim())
        || t.school_name.toLowerCase().includes(search.toLowerCase().trim()),
      )
    : teams;

  if (skipped) {
    return (
      <p className="text-[13px] text-[#9CA3AF] italic">
        Tu pourras associer ton équipe plus tard depuis ton profil.
      </p>
    );
  }

  if (loading) {
    return <p className="text-[13px] text-[#6b7280]">Chargement des équipes...</p>;
  }

  if (teams.length === 0) {
    return (
      <div className="bg-[#13151a] border border-[#2D3748] rounded-lg px-4 py-5">
        <p className="text-[13px] text-[#9CA3AF] mb-1">Aucune équipe civile trouvée pour {sportName || "ton sport"}.</p>
        <p className="text-[12px] text-[#6b7280] mb-4">Si ton équipe n&apos;apparaît pas, continue — tu pourras l&apos;associer plus tard.</p>
        <button
          type="button"
          onClick={() => { setSkipped(true); onContinueWithoutTeam(); }}
          className="h-10 px-5 rounded-lg border border-[#E63946]/40 text-[12px] font-bold text-[#E63946] hover:bg-[#E63946]/10 transition-colors"
        >
          Continuer sans équipe →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher ton équipe..."
        className={inputCls}
      />
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {visible.map((t) => {
          const isSelected = selectedTeamId === t.id;
          const meta = [t.age_group, t.division].filter(Boolean).join(" · ");
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className={`w-full text-left rounded-lg px-4 py-3 transition-colors border ${
                isSelected
                  ? "bg-[#E63946]/10 border-[#E63946]"
                  : "bg-[#13151a] border-[#2D3748] hover:border-[#4a4d56]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white truncate">{t.name}</p>
                  <p className="text-[11px] text-[#6b7280] truncate">
                    {t.school_name}{meta ? ` — ${meta}` : ""}
                  </p>
                </div>
                {isSelected && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="text-[12px] text-[#6b7280] px-1 py-2">Aucune équipe ne correspond à « {search} ».</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => { setSkipped(true); onContinueWithoutTeam(); }}
        className="text-[12px] text-[#6b7280] hover:text-[#E63946] transition-colors underline"
      >
        Mon équipe n&apos;est pas listée — continuer sans équipe
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SchoolTeamPicker — school-context self-join picker (Phase 1).

   Filters `teams` by the athlete's selected school + sport. Mirrors
   CivilTeamPicker's UX (search, single-select, opt-out) but scoped
   to one school instead of aggregating across LIGUE_CIVILE schools.

   Renders at step 4 once primarySport is known and selectedSchoolId
   is set. By then the athletes row was INSERTed at end of step 1 with
   school_id populated, so the "Athletes see their teams" RLS policy
   on `teams` is satisfied.

   Always optional. If no team matches or the athlete opts out, the
   coach can still claim the athlete later via existing flows.
───────────────────────────────────────────────────────────────── */

type SchoolTeamRow = {
  id: string;
  name: string;
  age_group: string | null;
  division: string | null;
  gender: string | null;
};

function SchoolTeamPicker({
  schoolId,
  sportName,
  selectedCoachId,
  selectedTeamId,
  onSelect,
  onContinueWithoutTeam,
}: {
  schoolId: string;
  sportName: string;
  selectedCoachId: string | null;
  selectedTeamId: string | null;
  onSelect: (team: SchoolTeamRow) => void;
  onContinueWithoutTeam: () => void;
}) {
  const [teams, setTeams] = useState<SchoolTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadTeams() {
      setLoading(true);
      const supabase = createClient();

      // Resolve sport_id from name — fail-soft to empty list (the
      // skip path still works) if the sport doesn't exist.
      const { data: sportRow } = await supabase
        .from("sports")
        .select("id")
        .eq("nom", sportName)
        .maybeSingle();
      if (!sportRow?.id) {
        if (!cancelled) { setTeams([]); setLoading(false); }
        return;
      }

      let query = supabase
        .from("teams")
        .select("id, name, age_group, division, gender")
        .eq("school_id", schoolId)
        .eq("sport_id", sportRow.id)
        .eq("is_active", true);

      // Narrow to the selected coach's teams — but ONLY if that coach
      // has linked teams (team_coaches). That table fills organically
      // via the coach portal; until a coach has links, fall back to all
      // school teams rather than hide them behind an empty picker.
      if (selectedCoachId) {
        const { data: ct } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", selectedCoachId);
        if (ct && ct.length > 0) {
          query = query.in("id", ct.map((r) => r.team_id as string));
        }
      }

      const { data: rows } = await query.order("name");

      if (!cancelled) {
        setTeams((rows ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.name as string,
          age_group: (r.age_group as string) ?? null,
          division: (r.division as string) ?? null,
          gender: (r.gender as string) ?? null,
        })));
        setLoading(false);
      }
    }
    if (schoolId && sportName) loadTeams();
    else { setTeams([]); setLoading(false); }
    return () => { cancelled = true; };
  }, [schoolId, sportName, selectedCoachId]);

  const visible = search.trim().length > 0
    ? teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase().trim()))
    : teams;

  if (skipped) {
    return (
      <p className="text-[13px] text-[#9CA3AF] italic">
        Tu pourras associer ton équipe plus tard.
      </p>
    );
  }

  if (loading) {
    return <p className="text-[13px] text-[#6b7280]">Chargement des équipes...</p>;
  }

  if (teams.length === 0) {
    return (
      <div className="bg-[#13151a] border border-[#2D3748] rounded-lg px-4 py-5">
        <p className="text-[13px] text-[#9CA3AF] mb-1">Aucune équipe pour {sportName || "ton sport"} à cette école pour l&apos;instant.</p>
        <p className="text-[12px] text-[#6b7280] mb-4">Pas grave — finis ton inscription, tu pourras associer ton équipe plus tard.</p>
        <button
          type="button"
          onClick={() => { setSkipped(true); onContinueWithoutTeam(); }}
          className="h-10 px-5 rounded-lg border border-[#E63946]/40 text-[12px] font-bold text-[#E63946] hover:bg-[#E63946]/10 transition-colors"
        >
          Continuer sans équipe →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher ton équipe..."
        className={inputCls}
      />
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {visible.map((t) => {
          const isSelected = selectedTeamId === t.id;
          const meta = [t.age_group, t.division, t.gender ? genderLabel(t.gender) : null].filter(Boolean).join(" · ");
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className={`w-full text-left rounded-lg px-4 py-3 transition-colors border ${
                isSelected
                  ? "bg-[#E63946]/10 border-[#E63946]"
                  : "bg-[#13151a] border-[#2D3748] hover:border-[#4a4d56]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white truncate">{t.name}</p>
                  {meta && <p className="text-[11px] text-[#6b7280] truncate">{meta}</p>}
                </div>
                {isSelected && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="text-[12px] text-[#6b7280] px-1 py-2">Aucune équipe ne correspond à « {search} ».</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => { setSkipped(true); onContinueWithoutTeam(); }}
        className="text-[12px] text-[#6b7280] hover:text-[#E63946] transition-colors underline"
      >
        Mon équipe n&apos;est pas listée — continuer sans équipe
      </button>
    </div>
  );
}

export default function AthleteOnboardingPage() {
  // Iter 7.50-a — Capacitor (mobile natif) route vers le nouveau flow
  // minimal "Construis ta carte" (3 écrans). Le desktop ci-dessous reste
  // byte-identique : aucune ligne supprimée/modifiée.
  if (IS_CAPACITOR) return <AthleteOnboardingMobile />;

  return <AthleteOnboardingDesktop />;
}

function AthleteOnboardingDesktop() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [existingAthleteId, setExistingAthleteId] = useState<string | null>(null);

  // Phase 2 athlete claim: if a coach-created orphan athlete row
  // matches this signup's email, we surface the modal at mount and
  // route into the existing UPDATE path (via existingAthleteId) on
  // claim. Skip means we leave the orphan alone and INSERT a fresh
  // row at end of step 1, just like a no-match signup.
  const [orphanMatch, setOrphanMatch] = useState<OrphanProfile | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);

  // Step 1 — Identity
  const [photo, setPhoto] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gradYear, setGradYear] = useState(DEFAULT_GRAD_YEAR);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // School (used when userContext === 'scolaire')
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedSchoolName, setSelectedSchoolName] = useState("");
  // Coach (optional, school-context only)
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);

  // Civil league team (used when userContext === 'ligue_civile').
  // Loaded from users.context at mount; civil athletes pick a team
  // their coach already created (no athlete-side team creation).
  // Can stay NULL if athlete clicks "Continuer sans équipe" — Loi 25
  // and the rest of the profile still apply.
  //
  // Phase 6.2: civil athletes anchor on athletes.school_id (the
  // LIGUE_CIVILE schools row) and join their team via the
  // team_athletes junction. Legacy athletes.league_team_id is left
  // NULL on writes; the column itself is dropped in Phase 6.3.
  const [userContext, setUserContext] = useState<"scolaire" | "ligue_civile" | null>(null);
  // Civil CLUB tier (parity with mobile selectedClubId/Name). The club
  // is the anchor written to athletes.school_id at submit (Étape 3);
  // the team below is optional and scoped to this club.
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [selectedClubName, setSelectedClubName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState("");
  const [selectedTeamSchoolId, setSelectedTeamSchoolId] = useState<string | null>(null);

  // Step 2 — Academic
  const [gpa, setGpa] = useState("");
  const [strongSubjects, setStrongSubjects] = useState<string[]>([]);
  const [academicHonors, setAcademicHonors] = useState<string[]>([]);
  const [cegepType, setCegepType] = useState("");
  const [cegepProgramDetail, setCegepProgramDetail] = useState("");
  const [openToPrivate, setOpenToPrivate] = useState(false);
  const [openToAnglophone, setOpenToAnglophone] = useState(false);
  const [openToRelocate, setOpenToRelocate] = useState(false);
  const [cegepRegions, setCegepRegions] = useState<string[]>([]);

  // Step 3 — Physical
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [dominantHand, setDominantHand] = useState("");
  const [dominantFoot, setDominantFoot] = useState("");

  // Step 4 — Sport & Media
  const [primarySport, setPrimarySport] = useState("");
  const [primaryPosition, setPrimaryPosition] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [highlightVideo, setHighlightVideo] = useState("");
  const [hudlLink, setHudlLink] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [instagramLink, setInstagramLink] = useState("");

  // Parent / Guardian
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentRelationship, setParentRelationship] = useState("");
  const [consentProfile, setConsentProfile] = useState(false);
  const [consentVisibility, setConsentVisibility] = useState(false);
  const [consentComms, setConsentComms] = useState(false);
  const [consentPartnerVisibility, setConsentPartnerVisibility] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);
      if (user.email) setEmail(user.email);

      // Pre-fill from user_metadata (set during signUp), then users table as fallback
      const meta = user.user_metadata || {};
      if (meta.first_name) setFirstName(meta.first_name as string);
      if (meta.last_name) setLastName(meta.last_name as string);
      if (meta.sport) setPrimarySport(meta.sport as string);

      // Single retried read of public.users. Right after signup the JWT
      // cookie hasn't fully propagated, so RLS can return 0 rows for ~1s
      // (the SAME race documented in app/athlete/layout.tsx:276-282).
      // .maybeSingle() returns null instead of throwing PGRST116, and we
      // retry a few times so the wizard pre-fills once the row is visible
      // — rather than aborting init() and hanging the spinner forever.
      let userRow: {
        first_name: string | null;
        last_name: string | null;
        context: string | null;
        onboarding_complete: boolean | null;
        privacy_preferences: Record<string, unknown> | null;
      } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data } = await supabase
          .from("users")
          .select("first_name, last_name, context, onboarding_complete, privacy_preferences")
          .eq("id", user.id)
          .maybeSingle();
        if (data) { userRow = data; break; }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
      }

      // Gate consentements (BLOC 3B) : consent Loi 25 manquant + onboarding
      // incomplet → interstitiel. Placé AVANT le build (couvre le nouvel
      // athlète social sans ligne athletes). needsConsent gère le double
      // signal (privacy_preferences OU user_metadata) anti-boucle. Fail-open :
      // si userRow est null (race RLS), on ne gate pas (l'app se dévoile).
      if (userRow && userRow.onboarding_complete !== true
          && needsConsent(userRow.privacy_preferences, user.user_metadata)) {
        router.replace("/consentements");
        return;
      }

      // Fallback: fill name from the users row only if metadata was empty.
      if (!meta.first_name) {
        if (userRow?.first_name) setFirstName(userRow.first_name);
        if (userRow?.last_name) setLastName(userRow.last_name);
      }

      // users.context is the civil/school discriminator. Wired at signup
      // in 5.3a (commit 5dc7456). Defaults to 'scolaire' when null —
      // preserves existing behavior for pre-5.3a users (and the race
      // window above, where the row may not be visible yet).
      const ctxRaw = userRow?.context;
      const ctx: "scolaire" | "ligue_civile" =
        ctxRaw === "ligue_civile" ? "ligue_civile" : "scolaire";
      setUserContext(ctx);

      // Check if athlete row exists — pre-fill all saved fields.
      // Phase 6.2: civil-context team membership is now read via the
      // team_athletes junction (joined to teams). The legacy
      // league_teams embed is dropped — the column is going away in
      // Phase 6.3 and the unified read is via schools + team_athletes.
      const { data: existing } = await supabase
        .from("athletes")
        .select("*, schools!school_id(name, type), sports!sport_id(nom), team_athletes(team_id, teams!team_id(id, name, school_id))")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        setExistingAthleteId(existing.id);
        // Skip onboarding ONLY when users.onboarding_complete is set — the SAME
        // criterion as the athlete layout guard. Previously this redirected on
        // the PRESENCE of athletes fields (first_name/last_name/sport_id/
        // school_id), which a coach-seeded CLAIMED account already has → it
        // jumped to the dashboard before handleSubmit could set the flag, so the
        // layout (flag still false) bounced back → infinite loop. Now a claimed
        // (or unfinished) account stays on the PRE-FILLED onboarding and
        // completes it, which sets the flag — no more loop.
        if (userRow?.onboarding_complete === true) {
          router.replace("/athlete/dashboard");
          return;
        }
        // Pre-fill from saved data. For school-context, school_id +
        // schools rel give the school name. For civil-context, the
        // same school_id points to a LIGUE_CIVILE row — but the team
        // metadata comes from the team_athletes junction.
        if (existing.first_name) setFirstName(existing.first_name);
        if (existing.last_name) setLastName(existing.last_name);
        if (existing.date_naissance) setDateOfBirth(existing.date_naissance);
        if (existing.genre) setGender(existing.genre);
        if (existing.photo_url) setPhoto(existing.photo_url);
        if (existing.telephone) setPhone(existing.telephone);
        if (existing.annee_diplomation) setGradYear(String(existing.annee_diplomation));
        const schoolRel = Array.isArray(existing.schools) ? existing.schools[0] : existing.schools;
        const schoolType = (schoolRel as { type?: string } | null)?.type;
        if (existing.school_id && schoolType !== "LIGUE_CIVILE") {
          setSelectedSchoolId(existing.school_id);
          if (schoolRel?.name) setSelectedSchoolName(schoolRel.name);
        }
        if (existing.coach_id) setSelectedCoachId(existing.coach_id as string);
        // Civil-context team prefill: read from team_athletes junction.
        const teamAthleteRel = Array.isArray(existing.team_athletes)
          ? existing.team_athletes[0]
          : existing.team_athletes;
        const teamRel = teamAthleteRel
          ? (Array.isArray((teamAthleteRel as Record<string, unknown>).teams)
              ? ((teamAthleteRel as Record<string, unknown>).teams as Record<string, unknown>[])[0]
              : ((teamAthleteRel as Record<string, unknown>).teams as Record<string, unknown> | null))
          : null;
        if (teamRel && typeof teamRel === "object") {
          const teamObj = teamRel as { id?: string; name?: string; school_id?: string };
          if (teamObj.id) setSelectedTeamId(teamObj.id);
          if (teamObj.name) setSelectedTeamName(teamObj.name);
          if (teamObj.school_id) setSelectedTeamSchoolId(teamObj.school_id);
        }
        if (existing.parent_first_name) setParentFirstName(existing.parent_first_name);
        if (existing.parent_last_name) setParentLastName(existing.parent_last_name);
        if (existing.parent_email) setParentEmail(existing.parent_email);
        if (existing.telephone_parent) setParentPhone(existing.telephone_parent);
        if (existing.parent_relationship) setParentRelationship(existing.parent_relationship);
        if (existing.consentement_parental) { setConsentProfile(true); setConsentVisibility(true); }
        if (existing.moyenne_generale) setGpa(String(existing.moyenne_generale));
        if (existing.matieres_fortes) setStrongSubjects(existing.matieres_fortes);
        if (existing.mentions_academiques) setAcademicHonors(existing.mentions_academiques);
        if (existing.ouvert_cegep_prive) setOpenToPrivate(true);
        if (existing.ouvert_cegep_anglophone) setOpenToAnglophone(true);
        if (existing.pret_changer_region) setOpenToRelocate(true);
        if (existing.regions_cegep_preferees) setCegepRegions(existing.regions_cegep_preferees);
        if (existing.taille_pieds) setHeightFeet(String(existing.taille_pieds));
        if (existing.taille_pouces) setHeightInches(String(existing.taille_pouces));
        if (existing.poids_lbs) setWeightLbs(String(existing.poids_lbs));
        if (existing.main_dominante) setDominantHand(existing.main_dominante);
        if (existing.pied_dominant) setDominantFoot(existing.pied_dominant);
        if (existing.numero_jersey) setJerseyNumber(existing.numero_jersey);
        const sportRel = Array.isArray(existing.sports) ? existing.sports[0] : existing.sports;
        if (sportRel?.nom) setPrimarySport(sportRel.nom);
        if (existing.video_faits_saillants_url) setHighlightVideo(existing.video_faits_saillants_url);
        if (existing.hudl_url) setHudlLink(existing.hudl_url);
        if (existing.youtube_url) setYoutubeLink(existing.youtube_url);
        if (existing.instagram_url) setInstagramLink(existing.instagram_url);
        // Resume at first incomplete step. Step 1 completion gate
        // mirrors canProceed() — for civil context, school_id can
        // legitimately be NULL ("Continuer sans équipe"), so we
        // don't require it. For scolaire context, school_id must
        // be a SECONDAIRE row.
        const step1Complete = existing.first_name && existing.consentement_parental
          && (ctx === "ligue_civile" || existing.school_id);
        if (step1Complete) {
          if (existing.taille_pieds || existing.poids_lbs) setStep(4);
          else if (existing.moyenne_generale || (existing.matieres_fortes && existing.matieres_fortes.length > 0)) setStep(3);
          else setStep(2);
        }
      } else if (user.email) {
        // Phase 2 athlete claim: no existing athlete row for this
        // auth.uid(). Check whether a coach pre-created an orphan
        // profile (user_id IS NULL) with this email. RLS policy
        // "athletes can read own orphan match" (migration
        // 20260516130000) scopes the SELECT to auth.users.email so
        // a malicious signup can't query for someone else's profile.
        const { data: orphan } = await supabase
          .from("athletes")
          .select("id, first_name, last_name, sports:sport_id(nom), schools:school_id(name), users:coach_id(first_name, last_name)")
          .ilike("email", user.email)
          .is("user_id", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (orphan) {
          const sportRel = Array.isArray(orphan.sports) ? orphan.sports[0] : orphan.sports;
          const schoolRel = Array.isArray(orphan.schools) ? orphan.schools[0] : orphan.schools;
          const coachRel = Array.isArray(orphan.users) ? orphan.users[0] : orphan.users;
          const coachObj = coachRel as { first_name?: string; last_name?: string } | null;
          const coachName = coachObj
            ? `${coachObj.first_name ?? ""} ${coachObj.last_name ?? ""}`.trim() || null
            : null;
          setOrphanMatch({
            id: orphan.id as string,
            first_name: (orphan.first_name as string) ?? null,
            last_name: (orphan.last_name as string) ?? null,
            sport_name: ((sportRel as { nom?: string } | null)?.nom) ?? null,
            school_name: ((schoolRel as { name?: string } | null)?.name) ?? null,
            coach_name: coachName,
          });
          setShowClaimModal(true);
        }
      }

      } catch (err) {
        // Unexpected failure (network, auth) — surface a recoverable
        // error rather than hanging. The JWT-propagation 0-rows race is
        // already handled above via .maybeSingle() + retry, so it does
        // NOT land here.
        console.error("[Onboarding] init failed:", err);
        setInitError(true);
      } finally {
        // ALWAYS clear the spinner, no matter what threw above.
        setLoading(false);
      }
    }
    init();
  }, [router]);

  // Phase 2 athlete claim: pull the full orphan record, pre-fill all
  // wizard state, then point existingAthleteId at the orphan id so
  // every downstream save UPDATE-targets it. The first UPDATE will
  // set user_id = auth.uid() (already in the standard athleteRecord
  // payload), satisfying the orphan-claim policy's WITH CHECK.
  async function handleClaimOrphan() {
    if (!orphanMatch) return;
    const supabase = createClient();
    const { data: full } = await supabase
      .from("athletes")
      .select("*, schools!school_id(name, type), sports!sport_id(nom), positions!position_id(abreviation)")
      .eq("id", orphanMatch.id)
      .maybeSingle();
    if (!full) {
      // RLS rejected or row disappeared — fall back to skip path.
      setShowClaimModal(false);
      setOrphanMatch(null);
      return;
    }

    if (full.first_name) setFirstName(full.first_name);
    if (full.last_name) setLastName(full.last_name);
    if (full.date_naissance) setDateOfBirth(full.date_naissance);
    if (full.genre) setGender(full.genre);
    if (full.photo_url) setPhoto(full.photo_url);
    if (full.telephone) setPhone(full.telephone);
    if (full.annee_diplomation) setGradYear(String(full.annee_diplomation));
    const schoolRel = Array.isArray(full.schools) ? full.schools[0] : full.schools;
    if (full.school_id && (schoolRel as { type?: string } | null)?.type !== "LIGUE_CIVILE") {
      setSelectedSchoolId(full.school_id as string);
      if ((schoolRel as { name?: string } | null)?.name) setSelectedSchoolName((schoolRel as { name?: string }).name as string);
    }
    if (full.coach_id) setSelectedCoachId(full.coach_id as string);
    if (full.nom_parent || full.parent_first_name) {
      if (full.parent_first_name) setParentFirstName(full.parent_first_name);
      if (full.parent_last_name) setParentLastName(full.parent_last_name);
    }
    if (full.parent_email) setParentEmail(full.parent_email);
    if (full.telephone_parent) setParentPhone(full.telephone_parent);
    if (full.parent_relationship) setParentRelationship(full.parent_relationship);
    if (full.moyenne_generale) setGpa(String(full.moyenne_generale));
    if (full.matieres_fortes) setStrongSubjects(full.matieres_fortes);
    if (full.mentions_academiques) setAcademicHonors(full.mentions_academiques);
    if (full.taille_pieds) setHeightFeet(String(full.taille_pieds));
    if (full.taille_pouces) setHeightInches(String(full.taille_pouces));
    if (full.poids_lbs) setWeightLbs(String(full.poids_lbs));
    if (full.main_dominante) setDominantHand(full.main_dominante);
    if (full.pied_dominant) setDominantFoot(full.pied_dominant);
    if (full.numero_jersey) setJerseyNumber(full.numero_jersey);
    const sportRel = Array.isArray(full.sports) ? full.sports[0] : full.sports;
    if ((sportRel as { nom?: string } | null)?.nom) setPrimarySport((sportRel as { nom?: string }).nom as string);
    const posRel = Array.isArray(full.positions) ? full.positions[0] : full.positions;
    if ((posRel as { abreviation?: string } | null)?.abreviation) setPrimaryPosition((posRel as { abreviation?: string }).abreviation as string);
    if (full.video_faits_saillants_url) setHighlightVideo(full.video_faits_saillants_url);
    if (full.hudl_url) setHudlLink(full.hudl_url);
    if (full.youtube_url) setYoutubeLink(full.youtube_url);
    if (full.instagram_url) setInstagramLink(full.instagram_url);

    // Critical: route every downstream save into the UPDATE branch
    // targeting the orphan row. The athleteRecord payload already
    // sets user_id = userId, so the first UPDATE satisfies the
    // claim policy's WITH CHECK (user_id = auth.uid()) and the row
    // transitions from orphan to owned in a single write.
    setExistingAthleteId(orphanMatch.id);
    setShowClaimModal(false);
  }

  function handleSkipClaim() {
    setShowClaimModal(false);
    setOrphanMatch(null);
  }

  function canProceed(): boolean {
    switch (step) {
      case 1: {
        // Identity + parental consent are required for both contexts
        // (Loi 25 minor consent applies regardless of school vs civil).
        // School context additionally requires selectedSchoolId; civil
        // context permits NULL league_team_id ("Continuer sans équipe").
        const baseValid = !!(firstName.trim() && lastName.trim() && gradYear
          && parentFirstName.trim() && parentLastName.trim() && parentEmail.trim()
          && consentProfile && consentVisibility);
        if (userContext === "ligue_civile") return baseValid;
        return baseValid && !!selectedSchoolId;
      }
      case 2: return true;
      case 3: return true;
      case 4: return !!primarySport;
      default: return false;
    }
  }

  // Save current step's data to Supabase before advancing
  async function saveStepAndAdvance() {
    if (!canProceed() || !userId) return;
    setSaving(true);

    const supabase = createClient();

    // Build partial payload for current step
    let payload: Record<string, unknown> = { user_id: userId };

    if (step === 1) {
      // Phase 6.2 unified model: civil athletes anchor on
      // athletes.school_id (the LIGUE_CIVILE schools row id resolved
      // from the picked team) — `league_team_id` is no longer
      // written. Team membership is captured via the team_athletes
      // junction at submit time (handleSubmit), not at step-save
      // time, to avoid orphan junction rows if the athlete drops
      // out mid-flow. The chk_school_or_league constraint is still
      // satisfied: we set school_id (possibly to the LIGUE_CIVILE
      // school) and leave league_team_id NULL.
      const isCivil = userContext === "ligue_civile";
      const civilAnchorSchoolId = isCivil ? selectedTeamSchoolId : null;
      payload = {
        ...payload,
        first_name: firstName.trim(), last_name: lastName.trim(),
        date_naissance: dateOfBirth || null, genre: gender || null,
        photo_url: photo || null, email: email || null, telephone: phone || null,
        annee_diplomation: gradYear ? parseInt(gradYear) : null,
        school_id: isCivil ? civilAnchorSchoolId : (selectedSchoolId || null),
        coach_id: isCivil ? null : selectedCoachId,
        league_team_id: null,
        nom_parent: `${parentFirstName.trim()} ${parentLastName.trim()}`.trim() || null,
        parent_first_name: parentFirstName.trim() || null, parent_last_name: parentLastName.trim() || null,
        parent_email: parentEmail.trim() || null, telephone_parent: parentPhone.trim() || null,
        parent_relationship: parentRelationship || null,
        consentement_parental: consentProfile && consentVisibility,
        consentement_parental_date: (consentProfile && consentVisibility) ? new Date().toISOString() : null,
        ...(consentProfile && consentVisibility && consentPartnerVisibility ? {
          partner_visibility_parental_consent: true,
          partner_visibility_opt_in: true,
          partner_visibility_opted_in_at: new Date().toISOString(),
        } : {}),
        status: "ACTIF", verified: false,
      };
    } else if (step === 2) {
      payload = {
        ...payload,
        moyenne_generale: gpa ? parseFloat(gpa) : null,
        matieres_fortes: strongSubjects, mentions_academiques: academicHonors,
        programme_cegep_vise: programmeCegepArray(cegepType, cegepProgramDetail),
        ouvert_cegep_prive: openToPrivate, ouvert_cegep_anglophone: openToAnglophone,
        pret_changer_region: openToRelocate, regions_cegep_preferees: cegepRegions,
      };
    } else if (step === 3) {
      payload = {
        ...payload,
        taille_pieds: heightFeet ? parseInt(heightFeet) : null,
        taille_pouces: heightInches ? parseInt(heightInches) : null,
        poids_lbs: weightLbs ? parseFloat(weightLbs) : null,
        main_dominante: dominantHand || null, pied_dominant: dominantFoot || null,
      };
    }

    try {
      if (existingAthleteId) {
        const { error } = await supabase.from("athletes").update(payload).eq("id", existingAthleteId);
        if (error) { console.error("[Onboarding step save] update:", error); setSaving(false); return; }
      } else {
        const { data, error } = await supabase.from("athletes").insert(payload).select("id").single();
        if (error) { console.error("[Onboarding step save] insert:", error); setSaving(false); return; }
        if (data) setExistingAthleteId(data.id);
      }
      setSaving(false);
      setStep(step + 1);
    } catch (err) {
      console.error("[Onboarding step save] unexpected:", err);
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!userId || !primarySport) return;
    if (!consentProfile || !consentVisibility) return;
    setSaving(true);

    try {
    const supabase = createClient();

    // Defense-in-depth: refuse to create athletes row if user
    // is not actually ATHLETE role. The layout's role guard
    // should prevent this, but if a non-athlete somehow
    // reaches here, abort cleanly instead of corrupting data.
    const { data: userRoleCheck } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userRoleCheck?.role !== "ATHLETE") {
      console.error("[Athlete onboarding] non-athlete attempted to submit, role:", userRoleCheck?.role);
      alert("Erreur : ton compte n'est pas configuré comme athlète. Contacte le support.");
      setSaving(false);
      return;
    }

    // Resolve sport_id
    const { data: sportData } = await supabase.from("sports").select("id").eq("nom", primarySport).single();

    // Resolve position_id
    let positionId = null;
    if (primaryPosition && sportData?.id) {
      const { data: posData } = await supabase.from("positions").select("id").eq("abreviation", primaryPosition).eq("sport_id", sportData.id).maybeSingle();
      positionId = posData?.id || null;
    }

    // Phase 6.2: civil athletes anchor on athletes.school_id (the
    // LIGUE_CIVILE schools row id from the picked team). Team
    // membership is recorded in the team_athletes junction after
    // the athlete row is INSERT/UPDATE'd below. Legacy
    // league_team_id is always NULL on writes.
    const isCivil = userContext === "ligue_civile";
    const civilAnchorSchoolId = isCivil ? selectedTeamSchoolId : null;

    const athleteRecord = {
      user_id: userId,
      school_id: isCivil ? civilAnchorSchoolId : (selectedSchoolId || null),
      coach_id: isCivil ? null : selectedCoachId,
      league_team_id: null,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_naissance: dateOfBirth || null,
      genre: gender || null,
      photo_url: photo || null,
      email: email || null,
      telephone: phone || null,
      annee_diplomation: gradYear ? parseInt(gradYear) : null,
      moyenne_generale: gpa ? parseFloat(gpa) : null,
      matieres_fortes: strongSubjects,
      mentions_academiques: academicHonors,
      programme_cegep_vise: programmeCegepArray(cegepType, cegepProgramDetail),
      ouvert_cegep_prive: openToPrivate,
      ouvert_cegep_anglophone: openToAnglophone,
      pret_changer_region: openToRelocate,
      regions_cegep_preferees: cegepRegions,
      taille_pieds: heightFeet ? parseInt(heightFeet) : null,
      taille_pouces: heightInches ? parseInt(heightInches) : null,
      poids_lbs: weightLbs ? parseFloat(weightLbs) : null,
      main_dominante: dominantHand || null,
      pied_dominant: dominantFoot || null,
      sport_id: sportData?.id || null,
      position_id: positionId,
      numero_jersey: jerseyNumber || null,
      video_faits_saillants_url: highlightVideo || null,
      hudl_url: hudlLink || null,
      youtube_url: youtubeLink || null,
      instagram_url: instagramLink || null,
      // Parent / Guardian
      nom_parent: `${parentFirstName.trim()} ${parentLastName.trim()}`.trim() || null,
      parent_first_name: parentFirstName.trim() || null,
      parent_last_name: parentLastName.trim() || null,
      parent_email: parentEmail.trim() || null,
      telephone_parent: parentPhone.trim() || null,
      parent_relationship: parentRelationship || null,
      consentement_parental: consentProfile && consentVisibility,
      consentement_parental_date: (consentProfile && consentVisibility) ? new Date().toISOString() : null,
      ...(consentProfile && consentVisibility && consentPartnerVisibility ? {
        partner_visibility_parental_consent: true,
        partner_visibility_opt_in: true,
        partner_visibility_opted_in_at: new Date().toISOString(),
      } : {}),
      status: "ACTIF",
      verified: false,
    };

    let athleteIdForTeam: string | null = existingAthleteId;
    if (existingAthleteId) {
      const { error } = await supabase.from("athletes").update(athleteRecord).eq("id", existingAthleteId);
      if (error) { console.error("[Onboarding] update failed:", error); setSaving(false); return; }
    } else {
      const { data: inserted, error } = await supabase.from("athletes").insert(athleteRecord).select("id").single();
      if (error) { console.error("[Onboarding] insert failed:", error); setSaving(false); return; }
      athleteIdForTeam = (inserted?.id as string) ?? null;
    }

    // Phase 6.2: for civil athletes who picked a team, record the
    // membership in the team_athletes junction (the new unified
    // anchor). Idempotent — ignore unique-violation on rejoin.
    //
    // Phase 1 (school self-join): same junction INSERT for school
    // athletes who picked a team via SchoolTeamPicker at step 4. The
    // condition is unified — `selectedTeamId` is null whenever the
    // athlete skipped or no picker was rendered (out-of-context),
    // so this block silently no-ops for those paths.
    if (selectedTeamId && athleteIdForTeam) {
      const { error: taErr } = await supabase.from("team_athletes").insert({
        team_id: selectedTeamId,
        athlete_id: athleteIdForTeam,
      });
      if (taErr && taErr.code !== "23505") {
        console.error("[Onboarding] team_athletes insert failed:", taErr);
      }
    }

    // Update profile_completion in DB
    const { data: freshAthlete } = await supabase.from("athletes").select("*").eq("user_id", userId).single();
    if (freshAthlete) {
      const completion = calculateProfileCompletion(freshAthlete);
      await supabase.from("athletes").update({ profile_completion: completion }).eq("user_id", userId);
    }

    await supabase.from("users").update({ onboarding_complete: true }).eq("id", userId);
    // Le profil caché (useCurrentUser, staleTime: Infinity) doit voir false→true
    // dans CETTE session pour que PushRegistrar demande la permission push.
    // Await AVANT la nav : on lance le refetch avant de quitter l'onboarding.
    await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    setSaving(false);
    router.replace("/athlete/dashboard");
    } catch (err) {
      console.error("[Onboarding] unexpected error:", err);
      setSaving(false);
    }
  }

  function toggleInArray(arr: string[], item: string, setter: (v: string[]) => void) {
    setter(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  }

  const pillCls = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors cursor-pointer ${
      active ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"
    }`;

  if (initError) {
    return (
      <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <PlaybookBackground />
        <p className="relative z-10 text-white font-semibold max-w-sm">
          Une erreur est survenue au chargement de ton profil.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="relative z-10 px-5 h-11 bg-[#E63946] text-white font-head font-bold uppercase tracking-widest text-sm rounded"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex items-center justify-center">
        <PlaybookBackground />
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex flex-col items-center px-4 py-8">
      <PlaybookBackground />

      {showClaimModal && orphanMatch && (
        <ClaimProfileModal
          orphan={orphanMatch}
          onClaim={handleClaimOrphan}
          onSkip={handleSkipClaim}
        />
      )}

      <div className="relative z-10 w-full max-w-2xl space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center mb-2">
          <NexusLogo variant="white" height={36} priority />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { if (s.number < step || canProceed()) setStep(s.number); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  s.number < step ? "bg-[#22C55E] text-white" : s.number === step ? "bg-[#E63946] text-white" : "bg-[#2D3748] text-[#6b7280]"
                }`}
              >
                {s.number < step ? "✓" : s.number}
              </button>
              {i < STEPS.length - 1 && <div className={`w-6 sm:w-10 h-0.5 ${s.number < step ? "bg-[#22C55E]" : "bg-[#2D3748]"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-[12px] text-[#6b7280]">Étape {step}/{STEPS.length} — {STEPS[step - 1].name}</p>

        {/* ═══════ STEP 1: IDENTITÉ ═══════ */}
        {step === 1 && (
          <div className={cardCls}>
            <h2 className="font-head text-xl font-black text-white uppercase tracking-tight mb-1">Identité</h2>
            <p className="text-[14px] text-[#6b7280] mb-6">Tes informations personnelles de base</p>

            {/* Photo */}
            <div className="flex items-center gap-5 mb-6">
              <div className="relative group shrink-0">
                {photo ? (
                  <img src={photo} alt="Photo" className="w-[80px] h-[80px] rounded-xl object-cover border-2 border-[#2a2d36]" />
                ) : (
                  <div className="w-[80px] h-[80px] rounded-xl bg-[#13151a] border-2 border-dashed border-[#2a2d36] flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  <input type="file" accept="image/*" className="hidden" title="Photo" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setPhoto(URL.createObjectURL(f));
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
                    const path = `${user.id}/${Date.now()}.${f.name.split(".").pop()}`;
                    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
                    if (uploadError) {
                      console.error("[Onboarding photo upload]", uploadError);
                      return;
                    }
                    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
                    setPhoto(urlData.publicUrl);
                  }} />
                </label>
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Ta photo</p>
                <p className="text-[12px] text-[#4a4d56]">Pour ta carte joueur. JPG ou PNG.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className={labelCls}>Prénom <span className="text-[#EF4444]">*</span></label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" className={inputCls} /></div>
              <div><label className={labelCls}>Nom <span className="text-[#EF4444]">*</span></label><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className={labelCls}>Genre</label>
                <select title="Genre" value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}><option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option><option value="X">Autre</option></select>
              </div>
              <div><label className={labelCls}>Date de naissance</label><DatePicker value={dateOfBirth} onChange={setDateOfBirth} placeholder="Sélectionner une date" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className={labelCls}>Année de graduation <span className="text-[#EF4444]">*</span></label>
                <select title="Graduation" value={gradYear} onChange={(e) => setGradYear(e.target.value)} className={inputCls}>{GRAD_YEAR_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select>
              </div>
              <div><label className={labelCls}>Courriel</label><input type="email" title="Courriel" placeholder="courriel@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} text-[#6b7280]`} readOnly /></div>
            </div>
            <div className="mb-4"><label className={labelCls}>Téléphone</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="514-000-0000" className={inputCls} /></div>

            {/* School OR civil-team block — conditional on userContext.
                Both contexts continue to use the existing parent +
                consent + partner-visibility blocks below. */}
            {userContext === "ligue_civile" ? (
              <>
                {/* CLUB tier — the civil anchor (athletes.school_id).
                    Sport-agnostic; always selectable. Picking a club
                    resets any previously chosen team (parity mobile). */}
                <div className={sectionTitle}>
                  <div className="w-0.5 h-4 bg-[#E63946] rounded-full" />
                  Mon club
                  <span className="text-[10px] text-[#4a4d56] font-normal normal-case tracking-normal ml-2">(optionnel)</span>
                </div>
                <div className="mb-3">
                  <ClubPicker
                    selectedClubId={selectedClubId}
                    onSelect={(c) => {
                      setSelectedClubId(c.id);
                      setSelectedClubName(c.name);
                      // Club changed → drop stale team selection.
                      setSelectedTeamId(null);
                      setSelectedTeamName("");
                      setSelectedTeamSchoolId(null);
                    }}
                    onContinueWithoutClub={() => {
                      setSelectedClubId(null);
                      setSelectedClubName("");
                      setSelectedTeamId(null);
                      setSelectedTeamName("");
                      setSelectedTeamSchoolId(null);
                    }}
                  />
                </div>
                {selectedClubName && (
                  <p className="text-[12px] text-[#22C55E] font-bold mb-6">✓ {selectedClubName}</p>
                )}

                <div className={sectionTitle}>
                  <div className="w-0.5 h-4 bg-[#E63946] rounded-full" />
                  Mon équipe
                  <span className="text-[10px] text-[#4a4d56] font-normal normal-case tracking-normal ml-2">(optionnel)</span>
                </div>
                <div className="mb-3">
                  <CivilTeamPicker
                    sportName={primarySport}
                    selectedTeamId={selectedTeamId}
                    onSelect={(t) => {
                      setSelectedTeamId(t.id);
                      setSelectedTeamName(t.name);
                      setSelectedTeamSchoolId(t.school_id);
                    }}
                    onContinueWithoutTeam={() => {
                      setSelectedTeamId(null);
                      setSelectedTeamName("");
                      setSelectedTeamSchoolId(null);
                    }}
                  />
                </div>
                {selectedTeamName && (
                  <p className="text-[12px] text-[#22C55E] font-bold mb-6">✓ {selectedTeamName}</p>
                )}
              </>
            ) : (
              <>
                {/* School selection */}
                <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Mon école <span className="text-[#EF4444]">*</span></div>
                <div className="mb-3">
                  <SchoolSelect
                    value={selectedSchoolId || null}
                    onChange={(id) => {
                      setSelectedSchoolId(id);
                      if (!id) setSelectedSchoolName("");
                      setSelectedCoachId(null);
                    }}
                    filterType="SECONDAIRE"
                    placeholder="Rechercher ton école..."
                  />
                </div>
                {selectedSchoolName && <p className="text-[12px] text-[#22C55E] font-bold mb-6">✓ {selectedSchoolName}</p>}

                {/* Coach picker — only after school selection */}
                {selectedSchoolId && (
                  <>
                    <div className={sectionTitle}>
                      <div className="w-0.5 h-4 bg-[#E63946] rounded-full" />
                      Mon coach <span className="text-[10px] text-[#4a4d56] font-normal normal-case tracking-normal ml-2">(optionnel)</span>
                    </div>
                    <p className="text-[12px] text-[#6b7280] mb-3">Sélectionne ton coach actuel. Tu pourras changer plus tard.</p>
                    <div className="mb-6">
                      <CoachPicker
                        schoolId={selectedSchoolId}
                        selectedCoachId={selectedCoachId}
                        onChange={setSelectedCoachId}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Parent / Guardian */}
            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Parent / Tuteur</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className={labelCls}>Prénom du parent <span className="text-[#EF4444]">*</span></label><input type="text" value={parentFirstName} onChange={(e) => setParentFirstName(e.target.value)} placeholder="Prénom" className={inputCls} /></div>
              <div><label className={labelCls}>Nom du parent <span className="text-[#EF4444]">*</span></label><input type="text" value={parentLastName} onChange={(e) => setParentLastName(e.target.value)} placeholder="Nom" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className={labelCls}>Courriel du parent <span className="text-[#EF4444]">*</span></label><input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="courriel@exemple.com" className={inputCls} /></div>
              <div><label className={labelCls}>Téléphone du parent</label><input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="514-000-0000" className={inputCls} /></div>
            </div>
            <div className="mb-6">
              <label className={labelCls}>Lien de parenté</label>
              <select title="Lien de parenté" value={parentRelationship} onChange={(e) => setParentRelationship(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="Père">Père</option>
                <option value="Mère">Mère</option>
                <option value="Tuteur légal">Tuteur légal</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            {/* Parental Consent */}
            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Consentement parental</div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={consentProfile} onChange={(e) => setConsentProfile(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentProfile ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56] group-hover:border-[#6b7280]"}`}>
                  {consentProfile && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[12px] text-[#9CA3AF] leading-snug">Je confirme que mon parent ou tuteur légal autorise la création de mon profil athlète sur Nexus. <span className="text-[#EF4444]">*</span></span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={consentVisibility} onChange={(e) => setConsentVisibility(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentVisibility ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56] group-hover:border-[#6b7280]"}`}>
                  {consentVisibility && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[12px] text-[#9CA3AF] leading-snug">Mon parent ou tuteur légal consent à ce que mes informations sportives et académiques soient visibles par les recruteurs des CÉGEP. <span className="text-[#EF4444]">*</span></span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={consentComms} onChange={(e) => setConsentComms(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentComms ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56] group-hover:border-[#6b7280]"}`}>
                  {consentComms && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[12px] text-[#6b7280] leading-snug">Mon parent ou tuteur accepte de recevoir des communications de Nexus concernant mon recrutement. <span className="text-[10px] text-[#4a4d56]">(optionnel)</span></span>
              </label>
            </div>

            <PartnerVisibilityConsentCard checked={consentPartnerVisibility} onChange={setConsentPartnerVisibility} />
          </div>
        )}

        {/* ═══════ STEP 2: ACADÉMIQUE ═══════ */}
        {step === 2 && (
          <div className={cardCls}>
            <h2 className="font-head text-xl font-black text-white uppercase tracking-tight mb-1">Académique</h2>
            <p className="text-[14px] text-[#6b7280] mb-6">Ton parcours scolaire et tes préférences CÉGEP</p>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div><label className={labelCls}>Moyenne générale (%)</label><input type="number" value={gpa} onChange={(e) => setGpa(e.target.value)} placeholder="78" min="0" max="100" className={inputCls} /></div>
              <div><label className={labelCls}>Programme CÉGEP visé</label>
                <select title="Programme" value={cegepType} onChange={(e) => setCegepType(e.target.value)} className={inputCls}><option value="">—</option><option value="dec_general">DEC général</option><option value="technique">Programme technique</option></select>
              </div>
            </div>
            {cegepType === "technique" && (
              <div className="mb-5"><label className={labelCls}>Précise le programme</label><input type="text" value={cegepProgramDetail} onChange={(e) => setCegepProgramDetail(e.target.value)} placeholder="Ex: Soins infirmiers" className={inputCls} /></div>
            )}

            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Matières fortes</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {SUBJECTS.map((s) => <button key={s} type="button" onClick={() => toggleInArray(strongSubjects, s, setStrongSubjects)} className={pillCls(strongSubjects.includes(s))}>{s}</button>)}
            </div>

            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Mentions académiques</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {HONORS.map((h) => (
                <button key={h} type="button" onClick={() => toggleInArray(academicHonors, h, setAcademicHonors)} className={pillCls(academicHonors.includes(h))}>{h}</button>
              ))}
            </div>

            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Préférences CÉGEP</div>
            <div className="flex flex-wrap gap-3 mb-4">
              {[
                { label: "Ouvert au privé", val: openToPrivate, set: setOpenToPrivate },
                { label: "Ouvert anglophone", val: openToAnglophone, set: setOpenToAnglophone },
                { label: "Ouvert à déménager", val: openToRelocate, set: setOpenToRelocate },
              ].map((p) => (
                <button key={p.label} type="button" onClick={() => p.set(!p.val)} className={pillCls(p.val)}>{p.label}</button>
              ))}
            </div>
            {openToRelocate && (
              <div className="mb-4">
                <label className={labelCls}>Régions CÉGEP préférées</label>
                <div className="flex flex-wrap gap-2">
                  {CEGEP_REGIONS.map((r) => <button key={r} type="button" onClick={() => toggleInArray(cegepRegions, r, setCegepRegions)} className={pillCls(cegepRegions.includes(r))}>{r}</button>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ STEP 3: PHYSIQUE ═══════ */}
        {step === 3 && (
          <div className={cardCls}>
            <h2 className="font-head text-xl font-black text-white uppercase tracking-tight mb-1">Profil physique</h2>
            <p className="text-[14px] text-[#6b7280] mb-6">Tes mensurations aident les recruteurs à évaluer ton profil</p>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div><label className={labelCls}>Taille (pieds)</label>
                <select title="Pieds" value={heightFeet} onChange={(e) => setHeightFeet(e.target.value)} className={inputCls}><option value="">—</option>{[4,5,6,7].map((v) => <option key={v} value={String(v)}>{v}&apos;</option>)}</select>
              </div>
              <div><label className={labelCls}>Taille (pouces)</label>
                <select title="Pouces" value={heightInches} onChange={(e) => setHeightInches(e.target.value)} className={inputCls}><option value="">—</option>{Array.from({length:12},(_,i)=><option key={i} value={String(i)}>{i}&quot;</option>)}</select>
              </div>
              <div><label className={labelCls}>Poids (lbs)</label><input type="number" value={weightLbs} onChange={(e) => setWeightLbs(e.target.value)} placeholder="175" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Main dominante</label>
                <select title="Main dominante" value={dominantHand} onChange={(e) => setDominantHand(e.target.value)} className={inputCls}><option value="">—</option><option value="Droite">Droite</option><option value="Gauche">Gauche</option><option value="Ambidextre">Ambidextre</option></select>
              </div>
              <div><label className={labelCls}>Pied dominant</label>
                <select title="Pied dominant" value={dominantFoot} onChange={(e) => setDominantFoot(e.target.value)} className={inputCls}><option value="">—</option><option value="Droit">Droit</option><option value="Gauche">Gauche</option><option value="Les deux">Les deux</option></select>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ STEP 4: SPORT & MÉDIAS ═══════ */}
        {step === 4 && (
          <div className={cardCls}>
            <h2 className="font-head text-xl font-black text-white uppercase tracking-tight mb-1">Sport & Médias</h2>
            <p className="text-[14px] text-[#6b7280] mb-6">Ton sport principal et tes liens vidéo</p>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Sport principal <span className="text-[#EF4444]">*</span></label>
                <div className="grid grid-cols-4 gap-2">
                  {SPORTS.map((s) => (
                    <button key={s} type="button" onClick={() => { setPrimarySport(s); setPrimaryPosition(""); }}
                      className={`py-2 rounded-lg text-[11px] font-bold transition-all ${primarySport === s ? "bg-[#E63946] text-white" : "bg-[#111317] border border-[#2D3748] text-[#9CA3AF] hover:border-[#4a4d56] hover:text-white"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {primarySport && (
                <SportPositionSelect
                  sport={primarySport}
                  value={primaryPosition}
                  onChange={setPrimaryPosition}
                  label="Position"
                />
              )}
            </div>

            <div className="mt-5 mb-5">
              <label className={labelCls}>Numéro de jersey</label>
              <input type="text" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} placeholder="12" className={`${inputCls} max-w-[120px]`} />
            </div>

            {/* Phase 1: school athletes self-join an existing team
                (optional). Filtered by selectedSchoolId + primarySport.
                Civil athletes pick their team in step 1 via the
                CivilTeamPicker; this block is school-context only. */}
            {userContext === "scolaire" && selectedSchoolId && primarySport && (
              <div className="mt-5 mb-5">
                <label className={labelCls}>Ton équipe (optionnel)</label>
                <p className="text-[12px] text-[#6b7280] mb-3">Sélectionne ton équipe actuelle à {selectedSchoolName || "ton école"}. Si elle n&apos;apparaît pas, tu pourras l&apos;associer plus tard.</p>
                <SchoolTeamPicker
                  schoolId={selectedSchoolId}
                  sportName={primarySport}
                  selectedCoachId={selectedCoachId}
                  selectedTeamId={selectedTeamId}
                  onSelect={(t) => { setSelectedTeamId(t.id); setSelectedTeamName(t.name); }}
                  onContinueWithoutTeam={() => { setSelectedTeamId(null); setSelectedTeamName(""); }}
                />
              </div>
            )}

            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Liens vidéo</div>
            <div className="space-y-3">
              <div><label className={labelCls}>Faits saillants</label><input type="url" value={highlightVideo} onChange={(e) => setHighlightVideo(e.target.value)} placeholder="https://..." className={inputCls} /></div>
              <div><label className={labelCls}>Hudl</label><input type="url" value={hudlLink} onChange={(e) => setHudlLink(e.target.value)} placeholder="https://hudl.com/..." className={inputCls} /></div>
              <div><label className={labelCls}>YouTube</label><input type="url" value={youtubeLink} onChange={(e) => setYoutubeLink(e.target.value)} placeholder="https://youtube.com/..." className={inputCls} /></div>
              <div><label className={labelCls}>Instagram</label><input type="url" value={instagramLink} onChange={(e) => setInstagramLink(e.target.value)} placeholder="https://instagram.com/..." className={inputCls} /></div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)}
              className="flex-1 py-3.5 rounded-lg border border-[#2D3748] text-[#9CA3AF] font-head font-bold text-[13px] uppercase tracking-widest hover:text-white hover:border-[#4a4d56] transition-colors">
              Retour
            </button>
          )}
          {step < 4 ? (
            <button type="button" onClick={saveStepAndAdvance} disabled={!canProceed() || saving}
              className={`flex-1 py-3.5 rounded-lg font-head font-bold text-[13px] uppercase tracking-widest transition-all ${
                canProceed() && !saving ? "bg-[#E63946] text-white hover:bg-[#D42B22]" : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"
              }`}>
              {saving ? "Enregistrement..." : "Suivant"}
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving || !canProceed()}
              className="flex-1 py-3.5 rounded-lg bg-[#E63946] text-white font-head font-bold text-[13px] uppercase tracking-widest hover:bg-[#D42B22] transition-all disabled:opacity-50">
              {saving ? "Enregistrement..." : "Compléter mon profil"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
