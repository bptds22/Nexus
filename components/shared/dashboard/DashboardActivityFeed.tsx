"use client";

/* ═══════════════════════════════════════════════════════════════
   DashboardActivityFeed — shared activity feed list.

   Replaces the duplicated ActivityFeedItem + ActivityFeedList in
   both dashboards. Pure presentational : `activities` + tap
   handler come from the parent ; no fetching here.

   Each item : initials avatar with ring-accent (iconColor),
   athlete name, verb (via shared activityVerb), relative time.
   "Aucune activité récente." empty state.

   The "Voir toutes les activités" CTA is owned by the parent
   (different routes per role).
═══════════════════════════════════════════════════════════════ */

import type { ActivityEvent } from "@/lib/types/activityEvents";
import { activityVerb, getInitials, triggerHaptic } from "./utils";

function DashboardActivityFeedItem({
  activity, isLast, onTap,
}: {
  activity: ActivityEvent;
  isLast: boolean;
  onTap: () => void;
}) {
  const initials = getInitials(activity.athleteName);
  const accent = activity.iconColor || "#6B7280";
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className={`w-full text-left py-4 active:opacity-60 transition-opacity ${isLast ? "" : "border-b border-white/[0.06]"}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white/[0.06]"
          style={{ boxShadow: `inset 0 0 0 1.5px ${accent}` }}
        >
          <span className="text-[12px] font-bold text-white/80 tracking-wide">{initials}</span>
        </div>
        <div className="flex-1 flex items-baseline justify-between gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-white truncate">
              {activity.athleteName || "Athlète"}
            </p>
            <p className="text-[15px] text-white/55 mt-0.5 truncate">{activityVerb(activity)}</p>
          </div>
          <span className="text-sm text-white/40 flex-shrink-0 whitespace-nowrap">
            {activity.relativeTime}
          </span>
        </div>
      </div>
    </button>
  );
}

export interface DashboardActivityFeedProps {
  activities: ActivityEvent[];
  onItemTap: (athleteId: string | undefined) => void;
  /** Max items to show (default 5). */
  limit?: number;
  /** Title for the feed (default "Activité récente"). */
  title?: string;
}

export function DashboardActivityFeed({
  activities, onItemTap, limit = 5, title = "Activité récente",
}: DashboardActivityFeedProps) {
  const visible = activities.slice(0, limit);
  return (
    <div className="px-4">
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-5">
        {title}
      </h2>
      {visible.length === 0 ? (
        <p className="text-sm text-white/40 italic">Aucune activité récente.</p>
      ) : (
        <div>
          {visible.map((a, idx) => (
            <DashboardActivityFeedItem
              key={a.id}
              activity={a}
              isLast={idx === visible.length - 1}
              onTap={() => onItemTap(a.athleteId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
