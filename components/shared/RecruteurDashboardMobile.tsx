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
import { DashboardGradientLayout } from "@/components/shared/dashboard/DashboardGradientLayout";
import { DashboardGreeting } from "@/components/shared/dashboard/DashboardGreeting";
import { DashboardHero } from "@/components/shared/dashboard/DashboardHero";
import { DashboardActivityFeed } from "@/components/shared/dashboard/DashboardActivityFeed";
import { SectionDivider } from "@/components/shared/dashboard/SectionDivider";
import { frenchDateUppercase, triggerHaptic } from "@/components/shared/dashboard/utils";

/* ── DashboardHero (Iter 6.2-redesign — hero card rouge Nexus gradient) ─ */

/* Local DashboardHero — REMOVED. Replaced by the shared
   <DashboardHero> from components/shared/dashboard with role-
   specific headline + 3 inset KpiCards (Pipeline / Favoris+
   progress-when-capped / Réponses) passed from the render block. */

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
        identityVisible={athlete.identityVisible}
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

/* activityVerb + getInitials + ActivityFeedItem + ActivityFeedList +
   SectionDivider — REMOVED (replaced by shared components from
   components/shared/dashboard/*). */

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

  // Hero headline — derived from the same signal hierarchy the old
  // local hero used : newAthletesThisWeek > 0 → fallback. Two lines,
  // second accented red (matches the new design recipe).
  const hasNews = actionBarData.newAthletesThisWeek > 0;
  const heroHeadline = hasNews ? (
    <h2 className="text-[24px] font-extrabold text-white leading-tight tracking-tight">
      {actionBarData.newAthletesThisWeek} nouveaux talents<br />
      <span className="text-[#E63946]">cette semaine</span>
    </h2>
  ) : (
    <h2 className="text-[24px] font-extrabold text-white leading-tight tracking-tight">
      Explore tes<br />
      <span className="text-[#E63946]">cibles</span>
    </h2>
  );

  // Favorites cap → optional progress bar. Source : useSubscription.
  // -1 means unlimited (AllStar) ; 0 means no cap-tracking (Free, etc.)
  const subAny = subscription as unknown as { maxFavorites?: number };
  const maxFavorites = typeof subAny.maxFavorites === "number" ? subAny.maxFavorites : 0;
  const favCount = favoritesArr.length;
  const favoritesProgress = maxFavorites > 0
    ? { current: favCount, total: maxFavorites, color: "#E63946" }
    : undefined;

  return (
    <DashboardGradientLayout>
      {/* Pull-to-refresh indicator (kept per-file) */}
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

      {/* Floating greeting on the gradient */}
      <DashboardGreeting
        greeting={headerName}
        dateLabel={currentDate ? frenchDateUppercase(currentDate) : undefined}
        chip={
          headerSchool
            ? {
                label: headerSchool,
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <path d="M10 22V16h4v6" />
                  </svg>
                ),
              }
            : undefined
        }
      />

      {/* Floating hero card. Insets : Pipeline total / Favoris (+ progress
          when a tier cap exists) / Réponses coachs. */}
      <DashboardHero
        eyebrow="Cette semaine"
        headline={heroHeadline}
        pulseBadge={
          actionBarData.coachReplies > 0
            ? {
                label: `${actionBarData.coachReplies} ${actionBarData.coachReplies > 1 ? "réponses coachs" : "réponse coach"}`,
                onTap: () => router.push("/recruteur/messages"),
              }
            : undefined
        }
        insets={[
          {
            label: "Processus",
            value: totalPipeline,
            subtitle: "athlètes",
            onTap: () => router.push("/recruteur/pipeline"),
          },
          {
            label: "Favoris",
            value: favCount,
            subtitle: maxFavorites > 0 ? `${favCount}/${maxFavorites}` : "actifs",
            progress: favoritesProgress,
            onTap: () => router.push("/recruteur/favoris"),
          },
          {
            label: "Réponses",
            value: actionBarData.coachReplies,
            subtitle: "coachs",
            onTap: () => router.push("/recruteur/messages"),
          },
        ]}
      />

      <SectionDivider />

      {/* Mon Processus (recruteur-specific funnel) */}
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

      {/* Activity feed (shared) */}
      <div className="py-6">
        <DashboardActivityFeed
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
    </DashboardGradientLayout>
  );
}
