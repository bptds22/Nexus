"use client";

import type { ActivityType } from "@/lib/types/activity";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/types/activity";

/* ─────────────────────────────────────────────────────────────────
   ActivityFilters — horizontal pill bar for the activities page.
   "Tous" + unique filter labels derived from ACTIVITY_TYPE_CONFIG.
───────────────────────────────────────────────────────────────── */

export type FilterValue = "tous" | ActivityType;

interface FilterPill {
  key: FilterValue;
  label: string;
}

export function getFilterPills(portal: "coach" | "recruiter"): FilterPill[] {
  const pills: FilterPill[] = [{ key: "tous", label: "Tous" }];

  // Deduplicate by label (some types share the same label like "Nouveaux athlètes")
  const seen = new Set<string>();
  const typeEntries = Object.entries(ACTIVITY_TYPE_CONFIG) as [ActivityType, { label: string }][];

  // Filter types relevant per portal
  const coachExclude: ActivityType[] = ["new_athlete_in_sport", "favorite_profile_updated", "favorite_stats_updated", "coach_response"];
  const recruiterExclude: ActivityType[] = ["profile_incomplete", "athlete_added"];

  for (const [type, config] of typeEntries) {
    if (portal === "coach" && coachExclude.includes(type)) continue;
    if (portal === "recruiter" && recruiterExclude.includes(type)) continue;
    if (seen.has(config.label)) continue;
    seen.add(config.label);
    pills.push({ key: type, label: config.label });
  }

  return pills;
}

interface ActivityFiltersProps {
  pills: FilterPill[];
  active: FilterValue;
  onChange: (val: FilterValue) => void;
}

export default function ActivityFilters({ pills, active, onChange }: ActivityFiltersProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
      {pills.map((pill) => {
        const isActive = active === pill.key;
        return (
          <button
            key={pill.key}
            type="button"
            onClick={() => onChange(pill.key)}
            className={`px-4 py-2.5 rounded-full text-[13px] font-bold tracking-wide whitespace-nowrap transition-all ${
              isActive
                ? "bg-[#E63946] text-white"
                : "bg-transparent border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56]"
            }`}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
