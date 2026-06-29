"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachEquipeDetailMobile — mobile dispatch of
   /coach/equipes/[teamId]. Sticky header + back chevron, team
   name + 5 pills (sport · age · division · league · season),
   sections : Entraîneurs / Athlètes / Invitations PENDING /
   Informations (drill-down) + désactivée banner if !is_active.

   Data : useCoachTeamDetail (TanStack, mirrors desktop load()).
   Mutations : direct Supabase INSERTs + invalidate ["coach-team",
   teamId] + ["coach-teams"] (which surface athlete count + roster
   on the list).

   Scope decisions (Run 3) :
   - Civil teams hide the "Ajouter un athlète" CTA → invitation
     flow only (mirrors desktop behavior at PageClient.tsx:734).
   - Désactiver l'équipe : routed to desktop via "Ouvrir le
     navigateur" NavRow link (Mobile ConfirmSheet flow can land in
     a follow-up — V1 keeps the destructive action behind the web
     full surface like Gestion d'École).
   - Cancel pending invitation : direct mutation with ConfirmSheet.
   - Informations edit : drill-down to /coach/equipes/[teamId]/modifier
     keeps the main detail page tight ; that route can also be web
     for V1 (NavRow with onTap routing).
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { useCoachTeamDetail } from "@/lib/queries/coach/useCoachTeamDetail";
import {
  CoachAthleteRowMobile, type CoachAthlete,
} from "@/components/shared/CoachAthletesMobile";
import { SwipeableRow } from "@/components/shared/SwipeableRow";
import {
  SectionLabel, Group, NavRow, ConfirmSheet, triggerHaptic, openExternal,
} from "@/components/shared/settings";
import { TeamAddCoachSheet } from "@/components/shared/teams/TeamAddCoachSheet";
import { TeamAddAthleteSheet } from "@/components/shared/teams/TeamAddAthleteSheet";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { relativeTimeFr } from "@/lib/utils/relativeTime";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

const ROLE_LABEL: Record<string, string> = {
  head_coach: "Chef",
  assistant: "Assistant",
  coordinator: "Coordo",
};
const ROLE_PILL: Record<string, string> = {
  head_coach: "bg-[#E63946]/15 text-[#E63946] border-[#E63946]/30",
  assistant: "bg-white/[0.06] text-[#9CA3AF] border-white/10",
  coordinator: "bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30",
};

/* Adapter : map the team-detail's CoachTeamDetailAthlete row to the
   CoachAthlete shape consumed by the shared CoachAthleteRowMobile.
   Fields not surfaced by the team query (photo, jersey, GPA, video,
   academic badges, favorites count) default to neutral values — the
   row only renders the slots actually used in the card. */
function toCoachAthlete(
  a: {
    athleteId: string; firstName: string; lastName: string;
    photoUrl: string; verified: boolean;
    position: string; school: string; region: string;
    anneeDiplomation: number | null; cote: number | null;
    recruitmentStatus: string | null;
    committedSchoolName: string | null; openToOffers: boolean | null;
  },
  isCivilTeam: boolean,
): CoachAthlete {
  return {
    id: a.athleteId,
    firstName: a.firstName,
    lastName: a.lastName,
    photo: a.photoUrl,
    position: a.position,
    sportName: "",
    sport: "",
    school: a.school,
    region: a.region,
    graduationYear: a.anneeDiplomation ?? 0,
    stars: a.cote != null ? a.cote / 2 : 0,
    isVerified: a.verified,
    lastValidation: null,
    jersey: "",
    recruitmentStatus: a.recruitmentStatus ?? "",
    committedSchoolName: a.committedSchoolName,
    openToOffers: a.openToOffers,
    // Civil teams have no school anchor → CoachAthleteRowMobile uses
    // noTeam to render "Ligue civile" in the sub-line instead of the
    // (empty) school name. Mirrors desktop PageClient.tsx:636's
    // school={isCivil ? "Ligue civile" : a.school} override.
    noTeam: isCivilTeam,
    coachId: null,
    favoritesCount: 0,
    hasVideo: false,
    gpa: 0,
    hasDistinction: false,
    hasAcademicBadge: false,
    createdAt: "",
  };
}

export default function CoachEquipeDetailMobile() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useMobileToast();
  const teamId = useDynamicParam("teamId");

  const { data, isLoading } = useCoachTeamDetail(teamId);
  const team = data?.team;
  const coaches = data?.coaches ?? [];
  const athletes = data?.athletes ?? [];
  const pending = data?.pendingInvitations ?? [];

  const [scrolled, setScrolled] = useState(false);
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [confirmRemoveAthlete, setConfirmRemoveAthlete] = useState<{ id: string; name: string } | null>(null);
  const [confirmRemoveCoach, setConfirmRemoveCoach] = useState<{ id: string; name: string } | null>(null);
  const [confirmCancelInvite, setConfirmCancelInvite] = useState<{ id: string; name: string } | null>(null);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["coach-team", teamId] });
    qc.invalidateQueries({ queryKey: ["coach-teams"] });
  }

  async function addCoachToTeam(coachId: string, role: "head_coach" | "assistant" | "coordinator") {
    if (!teamId) return;
    const supabase = createClient();
    const { error } = await supabase.from("team_coaches").insert({ team_id: teamId, coach_id: coachId, role });
    if (error) { toast.error({ message: error.message }); return; }
    triggerHaptic("Medium");
    toast.success({ message: "Entraîneur ajouté" });
    setShowAddCoach(false);
    invalidate();
  }

  async function addAthleteToTeam(athleteId: string) {
    if (!teamId) return;
    const supabase = createClient();
    const { error } = await supabase.from("team_athletes").insert({ team_id: teamId, athlete_id: athleteId });
    if (error) { toast.error({ message: error.message }); return; }
    triggerHaptic("Medium");
    toast.success({ message: "Athlète ajouté" });
    setShowAddAthlete(false);
    invalidate();
  }

  async function removeAthlete(rowId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("team_athletes").delete().eq("id", rowId);
    if (error) { toast.error({ message: error.message }); return; }
    triggerHaptic("Medium");
    toast.success({ message: "Athlète retiré" });
    setConfirmRemoveAthlete(null);
    invalidate();
  }

  async function removeCoach(rowId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("team_coaches").delete().eq("id", rowId);
    if (error) { toast.error({ message: error.message }); return; }
    triggerHaptic("Medium");
    toast.success({ message: "Entraîneur retiré" });
    setConfirmRemoveCoach(null);
    invalidate();
  }

  async function cancelInvitation(inviteId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("team_invitations")
      .update({ status: "CANCELLED", responded_at: new Date().toISOString() })
      .eq("id", inviteId);
    if (error) { toast.error({ message: error.message }); return; }
    triggerHaptic("Medium");
    toast.success({ message: "Invitation annulée" });
    setConfirmCancelInvite(null);
    invalidate();
  }

  // Loading skeleton
  if (isLoading || !team) {
    return (
      <div className="min-h-screen bg-[#111317] px-4 pt-24 space-y-3">
        <div className="h-7 bg-[#1A1D24] rounded w-48 animate-pulse" />
        <div className="h-4 bg-[#1A1D24] rounded w-64 animate-pulse" />
        <div className="h-32 bg-[#1A1D24] rounded-2xl animate-pulse mt-6" />
        <div className="h-48 bg-[#1A1D24] rounded-2xl animate-pulse" />
      </div>
    );
  }

  const pills = [team.sportName, team.ageGroup, team.division, team.league, team.season].filter(Boolean);
  const isAdmin = team.myRole === "ADMIN";

  return (
    <div
      className="min-h-screen bg-[#111317]"
      onScroll={(e) => setScrolled((e.target as HTMLDivElement).scrollTop > 4)}
      style={{ overflowY: "auto", height: "100dvh" }}
    >
      {/* Sticky header w/ back chevron */}
      <div
        className="sticky top-0 z-30 px-2 py-3 flex items-center gap-1"
        style={{
          backgroundColor: scrolled ? "rgba(17,19,23,0.85)" : "#111317",
          backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          borderBottom: scrolled ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid transparent",
          transition: "background-color 200ms ease-out, backdrop-filter 200ms ease-out, border-bottom-color 200ms ease-out",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
        }}
      >
        <button
          type="button"
          onClick={() => { triggerHaptic("Light"); router.push("/coach/equipes"); }}
          className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.04]"
          aria-label="Retour"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="font-head text-[17px] font-black text-white uppercase tracking-tight truncate flex-1">
          {team.name}
        </h1>
      </div>

      <div className="px-4 pt-2 pb-32 space-y-6">
        {/* Header pills */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pills.map((p, i) => (
              <span
                key={i}
                className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded bg-[#1A1D24] border border-white/10 text-[#9CA3AF]"
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Désactivée banner */}
        {!team.isActive && (
          <div className="bg-[#EF4444]/[0.06] border border-[#EF4444]/20 rounded-2xl p-4">
            <p className="text-[13px] font-bold text-[#EF4444]">Équipe désactivée</p>
            <p className="text-[12px] text-[#9CA3AF] mt-0.5">
              Cette équipe n&apos;apparaît plus aux recruteurs. Réactive-la sur le web.
            </p>
          </div>
        )}

        {/* ── Entraîneurs ─────────────────────────────────────── */}
        <div>
          <SectionLabel>Entraîneurs ({coaches.length})</SectionLabel>
          <Group>
            {coaches.map((c, i) => {
              const initials = c.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div
                  key={c.id}
                  className="w-full flex items-center px-4 gap-3"
                  style={{ minHeight: 60, borderTop: i === 0 ? undefined : "0.5px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-[#9CA3AF]">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-white truncate">{c.name}</p>
                    <span
                      className={`inline-block mt-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${ROLE_PILL[c.role] || ROLE_PILL.assistant}`}
                    >
                      {ROLE_LABEL[c.role] || c.role}
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveCoach({ id: c.id, name: c.name })}
                      className="w-9 h-9 rounded-full flex items-center justify-center active:bg-white/[0.04]"
                      aria-label="Retirer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
            {isAdmin && (
              <NavRow
                label="Ajouter un entraîneur"
                isFirst={coaches.length === 0}
                onTap={() => { triggerHaptic("Light"); setShowAddCoach(true); }}
              />
            )}
          </Group>
        </div>

        {/* ── Athlètes ────────────────────────────────────────── */}
        <div>
          <SectionLabel>Athlètes ({athletes.length})</SectionLabel>
          {athletes.length > 0 && (
            <div className="space-y-2">
              {athletes.map((a) => (
                <SwipeableRow
                  key={a.id}
                  onCommit={() => {
                    triggerHaptic("Medium");
                    setConfirmRemoveAthlete({ id: a.id, name: a.name });
                  }}
                  action={{
                    label: "Retirer",
                    color: "#E63946",
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                      </svg>
                    ),
                  }}
                  rowClassName="relative bg-[#1A1D24] rounded-2xl z-[1]"
                >
                  <CoachAthleteRowMobile
                    a={toCoachAthlete(a, team.isCivil)}
                    onTap={() => { triggerHaptic("Light"); router.push(`/coach/athletes/${a.athleteId}`); }}
                  />
                </SwipeableRow>
              ))}
            </div>
          )}
          <div className="mt-2">
            <Group>
              {!team.isCivil && (
                <NavRow
                  label="Ajouter un athlète"
                  sublabel="Choisis depuis ton roster"
                  isFirst
                  onTap={() => { triggerHaptic("Light"); setShowAddAthlete(true); }}
                />
              )}
              <NavRow
                label="Créer un nouvel athlète"
                isFirst={team.isCivil}
                onTap={() => { triggerHaptic("Light"); router.push("/coach/athletes/create"); }}
              />
            </Group>
          </div>
        </div>

        {/* ── Invitations PENDING ─────────────────────────────── */}
        {pending.length > 0 && (
          <div>
            <SectionLabel>Invitations en attente ({pending.length})</SectionLabel>
            <Group>
              {pending.map((p, i) => {
                const initials = p.athleteName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "?";
                return (
                  <div
                    key={p.id}
                    className="w-full flex items-center px-4 gap-3"
                    style={{ minHeight: 60, borderTop: i === 0 ? undefined : "0.5px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-[#F59E0B]">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] text-white truncate">{p.athleteName}</p>
                      <p className="text-[11px] text-[#6b7280] mt-0.5">
                        {[p.position, relativeTimeFr(p.createdAt)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmCancelInvite({ id: p.id, name: p.athleteName })}
                      className="text-[12px] font-bold text-[#EF4444] active:opacity-60 px-2"
                    >
                      Annuler
                    </button>
                  </div>
                );
              })}
            </Group>
          </div>
        )}

        {/* ── Informations (drill-down) ───────────────────────── */}
        <div>
          <SectionLabel>Informations</SectionLabel>
          <Group>
            <NavRow label="Nom" value={team.name || "—"} isFirst rightChevron="none" />
            <NavRow label="Catégorie d'âge" value={team.ageGroup || "—"} isFirst={false} rightChevron="none" />
            <NavRow label="Division" value={team.division || "—"} isFirst={false} rightChevron="none" />
            <NavRow label="Ligue" value={team.league || "—"} isFirst={false} rightChevron="none" />
            <NavRow label="Saison" value={team.season || "—"} isFirst={false} rightChevron="none" />
            <NavRow label="Genre" value={team.gender || "—"} isFirst={false} rightChevron="none" />
            {isAdmin && (
              <NavRow
                label="Modifier les informations"
                sublabel="Disponible sur l'écran de bureau"
                isFirst={false}
                rightChevron={IS_CAPACITOR ? "none" : "external"}
                onTap={() => {
                  triggerHaptic("Light");
                  if (IS_CAPACITOR) {
                    // iOS (3.1.1) : pas d'ouverture du web (tunnel d'achat joignable).
                    toast.info({ message: "Disponible sur la version web", detail: "La modification se fait sur nexussports.ca." });
                  } else {
                    openExternal(`https://nexussports.ca/coach/equipes/${teamId}`);
                  }
                }}
              />
            )}
          </Group>
        </div>
      </div>

      {/* Picker sheets */}
      <TeamAddCoachSheet
        open={showAddCoach}
        onClose={() => setShowAddCoach(false)}
        schoolId={team.schoolId || null}
        excludeIds={coaches.map((c) => c.coachId)}
        onPicked={addCoachToTeam}
      />
      <TeamAddAthleteSheet
        open={showAddAthlete}
        onClose={() => setShowAddAthlete(false)}
        schoolId={team.schoolId || null}
        excludeIds={athletes.map((a) => a.athleteId)}
        onPicked={addAthleteToTeam}
        onCreateNew={() => router.push("/coach/athletes/create")}
      />

      {/* Confirm sheets */}
      <ConfirmSheet
        open={!!confirmRemoveAthlete}
        onClose={() => setConfirmRemoveAthlete(null)}
        title="Retirer cet athlète de l'équipe ?"
        message={
          confirmRemoveAthlete
            ? `${confirmRemoveAthlete.name} ne sera plus rattaché·e à cette équipe. Son compte n'est pas supprimé.`
            : ""
        }
        confirmLabel="Retirer"
        onConfirm={() => confirmRemoveAthlete && removeAthlete(confirmRemoveAthlete.id)}
      />
      <ConfirmSheet
        open={!!confirmRemoveCoach}
        onClose={() => setConfirmRemoveCoach(null)}
        title="Retirer cet entraîneur ?"
        message={
          confirmRemoveCoach
            ? `${confirmRemoveCoach.name} ne sera plus listé·e comme entraîneur de cette équipe.`
            : ""
        }
        confirmLabel="Retirer"
        onConfirm={() => confirmRemoveCoach && removeCoach(confirmRemoveCoach.id)}
      />
      <ConfirmSheet
        open={!!confirmCancelInvite}
        onClose={() => setConfirmCancelInvite(null)}
        title="Annuler l'invitation ?"
        message={
          confirmCancelInvite
            ? `L'invitation envoyée à ${confirmCancelInvite.name} sera annulée.`
            : ""
        }
        confirmLabel="Annuler l'invitation"
        onConfirm={() => confirmCancelInvite && cancelInvitation(confirmCancelInvite.id)}
      />
    </div>
  );
}
