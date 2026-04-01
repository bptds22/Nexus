"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ActionBar from "./_components/ActionBar";
import KpiCards from "./_components/KpiCards";
import HotAthletes from "./_components/HotAthletes";
import ActivityFeed from "./_components/ActivityFeed";

import type { ActionBarData, KpiData, HotAthlete } from "./_data/mockDashboardData";
import type { ActivityEvent } from "@/lib/types/activityEvents";

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
  const [coachName, setCoachName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [actionBar, setActionBar] = useState<ActionBarData>({ unreadMessages: 0, incompleteProfiles: 0, newAthletes: 0 });
  const [kpi, setKpi] = useState<KpiData>({ totalAthletes: 0, completeProfiles: 0, totalProfiles: 0, completePct: 0, recruiterViews: 0, viewsTrend: 0, activeConversations: 0 });
  const [hotAthletes, setHotAthletes] = useState<HotAthlete[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Load coach profile + school name
      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, school_id, schools!school_id(name)")
        .eq("id", user.id)
        .single();

      if (profile) {
        const firstName = (profile.first_name as string) || "";
        const lastName = (profile.last_name as string) || "";
        setCoachName(`${firstName} ${lastName}`.trim() || "Coach");

        const schoolRaw = profile.schools;
        const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;
        const schoolObj = school as { name?: string } | null;
        setSchoolName(schoolObj?.name || "");
      }

      // Get all coach's athletes (active)
      const { data: athleteRows } = await supabase
        .from("athletes")
        .select("id, verified")
        .eq("coach_id", user.id)
        .eq("status", "ACTIF");
      console.log("Dashboard athletes:", athleteRows);

      const athletes = athleteRows || [];
      const coachAthleteIds = athletes.map((a: { id: string }) => a.id);
      const totalAthletes = athletes.length;
      const verifiedCount = athletes.filter((a: { verified: boolean }) => a.verified).length;

      // Banner 1: unread recruiter contacts (CONTACTE status in pipeline for coach's athletes)
      let unreadMessages = 0;
      if (coachAthleteIds.length > 0) {
        const { count } = await supabase
          .from("pipeline")
          .select("id", { count: "exact", head: true })
          .eq("status", "CONTACTE")
          .in("athlete_id", coachAthleteIds);
        unreadMessages = count || 0;
        console.log("Dashboard unread contacts:", count);
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
      console.log("Dashboard new athletes (unread):", newAthletesCount);

      setActionBar({
        unreadMessages,
        incompleteProfiles: unverifiedCount,
        newAthletes: newAthletesCount || 0,
      });

      // ── KPI 3: Recruiter views (this month vs last month) ──
      const now = new Date();
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      let viewsThisMonth = 0;
      let viewsLastMonth = 0;
      if (coachAthleteIds.length > 0) {
        const { count: thisMonthCount } = await supabase
          .from("athlete_views")
          .select("id", { count: "exact", head: true })
          .in("athlete_id", coachAthleteIds)
          .gte("viewed_at", firstOfThisMonth)
          .lt("viewed_at", firstOfNextMonth);
        viewsThisMonth = thisMonthCount || 0;
        console.log("Dashboard views this month:", thisMonthCount);

        const { count: lastMonthCount } = await supabase
          .from("athlete_views")
          .select("id", { count: "exact", head: true })
          .in("athlete_id", coachAthleteIds)
          .gte("viewed_at", firstOfLastMonth)
          .lt("viewed_at", firstOfThisMonth);
        viewsLastMonth = lastMonthCount || 0;
        console.log("Dashboard views last month:", lastMonthCount);
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
          .from("pipeline")
          .select("recruiter_id")
          .in("athlete_id", coachAthleteIds)
          .in("status", ["CONTACTE", "EN_DISCUSSION", "VISITE_PLANIFIEE", "ENGAGE"]);
        console.log("Dashboard active pipeline rows:", activeRows);
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
          .from("athlete_views")
          .select("athlete_id")
          .in("athlete_id", coachAthleteIds)
          .gte("viewed_at", startOfWeek);
        console.log("Hot athletes view rows this week:", viewRows);

        const viewCounts = new Map<string, number>();
        if (viewRows) {
          for (const r of viewRows) {
            viewCounts.set(r.athlete_id, (viewCounts.get(r.athlete_id) || 0) + 1);
          }
        }

        // Pipeline count per athlete (total recruiters interested)
        const { data: pipeRows } = await supabase
          .from("pipeline")
          .select("athlete_id")
          .in("athlete_id", coachAthleteIds);

        const pipeCounts = new Map<string, number>();
        if (pipeRows) {
          for (const r of pipeRows) {
            pipeCounts.set(r.athlete_id, (pipeCounts.get(r.athlete_id) || 0) + 1);
          }
        }

        // Sort by views descending, take top 5
        const sorted = [...viewCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        console.log("Hot athletes ranking:", sorted);

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
              uniqueRecruiters: pipeCounts.get(aid) || 0,
            };
          });
          setHotAthletes(hotList);
        }
      }

      // ── Activities feed ──
      const { data: activityRows } = await supabase
        .from("activities")
        .select("*, athletes(first_name, last_name)")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      console.log("Dashboard activities:", activityRows);

      if (activityRows && activityRows.length > 0) {
        const todayStr = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        // Start of week (Monday)
        const dayOfWeek = new Date().getDay();
        const mondayOff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - mondayOff);
        weekStart.setHours(0, 0, 0, 0);

        const TYPE_CONFIG: Record<string, { icon: string; iconColor: string; priority: 1 | 2; message: string; actionLabel: string }> = {
          PROFILE_MODIFIED: { icon: "file-text", iconColor: "#F59E0B", priority: 2, message: "{athlete} a mis à jour son profil.", actionLabel: "Voir le profil" },
          PROFILE_VERIFIED: { icon: "check-circle", iconColor: "#2563EB", priority: 2, message: "{athlete} est maintenant un profil vérifié.", actionLabel: "Voir le profil" },
          NEW_MESSAGE: { icon: "message-circle", iconColor: "#22C55E", priority: 1, message: "Nouveau message de {recruiter}, {cegep}, concernant {athlete}.", actionLabel: "Voir la conversation" },
          FAVORITED: { icon: "heart", iconColor: "#E63946", priority: 1, message: "{athlete} a été ajouté aux favoris par des recruteurs.", actionLabel: "Voir le profil" },
          STATUS_CHANGED: { icon: "pen-tool", iconColor: "#E63946", priority: 1, message: "{athlete} a changé de statut.", actionLabel: "Voir le profil" },
          ATHLETE_ADDED: { icon: "user-plus", iconColor: "#22C55E", priority: 2, message: "{athlete} a été ajouté à la plateforme.", actionLabel: "Voir le profil" },
          VIDEO_ADDED: { icon: "film", iconColor: "#22C55E", priority: 1, message: "{athlete} a ajouté une nouvelle vidéo highlights.", actionLabel: "Regarder la vidéo" },
          BADGE_EARNED: { icon: "award", iconColor: "#F97316", priority: 2, message: "{athlete} a reçu un badge.", actionLabel: "Voir le profil" },
        };

        const mapped: ActivityEvent[] = activityRows.map((row: Record<string, unknown>) => {
          const type = (row.type as string) || "";
          const cfg = TYPE_CONFIG[type] || { icon: "circle", iconColor: "#6B7280", priority: 2 as const, message: "Activité.", actionLabel: "Voir" };
          const meta = (row.metadata as Record<string, unknown>) || {};
          const athleteJoin = row.athletes as { first_name?: string; last_name?: string } | null;
          const athleteName = athleteJoin ? `${athleteJoin.first_name || ""} ${athleteJoin.last_name || ""}`.trim() : "";
          const createdAt = new Date(row.created_at as string);
          const createdDateStr = createdAt.toDateString();

          // Time group
          let timeGroup: ActivityEvent["timeGroup"] = "Cette semaine";
          if (createdDateStr === todayStr) timeGroup = "Aujourd'hui";
          else if (createdDateStr === yesterdayStr) timeGroup = "Hier";
          else if (createdAt >= weekStart) timeGroup = "Cette semaine";
          else timeGroup = "Semaine dernière";

          // Relative time
          const diffMs = Date.now() - createdAt.getTime();
          const diffMin = Math.floor(diffMs / 60000);
          const diffH = Math.floor(diffMin / 60);
          let relativeTime = "";
          if (timeGroup === "Aujourd'hui") {
            if (diffMin < 60) relativeTime = `Il y a ${diffMin} min`;
            else relativeTime = `Il y a ${diffH}h`;
          } else if (timeGroup === "Hier") {
            relativeTime = `Hier, ${createdAt.getHours()}h${createdAt.getMinutes().toString().padStart(2, "0")}`;
          } else {
            const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
            relativeTime = dayNames[createdAt.getDay()];
          }

          // Build message with metadata
          let message = cfg.message;
          let actionLabel = cfg.actionLabel;
          let actionUrl = `/coach/athletes/${row.athlete_id as string}`;
          if (type === "NEW_MESSAGE") {
            message = `Nouveau message de {recruiter}, {cegep}, concernant {athlete}.`;
            actionUrl = "/coach/demandes";
            actionLabel = "Voir la conversation";
          } else if (type === "FAVORITED" && meta.count) {
            message = `{athlete} a été ajouté aux favoris par ${meta.count} recruteurs cette semaine.`;
          } else if (type === "STATUS_CHANGED" && meta.new_status === "LETTRE_SIGNEE") {
            message = "{athlete} a signé sa lettre d'intention!";
          } else if (type === "STATUS_CHANGED" && meta.new_status) {
            message = `{athlete} est passé au statut ${meta.new_status as string}.`;
          } else if (type === "ATHLETE_ADDED" && meta.position) {
            message = `{athlete} (${meta.position as string}) a été ajouté à la plateforme.`;
          } else if (type === "BADGE_EARNED" && meta.badge_name) {
            message = `{athlete} a reçu le badge ${meta.badge_name as string}.`;
          } else if (type === "VIDEO_ADDED") {
            actionLabel = "Regarder la vidéo";
          }

          const ev: ActivityEvent = {
            id: row.id as string,
            type: (type === "NEW_MESSAGE" ? "coach_replied"
              : type === "FAVORITED" ? "competitor_favorited"
              : type === "STATUS_CHANGED" ? "status_lettre_signee"
              : type === "ATHLETE_ADDED" ? "new_athlete"
              : type === "VIDEO_ADDED" ? "video_added"
              : type === "BADGE_EARNED" ? "badge_added"
              : type === "PROFILE_VERIFIED" ? "profile_verified"
              : type === "PROFILE_MODIFIED" ? "scouting_report_updated"
              : "profile_updated_bulk") as ActivityEvent["type"],
            priority: cfg.priority,
            direction: "inbound",
            athleteId: (row.athlete_id as string) || undefined,
            athleteName,
            recruiterId: (meta.recruiter_id as string) || undefined,
            recruiterName: (meta.recruiter_name as string) || undefined,
            cegepName: (meta.cegep_name as string) || undefined,
            message,
            icon: cfg.icon,
            iconColor: cfg.iconColor,
            actionLabel,
            actionUrl,
            timestamp: row.created_at as string,
            relativeTime,
            timeGroup,
            metadata: {
              badgeName: (meta.badge_name as string) || undefined,
              favCount: (meta.count as number) || undefined,
            },
          };
          return ev;
        });

        setActivities(mapped);
      }

      setLoading(false);
    }

    load();
  }, []);

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
