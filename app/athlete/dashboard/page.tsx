"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { athleteUser, athleteStats, athleteActivity, profileChecklist } from "@/lib/mock/athlete";
import type { AthleteActivityItem } from "@/lib/mock/athlete";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   Athlete Dashboard — "Salut Marc-Antoine!"
   Personal, encouraging tone ("tu" everywhere)
═══════════════════════════════════════════════════════════════ */

function completenessColor(pct: number): string {
  if (pct < 40) return "#EF4444";
  if (pct < 70) return "#6B7280";
  return "#3B82F6";
}

const ACTIVITY_DOT: Record<AthleteActivityItem["type"], string> = {
  profile_viewed: "#9CA3AF",
  new_favorite: "#E63946",
  coach_update: "#3B82F6",
  suggestion_approved: "#22C55E",
  suggestion_rejected: "#E63946",
  milestone: "#F59E0B",
  completion_reminder: "#EAB308",
};

export default function AthleteDashboardPage() {
  const [firstName, setFirstName] = useState<string>(athleteUser.firstName);
  const u = { ...athleteUser, firstName };
  const s = athleteStats;
  const [activities, setActivities] = useState(athleteActivity);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("athletes")
        .select("first_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const fn = (data?.first_name as string | undefined)
        || (user.user_metadata?.first_name as string | undefined)
        || (user.email?.split("@")[0]);
      if (fn) setFirstName(fn);
    };
    load();
  }, []);
  const pctColor = completenessColor(s.profile_completeness);
  const viewsTrend = s.views_last_month > 0 ? Math.round(((s.views_this_month - s.views_last_month) / s.views_last_month) * 100) : 0;
  const unreadCount = activities.filter((a) => !a.read).length;

  const markRead = (id: string) => {
    setActivities((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
  };

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto space-y-6">

      {/* ── Greeting ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Salut {u.firstName}!
        </h1>
        {u.is_verified && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </div>
      <p className="text-[14px] text-[#9CA3AF] -mt-4">Voici ce qui se passe avec ton profil</p>

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
          <p className="font-head text-[36px] font-black text-white leading-none">{s.views_this_month}</p>
          {viewsTrend > 0 && (
            <p className="text-[12px] font-bold text-[#22C55E] mt-1.5">↑{viewsTrend}% vs mois dernier</p>
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
          <p className="font-head text-[36px] font-black text-white leading-none">{s.favorites_count}</p>
          <p className="text-[12px] text-[#6b7280] mt-1.5">de {s.recruiter_regions.length} région{s.recruiter_regions.length > 1 ? "s" : ""} différente{s.recruiter_regions.length > 1 ? "s" : ""}</p>
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
          <p className="font-head text-[36px] font-black leading-none" style={{ color: pctColor }}>{s.profile_completeness}%</p>
          <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden mt-3">
            <div className="h-full rounded-full transition-all" style={{ width: `${s.profile_completeness}%`, backgroundColor: pctColor }} />
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
            {activities.map((a) => (
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
            ))}
          </div>
        </div>

        {/* Profile Improvement Checklist (40%) */}
        {s.profile_completeness < 100 && (
          <div className="lg:col-span-2">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Améliore ton profil</h2>
            <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5 space-y-3">
              {profileChecklist.map((item) => (
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
      {u.is_verified && (
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
