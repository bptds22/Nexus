"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  mockDeactivationEvents,
  mockCoachOverviews,
  mockTrainerOverviews,
} from "@/lib/mock";

/* ══════════════════════════════════════════════════════════════
   PAGE 2 — Réassignation dashboard
   Route: /directeur/reassignation
   Tabs: Athlètes orphelins | Pipelines gelés | Historique
══════════════════════════════════════════════════════════════ */

type Tab = "orphans" | "pipelines" | "history";

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
  PARTIAL:  { bg: "rgba(59,130,246,0.15)", text: "#60A5FA" },
  COMPLETE: { bg: "rgba(34,197,94,0.15)", text: "#22C55E" },
};

export default function ReassignationPage() {
  const [tab, setTab] = useState<Tab>("orphans");
  const [bulkCoach, setBulkCoach] = useState("");

  /* Aggregate orphaned athletes from all events */
  const orphanedAthletes = useMemo(() => {
    return mockDeactivationEvents.flatMap((e) =>
      e.orphanedAthletes.map((a) => ({
        ...a,
        coachName: e.coachName,
        coachId: e.coachId,
        eventId: e.id,
      }))
    );
  }, []);

  /* Aggregate frozen pipelines */
  const frozenPipelines = useMemo(() => {
    return mockDeactivationEvents
      .filter((e) => e.coachType === "RECRUTEUR_CEGEP")
      .flatMap((e) =>
        e.frozenPipelines.map((p) => ({
          ...p,
          recruiterName: e.coachName,
          recruiterId: e.coachId,
          cegep: e.establishmentName,
          eventId: e.id,
        }))
      );
  }, []);

  /* Active coaches for reassignment dropdown */
  const activeCoaches = mockCoachOverviews.filter((c) => c.accountStatus === "ACTIF");
  const activeTrainers = mockTrainerOverviews.filter((t) => t.accountStatus === "ACTIF");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "orphans", label: "Athlètes orphelins", count: orphanedAthletes.length },
    { key: "pipelines", label: "Pipelines gelés", count: frozenPipelines.length },
    { key: "history", label: "Historique", count: mockDeactivationEvents.length },
  ];

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[22px] font-head font-bold text-white">
          Réassignation
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#13151a] rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-bold transition-colors ${
              tab === t.key
                ? "bg-[#1A1D24] text-white"
                : "text-[#6B7280] hover:text-white"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black inline-flex items-center justify-center ${
                  tab === t.key
                    ? "bg-[#E63946] text-white"
                    : "bg-[#2A2D35] text-[#6B7280]"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Athlètes orphelins ── */}
      {tab === "orphans" && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
          {/* Bulk action */}
          {orphanedAthletes.length > 0 && (
            <div className="px-5 py-3 border-b border-[#1e2128] flex items-center gap-3 flex-wrap">
              <span className="text-[12px] font-bold text-[#6B7280] uppercase tracking-[0.15em]">
                Réassigner tous à :
              </span>
              <select
                aria-label="Sélectionner un entraîneur"
                value={bulkCoach}
                onChange={(e) => setBulkCoach(e.target.value)}
                className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-1.5 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none"
              >
                <option value="">Choisir un entraîneur...</option>
                {activeCoaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} — {c.sport} ({c.athleteCount} athl.)
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!bulkCoach}
                className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-[#E63946] text-white hover:bg-[#D93C3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Réassigner tous
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">
                  <th className="text-left px-4 py-3">Athlète</th>
                  <th className="text-left px-4 py-3">Sport</th>
                  <th className="text-left px-4 py-3">Ancien coach</th>
                  <th className="text-center px-4 py-3">Pipeline actif?</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {orphanedAthletes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[14px] text-[#6B7280]">
                      Aucun athlète orphelin.
                    </td>
                  </tr>
                ) : (
                  orphanedAthletes.map((a) => (
                    <tr key={a.id} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/directeur/reassignation/${a.id}`}
                          className="text-[14px] font-semibold text-white hover:text-[#E63946] transition-colors"
                        >
                          {a.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{a.sport}</td>
                      <td className="px-4 py-3 text-[13px] text-[#6B7280]">{a.coachName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[11px] font-bold text-[#6B7280]">—</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/directeur/reassignation/${a.id}`}
                          className="text-[12px] font-bold text-[#E63946] hover:text-[#D93C3C] transition-colors"
                        >
                          Réassigner →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: Pipelines gelés ── */}
      {tab === "pipelines" && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">
                  <th className="text-left px-4 py-3">Athlète</th>
                  <th className="text-left px-4 py-3">Statut pipeline</th>
                  <th className="text-left px-4 py-3">Ancien recruteur</th>
                  <th className="text-left px-4 py-3">CÉGEP</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {frozenPipelines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[14px] text-[#6B7280]">
                      Aucun pipeline gelé.
                    </td>
                  </tr>
                ) : (
                  frozenPipelines.map((p) => (
                    <tr key={p.id} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                      <td className="px-4 py-3 text-[14px] font-semibold text-white">{p.athleteName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-[rgba(107,114,128,0.2)] text-[#9CA3AF]">
                            {p.status}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6B7280]">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            Gelé
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#6B7280]">{p.recruiterName}</td>
                      <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{p.cegep}</td>
                      <td className="px-4 py-3 text-right">
                        <select
                          aria-label="Transférer à"
                          className="bg-[#13151a] border border-[#2a2d36] rounded px-2 py-1 text-[11px] text-[#e0e0e0] focus:border-[#E63946] outline-none mr-2"
                        >
                          <option value="">Transférer à...</option>
                          {activeTrainers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.firstName} {t.lastName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded text-[11px] font-bold bg-[#E63946] text-white hover:bg-[#D93C3C] transition-colors"
                        >
                          Transférer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Historique ── */}
      {tab === "history" && (
        <div className="space-y-3">
          {mockDeactivationEvents.length === 0 ? (
            <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] py-16 text-center">
              <p className="text-[14px] text-[#6B7280]">Aucun historique de désactivation.</p>
            </div>
          ) : (
            mockDeactivationEvents.map((e) => {
              const badge = STATUS_BADGE[e.reassignmentStatus] || STATUS_BADGE.PENDING;
              return (
                <HistoryCard key={e.id} event={e} badge={badge} />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ── History card sub-component ── */

function HistoryCard({
  event: e,
  badge,
}: {
  event: (typeof mockDeactivationEvents)[number];
  badge: { bg: string; text: string };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-[#22262E] transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-[#E63946]/15 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-white truncate">
            {e.coachName}
            <span className="text-[#6B7280] font-normal ml-2">
              {e.coachType === "COACH_HS" ? "Entraîneur" : "Recruteur"}
            </span>
          </p>
          <p className="text-[11px] text-[#6B7280] mt-0.5">
            {formatDateFr(e.timestamp)} · {e.establishmentName}
            {e.reason && ` · ${e.reason}`}
          </p>
        </div>
        <span
          className="text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded shrink-0"
          style={{ backgroundColor: badge.bg, color: badge.text }}
        >
          {e.reassignmentStatus}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 py-4 border-t border-[#1e2128] space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-[20px] font-head font-black text-[#E63946]">{e.orphanedAthletes.length}</p>
              <p className="text-[11px] text-[#6B7280]">Athlètes orphelins</p>
            </div>
            <div>
              <p className="text-[20px] font-head font-black text-[#F59E0B]">{e.frozenPipelines.length}</p>
              <p className="text-[11px] text-[#6B7280]">Pipelines gelés</p>
            </div>
            <div>
              <p className="text-[20px] font-head font-black text-[#6B7280]">{e.frozenConversations.length}</p>
              <p className="text-[11px] text-[#6B7280]">Conversations</p>
            </div>
            <div>
              <p className="text-[20px] font-head font-black text-white">{e.directorName}</p>
              <p className="text-[11px] text-[#6B7280]">Par</p>
            </div>
          </div>

          {e.orphanedAthletes.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1.5">Athlètes concernés</p>
              <div className="flex flex-wrap gap-1.5">
                {e.orphanedAthletes.map((a) => (
                  <span key={a.id} className="text-[11px] bg-[#2A2D35] text-[#9CA3AF] px-2 py-0.5 rounded">
                    {a.name} ({a.sport})
                  </span>
                ))}
              </div>
            </div>
          )}

          {e.frozenPipelines.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1.5">Pipelines gelés</p>
              <div className="flex flex-wrap gap-1.5">
                {e.frozenPipelines.map((p) => (
                  <span key={p.id} className="text-[11px] bg-[#2A2D35] text-[#9CA3AF] px-2 py-0.5 rounded">
                    {p.athleteName} — {p.status}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
