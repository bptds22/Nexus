"use client";

import { useState, useRef, useEffect } from "react";
import StarRating from "@/components/ui/StarRating";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Recruiter Dashboard
   KPI cards → filterable athlete table → slide-out detail panel.
   All mock data. All French.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/* ══════════════════════════════════════════════════════════════
   MOCK DATA — replace with real API calls later
══════════════════════════════════════════════════════════════ */

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  school: string;
  sport: string;
  position: string;
  division: "D1" | "D2" | "D3";
  gradYear: number;
  heightCm: number;
  weightKg: number;
  coachRating: number;       // 1-5
  cegepAvgRating: number;    // 1-5
  keyStats: string;
  status: "approved" | "new" | "contacted";
  bio: string;
  coachNotes: string;
  hometown: string;
  jerseyNumber: number;
  isFavorite: boolean;
}

const ATHLETES: Athlete[] = [
  {
    id: "ath-001",
    firstName: "Alexis",
    lastName: "Tremblay",
    school: "École sec. De Mortagne",
    sport: "Football",
    position: "QB",
    division: "D1",
    gradYear: 2026,
    heightCm: 185,
    weightKg: 84,
    coachRating: 5,
    cegepAvgRating: 4.5,
    keyStats: "28 TD, 3200 verges, 68% compl.",
    status: "approved",
    bio: "Quart-arrière dynamique avec une lecture de jeu exceptionnelle et un bras puissant. Leader naturel sur le terrain.",
    coachNotes: "Alexis est notre joueur le plus complet. Excellent en lecture de blitz. Prêt pour le niveau collégial.",
    hometown: "Boucherville",
    jerseyNumber: 12,
    isFavorite: true,
  },
  {
    id: "ath-002",
    firstName: "Émilie",
    lastName: "Gagnon",
    school: "Collège Saint-Louis",
    sport: "Basketball",
    position: "Ailière",
    division: "D1",
    gradYear: 2026,
    heightCm: 178,
    weightKg: 68,
    coachRating: 4,
    cegepAvgRating: 4,
    keyStats: "18.2 pts/m, 7.4 reb, 3.1 passes",
    status: "new",
    bio: "Joueuse polyvalente capable de marquer à tous les niveaux. Excellente en défense et en transition rapide.",
    coachNotes: "Émilie a un potentiel énorme. Travailleuse acharnée, première arrivée et dernière à partir.",
    hometown: "Laval",
    jerseyNumber: 23,
    isFavorite: false,
  },
  {
    id: "ath-003",
    firstName: "Samuel",
    lastName: "Bouchard",
    school: "Séminaire de Sherbrooke",
    sport: "Hockey",
    position: "Défenseur",
    division: "D2",
    gradYear: 2027,
    heightCm: 188,
    weightKg: 91,
    coachRating: 4,
    cegepAvgRating: 3.5,
    keyStats: "12 buts, 28 passes, +22",
    status: "contacted",
    bio: "Défenseur robuste avec une excellente relance. Très bon en avantage numérique et en infériorité.",
    coachNotes: "Samuel est notre pilier en défense. Physique et intelligent. Capitaine de l'équipe.",
    hometown: "Sherbrooke",
    jerseyNumber: 4,
    isFavorite: true,
  },
  {
    id: "ath-004",
    firstName: "Camille",
    lastName: "Roy",
    school: "École sec. Saint-Jean-Eudes",
    sport: "Soccer",
    position: "Milieu offensif",
    division: "D1",
    gradYear: 2026,
    heightCm: 165,
    weightKg: 58,
    coachRating: 5,
    cegepAvgRating: 4.5,
    keyStats: "14 buts, 11 passes déc., 90% matchs",
    status: "approved",
    bio: "Milieu créatif avec une vision de jeu remarquable. Technique raffinée et endurance exceptionnelle.",
    coachNotes: "Camille est la meilleure joueuse que j'ai entraînée en 15 ans. Vision de jeu du prochain niveau.",
    hometown: "Québec",
    jerseyNumber: 10,
    isFavorite: false,
  },
  {
    id: "ath-005",
    firstName: "Nathan",
    lastName: "Lavoie",
    school: "Polyvalente Hyacinthe-Delorme",
    sport: "Football",
    position: "Receveur",
    division: "D2",
    gradYear: 2026,
    heightCm: 183,
    weightKg: 79,
    coachRating: 3,
    cegepAvgRating: 3,
    keyStats: "42 réc., 680 verges, 8 TD",
    status: "new",
    bio: "Receveur rapide avec d'excellentes mains. Route runner naturel avec une bonne séparation.",
    coachNotes: "Nathan s'améliore chaque semaine. Besoin de gagner en force mais le talent brut est là.",
    hometown: "Saint-Hyacinthe",
    jerseyNumber: 81,
    isFavorite: false,
  },
  {
    id: "ath-006",
    firstName: "Laurence",
    lastName: "Pelletier",
    school: "École sec. du Triolet",
    sport: "Volleyball",
    position: "Attaquante",
    division: "D1",
    gradYear: 2027,
    heightCm: 180,
    weightKg: 72,
    coachRating: 4,
    cegepAvgRating: 4,
    keyStats: "3.8 att/set, 48% eff., 0.9 blocs/set",
    status: "approved",
    bio: "Attaquante puissante avec un excellent saut vertical. Polyvalente en réception et au service.",
    coachNotes: "Laurence domine au filet. Son timing et sa lecture du bloc sont au-dessus de sa catégorie.",
    hometown: "Sherbrooke",
    jerseyNumber: 7,
    isFavorite: true,
  },
];

/* ── KPI definitions ─────────────────────────────────────────── */

const KPIS = [
  {
    label: "Profils disponibles",
    value: "147",
    change: "+12 cette semaine",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: "Favoris",
    value: "23",
    change: "+3 récemment",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  {
    label: "Demandes envoyées",
    value: "8",
    change: "5 en attente",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    label: "Taux de réponse",
    value: "87%",
    change: "Excellent",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <path d="M22 4L12 14.01l-3-3" />
      </svg>
    ),
  },
];

/* ── Status badge config ─────────────────────────────────────── */

const STATUS_MAP: Record<
  Athlete["status"],
  { label: string; bg: string; text: string; dot: string }
> = {
  approved: {
    label: "Approuvé",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  new: {
    label: "Nouveau",
    bg: "bg-[#3B82F6]/15",
    text: "text-[#3B82F6]",
    dot: "bg-[#3B82F6]",
  },
  contacted: {
    label: "Contacté",
    bg: "bg-[#F59E0B]/15",
    text: "text-[#F59E0B]",
    dot: "bg-[#F59E0B]",
  },
};

/* Stars: use shared StarRating component */

/* ══════════════════════════════════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════════════════════════════════ */

export default function RecruiterDashboard() {
  /* ── Filter state ──────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  /* ── Slide-out panel state ─────────────────────────────────── */
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Close panel on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setSelectedAthlete(null);
      }
    }
    if (selectedAthlete) {
      document.addEventListener("mousedown", handleClick);
    }
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

  /* ── Filter athletes ───────────────────────────────────────── */
  const filtered = ATHLETES.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
      a.school.toLowerCase().includes(q) ||
      a.sport.toLowerCase().includes(q) ||
      a.position.toLowerCase().includes(q);
    const matchesSport = sportFilter === "all" || a.sport === sportFilter;
    const matchesDivision =
      divisionFilter === "all" || a.division === divisionFilter;
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesSport && matchesDivision && matchesStatus;
  });

  /* ── Unique filter options from data ───────────────────────── */
  const sports = [...new Set(ATHLETES.map((a) => a.sport))].sort();
  const divisions = [...new Set(ATHLETES.map((a) => a.division))].sort();

  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto">

      {/* ══════════════════════════════════════════
          PAGE HEADER
      ══════════════════════════════════════════ */}
      <div className="mb-8">
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Tableau de bord
        </h1>
        <p className="font-sans text-sm text-[#9CA3AF] mt-1">
          Découvrez les meilleurs étudiants-athlètes du Québec
        </p>
      </div>

      {/* ══════════════════════════════════════════
          KPI CARDS
      ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="nx-auth-card bg-[#1A1D24] border border-[#2D3748] p-5 transition-colors hover:border-[#374151]"
          >
            <div className="flex items-start justify-between mb-3">
              <span className={`${label} text-[#9CA3AF]`}>{kpi.label}</span>
              <div className="text-[#374151]">{kpi.icon}</div>
            </div>
            <p className="font-head text-2xl font-black text-white tracking-tight">
              {kpi.value}
            </p>
            <p className="font-sans text-xs text-[#6B7280] mt-1">
              {kpi.change}
            </p>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          FILTERS BAR
      ══════════════════════════════════════════ */}
      <div className="nx-auth-card bg-[#1A1D24] border border-[#2D3748] p-4 mb-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher un athlète, école, sport..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="nx-input w-full h-10 pl-10 pr-4 bg-[#111317] border border-[#2D3748] rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-wl-red focus:outline-none transition-colors"
            />
          </div>

          {/* Dropdowns row */}
          <div className="flex items-center gap-3">
            {/* Sport filter */}
            <select
              aria-label="Filtrer par sport"
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
              className="nx-input h-10 px-3 min-w-[150px] bg-[#111317] border border-[#2D3748] rounded-lg text-white font-sans text-sm focus:border-wl-red focus:outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="all">Tous les sports</option>
              {sports.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Division filter */}
            <select
              aria-label="Filtrer par division"
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="nx-input h-10 px-3 min-w-[150px] bg-[#111317] border border-[#2D3748] rounded-lg text-white font-sans text-sm focus:border-wl-red focus:outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="all">Toutes divisions</option>
              {divisions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              aria-label="Filtrer par statut"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="nx-input h-10 px-3 min-w-[150px] bg-[#111317] border border-[#2D3748] rounded-lg text-white font-sans text-sm focus:border-wl-red focus:outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="all">Tous les statuts</option>
              <option value="approved">Approuvé</option>
              <option value="new">Nouveau</option>
              <option value="contacted">Contacté</option>
            </select>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════
          ATHLETE TABLE
      ══════════════════════════════════════════ */}
      <div className="nx-auth-card bg-[#1A1D24] border border-[#2D3748] overflow-hidden">

        {/* Table header */}
        <div className="hidden lg:grid grid-cols-[minmax(160px,1.4fr)_minmax(120px,1.2fr)_minmax(80px,0.7fr)_90px_90px_minmax(120px,1.3fr)_90px_80px] gap-4 px-6 py-3 border-b border-[#2D3748] bg-[#111317]/60">
          <span className={`${label} text-[#6B7280]`}>Athlète</span>
          <span className={`${label} text-[#6B7280]`}>École</span>
          <span className={`${label} text-[#6B7280]`}>Sport / Pos.</span>
          <span className={`${label} text-[#6B7280]`}>Note coach</span>
          <span className={`${label} text-[#6B7280]`}>Moy. CÉGEP</span>
          <span className={`${label} text-[#6B7280]`}>Stats clés</span>
          <span className={`${label} text-[#6B7280]`}>Statut</span>
          <span className={`${label} text-[#6B7280]`}>Action</span>
        </div>

        {/* Table rows */}
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-sans text-sm text-[#6B7280]">
              Aucun athlète ne correspond à vos critères.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#2D3748]">
            {filtered.map((a) => {
              const st = STATUS_MAP[a.status];
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedAthlete(a)}
                  className="group cursor-pointer transition-colors hover:bg-[#0D1A38] px-6 py-4"
                >
                  {/* Desktop row */}
                  <div className="hidden lg:grid grid-cols-[minmax(160px,1.4fr)_minmax(120px,1.2fr)_minmax(80px,0.7fr)_90px_90px_minmax(120px,1.3fr)_90px_80px] gap-4 items-center">

                    {/* Name + division badge */}
                    <div className="flex items-center gap-3">
                      {/* Avatar circle */}
                      <div className="w-9 h-9 rounded-full bg-[#2D3748] border border-[#374151] flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-[#9CA3AF]">
                          {a.firstName[0]}{a.lastName[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-sans text-sm text-white font-semibold truncate">
                          {a.firstName} {a.lastName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase bg-wl-red/15 text-[#E63946] rounded">
                            {a.division}
                          </span>
                          <span className="text-[10px] text-[#6B7280]">{a.gradYear}</span>
                        </div>
                      </div>
                      {/* Favorite indicator */}
                      {a.isFavorite && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#E63946" stroke="none" className="shrink-0">
                          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                        </svg>
                      )}
                    </div>

                    {/* School */}
                    <p className="font-sans text-sm text-[#9CA3AF] truncate">{a.school}</p>

                    {/* Sport + Position */}
                    <div className="min-w-0">
                      <p className="font-sans text-xs text-white truncate">{a.sport}</p>
                      <p className="font-sans text-[11px] text-[#6B7280] truncate">{a.position}</p>
                    </div>

                    {/* Coach rating */}
                    <StarRating rating={a.coachRating} size="sm" />

                    {/* CÉGEP avg rating */}
                    <StarRating rating={a.cegepAvgRating} size="sm" />

                    {/* Key stats */}
                    <p className="font-sans text-xs text-[#e0e0e0] truncate">{a.keyStats}</p>

                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${st.bg} ${st.text} text-[9px] font-bold tracking-[0.12em] uppercase w-fit`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>

                    {/* Contact button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAthlete(a);
                      }}
                      className="nx-ghost-btn h-8 px-3 border text-[9px] font-head font-bold uppercase tracking-widest whitespace-nowrap"
                    >
                      Contact
                    </button>
                  </div>

                  {/* Mobile card */}
                  <div className="lg:hidden">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#2D3748] border border-[#374151] flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#9CA3AF]">
                            {a.firstName[0]}{a.lastName[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-sans text-sm text-white font-semibold truncate">
                            {a.firstName} {a.lastName}
                          </p>
                          <p className="font-sans text-xs text-[#6B7280] truncate">{a.school}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${st.bg} ${st.text} text-[9px] font-bold tracking-wider uppercase shrink-0`}>
                        <span className={`w-1 h-1 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
                      <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase bg-wl-red/15 text-[#E63946] rounded">{a.division}</span>
                      <span>{a.sport} — {a.position}</span>
                      <StarRating rating={a.coachRating} size="sm" />
                    </div>
                    <p className="font-sans text-xs text-[#6B7280] mt-1.5 truncate">{a.keyStats}</p>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Table footer */}
        <div className="px-6 py-3 border-t border-[#2D3748] bg-[#111317]/60 flex items-center justify-between">
          <p className="font-sans text-xs text-[#6B7280]">
            {filtered.length} athlète{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
          </p>
          <p className="font-sans text-xs text-[#6B7280]">
            Page 1 sur 1
          </p>
        </div>

      </div>

      {/* ══════════════════════════════════════════
          SLIDE-OUT DETAIL PANEL
      ══════════════════════════════════════════ */}

      {/* Backdrop */}
      {selectedAthlete && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          fixed top-0 right-0 z-50 h-full w-full sm:w-[440px] bg-[#1A1D24] border-l border-[#2D3748]
          transform transition-transform duration-300 ease-in-out
          ${selectedAthlete ? "translate-x-0" : "translate-x-full"}
          overflow-y-auto
        `}
      >
        {selectedAthlete && (
          <div className="flex flex-col h-full">

            {/* Panel header */}
            <div className="sticky top-0 z-10 bg-[#1A1D24] border-b border-[#2D3748] px-6 py-4 flex items-center justify-between">
              <span className={`${label} text-[#9CA3AF]`}>Profil athlète</span>
              <button
                type="button"
                onClick={() => setSelectedAthlete(null)}
                className="text-[#6B7280] hover:text-white transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 px-6 py-6">

              {/* ── Player Card v30 (dynamic) ── */}
              <div className="flex justify-center mb-6">
                <div className="nx-v30-wrap relative" style={{ width: 300, paddingTop: 4, paddingBottom: 8 }}>

                  {/* Verified badge */}
                  {selectedAthlete.status === "approved" && (
                    <div className="nx-v30-badge absolute z-30" style={{ top: 10, right: -10 }}>
                      <svg width="42" height="42" viewBox="0 0 54 54" fill="none">
                        <defs>
                          <radialGradient id="panel-bg-grad" cx="38%" cy="28%" r="68%">
                            <stop offset="0%" stopColor="#29AAFF"/>
                            <stop offset="55%" stopColor="#0094F0"/>
                            <stop offset="100%" stopColor="#0060C0"/>
                          </radialGradient>
                          <radialGradient id="panel-shine" cx="38%" cy="25%" r="55%">
                            <stop offset="0%" stopColor="rgba(255,255,255,0.32)"/>
                            <stop offset="60%" stopColor="rgba(255,255,255,0)"/>
                          </radialGradient>
                        </defs>
                        <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35"/>
                        <circle cx="27" cy="27" r="24" fill="url(#panel-bg-grad)"/>
                        <circle cx="27" cy="27" r="24" fill="url(#panel-shine)"/>
                        <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
                        <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                    </div>
                  )}

                  {/* Main card */}
                  <div className="nx-v30-card relative overflow-visible" style={{ width: 300, borderRadius: 10 }}>

                    {/* Photo area — gradient placeholder with initials */}
                    <div className="relative overflow-hidden" style={{ width: 300, height: 380, borderRadius: 10, background: '#2F3440' }}>
                      {/* Gradient avatar bg */}
                      <div
                        className="absolute inset-0 z-[1] flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #2D3748 0%, #1A1D24 50%, #1a0a0a 100%)' }}
                      >
                        <span className="font-head text-[80px] font-black text-[#2D3748] uppercase select-none" style={{ letterSpacing: '0.05em' }}>
                          {selectedAthlete.firstName[0]}{selectedAthlete.lastName[0]}
                        </span>
                      </div>
                      {/* Jersey number watermark */}
                      <div className="absolute top-3 left-4 z-[3]">
                        <span className="font-head text-[48px] font-black text-white/10 leading-none">
                          #{selectedAthlete.jerseyNumber}
                        </span>
                      </div>
                      {/* Gradient fade to bottom */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]"
                        style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }}
                      />
                      {/* Corner fold */}
                      <div
                        className="absolute top-0 right-0 z-20"
                        style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 18px 18px 0', borderColor: 'transparent #1E2128 transparent transparent' }}
                      />
                    </div>

                    {/* Ticket stub */}
                    <div
                      className="nx-v30-ticket absolute z-[999] overflow-hidden"
                      style={{ bottom: -14, right: -20, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)' }}
                    >
                      <div className="flex" style={{ width: 310 }}>

                        {/* Left — dark navy */}
                        <div
                          className="flex flex-col justify-between"
                          style={{ background: '#1E2128', padding: '12px 14px 12px 14px', minWidth: 95, gap: 4 }}
                        >
                          {[
                            { lbl: "Sport", val: selectedAthlete.sport },
                            { lbl: "Pos", val: selectedAthlete.position },
                            { lbl: "Div", val: selectedAthlete.division },
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
                        <div
                          className="flex flex-col items-center justify-center"
                          style={{ width: 10, background: '#E6E6E6', borderLeft: '1.5px dashed rgba(11,18,32,0.2)', borderRight: '1.5px dashed rgba(11,18,32,0.2)', gap: 3 }}
                        >
                          {[...Array(7)].map((_, i) => (
                            <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(11,18,32,0.2)' }} />
                          ))}
                        </div>

                        {/* Right — cream */}
                        <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '12px 14px' }}>
                          {/* Stars */}
                          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#1E2128', borderRadius: 4, padding: '3px 5px', marginBottom: 6, width: 'fit-content' }}>
                            <StarRating rating={selectedAthlete.coachRating} size="md" showNumber={false} className="!gap-0.5" />
                          </div>
                          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#1E2128', marginBottom: 2 }}>
                            {selectedAthlete.school.length > 22 ? selectedAthlete.school.slice(0, 22) + "…" : selectedAthlete.school}
                          </div>
                          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#9CA3AF' }}>
                            {selectedAthlete.hometown}
                          </div>
                          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#E63946', marginTop: 2 }}>
                            Promotion {selectedAthlete.gradYear}
                          </div>
                        </div>

                        {/* Stub */}
                        <div
                          className="flex items-center justify-center flex-shrink-0"
                          style={{
                            background: '#E63946',
                            width: 22,
                            writingMode: 'vertical-rl' as const,
                            fontFamily: 'var(--font-montserrat), sans-serif',
                            fontSize: 9,
                            fontWeight: 900,
                            letterSpacing: '0.22em',
                            color: 'rgba(255,255,255,0.7)',
                          }}
                        >
                          NEXUS
                        </div>

                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Quick stats row below card */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {[
                  { l: "Taille", v: `${selectedAthlete.heightCm} cm` },
                  { l: "Poids", v: `${selectedAthlete.weightKg} kg` },
                  { l: "Ville", v: selectedAthlete.hometown },
                  { l: "Grad.", v: String(selectedAthlete.gradYear) },
                ].map((item) => (
                  <div key={item.l} className="bg-[#111317] border border-[#2D3748] p-2.5 rounded-lg text-center">
                    <p className={`${label} text-[#6B7280] mb-0.5`} style={{ fontSize: 8 }}>{item.l}</p>
                    <p className="font-sans text-xs text-white font-semibold">{item.v}</p>
                  </div>
                ))}
              </div>

              {/* Ratings */}
              <div className="flex gap-6 mb-6 p-4 bg-[#111317] border border-[#2D3748] rounded-lg">
                <div>
                  <p className={`${label} text-[#6B7280] mb-1.5`}>Note coach</p>
                  <StarRating rating={selectedAthlete.coachRating} size="sm" />
                </div>
                <div>
                  <p className={`${label} text-[#6B7280] mb-1.5`}>Moy. CÉGEP</p>
                  <StarRating rating={selectedAthlete.cegepAvgRating} size="sm" />
                </div>
              </div>

              {/* Key stats */}
              <div className="mb-6">
                <p className={`${label} text-[#9CA3AF] mb-2`}>Statistiques clés</p>
                <p className="font-sans text-sm text-[#e0e0e0] bg-[#111317] border border-[#2D3748] p-3 rounded-lg">
                  {selectedAthlete.keyStats}
                </p>
              </div>

              {/* Bio */}
              <div className="mb-6">
                <p className={`${label} text-[#9CA3AF] mb-2`}>Biographie</p>
                <p className="font-sans text-sm text-[#e0e0e0] leading-relaxed">
                  {selectedAthlete.bio}
                </p>
              </div>

              {/* Coach notes */}
              <div className="mb-6">
                <p className={`${label} text-[#9CA3AF] mb-2`}>Notes de l&apos;entraîneur</p>
                <div className="bg-[#111317] border border-[#2D3748] p-4 rounded-lg">
                  <p className="font-sans text-sm text-[#e0e0e0] leading-relaxed italic">
                    &ldquo;{selectedAthlete.coachNotes}&rdquo;
                  </p>
                </div>
              </div>

            </div>

            {/* Panel footer — sticky CTA */}
            <div className="sticky bottom-0 bg-[#1A1D24] border-t border-[#2D3748] px-6 py-4">
              <button
                type="button"
                className="nx-ghost-btn w-full h-12 border font-head font-black text-sm uppercase tracking-widest"
              >
                Je suis intéressé
              </button>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
