"use client";

import { useState, useMemo } from "react";
import { mockDeactivationEvents } from "@/lib/mock";

/* ══════════════════════════════════════════════════════════════
   PAGE 6 — Historique des désactivations (Admin)
   Route: /admin/desactivations
══════════════════════════════════════════════════════════════ */

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  PENDING:  { bg: "rgba(245,158,11,0.15)", text: "#F59E0B" },
  PARTIAL:  { bg: "rgba(59,130,246,0.15)", text: "#3B82F6" },
  COMPLETE: { bg: "rgba(34,197,94,0.15)", text: "#22C55E" },
};

type TypeFilter = "all" | "COACH_HS" | "RECRUTEUR_CEGEP";
type StatusFilter = "all" | "PENDING" | "PARTIAL" | "COMPLETE";

export default function AdminDesactivationsPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return mockDeactivationEvents.filter((e) => {
      if (typeFilter !== "all" && e.coachType !== typeFilter) return false;
      if (statusFilter !== "all" && e.reassignmentStatus !== statusFilter) return false;
      return true;
    });
  }, [typeFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-[#111317] px-6 sm:px-10 py-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-[22px] font-head font-bold text-white">
            Historique des désactivations
          </h1>
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase bg-[rgba(107,114,128,0.15)] text-[#6B7280] px-3 py-1 rounded-full">
            Administration
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filtrer par type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none"
          >
            <option value="all">Tous les types</option>
            <option value="COACH_HS">Entraîneurs (HS)</option>
            <option value="RECRUTEUR_CEGEP">Recruteurs (CÉGEP)</option>
          </select>
          <select
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none"
          >
            <option value="all">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="PARTIAL">Partiel</option>
            <option value="COMPLETE">Complété</option>
          </select>
          <span className="text-[12px] text-[#6B7280]">
            {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Coach / Recruteur</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Établissement</th>
                  <th className="text-left px-4 py-3">Directeur</th>
                  <th className="text-left px-4 py-3">Raison</th>
                  <th className="text-center px-4 py-3">Réassignation</th>
                  <th className="text-center px-4 py-3">Impact</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[14px] text-[#6B7280]">
                      Aucune désactivation trouvée.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => {
                    const badge = STATUS_BADGE[e.reassignmentStatus] || STATUS_BADGE.PENDING;
                    const isExpanded = expandedId === e.id;
                    return (
                      <>
                        <tr
                          key={e.id}
                          onClick={() => setExpandedId(isExpanded ? null : e.id)}
                          className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{formatDateFr(e.timestamp)}</td>
                          <td className="px-4 py-3 text-[14px] font-semibold text-white">{e.coachName}</td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-[rgba(107,114,128,0.2)] text-[#9CA3AF]">
                              {e.coachType === "COACH_HS" ? "Coach" : "Recruteur"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{e.establishmentName}</td>
                          <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{e.directorName}</td>
                          <td className="px-4 py-3 text-[12px] text-[#6B7280] max-w-[180px] truncate">{e.reason || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded"
                              style={{ backgroundColor: badge.bg, color: badge.text }}
                            >
                              {e.reassignmentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-[12px] text-[#6B7280]">
                            {e.orphanedAthletes.length + e.frozenPipelines.length} entités
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${e.id}-detail`} className="bg-[#13151a]">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                                <div className="text-center">
                                  <p className="text-[18px] font-head font-black text-[#E63946]">{e.orphanedAthletes.length}</p>
                                  <p className="text-[11px] text-[#6B7280]">Athlètes orphelins</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-[18px] font-head font-black text-[#F59E0B]">{e.frozenPipelines.length}</p>
                                  <p className="text-[11px] text-[#6B7280]">Pipelines gelés</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-[18px] font-head font-black text-[#6B7280]">{e.frozenConversations.length}</p>
                                  <p className="text-[11px] text-[#6B7280]">Conversations</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-[14px] font-bold text-white">{e.directorName}</p>
                                  <p className="text-[11px] text-[#6B7280]">Désactivé par</p>
                                </div>
                              </div>
                              {e.orphanedAthletes.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">Athlètes</p>
                                  <div className="flex flex-wrap gap-1">
                                    {e.orphanedAthletes.map((a) => (
                                      <span key={a.id} className="text-[11px] bg-[#2A2D35] text-[#9CA3AF] px-2 py-0.5 rounded">
                                        {a.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {e.frozenPipelines.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">Pipelines</p>
                                  <div className="flex flex-wrap gap-1">
                                    {e.frozenPipelines.map((p) => (
                                      <span key={p.id} className="text-[11px] bg-[#2A2D35] text-[#9CA3AF] px-2 py-0.5 rounded">
                                        {p.athleteName} — {p.status}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
