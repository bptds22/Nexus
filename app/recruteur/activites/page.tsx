"use client";

import { useState, useEffect } from "react";
import ActivityFeedFull from "@/app/components/activities/ActivityFeedFull";
import type { Activity, ActivityType } from "@/lib/types/activity";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   Recruiter Activités — wired to recruiter_activity_log
   Falls back to direct table queries if activity_log is empty
═══════════════════════════════════════════════════════════════ */

const ACTION_TO_TYPE: Record<string, ActivityType> = {
  NOTE_ADDED: "scouting_report",
  NOTE_UPDATED: "scouting_report",
  FAVORITED: "athlete_favorited",
  UNFAVORITED: "athlete_favorited",
  PIPELINE_CHANGED: "profile_viewed",
  PROFILE_VIEWED: "profile_viewed",
  NEW_ATHLETE: "new_athlete_in_sport",
  PROFILE_UPDATED: "favorite_profile_updated",
  VIDEO_ADDED: "video_added",
  ATHLETE_VERIFIED: "profile_verified",
  STATS_UPDATED: "favorite_stats_updated",
  REVIEW_SUBMITTED: "badge_earned",
  COACH_REPLY: "coach_response",
  LIST_CREATED: "scouting_report",
  LIST_NOTE_ADDED: "scouting_report",
  ATHLETE_ADDED_TO_LIST: "athlete_favorited",
  ATHLETE_REMOVED_FROM_LIST: "athlete_favorited",
};

const ACTION_LABELS: Record<string, { ctaLabel: string; ctaBase: string }> = {
  NOTE_ADDED: { ctaLabel: "Voir la note", ctaBase: "/recruteur/athletes/" },
  FAVORITED: { ctaLabel: "Voir le profil", ctaBase: "/recruteur/athletes/" },
  PIPELINE_CHANGED: { ctaLabel: "Voir le pipeline", ctaBase: "/recruteur/pipeline" },
  PROFILE_VIEWED: { ctaLabel: "Voir le profil", ctaBase: "/recruteur/athletes/" },
  NEW_ATHLETE: { ctaLabel: "Voir le profil", ctaBase: "/recruteur/athletes/" },
  VIDEO_ADDED: { ctaLabel: "Voir la vidéo", ctaBase: "/recruteur/athletes/" },
  ATHLETE_VERIFIED: { ctaLabel: "Voir le profil", ctaBase: "/recruteur/athletes/" },
  STATS_UPDATED: { ctaLabel: "Voir les stats", ctaBase: "/recruteur/athletes/" },
  PROFILE_UPDATED: { ctaLabel: "Voir le profil", ctaBase: "/recruteur/athletes/" },
  REVIEW_SUBMITTED: { ctaLabel: "Voir l'évaluation", ctaBase: "/recruteur/messages" },
  COACH_REPLY: { ctaLabel: "Voir la réponse", ctaBase: "/recruteur/messages" },
};

export default function RecruteurActivitesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Try recruiter_activity_log first
      const { data: logData, error: logErr } = await supabase
        .from("recruiter_activity_log")
        .select("id, action_type, details, read, created_at, athlete_id, recruiter_id")
        .eq("recruiter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      console.log("[Activities log]", { count: logData?.length, error: logErr });

      if (logData && logData.length > 0) {
        // Get athlete names for all referenced athletes
        const athleteIds = [...new Set(logData.map(l => l.athlete_id).filter(Boolean))];
        const athleteMap = new Map<string, { name: string; pos: string }>();
        if (athleteIds.length > 0) {
          const { data: athData } = await supabase
            .from("athletes")
            .select("id, first_name, last_name, positions!position_id(abreviation)")
            .in("id", athleteIds);
          if (athData) {
            for (const a of athData as Record<string, unknown>[]) {
              const posRel = a.positions;
              const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
              athleteMap.set(a.id as string, {
                name: `${a.first_name || ""} ${a.last_name || ""}`.trim(),
                pos: pos?.abreviation || "",
              });
            }
          }
        }

        // Get coach names for reviews
        const coachIds = logData
          .filter(l => l.details?.coach_id)
          .map(l => l.details.coach_id as string);
        const coachMap = new Map<string, string>();
        if (coachIds.length > 0) {
          const { data: coachData } = await supabase
            .from("users")
            .select("id, first_name, last_name")
            .in("id", [...new Set(coachIds)]);
          if (coachData) {
            for (const c of coachData) coachMap.set(c.id, `${c.first_name || ""} ${c.last_name || ""}`.trim());
          }
        }

        const mapped: Activity[] = logData.map(log => {
          const details = (log.details || {}) as Record<string, unknown>;
          const athlete = athleteMap.get(log.athlete_id || "");
          const athleteName = athlete?.name || `${details.first_name || ""} ${details.last_name || ""}`.trim();
          const athletePos = athlete?.pos || "";
          const coachName = coachMap.get((details.coach_id as string) || "");
          const actionType = log.action_type as string;
          const cfg = ACTION_LABELS[actionType] || { ctaLabel: "Voir", ctaBase: "/recruteur" };
          const needsAthleteId = cfg.ctaBase.endsWith("/");
          const stageLabel = details.new_stage ? (({
            IDENTIFIE: "Identifié", CONTACTE: "Contacté", EN_DISCUSSION: "En discussion",
            VISITE_PLANIFIEE: "Visite planifiée", ENGAGE: "Engagé", LETTRE_SIGNEE: "Lettre signée",
          } as Record<string, string>)[details.new_stage as string] || details.new_stage) : "";

          return {
            id: log.id,
            type: ACTION_TO_TYPE[actionType] || "profile_viewed",
            portal: "recruiter" as const,
            timestamp: log.created_at,
            isRead: log.read || false,
            athleteId: log.athlete_id || undefined,
            athleteName: athleteName || undefined,
            athletePosition: athletePos || undefined,
            coachName: coachName || undefined,
            messagePreview: actionType === "PIPELINE_CHANGED" && stageLabel ? `Pipeline: ${stageLabel}` : undefined,
            ctaLabel: actionType === "PIPELINE_CHANGED" && stageLabel ? `Pipeline: ${stageLabel}` : cfg.ctaLabel,
            ctaRoute: needsAthleteId ? `${cfg.ctaBase}${log.athlete_id || ""}` : cfg.ctaBase,
          };
        });

        // Mark recent as unread for visual emphasis
        const oneDayAgo = Date.now() - 86400000;
        for (const item of mapped) {
          if (!item.isRead && new Date(item.timestamp).getTime() > oneDayAgo) {
            item.isRead = false;
          }
        }

        setActivities(mapped);
        setLoading(false);
        return;
      }

      // FALLBACK: Direct table queries (same as before)
      const all: Activity[] = [];

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, content, created_at, sender_id, conversation_id")
        .neq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (msgs) {
        const convIds = [...new Set(msgs.map(m => m.conversation_id))];
        const convMap = new Map<string, { coachName: string; athleteName: string; athletePos: string; athleteId: string }>();
        if (convIds.length > 0) {
          const { data: convs } = await supabase
            .from("conversations")
            .select("id, coach:users!coach_id(first_name, last_name), athlete:athletes!athlete_id(id, first_name, last_name, positions!position_id(abreviation))")
            .in("id", convIds);
          if (convs) {
            for (const c of convs as Record<string, unknown>[]) {
              const coach = (Array.isArray(c.coach) ? c.coach[0] : c.coach) as Record<string, unknown> | null;
              const athlete = (Array.isArray(c.athlete) ? c.athlete[0] : c.athlete) as Record<string, unknown> | null;
              const posRel = athlete?.positions;
              const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
              convMap.set(c.id as string, {
                coachName: `${coach?.first_name || ""} ${coach?.last_name || ""}`.trim(),
                athleteName: `${athlete?.first_name || ""} ${athlete?.last_name || ""}`.trim(),
                athletePos: pos?.abreviation || "",
                athleteId: (athlete?.id as string) || "",
              });
            }
          }
        }
        for (const m of msgs) {
          const ctx = convMap.get(m.conversation_id);
          all.push({
            id: `msg-${m.id}`, type: "message_received", portal: "recruiter", timestamp: m.created_at, isRead: false,
            coachName: ctx?.coachName, athleteName: ctx?.athleteName, athletePosition: ctx?.athletePos, athleteId: ctx?.athleteId,
            messagePreview: (m.content as string)?.slice(0, 80), ctaLabel: "Voir la conversation", ctaRoute: `/recruteur/messages/${m.conversation_id}`,
          });
        }
      }

      const { data: favs } = await supabase
        .from("recruiter_favorites")
        .select("id, created_at, athlete_id, athletes!athlete_id(id, first_name, last_name, positions!position_id(abreviation))")
        .eq("recruiter_id", user.id).order("created_at", { ascending: false }).limit(10);
      if (favs) {
        for (const f of favs as Record<string, unknown>[]) {
          const a = (Array.isArray(f.athletes) ? f.athletes[0] : f.athletes) as Record<string, unknown> | null;
          const pos = ((Array.isArray(a?.positions) ? (a?.positions as unknown[])[0] : a?.positions) as { abreviation?: string } | null);
          all.push({
            id: `fav-${f.id}`, type: "athlete_favorited", portal: "recruiter", timestamp: f.created_at as string, isRead: true,
            athleteId: (a?.id as string) || (f.athlete_id as string), athleteName: `${a?.first_name || ""} ${a?.last_name || ""}`.trim(),
            athletePosition: pos?.abreviation || "", ctaLabel: "Voir le profil", ctaRoute: `/recruteur/athletes/${(a?.id as string) || f.athlete_id}`,
          });
        }
      }

      const { data: pipes } = await supabase
        .from("recruiter_pipeline")
        .select("id, stage, updated_at, athlete_id, athletes!athlete_id(id, first_name, last_name, positions!position_id(abreviation))")
        .eq("recruiter_id", user.id).order("updated_at", { ascending: false }).limit(10);
      if (pipes) {
        const sl: Record<string, string> = { IDENTIFIE: "Identifié", CONTACTE: "Contacté", EN_DISCUSSION: "En discussion", VISITE_PLANIFIEE: "Visite planifiée", ENGAGE: "Engagé", LETTRE_SIGNEE: "Lettre signée" };
        for (const p of pipes as Record<string, unknown>[]) {
          const a = (Array.isArray(p.athletes) ? p.athletes[0] : p.athletes) as Record<string, unknown> | null;
          const pos = ((Array.isArray(a?.positions) ? (a?.positions as unknown[])[0] : a?.positions) as { abreviation?: string } | null);
          all.push({
            id: `pipe-${p.id}`, type: "profile_viewed", portal: "recruiter", timestamp: (p.updated_at as string) || "", isRead: true,
            athleteId: (a?.id as string), athleteName: `${a?.first_name || ""} ${a?.last_name || ""}`.trim(),
            athletePosition: pos?.abreviation || "", ctaLabel: `Pipeline: ${sl[(p.stage as string)] || p.stage}`, ctaRoute: "/recruteur/pipeline",
          });
        }
      }

      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const oneDayAgo = Date.now() - 86400000;
      for (const item of all) { if (new Date(item.timestamp).getTime() > oneDayAgo) item.isRead = false; }

      console.log("[Activities fallback]", { total: all.length });
      setActivities(all);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>;
  }

  return (
    <ActivityFeedFull
      activities={activities}
      portal="recruiter"
      title="Activités"
      subtitle="Toute l'activité autour de vos favoris et messages"
    />
  );
}
