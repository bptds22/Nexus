"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Coach Dashboard (Tableau de bord)
   At-a-glance overview: athlete pipeline, profile completeness,
   recruiter interest, recent activity.
   All mock data — ready for Supabase integration.
───────────────────────────────────────────────────────────────── */

/* ══════════════════════════════════════════════════════════════
   STYLE CONSTANTS
══════════════════════════════════════════════════════════════ */

const cardCls = "bg-[#1A1D24] rounded-[14px] border border-[#1e2128]";
const labelCls = "text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280]";

/* ══════════════════════════════════════════════════════════════
   PROFILE COMPLETENESS — same math as the player card preview
   Required fields (11) = up to 40%
   Bonus sections = up to 60%
══════════════════════════════════════════════════════════════ */

interface AthleteData {
  id: number;
  name: string;
  position: string;
  gradYear: string;
  sport: string;
  status: "approved" | "pending" | "draft";
  rating: number;
  views: number;
  favorites: number;
  teamId: string;
  /* Completeness breakdown — which sections are filled */
  hasPhoto: boolean;
  hasIdentity: boolean;     // firstName, lastName, gender, dob, gradYear
  hasTeam: boolean;         // primarySport, position, team
  hasEvaluation: boolean;   // rating + comments
  hasAcademic: boolean;     // gpa
  hasCegep: boolean;        // cegep programs
  hasPhysical: boolean;     // height + weight
  hasTests: boolean;        // athletic tests
  hasStats: boolean;        // stats summary
  hasMedia: boolean;        // at least 1 video/link
  hasDetailedEval: boolean; // 3+ detailed ratings
  hasTraits: boolean;       // personality traits
  recruiterAvg: number | null; // avg recruiter evaluation (null = no evaluations yet)
  division?: string; // e.g. D1, D2, D3
}

function calcCompleteness(a: AthleteData): number {
  /* Required fields (11 items) → up to 40% */
  const reqItems = [a.hasPhoto, a.hasIdentity, a.hasTeam, a.hasEvaluation];
  // hasIdentity counts as 5 fields, hasTeam as 3, hasEvaluation as 2, hasPhoto as 1 = 11
  let reqScore = 0;
  if (a.hasPhoto) reqScore += 1;
  if (a.hasIdentity) reqScore += 5;
  if (a.hasTeam) reqScore += 3;
  if (a.hasEvaluation) reqScore += 2;
  let pct = Math.round((reqScore / 11) * 40);

  /* Bonus sections → up to 60% */
  if (a.hasAcademic) pct += 8;
  if (a.hasCegep) pct += 3;
  if (a.hasPhysical) pct += 5;
  if (a.hasTests) pct += 3;
  if (a.hasStats) pct += 5;
  if (a.hasMedia) pct += 18;
  if (a.hasDetailedEval) pct += 15;
  if (a.hasTraits) pct += 3;

  return Math.min(pct, 100);
}

function completenessColor(pct: number): string {
  if (pct >= 50) return "#3b82f6";  // blue — bon profil
  return "#8a8d96";                  // gray — incomplet / en progrès
}

function completenessLabel(pct: number): string {
  if (pct >= 50) return "Bon profil";
  if (pct >= 30) return "En progrès";
  return "Incomplet";
}

/* ══════════════════════════════════════════════════════════════
   MOCK DATA
══════════════════════════════════════════════════════════════ */

const COACH = {
  name: "Jean Dupont",
  school: "École sec. De Mortagne",
  teams: [
    { id: "t1", name: "Lynx Juvénile D1", sport: "Football" },
    { id: "t2", name: "Lynx Cadet D2", sport: "Football" },
    { id: "t3", name: "Lynx Basketball Juvénile", sport: "Basketball" },
    { id: "t4", name: "Lynx Basketball Féminin", sport: "Basketball" },
    { id: "t5", name: "Lynx Flag Football", sport: "Flag football" },
  ],
};

const ATHLETES: AthleteData[] = [
  { id: 1, name: "Alexis Tremblay", position: "QB", gradYear: "2027", sport: "Football", status: "approved", rating: 4.2, views: 47, favorites: 5, teamId: "t1", recruiterAvg: 4.0, division: "D1",
    hasPhoto: true, hasIdentity: true, hasTeam: true, hasEvaluation: true, hasAcademic: true, hasCegep: true, hasPhysical: true, hasTests: true, hasStats: true, hasMedia: true, hasDetailedEval: true, hasTraits: true },
  { id: 2, name: "Mathieu Gagné", position: "WR", gradYear: "2027", sport: "Football", status: "approved", rating: 3.8, views: 31, favorites: 3, teamId: "t1", recruiterAvg: 3.5, division: "D1",
    hasPhoto: true, hasIdentity: true, hasTeam: true, hasEvaluation: true, hasAcademic: true, hasCegep: false, hasPhysical: true, hasTests: false, hasStats: true, hasMedia: true, hasDetailedEval: false, hasTraits: true },
  { id: 3, name: "Samuel Bouchard", position: "OL", gradYear: "2027", sport: "Football", status: "pending", rating: 3.5, views: 0, favorites: 0, teamId: "t1", recruiterAvg: null, division: "D1",
    hasPhoto: true, hasIdentity: true, hasTeam: true, hasEvaluation: true, hasAcademic: false, hasCegep: false, hasPhysical: true, hasTests: false, hasStats: false, hasMedia: false, hasDetailedEval: false, hasTraits: false },
  { id: 4, name: "Émile Lavoie", position: "DB", gradYear: "2028", sport: "Football", status: "pending", rating: 4.0, views: 0, favorites: 0, teamId: "t2", recruiterAvg: null, division: "D2",
    hasPhoto: false, hasIdentity: true, hasTeam: true, hasEvaluation: true, hasAcademic: true, hasCegep: false, hasPhysical: true, hasTests: false, hasStats: false, hasMedia: false, hasDetailedEval: false, hasTraits: true },
  { id: 5, name: "Noah Pelletier", position: "RB", gradYear: "2027", sport: "Football", status: "approved", rating: 3.6, views: 22, favorites: 2, teamId: "t1", recruiterAvg: 3.2, division: "D1",
    hasPhoto: true, hasIdentity: true, hasTeam: true, hasEvaluation: true, hasAcademic: false, hasCegep: false, hasPhysical: true, hasTests: false, hasStats: true, hasMedia: true, hasDetailedEval: false, hasTraits: false },
  { id: 6, name: "Raphaël Martin", position: "LB", gradYear: "2027", sport: "Football", status: "draft", rating: 0, views: 0, favorites: 0, teamId: "t2", recruiterAvg: null, division: "D2",
    hasPhoto: false, hasIdentity: true, hasTeam: true, hasEvaluation: false, hasAcademic: false, hasCegep: false, hasPhysical: false, hasTests: false, hasStats: false, hasMedia: false, hasDetailedEval: false, hasTraits: false },
  { id: 7, name: "Olivier Côté", position: "PG", gradYear: "2028", sport: "Basketball", status: "approved", rating: 3.9, views: 18, favorites: 1, teamId: "t3", recruiterAvg: 3.7, division: "D1",
    hasPhoto: true, hasIdentity: true, hasTeam: true, hasEvaluation: true, hasAcademic: true, hasCegep: true, hasPhysical: true, hasTests: false, hasStats: false, hasMedia: false, hasDetailedEval: true, hasTraits: true },
  { id: 8, name: "Léa Fortin", position: "SG", gradYear: "2027", sport: "Basketball", status: "approved", rating: 4.1, views: 26, favorites: 4, teamId: "t4", recruiterAvg: 4.3, division: "D1",
    hasPhoto: true, hasIdentity: true, hasTeam: true, hasEvaluation: true, hasAcademic: true, hasCegep: true, hasPhysical: true, hasTests: false, hasStats: true, hasMedia: true, hasDetailedEval: true, hasTraits: true },
];

const CONTACT_REQUESTS = [
  { id: 1, recruiterName: "Marc Leblanc", recruiterOrg: "CÉGEP André-Laurendeau", athlete: "Alexis Tremblay", sport: "Football", position: "QB", date: "7 mars 2026", status: "open" as const },
  { id: 2, recruiterName: "Sophie Roy", recruiterOrg: "CÉGEP de Sherbrooke", athlete: "Mathieu Gagné", sport: "Football", position: "WR", date: "5 mars 2026", status: "open" as const },
  { id: 3, recruiterName: "Luc Bergeron", recruiterOrg: "CÉGEP Édouard-Montpetit", athlete: "Alexis Tremblay", sport: "Football", position: "QB", date: "3 mars 2026", status: "approved" as const },
];

const ACTIVITY = [
  { id: 1, text: "Profil d'Alexis Tremblay approuvé par l'admin", time: "Il y a 2h", type: "approval" as const },
  { id: 2, text: "Marc Leblanc a demandé à contacter Alexis Tremblay", time: "Il y a 5h", type: "contact" as const },
  { id: 3, text: "Sophie Roy a ajouté Mathieu Gagné en favori", time: "Il y a 1j", type: "favorite" as const },
  { id: 4, text: "Profil de Samuel Bouchard soumis pour approbation", time: "Il y a 2j", type: "submit" as const },
  { id: 5, text: "Luc Bergeron — demande de contact approuvée", time: "Il y a 3j", type: "approval" as const },
  { id: 6, text: "Sophie Roy a demandé à contacter Mathieu Gagné", time: "Il y a 4j", type: "contact" as const },
];

/* ══════════════════════════════════════════════════════════════
   ICON HELPERS — clean, simple color scheme
══════════════════════════════════════════════════════════════ */

function StatIcon({ type, color }: { type: string; color: string }) {
  const props = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "users": return <svg {...props}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>;
    case "check": return <svg {...props}><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>;
    case "clock": return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
    case "edit": return <svg {...props}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
    default: return null;
  }
}

function ActivityIcon({ type }: { type: string }) {
  const base = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "approval": return <svg {...base} stroke="#3b82f6"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>;
    case "contact": return <svg {...base} stroke="#8a8d96"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>;
    case "favorite": return <svg {...base} stroke="#E63946"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>;
    case "submit": return <svg {...base} stroke="#8a8d96"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15l3-3 3 3" /></svg>;
    default: return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   STATUS BADGES
══════════════════════════════════════════════════════════════ */

const statusConfig = {
  approved: { label: "Actif", bg: "bg-[#8a8d96]/10", text: "text-[#c8c8cc]", dot: "bg-emerald-400", animate: true },
  pending: { label: "En attente", bg: "bg-[#8a8d96]/10", text: "text-[#c8c8cc]", dot: "bg-amber-400", animate: false },
  draft: { label: "Brouillon", bg: "bg-[#8a8d96]/10", text: "text-[#c8c8cc]", dot: "bg-[#8a8d96]", animate: false },
  open: { label: "Nouveau", bg: "bg-[#8a8d96]/10", text: "text-[#c8c8cc]", dot: "bg-[#8a8d96]", animate: false },
};

function StatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const c = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${c.bg} ${c.text}`}>
      <span className="relative flex h-2 w-2">
        {c.animate && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-75`} />}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${c.dot}`} />
      </span>
      {c.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPLETENESS RING — small circular progress indicator
══════════════════════════════════════════════════════════════ */

function CompletenessRing({ pct, forceGray }: { pct: number; forceGray?: boolean }) {
  const color = forceGray ? "#8a8d96" : completenessColor(pct);
  const r = 14;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative w-9 h-9 shrink-0">
      <svg width="36" height="36" viewBox="0 0 36 36" className="rotate-[-90deg]">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#1e2128" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white tabular-nums">
        {pct}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE COMPONENT
══════════════════════════════════════════════════════════════ */

export default function CoachDashboardPage() {
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedAthlete, setSelectedAthlete] = useState<(AthleteData & { pct: number }) | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Close panel on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSelectedAthlete(null);
      }
    }
    if (selectedAthlete) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [selectedAthlete]);

  /* Close on Escape */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedAthlete(null);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  /* Filter athletes by team */
  const filtered = selectedTeam ? ATHLETES.filter((a) => a.teamId === selectedTeam) : ATHLETES;

  const totalViews = filtered.reduce((s, a) => s + a.views, 0);
  const totalFavs = filtered.reduce((s, a) => s + a.favorites, 0);

  /* Compute completeness per athlete */
  const athletesWithPct = filtered.map((a) => ({ ...a, pct: calcCompleteness(a) }));
  const avgPct = athletesWithPct.length > 0 ? Math.round(athletesWithPct.reduce((s, a) => s + a.pct, 0) / athletesWithPct.length) : 0;

  /* Sort: lowest completeness first so coach sees what needs work */
  const sortedAthletes = [...athletesWithPct].sort((a, b) => a.pct - b.pct);

  /* Count by status */
  const countApproved = filtered.filter((a) => a.status === "approved").length;
  const countPending = filtered.filter((a) => a.status === "pending").length;
  const countDraft = filtered.filter((a) => a.status === "draft").length;

  /* Count verified (blue check = pct >= 50) */
  const countVerified = athletesWithPct.filter((a) => a.pct >= 50).length;

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 py-8">

      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-[12px] text-[#6b7280] mb-4">
        <Link href="/" className="hover:text-white transition-colors">Nexus</Link>
        <span>/</span>
        <span className="text-[#e0e0e0] font-medium">Tableau de bord</span>
      </nav>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Tableau de bord
          </h1>
          <p className="text-[15px] text-[#6b7280] mt-1">
            Bienvenue, {COACH.name} — {COACH.school}
          </p>
        </div>
        <Link
          href="/coach/athletes/create"
          className="flex items-center gap-2.5 bg-[#E63946] text-white rounded-lg px-5 py-3 font-head font-bold text-[13px] uppercase tracking-widest
            transition-all duration-150 hover:bg-[#c62d3a] hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95 shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
          Créer un profil
        </Link>
      </div>

      {/* ── Hero stats — Athletes · Views · Favorites ─────────── */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Athletes */}
        <div className={`${cardCls} relative overflow-hidden p-6 flex flex-col justify-between`}>
          <div className="absolute top-0 left-0 w-1 h-full bg-[#E63946] rounded-r" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#8a8d96]/10">
              <StatIcon type="users" color="#8a8d96" />
            </div>
            <p className={labelCls}>Athlètes</p>
          </div>
          <p className="text-[42px] font-head font-black text-white leading-none tabular-nums">{ATHLETES.length}</p>
        </div>
        {/* Total views */}
        <div className={`${cardCls} relative overflow-hidden p-6 flex flex-col justify-between`}>
          <div className="absolute top-0 left-0 w-1 h-full bg-[#E63946] rounded-r" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#8a8d96]/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8a8d96" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <p className={labelCls}>Vues totales</p>
          </div>
          <p className="text-[42px] font-head font-black text-white leading-none tabular-nums">{totalViews}</p>
        </div>
        {/* Favorites */}
        <div className={`${cardCls} relative overflow-hidden p-6 flex flex-col justify-between`}>
          <div className="absolute top-0 left-0 w-1 h-full bg-[#E63946] rounded-r" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#8a8d96]/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8a8d96" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <p className={labelCls}>Favoris recruteurs</p>
          </div>
          <p className="text-[42px] font-head font-black text-white leading-none tabular-nums">{totalFavs}</p>
        </div>
      </div>

      {/* ── Secondary stats — Approuvés · En attente · Brouillons · Complétude ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className={`${cardCls} px-4 py-3.5 flex items-center gap-3`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8a8d96]/10">
            <StatIcon type="check" color="#8a8d96" />
          </div>
          <div>
            <p className="text-[22px] font-head font-black text-white leading-none tabular-nums">{countApproved}</p>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Approuvés</p>
          </div>
        </div>
        <div className={`${cardCls} px-4 py-3.5 flex items-center gap-3`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8a8d96]/10">
            <StatIcon type="clock" color="#8a8d96" />
          </div>
          <div>
            <p className="text-[22px] font-head font-black text-white leading-none tabular-nums">{countPending}</p>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">En attente</p>
          </div>
        </div>
        <div className={`${cardCls} px-4 py-3.5 flex items-center gap-3`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8a8d96]/10">
            <StatIcon type="edit" color="#8a8d96" />
          </div>
          <div>
            <p className="text-[22px] font-head font-black text-white leading-none tabular-nums">{countDraft}</p>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Brouillons</p>
          </div>
        </div>
        <div className={`${cardCls} px-4 py-3.5 flex items-center gap-3`}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="none">
            <circle cx="12" cy="12" r="10" opacity="0.15" fill="#3b82f6" />
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M9 12l2 2 4-4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div>
            <p className="text-[22px] font-head font-black text-white leading-none tabular-nums">{countVerified}<span className="text-[12px] text-[#6b7280]">/{athletesWithPct.length}</span></p>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Profils vérifiés</p>
          </div>
        </div>
      </div>

      {/* ── Main grid: Athletes + Activity ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Athletes table — 2 cols */}
        <div className={`${cardCls} lg:col-span-2 overflow-hidden`}>
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-[13px] font-bold tracking-[1.5px] uppercase text-[#8a8d96]">Profils athlètes</h2>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                aria-label="Filtrer par équipe"
                className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-1.5 text-[12px] text-[#e0e0e0] font-medium focus:border-[#E63946] outline-none transition-colors cursor-pointer nx-select-arrow"
              >
                <option value="">Toutes les équipes</option>
                {COACH.teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <Link href="/coach/athletes" className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#E63946] hover:text-[#ff4d5a] transition-colors">
              Voir tout →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-y border-[#1e2128]">
                  <th className="px-6 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Athlète</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Sport</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56] text-center">Cote</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56] text-center">Éval. recruteurs</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56] text-center">Profil</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Statut</th>
                </tr>
              </thead>
              <tbody>
                {sortedAthletes.map((a) => {
                  const pctColor = completenessColor(a.pct);
                  const pctLbl = completenessLabel(a.pct);
                  return (
                    <tr key={a.id} onClick={() => setSelectedAthlete(a)} className="border-b border-[#1e2128]/60 hover:bg-white/[0.02] transition-all cursor-pointer group relative border-l-2 border-l-transparent hover:border-l-[#E63946]">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#13151a] border border-[#2a2d36] flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-[#8a8d96]">
                              {a.name.split(" ").map((n) => n[0]).join("")}
                            </span>
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-white leading-tight">{a.name}</p>
                            <p className="text-[11px] text-[#6b7280]">{a.gradYear}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-[#c8c8cc]">{a.sport}</td>
                      <td className="px-4 py-3.5 text-center">
                        {a.rating > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[13px] font-bold text-white">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            {a.rating}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#4a4d56]">—</span>
                        )}
                      </td>
                      {/* Recruiter avg eval */}
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
                      {/* Completeness column */}
                      <td className="px-4 py-3.5 text-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="none" className="inline-block">
                          <circle cx="12" cy="12" r="10" opacity="0.15" fill={pctColor} />
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke={pctColor} strokeWidth="2" strokeLinecap="round" fill="none" />
                          <path d="M9 12l2 2 4-4" stroke={pctColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity feed — 1 col */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-[13px] font-bold tracking-[1.5px] uppercase text-[#8a8d96]">Activité récente</h2>
          </div>
          <div className="px-6 pb-6 space-y-0.5">
            {ACTIVITY.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-3 border-b border-[#1e2128]/60 last:border-0">
                <div className="mt-0.5 shrink-0">
                  <ActivityIcon type={a.type} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] text-[#e0e0e0] leading-snug">{a.text}</p>
                  <p className="text-[11px] text-[#4a4d56] mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contact Requests ───────────────────────────────────── */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[13px] font-bold tracking-[1.5px] uppercase text-[#8a8d96]">Demandes de contact</h2>
            {CONTACT_REQUESTS.filter((r) => r.status === "open").length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E63946] text-[10px] font-bold text-white">
                {CONTACT_REQUESTS.filter((r) => r.status === "open").length}
              </span>
            )}
          </div>
          <Link href="/coach/requests" className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#E63946] hover:text-[#ff4d5a] transition-colors">
            Voir tout →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-y border-[#1e2128]">
                <th className="px-6 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Recruteur</th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Organisation</th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Athlète</th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Date</th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Statut</th>
                <th className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]"></th>
              </tr>
            </thead>
            <tbody>
              {CONTACT_REQUESTS.map((r) => (
                <tr key={r.id} className="border-b border-[#1e2128]/60 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-3.5">
                    <p className="text-[13px] font-semibold text-white">{r.recruiterName}</p>
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-[#c8c8cc]">{r.recruiterOrg}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-[13px] text-white font-medium">{r.athlete}</p>
                    <p className="text-[11px] text-[#6b7280]">{r.sport} — {r.position}</p>
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-[#6b7280]">{r.date}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    {r.status === "open" && (
                      <div className="flex items-center gap-2">
                        <button type="button" className="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[#E63946] text-white hover:bg-[#c62d3a] hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] hover:-translate-y-0.5 transition-all duration-150 active:scale-95">
                          Approuver
                        </button>
                        <button type="button" className="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[#8a8d96]/10 text-[#c8c8cc] hover:bg-[#8a8d96]/20 hover:-translate-y-0.5 transition-all duration-150 active:scale-95">
                          Refuser
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SLIDE-OUT DETAIL PANEL
      ══════════════════════════════════════════════════════════ */}

      {/* Backdrop */}
      {selectedAthlete && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          fixed top-0 right-0 z-50 h-full w-full sm:w-[440px] bg-[#1A1D24] border-l border-[#1e2128]
          transform transition-transform duration-300 ease-in-out
          ${selectedAthlete ? "translate-x-0" : "translate-x-full"}
          overflow-y-auto
        `}
      >
        {selectedAthlete && (() => {
          const a = selectedAthlete;
          const pct = a.pct;
          const pctColor = completenessColor(pct);
          const teamName = COACH.teams.find((t) => t.id === a.teamId)?.name || "—";
          const initials = a.name.split(" ").map((n) => n[0]).join("");

          return (
            <div className="flex flex-col h-full">

              {/* Panel header */}
              <div className="sticky top-0 z-10 bg-[#1A1D24] border-b border-[#1e2128] px-6 py-4 flex items-center justify-between">
                <span className={labelCls}>Profil athlète</span>
                <button
                  type="button"
                  onClick={() => setSelectedAthlete(null)}
                  aria-label="Fermer"
                  className="text-[#6b7280] hover:text-white transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Panel content */}
              <div className="flex-1 px-6 py-6">

                {/* ── Player Card v30 ── */}
                <div className="flex justify-center mb-6">
                  <div className="nx-v30-wrap relative" style={{ width: 300, paddingTop: 4, paddingBottom: 8 }}>

                    {/* Verified badge — blue if good profile, gray otherwise */}
                    <div className="absolute z-30" style={{ top: 10, right: -10 }}>
                      {pct >= 50 ? (
                        <svg width="42" height="42" viewBox="0 0 54 54" fill="none">
                          <defs>
                            <radialGradient id="coach-bg-grad" cx="38%" cy="28%" r="68%">
                              <stop offset="0%" stopColor="#29AAFF"/><stop offset="55%" stopColor="#0094F0"/><stop offset="100%" stopColor="#0060C0"/>
                            </radialGradient>
                            <radialGradient id="coach-shine" cx="38%" cy="25%" r="55%">
                              <stop offset="0%" stopColor="rgba(255,255,255,0.32)"/><stop offset="60%" stopColor="rgba(255,255,255,0)"/>
                            </radialGradient>
                          </defs>
                          <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35"/>
                          <circle cx="27" cy="27" r="24" fill="url(#coach-bg-grad)"/>
                          <circle cx="27" cy="27" r="24" fill="url(#coach-shine)"/>
                          <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
                          <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                      ) : (
                        <svg width="42" height="42" viewBox="0 0 54 54" fill="none">
                          <defs>
                            <radialGradient id="coach-gray-grad" cx="38%" cy="28%" r="68%">
                              <stop offset="0%" stopColor="#6b7280"/><stop offset="55%" stopColor="#4a4d56"/><stop offset="100%" stopColor="#3a3d46"/>
                            </radialGradient>
                          </defs>
                          <circle cx="27" cy="27" r="26" fill="#4a4d56" opacity="0.35"/>
                          <circle cx="27" cy="27" r="24" fill="url(#coach-gray-grad)"/>
                          <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
                          <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                      )}
                    </div>

                    {/* Main card */}
                    <div className="relative overflow-visible" style={{ width: 300, borderRadius: 10 }}>

                      {/* Photo area */}
                      <div className="relative overflow-hidden" style={{ width: 300, height: 380, borderRadius: 10, background: '#2F3440' }}>
                        <div className="absolute inset-0 z-[1] flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg, #1E2D4A 0%, #0A1428 50%, #1a0a0a 100%)' }}>
                          <span className="font-head text-[80px] font-black text-[#1E2D4A] uppercase select-none" style={{ letterSpacing: '0.05em' }}>
                            {initials}
                          </span>
                        </div>
                        {/* Gradient fade */}
                        <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]"
                          style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }} />
                        {/* Corner fold */}
                        <div className="absolute top-0 right-0 z-20"
                          style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 18px 18px 0', borderColor: 'transparent #1E2128 transparent transparent' }} />
                      </div>

                      {/* Ticket stub */}
                      <div className="absolute z-[999] overflow-hidden"
                        style={{ bottom: -14, right: -20, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex" style={{ width: 310 }}>

                          {/* Left — dark navy */}
                          <div className="flex flex-col justify-between"
                            style={{ background: '#1E2128', padding: '12px 14px', minWidth: 95, gap: 4 }}>
                            {[
                              { lbl: "Sport", val: a.sport },
                              { lbl: "Pos", val: a.position },
                              { lbl: "Div", val: a.division ?? "D1" },
                            ].map((r) => (
                              <div key={r.lbl}>
                                <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)', marginBottom: 1 }}>
                                  {r.lbl}
                                </div>
                                <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>
                                  {r.val}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Perforation */}
                          <div className="flex flex-col items-center justify-center"
                            style={{ width: 10, background: '#E6E6E6', borderLeft: '1.5px dashed rgba(11,18,32,0.2)', borderRight: '1.5px dashed rgba(11,18,32,0.2)', gap: 3 }}>
                            {[...Array(7)].map((_, i) => (
                              <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(11,18,32,0.2)' }} />
                            ))}
                          </div>

                          {/* Right — cream */}
                          <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '10px 14px' }}>
                            <div style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: 18, fontWeight: 900, color: '#1E2128', letterSpacing: '0.04em', lineHeight: 1 }}>
                              {a.name}
                            </div>
                            {/* Stars */}
                            <svg width="100" height="13" viewBox="0 0 100 13" fill="none" style={{ display: 'block', marginTop: 6, marginBottom: 3 }}>
                              {[0, 20, 40, 60, 80].map((x, i) => (
                                <path
                                  key={x}
                                  d="M7,0L8.6,5L14,5L9.6,8L11.2,13L7,10.2L2.8,13L4.4,8L0,5L5.4,5Z"
                                  fill={i < Math.round(a.rating) ? "#F5C518" : "#3D4452"}
                                  transform={`translate(${x},0)`}
                                />
                              ))}
                            </svg>
                            <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#9CA3AF', marginTop: 2 }}>
                              {COACH.school.length > 22 ? COACH.school.slice(0, 22) + "…" : COACH.school}
                            </div>
                            <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#E64B47', marginTop: 1 }}>
                              Promotion {a.gradYear}
                            </div>
                          </div>

                          {/* Stub */}
                          <div className="flex items-center justify-center flex-shrink-0"
                            style={{
                              background: '#E64B47', width: 22,
                              writingMode: 'vertical-rl' as const,
                              fontFamily: 'var(--font-montserrat), sans-serif', fontSize: 9, fontWeight: 900,
                              letterSpacing: '0.22em', color: 'rgba(255,255,255,0.7)',
                            }}>
                            NEXUS
                          </div>

                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Recruiter avg — only info NOT on the card */}
                <div className="bg-[#13151a] border border-[#1e2128] p-4 rounded-lg mb-6">
                  <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#4a4d56] mb-2">Moyenne des évaluations recruteurs</p>
                  <div className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" stroke="none">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-lg font-black text-white">{a.recruiterAvg !== null ? a.recruiterAvg.toFixed(1) : "—"}</span>
                    {a.recruiterAvg !== null && <span className="text-[11px] text-[#6b7280]">/ 5</span>}
                    {a.recruiterAvg === null && <span className="text-[11px] text-[#4a4d56]">Aucune évaluation</span>}
                  </div>
                </div>

                {/* Engagement */}
                <div className="bg-[#13151a] border border-[#1e2128] p-4 rounded-lg mb-6">
                  <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#4a4d56] mb-3">Engagement recruteurs</p>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8d96" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                      <span className="text-sm font-bold text-white">{a.views}</span>
                      <span className="text-[11px] text-[#6b7280]">vues</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                      </svg>
                      <span className="text-sm font-bold text-white">{a.favorites}</span>
                      <span className="text-[11px] text-[#6b7280]">favoris</span>
                    </div>
                  </div>
                </div>

                {/* Profile completeness */}
                <div className="bg-[#13151a] border border-[#1e2128] p-4 rounded-lg mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Complétude du profil</p>
                    <span className="text-sm font-black tabular-nums" style={{ color: pctColor }}>{pct}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-[#1e2128] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: pctColor }} />
                  </div>
                  <p className="text-[11px] text-[#6b7280] mt-2">{completenessLabel(pct)}</p>

                  {/* Section checklist */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4">
                    {[
                      { label: "Photo", done: a.hasPhoto },
                      { label: "Identité", done: a.hasIdentity },
                      { label: "Équipe", done: a.hasTeam },
                      { label: "Évaluation", done: a.hasEvaluation },
                      { label: "Académique", done: a.hasAcademic },
                      { label: "CÉGEP", done: a.hasCegep },
                      { label: "Physique", done: a.hasPhysical },
                      { label: "Tests", done: a.hasTests },
                      { label: "Statistiques", done: a.hasStats },
                      { label: "Média", done: a.hasMedia },
                      { label: "Éval. détaillée", done: a.hasDetailedEval },
                      { label: "Traits", done: a.hasTraits },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-2">
                        {s.done ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8a8d96" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        )}
                        <span className={`text-[11px] ${s.done ? "text-[#c8c8cc]" : "text-[#4a4d56]"}`}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Panel footer — sticky CTA */}
              <div className="sticky bottom-0 bg-[#1A1D24] border-t border-[#1e2128] px-6 py-4">
                <Link
                  href={`/coach/athletes/create?edit=${a.id}`}
                  className="flex items-center justify-center gap-2 w-full h-12 bg-[#E63946] text-white rounded-lg font-head font-bold text-[13px] uppercase tracking-widest
                    transition-all duration-150 hover:bg-[#c62d3a] hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] hover:-translate-y-0.5 active:scale-95"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Modifier le profil
                </Link>
              </div>

            </div>
          );
        })()}
      </div>

    </div>
  );
}
