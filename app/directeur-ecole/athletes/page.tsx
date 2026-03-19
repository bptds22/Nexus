"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { mockTopAthletes, mockCoachOverviews } from "@/lib/mock";

/* ── Pipeline status definitions ───────────────────────────── */

type PipelineStatus = "crees" | "completes" | "vus" | "contactes";

const STATUS_META: Record<PipelineStatus, { label: string; color: string; icon: React.ReactNode }> = {
  crees: {
    label: "Profils créés",
    color: "#6B7280",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
  },
  completes: {
    label: "Profils complétés",
    color: "#3B82F6",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  vus: {
    label: "Profils vus par les recruteurs",
    color: "#F59E0B",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  contactes: {
    label: "Contactés par un recruteur",
    color: "#22C55E",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
};

const STATUT_TABS: { key: PipelineStatus | "tous"; label: string; count: number }[] = [
  { key: "tous", label: "Tous", count: 47 },
  { key: "crees", label: "Créés", count: 47 },
  { key: "completes", label: "Complétés", count: 34 },
  { key: "vus", label: "Vus", count: 28 },
  { key: "contactes", label: "Contactés", count: 12 },
];

/* ── Generate mock athlete data per status ─────────────────── */

interface DirectorAthlete {
  id: string;
  name: string;
  sport: string;
  position: string;
  coach: string;
  views: number;
  profilePercent: number;
  status: PipelineStatus;
}

function coachForSport(sport: string): string {
  return mockCoachOverviews.find((c) => c.sport === sport)?.firstName + " " +
    (mockCoachOverviews.find((c) => c.sport === sport)?.lastName ?? "") || "—";
}

const allAthletes: DirectorAthlete[] = mockTopAthletes
  .filter((a) => a.season === "2025-2026")
  .map((a, i) => {
    // Assign pipeline status based on index to match funnel numbers
    let status: PipelineStatus = "crees";
    if (i < 6) status = "contactes"; // top 6 viewed => contacted (subset)
    if (i < 7) status = "vus";       // top 7 => viewed
    if (i < 8) status = "completes"; // top 8 => completed

    // All are "created" since they exist
    return {
      id: a.id,
      name: a.name,
      sport: a.sport,
      position: a.position,
      coach: coachForSport(a.sport),
      views: a.views,
      profilePercent: 40 + Math.round(Math.random() * 55),
      status,
    };
  });

/* ── Page ──────────────────────────────────────────────────── */

export default function AthletesPage() {
  return (
    <Suspense>
      <AthletesContent />
    </Suspense>
  );
}

function AthletesContent() {
  const searchParams = useSearchParams();
  const rawStatut = searchParams.get("statut") as PipelineStatus | null;
  const activeTab = rawStatut && rawStatut in STATUS_META ? rawStatut : "tous";

  // Filter athletes based on pipeline status (cumulative — "vus" includes "contactes")
  const filtered = activeTab === "tous"
    ? allAthletes
    : allAthletes.filter((a) => {
        const ORDER: PipelineStatus[] = ["crees", "completes", "vus", "contactes"];
        const targetIdx = ORDER.indexOf(activeTab);
        const athleteIdx = ORDER.indexOf(a.status);
        // Include athletes at or beyond the target stage
        return athleteIdx >= targetIdx;
      });

  const meta = activeTab !== "tous" ? STATUS_META[activeTab] : null;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/directeur-ecole/dashboard"
              className="text-[#6B7280] hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
              Athlètes
            </h1>
          </div>
          <p className="text-[13px] text-[#6B7280] mt-1 ml-7">
            {meta ? meta.label : "Tous les athlètes"} — {filtered.length} athlète{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Count badge */}
        <div
          className="w-16 h-16 rounded-full border-2 flex items-center justify-center flex-shrink-0"
          style={{ borderColor: meta?.color ?? "#6B7280" }}
        >
          <span
            className="text-[32px] font-head font-black leading-none"
            style={{ color: meta?.color ?? "#FFFFFF" }}
          >
            {filtered.length}
          </span>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUT_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const tabColor = tab.key !== "tous" ? STATUS_META[tab.key].color : "#9CA3AF";
          return (
            <Link
              key={tab.key}
              href={tab.key === "tous" ? "/directeur-ecole/athletes" : `/directeur-ecole/athletes?statut=${tab.key}`}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-bold tracking-wide whitespace-nowrap transition-all ${
                isActive
                  ? "text-white"
                  : "bg-transparent border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56]"
              }`}
              style={isActive ? { backgroundColor: tabColor } : undefined}
            >
              {tab.label}
              <span className={`text-[11px] font-medium ${isActive ? "text-white/70" : "text-[#6B7280]"}`}>
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11px] text-[#6B7280] uppercase tracking-wider border-b border-[#2A2D35]">
                <th className="px-5 py-3">Athlète</th>
                <th className="px-5 py-3">Sport</th>
                <th className="px-5 py-3">Position</th>
                <th className="px-5 py-3">Coach</th>
                <th className="px-5 py-3 text-center">Profil</th>
                <th className="px-5 py-3 text-right">Vues</th>
                <th className="px-5 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const statusMeta = STATUS_META[a.status];
                return (
                  <tr
                    key={a.id}
                    className="border-b border-[#2A2D35] last:border-0 hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/directeur-ecole/athletes/${a.id}`}
                        className="text-white font-medium hover:text-[#E63946] transition-colors"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-[#9CA3AF]">{a.sport}</td>
                    <td className="px-5 py-3.5 text-[#9CA3AF]">{a.position}</td>
                    <td className="px-5 py-3.5 text-[#9CA3AF]">{a.coach}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-14 h-1.5 rounded-full bg-[#2A2D35] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${a.profilePercent}%`,
                              backgroundColor: a.profilePercent >= 60 ? "#3B82F6" : "#6B7280",
                            }}
                          />
                        </div>
                        <span
                          className="text-[12px] font-medium"
                          style={{ color: a.profilePercent >= 60 ? "#3B82F6" : "#6B7280" }}
                        >
                          {a.profilePercent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-white font-semibold">
                      {a.views}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                          style={{
                            backgroundColor: `${statusMeta.color}15`,
                            color: statusMeta.color,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: statusMeta.color }}
                          />
                          {STATUS_META[a.status].label.replace("Profils ", "").replace("par les recruteurs", "").replace("par un recruteur", "")}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
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
              Aucun athlète ne correspond à ce filtre.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
