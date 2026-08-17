"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import StarRating from "@/components/ui/StarRating";
import type { CoachOverview } from "@/lib/types/models";

/* ── Helpers ─────────────────────────────────────────────── */

function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  const diffW = Math.floor(diffD / 7);
  const diffM = Math.floor(diffD / 30);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH} heure${diffH > 1 ? "s" : ""}`;
  if (diffD < 7) return `Il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;
  if (diffW < 5) return `Il y a ${diffW} semaine${diffW > 1 ? "s" : ""}`;
  return `Il y a ${diffM} mois`;
}

function getDaysAgo(isoDate: string): number {
  return Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function deriveStatus(updatedAt: string | null): CoachOverview["status"] {
  if (!updatedAt) return "inactive_30d";
  const days = getDaysAgo(updatedAt);
  if (days < 7) return "active";
  if (days < 30) return "inactive_7d";
  return "inactive_30d";
}

const SPORT_COLORS: Record<string, string> = {
  Football: "bg-[#3B82F6]/20 text-[#60A5FA]",
  Hockey: "bg-[#8B5CF6]/20 text-[#A78BFA]",
  Basketball: "bg-[#F97316]/20 text-[#FB923C]",
  Volleyball: "bg-[#22C55E]/20 text-[#4ADE80]",
  Soccer: "bg-[#06B6D4]/20 text-[#22D3EE]",
  Natation: "bg-[#0EA5E9]/20 text-[#38BDF8]",
  Badminton: "bg-[#EC4899]/20 text-[#F472B6]",
};

const STATUS_DOT: Record<CoachOverview["status"], string> = {
  active: "#22C55E",
  inactive_7d: "#F59E0B",
  inactive_30d: "#E63946",
};

const STATUS_LABEL: Record<CoachOverview["status"], string> = {
  active: "Actif",
  inactive_7d: "Inactif 7j",
  inactive_30d: "Inactif 30j+",
};

/* ── Athlete type for this page ── */

interface CoachAthlete {
  id: string;
  name: string;
  position: string;
  completude: number;
  stars: number;
  views30d: number;
  lastUpdate: string;
}

/* ── KPI Card ────────────────────────────────────────────── */

function KpiCard({
  icon,
  value,
  label,
  suffix,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-[#2A2D35] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[22px] font-bold text-white">
          {value}
          {suffix}
        </p>
        <p className="text-[12px] text-[#6B7280]">{label}</p>
      </div>
    </div>
  );
}

/* ── Circular Progress ───────────────────────────────────── */

function CircularProgress({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = value >= 60 ? "#3B82F6" : "#6B7280";

  return (
    <svg width={48} height={48} className="shrink-0">
      <circle cx={24} cy={24} r={r} fill="none" stroke="#2A2D35" strokeWidth={4} />
      <circle
        cx={24}
        cy={24}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
      />
      <text
        x={24}
        y={24}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white text-[11px] font-bold"
      >
        {value}%
      </text>
    </svg>
  );
}

/* ── Component ───────────────────────────────────────────── */

export default function CoachDetailPageWrapper() {
  return <CoachDetailPage />;
}

function CoachDetailPage() {
  const router = useRouter();
  const coachId = useDynamicParam("coachId");

  const [coach, setCoach] = useState<CoachOverview | null>(null);
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    async function loadCoach() {
      const supabase = createClient();

      // Get coach profile
      const { data: profile } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, phone, avatar_url, updated_at")
        .eq("id", coachId)
        .single();

      // Get school_coaches entry
      const { data: schoolCoach } = await supabase
        .from("school_coaches")
        .select("role, sport, team_name")
        .eq("coach_id", coachId)
        .single();

      // Get athletes for this coach
      const { data: athleteRows } = await supabase
        .from("athletes")
        .select("id, first_name, last_name, profile_completion, verified, cote_globale_entraineur, updated_at, positions!position_id(nom, abreviation)")
        .eq("coach_id", coachId);

      if (profile) {
        const coachAthletes = athleteRows || [];
        const completed = coachAthletes.filter((a: Record<string, unknown>) => ((a.profile_completion as number) || 0) >= 60).length;
        const status = deriveStatus(profile.updated_at || null);

        setCoach({
          id: profile.id,
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          avatarUrl: profile.avatar_url || undefined,
          sport: schoolCoach?.sport || "",
          athleteCount: coachAthletes.length,
          profilesCompleted: completed,
          profileCompletionRate: coachAthletes.length > 0
            ? Math.round((completed / coachAthletes.length) * 100)
            : 0,
          recruiterViews30d: 0,
          viewsTrend: 0,
          messagesReceived: 0,
          lastLoginAt: profile.updated_at || new Date().toISOString(),
          status,
          accountStatus: "ACTIF" as "ACTIF" | "DESACTIVE",
          deactivatedAt: null,
          deactivatedBy: null,
          deactivationReason: null,
        });

        setAthletes(coachAthletes.map((a: Record<string, unknown>) => {
          const posRaw = a.positions;
          const pos = Array.isArray(posRaw) ? posRaw[0] : posRaw;
          const posObj = pos as { abreviation?: string; nom?: string } | null;
          return {
            id: a.id as string,
            name: `${(a.first_name as string) || ""} ${(a.last_name as string) || ""}`.trim(),
            position: posObj?.abreviation || posObj?.nom || "",
            completude: (a.profile_completion as number) || 0,
            stars: Math.round((a.cote_globale_entraineur as number) || 0),
            views30d: 0,
            lastUpdate: (a.updated_at as string) || new Date().toISOString(),
          };
        }));
      }

      setLoading(false);
    }
    loadCoach();
  }, [coachId]);

  const completionColor = (rate: number) => {
    if (rate >= 60) return "bg-[#3B82F6]";
    return "bg-[#6B7280]";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto">
        <p className="text-[#6B7280] text-[14px]">Coach introuvable</p>
        <Link
          href="/coach/ecole/coachs"
          className="text-[#E63946] text-[13px] mt-2 inline-block hover:underline"
        >
          Retour a la liste
        </Link>
      </div>
    );
  }

  const fullName = `${coach.firstName} ${coach.lastName}`;
  const initials = coach.firstName.charAt(0) + coach.lastName.charAt(0);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link
          href="/coach/ecole/coachs"
          className="hover:text-white transition-colors"
        >
          Mes coachs
        </Link>
        <span>&gt;</span>
        <span className="text-white">{fullName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#2A2D35] flex items-center justify-center text-[18px] font-bold text-[#9CA3AF] shrink-0">
          {initials}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="text-white font-bold"
              style={{ fontFamily: "var(--wl-font-head)", fontSize: 20 }}
            >
              {fullName}
            </h1>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${SPORT_COLORS[coach.sport] || "bg-[#374151]/30 text-[#9CA3AF]"}`}
            >
              {coach.sport}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: STATUS_DOT[coach.status] }}
              />
              <span className="text-[12px] text-[#9CA3AF]">
                {STATUS_LABEL[coach.status]}
              </span>
            </span>
          </div>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Derniere connexion : {getRelativeTime(coach.lastLoginAt)}
          </p>
        </div>

        {/* Delete coach button */}
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E63946]/40 text-[#E63946] text-[13px] font-semibold hover:bg-[#E63946]/10 transition-colors shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          Supprimer
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2 className="text-white font-bold text-[16px]" style={{ fontFamily: "var(--wl-font-head)" }}>
                Supprimer ce coach ?
              </h2>
            </div>
            <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
              Êtes-vous sûr de vouloir supprimer <span className="text-white font-medium">{fullName}</span> ?
              Cette action retirera l&apos;accès du coach et archivera ses {coach.athleteCount} athlètes.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg border border-[#2D3748] text-[#9CA3AF] text-[13px] font-semibold hover:text-white hover:border-[#4B5563] transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  router.push("/coach/ecole/coachs");
                }}
                className="px-4 py-2 rounded-lg bg-[#E63946] text-white text-[13px] font-semibold hover:bg-[#D93C3C] transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={
            <svg
              className="w-5 h-5 text-[#60A5FA]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
          value={coach.athleteCount}
          label="Athletes inscrits"
        />
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 flex items-center gap-4">
          <CircularProgress value={coach.profileCompletionRate} />
          <div>
            <p className="text-[22px] font-bold text-white">
              {coach.profileCompletionRate}%
            </p>
            <p className="text-[12px] text-[#6B7280]">Profils completes</p>
          </div>
        </div>
        <KpiCard
          icon={
            <svg
              className="w-5 h-5 text-[#A78BFA]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          }
          value={coach.recruiterViews30d}
          label="Vues recruteurs (30j)"
        />
      </div>

      {/* Athletes list */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2128]">
          <h2
            className="text-white font-bold text-[15px]"
            style={{ fontFamily: "var(--wl-font-head)" }}
          >
            Athletes de {fullName}
          </h2>
        </div>
        {athletes.length === 0 ? (
          <div className="py-12 text-center text-[#6B7280] text-[14px]">
            Aucun athlète pour ce coach
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#13151a]">
                  {["Athlete", "Position", "Completude", "Cote", "Vues 30j", "Dernier update"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {athletes.map((ath) => (
                  <tr
                    key={ath.id}
                    className="border-t border-[#1e2128] cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    onClick={() => window.location.href = `/coach/athletes/${ath.id}`}
                  >
                    <td className="px-4 py-3 text-[13px] text-white font-medium">
                      {ath.name}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                      {ath.position}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded bg-[#2A2D35] overflow-hidden">
                          <div
                            className={`h-full rounded ${completionColor(ath.completude)}`}
                            style={{ width: `${ath.completude}%` }}
                          />
                        </div>
                        <span className="text-[12px] text-[#9CA3AF]">
                          {ath.completude}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StarRating rating={ath.stars} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-white">
                      {ath.views30d}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#9CA3AF] whitespace-nowrap">
                      {getRelativeTime(ath.lastUpdate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity timeline — empty state until activities table is wired */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2128]">
          <h2
            className="text-white font-bold text-[15px]"
            style={{ fontFamily: "var(--wl-font-head)" }}
          >
            Activite recente de {fullName}
          </h2>
        </div>
        <div className="p-5">
          <p className="text-[13px] text-[#6B7280] text-center py-6">
            Aucune activite recente
          </p>
        </div>
      </div>
    </div>
  );
}
