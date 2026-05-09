"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   Team Detail — Manage coaches + athletes for a single team.
   5.5d-iii-redux: rich row layout (verified + position + status
   badge + region + height/weight + grad year + 5-star rating)
   replaces the prior captain/jersey row. Captain + jersey UI
   dropped from this page (deferred to athlete profile edit if
   needed). Civil ADMIN gets remove ✕ on hover; école keeps
   "Modifier" + "Voir →" links per row.
═══════════════════════════════════════════════════════════════ */

interface TeamCoach { id: string; coachId: string; name: string; role: string }

// Shared rich-row fields for both école (Section B) and civil
// (athletes section). Mirrors the visual contract of CoachAthleteRow
// at /coach/athletes/page.tsx without extracting it (P3 captures the
// future shared-component refactor — see post-launch-bugs.md).
interface RichRowShared {
  id: string;          // junction row id (team_athletes or league_team_athletes)
  athleteId: string;
  name: string;
  position: string;
  verified: boolean;
  region: string;
  heightWeight: string;
  gradYear: number | null;
  stars: number;       // 0-5 scale
  recruitmentStatus: GlobalRecruitmentStatus | null;
  committedSchoolName: string | null;
  openToOffers: boolean | null;
}

// École athletes carry their school name for the row sub-line.
// Civil athletes do not — the team header already identifies the
// team + league.
interface TeamAthlete extends RichRowShared { school: string }

interface CivilAthlete extends RichRowShared {}

interface AvailableAthlete { id: string; name: string; position: string }
interface AvailableCoach { id: string; name: string }

// Civil header shape — 5.5d-i ships the header only. Subsequent
// sub-phases extend with athletes (ii/iii), coaches section (iv),
// admin info edit (v), and invitation (vi).
interface CivilTeamHeader {
  id: string;
  name: string;
  ageGroup: string;
  gender: string;
  season: string;
  sportName: string;
  leagueName: string;
  myRole: "ADMIN" | "COACH";
  isActive: boolean;
}

function formatHeightWeight(pieds: number | null, pouces: number | null, lbs: number | null): string {
  const parts: string[] = [];
  if (pieds != null) {
    const inches = pouces ?? 0;
    parts.push(`${pieds}'${inches}"`);
  }
  if (lbs != null) {
    parts.push(`${lbs} lbs`);
  }
  return parts.join(" · ");
}

const ROLE_LABELS: Record<string, string> = { head_coach: "Entraîneur-chef", assistant: "Assistant", coordinator: "Coordonnateur" };
const ROLE_COLORS: Record<string, string> = {
  head_coach: "bg-[#E63946]/15 text-[#E63946] border-[#E63946]/30",
  assistant: "bg-[#2D3748] text-[#9CA3AF] border-[#2D3748]",
  coordinator: "bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30",
};

const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-white placeholder-[#4a4d56] focus:outline-none focus:border-[#E63946]/50 transition-colors";
const labelCls = "block text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1.5";
const sectionTitle = "text-[11px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-4";

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();

  const [team, setTeam] = useState<{ name: string; ageGroup: string; division: string; league: string; season: string; sportName: string; sportId: string; schoolId: string } | null>(null);
  const [coaches, setCoaches] = useState<TeamCoach[]>([]);
  const [athletes, setAthletes] = useState<TeamAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Add athlete
  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [availableAthletes, setAvailableAthletes] = useState<AvailableAthlete[]>([]);
  const [athleteSearch, setAthleteSearch] = useState("");

  // Add coach
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [availableCoaches, setAvailableCoaches] = useState<AvailableCoach[]>([]);
  const [newCoachRole, setNewCoachRole] = useState("assistant");

  // Edit team
  const [editName, setEditName] = useState("");
  const [editAgeGroup, setEditAgeGroup] = useState("");
  const [editDivision, setEditDivision] = useState("");
  const [editLeague, setEditLeague] = useState("");
  const [editSeason, setEditSeason] = useState("");

  // Civil branch state. isCivil gates the entire JSX return — école
  // path stays byte-identical when isCivil is false.
  const [isCivil, setIsCivil] = useState(false);
  const [civilHeader, setCivilHeader] = useState<CivilTeamHeader | null>(null);
  // 5.5d-ii: civil roster loaded from league_team_athletes junction.
  const [civilAthletes, setCivilAthletes] = useState<CivilAthlete[]>([]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  useEffect(() => { load(); }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Civil header load. Two-query approach for clear error handling:
  //   1. Fetch the team itself (existence check) → null = 404
  //   2. Fetch the user's league_coaches role on this team → null = 403
  // Single nested-join query would conflate "team missing" with
  // "user not authorized" — both produce a null result row.
  // Edge case (c) — team is_active=false renders the header normally
  // with a banner; redirect only happens for (a) and (b).
  async function loadCivilTeam(userId: string) {
    const supabase = createClient();

    const { data: team } = await supabase
      .from("league_teams")
      .select(`
        id, name, age_group, gender, season, is_active, sport_id, league_id,
        sports!sport_id(nom),
        leagues!league_id(name)
      `)
      .eq("id", teamId)
      .maybeSingle();

    if (!team) {
      // (a) team_id doesn't exist → silent 404 redirect
      router.replace("/coach/equipes");
      return;
    }

    const { data: roleRow } = await supabase
      .from("league_coaches")
      .select("role")
      .eq("league_team_id", teamId)
      .eq("coach_id", userId)
      .in("role", ["ADMIN", "COACH"])
      .order("role")
      .limit(1)
      .maybeSingle();

    if (!roleRow) {
      // (b) team exists but user is not a coach on it → silent 403 redirect
      router.replace("/coach/equipes");
      return;
    }

    const teamRecord = team as Record<string, unknown>;
    const sportRel = teamRecord.sports as { nom?: string } | { nom?: string }[] | null;
    const sport = Array.isArray(sportRel) ? sportRel[0] : sportRel;
    const leagueRel = teamRecord.leagues as { name?: string } | { name?: string }[] | null;
    const league = Array.isArray(leagueRel) ? leagueRel[0] : leagueRel;

    setCivilHeader({
      id: teamRecord.id as string,
      name: (teamRecord.name as string) || "",
      ageGroup: (teamRecord.age_group as string) || "",
      gender: (teamRecord.gender as string) || "",
      season: (teamRecord.season as string) || "",
      sportName: sport?.nom || "",
      leagueName: league?.name || "",
      myRole: (roleRow.role as "ADMIN" | "COACH") || "COACH",
      isActive: (teamRecord.is_active as boolean) ?? true,
    });

    // 5.5d-iii-redux: rich roster fetch via the league_team_athletes
    // junction (5.5b) embedding athlete + position + status + region
    // (from users.region for civil athletes since they have no school)
    // + height/weight + grad year + coach rating. Captain/jersey
    // columns on the junction are still in the schema but no longer
    // surfaced in this view.
    const { data: rosterRows } = await supabase
      .from("league_team_athletes")
      .select(`
        id, athlete_id,
        athletes!athlete_id(
          id, first_name, last_name, verified,
          position_id, positions!position_id(abreviation),
          statut_recrutement_override, open_to_offers,
          committed_school_id, committed_school:schools!committed_school_id(name),
          annee_diplomation, taille_pieds, taille_pouces, poids_lbs,
          cote_globale_entraineur,
          user_id, users!athletes_user_id_fkey(region)
        )
      `)
      .eq("league_team_id", teamId);

    if (rosterRows) {
      const mapped: CivilAthlete[] = rosterRows.map((row) => {
        const r = row as Record<string, unknown>;
        const athleteRel = r.athletes as Record<string, unknown> | Record<string, unknown>[] | null;
        const athlete = (Array.isArray(athleteRel) ? athleteRel[0] : athleteRel) as Record<string, unknown> | null;
        const posRel = athlete?.positions as { abreviation?: string } | { abreviation?: string }[] | null;
        const pos = Array.isArray(posRel) ? posRel[0] : posRel;
        const userRel = athlete?.users as { region?: string } | { region?: string }[] | null;
        const userRow = Array.isArray(userRel) ? userRel[0] : userRel;
        const committedRel = athlete?.committed_school as { name?: string } | { name?: string }[] | null;
        const committed = Array.isArray(committedRel) ? committedRel[0] : committedRel;
        const cote = athlete?.cote_globale_entraineur as number | null | undefined;
        const firstName = (athlete?.first_name as string) || "";
        const lastName = (athlete?.last_name as string) || "";
        return {
          id: r.id as string,
          athleteId: (athlete?.id as string) || (r.athlete_id as string),
          name: `${firstName} ${lastName}`.trim(),
          position: pos?.abreviation || "",
          verified: athlete?.verified === true,
          region: userRow?.region || "",
          heightWeight: formatHeightWeight(
            (athlete?.taille_pieds as number | null | undefined) ?? null,
            (athlete?.taille_pouces as number | null | undefined) ?? null,
            (athlete?.poids_lbs as number | null | undefined) ?? null,
          ),
          gradYear: typeof athlete?.annee_diplomation === "number" ? (athlete.annee_diplomation as number) : null,
          stars: cote != null ? Number(cote) / 2 : 0,
          recruitmentStatus: ((athlete?.statut_recrutement_override as string | null) ?? null) as GlobalRecruitmentStatus | null,
          committedSchoolName: committed?.name || null,
          openToOffers: (athlete?.open_to_offers as boolean | null) ?? null,
        };
      });
      setCivilAthletes(mapped);
    } else {
      setCivilAthletes([]);
    }
  }

  async function load() {
    const supabase = createClient();

    // Detect context FIRST. Civil coaches need a different load path
    // (league_teams + league_coaches) and a different render shape.
    // Pre-5.5d-i, civil coaches landing here would either 404 (team
    // not in `teams` table) or render the école shell with empty
    // school-side data.
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("users")
      .select("context")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profile?.context === "ligue_civile") {
      setIsCivil(true);
      await loadCivilTeam(authUser.id);
      setLoading(false);
      return;
    }

    // ── École path (unchanged below) ──
    const { data: t } = await supabase
      .from("teams")
      .select("name, age_group, division, league, season, school_id, sport_id, sports!sport_id(nom)")
      .eq("id", teamId)
      .single();
    if (!t) { setLoading(false); return; }

    const sportRel = (t as any).sports;
    const sport = Array.isArray(sportRel) ? sportRel[0] : sportRel;
    setTeam({ name: t.name, ageGroup: t.age_group || "", division: t.division || "", league: t.league || "", season: t.season || "", sportName: sport?.nom || "", sportId: t.sport_id, schoolId: t.school_id });
    setEditName(t.name); setEditAgeGroup(t.age_group || ""); setEditDivision(t.division || ""); setEditLeague(t.league || ""); setEditSeason(t.season || "2025-2026");

    // Coaches
    const { data: tc } = await supabase
      .from("team_coaches")
      .select("id, coach_id, role")
      .eq("team_id", teamId);
    if (tc) {
      // Resolve coach names
      const coachIds = tc.map((c: any) => c.coach_id).filter(Boolean);
      const nameMap = new Map<string, string>();
      if (coachIds.length > 0) {
        const { data: users } = await supabase.from("users").select("id, first_name, last_name").in("id", coachIds);
        for (const u of users || []) nameMap.set(u.id, `${u.first_name || ""} ${u.last_name || ""}`.trim());
      }
      setCoaches(tc.map((c: any) => ({
        id: c.id, coachId: c.coach_id, name: nameMap.get(c.coach_id) || "Coach", role: c.role,
      })));
    }

    // Athletes — rich row pulls verified, position, recruitment
    // status, committed-school name, region (from school), grad
    // year, height/weight components, and the coach's overall
    // rating in a single nested embed. captain + jersey columns
    // still exist on team_athletes but are no longer surfaced here
    // (P3: separate UI for membership-level edits if ever needed).
    const { data: ta } = await supabase
      .from("team_athletes")
      .select(`
        id, athlete_id,
        athletes!athlete_id(
          id, first_name, last_name, verified,
          position_id, positions!position_id(abreviation),
          statut_recrutement_override, open_to_offers,
          committed_school_id, committed_school:schools!committed_school_id(name),
          annee_diplomation, taille_pieds, taille_pouces, poids_lbs,
          cote_globale_entraineur,
          school_id, schools!school_id(name, region)
        )
      `)
      .eq("team_id", teamId);
    if (ta) {
      setAthletes(ta.map((a: any) => {
        const ath = Array.isArray(a.athletes) ? a.athletes[0] : a.athletes;
        const posRel = ath?.positions;
        const pos = Array.isArray(posRel) ? posRel[0] : posRel;
        const schoolRel = ath?.schools;
        const school = Array.isArray(schoolRel) ? schoolRel[0] : schoolRel;
        const committedRel = ath?.committed_school;
        const committed = Array.isArray(committedRel) ? committedRel[0] : committedRel;
        const cote = ath?.cote_globale_entraineur;
        return {
          id: a.id,
          athleteId: ath?.id || a.athlete_id,
          name: `${ath?.first_name || ""} ${ath?.last_name || ""}`.trim(),
          position: pos?.abreviation || "",
          verified: ath?.verified === true,
          region: school?.region || "",
          heightWeight: formatHeightWeight(ath?.taille_pieds ?? null, ath?.taille_pouces ?? null, ath?.poids_lbs ?? null),
          gradYear: typeof ath?.annee_diplomation === "number" ? ath.annee_diplomation : null,
          stars: cote != null ? Number(cote) / 2 : 0,
          recruitmentStatus: (ath?.statut_recrutement_override as GlobalRecruitmentStatus | null) ?? null,
          committedSchoolName: committed?.name || null,
          openToOffers: ath?.open_to_offers ?? null,
          school: school?.name || "",
        };
      }));
    }

    setLoading(false);
  }

  async function loadAvailableAthletes() {
    if (!team) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existingIds = athletes.map((a) => a.athleteId);
    const { data } = await supabase
      .from("athletes")
      .select("id, first_name, last_name, positions!position_id(abreviation)")
      .eq("school_id", team.schoolId)
      .not("id", "in", `(${existingIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
    if (data) {
      setAvailableAthletes(data.map((a: any) => {
        const posRel = a.positions;
        const pos = Array.isArray(posRel) ? posRel[0] : posRel;
        return { id: a.id, name: `${a.first_name || ""} ${a.last_name || ""}`.trim(), position: pos?.abreviation || "" };
      }));
    }
  }

  async function loadAvailableCoaches() {
    if (!team) return;
    const supabase = createClient();
    const existingIds = coaches.map((c) => c.coachId);
    const { data } = await supabase
      .from("users")
      .select("id, first_name, last_name")
      .eq("school_id", team.schoolId)
      .not("id", "in", `(${existingIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
    if (data) {
      setAvailableCoaches(data.map((u: any) => ({ id: u.id, name: `${u.first_name || ""} ${u.last_name || ""}`.trim() })));
    }
  }

  async function addAthlete(athleteId: string) {
    const supabase = createClient();
    await supabase.from("team_athletes").insert({ team_id: teamId, athlete_id: athleteId });
    setShowAddAthlete(false);
    showToast("Athlète ajouté");
    load();
  }

  // Civil ADMIN-only remove. RLS already permits any coach in
  // league_coaches to mutate; UI gate on ADMIN is product-layer.
  // The 5.5d-iii-a trigger nullifies athletes.league_team_id
  // automatically when the deleted membership matches the anchor.
  async function removeCivilAthlete(rowId: string, athleteName: string) {
    const confirmText = `Retirer ${athleteName} de l'équipe ? Le compte de l'athlète n'est pas supprimé, il pourra rejoindre une autre équipe.`;
    if (!confirm(confirmText)) return;
    const supabase = createClient();
    const { error } = await supabase.from("league_team_athletes").delete().eq("id", rowId);
    if (error) {
      alert("Erreur: " + error.message);
      return;
    }
    showToast("Athlète retiré");
    load();
  }

  async function addCoach(coachId: string) {
    const supabase = createClient();
    await supabase.from("team_coaches").insert({ team_id: teamId, coach_id: coachId, role: newCoachRole });
    setShowAddCoach(false);
    showToast("Entraîneur ajouté");
    load();
  }

  async function removeCoach(rowId: string) {
    const supabase = createClient();
    await supabase.from("team_coaches").delete().eq("id", rowId);
    showToast("Entraîneur retiré");
    load();
  }

  async function saveTeamInfo() {
    const supabase = createClient();
    await supabase.from("teams").update({ name: editName.trim(), age_group: editAgeGroup.trim() || null, division: editDivision.trim() || null, league: editLeague.trim() || null, season: editSeason }).eq("id", teamId);
    showToast("Informations mises à jour");
    load();
  }

  async function deactivateTeam() {
    if (!confirm("Désactiver cette équipe? Les athlètes ne seront pas supprimés.")) return;
    const supabase = createClient();
    await supabase.from("teams").update({ is_active: false }).eq("id", teamId);
    router.push("/coach/equipes");
  }

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1000px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#1A1D24] rounded w-64" />
          <div className="h-40 bg-[#1A1D24] rounded-xl" />
          <div className="h-40 bg-[#1A1D24] rounded-xl" />
        </div>
      </div>
    );
  }

  // Civil branch — header only for 5.5d-i. Subsequent sub-phases
  // extend this view with athletes (ii), mutations (iii), coaches
  // section (iv), and admin info edit (v). École JSX below this
  // branch is byte-identical to pre-5.5d-i.
  if (isCivil) {
    if (!civilHeader) return null; // redirect already fired (404/403) or in flight
    const ROLE_DISPLAY: Record<string, string> = { ADMIN: "Coach principal", COACH: "Coach" };
    const pills = [
      civilHeader.sportName,
      civilHeader.ageGroup,
      civilHeader.gender,
      civilHeader.leagueName,
      civilHeader.season,
      ROLE_DISPLAY[civilHeader.myRole] || "Coach",
    ].filter(Boolean);
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1000px] mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] text-[#6b7280]">
          <Link href="/coach/equipes" className="hover:text-white transition-colors">Mes équipes</Link>
          <span>/</span>
          <span className="text-white">{civilHeader.name}</span>
        </div>

        {/* Désactivée banner — read-only access stays available so a
            coach can still see metadata after deactivation, but the
            visual state is unmistakable. */}
        {!civilHeader.isActive && (
          <div className="bg-[#F59E0B]/[0.08] border border-[#F59E0B]/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-[13px] font-bold text-[#F59E0B]">Cette équipe est désactivée</p>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">{civilHeader.name}</h1>
          {pills.length > 0 && (
            <p className="text-[14px] text-[#9CA3AF] mt-1">{pills.join(" · ")}</p>
          )}
        </div>

        {/* 5.5d-iii-redux — Athlètes (rich row, école/civil parité).
            Mirrors the CoachAthleteRow visual model from
            /coach/athletes/page.tsx (avatar + verified + name +
            position pill + status badge + region + height/weight +
            grad year + 5-star rating). Civil ADMIN gets a hover ✕
            for remove; civil COACH stays read-only. No "+" buttons
            in the section header — civil acquisition is invitation-
            based (5.5d-vi), not pool selection. */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
          <h2 className={sectionTitle}>Athlètes ({civilAthletes.length})</h2>
          {civilAthletes.length === 0 ? (
            <p className="text-[13px] text-[#4a4d56]">Aucun athlète dans cette équipe</p>
          ) : (
            <div className="space-y-2">
              {civilAthletes.map((a) => {
                const isAdmin = civilHeader.myRole === "ADMIN";
                return (
                  <div key={a.id} className="bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 transition-all duration-200 ease-out flex items-center px-4 py-3 gap-3 group">
                    {/* Avatar + verified */}
                    <Link href={`/coach/athletes/${a.athleteId}`} className="relative w-10 h-10 shrink-0 block">
                      <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center">
                        <span className="text-[11px] font-bold text-[#9CA3AF]">
                          {a.name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2) || "?"}
                        </span>
                      </div>
                      {a.verified && (
                        <div className="absolute -top-0.5 -right-0.5 z-10">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        </div>
                      )}
                    </Link>
                    {/* Name (no school sub-line for civil) */}
                    <div className="w-[180px] shrink-0">
                      <Link href={`/coach/athletes/${a.athleteId}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate block">
                        {a.name || "—"}
                      </Link>
                    </div>
                    {/* Position */}
                    <div className="w-[50px] shrink-0">
                      {a.position ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">{a.position}</span>
                      ) : <span className="text-[#4a4d56]">—</span>}
                    </div>
                    {/* Status badge */}
                    <div className="w-[140px] shrink-0">
                      <RecruitmentStatusBadge
                        status={(a.recruitmentStatus || "OUVERT") as GlobalRecruitmentStatus}
                        committedSchoolName={a.committedSchoolName || undefined}
                        openToOffers={a.openToOffers}
                        size="sm"
                      />
                    </div>
                    {/* Region + height/weight */}
                    <div className="w-[130px] shrink-0">
                      {a.region && <span className="text-[12px] text-[#9CA3AF] block truncate">{a.region}</span>}
                      {a.heightWeight && <span className="text-[11px] text-[#6b7280]">{a.heightWeight}</span>}
                    </div>
                    {/* Year */}
                    <div className="w-[45px] shrink-0">
                      {a.gradYear != null ? (
                        <span className="text-[13px] text-[#9CA3AF]">{a.gradYear}</span>
                      ) : <span className="text-[#4a4d56]">—</span>}
                    </div>
                    {/* Rating stars */}
                    <div className="w-[110px] shrink-0">
                      {a.stars > 0 ? (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }, (_, i) => (
                            <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          ))}
                          <span className="text-[11px] font-bold text-[#F59E0B] ml-0.5">{a.stars.toFixed(1)}</span>
                        </div>
                      ) : <span />}
                    </div>
                    {/* Actions */}
                    <div className="flex-1 flex items-center justify-end gap-3">
                      <Link href={`/coach/athletes/${a.athleteId}`} className="text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1 shrink-0">
                        Voir <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                      </Link>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => removeCivilAthlete(a.id, a.name || "cet athlète")}
                          title="Retirer"
                          className="text-[#4a4d56] hover:text-[#E63946] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5.5d-iv will mount the coaches section.
            5.5d-v will mount admin-only info edit + deactivate. */}
      </div>
    );
  }

  if (!team) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1000px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#1A1D24] rounded w-64" />
          <div className="h-40 bg-[#1A1D24] rounded-xl" />
          <div className="h-40 bg-[#1A1D24] rounded-xl" />
        </div>
      </div>
    );
  }

  const filteredAthletes = athleteSearch
    ? availableAthletes.filter((a) => a.name.toLowerCase().includes(athleteSearch.toLowerCase()))
    : availableAthletes;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1000px] mx-auto space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-[#6b7280]">
        <Link href="/coach/equipes" className="hover:text-white transition-colors">Mes équipes</Link>
        <span>/</span>
        <span className="text-white">{team.name}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">{team.name}</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">{team.sportName}{team.ageGroup ? ` · ${team.ageGroup}` : ""}{team.division ? ` · ${team.division}` : ""}{team.league ? ` · ${team.league}` : ""} · {team.season}</p>
      </div>

      {/* ── Section A: Entraîneurs ──────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionTitle}>Entraîneurs</h2>
          <button type="button" onClick={() => { setShowAddCoach(true); loadAvailableCoaches(); }}
            className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">+ Ajouter</button>
        </div>
        {coaches.length === 0 ? (
          <p className="text-[13px] text-[#4a4d56]">Aucun entraîneur assigné</p>
        ) : (
          <div className="space-y-2">
            {coaches.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#2D3748] flex items-center justify-center">
                    <span className="text-[11px] font-bold text-[#9CA3AF]">{c.name.split(" ").map((n) => n[0]).join("")}</span>
                  </div>
                  <span className="text-[14px] font-bold text-white">{c.name}</span>
                  <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${ROLE_COLORS[c.role] || ROLE_COLORS.assistant}`}>
                    {ROLE_LABELS[c.role] || c.role}
                  </span>
                </div>
                <button type="button" onClick={() => removeCoach(c.id)} className="text-[#4a4d56] hover:text-[#E63946] transition-colors" title="Retirer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section B: Athlètes ─────────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionTitle}>Athlètes ({athletes.length})</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setShowAddAthlete(true); loadAvailableAthletes(); }}
              className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">+ Ajouter un athlète</button>
            <Link href="/coach/athletes/create" className="text-[11px] font-bold text-[#6b7280] hover:text-white transition-colors">+ Créer</Link>
          </div>
        </div>
        {athletes.length === 0 ? (
          <p className="text-[13px] text-[#4a4d56]">Aucun athlète dans cette équipe</p>
        ) : (
          <div className="space-y-2">
            {athletes.map((a) => (
              <div key={a.id} className="bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 transition-all duration-200 ease-out flex items-center px-4 py-3 gap-3 group">
                {/* Avatar + verified */}
                <Link href={`/coach/athletes/${a.athleteId}`} className="relative w-10 h-10 shrink-0 block">
                  <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center">
                    <span className="text-[11px] font-bold text-[#9CA3AF]">
                      {a.name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2) || "?"}
                    </span>
                  </div>
                  {a.verified && (
                    <div className="absolute -top-0.5 -right-0.5 z-10">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </div>
                  )}
                </Link>
                {/* Name + school sub-line (école-only) */}
                <div className="w-[180px] shrink-0">
                  <Link href={`/coach/athletes/${a.athleteId}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate block">
                    {a.name || "—"}
                  </Link>
                  {a.school && <p className="text-[12px] text-[#6b7280] truncate">{a.school}</p>}
                </div>
                {/* Position */}
                <div className="w-[50px] shrink-0">
                  {a.position ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">{a.position}</span>
                  ) : <span className="text-[#4a4d56]">—</span>}
                </div>
                {/* Status badge */}
                <div className="w-[140px] shrink-0">
                  <RecruitmentStatusBadge
                    status={(a.recruitmentStatus || "OUVERT") as GlobalRecruitmentStatus}
                    committedSchoolName={a.committedSchoolName || undefined}
                    openToOffers={a.openToOffers}
                    size="sm"
                  />
                </div>
                {/* Region + height/weight */}
                <div className="w-[130px] shrink-0">
                  {a.region && <span className="text-[12px] text-[#9CA3AF] block truncate">{a.region}</span>}
                  {a.heightWeight && <span className="text-[11px] text-[#6b7280]">{a.heightWeight}</span>}
                </div>
                {/* Year */}
                <div className="w-[45px] shrink-0">
                  {a.gradYear != null ? (
                    <span className="text-[13px] text-[#9CA3AF]">{a.gradYear}</span>
                  ) : <span className="text-[#4a4d56]">—</span>}
                </div>
                {/* Rating stars */}
                <div className="w-[110px] shrink-0">
                  {a.stars > 0 ? (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                      <span className="text-[11px] font-bold text-[#F59E0B] ml-0.5">{a.stars.toFixed(1)}</span>
                    </div>
                  ) : <span />}
                </div>
                {/* Actions: Modifier + Voir → */}
                <div className="flex-1 flex items-center justify-end gap-3">
                  <Link href={`/coach/athletes/${a.athleteId}/modifier`} className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors shrink-0">Modifier</Link>
                  <Link href={`/coach/athletes/${a.athleteId}`} className="text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1 shrink-0">
                    Voir <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section C: Informations ─────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
        <h2 className={sectionTitle}>Informations de l&apos;équipe</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div><label className={labelCls}>Nom</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} title="Nom" /></div>
          <div><label className={labelCls}>Catégorie d&apos;âge</label><input type="text" value={editAgeGroup} onChange={(e) => setEditAgeGroup(e.target.value)} placeholder="Ex: Juvénile, Cadet, Benjamin" className={inputCls} title="Catégorie d'âge" /></div>
          <div><label className={labelCls}>Division</label><input type="text" value={editDivision} onChange={(e) => setEditDivision(e.target.value)} placeholder="Ex: D1, D2, AA" className={inputCls} title="Division" /></div>
          <div><label className={labelCls}>Ligue</label><input type="text" value={editLeague} onChange={(e) => setEditLeague(e.target.value)} className={inputCls} title="Ligue" placeholder="Ex: RSEQ" /></div>
          <div><label className={labelCls}>Saison</label><select value={editSeason} onChange={(e) => setEditSeason(e.target.value)} className={inputCls} title="Saison"><option value="2025-2026">2025-2026</option><option value="2026-2027">2026-2027</option></select></div>
        </div>
        <div className="flex items-center justify-between">
          <button type="button" onClick={deactivateTeam} className="text-[12px] font-bold text-[#EF4444] hover:text-[#f87171] transition-colors">Désactiver l&apos;équipe</button>
          <button type="button" onClick={saveTeamInfo} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors">Enregistrer</button>
        </div>
      </div>

      {/* ── Add Athlete Modal ───────────────────────────────── */}
      {showAddAthlete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddAthlete(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[70vh] flex flex-col">
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Ajouter un athlète</h3>
            <input type="text" value={athleteSearch} onChange={(e) => setAthleteSearch(e.target.value)} placeholder="Rechercher..." className={`${inputCls} mb-3`} />
            <div className="flex-1 overflow-y-auto space-y-1">
              {filteredAthletes.length === 0 ? (
                <p className="text-[13px] text-[#4a4d56] py-4 text-center">Aucun athlète disponible</p>
              ) : filteredAthletes.map((a) => (
                <button key={a.id} type="button" onClick={() => addAthlete(a.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] text-left transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#2D3748] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#9CA3AF]">{a.name.split(" ").map((n) => n[0]).join("")}</span>
                  </div>
                  <span className="text-[14px] text-white">{a.name}</span>
                  {a.position && <span className="text-[11px] text-[#6b7280]">{a.position}</span>}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowAddAthlete(false)} className="mt-3 text-[13px] font-bold text-[#6b7280] hover:text-white transition-colors text-center">Fermer</button>
          </div>
        </div>
      )}

      {/* ── Add Coach Modal ─────────────────────────────────── */}
      {showAddCoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddCoach(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Ajouter un entraîneur</h3>
            <div className="mb-3">
              <label className={labelCls}>Rôle</label>
              <select value={newCoachRole} onChange={(e) => setNewCoachRole(e.target.value)} className={inputCls} title="Rôle">
                <option value="head_coach">Entraîneur-chef</option>
                <option value="assistant">Assistant</option>
                <option value="coordinator">Coordonnateur</option>
              </select>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {availableCoaches.length === 0 ? (
                <p className="text-[13px] text-[#4a4d56] py-4 text-center">Aucun entraîneur disponible</p>
              ) : availableCoaches.map((c) => (
                <button key={c.id} type="button" onClick={() => addCoach(c.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] text-left transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#2D3748] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#9CA3AF]">{c.name.split(" ").map((n) => n[0]).join("")}</span>
                  </div>
                  <span className="text-[14px] text-white">{c.name}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowAddCoach(false)} className="mt-3 text-[13px] font-bold text-[#6b7280] hover:text-white transition-colors w-full text-center">Fermer</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            <span className="text-[13px] font-bold text-white">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
