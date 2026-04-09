"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   NotesListsPanel — Recruiter notes + lists for an athlete
   Shown on the recruiter athlete profile page.
───────────────────────────────────────────────────────────────── */

const cardBase = "bg-[#1A1D24] rounded-xl border border-[#2D3748]";

interface NoteEntry {
  id: string;
  content: string;
  created_at: string;
}

interface ListEntry {
  id: string;
  name: string;
  created_at: string;
  memberCount: number;
}

export default function NotesListsPanel({ athleteId }: { athleteId: string }) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [noteText, setNoteText] = useState("");
  const [posting, setPosting] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [userName, setUserName] = useState({ initials: "", fullName: "" });

  const [lists, setLists] = useState<ListEntry[]>([]);
  const [allLists, setAllLists] = useState<{ id: string; name: string }[]>([]);
  const [listsOpen, setListsOpen] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [showListDropdown, setShowListDropdown] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Recruiter name
      const { data: userData } = await supabase.from("users").select("first_name, last_name").eq("id", user.id).single();
      if (userData) {
        setUserName({
          initials: `${(userData.first_name || "")[0] || ""}${(userData.last_name || "")[0] || ""}`.toUpperCase(),
          fullName: `${userData.first_name || ""} ${userData.last_name || ""}`.trim(),
        });
      }

      // Notes
      const { data: notesData } = await supabase
        .from("recruiter_notes")
        .select("id, content, created_at")
        .eq("recruiter_id", user.id)
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false });
      if (notesData) {
        setNotes(notesData);
        if (notesData.length > 0) setNotesOpen(true);
      }

      // Lists containing this athlete
      const { data: memberData } = await supabase
        .from("recruiter_list_members")
        .select("list_id")
        .eq("athlete_id", athleteId);

      if (memberData && memberData.length > 0) {
        const listIds = memberData.map((m) => m.list_id);
        const { data: listsData } = await supabase
          .from("recruiter_lists")
          .select("id, name, created_at")
          .in("id", listIds);

        if (listsData) {
          // Get member counts for each list
          const withCounts: ListEntry[] = await Promise.all(
            listsData.map(async (l) => {
              const { count } = await supabase
                .from("recruiter_list_members")
                .select("*", { count: "exact", head: true })
                .eq("list_id", l.id);
              return { ...l, memberCount: count ?? 0 };
            })
          );
          setLists(withCounts);
          if (withCounts.length > 0) setListsOpen(true);
        }
      }

      // All recruiter's lists (for add dropdown)
      const { data: allListsData } = await supabase
        .from("recruiter_lists")
        .select("id, name")
        .eq("recruiter_id", user.id)
        .order("name");
      if (allListsData) setAllLists(allListsData);
    }
    load();
  }, [athleteId]);

  /* ── Post note ── */
  async function handlePostNote() {
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
    if (data) {
      setNotes((prev) => [data, ...prev]);
      setNotesOpen(true);
    }
    setNoteText("");
    setPosting(false);
  }

  /* ── Delete note ── */
  async function handleDeleteNote(noteId: string) {
    const supabase = createClient();
    await supabase.from("recruiter_notes").delete().eq("id", noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  /* ── Add to list ── */
  async function handleAddToList(listId: string) {
    setAddingToList(true);
    const supabase = createClient();
    await supabase.from("recruiter_list_members").insert({ list_id: listId, athlete_id: athleteId });

    // Refresh lists
    const listInfo = allLists.find((l) => l.id === listId);
    if (listInfo) {
      const { count } = await supabase
        .from("recruiter_list_members")
        .select("*", { count: "exact", head: true })
        .eq("list_id", listId);
      setLists((prev) => [...prev, { id: listId, name: listInfo.name, created_at: new Date().toISOString(), memberCount: count ?? 1 }]);
    }
    setShowListDropdown(false);
    setAddingToList(false);
  }

  const availableLists = allLists.filter((l) => !lists.some((existing) => existing.id === l.id));

  return (
    <div className="space-y-5">
      {/* ── MES NOTES ── */}
      <div className={cardBase}>
        <button
          type="button"
          onClick={() => setNotesOpen(!notesOpen)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF]">Mes notes</span>
            {notes.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-[#E63946] text-[10px] font-black text-white">
                {notes.length}
              </span>
            )}
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${notesOpen ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {notesOpen && (
          <div className="px-5 pb-5 space-y-3">
            {/* Note input */}
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              placeholder="Ajouter une note..."
              className="w-full bg-[#111317] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePostNote(); } }}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handlePostNote}
                disabled={posting || !noteText.trim()}
                className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] disabled:bg-[#2D3748] disabled:text-[#4a4d56] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors"
              >
                {posting ? "..." : "Poster"}
              </button>
            </div>

            {/* Notes list */}
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                initials={userName.initials}
                fullName={userName.fullName}
                onDelete={handleDeleteNote}
              />
            ))}

            {notes.length === 0 && (
              <p className="text-[12px] text-[#4a4d56] italic">Aucune note pour cet athlète.</p>
            )}
          </div>
        )}
      </div>

      {/* ── DANS MES LISTES ── */}
      <div className={cardBase}>
        <button
          type="button"
          onClick={() => setListsOpen(!listsOpen)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF]">Dans mes listes</span>
            {lists.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-[#E63946] text-[10px] font-black text-white">
                {lists.length}
              </span>
            )}
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${listsOpen ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {listsOpen && (
          <div className="px-5 pb-5 space-y-3">
            {lists.map((list) => (
              <div key={list.id} className="bg-[#13151a] border border-[#2A2D35] rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                    <div>
                      <p className="text-[13px] font-bold text-white">{list.name}</p>
                      <p className="text-[11px] text-[#6b7280] mt-0.5">
                        {list.memberCount} athlète{list.memberCount !== 1 ? "s" : ""} · Créée le {new Date(list.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/recruteur/listes"
                    className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors whitespace-nowrap"
                  >
                    Voir la liste →
                  </Link>
                </div>
              </div>
            ))}

            {lists.length === 0 && (
              <p className="text-[12px] text-[#4a4d56] italic">Cet athlète n&apos;est dans aucune de vos listes.</p>
            )}

            {/* Add to list */}
            <div className="relative">
              {!showListDropdown ? (
                <button
                  type="button"
                  onClick={() => setShowListDropdown(true)}
                  disabled={availableLists.length === 0}
                  className="flex items-center gap-2 text-[12px] font-bold text-[#6b7280] hover:text-[#E63946] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Ajouter à une liste...
                </button>
              ) : (
                <div className="bg-[#111317] border border-[#2a2d36] rounded-lg p-2 space-y-1">
                  <div className="flex items-center justify-between px-2 pb-1.5 border-b border-[#2a2d36]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">Choisir une liste</span>
                    <button type="button" onClick={() => setShowListDropdown(false)} className="text-[#6b7280] hover:text-white transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                    </button>
                  </div>
                  {availableLists.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => handleAddToList(l.id)}
                      disabled={addingToList}
                      className="w-full text-left px-3 py-2 rounded-md text-[13px] text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {l.name}
                    </button>
                  ))}
                  {availableLists.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-[#4a4d56] italic">Aucune liste disponible.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Note card ── */

function NoteCard({ note, initials, fullName, onDelete }: { note: NoteEntry; initials: string; fullName: string; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const d = new Date(note.created_at);
  const dateStr = d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-[#13151a] border border-[#2A2D35] rounded-lg p-4 group">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#E63946] flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-white">{initials}</span>
          </div>
          <span className="text-[13px] font-bold text-white">{fullName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-[#6b7280]">Note · {dateStr} {timeStr}</span>
          {!confirming && (
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
          <button type="button" onClick={() => { onDelete(note.id); setConfirming(false); }} className="text-[11px] font-bold text-[#EF4444] hover:text-[#DC2626] transition-colors">Supprimer</button>
          <button type="button" onClick={() => setConfirming(false)} className="text-[11px] font-bold text-[#6b7280] hover:text-white transition-colors">Annuler</button>
        </div>
      )}
    </div>
  );
}
