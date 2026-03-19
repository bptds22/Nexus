"use client";

import { use } from "react";
import Link from "next/link";
import {
  ALL_PROFILES,
  BRUNO,
  type AthleteProfile,
} from "../../_data/mockAthleteProfiles";
import type { LeadershipBadge } from "@/lib/config/sportBadges";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import NxIcon from "@/components/ui/NxIcon";
import StarRating from "@/components/ui/StarRating";

/* ═══════════════════════════════════════════════════════════════
   APERÇU — Recruiter Preview Page
   Layout: 2-col Hero → Stat Strip → Coach Report → Academic Strip
═══════════════════════════════════════════════════════════════ */

const sectionLabel = "font-head text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-4";

/** Reverse map: NexusSport key → display name */
const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_NAME_MAP).map(([display, key]) => [key, display])
);

/* ── Badge Components ──────────────────────────────────────── */

const pillBase = "inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-full border";

function VerifiedBadge({ isVerified }: { isVerified: boolean }) {
  return (
    <span
      className={pillBase}
      style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}
    >
      {isVerified ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      ) : (
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#6B7280" }} />
      )}
      {isVerified ? "Vérifié" : "Non vérifié"}
    </span>
  );
}

function FavoritesBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className={pillBase}
      style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#E63946" stroke="none">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      {count} recruteur{count > 1 ? "s" : ""}
    </span>
  );
}

/* ── Recruitment Status Pill ────────────────────────────────── */

function RecruitmentStatusPill({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
    ouvert: { bg: "rgba(255,255,255,0.10)", border: "rgba(255,255,255,0.25)", text: "#FFFFFF", dot: "#22C55E", label: "Ouvert aux offres" },
    committed: { bg: "rgba(37,99,235,0.12)", border: "rgba(37,99,235,0.3)", text: "#3B82F6", dot: "#3B82F6", label: "Committed" },
    en_visite: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#f59e0b", dot: "#f59e0b", label: "En visite" },
  };
  const c = cfg[status] || cfg.ouvert;
  return (
    <span
      className={pillBase}
      style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

/* ── Preference Pill ────────────────────────────────────────── */

function PreferencePill({ active, label: lbl }: { active?: boolean; label: string }) {
  if (active === undefined) return null;
  return (
    <span
      className={pillBase}
      style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? "#22C55E" : "#6B7280" }} />
      {lbl}
    </span>
  );
}

/* ── V30 Player Card ───────────────────────────────────────── */

function PlayerCard({ a }: { a: AthleteProfile }) {
  const stars = Math.round(a.stars);
  const posAbbr = a.position.length > 4 ? a.position.slice(0, 3).toUpperCase() : a.position.toUpperCase();
  const sportDisplay = SPORT_DISPLAY[a.sport] || a.sport;

  return (
    <div className="nx-v30-wrap relative" style={{ width: 300, paddingTop: 6, paddingBottom: 10 }}>

      {/* Verified badge with cutout ring */}
      {a.profilePercent >= 50 && (
        <div className="nx-v30-badge absolute z-30" style={{ top: 10, right: -12 }}>
          <div className="rounded-full" style={{ border: '3px solid #111317' }}>
            <svg width="48" height="48" viewBox="0 0 54 54" fill="none">
              <defs>
                <radialGradient id="pc_bg" cx="38%" cy="28%" r="68%">
                  <stop offset="0%" stopColor="#29AAFF" />
                  <stop offset="55%" stopColor="#0094F0" />
                  <stop offset="100%" stopColor="#0060C0" />
                </radialGradient>
                <radialGradient id="pc_shine" cx="38%" cy="25%" r="55%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
                  <stop offset="60%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>
              <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35" />
              <circle cx="27" cy="27" r="24" fill="url(#pc_bg)" />
              <circle cx="27" cy="27" r="24" fill="url(#pc_shine)" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="nx-v30-card relative overflow-visible" style={{ width: 300, borderRadius: 10 }}>

        {/* Photo area */}
        <div className="relative overflow-hidden" style={{ width: 300, height: 420, borderRadius: 10, background: '#2F3440' }}>
          {a.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.photo} alt={`${a.firstName} ${a.lastName}`} className="absolute inset-0 w-full h-full object-cover z-[1]" />
          ) : (
            <div className="absolute inset-0 z-[1] flex items-center justify-center">
              <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 120, color: 'rgba(255,255,255,0.06)', letterSpacing: '0.05em', lineHeight: 1 }}>
                {a.firstName[0]}{a.lastName[0]}
              </span>
            </div>
          )}
          <div
            className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]"
            style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }}
          />
          <div className="absolute bottom-4 left-4 z-[3]">
            <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 28, color: '#fff', letterSpacing: '0.04em', lineHeight: 1 }}>
              {a.firstName}
            </p>
            <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 28, color: '#fff', letterSpacing: '0.04em', lineHeight: 1 }}>
              {a.lastName}
            </p>
          </div>
          <div
            className="absolute top-0 right-0 z-20"
            style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 20px 20px 0', borderColor: 'transparent #1E2128 transparent transparent' }}
          />
        </div>

        {/* Ticket */}
        <div
          className="nx-v30-ticket absolute z-[999] overflow-hidden"
          style={{ bottom: -14, right: -22, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex" style={{ width: 322 }}>
            <div
              className="flex flex-col justify-between"
              style={{ background: '#1E2128', padding: '12px 14px 12px 16px', minWidth: 96, gap: 4 }}
            >
              {[
                { lbl: "Sport", val: sportDisplay },
                { lbl: "Pos", val: posAbbr },
                { lbl: "No.", val: a.jerseyNumber ? `#${a.jerseyNumber}` : "—" },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)', marginBottom: 1 }}>
                    {r.lbl}
                  </div>
                  <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 16, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>
                    {r.val}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="nx-v30-perf flex flex-col items-center justify-center"
              style={{ width: 12, background: '#E6E6E6', borderLeft: '1.5px dashed rgba(11,18,32,0.2)', borderRight: '1.5px dashed rgba(11,18,32,0.2)', gap: 3 }}
            >
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(11,18,32,0.2)' }} />
              ))}
            </div>
            <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '12px 16px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', background: '#1E2128', borderRadius: 4, padding: '3px 5px', marginBottom: 6, width: 'fit-content' }}>
                <StarRating rating={a.stars} size="md" showNumber={false} className="!gap-0.5" />
              </div>
              <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#1E2128', marginBottom: 2 }}>
                {a.school}
              </div>
              <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#9CA3AF' }}>
                {a.region}
              </div>
              <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#E63946', marginTop: 2 }}>
                Promotion {a.graduationYear}
              </div>
            </div>
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                background: '#E63946',
                width: 24,
                writingMode: 'vertical-rl' as const,
                fontFamily: 'var(--font-bebas), sans-serif',
                fontSize: 10,
                letterSpacing: '0.22em',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              NEXUS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function ApercuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const athlete: AthleteProfile = ALL_PROFILES[id] || BRUNO;
  const a = athlete;

  /* Build the stat strip cells: height, weight, then badges */
  const statCells: { top: string; mid: string; sub?: string; iconName?: string }[] = [
    { top: a.heightDisplay || "—", mid: "Taille" },
    { top: a.weightDisplay || "—", mid: "Poids" },
    ...a.badges.map((b) => ({ top: "", mid: b.label, sub: b.detail, iconName: b.icon })),
  ];

  return (
    <div className="min-h-screen relative z-1">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/coach/athletes" className="text-[14px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
              Retour au roster
            </Link>
            <span className="text-[#2D3748]">|</span>
            <span className="text-[12px] text-[#6b7280] tracking-wider uppercase">Aperçu du profil — Tel que vu par les recruteurs</span>
          </div>
          <Link
            href={`/coach/athletes/${a.id}/modifier`}
            className="flex items-center gap-1.5 text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Modifier le profil
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 pb-28 relative z-1">

        {/* ══════════ HERO — 2 Columns ══════════ */}
        <section className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">

          {/* LEFT: Player Card */}
          <div className="shrink-0 flex justify-center lg:justify-start" style={{ minHeight: 480 }}>
            <PlayerCard a={a} />
          </div>

          {/* RIGHT: Info + stat strip */}
          <div className="flex-1 min-w-0 lg:pt-2 space-y-5">

            {/* Name */}
            <h1 className="font-head text-[36px] sm:text-[46px] font-black text-white uppercase tracking-tight leading-[0.92]">
              {a.firstName}<br />{a.lastName}
            </h1>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <VerifiedBadge isVerified={a.isVerified} />
              <FavoritesBadge count={a.favorites} />
              {a.commitmentStatus && (
                <RecruitmentStatusPill status={a.commitmentStatus} />
              )}
            </div>

            {/* Non-verified note */}
            {!a.isVerified && (
              <p className="text-[13px] text-[#6B7280] italic">
                Ce profil n&apos;est pas encore visible aux recruteurs.
              </p>
            )}

            {/* View count */}
            {a.views > 0 && (
              <div className="flex items-center gap-1.5 text-[#6b7280]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-[13px]">{a.views} vues ce mois</span>
              </div>
            )}

            {/* Video CTA */}
            <div>
              {a.videoUrl ? (
                <a
                  href={a.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3
                    text-white font-bold text-[13px] uppercase tracking-wider
                    transition-all hover:border-[#E63946] hover:shadow-[0_0_16px_rgba(230,57,70,0.2)] hover:-translate-y-0.5 group"
                >
                  <span className="w-8 h-8 rounded-full bg-[#E63946] flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
                      <polygon points="8 5 19 12 8 19 8 5" />
                    </svg>
                  </span>
                  Voir les faits saillants
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#6b7280] group-hover:text-white transition-colors">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ) : (
                <div className="inline-flex items-center gap-2.5 bg-[#1A1D24]/50 border border-[#2D3748] rounded-lg px-5 py-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="1.5" strokeLinecap="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <span className="text-[14px] text-[#6b7280]">Aucun lien vidéo</span>
                  <Link href={`/coach/athletes/${a.id}/modifier?step=6`} className="text-[12px] text-[#F59E0B] font-bold ml-2 hover:underline">
                    Ajouter
                  </Link>
                </div>
              )}
            </div>

            {/* ── STAT STRIP (connected bar) ───────────────────── */}
            <div>
              <h3 className={sectionLabel}>Profil athlète</h3>
              <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
                <div className="grid divide-x divide-[#2D3748]/50" style={{ gridTemplateColumns: `repeat(${statCells.length}, minmax(0, 1fr))` }}>
                  {statCells.map((cell, i) => (
                    <div key={i} className={`p-4 text-center flex flex-col items-center justify-center min-h-[100px] ${cell.iconName ? "bg-[#E63946]/[0.04]" : ""}`}>
                      {cell.iconName ? (
                        <div className="flex items-center justify-center min-h-[36px]">
                          <div className="w-10 h-10 rounded-full bg-[#E63946]/10 flex items-center justify-center">
                            <NxIcon name={cell.iconName} size={22} className="text-[#E63946]" />
                          </div>
                        </div>
                      ) : (
                        <p className="text-[26px] sm:text-[30px] font-head font-black text-white leading-none flex items-center justify-center min-h-[36px]">
                          {cell.top}
                        </p>
                      )}
                      <p className={`text-[12px] font-bold tracking-[0.2em] uppercase mt-2 ${cell.iconName ? "text-white" : "text-[#9CA3AF]"}`}>
                        {cell.mid}
                      </p>
                      {cell.sub && (
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">{cell.sub}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ RAPPORT DE L'ENTRAÎNEUR ══════════ */}
        {a.coachEndorsement ? (
          <section>
            <h2 className={sectionLabel}>Rapport de l&apos;entraîneur</h2>
            <div className="relative bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6 sm:p-8 pl-8 sm:pl-10 overflow-hidden">
              <span className="absolute top-3 left-3 text-[60px] font-serif text-[#E63946]/10 leading-none select-none">&ldquo;</span>
              <div className="relative">
                <p className="text-[18px] sm:text-[20px] text-white italic leading-relaxed pl-5"
                  style={{ borderLeftWidth: "3px", borderLeftStyle: "solid", borderLeftColor: "#E63946" }}>
                  &ldquo;{a.coachEndorsement}&rdquo;
                </p>
                <p className="text-[14px] font-bold text-[#9CA3AF] mt-4 pl-5">
                  — {a.coachName}, {a.coachSchool}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section>
            <h2 className={sectionLabel}>Rapport de l&apos;entraîneur</h2>
            <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6 text-center">
              <p className="text-[14px] text-[#6b7280]">Aucun rapport pour le moment</p>
              <Link href={`/coach/athletes/${a.id}/modifier?step=5`} className="text-[12px] text-[#F59E0B] font-bold mt-2 inline-block hover:underline">
                Ajoute ton rapport pour renforcer ce profil
              </Link>
            </div>
          </section>
        )}

        {/* ══════════ PROFIL ACADÉMIQUE (connected strip) ══════════ */}
        <section>
          <h2 className={sectionLabel}>Profil académique</h2>
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#2D3748]/50">
              <div className="p-5 text-center">
                <p className="text-[28px] font-head font-black text-white leading-none">
                  {a.gpa ? `${a.gpa}%` : "—"}
                </p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Moyenne générale</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-[18px] font-bold text-white leading-none mt-1">
                  {a.program || "—"}
                </p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Programme</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-[18px] font-bold text-white leading-none mt-1">
                  Juin {a.graduationYear}
                </p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Graduation</p>
              </div>
            </div>

            {/* Preference tags */}
            <div className="border-t border-[#2D3748]/50 px-5 py-3.5 flex flex-wrap gap-2">
              <PreferencePill active={a.openToRelocate} label="Ouvert à déménager" />
              <PreferencePill active={a.openToPrivate} label="Ouvert au privé" />
              <PreferencePill active={a.wantsDEC} label="Veut faire un DEC" />
              <PreferencePill active={a.openToAnglophone} label="Ouvert anglophone" />
            </div>
          </div>
        </section>
      </div>

      {/* ══════════ STICKY CTA ══════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:bottom-6 md:left-auto md:right-6 md:w-auto">
        {/* Mobile: full width bar */}
        <div className="md:hidden bg-[#111317]/95 backdrop-blur-sm border-t border-[#2D3748] px-4 py-3">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2.5 bg-[#E63946] text-white rounded-xl px-6 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest
              transition-all hover:bg-[#D42B22] active:scale-[0.98] shadow-[0_0_20px_rgba(230,57,70,0.3)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Contacter le coach
          </button>
        </div>

        {/* Desktop: floating button */}
        <button
          type="button"
          className="hidden md:flex items-center gap-2.5 bg-[#E63946] text-white rounded-xl px-8 py-4 font-head font-bold text-[14px] uppercase tracking-widest min-w-[220px] justify-center
            transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(230,57,70,0.4)] active:scale-[0.98] shadow-[0_4px_20px_rgba(230,57,70,0.3)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          Contacter le coach
        </button>
      </div>
    </div>
  );
}
