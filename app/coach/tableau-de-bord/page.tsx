"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ActionBar from "./_components/ActionBar";
import KpiCards from "./_components/KpiCards";
import HotAthletes from "./_components/HotAthletes";
import ActivityFeed from "./_components/ActivityFeed";
import { CoachDashboardMobile } from "@/components/shared/CoachDashboardMobile";

import type { ActionBarData, KpiData, HotAthlete } from "./_data/mockDashboardData";
import type { ActivityEvent } from "@/lib/types/activityEvents";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Coach Tableau de Bord
   Alert-system dashboard: signals, not summaries.
───────────────────────────────────────────────────────────────── */

function frenchDate(): string {
  const d = new Date();
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function TableauDeBordPage() {
  // Iter coach-dashboard-mobile : Capacitor → composant mobile-native.
  // Web (non-Capacitor) garde son layout existant intact.
  if (IS_CAPACITOR) return <CoachDashboardMobile />;

  const [coachName, setCoachName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [actionBar, setActionBar] = useState<ActionBarData>({ unreadMessages: 0, incompleteProfiles: 0, newAthletes: 0, pendingSuggestions: 0 });
  const [kpi, setKpi] = useState<KpiData>({ totalAthletes: 0, completeProfiles: 0, totalProfiles: 0, completePct: 0, recruiterViews: 0, viewsTrend: 0, activeConversations: 0 });
  const [hotAthletes, setHotAthletes] = useState<HotAthlete[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInterimDirector, setIsInterimDirector] = useState(false);
  const [interimSchoolName, setInterimSchoolName] = useState("");
  const [demotionNotifications, setDemotionNotifications] = useState<{
    id: string;
    title: string;
    message: string | null;
    metadata: Record<string, unknown> | null;
  }[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Load coach profile + school name + interim status fields.
      // Interim source of truth = users.is_school_admin + profile_data.admin_type
      // ('interim'). school_coaches.role est toujours 'COACH' dans le workflow
      // admin_claims (RPRP attesté + modération) — ne plus s'y fier ici.
      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, school_id, is_school_admin, profile_data, schools!school_id(name)")
        .eq("id", user.id)
        .single();

      let resolvedSchoolName = "";
      if (profile) {
        const firstName = (profile.first_name as string) || "";
        const lastName = (profile.last_name as string) || "";
        setCoachName(`${firstName} ${lastName}`.trim() || "Coach");

        const schoolRaw = profile.schools;
        const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;
        const schoolObj = school as { name?: string } | null;
        resolvedSchoolName = schoolObj?.name || "";
        setSchoolName(resolvedSchoolName);

        const adminType = (profile.profile_data as { admin_type?: string } | null)?.admin_type;
        if (profile.is_school_admin === true && adminType === "interim") {
          setIsInterimDirector(true);
          setInterimSchoolName(resolvedSchoolName);
        }
      }

      const coachSchoolId = (profile?.school_id as string) || null;

      // If coach has no school assigned, dashboard cannot scope to a
      // school roster. Bail out early — the dashboard is only useful
      // for coaches with a school. Show empty state via existing
      // loading/empty paths.
      if (!coachSchoolId) {
        setLoading(false);
        return;
      }

      // Load unread INTERIM_DEMOTED notifications
      const { data: demotions } = await supabase
        .from("coach_notifications")
        .select("id, title, message, metadata")
        .eq("coach_id", user.id)
        .eq("type", "INTERIM_DEMOTED")
        .eq("read", false)
        .order("created_at", { ascending: false });

      if (demotions && demotions.length > 0) {
        setDemotionNotifications(demotions.map((d) => ({
          id: d.id as string,
          title: d.title as string,
          message: (d.message as string) || null,
          metadata: (d.metadata as Record<string, unknown>) || null,
        })));
      }

      // Get athletes claimed by this coach (coach-scoped roster)
      const { data: athleteRows } = await supabase
        .from("athletes")
        .select("id, verified")
        .eq("coach_id", user.id)
        .eq("status", "ACTIF");

      const athletes = athleteRows || [];
      const coachAthleteIds = athletes.map((a: { id: string }) => a.id);
      const totalAthletes = athletes.length;
      const verifiedCount = athletes.filter((a: { verified: boolean }) => a.verified).length;

      // Banner 1: unread recruiter contacts (CONTACTE status in pipeline for coach's athletes)
      let unreadMessages = 0;
      if (coachAthleteIds.length > 0) {
        const { count } = await supabase
          .from("recruiter_pipeline")
          .select("id", { count: "exact", head: true })
          .eq("stage", "CONTACTE")
          .in("athlete_id", coachAthleteIds);
        unreadMessages = count || 0;
      }

      // Banner 2: non-verified profiles
      const unverifiedCount = totalAthletes - verifiedCount;

      // Banner 3: new athletes added (unread)
      const { count: newAthletesCount } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", user.id)
        .eq("type", "ATHLETE_ADDED")
        .eq("read", false);

      // Banner 4: pending athlete suggestions
      let pendingSuggestions = 0;
      if (coachAthleteIds.length > 0) {
        const { count: sugCount } = await supabase
          .from("athlete_suggestions")
          .select("id", { count: "exact", head: true })
          .in("athlete_id", coachAthleteIds)
          .eq("status", "EN_ATTENTE");
        pendingSuggestions = sugCount || 0;
      }

      setActionBar({
        unreadMessages,
        incompleteProfiles: unverifiedCount,
        newAthletes: newAthletesCount || 0,
        pendingSuggestions,
      });

      // ── KPI 3: Recruiter views (this month vs last month) ──
      const now = new Date();
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      let viewsThisMonth = 0;
      let viewsLastMonth = 0;
      if (coachAthleteIds.length > 0) {
        const [{ count: thisCount }, { count: lastCount }] = await Promise.all([
          supabase.from("recruiter_athlete_views").select("id", { count: "exact", head: true }).in("athlete_id", coachAthleteIds).gte("viewed_at", firstOfThisMonth).lt("viewed_at", firstOfNextMonth),
          supabase.from("recruiter_athlete_views").select("id", { count: "exact", head: true }).in("athlete_id", coachAthleteIds).gte("viewed_at", firstOfLastMonth).lt("viewed_at", firstOfThisMonth),
        ]);
        viewsThisMonth = thisCount || 0;
        viewsLastMonth = lastCount || 0;
      }

      // Calculate trend — always produce a value
      let viewsTrend = 0;
      if (viewsLastMonth === 0 && viewsThisMonth > 0) {
        viewsTrend = 100;
      } else if (viewsLastMonth > 0 && viewsThisMonth === 0) {
        viewsTrend = -100;
      } else if (viewsLastMonth > 0) {
        viewsTrend = Math.round(((viewsThisMonth - viewsLastMonth) / viewsLastMonth) * 100);
      }
      // viewsTrend = 0 when both are 0

      // ── KPI 4: Active conversations (distinct recruiters in active pipeline statuses) ──
      let activeConversations = 0;
      if (coachAthleteIds.length > 0) {
        const { data: activeRows } = await supabase
          .from("recruiter_pipeline")
          .select("recruiter_id")
          .in("athlete_id", coachAthleteIds)
          .in("stage", ["CONTACTE", "EN_DISCUSSION", "VISITE_PLANIFIEE", "ENGAGE"]);
        if (activeRows) {
          const uniqueRecruiters = new Set(activeRows.map((r: { recruiter_id: string }) => r.recruiter_id));
          activeConversations = uniqueRecruiters.size;
        }
      }

      setKpi({
        totalAthletes,
        completeProfiles: verifiedCount,
        totalProfiles: totalAthletes,
        completePct: totalAthletes > 0 ? Math.round((verifiedCount / totalAthletes) * 100) : 0,
        recruiterViews: viewsThisMonth,
        viewsTrend,
        activeConversations,
      });

      // ── Hot Athletes: top 5 most-viewed this week ──
      if (coachAthleteIds.length > 0) {
        // Start of current week (Monday, ISO standard)
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - mondayOffset);
        monday.setHours(0, 0, 0, 0);
        const startOfWeek = monday.toISOString();

        // Views this week per athlete
        const { data: viewRows } = await supabase
          .from("recruiter_athlete_views")
          .select("athlete_id")
          .in("athlete_id", coachAthleteIds)
          .gte("viewed_at", startOfWeek);

        const viewCounts = new Map<string, number>();
        for (const r of (viewRows || [])) {
          viewCounts.set(r.athlete_id, (viewCounts.get(r.athlete_id) || 0) + 1);
        }

        // Favorite count per athlete (distinct recruiters who favorited)
        const { data: favRows } = await supabase
          .from("recruiter_favorites")
          .select("athlete_id")
          .in("athlete_id", coachAthleteIds);

        const favCounts = new Map<string, number>();
        if (favRows) {
          for (const r of favRows) {
            favCounts.set(r.athlete_id, (favCounts.get(r.athlete_id) || 0) + 1);
          }
        }

        // Sort by views descending, take top 5
        const sorted = [...viewCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        if (sorted.length > 0) {
          const topIds = sorted.map(([id]) => id);
          const { data: topProfiles } = await supabase
            .from("athletes")
            .select("id, first_name, last_name, cote_globale_entraineur, positions!position_id(abreviation, nom)")
            .in("id", topIds);

          const profileMap = new Map<string, Record<string, unknown>>();
          if (topProfiles) {
            for (const p of topProfiles) profileMap.set(p.id as string, p);
          }

          const hotList: HotAthlete[] = sorted.map(([aid, views], i) => {
            const p = profileMap.get(aid);
            const posRaw = p?.positions;
            const pos = Array.isArray(posRaw) ? posRaw[0] : posRaw;
            const posObj = pos as { abreviation?: string; nom?: string } | null;
            return {
              id: aid,
              rank: i + 1,
              name: `${(p?.first_name as string) || ""} ${(p?.last_name as string) || ""}`.trim(),
              position: posObj?.abreviation || posObj?.nom || "",
              stars: Math.round((p?.cote_globale_entraineur as number) || 0),
              viewsThisWeek: views,
              uniqueRecruiters: favCounts.get(aid) || 0,
            };
          });
          setHotAthletes(hotList);
        }
      }

      // ── Activities feed (from recruiter_activity_log for coach's athletes) ──
      let activityRows: Record<string, unknown>[] | null = null;
      if (coachAthleteIds.length > 0) {
        const { data } = await supabase
          .from("recruiter_activity_log")
          .select("id, action_type, details, created_at, athlete_id")
          .in("athlete_id", coachAthleteIds)
          .order("created_at", { ascending: false })
          .limit(20);
        activityRows = data;
      }

      if (activityRows && activityRows.length > 0) {
        const TYPE_CONFIG: Record<string, { icon: string; iconColor: string; priority: 1 | 2; label: string }> = {
          PROFILE_VIEWED: { icon: "eye", iconColor: "#6B7280", priority: 2, label: "profil consulté par un recruteur" },
          FAVORITED: { icon: "heart", iconColor: "#E63946", priority: 1, label: "ajouté en favori" },
          PIPELINE_CHANGED: { icon: "activity", iconColor: "#F59E0B", priority: 1, label: "mouvement dans un pipeline" },
          ATHLETE_VERIFIED: { icon: "check-circle", iconColor: "#3B82F6", priority: 2, label: "profil vérifié" },
          VIDEO_ADDED: { icon: "film", iconColor: "#8B5CF6", priority: 2, label: "vidéo ajoutée" },
          PROFILE_UPDATED: { icon: "file-text", iconColor: "#6B7280", priority: 2, label: "profil mis à jour" },
          UNFAVORITED: { icon: "heart", iconColor: "#6B7280", priority: 2, label: "retiré des favoris" },
        };

        const mapped: ActivityEvent[] = activityRows.map((row) => {
          const actionType = (row.action_type as string) || "";
          const details = (row.details as Record<string, unknown>) || {};
          const cfg = TYPE_CONFIG[actionType] || { icon: "circle", iconColor: "#6B7280", priority: 2 as const, label: actionType.replace(/_/g, " ").toLowerCase() };
          const athleteName = `${(details.first_name as string) || ""} ${(details.last_name as string) || ""}`.trim();
          const createdAt = new Date(row.created_at as string);

          // Time group
          const now = new Date();
          const diffMs = now.getTime() - createdAt.getTime();
          const diffDays = Math.floor(diffMs / 86400000);
          let timeGroup: ActivityEvent["timeGroup"] = "Semaine dernière";
          if (diffDays === 0) timeGroup = "Aujourd'hui";
          else if (diffDays === 1) timeGroup = "Hier";
          else if (diffDays < 7) timeGroup = "Cette semaine";

          // Relative time
          const diffMin = Math.floor(diffMs / 60000);
          let relativeTime = "À l'instant";
          if (diffMin >= 1 && diffMin < 60) relativeTime = `Il y a ${diffMin} min`;
          else if (diffMin >= 60 && diffDays === 0) relativeTime = `Il y a ${Math.floor(diffMin / 60)}h`;
          else if (diffDays === 1) relativeTime = "Hier";
          else if (diffDays > 1 && diffDays < 7) relativeTime = `Il y a ${diffDays}j`;
          else if (diffDays >= 7) relativeTime = `Il y a ${Math.floor(diffDays / 7)} sem.`;

          return {
            id: row.id as string,
            type: (actionType === "FAVORITED" ? "competitor_favorited"
              : actionType === "PIPELINE_CHANGED" ? "status_engage"
              : actionType === "ATHLETE_VERIFIED" ? "profile_verified"
              : actionType === "VIDEO_ADDED" ? "video_added"
              : actionType === "PROFILE_VIEWED" ? "profile_updated_bulk"
              : "scouting_report_updated") as ActivityEvent["type"],
            priority: cfg.priority,
            direction: "inbound" as const,
            athleteId: (row.athlete_id as string) || undefined,
            athleteName: athleteName || undefined,
            message: athleteName ? `${athleteName} — ${cfg.label}` : cfg.label,
            icon: cfg.icon,
            iconColor: cfg.iconColor,
            actionLabel: "Voir",
            actionUrl: row.athlete_id ? `/coach/athletes/${row.athlete_id as string}` : undefined,
            timestamp: row.created_at as string,
            relativeTime,
            timeGroup,
          };
        });

        setActivities(mapped);
      }

      setLoading(false);
    }

    load();
  }, []);

  async function dismissDemotion(notificationId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("coach_notifications")
      .update({ read: true })
      .eq("id", notificationId);
    if (error) {
      console.error("[Dashboard] dismiss failed:", error);
      return;
    }
    setDemotionNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-8">

      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          {loading
            ? "Chargement…"
            : `Bienvenue, ${coachName}${schoolName ? ` — ${schoolName}` : ""}`
          }
        </p>
        <p className="text-[12px] text-[#6b7280] mt-0.5 capitalize">{frenchDate()}</p>
      </div>

      {/* Interim director status (persistent while role is held) */}
      {isInterimDirector && (
        <div className="rounded-xl border border-[#6B7280]/30 bg-[#6B7280]/[0.06] px-5 py-4 flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-[#c8c8cc]">
              Tu es directeur sportif intérimaire{interimSchoolName ? ` de ${interimSchoolName}` : ""}
            </p>
            <p className="text-[13px] text-[#9CA3AF] mt-0.5 leading-relaxed">
              Tu as les pleins pouvoirs administratifs jusqu&apos;à l&apos;arrivée d&apos;un directeur permanent. Si un directeur officiel s&apos;inscrit et choisit «&nbsp;C&apos;est moi&nbsp;», ton rôle sera automatiquement ramené à entraîneur.
            </p>
          </div>
        </div>
      )}

      {/* Demotion notification — dismissible */}
      {demotionNotifications.map((n) => {
        return (
          <div
            key={n.id}
            className="rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/[0.06] px-5 py-4 flex items-start gap-3"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-[#F59E0B]">
                {n.title}
              </p>
              {n.message && (
                <p className="text-[13px] text-[#9CA3AF] mt-0.5 leading-relaxed">
                  {n.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissDemotion(n.id)}
              aria-label="Fermer"
              className="shrink-0 text-[#9CA3AF] hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}

      {/* Zone 1: Action Bar */}
      <ActionBar data={actionBar} />

      {/* Zone 2: KPI Cards */}
      <KpiCards data={kpi} />

      {/* Zone 3 + 4: Hot Athletes + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <HotAthletes athletes={hotAthletes} />
        </div>
        <div className="xl:col-span-2">
          <ActivityFeed events={activities} />
        </div>
      </div>

    </div>
  );
}
