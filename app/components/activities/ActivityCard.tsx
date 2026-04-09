"use client";

import Link from "next/link";
import type { Activity } from "@/lib/types/activity";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/types/activity";
import ActivityIcon from "./ActivityIcon";
import { getActivityMessage, relativeTimeFromNow } from "./activityMessages";
import RichActivityMessage from "./RichActivityMessage";

/* ─────────────────────────────────────────────────────────────────
   ActivityCard — single activity row in the full-page feed.
   Unread = left red border + slightly brighter bg.
   Letter of intent = red glow highlight.
───────────────────────────────────────────────────────────────── */

export default function ActivityCard({ activity }: { activity: Activity }) {
  const config = ACTIVITY_TYPE_CONFIG[activity.type];
  const msg = getActivityMessage(activity);
  const relTime = relativeTimeFromNow(activity.timestamp, new Date());
  const isLettre = activity.type === "letter_of_intent";

  let containerBg = activity.isRead ? "#1A1D24" : "#1E2430";
  let borderLeft = activity.isRead ? "none" : `3px solid ${config.borderColor}`;
  const textColor = activity.isRead ? "#9CA3AF" : "#FFFFFF";
  const ctaColor = activity.isRead ? "#6B7280" : "#9CA3AF";

  if (isLettre) {
    containerBg = "rgba(230,51,41,0.08)";
    borderLeft = "4px solid #E63946";
  }

  const portal = activity.portal === "coach" ? "coach" as const : "recruiter" as const;

  return (
    <div
      className="flex items-start gap-3.5 px-5 py-4 rounded-lg transition-colors hover:brightness-110"
      style={{ backgroundColor: containerBg, borderLeft }}
    >
      {/* Icon in colored circle */}
      <div
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${activity.isRead ? "#6B7280" : config.borderColor}20` }}
      >
        <ActivityIcon
          name={config.icon}
          color={activity.isRead ? "#6B7280" : config.borderColor}
          size={18}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] leading-relaxed" style={{ color: textColor }}>
          <RichActivityMessage
            text={msg.text}
            entities={msg.entities}
            portal={portal}
          />
        </p>
        {activity.ctaLabel && activity.ctaRoute && (
          <Link
            href={activity.ctaRoute}
            className="inline-flex items-center gap-1 text-[13px] font-semibold mt-1.5 hover:underline"
            style={{ color: ctaColor }}
          >
            {activity.ctaLabel}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {/* Unread dot + timestamp */}
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        {!activity.isRead && (
          <div className="w-2 h-2 rounded-full bg-[#E63946]" />
        )}
        <span className="text-[12px] text-[#6B7280] whitespace-nowrap">
          {relTime}
        </span>
      </div>
    </div>
  );
}
