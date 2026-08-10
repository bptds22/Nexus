"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurActivitesMobile — iter 7.30b (Phase 1 unification)

   Feed mobile premium du recruteur : timeline depuis
   recruiter_activity_log (enrichi par migration 7.30a). Filtres pills
   scrollables horizontaux, groupement temporel (5 cohortes), cartes
   color-coded par action_type, navigation cible (athlète/liste/
   pipeline/conversation) avec back-nav lastRecruiterTab="activites".
   PRO-only via FeatureGate canon. Mark-all-read au mount.

   Phase 1 — la chrome (header sticky, pills, time-groups, skeleton,
   pagination, empty state, cards) vit dans ActivitiesPageShell. Ce
   fichier ne contient plus que les pièces SPÉCIFIQUES RECRUTEUR :
     - ACTION_VISUAL  : 17 action_types → {color, icon}
     - generateVerb   : phrase par action_type (athlete/list/coach interp)
     - getDestination : tap → route recruteur (athlete/liste/pipeline/msg)
     - FILTER_*       : 8 pills + leur set de members
     - emptyCopy      : libellé par filtre

   Recruiter output byte-identical avant/après Phase 1 — c'est un
   refactor, pas une refonte.
═══════════════════════════════════════════════════════════════ */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import FeatureGate from "@/components/subscription/FeatureGate";
import { useActivityList, type ActivityListItem } from "@/lib/queries/recruiter/useActivityList";
import { useMarkAllActivitiesRead } from "@/lib/queries/recruiter/useMarkAllActivitiesRead";
import {
  ActivitiesPageShell,
  type FilterOption,
  type EmptyCopy,
} from "@/components/shared/activities/ActivitiesPageShell";
import type { Visual } from "@/components/shared/activities/ActivityIcon";
import { triggerHaptic } from "@/components/shared/activities/utils";

/* ── Mapping action_type → visuel (couleur + icône SVG) ──────────
   Couleurs cohérentes avec ACTIVITY_TYPE_CONFIG desktop (canon 14.x)
   et étendues pour les nouveaux types loggés par migration 7.30a.
   Reste local au recruteur ; le coach a sa propre map. */

const ACTION_VISUAL: Record<string, Visual> = {
  NOTE_ADDED:               { color: "#F59E0B", icon: "file-text" },
  NOTE_UPDATED:             { color: "#F59E0B", icon: "file-text" },
  LIST_NOTE_ADDED:          { color: "#F59E0B", icon: "file-text" },
  FAVORITED:                { color: "#E63946", icon: "heart" },
  UNFAVORITED:              { color: "#9CA3AF", icon: "heart-broken" },
  PIPELINE_CHANGED:         { color: "#F59E0B", icon: "activity" },
  PROFILE_VIEWED:           { color: "#3B82F6", icon: "eye" },
  NEW_ATHLETE:              { color: "#E63946", icon: "user-plus" },
  VIDEO_ADDED:              { color: "#8B5CF6", icon: "film" },
  ATHLETE_VERIFIED:         { color: "#22C55E", icon: "check-circle" },
  PROFILE_UPDATED:          { color: "#3B82F6", icon: "refresh" },
  STATS_UPDATED:            { color: "#22C55E", icon: "bar-chart" },
  REVIEW_SUBMITTED:         { color: "#F59E0B", icon: "award" },
  COACH_REPLY:              { color: "#22C55E", icon: "reply" },
  LIST_CREATED:             { color: "#E63946", icon: "folder-plus" },
  ATHLETE_ADDED_TO_LIST:    { color: "#E63946", icon: "folder" },
  ATHLETE_REMOVED_FROM_LIST:{ color: "#9CA3AF", icon: "folder-minus" },
};

const DEFAULT_VISUAL: Visual = { color: "#6B7280", icon: "activity" };

function getVisual(actionType: string): Visual {
  return ACTION_VISUAL[actionType] ?? DEFAULT_VISUAL;
}

/* ── Labels d'étape pipeline (canon) ──────────────────────────── */

const STAGE_LABEL: Record<string, string> = {
  IDENTIFIE: "Identifié",
  CONTACTE: "Contacté",
  EN_DISCUSSION: "En discussion",
  VISITE_PLANIFIEE: "Visite planifiée",
  ENGAGE: "Engagé",
  LETTRE_SIGNEE: "Lettre signée",
};
const stage = (s: string | null) => (s ? STAGE_LABEL[s] ?? s : "");

/* ── Génération du verbe par action_type ─────────────────────── */

function generateVerb(item: ActivityListItem): string {
  const a = item.athleteName ?? "un athlète";
  const l = item.listName ? `« ${item.listName} »` : "une liste";
  switch (item.actionType) {
    case "NOTE_ADDED": return `Note ajoutée pour ${a}`;
    case "NOTE_UPDATED": return `Note mise à jour pour ${a}`;
    case "FAVORITED": return `${a} ajouté à tes favoris`;
    case "UNFAVORITED": return `${a} retiré de tes favoris`;
    case "PIPELINE_CHANGED": {
      if (item.beforeStage && item.newStage) {
        return `${a} : ${stage(item.beforeStage)} → ${stage(item.newStage)}`;
      }
      if (item.newStage) return `${a} → ${stage(item.newStage)}`;
      return `Processus de ${a} mis à jour`;
    }
    case "PROFILE_VIEWED": return `${a} a été consulté`;
    case "NEW_ATHLETE": return `Nouvel athlète : ${a}`;
    case "VIDEO_ADDED": return `Nouvelle vidéo sur ${a}`;
    case "ATHLETE_VERIFIED": return `${a} a été vérifié`;
    case "PROFILE_UPDATED": return `Profil de ${a} mis à jour`;
    case "STATS_UPDATED": return `Stats de ${a} mises à jour`;
    case "REVIEW_SUBMITTED": {
      const c = item.coachName ?? "un coach";
      const n = item.noteGlobale ? ` (${item.noteGlobale.toFixed(1)}/5)` : "";
      return `Tu as évalué ${c}${n}`;
    }
    case "COACH_REPLY": return `${item.coachName ?? "Un coach"} a répondu`;
    case "LIST_CREATED": return `Liste créée : ${l}`;
    case "LIST_NOTE_ADDED": return `Note ajoutée sur la liste ${l}`;
    case "ATHLETE_ADDED_TO_LIST": return `${a} ajouté à ${l}`;
    case "ATHLETE_REMOVED_FROM_LIST": return `${a} retiré de ${l}`;
    default: return `Activité : ${item.actionType.replace(/_/g, " ").toLowerCase()}`;
  }
}

/* ── Routing par action_type ────────────────────────────────── */

function getDestination(item: ActivityListItem): string | null {
  const listActions = ["LIST_CREATED", "ATHLETE_ADDED_TO_LIST", "ATHLETE_REMOVED_FROM_LIST", "LIST_NOTE_ADDED"];
  if (listActions.includes(item.actionType) && item.listId) {
    return `/recruteur/listes/${item.listId}`;
  }
  if (item.actionType === "COACH_REPLY" && item.conversationId) {
    return `/recruteur/messages?id=${item.conversationId}`;
  }
  if (item.actionType === "PIPELINE_CHANGED" && !item.athleteId) {
    return "/recruteur/pipeline";
  }
  if (item.athleteId) {
    return `/recruteur/athletes/${item.athleteId}`;
  }
  return null;
}

/* ── Filtres (iter 7.33 — catégories desktop, familiarité conservée) ─
   DIAG 7.32 a confirmé que le desktop a 14 pills (cf. ActivityFilters).
   On reprend l'ORDRE EXACT et le mapping EXACT desktop, MAIS :
    - On retire les 3 filtres MORTS côté recruteur (Messages, Lettres
      d'intention, Pipeline) — aucun action_type ne s'y range vraiment
      côté recruteur, c'est de la dette UX du desktop.
    - On RENOMME "Badges" en "Évaluations" (corrige la dette de nommage
      desktop : ce filtre contient REVIEW_SUBMITTED uniquement).
    - On REND les pills en STYLE iOS premium (slide assumé, App Store /
      Spotify look — pas de barre web dense).
   Mapping action_type → catégorie cohérent avec page.tsx desktop pour
   que "Notes" sur mobile retourne les mêmes lignes que "Notes" desktop. */

// Iter 7.34 Section B — BP retire Notes/Statistiques/Réponses → 8 pills.
// NOTE_ADDED/NOTE_UPDATED/LIST_CREATED/LIST_NOTE_ADDED/STATS_UPDATED/
// COACH_REPLY restent visibles dans "Tous" mais ne sont plus filtrables.
type FilterKey =
  | "tous"
  | "favoris"
  | "videos"
  | "evaluations"
  | "verifications"
  | "consultations"
  | "nouveauxathletes"
  | "misesajour";

const FILTER_OPTIONS: FilterOption<FilterKey>[] = [
  { value: "tous",             label: "Tous",              members: null },
  { value: "favoris",          label: "Favoris",           members: new Set(["FAVORITED", "UNFAVORITED", "ATHLETE_ADDED_TO_LIST", "ATHLETE_REMOVED_FROM_LIST"]) },
  { value: "videos",           label: "Vidéos",            members: new Set(["VIDEO_ADDED"]) },
  { value: "evaluations",      label: "Évaluations",       members: new Set(["REVIEW_SUBMITTED"]) },
  { value: "verifications",    label: "Vérifications",     members: new Set(["ATHLETE_VERIFIED"]) },
  { value: "consultations",    label: "Consultations",     members: new Set(["PROFILE_VIEWED", "PIPELINE_CHANGED"]) },
  { value: "nouveauxathletes", label: "Nouveaux athlètes", members: new Set(["NEW_ATHLETE"]) },
  { value: "misesajour",       label: "Mises à jour",      members: new Set(["PROFILE_UPDATED"]) },
];

const FILTER_LABEL_BY_KEY: Record<FilterKey, string> = Object.fromEntries(
  FILTER_OPTIONS.map((o) => [o.value, o.label]),
) as Record<FilterKey, string>;

function emptyCopy(filter: FilterKey): EmptyCopy {
  const label = filter === "tous" ? "" : ` « ${FILTER_LABEL_BY_KEY[filter]} »`;
  return {
    image: "/empty/nexus-empty-shortlist.png",
    title: `Aucune activité${label}`,
    description: "L'activité apparaîtra ici dès qu'un coach met à jour un athlète, que tu ajoutes une note, ou que tu organises tes prospects.",
  };
}

/* ── Inner (PRO-gated content) ───────────────────────────────── */

function ActivitesInner() {
  const router = useRouter();
  const { data: items = [], isLoading, isError, refetch } = useActivityList();
  const markAllMut = useMarkAllActivitiesRead();

  const handleMount = useCallback(() => {
    // Iter 7.30b — auto mark-all-read au mount (pattern desktop). Vide le
    // badge sidebar.
    markAllMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = useCallback((_item: ActivityListItem, destination: string) => {
    triggerHaptic("Light");
    try { sessionStorage.setItem("lastRecruiterTab", "activites"); } catch { /* no-op */ }
    router.push(destination);
  }, [router]);

  return (
    <ActivitiesPageShell<ActivityListItem, FilterKey>
      items={items}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
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

/* ── Outer (PRO gate canon) ─────────────────────────────────── */

export function RecruteurActivitesMobile() {
  return (
    <FeatureGate feature="activity_feed" requiredTier="pro">
      <ActivitesInner />
    </FeatureGate>
  );
}
