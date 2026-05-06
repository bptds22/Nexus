"use client";

import { useState, useMemo, useCallback, memo, useEffect } from "react";
import { useSubscription } from "@/lib/hooks/useSubscription";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
// Pipeline movement is now unrestricted — no validation imports needed
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import StarRating from "@/components/ui/StarRating";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import {
  KANBAN_COLUMNS,
  getCardsByStatus,
} from "./_data/mockKanbanData";
import type { PipelineKanbanCard } from "./_data/mockKanbanData";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
// MOCK_KANBAN no longer imported — all data from Supabase recruiter_pipeline

/* ═══════════════════════════════════════════════════════════════
   Pipeline de Recrutement — Kanban Board with Drag-and-Drop
   Tasks: Supabase fetch, staleness, card rings, next-action footer,
   inline edit, filter bar, flag toggle
═══════════════════════════════════════════════════════════════ */

const GRAY = "#6B7280";
const RED = "#E63946";
const BLUE = "#3B82F6";
const GREEN = "#22C55E";
const ORANGE = "#EAB308";

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

function isToday(dateStr: string | null, now: number): boolean {
  if (!dateStr || !now) return false;
  const d = new Date(dateStr);
  const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function isTomorrow(dateStr: string | null, now: number): boolean {
  if (!dateStr || !now) return false;
  const d = new Date(dateStr);
  const tom = new Date(now);
  tom.setDate(tom.getDate() + 1);
  return d.getFullYear() === tom.getFullYear() && d.getMonth() === tom.getMonth() && d.getDate() === tom.getDate();
}

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
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

/* ── Card ring color ─────────────────────────────────────────── */

function getCardRing(card: PipelineKanbanCard, now: number, competitorMap: Record<string, number>): { color: string | null; reason: string } {
  if (!now) return { color: null, reason: "" };
  const stale = isStale(card.status, card.moved_at, now);
  const compAhead = isCompetitorAhead(card.id, card.status, competitorMap);
  if (compAhead || stale) {
    return { color: RED, reason: compAhead ? "Un autre CÉGEP est plus avancé" : "Aucun mouvement récent" };
  }
  if (isToday(card.next_action_at, now) || isTomorrow(card.next_action_at, now)) {
    return { color: ORANGE, reason: "Action prévue prochainement" };
  }
  return { color: null, reason: "" };
}

/* ── Hook: stable client-side timestamp (0 on server, real after mount) */

function useClientNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    console.log("[Pipeline hydration] client mounted, dates initialized");
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

function FunnelSummary({ cards }: { cards: PipelineKanbanCard[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const col of KANBAN_COLUMNS) c[col.id] = 0;
    for (const card of cards) c[card.status] = (c[card.status] || 0) + 1;
    return c;
  }, [cards]);

  const total = cards.length;
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

/* ── TASK 5: Next Action Popover ─────────────────────────────── */

function NextActionPopover({
  card,
  onSave,
  onClose,
}: {
  card: PipelineKanbanCard;
  onSave: (id: string, fields: { flagged: boolean; next_action_at: string | null; next_action_note: string | null }) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(card.next_action_at?.slice(0, 10) || "");
  const [note, setNote] = useState(card.next_action_note || "");
  const [flagged, setFlagged] = useState(card.flagged);

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 w-full max-w-xs shadow-2xl animate-[modalIn_0.2s_ease-out]" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-[12px] font-bold uppercase tracking-[0.15em] text-white mb-4">Prochain suivi</h4>

        <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Date de suivi</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} placeholder="AAAA-MM-JJ" title="Date de suivi" className="w-full h-9 px-3 bg-[#13151a] border border-[#2a2d36] rounded-lg text-[13px] text-white focus:border-[#E63946] outline-none transition-colors mb-3" />

        <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Note</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: Appeler l'entraîneur..." className="w-full h-9 px-3 bg-[#13151a] border border-[#2a2d36] rounded-lg text-[13px] text-white placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors mb-3" />

        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <button
            type="button"
            onClick={() => setFlagged(!flagged)}
            className={`w-9 h-5 rounded-full transition-colors relative ${flagged ? "bg-[#E63946]" : "bg-[#2D3748]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${flagged ? "left-[18px]" : "left-0.5"}`} />
          </button>
          <span className="text-[12px] font-bold text-[#9CA3AF]">Marquer urgent</span>
        </label>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-9 text-[12px] font-bold text-[#6b7280] hover:text-white transition-colors">Annuler</button>
          <button
            type="button"
            onClick={() => onSave(card.pipeline_id, {
              flagged,
              next_action_at: date || null,
              next_action_note: note || null,
            })}
            className="flex-1 h-9 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-lg transition-colors"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Draggable Kanban Card (TASKS 3, 4, 7) ───────────────────── */

const DraggableKanbanCard = memo(function DraggableKanbanCard({
  card,
  isCommitment,
  isDraggable,
  onClick,
  onOpenAction,
  now,
  competitorMap,
}: {
  card: PipelineKanbanCard;
  isCommitment: boolean;
  isDraggable: boolean;
  onClick: () => void;
  onOpenAction: (card: PipelineKanbanCard) => void;
  now: number;
  competitorMap: Record<string, number>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card, status: card.status },
    disabled: !isDraggable,
  });

  const ring = getCardRing(card, now, competitorMap);
  const stale = isStale(card.status, card.moved_at, now);
  const staleDays = daysSince(card.moved_at, now);
  const compAhead = isCompetitorAhead(card.id, card.status, competitorMap);
  const hasAction = card.next_action_at || card.next_action_note;
  const actionToday = isToday(card.next_action_at, now);

  // Left border
  const borderLeft = ring.color ? `4px solid ${ring.color}` : isCommitment ? "3px solid #E63946" : "none";

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
        style={{ borderLeft }}
        aria-label={ring.reason || undefined}
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
            {card.flagged && <span className="w-2 h-2 rounded-full bg-[#E63946] shrink-0" title="Prioritaire" />}
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

          {/* Global recruitment status */}
          <div className="mt-1.5">
            <RecruitmentStatusBadge
              status={(card.recruitment_status || "OUVERT") as GlobalRecruitmentStatus}
              committedSchoolName={card.committed_school_name || undefined}
              openToOffers={card.open_to_offers}
              size="sm"
            />
          </div>
          {card.recruitment_status === 'RECRUTE' && ['identifie', 'contacte', 'en_discussion', 'visite_planifiee'].includes(card.status) && (
            <div className="mt-1.5 px-2 py-1 rounded bg-[#F59E0B]/10 border-l-2 border-[#F59E0B]">
              <span className="text-[10px] font-bold text-[#F59E0B]">⚠ Athlète recruté ailleurs</span>
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

          {/* Star rating */}
          <div className="mt-2">
            <StarRating rating={card.coach_rating} size="md" />
          </div>
        </div>

        {/* Footer: Next action / staleness */}
        {(hasAction || stale) && (
          <div className="px-3.5 pb-3 pt-2 border-t border-white/10" onClick={(e) => { e.stopPropagation(); onOpenAction(card); }}>
            {hasAction ? (
              <p className={`text-[11px] truncate ${actionToday ? "text-[#F59E0B]" : "text-[#6b7280]"}`}>
                {card.next_action_note && <>{card.next_action_note}</>}
                {card.next_action_at && <>{card.next_action_note ? " — " : ""}{formatDateFr(card.next_action_at)}</>}
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
  colDef, cards, activeCardStatus, onCardClick, onOpenAction, now, competitorMap,
}: {
  colDef: typeof KANBAN_COLUMNS[number];
  cards: PipelineKanbanCard[];
  activeCardStatus: RecruitmentStatus | null;
  onCardClick: (card: PipelineKanbanCard) => void;
  onOpenAction: (card: PipelineKanbanCard) => void;
  now: number;
  competitorMap: Record<string, number>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: colDef.id });
  const isExit = colDef.phase === "exit";
  const isCommitment = colDef.phase === "commitment";
  const isDraggable = true;
  const isValidTarget = activeCardStatus ? activeCardStatus !== colDef.id : false;
  const dropHighlight = isOver && isValidTarget;
  const dropBorderColor = dropHighlight ? (isExit ? GRAY : GREEN) : "transparent";
  const HeaderIcon = isExit ? TrashIcon : ArrowIcon;
  const tooltip = colDef.isAuto
    ? colDef.id === "contacte" ? "Statut automatique, mais accepte un retour depuis En discussion" : "Statut automatique — favori"
    : isExit ? "Retirer du pipeline" : "Glisser un athlète ici";

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
            <DraggableKanbanCard key={card.id} card={card} isCommitment={isCommitment} isDraggable={isDraggable} onClick={() => onCardClick(card)} onOpenAction={onOpenAction} now={now} competitorMap={competitorMap} />
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
  card, onClose, onStatusChange, onTogglePriority,
  isFreeDemoMode, onTeaseUpgrade,
}: {
  card: PipelineKanbanCard; onClose: () => void;
  onStatusChange: (cardId: string, newStatus: RecruitmentStatus) => void;
  onTogglePriority: (cardId: string, value: boolean) => void;
  isFreeDemoMode: boolean;
  onTeaseUpgrade: () => void;
}) {
  const [noteText, setNoteText] = useState("");
  const [noteHistory, setNoteHistory] = useState<NoteEntry[]>([]);
  const [posting, setPosting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<RecruitmentStatus | null>(null);
  const [retireReason, setRetireReason] = useState("");
  const currentCol = KANBAN_COLUMNS.find((c) => c.id === card.status);

  // Load note history from recruiter_notes
  useEffect(() => {
    async function loadNotes() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("recruiter_notes")
        .select("id, content, created_at")
        .eq("recruiter_id", user.id)
        .eq("athlete_id", card.id)
        .order("created_at", { ascending: false });
      if (data) setNoteHistory(data);
    }
    loadNotes();
  }, [card.id]);

  // Post a new note
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
    const { data, error } = await supabase
      .from("recruiter_notes")
      .insert({ recruiter_id: user.id, athlete_id: card.id, content: noteText.trim() })
      .select("id, content, created_at")
      .single();
    console.log("[Note posted]", { athlete: card.full_name, error });
    if (data) {
      setNoteHistory(prev => [data, ...prev]);
    }
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
            <div className="flex items-center gap-2 mt-3"><StarRating rating={card.coach_rating} size="md" /><span className="text-[12px] text-[#6b7280]">Cote du coach</span></div>
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
          {/* Priority toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Prioritaire</span>
            <button
              type="button"
              onClick={() => onTogglePriority(card.id, !card.flagged)}
              aria-label={card.flagged ? "Retirer la priorité" : "Marquer comme prioritaire"}
              className={`w-10 h-5 rounded-full transition-colors relative ${card.flagged ? "bg-[#E63946]" : "bg-[#2D3748]"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${card.flagged ? "left-[22px]" : "left-0.5"}`} />
            </button>
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
                Retirer du pipeline
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

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function Page() {
  return <PipelinePageContent />;
}

function PipelinePageContent() {
  const [cards, setCards] = useState<PipelineKanbanCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<PipelineKanbanCard | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<RecruitmentStatus>("identifie");
  const [activeCard, setActiveCard] = useState<PipelineKanbanCard | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ cardId: string; from: RecruitmentStatus; to: RecruitmentStatus } | null>(null);
  const [retireReason, setRetireReason] = useState("");
  const [actionPopover, setActionPopover] = useState<PipelineKanbanCard | null>(null);
  const [competitorMap, setCompetitorMap] = useState<Record<string, number>>({});
  const [sportFilter, setSportFilter] = useState("");
  const now = useClientNow();

  // Free users get a read-only "demo" experience: kanban renders
  // with their real pipeline data, drags revert on drop, save
  // actions show a tease toast instead of persisting.
  const { tier } = useSubscription();
  const isFreeDemoMode = tier === "free";

  /* ── Supabase fetch ──────────────────────────────────────── */

  useEffect(() => {
    async function fetchPipeline() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[Pipeline user ID]", user?.id);
      if (!user) return;

      const { data, error } = await supabase
        .from("recruiter_pipeline")
        .select(`
          id,
          recruiter_id,
          athlete_id,
          stage,
          notes,
          flagged,
          next_action_at,
          next_action_note,
          moved_at,
          created_at,
          updated_at,
          athletes!athlete_id(
            id,
            first_name,
            last_name,
            photo_url,
            verified,
            profile_completion,
            video_faits_saillants_url,
            annee_diplomation,
            numero_jersey,
            cote_globale_entraineur,
            recruitment_status,
            committed_school_id,
            school_id,
            league_team_id,
            open_to_offers,
            sports!sport_id(nom),
            positions!position_id(nom, abreviation),
            schools!school_id(name, region),
            committed_school:schools!committed_school_id(name)
          )
        `)
        .eq("recruiter_id", user.id)
        .order("moved_at", { ascending: false });

      console.log("[Pipeline fetch]", { count: data?.length, error });
      console.log('Pipeline athlete data:', data);
      console.log('Pipeline card data:', data?.[0]);
      if (data?.[0]) {
        const sample = data[0].athletes;
        const sAthl = Array.isArray(sample) ? sample[0] : sample;
        console.log("[Pipeline sample athlete]", { name: sAthl?.first_name, jersey: sAthl?.numero_jersey, type: typeof sAthl?.numero_jersey });
      }
      if (!data) return;

          const mapped: PipelineKanbanCard[] = data.map((p: Record<string, unknown>) => {
            const aRaw = p.athletes;
            const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as {
              id: string; first_name: string; last_name: string; photo_url: string | null; verified: boolean;
              profile_completion: number; video_faits_saillants_url: string | null;
              annee_diplomation: number | null; numero_jersey: string | null;
              cote_globale_entraineur: number | null;
              recruitment_status: string | null;
              committed_school_id: string | null;
              school_id: string | null;
              league_team_id: string | null;
              open_to_offers: boolean | null;
              sports: { nom: string } | { nom: string }[] | null;
              positions: { nom: string; abreviation: string } | { nom: string; abreviation: string }[] | null;
              schools: { name: string; region: string } | { name: string; region: string }[] | null;
              committed_school: { name: string } | { name: string }[] | null;
            } | null;

            const sportRel = a?.sports;
            const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
            const posRel = a?.positions;
            const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
            const schoolRel = a?.schools;
            const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string; region?: string } | null;
            const committedSchoolRel = a?.committed_school;
            const committedSchool = (Array.isArray(committedSchoolRel) ? committedSchoolRel[0] : committedSchoolRel) as { name?: string } | null;

            const movedAt = (p.moved_at as string) || (p.updated_at as string) || null;
            const daysSinceMove = movedAt ? Math.floor((Date.now() - new Date(movedAt).getTime()) / 86400000) : 0;
            const stageRaw = ((p.stage as string) || "IDENTIFIE").toLowerCase();

            return {
              id: a?.id || (p.athlete_id as string),
              pipeline_id: p.id as string,
              full_name: a ? `${a.first_name} ${a.last_name}` : "Athlète inconnu",
              photo_url: a?.photo_url || "",
              sport: sport?.nom || "",
              position: pos?.abreviation || "",
              school: school?.name || "",
              region: school?.region || "",
              division: "D1" as const,
              graduation_year: a?.annee_diplomation || 0,
              coach_rating: a?.cote_globale_entraineur || 0,
              profile_completeness: a?.profile_completion || 0,
              is_verified: a?.verified || false,
              has_video: !!a?.video_faits_saillants_url,
              jersey: a?.numero_jersey ? String(a.numero_jersey) : "",
              recruitment_status: (a?.recruitment_status as string) || "OUVERT",
              committed_school_name: committedSchool?.name || "",
              open_to_offers: (a?.open_to_offers as boolean | null) ?? null,
              status: stageRaw as RecruitmentStatus,
              days_in_status: daysSinceMove,
              notes: (p.notes as string) || "",
              last_activity: movedAt ? `Mis à jour il y a ${daysSinceMove} jours` : "",
              flagged: !!(p.flagged),
              next_action_at: (p.next_action_at as string) || null,
              next_action_note: (p.next_action_note as string) || null,
              moved_at: movedAt,
              noTeam: !a?.school_id && !a?.league_team_id,
            };
          });
          setCards(mapped);

          // Competitor stages query
          const athleteIds = mapped.map(c => c.id);
          if (athleteIds.length > 0) {
            const { data: competitorData } = await supabase
              .from("recruiter_pipeline")
              .select("athlete_id, stage")
              .in("athlete_id", athleteIds)
              .neq("recruiter_id", user.id)
              .neq("stage", "RETIRÉ");

            console.log("[Competitor stages]", competitorData);

            const cMap: Record<string, number> = {};
            if (competitorData) {
              for (const row of competitorData) {
                const order = STAGE_ORDER[row.stage.toLowerCase()] ?? 0;
                if (!cMap[row.athlete_id] || order > cMap[row.athlete_id]) {
                  cMap[row.athlete_id] = order;
                }
              }
            }
            setCompetitorMap(cMap);
          }
    }
    fetchPipeline();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const teaseUpgrade = useCallback(() => {
    showToast("Passe à Pro pour sauvegarder ton pipeline");
  }, [showToast]);

  /* ── Status change handler ─────────────────────────────────── */
  const handleStatusChange = useCallback(async (cardId: string, newStatus: RecruitmentStatus) => {
    if (isFreeDemoMode) {
      teaseUpgrade();
      setSelectedCard(null);
      return;
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("recruiter_pipeline")
        .update({ stage: newStatus.toUpperCase(), moved_at: now, updated_at: now })
        .eq("athlete_id", cardId)
        .eq("recruiter_id", user.id);
      console.log("[Pipeline PATCH]", { id: cardId, field: "stage", newValue: newStatus, error });

      // Re-fetch the athlete's global recruitment_status (trigger may have updated it)
      const { data: updatedAthlete } = await supabase
        .from("athletes")
        .select("recruitment_status")
        .eq("id", cardId)
        .single();
      if (updatedAthlete) {
        setCards((prev) => prev.map((c) => c.id === cardId
          ? { ...c, status: newStatus, days_in_status: 0, moved_at: new Date().toISOString(), recruitment_status: updatedAthlete.recruitment_status || "OUVERT" }
          : c
        ));
      } else {
        setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, status: newStatus, days_in_status: 0, moved_at: new Date().toISOString() } : c));
      }
    } else {
      setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, status: newStatus, days_in_status: 0, moved_at: new Date().toISOString() } : c));
    }
    setSelectedCard(null);
    showToast(`Statut changé → ${KANBAN_COLUMNS.find((col) => col.id === newStatus)?.label || newStatus}`);
  }, [showToast, isFreeDemoMode, teaseUpgrade]);

  const handleTogglePriority = useCallback(async (cardId: string, value: boolean) => {
    if (isFreeDemoMode) {
      teaseUpgrade();
      return;
    }
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, flagged: value } : c));
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from("recruiter_pipeline").update({ flagged: value }).eq("athlete_id", cardId).eq("recruiter_id", user.id);
      console.log("[Pipeline PATCH]", { id: cardId, field: "flagged", newValue: value, error });
    }
    showToast(value ? "Marqué prioritaire" : "Priorité retirée");
  }, [showToast, isFreeDemoMode, teaseUpgrade]);

  /* ── Save next action ───────────────────────────────────────── */
  const handleSaveAction = useCallback(async (pipelineId: string, fields: { flagged: boolean; next_action_at: string | null; next_action_note: string | null }) => {
    if (isFreeDemoMode) {
      teaseUpgrade();
      setActionPopover(null);
      return;
    }
    // Optimistic update
    setCards((prev) => prev.map((c) => c.pipeline_id === pipelineId ? { ...c, ...fields } : c));
    setActionPopover(null);
    const supabase = createClient();
    const { error } = await supabase.from("recruiter_pipeline").update(fields).eq("id", pipelineId);
    console.log("[Pipeline PATCH]", { id: pipelineId, field: "next_action", newValue: fields, error });
    showToast("Suivi mis à jour");
  }, [showToast, isFreeDemoMode, teaseUpgrade]);

  const openSlideOver = useCallback((card: PipelineKanbanCard) => {
    const fresh = cards.find((c) => c.id === card.id) || card;
    setSelectedCard(fresh);
  }, [cards]);

  const sports = useMemo(() => {
    const s = new Set(cards.map(c => c.sport).filter(Boolean));
    return Array.from(s).sort();
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (!sportFilter) return cards;
    return cards.filter(c => c.sport === sportFilter);
  }, [cards, sportFilter]);

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
      // Demo mode: visually move the card, then snap back with a
      // tease toast. No DB write, no confirm modal.
      const originalStatus = card.status;
      setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, status: targetCol } : c));
      setTimeout(() => {
        setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, status: originalStatus } : c));
        teaseUpgrade();
      }, 600);
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
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-[1600px] mx-auto space-y-5">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Mon processus de recrutement</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Saison 2025-2026 · Suivez vos prospects de l&apos;identification à la signature</p>
      </div>

      {isFreeDemoMode && (
        <div className="bg-[#1A1D24] border border-[#F59E0B]/20 rounded-lg px-5 py-3 flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-[13px] text-[#9CA3AF] flex-1">
            Tu visualises ton pipeline.{" "}
            <Link href="/tarifs" className="text-[#F59E0B] font-bold hover:underline">
              Passe à Pro
            </Link>{" "}
            pour sauvegarder tes mouvements et ajouter des notes.
          </p>
        </div>
      )}

      <FunnelSummary cards={cards} />

      {/* Sport filter */}
      {sports.length > 1 && (
        <div className="flex items-center gap-3">
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            aria-label="Filtrer par sport"
            className={`bg-[#13151a] border rounded-lg px-3 py-2 text-[13px] outline-none transition-colors ${sportFilter ? "border-[#E63946] text-[#E63946]" : "border-[#2a2d36] text-[#6b7280]"}`}
          >
            <option value="">Tous les sports</option>
            {sports.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {sportFilter && (
            <button type="button" onClick={() => setSportFilter("")} className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors">
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Mobile tab bar */}
      <p className="lg:hidden text-[12px] text-[#6b7280] text-center">Appuie sur une carte pour changer son statut</p>
      <div className="lg:hidden overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1 min-w-max">
          {KANBAN_COLUMNS.map((col) => {
            const count = getCardsByStatus(filteredCards, col.id).length;
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
          const colCards = getCardsByStatus(filteredCards, col.id);
          return (
            <div className="space-y-2">
              {colCards.length === 0 ? (
                <div className="py-12 text-center"><p className="text-[13px] text-[#4a4d56]">Aucun athlète dans cette colonne</p></div>
              ) : colCards.map((card) => (
                <DraggableKanbanCard key={card.id} card={card} isCommitment={col.phase === "commitment"} isDraggable={false} onClick={() => openSlideOver(card)} onOpenAction={setActionPopover} now={now} competitorMap={competitorMap} />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Desktop Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="hidden lg:flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn key={col.id} colDef={col} cards={getCardsByStatus(filteredCards, col.id)} activeCardStatus={activeCard?.status || null} onCardClick={openSlideOver} onOpenAction={setActionPopover} now={now} competitorMap={competitorMap} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard ? <DragOverlayCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Slide-Over */}
      {selectedCard && (
        <SlideOver
          key={selectedCard.id}
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onStatusChange={handleStatusChange}
          onTogglePriority={handleTogglePriority}
          isFreeDemoMode={isFreeDemoMode}
          onTeaseUpgrade={teaseUpgrade}
        />
      )}

      {/* TASK 5: Next action popover */}
      {actionPopover && (
        <NextActionPopover card={actionPopover} onSave={handleSaveAction} onClose={() => setActionPopover(null)} />
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
