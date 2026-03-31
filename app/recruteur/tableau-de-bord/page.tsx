"use client";

import Link from "next/link";
import ActionBar from "./_components/ActionBar";
import KpiCards from "./_components/KpiCards";
import TrendingAthletes from "./_components/TrendingAthletes";
import RecruiterActivityFeed from "./_components/RecruiterActivityFeed";
import { ACTION_BAR, KPI, TRENDING_ATHLETES } from "../_data/mockDashboardData";
import { MOCK_ACTIVITY_FEED } from "../_data/mockActivityFeed";


/* ─────────────────────────────────────────────────────────────────
   Nexus — Recruiter Tableau de Bord
   Daily landing page — answers 5 questions in 5 seconds.
───────────────────────────────────────────────────────────────── */

const BLUE = "#E63946";

function frenchDate(): string {
  const d = new Date("2026-03-10");
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── Quick Actions ─────────────────────────────────────────────── */

const iconBox = "w-10 h-10 rounded-lg bg-[#E63946]/15 flex items-center justify-center";

function QuickActions() {
  const actions = [
    { label: "Rechercher des athlètes", href: "/recruteur/recherche", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg> },
    { label: "Voir mes favoris", href: "/recruteur/favoris", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg> },
    { label: "Mes messages", href: "/recruteur/messages", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {actions.map((a) => (
        <Link key={a.href} href={a.href} className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 flex items-center gap-4 hover:border-[#E63946]/40 hover:shadow-[0_0_16px_rgba(230,57,70,0.1)] transition-all group">
          <div className={iconBox}>{a.icon}</div>
          <span className="text-[14px] font-bold text-white group-hover:text-[#E63946] transition-colors">{a.label}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function RecruteurTableauDeBordPage() {
  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-8">

      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Bienvenue, Pierre — CÉGEP Garneau, Div. 1
        </p>
        <p className="text-[12px] text-[#6b7280] mt-0.5 capitalize">{frenchDate()}</p>
      </div>

      {/* Zone 1: Action Bar */}
      <ActionBar data={ACTION_BAR} />

      {/* Zone 2: KPI Cards + Pipeline */}
      <KpiCards data={KPI} />

      {/* Zone 3 + 4: Trending Athletes + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <TrendingAthletes athletes={TRENDING_ATHLETES} />
        </div>
        <div className="xl:col-span-2">
          <RecruiterActivityFeed events={MOCK_ACTIVITY_FEED} />
        </div>
      </div>

      {/* Zone 5: Quick Actions */}
      <QuickActions />

    </div>
  );
}
