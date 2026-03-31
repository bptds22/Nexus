"use client";

import { useState, useMemo, useCallback, memo, useEffect } from "react";
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
import { isValidMove, isBackwardException, isTerminalStatus } from "@/lib/config/recruitmentStatuses";
import StarRating from "@/components/ui/StarRating";
import {
  MOCK_KANBAN,
  KANBAN_COLUMNS,
  getCardsByStatus,
} from "./_data/mockKanbanData";
import type { PipelineKanbanCard } from "./_data/mockKanbanData";

/* ═══════════════════════════════════════════════════════════════
   Pipeline de Recrutement — Kanban Board with Drag-and-Drop
   2 AUTO (gray) + 4 MANUAL (red) + exit
   Forward-only movement EXCEPT en_discussion → contacté
═══════════════════════════════════════════════════════════════ */

const GRAY = "#6B7280";
const RED = "#E63946";
const BLUE = "#3B82F6";
const GREEN = "#22C55E";
const ORANGE = "#EAB308";

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
  title,
  message,
  confirmLabel,
  confirmColor,
  textarea,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  textarea?: { placeholder: string; value: string; onChange: (v: string) => void };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-[modalIn_0.2s_ease-out]">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">{title}</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">{message}</p>
        {textarea && (
          <textarea
            value={textarea.value}
            onChange={(e) => textarea.onChange(e.target.value)}
            placeholder={textarea.placeholder}
            rows={2}
            className="w-full mt-3 bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
          />
        )}
        <div className="flex items-center justify-end gap-3 mt-5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
            Annuler
          </button>
          <button type="button" onClick={onConfirm} className="px-5 py-2 text-white text-[13px] font-bold rounded-lg transition-colors" style={{ backgroundColor: confirmColor || RED }}>
            {confirmLabel || "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Stars: use shared StarRating component */

function completenessColor(pct: number): string {
  if (pct < 40) return "#EF4444";
  if (pct < 70) return GRAY;
  return BLUE;
}

function daysColor(days: number): string {
  if (days > 30) return "#EF4444";
  if (days > 14) return ORANGE;
  return "#6B7280";
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

/* ── Drag Handle Icon ─────────────────────────────────────────── */

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" />
    </svg>
  );
}

/* ── Column Header Icons ──────────────────────────────────────── */

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round">
      <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

/* ── Draggable Kanban Card ────────────────────────────────────── */

const DraggableKanbanCard = memo(function DraggableKanbanCard({
  card,
  columnColor,
  isCommitment,
  isDraggable,
  onClick,
}: {
  card: PipelineKanbanCard;
  columnColor: string;
  isCommitment: boolean;
  isDraggable: boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: card.id,
    data: { card, status: card.status },
    disabled: !isDraggable,
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative group transition-opacity duration-150 ${isDragging ? "opacity-30 scale-[0.97]" : ""}`}
    >
      {/* Drag handle — only visible on hover for draggable cards */}
      {isDraggable && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center text-[#4a4d56] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
        >
          <GripIcon />
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        className={`
          w-full text-left bg-[#1A1D24] rounded-lg p-3 border transition-all duration-200
          hover:shadow-[0_0_16px_rgba(0,0,0,0.3)] hover:-translate-y-0.5
          ${isDraggable ? "pl-7" : ""}
          ${isCommitment
            ? "border-l-[3px] border-l-[#E63946] border-t-[#2D3748] border-r-[#2D3748] border-b-[#2D3748] hover:border-[#E63946]/40"
            : "border-[#2D3748] hover:border-[#6B7280]/50"
          }
        `}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[14px] font-bold text-white truncate">{card.full_name}</span>
            {card.is_verified && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill={BLUE} stroke="none" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {card.has_video && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#E63946" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: columnColor === RED ? "rgba(230,57,70,0.25)" : "rgba(107,114,128,0.25)" }}>
            {card.sport}
          </span>
          <span className="text-[11px] text-[#9CA3AF]">{card.position}</span>
        </div>
        <p className="text-[11px] text-[#6b7280] mt-1 truncate">{card.school}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#2D3748]/50 text-[10px] font-bold text-[#9CA3AF]">{card.division}</span>
          <span className="text-[11px] text-[#6b7280]">{card.graduation_year}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <StarRating rating={card.coach_rating} size="sm" />
          <span className="text-[11px] font-bold" style={{ color: completenessColor(card.profile_completeness) }}>{card.profile_completeness}%</span>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: daysColor(card.days_in_status) }}>
          Depuis {card.days_in_status} jour{card.days_in_status > 1 ? "s" : ""}
        </p>
      </button>
    </div>
  );
});

/* ── Drag Overlay Card (simplified) ───────────────────────────── */

function DragOverlayCard({ card }: { card: PipelineKanbanCard }) {
  const col = KANBAN_COLUMNS.find((c) => c.id === card.status);
  return (
    <div className="bg-[#1A1D24] rounded-lg p-3 border border-[#E63946]/40 shadow-2xl w-[250px] opacity-90" style={{ transform: "scale(1.02)" }}>
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-bold text-white">{card.full_name}</span>
        {card.is_verified && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill={BLUE} stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: col?.color === RED ? "rgba(230,57,70,0.25)" : "rgba(107,114,128,0.25)" }}>
          {card.sport}
        </span>
        <span className="text-[11px] text-[#9CA3AF]">{card.position}</span>
        <span className="text-[11px] text-[#6b7280]">· {card.school}</span>
      </div>
    </div>
  );
}

/* ── Droppable Kanban Column ──────────────────────────────────── */

function KanbanColumn({
  colDef,
  cards,
  activeCardStatus,
  onCardClick,
}: {
  colDef: typeof KANBAN_COLUMNS[number];
  cards: PipelineKanbanCard[];
  activeCardStatus: RecruitmentStatus | null;
  onCardClick: (card: PipelineKanbanCard) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: colDef.id });
  const isExit = colDef.phase === "exit";
  const isCommitment = colDef.phase === "commitment";
  const isDraggable = !isTerminalStatus(colDef.id);

  // Determine if this column is a valid drop target for the currently dragged card
  const isValidTarget = activeCardStatus ? isValidMove(activeCardStatus, colDef.id) : false;
  const isBackward = activeCardStatus ? isBackwardException(activeCardStatus, colDef.id) : false;

  // Visual state for drop target
  const dropHighlight = isOver && isValidTarget;
  const dropBorderColor = dropHighlight
    ? isBackward ? ORANGE : isExit ? GRAY : GREEN
    : "transparent";

  // Header icon
  const HeaderIcon = colDef.isAuto ? LockIcon : isExit ? TrashIcon : ArrowIcon;
  const tooltip = colDef.isAuto
    ? colDef.id === "contacte" ? "Statut automatique, mais accepte un retour depuis En discussion" : "Statut automatique — favori"
    : isExit ? "Retirer du pipeline" : "Glisser un athlète ici";

  return (
    <div className={`flex flex-col min-w-[260px] max-w-[300px] ${isExit ? "opacity-60 ml-4" : ""}`}>
      {/* Column header */}
      <div
        className="bg-[#1A1D24] rounded-t-lg px-3.5 py-3 border-t-[3px] border-x border-b border-[#2D3748]"
        style={{ borderTopColor: colDef.color }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span title={tooltip}><HeaderIcon /></span>
            <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-white">{colDef.label}</span>
          </div>
          <span
            className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-black text-white"
            style={{ backgroundColor: colDef.color }}
          >
            {cards.length}
          </span>
        </div>
      </div>

      {/* Cards container (droppable) */}
      <div
        ref={setNodeRef}
        className={`flex-1 bg-[#111317] border-x border-b rounded-b-lg p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-340px)] transition-all duration-300 ease-out border-[#2D3748]`}
        style={{
          borderColor: dropHighlight ? `${dropBorderColor}30` : undefined,
          boxShadow: dropHighlight ? `inset 0 0 30px ${dropBorderColor}08, 0 0 12px ${dropBorderColor}15` : undefined,
          background: dropHighlight ? `linear-gradient(180deg, ${dropBorderColor}06 0%, #111317 40%)` : undefined,
        }}
      >
        {/* Drop hint text */}
        {dropHighlight && (
          <div className="text-center py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: `${dropBorderColor}90` }}>
              {isExit ? "Retirer" : isBackward ? "Retour" : "Déposer ici"}
            </span>
          </div>
        )}

        {cards.length === 0 && !dropHighlight ? (
          <div className="py-8 text-center">
            <p className="text-[11px] text-[#4a4d56]">Aucun athlète</p>
          </div>
        ) : (
          cards.map((card) => (
            <DraggableKanbanCard
              key={card.id}
              card={card}
              columnColor={colDef.color}
              isCommitment={isCommitment}
              isDraggable={isDraggable}
              onClick={() => onCardClick(card)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Slide-Over Panel ─────────────────────────────────────────── */

function SlideOver({
  card,
  onClose,
  onStatusChange,
  onSaveNotes,
}: {
  card: PipelineKanbanCard;
  onClose: () => void;
  onStatusChange: (cardId: string, newStatus: RecruitmentStatus) => void;
  onSaveNotes: (cardId: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState(card.notes);
  const [pendingStatus, setPendingStatus] = useState<RecruitmentStatus | null>(null);
  const [retireReason, setRetireReason] = useState("");

  const currentCol = KANBAN_COLUMNS.find((c) => c.id === card.status);

  const handleStatusClick = (status: RecruitmentStatus) => {
    if (status === card.status) return;
    if (!isValidMove(card.status, status)) return;
    // All manual moves need confirmation
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

  // Determine modal text based on move type
  const pendingIsBackward = pendingStatus ? isBackwardException(card.status, pendingStatus) : false;
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
          {/* Athlete Info */}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-head text-[20px] font-black text-white uppercase tracking-tight">{card.full_name}</h2>
              {card.is_verified && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill={BLUE} stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: currentCol?.phase === "commitment" ? "rgba(230,57,70,0.25)" : "rgba(107,114,128,0.25)" }}>
                {card.sport}
              </span>
              <span className="text-[13px] text-[#9CA3AF]">{card.position}</span>
              <span className="text-[#2D3748]">·</span>
              <span className="text-[13px] text-[#9CA3AF]">{card.division}</span>
            </div>
            <p className="text-[13px] text-[#6b7280] mt-1">{card.school}</p>
            <p className="text-[13px] text-[#6b7280]">Promotion {card.graduation_year}</p>
            <div className="flex items-center gap-2 mt-3">
              <StarRating rating={card.coach_rating} size="md" />
              <span className="text-[12px] text-[#6b7280]">Cote du coach</span>
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

          {/* Notes */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-2">Notes internes</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Ajoutez vos notes privées..." className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none" />
            <button type="button" onClick={() => onSaveNotes(card.id, notes)} className="mt-2 px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-lg transition-colors">
              Sauvegarder
            </button>
          </div>

          {/* Change Status — updated logic */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Changer le statut</h3>
            <div className="grid grid-cols-2 gap-2">
              {KANBAN_COLUMNS.map((col) => {
                const isActive = col.id === card.status;
                const canMove = isValidMove(card.status, col.id);
                const backward = isBackwardException(card.status, col.id);
                const isAutoCol = col.isAuto;
                const disabled = !canMove && !isActive;

                // Special: if current is en_discussion, contacté button is orange "Retour"
                if (backward) {
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => handleStatusClick(col.id)}
                      className="px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all bg-[#EAB308]/10 border-[#EAB308]/40 text-[#EAB308] hover:bg-[#EAB308]/20"
                    >
                      ↩ Retour à {col.label}
                    </button>
                  );
                }

                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => !disabled && handleStatusClick(col.id)}
                    disabled={disabled}
                    className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all ${
                      isActive
                        ? col.phase === "commitment"
                          ? "bg-[#E63946]/15 border-[#E63946] text-[#E63946]"
                          : "bg-[#6B7280]/15 border-[#6B7280] text-[#6B7280]"
                        : disabled
                          ? "bg-transparent border-[#2D3748] text-[#3a3d46] cursor-not-allowed"
                          : "bg-transparent border-[#2D3748] text-[#6b7280] hover:border-[#4a4d56] hover:text-[#9CA3AF]"
                    }`}
                    title={isAutoCol && disabled ? "Statut automatique" : undefined}
                  >
                    {isAutoCol && disabled && <span className="mr-1">🔒</span>}
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-[#2D3748]">
            <Link href={`/recruteur/athletes/${card.id}`} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#13151a] border border-[#2D3748] rounded-lg text-[13px] font-bold text-white hover:border-[#E63946]/40 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              Voir le profil complet
            </Link>
            <Link href={`/recruteur/messages/${card.id}`} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#13151a] border border-[#2D3748] rounded-lg text-[13px] font-bold text-white hover:border-[#E63946]/40 transition-colors">
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

      {/* Confirmation modal */}
      {pendingStatus && (
        <ConfirmModal
          title={
            pendingIsRetire ? `Retirer ${card.full_name} ?`
            : pendingIsBackward ? "Remettre à Contacté ?"
            : `Confirmer le passage à ${pendingLabel} ?`
          }
          message={
            pendingIsRetire ? "Il ne sera plus dans ton suivi actif."
            : pendingIsBackward ? "La conversation sera marquée comme inactive. Tu devras réengager la discussion avec le coach."
            : "Cette action indique un engagement concret dans le processus de recrutement."
          }
          confirmLabel={
            pendingIsRetire ? "Retirer"
            : pendingIsBackward ? "Confirmer le retour"
            : "Confirmer"
          }
          confirmColor={
            pendingIsRetire ? "#EF4444"
            : pendingIsBackward ? ORANGE
            : RED
          }
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

export default function PipelinePage() {
  const [cards, setCards] = useState<PipelineKanbanCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<PipelineKanbanCard | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<RecruitmentStatus>("identifie");

  // DnD state
  const [activeCard, setActiveCard] = useState<PipelineKanbanCard | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ cardId: string; from: RecruitmentStatus; to: RecruitmentStatus } | null>(null);
  const [retireReason, setRetireReason] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("pipeline")
        .select(`
          id,
          status,
          notes,
          favorited_at,
          contacted_at,
          created_at,
          updated_at,
          athletes!pipeline_athlete_id_fkey(
            id,
            first_name,
            last_name,
            verified,
            profile_completion,
            video_faits_saillants_url,
            annee_diplomation,
            numero_jersey,
            cote_globale_entraineur,
            sports!athletes_sport_id_fkey(nom),
            positions!athletes_position_id_fkey(nom, abreviation)
          )
        `)
        .eq("recruiter_id", user.id)
        .neq("status", "NONE")
        .then(({ data, error }) => {
          console.log("Pipeline loaded:", data?.length, error);
          if (!data) return;

          const mapped: PipelineKanbanCard[] = data.map((p: Record<string, unknown>) => {
            const a = p.athletes as {
              id: string;
              first_name: string;
              last_name: string;
              verified: boolean;
              profile_completion: number;
              video_faits_saillants_url: string | null;
              annee_diplomation: number | null;
              numero_jersey: string | null;
              cote_globale_entraineur: number | null;
              sports: { nom: string } | null;
              positions: { nom: string; abreviation: string } | null;
            } | null;

            const daysSince = p.updated_at
              ? Math.floor((Date.now() - new Date(p.updated_at as string).getTime()) / 86400000)
              : 0;

            return {
              id: a?.id || (p.id as string),
              full_name: a ? `${a.first_name} ${a.last_name}` : "Athlète inconnu",
              sport: a?.sports?.nom || "",
              position: a?.positions?.abreviation || "",
              school: "",
              region: "",
              division: "D1" as const,
              graduation_year: a?.annee_diplomation || 0,
              coach_rating: a?.cote_globale_entraineur || 0,
              profile_completeness: a?.profile_completion || 0,
              is_verified: a?.verified || false,
              has_video: !!a?.video_faits_saillants_url,
              status: (p.status as string).toLowerCase() as RecruitmentStatus,
              days_in_status: daysSince,
              notes: (p.notes as string) || "",
              last_activity: p.updated_at ? `Mis à jour il y a ${Math.floor((Date.now() - new Date(p.updated_at as string).getTime()) / 86400000)} jours` : "",
            };
          });
          setCards(mapped);
        });
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* Status change handler */
  const handleStatusChange = useCallback(async (cardId: string, newStatus: RecruitmentStatus) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("pipeline")
        .update({
          status: newStatus.toUpperCase(),
          updated_at: new Date().toISOString(),
        })
        .eq("athlete_id", cardId)
        .eq("recruiter_id", user.id);
    }
    setCards((prev) =>
      prev.map((c) => c.id === cardId ? { ...c, status: newStatus, days_in_status: 0 } : c)
    );
    setSelectedCard(null);
    const label = KANBAN_COLUMNS.find((col) => col.id === newStatus)?.label || newStatus;
    showToast(`Statut changé → ${label}`);
  }, [showToast]);

  const handleSaveNotes = useCallback((cardId: string, notes: string) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, notes } : c)));
    showToast("Notes sauvegardées (POC)");
  }, [showToast]);

  const openSlideOver = useCallback((card: PipelineKanbanCard) => {
    const fresh = cards.find((c) => c.id === card.id) || card;
    setSelectedCard(fresh);
  }, [cards]);

  /* ── DnD Handlers ───────────────────────────────────────────── */

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
    // Check if we dropped on a column (not another card)
    const isColumn = KANBAN_COLUMNS.some((c) => c.id === targetCol);
    if (!isColumn) return;

    if (card.status === targetCol) return;

    if (!isValidMove(card.status, targetCol)) {
      // Invalid move — show toast
      const targetIsAuto = KANBAN_COLUMNS.find((c) => c.id === targetCol)?.isAuto;
      if (targetIsAuto) {
        showToast("Ce statut est assigné automatiquement");
      } else {
        showToast("Le pipeline avance uniquement vers l'avant");
      }
      return;
    }

    // Valid move — show confirmation
    setPendingDrop({ cardId: card.id, from: card.status, to: targetCol });
  }, [showToast]);

  const confirmDrop = useCallback(() => {
    if (!pendingDrop) return;
    handleStatusChange(pendingDrop.cardId, pendingDrop.to);
    setPendingDrop(null);
    setRetireReason("");
  }, [pendingDrop, handleStatusChange]);

  const cancelDrop = useCallback(() => {
    setPendingDrop(null);
    setRetireReason("");
  }, []);

  // Drop modal text
  const dropIsBackward = pendingDrop ? isBackwardException(pendingDrop.from, pendingDrop.to) : false;
  const dropIsRetire = pendingDrop?.to === "retire";
  const dropLabel = pendingDrop ? KANBAN_COLUMNS.find((c) => c.id === pendingDrop.to)?.label : "";
  const dropCardName = pendingDrop ? cards.find((c) => c.id === pendingDrop.cardId)?.full_name : "";

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-[1600px] mx-auto space-y-5">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Pipeline de recrutement
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Saison 2025-2026 · Suivez vos prospects de l&apos;identification à la signature
        </p>
      </div>

      {/* ── Funnel Summary ───────────────────────────────────── */}
      <FunnelSummary cards={cards} />

      {/* ── Mobile: info + tab bar ───────────────────────────── */}
      <p className="lg:hidden text-[12px] text-[#6b7280] text-center">Appuie sur une carte pour changer son statut</p>
      <div className="lg:hidden overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1 min-w-max">
          {KANBAN_COLUMNS.map((col) => {
            const count = getCardsByStatus(cards, col.id).length;
            const isActive = mobileTab === col.id;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => setMobileTab(col.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                  isActive
                    ? col.phase === "commitment"
                      ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
                      : "bg-[#6B7280]/10 text-[#9CA3AF] border border-[#6B7280]/20"
                    : "text-[#6b7280] border border-transparent hover:text-[#9CA3AF]"
                }`}
              >
                {col.label}
                <span className={`text-[10px] font-black ${isActive ? "" : "text-[#4a4d56]"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mobile Single Column ─────────────────────────────── */}
      <div className="lg:hidden">
        {(() => {
          const col = KANBAN_COLUMNS.find((c) => c.id === mobileTab)!;
          const colCards = getCardsByStatus(cards, col.id);
          return (
            <div className="space-y-2">
              {colCards.length === 0 ? (
                <div className="py-12 text-center"><p className="text-[13px] text-[#4a4d56]">Aucun athlète dans cette colonne</p></div>
              ) : (
                colCards.map((card) => (
                  <DraggableKanbanCard
                    key={card.id}
                    card={card}
                    columnColor={col.color}
                    isCommitment={col.phase === "commitment"}
                    isDraggable={false}
                    onClick={() => openSlideOver(card)}
                  />
                ))
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Desktop Kanban Board (with DnD) ──────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="hidden lg:flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              colDef={col}
              cards={getCardsByStatus(cards, col.id)}
              activeCardStatus={activeCard?.status || null}
              onCardClick={openSlideOver}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard ? <DragOverlayCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      {/* ── Slide-Over ───────────────────────────────────────── */}
      {selectedCard && (
        <SlideOver
          key={selectedCard.id}
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onStatusChange={handleStatusChange}
          onSaveNotes={handleSaveNotes}
        />
      )}

      {/* ── Drop Confirmation Modal ──────────────────────────── */}
      {pendingDrop && (
        <ConfirmModal
          title={
            dropIsRetire ? `Retirer ${dropCardName} ?`
            : dropIsBackward ? "Remettre à Contacté ?"
            : `Confirmer le passage à ${dropLabel} ?`
          }
          message={
            dropIsRetire ? "Il ne sera plus dans ton suivi actif."
            : dropIsBackward ? "La conversation sera marquée comme inactive. Tu devras réengager la discussion avec le coach."
            : "Cette action indique un engagement concret dans le processus de recrutement."
          }
          confirmLabel={dropIsRetire ? "Retirer" : dropIsBackward ? "Confirmer le retour" : "Confirmer"}
          confirmColor={dropIsRetire ? "#EF4444" : dropIsBackward ? ORANGE : RED}
          textarea={dropIsRetire ? { placeholder: "Raison du retrait (optionnel)", value: retireReason, onChange: setRetireReason } : undefined}
          onConfirm={confirmDrop}
          onCancel={cancelDrop}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────── */}
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
