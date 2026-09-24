"use client";

import { useState, useMemo, useCallback, memo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@/lib/hooks/useSubscription";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePipelineCards } from "@/lib/queries/recruiter/usePipelineCards";
import {
  sortPipelineCards,
  PIPELINE_SORT_OPTIONS,
  DEFAULT_PIPELINE_SORT,
  type PipelineSortMode,
} from "@/lib/pipeline/sortPipelineCards";
import {
  filterPipelineCards,
  facetOptions,
  isFacetOffered,
  toggleFacetValue,
  activeFilterCount,
  FACETS,
  EMPTY_FILTERS,
  QUICK_FILTERS,
  FILTRE_PIPELINE_URL,
  quickDepuisFiltreUrl,
  type FacetDef,
  type FacetOption,
  type PipelineFilters,
  type QuickKey,
} from "@/lib/pipeline/filterPipelineCards";
import { usePipelineNotes } from "@/lib/queries/recruiter/usePipelineNotes";
import { usePreferenceLocale } from "@/lib/recherche/useFiltresRecherche";
import { construireCsv, decimalFr, type ValeurCsv } from "@/lib/export/csv";
import { useRemoveFromPipeline } from "@/lib/queries/recruiter/useRemoveFromPipeline";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  closestCenter,
} from "@dnd-kit/core";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { getCurrentSeason } from "@/lib/utils/season";
// Pipeline movement is now unrestricted — no validation imports needed
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import StarRating from "@/components/ui/StarRating";
import { aUneCote } from "@/lib/evaluations/presence";
import { GradeChip, GradePicker } from "@/components/shared/GradeChip";
import { useUpsertAthleteGrade } from "@/lib/queries/recruiter/useUpsertAthleteGrade";
import { GRADES, type Grade } from "@/lib/config/grades";
import { champVisitePourEtape, etapePorteVisite } from "@/lib/pipeline/regleVisite";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import { generateCalendarLinks, downloadIcs } from "@/lib/calendar/generateCalendarLinks";
import {
  KANBAN_COLUMNS,
  getCardsByStatus,
} from "./_data/mockKanbanData";
import type { PipelineKanbanCard } from "./_data/mockKanbanData";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import RelanceFiche from "@/components/shared/RelanceFiche";
import { PencilIcon } from "@/components/shared/wizard/modeIcons";
import { RecruteurPipelineMobile } from "@/components/shared/RecruteurPipelineMobile";
// MOCK_KANBAN no longer imported — all data from Supabase recruiter_pipeline

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** Valeurs admises de la préférence kanban/tableau — constante de module :
 *  usePreferenceLocale la met dans ses dépendances, un tableau recréé à
 *  chaque rendu la relirait sans fin. */
const VUES_PIPELINE = ["kanban", "tableau"] as const;

/* ═══════════════════════════════════════════════════════════════
   Pipeline de Recrutement — Kanban Board with Drag-and-Drop
   Tasks: Supabase fetch, staleness, card rings, next-action footer,
   inline edit, filter bar, flag toggle
═══════════════════════════════════════════════════════════════ */

const GRAY = "#6B7280";
const RED = "#E63946";
const BLUE = "#3B82F6";
const GREEN = "#22C55E";

/* ── Staleness logic — all date functions accept a stable `now` timestamp
   to avoid hydration mismatches (server vs client Date.now() differ) ──── */

const STALE_THRESHOLDS: Record<string, number> = {
  identifie: 14,
  contacte: 7,
  en_discussion: 10,
  visite_planifiee: 5,
  engage: 14,
  lettre_signee: Infinity,
  retire: Infinity,
};

function isStale(stage: string, movedAt: string | null, now: number): boolean {
  if (!movedAt || !now) return false;
  const threshold = STALE_THRESHOLDS[stage];
  if (!threshold || threshold === Infinity) return false;
  const days = Math.floor((now - new Date(movedAt).getTime()) / 86400000);
  return days > threshold;
}

function daysSince(dateStr: string | null, now: number): number {
  if (!dateStr || !now) return 0;
  return Math.floor((now - new Date(dateStr).getTime()) / 86400000);
}

/** `next_action_at` (colonne `date`, « AAAA-MM-JJ ») → minuit LOCAL.
 *
 *  JAMAIS `new Date("2026-09-16")` : une chaîne date-seule est lue en UTC,
 *  soit le 15 à 20 h au Québec. Toutes les lectures de relance de cet écran
 *  passaient par là — la date s'affichait un jour trop tôt et une relance
 *  du jour sortait « en retard ». Même principe que RelancesDuJour, qui
 *  compare la chaîne AAAA-MM-JJ sans passer par `new Date(str)`. */
function jourLocal(dateStr: string): Date {
  const [a, m, j] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, j);
}


/* `isLate` (relance dépassée → or) est RETIRÉE le 2026-09-23 : décision BP,
   les dates de relance et de visite sont en BLANC, le jaune est réservé aux
   étoiles de la cote du coach. Le retard n'a plus de couleur sur le web ; le
   filtre « À relancer » (estRelanceAFaire) le couvre toujours. Le mobile
   garde son or (formatRelancePill) jusqu'au lot mobile. */

/** Format COURT de la relance sur la carte : « 16 sept. ». La carte fait
 *  300px et partage la ligne avec la note ; le jour de la semaine ne tenait
 *  pas. */
function formatRelanceCourt(dateStr: string): string {
  const d = jourLocal(dateStr);
  const mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${d.getDate()} ${mois[d.getMonth()]}`;
}

/* ── Visite planifiée : formatage de visit_at ──────────────────────
   visit_at est un timestamptz (instant absolu). On l'affiche dans le
   fuseau local du navigateur — America/Toronto pour l'utilisateur cible.

   L'heure est OPTIONNELLE à la saisie : quand elle est omise, on stocke
   minuit local. Minuit pile est donc lu comme « pas d'heure » et on
   n'affiche que la date — sinon on afficherait « à 00h00 », qui se lirait
   comme un vrai rendez-vous à minuit. Conséquence assumée : une visite
   réellement fixée à 00h00 s'affiche sans heure. */
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function visitHasTime(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/** Pill kanban : « 12 mars · 14h00 ». Année ajoutée seulement si ≠ année courante.
 *
 *  `now` est un timestamp ms issu de useClientNow(), donc 0 au premier rendu
 *  (SSR-safe : pas de Date.now() pendant le render). À 0 on n'a pas d'année de
 *  référence : on omet le suffixe et on ne déclare rien « en retard » — sinon la
 *  pill afficherait « 1970 » puis clignerait, et virerait au rouge à tort. */
function formatVisitPill(iso: string, now: number): { label: string; isPast: boolean } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const currentYear = now ? new Date(now).getFullYear() : d.getFullYear();
  const yearSuffix = d.getFullYear() !== currentYear ? ` ${d.getFullYear()}` : "";
  let label = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${yearSuffix}`;
  if (visitHasTime(d)) {
    label += ` · ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return { label, isPast: now > 0 && d.getTime() < now };
}

/** Slide-over : « 12 mars 2026 à 14h00 ». */
function formatVisitLong(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const base = `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
  return visitHasTime(d)
    ? `${base} à ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`
    : base;
}

/** ISO → valeurs des <input type="date"> / <input type="time"> (heure LOCALE). */
function isoToInputs(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: visitHasTime(d) ? `${p(d.getHours())}:${p(d.getMinutes())}` : "",
  };
}

/** Inverse : inputs → instant ISO. Pas de suffixe « Z » → interprété en heure
 *  LOCALE, donc 14h à Montréal stocke bien l'instant UTC correspondant. */
function inputsToIso(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ── Competitor logic ─────────────────────────────────────────── */

const STAGE_ORDER: Record<string, number> = {
  identifie: 1, contacte: 2, en_discussion: 3,
  visite_planifiee: 4, engage: 5, lettre_signee: 6,
};

function isCompetitorAhead(
  athleteId: string,
  myStage: string,
  competitorMap: Record<string, number>,
): boolean {
  const myOrder = STAGE_ORDER[myStage] ?? 0;
  const competitorOrder = competitorMap[athleteId] ?? 0;
  return competitorOrder > myOrder;
}

/* ── Liseré coloré des cartes — RETIRÉ (décision BP 2026-09-23) ─────
   `getCardRing` peignait le bord gauche : rouge 4 px (aucun mouvement
   récent, ou « autre cégep plus avancé » — mort depuis le 17 septembre),
   jaune 4 px (relance aujourd'hui ou demain), et rouge 3 px décoratif sur
   les colonnes d'engagement. Trois sens, une seule couleur, rien à l'écran
   pour les départager. Les cartes n'ont plus de liséré ; « Aucun mouvement
   depuis N j » reste écrit au pied de la carte. */

/* ── Hook: stable client-side timestamp (0 on server, real after mount) */

function useClientNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
  }, []);
  return now;
}

/* ── Filter types ────────────────────────────────────────────── */

/* ── Toast ────────────────────────────────────────────────────── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-[fadeInUp_0.3s_ease-out]">
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        <span className="text-[13px] font-bold text-white">{message}</span>
        <button type="button" onClick={onDone} className="text-[#6b7280] hover:text-white ml-2" aria-label="Fermer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ── Confirmation Modal ───────────────────────────────────────── */

function ConfirmModal({
  title, message, confirmLabel, confirmColor, textarea, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel?: string; confirmColor?: string;
  textarea?: { placeholder: string; value: string; onChange: (v: string) => void };
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-[modalIn_0.2s_ease-out]">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">{title}</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">{message}</p>
        {textarea && (
          <textarea value={textarea.value} onChange={(e) => textarea.onChange(e.target.value)} placeholder={textarea.placeholder} rows={2} className="w-full mt-3 bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none" />
        )}
        <div className="flex items-center justify-end gap-3 mt-5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
          <button type="button" onClick={onConfirm} className="px-5 py-2 text-white text-[13px] font-bold rounded-lg transition-colors" style={{ backgroundColor: confirmColor || RED }}>{confirmLabel || "Confirmer"}</button>
        </div>
      </div>
    </div>
  );
}

function completenessColor(pct: number): string {
  if (pct < 40) return "#EF4444";
  if (pct < 70) return GRAY;
  return BLUE;
}

/* ── Funnel Summary Bar ──────────────────────────────────────── */

/* Le bandeau compte les cartes FILTRÉES, pas le pipeline entier (Lot 2b).
   Un récapitulatif qui annonce « 15 athlètes suivis » au-dessus d'un kanban
   qui en montre 6 ne récapitule rien : il contredit l'écran.

   Le total absolu reste affiché en référence — « 6 sur 15 » — pour que le
   filtre se lise comme un cadrage temporaire et non comme une perte de
   données. Sans filtre actif, l'affichage ne change pas d'un pixel. */
function FunnelSummary({ cards, totalCards }: { cards: PipelineKanbanCard[]; totalCards: number }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const col of KANBAN_COLUMNS) c[col.id] = 0;
    for (const card of cards) c[card.status] = (c[card.status] || 0) + 1;
    return c;
  }, [cards]);

  const total = cards.length;
  const isFiltered = total !== totalCards;
  const stages = KANBAN_COLUMNS.filter((c) => c.id !== "retire");
  const conversions: { pct: number }[] = [];
  for (let i = 1; i < stages.length; i++) {
    const prev = counts[stages[i - 1].id] || 0;
    const cur = counts[stages[i].id] || 0;
    conversions.push({ pct: prev > 0 ? Math.round((cur / prev) * 100) : 0 });
  }

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] px-6 py-5">
      <div className="flex items-baseline gap-2 mb-4">
        <span className="font-head text-[28px] font-black text-white leading-none">{total}</span>
        {isFiltered && (
          <span className="text-[15px] font-bold text-[#6b7280] leading-none">sur {totalCards}</span>
        )}
        <span className="text-[14px] font-bold text-[#9CA3AF] uppercase tracking-wider">athlètes suivis</span>
      </div>
      <div className="flex items-center gap-0 overflow-x-auto">
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-center shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: stage.phase === "commitment" ? "rgba(230,57,70,0.08)" : "rgba(107,114,128,0.06)" }}>
              <span className="font-head text-[22px] font-black leading-none" style={{ color: stage.color }}>{counts[stage.id]}</span>
              <span className="text-[13px] font-semibold text-[#9CA3AF] whitespace-nowrap">{stage.label.toLowerCase()}</span>
            </div>
            {i < stages.length - 1 && (
              <div className="flex flex-col items-center mx-1.5 shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                <span className="text-[10px] font-bold text-[#4a4d56] mt-0.5">{conversions[i]?.pct}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Icons ────────────────────────────────────────────────────── */

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" />
    </svg>
  );
}

function ArrowIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>;
}
function TrashIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>;
}

/* ── Draggable Kanban Card (TASKS 3, 4, 7) ───────────────────── */

const DraggableKanbanCard = memo(function DraggableKanbanCard({
  card,
  isDraggable,
  onClick,
  now,
  competitorMap,
}: {
  card: PipelineKanbanCard;
  isDraggable: boolean;
  onClick: () => void;
  now: number;
  competitorMap: Record<string, number>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card, status: card.status },
    disabled: !isDraggable,
  });

  const stale = isStale(card.status, card.moved_at, now);
  const staleDays = daysSince(card.moved_at, now);
  const compAhead = isCompetitorAhead(card.id, card.status, competitorMap);
  const hasAction = card.next_action_at || card.next_action_note;

  // Left border

  return (
    <div
      ref={setNodeRef}
      className={`relative group transition-opacity duration-150 ${isDragging ? "opacity-30 scale-[0.97]" : ""}`}
    >
      {/* Drag handle */}
      {isDraggable && (
        <div {...attributes} {...listeners} className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center text-[#4a4d56] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10">
          <GripIcon />
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left bg-[#1A1D24] rounded-lg border border-[#2D3748] transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 overflow-hidden ${isDraggable ? "" : ""}`}
      >
        {/* Photo banner */}
        <div className="relative h-20 bg-[#2F3440] overflow-hidden">
          {(() => {
            const [first, ...rest] = (card.full_name || "").split(/\s+/);
            return (
              <AthletePhotoFill
                photoUrl={card.photo_url}
                firstName={first}
                lastName={rest.join(" ")}
                initialsFontSize={48}
                className="object-[center_15%]"
                identityVisible={card.identityVisible}
              />
            );
          })()}
          <div className="absolute inset-0 z-[2]" style={{ background: "linear-gradient(to top, #1A1D24 0%, transparent 60%)" }} />
          {/* Verified badge */}
          <div className="absolute top-2 left-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill={card.is_verified ? BLUE : "#4a4d56"} stroke="none">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" stroke={card.is_verified ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          {/* Position pill */}
          {card.position && (
            <span className="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm text-[11px] font-bold uppercase tracking-wider text-white">{card.position}</span>
          )}
        </div>

        {/* Card body */}
        <div className={`px-3.5 pb-3.5 pt-1.5 ${isDraggable ? "pl-8" : ""}`}>
          {/* Name + Jersey + Priority */}
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-semibold text-white truncate">{card.full_name}</span>
            {card.jersey && <span className="text-[12px] font-black text-[#E63946] shrink-0">#{card.jersey}</span>}
          </div>

          {/* School + Year (or "Ligue Civile" badge) */}
          <p className="text-[12px] text-[#6b7280] mt-1 truncate flex items-center gap-1.5">
            {card.noTeam ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF] shrink-0">
                Ligue Civile
              </span>
            ) : (
              <span className="truncate">{card.school}</span>
            )}
            {card.graduation_year > 0 && <><span className="text-[#4a4d56] shrink-0">·</span><span className="shrink-0">{card.graduation_year}</span></>}
          </p>

          {/* Global recruitment status + pill « visite planifiée » ─────────
              La pill n'apparaît que dans la colonne VISITE_PLANIFIEE et avec
              une date. Ambre par défaut, rouge si la date est passée (signal
              retard). Purement informative : le clic remonte au bouton parent
              (ouverture du slide-over), l'édition se fait là-bas. */}
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {/* OUVERT NE S'AFFICHE PAS (arbitrage BP, 2026-09-04). C'est
                l'état PAR DÉFAUT d'un athlète : une pastille verte sur
                presque chaque carte n'informe de rien et noie les deux
                statuts qui, eux, disent quelque chose. L'absence de
                pastille SIGNIFIE « ouvert ».
                EN PROCESSUS et RECRUTÉ restent : ils disent qu'un AUTRE
                recruteur travaille l'athlète — la seule information
                concurrentielle que porte la carte.
                Le statut complet reste lisible dans le panneau athlète :
                on allège la carte, on ne retire pas l'information. */}
            {card.recruitment_status && card.recruitment_status !== "OUVERT" && (
              <RecruitmentStatusBadge
                status={card.recruitment_status as GlobalRecruitmentStatus}
                committedSchoolName={card.committed_school_name || undefined}
                openToOffers={card.open_to_offers}
                size="sm"
              />
            )}
            {etapePorteVisite(card.status) && card.visit_at && (() => {
              const v = formatVisitPill(card.visit_at, now);
              if (!v) return null;
              /* BLANC (décision BP 2026-09-23) : le jaune est réservé aux
                 étoiles de la cote du coach. */
              const fg = "#FFFFFF";
              return (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                  style={{
                    color: fg,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                  title={v.isPast ? "Visite passée" : "Visite planifiée"}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {v.label}
                </span>
              );
            })()}
          </div>
          {card.recruitment_status === 'RECRUTE' && ['identifie', 'contacte', 'en_discussion', 'visite_planifiee'].includes(card.status) && (
            <div className="mt-1.5 px-2 py-1 rounded bg-[#E63946]/10 border-l-2 border-[#E63946]">
              {/* Rouge, comme « Un autre CÉGEP est plus avancé » : une alerte.
                  Plus de jaune hors des étoiles (décision BP 2026-09-23). */}
              <span className="text-[10px] font-bold text-[#E63946]">⚠ Athlète recruté ailleurs</span>
            </div>
          )}
          {card.recruitment_status === 'RETIRE' && (
            <div className="mt-1.5 px-2 py-1 rounded bg-[#6B7280]/10 border-l-2 border-[#6B7280]">
              <span className="text-[10px] font-bold text-[#6B7280]">⚠ Athlète retiré</span>
            </div>
          )}

          {/* Competitor warning */}
          {compAhead && (
            <p className="text-[11px] text-[#E63946] mt-1.5">⚠️ Un autre CÉGEP est plus avancé</p>
          )}

          {/* Cote du coach + mon grade, sur la même ligne (retour terrain
              2026-09-04). Les deux jugements portés sur l'athlète se lisent
              d'un seul regard : les étoiles à gauche, ma puce poussée à
              droite par ml-auto. */}
          <div className="mt-2 flex items-center gap-2">
            {/* Une cote ABSENTE n'est pas une cote de ZERO
                (lib/evaluations/presence) : StarRating rendrait « 0.0 ». */}
            {aUneCote(card.coach_rating)
              ? <StarRating rating={card.coach_rating} size="md" />
              : <span className="text-[12px] text-[#6b7280]">Pas encore évalué</span>}
            <GradeChip grade={card.grade} className="ml-auto" />
          </div>
        </div>

        {/* Footer: Next action / staleness */}
        {(hasAction || stale) && (
          /* Plus de fenêtre dédiée à la relance (décision BP 2026-09-23) : le
             pied n'a plus son propre clic, il fait partie de la carte — un clic
             n'importe où ouvre le panneau latéral, seul lieu de la relance. */
          <div className="px-3.5 pb-3 pt-2 border-t border-white/10">
            {/* La DATE est un élément à part, `shrink-0`, et seule la NOTE
                tronque. Avant, date et note partageaient un seul `truncate`,
                la date EN FIN : une note un peu longue poussait la date
                derrière l'ellipse, et la carte semblait sans relance. */}
            {hasAction ? (
              <p className="text-[11px] flex items-center gap-1.5 min-w-0">
                {card.next_action_at && (
                  <span className="shrink-0 font-semibold text-white">
                    {/* « Relance 16 sept. », pas la date nue (retour BP
                        2026-09-23) : seule, une date ne dit pas ce qu'elle date. */}
                    Relance {formatRelanceCourt(card.next_action_at)}
                  </span>
                )}
                {card.next_action_at && card.next_action_note && <span className="shrink-0 text-[#4a4d56]">·</span>}
                {card.next_action_note && <span className="truncate text-[#6b7280]">{card.next_action_note}</span>}
              </p>
            ) : stale ? (
              <p className="text-[11px] text-[#E63946]">Aucun mouvement depuis {staleDays}j</p>
            ) : null}
          </div>
        )}
      </button>
    </div>
  );
});

/* ── Vue tableau (Lot A, décision BP 2026-09-23) ─────────────────────
   Les MÊMES cartes que le kanban (déjà filtrées et triées par la page),
   à plat, en colonnes façon Excel — la feuille de suivi que les
   recruteurs tiennent à côté. Aucun champ neuf : tout vient de
   usePipelineCards.

   Ce que le tableau ne fait PAS, exprès : aucune édition en ligne. Un clic
   sur une ligne ouvre le même panneau latéral que la carte ; un clic sur la
   relance ouvre le même popover. Les gardes du mode démo gratuit vivent
   dans ces deux surfaces — le tableau en hérite sans en dupliquer une.

   « Faits saillants » = oui/non + lien vers la fiche : recruiter_athlete_cards
   ne rend que `a_une_video` (video_faits_saillants_url non nul), pas l'URL.
   Option retenue par BP plutôt qu'une migration de la RPC. Conséquence : un
   athlète qui n'a QU'UN lien Hudl s'affiche « — » ici ; la fiche le montre. */

/** Colonnes dont l'en-tête pilote un tri EXISTANT (sortPipelineCards). Les
 *  autres ne sont pas triables : pas de mode de tri inventé pour le tableau,
 *  le menu « Trier » et les en-têtes restent un seul et même état. */
const TRI_PAR_COLONNE: Partial<Record<string, PipelineSortMode>> = {
  nom: "name_asc",
  cote: "rating_desc",
  grade: "grade_desc",
  relance: "next_action_asc",
};

/* TROIS BLOCS (retour BP 2026-09-23) : qui est le joueur, ce qu'il vaut,
   où j'en suis avec lui. Un bloc = un titre au-dessus et un filet vertical
   à sa gauche, pour que l'œil trouve le bloc avant la colonne.
   L'ordre des colonnes est celui de BP (2e passe), dans COLONNES_TABLEAU. */
type BlocTableau = "identification" | "evaluation" | "suivi";

const BLOCS_TABLEAU: { cle: BlocTableau; libelle: string }[] = [
  { cle: "identification", libelle: "Identification" },
  { cle: "evaluation", libelle: "Évaluation" },
  { cle: "suivi", libelle: "Mon suivi" },
];

const COLONNES_TABLEAU: { cle: string; libelle: string; bloc: BlocTableau }[] = [
  /* Ordre fixé par BP le 2026-09-23 (2e passe) — ne pas « ranger ». */
  { cle: "nom", libelle: "Nom", bloc: "identification" },
  { cle: "numero", libelle: "#", bloc: "identification" },
  { cle: "ecole", libelle: "École / Club", bloc: "identification" },
  { cle: "position", libelle: "Position", bloc: "identification" },
  { cle: "taille", libelle: "Taille", bloc: "evaluation" },
  { cle: "poids", libelle: "Poids", bloc: "evaluation" },
  { cle: "cote", libelle: "Cote coach", bloc: "evaluation" },
  { cle: "grade", libelle: "Mon grade", bloc: "suivi" },
  { cle: "etape", libelle: "Étape", bloc: "suivi" },
  { cle: "relance", libelle: "Relance", bloc: "suivi" },
  { cle: "visite", libelle: "Visite", bloc: "suivi" },
  { cle: "video", libelle: "Faits saillants", bloc: "suivi" },
  { cle: "note", libelle: "Note de suivi", bloc: "suivi" },
];

/** Première colonne de chaque bloc : c'est elle qui porte le filet. */
const DEBUT_DE_BLOC = new Set(
  COLONNES_TABLEAU.filter((c, i) => i > 0 && COLONNES_TABLEAU[i - 1].bloc !== c.bloc).map((c) => c.cle),
);

function formatTaille(card: PipelineKanbanCard): string | null {
  return card.taille_pieds ? `${card.taille_pieds}'${card.taille_pouces ?? 0}"` : null;
}

function formatPoids(card: PipelineKanbanCard): string | null {
  return card.poids_lbs ? `${card.poids_lbs} lbs` : null;
}

const VIDE = <span className="text-[#4a4d56]">—</span>;

/* ── Export CSV (lot B, décision BP 2026-09-24) ─────────────────────
   MÊMES colonnes, MÊME ordre que la vue tableau : les en-têtes et les
   valeurs dérivent de COLONNES_TABLEAU, rien n'est listé deux fois.
   Différences voulues avec l'écran, parce qu'un tableur n'est pas un écran :
   · dates en AAAA-MM-JJ (triables dans Excel), visite avec l'heure si posée ;
   · cote en décimal français (4,5) ;
   · Faits saillants : « Oui » ou vide (la RPC ne rend pas l'URL) ;
   · Note de suivi : TOUTES les notes de suivi, datées, du plus ancien au plus
     récent, RASSEMBLÉES dans une seule case (décision BP) — le tableau n'en
     montre que la dernière.
   Identité masquée : `full_name` vaut déjà « Identité réservée » et le
   numéro est vide — l'export ne sort que ce que l'écran montre. */
function valeurExport(cle: string, card: PipelineKanbanCard, notes: string): ValeurCsv {
  switch (cle) {
    case "nom": return card.full_name;
    case "numero": return card.jersey || "";
    case "ecole": return card.noTeam ? "Ligue civile" : card.school;
    case "position": return card.position;
    case "taille": return formatTaille(card) ?? "";
    case "poids": return formatPoids(card) ?? "";
    case "cote": return aUneCote(card.coach_rating) ? decimalFr(card.coach_rating) : "";
    case "grade": return card.grade ?? "";
    case "etape": return KANBAN_COLUMNS.find((c) => c.id === card.status)?.label ?? card.status;
    case "relance": return card.next_action_at ? card.next_action_at.slice(0, 10) : "";
    case "visite": {
      if (!card.visit_at) return "";
      const { date, time } = isoToInputs(card.visit_at);
      return time ? `${date} ${time}` : date;
    }
    case "video": return card.has_video ? "Oui" : "";
    case "note": return notes;
    default: return "";
  }
}

/** Date locale AAAA-MM-JJ d'un timestamptz (une note écrite le soir n'est pas
 *  datée du lendemain). */
function dateLocale(iso: string): string {
  return isoToInputs(iso).date;
}

/** Date d'une note de suivi : « 18 sept. », année ajoutée si elle diffère.
 *  `created_at` est un timestamptz — lu en heure LOCALE (new Date), pas
 *  tranché en chaîne comme jourLocal() le fait pour les colonnes `date` :
 *  une note écrite à 21 h serait sinon datée du lendemain (UTC). */
function formatDateNote(iso: string, now: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const annee = now ? new Date(now).getFullYear() : d.getFullYear();
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${d.getFullYear() !== annee ? ` ${d.getFullYear()}` : ""}`;
}

/** Contenu d'une cellule — une seule fonction pour les treize colonnes, pour
 *  que l'ORDRE vive dans COLONNES_TABLEAU et nulle part ailleurs. */
function celluleTableau(cle: string, card: PipelineKanbanCard, now: number): React.ReactNode {
  switch (cle) {
    case "nom":
      return <span className={`line-clamp-2 text-[15px] font-semibold leading-snug ${card.identityVisible === false ? "text-[#6b7280] italic" : "text-white"}`}>{card.full_name}</span>;
    case "numero":
      return card.jersey ? <span className="font-black text-[#E63946]">{card.jersey}</span> : VIDE;
    case "position":
      return card.position
        ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.06] text-[12px] font-bold uppercase tracking-wider text-white">{card.position}</span>
        : VIDE;
    case "ecole":
      return card.noTeam
        ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">Ligue Civile</span>
        : card.school ? <span className="line-clamp-2 leading-snug text-[#c8c8cc]" title={card.school}>{card.school}</span> : VIDE;
    case "cote":
      /* Compacte (★ 4.5) : cinq étoiles pour un chiffre prenaient 120 px.
         Une cote ABSENTE n'est pas une cote de ZÉRO (lib/evaluations/presence). */
      return aUneCote(card.coach_rating) ? (
        <span className="inline-flex items-center gap-1 font-bold text-[#F59E0B] tabular-nums" title={`Cote du coach : ${card.coach_rating.toFixed(1)} / 5`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          {card.coach_rating.toFixed(1)}
        </span>
      ) : VIDE;
    case "taille": {
      const t = formatTaille(card);
      return t ? <span className="text-[#e0e0e0] tabular-nums">{t}</span> : VIDE;
    }
    case "poids": {
      const p = formatPoids(card);
      return p ? <span className="text-[#e0e0e0] tabular-nums">{p}</span> : VIDE;
    }
    case "etape": {
      const col = KANBAN_COLUMNS.find((c) => c.id === card.status);
      const engagement = col?.phase === "commitment";
      return (
        <span className={`inline-flex items-center gap-1.5 font-semibold whitespace-nowrap ${engagement ? "text-[#E63946]" : "text-[#9CA3AF]"}`}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col?.color ?? GRAY }} />
          {col?.label ?? card.status}
        </span>
      );
    }
    case "grade":
      return card.grade ? <GradeChip grade={card.grade} /> : VIDE;
    case "relance":
      /* Rendu en LECTURE seulement : la cellule éditable (CelluleRelance)
         l'enveloppe dans le tableau. Blanc — le jaune est réservé aux étoiles. */
      return card.next_action_at
        ? <span className="font-semibold whitespace-nowrap text-white">{formatRelanceCourt(card.next_action_at)}</span>
        : VIDE;
    case "visite": {
      const v = card.visit_at ? formatVisitPill(card.visit_at, now) : null;
      return v
        ? <span className="font-semibold whitespace-nowrap text-white" title={v.isPast ? "Visite passée" : "Visite planifiée"}>{v.label}</span>
        : VIDE;
    }
    case "note":
      /* La DERNIÈRE note de suivi (recruiter_notes), avec sa date — pas la
         note de relance, qui passe au survol de la colonne Relance. */
      return card.derniere_note ? (
        <span className="line-clamp-2 leading-snug text-[#9CA3AF]" title={card.derniere_note.content}>
          <span className="font-semibold text-[#6b7280]">{formatDateNote(card.derniere_note.created_at, now)} — </span>
          {card.derniere_note.content}
        </span>
      ) : VIDE;
    case "video":
      return card.has_video ? (
        <Link
          href={`/recruteur/athletes/${card.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 font-bold text-white hover:text-[#E63946] transition-colors whitespace-nowrap"
          title="Ouvrir la fiche pour voir les faits saillants"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          Voir
        </Link>
      ) : VIDE;
    default:
      return VIDE;
  }
}

/** Relance ÉDITABLE dans la cellule (décision BP 2026-09-23 : il aime modifier
 *  la date sur place ; aucune fenêtre dédiée). Un clic pose un champ date DANS
 *  la case ; choisir une date l'enregistre aussitôt, la vider retire la
 *  relance, Échap annule. La NOTE de relance ne s'édite pas ici : elle vit au
 *  panneau latéral (seul lieu complet de la relance) et s'affiche au survol.
 *  Mode démo : le clic affiche l'invitation Pro, rien n'est écrit. */
function CelluleRelance({
  card, now, isFreeDemoMode, onTease, onSave,
}: {
  card: PipelineKanbanCard;
  now: number;
  isFreeDemoMode: boolean;
  onTease: () => void;
  onSave: (pipelineId: string, date: string | null) => void;
}) {
  const [edition, setEdition] = useState(false);
  if (edition) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={card.next_action_at?.slice(0, 10) ?? ""}
        aria-label="Date de relance"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          // Une saisie clavier partielle rend "" : on n'efface que si le champ
          // est vraiment vide ET valide (bouton « Effacer » du sélecteur).
          if (!v && !e.target.validity.valid) return;
          setEdition(false);
          if (v !== (card.next_action_at?.slice(0, 10) ?? "")) onSave(card.pipeline_id, v || null);
        }}
        onBlur={() => setEdition(false)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEdition(false); } }}
        className="w-[150px] bg-[#13151a] border border-[#E63946] rounded-md px-2 py-1 text-[13px] text-white outline-none [color-scheme:dark]"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (isFreeDemoMode) { onTease(); return; } setEdition(true); }}
      className="inline-flex items-center gap-1.5 group/relance"
      title={card.next_action_note ? `Note de relance : ${card.next_action_note}\n\nCliquer pour modifier la date` : "Cliquer pour poser ou modifier la date de relance"}
    >
      {celluleTableau("relance", card, now)}
      <PencilIcon color="#6B7280" size={11} />
    </button>
  );
}

/** Clic DANS une cellule éditable mais HORS de son bouton (la marge de la
 *  case, qui s'éclaire au survol) : il ne doit JAMAIS remonter à la ligne,
 *  dont le clic ouvre le panneau latéral — sinon les deux se déclenchaient
 *  (bug relevé par BP le 2026-09-23). On arrête la propagation et on ouvre
 *  l'édition de la case, comme si le bouton avait été cliqué.
 *  Un clic sur le bouton lui-même, ou sur le champ en cours d'édition,
 *  n'arrive pas ici : ils arrêtent la propagation eux-mêmes. */
function cliquerCelluleEditable(e: React.MouseEvent<HTMLTableCellElement>) {
  e.stopPropagation();
  if (e.target !== e.currentTarget) return;
  e.currentTarget.querySelector<HTMLButtonElement>("button")?.click();
}

/** Même garde au CLAVIER : la ligne ouvre le panneau sur Entrée
 *  (onKeyDown du <tr>). Entrée sur le bouton d'une cellule, ou dans son champ
 *  en cours d'édition, déclenchait l'édition ET le panneau. Les touches d'une
 *  cellule éditable restent dans la cellule. */
function arreterToucheCellule(e: React.KeyboardEvent<HTMLTableCellElement>) {
  e.stopPropagation();
}

/** Le petit crayon des cellules éditables : il dit que la case se modifie. */
const CRAYON = <PencilIcon color="#6B7280" size={11} />;

/** MON GRADE éditable dans la cellule (décision BP 2026-09-23). Un clic pose
 *  un menu A+ … D (et « Aucun ») DANS la case ; choisir enregistre aussitôt.
 *  Même écriture que le panneau (handleSetGrade, optimiste, garde démo). */
function CelluleGrade({ card, isFreeDemoMode, onTease, onSave }: {
  card: PipelineKanbanCard;
  isFreeDemoMode: boolean;
  onTease: () => void;
  onSave: (cardId: string, grade: Grade | null, previous: Grade | null) => void;
}) {
  const [edition, setEdition] = useState(false);
  if (edition) {
    return (
      <select
        autoFocus
        defaultValue={card.grade ?? ""}
        aria-label="Mon grade"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          setEdition(false);
          const suivant = (GRADES as readonly string[]).includes(v) ? (v as Grade) : null;
          if (suivant !== (card.grade ?? null)) onSave(card.id, suivant, card.grade ?? null);
        }}
        onBlur={() => setEdition(false)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEdition(false); } }}
        className="bg-[#13151a] border border-[#E63946] rounded-md px-2 py-1 text-[13px] text-white outline-none [color-scheme:dark]"
      >
        <option value="">Aucun</option>
        {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
    );
  }
  return (
    <button type="button" className="inline-flex items-center gap-1.5" title="Cliquer pour modifier mon grade"
      onClick={(e) => { e.stopPropagation(); if (isFreeDemoMode) { onTease(); return; } setEdition(true); }}>
      {card.grade ? <GradeChip grade={card.grade} /> : VIDE}
      {CRAYON}
    </button>
  );
}

/** ÉTAPE éditable dans la cellule. « Retiré » passe par la CONFIRMATION
 *  existante (décision BP : elle retire l'athlète du processus) ; les autres
 *  étapes s'appliquent aussitôt, par le même handler que le kanban. */
function CelluleEtape({ card, isFreeDemoMode, onTease, onChange }: {
  card: PipelineKanbanCard;
  isFreeDemoMode: boolean;
  onTease: () => void;
  onChange: (card: PipelineKanbanCard, etape: RecruitmentStatus) => void;
}) {
  const [edition, setEdition] = useState(false);
  if (edition) {
    return (
      <select
        autoFocus
        defaultValue={card.status}
        aria-label="Étape"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value as RecruitmentStatus;
          setEdition(false);
          if (v !== card.status) onChange(card, v);
        }}
        onBlur={() => setEdition(false)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEdition(false); } }}
        className="bg-[#13151a] border border-[#E63946] rounded-md px-2 py-1 text-[13px] text-white outline-none [color-scheme:dark]"
      >
        {KANBAN_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    );
  }
  return (
    <button type="button" className="inline-flex items-center gap-1.5" title="Cliquer pour changer l'étape"
      onClick={(e) => { e.stopPropagation(); if (isFreeDemoMode) { onTease(); return; } setEdition(true); }}>
      {celluleTableau("etape", card, 0)}
      {CRAYON}
    </button>
  );
}

/** DATE DE VISITE éditable dans la cellule — règle BP (lib/pipeline/regleVisite) :
 *  poser une date fait passer l'étape AU MOINS à « Visite planifiée » (jamais
 *  de recul depuis Engagé / Lettre signée) ; vider la date ne change pas
 *  l'étape. L'heure éventuelle d'une visite existante est conservée. */
function CelluleVisite({ card, now, isFreeDemoMode, onTease, onSave }: {
  card: PipelineKanbanCard;
  now: number;
  isFreeDemoMode: boolean;
  onTease: () => void;
  onSave: (card: PipelineKanbanCard, date: string | null) => void;
}) {
  const [edition, setEdition] = useState(false);
  if (edition) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={isoToInputs(card.visit_at ?? null).date}
        aria-label="Date de visite"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          if (!v && !e.target.validity.valid) return;
          setEdition(false);
          if (v !== isoToInputs(card.visit_at ?? null).date) onSave(card, v || null);
        }}
        onBlur={() => setEdition(false)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEdition(false); } }}
        className="w-[150px] bg-[#13151a] border border-[#E63946] rounded-md px-2 py-1 text-[13px] text-white outline-none [color-scheme:dark]"
      />
    );
  }
  return (
    <button type="button" className="inline-flex items-center gap-1.5"
      title={etapePorteVisite(card.status) ? "Cliquer pour poser ou modifier la date de visite" : "Poser une date de visite fait passer l'athlète à « Visite planifiée »"}
      onClick={(e) => { e.stopPropagation(); if (isFreeDemoMode) { onTease(); return; } setEdition(true); }}>
      {celluleTableau("visite", card, now)}
      {CRAYON}
    </button>
  );
}

/** Largeurs minimales : les colonnes à texte libre (nom, école, note) passent
 *  sur deux lignes plutôt que d'écraser les autres. */
const LARGEUR_MIN: Partial<Record<string, string>> = {
  /* Nom FIGÉ à gauche (comme une colonne figée d'Excel) : sous ~1600 px
     d'écran le tableau défile dans son cadre, et « Mon suivi » se lit sans
     perdre de vue de quel joueur il s'agit. Fond opaque obligatoire, sinon
     les cellules défilent en transparence dessous. */
  nom: "min-w-[150px] sticky left-0 z-[1] bg-[#1A1D24] shadow-[1px_0_0_#2D3748] group-hover:bg-[#1f2229] group-focus:bg-[#20232a]",
  ecole: "min-w-[160px] max-w-[260px]",
  note: "min-w-[180px] max-w-[320px]",
};

function PipelineTable({
  cards,
  now,
  sortBy,
  onSort,
  onRowClick,
  isFreeDemoMode,
  onTease,
  onSaveRelance,
  onSetGrade,
  onChangeEtape,
  onSaveVisite,
}: {
  cards: PipelineKanbanCard[];
  now: number;
  sortBy: PipelineSortMode;
  onSort: (mode: PipelineSortMode) => void;
  onRowClick: (card: PipelineKanbanCard) => void;
  isFreeDemoMode: boolean;
  onTease: () => void;
  onSaveRelance: (pipelineId: string, date: string | null) => void;
  onSetGrade: (cardId: string, grade: Grade | null, previous: Grade | null) => void;
  onChangeEtape: (card: PipelineKanbanCard, etape: RecruitmentStatus) => void;
  onSaveVisite: (card: PipelineKanbanCard, date: string | null) => void;
}) {
  const filet = (cle: string) => (DEBUT_DE_BLOC.has(cle) ? "border-l border-[#2D3748]" : "");
  return (
    <div className="overflow-x-auto rounded-xl border border-[#2D3748] bg-[#1A1D24]">
      <table className="w-full text-[14px]">
        <thead>
          {/* Rangée des blocs. */}
          <tr>
            {BLOCS_TABLEAU.map((b, i) => (
              <th
                key={b.cle}
                scope="colgroup"
                colSpan={COLONNES_TABLEAU.filter((c) => c.bloc === b.cle).length}
                className={`text-left px-4 pt-3.5 pb-1 text-[11px] font-black uppercase tracking-[0.2em] ${b.cle === "suivi" ? "text-[#E63946]" : "text-[#9CA3AF]"} ${i > 0 ? "border-l border-[#2D3748]" : ""}`}
              >
                {b.libelle}
              </th>
            ))}
          </tr>
          <tr className="border-b border-[#2D3748]">
            {COLONNES_TABLEAU.map((col) => {
              const mode = TRI_PAR_COLONNE[col.cle];
              const actif = mode !== undefined && sortBy === mode;
              const fige = col.cle === "nom" ? "sticky left-0 z-[1] bg-[#1A1D24] shadow-[1px_0_0_#2D3748]" : "";
              const base = `text-left align-bottom px-4 pt-1 pb-3 text-[12px] leading-tight font-bold uppercase tracking-wide whitespace-nowrap ${filet(col.cle)} ${fige}`;
              if (!mode) {
                return <th key={col.cle} scope="col" className={`${base} text-[#6b7280]`}>{col.libelle}</th>;
              }
              return (
                <th key={col.cle} scope="col" className={base} aria-sort={actif ? "ascending" : "none"}>
                  {/* Re-cliquer l'en-tête actif rend le tri par défaut : on ne
                      reste jamais coincé dans un tri choisi par mégarde. */}
                  <button
                    type="button"
                    onClick={() => onSort(actif ? DEFAULT_PIPELINE_SORT : mode)}
                    className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors ${actif ? "text-white" : "text-[#6b7280] hover:text-[#9CA3AF]"}`}
                    title={actif ? "Revenir au tri par dernière activité" : `Trier : ${PIPELINE_SORT_OPTIONS.find((o) => o.value === mode)?.label}`}
                  >
                    {col.libelle}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={actif ? "opacity-100" : "opacity-30"} aria-hidden>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {cards.length === 0 ? (
            <tr>
              <td colSpan={COLONNES_TABLEAU.length} className="px-4 py-14 text-center text-[14px] text-[#4a4d56]">
                Aucun athlète ne correspond
              </td>
            </tr>
          ) : cards.map((card) => {
            return (
              <tr
                key={card.id}
                tabIndex={0}
                onClick={() => onRowClick(card)}
                onKeyDown={(e) => { if (e.key === "Enter") onRowClick(card); }}
                className="group border-t border-[#2D3748]/60 cursor-pointer hover:bg-white/[0.03] focus:bg-white/[0.04] outline-none transition-colors"
                aria-label={card.full_name}
              >
                {COLONNES_TABLEAU.map((col) => {
                  const cls = `px-4 py-3.5 ${filet(col.cle)} ${LARGEUR_MIN[col.cle] ?? "whitespace-nowrap"}`;
                  /* Plus de liséré coloré en bord de ligne : retiré avec
                     celui des cartes (décision BP 2026-09-23). */
                  /* Cellules ÉDITABLES sur place (décision BP 2026-09-23) :
                     Mon grade, Étape, Relance, Visite. Aucune fenêtre dédiée. */
                  if (col.cle === "grade") {
                    return (
                      <td key={col.cle} className={`${cls} hover:bg-white/[0.04]`} onClick={cliquerCelluleEditable} onKeyDown={arreterToucheCellule}>
                        <CelluleGrade card={card} isFreeDemoMode={isFreeDemoMode} onTease={onTease} onSave={onSetGrade} />
                      </td>
                    );
                  }
                  if (col.cle === "etape") {
                    return (
                      <td key={col.cle} className={`${cls} hover:bg-white/[0.04]`} onClick={cliquerCelluleEditable} onKeyDown={arreterToucheCellule}>
                        <CelluleEtape card={card} isFreeDemoMode={isFreeDemoMode} onTease={onTease} onChange={onChangeEtape} />
                      </td>
                    );
                  }
                  if (col.cle === "visite") {
                    return (
                      <td key={col.cle} className={`${cls} hover:bg-white/[0.04]`} onClick={cliquerCelluleEditable} onKeyDown={arreterToucheCellule}>
                        <CelluleVisite card={card} now={now} isFreeDemoMode={isFreeDemoMode} onTease={onTease} onSave={onSaveVisite} />
                      </td>
                    );
                  }
                  if (col.cle === "relance") {
                    /* Relance : éditable SUR PLACE (CelluleRelance) — y compris
                       pour en POSER une sur une ligne qui n'en a pas. */
                    return (
                      <td key={col.cle} className={`${cls} hover:bg-white/[0.04]`} onClick={cliquerCelluleEditable} onKeyDown={arreterToucheCellule}>
                        <CelluleRelance card={card} now={now} isFreeDemoMode={isFreeDemoMode} onTease={onTease} onSave={onSaveRelance} />
                      </td>
                    );
                  }
                  return <td key={col.cle} className={cls}>{celluleTableau(col.cle, card, now)}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Drag Overlay Card ───────────────────────────────────────── */

function DragOverlayCard({ card }: { card: PipelineKanbanCard }) {
  const col = KANBAN_COLUMNS.find((c) => c.id === card.status);
  return (
    <div className="bg-[#1A1D24] rounded-lg p-3.5 border border-[#E63946]/40 shadow-2xl w-[290px] opacity-90" style={{ transform: "scale(1.02)" }}>
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-bold text-white">{card.full_name}</span>
        {card.is_verified && <svg width="12" height="12" viewBox="0 0 24 24" fill={BLUE} stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: col?.color === RED ? "rgba(230,57,70,0.25)" : "rgba(107,114,128,0.25)" }}>{card.sport}</span>
        <span className="text-[11px] text-[#9CA3AF]">{card.position}</span>
        {card.noTeam ? (
          <span className="inline-flex items-center px-1.5 py-0 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">
            Ligue Civile
          </span>
        ) : (
          <span className="text-[11px] text-[#6b7280]">· {card.school}</span>
        )}
      </div>
    </div>
  );
}

/* ── Droppable Kanban Column ─────────────────────────────────── */

function KanbanColumn({
  colDef, cards, activeCardStatus, onCardClick, now, competitorMap,
}: {
  colDef: typeof KANBAN_COLUMNS[number];
  cards: PipelineKanbanCard[];
  activeCardStatus: RecruitmentStatus | null;
  onCardClick: (card: PipelineKanbanCard) => void;
  now: number;
  competitorMap: Record<string, number>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: colDef.id });
  const isExit = colDef.phase === "exit";
  const isDraggable = true;
  const isValidTarget = activeCardStatus ? activeCardStatus !== colDef.id : false;
  const dropHighlight = isOver && isValidTarget;
  const dropBorderColor = dropHighlight ? (isExit ? GRAY : GREEN) : "transparent";
  const HeaderIcon = isExit ? TrashIcon : ArrowIcon;
  const tooltip = colDef.isAuto
    ? colDef.id === "contacte" ? "Statut automatique, mais accepte un retour depuis En discussion" : "Statut automatique — favori"
    : isExit ? "Retirer du processus" : "Glisser un athlète ici";

  return (
    <div className={`flex flex-col min-w-[300px] max-w-[340px] ${isExit ? "opacity-60 ml-4" : ""}`}>
      <div className="bg-[#1A1D24] rounded-t-lg px-3.5 py-3 border-t-[3px] border-x border-b border-[#2D3748]" style={{ borderTopColor: colDef.color }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span title={tooltip}><HeaderIcon /></span>
            <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-white">{colDef.label}</span>
          </div>
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-black text-white" style={{ backgroundColor: colDef.color }}>{cards.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 bg-[#111317] border-x border-b rounded-b-lg p-2.5 space-y-2.5 overflow-y-auto max-h-[calc(100vh-300px)] transition-all duration-300 ease-out border-[#2D3748]"
        style={{
          borderColor: dropHighlight ? `${dropBorderColor}30` : undefined,
          boxShadow: dropHighlight ? `inset 0 0 30px ${dropBorderColor}08, 0 0 12px ${dropBorderColor}15` : undefined,
          background: dropHighlight ? `linear-gradient(180deg, ${dropBorderColor}06 0%, #111317 40%)` : undefined,
        }}
      >
        {dropHighlight && (
          <div className="text-center py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: `${dropBorderColor}90` }}>
              {isExit ? "Retirer" : "Déposer ici"}
            </span>
          </div>
        )}
        {cards.length === 0 && !dropHighlight ? (
          <div className="py-8 text-center"><p className="text-[11px] text-[#4a4d56]">Aucun athlète</p></div>
        ) : (
          cards.map((card) => (
            <DraggableKanbanCard key={card.id} card={card} isDraggable={isDraggable} onClick={() => onCardClick(card)} now={now} competitorMap={competitorMap} />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Slide-Over Panel ─────────────────────────────────────────── */

interface NoteEntry {
  id: string;
  content: string;
  created_at: string;
}

function SlideOver({
  card, onClose, onStatusChange, onSetGrade, onSaveVisit, onSaveRelanceNote,
  isFreeDemoMode, onTeaseUpgrade,
}: {
  card: PipelineKanbanCard; onClose: () => void;
  onStatusChange: (cardId: string, newStatus: RecruitmentStatus) => void;
  /** `null` retire le grade (DELETE de la ligne, pas un NULL en base). */
  onSetGrade: (cardId: string, grade: Grade | null, previousGrade: Grade | null) => void;
  /** Écrit recruiter_pipeline.visit_at. `null` efface la date. */
  onSaveVisit: (pipelineId: string, visitAtIso: string | null) => void;
  /** Écrit recruiter_pipeline.next_action_note. `null` l'efface. */
  onSaveRelanceNote: (pipelineId: string, note: string | null) => void;
  isFreeDemoMode: boolean;
  onTeaseUpgrade: () => void;
}) {
  const [noteText, setNoteText] = useState("");
  // Note de RELANCE (next_action_note) — distincte des notes de suivi. Seedée
  // au montage : le panneau se remonte à chaque carte (key={card.id}).
  const [noteRelance, setNoteRelance] = useState(card.next_action_note ?? "");
  // Édition inline de la visite. Le panneau se ferme/rouvre par carte, donc
  // on seed depuis card.visit_at à chaque montage — pas besoin de resync.
  const [editingVisit, setEditingVisit] = useState(false);
  const [visitDate, setVisitDate] = useState(() => isoToInputs(card.visit_at ?? null).date);
  const [visitTime, setVisitTime] = useState(() => isoToInputs(card.visit_at ?? null).time);
  // Migration TanStack (iter 5.3b) — notes en cache per-athlete on-demand.
  const queryClient = useQueryClient();
  const { data: noteHistory = [] } = usePipelineNotes(card.id);
  const [posting, setPosting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<RecruitmentStatus | null>(null);
  const [retireReason, setRetireReason] = useState("");
  const currentCol = KANBAN_COLUMNS.find((c) => c.id === card.status);

  // Post a new note + invalidation cache
  const handlePostNote = async () => {
    if (!noteText.trim()) return;
    if (isFreeDemoMode) {
      onTeaseUpgrade();
      setNoteText("");
      return;
    }
    setPosting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return; }
    await supabase
      .from("recruiter_notes")
      .insert({ recruiter_id: user.id, athlete_id: card.id, content: noteText.trim() })
      .select("id, content, created_at")
      .single();
    queryClient.invalidateQueries({ queryKey: ["pipeline-notes"] });
    // Colonne « Note de suivi » de la vue tableau (dernière note, lue par
    // usePipelineCards) : sans ceci elle resterait sur l'ancienne note.
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    setNoteText("");
    setPosting(false);
  };

  const handleStatusClick = (status: RecruitmentStatus) => {
    if (status === card.status) return;
    setPendingStatus(status);
  };

  const confirmStatus = () => {
    if (pendingStatus) {
      onStatusChange(card.id, pendingStatus);
      setPendingStatus(null);
      setRetireReason("");
    }
  };

  const pctColor = completenessColor(card.profile_completeness);
  const pendingIsRetire = pendingStatus === "retire";
  const pendingLabel = pendingStatus ? KANBAN_COLUMNS.find((c) => c.id === pendingStatus)?.label : "";

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[80] w-full sm:w-[420px] bg-[#1A1D24] border-l border-[#2D3748] shadow-2xl overflow-y-auto animate-[slideInRight_0.25s_ease-out]">
        <button type="button" onClick={onClose} aria-label="Fermer le panneau" className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center text-[#6b7280] hover:text-white transition-colors z-10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-head text-[20px] font-black text-white uppercase tracking-tight">{card.full_name}</h2>
              {card.is_verified && <svg width="18" height="18" viewBox="0 0 24 24" fill={BLUE} stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: currentCol?.phase === "commitment" ? "rgba(230,57,70,0.25)" : "rgba(107,114,128,0.25)" }}>{card.sport}</span>
              <span className="text-[13px] text-[#9CA3AF]">{card.position}</span>
              <span className="text-[#2D3748]">·</span>
              <span className="text-[13px] text-[#9CA3AF]">{card.division}</span>
            </div>
            {card.noTeam ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mt-1">
                Ligue Civile
              </span>
            ) : (
              <p className="text-[13px] text-[#6b7280] mt-1">{card.school}</p>
            )}
            <p className="text-[13px] text-[#6b7280]">Promotion {card.graduation_year}</p>
            <div className="flex items-center gap-2 mt-3">{aUneCote(card.coach_rating) ? <><StarRating rating={card.coach_rating} size="md" /><span className="text-[12px] text-[#6b7280]">Cote du coach</span></> : <span className="text-[12px] text-[#6b7280]">Pas encore évalué par son entraîneur</span>}</div>
            {/* Mon grade — sous la cote du coach, et séparé d'elle : les
                étoiles sont le jugement d'un tiers, le grade est le mien. */}
            <div className="mt-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Mon grade</span>
              <div className="mt-2">
                <GradePicker value={card.grade} onSelect={(g) => onSetGrade(card.id, g, card.grade ?? null)} />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider">Profil complété</span>
                <span className="text-[13px] font-bold" style={{ color: pctColor }}>{card.profile_completeness}%</span>
              </div>
              <div className="h-1.5 bg-[#2D3748] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${card.profile_completeness}%`, backgroundColor: pctColor }} />
              </div>
            </div>
          </div>
          {/* Notes — ServiceNow-style work notes + activity feed */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-2">Notes de suivi</h3>
            {/* Input */}
            <div className="flex gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                placeholder="Ajouter une note..."
                className="flex-1 bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePostNote(); } }}
              />
              <button
                type="button"
                onClick={handlePostNote}
                disabled={posting || !noteText.trim()}
                className="self-end px-3 py-2 bg-[#E63946] hover:bg-[#D42B22] disabled:bg-[#2D3748] disabled:text-[#4a4d56] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors shrink-0"
              >
                {posting ? "..." : "Poster"}
              </button>
            </div>

            {/* Activity timeline */}
            {noteHistory.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Activités</span>
                  <span className="text-[10px] text-[#4a4d56]">{noteHistory.length}</span>
                </div>
                <div className="space-y-0">
                  {noteHistory.map((note, idx) => {
                    const d = new Date(note.created_at);
                    const dateStr = d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
                    const timeStr = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={note.id} className={`relative pl-5 pb-4 ${idx < noteHistory.length - 1 ? "border-l border-[#2D3748]" : "border-l border-transparent"} ml-1.5`}>
                        {/* Timeline dot */}
                        <div className="absolute left-[-4px] top-1 w-2 h-2 rounded-full bg-[#E63946]" />
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="text-[11px] font-bold text-[#9CA3AF]">{dateStr}</span>
                          <span className="text-[10px] text-[#4a4d56]">{timeStr}</span>
                        </div>
                        <p className="text-[13px] text-[#e0e0e0] leading-relaxed whitespace-pre-wrap">{note.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Changer le statut</h3>
            <div className="grid grid-cols-2 gap-2">
              {KANBAN_COLUMNS.map((col) => {
                const isActive = col.id === card.status;
                return (
                  <button key={col.id} type="button" onClick={() => handleStatusClick(col.id)} className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all ${isActive ? (col.phase === "commitment" ? "bg-[#E63946]/15 border-[#E63946] text-[#E63946]" : col.phase === "exit" ? "bg-[#6B7280]/15 border-[#6B7280] text-[#6B7280]" : "bg-[#6B7280]/15 border-[#6B7280] text-[#6B7280]") : "bg-transparent border-[#2D3748] text-[#6b7280] hover:border-[#4a4d56] hover:text-[#9CA3AF]"}`}>
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* ── Relance ───────────────────────────────────────────────────
              LE MÊME bloc que la fiche athlète (RelanceFiche) : même champ
              date, même UPDATE, mêmes toasts, même décision « la date seule,
              la note reste au pipeline ». Le recruteur fixe ou déplace sa
              relance sans quitter Mon processus.
              Le composant invalide ["pipeline"] après écriture : la carte du
              kanban et l'encart du dashboard suivent sans rechargement.
              Gate : jamais en mode démo Free — la RLS refuserait l'UPDATE
              (`user_has_pro()`), et un bouton qui échoue est pire qu'absent.
              La ligne existe forcément : la carte EST la ligne du pipeline. */}
          {!isFreeDemoMode && (
            <div>
              <RelanceFiche athleteId={card.id} sousTitre={null} />
              {/* Note de relance — ÉDITABLE ici, et seulement ici (la fenêtre
                  « Prochain suivi » est retirée). Enregistrée en quittant le
                  champ ou sur Entrée. Privée au recruteur depuis le Lot 2a
                  (2026-09-17) : ni le coach ni l'admin cégep ne lisent la ligne. */}
              <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280] mt-3 mb-1" htmlFor={`note-relance-${card.id}`}>Note de relance</label>
              <input
                id={`note-relance-${card.id}`}
                type="text"
                value={noteRelance}
                onChange={(e) => setNoteRelance(e.target.value)}
                onBlur={() => {
                  const v = noteRelance.trim();
                  if (v !== (card.next_action_note ?? "")) onSaveRelanceNote(card.pipeline_id, v || null);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                placeholder="Ex. : appeler l'entraîneur après le match"
                className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors"
              />
            </div>
          )}

          {/* ── Visite prévue ─────────────────────────────────────────────
              VISITE_PLANIFIEE uniquement. Sauvegarde immédiate à chaque
              changement d'input : pas de bouton « Enregistrer ». */}
          {etapePorteVisite(card.status) && (() => {
            const longLabel = card.visit_at ? formatVisitLong(card.visit_at) : null;

            const commit = (nextDate: string, nextTime: string) => {
              if (isFreeDemoMode) { onTeaseUpgrade(); return; }
              onSaveVisit(card.pipeline_id, inputsToIso(nextDate, nextTime));
            };

            return (
              /* NEUTRE depuis le 2026-09-23 (décision BP : le jaune est réservé
                 aux étoiles de la cote du coach). Ce qui suit est l'historique
                 de la teinte or, remplacée par la surface standard.
                 Teinte OR — la même que la relance, sur le web. Le bloc mobile
                 (RecruteurPipelineMobile, « Visite planifiée ») porte encore
                 le titre gris sur fond neutre : sa teinte reste à faire au
                 lot mobile (protocole web-d'abord). Une
                 visite et une relance sont la même catégorie : un rendez-vous
                 à tenir. Le bloc portait la surface et la bordure standard
                 (#1A1D24 / #2D3748) et un titre dans le même gris que
                 « Notes de suivi » : à la lecture rapide il pesait autant que
                 les trois autres sections du panneau.
                 Pas de rouge — #E63946 dit le retard et l'alerte dans cet
                 écran ; une visite planifiée n'est pas un problème.
                 La DATE reste blanche : c'est le contenu, il doit rester
                 lisible. Le fond est à 8 % pour teinter sans écraser. */
              <div
                className="rounded-lg border"
                style={{
                  padding: "12px 16px",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderColor: "#2D3748",
                }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] mb-2 text-white">Visite prévue</h3>

                {!editingVisit ? (
                  <button
                    type="button"
                    onClick={() => setEditingVisit(true)}
                    aria-label={`Modifier la date de visite${longLabel ? ` : ${longLabel}` : ""}`}
                    className="inline-flex items-center gap-1.5 text-[13px] text-white hover:text-[#D1D5DB] transition-colors text-left"
                  >
                    {longLabel ?? <span className="text-[#6B7280]">Aucune date</span>}
                    {/* Crayon toujours visible : sans lui, rien ne dit que la
                        date s'édite en place. Gris, jamais le rouge. */}
                    <PencilIcon color="#9CA3AF" size={12} />
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={visitDate}
                      aria-label="Date de la visite"
                      onChange={(e) => {
                        const v = e.target.value;
                        setVisitDate(v);
                        // Date effacée → l'heure seule n'a pas de sens : on efface tout.
                        if (!v) setVisitTime("");
                        commit(v, v ? visitTime : "");
                      }}
                      className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none"
                    />
                    <input
                      type="time"
                      value={visitTime}
                      disabled={!visitDate}
                      aria-label="Heure de la visite"
                      onChange={(e) => { setVisitTime(e.target.value); commit(visitDate, e.target.value); }}
                      className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none disabled:opacity-40"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingVisit(false)}
                      className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] hover:text-white transition-colors"
                    >
                      Terminé
                    </button>
                  </div>
                )}

                {/* Export agenda — seulement quand il y a une date à exporter. */}
                {card.visit_at && (() => {
                  const start = new Date(card.visit_at);
                  if (Number.isNaN(start.getTime())) return null;
                  const title = card.sport
                    ? `Visite — ${card.full_name} (${card.sport})`
                    : `Visite — ${card.full_name}`;
                  const { googleUrl, icsBlob } = generateCalendarLinks({
                    title,
                    description: `Visite planifiée avec ${card.full_name} via Nexus.`,
                    location: card.school || "",
                    startDate: start,
                    durationMinutes: 60,
                  });
                  const icsName = `visite-${card.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.ics`;
                  const btn = "flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-[#2D3748] bg-[#13151a] text-xs font-semibold text-[#6B7280] hover:text-[#E63946] hover:border-[#E63946]/40 transition-colors";

                  return (
                    <div className="flex gap-2 mt-3">
                      <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={btn}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        Google Agenda
                      </a>
                      <button type="button" onClick={() => downloadIcs(icsBlob, icsName)} className={btn}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Télécharger (.ics)
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          <div className="space-y-2 pt-2 border-t border-[#2D3748]">
            <Link href={`/recruteur/athletes/${card.id}`} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#13151a] border border-[#2D3748] rounded-lg text-[13px] font-bold text-white hover:border-[#E63946]/40 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              Voir le profil complet
            </Link>
            <Link href={`/recruteur/messages/nouveau?athlete=${card.id}`} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#13151a] border border-[#2D3748] rounded-lg text-[13px] font-bold text-white hover:border-[#E63946]/40 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              Envoyer un message
            </Link>
            {card.status !== "retire" && (
              <button type="button" onClick={() => handleStatusClick("retire")} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-transparent border border-[#EF4444]/30 rounded-lg text-[13px] font-bold text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6" /><path d="M9 9l6 6" /></svg>
                Retirer du processus
              </button>
            )}
          </div>
        </div>
      </div>
      {pendingStatus && (
        <ConfirmModal
          title={pendingIsRetire ? `Retirer ${card.full_name} ?` : `Déplacer vers ${pendingLabel} ?`}
          message={pendingIsRetire ? "Il ne sera plus dans ton suivi actif." : `${card.full_name} sera déplacé vers ${pendingLabel}.`}
          confirmLabel={pendingIsRetire ? "Retirer" : "Confirmer"}
          confirmColor={pendingIsRetire ? "#EF4444" : RED}
          textarea={pendingIsRetire ? { placeholder: "Raison du retrait (optionnel)", value: retireReason, onChange: setRetireReason } : undefined}
          onConfirm={confirmStatus}
          onCancel={() => { setPendingStatus(null); setRetireReason(""); }}
        />
      )}
    </>
  );
}

/* ── FacetDropdown ──────────────────────────────────────────────────────
   Une pilule `nx-filter-select` — l'apparence exacte des dropdowns de la
   page Recherche — qui ouvre un menu à CASES au lieu d'une liste native.

   POURQUOI PAS UN <select> : il est mono-valeur. Adopter le vrai `<select>`
   de la Recherche aurait coûté le multi-sélection, les compteurs par option
   et « Non renseigné » — trois choses arbitrées. Le bouton porte les mêmes
   classes, donc le même rendu, sans ce renoncement.

   Le voile `fixed inset-0` derrière le menu ferme au clic extérieur sans
   écouteur global : un `mousedown` sur `document` aurait fermé le menu au
   moment même où l'on coche une case (l'événement remonte avant le clic).

   Composant LOCAL, volontairement. Rien n'est extrait de la page Recherche :
   elle est dense, gatée Pro et couplée à `useFiltresRecherche` + l'URL.
   L'extraction se fera au 3e consommateur — consigné en P3. */
function FacetDropdown({
  def, options, selected, onToggle,
}: {
  def: FacetDef;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const n = selected.length;
  // 0 coché → « Toutes les positions ». 1 → sa valeur. 2+ → « Position (3) ».
  const label = n === 0
    ? def.allLabel
    : n === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? def.label)
      : `${def.label} (${n})`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`nx-filter-select text-left${n > 0 ? " nx-filter-active" : ""}`}
      >
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute z-[61] mt-1 min-w-[220px] max-h-[320px] overflow-y-auto rounded-xl border border-[#2a2d36] bg-[#1A1D24] p-1.5 shadow-2xl">
            {options.map((opt) => {
              const on = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onToggle(opt.value)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-white/[0.04]"
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-white/40 bg-white/[0.14]" : "border-[#3a3f4b]"}`}>
                    {on && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className={`flex-1 truncate ${on ? "text-white" : "text-[#9CA3AF]"}`}>{opt.label}</span>
                  <span className="text-[11px] text-[#4a4d56]">{opt.count}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function Page() {
  /* LA BASCULE CAPACITOR SE FAIT ICI, PAS DANS PipelinePageContent — même
     patron et même raison que RecherchePage (app/recruteur/recherche/page.tsx) :
     lire `?filtre=relances`/`?athlete=` exige useSearchParams(), qui exige un
     Suspense. Les DEUX branches restent dans le Suspense : RecruteurPipelineMobile
     lit désormais aussi l'URL (parité relances web/mobile). */
  return (
    <Suspense>
      {IS_CAPACITOR ? <RecruteurPipelineMobile /> : <PipelinePageContent />}
    </Suspense>
  );
}

function PipelinePageContent() {
  const searchParams = useSearchParams();

  // Migration TanStack (iter 5.3b) — kanban cards + competitorMap via hook.
  // Cache 60s → navigation tab → Pipeline instantanée.
  const queryClient = useQueryClient();
  const { data: pipelineData } = usePipelineCards();
  const cards = pipelineData?.cards ?? [];
  const competitorMap = pipelineData?.competitorMap ?? {};

  const [selectedCard, setSelectedCard] = useState<PipelineKanbanCard | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<RecruitmentStatus>("identifie");
  const [activeCard, setActiveCard] = useState<PipelineKanbanCard | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ cardId: string; from: RecruitmentStatus; to: RecruitmentStatus } | null>(null);
  const [retireReason, setRetireReason] = useState("");
  const [filters, setFilters] = useState<PipelineFilters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  /* ?filtre=relances | visites (tuiles du tableau de bord) : chip ACTIVE dès
     le premier rendu — pas un useEffect qui l'activerait un tick après
     affichage du kanban entier. Relances : triées la plus proche d'abord.
     Valeurs et prédicats partagés avec les tuiles (filterPipelineCards). */
  const [quick, setQuick] = useState<QuickKey[]>(() => quickDepuisFiltreUrl(searchParams.get("filtre")));
  const [sortBy, setSortBy] = useState<PipelineSortMode>(() =>
    searchParams.get("filtre") === FILTRE_PIPELINE_URL.relances ? "next_action_asc" : DEFAULT_PIPELINE_SORT,
  );
  const now = useClientNow();

  /* Kanban ⇄ tableau (Lot A). Préférence d'AFFICHAGE : localStorage, comme
     grille/liste de la Recherche — elle ne change pas les données et un lien
     partagé n'impose pas la vue. */
  const [vue, setVue] = usePreferenceLocale<"kanban" | "tableau">(
    "nexus:pipeline:vue", "kanban", VUES_PIPELINE);

  // Free users get a read-only "demo" experience: kanban renders
  // with their real pipeline data, drags revert on drop, save
  // actions show a tease toast instead of persisting.
  // `tierLoading` : le Provider défaute tier→"free" avant le fetch — sans ce
  // garde, un All Star verrait le bandeau démo + les reverts de drag flasher au
  // login. On n'active donc le mode démo QU'UNE FOIS le tier réellement chargé.
  const { tier, loading: tierLoading } = useSubscription();
  /* ── DÉCISION PRODUIT (BP, 2026-09-10) — écrite, jamais héritée ──────
     LE MODE DÉMO GRATUIT DE « MON PROCESSUS » EST ASSUMÉ.

     Un compte Free VOIT le pipeline et ne peut rien y écrire. Ce n'est pas
     un verrou oublié : c'est un levier de conversion, et il est délibéré
     depuis 0002c30 (« Pipeline demo mode for Free + sidebar unlock »), qui
     a retiré le <FeatureGate feature="unlimited_pipeline" requiredTier="pro">
     posé le matin même par 23c060e.

     ⚠️ DEUX CHOSES CONTREDISENT CE CHOIX AILLEURS, et c'est voulu de les
     laisser dire le contraire tant que le chantier « source de vérité unique
     du gating » n'a pas tranché (docs/fast-follow-1.4.2.md) :

       · la NAVIGATION reverrouille — `requiredTier: "pro"` sur l'item de la
         sidebar (adea65b) et de la MobileTabBar. Le lien est donc bloqué,
         la route ne l'est pas. C'est ce qui rend la démo atteignable par
         lien direct et invisible depuis le menu.
       · la TABLE DE FEATURES du SubscriptionProvider déclare
         `free.can_use_pipeline: false`. Elle n'est lue par personne.

     CE QUI TIENT VRAIMENT, ce n'est aucun de ces deux-là : c'est la RLS.
     `user_has_pro()` garde le with_check de recruiter_pipeline en INSERT
     ET en UPDATE. La démo est donc en lecture seule par construction, pas
     par politesse du client. Ne retirez pas ces gardes `isFreeDemoMode`
     en croyant simplifier : elles évitent à l'usager un refus serveur sec.
     ──────────────────────────────────────────────────────────────────── */
  const isFreeDemoMode = !tierLoading && tier === "free";

  // Ex-mega useEffect fetchPipeline (200+ lignes) retiré en iter 5.3b — logique dans usePipelineCards.

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const teaseUpgrade = useCallback(() => {
    showToast("Passe à Pro pour sauvegarder ton processus");
  }, [showToast]);

  // Iter 6.1b — hook DELETE pour le statut "retire" qui violait
  // chk_recruiter_pipeline_stage en UPDATE (RETIRE pas dans l'enum DB).
  const removeFromPipeline = useRemoveFromPipeline();

  /* ── Status change handler ─────────────────────────────────── */
  const handleStatusChange = useCallback(async (cardId: string, newStatus: RecruitmentStatus) => {
    if (isFreeDemoMode) {
      teaseUpgrade();
      setSelectedCard(null);
      return;
    }
    // Fix 10 iter 6.1b — "retire" = DELETE row (et non UPDATE stage='RETIRE'
    // qui échouait silencieusement à cause de chk_recruiter_pipeline_stage).
    if (newStatus === "retire") {
      try {
        await removeFromPipeline.mutateAsync({ cardId });
        setSelectedCard(null);
        showToast("Athlète retiré du processus");
      } catch {
        showToast("Erreur lors du retrait");
      }
      return;
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const now = new Date().toISOString();
      // regleVisite (décision BP 2026-09-23) : la date de visite survit de
      // « Visite planifiée » à « Lettre signée » ; elle n'est effacée que si
      // l'étape redescend SOUS « Visite planifiée ».
      const payload: Record<string, unknown> = {
        stage: newStatus.toUpperCase(), moved_at: now, updated_at: now,
        ...champVisitePourEtape(newStatus),
      };

      await supabase
        .from("recruiter_pipeline")
        .update(payload)
        .eq("athlete_id", cardId)
        .eq("recruiter_id", user.id);

      // Invalidations TanStack (iter 5.3b) — pipeline + dashboard.kpi (pipelineCounts).
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
    }
    setSelectedCard(null);
    showToast(`Statut changé → ${KANBAN_COLUMNS.find((col) => col.id === newStatus)?.label || newStatus}`);
  }, [showToast, isFreeDemoMode, teaseUpgrade, queryClient, removeFromPipeline]);

  /* ── Grade (slide-over) ─────────────────────────────────────────
     `selectedCard` est un SNAPSHOT : l'optimistic update du hook patche le
     cache ["pipeline"], pas ce snapshot. Sans le setSelectedCard ci-dessous,
     la grille du panneau resterait sur l'ancienne valeur jusqu'à réouverture
     — le même piège que handleSaveVisit plus bas.
     Le garde isFreeDemoMode n'est pas décoratif : user_has_pro() est en with
     check sur INSERT et UPDATE, donc un compte free verrait la sélection se
     poser puis se défaire au revert. On l'arrête avant l'aller-retour. */
  const upsertGrade = useUpsertAthleteGrade();
  const handleSetGrade = useCallback((cardId: string, grade: Grade | null, previousGrade: Grade | null) => {
    if (isFreeDemoMode) {
      teaseUpgrade();
      return;
    }
    // `previousGrade` vient du panneau, qui l'a sous les yeux au moment du
    // clic. Le rechercher dans `cards` ici rendrait ce callback dépendant
    // d'un tableau recréé à chaque rendu, pour une valeur que l'appelant
    // connaît déjà.
    setSelectedCard((prev) => (prev && prev.id === cardId ? { ...prev, grade } : prev));
    upsertGrade.mutate(
      { athleteId: cardId, grade },
      {
        onError: () => {
          setSelectedCard((prev) => (prev && prev.id === cardId ? { ...prev, grade: previousGrade } : prev));
          showToast("Grade non enregistré");
        },
        onSuccess: () => showToast(grade ? `Grade ${grade} enregistré` : "Grade retiré"),
      },
    );
  }, [isFreeDemoMode, teaseUpgrade, upsertGrade, showToast]);

  /* ── Save visit_at (slide-over) ─────────────────────────────────
     Écriture immédiate à chaque changement d'input — pas de bouton
     « Enregistrer ». Le panneau lit `selectedCard`, un snapshot : on le
     patche localement en plus d'invalider, sinon la date affichée (et les
     boutons agenda) resteraient sur l'ancienne valeur jusqu'à réouverture. */
  const handleSaveVisit = useCallback(async (pipelineId: string, visitAtIso: string | null) => {
    if (isFreeDemoMode) {
      teaseUpgrade();
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("recruiter_pipeline")
      .update({ visit_at: visitAtIso, updated_at: new Date().toISOString() })
      .eq("id", pipelineId);

    if (error) {
      showToast("Date de visite non enregistrée");
      return;
    }

    setSelectedCard((prev) => (prev ? { ...prev, visit_at: visitAtIso } : prev));
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    showToast(visitAtIso ? "Date de visite mise à jour" : "Date de visite retirée");
  }, [showToast, isFreeDemoMode, teaseUpgrade, queryClient]);

  /* ── Relance : date (cellule du tableau) et note (panneau) ─────────
     Plus de fenêtre dédiée (décision BP 2026-09-23) : la DATE s'édite dans la
     cellule du tableau ou dans le panneau (RelanceFiche), la NOTE dans le
     panneau seulement. `flagged` n'est plus écrit par le web — sa dernière
     interface (« Marquer urgent », dans la fenêtre) part avec elle ; la
     colonne reste en base (admin, mobile). */
  const handleSaveRelanceDate = useCallback(async (pipelineId: string, date: string | null) => {
    if (isFreeDemoMode) { teaseUpgrade(); return; }
    const supabase = createClient();
    const { error } = await supabase.from("recruiter_pipeline").update({ next_action_at: date }).eq("id", pipelineId);
    if (error) { showToast("Relance non enregistrée"); return; }
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
    showToast(date ? "Relance mise à jour" : "Relance retirée");
  }, [showToast, isFreeDemoMode, teaseUpgrade, queryClient]);

  const handleSaveRelanceNote = useCallback(async (pipelineId: string, note: string | null) => {
    if (isFreeDemoMode) { teaseUpgrade(); return; }
    const supabase = createClient();
    const { error } = await supabase.from("recruiter_pipeline").update({ next_action_note: note }).eq("id", pipelineId);
    if (error) { showToast("Note de relance non enregistrée"); return; }
    // `selectedCard` est un SNAPSHOT (même piège que handleSaveVisit).
    setSelectedCard((prev) => (prev && prev.pipeline_id === pipelineId ? { ...prev, next_action_note: note } : prev));
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    showToast(note ? "Note de relance enregistrée" : "Note de relance retirée");
  }, [showToast, isFreeDemoMode, teaseUpgrade, queryClient]);

  /* ── Cellules du tableau : étape et visite ─────────────────────────
     Étape : même handler que le kanban ; « Retiré » passe par la
     confirmation existante (pendingDrop → ConfirmModal), jamais direct. */
  const handleChangeEtapeTableau = useCallback((card: PipelineKanbanCard, etape: RecruitmentStatus) => {
    if (isFreeDemoMode) { teaseUpgrade(); return; }
    if (etape === "retire") {
      setPendingDrop({ cardId: card.id, from: card.status, to: "retire" });
      return;
    }
    void handleStatusChange(card.id, etape);
  }, [isFreeDemoMode, teaseUpgrade, handleStatusChange]);

  /* Visite : regleVisite. Une date posée sur une étape ANTÉRIEURE à « Visite
     planifiée » y fait passer l'athlète (même écriture qu'un changement
     d'étape : stage + moved_at) ; sur Engagé / Lettre signée l'étape ne bouge
     pas. Une date vidée n'enlève que la date. L'heure d'une visite existante
     est conservée. */
  const handleSaveVisiteTableau = useCallback(async (card: PipelineKanbanCard, date: string | null) => {
    if (isFreeDemoMode) { teaseUpgrade(); return; }
    const visitAt = date ? inputsToIso(date, isoToInputs(card.visit_at ?? null).time) : null;
    const avance = !!visitAt && !etapePorteVisite(card.status);
    const maintenant = new Date().toISOString();
    const payload: Record<string, unknown> = { visit_at: visitAt, updated_at: maintenant };
    if (avance) { payload.stage = "VISITE_PLANIFIEE"; payload.moved_at = maintenant; }
    const supabase = createClient();
    const { error } = await supabase.from("recruiter_pipeline").update(payload).eq("id", card.pipeline_id);
    if (error) { showToast("Date de visite non enregistrée"); return; }
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
    showToast(!visitAt ? "Date de visite retirée" : avance ? "Visite planifiée — étape mise à jour" : "Date de visite mise à jour");
  }, [isFreeDemoMode, teaseUpgrade, showToast, queryClient]);

  const openSlideOver = useCallback((card: PipelineKanbanCard) => {
    const fresh = cards.find((c) => c.id === card.id) || card;
    setSelectedCard(fresh);
  }, [cards]);

  /* ?athlete=<id> (clic sur un nom précis dans « Relances aujourd'hui ») :
     ouvre directement sa fiche pipeline, pas la liste entière. `cards` charge
     de façon async — l'effet réessaie à chaque changement de `cards` jusqu'à
     ce que la carte apparaisse. `card.id` est l'athlete_id (usePipelineCards). */
  useEffect(() => {
    const athleteId = searchParams.get("athlete");
    if (!athleteId) return;
    const found = cards.find((c) => c.id === athleteId);
    if (found) setSelectedCard(found);
  }, [searchParams, cards]);

  /* LES FACETTES (Lot 2b) — le sélecteur « sport » a disparu : le sport est
     devenu une facette parmi cinq, dans le même système. Deux mécaniques de
     filtrage dans la même barre en faisaient une de trop. */
  const extra = useMemo(() => ({ search, quick }), [search, quick]);

  const filteredCards = useMemo(
    () => filterPipelineCards(cards, filters, extra),
    [cards, filters, extra],
  );

  /* Options et compteurs de chaque facette. Comptés sur les cartes filtrées
     par les AUTRES facettes — voir filterPipelineCards. Les facettes à une
     seule valeur possible sont écartées : elles ne filtrent rien. */
  /* La PRÉSENCE d'une pilule se juge sur l'ensemble des cartes
     (isFacetOffered), son CONTENU sur le contexte courant (facetOptions).
     Mélanger les deux faisait disparaître des pilules en cours de filtrage. */
  const facetLists = useMemo(
    () => FACETS.filter((f) => isFacetOffered(cards, f.key, filters))
                .map((f) => ({ def: f, options: facetOptions(cards, f.key, filters, extra) })),
    [cards, filters, extra],
  );

  const nActiveFilters = activeFilterCount(filters, extra);

  /* LA COUCHE DE TRI, qui n'existait pas côté web (Lot 2). Les colonnes
     rendaient jusqu'ici l'ordre brut de la requête (`moved_at desc`), et les
     cartes flaggées ne remontaient pas — alors que le mobile les remontait
     depuis iter 6.1b. Même fonction des deux côtés désormais.
     Trié UNE fois ici, pas dans chaque colonne : getCardsByStatus filtre et
     préserve l'ordre, donc les trois points de rendu héritent du même tri. */
  const sortedCards = useMemo(
    () => sortPipelineCards(filteredCards, sortBy),
    [filteredCards, sortBy],
  );

  /* ── Export CSV (lot B) ─────────────────────────────────────────
     Exporte les athlètes AFFICHÉS (filtres, recherche et tri en cours).
     Ordre des gestes, et il compte :
       1. lire toutes les notes de suivi des athlètes exportés ;
       2. JOURNALISER l'export (public.pipeline_exports : qui, quand, combien
          de lignes) — s'il échoue, RIEN ne sort : un export non tracé n'a
          pas lieu (données d'athlètes, majoritairement mineurs) ;
       3. seulement alors, construire et télécharger le fichier.
     Réservé au Pro : bouton désactivé en mode démo, et user_has_pro() garde
     l'INSERT du journal en base. */
  const [exportEnCours, setExportEnCours] = useState(false);
  const handleExportCsv = useCallback(async () => {
    if (isFreeDemoMode) { teaseUpgrade(); return; }
    if (exportEnCours || sortedCards.length === 0) return;
    setExportEnCours(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showToast("Session expirée — reconnecte-toi"); return; }

      const ids = sortedCards.map((c) => c.id);
      const { data: lignesNotes, error: errNotes } = await supabase
        .from("recruiter_notes")
        .select("athlete_id, content, created_at")
        .eq("recruiter_id", user.id)
        .in("athlete_id", ids)
        .order("created_at", { ascending: true });
      if (errNotes) { showToast("Export impossible : notes de suivi illisibles"); return; }
      const notesPar: Record<string, string[]> = {};
      for (const n of (lignesNotes ?? []) as { athlete_id: string; content: string; created_at: string }[]) {
        (notesPar[n.athlete_id] ??= []).push(`${dateLocale(n.created_at)} — ${n.content}`);
      }

      const { error: errJournal } = await supabase.from("pipeline_exports").insert({ nb_lignes: sortedCards.length });
      if (errJournal) { showToast("Export annulé : il n'a pas pu être journalisé"); return; }

      const csv = construireCsv(
        COLONNES_TABLEAU.map((c) => c.libelle),
        sortedCards.map((card) => COLONNES_TABLEAU.map((c) => valeurExport(c.cle, card, (notesPar[card.id] ?? []).join("\n")))),
      );
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `processus-recrutement-${dateLocale(new Date().toISOString())}.csv`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(url);
      showToast(`${sortedCards.length} athlète${sortedCards.length > 1 ? "s" : ""} exporté${sortedCards.length > 1 ? "s" : ""}`);
    } finally {
      setExportEnCours(false);
    }
  }, [isFreeDemoMode, teaseUpgrade, exportEnCours, sortedCards, showToast]);

  /* ── DnD Handlers ──────────────────────────────────────────── */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const card = (event.active.data.current as { card: PipelineKanbanCard })?.card;
    if (card) setActiveCard(card);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;
    const card = (active.data.current as { card: PipelineKanbanCard })?.card;
    if (!card) return;
    const targetCol = over.id as RecruitmentStatus;
    if (!KANBAN_COLUMNS.some((c) => c.id === targetCol)) return;
    if (card.status === targetCol) return;

    if (isFreeDemoMode) {
      // Demo mode (iter 5.3b) : pas de visual move car cards vient du cache
      // TanStack (read-only). Juste le tease toast — UX dégradée acceptée.
      teaseUpgrade();
      return;
    }

    setPendingDrop({ cardId: card.id, from: card.status, to: targetCol });
  }, [isFreeDemoMode, teaseUpgrade]);

  const confirmDrop = useCallback(() => {
    if (!pendingDrop) return;
    handleStatusChange(pendingDrop.cardId, pendingDrop.to);
    setPendingDrop(null);
    setRetireReason("");
  }, [pendingDrop, handleStatusChange]);

  const cancelDrop = useCallback(() => { setPendingDrop(null); setRetireReason(""); }, []);

  const dropIsRetire = pendingDrop?.to === "retire";
  const dropLabel = pendingDrop ? KANBAN_COLUMNS.find((c) => c.id === pendingDrop.to)?.label : "";
  const dropCardName = pendingDrop ? cards.find((c) => c.id === pendingDrop.cardId)?.full_name : "";

  return (
    <div className={`px-4 sm:px-6 lg:px-10 py-8 mx-auto space-y-5 ${vue === "tableau" ? "max-w-none" : "max-w-[1600px]"}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Mon processus de recrutement</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">Saison {getCurrentSeason()} · Suivez vos prospects de l&apos;identification à la signature</p>
        </div>
        <div className="flex items-center gap-3">
        {/* Export CSV (lot B) — désactivé en mode démo (réservé au Pro). */}
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={isFreeDemoMode || exportEnCours || sortedCards.length === 0}
          title={isFreeDemoMode
            ? "L'export est réservé aux membres Pro"
            : `Exporter les ${sortedCards.length} athlète${sortedCards.length > 1 ? "s" : ""} affiché${sortedCards.length > 1 ? "s" : ""} (CSV pour Excel)`}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#2a2d36] bg-[#13151a] text-[14px] font-bold text-white hover:border-[#4a4d56] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exportEnCours ? "Export…" : "Exporter"}
        </button>
        {/* Bascule kanban ⇄ tableau — agrandie (retour BP 2026-09-23) : c'est
            le choix principal de la page, pas un réglage discret. */}
        <div className="flex items-center bg-[#13151a] border border-[#2a2d36] rounded-xl overflow-hidden" role="group" aria-label="Affichage">
          <button
            type="button"
            title="Vue kanban"
            aria-pressed={vue === "kanban"}
            onClick={() => setVue("kanban")}
            className={`flex items-center gap-2 px-5 py-3 text-[14px] font-bold transition-colors ${vue === "kanban" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="12" rx="1" /><rect x="17" y="3" width="4" height="8" rx="1" />
            </svg>
            Kanban
          </button>
          <button
            type="button"
            title="Vue tableau"
            aria-pressed={vue === "tableau"}
            onClick={() => setVue("tableau")}
            className={`flex items-center gap-2 px-5 py-3 text-[14px] font-bold transition-colors ${vue === "tableau" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="1" /><path d="M3 10h18" /><path d="M3 15h18" /><path d="M9 4v16" />
            </svg>
            Tableau
          </button>
        </div>
        </div>
      </div>

      {isFreeDemoMode && (
        <div className="bg-[#1A1D24] border border-[#F59E0B]/20 rounded-lg px-5 py-3 flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-[13px] text-[#9CA3AF] flex-1">
            Tu visualises ton processus.{" "}
            <Link href="/tarifs" className="text-[#F59E0B] font-bold hover:underline">
              Passe à Pro
            </Link>{" "}
            pour sauvegarder tes mouvements et ajouter des notes.
          </p>
        </div>
      )}

      <FunnelSummary cards={filteredCards} totalCards={cards.length} />

      {/* ── BARRE DE FILTRES ET DE TRI (Lot 2b) ──────────────────────────
          Alignée sur le langage de la page Recherche : champ de recherche,
          pilules `nx-filter-select`, chips rapides. Trois différences
          assumées, chacune parce que le pipeline n'est pas la recherche :

          · Les pilules ouvrent un menu à CASES (FacetDropdown), pas une
            liste native — le multi-sélection, les compteurs et « Non
            renseigné » ne tiennent pas dans un <option>.
          · Pas de « Filtres avancés » : le repli de la Recherche existe
            parce qu'elle porte 21 filtres. Cinq tiennent sur une ligne.
          · Pas de cascade sport → position : les positions offertes sont
            celles des cartes réelles, et le compteur le dit. Le pipeline
            n'a pas le problème du catalogue vide.

          L'ÉTAT ACTIF EST BLANC FRANC (nx-filter-active), jamais rouge : le
          rouge #E63946 est la couleur de la plateforme (CTA, priorité,
          destructif). Il ne reste que sur « Réinitialiser », une action. */}
      <div className="space-y-3">
        {/* Recherche par nom — même gate Pro que la page Recherche : en free
            les noms sont de toute façon verrouillés côté serveur, un champ
            actif ne chercherait que des « Athlète réservé ». */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder={isFreeDemoMode ? "Recherche par nom (Pro)" : "Rechercher par nom..."}
            value={isFreeDemoMode ? "" : search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={isFreeDemoMode}
            title={isFreeDemoMode ? "La recherche par nom est réservée aux recruteurs Pro" : undefined}
            className={`w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors${isFreeDemoMode ? " opacity-60 cursor-not-allowed" : ""}`}
          />
        </div>

        {/* Facettes + tri + réinitialisation */}
        <div className="flex flex-wrap items-center gap-2.5">
          {facetLists.map(({ def, options }) => (
            <FacetDropdown
              key={def.key}
              def={def}
              options={options}
              selected={filters[def.key]}
              onToggle={(v) => setFilters((f) => toggleFacetValue(f, def.key, v))}
            />
          ))}

          {facetLists.length > 0 && <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as PipelineSortMode)}
            aria-label="Trier les athlètes"
            className={`nx-filter-select${sortBy !== DEFAULT_PIPELINE_SORT ? " nx-filter-active" : ""}`}
          >
            {PIPELINE_SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>Trier: {opt.label}</option>
            ))}
          </select>

          {(nActiveFilters > 0 || sortBy !== DEFAULT_PIPELINE_SORT) && (
            <button
              type="button"
              onClick={() => { setFilters(EMPTY_FILTERS); setSearch(""); setQuick([]); setSortBy(DEFAULT_PIPELINE_SORT); }}
              className="nx-filter-reset flex items-center gap-1.5 text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors ml-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
              Réinitialiser
            </button>
          )}
        </div>

        {/* Chips rapides + compteur de résultats */}
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((q) => {
            const on = quick.includes(q.key);
            // « Avec grade » porte le violet du grade : la teinte est réservée
            // à cette notion sur les cartes pipeline, la chip la reprend.
            const activeCls = q.key === "graded"
              ? "bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/40"
              : "bg-white/[0.06] text-white border border-white/40";
            return (
              <button
                key={q.key}
                type="button"
                onClick={() => setQuick((cur) => cur.includes(q.key) ? cur.filter((k) => k !== q.key) : [...cur, q.key])}
                aria-pressed={on}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${on ? activeCls : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"}`}
              >
                {q.label}
              </button>
            );
          })}

          {/* Conditionnel : « 15 sur 15 » en permanence serait du bruit. Il
              n'apparaît que quand un filtre retire réellement des cartes —
              c'est lui qui explique un kanban à moitié vide. */}
          {nActiveFilters > 0 && (
            <span className="ml-auto text-[12px] text-[#9CA3AF]">
              <span className="font-bold text-white">{filteredCards.length}</span> sur {cards.length}
            </span>
          )}
        </div>
      </div>

      {vue === "tableau" ? (
        <PipelineTable
          cards={sortedCards}
          now={now}
          sortBy={sortBy}
          onSort={setSortBy}
          onRowClick={openSlideOver}
          isFreeDemoMode={isFreeDemoMode}
          onTease={teaseUpgrade}
          onSaveRelance={handleSaveRelanceDate}
          onSetGrade={handleSetGrade}
          onChangeEtape={handleChangeEtapeTableau}
          onSaveVisite={handleSaveVisiteTableau}
        />
      ) : (<>
      {/* Mobile tab bar */}
      <p className="lg:hidden text-[12px] text-[#6b7280] text-center">Appuie sur une carte pour changer son statut</p>
      <div className="lg:hidden overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1 min-w-max">
          {KANBAN_COLUMNS.map((col) => {
            const count = getCardsByStatus(sortedCards, col.id).length;
            const isActive = mobileTab === col.id;
            return (
              <button key={col.id} type="button" onClick={() => setMobileTab(col.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${isActive ? (col.phase === "commitment" ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "bg-[#6B7280]/10 text-[#9CA3AF] border border-[#6B7280]/20") : "text-[#6b7280] border border-transparent hover:text-[#9CA3AF]"}`}>
                {col.label} <span className={`text-[10px] font-black ${isActive ? "" : "text-[#4a4d56]"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile single column */}
      <div className="lg:hidden">
        {(() => {
          const col = KANBAN_COLUMNS.find((c) => c.id === mobileTab)!;
          const colCards = getCardsByStatus(sortedCards, col.id);
          return (
            <div className="space-y-2">
              {colCards.length === 0 ? (
                <div className="py-12 text-center"><p className="text-[13px] text-[#4a4d56]">Aucun athlète dans cette colonne</p></div>
              ) : colCards.map((card) => (
                <DraggableKanbanCard key={card.id} card={card} isDraggable={false} onClick={() => openSlideOver(card)} now={now} competitorMap={competitorMap} />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Desktop Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="hidden lg:flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn key={col.id} colDef={col} cards={getCardsByStatus(sortedCards, col.id)} activeCardStatus={activeCard?.status || null} onCardClick={openSlideOver} now={now} competitorMap={competitorMap} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard ? <DragOverlayCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>
      </>)}

      {/* Slide-Over */}
      {selectedCard && (
        <SlideOver
          key={selectedCard.id}
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onStatusChange={handleStatusChange}
          onSetGrade={handleSetGrade}
          onSaveVisit={handleSaveVisit}
          onSaveRelanceNote={handleSaveRelanceNote}
          isFreeDemoMode={isFreeDemoMode}
          onTeaseUpgrade={teaseUpgrade}
        />
      )}

      {/* Drop Confirmation Modal */}
      {pendingDrop && (
        <ConfirmModal
          title={dropIsRetire ? `Retirer ${dropCardName} ?` : `Déplacer vers ${dropLabel} ?`}
          message={dropIsRetire ? "Il ne sera plus dans ton suivi actif." : `${dropCardName} sera déplacé vers ${dropLabel}.`}
          confirmLabel={dropIsRetire ? "Retirer" : "Confirmer"}
          confirmColor={dropIsRetire ? "#EF4444" : RED}
          textarea={dropIsRetire ? { placeholder: "Raison du retrait (optionnel)", value: retireReason, onChange: setRetireReason } : undefined}
          onConfirm={confirmDrop}
          onCancel={cancelDrop}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
