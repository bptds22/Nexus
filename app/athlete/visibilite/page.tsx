"use client";

import Link from "next/link";
import FeatureGate from "@/components/subscription/FeatureGate";
import useAthleteVisibility from "@/hooks/useAthleteVisibility";
import { relativeTimeFr } from "@/lib/utils/relativeTime";

/* ═══════════════════════════════════════════════════════════════
   Ma Visibilité — Recruiter activity on athlete profile
   Free: KPIs, chart, regions, comparison
   Pro: CÉGEP cards, recruiter rows
═══════════════════════════════════════════════════════════════ */

const sectionTitle = "text-[11px] font-semibold tracking-[2px] uppercase text-[#555]";
const proTag = "text-[9px] font-bold tracking-[1.5px] uppercase bg-[#E63946]/15 text-[#E63946] px-2 py-0.5 rounded ml-2";

function Initials({ name, size = 36 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full bg-[#252830] flex items-center justify-center flex-shrink-0 text-[#E63946] font-bold"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

function InterestBadge({ level }: { level: "fort" | "interesse" | "nouveau" }) {
  const config = {
    fort: { label: "Intérêt fort", bg: "bg-[#E63946]/15", text: "text-[#E63946]", border: "border-[#E63946]/30" },
    interesse: { label: "Intéressé", bg: "bg-[#F59E0B]/15", text: "text-[#F59E0B]", border: "border-[#F59E0B]/30" },
    nouveau: { label: "Nouveau", bg: "bg-[#3B82F6]/15", text: "text-[#3B82F6]", border: "border-[#3B82F6]/30" },
  }[level];
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${config.bg} ${config.text} ${config.border}`}>
      {config.label}
    </span>
  );
}

export default function VisibilitePage() {
  const { stats, weeklyViews, regionBreakdown, cegepDetails, recruiterDetails, percentile, sportName, loading } = useAthleteVisibility();

  const trend = stats.viewsLastMonth > 0
    ? Math.round(((stats.viewsThisMonth - stats.viewsLastMonth) / stats.viewsLastMonth) * 100)
    : 0;
  const maxBar = weeklyViews.length > 0 ? Math.max(...weeklyViews.map((w) => w.viewCount)) : 0;

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[#1A1D24] rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-[#1A1D24] rounded-xl" />)}
          </div>
          <div className="h-[240px] bg-[#1A1D24] rounded-xl" />
        </div>
      </div>
    );
  }

  const hasViews = stats.viewsThisMonth > 0 || stats.viewsLastMonth > 0 || weeklyViews.length > 0;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Ma visibilité</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Suis l&apos;activité des recruteurs sur ton profil</p>
      </div>

      {/* Empty state */}
      {!hasViews && (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-8 text-center">
          <svg className="mx-auto mb-4 text-[#4a4d56]" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          <p className="text-[15px] font-bold text-white mb-2">Ton profil n&apos;a pas encore été consulté</p>
          <p className="text-[13px] text-[#9CA3AF] mb-4">Complète ton profil pour augmenter ta visibilité!</p>
          <Link href="/athlete/profil" className="inline-flex items-center gap-1 text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors">
            Améliorer mon profil →
          </Link>
        </div>
      )}

      {/* ── Section 1: Impact stats KPIs ─────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Vues ce mois</p>
          <p className="font-head text-[36px] font-black text-white leading-none mt-1">{stats.viewsThisMonth}</p>
          {trend > 0 && <p className="text-[12px] font-bold text-[#22C55E] mt-1">↑{trend}% vs mois dernier</p>}
          {trend < 0 && <p className="text-[12px] font-bold text-[#EF4444] mt-1">↓{Math.abs(trend)}% vs mois dernier</p>}
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Recruteurs uniques au total</p>
          <p className="font-head text-[36px] font-black text-white leading-none mt-1">{stats.uniqueRecruiters}</p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Ajouté aux favoris</p>
          <p className="font-head text-[36px] font-black text-[#E63946] leading-none mt-1">{stats.totalFavorites}</p>
        </div>
      </div>

      {/* ── Section 2: Weekly views chart ─────────────────────── */}
      {weeklyViews.length > 0 && (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-5">Vues par semaine — 8 dernières semaines</h2>
          <div className="flex items-end gap-3 h-[180px]">
            {weeklyViews.map((w, i) => {
              const height = maxBar > 0 ? (w.viewCount / maxBar) * 100 : 0;
              const isCurrent = i === weeklyViews.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[11px] font-bold text-white">{w.viewCount}</span>
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{ height: `${height}%`, backgroundColor: isCurrent ? "#E63946" : "rgba(230,57,70,0.4)", minHeight: 4 }}
                  />
                  <span className="text-[10px] text-[#4a4d56]">Sem {i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 3: Recruiter regions (free) ──────────────── */}
      {regionBreakdown.length > 0 && (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">D&apos;où viennent les recruteurs intéressés</h2>
          <p className="text-[13px] text-[#9CA3AF] mb-4">Tes vues viennent de {regionBreakdown.length} région{regionBreakdown.length > 1 ? "s" : ""} du Québec</p>
          <div className="space-y-3">
            {regionBreakdown.map((r) => {
              const maxCount = Math.max(...regionBreakdown.map((x) => x.count));
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
      )}

      {/* ── Section 4: How you compare ────────────────────────── */}
      {percentile !== null && (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Ton profil vs la moyenne</h2>
          {percentile >= 70 ? (
            <p className="text-[15px] font-bold text-[#22C55E]">
              Ton profil est dans le top {100 - percentile}% des profils les plus consultés en {sportName}
            </p>
          ) : (
            <div>
              <p className="text-[15px] font-bold text-[#EAB308] mb-2">Ton profil est en dessous de la moyenne pour le {sportName}</p>
              <p className="text-[13px] text-[#9CA3AF]">Voici comment améliorer ta visibilité :</p>
              <Link href="/athlete/profil" className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors mt-2 inline-block">
                Améliorer mon profil →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Section 5: Quels CÉGEPs consultent ton profil (Pro) ── */}
      <FeatureGate feature="who_viewed" requiredTier="pro">
        <div>
          <div className="flex items-center mb-4">
            <h2 className={sectionTitle}>Quels CÉGEPs consultent ton profil</h2>
            <span className={proTag}>PRO</span>
          </div>
          {cegepDetails.length > 0 ? (
            <div className="space-y-3">
              {cegepDetails.map((c) => (
                <div
                  key={c.cegepName}
                  className="bg-[#1A1D24] rounded-lg border-l-[3px] border-l-[#E63946] flex items-center gap-3.5"
                  style={{ padding: "14px 16px" }}
                >
                  <Initials name={c.cegepName} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-bold text-white">{c.cegepName}</p>
                      <InterestBadge level={c.interestLevel} />
                    </div>
                    <p className="text-[12px] text-[#6b7280] mt-0.5">{c.region}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="flex items-center gap-1.5 text-[12px] text-[#9CA3AF]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      {c.totalViews}
                    </span>
                    {c.favCount > 0 && (
                      <span className="flex items-center gap-1.5 text-[12px] text-[#E63946]">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="#E63946" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                        {c.favCount}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-6 text-center">
              <p className="text-[13px] text-[#555]">Aucun CÉGEP n&apos;a encore consulté ton profil</p>
            </div>
          )}
        </div>
      </FeatureGate>

      {/* ── Section 6: Qui consulte ton profil (Pro) ────────── */}
      <FeatureGate feature="who_viewed" requiredTier="pro">
        <div>
          <div className="flex items-center mb-4">
            <h2 className={sectionTitle}>Qui consulte ton profil</h2>
            <span className={proTag}>PRO</span>
          </div>
          {recruiterDetails.length > 0 ? (
            <div className="space-y-2">
              {recruiterDetails.map((r) => (
                <div
                  key={r.recruiterId}
                  className="bg-[#1A1D24] rounded-lg flex items-center gap-3.5"
                  style={{ padding: "12px 14px" }}
                >
                  <Initials name={r.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white">{r.name}</p>
                    {r.cegepName && <p className="text-[11px] text-[#6b7280]">{r.cegepName}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-[12px] text-[#9CA3AF]">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      {r.viewCount}
                    </span>
                    {r.hasFavorited && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#E63946" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                    )}
                    <span className="text-[11px] text-[#4a4d56]">{relativeTimeFr(r.lastViewed)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-6 text-center">
              <p className="text-[13px] text-[#555]">Aucun recruteur n&apos;a encore consulté ton profil</p>
            </div>
          )}
        </div>
      </FeatureGate>

      {/* ── Section 7: Verified + video impact ────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#E63946]/10 p-5">
        <p className="text-[13px] text-[#9CA3AF] mb-4">Les profils vérifiés avec vidéo reçoivent :</p>
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
      </div>
    </div>
  );
}
