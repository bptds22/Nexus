"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ActivityFeedFull from "@/app/components/activities/ActivityFeedFull";
import type { Activity, ActivityType } from "@/lib/types/activity";
import { CoachActivitesMobile } from "@/components/shared/CoachActivitesMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Coach Activités — full-page activity feed wired to Supabase.

   Phase 2 — sur Capacitor, dispatch vers CoachActivitesMobile qui
   consomme le shell partagé ActivitiesPageShell (extrait du recruteur
   en Phase 1). Pas de FeatureGate ici : coach activities sont free
   par canon (CLAUDE.md baseline coach).
═══════════════════════════════════════════════════════════════ */

/** Map DB activity type → Activity type */
function mapType(dbType: string): ActivityType {
  const MAP: Record<string, ActivityType> = {
    NEW_MESSAGE: "message_received",
    FAVORITED: "athlete_favorited",
    VIDEO_ADDED: "video_added",
    BADGE_EARNED: "badge_earned",
    PROFILE_VERIFIED: "profile_verified",
    PROFILE_MODIFIED: "profile_viewed",
    PROFILE_VIEWED: "profile_viewed",
    PROFILE_UPDATED: "profile_viewed",
    ATHLETE_ADDED: "athlete_added",
    NEW_ATHLETE: "athlete_added",
    STATUS_CHANGED: "status_changed",
    PIPELINE_CHANGED: "status_changed",
    LETTRE_SIGNEE: "letter_of_intent",
  };
  return MAP[dbType] || "profile_viewed";
}

/** Build display text from DB activity */
function buildMessage(dbType: string, athleteName: string, position: string, meta: Record<string, unknown>): string {
  const ap = position ? `${athleteName} (${position})` : athleteName;
  switch (dbType) {
    case "NEW_MESSAGE":
      return `${(meta.recruiter_name as string) || "Un recruteur"} (${(meta.cegep_name as string) || "CÉGEP"}) a envoyé un message concernant ${ap}`;
    case "FAVORITED":
      return `${ap} a été ajouté aux favoris par un recruteur`;
    case "VIDEO_ADDED":
      return `Une nouvelle vidéo a été ajoutée au profil de ${ap}`;
    case "PROFILE_VERIFIED":
      return `Le profil de ${ap} a été vérifié`;
    case "BADGE_EARNED":
      return `${ap} a obtenu le badge « ${(meta.badge_name as string) || "—"} »`;
    case "STATUS_CHANGED":
    case "LETTRE_SIGNEE":
      if ((meta.new_status as string) === "LETTRE_SIGNEE") return `${ap} a signé une lettre d'intention`;
      return `${ap} a changé de statut`;
    case "ATHLETE_ADDED":
      return `${ap} a été ajouté à votre liste`;
    case "PROFILE_MODIFIED":
      return `Un nouveau rapport de dépistage est disponible pour ${ap}`;
    default:
      return `Activité pour ${ap}`;
  }
}

function buildCtaLabel(dbType: string): string {
  switch (dbType) {
    case "NEW_MESSAGE": return "Voir la conversation";
    case "VIDEO_ADDED": return "Regarder la vidéo";
    case "PROFILE_MODIFIED": return "Lire le rapport";
    default: return "Voir le profil";
  }
}

export default function CoachActivitesPage() {
  // Phase 2 — mobile early return AVANT le rendu desktop. Le mobile
  // gère son propre data layer (useCoachActivityList) et mark-all-read.
  if (IS_CAPACITOR) return <CoachActivitesMobile />;
  return <CoachActivitesDesktop />;
}

function CoachActivitesDesktop() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachId, setCoachId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setCoachId(user.id);

      const { data, error } = await supabase
        .from("activities")
        .select("*, athletes(first_name, last_name, position_id, positions!position_id(nom, abreviation))")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (data) {
        const mapped: Activity[] = data.map((row: Record<string, unknown>) => {
          const dbType = (row.type as string) || "";
          const meta = (row.metadata as Record<string, unknown>) || {};
          const athleteRaw = row.athletes as Record<string, unknown> | null;
          const posRaw = athleteRaw?.positions;
          const pos = Array.isArray(posRaw) ? posRaw[0] : posRaw;
          const posObj = pos as { abreviation?: string; nom?: string } | null;
          const position = posObj?.abreviation || posObj?.nom || "";
          const athleteName = athleteRaw
            ? `${(athleteRaw.first_name as string) || ""} ${(athleteRaw.last_name as string) || ""}`.trim()
            : "";
          const athleteId = (row.athlete_id as string) || "";

          const ctaRoute = dbType === "NEW_MESSAGE" && meta.conversation_id
            ? `/coach/demandes?id=${meta.conversation_id as string}`
            : `/coach/athletes/${athleteId}`;

          return {
            id: row.id as string,
            type: mapType(dbType),
            portal: "coach" as const,
            timestamp: (row.created_at as string) || "",
            isRead: !!(row.read),
            athleteId,
            athleteName,
            athletePosition: position,
            recruiterName: (meta.recruiter_name as string) || undefined,
            cegepName: (meta.cegep_name as string) || undefined,
            badgeName: (meta.badge_name as string) || undefined,
            messagePreview: buildMessage(dbType, athleteName, position, meta),
            ctaLabel: buildCtaLabel(dbType),
            ctaRoute,
            isHighlighted: dbType === "STATUS_CHANGED" || dbType === "LETTRE_SIGNEE",
          };
        });
        setActivities(mapped);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto flex items-center justify-center">
        <p className="text-[#6B7280] text-sm py-20">Chargement des activités...</p>
      </div>
    );
  }

  const markRead = async (id: string) => {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    const supabase = createClient();
    await supabase.from("activities").update({ read: true }).eq("id", id);
    window.dispatchEvent(new Event("activities-updated"));
  };

  const markAllRead = async () => {
    if (!coachId) return;
    setActivities((prev) => prev.map((a) => ({ ...a, isRead: true })));
    const supabase = createClient();
    await supabase
      .from("activities")
      .update({ read: true })
      .eq("coach_id", coachId)
      .eq("read", false);
    window.dispatchEvent(new Event("activities-updated"));
  };

  return (
    <ActivityFeedFull
      activities={activities}
      portal="coach"
      title="Activités"
      subtitle="Toute l'activité autour de tes athlètes"
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
    />
  );
}
