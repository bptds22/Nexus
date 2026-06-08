"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurMessagesMobile — Liste de conversations (iter 7.8a)
   Feel iOS Messages : large title "Messages", Edit top-left, filtre
   top-right, search bar sticky, items denses avec athlète en vedette
   + coach en sous-titre, dot non-lu, swipe-to-archive, mode Edit
   multi-sélection, filtre bottom sheet (Tous / Non lu / Archivé).

   Gating Free : liste floutée + compte de threads net + tease upgrade.

   Référence design : docs/mobile-design-system.md.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { useConversations, type ThreadData } from "@/lib/queries/recruiter/useConversations";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { createClient } from "@/lib/supabase/client";
import { EmptyState as SharedEmptyState } from "@/components/mobile/EmptyState";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

function relativeTime(isoStr: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) {
    const dayNames = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
    return dayNames[d.getDay()];
  }
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

/* ── useArchiveConversation (mutation TanStack inline + optimistic) ── */

function useArchiveConversation() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const queryKey = ["conversations", userId];

  return useMutation({
    mutationFn: async ({ conversationId, newStatus }: { conversationId: string; newStatus: "ACTIVE" | "ARCHIVE" }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("conversations")
        .update({ status: newStatus })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onMutate: async ({ conversationId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ThreadData[]>(queryKey);
      queryClient.setQueryData<ThreadData[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((t) => (t.id === conversationId ? { ...t, status: newStatus } : t));
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/* ── FilterSheet ──────────────────────────────────────────────── */

type FilterKey = "tous" | "non_lu" | "archive";

const FILTER_OPTIONS: { value: FilterKey; label: string }[] = [
  { value: "tous",    label: "Tous" },
  { value: "non_lu",  label: "Non lu" },
  { value: "archive", label: "Archivé" },
];

function FilterSheet({
  open, onClose, value, onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: FilterKey;
  onChange: (v: FilterKey) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setDragOffset(0); setIsDragging(false); } }, [open]);

  if (!mounted) return null;
  const closeSheet = () => { triggerHaptic("Light"); onClose(); };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/60"
            onClick={closeSheet}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: dragOffset }}
            exit={{ y: "100%" }}
            transition={isDragging ? { duration: 0 } : { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-[#111317] rounded-t-2xl flex flex-col"
            style={{ maxHeight: "60vh", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div
              onTouchStart={(e) => { setIsDragging(true); dragStartYRef.current = e.touches[0].clientY; }}
              onTouchMove={(e) => {
                if (dragStartYRef.current === 0) return;
                const dy = Math.max(0, e.touches[0].clientY - dragStartYRef.current);
                setDragOffset(dy);
              }}
              onTouchEnd={() => {
                if (dragOffset > 100) closeSheet();
                else setDragOffset(0);
                setIsDragging(false); dragStartYRef.current = 0;
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              <div className="flex justify-center pt-3 pb-3">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
            </div>
            <h2 className="px-5 pb-3 text-[12px] uppercase tracking-[0.18em] text-white/50 font-bold">
              Filtrer
            </h2>
            <div className="mx-4 mb-4 bg-[#1A1D24] rounded-2xl overflow-hidden">
              {FILTER_OPTIONS.map((opt) => {
                const active = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { triggerHaptic("Light"); onChange(opt.value); closeSheet(); }}
                    className="flex items-center justify-between w-full px-4 py-3.5 border-b border-white/[0.06] last:border-b-0 text-left active:bg-white/[0.03]"
                  >
                    <span className="text-[15px] text-white/95 font-medium">{opt.label}</span>
                    {active && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── ThreadItem (avec swipe-to-archive) ──────────────────────── */

const SWIPE_THRESHOLD = 100;

function ThreadItem({
  thread, index, isLast, isEdit, selected, onTap, onToggleSelect, onCommitArchive,
}: {
  thread: ThreadData;
  index: number;
  isLast: boolean;
  isEdit: boolean;
  selected: boolean;
  onTap: () => void;
  onToggleSelect: () => void;
  onCommitArchive: () => void;
}) {
  const x = useMotionValue(0);
  const archiveOpacity = useTransform(x, [-SWIPE_THRESHOLD, -40, 0], [1, 0.4, 0]);
  const unread = thread.unreadCount > 0;
  const isArchived = thread.status === "ARCHIVE";

  return (
    <div className="relative">
      {/* Action archive révélée par swipe gauche (gris non-destructif) */}
      <motion.div
        style={{ opacity: archiveOpacity }}
        className="absolute inset-0 flex items-center justify-end pr-5 pointer-events-none bg-[#6B7280]/20"
      >
        <div className="flex flex-col items-center text-[#9CA3AF]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
          <span className="text-[10px] uppercase tracking-wider font-bold mt-1">
            {isArchived ? "Réactiver" : "Archiver"}
          </span>
        </div>
      </motion.div>

      <motion.div
        drag={isEdit ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -SWIPE_THRESHOLD) {
            onCommitArchive();
          }
        }}
        className="relative bg-[#111317] z-[1]"
      >
        <button
          type="button"
          onClick={isEdit ? onToggleSelect : onTap}
          className="w-full flex items-center gap-3 pl-4 pr-4 py-3 active:bg-white/[0.03] transition-colors text-left"
        >
          {/* Cercle de sélection (mode Edit) */}
          {isEdit && (
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? "bg-[#E63946] border-[#E63946]" : "border-white/40"}`}
            >
              {selected && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          )}

          {/* Dot non-lu à gauche (style iOS) */}
          {!isEdit && (
            <div className="w-3 flex justify-center flex-shrink-0">
              {unread && <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />}
            </div>
          )}

          {/* Avatar athlète 52×52 */}
          <div className="relative w-[52px] h-[52px] rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
            <AthletePhotoFill
              photoUrl={null}
              firstName={thread.athleteInitials[0] ?? ""}
              lastName={thread.athleteInitials[1] ?? ""}
              initialsFontSize={20}
            />
          </div>

          {/* Bloc texte 3 lignes + time droite */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className={`text-base truncate ${unread ? "font-bold text-white" : "font-semibold text-white/95"}`}>
                {thread.athleteName}
              </p>
              <span className={`text-[13px] flex-shrink-0 ${unread ? "text-[#3B82F6] font-semibold" : "text-white/40"}`}>
                {relativeTime(thread.lastMessageAt)}
              </span>
            </div>
            <p className="text-[15px] text-white/55 mt-0.5 truncate">
              Coach {thread.coachName}
            </p>
            <p className="text-[15px] text-white/40 mt-0.5 truncate">
              {thread.lastMessage || "Aucun message"}
            </p>
          </div>
        </button>
        {/* Séparateur inset commençant après l'avatar (style iOS) */}
        {!isLast && (
          <div className="absolute left-[88px] right-0 bottom-0 h-px bg-white/[0.06]" />
        )}
      </motion.div>

      {/* Mount stagger via key change handled by parent map */}
      <style jsx>{`
        @keyframes nx-stagger-msg {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── EmptyState ──────────────────────────────────────────────── */

function EmptyState({ kind }: { kind: "all" | "search" | "non_lu" | "archive" }) {
  const msg = {
    all:     { title: "Aucune conversation",       sub: "Tes échanges avec les coachs apparaîtront ici." },
    search:  { title: "Aucun résultat",             sub: "Essaie d'autres termes de recherche." },
    non_lu:  { title: "Tu es à jour",               sub: "Aucun message non lu." },
    archive: { title: "Aucune conversation archivée", sub: "Les conversations archivées apparaîtront ici." },
  }[kind];
  return (
    <SharedEmptyState
      image="/empty/nexus-empty-messagerie.png"
      title={msg.title}
      description={msg.sub}
    />
  );
}

/* ── SkeletonList ─────────────────────────────────────────────── */

function SkeletonList() {
  return (
    <div className="px-4 py-2 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="w-[52px] h-[52px] rounded-full nx-pulse-msg" />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded nx-pulse-msg" style={{ width: "55%" }} />
            <div className="h-2.5 rounded nx-pulse-msg" style={{ width: "40%" }} />
            <div className="h-2.5 rounded nx-pulse-msg" style={{ width: "70%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function RecruteurMessagesMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const { data: threads = [], isLoading } = useConversations();
  const { tier, loading: tierLoading } = useSubscription();
  const isFree = tier === "free";
  const archiveMut = useArchiveConversation();

  // States
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [filter, setFilter] = useState<FilterKey>("tous");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scrollY, setScrollY] = useState(0);

  // Sortie d'edit mode si pas de threads
  useEffect(() => { if (threads.length === 0) setEditMode(false); }, [threads.length]);
  useEffect(() => { if (!editMode) setSelected(new Set()); }, [editMode]);

  // Scroll listener pour blur backdrop du header
  useEffect(() => {
    let raf = 0; let last = 0; let tick = false;
    const onScroll = () => {
      last = window.scrollY || 0;
      if (!tick) {
        raf = window.requestAnimationFrame(() => { setScrollY(last); tick = false; });
        tick = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) window.cancelAnimationFrame(raf); };
  }, []);
  const scrolled = scrollY > 20;

  // Filtre + recherche local
  const filtered = useMemo(() => {
    let list = [...threads];
    if (filter === "non_lu") list = list.filter((t) => t.unreadCount > 0 && t.status !== "ARCHIVE");
    else if (filter === "archive") list = list.filter((t) => t.status === "ARCHIVE");
    else list = list.filter((t) => t.status !== "ARCHIVE");

    if (debouncedSearch.trim().length >= 2) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((t) =>
        t.coachName.toLowerCase().includes(q) ||
        t.athleteName.toLowerCase().includes(q) ||
        t.lastMessage.toLowerCase().includes(q)
      );
    }
    return list;
  }, [threads, filter, debouncedSearch]);

  // Active filter count badge
  const filterLabel = FILTER_OPTIONS.find((o) => o.value === filter)?.label || "Tous";
  const isActiveFilter = filter !== "tous";

  // Handlers
  const handleTap = (thread: ThreadData) => {
    if (isFree) {
      toast.warning({ message: "Messagerie réservée Pro", detail: "Passe à Pro pour répondre aux coachs" });
      return;
    }
    try { sessionStorage.setItem("lastRecruiterTab", "messages"); } catch { /* no-op */ }
    router.push(`/recruteur/messages/${thread.id}`);
  };

  const handleToggleSelect = (id: string) => {
    triggerHaptic("Light");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleArchiveSwipe = (thread: ThreadData) => {
    if (isFree) {
      toast.warning({ message: "Action réservée Pro" });
      return;
    }
    const newStatus = thread.status === "ARCHIVE" ? "ACTIVE" : "ARCHIVE";
    archiveMut.mutate(
      { conversationId: thread.id, newStatus },
      {
        onSuccess: () => {
          triggerHaptic("Medium");
          toast.success({
            message: newStatus === "ARCHIVE" ? "Conversation archivée" : "Conversation réactivée",
            duration: 5000,
            action: {
              label: "Annuler",
              onClick: () => {
                archiveMut.mutate({ conversationId: thread.id, newStatus: thread.status as "ACTIVE" | "ARCHIVE" });
              },
            },
          });
        },
        onError: () => toast.error({ message: "Erreur d'archivage" }),
      }
    );
  };

  const handleArchiveSelected = () => {
    if (selected.size === 0 || isFree) return;
    const ids = Array.from(selected);
    Promise.all(
      ids.map((id) => archiveMut.mutateAsync({ conversationId: id, newStatus: "ARCHIVE" }))
    ).then(() => {
      triggerHaptic("Medium");
      toast.success({ message: `${ids.length} conversation${ids.length > 1 ? "s archivées" : " archivée"}` });
      setSelected(new Set());
      setEditMode(false);
    }).catch(() => toast.error({ message: "Erreur d'archivage" }));
  };

  const totalThreads = threads.length;
  const loading = isLoading || tierLoading;

  // Empty kind
  const emptyKind: "all" | "search" | "non_lu" | "archive" =
    debouncedSearch.length >= 2 ? "search" :
    filter === "non_lu" ? "non_lu" :
    filter === "archive" ? "archive" : "all";

  return (
    <div
      className={`min-h-screen bg-[#111317] text-white${editMode ? "" : " nx-mobile-pb-tabbar"}`}
      style={editMode ? { paddingBottom: 80 } : undefined}
    >
      {/* Header sticky */}
      <div
        className="sticky top-0 z-30"
        style={{
          backgroundColor: scrolled ? "rgba(17,19,23,0.85)" : "#111317",
          backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          borderBottom: scrolled ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid transparent",
          transition: "background-color 200ms, backdrop-filter 200ms, border-bottom-color 200ms",
          paddingTop: "calc(env(safe-area-inset-top) + 8px)",
        }}
      >
        {/* Row : Edit pill / + (nouveau) / Filter pill (Iter 7.8b Section C — pills iOS) */}
        <div className="flex items-center justify-between px-4 h-11">
          <button
            type="button"
            disabled={isFree || totalThreads === 0}
            onClick={() => { triggerHaptic("Light"); setEditMode((v) => !v); }}
            className={`rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors ${
              isFree || totalThreads === 0
                ? "bg-white/[0.04] text-white/30"
                : editMode
                  ? "bg-white/[0.16] text-white active:bg-white/[0.22]"
                  : "bg-white/[0.08] text-white active:bg-white/[0.14]"
            }`}
          >
            {editMode ? "OK" : "Modifier"}
          </button>
          <div className="flex items-center gap-2">
            {/* Iter 7.64 — Bouton + nouvelle conversation. Pro+ requis
                (RLS messages_insert / conversations_insert gated). Free
                tap → toast upgrade pour éviter le rejet RLS dégueu. */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("Light");
                if (isFree) {
                  toast.info({
                    message: "Abonnement Pro requis",
                    detail: "L'envoi de messages est réservé Pro.",
                  });
                  return;
                }
                router.push("/recruteur/messages/nouveau");
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                isFree
                  ? "bg-white/[0.04] opacity-50"
                  : "bg-[#E63946] active:bg-[#D42B22] shadow-[0_4px_12px_rgba(230,57,70,0.35)]"
              }`}
              aria-label="Nouveau message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              disabled={isFree}
              onClick={() => { triggerHaptic("Light"); setFilterSheetOpen(true); }}
              className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                isFree
                  ? "bg-white/[0.04] opacity-50"
                  : "bg-white/[0.08] active:bg-white/[0.14]"
              }`}
              aria-label="Filtres"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              {isActiveFilter && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#E63946] border-2 border-[#111317]" />
              )}
            </button>
          </div>
        </div>

        {/* Large title iOS */}
        <h1 className="px-4 pt-2 pb-3 font-head text-[34px] font-black text-white uppercase tracking-tight leading-none">
          Messages
        </h1>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className={`flex items-center gap-2 px-3 h-10 rounded-2xl bg-white/[0.08] ${isFree ? "opacity-50" : ""}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              inputMode="search"
              placeholder={filterLabel === "Tous" ? "Rechercher" : `Rechercher dans ${filterLabel.toLowerCase()}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isFree}
              className="flex-1 bg-transparent text-[16px] text-white placeholder:text-white/40 outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-white/60 active:text-white" aria-label="Effacer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content + blur Free overlay */}
      <div className="relative">
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <EmptyState kind={emptyKind} />
        ) : (
          <div className={`relative ${isFree ? "blur-[6px] select-none pointer-events-none" : ""}`}>
            <AnimatePresence initial={true}>
              {filtered.map((t, idx) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, delay: Math.min(idx * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                >
                  <ThreadItem
                    thread={t}
                    index={idx}
                    isLast={idx === filtered.length - 1}
                    isEdit={editMode}
                    selected={selected.has(t.id)}
                    onTap={() => handleTap(t)}
                    onToggleSelect={() => handleToggleSelect(t.id)}
                    onCommitArchive={() => handleArchiveSwipe(t)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Free tier overlay tease */}
        {isFree && totalThreads > 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 pointer-events-none">
            <div
              className="rounded-2xl bg-[#111317]/85 backdrop-blur-md border border-white/10 px-5 py-5 max-w-[300px] text-center pointer-events-auto"
            >
              <p className="font-head text-[40px] font-black text-white leading-none">
                {totalThreads}
              </p>
              <p className="text-[12px] uppercase tracking-wider text-white/60 font-semibold mt-1">
                coach{totalThreads !== 1 ? "s" : ""} {totalThreads !== 1 ? "t'attendent" : "t'attend"}
              </p>
              <p className="text-[14px] text-white/85 mt-3 leading-snug">
                Passe à Pro pour lire et répondre.
              </p>
              <button
                type="button"
                onClick={() => { triggerHaptic("Light"); router.push("/tarifs"); }}
                className="mt-4 w-full py-2.5 rounded-2xl bg-[#E63946] text-white font-bold text-[14px] active:bg-[#D42B22] transition-colors"
              >
                Voir les forfaits
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mode Edit : barre d'action bas */}
      {editMode && !isFree && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 bg-[#1A1D24] border-t border-white/[0.06] px-4 py-3"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={handleArchiveSelected}
            disabled={selected.size === 0}
            className={`w-full py-3 rounded-2xl font-bold text-[15px] transition-colors ${selected.size === 0 ? "bg-white/[0.06] text-white/40" : "bg-[#E63946] text-white active:bg-[#D42B22]"}`}
          >
            {selected.size === 0 ? "Sélectionne des conversations" : `Archiver (${selected.size})`}
          </button>
        </div>
      )}

      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        value={filter}
        onChange={setFilter}
      />

      <style jsx>{`
        @keyframes nx-pulse-msg-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        :global(.nx-pulse-msg) { background: #1A1D24; animation: nx-pulse-msg-kf 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
