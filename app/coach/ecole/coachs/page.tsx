"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SchoolGate from "@/components/subscription/SchoolGate";
import type { CoachOverview } from "@/lib/types/models";

/* ── Helpers ─────────────────────────────────────────────── */

function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  const diffW = Math.floor(diffD / 7);
  const diffM = Math.floor(diffD / 30);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH} heure${diffH > 1 ? "s" : ""}`;
  if (diffD < 7) return `Il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;
  if (diffW < 5) return `Il y a ${diffW} semaine${diffW > 1 ? "s" : ""}`;
  return `Il y a ${diffM} mois`;
}

function getDaysAgo(isoDate: string): number {
  return Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getLoginColor(isoDate: string): string {
  const days = getDaysAgo(isoDate);
  if (days < 7) return "text-white";
  if (days <= 30) return "text-[#F59E0B]";
  return "text-[#E63946]";
}

const STATUS_DOT: Record<CoachOverview["status"], string> = {
  active: "#22C55E",
  inactive_7d: "#F59E0B",
  inactive_30d: "#E63946",
};

const STATUS_LABEL: Record<CoachOverview["status"], string> = {
  active: "Actif",
  inactive_7d: "Inactif 7j",
  inactive_30d: "Inactif 30j+",
};

const SPORT_COLORS: Record<string, string> = {
  Football: "bg-[#3B82F6]/20 text-[#60A5FA]",
  Hockey: "bg-[#8B5CF6]/20 text-[#A78BFA]",
  Basketball: "bg-[#F97316]/20 text-[#FB923C]",
  Volleyball: "bg-[#22C55E]/20 text-[#4ADE80]",
  Soccer: "bg-[#06B6D4]/20 text-[#22D3EE]",
  Natation: "bg-[#0EA5E9]/20 text-[#38BDF8]",
  Badminton: "bg-[#EC4899]/20 text-[#F472B6]",
};

type SortKey =
  | "name"
  | "sport"
  | "athleteCount"
  | "profileCompletionRate"
  | "recruiterViews30d"
  | "messagesReceived"
  | "lastLoginAt"
  | "status";

type SortDir = "asc" | "desc";

const SPORTS_FILTER = [
  "Tous",
  "Football",
  "Hockey",
  "Basketball",
  "Volleyball",
  "Soccer",
  "Natation",
  "Badminton",
];

const STATUS_FILTER = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actif" },
  { value: "inactive_7d", label: "Inactif 7j+" },
  { value: "inactive_30d", label: "Inactif 30j+" },
];

function deriveStatus(updatedAt: string | null): CoachOverview["status"] {
  if (!updatedAt) return "inactive_30d";
  const days = getDaysAgo(updatedAt);
  if (days < 7) return "active";
  if (days < 30) return "inactive_7d";
  return "inactive_30d";
}

/* ── Component ───────────────────────────────────────────── */

export default function CoachesListPageWrapper() {
  return <SchoolGate><CoachesListPage /></SchoolGate>;
}

function CoachesListPage() {
  const [coaches, setCoaches] = useState<CoachOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sportFilter, setSportFilter] = useState("Tous");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    async function loadCoaches() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get current user's school_id from school_coaches
      const { data: mySchool } = await supabase
        .from("school_coaches")
        .select("school_id")
        .eq("coach_id", user.id)
        .limit(1)
        .single();
      console.log("My school:", mySchool);

      if (!mySchool) { setLoading(false); return; }

      // Get all coaches in the same school
      const { data: schoolCoaches, error } = await supabase
        .from("school_coaches")
        .select("coach_id, role, sport, team_name, created_at")
        .eq("school_id", mySchool.school_id);
      console.log("School coaches:", schoolCoaches, error);

      if (error || !schoolCoaches) { setLoading(false); return; }

      const coachIds = schoolCoaches.map(sc => sc.coach_id);

      // Get user profiles for all coaches
      const { data: userProfiles } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, avatar_url, status, updated_at")
        .in("id", coachIds);

      // Get athlete counts per coach
      const { data: athletes } = await supabase
        .from("athletes")
        .select("id, coach_id, profile_completion, verified")
        .in("coach_id", coachIds);
      console.log("Athletes for coaches:", athletes);

      const mapped: CoachOverview[] = schoolCoaches.map(sc => {
        const profile = userProfiles?.find(u => u.id === sc.coach_id);
        const coachAthletes = athletes?.filter(a => a.coach_id === sc.coach_id) || [];
        const completedProfiles = coachAthletes.filter(a => (a.profile_completion || 0) >= 60).length;
        const totalAthletes = coachAthletes.length;
        const completionRate = totalAthletes > 0
          ? Math.round((completedProfiles / totalAthletes) * 100)
          : 0;

        const status = deriveStatus(profile?.updated_at || null);
        const accountStatus = profile?.status === "DESACTIVE" ? "DESACTIVE" : "ACTIF";

        return {
          id: sc.coach_id,
          firstName: profile?.first_name || "",
          lastName: profile?.last_name || "",
          avatarUrl: profile?.avatar_url || undefined,
          sport: sc.sport || "",
          athleteCount: totalAthletes,
          profilesCompleted: completedProfiles,
          profileCompletionRate: completionRate,
          recruiterViews30d: 0,
          viewsTrend: 0,
          messagesReceived: 0,
          lastLoginAt: profile?.updated_at || new Date().toISOString(),
          status,
          accountStatus: accountStatus as "ACTIF" | "DESACTIVE",
          deactivatedAt: null,
          deactivatedBy: null,
          deactivationReason: null,
        };
      });

      setCoaches(mapped);
      setLoading(false);
    }
    loadCoaches();
  }, []);

  /* ── Filter + Sort ── */
  const activeCoaches = coaches.filter((c) => c.accountStatus === "ACTIF");
  const deactivatedCoaches = coaches.filter((c) => c.accountStatus === "DESACTIVE");

  const filtered = useMemo(() => {
    let list = [...activeCoaches];

    if (sportFilter !== "Tous") {
      list = list.filter((c) => c.sport === sportFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`
          );
          break;
        case "sport":
          cmp = a.sport.localeCompare(b.sport);
          break;
        case "athleteCount":
          cmp = a.athleteCount - b.athleteCount;
          break;
        case "profileCompletionRate":
          cmp = a.profileCompletionRate - b.profileCompletionRate;
          break;
        case "recruiterViews30d":
          cmp = a.recruiterViews30d - b.recruiterViews30d;
          break;
        case "messagesReceived":
          cmp = a.messagesReceived - b.messagesReceived;
          break;
        case "lastLoginAt":
          cmp =
            new Date(a.lastLoginAt).getTime() -
            new Date(b.lastLoginAt).getTime();
          break;
        case "status": {
          const order = { active: 0, inactive_7d: 1, inactive_30d: 2 };
          cmp = order[a.status] - order[b.status];
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [activeCoaches, sortKey, sortDir, sportFilter, statusFilter, searchQuery]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleRappel(e: React.MouseEvent, coach: CoachOverview) {
    e.preventDefault();
    e.stopPropagation();
    setToast(`Rappel envoye a ${coach.firstName} ${coach.lastName}`);
    setTimeout(() => setToast(null), 3000);
  }

  const SortIndicator = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return (
      <span className="ml-1 text-[9px]">
        {sortDir === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

  const completionColor = (rate: number) => {
    if (rate >= 60) return "bg-[#3B82F6]";
    return "bg-[#6B7280]";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="uppercase text-white font-bold tracking-wide"
            style={{ fontFamily: "var(--wl-font-head)", fontSize: 22 }}
          >
            MES COACHS
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {coaches.length} entraineurs dans votre ecole
          </p>
        </div>
        <Link
          href="/coach/ecole/inviter"
          className="inline-flex items-center justify-center bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-[0.12em] rounded-lg px-5 h-10 hover:bg-[#D93C3C] transition-colors"
          style={{ fontFamily: "var(--wl-font-head)" }}
        >
          + Inviter un coach
        </Link>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] outline-none focus:border-[#E63946] transition-colors"
        >
          {SPORTS_FILTER.map((s) => (
            <option key={s} value={s}>
              Sport : {s}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] outline-none focus:border-[#E63946] transition-colors"
        >
          {STATUS_FILTER.map((s) => (
            <option key={s.value} value={s.value}>
              Statut : {s.label}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Recherche par nom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-9 pr-3 py-2 text-[13px] text-[#e0e0e0] placeholder-[#6B7280] outline-none focus:border-[#E63946] transition-colors"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-[#6B7280] text-[14px]">
            Aucun coach trouve
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#13151a]">
                  {(
                    [
                      { key: "name" as SortKey, label: "Coach", w: "20%" },
                      { key: "sport" as SortKey, label: "Sport", w: "15%" },
                      { key: "athleteCount" as SortKey, label: "Athletes", w: "10%" },
                      { key: "profileCompletionRate" as SortKey, label: "Profils completes", w: "15%" },
                      { key: "recruiterViews30d" as SortKey, label: "Vues recruteurs", w: "12%" },
                      { key: "messagesReceived" as SortKey, label: "Messages recus", w: "10%" },
                      { key: "lastLoginAt" as SortKey, label: "Derniere connexion", w: "10%" },
                      { key: "status" as SortKey, label: "Statut", w: "8%" },
                    ] as const
                  ).map((col) => (
                    <th
                      key={col.key}
                      style={{ width: col.w }}
                      className="px-4 py-3 text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] cursor-pointer select-none hover:text-[#9CA3AF] transition-colors whitespace-nowrap"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      <SortIndicator col={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((coach) => {
                  const initials =
                    coach.firstName.charAt(0) + coach.lastName.charAt(0);
                  const total = coach.athleteCount;
                  const completed = coach.profilesCompleted;

                  return (
                    <Link
                      key={coach.id}
                      href={`/coach/ecole/coachs/${coach.id}`}
                      className="contents"
                    >
                      <tr className="border-t border-[#1e2128] hover:bg-[#22262E] cursor-pointer transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#2A2D35] flex items-center justify-center text-[11px] font-bold text-[#9CA3AF] shrink-0">
                              {initials}
                            </div>
                            <span className="text-[13px] font-bold text-white whitespace-nowrap">
                              {coach.firstName} {coach.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${SPORT_COLORS[coach.sport] || "bg-[#374151]/30 text-[#9CA3AF]"}`}
                          >
                            {coach.sport}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] font-bold text-white">
                          {coach.athleteCount}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded bg-[#2A2D35] overflow-hidden">
                              <div
                                className={`h-full rounded ${completionColor(coach.profileCompletionRate)}`}
                                style={{ width: `${coach.profileCompletionRate}%` }}
                              />
                            </div>
                            <span className="text-[12px] text-[#9CA3AF]">
                              {completed}/{total}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[13px] font-bold text-white">
                            {coach.recruiterViews30d}
                          </span>
                          {coach.viewsTrend !== 0 && (
                            <span
                              className={`ml-1.5 text-[11px] font-semibold ${coach.viewsTrend > 0 ? "text-[#22C55E]" : "text-[#E63946]"}`}
                            >
                              {coach.viewsTrend > 0 ? "\u2191" : "\u2193"}
                              {Math.abs(coach.viewsTrend)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <svg
                              className="w-3.5 h-3.5 text-[#6B7280]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                            <span className="text-[13px] text-white">
                              {coach.messagesReceived}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 text-[12px] whitespace-nowrap ${getLoginColor(coach.lastLoginAt)}`}
                        >
                          {getRelativeTime(coach.lastLoginAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: STATUS_DOT[coach.status] }}
                            />
                            <span className="text-[12px] text-[#9CA3AF] whitespace-nowrap">
                              {STATUS_LABEL[coach.status]}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {coach.status === "inactive_30d" && (
                              <button
                                onClick={(e) => handleRappel(e, coach)}
                                className="border border-[#F59E0B] text-[#F59E0B] text-[11px] px-2 py-0.5 rounded hover:bg-[#F59E0B]/10 transition-colors"
                              >
                                Rappeler
                              </button>
                            )}
                            <Link
                              href={`/directeur/equipe/${coach.id}/supprimer`}
                              onClick={(e) => e.stopPropagation()}
                              className="border border-[#E63946]/40 text-[#E63946] text-[11px] px-2 py-0.5 rounded hover:bg-[#E63946]/10 transition-colors"
                            >
                              Supprimer
                            </Link>
                          </div>
                        </td>
                      </tr>
                    </Link>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Deactivated coaches section ── */}
      {deactivatedCoaches.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280]">
            Désactivés ({deactivatedCoaches.length})
          </h2>
          <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden opacity-70">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody>
                  {deactivatedCoaches.map((coach) => {
                    const initials = coach.firstName.charAt(0) + coach.lastName.charAt(0);
                    const deactivatedDate = coach.deactivatedAt
                      ? new Date(coach.deactivatedAt).toLocaleDateString("fr-CA")
                      : "—";
                    return (
                      <tr key={coach.id} className="border-t first:border-t-0 border-[#1e2128] hover:bg-[#22262E] transition-colors">
                        <td className="px-4 py-3" style={{ width: "25%" }}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#2A2D35] flex items-center justify-center text-[11px] font-bold text-[#4a4d56] shrink-0">
                              {initials}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold text-[#6B7280]">
                                {coach.firstName} {coach.lastName}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded bg-[rgba(107,114,128,0.2)] text-[#6B7280]">
                                Désactivé
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#6B7280]" style={{ width: "15%" }}>
                          {coach.sport}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#6B7280]" style={{ width: "25%" }}>
                          Désactivé le {deactivatedDate}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#6B7280] max-w-[200px] truncate" style={{ width: "20%" }}>
                          {coach.deactivationReason || "—"}
                        </td>
                        <td className="px-4 py-3 text-right" style={{ width: "15%" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setToast(`${coach.firstName} ${coach.lastName} a été réactivé.`);
                              setTimeout(() => setToast(null), 3000);
                            }}
                            className="text-[12px] font-bold text-[#22C55E] hover:text-[#16A34A] transition-colors"
                          >
                            Réactiver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#22C55E] text-white text-[13px] font-semibold px-5 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
