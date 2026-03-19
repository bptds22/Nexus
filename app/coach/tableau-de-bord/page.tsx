"use client";

import ActionBar from "./_components/ActionBar";
import KpiCards from "./_components/KpiCards";
import HotAthletes from "./_components/HotAthletes";
import ActivityFeed from "./_components/ActivityFeed";

import { ACTION_BAR, KPI, HOT_ATHLETES, ACTIVITY_FEED } from "./_data/mockDashboardData";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Coach Tableau de Bord
   Alert-system dashboard: signals, not summaries.
───────────────────────────────────────────────────────────────── */

function frenchDate(): string {
  const d = new Date("2026-03-10");
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function TableauDeBordPage() {
  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-8">

      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Bienvenue, Coach Bergeron — École secondaire Saint-Jean-Eudes
        </p>
        <p className="text-[12px] text-[#6b7280] mt-0.5 capitalize">{frenchDate()}</p>
      </div>

      {/* Zone 1: Action Bar */}
      <ActionBar data={ACTION_BAR} />

      {/* Zone 2: KPI Cards */}
      <KpiCards data={KPI} />

      {/* Zone 3 + 4: Hot Athletes + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <HotAthletes athletes={HOT_ATHLETES} />
        </div>
        <div className="xl:col-span-2">
          <ActivityFeed events={ACTIVITY_FEED} />
        </div>
      </div>

    </div>
  );
}
