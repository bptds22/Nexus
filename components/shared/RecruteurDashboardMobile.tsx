"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurDashboardMobile — Page Dashboard mobile-native (iter 6.2)
   Refonte premium Stripe-inspired :
     - Whitespace généreux (40-50 % de l'écran)
     - Typographie radicale (28 px greeting, 11 px section labels)
     - Couleurs minimalistes (rouge action, gris info)
     - Sections aérées avec dividers (pas tout en cards)
     - 1-2 infos par card MAX

   Référence design : docs/mobile-design-system.md.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { useDashboardHeader } from "@/lib/queries/recruiter/useDashboardHeader";
import { useDashboardKpi } from "@/lib/queries/recruiter/useDashboardKpi";
import { useTrendingAthletes } from "@/lib/queries/recruiter/useTrendingAthletes";
import { useActivityFeed } from "@/lib/queries/recruiter/useActivityFeed";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useFavorites } from "@/lib/queries/shared/useFavorites";
import type { TrendingAthlete } from "@/app/recruteur/_data/mockDashboardData";
import type { ActivityEvent } from "@/lib/types/activityEvents";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

/* ── Date formatting ─────────────────────────────────────────── */

function frenchDateUppercase(d: Date): string {
  const days = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
  const months = [
    "JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN",
    "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── DashboardHero (Iter 6.2-redesign — hero card rouge Nexus gradient) ─ */

function DashboardHero({
  greeting, organizationName, currentDate, newAthletesThisWeek, coachReplies,
  onTapNewAthletes, onTapMessages,
}: {
  greeting: string;
  organizationName: string;
  currentDate: Date;
  newAthletesThisWeek: number;
  coachReplies: number;
  onTapNewAthletes: () => void;
  onTapMessages: () => void;
}) {
  // Iter 7.4 Section C — marque X Nexus en fond droite, débordant du coin
  // top-right (cropé). Couche noire en offset derrière (profondeur, ombre
  // portée nette), couche blanche devant (contraste max sur rouge). Trio
  // marque sur le rouge Nexus. Headline + greeting + chip à gauche sur
  // rouge plein (lisibilité protégée — le X ne mord jamais le texte).
  const hasNews = newAthletesThisWeek > 0;
  return (
    <div className="px-4 pt-5">
      <div
        className="relative overflow-hidden w-full rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, #E63946 0%, #B82834 60%, #7F1B25 100%)",
          minHeight: 260,
        }}
      >
      {/* Iter 7.14 — Logo arrière passe du ROUGE au BLANC (BP veut profondeur
          d'ombre portée blanche, plus aucun rouge dans le X) + noir poursuit
          son glissement sud-est (+5/+5 vs 7.13 = +10/+10 cumulé depuis 7.12).
           - BLANC (icon-white.svg, 0.70) : 300×300, top 50 / right -60 —
             position arrière inchangée (relation diagonale BD validée), juste
             la couleur change rouge→blanc.
           - NOIR (icon-black.svg, 0.95) : 300×300, top 48 / right -58 (sud-est
             cumulé depuis 7.12 baseline 38/-48). Offset noir→blanc final =
             top +2 / right -2.
          DOM order : blanc first (derrière), noir after (devant). */}
      <div
        className="absolute z-0 pointer-events-none"
        style={{
          top: 50, right: -60,
          width: 300, height: 300,
          opacity: 0.70,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-white.svg" alt="" className="w-full h-full object-contain" />
      </div>
      <div
        className="absolute z-0 pointer-events-none"
        style={{
          top: 48, right: -58,
          width: 300, height: 300,
          opacity: 0.95,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-black.svg" alt="" className="w-full h-full object-contain" />
      </div>
      <div className="relative z-10">
        {/* Eyebrow : date à gauche + chip CÉGEP à droite (full width — la
            zone haut-droite est libre, le X est cut bottom-right). */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wider text-white/75 font-semibold truncate">
            {frenchDateUppercase(currentDate)}
          </p>
          {organizationName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.16] px-2.5 py-1 flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="8" y2="6" /><line x1="12" y1="6" x2="12" y2="6" /><line x1="16" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="8" y2="10" /><line x1="12" y1="10" x2="12" y2="10" /><line x1="16" y1="10" x2="16" y2="10" />
                <path d="M10 22V16h4v6" />
              </svg>
              <span className="text-[13px] text-white truncate max-w-[180px]">{organizationName}</span>
            </span>
          )}
        </div>

        {/* Iter 7.8d Section B — bloc greeting+headline+badge contraint à
            gauche (max ~62%) pour que le headline ne morde jamais le X
            noir massif ancré bottom-right. */}
        <div className="max-w-[62%]">
          {/* Greeting secondaire */}
          <p className="text-[20px] font-medium text-white/85 mt-3">
            Bonjour{greeting ? `, ${greeting}` : ""}
          </p>

          {/* Headline dynamique = focal punch */}
          {hasNews ? (
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); onTapNewAthletes(); }}
              className="block w-full text-left active:opacity-80 transition-opacity mt-2"
            >
              <h1 className="text-[30px] font-extrabold text-white leading-tight tracking-tight">
                {newAthletesThisWeek} nouveaux talents cette semaine
              </h1>
            </button>
          ) : (
            <h1 className="text-[30px] font-extrabold text-white leading-tight tracking-tight mt-2">
              Explore tes cibles
            </h1>
          )}
        </div>

        {/* Iter 7.5 Section C — badge punchy avec pulse dot, fond blanc 20%,
            label semibold. Signal "nouveau coach a répondu" lisible au premier
            coup d'œil, pas noyé dans le rouge. */}
        {coachReplies > 0 && (
          <button
            type="button"
            onClick={() => { triggerHaptic("Light"); onTapMessages(); }}
            className="inline-flex items-center gap-2 mt-4 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1.5 active:bg-white/[0.28] transition-colors"
          >
            <span className="relative flex w-2 h-2 flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-60" />
              <span className="relative w-2 h-2 rounded-full bg-white" />
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span className="text-[14px] text-white font-semibold">
              {coachReplies} {coachReplies > 1 ? "réponses coachs" : "réponse coach"}
            </span>
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

/* NotificationCard retiré en iter 6.2-redesign-fix Fix 3 — section Notifications
   supprimée car redondante avec les 2 stats du hero. */

/* ── MonProcessusFunnel (Iter 7.2 — rampe rouge intensité, premium) ── */

const PROCESSUS_STAGES: { key: string; label: string; intensity: number }[] = [
  { key: "identifie",        label: "Identifié",        intensity: 0.30 },
  { key: "contacte",         label: "Contacté",         intensity: 0.45 },
  { key: "en_discussion",    label: "En discussion",    intensity: 0.60 },
  { key: "visite_planifiee", label: "Visite planifiée", intensity: 0.75 },
  { key: "engage",           label: "Engagé",           intensity: 0.90 },
  { key: "lettre_signee",    label: "Lettre signée",    intensity: 1.00 },
];

function MonProcessusFunnel({
  counts, totalCount, onSeeAll,
}: {
  counts: Record<string, number>;
  totalCount: number;
  onSeeAll: () => void;
}) {
  // Iter 7.3 Section C — survival% (closing %) : pour chaque stage k,
  // % de la cohorte ayant atteint AU MOINS ce stage. Modèle cold-call,
  // suppose flux séquentiel (athlète à Engagé compté comme passé par
  // tous les stages précédents). N=0 → tout 0%.
  const stageCounts = PROCESSUS_STAGES.map((s) => ({ ...s, count: counts[s.key] ?? 0 }));
  const N = stageCounts.reduce((sum, s) => sum + s.count, 0);
  const stageWithSurvival = stageCounts.map((s, k) => {
    const reachedAtLeast = stageCounts.slice(k).reduce((sum, x) => sum + x.count, 0);
    const survival = N > 0 ? Math.round((reachedAtLeast / N) * 100) : 0;
    return { ...s, survival };
  });

  return (
    <div className="px-4">
      <div className="bg-[#1A1D24] rounded-2xl p-[18px] border border-white/[0.05]">
        {/* Header carte */}
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xs uppercase tracking-wider text-white/70 font-semibold">
            Mon processus
          </h2>
          <span className="text-[13px] text-white/85 tabular-nums">
            {totalCount} athlète{totalCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Lignes par stage avec barre survival% (rétrécit en descendant = funnel) */}
        <div className="space-y-[15px]">
          {stageWithSurvival.map((s) => {
            const isEmpty = s.survival === 0;
            return (
              <div key={s.key}>
                <div className="flex items-baseline gap-2.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 self-center"
                    style={{ backgroundColor: `rgba(230, 57, 70, ${s.intensity})` }}
                  />
                  <span className={`text-base font-medium truncate ${isEmpty ? "text-white/45" : "text-white/[0.88]"}`}>
                    {s.label}
                  </span>
                  <span className="text-[12px] text-white/45 tabular-nums flex-shrink-0">
                    · {s.count}
                  </span>
                  <span className={`flex-1 text-right text-[17px] font-bold tabular-nums ${isEmpty ? "text-white/45" : "text-white"}`}>
                    {s.survival}%
                  </span>
                </div>
                <div className="ml-[18px] mt-1.5 h-[4px] rounded overflow-hidden bg-white/[0.05]">
                  {!isEmpty && (
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${s.survival}%`,
                        backgroundColor: `rgba(230, 57, 70, ${s.intensity})`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA plein-width bg blanc subtle, chevron-right en fin (PAS de flèche en tête) */}
        <button
          type="button"
          onClick={() => { triggerHaptic("Light"); onSeeAll(); }}
          className="mt-5 w-full py-3 rounded-2xl bg-white/[0.04] active:bg-white/[0.08] text-[#E63946] font-semibold text-base flex items-center justify-center gap-2 transition-colors"
        >
          Voir le processus complet
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── TrendingAthletesCarousel + TrendingAthleteCard ──────────── */

function TrendingAthleteCard({ athlete, isFavorited, onTap }: {
  athlete: TrendingAthlete;
  isFavorited: boolean;
  onTap: () => void;
}) {
  // Iter 6.2-fix2a Fix 2 — réplique du visuel AthleteCardMobile de Recherche :
  // aspect 4:5 portrait, gradient bottom 2/3 (rgba 0.92→transparent), heart
  // top-left (visuel uniquement — tap card = navigation profil), stars top-
  // right, nom + position en overlay bas. Pas de verified check (donnée
  // indisponible dans useTrendingAthletes).
  const [first, ...rest] = (athlete.name || "").split(/\s+/);
  const firstName = athlete.firstName ?? first;
  const lastName = athlete.lastName ?? rest.join(" ");
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className="relative flex-shrink-0 w-[168px] aspect-[4/5] rounded-2xl overflow-hidden bg-[#1A1D24] active:opacity-80 transition-opacity text-left"
    >
      <AthletePhotoFill
        photoUrl={athlete.photoUrl ?? null}
        firstName={firstName}
        lastName={lastName}
        initialsFontSize={48}
        className="object-[center_15%]"
      />

      {/* Iter 7.5 Section B — gradient termine en #1A1D24 OPAQUE (couleur
          carte), pas en noir pur — fusionne avec les coins rounded du
          parent. Mécanisme canon Pipeline + DashboardHero. */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 z-[2] pointer-events-none"
        style={{ background: "linear-gradient(to top, #1A1D24 0%, rgba(26,29,36,0.85) 35%, transparent 70%)" }}
      />

      {/* Heart top-left (visuel — non interactif depuis Dashboard) */}
      <div className="absolute top-2 left-2 z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
        <svg
          width="20" height="20" viewBox="0 0 24 24"
          fill={isFavorited ? "#E63946" : "none"}
          stroke={isFavorited ? "#E63946" : "#9CA3AF"}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      </div>

      {/* Stars top-right pill (Iter 7.4 Section B — 14px lisible) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 z-10">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span className="text-[14px] font-bold text-white leading-none">{athlete.stars.toFixed(1)}</span>
      </div>

      {/* Bottom info overlay (canon iter 7.2) — respiration verticale bumpée
          en 7.5 pour ne pas coller au bord arrondi. */}
      <div className="absolute inset-x-0 bottom-0 px-3 pt-3 pb-4 z-10">
        <p className="text-white font-bold text-base truncate leading-tight">
          {athlete.name || "—"}
        </p>
        <p className="text-[15px] text-[#9CA3AF] mt-0.5 truncate">
          {athlete.position || "—"}
        </p>
      </div>
    </button>
  );
}

function TrendingAthletesCarousel({
  athletes, sportLabel, favorites, onAthleteTap,
}: {
  athletes: TrendingAthlete[];
  sportLabel?: string | null;
  favorites: Set<string>;
  onAthleteTap: (athleteId: string) => void;
}) {
  return (
    <div>
      <div className="px-4 mb-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-white/50 font-semibold">
          Athlètes tendance
        </h2>
        <p className="text-sm text-white/40 mt-1">
          Les plus consultés cette semaine{sportLabel ? ` en ${sportLabel}` : ""}
        </p>
      </div>
      {athletes.length === 0 ? (
        <p className="px-4 text-sm text-white/40 italic">Pas encore de tendances cette semaine.</p>
      ) : (
        <div className="overflow-x-auto nx-no-scrollbar pl-4">
          <div className="flex gap-3 pr-4">
            {athletes.slice(0, 5).map((a) => (
              <TrendingAthleteCard
                key={a.id}
                athlete={a}
                isFavorited={favorites.has(a.id)}
                onTap={() => onAthleteTap(a.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── ActivityFeedList + ActivityFeedItem ─────────────────────── */

// Iter 6.2-fix Fix 8 : verbe extrait dehors pour réutilisabilité.
function activityVerb(activity: ActivityEvent): string {
  switch (activity.type) {
    case "coach_replied":          return "Réponse reçue";
    case "recruiter_favorited":    return activity.iconColor === "#6B7280" ? "Retiré des favoris" : "Ajouté aux favoris";
    case "profile_verified":       return "Profil vérifié";
    case "video_added":            return "Vidéo ajoutée";
    case "profile_updated_bulk":   return "Profil mis à jour";
    case "scouting_report_updated":return "Note ajoutée";
    case "status_engage":          return "Changement de statut";
    default:                       return "Activité";
  }
}

function getInitials(name?: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  const f = parts[0]?.[0] ?? "";
  const l = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (f + l).toUpperCase() || "—";
}

function ActivityFeedItem({ activity, isLast, onTap }: {
  activity: ActivityEvent;
  isLast: boolean;
  onTap: () => void;
}) {
  // Iter 7.3 Section E — déflatter par visuel : ring accent (iconColor) sur
  // l'avatar selon le type d'événement. Verbe spécifique data-gated : le
  // log expose un type générique sans destination de stage explicite. Vrai
  // déflattage nécessite un enrichissement séparé de recruiter_activity_log.
  const initials = getInitials(activity.athleteName);
  const accent = activity.iconColor || "#6B7280";
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className={`w-full text-left py-4 active:opacity-60 transition-opacity ${isLast ? "" : "border-b border-white/[0.06]"}`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar initiales + ring accent par type d'événement (iconColor) */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white/[0.06]"
          style={{ boxShadow: `inset 0 0 0 1.5px ${accent}` }}
        >
          <span className="text-[12px] font-bold text-white/80 tracking-wide">{initials}</span>
        </div>
        {/* Texte + délai */}
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

function ActivityFeedList({ activities, onItemTap }: {
  activities: ActivityEvent[];
  onItemTap: (athleteId: string | undefined) => void;
}) {
  const visible = activities.slice(0, 5);
  return (
    <div className="px-4">
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-5">
        Activité récente
      </h2>
      {visible.length === 0 ? (
        <p className="text-sm text-white/40 italic">Aucune activité récente.</p>
      ) : (
        <div>
          {visible.map((a, idx) => (
            <ActivityFeedItem
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

/* ── SectionDivider + Skeleton + EmptyHeader ────────────────── */

function SectionDivider() {
  return <div className="mx-4 border-t border-white/[0.06]" />;
}

function DashboardSkeleton() {
  return (
    <div className="px-4 pt-6 space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded nx-pulse-dash" />
        <div className="h-8 w-56 rounded nx-pulse-dash" />
        <div className="h-4 w-40 rounded nx-pulse-dash" />
      </div>
      <div className="space-y-3">
        <div className="h-16 rounded-2xl nx-pulse-dash" />
        <div className="h-16 rounded-2xl nx-pulse-dash" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-20 h-16 rounded-2xl nx-pulse-dash" />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function RecruteurDashboardMobile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: header, isLoading: headerLoading } = useDashboardHeader();
  const { data: kpiBundle, isLoading: kpiLoading } = useDashboardKpi();
  const { data: trendingAthletes = [] } = useTrendingAthletes();
  const { data: activityEvents = [] } = useActivityFeed();
  const { data: favoritesArr = [] } = useFavorites();
  const favoritesSet = useMemo(() => new Set(favoritesArr), [favoritesArr]);
  const subscription = useSubscription();

  const loading = headerLoading || kpiLoading;
  const headerName = header?.headerName ?? "";
  const headerSchool = header?.headerSchool ?? "";
  const actionBarData = kpiBundle?.actionBarData ?? { coachReplies: 0, newAthletesThisWeek: 0 };
  const pipelineCounts = kpiBundle?.pipelineCounts ?? {};

  const totalPipeline = useMemo(
    () => Object.entries(pipelineCounts)
      .filter(([k]) => k !== "retire")
      .reduce((sum, [, n]) => sum + n, 0),
    [pipelineCounts]
  );

  // Pipeline limit selon tier (Free=0, Pro=50, AllStar=-1)

  // Iter 6.1c sessionStorage pour back nav vers dashboard
  const navAthlete = (id: string | undefined) => {
    if (!id) return;
    try { sessionStorage.setItem("lastRecruiterTab", "tableau-de-bord"); } catch { /* no-op */ }
    router.push(`/recruteur/athletes/${id}`);
  };

  // Date stable côté client (évite hydration mismatch en SSG)
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  useEffect(() => { setCurrentDate(new Date()); }, []);

  // Scroll + pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const PULL_THRESHOLD = 80;

  useEffect(() => {
    let startY = 0; let current = 0;
    const onTouchStart = (e: TouchEvent) => {
      if ((window.scrollY || 0) === 0) startY = e.touches[0].clientY; else startY = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if ((window.scrollY || 0) !== 0 || startY === 0) return;
      current = Math.max(0, Math.min(e.touches[0].clientY - startY, 120));
      setPullDistance(current);
      setIsPulling(current > 0);
    };
    const onTouchEnd = async () => {
      if (current >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        triggerHaptic("Medium");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
          queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
        ]);
        window.setTimeout(() => { setIsRefreshing(false); setPullDistance(0); setIsPulling(false); }, 600);
      } else {
        setPullDistance(0); setIsPulling(false);
      }
      startY = 0; current = 0;
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isRefreshing, queryClient]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111317] text-white">
        <DashboardSkeleton />
        <style jsx>{`
          @keyframes nx-pulse-dash-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
          :global(.nx-pulse-dash) { background: #1A1D24; animation: nx-pulse-dash-kf 1.4s ease-in-out infinite; }
          :global(.nx-no-scrollbar) { scrollbar-width: none; -ms-overflow-style: none; }
          :global(.nx-no-scrollbar::-webkit-scrollbar) { display: none; }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#111317] text-white"
      style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom) + 32px)" }}
    >
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div
          className="fixed left-0 right-0 z-[55] flex justify-center items-center pointer-events-none"
          style={{ top: 0, height: Math.max(pullDistance, isRefreshing ? 60 : 0) }}
        >
          <div
            className="rounded-full p-2"
            style={{
              background: "rgba(230, 57, 70, 0.1)",
              transform: isRefreshing ? "rotate(0deg)" : `rotate(${pullDistance * 4}deg)`,
              opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: isRefreshing ? "nx-rotate-dash 1s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </div>
        </div>
      )}

      <DashboardHero
        greeting={headerName}
        organizationName={headerSchool}
        currentDate={currentDate ?? new Date(2026, 5, 2)}
        newAthletesThisWeek={actionBarData.newAthletesThisWeek}
        coachReplies={actionBarData.coachReplies}
        onTapNewAthletes={() => router.push("/recruteur/recherche?nouveau=true")}
        onTapMessages={() => router.push("/recruteur/messages")}
      />

      <SectionDivider />

      {/* Mon Processus (Iter 6.2-fix — liste Stripe-clean au lieu du strip) */}
      <div className="py-6">
        <MonProcessusFunnel
          counts={pipelineCounts}
          totalCount={totalPipeline}
          onSeeAll={() => router.push("/recruteur/pipeline")}
        />
      </div>

      <SectionDivider />

      {/* Trending athletes */}
      <div className="py-6">
        <TrendingAthletesCarousel
          athletes={trendingAthletes}
          sportLabel={subscription.subscription?.role === "recruiter" ? null : null /* placeholder, hook ne retourne pas le sport */}
          favorites={favoritesSet}
          onAthleteTap={navAthlete}
        />
      </div>

      <SectionDivider />

      {/* Activity feed */}
      <div className="py-6">
        <ActivityFeedList
          activities={activityEvents}
          onItemTap={navAthlete}
        />
        {activityEvents.length > 5 && (
          <div className="px-4 mt-4">
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); router.push("/recruteur/activites"); }}
              className="w-full py-3 rounded-2xl bg-white/[0.03] active:bg-white/[0.06] text-[#E63946] font-semibold text-base transition-colors"
            >
              Voir toutes les activités
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes nx-pulse-dash-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        :global(.nx-pulse-dash) { background: #1A1D24; animation: nx-pulse-dash-kf 1.4s ease-in-out infinite; }
        :global(.nx-no-scrollbar) { scrollbar-width: none; -ms-overflow-style: none; }
        :global(.nx-no-scrollbar::-webkit-scrollbar) { display: none; }
        @keyframes nx-rotate-dash { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
