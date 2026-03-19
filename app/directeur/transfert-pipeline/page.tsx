"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { mockDeactivationEvents, mockTrainerOverviews } from "@/lib/mock";

/* ══════════════════════════════════════════════════════════════
   PAGE 4 — Transfert de pipeline (CÉGEP only)
   Route: /directeur/transfert-pipeline
══════════════════════════════════════════════════════════════ */

export default function TransfertPipelinePage() {
  const [bulkRecruiter, setBulkRecruiter] = useState("");

  /* Frozen pipelines from deactivated recruiters */
  const frozenPipelines = useMemo(() => {
    return mockDeactivationEvents
      .filter((e) => e.coachType === "RECRUTEUR_CEGEP")
      .flatMap((e) =>
        e.frozenPipelines.map((p) => ({
          ...p,
          recruiterName: e.coachName,
          cegep: e.establishmentName,
          conversations: e.frozenConversations.length,
        }))
      );
  }, []);

  const activeTrainers = mockTrainerOverviews.filter((t) => t.accountStatus === "ACTIF");

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-head font-bold text-white">
            Transfert de pipeline
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Transférer les dossiers de recrutement des recruteurs désactivés vers des recruteurs actifs.
          </p>
        </div>
        <Link
          href="/directeur/reassignation"
          className="text-[13px] text-[#6B7280] hover:text-white transition-colors inline-flex items-center gap-1"
        >
          ← Réassignation
        </Link>
      </div>

      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        {/* Bulk action */}
        {frozenPipelines.length > 0 && (
          <div className="px-5 py-3 border-b border-[#1e2128] flex items-center gap-3 flex-wrap">
            <span className="text-[12px] font-bold text-[#6B7280] uppercase tracking-[0.15em]">
              Transférer tous à :
            </span>
            <select
              aria-label="Sélectionner un recruteur"
              value={bulkRecruiter}
              onChange={(e) => setBulkRecruiter(e.target.value)}
              className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-1.5 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none"
            >
              <option value="">Choisir un recruteur...</option>
              {activeTrainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName} — {t.sports.join(", ")}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!bulkRecruiter}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-[#E63946] text-white hover:bg-[#D93C3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Transférer tous
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">
                <th className="text-left px-4 py-3">Athlète</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Ancien recruteur</th>
                <th className="text-left px-4 py-3">CÉGEP</th>
                <th className="text-center px-4 py-3">Conv.</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {frozenPipelines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[14px] text-[#6B7280]">
                    Aucun pipeline gelé à transférer.
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
                    <td className="px-4 py-3 text-center text-[13px] text-[#6B7280]">{p.conversations}</td>
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
    </div>
  );
}
