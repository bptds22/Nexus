"use client";

/* ═══════════════════════════════════════════════════════════════
   TeamAddCoachSheet — mobile picker for adding a coach to a team.

   Loads users where school_id = team.schoolId minus ids already in
   team_coaches for this team. Surface : avatar w/ initials + name +
   role select (head_coach | assistant | coordinator). Tap → INSERT
   team_coaches → parent invalidates the detail cache.

   Mirrors TeamPickerSheet's bottom-sheet idiom (portal + drag
   handle + safe-area + dimmed backdrop). No DB mutation lives in
   the sheet — caller wires the onPicked → mutation.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { triggerHaptic } from "@/lib/haptics";

export interface CoachCandidate {
  id: string;
  name: string;
}

export interface TeamAddCoachSheetProps {
  open: boolean;
  onClose: () => void;
  schoolId: string | null;
  /** Coach ids already on the team — excluded from the candidate list. */
  excludeIds: string[];
  /** Called when the coach picks a candidate + a role. */
  onPicked: (coachId: string, role: "head_coach" | "assistant" | "coordinator") => void;
}

export function TeamAddCoachSheet({
  open, onClose, schoolId, excludeIds, onPicked,
}: TeamAddCoachSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [coaches, setCoaches] = useState<CoachCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"head_coach" | "assistant" | "coordinator">("assistant");
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setSearch(""); setDragOffset(0); setRole("assistant"); } }, [open]);

  useEffect(() => {
    if (!open || !schoolId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .eq("school_id", schoolId)
        .eq("role", "COACH");
      if (cancelled) return;
      const rows = (data || []) as { id: string; first_name?: string; last_name?: string }[];
      const excluded = new Set(excludeIds);
      const filtered = rows
        .filter((u) => !excluded.has(u.id))
        .map((u) => ({
          id: u.id,
          name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Coach",
        }));
      setCoaches(filtered);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schoolId, excludeIds.join(",")]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coaches;
    return coaches.filter((c) => c.name.toLowerCase().includes(q));
  }, [coaches, search]);

  if (!mounted || !open) return null;

  let touchStartY = 0;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70]"
        style={{
          background: `rgba(0,0,0,${Math.max(0.2, 0.6 - dragOffset / 300)})`,
          animation: "nx-modal-fade 200ms ease-out forwards",
        }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl flex flex-col"
        style={{
          maxHeight: "min(85vh, calc(100dvh - env(safe-area-inset-top, 0px)))",
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: `translateY(${dragOffset}px)`,
          transition: dragOffset === 0 ? "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab"
          onTouchStart={(e) => { touchStartY = e.touches[0].clientY; }}
          onTouchMove={(e) => {
            const dy = Math.max(0, e.touches[0].clientY - touchStartY);
            setDragOffset(dy);
          }}
          onTouchEnd={() => {
            if (dragOffset > 100) onClose();
            setDragOffset(0);
          }}
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-5 pb-3 shrink-0">
          <h2 className="font-head text-[17px] font-black text-white uppercase tracking-tight text-center">
            Ajouter un entraîneur
          </h2>
          <p className="text-[12px] text-[#9CA3AF] text-center mt-1">
            Choisis le rôle puis la personne dans ton école.
          </p>
        </div>

        {/* Role selector — 3 pills */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex gap-2">
            {[
              { v: "head_coach" as const, l: "Chef" },
              { v: "assistant" as const, l: "Assistant" },
              { v: "coordinator" as const, l: "Coordo" },
            ].map((o) => {
              const sel = role === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => { void triggerHaptic("Light"); setRole(o.v); }}
                  className={`flex-1 h-10 rounded-2xl text-[12px] font-bold uppercase tracking-wider transition-all ${
                    sel
                      ? "bg-[rgba(230,57,70,0.12)] border border-[#E63946] text-white"
                      : "bg-[#111317] border border-white/10 text-[#9CA3AF] active:bg-white/[0.04]"
                  }`}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 px-3 h-10 rounded-2xl bg-white/[0.06]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              inputMode="search"
              placeholder="Rechercher un entraîneur"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="space-y-2 pt-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[56px] rounded-2xl bg-[#111317] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <p className="text-[14px] font-bold text-white">
                {coaches.length === 0 ? "Aucun entraîneur disponible" : "Aucun résultat"}
              </p>
              <p className="text-[12px] text-white/55 mt-1 max-w-xs">
                {coaches.length === 0
                  ? "Tous les entraîneurs de l'école sont déjà sur l'équipe."
                  : "Essaie un autre nom."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((c) => {
                const initials = c.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { void triggerHaptic("Light"); onPicked(c.id, role); }}
                      className="w-full flex items-center gap-3 p-3 bg-[#111317] rounded-2xl active:bg-[#22262e] transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-bold text-[#9CA3AF]">{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-white truncate">{c.name}</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
