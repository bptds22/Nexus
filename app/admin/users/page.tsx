"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ADMIN_USERS, PENDING_RECRUITERS, ADMIN_SCHOOLS, DIRECTOR_ASSIGNMENTS } from "@/lib/mock/admin";
import type { AdminUserRow } from "@/lib/mock/admin";
import DirectorsTab from "./_components/DirectorsTab";

/* ── Helpers ─────────────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "En ligne";
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d}j`;
  return formatDate(iso);
}

const ROLE_BADGE: Record<AdminUserRow["role"], { bg: string; text: string; label: string }> = {
  admin: { bg: "bg-[#E63946]/15", text: "text-[#E63946]", label: "Admin" },
  coach: { bg: "bg-[#3B82F6]/15", text: "text-[#3B82F6]", label: "Entraîneur" },
  recruiter: { bg: "bg-[#E63946]/15", text: "text-[#E63946]", label: "Recruteur" },
  director: { bg: "bg-[#EAB308]/15", text: "text-[#EAB308]", label: "Directeur" },
  athlete: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Athlète" },
  coach_league: { bg: "bg-[#3B82F6]/15", text: "text-[#3B82F6]", label: "Entraîneur (ligue)" },
  coordinator: { bg: "bg-[#EAB308]/15", text: "text-[#EAB308]", label: "Coordonnateur" },
};

const STATUS_BADGE: Record<AdminUserRow["status"], { bg: string; text: string; label: string }> = {
  active: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Actif" },
  suspended: { bg: "bg-[#E63946]/15", text: "text-[#E63946]", label: "Suspendu" },
  pending_validation: { bg: "bg-[#EAB308]/15", text: "text-[#EAB308]", label: "En attente" },
};

/* ── Page ─────────────────────────────────────────────────── */

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-[#6b7280]">Chargement...</div>}>
      <AdminUsersContent />
    </Suspense>
  );
}

function AdminUsersContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "directors" ? "directors" : "users";
  const [mainTab, setMainTab] = useState<"users" | "directors">(initialTab as "users" | "directors");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "coach" as string, school: "" });
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [users, setUsers] = useState(ADMIN_USERS);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  // Read URL search params on mount to pre-fill filters
  useEffect(() => {
    const role = searchParams.get("role");
    const school = searchParams.get("school");
    const tab = searchParams.get("tab");
    if (role) setRoleFilter(role);
    if (school) setSchoolFilter(school);
    if (tab === "directors") setMainTab("directors");
  }, [searchParams]);

  const allSchools = useMemo(() => {
    const set = new Set(users.map((u) => u.school_or_cegep));
    return Array.from(set).sort();
  }, [users]);

  // Build owner/collaborator lookup from assignments
  const directorRoleMap = useMemo(() => {
    const m: Record<string, "owner" | "collaborator"> = {};
    for (const a of DIRECTOR_ASSIGNMENTS) m[a.user_id] = a.director_role;
    return m;
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (roleFilter === "director_owner") {
        if (u.role !== "director" || directorRoleMap[u.id] !== "owner") return false;
      } else if (roleFilter === "director_collaborator") {
        if (u.role !== "director" || directorRoleMap[u.id] !== "collaborator") return false;
      } else if (roleFilter !== "all" && u.role !== roleFilter) {
        return false;
      }
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (schoolFilter !== "all" && u.school_or_cegep !== schoolFilter) return false;
      return true;
    });
  }, [search, roleFilter, statusFilter, schoolFilter, directorRoleMap]);

  const counts = {
    coach: users.filter((u) => u.role === "coach").length,
    recruiter: users.filter((u) => u.role === "recruiter").length,
    director: users.filter((u) => u.role === "director").length,
    athlete: users.filter((u) => u.role === "athlete").length,
    admin: users.filter((u) => u.role === "admin").length,
  };

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const selectBase = "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
            Gestion des utilisateurs
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-1">
            {counts.coach} coachs · {counts.recruiter} recruteurs · {counts.director} directeurs · {counts.athlete} athlètes · {counts.admin} admins
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="shrink-0 px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[13px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors"
        >
          + Inviter un utilisateur
        </button>
      </div>

      {/* Main Tab Bar */}
      <div className="flex items-center gap-1 border-b border-[#2D3748]">
        <button type="button" onClick={() => setMainTab("users")} className={`px-5 py-2.5 text-[13px] font-bold uppercase tracking-wider border-b-2 transition-colors -mb-px ${mainTab === "users" ? "border-[#E63946] text-[#E63946]" : "border-transparent text-[#6b7280] hover:text-[#9CA3AF]"}`}>
          Utilisateurs
        </button>
        <button type="button" onClick={() => setMainTab("directors")} className={`px-5 py-2.5 text-[13px] font-bold uppercase tracking-wider border-b-2 transition-colors -mb-px ${mainTab === "directors" ? "border-[#E63946] text-[#E63946]" : "border-transparent text-[#6b7280] hover:text-[#9CA3AF]"}`}>
          Directeurs
        </button>
      </div>

      {/* Directors Tab */}
      {mainTab === "directors" && <DirectorsTab />}

      {/* Users Tab */}
      {mainTab === "users" && <>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher par nom ou courriel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${selectBase} flex-1 min-w-[240px]`}
        />
        <select title="Rôle" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectBase}>
          <option value="all">Tous les rôles</option>
          <option value="admin">Admin</option>
          <option value="coach">Entraîneur (scolaire)</option>
          <option value="coach_league">Entraîneur (ligue)</option>
          <option value="recruiter">Recruteur</option>
          <option value="director">Directeur (tous)</option>
          <option value="director_owner">↳ Propriétaire</option>
          <option value="director_collaborator">↳ Collaborateur</option>
          <option value="coordinator">Coordonnateur</option>
          <option value="athlete">Athlète</option>
        </select>
        <select title="Statut" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectBase}>
          <option value="all">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="suspended">Suspendu</option>
          <option value="pending_validation">En attente</option>
        </select>
        <select title="Établissement" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className={selectBase}>
          <option value="all">Tous les établissements</option>
          {allSchools.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Users table */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#2D3748]">
                {["Nom", "Courriel", "Rôle", "Établissement", "Statut", "Inscrit le", "Dernière connexion", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const role = ROLE_BADGE[u.role];
                const status = STATUS_BADGE[u.status];
                return (
                  <tr key={u.id} className={`border-b border-[#2D3748]/40 hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "bg-[#1A1D24]" : "bg-[#111317]/50"}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button type="button" onClick={() => setSelectedUser(u)} className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors text-left">
                        {u.full_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF] whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${role.bg} ${role.text}`}>{role.label}</span>
                        {u.role === "director" && directorRoleMap[u.id] === "owner" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#DAB65A]/15 text-[#DAB65A] text-[9px] font-bold">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#DAB65A" stroke="none"><path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" /><circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" /></svg>
                            Proprio.
                          </span>
                        )}
                        {u.role === "director" && directorRoleMap[u.id] === "collaborator" && (
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-[#6B7280]/15 text-[#6B7280] text-[9px] font-bold">Collab.</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF] whitespace-nowrap">{u.school_or_cegep}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${status.bg} ${status.text}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6b7280] whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-[12px] text-[#6b7280] whitespace-nowrap">{timeAgo(u.last_login_at)}</td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button type="button" title="Actions" onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)} className="text-[#6b7280] hover:text-white p-1 transition-colors">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                        </button>
                        {openMenu === u.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                            <div className="absolute right-0 top-8 z-50 bg-[#1A1D24] border border-[#2D3748] rounded-lg py-1.5 min-w-[220px] shadow-xl">
                              <button type="button" onClick={() => { setOpenMenu(null); showToast("Voir le profil — POC"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                Voir le profil
                              </button>
                              <button type="button" onClick={() => { setOpenMenu(null); showToast("Modifier le rôle — POC"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                                Modifier le rôle
                              </button>
                              <div className="border-t border-[#2D3748] my-1.5" />
                              {u.status === "active" ? (
                                <button type="button" onClick={() => { setOpenMenu(null); setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: "suspended" as const } : x)); showToast("Utilisateur suspendu"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#F59E0B] hover:bg-[#F59E0B]/10 flex items-center gap-2.5">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M4.93 4.93l14.14 14.14" /></svg>
                                  Suspendre le compte
                                </button>
                              ) : u.status === "suspended" ? (
                                <button type="button" onClick={() => { setOpenMenu(null); setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: "active" as const } : x)); showToast("Compte réactivé"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#22C55E] hover:bg-[#22C55E]/10 flex items-center gap-2.5">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                                  Réactiver le compte
                                </button>
                              ) : null}
                              <button type="button" onClick={() => { setOpenMenu(null); showToast("Mot de passe réinitialisé — POC"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                                Réinitialiser le mot de passe
                              </button>
                              <div className="border-t border-[#2D3748] my-1.5" />
                              <button type="button" onClick={() => { setOpenMenu(null); setUsers((prev) => prev.filter((x) => x.id !== u.id)); showToast("Utilisateur supprimé"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#E63946] hover:bg-[#E63946]/10 flex items-center gap-2.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                Supprimer le compte
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
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#6b7280] text-[14px]">Aucun utilisateur trouvé</div>
        )}
      </div>

      {/* Pending Recruiter Validations */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">
            Validation des recruteurs
          </h2>
          <span className="min-w-[24px] h-6 px-2 rounded-full bg-[#E63946] text-white text-[12px] font-bold flex items-center justify-center">
            {PENDING_RECRUITERS.length}
          </span>
        </div>
        <div className="space-y-4">
          {PENDING_RECRUITERS.map((pr) => (
            <div key={pr.id} className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-white">{pr.full_name}</p>
                <p className="text-[13px] text-[#9CA3AF] mt-0.5">{pr.email}</p>
                <p className="text-[13px] text-[#6b7280] mt-1">
                  <span className="text-[#E63946] font-bold">{pr.declared_cegep}</span> · Soumis le {formatDate(pr.submitted_at)}
                </p>
                <p className="text-[13px] text-[#9CA3AF] mt-2 italic leading-relaxed">
                  &ldquo;{pr.justification}&rdquo;
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => showToast("Action simulée — POC")}
                  className="px-5 py-2.5 rounded-lg bg-[#22C55E] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#16A34A] transition-colors"
                >
                  Approuver
                </button>
                <button
                  type="button"
                  onClick={() => showToast("Action simulée — POC")}
                  className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                >
                  Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (() => {
        const u = selectedUser;
        const role = ROLE_BADGE[u.role];
        const status = STATUS_BADGE[u.status];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
            <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl w-full max-w-[520px] shadow-2xl mx-4 overflow-hidden">
              {/* Header */}
              <div className="p-6 pb-4 flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                  <span className="text-[18px] font-head font-black text-white">{u.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-head text-[18px] font-black text-white">{u.full_name}</h2>
                  <p className="text-[13px] text-[#9CA3AF] mt-0.5">{u.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${role.bg} ${role.text}`}>{role.label}</span>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${status.bg} ${status.text}`}>{status.label}</span>
                  </div>
                </div>
                <button type="button" title="Fermer" onClick={() => setSelectedUser(null)} className="text-[#6b7280] hover:text-white p-1 shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Info rows */}
              <div className="px-6 pb-4 space-y-3">
                <div className="flex justify-between py-2 border-b border-[#2D3748]/40">
                  <span className="text-[12px] text-[#6b7280] uppercase tracking-wider font-bold">Établissement</span>
                  <span className="text-[13px] text-white font-bold">{u.school_or_cegep}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#2D3748]/40">
                  <span className="text-[12px] text-[#6b7280] uppercase tracking-wider font-bold">Inscrit le</span>
                  <span className="text-[13px] text-white">{formatDate(u.created_at)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#2D3748]/40">
                  <span className="text-[12px] text-[#6b7280] uppercase tracking-wider font-bold">Dernière connexion</span>
                  <span className="text-[13px] text-white">{timeAgo(u.last_login_at)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[12px] text-[#6b7280] uppercase tracking-wider font-bold">ID</span>
                  <span className="text-[12px] text-[#6b7280] font-mono">{u.id}</span>
                </div>
              </div>

              {/* Actions bar */}
              <div className="bg-[#111317] border-t border-[#2D3748] px-6 py-4 space-y-3">
                <div className="flex flex-wrap gap-2 justify-center">
                  <button type="button" onClick={() => { setSelectedUser(null); showToast("Modifier le rôle — POC"); }} className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                    Modifier le rôle
                  </button>
                  <button type="button" onClick={() => { setSelectedUser(null); showToast("Mot de passe réinitialisé — POC"); }} className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                    Réinitialiser MDP
                  </button>
                  {u.status === "active" ? (
                    <button type="button" onClick={() => { setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: "suspended" as const } : x)); setSelectedUser({ ...u, status: "suspended" }); showToast("Utilisateur suspendu"); }} className="px-4 py-2 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] font-bold text-[12px] uppercase tracking-wider hover:bg-[#F59E0B]/25 transition-colors">
                      Suspendre
                    </button>
                  ) : u.status === "suspended" ? (
                    <button type="button" onClick={() => { setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: "active" as const } : x)); setSelectedUser({ ...u, status: "active" }); showToast("Compte réactivé"); }} className="px-4 py-2 rounded-lg bg-[#22C55E]/15 text-[#22C55E] font-bold text-[12px] uppercase tracking-wider hover:bg-[#22C55E]/25 transition-colors">
                      Réactiver
                    </button>
                  ) : null}
                </div>
                <div className="flex justify-center">
                  <button type="button" onClick={() => { setUsers((prev) => prev.filter((x) => x.id !== u.id)); setSelectedUser(null); showToast("Utilisateur supprimé"); }} className="px-6 py-2 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
                    Supprimer le compte
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-[480px] shadow-2xl mx-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></svg>
                </div>
                <div>
                  <h2 className="font-head text-[16px] font-black text-white uppercase">Inviter un utilisateur</h2>
                </div>
              </div>
              <button type="button" title="Fermer" onClick={() => setShowInvite(false)} className="text-[#6b7280] hover:text-white p-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-[13px] text-[#6b7280] mb-5">L&apos;utilisateur recevra un courriel d&apos;invitation pour créer son compte.</p>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">Nom complet *</label>
                <input type="text" placeholder="Jean-François Roy" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} className={selectBase + " w-full"} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">Courriel *</label>
                <input type="email" placeholder="jf.roy@ecole.qc.ca" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className={selectBase + " w-full"} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">Rôle *</label>
                <select title="Rôle" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value, school: "" })} className={selectBase + " w-full"}>
                  <option value="coach">Entraîneur (école secondaire)</option>
                  <option value="coach_league">Entraîneur (ligue civile)</option>
                  <option value="recruiter">Recruteur (CÉGEP)</option>
                  <option value="director">Directeur sportif (école secondaire)</option>
                  <option value="director_cegep">Directeur sportif (CÉGEP)</option>
                  <option value="coordinator">Coordonnateur (ligue civile)</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">Établissement</label>
                <select title="Établissement" value={inviteForm.school} onChange={(e) => setInviteForm({ ...inviteForm, school: e.target.value })} className={selectBase + " w-full"}>
                  <option value="">— Sélectionner —</option>
                  {(inviteForm.role === "coach" || inviteForm.role === "director") &&
                    ADMIN_SCHOOLS.filter((s) => s.type === "secondaire").map((s) => (
                      <option key={s.id} value={s.name}>{s.name} — {s.city}</option>
                    ))
                  }
                  {(inviteForm.role === "recruiter" || inviteForm.role === "director_cegep") &&
                    ADMIN_SCHOOLS.filter((s) => s.type === "cegep").map((s) => (
                      <option key={s.id} value={s.name}>{s.name} — {s.city}</option>
                    ))
                  }
                  {inviteForm.role === "admin" &&
                    <option value="Nexus HQ">Nexus HQ</option>
                  }
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInvite(false);
                  setInviteForm({ name: "", email: "", role: "coach", school: "" });
                  showToast("Invitation envoyée (POC)");
                }}
                disabled={!inviteForm.name || !inviteForm.email}
                className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                Envoyer l&apos;invitation
              </button>
            </div>
          </div>
        </div>
      )}

      </>}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
