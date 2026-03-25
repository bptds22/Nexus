"use client";

import Link from "next/link";
import { athleteUser, athleteStats } from "@/lib/mock/athlete";
import FeatureGate from "@/components/subscription/FeatureGate";
import UpgradePrompt from "@/components/subscription/UpgradePrompt";

/* ═══════════════════════════════════════════════════════════════
   Ma Visibilité — Recruiter activity on athlete profile
   All recruiter info is ANONYMOUS
═══════════════════════════════════════════════════════════════ */

export default function VisibilitePage() {
  const u = athleteUser;
  const s = athleteStats;
  const trend = s.views_last_month > 0 ? Math.round(((s.views_this_month - s.views_last_month) / s.views_last_month) * 100) : 0;
  const maxBar = Math.max(...s.views_weekly);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Ma visibilité</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Suis l&apos;activité des recruteurs sur ton profil</p>
      </div>

      {/* ── Section 1: Impact stats ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Vues ce mois</p>
          <p className="font-head text-[36px] font-black text-white leading-none mt-1">{s.views_this_month}</p>
          {trend > 0 && <p className="text-[12px] font-bold text-[#22C55E] mt-1">↑{trend}% vs mois dernier</p>}
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Recruteurs uniques au total</p>
          <p className="font-head text-[36px] font-black text-white leading-none mt-1">{s.unique_recruiters_viewed}</p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Ajouté aux favoris</p>
          <p className="font-head text-[36px] font-black text-[#E63946] leading-none mt-1">{s.favorites_count}</p>
        </div>
      </div>

      {/* ── Section 2: Weekly views chart ─────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-5">Vues par semaine — 8 dernières semaines</h2>
        <div className="flex items-end gap-3 h-[180px]">
          {s.views_weekly.map((v, i) => {
            const height = maxBar > 0 ? (v / maxBar) * 100 : 0;
            const isCurrent = i === s.views_weekly.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-bold text-white">{v}</span>
                <div className="w-full rounded-t-md transition-all" style={{ height: `${height}%`, backgroundColor: isCurrent ? "#E63946" : "rgba(230,57,70,0.4)", minHeight: 4 }} />
                <span className="text-[10px] text-[#4a4d56]">Sem {i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Recruiter regions ──────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">D&apos;où viennent les recruteurs intéressés</h2>
        <p className="text-[13px] text-[#9CA3AF] mb-4">Tes vues viennent de {s.recruiter_regions.length} région{s.recruiter_regions.length > 1 ? "s" : ""} du Québec</p>
        <div className="space-y-3">
          {s.recruiter_regions.map((r) => {
            const maxCount = Math.max(...s.recruiter_regions.map((x) => x.count));
            const width = maxCount > 0 ? (r.count / maxCount) * 100 : 0;
            return (
              <div key={r.region} className="flex items-center gap-3">
                <span className="text-[13px] text-white font-bold w-[180px] shrink-0">{r.region}</span>
                <div className="flex-1 h-3 bg-[#2D3748] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#E63946]" style={{ width: `${width}%` }} />
                </div>
                <span className="text-[12px] text-[#9CA3AF] shrink-0 w-[100px] text-right">{r.count} recruteur{r.count > 1 ? "s" : ""}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-[#4a4d56] mt-4 italic">Les noms des recruteurs et des CÉGEPs restent confidentiels pour protéger le processus de recrutement.</p>
      </div>

      {/* ── Section 4: How you compare ────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Ton profil vs la moyenne</h2>
        {s.profile_rank_sport === "top_30" ? (
          <div className="flex items-center gap-3">
            <span className="text-[24px]">🔥</span>
            <p className="text-[15px] font-bold text-[#22C55E]">Ton profil est dans le top 30% des profils les plus consultés en {u.sport}</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[24px]">📈</span>
              <p className="text-[15px] font-bold text-[#EAB308]">Ton profil est en dessous de la moyenne pour le {u.sport}</p>
            </div>
            <p className="text-[13px] text-[#9CA3AF]">Voici comment améliorer ta visibilité :</p>
            <Link href="/athlete/profil" className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors mt-2 inline-block">Améliorer mon profil →</Link>
          </div>
        )}
      </div>

      {/* ── Section 5: Verified impact ────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#E63946]/10 p-5">
        {u.is_verified ? (
          <>
            <p className="text-[13px] text-[#9CA3AF] mb-4">Les profils vérifiés comme le tien reçoivent :</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="font-head text-[28px] font-black text-white">11x</p>
                <p className="text-[11px] text-[#6b7280] uppercase tracking-wider">plus de vues</p>
              </div>
              <div className="text-center">
                <p className="font-head text-[28px] font-black text-white">3x</p>
                <p className="text-[11px] text-[#6b7280] uppercase tracking-wider">plus d&apos;engagements</p>
              </div>
              <div className="text-center">
                <p className="font-head text-[28px] font-black text-white">80%</p>
                <p className="text-[11px] text-[#6b7280] uppercase tracking-wider">contactés par un recruteur</p>
              </div>
            </div>
            <p className="text-[11px] text-[#6b7280] mt-4">Continue à améliorer ton profil pour maximiser ta visibilité!</p>
          </>
        ) : (
          <>
            <p className="text-[14px] font-bold text-white mb-2">Les profils vérifiés reçoivent 11x plus de vues</p>
            <p className="text-[13px] text-[#9CA3AF]">Ton profil est à {s.profile_completeness}% — il te manque {60 - s.profile_completeness}% pour être vérifié</p>
            <p className="text-[12px] text-[#6b7280] mt-2">Parle à ton coach pour compléter les sections manquantes</p>
            <Link href="/athlete/profil" className="inline-flex items-center gap-1 text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] mt-3 transition-colors">
              Voir mon profil →
            </Link>
          </>
        )}
      </div>

      {/* ── Section 6: Who viewed — Pro gated ────────────────── */}
      <FeatureGate feature="who_viewed" requiredTier="athlete_pro">
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Quels CÉGEPs consultent ton profil</h2>
          <div className="space-y-3">
            {[
              { name: "CÉGEP de Sainte-Foy", views: 8, lastSeen: "il y a 2 jours" },
              { name: "CÉGEP Garneau", views: 5, lastSeen: "il y a 4 jours" },
              { name: "CÉGEP Limoilou", views: 3, lastSeen: "il y a 1 semaine" },
              { name: "CÉGEP Édouard-Montpetit", views: 2, lastSeen: "il y a 2 semaines" },
              { name: "CÉGEP André-Laurendeau", views: 1, lastSeen: "il y a 3 semaines" },
            ].map((c) => (
              <div key={c.name} className="flex items-center justify-between py-2 border-b border-[#2D3748]/40 last:border-0">
                <div>
                  <p className="text-[13px] font-bold text-white">{c.name}</p>
                  <p className="text-[11px] text-[#6B7280]">{c.lastSeen}</p>
                </div>
                <span className="text-[13px] font-bold text-[#E63946]">{c.views} vues</span>
              </div>
            ))}
          </div>
        </div>
      </FeatureGate>
    </div>
  );
}
