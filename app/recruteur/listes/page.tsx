"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { getStatusConfig } from "@/lib/config/recruitmentStatuses";
import { MOCK_LISTS, AVAILABLE_ATHLETES } from "./_data/mockListsData";
import type { ProspectList, ProspectListAthlete } from "./_data/mockListsData";

/* ═══════════════════════════════════════════════════════════════
   Mes Listes de Prospects — Organized folders for pipeline athletes
   Grid overview → expanded list view with athlete table
═══════════════════════════════════════════════════════════════ */

const GOLD = "#F59E0B";
const BLUE = "#3B82F6";

/* ── Toast ────────────────────────────────────────────────────── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-[fadeInUp_0.3s_ease-out]">
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        <span className="text-[13px] font-bold text-white">{message}</span>
        <button type="button" onClick={onDone} className="text-[#6b7280] hover:text-white ml-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ── Confirm Modal ────────────────────────────────────────────── */

function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-[modalIn_0.2s_ease-out]">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">{title}</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3 mt-5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 text-[13px] font-bold rounded-lg transition-colors text-white ${danger ? "bg-[#EF4444] hover:bg-[#DC2626]" : "bg-[#E63946] hover:bg-[#D42B22]"}`}
          >
            {confirmLabel || "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Stars (small read-only) ──────────────────────────────────── */

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < rating ? GOLD : "#374151"} stroke={i < rating ? "none" : GOLD} strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

/* ── Pipeline Status Badge (inline) ───────────────────────────── */

function StatusBadge({ status }: { status: RecruitmentStatus }) {
  if (status === "none") return null;
  const cfg = getStatusConfig(status);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase"
      style={{ backgroundColor: cfg.bgColor, borderWidth: 1, borderStyle: "solid", borderColor: cfg.borderColor, color: cfg.color }}
    >
      {cfg.shortLabel}
    </span>
  );
}

/* ── Sport breakdown pills ────────────────────────────────────── */

function SportBreakdown({ athletes }: { athletes: ProspectListAthlete[] }) {
  const breakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of athletes) m.set(a.sport, (m.get(a.sport) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [athletes]);

  return (
    <span className="text-[11px] text-[#6b7280]">
      {breakdown.map(([sport, count], i) => (
        <span key={sport}>
          {i > 0 && " · "}{sport} ×{count}
        </span>
      ))}
    </span>
  );
}

/* ── Relative time helper ─────────────────────────────────────── */

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "aujourd'hui";
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "il y a 1 jour";
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  return months === 1 ? "il y a 1 mois" : `il y a ${months} mois`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── 3-Dot Menu ───────────────────────────────────────────────── */

function ListMenu({
  onRename,
  onEditDesc,
  onShare,
  onExport,
  onDelete,
}: {
  onRename: () => void;
  onEditDesc: () => void;
  onShare: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const items = [
    { label: "Renommer", action: onRename },
    { label: "Modifier la description", action: onEditDesc },
    { label: "Partager", action: onShare },
    { label: "Exporter PDF", action: onExport },
    { label: "Supprimer", action: onDelete, danger: true },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[40]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-[50] w-52 bg-[#1A1D24] border border-[#2D3748] rounded-lg shadow-xl overflow-hidden">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); item.action(); }}
                className={`w-full text-left px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  item.danger
                    ? "text-[#EF4444] hover:bg-[#EF4444]/10"
                    : "text-[#9CA3AF] hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Create List Modal ────────────────────────────────────────── */

function CreateListModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim());
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-[modalIn_0.2s_ease-out]">
        <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight">Nouvelle liste</h3>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1.5">
              Nom de la liste <span className="text-[#E63946]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: QB prioritaires 2026"
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1.5">
              Description <span className="text-[#4a4d56]">(optionnel)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder="Décrivez l'objectif de cette liste..."
              rows={3}
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
            />
            <p className="text-[10px] text-[#4a4d56] mt-1 text-right">{description.length}/200</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] border border-[#2D3748] rounded-lg hover:text-white hover:border-[#4a4d56] transition-colors">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-bold rounded-lg transition-colors"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Athlete Modal ────────────────────────────────────────── */

function AddAthleteModal({
  listName,
  existingIds,
  onClose,
  onAdd,
}: {
  listName: string;
  existingIds: Set<string>;
  onClose: () => void;
  onAdd: (athlete: ProspectListAthlete, note: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  /* Unique schools from available athletes */
  const schools = useMemo(() => {
    const all = AVAILABLE_ATHLETES.filter((a) => !existingIds.has(a.id));
    const set = new Set(all.map((a) => a.school));
    return Array.from(set).sort();
  }, [existingIds]);

  const available = useMemo(() => {
    let list = AVAILABLE_ATHLETES.filter((a) => !existingIds.has(a.id));
    if (schoolFilter) list = list.filter((a) => a.school === schoolFilter);
    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.full_name.toLowerCase().includes(q) || a.sport.toLowerCase().includes(q));
    }
    return list;
  }, [search, schoolFilter, existingIds]);

  const handleAdd = (athlete: ProspectListAthlete) => {
    if (noteFor === athlete.id) {
      onAdd(athlete, noteText);
      setNoteFor(null);
      setNoteText("");
    } else {
      setNoteFor(athlete.id);
      setNoteText("");
    }
  };

  const handleConfirmAdd = (athlete: ProspectListAthlete) => {
    onAdd(athlete, noteText);
    setNoteFor(null);
    setNoteText("");
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl animate-[modalIn_0.2s_ease-out] max-h-[80vh] flex flex-col">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
          Ajouter à « {listName} »
        </h3>

        {/* Search */}
        <div className="relative mt-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un athlète..."
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-9 pr-4 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors"
            autoFocus
          />
        </div>

        {/* School filter */}
        {schools.length > 1 && (
          <select
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            aria-label="Filtrer par école"
            className={`mt-3 w-full bg-[#13151a] border rounded-lg px-3 py-2 text-[13px] outline-none transition-colors ${
              schoolFilter ? "border-[#E63946] text-[#E63946]" : "border-[#2a2d36] text-[#6b7280]"
            }`}
          >
            <option value="">Toutes les écoles</option>
            {schools.map((s) => (
              <option key={s} value={s}>{s.replace("É.S. ", "")}</option>
            ))}
          </select>
        )}

        {/* Athletes list */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-1 min-h-0">
          {available.length === 0 ? (
            <p className="text-[13px] text-[#4a4d56] text-center py-8">
              {search ? "Aucun athlète trouvé" : "Tous les favoris sont déjà dans cette liste"}
            </p>
          ) : (
            available.map((a) => (
              <div key={a.id} className="bg-[#13151a] rounded-lg border border-[#2a2d36] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#2F3440] border border-[#2D3748] flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-white/20">{a.full_name.split(" ").map((w) => w[0]).join("")}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{a.full_name}</p>
                      <p className="text-[11px] text-[#6b7280]">{a.sport} · {a.position} · {a.school}</p>
                    </div>
                  </div>
                  {noteFor === a.id ? (
                    <button
                      type="button"
                      onClick={() => handleConfirmAdd(a)}
                      className="px-3 py-1.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[11px] font-bold rounded-lg transition-colors shrink-0"
                    >
                      Confirmer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAdd(a)}
                      className="px-3 py-1.5 border border-[#E63946] text-[#E63946] text-[11px] font-bold rounded-lg hover:bg-[#E63946]/10 transition-colors shrink-0"
                    >
                      Ajouter
                    </button>
                  )}
                </div>
                {noteFor === a.id && (
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Note (optionnel)"
                    rows={2}
                    className="w-full mt-2 bg-[#111317] border border-[#2a2d36] rounded-lg px-3 py-2 text-[12px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
                    autoFocus
                  />
                )}
              </div>
            ))
          )}
        </div>

        <button type="button" onClick={onClose} className="mt-4 w-full px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] border border-[#2D3748] rounded-lg hover:text-white hover:border-[#4a4d56] transition-colors text-center">
          Fermer
        </button>
      </div>
    </div>
  );
}

/* ── List Card (Grid View) ────────────────────────────────────── */

function ListCard({
  list,
  onClick,
  onMenuAction,
}: {
  list: ProspectList;
  onClick: () => void;
  onMenuAction: (action: string) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 cursor-pointer hover:border-white/20 hover:shadow-[0_0_24px_rgba(230,57,70,0.08)] hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col"
    >
      {/* Top: name + menu */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight leading-tight flex-1 min-w-0 truncate">
          {list.name}
        </h3>
        <ListMenu
          onRename={() => onMenuAction("rename")}
          onEditDesc={() => onMenuAction("editDesc")}
          onShare={() => onMenuAction("share")}
          onExport={() => onMenuAction("export")}
          onDelete={() => onMenuAction("delete")}
        />
      </div>

      {/* Description */}
      <p className="text-[13px] text-[#9CA3AF] mt-1.5 line-clamp-1">{list.description}</p>

      {/* Athlete count */}
      <div className="flex items-center gap-1.5 mt-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        <span className="text-[13px] font-bold text-white">{list.athletes.length} athlète{list.athletes.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Sport breakdown */}
      <div className="mt-2">
        <SportBreakdown athletes={list.athletes} />
      </div>

      {/* Dates */}
      <div className="mt-auto pt-3 border-t border-[#2D3748]/30 mt-4 space-y-0.5">
        <p className="text-[11px] text-[#4a4d56]">Créée le {formatDate(list.created_at)}</p>
        <p className="text-[11px] text-[#4a4d56]">Modifiée {relativeTime(list.updated_at)}</p>
      </div>
    </div>
  );
}

/* ── Expanded List View ───────────────────────────────────────── */

function ExpandedListView({
  list,
  onBack,
  onRemoveAthlete,
  onAddAthlete,
  onEditNote,
  onToast,
}: {
  list: ProspectList;
  onBack: () => void;
  onRemoveAthlete: (listId: string, athleteId: string) => void;
  onAddAthlete: (listId: string, athlete: ProspectListAthlete) => void;
  onEditNote: (listId: string, athleteId: string, note: string) => void;
  onToast: (msg: string) => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const verifiedCount = list.athletes.filter((a) => a.is_verified).length;
  const avgRating = list.athletes.length > 0
    ? (list.athletes.reduce((s, a) => s + a.coach_rating, 0) / list.athletes.length).toFixed(1)
    : "0.0";

  const sportSummary = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of list.athletes) m.set(a.sport, (m.get(a.sport) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([s, c]) => `${c} ${s}`).join(", ");
  }, [list.athletes]);

  const existingIds = useMemo(() => new Set(list.athletes.map((a) => a.id)), [list.athletes]);

  const handleStartEditNote = (athleteId: string, currentNote: string) => {
    setEditingNote(athleteId);
    setEditNoteText(currentNote);
  };

  const handleSaveNote = (athleteId: string) => {
    onEditNote(list.id, athleteId, editNoteText);
    setEditingNote(null);
    onToast("Note sauvegardée (POC)");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} className="mt-1 w-9 h-9 rounded-lg bg-[#13151a] border border-[#2D3748] flex items-center justify-center text-[#6b7280] hover:text-white hover:border-[#4a4d56] transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">{list.name}</h1>
            <p className="text-[14px] text-[#9CA3AF] mt-1">{list.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#E63946] text-[#E63946] rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-[#E63946]/10 transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          Ajouter un athlète
        </button>
      </div>

      {/* Stats bar */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="text-[13px] font-bold text-white">{list.athletes.length} athlète{list.athletes.length !== 1 ? "s" : ""}</span>
        <span className="text-[#2D3748]">·</span>
        <span className="text-[13px] text-[#9CA3AF]">{verifiedCount} vérifié{verifiedCount !== 1 ? "s" : ""}</span>
        <span className="text-[#2D3748]">·</span>
        <span className="text-[13px] text-[#9CA3AF]">{sportSummary}</span>
        <span className="text-[#2D3748]">·</span>
        <span className="text-[13px] text-[#9CA3AF] flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill={GOLD} stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {avgRating} moyenne
        </span>
      </div>

      {/* Table */}
      {list.athletes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3 className="font-head text-lg font-black text-white uppercase tracking-wide mb-1">Liste vide</h3>
          <p className="text-[13px] text-[#9CA3AF] max-w-sm mb-4">Ajoutez des athlètes depuis vos favoris pour commencer.</p>
          <button type="button" onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-5 py-2.5 font-head font-bold text-[12px] uppercase tracking-widest hover:bg-[#D42B22] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            Ajouter un athlète
          </button>
        </div>
      ) : (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2D3748]">
                  {["Athlète", "Sport / Pos.", "École", "Div.", "Note coach", "Pipeline", "Ajouté le", "Note", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.athletes.map((a) => (
                  <tr key={a.id} className="border-b border-[#2D3748]/40 hover:bg-white/[0.02] transition-colors">
                    {/* Athlete */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/recruteur/athletes/${a.id}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors">
                          {a.full_name}
                        </Link>
                        {a.is_verified && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={BLUE} stroke="none">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6b7280] mt-0.5">{a.graduation_year}</p>
                    </td>
                    {/* Sport + position */}
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[#9CA3AF]">{a.sport}</span>
                      <span className="text-[#2D3748] mx-1">·</span>
                      <span className="text-[13px] font-bold text-[#9CA3AF] uppercase">{a.position}</span>
                    </td>
                    {/* School */}
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF] max-w-[160px] truncate">{a.school}</td>
                    {/* Division */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#2D3748]/50 text-[11px] font-bold text-[#9CA3AF]">{a.division}</span>
                    </td>
                    {/* Coach rating */}
                    <td className="px-4 py-3"><Stars rating={a.coach_rating} /></td>
                    {/* Pipeline */}
                    <td className="px-4 py-3"><StatusBadge status={a.pipeline_status} /></td>
                    {/* Added date */}
                    <td className="px-4 py-3 text-[12px] text-[#6b7280] whitespace-nowrap">{formatDate(a.added_at)}</td>
                    {/* Note */}
                    <td className="px-4 py-3 max-w-[200px]">
                      {editingNote === a.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editNoteText}
                            onChange={(e) => setEditNoteText(e.target.value)}
                            className="flex-1 bg-[#13151a] border border-[#2a2d36] rounded px-2 py-1 text-[12px] text-[#e0e0e0] focus:border-[#E63946] outline-none"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveNote(a.id); if (e.key === "Escape") setEditingNote(null); }}
                          />
                          <button type="button" onClick={() => handleSaveNote(a.id)} className="text-[#22C55E] hover:text-[#16A34A]">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEditNote(a.id, a.recruiter_note)}
                          className="text-[12px] text-[#6b7280] hover:text-[#9CA3AF] transition-colors truncate block max-w-full text-left"
                          title={a.recruiter_note || "Ajouter une note"}
                        >
                          {a.recruiter_note || <span className="italic text-[#4a4d56]">—</span>}
                        </button>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/recruteur/athletes/${a.id}`} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors" title="Voir le profil">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleStartEditNote(a.id, a.recruiter_note)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
                          title="Modifier la note"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(a.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-[#EF4444] hover:bg-[#EF4444]/5 transition-colors"
                          title="Retirer de la liste"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-[#2D3748]/40">
            {list.athletes.map((a) => (
              <div key={a.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/recruteur/athletes/${a.id}`} className="text-[15px] font-bold text-white hover:text-[#E63946] transition-colors">
                        {a.full_name}
                      </Link>
                      {a.is_verified && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={BLUE} stroke="none">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      )}
                    </div>
                    <p className="text-[12px] text-[#6b7280] mt-0.5">{a.sport} · {a.position} · {a.school}</p>
                  </div>
                  <StatusBadge status={a.pipeline_status} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[#6b7280]">{a.division}</span>
                  <span className="text-[11px] text-[#6b7280]">{a.graduation_year}</span>
                  <Stars rating={a.coach_rating} />
                </div>
                {a.recruiter_note && (
                  <p className="text-[12px] text-[#9CA3AF] italic">&ldquo;{a.recruiter_note}&rdquo;</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Link href={`/recruteur/athletes/${a.id}`} className="text-[11px] font-bold text-[#E63946]">Voir profil</Link>
                  <span className="text-[#2D3748]">·</span>
                  <button type="button" onClick={() => setRemoveTarget(a.id)} className="text-[11px] font-bold text-[#6b7280] hover:text-[#EF4444] transition-colors">Retirer</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Athlete Modal */}
      {showAddModal && (
        <AddAthleteModal
          listName={list.name}
          existingIds={existingIds}
          onClose={() => setShowAddModal(false)}
          onAdd={(athlete, note) => {
            onAddAthlete(list.id, { ...athlete, added_at: new Date().toISOString(), recruiter_note: note });
            onToast(`${athlete.full_name} ajouté à la liste (POC)`);
          }}
        />
      )}

      {/* Remove confirmation */}
      {removeTarget && (
        <ConfirmModal
          title="Retirer de la liste"
          message={`Retirer cet athlète de « ${list.name} » ? Il restera dans vos favoris.`}
          confirmLabel="Retirer"
          danger
          onConfirm={() => { onRemoveAthlete(list.id, removeTarget); setRemoveTarget(null); onToast("Athlète retiré de la liste (POC)"); }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────────────── */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-24 h-24 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </div>
      <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Aucune liste créée</h3>
      <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed mb-6">
        Organisez vos prospects en listes pour mieux planifier vos tournées de recrutement et suivre vos priorités.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-6 py-3 font-head font-bold text-[13px] uppercase tracking-widest transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 active:scale-95"
      >
        Créer ma première liste
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function ListesPage() {
  const [lists, setLists] = useState<ProspectList[]>(MOCK_LISTS);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selectedList = useMemo(() => lists.find((l) => l.id === selectedListId) || null, [lists, selectedListId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* Create list */
  const handleCreateList = useCallback((name: string, description: string) => {
    const newList: ProspectList = {
      id: `list-${Date.now()}`,
      name,
      description,
      athletes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLists((prev) => [newList, ...prev]);
    setShowCreateModal(false);
    setSelectedListId(newList.id);
    showToast("Liste créée (POC)");
  }, [showToast]);

  /* Delete list */
  const handleDeleteList = useCallback((listId: string) => {
    setLists((prev) => prev.filter((l) => l.id !== listId));
    if (selectedListId === listId) setSelectedListId(null);
    setDeleteTarget(null);
    showToast("Liste supprimée (POC)");
  }, [selectedListId, showToast]);

  /* Menu actions */
  const handleMenuAction = useCallback((listId: string, action: string) => {
    if (action === "delete") {
      setDeleteTarget(listId);
    } else if (action === "share") {
      showToast("Partage — Phase 2");
    } else {
      showToast("Action simulée — POC");
    }
  }, [showToast]);

  /* Remove athlete from list */
  const handleRemoveAthlete = useCallback((listId: string, athleteId: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId ? { ...l, athletes: l.athletes.filter((a) => a.id !== athleteId), updated_at: new Date().toISOString() } : l
      )
    );
  }, []);

  /* Add athlete to list */
  const handleAddAthlete = useCallback((listId: string, athlete: ProspectListAthlete) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId ? { ...l, athletes: [...l.athletes, athlete], updated_at: new Date().toISOString() } : l
      )
    );
  }, []);

  /* Edit note */
  const handleEditNote = useCallback((listId: string, athleteId: string, note: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, athletes: l.athletes.map((a) => (a.id === athleteId ? { ...a, recruiter_note: note } : a)), updated_at: new Date().toISOString() }
          : l
      )
    );
  }, []);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {selectedList ? (
        /* ── Expanded List View ─────────────────────────────── */
        <ExpandedListView
          list={selectedList}
          onBack={() => setSelectedListId(null)}
          onRemoveAthlete={handleRemoveAthlete}
          onAddAthlete={handleAddAthlete}
          onEditNote={handleEditNote}
          onToast={showToast}
        />
      ) : (
        /* ── Grid Overview ─────────────────────────────────── */
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                Mes listes de prospects
              </h1>
              <p className="text-[14px] text-[#9CA3AF] mt-1">
                Organisez vos prospects en listes personnalisées
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 border border-[#E63946] text-[#E63946] rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-[#E63946]/10 transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
              Créer une liste
            </button>
          </div>

          {lists.length === 0 ? (
            <EmptyState onCreate={() => setShowCreateModal(true)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {lists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  onClick={() => setSelectedListId(list.id)}
                  onMenuAction={(action) => handleMenuAction(list.id, action)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create List Modal */}
      {showCreateModal && (
        <CreateListModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateList}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmModal
          title="Supprimer cette liste"
          message="Cette action est irréversible. Les athlètes resteront dans vos favoris."
          confirmLabel="Supprimer"
          danger
          onConfirm={() => handleDeleteList(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
