"use client";

import ActivityFeedFull from "@/app/components/activities/ActivityFeedFull";
import { COACH_ACTIVITIES } from "@/lib/mock/activities";

/* ═══════════════════════════════════════════════════════════════
   Coach Activités — full-page activity feed.
═══════════════════════════════════════════════════════════════ */

export default function CoachActivitesPage() {
  return (
    <ActivityFeedFull
      activities={COACH_ACTIVITIES}
      portal="coach"
      title="Activités"
      subtitle="Toute l'activité autour de tes athlètes"
    />
  );
}
