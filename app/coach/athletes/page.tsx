"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MOCK_ATHLETES, type Athlete } from "@/lib/mock/athletes-mock-data";

/* ══════════════════════════════════════════════════════════════
   STYLE CONSTANTS — matching create page exactly
══════════════════════════════════════════════════════════════ */

const cardCls = "bg-[#1A1D24] rounded-[14px] border border-[#1e2128]";
const inputCls =
  "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[15px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors";

/* ══════════════════════════════════════════════════════════════
   COMPLETENESS COLOR — same blue/gray rule
══════════════════════════════════════════════════════════════ */

function pctColor(p: number) {
  return p >= 50 ? "#3b82f6" : "#8a8d96";
}

/* ══════════════════════════════════════════════════════════════
   NEXT-ACTION NUDGE
══════════════════════════════════════════════════════════════ */

function nudge(a: Athlete): { text: string; color: string } {
  const p = a.profileCompletion;
  if (p >= 95) return { text: "Profil complet", color: "#10b981" };
  if (p >= 70) {
    const missing = !a.hasVideo ? "une vidéo highlight" : !a.hasStats ? "les statistiques" : !a.hasPhoto ? "une photo" : "les détails manquants";
    return { text: `Presque complet — Ajouter ${missing}`, color: "#3b82f6" };
  }
  if (p >= 40) {
    const tip = !a.hasVideo ? "Ajouter une vidéo highlight" : !a.hasStats ? "Compléter les statistiques" : "Compléter le profil";
    return { text: tip, color: "#f59e0b" };
  }
  return { text: "Profil incomplet — Ajouter les informations de base", color: "#f59e0b" };
}

/* ══════════════════════════════════════════════════════════════
   RELATIVE TIME
══════════════════════════════════════════════════════════════ */

const NOW = new Date("2026-03-09");

function relativeTime(dateStr: string): { text: string; stale: boolean } {
  const d = new Date(dateStr);
  const diffMs = NOW.getTime() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return { text: "Mis à jour aujourd'hui", stale: false };
  if (days === 1) return { text: "Mis à jour hier", stale: false };
  if (days < 7) return { text: `Mis à jour il y a ${days} jours`, stale: false };
  if (days < 30) {
    const w = Math.floor(days / 7);
    return { text: `Mis à jour il y a ${w} sem.`, stale: false };
  }
  const months = Math.floor(days / 30);
  return { text: `Mis à jour il y a ${months} mois`, stale: true };
}

/* ══════════════════════════════════════════════════════════════
   STATUS BADGE — hide Actif, only show Brouillon/Inactif
══════════════════════════════════════════════════════════════ */

const STATUS_MAP: Record<Athlete["status"], { label: string; dot: string; animate: boolean }> = {
  actif: { label: "Actif", dot: "bg-emerald-400", animate: true },
  en_attente: { label: "En attente", dot: "bg-amber-400", animate: false },
  brouillon: { label: "Brouillon", dot: "bg-[#8a8d96]", animate: false },
  inactif: { label: "Inactif", dot: "bg-[#8a8d96]", animate: false },
};

function StatusBadge({ status, showAll }: { status: Athlete["status"]; showAll?: boolean }) {
  if (!showAll && status === "actif") return null;
  const s = STATUS_MAP[status];
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#8a8d96]/10 px-2.5 py-1 rounded-full">
      <span className="relative flex h-2 w-2">
        {s.animate && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${s.dot} opacity-75`} />}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${s.dot}`} />
      </span>
      <span className="text-[11px] font-semibold text-[#c8c8cc]">{s.label}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   FILTER OPTIONS
══════════════════════════════════════════════════════════════ */

const SPORTS = ["Tous", "Football", "Soccer", "Basketball", "Volleyball", "Hockey", "Rugby", "Flag-Football"];
const GRAD_YEARS = ["Toutes", "2025", "2026", "2027", "2028"];
const STATUSES = ["Tous", "Actif", "En attente", "Brouillon", "Inactif"];

/* ══════════════════════════════════════════════════════════════
   SORT HELPERS
══════════════════════════════════════════════════════════════ */

type SortKey = "name" | "sport" | "position" | "school" | "gradYear" | "completion" | "views" | "status";

function sortAthletes(list: Athlete[], key: SortKey, asc: boolean): Athlete[] {
  const sorted = [...list].sort((a, b) => {
    switch (key) {
      case "name": return a.lastName.localeCompare(b.lastName);
      case "sport": return a.sport.localeCompare(b.sport);
      case "position": return a.position.localeCompare(b.position);
      case "school": return a.schoolName.localeCompare(b.schoolName);
      case "gradYear": return a.gradYear - b.gradYear;
      case "completion": return a.profileCompletion - b.profileCompletion;
      case "views": return a.recruiterViews - b.recruiterViews;
      case "status": return a.status.localeCompare(b.status);
      default: return 0;
    }
  });
  return asc ? sorted : sorted.reverse();
}

/* ══════════════════════════════════════════════════════════════
   PAGE COMPONENT
══════════════════════════════════════════════════════════════ */

export default function MesAthletesPage() {
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("Tous");
  const [gradFilter, setGradFilter] = useState("Toutes");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [view, setView] = useState<"grid" | "list">("grid");

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = MOCK_ATHLETES;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.firstName.toLowerCase().includes(q) ||
          a.lastName.toLowerCase().includes(q) ||
          `${a.firstName} ${a.lastName}`.toLowerCase().includes(q)
      );
    }
    if (sportFilter !== "Tous") list = list.filter((a) => a.sport === sportFilter);
    if (gradFilter !== "Toutes") list = list.filter((a) => a.gradYear === Number(gradFilter));
    if (statusFilter !== "Tous") {
      const filterMap: Record<string, string> = { "Actif": "actif", "En attente": "en_attente", "Brouillon": "brouillon", "Inactif": "inactif" };
      list = list.filter((a) => a.status === filterMap[statusFilter]);
    }
    return sortAthletes(list, sortKey, sortAsc);
  }, [search, sportFilter, gradFilter, statusFilter, sortKey, sortAsc]);

  const initials = (a: Athlete) => `${a.firstName[0]}${a.lastName[0]}`.toUpperCase();

  const SortArrow = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null;
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" className={`inline ml-1 ${sortAsc ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 6l3-3 3 3" />
      </svg>
    );
  };

  const thCls = "px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56] cursor-pointer select-none hover:text-[#8a8d96] transition-colors";

  return (
    <div className="px-6 sm:px-10 py-8 max-w-7xl mx-auto">

      {/* ── Breadcrumb + CTA ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2 text-[13px] text-[#6b7280]">
          <span className="font-bold text-[#8a8d96]">Nexus</span>
          <span>/</span>
          <span>Coach</span>
          <span>/</span>
          <span className="text-white">Mes Athlètes</span>
        </div>
        <Link
          href="/coach/athletes/create"
          className="flex items-center gap-2.5 bg-[#E63946] text-white rounded-lg px-6 py-3 font-head font-bold text-[13px] uppercase tracking-widest
            transition-all duration-150 hover:bg-[#c62d3a] hover:-translate-y-0.5 hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95 active:bg-[#a8222e]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
          Créer un profil
        </Link>
      </div>

      {/* ── Title ─────────────────────────────────────────────── */}
      <h1 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
        Mes Athlètes
      </h1>
      <p className="text-[15px] text-[#6b7280] mt-2">
        Gérez et suivez les profils de vos étudiants-athlètes
      </p>
      <span className="inline-block mt-3 bg-[#E63946]/10 text-[#E63946] text-[12px] font-bold tracking-wider uppercase px-3 py-1 rounded-full">
        {MOCK_ATHLETES.length} athlètes
      </span>

      {/* ── Filters & Search ──────────────────────────────────── */}
      <div className={`${cardCls} mt-6 p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher un athlète…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} !pl-10`}
            />
          </div>
          <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} aria-label="Filtrer par sport"
            className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors cursor-pointer">
            {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={gradFilter} onChange={(e) => setGradFilter(e.target.value)} aria-label="Filtrer par année"
            className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors cursor-pointer">
            {GRAD_YEARS.map((y) => <option key={y} value={y}>{y === "Toutes" ? "Année" : y}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrer par statut"
            className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors cursor-pointer">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex items-center bg-[#13151a] border border-[#2a2d36] rounded-lg overflow-hidden">
            <button type="button" onClick={() => setView("grid")} aria-label="Vue grille"
              className={`p-3 transition-colors ${view === "grid" ? "bg-[#E63946]/15 text-[#E63946]" : "text-[#6b7280] hover:text-white"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button type="button" onClick={() => setView("list")} aria-label="Vue liste"
              className={`p-3 transition-colors ${view === "list" ? "bg-[#E63946]/15 text-[#E63946]" : "text-[#6b7280] hover:text-white"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
                <path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#1e2128] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="17" y1="11" x2="23" y2="11" />
            </svg>
          </div>
          <h3 className="font-head text-lg font-bold text-white uppercase tracking-wide mb-2">Aucun athlète trouvé</h3>
          <p className="text-[14px] text-[#6b7280] max-w-sm mb-6">Essayez de modifier vos filtres ou créez un nouveau profil</p>
          <Link href="/coach/athletes/create"
            className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-5 py-3 font-head font-bold text-[13px] uppercase tracking-widest transition-all duration-150 hover:bg-[#c62d3a] hover:-translate-y-0.5 hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            Créer un profil
          </Link>
        </div>
      ) : view === "grid" ? (
        /* ── Grid view ───────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
          {filtered.map((a) => {
            const n = nudge(a);
            const updated = relativeTime(a.updatedAt);
            const isUrgentGrad = a.gradYear === 2025;

            return (
              <div
                key={a.id}
                className={`${cardCls} p-6 hover:border-[#2a2d36] hover:shadow-[0_0_24px_rgba(0,0,0,0.25)] transition-all duration-200 group relative`}
              >
                {/* Notification dot — pending recruiter requests */}
                {a.pendingRequests > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 z-10 group/notif">
                    <span className="relative flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E63946] opacity-50" />
                      <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-[#E63946] text-[9px] font-bold text-white">
                        {a.pendingRequests}
                      </span>
                    </span>
                    <div className="absolute -top-8 right-0 bg-[#111317] border border-[#2a2d36] rounded-lg px-2.5 py-1 text-[10px] text-[#c8c8cc] whitespace-nowrap opacity-0 group-hover/notif:opacity-100 transition-opacity pointer-events-none shadow-lg">
                      {a.pendingRequests} demande{a.pendingRequests > 1 ? "s" : ""} en attente
                    </div>
                  </div>
                )}

                {/* Top: avatar + name + sport pill */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#13151a] border border-[#2a2d36] flex items-center justify-center shrink-0">
                    <span className="text-[16px] font-bold text-[#8a8d96]">{initials(a)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-bold text-white leading-tight truncate">
                      {a.firstName} {a.lastName}
                    </p>
                    <span className="inline-block mt-1.5 bg-[#E63946]/10 text-[#E63946] text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full">
                      {a.sport} — {a.position}
                    </span>
                  </div>
                  {/* Overflow menu */}
                  <div className="relative">
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === a.id ? null : a.id); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
                      aria-label="Menu actions">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {menuOpen === a.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-9 z-50 bg-[#1A1D24] border border-[#2a2d36] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] py-1.5 min-w-[160px]">
                          <Link href={`/coach/athletes/create?edit=${a.id}`} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#c8c8cc] hover:bg-white/[0.06] transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            Modifier
                          </Link>
                          <button type="button" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#c8c8cc] hover:bg-white/[0.06] transition-colors w-full text-left">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                            Dupliquer
                          </button>
                          <button type="button" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#c8c8cc] hover:bg-white/[0.06] transition-colors w-full text-left">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 8V21H3V8" /><path d="M1 3h22v5H1z" /></svg>
                            Archiver
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* School + City + Grad */}
                <div className="mb-3">
                  <p className="text-[13px] text-[#c8c8cc]">{a.schoolName}</p>
                  <p className="text-[12px] text-[#6b7280]">
                    {a.city} ·{" "}
                    {isUrgentGrad ? (
                      <span className="text-[#f59e0b] font-semibold">
                        Promotion {a.gradYear}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" className="inline ml-1 -mt-0.5">
                          <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
                        </svg>
                      </span>
                    ) : (
                      <span>Promotion {a.gradYear}</span>
                    )}
                  </p>
                </div>

                {/* Profile check badge */}
                <div className="flex items-center gap-2 mb-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={pctColor(a.profileCompletion)} stroke="none">
                    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <circle cx="12" cy="12" r="10" opacity="0.15" />
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke={pctColor(a.profileCompletion)} strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M9 12l2 2 4-4" stroke={pctColor(a.profileCompletion)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <span className="text-[12px] font-bold tabular-nums" style={{ color: pctColor(a.profileCompletion) }}>
                    {a.profileCompletion}%
                  </span>
                </div>

                {/* Next-action nudge */}
                <p className="text-[10px] font-medium mb-3 leading-snug" style={{ color: n.color }}>
                  {n.text}
                </p>

                {/* Stats row + updated */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8a8d96" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                      <span className="text-[12px] text-[#8a8d96]">{a.recruiterViews} vues</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8a8d96" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                      </svg>
                      <span className="text-[12px] text-[#8a8d96]">{a.favoriteCount} favoris</span>
                    </div>
                  </div>
                </div>

                {/* Updated at */}
                <p className={`text-[10px] mb-4 ${updated.stale ? "text-[#f59e0b] font-semibold" : "text-[#4a4d56]"}`}>
                  {updated.text}{updated.stale && " ⚠"}
                </p>

                {/* Bottom: status + actions */}
                <div className="flex items-center justify-between pt-4 border-t border-[#1e2128]">
                  <StatusBadge status={a.status} />
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/coach/athletes/create?edit=${a.id}`}
                      className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#6b7280] hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Modifier
                    </Link>
                    <Link
                      href={`/coach/athletes/${a.id}`}
                      className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#E63946] hover:text-[#ff4d5a] transition-colors"
                    >
                      Voir le profil →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table view ──────────────────────────────────────── */
        <div className={`${cardCls} mt-6 overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#1e2128]">
                  <th className={thCls} onClick={() => handleSort("name")}>Athlète<SortArrow k="name" /></th>
                  <th className={thCls} onClick={() => handleSort("sport")}>Sport<SortArrow k="sport" /></th>
                  <th className={thCls} onClick={() => handleSort("position")}>Position<SortArrow k="position" /></th>
                  <th className={thCls} onClick={() => handleSort("gradYear")}>Promotion<SortArrow k="gradYear" /></th>
                  <th className={`${thCls} text-center`}>Cote</th>
                  <th className={`${thCls} text-center`}>Éval. recruteurs</th>
                  <th className={`${thCls} text-center`} onClick={() => handleSort("completion")}>Profil<SortArrow k="completion" /></th>
                  <th className={`${thCls} text-center`} onClick={() => handleSort("views")}>Vues<SortArrow k="views" /></th>
                  <th className={thCls} onClick={() => handleSort("status")}>Statut<SortArrow k="status" /></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}
                    className="border-b border-[#1e2128]/60 hover:bg-white/[0.02] transition-all cursor-pointer border-l-2 border-l-transparent hover:border-l-[#E63946]">
                    <td className="px-4 py-3.5">
                      <Link href={`/coach/athletes/${a.id}`} className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-[#13151a] border border-[#2a2d36] flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-[#8a8d96]">{initials(a)}</span>
                          </div>
                          {a.pendingRequests > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#E63946] text-[7px] font-bold text-white flex items-center justify-center">
                              {a.pendingRequests}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-white leading-tight">{a.firstName} {a.lastName}</p>
                          <p className="text-[11px] text-[#6b7280]">{a.city}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-[#c8c8cc]">{a.sport}</td>
                    <td className="px-4 py-3.5 text-[13px] text-[#c8c8cc]">{a.position}</td>
                    <td className="px-4 py-3.5 text-[13px] text-[#c8c8cc]">{a.gradYear}</td>
                    {/* Coach rating */}
                    <td className="px-4 py-3.5 text-center">
                      {a.coachRating > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-white">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          {a.coachRating}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#4a4d56]">—</span>
                      )}
                    </td>
                    {/* Recruiter avg */}
                    <td className="px-4 py-3.5 text-center">
                      {a.recruiterAvg !== null ? (
                        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-white">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffffff" stroke="none">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          {a.recruiterAvg.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#4a4d56]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="none" className="inline-block">
                        <circle cx="12" cy="12" r="10" opacity="0.15" fill={pctColor(a.profileCompletion)} />
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke={pctColor(a.profileCompletion)} strokeWidth="2" strokeLinecap="round" fill="none" />
                        <path d="M9 12l2 2 4-4" stroke={pctColor(a.profileCompletion)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="text-[13px] text-[#c8c8cc]">{a.recruiterViews}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={a.status} showAll />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
