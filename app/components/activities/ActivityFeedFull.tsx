"use client";

import { useState, useMemo } from "react";
import type { Activity } from "@/lib/types/activity";
import { ACTIVITY_TYPE_CONFIG, TIME_GROUP_ORDER, getTimeGroup } from "@/lib/types/activity";
import type { FilterValue } from "./ActivityFilters";
import ActivityFilters, { getFilterPills } from "./ActivityFilters";
import ActivityCard from "./ActivityCard";
import ActivityTimeGroup from "./ActivityTimeGroup";
import ActivityEmptyState from "./ActivityEmptyState";

/* ─────────────────────────────────────────────────────────────────
   ActivityFeedFull — full-page activity feed with filters,
   temporal grouping, pagination, and unread summary.
   Used by both /coach/activites and /recruteur/activites.
───────────────────────────────────────────────────────────────── */

const NOW = new Date("2026-03-11T10:00:00");
const PAGE_SIZE = 15;

interface Props {
  activities: Activity[];
  portal: "coach" | "recruiter";
  title: string;
  subtitle: string;
}

export default function ActivityFeedFull({ activities, portal, title, subtitle }: Props) {
  const [filter, setFilter] = useState<FilterValue>("tous");
  const [search, setSearch] = useState("");
  const [showCount, setShowCount] = useState(PAGE_SIZE);

  const pills = useMemo(() => getFilterPills(portal), [portal]);
  const unreadCount = activities.filter((a) => !a.isRead).length;

  /* ── Filtered + searched list ────────────────────────────── */
  const filtered = useMemo(() => {
    let list = [...activities];

    // Filter by type
    if (filter !== "tous") {
      const selectedLabel = ACTIVITY_TYPE_CONFIG[filter]?.label;
      if (selectedLabel) {
        list = list.filter((a) => ACTIVITY_TYPE_CONFIG[a.type]?.label === selectedLabel);
      }
    }

    // Search by athlete name
    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        (a.athleteName?.toLowerCase().includes(q)) ||
        (a.recruiterName?.toLowerCase().includes(q)) ||
        (a.coachName?.toLowerCase().includes(q)) ||
        (a.cegepName?.toLowerCase().includes(q)) ||
        (a.schoolName?.toLowerCase().includes(q))
      );
    }

    // Sort by timestamp desc
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return list;
  }, [activities, filter, search]);

  /* ── Group by time ──────────────────────────────────────── */
  type FeedItem =
    | { kind: "event"; activity: Activity }
    | { kind: "header"; label: string };

  const allItems = useMemo(() => {
    const grouped = new Map<string, Activity[]>();
    for (const tg of TIME_GROUP_ORDER) grouped.set(tg, []);

    for (const a of filtered) {
      const group = getTimeGroup(a.timestamp, NOW);
      grouped.get(group)?.push(a);
    }

    const items: FeedItem[] = [];
    let isFirst = true;

    for (const tg of TIME_GROUP_ORDER) {
      const arr = grouped.get(tg);
      if (!arr || arr.length === 0) continue;

      if (!isFirst) {
        items.push({ kind: "header", label: tg });
      }
      isFirst = false;

      for (const a of arr) {
        items.push({ kind: "event", activity: a });
      }
    }

    return items;
  }, [filtered]);

  const displayItems = allItems.slice(0, showCount);
  const hasMore = allItems.length > showCount;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              {title}
            </h1>
            <p className="text-[14px] text-[#9CA3AF] mt-1">{subtitle}</p>
          </div>
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-[#E63946] text-white text-[13px] font-bold px-3.5 py-1.5 rounded-full self-start">
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-[40%] min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par athlète, recruteur, CÉGEP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
          />
        </div>

        {/* Filter pills */}
        <ActivityFilters pills={pills} active={filter} onChange={setFilter} />
      </div>

      {/* ── Feed ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <ActivityEmptyState portal={portal} />
      ) : (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden">
          <div className="px-3 py-4 space-y-1">
            {displayItems.map((item) => {
              if (item.kind === "header") {
                return <ActivityTimeGroup key={`hdr-${item.label}`} label={item.label} />;
              }
              return <ActivityCard key={item.activity.id} activity={item.activity} />;
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowCount((c) => c + PAGE_SIZE)}
                className="w-full py-2.5 rounded-lg border border-[#2D3748] text-[13px] text-[#9CA3AF] font-medium hover:text-white hover:border-[#4B5563] transition-colors"
              >
                Voir plus d&apos;activité ({allItems.length - showCount} restante{allItems.length - showCount > 1 ? "s" : ""})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
