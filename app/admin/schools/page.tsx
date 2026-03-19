"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_SCHOOLS } from "@/lib/mock/admin";

const selectBase = "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

export default function AdminSchoolsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [confFilter, setConfFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [tab, setTab] = useState<"secondaire" | "cegep">("secondaire");
  const [toast, setToast] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [schools, setSchools] = useState(ADMIN_SCHOOLS);
  const [selectedSchool, setSelectedSchool] = useState<typeof ADMIN_SCHOOLS[0] | null>(null);

  const filtered = useMemo(() => {
    return schools.filter((s) => {
      if (s.type !== tab) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.city.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (confFilter !== "all" && s.conference !== confFilter) return false;
      if (!showInactive && !s.is_active) return false;
      return true;
    });
  }, [search, typeFilter, confFilter, showInactive, tab]);

  const secCount = schools.filter((s) => s.type === "secondaire").length;
  const cegCount = schools.filter((s) => s.type === "cegep").length;

  function showToast() { setToast("Action simulée — POC"); setTimeout(() => setToast(null), 3000); }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Gestion des établissements</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">{secCount} écoles secondaires · {cegCount} CÉGEPs</p>
        </div>
        <button type="button" onClick={showToast} className="shrink-0 px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[13px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors">
          + Ajouter un établissement
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input type="text" placeholder="Rechercher un établissement..." value={search} onChange={(e) => setSearch(e.target.value)} className={`${selectBase} flex-1 min-w-[240px]`} />
        <select value={confFilter} onChange={(e) => setConfFilter(e.target.value)} className={selectBase}>
          <option value="all">Toutes les conférences</option>
          <option value="sud_ouest">Sud-Ouest</option>
          <option value="nord_est">Nord-Est</option>
        </select>
        <label className="flex items-center gap-2 text-[13px] text-[#9CA3AF] cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-[#E63946]" />
          Afficher inactifs
        </label>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2D3748]">
        {([["secondaire", `Écoles secondaires (${secCount})`], ["cegep", `CÉGEPs (${cegCount})`]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`px-5 py-3 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${tab === key ? "text-[#E63946] border-[#E63946]" : "text-[#6b7280] border-transparent hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#2D3748]">
                {tab === "secondaire"
                  ? ["Nom", "Ville", "Région", "Conférence", "Sports", "Coachs", "Statut", ""].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">{h}</th>)
                  : ["Nom", "Ville", "Conférence", "Privé", "Sports", "Recruteurs", "Statut", ""].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">{h}</th>)
                }
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className={`border-b border-[#2D3748]/40 hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "bg-[#1A1D24]" : "bg-[#111317]/50"}`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button type="button" onClick={() => setSelectedSchool(s)} className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors text-left">
                      {s.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#9CA3AF] whitespace-nowrap">{s.city}</td>
                  {tab === "secondaire" && <td className="px-4 py-3 text-[13px] text-[#9CA3AF] whitespace-nowrap">{s.region}</td>}
                  <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{s.conference === "sud_ouest" ? "Sud-Ouest" : s.conference === "nord_est" ? "Nord-Est" : "—"}</td>
                  {tab === "cegep" && (
                    <td className="px-4 py-3">{s.is_private ? <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[11px] font-bold">Privé</span> : ""}</td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.sports.slice(0, 3).map((sp) => (
                        <span key={sp} className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[10px] font-bold text-[#9CA3AF]">{sp}</span>
                      ))}
                      {s.sports.length > 3 && <span className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[10px] font-bold text-[#6b7280]">+{s.sports.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold text-white">{tab === "secondaire" ? s.coaches_count : s.recruiters_count}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${s.is_active ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-[#6b7280]/15 text-[#6b7280]"}`}>
                      {s.is_active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button type="button" title="Actions" onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)} className="text-[#6b7280] hover:text-white p-1 transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                      </button>
                      {openMenu === s.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                          <div className="absolute right-0 top-8 z-50 bg-[#1A1D24] border border-[#2D3748] rounded-lg py-1.5 min-w-[200px] shadow-xl">
                            <button type="button" onClick={() => { setOpenMenu(null); showToast(); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              Modifier
                            </button>
                            <button type="button" onClick={() => { setOpenMenu(null); router.push(`/admin/users?role=${tab === "secondaire" ? "coach" : "recruiter"}&school=${encodeURIComponent(s.name)}`); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                              {tab === "secondaire" ? "Voir les coachs" : "Voir les recruteurs"}
                            </button>
                            <div className="border-t border-[#2D3748] my-1.5" />
                            {s.is_active ? (
                              <button type="button" onClick={() => { setOpenMenu(null); setSchools((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: false } : x)); showToast(); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#F59E0B] hover:bg-[#F59E0B]/10 flex items-center gap-2.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M4.93 4.93l14.14 14.14" /></svg>
                                Désactiver
                              </button>
                            ) : (
                              <button type="button" onClick={() => { setOpenMenu(null); setSchools((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: true } : x)); showToast(); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#22C55E] hover:bg-[#22C55E]/10 flex items-center gap-2.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                                Réactiver
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-[#6b7280] text-[14px]">Aucun établissement trouvé</div>}
      </div>

      {/* School Detail Modal */}
      {selectedSchool && (() => {
        const s = selectedSchool;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSchool(null)} />
            <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl w-full max-w-[520px] shadow-2xl mx-4 overflow-hidden">
              {/* Header */}
              <div className="p-6 pb-4 flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22V12h6v10" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-head text-[18px] font-black text-white">{s.name}</h2>
                  <p className="text-[13px] text-[#9CA3AF] mt-0.5">{s.city}, {s.region}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${s.type === "cegep" ? "bg-[#A855F7]/15 text-[#A855F7]" : "bg-[#3B82F6]/15 text-[#3B82F6]"}`}>
                      {s.type === "cegep" ? "CÉGEP" : "École secondaire"}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${s.is_active ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-[#6b7280]/15 text-[#6b7280]"}`}>
                      {s.is_active ? "Actif" : "Inactif"}
                    </span>
                    {s.is_private && <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#F59E0B]/15 text-[#F59E0B]">Privé</span>}
                  </div>
                </div>
                <button type="button" title="Fermer" onClick={() => setSelectedSchool(null)} className="text-[#6b7280] hover:text-white p-1 shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Info rows */}
              <div className="px-6 pb-4 space-y-3">
                <div className="flex justify-between py-2 border-b border-[#2D3748]/40">
                  <span className="text-[12px] text-[#6b7280] uppercase tracking-wider font-bold">Conférence RSEQ</span>
                  <span className="text-[13px] text-white">{s.conference === "sud_ouest" ? "Sud-Ouest" : s.conference === "nord_est" ? "Nord-Est" : "—"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#2D3748]/40">
                  <span className="text-[12px] text-[#6b7280] uppercase tracking-wider font-bold">{s.type === "cegep" ? "Recruteurs" : "Coachs"}</span>
                  <span className="text-[13px] text-white font-bold">{s.type === "cegep" ? s.recruiters_count : s.coaches_count}</span>
                </div>
                <div className="py-2 border-b border-[#2D3748]/40">
                  <span className="text-[12px] text-[#6b7280] uppercase tracking-wider font-bold block mb-2">Sports offerts</span>
                  <div className="flex flex-wrap gap-1.5">
                    {s.sports.map((sp) => (
                      <span key={sp} className="px-2.5 py-1 rounded-full bg-[#2D3748] text-[11px] font-bold text-[#9CA3AF]">{sp}</span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[12px] text-[#6b7280] uppercase tracking-wider font-bold">ID</span>
                  <span className="text-[12px] text-[#6b7280] font-mono">{s.id}</span>
                </div>
              </div>

              {/* Actions bar */}
              <div className="bg-[#111317] border-t border-[#2D3748] px-6 py-4 space-y-3">
                <div className="flex flex-wrap gap-2 justify-center">
                  <button type="button" onClick={() => { setSelectedSchool(null); showToast(); }} className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                    Modifier
                  </button>
                  <button type="button" onClick={() => { setSelectedSchool(null); router.push(`/admin/users?role=${s.type === "cegep" ? "recruiter" : "coach"}&school=${encodeURIComponent(s.name)}`); }} className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                    {s.type === "cegep" ? "Voir les recruteurs" : "Voir les coachs"}
                  </button>
                  {s.is_active ? (
                    <button type="button" onClick={() => { setSchools((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: false } : x)); setSelectedSchool({ ...s, is_active: false }); showToast(); }} className="px-4 py-2 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] font-bold text-[12px] uppercase tracking-wider hover:bg-[#F59E0B]/25 transition-colors">
                      Désactiver
                    </button>
                  ) : (
                    <button type="button" onClick={() => { setSchools((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: true } : x)); setSelectedSchool({ ...s, is_active: true }); showToast(); }} className="px-4 py-2 rounded-lg bg-[#22C55E]/15 text-[#22C55E] font-bold text-[12px] uppercase tracking-wider hover:bg-[#22C55E]/25 transition-colors">
                      Réactiver
                    </button>
                  )}
                </div>
                <div className="flex justify-center">
                  <button type="button" onClick={() => { setSchools((prev) => prev.filter((x) => x.id !== s.id)); setSelectedSchool(null); showToast(); }} className="px-6 py-2 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
                    Supprimer l&apos;établissement
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">{toast}</div>}
    </div>
  );
}
