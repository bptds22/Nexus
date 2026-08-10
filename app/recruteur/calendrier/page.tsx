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
import StarRating from "@/components/ui/StarRating";
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

/** Select de filtre — classes `nx-filter-select` / `nx-filter-active` de la
 *  plateforme, identiques à recherche/page.tsx. Aucun style local. */
function FilterSelect({
  value, onChange, disabled, active, ariaLabel, children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  active?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`nx-filter-select${active ? " nx-filter-active" : ""}`}
    >
      {children}
    </select>
  );
}

/** Multi-sélection : chaque choix s'ajoute, la pastille teintée porte un ×
 *  pour tout effacer. Métriques alignées sur `nx-filter-select` (13px / 600 /
 *  8-14px / rounded-full) pour que la rangée reste homogène — un <select>
 *  natif ne peut pas héberger le bouton ×, d'où le wrapper. */
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
      className={`relative inline-flex items-center rounded-full border text-[13px] font-semibold text-white transition-colors ${
        active
          ? "border-[#E63946] bg-[rgba(230,57,70,0.08)]"
          : "border-[#3a3f4b] bg-[#1A1D24] hover:border-[#555a66] hover:bg-[#1E2128]"
      }`}
    >
      <select
        value=""
        onChange={(e) => { if (e.target.value) onAdd(e.target.value); }}
        className={`cursor-pointer appearance-none whitespace-nowrap bg-transparent py-2 pl-[14px] text-[13px] font-semibold outline-none ${active ? "pr-1.5" : "pr-9"}`}
      >
        <option value="">{active ? renderLabel(values) : placeholder}</option>
        {children}
      </select>
      {active ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Effacer le filtre"
          className="pl-0.5 pr-[12px] text-[14px] font-normal leading-none text-[#9CA3AF] transition-colors hover:text-white"
        >
          ×
        </button>
      ) : (
        <Chevron className="pointer-events-none absolute right-[12px] opacity-60" />
      )}
    </div>
  );
}

/** Chip — même rendu que les quick presets de recherche/page.tsx. */
function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
        on
          ? "border-[#E63946]/30 bg-[#E63946]/15 text-[#E63946]"
          : "border-[#2D3748] bg-[#13151a] text-[#6b7280] hover:border-[#4a4d56] hover:text-white"
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
        <b className="flex flex-wrap items-center gap-x-2 text-[14.5px] font-semibold leading-[1.3] text-[#EDEFF3]">
          <span>
            {t.firstName} {t.lastName}
            {t.verified && <span className="text-[#3B82F6]"> ✓</span>}
          </span>
          {/* Cote coach — composant étoiles partagé de la plateforme, même
              rendu que les cartes de la Recherche. Athlète non coté : rien,
              pas de « N/A ». */}
          {t.stars > 0 && <StarRating rating={t.stars} size="sm" />}
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

/** Vide contextuel : des matchs existent pour les cibles, mais le seuil ou
 *  les filtres les écartent tous. Distinct de la planche RSEQ, qui affirme
 *  qu'il n'y a aucun match — ce qui serait faux ici. */
function NoMatchForFilters({ minTargets, onReset }: { minTargets: number; onReset: () => void }) {
  return (
    <div className="mt-[34px] rounded-2xl border border-[#262A33] bg-[#1A1D24] px-[30px] py-[60px] text-center">
      <div className="mb-[18px] inline-flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#20242C] text-[#8A909C]">
        <CalendarIcon size={26} strokeWidth={1.8} />
      </div>
      <h3 className="mb-2 text-[20px] font-bold text-[#EDEFF3]">
        {minTargets > 1
          ? `Aucun match avec ${minTargets} cibles ou plus.`
          : "Aucun match ne correspond à vos filtres."}
      </h3>
      <p className="mx-auto max-w-[520px] text-[15px] text-[#8A909C]">
        {minTargets > 1
          ? "Réduisez le seuil ou élargissez vos filtres."
          : "Élargissez vos filtres pour retrouver des matchs."}{" "}
        <button type="button" onClick={onReset} className="font-semibold text-[#E63946]">
          Réinitialiser
        </button>
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    () => buildMatches(games, filterTargets(targets, filters), sort, filters.minTargets),
    [games, targets, filters, sort],
  );
  // Référence sans aucun filtre ni seuil : sert à distinguer « vos cibles
  // n'ont aucun match RSEQ » (planche vide) de « des matchs existent mais
  // rien ne passe le seuil / les filtres » (message contextuel).
  const baseMatchCount = useMemo(
    () => buildMatches(games, targets, sort).length,
    [games, targets, sort],
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
          {/* ── Filtres — deux étages, pattern de recherche/page.tsx ── */}
          <div className="mt-[22px] space-y-3">
            {/* Rangée principale : toujours visible */}
            <div className="flex flex-wrap items-center gap-2.5">
              <FilterSelect
                value={filters.sport}
                active={!!filters.sport}
                ariaLabel="Sport"
                onChange={(v) => setFilters((f) => ({ ...f, sport: v, position: "" }))}
              >
                {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </FilterSelect>

              <FilterSelect
                value={filters.position}
                active={!!filters.position}
                disabled={!filters.sport}
                ariaLabel="Position"
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

              {/* Seuil de densité — pastille teintée + × dès qu'il dépasse 1+ */}
              <MultiFilterSelect
                values={filters.minTargets > 1 ? [String(filters.minTargets)] : []}
                placeholder="Cibles : 1+"
                renderLabel={(v) => `Cibles : ${v[0]}+`}
                onAdd={(v) => set("minTargets", Number(v))}
                onClear={() => set("minTargets", 1)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}+ cible{n > 1 ? "s" : ""}</option>
                ))}
              </MultiFilterSelect>

              <FilterSelect value={sort} ariaLabel="Trier" onChange={(v) => setSort(v as CalendarSort)}>
                <option value="date">Trier : date</option>
                <option value="density">Trier : densité</option>
              </FilterSelect>

              <div className="mx-1 hidden h-6 w-px bg-[#2D3748] sm:block" />

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                  showAdvanced
                    ? "border border-[#E63946]/30 bg-[#E63946]/10 text-[#E63946]"
                    : "border border-[#2D3748] text-[#9CA3AF] hover:text-white"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                Filtres avancés
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {hasActiveFilters(filters) && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="nx-filter-reset ml-1 flex items-center gap-1.5 text-[13px] font-bold text-[#E63946] transition-colors hover:text-[#D42B22]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                  </svg>
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Panneau avancé — replié par défaut */}
            {showAdvanced && (
              <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-[#2a2d36] bg-[#13151a] p-3">
                <FilterSelect value={filters.region} active={!!filters.region} ariaLabel="Région" onChange={(v) => set("region", v)}>
                  <option value="">Toutes les régions</option>
                  {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </FilterSelect>

                <FilterSelect value={filters.orgType} active={!!filters.orgType} ariaLabel="Organisation" onChange={(v) => set("orgType", v)}>
                  <option value="">Toutes les organisations</option>
                  <option value="scolaire">Scolaire</option>
                  <option value="ligue_civile">Ligue civile</option>
                </FilterSelect>

                <FilterSelect value={filters.minRating} active={!!filters.minRating} ariaLabel="Cote" onChange={(v) => set("minRating", v)}>
                  <option value="">Toutes les cotes</option>
                  <option value="1">★ 1+</option>
                  <option value="2">★★ 2+</option>
                  <option value="3">★★★ 3+</option>
                  <option value="4">★★★★ 4+</option>
                  <option value="5">★★★★★ 5</option>
                </FilterSelect>

                <FilterSelect value={filters.minGpa} active={!!filters.minGpa} ariaLabel="Moyenne" onChange={(v) => set("minGpa", v)}>
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

                <FilterSelect value={filters.stage} active={!!filters.stage} ariaLabel="Statut pipeline" onChange={(v) => set("stage", v)}>
                  <option value="">Statut : tous</option>
                  {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </FilterSelect>

                <div className="mx-1 h-6 w-px bg-[#2D3748]" />

                <FilterChip on={filters.verifiedOnly} onClick={() => set("verifiedOnly", !filters.verifiedOnly)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={filters.verifiedOnly ? "#E63946" : "none"} stroke={filters.verifiedOnly ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  Vérifié
                </FilterChip>
                <FilterChip on={filters.withVideoOnly} onClick={() => set("withVideoOnly", !filters.withVideoOnly)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={filters.withVideoOnly ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                  Avec vidéo
                </FilterChip>
              </div>
            )}
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
            /* Deux vides distincts : aucun match RSEQ du tout (planche de la
               réf) vs des matchs existent mais rien ne franchit le seuil ou
               les filtres (message contextuel, actionnable). */
            baseMatchCount > 0 ? (
              <NoMatchForFilters
                minTargets={filters.minTargets}
                onReset={() => setFilters(EMPTY_FILTERS)}
              />
            ) : (
              <EmptyBoard />
            )
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
                      {/* Marqueur, pas compteur : point rouge si le jour porte
                          au moins un match à cibles, ★ rouge s'il contient un
                          « fort potentiel ». Le détail vit dans les cartes
                          rendues sous la grille. */}
                      {c.hasMatch && (
                        <span
                          className="absolute bottom-2 left-[11px] leading-none text-[#E63946]"
                          aria-label={c.hasHot ? "Match à fort potentiel" : "Match à surveiller"}
                        >
                          {c.hasHot ? (
                            <span className="text-[13px]">★</span>
                          ) : (
                            <span className="block h-[7px] w-[7px] rounded-full bg-[#E63946]" />
                          )}
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

        </>
      )}
    </div>
  );
}
