/* ─────────────────────────────────────────────────────────────────
   Roster Toolbar — search + filter pills + team, sport, grad year,
   verification status selects
───────────────────────────────────────────────────────────────── */

import { COACH_TEAMS } from "../_data/mockRosterData";
import NxSelect, { type NxOption } from "../../components/NxSelect";

export type FilterPreset = "tous" | "non_verifies" | "plus_consultes" | "favoris";

const PILLS: { key: FilterPreset; label: string; icon?: React.ReactNode }[] = [
  { key: "tous", label: "Tous" },
  { key: "non_verifies", label: "Non vérifiés" },
  { key: "plus_consultes", label: "Les plus consultés" },
  {
    key: "favoris",
    label: "Favoris",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#E63946" stroke="none">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
];

const GRAD_YEARS = [2026, 2027, 2028, 2029];

// Derive unique sports from teams
const SPORTS = [...new Set(COACH_TEAMS.map((t) => t.sport))];

const TEAM_OPTIONS: NxOption[] = [
  { value: "all", label: "Toutes les équipes" },
  ...COACH_TEAMS.map((t) => ({ value: t.id, label: t.name })),
];

const GRAD_OPTIONS: NxOption[] = [
  { value: "all", label: "Toutes les années" },
  ...GRAD_YEARS.map((y) => ({ value: String(y), label: String(y) })),
];

const SPORT_OPTIONS: NxOption[] = [
  { value: "all", label: "Tous les sports" },
  ...SPORTS.map((s) => ({ value: s, label: s })),
];

const VERIFICATION_OPTIONS: NxOption[] = [
  { value: "all", label: "Tous les statuts" },
  { value: "verified", label: "Vérifiés" },
  { value: "not_verified", label: "Non vérifiés" },
  { value: "auto", label: "Auto-vérifiés" },
  { value: "manual", label: "Manuellement vérifiés" },
];

interface RosterToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  activeFilter: FilterPreset;
  onFilterChange: (f: FilterPreset) => void;
  selectedGradYear: string;
  onGradYearChange: (y: string) => void;
  selectedTeamId: string;
  onTeamChange: (id: string) => void;
  selectedSport: string;
  onSportChange: (s: string) => void;
  selectedVerification: string;
  onVerificationChange: (v: string) => void;
}

export default function RosterToolbar({
  search, onSearchChange,
  activeFilter, onFilterChange,
  selectedGradYear, onGradYearChange,
  selectedTeamId, onTeamChange,
  selectedSport, onSportChange,
  selectedVerification, onVerificationChange,
}: RosterToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Search + dropdowns */}
      <div className="flex flex-wrap items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-[40%] min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un athlète..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
          />
        </div>

        {/* Sport select */}
        <div className="w-[170px]">
          <NxSelect
            value={selectedSport}
            onChange={onSportChange}
            options={SPORT_OPTIONS}
            aria-label="Filtrer par sport"
          />
        </div>

        {/* Team select */}
        <div className="w-[200px]">
          <NxSelect
            value={selectedTeamId}
            onChange={onTeamChange}
            options={TEAM_OPTIONS}
            aria-label="Filtrer par équipe"
          />
        </div>

        {/* Graduation year select */}
        <div className="w-[170px]">
          <NxSelect
            value={selectedGradYear}
            onChange={onGradYearChange}
            options={GRAD_OPTIONS}
            aria-label="Filtrer par année de graduation"
          />
        </div>

        {/* Verification status select */}
        <div className="w-[200px]">
          <NxSelect
            value={selectedVerification}
            onChange={onVerificationChange}
            options={VERIFICATION_OPTIONS}
            aria-label="Filtrer par statut de vérification"
          />
        </div>
      </div>

      {/* Row 2: Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
        {PILLS.map((pill) => {
          const isActive = activeFilter === pill.key;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => onFilterChange(pill.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-bold tracking-wide whitespace-nowrap transition-all ${
                isActive
                  ? "bg-[#E63946] text-white"
                  : "bg-transparent border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56]"
              }`}
            >
              {pill.icon}
              {pill.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
