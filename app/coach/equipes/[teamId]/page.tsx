"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import { relativeTimeFr } from "@/lib/utils/relativeTime";
import { orgLabelPossessive, isCivilType, type SchoolType } from "@/lib/utils/orgLabel";
import { getCurrentSeason } from "@/lib/utils/season";
import CoachAthleteRow from "@/components/coach/CoachAthleteRow";

/* ═══════════════════════════════════════════════════════════════
   Team Detail — Manage coaches + athletes for a single team.

   Phase 6.2.d: collapsed the 5.5d civil early-return branch into a
   single unified code path. Post-Phase 6.1 the DB stores civil teams
   in `teams` (with schools.type='LIGUE_CIVILE') and civil rosters in
   `team_athletes`, so this page no longer needs to fork on context.
   UI labels are contextualised via lib/utils/orgLabel.

   Rich-row layout (verified + position + status badge + region +
   height/weight + grad year + 5-star rating) is shared across all
   school types. Civil acquisition stays invitation-only (no +
   Ajouter button when isCivil) — école/cégep still pick from the
   school's athlete pool.
═══════════════════════════════════════════════════════════════ */

interface TeamCoach { id: string; coachId: string; name: string; role: string }

interface TeamAthlete {
  id: string;          // team_athletes junction row id
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
  school: string;      // school sub-line (blank for civil teams)
}

// PENDING invitations visible on the team page (5.5e-v).
// Post-Phase 6.1 the column is team_id (renamed from league_team_id)
// and FKs to teams, so school + civil teams share this surface.
interface PendingInvitationRow {
  id: string;          // team_invitations.id
  athleteId: string;
  athleteName: string;
  position: string;    // abreviation
  createdAt: string;
}

interface AvailableAthlete { id: string; name: string; position: string }
interface AvailableCoach { id: string; name: string }

// Team header shape. `schoolType` discriminates UI behavior — civil
// teams hide the école-pool add modal and surface a hover-X remove
// button instead of a Modifier link.
interface TeamState {
  name: string;
  ageGroup: string;
  division: string;
  league: string;
  season: string;
  sportName: string;
  sportId: string;
  schoolId: string;
  schoolName: string;
  schoolType: SchoolType | null;
  gender: string;
  isActive: boolean;
  myRole: "ADMIN" | "COACH";
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

  const [team, setTeam] = useState<TeamState | null>(null);
  const [coaches, setCoaches] = useState<TeamCoach[]>([]);
  const [athletes, setAthletes] = useState<TeamAthlete[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitationRow[]>([]);
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

  // Derived context flag. After Phase 6.1 schools.type drives
  // everything UI-side; no more users.context guard.
  const isCivil = isCivilType(team?.schoolType);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  useEffect(() => { load(); }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unified load. Reads `teams` + `schools` (for type discriminator)
  // + `sports` (name embed), plus the user's team_coaches role for
  // 404/403 redirects. Roster from team_athletes; coaches from
  // team_coaches; PENDING invitations from team_invitations (column
  // renamed league_team_id → team_id in Phase 6.1.a).
  async function load() {
    const supabase = createClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setLoading(false); return; }

    // ── Team header + school type ─────────────────────────────
    const { data: t } = await supabase
      .from("teams")
      .select(`
        name, age_group, division, league, season, gender, is_active,
        school_id, sport_id,
        sports!sport_id(nom),
        schools!school_id(name, type)
      `)
      .eq("id", teamId)
      .maybeSingle();

    if (!t) {
      // Team missing → silent 404 redirect (route is broken regardless
      // of école/civil context). Apply to both.
      router.replace("/coach/equipes");
      return;
    }

    // Resolve schoolType early so we can differentiate the no-coach
    // route guard behavior below (école = soft skeleton, civil =
    // redirect — restoring the pre-Phase-6.2.d original behavior
    // per BP feedback).
    const tRecPre = t as Record<string, unknown>;
    const schoolRelPre = tRecPre.schools as { name?: string; type?: string } | { name?: string; type?: string }[] | null;
    const schoolRowPre = Array.isArray(schoolRelPre) ? schoolRelPre[0] : schoolRelPre;
    const teamSchoolType = (schoolRowPre?.type ?? null) as SchoolType | null;
    const isTeamCivil = isCivilType(teamSchoolType);

    // ── Role check (any coach on the team can read; ADMIN gets
    //    edit affordances downstream) ────────────────────────────
    const { data: roleRow } = await supabase
      .from("team_coaches")
      .select("role")
      .eq("team_id", teamId)
      .eq("coach_id", authUser.id)
      .order("role")
      .limit(1)
      .maybeSingle();

    // No team_coaches row for the current user :
    //   - Civil (LIGUE_CIVILE) : redirect (pre-Phase-6.2.d behavior)
    //   - École/Cégep : soft fall-through (setLoading(false), renders
    //     the empty skeleton branch — pre-Phase-6.2.d behavior).
    // RLS already blocks roster reads via team_athletes / team_coaches
    // policies, so the école skeleton renders without sensitive data.
    if (!roleRow) {
      if (isTeamCivil) {
        router.replace("/coach/equipes");
      } else {
        setLoading(false);
      }
      return;
    }

    const tRec = t as Record<string, unknown>;
    const sportRel = tRec.sports as { nom?: string } | { nom?: string }[] | null;
    const sport = Array.isArray(sportRel) ? sportRel[0] : sportRel;
    const schoolRel = tRec.schools as { name?: string; type?: string } | { name?: string; type?: string }[] | null;
    const schoolRow = Array.isArray(schoolRel) ? schoolRel[0] : schoolRel;
    const rawRole = (roleRow as { role?: string } | null)?.role;
    const myRole: "ADMIN" | "COACH" = rawRole === "head_coach" || rawRole === "ADMIN" ? "ADMIN" : "COACH";

    const teamState: TeamState = {
      name: (tRec.name as string) || "",
      ageGroup: (tRec.age_group as string) || "",
      division: (tRec.division as string) || "",
      league: (tRec.league as string) || "",
      season: (tRec.season as string) || "",
      sportName: sport?.nom || "",
      sportId: (tRec.sport_id as string) || "",
      schoolId: (tRec.school_id as string) || "",
      schoolName: schoolRow?.name || "",
      schoolType: (schoolRow?.type as SchoolType | undefined) ?? null,
      gender: (tRec.gender as string) || "",
      isActive: (tRec.is_active as boolean) ?? true,
      myRole,
    };

    setTeam(teamState);
    setEditName(teamState.name);
    setEditAgeGroup(teamState.ageGroup);
    setEditDivision(teamState.division);
    setEditLeague(teamState.league);
    setEditSeason(teamState.season || getCurrentSeason());

    // ── Coaches ──────────────────────────────────────────────
    const { data: tc } = await supabase
      .from("team_coaches")
      .select("id, coach_id, role")
      .eq("team_id", teamId);
    if (tc) {
      const coachIds = tc.map((c: { coach_id: string }) => c.coach_id).filter(Boolean);
      const nameMap = new Map<string, string>();
      if (coachIds.length > 0) {
        const { data: users } = await supabase.from("users").select("id, first_name, last_name").in("id", coachIds);
        for (const u of users || []) nameMap.set(u.id, `${u.first_name || ""} ${u.last_name || ""}`.trim());
      }
      setCoaches(tc.map((c: { id: string; coach_id: string; role: string }) => ({
        id: c.id, coachId: c.coach_id, name: nameMap.get(c.coach_id) || "Coach", role: c.role,
      })));
    } else {
      setCoaches([]);
    }

    // ── Athletes (team_athletes — unified across school types) ──
    // Rich row pulls verified, position, recruitment status,
    // committed-school name, region (from school for SECONDAIRE/
    // CEGEP, from users.region as fallback for LIGUE_CIVILE), grad
    // year, height/weight components, coach overall rating.
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
          school_id, schools!school_id(name, region, type),
          user_id, users!athletes_user_id_fkey(region)
        )
      `)
      .eq("team_id", teamId);
    if (ta) {
      setAthletes(ta.map((a: Record<string, unknown>) => {
        const athleteRel = a.athletes as Record<string, unknown> | Record<string, unknown>[] | null;
        const ath = (Array.isArray(athleteRel) ? athleteRel[0] : athleteRel) as Record<string, unknown> | null;
        const posRel = ath?.positions as { abreviation?: string } | { abreviation?: string }[] | null;
        const pos = Array.isArray(posRel) ? posRel[0] : posRel;
        const schoolRel2 = ath?.schools as { name?: string; region?: string; type?: string } | { name?: string; region?: string; type?: string }[] | null;
        const athleteSchool = Array.isArray(schoolRel2) ? schoolRel2[0] : schoolRel2;
        const committedRel = ath?.committed_school as { name?: string } | { name?: string }[] | null;
        const committed = Array.isArray(committedRel) ? committedRel[0] : committedRel;
        const userRel = ath?.users as { region?: string } | { region?: string }[] | null;
        const userRow = Array.isArray(userRel) ? userRel[0] : userRel;
        const cote = ath?.cote_globale_entraineur as number | null | undefined;
        const firstName = (ath?.first_name as string) || "";
        const lastName = (ath?.last_name as string) || "";
        // Civil athletes typically have no school anchor → fall back to
        // users.region. École/cégep athletes use school.region directly.
        const schoolIsCivil = athleteSchool?.type === "LIGUE_CIVILE";
        const region = schoolIsCivil
          ? (userRow?.region || "")
          : (athleteSchool?.region || userRow?.region || "");
        // Sub-line school: only meaningful when the athlete's
        // anchor is a real school (not a civil placeholder).
        const schoolSubLine = schoolIsCivil ? "" : (athleteSchool?.name || "");
        return {
          id: a.id as string,
          athleteId: (ath?.id as string) || (a.athlete_id as string),
          name: `${firstName} ${lastName}`.trim(),
          position: pos?.abreviation || "",
          verified: ath?.verified === true,
          region,
          heightWeight: formatHeightWeight(
            (ath?.taille_pieds as number | null | undefined) ?? null,
            (ath?.taille_pouces as number | null | undefined) ?? null,
            (ath?.poids_lbs as number | null | undefined) ?? null,
          ),
          gradYear: typeof ath?.annee_diplomation === "number" ? (ath.annee_diplomation as number) : null,
          stars: cote != null ? Number(cote) / 2 : 0,
          recruitmentStatus: ((ath?.statut_recrutement_override as string | null) ?? null) as GlobalRecruitmentStatus | null,
          committedSchoolName: committed?.name || null,
          openToOffers: (ath?.open_to_offers as boolean | null) ?? null,
          school: schoolSubLine,
        };
      }));
    } else {
      setAthletes([]);
    }

    // ── PENDING invitations (5.5e-v, post-rename) ───────────────
    // RLS policy "Coaches select invitations on own teams" scopes
    // the read to coaches on the team. We still constrain by
    // team_id explicitly so the query is correct regardless of
    // which row team_coaches resolves first.
    const { data: pendingRows } = await supabase
      .from("team_invitations")
      .select(`
        id, created_at,
        athletes!athlete_id(
          id, first_name, last_name,
          position_id, positions!position_id(abreviation)
        )
      `)
      .eq("team_id", teamId)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });

    if (pendingRows) {
      setPendingInvitations(pendingRows.map((row) => {
        const r = row as Record<string, unknown>;
        const athleteRel = r.athletes as Record<string, unknown> | Record<string, unknown>[] | null;
        const athlete = (Array.isArray(athleteRel) ? athleteRel[0] : athleteRel) ?? {};
        const posRel = (athlete as Record<string, unknown>).positions as { abreviation?: string } | { abreviation?: string }[] | null;
        const pos = Array.isArray(posRel) ? posRel[0] : posRel;
        const firstName = ((athlete as { first_name?: string }).first_name) || "";
        const lastName = ((athlete as { last_name?: string }).last_name) || "";
        return {
          id: r.id as string,
          athleteId: ((athlete as { id?: string }).id) || "",
          athleteName: `${firstName} ${lastName}`.trim(),
          position: pos?.abreviation || "",
          createdAt: r.created_at as string,
        };
      }));
    } else {
      setPendingInvitations([]);
    }

    setLoading(false);
  }

  async function loadAvailableAthletes() {
    if (!team) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existingIds = athletes.map((a) => a.athleteId);
    // École/cégep: pool from same school. Civil teams use the
    // invitation flow (5.5d-vi) — this modal isn't surfaced for them.
    const { data } = await supabase
      .from("athletes")
      .select("id, first_name, last_name, positions!position_id(abreviation)")
      .eq("school_id", team.schoolId)
      .not("id", "in", `(${existingIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
    if (data) {
      setAvailableAthletes(data.map((a: Record<string, unknown>) => {
        const posRel = a.positions as { abreviation?: string } | { abreviation?: string }[] | null;
        const pos = Array.isArray(posRel) ? posRel[0] : posRel;
        return {
          id: a.id as string,
          name: `${(a.first_name as string) || ""} ${(a.last_name as string) || ""}`.trim(),
          position: pos?.abreviation || "",
        };
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
      setAvailableCoaches(data.map((u: Record<string, unknown>) => ({
        id: u.id as string,
        name: `${(u.first_name as string) || ""} ${(u.last_name as string) || ""}`.trim(),
      })));
    }
  }

  async function addAthlete(athleteId: string) {
    const supabase = createClient();
    await supabase.from("team_athletes").insert({ team_id: teamId, athlete_id: athleteId });
    setShowAddAthlete(false);
    showToast("Athlète ajouté");
    load();
  }

  // Remove athlete from team_athletes. Trigger
  // `reset_athlete_anchor_on_team_remove` (6.1.c) handles the
  // school_id null-out automatically for LIGUE_CIVILE anchors and
  // preserves school_id for SECONDAIRE/CEGEP. RLS already permits
  // any coach in team_coaches to mutate.
  async function removeAthlete(rowId: string, athleteName: string) {
    const confirmText = `Retirer ${athleteName} de l'équipe ? Le compte de l'athlète n'est pas supprimé, il pourra rejoindre une autre équipe.`;
    if (!confirm(confirmText)) return;
    const supabase = createClient();
    const { error } = await supabase.from("team_athletes").delete().eq("id", rowId);
    if (error) {
      alert("Erreur: " + error.message);
      return;
    }
    showToast("Athlète retiré");
    load();
  }

  // Cancel a PENDING invitation. RLS "Coaches cancel own
  // invitations" gates the UPDATE; WITH CHECK clamps status to
  // 'CANCELLED'. Same load() refresh pattern as removeAthlete so
  // both sections stay in sync.
  async function handleCancelInvitation(invitationId: string, athleteName: string) {
    if (!window.confirm(`Annuler l'invitation à ${athleteName} ?`)) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("team_invitations")
      .update({ status: "CANCELLED", responded_at: new Date().toISOString() })
      .eq("id", invitationId);
    if (error) {
      alert("Erreur: " + error.message);
      return;
    }
    showToast("Invitation annulée");
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
    await supabase.from("teams").update({
      name: editName.trim(),
      age_group: editAgeGroup.trim() || null,
      division: editDivision.trim() || null,
      league: editLeague.trim() || null,
      season: editSeason,
    }).eq("id", teamId);
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

  // Header subtitle pills — civil teams show league/sport/age/
  // gender/season/role; école/cégep show sport/age/division/
  // league/season. Both filter empty values cleanly.
  const headerPills: string[] = isCivil
    ? [
        team.sportName,
        team.ageGroup,
        team.gender,
        team.schoolName,
        team.season,
        team.myRole === "ADMIN" ? "Coach principal" : "Coach",
      ].filter(Boolean)
    : [
        team.sportName,
        team.ageGroup,
        team.division,
        team.league,
        team.season,
      ].filter(Boolean);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1000px] mx-auto space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-[#6b7280]">
        <Link href="/coach/equipes" className="hover:text-white transition-colors">Mes équipes</Link>
        <span>/</span>
        <span className="text-white">{team.name}</span>
      </div>

      {/* Désactivée banner — applies to any school type. Read-only
          access remains so a coach can still see metadata after
          deactivation. */}
      {!team.isActive && (
        <div className="bg-[#F59E0B]/[0.08] border border-[#F59E0B]/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-[13px] font-bold text-[#F59E0B]">Cette équipe est désactivée</p>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">{team.name}</h1>
        {headerPills.length > 0 && (
          <p className="text-[14px] text-[#9CA3AF] mt-1">{headerPills.join(" · ")}</p>
        )}
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
          {/* Civil teams use invitations (5.5d-vi) instead of a pool
              picker — hide the + Ajouter button. + Créer stays
              available across contexts (coach manually entering an
              athlete who isn't on the platform). */}
          <div className="flex items-center gap-2">
            {!isCivil && (
              <button type="button" onClick={() => { setShowAddAthlete(true); loadAvailableAthletes(); }}
                className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">+ Ajouter un athlète</button>
            )}
            <Link href="/coach/athletes/create" className="text-[11px] font-bold text-[#6b7280] hover:text-white transition-colors">+ Créer</Link>
          </div>
        </div>
        {athletes.length === 0 ? (
          <p className="text-[13px] text-[#4a4d56]">Aucun athlète dans cette équipe</p>
        ) : (
          <div className="space-y-2">
            {athletes.map((a) => (
              <CoachAthleteRow
                key={a.id}
                athleteId={a.athleteId}
                firstName={a.name.split(" ")[0] || ""}
                lastName={a.name.split(" ").slice(1).join(" ") || ""}
                isVerified={a.verified}
                school={isCivil ? "Ligue civile" : a.school}
                position={a.position}
                recruitmentStatus={a.recruitmentStatus}
                committedSchoolName={a.committedSchoolName}
                openToOffers={a.openToOffers}
                region={a.region}
                heightWeight={a.heightWeight}
                gradYear={a.gradYear}
                stars={a.stars}
                showRegion={false}
                showYear={false}
              >
                {/* Spacer takes leftover row width so the action group
                    anchors against the right edge. Caller-side because
                    the athletes-page row already has a flex-1 child
                    (badges) and doesn't need this. */}
                <div className="flex-1 min-w-0" />
                {/* Actions: Modifier (école/cégep) + Voir → + remove ✕
                    on hover (any coach via team_athletes RLS) */}
                <div className="flex items-center gap-3 shrink-0">
                  {!isCivil && (
                    <Link href={`/coach/athletes/${a.athleteId}/modifier`} className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors shrink-0">Modifier</Link>
                  )}
                  <Link href={`/coach/athletes/${a.athleteId}`} className="text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1 shrink-0">
                    Voir <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeAthlete(a.id, a.name || "cet athlète")}
                    title="Retirer de l'équipe"
                    className="text-[#4a4d56] hover:text-[#E63946] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </CoachAthleteRow>
            ))}
          </div>
        )}
      </div>

      {/* ── Invitations envoyées (PENDING) ─────────────────────
          Self-hides when 0. team_invitations is unified post-6.1
          (column renamed league_team_id → team_id), so this surface
          is universal. Civil flow A (5.5e-iv-a) is currently the
          primary user but école/cégep can also send via the same
          table. */}
      {pendingInvitations.length > 0 && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
          <h2 className={sectionTitle}>Invitations envoyées ({pendingInvitations.length})</h2>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 transition-all duration-200 ease-out flex items-center px-4 py-3 gap-3 group">
                <Link href={`/coach/athletes/${inv.athleteId}`} className="relative w-10 h-10 shrink-0 block">
                  <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center">
                    <span className="text-[11px] font-bold text-[#9CA3AF]">
                      {inv.athleteName.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2) || "?"}
                    </span>
                  </div>
                </Link>
                <div className="w-[180px] shrink-0">
                  <Link href={`/coach/athletes/${inv.athleteId}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate block">
                    {inv.athleteName || "—"}
                  </Link>
                </div>
                <div className="w-[50px] shrink-0">
                  {inv.position ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">{inv.position}</span>
                  ) : <span className="text-[#4a4d56]">—</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] text-[#6b7280]" title={new Date(inv.createdAt).toLocaleString("fr-CA")}>
                    Envoyée {relativeTimeFr(inv.createdAt).toLowerCase()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCancelInvitation(inv.id, inv.athleteName || "cet athlète")}
                  className="text-[12px] font-bold text-[#9CA3AF] hover:text-[#E63946] border border-[#2D3748] hover:border-[#E63946]/50 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  Annuler
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <button type="button" onClick={deactivateTeam} className="text-[12px] font-bold text-[#EF4444] hover:text-[#f87171] transition-colors">
            Désactiver {orgLabelPossessive(team.schoolType).toLowerCase().startsWith("ma") ? "ma" : "mon"} équipe
          </button>
          <button type="button" onClick={saveTeamInfo} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors">Enregistrer</button>
        </div>
      </div>

      {/* ── Add Athlete Modal (école/cégep only) ────────────── */}
      {showAddAthlete && !isCivil && (
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
