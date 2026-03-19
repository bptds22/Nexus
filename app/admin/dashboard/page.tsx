"use client";

import Link from "next/link";
import { adminKPIs, SYSTEM_ALERTS } from "@/lib/mock/admin";

/* ── Helpers ─────────────────────────────────────────────── */

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "il y a quelques minutes";
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-[#3B82F6]",
  warning: "bg-[#F59E0B]",
  critical: "bg-[#E63946]",
};

/* ── Page ─────────────────────────────────────────────────── */

export default function AdminDashboard() {
  const kpi = adminKPIs;
  const maxSignup = Math.max(...kpi.weeklySignups);

  const kpiCards: { label: string; value: string | number; sub: string; color: string; href: string; icon: React.ReactNode }[] = [
    { label: "Athlètes inscrits", value: kpi.totalAthletes, sub: "inscrits cette saison", color: "#E63946", href: "/admin/athletes",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg> },
    { label: "Profils vérifiés", value: kpi.verifiedProfiles, sub: `vérifiés sur ${kpi.totalAthletes} athlètes`, color: "#3B82F6", href: "/admin/athletes",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg> },
    { label: "Recruteurs actifs", value: kpi.activeRecruiters, sub: "connectés ce mois-ci", color: "#FFFFFF", href: "/admin/users",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg> },
    { label: "Coachs inscrits", value: kpi.activeCoachs, sub: "actifs sur la plateforme", color: "#F59E0B", href: "/admin/users",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> },
    { label: "Demandes en cours", value: kpi.pendingContactRequests, sub: "5 en attente de réponse", color: "#A855F7", href: "/admin/pipeline",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> },
    { label: "Complétion moyenne", value: `${kpi.avgProfileCompletion}%`, sub: "moyenne tous profils", color: "#22C55E", href: "/admin/analytics",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg> },
  ];

  const quickActions = [
    { title: "Valider les recruteurs", badge: kpi.pendingRecruiterValidations, href: "/admin/users", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg> },
    { title: "Approuver les profils", badge: kpi.pendingProfileApprovals, href: "/admin/athletes", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg> },
    { title: "Modérer le contenu", badge: kpi.flaggedContent, href: "/admin/moderation", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
    { title: "Voir l'analytique", badge: 0, href: "/admin/analytics", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">Vue d&apos;ensemble de la plateforme Nexus</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => (
          <Link key={card.label} href={card.href} className="group bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/20 p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">{card.label}</p>
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: `${card.color}20` }}>
                <span style={{ color: card.color }}>{card.icon}</span>
              </div>
            </div>
            <p className="text-[36px] font-head font-black text-white leading-none">{card.value}</p>
            <p className="text-[13px] text-[#6b7280] mt-1">{card.sub}</p>
          </Link>
        ))}
      </div>

      {/* Middle — Chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Activity chart */}
        <div className="lg:col-span-3 bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-6">
            Inscriptions par semaine — 7 dernières semaines
          </p>
          <div className="flex items-end gap-3 h-[180px]">
            {kpi.weeklySignups.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-[#E63946] rounded-t-md transition-all hover:bg-[#D42B22]"
                  style={{ height: `${(v / maxSignup) * 100}%` }}
                />
                <span className="text-[10px] text-[#6b7280] font-bold">{v}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3">
            {["S-7", "S-6", "S-5", "S-4", "S-3", "S-2", "S-1"].map((w) => (
              <span key={w} className="text-[9px] text-[#6b7280] font-bold flex-1 text-center">{w}</span>
            ))}
          </div>
        </div>

        {/* System alerts */}
        <div className="lg:col-span-2 bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-4">
            Alertes système
          </p>
          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
            {SYSTEM_ALERTS.map((alert) => (
              <Link
                key={alert.id}
                href={alert.link}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[alert.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#9CA3AF] group-hover:text-white transition-colors leading-snug">
                    {alert.message}
                  </p>
                  <p className="text-[10px] text-[#6b7280] mt-1">{timeAgo(alert.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-4">
          Actions rapides
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const hasItems = action.badge > 0;
            return (
              <Link
                key={action.title}
                href={action.href}
                className={`group flex items-center gap-4 rounded-xl px-5 py-5 border-l-4 transition-all hover:-translate-y-0.5 ${
                  hasItems
                    ? "bg-[#E63946]/[0.08] border-l-[#E63946]"
                    : "bg-[#1A1D24] border-l-[#2D3748]"
                }`}
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${hasItems ? "bg-[#E63946]/20 text-[#E63946]" : "bg-[#2D3748]/50 text-[#6b7280]"}`}>
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-white">{action.title}</p>
                </div>
                {hasItems && (
                  <span className="min-w-[28px] h-7 px-2 rounded-full bg-[#E63946] text-white text-[13px] font-black flex items-center justify-center">
                    {action.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
