"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurCalendrierMobile — pendant mobile du Calendrier de
   recrutement (app/recruteur/calendrier).

   Même couche data que le desktop (useRecruitingCalendar +
   lib/calendar/recruitingCalendar) : compteurs, semaines, « fort
   potentiel » et grille mensuelle ne sont calculés qu'à un seul
   endroit. Seule l'UI est native mobile — pickers en sheet,
   haptics, safe areas.

   Référence design : docs/reference/calendrier-recruteur-ref.html
   pour le contenu et la hiérarchie ; docs/mobile-design-system.md
   pour les primitives.
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
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

const SPORT_OPTIONS: PickerOption[] = [
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

const ORG_OPTIONS: PickerOption[] = [
  { value: "", label: "Toutes les organisations" },
  { value: "scolaire", label: "Scolaire" },
  { value: "ligue_civile", label: "Ligue civile" },
];

const RATING_OPTIONS: PickerOption[] = [
  { value: "", label: "Toutes les cotes" },
  { value: "1", label: "★ 1+" },
  { value: "2", label: "★★ 2+" },
  { value: "3", label: "★★★ 3+" },
  { value: "4", label: "★★★★ 4+" },
  { value: "5", label: "★★★★★ 5" },
];

const GPA_OPTIONS: PickerOption[] = [
  { value: "", label: "Toutes les moyennes" },
  { value: "60", label: "60 %+" },
  { value: "70", label: "70 %+" },
  { value: "80", label: "80 %+" },
  { value: "85", label: "85 %+" },
  { value: "90", label: "90 %+" },
];

const STAGE_OPTIONS: PickerOption[] = [
  { value: "", label: "Statut : tous" },
  { value: "IDENTIFIE", label: "Identifié" },
  { value: "CONTACTE", label: "Contacté" },
  { value: "EN_DISCUSSION", label: "En discussion" },
  { value: "VISITE_PLANIFIEE", label: "En visite" },
  { value: "ENGAGE", label: "Engagé" },
  { value: "LETTRE_SIGNEE", label: "Lettre signée" },
];

const SORT_OPTIONS: PickerOption[] = [
  { value: "date", label: "Date" },
  { value: "density", label: "Densité de cibles" },
];

const PROMOTION_OPTIONS = ["2026", "2027", "2028"];

const STAGE_LABEL: Record<string, string> = {
  IDENTIFIE: "Identifié",
  CONTACTE: "Contacté",
  EN_DISCUSSION: "En discussion",
  VISITE_PLANIFIEE: "En visite",
  ENGAGE: "Engagé",
  LETTRE_SIGNEE: "Lettre signée",
};

const DOW = ["L", "M", "M", "J", "V", "S", "D"];

/* ── Primitives ────────────────────────────────────────────── */

function Avatar({ text, more = false, className = "" }: { text: string; more?: boolean; className?: string }) {
  return (
    <div
      className={`w-[30px] h-[30px] rounded-full border-2 border-[#1A1D24] flex items-center justify-center font-bold shrink-0 ${
        more ? "bg-[#B32330] text-white text-[10.5px]" : "bg-[#20242C] text-[#B9BFC9] text-[11px]"
      } ${className}`}
    >
      {text}
    </div>
  );
}

function StagePill({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const isVisit = stage === "VISITE_PLANIFIEE";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-semibold whitespace-nowrap ${
        isVisit
          ? "bg-[rgba(34,197,94,0.10)] border border-[rgba(34,197,94,0.30)] text-[#22C55E]"
          : "bg-[#20242C] text-[#B9BFC9]"
      }`}
    >
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

function TargetRow({ t }: { t: CalendarTarget }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-[#1E2129] py-2 first:border-t-0">
      <Avatar text={t.initials} className="!border-[#171A20]" />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[14px] font-semibold leading-tight text-[#EDEFF3]">
          {t.firstName} {t.lastName}
          {t.verified && <span className="text-[#3B82F6]"> ✓</span>}
        </b>
        <span className="text-[12px] text-[#8A909C]">
          {[t.position, t.graduationYear ? `Promotion ${t.graduationYear}` : ""].filter(Boolean).join(" · ")}
        </span>
      </div>
      <StagePill stage={t.pipelineStage} />
    </div>
  );
}

function DetailColumn({ name, targets }: { name: string; targets: CalendarTarget[] }) {
  return (
    <div className="border-t border-[#1E2129] px-4 py-3.5">
      <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#B9BFC9]">
        {name}
        <span className="ml-2 text-[11.5px] font-medium normal-case tracking-normal text-[#5C6575]">
          {targets.length} cible{targets.length !== 1 ? "s" : ""}
        </span>
      </div>
      {targets.length === 0 ? (
        <div className="text-[13px] italic text-[#5C6575]">Aucune de vos cibles dans cette équipe.</div>
      ) : (
        targets.map((t) => <TargetRow key={`${t.athleteId}-${t.teamId}`} t={t} />)
      )}
    </div>
  );
}

function MatchCard({ m }: { m: MatchView }) {
  const [open, setOpen] = useState(false);
  const stack = [...m.homeTargets, ...m.visitorTargets];
  const shown = stack.slice(0, 3);
  const extra = stack.length - shown.length;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#262A33] bg-[#1A1D24] ${
        m.hot ? "border-l-[3px] border-l-[#E63946]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => { triggerHaptic("Light"); setOpen((v) => !v); }}
        className="flex w-full items-start gap-3.5 px-4 py-3.5 text-left"
      >
        <div className="w-12 shrink-0 text-center">
          <div className="text-[26px] font-extrabold leading-none tracking-[-0.02em] text-[#EDEFF3]">
            {dayNumber(m.game.gameDate)}
          </div>
          <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#E63946]">
            {shortMonthLabel(m.game.gameDate)}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {m.hot && (
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#E63946]">
              ★ Fort potentiel
            </span>
          )}
          <div className="text-[15px] font-bold leading-snug text-[#EDEFF3]">
            {m.game.homeName}
            <span className="px-1 text-[13px] font-medium text-[#5C6575]">vs</span>
            {m.game.visitorName}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[13px] font-medium text-[#8A909C]">
            {m.game.gameTime && <span>{m.game.gameTime}</span>}
            {m.game.venue && <span className="truncate">{m.game.venue}</span>}
          </div>
          {m.game.competition && (
            <div className="mt-0.5 text-[12.5px] text-[#5C6575]">{m.game.competition}</div>
          )}

          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="flex">
              {shown.map((t, i) => (
                <Avatar key={`${t.athleteId}-${t.teamId}`} text={t.initials} className={i === 0 ? "" : "-ml-2"} />
              ))}
              {extra > 0 && <Avatar text={`+${extra}`} more className="-ml-2" />}
            </div>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[rgba(230,57,70,0.28)] bg-[rgba(230,57,70,0.09)] px-3 py-1 text-[13px] font-semibold text-[#EDEFF3]">
              <b className="font-extrabold text-[#E63946]">{m.count}</b> cible{m.count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`mt-1 shrink-0 text-[#5C6575] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="bg-[#171A20]">
          <DetailColumn name={m.game.homeName} targets={m.homeTargets} />
          <DetailColumn name={m.game.visitorName} targets={m.visitorTargets} />
        </div>
      )}
    </div>
  );
}

/** Ligne de filtre dans le sheet. */
function FilterRow({ label, value, onOpen }: { label: string; value: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onOpen(); }}
      className="flex w-full items-center justify-between border-b border-[#1E2129] px-4 py-3.5 text-left"
    >
      <span className="text-[15px] text-[#B9BFC9]">{label}</span>
      <span className="flex items-center gap-1.5 text-[15px] font-semibold text-[#EDEFF3]">
        {value}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5C6575" strokeWidth="2.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onClick(); }}
      className={`rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
        on
          ? "border-[rgba(230,57,70,0.28)] bg-[rgba(230,57,70,0.09)] text-[#EDEFF3]"
          : "border-[#262A33] text-[#8A909C]"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyBoard() {
  return (
    <div className="mt-6 rounded-2xl border border-[#262A33] bg-[#1A1D24] px-6 py-12 text-center">
      <div className="mb-4 inline-flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#20242C] text-[#8A909C]">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <h3 className="mb-2 text-[18px] font-bold text-[#EDEFF3]">Aucun match à venir pour vos cibles</h3>
      <p className="mx-auto max-w-[420px] text-[14px] text-[#8A909C]">
        Leurs équipes ne sont pas encore reliées au calendrier RSEQ, ou la saison n&apos;est pas publiée.
        Les matchs apparaîtront automatiquement dès que les calendriers seront disponibles.{" "}
        <Link href="/recruteur/recherche" className="font-semibold text-[#E63946]">Explorer des athlètes →</Link>
      </p>
    </div>
  );
}

function FreeWall() {
  const pro = RECRUITER_TIERS.find((t) => t.id === "rec_pro");
  const price = pro ? `${pro.monthly.toFixed(2).replace(".", ",")} $/mois` : "";
  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border border-[#262A33] bg-[#1A1D24] px-6 py-12 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none p-5 opacity-45 blur-[7px]">
        {[
          { d: "12", mo: "Oct", h: "Vulkins Jean-Eudes", v: "Phénix André-Grasset", n: 6 },
          { d: "14", mo: "Oct", h: "Titans Limoilou", v: "Élans Garneau", n: 2 },
        ].map((g) => (
          <div key={g.d} className="mb-3 flex items-center gap-3 rounded-2xl border border-[#262A33] bg-[#1A1D24] px-4 py-3.5">
            <div className="w-12 shrink-0 text-center">
              <div className="text-[26px] font-extrabold leading-none text-[#EDEFF3]">{g.d}</div>
              <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#E63946]">{g.mo}</div>
            </div>
            <div className="min-w-0 flex-1 text-left text-[15px] font-bold text-[#EDEFF3]">
              {g.h}<span className="px-1 text-[13px] font-medium text-[#5C6575]">vs</span>{g.v}
            </div>
            <span className="shrink-0 rounded-full border border-[rgba(230,57,70,0.28)] bg-[rgba(230,57,70,0.09)] px-3 py-1 text-[13px] font-semibold text-[#EDEFF3]">
              <b className="font-extrabold text-[#E63946]">{g.n}</b> cibles
            </span>
          </div>
        ))}
      </div>
      <div className="relative z-[2]">
        <div className="mb-4 inline-flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#20242C] text-[#8A909C]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h3 className="mb-2 text-[18px] font-bold text-[#EDEFF3]">Planifiez vos déplacements avec le tier Pro</h3>
        <p className="mx-auto max-w-[420px] text-[14px] text-[#8A909C]">
          Voyez quels matchs regroupent le plus de vos cibles, filtrés par position, promotion et région.
        </p>
        <Link
          href="/tarifs"
          className="mt-5 inline-flex items-center rounded-xl bg-[#E63946] px-6 py-3 text-[15px] font-bold text-white"
        >
          Passer au tier Pro{price ? ` — ${price}` : ""}
        </Link>
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────── */

type PickerKey = "sport" | "position" | "region" | "orgType" | "minRating" | "minGpa" | "stage" | "sort" | null;

export function RecruteurCalendrierMobile() {
  const { tier, loading: tierLoading } = useSubscription();
  const isFree = tier === "free";

  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<CalendarSort>("date");
  const [view, setView] = useState<"list" | "cal">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [picker, setPicker] = useState<PickerKey>(null);

  const today = useMemo(() => todayIso(), []);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data, isLoading, isError } = useRecruitingCalendar(!isFree && !tierLoading);
  const { data: regions = [] } = useRegions();
  const { data: lists = [] } = useRecruiterLists();
  const { data: posData } = usePositionsBySport(filters.sport || null);

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

  const positionOptions: PickerOption[] = useMemo(() => {
    const opts: PickerOption[] = [{ value: "", label: "Toutes les positions" }];
    (posData?.positions ?? []).forEach((p) => opts.push({ value: p.abbr, label: `${p.abbr} — ${p.label}` }));
    return opts;
  }, [posData]);

  const regionOptions: PickerOption[] = useMemo(() => {
    const opts: PickerOption[] = [{ value: "", label: "Toutes les régions" }];
    regions.forEach((r) => opts.push({ value: r, label: r }));
    return opts;
  }, [regions]);

  const labelOf = (opts: PickerOption[], v: string, fallback: string) =>
    opts.find((o) => o.value === v)?.label ?? fallback;

  const now = new Date();
  const atFirstMonth =
    cursor.year < now.getFullYear() ||
    (cursor.year === now.getFullYear() && cursor.month <= now.getMonth());

  const shiftMonth = (delta: number) => {
    triggerHaptic("Light");
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelectedDay(null);
  };

  const activeCount =
    (filters.sport ? 1 : 0) + (filters.position ? 1 : 0) + filters.promotions.length +
    (filters.region ? 1 : 0) + (filters.orgType ? 1 : 0) + (filters.minRating ? 1 : 0) +
    (filters.minGpa ? 1 : 0) + (filters.stage ? 1 : 0) + filters.listIds.length +
    (filters.verifiedOnly ? 1 : 0) + (filters.withVideoOnly ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Header */}
      <div className="px-4 pb-3 pt-[calc(env(safe-area-inset-top)+16px)]">
        <h1 className="font-head text-[24px] font-extrabold uppercase leading-tight tracking-tight text-[#EDEFF3]">
          Calendrier de recrutement
        </h1>
        <p className="mt-1 text-[14px] text-[#B9BFC9]">Vos prochains matchs à surveiller, selon vos cibles</p>
      </div>

      {/* Disclaimer */}
      <div className="mx-4 rounded-xl border border-[#1E2129] bg-[#1A1D24] px-3.5 py-3">
        <div className="text-[13.5px] text-[#8A909C]">
          <b className="font-semibold text-[#B9BFC9]">Basé sur le calendrier officiel RSEQ.</b>{" "}
          Horaires et lieux à confirmer avant de vous déplacer.
        </div>
        {lastUpdated && (
          <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6575]">
            <span className="mr-1.5 inline-block h-[6px] w-[6px] translate-y-px rounded-full bg-[#22C55E]" />
            Mis à jour le {lastUpdated}
          </div>
        )}
      </div>

      {isFree ? (
        <div className="px-4"><FreeWall /></div>
      ) : (
        <>
          {/* Barre d'actions : vue + filtres */}
          <div className="sticky top-0 z-30 mt-3 flex items-center gap-2 bg-[#111317]/95 px-4 py-2.5 backdrop-blur-sm">
            <div className="flex overflow-hidden rounded-xl border border-[#262A33] bg-[#1A1D24]">
              {(["list", "cal"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { triggerHaptic("Light"); setView(v); }}
                  className={`px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                    view === v ? "bg-[#E63946] text-white" : "text-[#8A909C]"
                  }`}
                >
                  {v === "list" ? "Liste" : "Calendrier"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); setShowFilters(true); }}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-[#262A33] bg-[#1A1D24] px-3.5 py-2 text-[13px] font-semibold text-[#B9BFC9]"
            >
              Filtres
              {activeCount > 0 && (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E63946] px-1 text-[10px] font-black text-white">
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          <div className="px-4 pb-8">
            {isLoading ? (
              <div className="py-16 text-center text-[14px] text-[#5C6575]">Chargement de votre calendrier…</div>
            ) : isError ? (
              /* Pas la planche vide : on ne sait pas s'il n'y a aucun
                 match, on sait que la requête a échoué. */
              <div className="mt-6 rounded-2xl border border-[#262A33] bg-[#1A1D24] px-6 py-12 text-center">
                <h3 className="mb-2 text-[18px] font-bold text-[#EDEFF3]">Calendrier momentanément indisponible</h3>
                <p className="mx-auto max-w-[420px] text-[14px] text-[#8A909C]">
                  Les matchs n&apos;ont pas pu être chargés. Réessayez dans un moment.
                </p>
              </div>
            ) : matches.length === 0 ? (
              <>
                <EmptyBoard />
                {hasActiveFilters(filters) && (
                  <div className="mt-3 text-center text-[13px] text-[#5C6575]">
                    Aucun match ne correspond à ces filtres.{" "}
                    <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="font-semibold text-[#E63946]">
                      Réinitialiser
                    </button>
                  </div>
                )}
              </>
            ) : view === "list" ? (
              <div className="flex flex-col gap-7 pt-1">
                {weeks.map((w) => (
                  <div key={w.key}>
                    <div className="mb-3 flex flex-wrap items-baseline gap-2 border-b border-[#1E2129] pb-2">
                      <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#B9BFC9]">{w.label}</h2>
                      <span className="text-[12px] font-medium text-[#5C6575]">
                        {w.matchCount} match{w.matchCount !== 1 ? "s" : ""} · {w.targetCount} cible{w.targetCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {w.matches.map((m) => <MatchCard key={m.game.id} m={m} />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pt-1">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[17px] font-bold capitalize text-[#EDEFF3]">
                    {monthLabel(cursor.year, cursor.month)}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      type="button" onClick={() => shiftMonth(-1)} disabled={atFirstMonth} aria-label="Mois précédent"
                      className="h-9 w-9 rounded-full border border-[#262A33] bg-[#1A1D24] text-[#B9BFC9] disabled:opacity-35"
                    >‹</button>
                    <button
                      type="button" onClick={() => shiftMonth(1)} aria-label="Mois suivant"
                      className="h-9 w-9 rounded-full border border-[#262A33] bg-[#1A1D24] text-[#B9BFC9]"
                    >›</button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DOW.map((d, i) => (
                    <div key={`${d}-${i}`} className="py-1 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#5C6575]">
                      {d}
                    </div>
                  ))}
                  {grid.map((c) => {
                    const selected = selectedDay === c.iso;
                    return (
                      <button
                        key={c.iso}
                        type="button"
                        onClick={() => { triggerHaptic("Light"); setSelectedDay(selected ? null : c.iso); }}
                        className={`relative aspect-square rounded-lg border px-1 pt-1 text-left text-[12.5px] font-semibold ${
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
                          <span className="absolute bottom-1 left-1 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#E63946] px-1 text-[10px] font-bold text-white">
                            {c.targetCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedDay ? (
                  dayMatches.length > 0 ? (
                    <div className="mt-4 flex flex-col gap-2.5">
                      {dayMatches.map((m) => <MatchCard key={m.game.id} m={m} />)}
                    </div>
                  ) : (
                    <div className="mt-3 text-[13px] text-[#5C6575]">Aucun match ce jour-là pour vos cibles.</div>
                  )
                ) : (
                  <div className="mt-3 text-[13px] text-[#5C6575]">Sélectionnez un jour pour voir ses matchs.</div>
                )}
              </div>
            )}
          </div>

          {/* Sheet filtres */}
          {showFilters && (
            <div className="fixed inset-0 z-40 flex flex-col justify-end">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowFilters(false)}
              />
              <div className="relative max-h-[85vh] overflow-y-auto rounded-t-[20px] border-t border-[#262A33] bg-[#111317] pb-[calc(env(safe-area-inset-bottom)+20px)]">
                <div className="sticky top-0 flex items-center justify-between border-b border-[#1E2129] bg-[#111317] px-4 py-3.5">
                  <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-[14px] font-semibold text-[#8A909C]">
                    Réinitialiser
                  </button>
                  <span className="text-[15px] font-bold text-[#EDEFF3]">Filtres</span>
                  <button type="button" onClick={() => setShowFilters(false)} className="text-[14px] font-bold text-[#E63946]">
                    OK
                  </button>
                </div>

                <FilterRow label="Sport" value={labelOf(SPORT_OPTIONS, filters.sport, "Tous")} onOpen={() => setPicker("sport")} />
                <FilterRow
                  label="Position"
                  value={filters.sport ? labelOf(positionOptions, filters.position, "Toutes") : "Choisir un sport"}
                  onOpen={() => { if (filters.sport) setPicker("position"); }}
                />
                <FilterRow label="Région" value={labelOf(regionOptions, filters.region, "Toutes")} onOpen={() => setPicker("region")} />
                <FilterRow label="Organisation" value={labelOf(ORG_OPTIONS, filters.orgType, "Toutes")} onOpen={() => setPicker("orgType")} />
                <FilterRow label="Cote" value={labelOf(RATING_OPTIONS, filters.minRating, "Toutes")} onOpen={() => setPicker("minRating")} />
                <FilterRow label="Moyenne" value={labelOf(GPA_OPTIONS, filters.minGpa, "Toutes")} onOpen={() => setPicker("minGpa")} />
                <FilterRow label="Statut pipeline" value={labelOf(STAGE_OPTIONS, filters.stage, "Tous")} onOpen={() => setPicker("stage")} />
                <FilterRow label="Trier par" value={labelOf(SORT_OPTIONS, sort, "Date")} onOpen={() => setPicker("sort")} />

                <div className="border-b border-[#1E2129] px-4 py-3.5">
                  <div className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.1em] text-[#5C6575]">Promotions</div>
                  <div className="flex flex-wrap gap-2">
                    {PROMOTION_OPTIONS.map((p) => (
                      <Chip key={p} on={filters.promotions.includes(p)} onClick={() => set("promotions", toggleIn(filters.promotions, p))}>
                        {p}
                      </Chip>
                    ))}
                  </div>
                </div>

                {lists.length > 0 && (
                  <div className="border-b border-[#1E2129] px-4 py-3.5">
                    <div className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.1em] text-[#5C6575]">Mes listes</div>
                    <div className="flex flex-wrap gap-2">
                      {lists.map((l) => (
                        <Chip key={l.id} on={filters.listIds.includes(l.id)} onClick={() => set("listIds", toggleIn(filters.listIds, l.id))}>
                          {l.name}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 px-4 py-3.5">
                  <Chip on={filters.verifiedOnly} onClick={() => set("verifiedOnly", !filters.verifiedOnly)}>✓ Vérifié</Chip>
                  <Chip on={filters.withVideoOnly} onClick={() => set("withVideoOnly", !filters.withVideoOnly)}>🎬 Avec vidéo</Chip>
                </div>
              </div>
            </div>
          )}

          <MobilePicker
            open={picker === "sport"} onClose={() => setPicker(null)} title="Sport"
            options={SPORT_OPTIONS} value={filters.sport}
            onChange={(v) => setFilters((f) => ({ ...f, sport: String(v ?? ""), position: "" }))}
          />
          <MobilePicker
            open={picker === "position"} onClose={() => setPicker(null)} title="Position"
            options={positionOptions} value={filters.position}
            onChange={(v) => set("position", String(v ?? ""))}
          />
          <MobilePicker
            open={picker === "region"} onClose={() => setPicker(null)} title="Région"
            options={regionOptions} value={filters.region}
            onChange={(v) => set("region", String(v ?? ""))}
          />
          <MobilePicker
            open={picker === "orgType"} onClose={() => setPicker(null)} title="Organisation"
            options={ORG_OPTIONS} value={filters.orgType}
            onChange={(v) => set("orgType", String(v ?? ""))}
          />
          <MobilePicker
            open={picker === "minRating"} onClose={() => setPicker(null)} title="Cote"
            options={RATING_OPTIONS} value={filters.minRating}
            onChange={(v) => set("minRating", String(v ?? ""))}
          />
          <MobilePicker
            open={picker === "minGpa"} onClose={() => setPicker(null)} title="Moyenne"
            options={GPA_OPTIONS} value={filters.minGpa}
            onChange={(v) => set("minGpa", String(v ?? ""))}
          />
          <MobilePicker
            open={picker === "stage"} onClose={() => setPicker(null)} title="Statut pipeline"
            options={STAGE_OPTIONS} value={filters.stage}
            onChange={(v) => set("stage", String(v ?? ""))}
          />
          <MobilePicker
            open={picker === "sort"} onClose={() => setPicker(null)} title="Trier par"
            options={SORT_OPTIONS} value={sort}
            onChange={(v) => setSort((String(v ?? "date") as CalendarSort))}
          />
        </>
      )}
    </div>
  );
}
