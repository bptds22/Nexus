"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurActivitesMobile — iter 7.30b
   Feed mobile premium du recruteur : timeline depuis
   recruiter_activity_log (enrichi par migration 7.30a). Filtres pills
   scrollables horizontaux, groupement temporel (5 cohortes), cartes
   color-coded par action_type, navigation cible (athlète/liste/
   pipeline/conversation) avec back-nav lastRecruiterTab="activites".
   PRO-only via FeatureGate canon. Mark-all-read au mount.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import FeatureGate from "@/components/subscription/FeatureGate";
import { useActivityList, type ActivityListItem } from "@/lib/queries/recruiter/useActivityList";
import { useMarkAllActivitiesRead } from "@/lib/queries/recruiter/useMarkAllActivitiesRead";
import { formatRelativeDate } from "@/lib/utils/formatRelativeDate";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

/* ── Mapping action_type → visuel (couleur + icône SVG) ──────────
   Couleurs cohérentes avec ACTIVITY_TYPE_CONFIG desktop (canon 14.x)
   et étendues pour les nouveaux types loggés par migration 7.30a. */

interface Visual { color: string; icon: string }

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

function ActionIcon({ name, color, size = 20 }: { name: string; color: string; size?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "file-text": return (<svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>);
    case "heart": return (<svg {...p} fill={color} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>);
    case "heart-broken": return (<svg {...p}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /><path d="M12 5.67l-2 4 4 2-2 4" /></svg>);
    case "activity": return (<svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>);
    case "eye": return (<svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>);
    case "user-plus": return (<svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>);
    case "film": return (<svg {...p}><rect x="2" y="2" width="20" height="20" rx="2.18" /><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5" /></svg>);
    case "check-circle": return (<svg {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>);
    case "refresh": return (<svg {...p}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>);
    case "bar-chart": return (<svg {...p}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>);
    case "award": return (<svg {...p}><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>);
    case "reply": return (<svg {...p}><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>);
    case "folder-plus": return (<svg {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>);
    case "folder": return (<svg {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>);
    case "folder-minus": return (<svg {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="9" y1="14" x2="15" y2="14" /></svg>);
    default: return (<svg {...p}><circle cx="12" cy="12" r="10" /></svg>);
  }
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
      return `Pipeline de ${a} mis à jour`;
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
    return `/recruteur/messages/${item.conversationId}`;
  }
  if (item.actionType === "PIPELINE_CHANGED" && !item.athleteId) {
    return "/recruteur/pipeline";
  }
  if (item.athleteId) {
    return `/recruteur/athletes/${item.athleteId}`;
  }
  return null;
}

/* ── Groupement temporel (5 cohortes mobile) ─────────────────── */

type TimeGroup = "Aujourd'hui" | "Hier" | "Cette semaine" | "Ce mois-ci" | "Plus ancien";
const TIME_GROUP_ORDER: TimeGroup[] = ["Aujourd'hui", "Hier", "Cette semaine", "Ce mois-ci", "Plus ancien"];

function getTimeGroup(iso: string, now: Date): TimeGroup {
  const d = new Date(iso);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const eventDay = new Date(d); eventDay.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 14) return "Cette semaine";
  if (diffDays < 30) return "Ce mois-ci";
  return "Plus ancien";
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

const FILTER_MEMBERS: Record<FilterKey, Set<string> | null> = {
  tous: null,
  favoris: new Set([
    "FAVORITED", "UNFAVORITED",
    "ATHLETE_ADDED_TO_LIST", "ATHLETE_REMOVED_FROM_LIST",
  ]),
  videos: new Set(["VIDEO_ADDED"]),
  evaluations: new Set(["REVIEW_SUBMITTED"]),
  verifications: new Set(["ATHLETE_VERIFIED"]),
  consultations: new Set(["PROFILE_VIEWED", "PIPELINE_CHANGED"]),
  nouveauxathletes: new Set(["NEW_ATHLETE"]),
  misesajour: new Set(["PROFILE_UPDATED"]),
};

const FILTER_LABELS: Record<FilterKey, string> = {
  tous: "Tous",
  favoris: "Favoris",
  videos: "Vidéos",
  evaluations: "Évaluations",
  verifications: "Vérifications",
  consultations: "Consultations",
  nouveauxathletes: "Nouveaux athlètes",
  misesajour: "Mises à jour",
};

const FILTER_ORDER: FilterKey[] = [
  "tous",
  "favoris",
  "videos",
  "evaluations",
  "verifications",
  "consultations",
  "nouveauxathletes",
  "misesajour",
];

const PAGE_SIZE = 30;

/* ── Inner (PRO-gated content) ───────────────────────────────── */

function ActivitesInner() {
  const router = useRouter();
  const { data: items = [], isLoading } = useActivityList();
  const markAllMut = useMarkAllActivitiesRead();
  const [filter, setFilter] = useState<FilterKey>("tous");
  const [showCount, setShowCount] = useState(PAGE_SIZE);

  // Iter 7.30b — auto mark-all-read au mount (pattern desktop). Vide le badge sidebar.
  useEffect(() => {
    markAllMut.mutate();
    // exécuté une fois au mount uniquement, mutation autonome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (filter === "tous") return items;
    const members = FILTER_MEMBERS[filter];
    if (!members) return items;
    return items.filter((it) => members.has(it.actionType));
  }, [items, filter]);

  const visible = filtered.slice(0, showCount);
  const hasMore = filtered.length > showCount;

  // Grouping temporel (préservant l'ordre DESC dans chaque groupe).
  const groups = useMemo(() => {
    const now = new Date();
    const acc = new Map<TimeGroup, ActivityListItem[]>();
    for (const tg of TIME_GROUP_ORDER) acc.set(tg, []);
    for (const it of visible) {
      const g = getTimeGroup(it.createdAt, now);
      acc.get(g)?.push(it);
    }
    return TIME_GROUP_ORDER
      .map((g) => ({ group: g, items: acc.get(g) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [visible]);

  const handleTap = useCallback((item: ActivityListItem) => {
    const dest = getDestination(item);
    if (!dest) return;
    triggerHaptic("Light");
    try { sessionStorage.setItem("lastRecruiterTab", "activites"); } catch { /* no-op */ }
    router.push(dest);
  }, [router]);

  return (
    /* Iter 7.34 Section A — overflow-x-hidden + w-full sur la chaîne pour
       tuer le débordement horizontal de la PAGE. Le bug réel : les pills
       w-max remontaient via la chaîne flex (right-column flex-1 + main flex-1
       sans min-w-0 par défaut), l'overflow-x: hidden de main était contourné.
       Ceinture : overflow-x-hidden ici clippe au niveau page. */
    <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white pb-[calc(64px+env(safe-area-inset-bottom))]">
      {/* Header sticky opaque (canon 14.11) */}
      <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="px-4 pt-3 pb-3">
          <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">
            Activité
          </h1>
        </div>
        {/* Iter 7.33 Section 1 — pills iOS premium (slide assumé, pattern
            App Store/Spotify). 11 catégories desktop sans les 3 morts.
            Style : pills rondes h-9 px-4, espacement gap-2.5 généreux, premier
            pill aligné au bord (px-4 du container parent), gradient bord droit
            pour signaler le scroll horizontal. */}
        {/* Iter 7.34 Section A — w-full + min-w-0 bornent le viewport scroll
            au conteneur. Sans w-full, l'overflow-x-auto prenait la largeur
            naturelle de son contenu (w-max) et faisait déborder la page. */}
        <div
          className="w-full min-w-0 pb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex items-center gap-2.5 px-4 w-max">
            {FILTER_ORDER.map((key) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { triggerHaptic("Light"); setFilter(key); setShowCount(PAGE_SIZE); }}
                  className={`h-9 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${
                    active
                      ? "bg-[#E63946] text-white shadow-[0_0_12px_rgba(230,57,70,0.35)]"
                      : "bg-white/[0.06] text-[#9CA3AF] active:bg-white/[0.10]"
                  }`}
                >
                  {FILTER_LABELS[key]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        {isLoading && items.length === 0 ? (
          // Skeleton aligné sur la nouvelle hauteur de carte (88-96px).
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[88px] rounded-2xl bg-[#1A1D24] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {groups.map(({ group, items: groupItems }) => (
                <motion.div
                  key={group}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 className="text-[12px] uppercase tracking-[0.18em] text-white/40 font-bold mb-2.5 px-1">
                    {group}
                  </h2>
                  {/* Iter 7.32 Section 2 — gap entre cartes augmenté (space-y-2
                      → 2.5) pour aérer le rythme façon notifications iOS. */}
                  <div className="space-y-2.5">
                    {groupItems.map((item) => (
                      <ActivityCard
                        key={item.id}
                        item={item}
                        onTap={() => handleTap(item)}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {hasMore && (
              <button
                type="button"
                onClick={() => { triggerHaptic("Light"); setShowCount((c) => c + PAGE_SIZE); }}
                className="w-full py-3 rounded-xl bg-white/[0.06] active:bg-white/[0.10] text-white font-semibold text-[14px] transition-colors"
              >
                Voir plus
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ActivityCard ───────────────────────────────────────────── */

function ActivityCard({ item, onTap }: { item: ActivityListItem; onTap: () => void }) {
  const visual = ACTION_VISUAL[item.actionType] ?? DEFAULT_VISUAL;
  const verb = generateVerb(item);
  const dest = getDestination(item);

  return (
    /* Iter 7.32 Section 2 — densité "card app" (vs "ligne newsfeed web") :
       hauteur ~96px (py-3.5), texte verbe 15px font-medium leading-snug,
       icône container 10×10 + SVG 22px, accent gauche épaissi à 4px. */
    <button
      type="button"
      onClick={onTap}
      disabled={!dest}
      className={`w-full relative rounded-2xl overflow-hidden bg-[#1A1D24] text-left ${
        dest ? "active:opacity-80" : "opacity-90"
      } transition-opacity`}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: visual.color }}
        aria-hidden
      />
      <div className="flex items-center gap-3 pl-4 pr-3 py-3.5 min-h-[88px]">
        <span
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${visual.color}1F` }}
        >
          <ActionIcon name={visual.icon} color={visual.color} size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] text-white font-medium leading-snug">{verb}</p>
          <p className="text-[12px] text-white/50 mt-1.5">{formatRelativeDate(item.createdAt)}</p>
        </div>
        {dest && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
    </button>
  );
}

function EmptyState({ filter }: { filter: FilterKey }) {
  const label = filter === "tous" ? "" : ` « ${FILTER_LABELS[filter]} »`;
  return (
    <div className="flex flex-col items-center text-center py-20 px-6">
      <div className="w-16 h-16 rounded-full bg-[#1A1D24] flex items-center justify-center mb-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <p className="text-[16px] font-bold text-white">Aucune activité{label}</p>
      <p className="text-[13px] text-white/55 mt-2 max-w-xs leading-relaxed">
        L&apos;activité apparaîtra ici dès qu&apos;un coach met à jour un athlète, que tu ajoutes une note, ou que tu organises tes prospects.
      </p>
    </div>
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
