"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachDashboardMobile — Page Dashboard coach mobile-native (iter coach-1)
   Calqué sur RecruteurDashboardMobile (template validé) — même tokens,
   même Outfit weights, mêmes patterns (hero gradient + KPI bento +
   horizontal-scroll strip + activity feed).

   Architecture : Option B — useEffect inline porté de la page web
   coach actuelle (app/coach/tableau-de-bord/page.tsx). Pas de hooks
   TanStack pour ce sprint.

   Source intérim : feat/capacitor-setup branch — is_school_admin +
   profile_data.admin_type === 'interim' (PAS la query legacy
   school_coaches.role='DIRECTEUR_INTERIM' qui ne couvrait que APPROVED
   et était dépréciée au sprint coach-responsable-2c).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ActivityEvent } from "@/lib/types/activityEvents";
import { loadCoachTaskCounts } from "@/lib/coach/tasks";
import { DashboardGradientLayout } from "@/components/shared/dashboard/DashboardGradientLayout";
import { DashboardGreeting } from "@/components/shared/dashboard/DashboardGreeting";
import { DashboardHero } from "@/components/shared/dashboard/DashboardHero";
import { DashboardActivityFeed } from "@/components/shared/dashboard/DashboardActivityFeed";
import { SectionDivider } from "@/components/shared/dashboard/SectionDivider";
import { frenchDateUppercase, getInitials, triggerHaptic } from "@/components/shared/dashboard/utils";

/* ── Types data (locaux — alignés sur les états de la web page) ─ */

interface ActionBarData {
  unreadMessages: number;
  incompleteProfiles: number;
  newAthletes: number;
  pendingSuggestions: number;
  /** ÉTAPE 3c — évaluations manquantes (manque cote OU rapport coach).
   *  Compté par lib/coach/tasks.loadCoachTaskCounts.missingEval. */
  missingEvals: number;
}

interface KpiData {
  totalAthletes: number;
  verifiedCount: number;
  completePct: number;
  recruiterViews: number;
  viewsTrend: number;
}

interface HotAthleteRow {
  id: string;
  rank: number; // 1..5
  name: string;
  position: string;
  stars: number;
  photoUrl: string | null;
  viewsThisWeek: number;
  uniqueRecruiters: number;
}

interface DemotionNotif {
  id: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
}

/* Local DashboardHero — REMOVED. Replaced by the shared
   <DashboardHero> from components/shared/dashboard, with role-
   specific headline + 3 inset KpiCards (Roster / Vérifiés+
   progress / Vues+trend) passed from the render block below. */

/* ═══════════════════════════════════════════════════════════════
   InterimBanner — gris neutre, persistant (source = is_school_admin
   + profile_data.admin_type === 'interim')
═══════════════════════════════════════════════════════════════ */

function InterimBanner({ schoolName }: { schoolName: string }) {
  return (
    <div className="mx-4 mt-4 rounded-2xl border border-white/[0.06] bg-[#1A1D24] px-4 py-3.5 flex items-start gap-3">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-white">
          Tu es responsable de sports intérimaire{schoolName ? ` de ${schoolName}` : ""}
        </p>
        <p className="text-[13px] text-white/55 mt-0.5 leading-relaxed">
          Tu as les pleins pouvoirs administratifs jusqu&apos;à l&apos;arrivée d&apos;un responsable de sports permanent.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DemotionNotificationCard — gold amber, dismissible
═══════════════════════════════════════════════════════════════ */

function DemotionNotificationCard({
  notif, onDismiss,
}: {
  notif: DemotionNotif;
  onDismiss: () => void;
}) {
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-[#F59E0B]/25 bg-[#F59E0B]/[0.06] px-4 py-3.5 flex items-start gap-3">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-[#F59E0B]">{notif.title}</p>
        {notif.message && (
          <p className="text-[13px] text-white/55 mt-0.5 leading-relaxed">{notif.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => { triggerHaptic("Light"); onDismiss(); }}
        aria-label="Fermer"
        className="shrink-0 text-white/55 active:text-white transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KpiTrio — 3 cards bento (Athlètes / Profils vérifiés / Vues)
═══════════════════════════════════════════════════════════════ */

/* Local KpiTrio — REMOVED. The 3 stats (Roster / Vérifiés / Vues)
   are now hoisted into the shared <DashboardHero>'s inset row,
   with the Vérifiés inset showing a true ratio progress bar
   (verifiedCount / totalAthletes) and the Vues inset carrying the
   ±% trend chip. KpiTrio had no other consumer. */

/* ═══════════════════════════════════════════════════════════════
   CoachActionBar — 4 banner cards (rouge / amber / coach-only)
═══════════════════════════════════════════════════════════════ */

function CoachActionBar({
  data, onTapMessages, onTapIncomplete, onTapMissingEvals, onTapNewAthletes, onTapSuggestions,
}: {
  data: ActionBarData;
  onTapMessages: () => void;
  onTapIncomplete: () => void;
  /** ÉTAPE 3c — nouvelle carte "Évaluations manquantes" (gold + star). */
  onTapMissingEvals: () => void;
  onTapNewAthletes: () => void;
  onTapSuggestions: () => void;
}) {
  const hasAny =
    data.unreadMessages > 0 || data.incompleteProfiles > 0 ||
    data.newAthletes > 0 || data.pendingSuggestions > 0 || data.missingEvals > 0;

  if (!hasAny) return null;

  return (
    <div className="px-4">
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-3">
        À traiter
      </h2>
      <div className="space-y-2.5">
        {/* Intérêt recruteur (vert #22C55E — sémantique messaging /
            contact-request, source recruiter_pipeline stage CONTACTE) */}
        {data.unreadMessages > 0 && (
          <ActionRow
            accent="#22C55E"
            iconBg="#22C55E"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            }
            title={`${data.unreadMessages} recruteur${data.unreadMessages > 1 ? "s" : ""} intéressé${data.unreadMessages > 1 ? "s" : ""}`}
            subtitle="Consulte les demandes de contact"
            badge={data.unreadMessages}
            badgeBg="#22C55E"
            onTap={onTapMessages}
          />
        )}

        {/* Profils non vérifiés (gris #4a4d56 — canon non-verified state) */}
        {data.incompleteProfiles > 0 && (
          <ActionRow
            accent="#4a4d56"
            iconBg="#4a4d56"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L4 7v6c0 5 4 9 8 9s8-4 8-9V7l-8-5z" />
              </svg>
            }
            title={`${data.incompleteProfiles} profil${data.incompleteProfiles > 1 ? "s" : ""} non vérifié${data.incompleteProfiles > 1 ? "s" : ""}`}
            subtitle="Évalue et valide pour booster leur visibilité"
            badge={data.incompleteProfiles}
            badgeBg="#4a4d56"
            onTap={onTapIncomplete}
          />
        )}

        {/* Évaluations manquantes (gold #F59E0B — star icon, domaine rating).
            ÉTAPE 3c : nouvelle catégorie alimentée par loadCoachTaskCounts.missingEval. */}
        {data.missingEvals > 0 && (
          <ActionRow
            accent="#F59E0B"
            iconBg="#F59E0B"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            }
            title={`${data.missingEvals} évaluation${data.missingEvals > 1 ? "s" : ""} manquante${data.missingEvals > 1 ? "s" : ""}`}
            subtitle="Donne une cote globale ou un rapport à ces athlètes"
            badge={data.missingEvals}
            badgeBg="#F59E0B"
            onTap={onTapMissingEvals}
          />
        )}

        {/* Nouveaux athlètes (gris neutre — info récente) */}
        {data.newAthletes > 0 && (
          <ActionRow
            accent="#6B7280"
            iconBg="#3B82F6"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            }
            title={`${data.newAthletes} nouvel athlète${data.newAthletes > 1 ? "s" : ""} ajouté${data.newAthletes > 1 ? "s" : ""}`}
            subtitle="Voir le détail dans tes activités"
            badge={data.newAthletes}
            badgeBg="#3B82F6"
            onTap={onTapNewAthletes}
          />
        )}

        {/* Suggestions athlètes en attente (rouge — bloque l'athlète) */}
        {data.pendingSuggestions > 0 && (
          <ActionRow
            accent="#E63946"
            iconBg="#1A1D24"
            iconBorder="#E63946"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
            }
            title={`${data.pendingSuggestions} suggestion${data.pendingSuggestions > 1 ? "s" : ""} en attente`}
            subtitle="Approuve les modifications proposées par tes athlètes"
            badge={data.pendingSuggestions}
            badgeBg="#E63946"
            onTap={onTapSuggestions}
          />
        )}
      </div>
    </div>
  );
}

function ActionRow({
  accent, icon, iconBg, iconBorder, title, subtitle, badge, badgeBg, onTap,
}: {
  accent: string;
  icon: React.ReactNode;
  iconBg: string;
  iconBorder?: string;
  title: string;
  subtitle: string;
  badge: number;
  badgeBg: string;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className="w-full flex items-center gap-3 rounded-2xl bg-[#1A1D24] border border-white/[0.05] px-4 py-3.5 active:bg-white/[0.04] transition-colors text-left relative overflow-hidden"
    >
      {/* Accent bar */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: accent }}
      />
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ml-1"
        style={{
          backgroundColor: iconBg,
          border: iconBorder ? `1.5px solid ${iconBorder}` : undefined,
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white truncate">{title}</p>
        <p className="text-[13px] text-white/55 mt-0.5 truncate">{subtitle}</p>
      </div>
      <span
        className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-white text-[13px] font-bold tabular-nums flex-shrink-0"
        style={{ backgroundColor: badgeBg }}
      >
        {badge}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HotAthletesStrip — horizontal-scroll 4:5 (parité TrendingAthletes
   recruteur, mais avec RANK badge à la place du heart top-left)
═══════════════════════════════════════════════════════════════ */

function HotAthleteCard({ athlete, onTap }: {
  athlete: HotAthleteRow;
  onTap: () => void;
}) {
  // Rank badge : #1 = rouge plein (#E63946), #2-5 = blanc/gris sur inset
  // (#0C0E12). PAS de bleu (réservé verified semantic).
  const isTopRank = athlete.rank === 1;
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className="relative flex-shrink-0 w-[168px] aspect-[4/5] rounded-2xl overflow-hidden bg-[#1A1D24] active:opacity-80 transition-opacity text-left"
    >
      {/* Photo / fallback initiales (pas de composant partagé léger sans
          dep externe → on inline). */}
      {athlete.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={athlete.photoUrl}
          alt={athlete.name}
          className="absolute inset-0 w-full h-full object-cover object-[center_15%]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0C0E12]">
          <span className="text-[48px] font-extrabold text-white/40">
            {getInitials(athlete.name)}
          </span>
        </div>
      )}

      {/* Gradient bottom 2/3 fondu vers card color (#1A1D24) */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 z-[2] pointer-events-none"
        style={{ background: "linear-gradient(to top, #1A1D24 0%, rgba(26,29,36,0.85) 35%, transparent 70%)" }}
      />

      {/* Rank badge top-left — #1 rouge, #2-5 inset */}
      <div className="absolute top-2 left-2 z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-extrabold tabular-nums ${
            isTopRank
              ? "bg-[#E63946] text-white"
              : "bg-[#0C0E12] text-white/85 border border-white/[0.12]"
          }`}
        >
          {athlete.rank}
        </span>
      </div>

      {/* Stars top-right pill (gold uniquement — semantic ratings) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 z-10">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span className="text-[14px] font-bold text-white leading-none">{athlete.stars.toFixed(1)}</span>
      </div>

      {/* Bottom info overlay : nom + position */}
      <div className="absolute inset-x-0 bottom-0 px-3 pt-3 pb-4 z-10">
        <p className="text-white font-bold text-base truncate leading-tight">
          {athlete.name || "—"}
        </p>
        <p className="text-[15px] text-white/55 mt-0.5 truncate">
          {athlete.position || "—"}
        </p>
      </div>
    </button>
  );
}

function HotAthletesStrip({ athletes, onAthleteTap }: {
  athletes: HotAthleteRow[];
  onAthleteTap: (id: string) => void;
}) {
  return (
    <div>
      <div className="px-4 mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold">
          Athlètes en demande
        </h2>
        <p className="text-[13px] text-white/45 mt-1">
          Les plus consultés cette semaine
        </p>
      </div>
      {athletes.length === 0 ? (
        <p className="px-4 text-[14px] text-white/40 italic">
          Pas encore d&apos;athlètes consultés cette semaine.
        </p>
      ) : (
        <div className="overflow-x-auto nx-no-scrollbar pl-4">
          <div className="flex gap-3 pr-4">
            {athletes.slice(0, 5).map((a) => (
              <HotAthleteCard
                key={a.id}
                athlete={a}
                onTap={() => onAthleteTap(a.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ActivityFeedItem + ActivityFeedList (verbatim recruteur)
═══════════════════════════════════════════════════════════════ */

/* ActivityFeedItem + ActivityFeedList + SectionDivider — REMOVED
   (replaced by the shared DashboardActivityFeed + SectionDivider
   from components/shared/dashboard/*). */

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
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */

export function CoachDashboardMobile() {
  const router = useRouter();

  // Auth + data
  const [coachName, setCoachName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [actionBar, setActionBar] = useState<ActionBarData>({
    unreadMessages: 0, incompleteProfiles: 0, newAthletes: 0, pendingSuggestions: 0, missingEvals: 0,
  });
  const [kpi, setKpi] = useState<KpiData>({
    totalAthletes: 0, verifiedCount: 0, completePct: 0, recruiterViews: 0, viewsTrend: 0,
  });
  const [hotAthletes, setHotAthletes] = useState<HotAthleteRow[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isInterimDirector, setIsInterimDirector] = useState(false);
  const [interimSchoolName, setInterimSchoolName] = useState("");
  const [demotionNotifications, setDemotionNotifications] = useState<DemotionNotif[]>([]);
  const [loading, setLoading] = useState(true);

  // Date stable client (évite hydration mismatch SSG)
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  useEffect(() => { setCurrentDate(new Date()); }, []);

  // Pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
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
        setReloadKey((k) => k + 1);
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
  }, [isRefreshing]);

  /* ── Data load — porté verbatim de la web page coach actuelle ─ */
  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Profil coach + intérim source (is_school_admin + admin_type)
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
      if (!coachSchoolId) { setLoading(false); return; }

      // Demotion notifications
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

      // Athletes claimed by this coach
      const { data: athleteRows } = await supabase
        .from("athletes")
        .select("id, verified")
        .eq("coach_id", user.id)
        .eq("status", "ACTIF");

      const athletes = athleteRows || [];
      const coachAthleteIds = athletes.map((a: { id: string }) => a.id);
      const totalAthletes = athletes.length;
      const verifiedCount = athletes.filter((a: { verified: boolean }) => a.verified).length;

      // ActionBar #1: unread recruiter contacts (recruiter_pipeline stage CONTACTE)
      let unreadMessages = 0;
      if (coachAthleteIds.length > 0) {
        const { count } = await supabase
          .from("recruiter_pipeline")
          .select("id", { count: "exact", head: true })
          .eq("stage", "CONTACTE")
          .in("athlete_id", coachAthleteIds);
        unreadMessages = count || 0;
      }

      // ÉTAPE 3c — ActionBar #2/#4/#5 (non-vérifiés + suggestions + éval
      // manquante) viennent du helper partagé lib/coach/tasks.loadCoachTaskCounts.
      // Une seule source de vérité — tab badge, web dashboard, mobile dashboard
      // et /coach/a-traiter consomment tous le même helper. Adds missingEvals.
      const taskCounts = await loadCoachTaskCounts(supabase, user.id);

      // ActionBar #3: new athletes added (unread) — séparé, pas une "tâche"
      const { count: newAthletesCount } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", user.id)
        .eq("type", "ATHLETE_ADDED")
        .eq("read", false);

      setActionBar({
        unreadMessages,
        incompleteProfiles: taskCounts.unverified,
        missingEvals: taskCounts.missingEval,
        pendingSuggestions: taskCounts.pendingSuggestions,
        newAthletes: newAthletesCount || 0,
      });

      // KPI: recruiter views ce mois vs mois dernier
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

      let viewsTrend = 0;
      if (viewsLastMonth === 0 && viewsThisMonth > 0) viewsTrend = 100;
      else if (viewsLastMonth > 0 && viewsThisMonth === 0) viewsTrend = -100;
      else if (viewsLastMonth > 0) {
        viewsTrend = Math.round(((viewsThisMonth - viewsLastMonth) / viewsLastMonth) * 100);
      }

      setKpi({
        totalAthletes,
        verifiedCount,
        completePct: totalAthletes > 0 ? Math.round((verifiedCount / totalAthletes) * 100) : 0,
        recruiterViews: viewsThisMonth,
        viewsTrend,
      });

      // HotAthletes: top 5 most-viewed this week
      if (coachAthleteIds.length > 0) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - mondayOffset);
        monday.setHours(0, 0, 0, 0);
        const startOfWeek = monday.toISOString();

        const { data: viewRows } = await supabase
          .from("recruiter_athlete_views")
          .select("athlete_id")
          .in("athlete_id", coachAthleteIds)
          .gte("viewed_at", startOfWeek);

        const viewCounts = new Map<string, number>();
        for (const r of (viewRows || [])) {
          viewCounts.set(r.athlete_id, (viewCounts.get(r.athlete_id) || 0) + 1);
        }

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

        const sorted = [...viewCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        if (sorted.length > 0) {
          const topIds = sorted.map(([id]) => id);
          const { data: topProfiles } = await supabase
            .from("athletes")
            .select("id, first_name, last_name, photo_url, cote_globale_entraineur, positions!position_id(abreviation, nom)")
            .in("id", topIds);

          const profileMap = new Map<string, Record<string, unknown>>();
          if (topProfiles) {
            for (const p of topProfiles) profileMap.set(p.id as string, p);
          }

          const hotList: HotAthleteRow[] = sorted.map(([aid, views], i) => {
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
              photoUrl: (p?.photo_url as string) || null,
              viewsThisWeek: views,
              uniqueRecruiters: favCounts.get(aid) || 0,
            };
          });
          setHotAthletes(hotList);
        }
      }

      // Activities feed
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
        const TYPE_CONFIG: Record<string, { iconColor: string; priority: 1 | 2 }> = {
          PROFILE_VIEWED:    { iconColor: "#6B7280", priority: 2 },
          FAVORITED:         { iconColor: "#E63946", priority: 1 },
          PIPELINE_CHANGED:  { iconColor: "#F59E0B", priority: 1 },
          ATHLETE_VERIFIED:  { iconColor: "#3B82F6", priority: 2 },
          VIDEO_ADDED:       { iconColor: "#8B5CF6", priority: 2 },
          PROFILE_UPDATED:   { iconColor: "#6B7280", priority: 2 },
          UNFAVORITED:       { iconColor: "#6B7280", priority: 2 },
        };

        const mapped: ActivityEvent[] = activityRows.map((row) => {
          const actionType = (row.action_type as string) || "";
          const details = (row.details as Record<string, unknown>) || {};
          const cfg = TYPE_CONFIG[actionType] || { iconColor: "#6B7280", priority: 2 as const };
          const athleteName = `${(details.first_name as string) || ""} ${(details.last_name as string) || ""}`.trim();
          const createdAt = new Date(row.created_at as string);

          const now2 = new Date();
          const diffMs = now2.getTime() - createdAt.getTime();
          const diffDays = Math.floor(diffMs / 86400000);
          let timeGroup: ActivityEvent["timeGroup"] = "Semaine dernière";
          if (diffDays === 0) timeGroup = "Aujourd'hui";
          else if (diffDays === 1) timeGroup = "Hier";
          else if (diffDays < 7) timeGroup = "Cette semaine";

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
            message: athleteName ? `${athleteName}` : "Activité",
            icon: "circle",
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
  }, [reloadKey]);

  async function dismissDemotion(notificationId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("coach_notifications")
      .update({ read: true })
      .eq("id", notificationId);
    if (error) {
      console.error("[CoachDashboardMobile] dismiss failed:", error);
      return;
    }
    setDemotionNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }

  /* ── Nav helpers ───────────────────────────────────────────── */

  const navAthlete = (id: string | undefined) => {
    if (!id) return;
    router.push(`/coach/athletes/${id}`);
  };

  /* ── Render ────────────────────────────────────────────────── */

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
  // local hero used : unreadMessages > 0 → viewsTrend > 0 → fallback.
  // Two lines, second accented red (matches the new design recipe).
  const hasInterest = actionBar.unreadMessages > 0;
  const hasTrend = kpi.viewsTrend > 0 && kpi.recruiterViews > 0;
  const heroHeadline = hasInterest ? (
    <h2 className="text-[24px] font-extrabold text-white leading-tight tracking-tight">
      {actionBar.unreadMessages} recruteur{actionBar.unreadMessages > 1 ? "s" : ""}<br />
      <span className="text-[#E63946]">intéressé{actionBar.unreadMessages > 1 ? "s" : ""}</span>
    </h2>
  ) : hasTrend ? (
    <h2 className="text-[24px] font-extrabold text-white leading-tight tracking-tight">
      +{kpi.viewsTrend}% de vues<br />
      <span className="text-[#E63946]">ce mois</span>
    </h2>
  ) : (
    <h2 className="text-[24px] font-extrabold text-white leading-tight tracking-tight">
      Suis tes<br />
      <span className="text-[#E63946]">athlètes</span>
    </h2>
  );

  return (
    <DashboardGradientLayout>
      {/* Pull-to-refresh indicator (kept per-file, simple) */}
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
        greeting={coachName.split(/\s+/)[0] || ""}
        dateLabel={currentDate ? frenchDateUppercase(currentDate) : undefined}
        chip={
          schoolName
            ? {
                label: schoolName,
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                ),
              }
            : undefined
        }
      />

      {/* Floating hero card on the gradient — hoists the old KpiTrio
          stats (Roster / Vérifiés+progress / Vues+trend) into its
          inset row. KpiTrio is now deleted. */}
      <DashboardHero
        eyebrow="Cette semaine"
        headline={heroHeadline}
        pulseBadge={
          actionBar.pendingSuggestions > 0
            ? {
                label: `${actionBar.pendingSuggestions} suggestion${actionBar.pendingSuggestions > 1 ? "s" : ""} à examiner`,
                onTap: () => router.push("/coach/suggestions"),
              }
            : undefined
        }
        insets={[
          {
            label: "Roster",
            value: kpi.totalAthletes,
            subtitle: "athlètes",
            onTap: () => router.push("/coach/athletes"),
          },
          {
            label: "Vérifiés",
            value: `${kpi.completePct}%`,
            subtitle: `${kpi.verifiedCount}/${kpi.totalAthletes}`,
            progress: { current: kpi.verifiedCount, total: Math.max(kpi.totalAthletes, 1), color: "#3B82F6" },
            onTap: () => router.push("/coach/athletes?filtre=non_verifies"),
          },
          {
            label: "Vues",
            value: kpi.recruiterViews,
            trend: kpi.viewsTrend !== 0 ? { value: kpi.viewsTrend, positive: kpi.viewsTrend > 0 } : undefined,
            onTap: () => router.push("/coach/athletes"),
          },
        ]}
      />

      {/* Intérim banner (if applicable) */}
      {isInterimDirector && <InterimBanner schoolName={interimSchoolName} />}

      {/* Demotion notifs (if applicable) */}
      {demotionNotifications.map((n) => (
        <DemotionNotificationCard
          key={n.id}
          notif={n}
          onDismiss={() => dismissDemotion(n.id)}
        />
      ))}

      <SectionDivider />

      {/* ActionBar (alert-system) */}
      <div className="py-6">
        <CoachActionBar
          data={actionBar}
          onTapMessages={() => router.push("/coach/demandes")}
          onTapIncomplete={() => router.push("/coach/athletes?filtre=non_verifies")}
          onTapMissingEvals={() => router.push("/coach/a-traiter")}
          onTapNewAthletes={() => router.push("/coach/activites")}
          onTapSuggestions={() => router.push("/coach/suggestions")}
        />
      </div>

      <SectionDivider />

      {/* HotAthletes strip */}
      <div className="py-6">
        <HotAthletesStrip athletes={hotAthletes} onAthleteTap={navAthlete} />
      </div>

      <SectionDivider />

      {/* Activity feed (shared) */}
      <div className="py-6">
        <DashboardActivityFeed
          activities={activities}
          onItemTap={navAthlete}
        />
        {activities.length > 5 && (
          <div className="px-4 mt-4">
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); router.push("/coach/activites"); }}
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
