"use client";

import { useState, useMemo } from "react";
import {
  ADMIN_SCHOOLS,
  DIRECTOR_ASSIGNMENTS,
  OWNERSHIP_TRANSFER_REQUESTS,
  DIRECTOR_JOIN_REQUESTS,
} from "@/lib/mock/admin";
import type {
  DirectorAssignment,
  OwnershipTransferRequest,
  DirectorJoinRequest,
} from "@/lib/mock/admin";

/* ═══════════════════════════════════════════════════════════════
   Directors Tab — School/CÉGEP director assignments,
   ownership transfers, and join requests
═══════════════════════════════════════════════════════════════ */

const GOLD = "#DAB65A";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function daysAgo(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/* ── Crown Icon ───────────────────────────────────────────────── */

function CrownIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={GOLD} stroke="none">
      <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="12" cy="3" r="2" />
      <circle cx="19" cy="6" r="2" />
    </svg>
  );
}

/* ── Toast ────────────────────────────────────────────────────── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-[fadeInUp_0.3s_ease-out]">
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        <span className="text-[13px] font-bold text-white">{message}</span>
        <button type="button" onClick={onDone} className="text-[#6b7280] hover:text-white ml-2" aria-label="Fermer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ── Confirm Modal ────────────────────────────────────────────── */

function ConfirmModal({ title, children, confirmLabel, confirmColor, onConfirm, onCancel }: {
  title: string; children: React.ReactNode; confirmLabel: string; confirmColor?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">{title}</h3>
        <div className="mt-3 text-[13px] text-[#9CA3AF] leading-relaxed">{children}</div>
        <div className="flex items-center justify-end gap-3 mt-5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
          <button type="button" onClick={onConfirm} className="px-5 py-2 text-white text-[13px] font-bold rounded-lg transition-colors" style={{ backgroundColor: confirmColor || "#E63946" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */

export default function DirectorsTab() {
  const [assignments, setAssignments] = useState(DIRECTOR_ASSIGNMENTS);
  const [transfers, setTransfers] = useState(OWNERSHIP_TRANSFER_REQUESTS);
  const [joins, setJoins] = useState(DIRECTOR_JOIN_REQUESTS);
  const [toast, setToast] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"schools" | "transfers" | "joins">("schools");
  const [confirmAction, setConfirmAction] = useState<{ type: string; id: string; label: string } | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  /* KPIs */
  const schoolsWithDirector = useMemo(() => {
    const schoolIds = new Set(assignments.filter((a) => a.director_role === "owner").map((a) => a.school_id));
    const totalSecondaire = ADMIN_SCHOOLS.filter((s) => s.type === "secondaire").length;
    const totalCegep = ADMIN_SCHOOLS.filter((s) => s.type === "cegep").length;
    const secWithDir = ADMIN_SCHOOLS.filter((s) => s.type === "secondaire" && schoolIds.has(s.id)).length;
    const cegWithDir = ADMIN_SCHOOLS.filter((s) => s.type === "cegep" && schoolIds.has(s.id)).length;
    return { secWithDir, totalSecondaire, cegWithDir, totalCegep };
  }, [assignments]);

  const pendingCount = transfers.filter((t) => t.status === "pending").length + joins.filter((j) => j.status === "pending_owner" || j.status === "pending_admin").length;

  /* School assignments table data */
  const schoolRows = useMemo(() => {
    return ADMIN_SCHOOLS.map((school) => {
      const owner = assignments.find((a) => a.school_id === school.id && a.director_role === "owner");
      const collabs = assignments.filter((a) => a.school_id === school.id && a.director_role === "collaborator");
      const hasPending = transfers.some((t) => t.school_id === school.id && t.status === "pending") || joins.some((j) => j.school_id === school.id && (j.status === "pending_owner" || j.status === "pending_admin"));
      const ownerInactive = owner && daysAgo(owner.last_login_at) > 30;
      return { school, owner, collabs, hasPending, ownerInactive, inactiveDays: owner ? daysAgo(owner.last_login_at) : 0 };
    });
  }, [assignments, transfers, joins]);

  /* Actions */
  const approveTransfer = (id: string) => {
    setTransfers((prev) => prev.map((t) => t.id === id ? { ...t, status: "approved" as const, reviewed_at: new Date().toISOString(), reviewed_by: "u-001" } : t));
    showToast("Transfert approuvé (POC)");
  };

  const rejectTransfer = (id: string) => {
    setTransfers((prev) => prev.map((t) => t.id === id ? { ...t, status: "rejected" as const, reviewed_at: new Date().toISOString(), reviewed_by: "u-001" } : t));
    showToast("Transfert rejeté (POC)");
  };

  const approveJoin = (id: string, asOwner: boolean) => {
    setJoins((prev) => prev.map((j) => j.id === id ? { ...j, status: "approved" as const } : j));
    showToast(asOwner ? "Approuvé comme directeur principal (POC)" : "Approuvé comme collaborateur (POC)");
  };

  const rejectJoin = (id: string) => {
    setJoins((prev) => prev.map((j) => j.id === id ? { ...j, status: "rejected" as const } : j));
    showToast("Demande rejetée (POC)");
  };

  return (
    <div className="space-y-6">

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Écoles avec directeur</p>
          <p className="text-[24px] font-head font-black text-white mt-1">{schoolsWithDirector.secWithDir} <span className="text-[16px] text-[#6b7280]">/ {schoolsWithDirector.totalSecondaire}</span></p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">CÉGEPs avec directeur</p>
          <p className="text-[24px] font-head font-black text-white mt-1">{schoolsWithDirector.cegWithDir} <span className="text-[16px] text-[#6b7280]">/ {schoolsWithDirector.totalCegep}</span></p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Demandes en attente</p>
          <p className="text-[24px] font-head font-black mt-1" style={{ color: pendingCount > 0 ? "#E63946" : "white" }}>{pendingCount}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-[#2D3748] pb-0">
        {([
          { key: "schools" as const, label: "Établissements", count: ADMIN_SCHOOLS.length },
          { key: "transfers" as const, label: "Transferts", count: transfers.filter((t) => t.status === "pending").length },
          { key: "joins" as const, label: "Demandes", count: joins.filter((j) => j.status !== "approved" && j.status !== "rejected").length },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSubTab(tab.key)}
            className={`px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider border-b-2 transition-colors -mb-px ${
              subTab === tab.key ? "border-[#E63946] text-[#E63946]" : "border-transparent text-[#6b7280] hover:text-[#9CA3AF]"
            }`}
          >
            {tab.label}
            {tab.count > 0 && tab.key !== "schools" && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#E63946] text-white text-[10px] font-black">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Schools Tab ──────────────────────────────────────── */}
      {subTab === "schools" && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2D3748]">
                  {["Établissement", "Type", "Directeur principal", "Collaborateurs", "Statut"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schoolRows.map(({ school, owner, collabs, hasPending, ownerInactive, inactiveDays }) => (
                  <tr key={school.id} className="border-b border-[#2D3748]/40 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-bold text-white">{school.name}</p>
                      <p className="text-[11px] text-[#6b7280]">{school.city}, {school.region}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${school.type === "cegep" ? "bg-[#3B82F6]/15 text-[#3B82F6]" : "bg-[#EAB308]/15 text-[#EAB308]"}`}>
                        {school.type === "cegep" ? "CÉGEP" : "École"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {owner ? (
                        <div className="flex items-center gap-1.5">
                          <CrownIcon size={14} />
                          <span className="text-[13px] font-bold text-white">{owner.user_name}</span>
                          {ownerInactive && (
                            <span className="text-[10px] font-bold text-[#E63946] ml-1">⚠ Inactif ({inactiveDays}j)</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[12px] font-bold text-[#E63946]">AUCUN</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                      {collabs.length > 0 ? `${collabs.length} collaborateur${collabs.length > 1 ? "s" : ""}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {!owner ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E63946]/15 text-[#E63946]">Sans directeur</span>
                      ) : hasPending ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAB308]/15 text-[#EAB308]">En attente</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E]">Complet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Transfers Tab ────────────────────────────────────── */}
      {subTab === "transfers" && (
        <div className="space-y-4">
          {transfers.filter((t) => t.status === "pending").length === 0 ? (
            <div className="text-center py-12 text-[#6b7280]">Aucun transfert en attente</div>
          ) : (
            transfers.filter((t) => t.status === "pending").map((t) => (
              <div key={t.id} className="bg-[#1A1D24] rounded-xl border border-[#2D3748] border-l-4 border-l-[#EAB308] p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.school_type === "cegep" ? "bg-[#3B82F6]/15 text-[#3B82F6]" : "bg-[#EAB308]/15 text-[#EAB308]"}`}>
                        {t.school_type === "cegep" ? "CÉGEP" : "École"}
                      </span>
                      <span className="text-[14px] font-bold text-white">{t.school_name}</span>
                    </div>
                    <p className="text-[13px] text-[#9CA3AF]">
                      <span className="text-white font-bold">{t.current_owner_name}</span> → <span className="text-white font-bold">{t.requested_new_owner_name}</span>
                    </p>
                    <p className="text-[12px] text-[#6b7280] mt-1 italic">&ldquo;{t.reason}&rdquo;</p>
                    <p className="text-[11px] text-[#4a4d56] mt-1">
                      Demandé par {t.requested_by === "owner" ? "le directeur" : "l'admin"} le {formatDate(t.requested_at)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => approveTransfer(t.id)} className="px-4 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[12px] font-bold rounded-lg transition-colors">Approuver</button>
                    <button type="button" onClick={() => rejectTransfer(t.id)} className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-lg transition-colors">Rejeter</button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* History */}
          {transfers.filter((t) => t.status !== "pending").length > 0 && (
            <div className="mt-6">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Historique</h3>
              {transfers.filter((t) => t.status !== "pending").map((t) => (
                <div key={t.id} className="bg-[#1A1D24] rounded-lg border border-[#2D3748]/40 p-4 mb-2 opacity-60">
                  <p className="text-[13px] text-[#9CA3AF]">
                    {t.school_name}: {t.current_owner_name} → {t.requested_new_owner_name}
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${t.status === "approved" ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-[#E63946]/15 text-[#E63946]"}`}>
                      {t.status === "approved" ? "Approuvé" : "Rejeté"}
                    </span>
                  </p>
                  {t.reviewed_at && <p className="text-[11px] text-[#4a4d56] mt-1">Traité le {formatDate(t.reviewed_at)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Joins Tab ────────────────────────────────────────── */}
      {subTab === "joins" && (
        <div className="space-y-4">
          {joins.filter((j) => j.status === "pending_owner" || j.status === "pending_admin").length === 0 ? (
            <div className="text-center py-12 text-[#6b7280]">Aucune demande en attente</div>
          ) : (
            joins.filter((j) => j.status === "pending_owner" || j.status === "pending_admin").map((j) => (
              <div key={j.id} className="bg-[#1A1D24] rounded-xl border border-[#2D3748] border-l-4 border-l-[#3B82F6] p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${j.school_type === "cegep" ? "bg-[#3B82F6]/15 text-[#3B82F6]" : "bg-[#EAB308]/15 text-[#EAB308]"}`}>
                        {j.school_type === "cegep" ? "CÉGEP" : "École"}
                      </span>
                      <span className="text-[14px] font-bold text-white">{j.school_name}</span>
                    </div>
                    <p className="text-[13px] text-white font-bold">{j.user_name}</p>
                    <p className="text-[12px] text-[#6b7280]">{j.user_email}</p>
                    <p className="text-[12px] text-[#9CA3AF] mt-1 italic">&ldquo;{j.message}&rdquo;</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] text-[#4a4d56]">Directeur actuel:</span>
                      <span className="text-[11px] text-[#9CA3AF] font-bold">{j.current_owner_name || "Aucun"}</span>
                    </div>
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      j.status === "pending_owner" ? "bg-[#EAB308]/15 text-[#EAB308]" : "bg-[#E63946]/15 text-[#E63946]"
                    }`}>
                      {j.status === "pending_owner" ? "En attente du directeur" : "En attente — admin requis"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {!j.current_owner_name ? (
                      <>
                        <button type="button" onClick={() => approveJoin(j.id, true)} className="px-4 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[12px] font-bold rounded-lg transition-colors whitespace-nowrap">
                          <CrownIcon size={12} /> Directeur principal
                        </button>
                        <button type="button" onClick={() => approveJoin(j.id, false)} className="px-4 py-2 bg-[#6B7280] hover:bg-[#4B5563] text-white text-[12px] font-bold rounded-lg transition-colors whitespace-nowrap">Collaborateur</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => approveJoin(j.id, false)} className="px-4 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[12px] font-bold rounded-lg transition-colors">Forcer l&apos;approbation</button>
                    )}
                    <button type="button" onClick={() => rejectJoin(j.id)} className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-lg transition-colors">Rejeter</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
