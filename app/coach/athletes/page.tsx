"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type RosterAthlete } from "./_data/mockRosterData";
import RosterSummaryBar from "./_components/RosterSummaryBar";
import RosterToolbar, { type FilterPreset } from "./_components/RosterToolbar";
import RosterTable, { type SortKey } from "./_components/RosterTable";
import RosterMobileCard from "./_components/RosterMobileCard";
import RosterGridCard from "./_components/RosterGridCard";
import RosterEmptyState from "./_components/RosterEmptyState";

/* ─────────────────────────────────────────────────────────────────
   Mes Athlètes — Roster Workbench
   The coach's operational management tool for the entire roster.
───────────────────────────────────────────────────────────────── */

function sortAthletes(list: RosterAthlete[], key: SortKey, asc: boolean): RosterAthlete[] {
  const sorted = [...list].sort((a, b) => {
    switch (key) {
      case "stage": {
        // Non-verified first (false=0 < true=1), then by profilePercent ascending
        const va = a.isVerified ? 1 : 0;
        const vb = b.isVerified ? 1 : 0;
        if (va !== vb) return va - vb;
        return a.profilePercent - b.profilePercent;
      }
      case "name":
        return a.lastName.localeCompare(b.lastName);
      case "position":
        return a.position.localeCompare(b.position);
      case "gradYear":
        return a.gradYear - b.gradYear;
      case "commitment": {
        const COMMIT_ORDER = { aucun: 0, en_discussion: 1, visite_planifiee: 2, lettre_signee: 3, place: 4 };
        return COMMIT_ORDER[a.commitmentStatus] - COMMIT_ORDER[b.commitmentStatus];
      }
      case "views":
        return a.views - b.views;
      case "favorites":
        return a.favorites - b.favorites;
      default:
        return 0;
    }
  });
  return asc ? sorted : sorted.reverse();
}

function mapUrlFilter(param: string | null): FilterPreset {
  if (param === "incomplets") return "non_verifies";
  if (param === "non_verifies") return "non_verifies";
  if (param === "favoris") return "favoris";
  if (param === "consultes") return "plus_consultes";
  return "tous";
}

/** Get sport name — teamId now stores the sport name directly from Supabase */
function getSport(teamId: string): string {
  return teamId === "real" ? "" : teamId;
}

export default function MesAthletesPage() {
  return (
    <Suspense>
      <MesAthletesContent />
    </Suspense>
  );
}

function MesAthletesContent() {
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filtre");

  const [realAthletes, setRealAthletes] = useState<RosterAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterPreset>(mapUrlFilter(urlFilter));
  const [selectedGradYear, setSelectedGradYear] = useState("all");
  const [selectedTeamId, setSelectedTeamId] = useState("all");
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedVerification, setSelectedVerification] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("stage");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const loadAthletes = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("athletes")
        .select(`
          id,
          first_name,
          last_name,
          verified,
          profile_completion,
          verification_method,
          verified_at,
          verified_by,
          video_faits_saillants_url,
          annee_diplomation,
          cote_globale_entraineur,
          numero_jersey,
          status,
          sport_id,
          position_id,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          evaluations(cote_globale)
        `)
        .eq("coach_id", session.user.id)
        .eq("status", "ACTIF");

      console.log("Roster query result:", JSON.stringify(data), "error:", error, "uid:", session.user.id);

      if (!data) { setLoading(false); return; }

      // Batch-query pipeline for all athlete IDs
      const athleteIds = data.map((a: Record<string, unknown>) => a.id as string);
      const { data: pipelineRows } = await supabase
        .from("pipeline")
        .select("athlete_id, status")
        .in("athlete_id", athleteIds);

      // Build recruitment labels: find highest status + count of recruiters at that level or higher
      const STATUS_ORDER: Record<string, number> = { IDENTIFIE: 1, CONTACTE: 2, EN_DISCUSSION: 3, VISITE_PLANIFIEE: 4, ENGAGE: 5, LETTRE_SIGNEE: 6 };
      const STATUS_LABELS: Record<string, string> = { IDENTIFIE: "Identifié", CONTACTE: "Contacté", EN_DISCUSSION: "En discussion", VISITE_PLANIFIEE: "Visite", ENGAGE: "Engagé", LETTRE_SIGNEE: "Lettre signée" };
      const recruitmentMap = new Map<string, string>();
      if (pipelineRows) {
        const byAthlete = new Map<string, { status: string }[]>();
        for (const row of pipelineRows) {
          const list = byAthlete.get(row.athlete_id) || [];
          list.push(row);
          byAthlete.set(row.athlete_id, list);
        }
        for (const [aid, rows] of byAthlete) {
          // Find highest status
          let maxOrder = 0;
          let maxStatus = "";
          for (const r of rows) {
            const order = STATUS_ORDER[r.status] || 0;
            if (order > maxOrder) { maxOrder = order; maxStatus = r.status; }
          }
          // Count recruiters at that status or higher
          const count = rows.filter(r => (STATUS_ORDER[r.status] || 0) >= maxOrder).length;
          const label = STATUS_LABELS[maxStatus] || maxStatus;
          recruitmentMap.set(aid, `${label} (${count})`);
        }
      }

      const mapped: RosterAthlete[] = data.map((a: Record<string, unknown>) => {
        // Handle FK joins — may be object or array
        const posRaw = a.positions;
        const pos = Array.isArray(posRaw) ? posRaw[0] : posRaw;
        const posObj = pos as { nom?: string; abreviation?: string } | null;

        const sportRaw = a.sports;
        const sport = Array.isArray(sportRaw) ? sportRaw[0] : sportRaw;
        const sportObj = sport as { nom?: string } | null;

        const evalsRaw = a.evaluations;
        const evals = Array.isArray(evalsRaw) ? evalsRaw : [];
        const eval0 = evals[0] as { cote_globale?: number } | undefined;
        const stars = eval0?.cote_globale || (a.cote_globale_entraineur as number) || 0;

        const position = posObj?.abreviation || posObj?.nom || "";
        const gradYear = (a.annee_diplomation as number) || 0;
        const profilePct = (a.profile_completion as number) || 0;
        const isVerified = !!(a.verified);

        const athlete: RosterAthlete = {
          id: a.id as string,
          firstName: (a.first_name as string) || "",
          lastName: (a.last_name as string) || "",
          position,
          gradYear,
          teamId: sportObj?.nom || "real",
          profilePercent: profilePct,
          isVerified,
          verification: {
            isVerified,
            method: (a.verification_method as "auto" | "manual_coach" | "manual_director") || null,
            verifiedAt: (a.verified_at as string) || null,
            verifiedBy: (a.verified_by as string) || null,
            verifiedByName: null,
            profilePercentAtVerification: profilePct || null,
            autoEligible: profilePct >= 60,
            manualOverrideActive: false,
          },
          views: 0,
          favorites: 0,
          stars: Math.round(stars),
          commitmentStatus: "aucun" as const,
          badgeIcons: [],
          recruitmentLabel: recruitmentMap.get(a.id as string) || undefined,
        };

        console.log("Mapped athlete:", athlete.firstName, athlete.lastName, "pos:", athlete.position, "grad:", athlete.gradYear, "verified:", athlete.isVerified, "stars:", athlete.stars);
        return athlete;
      });

      setRealAthletes(mapped);
      setLoading(false);
    };

    loadAthletes();
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  const filtered = useMemo(() => {
    let list = [...realAthletes];

    // Search filter
    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.firstName.toLowerCase().includes(q) ||
          a.lastName.toLowerCase().includes(q) ||
          `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
          a.position.toLowerCase().includes(q)
      );
    }

    // Dropdown filters (always active)
    if (selectedTeamId !== "all") {
      list = list.filter((a) => a.teamId === selectedTeamId);
    }
    if (selectedGradYear !== "all") {
      list = list.filter((a) => a.gradYear === Number(selectedGradYear));
    }
    if (selectedSport !== "all") {
      list = list.filter((a) => getSport(a.teamId) === selectedSport);
    }

    // Verification status filter
    if (selectedVerification !== "all") {
      switch (selectedVerification) {
        case "verified":
          list = list.filter((a) => a.isVerified);
          break;
        case "not_verified":
          list = list.filter((a) => !a.isVerified);
          break;
        case "auto":
          list = list.filter((a) => a.verification.method === "auto");
          break;
        case "manual":
          list = list.filter((a) => a.verification.method === "manual_coach" || a.verification.method === "manual_director");
          break;
      }
    }

    // Preset filter
    switch (activeFilter) {
      case "non_verifies":
        list = list.filter((a) => !a.isVerified);
        break;
      case "plus_consultes":
        return sortAthletes(list, "views", false);
      case "favoris":
        list = list.filter((a) => a.favorites > 0);
        break;
    }

    console.log("Athletes loaded:", list.length, "Filter:", activeFilter);
    return sortAthletes(list, sortKey, sortAsc);
  }, [realAthletes, search, activeFilter, selectedGradYear, selectedTeamId, selectedSport, selectedVerification, sortKey, sortAsc]);

  // If the entire roster is empty (not just filtered)
  if (loading) return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto flex items-center justify-center">
      <p className="text-[#6B7280] text-sm py-20">Chargement du roster...</p>
    </div>
  );

  if (!loading && realAthletes.length === 0) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto">
        <RosterEmptyState />
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Mes Athlètes
          </h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">
            Roster — Saison 2025-2026
          </p>
        </div>
        <div className="flex items-center gap-3 self-start">
          {/* View toggle */}
          <div className="flex items-center bg-[#13151a] border border-[#2a2d36] rounded-lg overflow-hidden">
            <button
              type="button"
              title="Vue liste"
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
              </svg>
            </button>
            <button
              type="button"
              title="Vue grille"
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
          </div>

          <Link
            href="/coach/athletes/create"
            className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-5 py-3 font-head font-bold text-[13px] uppercase tracking-widest
              transition-all duration-150 hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            Ajouter un athlète
          </Link>
        </div>
      </div>

      {/* ── Summary Bar ─────────────────────────────────────────── */}
      <RosterSummaryBar athletes={realAthletes} />

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <RosterToolbar
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        selectedGradYear={selectedGradYear}
        onGradYearChange={setSelectedGradYear}
        selectedTeamId={selectedTeamId}
        onTeamChange={setSelectedTeamId}
        selectedSport={selectedSport}
        onSportChange={setSelectedSport}
        selectedVerification={selectedVerification}
        onVerificationChange={setSelectedVerification}
        sportsList={[...new Set(realAthletes.map((a) => getSport(a.teamId)).filter(Boolean))]}
      />

      {/* ── Content ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h3 className="font-head text-lg font-bold text-white uppercase tracking-wide mb-2">
            Aucun athlète trouvé
          </h3>
          <p className="text-[14px] text-[#6b7280] max-w-sm">
            Essayez de modifier vos filtres ou votre recherche.
          </p>
        </div>
      ) : (
        viewMode === "list" ? (
          <>
            {/* Desktop table (hidden on mobile) */}
            <div className="hidden md:block">
              <RosterTable
                athletes={filtered}
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={handleSort}
              />
            </div>

            {/* Mobile cards (hidden on desktop) */}
            <div className="md:hidden space-y-3">
              {filtered.map((a) => (
                <RosterMobileCard key={a.id} athlete={a} />
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((a) => (
              <RosterGridCard key={a.id} athlete={a} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
