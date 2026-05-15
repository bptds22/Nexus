"use client";

import FeatureGate from "@/components/subscription/FeatureGate";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import StarRating from "@/components/ui/StarRating";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import type { ProspectList, ProspectListAthlete } from "./_data/mockListsData";
import AthletePhoto from "@/components/shared/AthletePhoto";

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

/* Stars: use shared StarRating component */

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
  const [available, setAvailable] = useState<ProspectListAthlete[]>([]);
  const [loading, setLoading] = useState(true);

  // Load favorited athletes from Supabase
  useEffect(() => {
    async function loadFavs() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("recruiter_favorites")
        .select(`
          athlete_id,
          athletes!athlete_id(
            id, first_name, last_name, photo_url, verified, annee_diplomation,
            numero_jersey, cote_globale_entraineur,
            sports!sport_id(nom),
            positions!position_id(nom, abreviation),
            schools!school_id(name)
          )
        `)
        .eq("recruiter_id", user.id);

      if (data) {
        const mapped: ProspectListAthlete[] = data
          .map((f: Record<string, unknown>) => {
            const aRaw = f.athletes;
            const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as Record<string, unknown> | null;
            if (!a) return null;
            const sportRel = a.sports;
            const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
            const posRel = a.positions;
            const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
            const schoolRel = a.schools;
            const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string } | null;
            return {
              id: a.id as string,
              full_name: `${a.first_name} ${a.last_name}`,
              photo_url: (a.photo_url as string) || "",
              jersey: a.numero_jersey != null && a.numero_jersey !== "" ? String(a.numero_jersey) : "",
              sport: sport?.nom || "",
              position: pos?.abreviation || "",
              school: school?.name || "",
              division: "D1" as const,
              graduation_year: (a.annee_diplomation as number) || 0,
              coach_rating: (a.cote_globale_entraineur as number) || 0,
              is_verified: !!(a.verified),
              pipeline_status: "identifie" as RecruitmentStatus,
              added_at: "",
              recruiter_note: "",
              priority: false,
            };
          })
          .filter(Boolean) as ProspectListAthlete[];
        setAvailable(mapped.filter(a => !existingIds.has(a.id)));
      }
      setLoading(false);
    }
    loadFavs();
  }, [existingIds]);

  const filtered = useMemo(() => {
    if (search.trim().length < 2) return available;
    const q = search.toLowerCase();
    return available.filter(a => a.full_name.toLowerCase().includes(q) || a.sport.toLowerCase().includes(q));
  }, [search, available]);

  const handleAdd = (athlete: ProspectListAthlete) => {
    onAdd(athlete, "");
    setAvailable(prev => prev.filter(a => a.id !== athlete.id));
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

        {/* Athletes list */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-1 min-h-0">
          {loading ? (
            <p className="text-[13px] text-[#4a4d56] text-center py-8">Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-[#4a4d56] text-center py-8">
              {search ? "Aucun athlète trouvé" : "Tous les favoris sont déjà dans cette liste"}
            </p>
          ) : (
            filtered.map((a) => (
              <div key={a.id} className="bg-[#13151a] rounded-lg border border-[#2a2d36] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {(() => {
                      const [first, ...rest] = (a.full_name || "").split(/\s+/);
                      return (
                        <div className="relative w-8 h-8 shrink-0">
                          <AthletePhoto
                            photoUrl={a.photo_url}
                            firstName={first}
                            lastName={rest.join(" ")}
                            size={32}
                          />
                        </div>
                      );
                    })()}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-bold text-white truncate">{a.full_name}</p>
                        {a.jersey && <span className="text-[12px] font-black text-[#E63946]">#{a.jersey}</span>}
                      </div>
                      <p className="text-[11px] text-[#6b7280]">{a.position && <>{a.position} · </>}{a.school}</p>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={a.coach_rating >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(a)}
                    className="px-3 py-1.5 border border-[#E63946] text-[#E63946] text-[11px] font-bold rounded-lg hover:bg-[#E63946]/10 transition-colors shrink-0"
                  >
                    Ajouter
                  </button>
                </div>
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

/* ── Note entry for activity feed ─────────────────────────────── */
interface NoteEntry { id: string; content: string; created_at: string; }

function NoteCard({ note, initials, fullName, onDelete }: { note: NoteEntry; initials: string; fullName: string; onDelete?: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const d = new Date(note.created_at);
  const dateStr = d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="bg-[#13151a] border border-[#2A2D35] rounded-lg p-4 mb-3 relative group">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#E63946] flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-white">{initials}</span>
          </div>
          <span className="text-[13px] font-bold text-white">{fullName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-[#6b7280]">Note ajoutée · {dateStr} {timeStr}</span>
          {onDelete && !confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-6 h-6 flex items-center justify-center rounded text-[#6b7280] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Supprimer cette note"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>
      <p className="text-[13px] text-[#d1d5db] leading-relaxed whitespace-pre-wrap mt-2 ml-[42px]">{note.content}</p>
      {confirming && (
        <div className="flex items-center gap-2 mt-2 ml-[42px]">
          <span className="text-[11px] text-[#9CA3AF]">Supprimer cette note ?</span>
          <button type="button" onClick={() => { onDelete?.(note.id); setConfirming(false); }} className="text-[11px] font-bold text-[#EF4444] hover:text-[#DC2626] transition-colors">Supprimer</button>
          <button type="button" onClick={() => setConfirming(false)} className="text-[11px] font-bold text-[#6b7280] hover:text-white transition-colors">Annuler</button>
        </div>
      )}
    </div>
  );
}

function AthleteNotesPanel({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [noteText, setNoteText] = useState("");
  const [posting, setPosting] = useState(false);
  const [userName, setUserName] = useState({ initials: "", fullName: "" });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase.from("users").select("first_name, last_name").eq("id", user.id).single();
      if (userData) {
        setUserName({
          initials: `${(userData.first_name || "")[0] || ""}${(userData.last_name || "")[0] || ""}`.toUpperCase(),
          fullName: `${userData.first_name || ""} ${userData.last_name || ""}`.trim(),
        });
      }

      const { data } = await supabase
        .from("recruiter_notes")
        .select("id, content, created_at")
        .eq("recruiter_id", user.id)
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false });
      if (data) setNotes(data);
    }
    load();
  }, [athleteId]);

  const handlePost = async () => {
    if (!noteText.trim()) return;
    setPosting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return; }
    const { data } = await supabase
      .from("recruiter_notes")
      .insert({ recruiter_id: user.id, athlete_id: athleteId, content: noteText.trim() })
      .select("id, content, created_at")
      .single();
    if (data) setNotes(prev => [data, ...prev]);
    setNoteText("");
    setPosting(false);
  };

  return (
    <div className="px-5 py-4">
      <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Notes — {athleteName}</h4>
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        rows={2}
        placeholder="Ajouter une note..."
        className="w-full bg-[#111317] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
      />
      <div className="flex justify-end mt-2">
        <button type="button" onClick={handlePost} disabled={posting || !noteText.trim()} className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] disabled:bg-[#2D3748] disabled:text-[#4a4d56] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors">
          {posting ? "..." : "Poster"}
        </button>
      </div>
      {notes.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] font-bold text-white mb-3">Activités: {notes.length}</p>
          {notes.map(note => <NoteCard key={note.id} note={note} initials={userName.initials} fullName={userName.fullName} onDelete={async (id) => { const supabase = createClient(); await supabase.from("recruiter_notes").delete().eq("id", id); setNotes(prev => prev.filter(n => n.id !== id)); }} />)}
        </div>
      )}
      {notes.length === 0 && <p className="text-[12px] text-[#4a4d56] italic mt-3">Aucune note pour cet athlète.</p>}
    </div>
  );
}

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
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);

  // List-level notes
  const [listNotes, setListNotes] = useState<{ id: string; content: string; created_at: string }[]>([]);
  const [listNoteText, setListNoteText] = useState("");
  const [listNotePosting, setListNotePosting] = useState(false);
  const [listNotesOpen, setListNotesOpen] = useState(false);
  const [listUserName, setListUserName] = useState({ initials: "", fullName: "" });

  useEffect(() => {
    async function loadListNotes() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase.from("users").select("first_name, last_name").eq("id", user.id).single();
      if (userData) {
        setListUserName({
          initials: `${(userData.first_name || "")[0] || ""}${(userData.last_name || "")[0] || ""}`.toUpperCase(),
          fullName: `${userData.first_name || ""} ${userData.last_name || ""}`.trim(),
        });
      }

      const { data } = await supabase
        .from("recruiter_list_notes")
        .select("id, content, created_at")
        .eq("list_id", list.id)
        .eq("recruiter_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setListNotes(data);
        if (data.length > 0) setListNotesOpen(true);
      }
    }
    loadListNotes();
  }, [list.id]);

  const handlePostListNote = async () => {
    if (!listNoteText.trim()) return;
    setListNotePosting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setListNotePosting(false); return; }
    const { data } = await supabase
      .from("recruiter_list_notes")
      .insert({ list_id: list.id, recruiter_id: user.id, content: listNoteText.trim() })
      .select("id, content, created_at")
      .single();
    if (data) {
      setListNotes(prev => [data, ...prev]);
      setListNotesOpen(true);
    }
    setListNoteText("");
    setListNotePosting(false);
  };
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

      {/* Athletes */}
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
        <div className="flex flex-col gap-2">
          {list.athletes.map((a) => (
            <React.Fragment key={a.id}>
              <div className={`bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] transition-all duration-300 ease-out ${expandedNotes === a.id ? "border-[#E63946]/20" : ""}`}>
                <div className="flex items-center px-4 py-3 gap-3">
                  {/* Avatar + check */}
                  {(() => {
                    const [first, ...rest] = (a.full_name || "").split(/\s+/);
                    return (
                  <div className="relative w-10 h-10 shrink-0" style={{ overflow: "visible" }}>
                    <AthletePhoto
                      photoUrl={a.photo_url}
                      firstName={first}
                      lastName={rest.join(" ")}
                      size={40}
                    />
                    <div className="absolute -top-0.5 -right-0.5 z-10">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={a.is_verified ? "#3B82F6" : "#4a4d56"} stroke="none">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9 12l2 2 4-4" stroke={a.is_verified ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </div>
                  </div>
                    );
                  })()}

                  {/* Name + jersey + school — fixed width */}
                  <div className="w-[200px] shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/recruteur/athletes/${a.id}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate">
                        {a.full_name}
                      </Link>
                      {a.jersey && <span className="text-[13px] font-black text-[#E63946]">#{a.jersey}</span>}
                      {a.priority && <span className="w-2 h-2 rounded-full bg-[#E63946] shrink-0" title="Prioritaire" />}
                    </div>
                    <p className="text-[12px] text-[#6b7280] truncate">{a.school} · {a.graduation_year}</p>
                  </div>

                  {/* Position pill — fixed width */}
                  <div className="w-[50px] shrink-0">
                    {a.position ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">{a.position}</span>
                    ) : <span />}
                  </div>

                  {/* Recruitment status — fixed width */}
                  <div className="w-[140px] shrink-0">
                    <RecruitmentStatusBadge status={(a.pipeline_status || "ouvert").toUpperCase() as GlobalRecruitmentStatus} size="sm" />
                  </div>

                  {/* Stars — fixed width */}
                  <div className="w-[120px] shrink-0">
                    <StarRating rating={a.coach_rating} size="sm" />
                  </div>

                  {/* Added date — fixed width */}
                  <div className="w-[90px] shrink-0">
                    <span className="text-[12px] text-[#6b7280] whitespace-nowrap">{a.added_at ? formatDate(a.added_at) : ""}</span>
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Notes + Actions */}
                  <button type="button" onClick={() => setExpandedNotes(expandedNotes === a.id ? null : a.id)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shrink-0 ${expandedNotes === a.id ? "bg-[#E63946]/15 text-[#E63946]" : "text-[#6b7280] hover:text-white hover:bg-white/5"}`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                    Notes
                  </button>
                  <Link href={`/recruteur/athletes/${a.id}`} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors shrink-0" title="Voir le profil">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  </Link>
                  <button type="button" onClick={() => setRemoveTarget(a.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-[#EF4444] hover:bg-[#EF4444]/5 transition-colors shrink-0" title="Retirer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Expandable notes panel */}
                {expandedNotes === a.id && (
                  <div className="border-t border-[#2D3748]">
                    <AthleteNotesPanel athleteId={a.id} athleteName={a.full_name} />
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* List-level notes — at bottom */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
        <button type="button" onClick={() => setListNotesOpen(!listNotesOpen)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Notes de liste</span>
            {listNotes.length > 0 && <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-[#E63946] text-[10px] font-black text-white">{listNotes.length}</span>}
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${listNotesOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {listNotesOpen && (
          <div className="px-5 pb-5 border-t border-[#2D3748]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mt-4 mb-2">Notes</p>
            <textarea value={listNoteText} onChange={(e) => setListNoteText(e.target.value)} rows={2} placeholder="Ajouter une note à cette liste..." className="w-full bg-[#111317] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePostListNote(); } }} />
            <div className="flex justify-end mt-2">
              <button type="button" onClick={handlePostListNote} disabled={listNotePosting || !listNoteText.trim()} className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] disabled:bg-[#2D3748] disabled:text-[#4a4d56] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors">{listNotePosting ? "..." : "Poster"}</button>
            </div>
            {listNotes.length > 0 && (
              <div className="mt-4">
                <p className="text-[13px] font-bold text-white mb-3">Activités: {listNotes.length}</p>
                {listNotes.map(note => <NoteCard key={note.id} note={note} initials={listUserName.initials} fullName={listUserName.fullName} onDelete={async (id) => { const supabase = createClient(); await supabase.from("recruiter_list_notes").delete().eq("id", id); setListNotes(prev => prev.filter(n => n.id !== id)); }} />)}
              </div>
            )}
            {listNotes.length === 0 && <p className="text-[12px] text-[#4a4d56] italic mt-3">Aucune note pour cette liste.</p>}
          </div>
        )}
      </div>

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

export default function Page() {
  return (
    <FeatureGate feature="custom_lists" requiredTier="pro">
      <ListesPageContent />
    </FeatureGate>
  );
}

function ListesPageContent() {
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedList = useMemo(() => lists.find((l) => l.id === selectedListId) || null, [lists, selectedListId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Load lists from Supabase ─────────────────────────────── */
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // 1. Fetch lists
      const { data: listsData, error: listsErr } = await supabase
        .from("recruiter_lists")
        .select("id, name, description, created_at, updated_at")
        .eq("recruiter_id", user.id)
        .order("updated_at", { ascending: false });

      if (!listsData) { setLoading(false); return; }

      // 2. Fetch all list-athlete links
      const listIds = listsData.map(l => l.id);
      let athleteLinks: { list_id: string; athlete_id: string; added_at: string }[] = [];
      if (listIds.length > 0) {
        const { data: linksData, error: linksErr } = await supabase
          .from("recruiter_list_members")
          .select("list_id, athlete_id, added_at")
          .in("list_id", listIds);
        athleteLinks = linksData || [];
      }

      // 3. Fetch athlete details for all linked athletes
      const athleteIds = [...new Set(athleteLinks.map(l => l.athlete_id))];
      let athleteMap = new Map<string, ProspectListAthlete>();
      if (athleteIds.length > 0) {
        const { data: athData } = await supabase
          .from("athletes")
          .select(`
            id, first_name, last_name, photo_url, verified, annee_diplomation,
            numero_jersey, cote_globale_entraineur,
            recruitment_status,
            sports!sport_id(nom),
            positions!position_id(nom, abreviation),
            schools!school_id(name, region)
          `)
          .in("id", athleteIds);

        if (athData) {
          for (const a of athData as Record<string, unknown>[]) {
            const sportRel = a.sports;
            const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
            const posRel = a.positions;
            const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
            const schoolRel = a.schools;
            const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string } | null;

            athleteMap.set(a.id as string, {
              id: a.id as string,
              full_name: `${a.first_name} ${a.last_name}`,
              photo_url: (a.photo_url as string) || "",
              jersey: a.numero_jersey != null && a.numero_jersey !== "" ? String(a.numero_jersey) : "",
              sport: sport?.nom || "",
              position: pos?.abreviation || "",
              school: school?.name || "",
              division: "D1",
              graduation_year: (a.annee_diplomation as number) || 0,
              coach_rating: (a.cote_globale_entraineur as number) || 0,
              is_verified: !!(a.verified),
              pipeline_status: ((a.recruitment_status as string) || "OUVERT").toLowerCase() as RecruitmentStatus,
              added_at: "",
              recruiter_note: "",
              priority: false,
            });
          }
        }
      }

      // 4. Assemble lists
      const assembled: ProspectList[] = listsData.map(l => ({
        id: l.id,
        name: l.name,
        description: l.description || "",
        created_at: l.created_at,
        updated_at: l.updated_at,
        athletes: athleteLinks
          .filter(link => link.list_id === l.id)
          .map(link => {
            const base = athleteMap.get(link.athlete_id);
            if (!base) return null;
            return { ...base, added_at: link.added_at, priority: false };
          })
          .filter(Boolean) as ProspectListAthlete[],
      }));

      setLists(assembled);
      setLoading(false);
    }
    load();
  }, []);

  /* Create list */
  const handleCreateList = useCallback(async (name: string, description: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("recruiter_lists")
      .insert({ recruiter_id: user.id, name, description })
      .select("id, name, description, created_at, updated_at")
      .single();

    if (data) {
      const newList: ProspectList = { ...data, description: data.description || "", athletes: [] };
      setLists(prev => [newList, ...prev]);
      setSelectedListId(data.id);
    }
    setShowCreateModal(false);
    showToast("Liste créée");
  }, [showToast]);

  /* Delete list */
  const handleDeleteList = useCallback(async (listId: string) => {
    const supabase = createClient();
    await supabase.from("recruiter_lists").delete().eq("id", listId);
    setLists(prev => prev.filter(l => l.id !== listId));
    if (selectedListId === listId) setSelectedListId(null);
    setDeleteTarget(null);
    showToast("Liste supprimée");
  }, [selectedListId, showToast]);

  /* Menu actions */
  const handleMenuAction = useCallback((listId: string, action: string) => {
    if (action === "delete") {
      setDeleteTarget(listId);
    } else if (action === "share") {
      showToast("Partage — Phase 2");
    } else {
      showToast("À venir");
    }
  }, [showToast]);

  /* Remove athlete from list */
  const handleRemoveAthlete = useCallback(async (listId: string, athleteId: string) => {
    const supabase = createClient();
    await supabase.from("recruiter_list_members").delete().eq("list_id", listId).eq("athlete_id", athleteId);
    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, athletes: l.athletes.filter(a => a.id !== athleteId) } : l
    ));
  }, []);

  /* Add athlete to list */
  const handleAddAthlete = useCallback(async (listId: string, athlete: ProspectListAthlete) => {
    const supabase = createClient();
    await supabase.from("recruiter_list_members").insert({ list_id: listId, athlete_id: athlete.id });
    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, athletes: [...l.athletes, { ...athlete, added_at: new Date().toISOString() }] } : l
    ));
  }, []);

  /* Edit note — uses recruiter_notes table via insert */
  const handleEditNote = useCallback((_listId: string, _athleteId: string, _note: string) => {
    // Notes are now handled by the activity feed in ExpandedListView
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
