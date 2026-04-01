"use client";

import { useState } from "react";
import Link from "next/link";
import type { ActivityEvent } from "@/lib/types/activityEvents";
import RichActivityMessage, { eventToEntities } from "@/app/components/activities/RichActivityMessage";

/* ─────────────────────────────────────────────────────────────────
   Coach ACTIVITÉS RÉCENTES — Same rich layout as recruiter feed.
   Priority-based styling, {athlete} bold names, action links,
   date section dividers, right-aligned timestamps.
───────────────────────────────────────────────────────────────── */

/* ── EventIcon — maps icon names to inline SVGs ──────────────── */

function EventIcon({ name, color, size }: { name: string; color: string; size: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "message-circle":
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      );
    case "send":
      return (
        <svg {...props}>
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22l-4-9-9-4z" />
        </svg>
      );
    case "heart":
      return (
        <svg {...props} fill={color} stroke="none">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      );
    case "film":
      return (
        <svg {...props}>
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <path d="M7 2v20" />
          <path d="M17 2v20" />
          <path d="M2 12h20" />
          <path d="M2 7h5" />
          <path d="M2 17h5" />
          <path d="M17 7h5" />
          <path d="M17 17h5" />
        </svg>
      );
    case "check-circle":
      return (
        <svg {...props}>
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
        </svg>
      );
    case "award":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="7" />
          <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
        </svg>
      );
    case "file-text":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      );
    case "user-plus":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <path d="M20 8v6" />
          <path d="M23 11h-6" />
        </svg>
      );
    case "bar-chart-3":
      return (
        <svg {...props}>
          <path d="M18 20V10" />
          <path d="M12 20V4" />
          <path d="M6 20v-6" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      );
    case "handshake":
      return (
        <svg {...props}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "pen-tool":
      return (
        <svg {...props}>
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      );
    case "x-circle":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6" />
          <path d="M9 9l6 6" />
        </svg>
      );
    case "camera":
      return (
        <svg {...props}>
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}


/* ── TimeGroupHeader ─────────────────────────────────────────── */

function TimeGroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-[#2D3748]" />
      <span className="text-[11px] text-[#6B7280] uppercase tracking-wider font-medium shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#2D3748]" />
    </div>
  );
}

/* ── ActivityEventCard ───────────────────────────────────────── */

function ActivityEventCard({ event }: { event: ActivityEvent }) {
  const { priority, type } = event;
  const isLettreSigne = type === "status_lettre_signee";

  let containerBg = "#1A1D24";
  let borderLeft = "none";
  let textColor = "#FFFFFF";
  let actionColor = "#6B7280";
  let iconSize = 20;
  let iconColor = event.iconColor;

  if (priority === 1) {
    containerBg = "#1E2430";
    borderLeft = `4px solid ${event.iconColor}`;
    textColor = "#FFFFFF";
    actionColor = "#FFFFFF";
    iconSize = 24;
  } else if (priority === 2) {
    containerBg = "#1A1D24";
    borderLeft = "2px solid #2D3748";
    textColor = "#FFFFFF";
    actionColor = "#9CA3AF";
    iconSize = 24;
  } else {
    containerBg = "#1A1D24";
    borderLeft = "none";
    textColor = "#9CA3AF";
    actionColor = "#6B7280";
    iconSize = 20;
    iconColor = "#6B7280";
  }

  if (isLettreSigne) {
    containerBg = "rgba(230,51,41,0.08)";
    borderLeft = "4px solid #E63946";
  }

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-lg transition-colors hover:brightness-110"
      style={{ backgroundColor: containerBg, borderLeft }}
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        <EventIcon name={event.icon} color={iconColor} size={iconSize} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] leading-relaxed" style={{ color: textColor }}>
          <RichActivityMessage
            text={event.message}
            entities={eventToEntities(event)}
            portal="coach"
          />
        </p>
        {event.actionLabel && event.actionUrl && (
          <Link
            href={event.actionUrl}
            className="inline-flex items-center gap-1 text-[13px] font-semibold mt-1 hover:underline"
            style={{ color: actionColor, fontWeight: priority === 1 ? 700 : 600 }}
          >
            {event.actionLabel}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {/* Timestamp — right-aligned */}
      <span className="text-[12px] text-[#6B7280] shrink-0 whitespace-nowrap mt-0.5">
        {event.relativeTime}
      </span>
    </div>
  );
}

/* ── Sort helper ─────────────────────────────────────────────── */

function sortKey(ev: ActivityEvent): number {
  const dirVal = ev.direction === "inbound" ? 0 : 1;
  return ev.priority * 10 + dirVal;
}

const TIME_GROUP_ORDER: ActivityEvent["timeGroup"][] = [
  "Aujourd'hui",
  "Hier",
  "Cette semaine",
  "Semaine dernière",
];

const INITIAL_LIMIT = 15;

/* ── Main Feed Component ─────────────────────────────────────── */

export default function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const [showAll, setShowAll] = useState(false);

  if (events.length === 0) {
    return (
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-8 text-center">
        <p className="text-[16px] text-[#9CA3AF] font-semibold">Aucune activité récente</p>
        <p className="text-[12px] text-[#6b7280] mt-2">
          Les activités de vos athlètes apparaîtront ici
        </p>
      </div>
    );
  }

  /* Group events by timeGroup */
  const grouped = new Map<ActivityEvent["timeGroup"], ActivityEvent[]>();
  for (const tg of TIME_GROUP_ORDER) {
    grouped.set(tg, []);
  }
  for (const ev of events) {
    const arr = grouped.get(ev.timeGroup);
    if (arr) arr.push(ev);
  }
  for (const arr of grouped.values()) {
    arr.sort((a, b) => sortKey(a) - sortKey(b));
  }

  /* Flatten into display list with separators */
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

  const displayItems = showAll ? allItems : allItems.slice(0, INITIAL_LIMIT);
  const hasMore = allItems.length > INITIAL_LIMIT;

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-head font-bold text-[15px] tracking-[0.15em] uppercase text-white">
          Activités récentes
        </h2>
      </div>

      {/* Feed list */}
      <div className="px-3 pb-4 space-y-1">
        {displayItems.map((item) => {
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
            type="button"
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
