"use client";

/* ═══════════════════════════════════════════════════════════════
   AddAthleteToListSheet — iter 7.24 Sprint 4b
   Sélecteur d'athlètes pour ajouter à la liste courante DEPUIS le
   détail de la liste. Réplique le flow desktop AddAthleteModal :
   source = FAVORIS du recruteur, recherche client, athlètes déjà
   membres masqués. Réutilise useFavoriteAthletes + useToggleListMember
   (garde anti-temp-id intégrée).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useFavoriteAthletes } from "@/lib/queries/recruiter/useFavoriteAthletes";
import { useToggleListMember } from "@/lib/queries/recruiter/useToggleListMember";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { triggerHaptic } from "@/lib/haptics";


export interface AddAthleteToListSheetProps {
  open: boolean;
  onClose: () => void;
  listId: string;
  listName: string | null;
  /** Set des athleteId déjà membres de la liste (calculé par DetailInner). */
  existingIds: Set<string>;
}

export function AddAthleteToListSheet({
  open, onClose, listId, listName, existingIds,
}: AddAthleteToListSheetProps) {
  const toast = useMobileToast();
  const { athletes: favorites = [], isLoading } = useFavoriteAthletes();
  const toggleMut = useToggleListMember();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  // Athlètes ajoutés pendant cette session de sheet (filtrés sans attendre
  // que le refetch de ["list-athletes"] arrive).
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  // In-flight pour montrer un état "Ajout..." par row.
  const [adding, setAdding] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) {
      setSearch(""); setJustAdded(new Set()); setAdding(new Set());
    }
  }, [open]);

  // Iter 7.25 FIX — useMemo DOIT être appelé AVANT l'early return (Rules of Hooks).
  // Avant ce fix : render 1 mounted=false → 9 hooks → return null ; render 2
  // mounted=true → 10 hooks (useMemo ajouté) → React throws "Rendered more hooks
  // than during the previous render" → écran noir qui couvre tout le DetailInner
  // parce que ce sheet est rendu en sibling permanent (open=false initialement).
  // Identique au crash thread iter 7.8d, leçon canon 14.x.
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return favorites.filter((a) => {
      if (existingIds.has(a.id) || justAdded.has(a.id)) return false;
      if (!q) return true;
      const name = `${a.firstName} ${a.lastName}`.toLowerCase();
      const sport = (a.sportName ?? "").toLowerCase();
      return name.includes(q) || sport.includes(q);
    });
  }, [favorites, existingIds, justAdded, debouncedSearch]);

  if (!mounted) return null;

  const handleAdd = async (athleteId: string, fullName: string) => {
    if (listId.startsWith("temp-")) {
      toast.info({ message: "Liste en cours de création…", detail: "Réessaie dans un instant." });
      return;
    }
    triggerHaptic("Light");
    setAdding((s) => { const n = new Set(s); n.add(athleteId); return n; });
    try {
      await toggleMut.mutateAsync({ listId, athleteId, isCurrentlyMember: false });
      setJustAdded((s) => { const n = new Set(s); n.add(athleteId); return n; });
      toast.success({
        message: `Ajouté à ${listName ?? "la liste"}`,
        detail: fullName,
      });
    } catch (e) {
      const err = e as { message?: string; code?: string };
      const detail = err.code ? `[${err.code}] ${err.message ?? ""}` : err.message;
      toast.error({ message: "Échec ajout", detail: detail || "Erreur inconnue." });
      // eslint-disable-next-line no-console
      console.error("[AddAthleteToListSheet add]", e);
    } finally {
      setAdding((s) => { const n = new Set(s); n.delete(athleteId); return n; });
    }
  };

  const hasNoFavorites = !isLoading && favorites.length === 0;
  const allAlreadyMembers = !isLoading && favorites.length > 0 && filtered.length === 0 && debouncedSearch.trim().length === 0;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[75] bg-[#111317] rounded-t-3xl flex flex-col"
            style={{ maxHeight: "92vh", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-3 flex items-center justify-between border-b border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full bg-white/[0.06] active:bg-white/[0.10] flex items-center justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
              <span className="text-[15px] font-bold text-white truncate px-3">
                {listName ? `Ajouter à « ${listName} »` : "Ajouter un athlète"}
              </span>
              <div className="w-9" />
            </div>

            {/* Search bar */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un favori…"
                  className="w-full bg-white/[0.06] rounded-xl pl-9 pr-9 py-2.5 text-[14px] text-white placeholder:text-white/40 outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Effacer"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/[0.10] flex items-center justify-center active:bg-white/[0.18]"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {isLoading ? (
                <div className="space-y-2 pt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-[#1A1D24] animate-pulse" />
                  ))}
                </div>
              ) : hasNoFavorites ? (
                <p className="text-[14px] text-white/55 italic text-center py-12">
                  Aucun favori pour le moment. Ajoute des athlètes à tes favoris d&apos;abord.
                </p>
              ) : allAlreadyMembers ? (
                <p className="text-[14px] text-white/55 italic text-center py-12">
                  Tous tes favoris sont déjà dans cette liste.
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-[14px] text-white/55 italic text-center py-12">
                  Aucun favori ne correspond à « {debouncedSearch} ».
                </p>
              ) : (
                <div className="space-y-2 pt-2">
                  {filtered.map((a) => {
                    // `a.fullName` est résolu par displayFullName() dans le
                    // hook. L'interpolation manuelle qui était ici rendait une
                    // chaîne VIDE sous identité réservée : le serveur ne
                    // projette ni first_name ni last_name dans ce cas.
                    const fullName = a.fullName;
                    const isAdding = adding.has(a.id);
                    return (
                      <div key={a.id} className="bg-[#1A1D24] rounded-xl px-3 py-2.5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
                          <AthletePhoto
                            photoUrl={a.photo}
                            firstName={a.firstName}
                            lastName={a.lastName}
                            identityVisible={a.identityVisible}
                            size={40}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[14px] font-bold text-white truncate">{fullName}</p>
                            {a.jersey && (
                              <span className="text-[12px] font-black text-[#E63946] flex-shrink-0">#{a.jersey}</span>
                            )}
                            {a.isVerified && (
                              <span className="flex-shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#3B82F6]">
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/55 truncate">
                            {a.position && <>{a.position} · </>}{a.school || a.sportName || "—"}
                          </p>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {Array.from({ length: 5 }, (_, i) => (
                              <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAdd(a.id, fullName)}
                          disabled={isAdding}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider flex-shrink-0 transition-colors ${
                            isAdding
                              ? "bg-white/[0.06] text-white/40"
                              : "border border-[#E63946] text-[#E63946] active:bg-[#E63946]/10"
                          }`}
                        >
                          {isAdding ? "..." : "Ajouter"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
