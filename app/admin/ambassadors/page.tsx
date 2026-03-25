"use client";

import { useState } from "react";
import {
  MOCK_AMBASSADORS,
  MOCK_APPLICATIONS,
  MOCK_REGION_COVERAGE,
  ADMIN_AMBASSADOR_KPIS,
} from "@/lib/mock/ambassadors";
import type { Ambassador, AmbassadorApplication } from "@/lib/mock/ambassadors";

/* ═══════════════════════════════════════════════════════════════
   Admin — Gestion des ambassadeurs
═══════════════════════════════════════════════════════════════ */

const selectBase = "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

const STATUS_BADGE: Record<Ambassador["status"], { bg: string; text: string; label: string }> = {
  active: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Actif" },
  elite: { bg: "bg-[#DAB65A]/15", text: "text-[#DAB65A]", label: "Élite" },
  inactive: { bg: "bg-[#E63946]/15", text: "text-[#E63946]", label: "Inactif" },
};

function formatCAD(n: number) {
  if (n === 0) return "0 $";
  return n.toLocaleString("fr-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " $";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminAmbassadorsPage() {
  const [toast, setToast] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [apps, setApps] = useState<AmbassadorApplication[]>(MOCK_APPLICATIONS.filter((a) => a.status === "pending"));

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const kpi = ADMIN_AMBASSADOR_KPIS;

  const filtered = MOCK_AMBASSADORS.filter((a) => {
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const handleApprove = (id: string) => {
    setApps((prev) => prev.filter((a) => a.id !== id));
    showToast("Ambassadeur activé. Code référal généré. (POC)");
  };
  const handleReject = (id: string) => {
    setApps((prev) => prev.filter((a) => a.id !== id));
    showToast("Candidature rejetée.");
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Gestion des ambassadeurs
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">
          {kpi.active_ambassadors} actifs · {kpi.elite_ambassadors} élite · {apps.length} candidature{apps.length > 1 ? "s" : ""} en attente
        </p>
      </div>

      {/* ── KPI strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">Ambassadeurs actifs</p>
          <p className="font-head text-[32px] font-black text-[#22C55E] leading-none mt-1">{kpi.active_ambassadors}</p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">Ambassadeurs Élite</p>
          <p className="font-head text-[32px] font-black text-[#DAB65A] leading-none mt-1">{kpi.elite_ambassadors}</p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">Référals totaux</p>
          <p className="font-head text-[32px] font-black text-white leading-none mt-1">{kpi.total_referrals}</p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">Revenu généré</p>
          <p className="font-head text-[32px] font-black text-[#22C55E] leading-none mt-1">{formatCAD(kpi.revenue_from_referrals)}</p>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectBase}>
          <option value="all">Tous les types</option>
          <option value="coach">Coach</option>
          <option value="recruteur">Recruteur</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectBase}>
          <option value="all">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="elite">Élite</option>
          <option value="inactive">Inactif</option>
        </select>
      </div>

      {/* ── Ambassador table ───────────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-[#2D3748]">
                {["Ambassadeur", "Type", "Région", "Référals", "Actifs", "Payants", "Commission", "Statut", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const st = STATUS_BADGE[a.status];
                return (
                  <tr key={a.id} className={`${i % 2 === 0 ? "bg-[#111317]/40" : ""} hover:bg-white/[0.02] transition-colors border-b border-[#2D3748]/40`}>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-bold text-white">{a.name}</p>
                      <p className="text-[11px] text-[#6b7280]">{a.institution}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.type === "coach" ? "bg-[#3B82F6]/15 text-[#3B82F6]" : "bg-[#E63946]/15 text-[#E63946]"}`}>
                        {a.type === "coach" ? "Coach" : "Recruteur"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{a.region}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-white">{a.total_referrals}</td>
                    <td className="px-4 py-3 text-[13px] text-white">{a.active_referrals}</td>
                    <td className="px-4 py-3 text-[13px] text-white">{a.paying_referrals}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-[#22C55E]">{formatCAD(a.total_commission)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${st.bg} ${st.text}`}>
                        {a.status === "elite" && <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>}
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#6b7280] hover:text-white"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
                      </button>
                      {openMenu === a.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                          <div className="absolute right-0 top-10 z-50 bg-[#1A1D24] border border-[#2D3748] rounded-lg shadow-xl py-1.5 min-w-[200px]">
                            <button type="button" onClick={() => { showToast("Détail ambassadeur (POC)"); setOpenMenu(null); }} className="w-full px-4 py-2 text-left text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors">Voir le détail</button>
                            <button type="button" onClick={() => { showToast("Statut modifié (POC)"); setOpenMenu(null); }} className="w-full px-4 py-2 text-left text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors">Changer le statut</button>
                            <button type="button" onClick={() => { showToast("Paiement envoyé via Stripe Connect (Phase 3)"); setOpenMenu(null); }} className="w-full px-4 py-2 text-left text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors">Payer la commission</button>
                            <div className="border-t border-[#2D3748] my-1" />
                            <button type="button" onClick={() => { showToast("Statut révoqué (POC)"); setOpenMenu(null); }} className="w-full px-4 py-2 text-left text-[12px] text-[#E63946] hover:bg-[#E63946]/5 transition-colors">Révoquer le statut</button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pending applications ────────────────────────────── */}
      {apps.length > 0 && (
        <div>
          <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">
            Candidatures en attente
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#E63946] text-white text-[10px] font-bold">{apps.length}</span>
          </h2>
          <div className="space-y-4">
            {apps.map((a) => (
              <div key={a.id} className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[14px] font-bold text-white">{a.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.role === "coach" ? "bg-[#3B82F6]/15 text-[#3B82F6]" : "bg-[#E63946]/15 text-[#E63946]"}`}>
                        {a.role === "coach" ? "Coach" : "Recruteur"}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#9CA3AF] mb-1">{a.institution} · {a.region}</p>
                    <p className="text-[12px] text-[#6b7280] mb-3">Soumise le {formatDate(a.submitted_at)}</p>
                    <div className="bg-[#111317] rounded-lg p-3 border-l-2 border-[#E63946]/30">
                      <p className="text-[13px] text-[#9CA3AF] leading-relaxed">&ldquo;{a.message}&rdquo;</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 self-start">
                    <button
                      type="button"
                      onClick={() => handleApprove(a.id)}
                      className="px-4 py-2 rounded-lg bg-[#22C55E] text-white font-bold text-[11px] uppercase tracking-wider hover:bg-[#16A34A] transition-colors"
                    >
                      Approuver
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(a.id)}
                      className="px-4 py-2 rounded-lg bg-[#E63946] text-white font-bold text-[11px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                    >
                      Rejeter
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Regional coverage ──────────────────────────────── */}
      <div>
        <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">
          Couverture régionale
        </h2>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#2D3748]">
                {["Région", "Ambassador Coach", "Ambassador Recruteur", "Écoles", "Statut"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_REGION_COVERAGE.map((r, i) => {
                const hasCoach = !!r.ambassador_coach;
                const hasRec = !!r.ambassador_recruteur;
                return (
                  <tr key={r.region} className={`${i % 2 === 0 ? "bg-[#111317]/40" : ""} hover:bg-white/[0.02] transition-colors border-b border-[#2D3748]/40`}>
                    <td className="px-4 py-3 text-[13px] font-bold text-white">{r.region}</td>
                    <td className="px-4 py-3">
                      {hasCoach ? (
                        <span className="text-[12px] text-[#22C55E] font-bold">{r.ambassador_coach}</span>
                      ) : (
                        <span className="text-[11px] text-[#EAB308] font-bold uppercase tracking-wider">Vacant</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {hasRec ? (
                        <span className="text-[12px] text-[#22C55E] font-bold">{r.ambassador_recruteur}</span>
                      ) : (
                        <span className="text-[11px] text-[#EAB308] font-bold uppercase tracking-wider">Vacant</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{r.schools_count}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === "active" ? "bg-[#22C55E]/15 text-[#22C55E]" :
                        r.status === "searching" ? "bg-[#E63946]/15 text-[#E63946]" :
                        r.status === "phase2" ? "bg-[#6B7280]/15 text-[#6B7280]" :
                        "bg-[#4a4d56]/10 text-[#4a4d56]"
                      }`}>
                        {r.status === "active" ? "Actif" : r.status === "searching" ? "Recherche" : r.status === "phase2" ? "Phase 2" : "Phase 3"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
