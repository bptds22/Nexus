"use client";

import { useState } from "react";
import Link from "next/link";
import type { ActivityEvent } from "@/lib/types/activityEvents";
import ActivityEventCard from "./ActivityEventCard";
import TimeGroupHeader from "./TimeGroupHeader";

/* ─────────────────────────────────────────────────────────────────
   Sort helper — within each time group:
   P1 inbound -> P1 outbound -> P2 inbound -> P2 outbound -> P3
───────────────────────────────────────────────────────────────── */

function sortKey(ev: ActivityEvent): number {
  const dirVal = ev.direction === "inbound" ? 0 : 1;
  return ev.priority * 10 + dirVal;
}

/* ─────────────────────────────────────────────────────────────────
   Time group ordering
───────────────────────────────────────────────────────────────── */

const TIME_GROUP_ORDER: ActivityEvent["timeGroup"][] = [
  "Aujourd'hui",
  "Hier",
  "Cette semaine",
  "Semaine dernière",
];

/* ─────────────────────────────────────────────────────────────────
   RecruiterActivityFeed — main feed component
───────────────────────────────────────────────────────────────── */

const INITIAL_LIMIT = 15;

export default function RecruiterActivityFeed({ events }: { events: ActivityEvent[] }) {
  const [showAll, setShowAll] = useState(false);

  /* ── Empty state ─────────────────────────────────────────── */
  if (events.length === 0) {
    return (
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-8 text-center">
        <p className="text-[16px] text-[#9CA3AF] font-semibold">
          Aucune activité récente
        </p>
        <Link
          href="/recruteur/recherche"
          className="inline-flex items-center gap-1 text-[13px] text-white font-bold mt-3 hover:underline"
        >
          Rechercher des athlètes
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    );
  }

  /* ── Group events by timeGroup ─────────────────────────── */
  const grouped = new Map<ActivityEvent["timeGroup"], ActivityEvent[]>();
  for (const tg of TIME_GROUP_ORDER) {
    grouped.set(tg, []);
  }
  for (const ev of events) {
    const arr = grouped.get(ev.timeGroup);
    if (arr) arr.push(ev);
  }
  // Sort within each group
  for (const arr of grouped.values()) {
    arr.sort((a, b) => sortKey(a) - sortKey(b));
  }

  /* ── Flatten into display list with separators ─────────── */
  type FeedItem =
    | { kind: "event"; event: ActivityEvent }
    | { kind: "header"; label: string };

  const allItems: FeedItem[] = [];
  let isFirstGroup = true;

  for (const tg of TIME_GROUP_ORDER) {
    const arr = grouped.get(tg);
    if (!arr || arr.length === 0) continue;

    if (!isFirstGroup) {
      allItems.push({ kind: "header", label: tg });
    }
    isFirstGroup = false;

    for (const ev of arr) {
      allItems.push({ kind: "event", event: ev });
    }
  }

  /* ── Apply limit ─────────────────────────────────────────── */
  const displayItems = showAll ? allItems : allItems.slice(0, INITIAL_LIMIT);
  const hasMore = allItems.length > INITIAL_LIMIT;

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-head font-bold text-[15px] tracking-[0.15em] uppercase text-white">
          Activités récentes
        </h2>
        <p className="text-[13px] text-[#9CA3AF] mt-1">De tes athlètes favoris</p>
      </div>

      {/* Feed list */}
      <div className="px-3 pb-4 space-y-1">
        {displayItems.map((item, i) => {
          if (item.kind === "header") {
            return <TimeGroupHeader key={`hdr-${item.label}`} label={item.label} />;
          }
          return <ActivityEventCard key={item.event.id} event={item.event} />;
        })}
      </div>

      {/* "Voir plus" button */}
      {hasMore && !showAll && (
        <div className="px-5 pb-5">
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-2.5 rounded-lg border border-[#2D3748] text-[13px] text-[#9CA3AF] font-medium hover:text-white hover:border-[#4B5563] transition-colors"
          >
            Voir plus d&apos;activité
          </button>
        </div>
      )}
    </div>
  );
}
