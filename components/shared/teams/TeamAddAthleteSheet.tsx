"use client";

/* ═══════════════════════════════════════════════════════════════
   TeamAddAthleteSheet — mobile picker for adding an athlete to a
   team. Mirrors the desktop modal in
   app/coach/equipes/[teamId]/PageClient.tsx : pool = athletes whose
   school_id matches the team's school_id, minus athletes already on
   the team (via team_athletes). Caller wires the INSERT.

   Civil teams use the invitation flow → THIS sheet should not be
   surfaced for them. Parent gates by `team.isCivil`.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { triggerHaptic } from "@/lib/haptics";

export interface AthleteCandidate {
  id: string;
  /** First name kept separate so AthletePhoto can render the canonical
   *  photo + initials-fallback (parity with the /coach/athletes roster). */
  firstName: string;
  lastName: string;
  name: string;
  photoUrl: string;
  position: string;
}

export interface TeamAddAthleteSheetProps {
  open: boolean;
  onClose: () => void;
  schoolId: string | null;
  /** Athlete ids already on the team — excluded from the candidate list. */
  excludeIds: string[];
  /** Called when the coach picks a candidate. Le NOM accompagne l'id : quand
   *  l'ajout est refusé (athlète déjà ancré ailleurs), l'appelant doit pouvoir
   *  le nommer dans son message sans re-requêter — le candidat n'est par
   *  définition pas dans la liste des athlètes de l'équipe. */
  onPicked: (athleteId: string, athleteName: string) => void;
  /** Optional "create athlete" CTA — navigates to /coach/athletes/create. */
  onCreateNew?: () => void;
}

export function TeamAddAthleteSheet({
  open, onClose, schoolId, excludeIds, onPicked, onCreateNew,
}: TeamAddAthleteSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [list, setList] = useState<AthleteCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setSearch(""); setDragOffset(0); } }, [open]);

  useEffect(() => {
    if (!open || !schoolId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("athletes")
        .select("id, first_name, last_name, photo_url, positions!position_id(abreviation)")
        .eq("school_id", schoolId)
        .eq("status", "ACTIF");
      if (cancelled) return;
      const excluded = new Set(excludeIds);
      const mapped: AthleteCandidate[] = ((data || []) as Record<string, unknown>[])
        .filter((a) => !excluded.has(a.id as string))
        .map((a) => {
          const posRel = a.positions as { abreviation?: string } | { abreviation?: string }[] | null;
          const pos = Array.isArray(posRel) ? posRel[0] : posRel;
          const firstName = (a.first_name as string) || "";
          const lastName = (a.last_name as string) || "";
          return {
            id: a.id as string,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`.trim() || "Athlète",
            photoUrl: (a.photo_url as string | null) || "",
            position: pos?.abreviation || "",
          };
        });
      setList(mapped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schoolId, excludeIds.join(",")]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      a.name.toLowerCase().includes(q) || a.position.toLowerCase().includes(q),
    );
  }, [list, search]);

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
            Ajouter un athlète
          </h2>
          <p className="text-[12px] text-[#9CA3AF] text-center mt-1">
            Choisis un athlète de ton école pour l&apos;ajouter à l&apos;équipe.
          </p>
        </div>

        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 px-3 h-10 rounded-2xl bg-white/[0.06]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              inputMode="search"
              placeholder="Rechercher un athlète"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {loading ? (
            <div className="space-y-2 pt-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[56px] rounded-2xl bg-[#111317] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <p className="text-[14px] font-bold text-white">
                {list.length === 0 ? "Aucun athlète disponible" : "Aucun résultat"}
              </p>
              <p className="text-[12px] text-white/55 mt-1 max-w-xs">
                {list.length === 0
                  ? "Tous tes athlètes sont déjà sur l'équipe — ou tu n'as pas encore créé d'athlète."
                  : "Essaie un autre nom."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => { void triggerHaptic("Light"); onPicked(a.id, a.name); }}
                    className="w-full flex items-center gap-3 p-3 bg-[#111317] rounded-2xl active:bg-[#22262e] transition-colors text-left"
                  >
                    {/* Canonical photo (athletes.photo_url) + initials
                        fallback — mirrors the /coach/athletes roster
                        and the team-detail Athlètes row. */}
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                      <AthletePhoto
                        photoUrl={a.photoUrl}
                        firstName={a.firstName}
                        lastName={a.lastName}
                        size={40}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-white truncate">{a.name}</p>
                      {a.position && <p className="text-[12px] text-white/55 truncate">{a.position}</p>}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {onCreateNew && (
          <div className="px-4 pt-2 pb-3 shrink-0 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onCreateNew}
              className="w-full h-12 rounded-2xl bg-[#E63946] text-white text-[14px] font-bold uppercase tracking-wider active:bg-[#D42B22] transition-colors flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              Créer un nouvel athlète
            </button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
