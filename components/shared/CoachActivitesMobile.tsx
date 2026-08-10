"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachActivitesMobile — Phase 2 (coach mirror of RecruteurActivitesMobile).

   Mobile-native activity feed for the coach, consuming the same
   ActivitiesPageShell the recruiter consumes. Only the role-specific
   bits live here :
     - ACTION_VISUAL : 13 coach action_types → {color, icon}
     - generateVerb  : phrase from the COACH's perspective (things
                       happening TO their athletes : recruiter
                       favorited them, profile viewed, video added,
                       badge earned, status changed, etc.)
     - getDestination: NEW_MESSAGE → coach thread ; athlete events →
                       /coach/athletes/[id] ; admin broadcast → no nav
     - FILTER_*      : 5 simpler pills (Tous / Messages / Favoris /
                       Pipeline / Athlètes) — lighter than recruiter's 8
     - onMount       : useMarkAllCoachActivitiesRead (writes
                       activities.read=true)

   NO FeatureGate — coach activities are free per CLAUDE.md baseline.

   Data : public.activities WHERE coach_id = auth.uid() via
   useCoachActivityList ([activity-feed, coach, userId]).
═══════════════════════════════════════════════════════════════ */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCoachActivityList, type CoachActivityItem } from "@/lib/queries/coach/useCoachActivityList";
import { useMarkAllCoachActivitiesRead } from "@/lib/queries/coach/useMarkAllCoachActivitiesRead";
import {
  ActivitiesPageShell,
  type FilterOption,
  type EmptyCopy,
} from "@/components/shared/activities/ActivitiesPageShell";
import type { Visual } from "@/components/shared/activities/ActivityIcon";
import { triggerHaptic } from "@/components/shared/activities/utils";

/* ── Mapping action_type → visuel (couleur + icône SVG) ──────────
   13 types per activities_type_check (baseline.sql:1184). Couleurs
   alignées sur la map recruteur quand le concept se recouvre (heart
   = favorited, eye = profile_viewed) + des accents coach-spécifiques
   (message-circle pour NEW_MESSAGE, award pour BADGE_EARNED, bell
   pour ADMIN_BROADCAST). */

const ACTION_VISUAL: Record<string, Visual> = {
  NEW_MESSAGE:       { color: "#22C55E", icon: "message-circle" },
  FAVORITED:         { color: "#E63946", icon: "heart" },
  PROFILE_VIEWED:    { color: "#3B82F6", icon: "eye" },
  STATUS_CHANGED:    { color: "#F59E0B", icon: "trending-up" },
  PIPELINE_CHANGED:  { color: "#F59E0B", icon: "activity" },
  BADGE_EARNED:      { color: "#F59E0B", icon: "award" },
  PROFILE_VERIFIED:  { color: "#22C55E", icon: "check-circle" },
  VIDEO_ADDED:       { color: "#8B5CF6", icon: "film" },
  PROFILE_UPDATED:   { color: "#3B82F6", icon: "refresh" },
  PROFILE_MODIFIED:  { color: "#3B82F6", icon: "refresh" },
  ATHLETE_ADDED:     { color: "#E63946", icon: "user-plus" },
  NEW_ATHLETE:       { color: "#E63946", icon: "user-plus" },
  ADMIN_BROADCAST:   { color: "#9CA3AF", icon: "bell" },
};

const DEFAULT_VISUAL: Visual = { color: "#6B7280", icon: "activity" };

function getVisual(actionType: string): Visual {
  return ACTION_VISUAL[actionType] ?? DEFAULT_VISUAL;
}

/* ── Status / stage labels (canon) ────────────────────────────── */

const STAGE_LABEL: Record<string, string> = {
  IDENTIFIE: "Identifié",
  CONTACTE: "Contacté",
  EN_DISCUSSION: "En discussion",
  VISITE_PLANIFIEE: "Visite planifiée",
  ENGAGE: "Engagé",
  LETTRE_SIGNEE: "Lettre signée",
};
const stage = (s: string | null) => (s ? STAGE_LABEL[s] ?? s : "");

/* ── Génération du verbe (perspective COACH) ─────────────────── */

function generateVerb(item: CoachActivityItem): string {
  const a = item.athleteName ?? "un athlète";
  const ap = item.athletePosition ? `${a} (${item.athletePosition})` : a;
  switch (item.actionType) {
    case "NEW_MESSAGE": {
      const rec = item.recruiterName || "Un recruteur";
      const cegep = item.cegepName ? ` (${item.cegepName})` : "";
      return `${rec}${cegep} a écrit au sujet de ${a}`;
    }
    case "FAVORITED":
      return `${a} a été ajouté aux favoris d'un recruteur`;
    case "PROFILE_VIEWED":
      return `Le profil de ${a} a été consulté`;
    case "STATUS_CHANGED": {
      if (item.newStatus === "LETTRE_SIGNEE") return `${a} a signé une lettre d'intention`;
      if (item.newStatus) return `${a} : ${stage(item.newStatus)}`;
      return `Statut de ${a} mis à jour`;
    }
    case "PIPELINE_CHANGED": {
      if (item.newStatus) return `${a} : ${stage(item.newStatus)}`;
      return `Processus de ${a} mis à jour`;
    }
    case "BADGE_EARNED":
      return `${a} a obtenu le badge « ${item.badgeName ?? "—"} »`;
    case "PROFILE_VERIFIED":
      return `${a} a été vérifié`;
    case "VIDEO_ADDED":
      return `Nouvelle vidéo sur ${ap}`;
    case "PROFILE_UPDATED":
    case "PROFILE_MODIFIED":
      return `Profil de ${a} mis à jour`;
    case "ATHLETE_ADDED":
    case "NEW_ATHLETE":
      return `${a} ajouté à ton programme`;
    case "ADMIN_BROADCAST":
      return "Annonce Nexus";
    default:
      return `Activité : ${item.actionType.replace(/_/g, " ").toLowerCase()}`;
  }
}

/* ── Routing par action_type ────────────────────────────────── */

function getDestination(item: CoachActivityItem): string | null {
  if (item.actionType === "NEW_MESSAGE" && item.conversationId) {
    return `/coach/demandes?id=${item.conversationId}`;
  }
  if (item.actionType === "ADMIN_BROADCAST") {
    // Annonces : pas de cible cliquable pour l'instant.
    return null;
  }
  if (item.athleteId) {
    return `/coach/athletes/${item.athleteId}`;
  }
  return null;
}

/* ── Filtres COACH (4 catégories simples) ───────────────────────
   "Pipeline" pill removed — pipeline is a recruiter concept, not a
   coach one. The underlying STATUS_CHANGED / PIPELINE_CHANGED events
   (incl. the LETTRE_SIGNEE special-case the verb generator handles)
   are folded into "Athlètes" since they ARE things happening TO the
   coach's athletes — the coach can still find them by tapping
   Athlètes. They also remain visible under "Tous" (Tous = no
   filter). The verb generator + destination resolver are unchanged. */

type FilterKey = "tous" | "messages" | "favoris" | "athletes";

const FILTER_OPTIONS: FilterOption<FilterKey>[] = [
  { value: "tous",     label: "Tous",     members: null },
  { value: "messages", label: "Messages", members: new Set(["NEW_MESSAGE"]) },
  { value: "favoris",  label: "Favoris",  members: new Set(["FAVORITED"]) },
  {
    value: "athletes",
    label: "Athlètes",
    members: new Set([
      "ATHLETE_ADDED", "NEW_ATHLETE",
      "VIDEO_ADDED",
      "PROFILE_UPDATED", "PROFILE_MODIFIED",
      "PROFILE_VERIFIED", "BADGE_EARNED",
      "PROFILE_VIEWED",
      // Status / pipeline events fall here too — coach perspective :
      // "ton athlète a signé une lettre" is an athlete event, not a
      // pipeline concept.
      "STATUS_CHANGED", "PIPELINE_CHANGED",
    ]),
  },
];

const FILTER_LABEL_BY_KEY: Record<FilterKey, string> = Object.fromEntries(
  FILTER_OPTIONS.map((o) => [o.value, o.label]),
) as Record<FilterKey, string>;

function emptyCopy(filter: FilterKey): EmptyCopy {
  const label = filter === "tous" ? "" : ` « ${FILTER_LABEL_BY_KEY[filter]} »`;
  return {
    image: "/empty/nexus-empty-shortlist.png",
    title: `Aucune activité${label}`,
    description: "L'activité apparaîtra ici dès qu'un recruteur s'intéresse à un de tes athlètes ou qu'un athlète met à jour son profil.",
  };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function CoachActivitesMobile() {
  const router = useRouter();
  const { data: items = [], isLoading } = useCoachActivityList();
  const markAllMut = useMarkAllCoachActivitiesRead();

  const handleMount = useCallback(() => {
    markAllMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = useCallback((_item: CoachActivityItem, destination: string) => {
    triggerHaptic("Light");
    try { sessionStorage.setItem("lastCoachTab", "activites"); } catch { /* no-op */ }
    router.push(destination);
  }, [router]);

  return (
    <ActivitiesPageShell<CoachActivityItem, FilterKey>
      items={items}
      isLoading={isLoading}
      title="Activité"
      getId={(it) => it.id}
      getCreatedAt={(it) => it.createdAt}
      getActionType={(it) => it.actionType}
      getVerb={generateVerb}
      getDestination={getDestination}
      getVisual={getVisual}
      filterOptions={FILTER_OPTIONS}
      onMount={handleMount}
      onTapItem={handleTap}
      emptyCopy={emptyCopy}
      pageSize={30}
    />
  );
}
