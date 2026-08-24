"use client";

import { useEffect, useState } from "react";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isValidationExpired } from "@/lib/utils/profileValidation";
import AthleteDashboardMobile from "@/components/shared/AthleteDashboardMobile";
import { countAthleteUnread } from "@/lib/messaging/athleteUnread";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Athlete Dashboard — personal, encouraging tone ("tu" everywhere)
═══════════════════════════════════════════════════════════════ */

type ActivityItem = {
  id: string;
  type: "profile_viewed" | "new_favorite" | "coach_update" | "suggestion_approved" | "suggestion_rejected" | "milestone" | "completion_reminder";
  message: string;
  time: string;
  read: boolean;
};

type ChecklistItem = {
  label: string;
  boost: number;
  done: boolean;
  section?: string;
};

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

function completenessColor(pct: number): string {
  if (pct < 40) return "#EF4444";
  if (pct < 70) return "#6B7280";
  return "#3B82F6";
}

const ACTIVITY_DOT: Record<ActivityItem["type"], string> = {
  profile_viewed: "#9CA3AF",
  new_favorite: "#E63946",
  coach_update: "#3B82F6",
  suggestion_approved: "#22C55E",
  suggestion_rejected: "#E63946",
  milestone: "#F59E0B",
  completion_reminder: "#EAB308",
};

export default function AthleteDashboardPage() {
  // Capacitor → mobile-native dashboard (Phase 1 re-skin onto shared
  // coach/recruiter design primitives). Web (non-Capacitor) keeps its
  // existing responsive layout below — proven reference, byte-for-byte
  // unchanged.
  if (IS_CAPACITOR) return <AthleteDashboardMobile />;
  return <AthleteDashboardPageDesktop />;
}

function AthleteDashboardPageDesktop() {
  const [firstName, setFirstName] = useState<string>("");
  const [verified, setVerified] = useState<boolean>(false);
  const [profileCompletion, setProfileCompletion] = useState<number>(0);
  const [lastValidation, setLastValidation] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState<{ count: number; latestTitle: string | null }>({ count: 0, latestTitle: null });
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [viewsThisMonth, setViewsThisMonth] = useState(0);
  const [viewsLastMonth, setViewsLastMonth] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [regionsCount, setRegionsCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
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
        setLastValidation((data.last_profile_validation as string) || null);
        setProfileCompletion((data.profile_completion as number) || 0);
      }

      /* Relance de re-validation. La règle est réévaluée SERVEUR à chaque
         ouverture : le client ne décide rien, il déclenche. La RPC est
         idempotente (une notification par athlète et par mois, garantie par
         un index unique partiel), donc l'appeler ici ET depuis le tableau de
         bord mobile ne peut pas produire de doublon. Échec silencieux
         assumé : rater une relance ne doit pas casser le tableau de bord. */
      await supabase.rpc("ensure_validation_notice");

      const { data: athleteRow } = await supabase
        .from("athletes")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (athleteRow?.id) {
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

        /* Messages non lus. MÊME fonction que le badge de la barre latérale
           et de la barre d'onglets mobile — un troisième compte recopié ici
           aurait le même angle mort que les deux premiers. Couvre les fils
           coach, recruteur, de service et de groupe, avec leurs deux
           mécaniques de lecture. Voir lib/messaging/athleteUnread.ts. */
        setUnreadMsgs(await countAthleteUnread(supabase, user.id, athleteRow.id as string));

        // 5.5e-iv-c: pending Flow A invitations count for the dashboard
        // banner. Refresh hook is the same 'notifications-updated' event
        // dispatched by 5.5e-iv-b accept/reject handlers — load() runs
        // again on the event so this count stays in sync.
        const { count: pendingCount } = await supabase
          .from("team_invitations")
          .select("id", { count: "exact", head: true })
          .eq("athlete_id", athleteRow.id)
          .eq("status", "PENDING");
        setPendingInvitations(pendingCount ?? 0);

        // ── Real KPI data ──────────────────────────────────────
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

        // ── Activity feed ──────────────────────────────────────
        const { data: activityRows } = await supabase
          .from("recruiter_activity_log")
          .select("id, action_type, created_at, recruiter_id")
          .eq("athlete_id", athleteRow.id)
          .order("created_at", { ascending: false })
          .limit(20);

        // Resolve recruiter regions via public.users (recruiter_id FK points at auth.users,
        // which isn't embeddable — same two-step pattern as the favorites region lookup above)
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

        if (activityRows && activityRows.length > 0) {
          const mapped: ActivityItem[] = activityRows.map((row: { id: string; action_type: string; created_at: string; recruiter_id: string }) => {
            const recruiterRegion = regionById.get(row.recruiter_id) ?? null;
            const regionLabel = recruiterRegion ? ` de la région ${recruiterRegion}` : "";
            let type: ActivityItem["type"] = "profile_viewed";
            let message = "";
            switch (row.action_type) {
              case "PROFILE_VIEWED":
                type = "profile_viewed";
                message = `Un recruteur${regionLabel} a consulté ton profil`;
                break;
              case "FAVORITE_ADDED":
                type = "new_favorite";
                message = `Un recruteur${regionLabel} t'a ajouté à ses favoris`;
                break;
              case "ATHLETE_VERIFIED":
                type = "coach_update";
                message = "Ton profil a été vérifié par ton coach";
                break;
              default:
                type = "profile_viewed";
                message = `Activité: ${row.action_type}`;
            }
            return {
              id: row.id,
              type,
              message,
              time: formatRelativeTime(row.created_at),
              read: true,
            };
          });
          setActivities(mapped);
        } else {
          setActivities([]);
        }

        // ── Profile checklist (derived from real fields) ───────
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
      }
    };
    load();
    const handler = () => load();
    window.addEventListener("notifications-updated", handler);
    return () => window.removeEventListener("notifications-updated", handler);
  }, []);
  const badgeActive = verified && !isValidationExpired({ verified, last_profile_validation: lastValidation });
  const pctColor = completenessColor(profileCompletion);
  const viewsTrend: number | null = viewsLastMonth > 0
    ? Math.round(((viewsThisMonth - viewsLastMonth) / viewsLastMonth) * 100)
    : null;
  const unreadCount = activities.filter((a) => !a.read).length;

  const markRead = (id: string) => {
    setActivities((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
  };

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto space-y-6">

      {/* ── Greeting ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Salut {firstName || "..."}!
        </h1>
        {verified && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill={badgeActive ? "#3B82F6" : "#4a4d56"} stroke="none" aria-label={badgeActive ? "Profil vérifié" : "Badge désactivé"}>
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" stroke={badgeActive ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </div>
      <p className="text-[14px] text-[#9CA3AF] -mt-4">Voici ce qui se passe avec ton profil</p>

      {/* ── Pending invitations banner (5.5e-iv-c) ────────────── */}
      {pendingInvitations > 0 && (
        <Link
          href="/athlete/notifications"
          className="flex items-center gap-4 bg-[#1A1D24] border border-[#E63946]/30 hover:border-[#E63946]/60 rounded-xl px-5 py-4 transition-colors group"
        >
          <span className="w-11 h-11 shrink-0 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center text-xl">
            🤝
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-bold text-white leading-tight">
                Invitations en attente
              </p>
              <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 bg-[#E63946] rounded-full text-[11px] font-bold text-white leading-none">
                {pendingInvitations}
              </span>
            </div>
            <p className="text-[12px] text-[#9CA3AF] truncate mt-1">
              Tu as {pendingInvitations} invitation{pendingInvitations > 1 ? "s" : ""} d&apos;équipe à examiner
            </p>
          </div>
          <span className="text-[12px] font-bold text-[#E63946] group-hover:text-[#D42B22] shrink-0">
            Voir tout →
          </span>
        </Link>
      )}

      {/* ── Messagerie ────────────────────────────────────────────
           Jumeau du bandeau de notifications, en vert : c'est l'accent de
           la messagerie athlète (badge de la barre latérale, pastille de
           non-lus de l'inbox), et le rouge est déjà pris par les
           notifications juste en dessous.

           AFFICHÉ MÊME À ZÉRO, délibérément. Le dashboard ne portait AUCUN
           lien vers /athlete/messages — ni carte, ni bandeau, ni entrée.
           Un bandeau conditionné à `> 0` laisserait la messagerie invisible
           dans le cas courant, c'est-à-dire exactement le défaut qu'on
           corrige. L'état vide est donc discret plutôt qu'absent.
           Pour revenir au comportement conditionnel : envelopper dans
           {unreadMsgs > 0 && (…)}. */}
      <Link
        href="/athlete/messages"
        className={`flex items-center gap-4 bg-[#1A1D24] border rounded-xl px-5 py-4 transition-colors group ${
          unreadMsgs > 0
            ? "border-[#22C55E]/30 hover:border-[#22C55E]/60"
            : "border-white/5 hover:border-white/15"
        }`}
      >
        <span
          className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center border ${
            unreadMsgs > 0
              ? "bg-[#22C55E]/10 border-[#22C55E]/30"
              : "bg-white/[0.03] border-white/10"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={unreadMsgs > 0 ? "#22C55E" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-[13px] font-bold leading-tight ${unreadMsgs > 0 ? "text-white" : "text-[#9CA3AF]"}`}>
              {unreadMsgs > 0 ? "Nouveaux messages" : "Messagerie"}
            </p>
            {unreadMsgs > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 bg-[#22C55E] rounded-full text-[11px] font-bold text-[#0b0d10] leading-none">
                {unreadMsgs}
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#6b7280] truncate mt-1">
            {unreadMsgs > 0
              ? `${unreadMsgs} message${unreadMsgs > 1 ? "s" : ""} non lu${unreadMsgs > 1 ? "s" : ""}`
              : "Aucun nouveau message"}
          </p>
        </div>
        <span className={`text-[12px] font-bold shrink-0 ${unreadMsgs > 0 ? "text-[#22C55E]" : "text-[#6b7280] group-hover:text-[#9CA3AF]"}`}>
          Ouvrir →
        </span>
      </Link>

      {/* ── Unread notifications banner ───────────────────────── */}
      {unreadNotifs.count > 0 && (
        <Link
          href="/athlete/notifications"
          className="flex items-center gap-4 bg-[#1A1D24] border border-[#E63946]/30 hover:border-[#E63946]/60 rounded-xl px-5 py-4 transition-colors group"
        >
          <span className="w-11 h-11 shrink-0 rounded-full bg-[#E63946]/10 border border-[#E63946]/30 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-bold text-white leading-tight">
                Nouvelles notifications
              </p>
              <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 bg-[#E63946] rounded-full text-[11px] font-bold text-white leading-none">
                {unreadNotifs.count}
              </span>
            </div>
            {unreadNotifs.latestTitle && (
              <p className="text-[12px] text-[#9CA3AF] truncate mt-1">{unreadNotifs.latestTitle}</p>
            )}
          </div>
          <span className="text-[12px] font-bold text-[#E63946] group-hover:text-[#D42B22] shrink-0">
            Voir tout →
          </span>
        </Link>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Views this month */}
        <div className="group bg-[#1A1D24] rounded-xl border border-white/5 p-5 hover:border-[#E63946]/20 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Vues ce mois</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <p className="font-head text-[36px] font-black text-white leading-none">{viewsThisMonth}</p>
          {viewsTrend !== null && viewsTrend > 0 && (
            <p className="text-[12px] font-bold text-[#22C55E] mt-1.5">↑{viewsTrend}% vs mois dernier</p>
          )}
          {viewsTrend !== null && viewsTrend < 0 && (
            <p className="text-[12px] font-bold text-[#EF4444] mt-1.5">↓{Math.abs(viewsTrend)}% vs mois dernier</p>
          )}
        </div>

        {/* Interested recruiters */}
        <div className="group bg-[#1A1D24] rounded-xl border border-white/5 p-5 hover:border-[#E63946]/20 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Recruteurs intéressés</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
          <p className="font-head text-[36px] font-black text-white leading-none">{favoritesCount}</p>
          {regionsCount > 0 && (
            <p className="text-[12px] text-[#6b7280] mt-1.5">de {regionsCount} région{regionsCount > 1 ? "s" : ""} différente{regionsCount > 1 ? "s" : ""}</p>
          )}
        </div>

        {/* Profile completeness */}
        <div className="group bg-[#1A1D24] rounded-xl border border-white/5 p-5 hover:border-[#E63946]/20 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Complétion du profil</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={pctColor} strokeWidth="2" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <p className="font-head text-[36px] font-black leading-none" style={{ color: pctColor }}>{profileCompletion}%</p>
          <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden mt-3">
            <div className="h-full rounded-full transition-all" style={{ width: `${profileCompletion}%`, backgroundColor: pctColor }} />
          </div>
          <Link href="/athlete/profil" className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] mt-2 inline-block transition-colors">
            Améliorer →
          </Link>
        </div>
      </div>

      {/* ── Middle Section: Activity + Checklist ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Activity Feed (60%) */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Activité récente</h2>
            {unreadCount > 0 && (
              <span className="text-[11px] font-bold text-[#E63946]">{unreadCount} non lu{unreadCount > 1 ? "s" : ""}</span>
            )}
          </div>
          <div className="space-y-2">
            {activities.length === 0 ? (
              <div className="bg-[#1A1D24] rounded-lg border border-white/5 p-8 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <p className="text-[13px] text-[#9CA3AF] font-semibold">Aucune activité pour l&apos;instant</p>
                <p className="text-[12px] text-[#6b7280] mt-1.5">Partage ton profil pour attirer les recruteurs</p>
              </div>
            ) : (
              activities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => markRead(a.id)}
                  className={`group w-full text-left bg-[#1A1D24] rounded-lg border p-4 transition-all duration-300 hover:border-[#2D3748] relative overflow-hidden ${
                    a.read ? "border-white/5" : "border-[#2D3748] bg-[#1A1D24]"
                  }`}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5">
                      <span className="block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ACTIVITY_DOT[a.type] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-relaxed ${a.read ? "text-[#9CA3AF]" : "text-white font-semibold"}`}>
                        {a.message}
                      </p>
                      <p className="text-[11px] text-[#4a4d56] mt-1">{a.time}</p>
                    </div>
                    {!a.read && (
                      <span className="w-2 h-2 rounded-full bg-[#E63946] shrink-0 mt-2" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Profile Improvement Checklist (40%) */}
        {profileCompletion < 100 && (
          <div className="lg:col-span-2">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Améliore ton profil</h2>
            <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5 space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  {item.done ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
                      <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
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
                <Link href="/athlete/profil" className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors flex items-center gap-1">
                  Compléter mon profil
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats Impact Banner ────────────────────────────────── */}
      {verified && (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 px-5 py-3.5 flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
          </svg>
          <p className="text-[13px] text-[#9CA3AF]">
            Les profils vérifiés comme le tien reçoivent <span className="font-bold text-white">11x</span> plus de vues
          </p>
        </div>
      )}
    </div>
  );
}
