"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteDashboardMobile — Phase 1 of the athlete mobile dashboard
   re-skin onto the shared coach/recruiter design system.

   Self-contained : fetches its own data with the EXACT queries
   from app/athlete/dashboard/page.tsx (same tables / fields /
   filters). Mirrors the structural shape of CoachDashboardMobile
   and RecruteurDashboardMobile : compose the shared primitives
   from components/shared/dashboard/ instead of hand-rolling card
   markup. Desktop body in page.tsx is the proven reference and
   stays byte-for-byte unchanged behind the IS_CAPACITOR dispatch.

   PHASE 1 SCOPE
   - Greeting (name + verified badge, no chip — D1 locked)
   - Pending invitations inline banner (above hero, canon surface)
   - Unread notifications inline banner (above hero, canon surface)
   - Hero card : eyebrow + headline + 3 KpiCard insets
       Vues ce mois (trend) / Recruteurs intéressés (region subtitle)
       / Complétion du profil (progress + onTap Améliorer)
   - Activity feed via DashboardActivityFeed (max 5 items)

   EXPLICITLY EXCLUDED (Phase 2, do NOT add here)
   - Améliore ton profil checklist
   - "11× profils vérifiés" banner
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { DashboardGradientLayout } from "@/components/shared/dashboard/DashboardGradientLayout";
import { DashboardGreeting } from "@/components/shared/dashboard/DashboardGreeting";
import { DashboardHero } from "@/components/shared/dashboard/DashboardHero";
import { DashboardActivityFeed } from "@/components/shared/dashboard/DashboardActivityFeed";
import { SectionDivider } from "@/components/shared/dashboard/SectionDivider";
import { frenchDateUppercase } from "@/components/shared/dashboard/utils";
import type { ActivityEvent } from "@/lib/types/activityEvents";

/* ── Checklist item shape — mirrors desktop's local ChecklistItem
      type (page.tsx). The `section` tag is display-only ; "coach"
      drives the "(coach)" inline tag, the other values are dormant
      classifiers we preserve byte-for-byte for any future parity. */
type ChecklistItem = {
  label: string;
  boost: number;
  done: boolean;
  section?: string;
};

/* ── Inline banner — reused for pending invitations + unread notif.
      Canon surface (#1A1D24), red accent, tap → href. */
function InlineBanner({
  href, accent, icon, title, subtitle,
}: {
  href: string;
  accent: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  return (
    <div className="px-4">
      <button
        type="button"
        onClick={() => router.push(href)}
        className="w-full text-left bg-[#1A1D24] rounded-2xl border border-white/[0.05] active:bg-white/[0.02] transition-colors flex items-center gap-3 px-4 py-3"
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-white truncate">{title}</p>
          {subtitle && (
            <p className="text-[12px] text-white/55 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}

/* ── Activity row map.
      The page.tsx already canonicalizes the three DB action_types into
      its local ActivityItem shape ; here we map them into ActivityEvent
      (the shape DashboardActivityFeed accepts). The top-line "name" slot
      surfaces the subject of the action ("Un recruteur de la région X",
      "Ton coach") ; the verb comes from activityVerb() in utils.ts. */
function mapActivityRow(
  row: { id: string; action_type: string; created_at: string; recruiter_id: string },
  recruiterRegionById: Map<string, string | null>,
): ActivityEvent | null {
  const recruiterRegion = recruiterRegionById.get(row.recruiter_id) ?? null;
  const regionLabel = recruiterRegion ? ` de la région ${recruiterRegion}` : "";
  switch (row.action_type) {
    case "PROFILE_VIEWED":
      return baseEvent(row, {
        type: "profile_viewed",
        athleteName: `Un recruteur${regionLabel}`,
        iconColor: "#9CA3AF",
      });
    case "FAVORITE_ADDED":
      return baseEvent(row, {
        type: "recruiter_favorited",
        athleteName: `Un recruteur${regionLabel}`,
        iconColor: "#E63946",
      });
    case "ATHLETE_VERIFIED":
      return baseEvent(row, {
        type: "profile_verified",
        athleteName: "Ton coach",
        iconColor: "#3B82F6",
      });
    default:
      return null;
  }
}

function baseEvent(
  row: { id: string; created_at: string },
  overrides: Pick<ActivityEvent, "type" | "athleteName" | "iconColor">,
): ActivityEvent {
  return {
    id: row.id,
    priority: 2,
    direction: "inbound",
    message: "",
    icon: "",
    timestamp: row.created_at,
    relativeTime: formatRelativeTime(row.created_at),
    timeGroup: relativeTimeGroup(row.created_at),
    ...overrides,
  };
}

/* Copy of formatRelativeTime from page.tsx (Bug #8 : no shared loader,
   queries + helpers stay byte-for-byte identical between desktop and
   mobile so they cannot drift). */
function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return diffMins <= 1 ? "À l'instant" : `Il y a ${diffMins}min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaine${Math.floor(diffDays / 7) > 1 ? "s" : ""}`;
  return `Il y a ${Math.floor(diffDays / 30)} mois`;
}

function relativeTimeGroup(isoTimestamp: string): ActivityEvent["timeGroup"] {
  const diffDays = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 86400000);
  if (diffDays < 1) return "Aujourd'hui";
  if (diffDays < 2) return "Hier";
  if (diffDays < 7) return "Cette semaine";
  return "Semaine dernière";
}

/* ── AthleteImproveProfileBlock — "Améliore ton profil" checklist.
      Athlete-only section (Phase 2). Mirrors desktop page.tsx
      :466-502 byte-for-byte : same card surface, same per-row state
      icons, same green/grey/red tokens, same "(coach)" tag rule,
      same single-CTA-at-bottom navigation pattern.

      Section hidden when profileCompletion === 100 (matches desktop
      `{profileCompletion < 100 && …}` gate). Rendered when items is
      empty (yet-to-load) the parent skips render too. */
function AthleteImproveProfileBlock({ items }: { items: ChecklistItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="px-4">
      <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">
        Améliore ton profil
      </h2>
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            {item.done ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            ) : (
              <div className="w-[18px] h-[18px] rounded-full border-2 border-[#4a4d56] shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className={`text-[13px] ${item.done ? "text-[#6b7280] line-through" : "text-white font-semibold"}`}>
                {item.label}
              </span>
              {item.section === "coach" && !item.done && (
                <span className="text-[10px] text-[#6b7280] ml-1">(coach)</span>
              )}
            </div>
            <span className={`text-[11px] font-bold shrink-0 ${item.done ? "text-[#4a4d56]" : "text-[#22C55E]"}`}>
              +{item.boost}%
            </span>
          </div>
        ))}

        <div className="pt-3 border-t border-[#2D3748]/40">
          <Link
            href="/athlete/profil"
            className="text-[12px] font-bold text-[#E63946] active:text-[#D42B22] transition-colors flex items-center gap-1"
          >
            Compléter mon profil
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── VerifiedImpactBanner — "11x plus de vues" reinforcement for
      verified athletes. Mirrors desktop page.tsx:506-515 verbatim :
      canon #1A1D24 surface, red trend-up icon, "11x" bold-white
      inline (lowercase x — NOT the multiplication sign). Static —
      no CTA, no link. Parent gates on `verified` so this component
      assumes it's already cleared. */
function VerifiedImpactBanner() {
  return (
    <div className="px-4">
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 px-5 py-3.5 flex items-center gap-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#E63946"
          strokeWidth="2"
          strokeLinecap="round"
          className="flex-shrink-0"
        >
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
        <p className="text-[13px] text-[#9CA3AF]">
          Les profils vérifiés comme le tien reçoivent{" "}
          <span className="font-bold text-white">11x</span> plus de vues
        </p>
      </div>
    </div>
  );
}

export default function AthleteDashboardMobile() {
  const router = useRouter();

  // State mirrors the desktop page.tsx exactly.
  const [firstName, setFirstName] = useState<string>("");
  const [verified, setVerified] = useState<boolean>(false);
  const [profileCompletion, setProfileCompletion] = useState<number>(0);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState<{ count: number; latestTitle: string | null }>({ count: 0, latestTitle: null });
  const [pendingInvitations, setPendingInvitations] = useState<number>(0);
  const [viewsThisMonth, setViewsThisMonth] = useState<number>(0);
  const [viewsLastMonth, setViewsLastMonth] = useState<number>(0);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [regionsCount, setRegionsCount] = useState<number>(0);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // ── Athlete row : first_name, verified, profile_completion ──
      const { data } = await supabase
        .from("athletes")
        .select("first_name, verified, last_profile_validation, profile_completion")
        .eq("user_id", user.id)
        .maybeSingle();
      const fn = (data?.first_name as string | undefined)
        || (user.user_metadata?.first_name as string | undefined)
        || (user.email?.split("@")[0]);
      if (fn) setFirstName(fn);
      if (data) {
        setVerified(!!data.verified);
        setProfileCompletion((data.profile_completion as number) || 0);
      }

      const { data: athleteRow } = await supabase
        .from("athletes")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!athleteRow?.id) return;

      // ── Unread athlete_notifications + latest title ──
      const { data: notifs, count } = await supabase
        .from("athlete_notifications")
        .select("title", { count: "exact" })
        .eq("athlete_id", athleteRow.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(1);
      setUnreadNotifs({
        count: count ?? 0,
        latestTitle: (notifs?.[0]?.title as string) || null,
      });

      // ── PENDING team_invitations count ──
      const { count: pendingCount } = await supabase
        .from("team_invitations")
        .select("id", { count: "exact", head: true })
        .eq("athlete_id", athleteRow.id)
        .eq("status", "PENDING");
      setPendingInvitations(pendingCount ?? 0);

      // ── KPIs : views this month + last month + favorites ──
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const [viewsMonthRes, viewsLastRes, favsRes] = await Promise.all([
        supabase
          .from("recruiter_athlete_views")
          .select("id", { count: "exact", head: true })
          .eq("athlete_id", athleteRow.id)
          .gte("viewed_at", startOfMonth),
        supabase
          .from("recruiter_athlete_views")
          .select("id", { count: "exact", head: true })
          .eq("athlete_id", athleteRow.id)
          .gte("viewed_at", startOfLastMonth)
          .lt("viewed_at", startOfMonth),
        supabase
          .from("recruiter_favorites")
          .select("recruiter_id")
          .eq("athlete_id", athleteRow.id),
      ]);

      setViewsThisMonth(viewsMonthRes.count ?? 0);
      setViewsLastMonth(viewsLastRes.count ?? 0);

      const favRecruiterIds = (favsRes.data || []).map((r: { recruiter_id: string }) => r.recruiter_id);
      setFavoritesCount(favRecruiterIds.length);

      if (favRecruiterIds.length > 0) {
        const { data: recruiters } = await supabase
          .from("users")
          .select("region")
          .in("id", favRecruiterIds);
        const uniqueRegions = new Set(
          (recruiters || []).map((r: { region?: string | null }) => r.region).filter(Boolean),
        );
        setRegionsCount(uniqueRegions.size);
      } else {
        setRegionsCount(0);
      }

      // ── Activity feed ──
      const { data: activityRows } = await supabase
        .from("recruiter_activity_log")
        .select("id, action_type, created_at, recruiter_id")
        .eq("athlete_id", athleteRow.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const activityRecruiterIds = [
        ...new Set((activityRows ?? []).map((r) => r.recruiter_id).filter(Boolean)),
      ];
      let regionById = new Map<string, string | null>();
      if (activityRecruiterIds.length > 0) {
        const { data: activityRecruiters } = await supabase
          .from("users")
          .select("id, region")
          .in("id", activityRecruiterIds);
        regionById = new Map(
          (activityRecruiters ?? []).map((u): [string, string | null] => [u.id, u.region]),
        );
      }

      const mappedEvents: ActivityEvent[] = ((activityRows ?? []) as { id: string; action_type: string; created_at: string; recruiter_id: string }[])
        .map((row) => mapActivityRow(row, regionById))
        .filter((e): e is ActivityEvent => e !== null);
      setActivities(mappedEvents);

      // ── Profile checklist (derived from real fields) ────────
      // Mirrors desktop page.tsx:236-262 byte-for-byte (Bug #8 :
      // queries + builder identical so mobile and desktop completion
      // states cannot drift). Same table, same SELECT string, same
      // evaluations embed shape, same 10-item builder + boosts.
      const { data: athleteFullRow } = await supabase
        .from("athletes")
        .select("photo_url, first_name, last_name, date_naissance, telephone, taille_pieds, poids_lbs, sport_id, position_id, video_match_complet_url, video_faits_saillants_url, hudl_url, youtube_url, instagram_url, moyenne_generale, test_40_verges, saut_vertical, evaluations(vitesse_explosivite, force_puissance, leadership, rapport_entraineur, updated_at)")
        .eq("id", athleteRow.id)
        .maybeSingle();

      if (athleteFullRow) {
        const evalRow = selectBestEvaluation(
          Array.isArray(athleteFullRow.evaluations)
            ? athleteFullRow.evaluations
            : athleteFullRow.evaluations ? [athleteFullRow.evaluations] : []
        );
        const hasAnyTrait = evalRow && (
          (evalRow.vitesse_explosivite || 0) > 0 ||
          (evalRow.force_puissance || 0) > 0 ||
          (evalRow.leadership || 0) > 0
        );
        const newChecklist: ChecklistItem[] = [
          { label: "Photo de profil", boost: 8, done: !!athleteFullRow.photo_url },
          { label: "Identité complète", boost: 10, done: !!(athleteFullRow.first_name && athleteFullRow.last_name && athleteFullRow.date_naissance && athleteFullRow.telephone) },
          { label: "Profil physique", boost: 10, done: !!(athleteFullRow.taille_pieds && athleteFullRow.poids_lbs) },
          { label: "Sport et position", boost: 8, done: !!(athleteFullRow.sport_id && athleteFullRow.position_id) },
          { label: "Évaluation coach", boost: 15, done: !!hasAnyTrait, section: "coach" },
          { label: "Rapport entraîneur", boost: 12, done: !!evalRow?.rapport_entraineur, section: "coach" },
          { label: "Vidéo de match complet", boost: 8, done: !!athleteFullRow.video_match_complet_url, section: "media" },
          { label: "Médias et liens complets", boost: 7, done: !!(athleteFullRow.video_faits_saillants_url || athleteFullRow.hudl_url || athleteFullRow.youtube_url || athleteFullRow.instagram_url), section: "media" },
          { label: "Profil académique", boost: 10, done: !!athleteFullRow.moyenne_generale },
          { label: "Stats clés détaillées", boost: 12, done: !!(athleteFullRow.test_40_verges || athleteFullRow.saut_vertical), section: "stats" },
        ];
        setChecklist(newChecklist);
      }
    };
    load();
  }, []);

  /* ── Derived values ─────────────────────────────────────── */

  // Month-over-month trend %. Falls back to 0 when last month was 0
  // (avoids division-by-zero ; matches what the desktop card shows).
  const viewsTrend = useMemo(() => {
    if (viewsLastMonth === 0) return null;
    const delta = viewsThisMonth - viewsLastMonth;
    const pct = Math.round((delta / viewsLastMonth) * 100);
    return { value: pct, positive: pct >= 0 };
  }, [viewsThisMonth, viewsLastMonth]);

  const dateLabel = useMemo(() => frenchDateUppercase(new Date()), []);

  // Hero headline : athlete-facing tone ("ton profil"), red accent on
  // the second line so the KPI strip below feels anchored to the
  // current month's activity.
  const heroHeadline = (
    <h2 className="text-[24px] font-extrabold text-white leading-tight tracking-tight">
      Ton profil ce mois.
      <br />
      <span className="text-[#E63946]">
        {viewsThisMonth} {viewsThisMonth === 1 ? "vue" : "vues"} reçues.
      </span>
    </h2>
  );

  return (
    <DashboardGradientLayout>
      <DashboardGreeting
        greeting={firstName}
        dateLabel={dateLabel}
        verifiedBadge={verified}
      />

      {/* Phase 1 banners — kept inline above the hero (D3 locked).
          Conditional on real counts ; same routing targets as desktop
          (/athlete/notifications for both). */}
      {pendingInvitations > 0 && (
        <div className="mb-3">
          <InlineBanner
            href="/athlete/notifications"
            accent="#E63946"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            }
            title={`Tu as ${pendingInvitations} invitation${pendingInvitations > 1 ? "s" : ""} d'équipe à examiner`}
          />
        </div>
      )}

      {unreadNotifs.count > 0 && (
        <div className="mb-3">
          <InlineBanner
            href="/athlete/notifications"
            accent="#F59E0B"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            }
            title={`${unreadNotifs.count} ${unreadNotifs.count > 1 ? "notifications non lues" : "notification non lue"}`}
            subtitle={unreadNotifs.latestTitle ?? undefined}
          />
        </div>
      )}

      <DashboardHero
        eyebrow="Ce mois-ci"
        headline={heroHeadline}
        insets={[
          {
            label: "Vues",
            value: viewsThisMonth,
            subtitle: "ce mois",
            trend: viewsTrend ?? undefined,
            onTap: () => router.push("/athlete/profil"),
          },
          {
            label: "Recruteurs",
            value: favoritesCount,
            subtitle: regionsCount > 0
              ? `${regionsCount} région${regionsCount > 1 ? "s" : ""}`
              : "intéressés",
            onTap: () => router.push("/athlete/profil"),
          },
          {
            label: "Complétion",
            value: `${profileCompletion}%`,
            subtitle: "Améliorer",
            progress: { current: profileCompletion, total: 100 },
            onTap: () => router.push("/athlete/profil"),
          },
        ]}
      />

      <SectionDivider />

      <div className="py-6">
        <DashboardActivityFeed
          activities={activities}
          onItemTap={() => router.push("/athlete/notifications")}
          limit={5}
        />
      </div>

      {/* ── Phase 2 : athlete-only sections ────────────────────
          Améliore ton profil checklist renders UNCONDITIONALLY to
          match desktop (the block self-hides when items.length===0,
          so an unloaded checklist shows nothing without flashing an
          empty card). A `profileCompletion < 100` gate would read
          the stored athletes.profile_completion column which can
          disagree with the checklist's own field-derived done-states
          — making any drift visible as a bug. 11x verified-
          reinforcement banner stays gated on `verified` (athlete-
          only motivational copy ; desktop does the same). Both
          inline-stack inside the gradient layout, which reserves
          bottom padding for the tab bar (paddingBottom: calc(64px
          + safe-area + 32px) — DashboardGradientLayout.tsx:32). */}
      <SectionDivider />
      <div className="py-6">
        <AthleteImproveProfileBlock items={checklist} />
      </div>

      {verified && (
        <div className="pb-2">
          <VerifiedImpactBanner />
        </div>
      )}
    </DashboardGradientLayout>
  );
}
