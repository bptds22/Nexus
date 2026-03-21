"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ADMIN_ATHLETES, ADMIN_SCHOOLS } from "@/lib/mock/admin";
import type { AdminAthleteRow } from "@/lib/mock/admin";

/* ── Helpers ─────────────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_BADGE: Record<AdminAthleteRow["status"], { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-[#6b7280]/15", text: "text-[#6b7280]", label: "Brouillon" },
  pending_approval: { bg: "bg-[#EAB308]/15", text: "text-[#EAB308]", label: "En attente" },
  approved: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Approuvé" },
  rejected: { bg: "bg-[#E63946]/15", text: "text-[#E63946]", label: "Rejeté" },
  archived: { bg: "bg-[#6b7280]/10", text: "text-[#4B5563]", label: "Archivé" },
};

function completionColor(pct: number) {
  if (pct < 40) return "bg-[#EF4444]";
  if (pct < 70) return "bg-[#6B7280]";
  return "bg-[#3B82F6]";
}

const selectBase = "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

type QuickTab = "all" | "pending_approval" | "unverified" | "draft" | "flagged";

/* ── Page ─────────────────────────────────────────────────── */

export default function AdminAthletesPage() {
  const [athletes, setAthletes] = useState(ADMIN_ATHLETES);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [divFilter, setDivFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [quickTab, setQuickTab] = useState<QuickTab>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const schoolTypeMap = useMemo(() => {
    const map: Record<string, "secondaire" | "cegep"> = {};
    ADMIN_SCHOOLS.forEach((s) => { map[s.name] = s.type; });
    return map;
  }, []);

  const { secondaireSchools, cegepSchools } = useMemo(() => {
    const set = new Set(athletes.map((a) => a.school));
    const all = Array.from(set).sort();
    return {
      secondaireSchools: all.filter((s) => schoolTypeMap[s] !== "cegep"),
      cegepSchools: all.filter((s) => schoolTypeMap[s] === "cegep"),
    };
  }, [athletes, schoolTypeMap]);

  const filtered = useMemo(() => {
    return athletes.filter((a) => {
      if (search && !a.full_name.toLowerCase().includes(search.toLowerCase()) && !a.school.toLowerCase().includes(search.toLowerCase())) return false;
      if (sportFilter !== "all" && a.sport !== sportFilter) return false;
      if (divFilter !== "all" && a.division !== divFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (schoolFilter !== "all" && a.school !== schoolFilter) return false;
      if (verifiedOnly && !a.is_verified) return false;
      if (quickTab === "pending_approval" && a.status !== "pending_approval") return false;
      if (quickTab === "unverified" && a.is_verified) return false;
      if (quickTab === "draft" && a.status !== "draft") return false;
      if (quickTab === "flagged" && !a.is_flagged) return false;
      return true;
    });
  }, [athletes, search, sportFilter, divFilter, statusFilter, schoolFilter, verifiedOnly, quickTab]);

  const totalCount = athletes.length;
  const verifiedCount = athletes.filter((a) => a.is_verified).length;
  const pendingCount = athletes.filter((a) => a.status === "pending_approval").length;
  const unverifiedCount = athletes.filter((a) => !a.is_verified).length;
  const draftCount = athletes.filter((a) => a.status === "draft").length;
  const flaggedCount = athletes.filter((a) => a.is_flagged).length;
  const sports = [...new Set(athletes.map((a) => a.sport))];

  function showToast(msg = "Action simulée — POC") { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function deleteAthlete(id: string) {
    setAthletes((prev) => prev.filter((a) => a.id !== id));
    showToast("Profil supprimé");
  }

  function hideAthlete(id: string) {
    setAthletes((prev) => prev.map((a) => a.id === id ? { ...a, status: "archived" as const, is_flagged: false } : a));
    showToast("Profil masqué aux recruteurs");
  }

  function approveAthlete(id: string) {
    setAthletes((prev) => prev.map((a) => a.id === id ? { ...a, status: "approved" as const } : a));
    showToast("Profil approuvé");
  }

  function rejectAthlete(id: string) {
    setAthletes((prev) => prev.map((a) => a.id === id ? { ...a, status: "rejected" as const } : a));
    showToast("Profil rejeté");
  }

  function flagAthlete(id: string) {
    setAthletes((prev) => prev.map((a) => a.id === id ? { ...a, is_flagged: true, flag_reason: "Signalé par l'admin" } : a));
    showToast("Profil signalé");
  }

  function unflagAthlete(id: string) {
    setAthletes((prev) => prev.map((a) => a.id === id ? { ...a, is_flagged: false, flag_reason: undefined } : a));
    showToast("Signalement retiré");
  }

  const quickTabs: { key: QuickTab; label: string; count: number; badge?: boolean }[] = [
    { key: "all", label: "Tous", count: totalCount },
    { key: "pending_approval", label: "En attente", count: pendingCount, badge: true },
    { key: "unverified", label: "Non vérifiés", count: unverifiedCount },
    { key: "draft", label: "Brouillons", count: draftCount },
    { key: "flagged", label: "Signalés", count: flaggedCount, badge: true },
  ];

  const showApprovalQueue = quickTab === "pending_approval";

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Gestion des athlètes</h1>
        <p className="text-[13px] text-[#6b7280] mt-1">{totalCount} profils · {verifiedCount} vérifiés · {pendingCount} en attente d&apos;approbation</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input type="text" placeholder="Rechercher un athlète..." value={search} onChange={(e) => setSearch(e.target.value)} className={`${selectBase} flex-1 min-w-[240px]`} />
        <select title="Sport" value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} className={selectBase}>
          <option value="all">Tous les sports</option>
          {sports.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select title="Division" value={divFilter} onChange={(e) => setDivFilter(e.target.value)} className={selectBase}>
          <option value="all">Toutes les divisions</option>
          <option value="D1">D1</option><option value="D2">D2</option><option value="D3">D3</option>
        </select>
        <select title="Statut" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectBase}>
          <option value="all">Tous les statuts</option>
          <option value="draft">Brouillon</option><option value="pending_approval">En attente</option>
          <option value="approved">Approuvé</option><option value="rejected">Rejeté</option><option value="archived">Archivé</option>
        </select>
        <select title="Établissement" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className={selectBase}>
          <option value="all">Tous les établissements</option>
          {secondaireSchools.length > 0 && (
            <optgroup label="Écoles secondaires">
              {secondaireSchools.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          )}
          {cegepSchools.length > 0 && (
            <optgroup label="CÉGEPs">
              {cegepSchools.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          )}
        </select>
        <label className="flex items-center gap-2 text-[13px] text-[#9CA3AF] cursor-pointer">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="accent-[#3B82F6]" />
          Vérifiés seulement
        </label>
      </div>

      {/* Quick tabs */}
      <div className="flex gap-1 border-b border-[#2D3748]">
        {quickTabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setQuickTab(t.key)}
            className={`flex items-center gap-2 px-5 py-3 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${quickTab === t.key ? "text-[#E63946] border-[#E63946]" : "text-[#6b7280] border-transparent hover:text-white"}`}
          >
            {t.label}
            <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${t.badge && t.count > 0 ? "bg-[#E63946] text-white" : "bg-[#2D3748] text-[#6b7280]"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Flagged athletes (card view) */}
      {quickTab === "flagged" ? (
        <div className="space-y-4">
          {filtered.map((a) => (
            <div key={a.id} className="bg-[#1A1D24] rounded-xl border border-[#E63946]/20 p-6 flex flex-col sm:flex-row gap-5">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-xl bg-[#E63946]/10 flex items-center justify-center shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22V2" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-white">{a.full_name}</p>
                  <p className="text-[13px] text-[#9CA3AF] mt-0.5">{a.school} · {a.sport} — {a.position} · {a.division}</p>
                  <p className="text-[12px] text-[#6b7280] mt-1">Coach : <span className="text-white font-bold">{a.coach_name}</span></p>

                  {/* Flag details */}
                  <div className="mt-3 border-l-2 border-[#E63946]/40 bg-[#111317] rounded-r-lg px-4 py-3 space-y-2">
                    {a.flag_category && (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[11px] font-bold">{a.flag_category}</span>
                      </div>
                    )}
                    {a.flag_reason && (
                      <p className="text-[13px] text-[#F59E0B] italic leading-relaxed">&ldquo;{a.flag_reason}&rdquo;</p>
                    )}
                    {a.flagged_by && (
                      <p className="text-[11px] text-[#6b7280]">
                        Signalé par <span className="text-[#9CA3AF] font-bold">{a.flagged_by}</span>
                        {a.flagged_at && <> · {new Date(a.flagged_at).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}</>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0 self-center">
                <button type="button" onClick={() => unflagAthlete(a.id)} className="px-4 py-2 rounded-lg bg-[#22C55E]/15 text-[#22C55E] font-bold text-[12px] uppercase tracking-wider hover:bg-[#22C55E]/25 transition-colors">Retirer le signalement</button>
                <button type="button" onClick={() => hideAthlete(a.id)} className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">Masquer aux recruteurs</button>
                <button type="button" onClick={() => showToast("Contacter le coach — POC")} className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">Contacter le coach</button>
                <button type="button" onClick={() => deleteAthlete(a.id)} className="px-4 py-2 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">Supprimer le profil</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-12 text-[#6b7280] text-[14px]">Aucun profil signalé</div>}
        </div>
      ) : showApprovalQueue ? (
        <div className="space-y-4">
          {filtered.map((a) => {
            return (
              <div key={a.id} className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6 flex flex-col sm:flex-row gap-5">
                {/* Avatar placeholder + info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-14 h-14 rounded-xl bg-[#2D3748] flex items-center justify-center shrink-0">
                    <span className="text-[18px] font-head font-black text-[#6b7280]">{a.full_name.split(" ").map((n) => n[0]).join("")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/athletes/${a.id}`} className="text-[16px] font-bold text-white hover:text-[#E63946] transition-colors">{a.full_name}</Link>
                    <p className="text-[13px] text-[#9CA3AF] mt-0.5">{a.school} · {a.sport} — {a.position} · {a.division}</p>
                    <p className="text-[12px] text-[#6b7280] mt-1">Soumis par <span className="text-white font-bold">{a.coach_name}</span> le {formatDate(a.created_at)}</p>
                    {/* Completion bar */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-[#2D3748] rounded-full overflow-hidden max-w-[200px]">
                        <div className={`h-full rounded-full ${completionColor(a.profile_completeness)}`} style={{ width: `${a.profile_completeness}%` }} />
                      </div>
                      <span className="text-[12px] text-[#9CA3AF] font-bold">{a.profile_completeness}%</span>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex gap-3 shrink-0 self-center">
                  <button type="button" onClick={() => approveAthlete(a.id)} className="px-5 py-2.5 rounded-lg bg-[#22C55E] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#16A34A] transition-colors">Approuver</button>
                  <button type="button" onClick={() => rejectAthlete(a.id)} className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">Rejeter</button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-12 text-[#6b7280] text-[14px]">Aucun profil en attente</div>}
        </div>
      ) : (
        /* Table view */
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2D3748]">
                  {["Athlète", "École", "Sport/Pos.", "Div.", "Statut", "Vérifié", "Complétion", "Coach", "Vues", "Favoris", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => {
                  const st = STATUS_BADGE[a.status];
                  return (
                    <tr key={a.id} className={`border-b border-[#2D3748]/40 hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "bg-[#1A1D24]" : "bg-[#111317]/50"}`}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/athletes/${a.id}`} className="text-[13px] font-bold text-white whitespace-nowrap hover:text-[#E63946] hover:underline transition-colors">{a.full_name}</Link>
                        <p className="text-[11px] text-[#6b7280]">{a.graduation_year}</p>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#9CA3AF] whitespace-nowrap">{a.school}</td>
                      <td className="px-4 py-3 text-[13px] text-[#9CA3AF] whitespace-nowrap">{a.sport} · {a.position}</td>
                      <td className="px-4 py-3 text-[13px] font-bold text-white">{a.division}</td>
                      <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${st.bg} ${st.text}`}>{st.label}</span></td>
                      <td className="px-4 py-3 text-center">
                        {a.is_verified ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="inline"><circle cx="12" cy="12" r="10" fill="#3B82F6" /><path d="M8 12l2.5 2.5L16 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="inline"><circle cx="12" cy="12" r="10" stroke="#4B5563" strokeWidth="1.5" /></svg>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#2D3748] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${completionColor(a.profile_completeness)}`} style={{ width: `${a.profile_completeness}%` }} />
                          </div>
                          <span className="text-[11px] text-[#6b7280]">{a.profile_completeness}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#9CA3AF] whitespace-nowrap">{a.coach_name}</td>
                      <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          {a.views_this_month}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-[13px] text-[#E63946] font-bold">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#E63946" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                          {a.favorites_count || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button type="button" title="Actions" onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)} className="text-[#6b7280] hover:text-white p-1 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                          </button>
                          {openMenu === a.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                              <div className="absolute right-0 top-8 z-50 bg-[#1A1D24] border border-[#2D3748] rounded-lg py-1.5 min-w-[220px] shadow-xl">
                                <Link href={`/admin/athletes/${a.id}`} onClick={() => setOpenMenu(null)} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                  Voir le profil
                                </Link>
                                <button type="button" onClick={() => { setOpenMenu(null); showToast("Contacter le coach — POC"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                  Contacter le coach
                                </button>
                                <div className="border-t border-[#2D3748] my-1.5" />
                                {a.status === "approved" && (
                                  <button type="button" onClick={() => { setOpenMenu(null); hideAthlete(a.id); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M1 1l22 22" /></svg>
                                    Masquer aux recruteurs
                                  </button>
                                )}
                                {a.status === "pending_approval" && (
                                  <>
                                    <button type="button" onClick={() => { setOpenMenu(null); approveAthlete(a.id); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#22C55E] hover:bg-[#22C55E]/10 flex items-center gap-2.5">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                                      Approuver
                                    </button>
                                    <button type="button" onClick={() => { setOpenMenu(null); rejectAthlete(a.id); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#E63946] hover:bg-[#E63946]/10 flex items-center gap-2.5">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                                      Rejeter
                                    </button>
                                  </>
                                )}
                                {!a.is_flagged ? (
                                  <button type="button" onClick={() => { setOpenMenu(null); flagAthlete(a.id); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#F59E0B] hover:bg-[#F59E0B]/10 flex items-center gap-2.5">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22V2" /></svg>
                                    Signaler le profil
                                  </button>
                                ) : (
                                  <button type="button" onClick={() => { setOpenMenu(null); unflagAthlete(a.id); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#22C55E] hover:bg-[#22C55E]/10 flex items-center gap-2.5">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                                    Retirer le signalement
                                  </button>
                                )}
                                <div className="border-t border-[#2D3748] my-1.5" />
                                <button type="button" onClick={() => { setOpenMenu(null); deleteAthlete(a.id); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#E63946] hover:bg-[#E63946]/10 flex items-center gap-2.5">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                  Supprimer le profil
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="text-center py-12 text-[#6b7280] text-[14px]">Aucun athlète trouvé</div>}
        </div>
      )}

      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">{toast}</div>}
    </div>
  );
}
