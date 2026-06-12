"use client";

/* ═══════════════════════════════════════════════════════════════
   ActivitiesPageShell — identity-agnostic chrome for the mobile
   activities page. Extracted from RecruteurActivitesMobile so coach
   and recruiter can share :
     - Sticky opaque header with title
     - Sticky horizontally-scrollable filter pills row
     - Time-grouped list (Aujourd'hui / Hier / Cette semaine /
       Ce mois-ci / Plus ancien cohorts)
     - Color-coded activity cards (left rail tint + tinted icon
       chip + verb + relative time + chevron)
     - Skeleton on load, per-filter empty state, "Voir plus"
       pagination, motion-animated group reveals
     - Mark-all-read fires once on mount (caller passes the
       mutation)

   Role-specific bits are passed as PROPS — the shell never knows
   what an action_type means, just how to render it given the
   role's :
     - visual map      (color + icon name)
     - verb generator  (the sentence)
     - destination     (tap target route, or null = not tappable)
     - filter options  (pills + members set per pill)
     - empty-state copy (filter-aware)
     - onMount hook    (mark-all-read mutation)

   PURE presentational : no fetching, no router, no auth, no toast.
   Generic over T = the role's activity item shape.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { EmptyState as SharedEmptyState } from "@/components/mobile/EmptyState";
import { formatRelativeDate } from "@/lib/utils/formatRelativeDate";
import { ActivityIcon, DEFAULT_VISUAL, type Visual } from "./ActivityIcon";
import { TIME_GROUP_ORDER, getTimeGroup, triggerHaptic } from "./utils";

const DEFAULT_PAGE_SIZE = 30;

/* ── Filter option contract ─────────────────────────────────── */

export interface FilterOption<F extends string> {
  value: F;
  label: string;
  /** Set of action_type values that belong to this filter.
   *  null = "all" (shows every item). Convention : the first
   *  option is always the "all" pill with members === null. */
  members: Set<string> | null;
}

/* ── Empty-state copy resolver ──────────────────────────────── */

export interface EmptyCopy {
  image?: string;
  title: string;
  description: string;
}

/* ── Public API ─────────────────────────────────────────────── */

export interface ActivitiesPageShellProps<T, F extends string = string> {
  items: T[];
  isLoading: boolean;

  /** Sticky header title (e.g. "Activité"). */
  title: string;

  /* Field accessors — the shell doesn't know what `T` looks like. */
  getId: (item: T) => string;
  getCreatedAt: (item: T) => string;
  getActionType: (item: T) => string;
  getVerb: (item: T) => string;
  /** Destination route on tap. null = card not tappable, no chevron. */
  getDestination: (item: T) => string | null;
  getVisual: (actionType: string) => Visual;

  /** Filter pills. First option is the "all" pill (members === null). */
  filterOptions: FilterOption<F>[];

  /** Fired once on mount. Roles pass their mark-all-read mutation. */
  onMount?: () => void;

  /** Custom tap behavior — e.g. sessionStorage stash before nav. If
   *  omitted, the shell does triggerHaptic + router.push(destination). */
  onTapItem?: (item: T, destination: string) => void;

  /** Per-filter empty-state copy. Receives the active filter value. */
  emptyCopy: (filter: F) => EmptyCopy;

  /** Page size for "Voir plus" pagination. Default 30. */
  pageSize?: number;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function ActivitiesPageShell<T, F extends string = string>({
  items,
  isLoading,
  title,
  getId,
  getCreatedAt,
  getActionType,
  getVerb,
  getDestination,
  getVisual,
  filterOptions,
  onMount,
  onTapItem,
  emptyCopy,
  pageSize = DEFAULT_PAGE_SIZE,
}: ActivitiesPageShellProps<T, F>) {
  const router = useRouter();
  const initialFilter = filterOptions[0]?.value as F;
  const [filter, setFilter] = useState<F>(initialFilter);
  const [showCount, setShowCount] = useState(pageSize);

  /* Mark-all-read fires once on mount (role-specific mutation). */
  useEffect(() => {
    onMount?.();
    // Run once on mount — the mutation itself is owned by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Filter members lookup (first option is the "all" sentinel). */
  const membersByValue = useMemo(() => {
    const m = new Map<F, Set<string> | null>();
    for (const opt of filterOptions) m.set(opt.value, opt.members);
    return m;
  }, [filterOptions]);

  const filtered = useMemo(() => {
    const members = membersByValue.get(filter);
    if (!members) return items;
    return items.filter((it) => members.has(getActionType(it)));
  }, [items, filter, membersByValue, getActionType]);

  const visible = filtered.slice(0, showCount);
  const hasMore = filtered.length > showCount;

  /* Group by time cohort, preserving DESC order within each. */
  const groups = useMemo(() => {
    const now = new Date();
    const acc = new Map<string, T[]>();
    for (const tg of TIME_GROUP_ORDER) acc.set(tg, []);
    for (const it of visible) {
      const g = getTimeGroup(getCreatedAt(it), now);
      acc.get(g)?.push(it);
    }
    return TIME_GROUP_ORDER
      .map((g) => ({ group: g, items: acc.get(g) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [visible, getCreatedAt]);

  const handleTap = useCallback((item: T) => {
    const dest = getDestination(item);
    if (!dest) return;
    if (onTapItem) {
      onTapItem(item, dest);
      return;
    }
    triggerHaptic("Light");
    router.push(dest);
  }, [getDestination, onTapItem, router]);

  return (
    /* Iter 7.34 Section A — overflow-x-hidden + w-full sur la chaîne pour
       tuer le débordement horizontal de la PAGE. Le bug réel : les pills
       w-max remontaient via la chaîne flex (right-column flex-1 + main flex-1
       sans min-w-0 par défaut), l'overflow-x: hidden de main était contourné.
       Ceinture : overflow-x-hidden ici clippe au niveau page. */
    <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Header sticky opaque (canon 14.11) */}
      <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="px-4 pt-3 pb-3">
          <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">
            {title}
          </h1>
        </div>
        {/* Iter 7.33 Section 1 — pills iOS premium (slide assumé, pattern
            App Store/Spotify). Style : pills rondes h-9 px-4, espacement gap-2.5
            généreux, premier pill aligné au bord (px-4 du container parent). */}
        {/* Iter 7.34 Section A — w-full + min-w-0 bornent le viewport scroll
            au conteneur. Sans w-full, l'overflow-x-auto prenait la largeur
            naturelle de son contenu (w-max) et faisait déborder la page. */}
        <div
          className="w-full min-w-0 pb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex items-center gap-2.5 px-4 w-max">
            {filterOptions.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { triggerHaptic("Light"); setFilter(opt.value); setShowCount(pageSize); }}
                  className={`h-9 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${
                    active
                      ? "bg-[#E63946] text-white shadow-[0_0_12px_rgba(230,57,70,0.35)]"
                      : "bg-white/[0.06] text-[#9CA3AF] active:bg-white/[0.10]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        {isLoading && items.length === 0 ? (
          /* Skeleton aligné sur la nouvelle hauteur de carte (88-96px). */
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[88px] rounded-2xl bg-[#1A1D24] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <ShellEmptyState copy={emptyCopy(filter)} />
        ) : (
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {groups.map(({ group, items: groupItems }) => (
                <motion.div
                  key={group}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 className="text-[12px] uppercase tracking-[0.18em] text-white/40 font-bold mb-2.5 px-1">
                    {group}
                  </h2>
                  {/* Iter 7.32 Section 2 — gap entre cartes augmenté (space-y-2
                      → 2.5) pour aérer le rythme façon notifications iOS. */}
                  <div className="space-y-2.5">
                    {groupItems.map((item) => (
                      <ActivityCard<T>
                        key={getId(item)}
                        item={item}
                        verb={getVerb(item)}
                        visual={getVisual(getActionType(item)) ?? DEFAULT_VISUAL}
                        dest={getDestination(item)}
                        getCreatedAt={getCreatedAt}
                        onTap={() => handleTap(item)}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {hasMore && (
              <button
                type="button"
                onClick={() => { triggerHaptic("Light"); setShowCount((c) => c + pageSize); }}
                className="w-full py-3 rounded-2xl bg-white/[0.06] active:bg-white/[0.10] text-white font-semibold text-[14px] transition-colors"
              >
                Voir plus
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ActivityCard ───────────────────────────────────────────── */

function ActivityCard<T>({
  item, verb, visual, dest, getCreatedAt, onTap,
}: {
  item: T;
  verb: string;
  visual: Visual;
  dest: string | null;
  getCreatedAt: (item: T) => string;
  onTap: () => void;
}) {
  return (
    /* Iter 7.32 Section 2 — densité "card app" (vs "ligne newsfeed web") :
       hauteur ~96px (py-3.5), texte verbe 15px font-medium leading-snug,
       icône container 10×10 + SVG 22px, accent gauche épaissi à 4px. */
    <button
      type="button"
      onClick={onTap}
      disabled={!dest}
      className={`w-full relative rounded-2xl overflow-hidden bg-[#1A1D24] text-left ${
        dest ? "active:opacity-80" : "opacity-90"
      } transition-opacity`}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: visual.color }}
        aria-hidden
      />
      <div className="flex items-center gap-3 pl-4 pr-3 py-3.5 min-h-[88px]">
        <span
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${visual.color}1F` }}
        >
          <ActivityIcon name={visual.icon} color={visual.color} size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] text-white font-medium leading-snug">{verb}</p>
          <p className="text-[12px] text-white/50 mt-1.5">{formatRelativeDate(getCreatedAt(item))}</p>
        </div>
        {dest && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
    </button>
  );
}

/* ── Empty-state wrapper ────────────────────────────────────── */

function ShellEmptyState({ copy }: { copy: EmptyCopy }) {
  return (
    <SharedEmptyState
      image={copy.image ?? "/empty/nexus-empty-shortlist.png"}
      title={copy.title}
      description={copy.description}
    />
  );
}
