"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  mockTrainerOverviews,
  mockDirectorActivitiesCegep,
} from "@/lib/mock";
import type { TrainerOverview, DirectorActivity } from "@/lib/types/models";

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

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH} heure${diffH > 1 ? "s" : ""}`;
  if (diffD < 7) return `Il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;
  if (diffW < 5) return `Il y a ${diffW} semaine${diffW > 1 ? "s" : ""}`;
  return `Il y a ${diffM} mois`;
}

const SPORT_COLORS: Record<string, string> = {
  Football: "bg-[#374151]/30 text-[#9CA3AF]",
  Hockey: "bg-[#374151]/30 text-[#9CA3AF]",
  Basketball: "bg-[#374151]/30 text-[#9CA3AF]",
  Volleyball: "bg-[#374151]/30 text-[#9CA3AF]",
  Soccer: "bg-[#374151]/30 text-[#9CA3AF]",
};

const DIVISION_COLORS: Record<string, string> = {
  D1: "bg-[#E63946]/15 text-[#E63946]",
  D2: "bg-[#F59E0B]/15 text-[#F59E0B]",
  D3: "bg-[#6B7280]/15 text-[#9CA3AF]",
};

const STATUS_DOT: Record<TrainerOverview["status"], string> = {
  active: "#22C55E",
  inactive: "#F59E0B",
  season_ended: "#6B7280",
};

const STATUS_LABEL: Record<TrainerOverview["status"], string> = {
  active: "Actif",
  inactive: "Inactif",
  season_ended: "Saison terminée",
};

const ACTIVITY_DOT_COLOR: Record<string, string> = {
  recruit_confirmed: "#E63946",   // commitment → red
  new_favorite: "#E63946",        // favorite → red
  message_sent: "#22C55E",        // communication → green
  recruiter_inactive: "#F59E0B",  // warning → amber
  recruiter_joined: "#60A5FA",    // verified account → blue
};

function activityText(a: DirectorActivity): string {
  switch (a.type) {
    case "recruit_confirmed":
      return `Recrue confirmée : ${a.athleteName} (${a.sportName})`;
    case "new_favorite":
      return `A ajouté ${a.athleteName} à ses favoris (${a.sportName})`;
    case "message_sent":
      return `A contacté le coach de ${a.athleteName} (${a.sportName})`;
    case "recruiter_inactive":
      return `Inactif depuis ${a.daysInactive} jours`;
    case "recruiter_joined":
      return `A rejoint la plateforme`;
    default:
      return a.ctaLabel;
  }
}

/* ── Mock recruited athletes ─────────────────────────────── */

interface MockRecruit {
  id: string;
  name: string;
  sport: string;
  position: string;
  sourceSchool: string;
  date: string;
}

function getMockRecruits(trainer: TrainerOverview): MockRecruit[] {
  const recruits: MockRecruit[] = [];
  const names = [
    { name: "Gabriel Ouellet", sport: "Football", position: "WR", sourceSchool: "École secondaire De Rochebelle", date: "2026-03-11" },
    { name: "Raphaël Lévesque", sport: "Hockey", position: "Ailier gauche", sourceSchool: "Collège Saint-Charles-Garnier", date: "2026-03-09" },
    { name: "Maïka Desjardins", sport: "Basketball", position: "Ailière", sourceSchool: "École secondaire Roger-Comtois", date: "2026-03-07" },
    { name: "Samuel Girard", sport: "Football", position: "OL", sourceSchool: "École secondaire de la Seigneurie", date: "2026-03-04" },
    { name: "Éliane Mercier", sport: "Basketball", position: "Pivot", sourceSchool: "École secondaire Mont-Saint-Sacrement", date: "2026-02-14" },
  ];

  for (let i = 0; i < Math.min(trainer.recruitsConfirmed, names.length); i++) {
    recruits.push({
      id: `recruit-${trainer.id}-${i}`,
      ...names[i],
    });
  }

  return recruits;
}

/* ── KPI Card ────────────────────────────────────────────── */

function KpiCard({
  icon,
  value,
  label,
  valueColor,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-[#2A2D35] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p
          className="text-[22px] font-bold"
          style={{ color: valueColor || "#fff" }}
        >
          {value}
        </p>
        <p className="text-[12px] text-[#6B7280]">{label}</p>
      </div>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────── */

export default function TrainerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const trainerId = params.trainerId as string;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const trainer = mockTrainerOverviews.find((t) => t.id === trainerId);

  if (!trainer) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto">
        <p className="text-[#6B7280] text-[14px]">Entraîneur introuvable</p>
        <Link
          href="/directeur-cegep/entraineurs"
          className="text-[#E63946] text-[13px] mt-2 inline-block hover:underline"
        >
          Retour à la liste
        </Link>
      </div>
    );
  }

  const fullName = `${trainer.firstName} ${trainer.lastName}`;
  const initials = trainer.firstName.charAt(0) + trainer.lastName.charAt(0);
  const recruits = getMockRecruits(trainer);

  /* Filter activities related to this trainer */
  const trainerActivities = mockDirectorActivitiesCegep
    .filter((a) => a.recruiterName === fullName)
    .slice(0, 10);

  /* If no matching activities, show most recent 10 as fallback */
  const timeline =
    trainerActivities.length > 0
      ? trainerActivities
      : mockDirectorActivitiesCegep.slice(0, 10);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link
          href="/directeur-cegep/entraineurs"
          className="hover:text-white transition-colors"
        >
          Mes entraîneurs
        </Link>
        <span>&gt;</span>
        <span className="text-white">{fullName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#2A2D35] flex items-center justify-center text-[18px] font-bold text-[#9CA3AF] shrink-0">
          {initials}
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="text-white font-bold"
              style={{ fontFamily: "var(--wl-font-head)", fontSize: 20 }}
            >
              {fullName}
            </h1>
            {trainer.sports.map((sport) => (
              <span
                key={sport}
                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${SPORT_COLORS[sport] || "bg-[#374151]/30 text-[#9CA3AF]"}`}
              >
                {sport}
              </span>
            ))}
            {trainer.division.map((div) => (
              <span
                key={div}
                className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${DIVISION_COLORS[div] || "bg-[#374151]/30 text-[#9CA3AF]"}`}
              >
                {div}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: STATUS_DOT[trainer.status] }}
              />
              <span className="text-[12px] text-[#9CA3AF]">
                {STATUS_LABEL[trainer.status]}
              </span>
            </span>
          </div>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Dernière connexion : {getRelativeTime(trainer.lastLoginAt)}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={
            <svg
              className="w-5 h-5 text-[#E63946]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
              />
            </svg>
          }
          value={trainer.activeFavorites}
          label="Favoris actifs"
        />
        <KpiCard
          icon={
            <svg
              className="w-5 h-5 text-[#60A5FA]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          value={trainer.messagesSent30d}
          label="Messages envoyés (30j)"
        />
        <KpiCard
          icon={
            <svg
              className="w-5 h-5 text-[#E63946]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          value={trainer.recruitsConfirmed}
          label="Recrues confirmées"
          valueColor={trainer.recruitsConfirmed > 0 ? "#E63946" : undefined}
        />
      </div>

      {/* Recruits table */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2128]">
          <h2
            className="text-white font-bold text-[15px]"
            style={{ fontFamily: "var(--wl-font-head)" }}
          >
            Recrues de {fullName}
          </h2>
        </div>

        {trainer.recruitsConfirmed > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#13151a]">
                  {["Athlète", "Sport", "Position", "École d'origine", "Date"].map(
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
                {recruits.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[#1e2128]"
                  >
                    <td className="px-4 py-3 text-[13px] text-white font-medium">
                      {r.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${SPORT_COLORS[r.sport] || "bg-[#374151]/30 text-[#9CA3AF]"}`}
                      >
                        {r.sport}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                      {r.position}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                      {r.sourceSchool}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#9CA3AF] whitespace-nowrap">
                      {new Date(r.date).toLocaleDateString("fr-CA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-[14px] text-[#6B7280]">
            Aucune recrue confirmée pour le moment
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2128]">
          <h2
            className="text-white font-bold text-[15px]"
            style={{ fontFamily: "var(--wl-font-head)" }}
          >
            Activité récente de {fullName}
          </h2>
        </div>
        <div className="p-5">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 border-l-2 border-[#2A2D35]" />

            <div className="space-y-5">
              {timeline.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 relative"
                >
                  {/* Dot */}
                  <div
                    className="w-4 h-4 rounded-full border-2 border-[#1A1D24] shrink-0 z-10"
                    style={{
                      backgroundColor:
                        ACTIVITY_DOT_COLOR[activity.type] || "#6B7280",
                    }}
                  />

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#e0e0e0]">
                      {activityText(activity)}
                    </p>
                  </div>

                  {/* Relative date */}
                  <span className="text-[11px] text-[#6B7280] whitespace-nowrap shrink-0">
                    {getRelativeTime(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {timeline.length === 0 && (
            <p className="text-[13px] text-[#6B7280] text-center py-6">
              Aucune activité récente
            </p>
          )}
        </div>
      </div>

      {/* Delete coach */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-white" style={{ fontFamily: "var(--wl-font-head)" }}>
              Retirer cet entraîneur
            </h3>
            <p className="text-[12px] text-[#6B7280] mt-1">
              L&apos;entraîneur sera désactivé et n&apos;aura plus accès à la plateforme.
            </p>
          </div>
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-lg border border-[#E63946]/30 text-[#E63946] text-[13px] font-semibold hover:bg-[#E63946]/10 transition-colors"
            >
              Retirer
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-[#F59E0B]">Confirmer ?</span>
              <button
                type="button"
                onClick={() => {
                  // TODO: call API to deactivate coach
                  router.push("/directeur-cegep/entraineurs");
                }}
                className="px-4 py-2 rounded-lg bg-[#E63946] text-white text-[13px] font-semibold hover:bg-[#D42B22] transition-colors"
              >
                Oui, retirer
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-[#2D3748] text-[#9CA3AF] text-[13px] font-semibold hover:border-[#4a4d56] transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
