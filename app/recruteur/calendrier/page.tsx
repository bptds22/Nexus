"use client";

/* ═══════════════════════════════════════════════════════════════
   Calendrier de recrutement — portail recruteur.

   Port 1:1 de docs/reference/calendrier-recruteur-ref.html
   (SHA-256 CEBAA004…3C7E). La réf est pixel-finale : aucune décision
   de design n'est prise ici, seules les données sont branchées.

   Portail recruteur = PLATEFORME → rouge Nexus légitime, Outfit,
   vouvoiement.
═══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useRegions } from "@/lib/queries/shared/useRegions";
import { usePositionsBySport } from "@/lib/queries/recruiter/usePositionsBySport";
import { useRecruiterLists } from "@/lib/queries/recruiter/useRecruiterLists";
import {
  useRecruitingCalendar,
  todayIso,
  type CalendarTarget,
} from "@/lib/queries/recruiter/useRecruitingCalendar";
import {
  buildMatches,
  buildMonthGrid,
  dayNumber,
  EMPTY_FILTERS,
  filterTargets,
  formatLastUpdated,
  groupByWeek,
  hasActiveFilters,
  matchesOnDay,
  monthLabel,
  shortMonthLabel,
  type CalendarFilters,
  type CalendarSort,
  type MatchView,
} from "@/lib/calendar/recruitingCalendar";
import { RECRUITER_TIERS } from "@/lib/config/pricing";
import { RecruteurCalendrierMobile } from "@/components/shared/RecruteurCalendrierMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* Sous-ensemble des sports de la page Recherche. */
const SPORTS = [
  { value: "", label: "Tous les sports" },
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "soccer", label: "Soccer" },
  { value: "hockey", label: "Hockey" },
  { value: "volleyball", label: "Volleyball" },
  { value: "athlétisme", label: "Athlétisme" },
  { value: "badminton", label: "Badminton" },
  { value: "baseball", label: "Baseball" },
  { value: "cheerleading", label: "Cheerleading" },
  { value: "cross-country", label: "Cross-country" },
  { value: "flag_football", label: "Flag football" },
  { value: "futsal", label: "Futsal" },
  { value: "natation", label: "Natation" },
  { value: "rugby", label: "Rugby" },
  { value: "ultimate_frisbee", label: "Ultimate frisbee" },
  { value: "autre", label: "Autre" },
];

const PROMOTIONS = ["2026", "2027", "2028"];

/* Stages de recruiter_pipeline (chk_recruiter_pipeline_stage). */
const STAGES: { value: string; label: string }[] = [
  { value: "IDENTIFIE", label: "Identifié" },
  { value: "CONTACTE", label: "Contacté" },
  { value: "EN_DISCUSSION", label: "En discussion" },
  { value: "VISITE_PLANIFIEE", label: "En visite" },
  { value: "ENGAGE", label: "Engagé" },
  { value: "LETTRE_SIGNEE", label: "Lettre signée" },
];

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.value, s.label]),
);

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/* ── Primitives de la réf ──────────────────────────────────── */

const Chevron = ({ className = "" }: { className?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CalendarIcon = ({ size = 15, strokeWidth = 2.2 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const LockIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/** `.f-select` de la réf, en <select> natif. */
function FilterSelect({
  value, onChange, disabled, active, children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative inline-flex items-center rounded-full border transition-colors ${
        disabled
          ? "bg-[#1A1D24] border-[#262A33] text-[#5C6575]"
          : active
            ? "bg-[rgba(230,57,70,0.09)] border-[rgba(230,57,70,0.28)] text-[#EDEFF3]"
            : "bg-[#1A1D24] border-[#262A33] text-[#EDEFF3]"
      }`}
    >
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none bg-transparent outline-none pl-[18px] pr-9 py-[10px] text-[14.5px] whitespace-nowrap ${
          active ? "font-semibold" : "font-medium"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {children}
      </select>
      <Chevron className="pointer-events-none absolute right-[15px] opacity-55" />
    </div>
  );
}

/** `.f-select.on-list` — multi-sélection : chaque choix s'ajoute, la pastille
 *  teintée porte le × de la réf pour tout effacer. */
function MultiFilterSelect({
  values, onAdd, onClear, placeholder, renderLabel, children,
}: {
  values: string[];
  onAdd: (v: string) => void;
  onClear: () => void;
  placeholder: string;
  renderLabel: (values: string[]) => string;
  children: React.ReactNode;
}) {
  const active = values.length > 0;
  return (
    <div
      className={`relative inline-flex items-center rounded-full border transition-colors ${
        active
          ? "bg-[rgba(230,57,70,0.09)] border-[rgba(230,57,70,0.28)] text-[#EDEFF3] font-semibold"
          : "bg-[#1A1D24] border-[#262A33] text-[#EDEFF3] font-medium"
      }`}
    >
      <select
        value=""
        onChange={(e) => { if (e.target.value) onAdd(e.target.value); }}
        className={`appearance-none bg-transparent outline-none cursor-pointer pl-[18px] py-[10px] text-[14.5px] whitespace-nowrap ${active ? "pr-2" : "pr-9"}`}
      >
        <option value="">{active ? renderLabel(values) : placeholder}</option>
        {children}
      </select>
      {active && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Effacer le filtre"
          className="pr-[15px] pl-0.5 text-[#8A909C] hover:text-[#EDEFF3] font-normal text-[14.5px] leading-none"
        >
          ×
        </button>
      )}
      {!active && <Chevron className="pointer-events-none absolute right-[15px] opacity-55" />}
    </div>
  );
}

/** `.f-chip` */
function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-[15px] py-2 text-[14px] font-medium transition-colors ${
        on
          ? "text-[#EDEFF3] border-[rgba(230,57,70,0.28)] bg-[rgba(230,57,70,0.09)]"
          : "text-[#8A909C] border-[#262A33] bg-transparent hover:text-[#EDEFF3] hover:border-[#333B4A]"
      }`}
    >
      {children}
    </button>
  );
}

/** `.av` — pastille d'initiales. */
function Avatar({ text, more = false, className = "" }: { text: string; more?: boolean; className?: string }) {
  return (
    <div
      className={`w-[34px] h-[34px] rounded-full border-2 border-[#1A1D24] flex items-center justify-center font-bold shrink-0 ${
        more ? "bg-[#B32330] text-white text-[11.5px]" : "bg-[#20242C] text-[#B9BFC9] text-[12px]"
      } ${className}`}
    >
      {text}
    </div>
  );
}

/** `.stg` — pastille de stage pipeline. `VISITE_PLANIFIEE` est le seul
 *  stage que la réf distingue (vert). Une cible venue d'un favori ou
 *  d'une liste seule n'a aucun stage : on n'affiche alors pas de
 *  pastille plutôt que d'inventer un libellé. */
function StagePill({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const label = STAGE_LABEL[stage] ?? stage;
  const isVisit = stage === "VISITE_PLANIFIEE";
  return (
    <span
      className={`shrink-0 rounded-full px-[10px] py-[3px] text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap ${
        isVisit
          ? "bg-[rgba(34,197,94,0.10)] border border-[rgba(34,197,94,0.30)] text-[#22C55E]"
          : "bg-[#20242C] text-[#B9BFC9]"
      }`}
    >
      {label}
    </span>
  );
}

/** `.tgt` — une cible dans le détail déplié. */
function TargetRow({ t }: { t: CalendarTarget }) {
  return (
    <div className="flex items-center gap-3 py-2 border-t border-[#1E2129] first:border-t-0">
      <Avatar text={t.initials} className="!w-8 !h-8 !border-[#171A20]" />
      <div className="flex-1 min-w-0">
        <b className="block text-[14.5px] font-semibold leading-[1.3] text-[#EDEFF3]">
          {t.firstName} {t.lastName}
          {t.verified && <span className="text-[#3B82F6]"> ✓</span>}
        </b>
        <i className="not-italic text-[12.5px] text-[#8A909C]">
          {[t.position, t.graduationYear ? `Promotion ${t.graduationYear}` : ""]
            .filter(Boolean)
            .join(" · ")}
        </i>
      </div>
      <StagePill stage={t.pipelineStage} />
    </div>
  );
}

/** Colonne d'équipe du détail déplié. */
function DetailColumn({ name, targets, className = "" }: { name: string; targets: CalendarTarget[]; className?: string }) {
  return (
    <div className={`px-[22px] py-[18px] ${className}`}>
      <div className="mb-3 text-[13px] font-bold tracking-[0.1em] uppercase text-[#B9BFC9]">
        {name}
        <span className="ml-2 text-[12.5px] font-medium tracking-normal normal-case text-[#5C6575]">
          {targets.length} cible{targets.length > 1 ? "s" : ""}
        </span>
      </div>
      {targets.length === 0 ? (
        <div className="text-[13.5px] italic text-[#5C6575]">Aucune de vos cibles dans cette équipe.</div>
      ) : (
        targets.map((t) => <TargetRow key={`${t.athleteId}-${t.teamId}`} t={t} />)
      )}
    </div>
  );
}

/** `.match` — carte de match. Partagée par la vue Liste et la vue
 *  Calendrier (cartes du jour rendues sous la grille). */
function MatchCard({ m }: { m: MatchView }) {
  const [open, setOpen] = useState(false);
  const stack = [...m.homeTargets, ...m.visitorTargets];
  const shown = stack.slice(0, 3);
  const extra = stack.length - shown.length;

  return (
    <div
      className={`bg-[#1A1D24] border border-[#262A33] rounded-2xl overflow-hidden transition-colors hover:border-[#333B4A] ${
        m.hot ? "border-l-[3px] border-l-[#E63946]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-[22px] px-[22px] py-[18px] text-left text-[#EDEFF3] flex-wrap sm:flex-nowrap"
      >
        {/* Bloc date */}
        <div className="w-16 shrink-0 text-center">
          <div className="text-[30px] font-extrabold leading-none tracking-[-0.02em]">
            {dayNumber(m.game.gameDate)}
          </div>
          <div className="mt-[3px] text-[12px] font-bold uppercase tracking-[0.1em] text-[#E63946]">
            {shortMonthLabel(m.game.gameDate)}
          </div>
        </div>

        {/* Matchup + meta */}
        <div className="flex-1 min-w-0">
          {m.hot && (
            <span className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#E63946]">
              ★ Match à fort potentiel
            </span>
          )}
          <div className="text-[17px] font-bold leading-[1.35]">
            {m.game.homeName}
            <span className="px-1 text-[14.5px] font-medium text-[#5C6575]">vs</span>
            {m.game.visitorName}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-[14px] gap-y-1.5 text-[14.5px] font-medium text-[#8A909C]">
            {m.game.gameTime && <span>{m.game.gameTime}</span>}
            {m.game.venue && <span>{m.game.venue}</span>}
            {m.game.competition && <span className="text-[#5C6575]">{m.game.competition}</span>}
          </div>
        </div>

        {/* Compteur */}
        <div className="flex shrink-0 items-center gap-[14px] max-sm:w-full max-sm:justify-end">
          <div className="flex">
            {shown.map((t, i) => (
              <Avatar
                key={`${t.athleteId}-${t.teamId}`}
                text={t.initials}
                className={i === 0 ? "" : "-ml-[9px]"}
              />
            ))}
            {extra > 0 && <Avatar text={`+${extra}`} more className="-ml-[9px]" />}
          </div>
          <span className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-[rgba(230,57,70,0.28)] bg-[rgba(230,57,70,0.09)] px-[15px] py-[7px] text-[14px] font-semibold text-[#EDEFF3]">
            <b className="font-extrabold text-[#E63946]">{m.count}</b> cible{m.count > 1 ? "s" : ""}
          </span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-[#5C6575] transition-transform duration-[250ms] ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-1 border-t border-[#1E2129] bg-[#171A20] md:grid-cols-2">
          <DetailColumn name={m.game.homeName} targets={m.homeTargets} />
          <DetailColumn
            name={m.game.visitorName}
            targets={m.visitorTargets}
            className="border-t border-[#1E2129] md:border-t-0 md:border-l"
          />
        </div>
      )}
    </div>
  );
}

/* ── Planches d'états ──────────────────────────────────────── */

function EmptyBoard() {
  return (
    <div className="mt-[34px] rounded-2xl border border-[#262A33] bg-[#1A1D24] px-[30px] py-[60px] text-center">
      <div className="mb-[18px] inline-flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#20242C] text-[#8A909C]">
        <CalendarIcon size={26} strokeWidth={1.8} />
      </div>
      <h3 className="mb-2 text-[20px] font-bold text-[#EDEFF3]">Aucun match à venir pour vos cibles</h3>
      <p className="mx-auto max-w-[520px] text-[15px] text-[#8A909C]">
        Leurs équipes ne sont pas encore reliées au calendrier RSEQ, ou la saison n&apos;est pas publiée.
        Les matchs apparaîtront automatiquement dès que les calendriers seront disponibles.{" "}
        <Link href="/recruteur/recherche" className="font-semibold text-[#E63946] no-underline">
          Explorer des athlètes →
        </Link>
      </p>
    </div>
  );
}

/** Mur Free — planche `.board.lock` de la réf. Le fond flouté est le
 *  décor de la réf (fixture), pas de la donnée : aucune requête ne
 *  part pour un recruteur Free. */
function FreeWall() {
  const pro = RECRUITER_TIERS.find((t) => t.id === "rec_pro");
  const price = pro ? `${pro.monthly.toFixed(2).replace(".", ",")} $/mois` : "";

  const Ghost = ({ day, month, home, visitor, meta, count }: {
    day: string; month: string; home: string; visitor: string; meta: string; count: number;
  }) => (
    <div className="mb-3 overflow-hidden rounded-2xl border border-[#262A33] bg-[#1A1D24]">
      <div className="flex items-center gap-[22px] px-[22px] py-[18px]">
        <div className="w-16 shrink-0 text-center">
          <div className="text-[30px] font-extrabold leading-none tracking-[-0.02em] text-[#EDEFF3]">{day}</div>
          <div className="mt-[3px] text-[12px] font-bold uppercase tracking-[0.1em] text-[#E63946]">{month}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold leading-[1.35] text-[#EDEFF3]">
            {home}<span className="px-1 text-[14.5px] font-medium text-[#5C6575]">vs</span>{visitor}
          </div>
          <div className="mt-1 text-[14.5px] font-medium text-[#8A909C]">{meta}</div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-[7px] rounded-full border border-[rgba(230,57,70,0.28)] bg-[rgba(230,57,70,0.09)] px-[15px] py-[7px] text-[14px] font-semibold text-[#EDEFF3]">
          <b className="font-extrabold text-[#E63946]">{count}</b> cibles
        </span>
      </div>
    </div>
  );

  return (
    <div className="relative mt-[34px] overflow-hidden rounded-2xl border border-[#262A33] bg-[#1A1D24] px-[30px] py-[60px] text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none p-6 opacity-45 blur-[7px]">
        <Ghost day="12" month="Oct" home="Vulkins Jean-Eudes" visitor="Phénix André-Grasset" meta="14:00 · Stade Jean-Eudes" count={6} />
        <Ghost day="14" month="Oct" home="Titans Limoilou" visitor="Élans Garneau" meta="19:30 · Terrain Limoilou" count={2} />
      </div>
      <div className="relative z-[2]">
        <div className="mb-[18px] inline-flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#20242C] text-[#8A909C]">
          <LockIcon />
        </div>
        <h3 className="mb-2 text-[20px] font-bold text-[#EDEFF3]">Planifiez vos déplacements avec le tier Pro</h3>
        <p className="mx-auto max-w-[520px] text-[15px] text-[#8A909C]">
          Voyez quels matchs regroupent le plus de vos cibles, filtrés par position, promotion et région.
        </p>
        <Link
          href="/tarifs"
          className="mt-5 inline-flex items-center gap-[9px] rounded-xl border-0 bg-[#E63946] px-[26px] py-[13px] text-[15px] font-bold text-white shadow-[0_8px_22px_-10px_rgba(230,57,70,0.7)]"
        >
          Passer au tier Pro{price ? ` — ${price}` : ""}
        </Link>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */

export default function CalendrierPage() {
  if (IS_CAPACITOR) return <RecruteurCalendrierMobile />;
  return <CalendrierContent />;
}

function CalendrierContent() {
  const { tier, loading: tierLoading } = useSubscription();
  const isFree = tier === "free";

  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<CalendarSort>("date");
  const [view, setView] = useState<"list" | "cal">("list");

  const today = useMemo(() => todayIso(), []);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Le mur Free ne monte aucune requête : le contenu n'est pas
  // téléchargé puis masqué, il n'est jamais demandé.
  const { data, isLoading, isError } = useRecruitingCalendar(!isFree && !tierLoading);
  const { data: regions = [] } = useRegions();
  const { data: lists = [] } = useRecruiterLists();
  const { data: posData } = usePositionsBySport(filters.sport || null);
  const positions = posData?.positions ?? [];

  const targets = data?.targets ?? [];
  const games = data?.games ?? [];

  const matches = useMemo(
    () => buildMatches(games, filterTargets(targets, filters), sort),
    [games, targets, filters, sort],
  );
  const weeks = useMemo(() => groupByWeek(matches), [matches]);
  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, matches, today),
    [cursor, matches, today],
  );
  const dayMatches = useMemo(
    () => (selectedDay ? matchesOnDay(matches, selectedDay) : []),
    [matches, selectedDay],
  );

  const lastUpdated = formatLastUpdated(data?.lastUpdated ?? null);

  const set = <K extends keyof CalendarFilters>(k: K, v: CalendarFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const toggleIn = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  // Nav mois bornée : jamais avant le mois courant.
  const now = new Date();
  const atFirstMonth =
    cursor.year < now.getFullYear() ||
    (cursor.year === now.getFullYear() && cursor.month <= now.getMonth());

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelectedDay(null);
  };

  return (
    <div className="mx-auto max-w-[1180px] px-[26px] pb-[90px] pt-10 font-sans text-[#EDEFF3]">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="font-head text-[clamp(28px,3.2vw,40px)] font-extrabold uppercase leading-[1.1] tracking-[-0.01em]">
            Calendrier de recrutement
          </h1>
          <div className="mt-1.5 text-[16px] font-normal text-[#B9BFC9]">
            Vos prochains matchs à surveiller, selon vos cibles
          </div>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-xl border border-[#262A33] bg-[#1A1D24]">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`flex items-center gap-2 px-[18px] py-[11px] text-[14px] font-semibold transition-all ${
              view === "list" ? "bg-[#E63946] text-white" : "text-[#8A909C] hover:text-[#EDEFF3]"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" />
            </svg>
            Liste
          </button>
          <button
            type="button"
            onClick={() => setView("cal")}
            className={`flex items-center gap-2 px-[18px] py-[11px] text-[14px] font-semibold transition-all ${
              view === "cal" ? "bg-[#E63946] text-white" : "text-[#8A909C] hover:text-[#EDEFF3]"
            }`}
          >
            <CalendarIcon />
            Calendrier
          </button>
        </div>
      </div>

      {/* ── Disclaimer + fraîcheur ── */}
      <div className="mt-[18px] flex flex-wrap items-center justify-between gap-3.5 rounded-xl border border-[#1E2129] bg-[#1A1D24] px-4 py-3">
        <div className="text-[14.5px] text-[#8A909C]">
          <b className="font-semibold text-[#B9BFC9]">Basé sur le calendrier officiel RSEQ.</b>{" "}
          Horaires et lieux à confirmer avant de vous déplacer.
        </div>
        {lastUpdated && (
          <div className="whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5C6575]">
            <span className="mr-[7px] inline-block h-[7px] w-[7px] translate-y-px rounded-full bg-[#22C55E]" />
            Mis à jour le {lastUpdated}
          </div>
        )}
      </div>

      {isFree ? (
        <FreeWall />
      ) : (
        <>
          {/* ── Filtres ── */}
          <div className="mt-[22px] flex flex-wrap gap-2.5">
            <FilterSelect
              value={filters.sport}
              active={!!filters.sport}
              onChange={(v) => setFilters((f) => ({ ...f, sport: v, position: "" }))}
            >
              {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </FilterSelect>

            <FilterSelect
              value={filters.position}
              active={!!filters.position}
              disabled={!filters.sport}
              onChange={(v) => set("position", v)}
            >
              <option value="">
                {filters.sport ? "Toutes les positions" : "Sélectionner un sport d'abord"}
              </option>
              {positions.map((p) => <option key={p.abbr} value={p.abbr}>{p.abbr} — {p.label}</option>)}
            </FilterSelect>

            <MultiFilterSelect
              values={filters.promotions}
              placeholder="Toutes les promotions"
              renderLabel={(v) => (v.length === 1 ? `Promotion ${v[0]}` : `${v.length} promotions`)}
              onAdd={(v) => set("promotions", toggleIn(filters.promotions, v))}
              onClear={() => set("promotions", [])}
            >
              {PROMOTIONS.map((p) => (
                <option key={p} value={p}>{filters.promotions.includes(p) ? `✓ ${p}` : p}</option>
              ))}
            </MultiFilterSelect>

            <FilterSelect value={filters.region} active={!!filters.region} onChange={(v) => set("region", v)}>
              <option value="">Toutes les régions</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </FilterSelect>

            <FilterSelect value={filters.orgType} active={!!filters.orgType} onChange={(v) => set("orgType", v)}>
              <option value="">Toutes les organisations</option>
              <option value="scolaire">Scolaire</option>
              <option value="ligue_civile">Ligue civile</option>
            </FilterSelect>

            <FilterSelect value={filters.minRating} active={!!filters.minRating} onChange={(v) => set("minRating", v)}>
              <option value="">Toutes les cotes</option>
              <option value="1">★ 1+</option>
              <option value="2">★★ 2+</option>
              <option value="3">★★★ 3+</option>
              <option value="4">★★★★ 4+</option>
              <option value="5">★★★★★ 5</option>
            </FilterSelect>

            <FilterSelect value={filters.minGpa} active={!!filters.minGpa} onChange={(v) => set("minGpa", v)}>
              <option value="">Toutes les moyennes</option>
              <option value="60">60 %+</option>
              <option value="70">70 %+</option>
              <option value="80">80 %+</option>
              <option value="85">85 %+</option>
              <option value="90">90 %+</option>
            </FilterSelect>

            <MultiFilterSelect
              values={filters.listIds}
              placeholder="Mes listes"
              renderLabel={(v) =>
                v.length === 1
                  ? `Liste : ${lists.find((l) => l.id === v[0])?.name ?? "—"}`
                  : `${v.length} listes`
              }
              onAdd={(v) => set("listIds", toggleIn(filters.listIds, v))}
              onClear={() => set("listIds", [])}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {filters.listIds.includes(l.id) ? `✓ ${l.name}` : l.name}
                </option>
              ))}
            </MultiFilterSelect>

            <FilterSelect value={filters.stage} active={!!filters.stage} onChange={(v) => set("stage", v)}>
              <option value="">Statut : tous</option>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </FilterSelect>

            <FilterSelect value={sort} onChange={(v) => setSort(v as CalendarSort)}>
              <option value="date">Trier : date</option>
              <option value="density">Trier : densité</option>
            </FilterSelect>
          </div>

          <div className="mt-3 flex flex-wrap gap-2.5">
            <FilterChip on={filters.verifiedOnly} onClick={() => set("verifiedOnly", !filters.verifiedOnly)}>
              <span className={filters.verifiedOnly ? "text-[#E63946]" : ""}>✓</span> Vérifié
            </FilterChip>
            <FilterChip on={filters.withVideoOnly} onClick={() => set("withVideoOnly", !filters.withVideoOnly)}>
              🎬 Avec vidéo
            </FilterChip>
          </div>

          {/* ── Contenu ── */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-[14px] text-[#5C6575]">
              Chargement de votre calendrier…
            </div>
          ) : isError ? (
            /* Un échec de requête ne doit PAS emprunter la planche vide :
               « Aucun match à venir » affirmerait qu'il n'y en a pas,
               alors qu'on n'en sait rien. Même coquille que la réf,
               copie honnête. */
            <div className="mt-[34px] rounded-2xl border border-[#262A33] bg-[#1A1D24] px-[30px] py-[60px] text-center">
              <div className="mb-[18px] inline-flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#20242C] text-[#8A909C]">
                <CalendarIcon size={26} strokeWidth={1.8} />
              </div>
              <h3 className="mb-2 text-[20px] font-bold text-[#EDEFF3]">Calendrier momentanément indisponible</h3>
              <p className="mx-auto max-w-[520px] text-[15px] text-[#8A909C]">
                Les matchs n&apos;ont pas pu être chargés. Réessayez dans un moment.
              </p>
            </div>
          ) : matches.length === 0 ? (
            <EmptyBoard />
          ) : view === "list" ? (
            <div className="mt-[34px] flex flex-col gap-[34px]">
              {weeks.map((w) => (
                <div key={w.key} className="flex flex-col">
                  <div className="mb-4 flex items-baseline gap-3.5 border-b border-[#1E2129] pb-2.5">
                    <h2 className="text-[14px] font-bold uppercase tracking-[0.14em] text-[#B9BFC9]">{w.label}</h2>
                    <span className="text-[12.5px] font-medium text-[#5C6575]">
                      {w.matchCount} match{w.matchCount > 1 ? "s" : ""} · {w.targetCount} cible{w.targetCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {w.matches.map((m) => <MatchCard key={m.game.id} m={m} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-[34px]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[19px] font-bold capitalize">{monthLabel(cursor.year, cursor.month)}</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    disabled={atFirstMonth}
                    aria-label="Mois précédent"
                    className="h-[38px] w-[38px] rounded-full border border-[#262A33] bg-[#1A1D24] text-[16px] text-[#B9BFC9] transition-colors enabled:hover:border-[#333B4A] enabled:hover:text-[#EDEFF3] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    aria-label="Mois suivant"
                    className="h-[38px] w-[38px] rounded-full border border-[#262A33] bg-[#1A1D24] text-[16px] text-[#B9BFC9] transition-colors hover:border-[#333B4A] hover:text-[#EDEFF3]"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {DOW.map((d) => (
                  <div key={d} className="py-1.5 text-center text-[12px] font-bold uppercase tracking-[0.08em] text-[#5C6575]">
                    {d}
                  </div>
                ))}
                {grid.map((c) => {
                  const selected = selectedDay === c.iso;
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      onClick={() => setSelectedDay(selected ? null : c.iso)}
                      className={`relative aspect-[1.15] rounded-xl border px-[11px] py-[9px] text-left text-[14px] font-semibold transition-colors ${
                        c.outside ? "opacity-[0.32]" : ""
                      } ${
                        selected
                          ? "border-[#333B4A] bg-[#20242C] text-[#EDEFF3]"
                          : c.isToday
                            ? "border-[#E63946] bg-[#1A1D24] text-[#EDEFF3]"
                            : "border-[#1E2129] bg-[#1A1D24] text-[#8A909C]"
                      }`}
                    >
                      {c.day}
                      {c.targetCount > 0 && (
                        <span className="absolute bottom-2 left-[9px] inline-flex items-center rounded-full bg-[#E63946] px-[9px] py-0.5 text-[11.5px] font-bold text-white">
                          {selected ? `${c.targetCount} cible${c.targetCount > 1 ? "s" : ""}` : c.targetCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedDay ? (
                dayMatches.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-3">
                    {dayMatches.map((m) => <MatchCard key={m.game.id} m={m} />)}
                  </div>
                ) : (
                  <div className="mt-3.5 text-[13.5px] text-[#5C6575]">Aucun match ce jour-là pour vos cibles.</div>
                )
              ) : (
                <div className="mt-3.5 text-[13.5px] text-[#5C6575]">
                  Sélectionnez un jour pour voir ses matchs.
                </div>
              )}
            </div>
          )}

          {/* Filtres actifs mais plus aucune cible : on le dit, plutôt que
              de laisser croire à un calendrier vide. */}
          {!isLoading && matches.length === 0 && hasActiveFilters(filters) && (
            <div className="mt-4 text-center text-[13.5px] text-[#5C6575]">
              Aucun match ne correspond à ces filtres.{" "}
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="font-semibold text-[#E63946]"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
