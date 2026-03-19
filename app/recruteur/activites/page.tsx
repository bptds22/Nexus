"use client";

import ActivityFeedFull from "@/app/components/activities/ActivityFeedFull";
import { RECRUITER_ACTIVITIES } from "@/lib/mock/activities";

/* ═══════════════════════════════════════════════════════════════
   Recruiter Activités — full-page activity feed.
═══════════════════════════════════════════════════════════════ */

export default function RecruteurActivitesPage() {
  return (
    <ActivityFeedFull
      activities={RECRUITER_ACTIVITIES}
      portal="recruiter"
      title="Activités"
      subtitle="Toute l'activité autour de vos favoris et messages"
    />
  );
}
