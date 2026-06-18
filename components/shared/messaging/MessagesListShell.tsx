"use client";

/* ═══════════════════════════════════════════════════════════════
   MessagesListShell — identity-agnostic chrome for the messaging
   list screen. Extracted from RecruteurMessagesMobile.

   What it owns :
   - Sticky header with scroll-blur backdrop
   - Large title (default "Messages")
   - Edit pill (left) + "+" new-message + filter pill (right)
   - Sticky search bar (debounce + state owned by parent)
   - Per-row swipe-to-archive motion (framer-motion, gray-reveal)
   - Edit mode multi-select with selection circle
   - Bulk-archive bottom bar (visible in edit mode)
   - FilterSheet (single-select bottom sheet)
   - SkeletonList placeholder
   - Shared <EmptyState> wired to /empty/nexus-empty-messagerie.png
   - Optional free-tier blur + tease overlay slot

   What it DOESN'T own (parent provides) :
   - The threads array + its shape (generic T)
   - Field accessors (getId / getUnread / getStatus)
   - The row CONTENT (renderRowContent : avatar + name + last
     message + relative-time, role-specific layout)
   - Data fetching, mutations, navigation, tier checks, copy
   - Free-tier lock overlay content (parent passes the tease card)

   Pure presentational ; no fetching, no router, no subscription.
═══════════════════════════════════════════════════════════════ */

import {
  useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import {
  motion, AnimatePresence,
} from "framer-motion";
import { EmptyState as SharedEmptyState } from "@/components/mobile/EmptyState";
import { FilterSheet, type FilterOption } from "./FilterSheet";
import { SwipeableRow } from "@/components/shared/SwipeableRow";

export type { FilterOption } from "./FilterSheet";
import { triggerHaptic } from "./utils";

/* ═══ Generic per-row swipe component ═══════════════════════════ */

function ThreadRowSwipe<T>({
  thread, isLast, isEdit, selected, unread, isArchived,
  onTap, onToggleSelect, onCommitArchive, renderContent,
}: {
  thread: T;
  isLast: boolean;
  isEdit: boolean;
  selected: boolean;
  unread: boolean;
  isArchived: boolean;
  onTap: () => void;
  onToggleSelect: () => void;
  onCommitArchive: () => void;
  renderContent: (t: T) => ReactNode;
}) {
  return (
    <SwipeableRow
      disabled={isEdit}
      onCommit={onCommitArchive}
      action={{
        label: isArchived ? "Réactiver" : "Archiver",
        // Foreground (icon + label) = #9CA3AF, bg = #6B7280/20 — same
        // tokens as the original ThreadRowSwipe (pre-extraction).
        color: "#9CA3AF",
        bgColor: "#6B7280",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        ),
      }}
    >
      <button
        type="button"
        onClick={isEdit ? onToggleSelect : onTap}
        className="w-full flex items-center gap-3 pl-4 pr-4 py-3 active:bg-white/[0.03] transition-colors text-left"
      >
        {/* Edit-mode selection circle */}
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

        {/* Unread dot (iOS-style left rail) */}
        {!isEdit && (
          <div className="w-3 flex justify-center flex-shrink-0">
            {unread && <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />}
          </div>
        )}

        {/* Role-specific row content (avatar + names + time + last
            message). Provided by the parent via renderRowContent. */}
        <div className="flex-1 min-w-0">
          {renderContent(thread)}
        </div>
      </button>

      {/* iOS-style inset separator starting after the avatar (88px) */}
      {!isLast && (
        <div className="absolute left-[88px] right-0 bottom-0 h-px bg-white/[0.06]" />
      )}
    </SwipeableRow>
  );
}

/* ═══ Skeleton placeholder while threads load ═══════════════════ */

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

/* ═══ Public API ════════════════════════════════════════════════ */

export interface MessagesListShellProps<T> {
  /** Threads (already filtered + sorted by the parent). */
  threads: T[];
  isLoading: boolean;

  /* Field accessors so the shell can drive its UI without knowing
     the concrete shape. */
  getId: (t: T) => string;
  getUnread: (t: T) => boolean;
  /** "ARCHIVE" vs "ACTIVE" — drives the swipe-action label. */
  getStatus: (t: T) => "ACTIVE" | "ARCHIVE";

  /** Renders the inner row content (avatar + names + last message
     + relative-time). Role-specific layout. */
  renderRowContent: (t: T) => ReactNode;

  /** Filter (single select). The parent owns the keyset + labels. */
  filterOptions: FilterOption<string>[];
  filter: string;
  onFilterChange: (v: string) => void;

  /** Sticky search bar (parent owns debounce). */
  search: string;
  onSearchChange: (s: string) => void;
  searchPlaceholder?: string;

  /** Edit mode multi-select. */
  editMode: boolean;
  onToggleEdit: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onBulkArchive: () => void;

  /** Per-thread interactions. */
  onTapThread: (t: T) => void;
  onSwipeArchive: (t: T) => void;

  /** Large title + "+" new-message FAB-pill. */
  title?: string;
  onCreate?: () => void;
  /** Disable the "+" button if the parent wants to gate it (e.g. tier).
   *  When disabled, tapping calls onCreateBlocked instead of onCreate. */
  createDisabled?: boolean;
  onCreateBlocked?: () => void;

  /** Free-tier (or any) full-list lock. When true, the list is blurred
   *  and `lockOverlay` is rendered centered above it. */
  isLocked?: boolean;
  /** Overlay card content shown over the blurred list. Role-specific. */
  lockOverlay?: ReactNode;

  /** Empty-state copy. Image defaults to the messaging asset. */
  emptyImage?: string;
  emptyTitle: string;
  emptyDescription: string;
}

export function MessagesListShell<T>({
  threads, isLoading,
  getId, getUnread, getStatus,
  renderRowContent,
  filterOptions, filter, onFilterChange,
  search, onSearchChange, searchPlaceholder = "Rechercher",
  editMode, onToggleEdit, selectedIds, onToggleSelect, onBulkArchive,
  onTapThread, onSwipeArchive,
  title = "Messages",
  onCreate, createDisabled, onCreateBlocked,
  isLocked, lockOverlay,
  emptyImage = "/empty/nexus-empty-messagerie.png",
  emptyTitle, emptyDescription,
}: MessagesListShellProps<T>) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  /* Header backdrop-blur once user scrolls past 20px (iOS pattern). */
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let tick = false;
    const onScroll = () => {
      last = window.scrollY || 0;
      if (!tick) {
        raf = window.requestAnimationFrame(() => { setScrollY(last); tick = false; });
        tick = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
  const scrolled = scrollY > 20;

  /* "Active filter" = anything other than the FIRST option in the
     list. Parent convention : the first option is the "all" filter. */
  const isActiveFilter = filterOptions.length > 0 && filter !== filterOptions[0].value;
  const activeFilterLabel = filterOptions.find((o) => o.value === filter)?.label || filterOptions[0]?.label || "";
  const allFilterLabel = filterOptions[0]?.label || "";
  const searchPlaceholderResolved = !isActiveFilter
    ? searchPlaceholder
    : `${searchPlaceholder} dans ${activeFilterLabel.toLowerCase()}`;

  const totalThreads = threads.length;

  return (
    <div
      className={`min-h-screen bg-[#111317] text-white${editMode ? "" : " nx-mobile-pb-tabbar"}`}
      style={editMode ? { paddingBottom: 80 } : undefined}
    >
      {/* Sticky header */}
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
        {/* Row : Edit pill (left) · + (center-right) · Filter pill (right) */}
        <div className="flex items-center justify-between px-4 h-11">
          <button
            type="button"
            disabled={isLocked || totalThreads === 0}
            onClick={() => { triggerHaptic("Light"); onToggleEdit(); }}
            className={`rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors ${
              isLocked || totalThreads === 0
                ? "bg-white/[0.04] text-white/30"
                : editMode
                  ? "bg-white/[0.16] text-white active:bg-white/[0.22]"
                  : "bg-white/[0.08] text-white active:bg-white/[0.14]"
            }`}
          >
            {editMode ? "OK" : "Modifier"}
          </button>
          <div className="flex items-center gap-2">
            {/* New message button (parent passes onCreate ; gating
                surfaced via createDisabled + onCreateBlocked). */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("Light");
                if (createDisabled) {
                  onCreateBlocked?.();
                  return;
                }
                onCreate?.();
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                createDisabled
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
              disabled={isLocked}
              onClick={() => { triggerHaptic("Light"); setFilterSheetOpen(true); }}
              className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                isLocked
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

        {/* Large title (iOS-style) */}
        <h1 className="px-4 pt-2 pb-3 font-head text-[34px] font-black text-white uppercase tracking-tight leading-none">
          {title}
        </h1>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className={`flex items-center gap-2 px-3 h-10 rounded-2xl bg-white/[0.08] ${isLocked ? "opacity-50" : ""}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              inputMode="search"
              placeholder={isActiveFilter && allFilterLabel ? searchPlaceholderResolved : searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              disabled={isLocked}
              className="flex-1 bg-transparent text-[16px] text-white placeholder:text-white/40 outline-none"
            />
            {search && (
              <button type="button" onClick={() => onSearchChange("")} className="text-white/60 active:text-white" aria-label="Effacer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content + lock overlay */}
      <div className="relative">
        {isLoading ? (
          <SkeletonList />
        ) : threads.length === 0 ? (
          <SharedEmptyState image={emptyImage} title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className={`relative ${isLocked ? "blur-[6px] select-none pointer-events-none" : ""}`}>
            <AnimatePresence initial={true}>
              {threads.map((t, idx) => (
                <motion.div
                  key={getId(t)}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, delay: Math.min(idx * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                >
                  <ThreadRowSwipe<T>
                    thread={t}
                    isLast={idx === threads.length - 1}
                    isEdit={editMode}
                    selected={selectedIds.has(getId(t))}
                    unread={getUnread(t)}
                    isArchived={getStatus(t) === "ARCHIVE"}
                    onTap={() => onTapThread(t)}
                    onToggleSelect={() => {
                      triggerHaptic("Light");
                      onToggleSelect(getId(t));
                    }}
                    onCommitArchive={() => onSwipeArchive(t)}
                    renderContent={renderRowContent}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Lock overlay tease (free-tier) */}
        {isLocked && totalThreads > 0 && lockOverlay && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 pointer-events-none">
            <div className="pointer-events-auto">
              {lockOverlay}
            </div>
          </div>
        )}
      </div>

      {/* Edit-mode bulk-archive bar */}
      {editMode && !isLocked && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 bg-[#1A1D24] border-t border-white/[0.06] px-4 py-3"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onBulkArchive}
            disabled={selectedIds.size === 0}
            className={`w-full py-3 rounded-2xl font-bold text-[15px] transition-colors ${
              selectedIds.size === 0
                ? "bg-white/[0.06] text-white/40"
                : "bg-[#E63946] text-white active:bg-[#D42B22]"
            }`}
          >
            {selectedIds.size === 0 ? "Sélectionne des conversations" : `Archiver (${selectedIds.size})`}
          </button>
        </div>
      )}

      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        value={filter}
        onChange={onFilterChange}
        options={filterOptions}
      />

      <style jsx>{`
        @keyframes nx-pulse-msg-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        :global(.nx-pulse-msg) { background: #1A1D24; animation: nx-pulse-msg-kf 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
