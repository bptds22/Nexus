"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ALL_RECRUITER_PROFILES,
  mockAthleteProfileFull,
} from "@/lib/mock/athleteProfileRecruiter";
import type { AthleteProfileRecruiterView, AthleteTraitRatings } from "@/lib/types/models";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import NxIcon from "@/components/ui/NxIcon";
import StarRating from "@/components/ui/StarRating";

/* ═══════════════════════════════════════════════════════════════
   Coach Athlete Profile — Same design as recruiter view
   + coach-specific action bar on top (consent, invite, edit)
═══════════════════════════════════════════════════════════════ */

const sectionLabel = "font-head text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-4";
const pillBase = "inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-full border";
const cardBase = "bg-[#1A1D24] rounded-xl border border-[#2D3748]";

const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_NAME_MAP).map(([display, key]) => [key, display])
);

const CHARACTER_TRAITS: { key: keyof AthleteTraitRatings; label: string; iconName: string }[] = [
  { key: "leadership", label: "Leadership", iconName: "leadership" },
  { key: "discipline", label: "Discipline", iconName: "discipline" },
  { key: "coachability", label: "Coachabilité", iconName: "coachability" },
  { key: "gameIQ", label: "Intelligence de jeu", iconName: "gameIQ" },
  { key: "competitiveness", label: "Compétitivité", iconName: "competitiveness" },
  { key: "teamwork", label: "Esprit d'équipe", iconName: "teamwork" },
  { key: "resilience", label: "Résilience", iconName: "resilience" },
  { key: "attitude", label: "Attitude", iconName: "attitude" },
];

/* ── Shared components (same as recruiter view) ───────────────── */

function ProfileToggle({ mode, onChange }: { mode: "simple" | "detailed"; onChange: (m: "simple" | "detailed") => void }) {
  const pill = (active: boolean) =>
    `px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all cursor-pointer ${
      active ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]" : "text-[#6b7280] hover:text-white"
    }`;
  return (
    <div className="flex items-center gap-1 bg-[#13151a] rounded-xl p-1.5 w-fit">
      <button type="button" onClick={() => onChange("simple")} className={pill(mode === "simple")}>Simplifié</button>
      <button type="button" onClick={() => onChange("detailed")} className={pill(mode === "detailed")}>Détaillé</button>
    </div>
  );
}

function CompletenessBar({ percent }: { percent: number }) {
  const color = percent >= 80 ? "#3B82F6" : percent >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-[#2D3748] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <span className="text-[13px] font-bold" style={{ color }}>{percent}%</span>
    </div>
  );
}

function VerifiedBadge({ isVerified }: { isVerified: boolean }) {
  return (
    <span className={pillBase} style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isVerified ? "#3B82F6" : "#6B7280" }} />
      {isVerified ? "Vérifié" : "Non vérifié"}
    </span>
  );
}

function PreferencePill({ active, label: lbl }: { active?: boolean; label: string }) {
  if (active === undefined) return null;
  return (
    <span className={pillBase} style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? "#22C55E" : "#6B7280" }} />
      {lbl}
    </span>
  );
}

function positionAbbr(pos: string): string {
  const match = pos.match(/\(([^)]+)\)/);
  if (match) return match[1].toUpperCase();
  return pos.length > 4 ? pos.slice(0, 3).toUpperCase() : pos.toUpperCase();
}

function InfoRow({ label, value, icon }: { label: string; value?: string | number | null; icon?: string }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/40 last:border-b-0">
      <span className="text-[13px] text-[#9CA3AF] flex items-center gap-2">
        {icon && <NxIcon name={icon} size={14} className="text-[#6B7280]" />}
        {label}
      </span>
      <span className="text-[14px] font-bold text-white">{value}</span>
    </div>
  );
}

/* ── Player Card (V30) — same as recruiter view ───────────────── */

function PlayerCard({ a }: { a: AthleteProfileRecruiterView }) {
  const ratingValue = a.overallRating;
  const posAbbr = positionAbbr(a.primaryPosition);
  const sportKey = SPORT_NAME_MAP[a.primarySport];
  const sportDisplay = sportKey ? (SPORT_DISPLAY[sportKey] || a.primarySport) : a.primarySport;

  return (
    <div className="nx-v30-wrap relative" style={{ width: 300, paddingTop: 6, paddingBottom: 10 }}>
      {a.isVerified && (
        <div className="nx-v30-badge absolute z-30" style={{ top: 10, right: -12 }}>
          <div className="rounded-full" style={{ border: '3px solid #111317' }}>
            <svg width="48" height="48" viewBox="0 0 54 54" fill="none">
              <defs>
                <radialGradient id="cc_bg" cx="38%" cy="28%" r="68%"><stop offset="0%" stopColor="#29AAFF" /><stop offset="55%" stopColor="#0094F0" /><stop offset="100%" stopColor="#0060C0" /></radialGradient>
              </defs>
              <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35" />
              <circle cx="27" cy="27" r="24" fill="url(#cc_bg)" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
      )}

      <div className="nx-v30-card relative overflow-visible" style={{ width: 300, borderRadius: 10 }}>
        <div className="relative overflow-hidden" style={{ width: 300, height: 420, borderRadius: 10, background: '#2F3440' }}>
          {a.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.photoUrl} alt={`${a.firstName} ${a.lastName}`} className="absolute inset-0 w-full h-full object-cover z-[1]" />
          ) : (
            <div className="absolute inset-0 z-[1] flex items-center justify-center">
              <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 120, color: 'rgba(255,255,255,0.06)', letterSpacing: '0.05em', lineHeight: 1 }}>
                {a.firstName[0]}{a.lastName[0]}
              </span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }} />
          <div className="absolute bottom-4 left-4 z-[3]">
            <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 28, color: '#fff', letterSpacing: '0.04em', lineHeight: 1 }}>{a.firstName}</p>
            <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 28, color: '#fff', letterSpacing: '0.04em', lineHeight: 1 }}>{a.lastName}</p>
          </div>
        </div>

        {/* Ticket */}
        <div className="nx-v30-ticket absolute z-[999] overflow-hidden" style={{ bottom: -14, right: -22, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <div className="flex" style={{ width: 322 }}>
            <div className="flex flex-col justify-between" style={{ background: '#1E2128', padding: '12px 14px 12px 16px', minWidth: 96, gap: 4 }}>
              {[
                { lbl: "Sport", val: sportDisplay },
                { lbl: "Pos", val: posAbbr },
                { lbl: "Promo", val: String(a.graduationYear) },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)', marginBottom: 1 }}>{r.lbl}</div>
                  <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 16, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>{r.val}</div>
                </div>
              ))}
            </div>
            <div className="nx-v30-perf flex flex-col items-center justify-center" style={{ width: 12, background: '#E6E6E6', borderLeft: '1.5px dashed rgba(11,18,32,0.2)', borderRight: '1.5px dashed rgba(11,18,32,0.2)', gap: 3 }}>
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(11,18,32,0.2)' }} />
              ))}
            </div>
            <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '12px 16px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', background: '#1E2128', borderRadius: 4, padding: '3px 5px', marginBottom: 6, width: 'fit-content' }}>
                <StarRating rating={ratingValue} size="md" showNumber={false} className="!gap-0.5" />
              </div>
              <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#1E2128', marginBottom: 2 }}>{a.schoolName}</div>
              <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#9CA3AF' }}>{a.region}</div>
            </div>
            <div className="flex items-center justify-center flex-shrink-0" style={{ background: '#E63946', width: 24, writingMode: 'vertical-rl' as const, fontFamily: 'var(--font-bebas), sans-serif', fontSize: 10, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.7)' }}>NEXUS</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Toast ────────────────────────────────────────────────────── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-[fadeInUp_0.3s_ease-out]">
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        <span className="text-[13px] font-bold text-white">{message}</span>
        <button type="button" onClick={onDone} className="text-[#6b7280] hover:text-white ml-2" aria-label="Fermer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function CoachAthleteProfilePage() {
  const params = useParams();
  const id = params.id as string;

  // Load profile — map to recruiter mock data
  const a = ALL_RECRUITER_PROFILES[id] || mockAthleteProfileFull;

  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const [consentGiven, setConsentGiven] = useState(true); // mock: most have consent
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [recruiterView, setRecruiterView] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);

  const isDetailed = mode === "detailed";
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Trait calculations
  const traitEntries = a.traitRatings ? Object.entries(a.traitRatings) as [keyof AthleteTraitRatings, number][] : [];
  const traitAvg = traitEntries.length > 0 ? traitEntries.reduce((s, [, v]) => s + v, 0) / traitEntries.length : null;
  const coteGlobale = traitAvg ?? a.overallRating;

  // Stat strip cells (same as recruiter)
  const statCells: { top?: string; mid: string; sub?: string; iconName?: string }[] = [
    { top: a.heightDisplay, mid: "Taille" },
    { top: a.weightDisplay, mid: "Poids" },
  ];
  if (a.distinctions.length > 0) {
    a.distinctions.forEach((d) => statCells.push({ iconName: d.icon, mid: d.label, sub: d.detail }));
  }

  return (
    <div className="px-5 md:px-8 lg:px-10 py-6 max-w-7xl mx-auto space-y-6">

      {/* ── Breadcrumb ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-[12px] text-[#6b7280]">
        <Link href="/coach" className="hover:text-white transition-colors">Nexus</Link>
        <span>/</span>
        <Link href="/coach" className="hover:text-white transition-colors">Coach</Link>
        <span>/</span>
        <Link href="/coach/athletes" className="hover:text-white transition-colors">Mes Athlètes</Link>
        <span>/</span>
        <span className="text-white font-semibold">{a.firstName} {a.lastName}</span>
      </div>

      {/* ── Coach Action Bar ──────────────────────────────────── */}
      {!recruiterView && (
        <div className={`${cardBase} p-4 sm:p-5`}>
          <div className="flex flex-wrap items-center gap-4">

            {/* Consent indicator */}
            {consentGiven ? (
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
                <span className="text-[12px] font-bold text-[#22C55E]">Consentement parental confirmé</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                <span className="text-[12px] font-bold text-[#EAB308]">Consentement non confirmé</span>
                <button type="button" onClick={() => { setConsentGiven(true); showToast("Consentement confirmé (POC)"); }} className="px-3 py-1 bg-[#EAB308] hover:bg-[#CA8A04] text-white text-[11px] font-bold rounded transition-colors">Confirmer</button>
              </div>
            )}

            <div className="flex-1" />

            {/* Invite */}
            <button type="button" onClick={() => consentGiven ? setShowInviteModal(true) : null}
              disabled={!consentGiven}
              title={!consentGiven ? "Confirme le consentement parental d'abord" : undefined}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                consentGiven ? "border-[#E63946] text-[#E63946] hover:bg-[#E63946]/10" : "border-[#2D3748] text-[#4a4d56] cursor-not-allowed"
              }`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
              Inviter l&apos;athlète
            </button>

            {/* Edit */}
            <Link href={`/coach/athletes/${id}/modifier`} className="flex items-center gap-2 px-4 py-2 border border-[#E63946] text-[#E63946] rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Modifier
            </Link>

            {/* Aperçu recruteur */}
            <button type="button" onClick={() => setRecruiterView(true)} className="flex items-center gap-2 px-4 py-2 border border-[#2D3748] text-[#9CA3AF] rounded-lg text-[11px] font-bold uppercase tracking-wider hover:text-white hover:border-[#4a4d56] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              Aperçu recruteur
            </button>

            {/* 3-dot menu */}
            <div className="relative">
              <button type="button" title="Plus d'actions" onClick={() => setOpenMenu(!openMenu)} className="w-9 h-9 rounded-lg border border-[#2D3748] flex items-center justify-center text-[#6b7280] hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
              </button>
              {openMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-[#1A1D24] border border-[#2D3748] rounded-lg shadow-xl overflow-hidden">
                    {["Exporter PDF", "Archiver", "Supprimer"].map((label) => (
                      <button key={label} type="button" onClick={() => { setOpenMenu(false); showToast(`${label} (POC)`); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors">{label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recruiter view banner */}
      {recruiterView && (
        <div className="bg-[#3B82F6]/8 border border-[#3B82F6]/20 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#3B82F6]">Mode aperçu recruteur — c&apos;est ce que les recruteurs voient</span>
          <button type="button" onClick={() => setRecruiterView(false)} className="px-4 py-2 bg-[#3B82F6] text-white text-[12px] font-bold rounded-lg hover:bg-[#2563EB] transition-colors">Retour coach</button>
        </div>
      )}

      {/* ── Toggle + Completeness ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <ProfileToggle mode={mode} onChange={setMode} />
        <div className="w-full sm:w-56">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1">Profil complété</p>
          <CompletenessBar percent={a.profileCompleteness} />
        </div>
      </div>

      {/* ══════════ HERO — same 2-column layout as recruiter ══════════ */}
      <section className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
        <div className="shrink-0 flex justify-center lg:justify-start" style={{ minHeight: 480 }}>
          <PlayerCard a={a} />
        </div>

        <div className="flex-1 min-w-0 lg:pt-2 space-y-5">
          <h1 className="font-head text-[36px] sm:text-[46px] font-black text-white uppercase tracking-tight leading-[0.92]">
            {a.firstName}<br />{a.lastName}
            {a.jerseyNumber && <span className="text-[#E63946] ml-3">#{a.jerseyNumber}</span>}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <VerifiedBadge isVerified={a.isVerified} />
          </div>

          {a.viewsThisMonth > 0 && (
            <div className="flex items-center gap-1.5 text-[#6b7280]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              <span className="text-[13px]">{a.viewsThisMonth} vues ce mois</span>
            </div>
          )}

          {/* Video CTA */}
          <div>
            {a.highlightVideoUrl ? (
              <a href={a.highlightVideoUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 text-white font-bold text-[14px] uppercase tracking-wider transition-all hover:border-[#E63946] hover:shadow-[0_0_16px_rgba(230,57,70,0.2)] hover:-translate-y-0.5 group">
                <span className="w-8 h-8 rounded-full bg-[#E63946] flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="8 5 19 12 8 19 8 5" /></svg>
                </span>
                Voir les faits saillants
              </a>
            ) : (
              <div className="inline-flex items-center gap-2.5 bg-[#1A1D24]/50 border border-[#2D3748] rounded-lg px-5 py-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="1.5" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                <span className="text-[14px] text-[#6b7280]">Aucun lien vidéo</span>
              </div>
            )}
          </div>

          {/* Stat Strip */}
          <div>
            <h3 className={sectionLabel}>Profil athlète</h3>
            <div className={`${cardBase} overflow-hidden`}>
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
                      <p className="text-[26px] sm:text-[30px] font-head font-black text-white leading-none flex items-center justify-center min-h-[36px]">{cell.top}</p>
                    )}
                    <p className={`text-[12px] font-bold tracking-[0.2em] uppercase mt-2 ${cell.iconName ? "text-white" : "text-[#9CA3AF]"}`}>{cell.mid}</p>
                    {cell.sub && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{cell.sub}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ COACH REPORT ══════════ */}
      {a.coachReport && (
        <section>
          <h2 className={sectionLabel}>Rapport de l&apos;entraîneur</h2>
          <div className={`relative ${cardBase} p-6 sm:p-8 pl-8 sm:pl-10 overflow-hidden`}>
            <span className="absolute top-3 left-3 text-[60px] font-serif text-[#E63946]/10 leading-none select-none">&ldquo;</span>
            <div className="relative">
              <p className="text-[18px] sm:text-[20px] text-white italic leading-relaxed pl-5" style={{ borderLeft: "3px solid #E63946" }}>
                &ldquo;{a.coachReport}&rdquo;
              </p>
              <p className="text-[14px] font-bold text-[#9CA3AF] mt-4 pl-5">-- {a.coachName}, {a.coachSchool}</p>

              {!isDetailed && (
                <div className="mt-3 pl-5 flex items-center gap-3">
                  <StarRating rating={coteGlobale} size="md" showNumber={false} />
                  <span className="text-[18px] font-head font-black text-white">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
                  <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote Globale</span>
                </div>
              )}

              {isDetailed && (
                <div className="mt-5 pl-5">
                  <div className="flex items-center gap-3 mb-4">
                    <StarRating rating={coteGlobale} size="md" showNumber={false} />
                    <span className="text-[18px] font-head font-black text-white">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
                    <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote Globale</span>
                  </div>

                  {a.traitRatings && (
                    <div className="border-t border-[#2D3748]/50 pt-4">
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">Détail par trait</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                        {CHARACTER_TRAITS.map((trait) => {
                          const val = a.traitRatings![trait.key];
                          return (
                            <div key={trait.key} className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/30">
                              <span className="text-[13px] text-[#c8c8cc] flex items-center gap-2">
                                <NxIcon name={trait.iconName} size={15} className="text-[#6B7280]" />
                                {trait.label}
                              </span>
                              <StarRating rating={val} size="sm" />
                            </div>
                          );
                        })}
                      </div>
                      {traitAvg !== null && (
                        <div className="mt-4 pt-4 border-t border-[#2D3748]/50 flex items-center justify-between">
                          <span className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">Moyenne des traits</span>
                          <div className="flex items-center gap-2">
                            <StarRating rating={traitAvg} size="md" />
                            <span className="text-[16px] font-head font-black text-white">{traitAvg.toFixed(1)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {a.distinctions.length > 0 && (
                    <div className="border-t border-[#2D3748]/50 pt-4 mt-4">
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">Distinctions</p>
                      <div className="flex flex-wrap gap-3">
                        {a.distinctions.map((d, i) => (
                          <div key={i} className="flex items-center gap-3 bg-[#E63946]/[0.06] border border-[#E63946]/20 rounded-lg px-4 py-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#E63946]/10 flex items-center justify-center flex-shrink-0">
                              <NxIcon name={d.icon} size={16} className="text-[#E63946]" />
                            </div>
                            <div>
                              <p className="text-[13px] font-bold text-white">{d.label}</p>
                              {d.detail && <p className="text-[11px] text-[#9CA3AF]">{d.detail}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ ACADEMIC PROFILE ══════════ */}
      <section>
        <h2 className={sectionLabel}>Profil académique</h2>
        <div className={`${cardBase} overflow-hidden`}>
          <div className={`grid grid-cols-1 ${isDetailed ? "sm:grid-cols-3" : "sm:grid-cols-2"} divide-y sm:divide-y-0 sm:divide-x divide-[#2D3748]/50`}>
            <div className="p-5 text-center">
              <p className="text-[28px] font-head font-black text-white leading-none">{a.gpa ? `${a.gpa}%` : "—"}</p>
              <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Moyenne générale</p>
            </div>
            {isDetailed && (
              <div className="p-5 text-center">
                <p className="text-[18px] font-bold text-white leading-none mt-1">{a.program || "—"}</p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Programme</p>
              </div>
            )}
            <div className="p-5 text-center">
              <p className="text-[18px] font-bold text-white leading-none mt-1">Juin {a.graduationYear}</p>
              <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Graduation</p>
            </div>
          </div>
          <div className="border-t border-[#2D3748]/50 px-5 py-3.5 flex flex-wrap gap-2">
            <PreferencePill active={a.openToRelocate} label="Ouvert à déménager" />
            <PreferencePill active={a.openToPrivate} label="Ouvert au privé" />
            <PreferencePill active={a.wantsDEC} label="Veut faire un DEC" />
            <PreferencePill active={a.openToAnglophone} label="Ouvert anglophone" />
          </div>
        </div>
      </section>

      {/* ══════════ DETAILED SECTIONS ══════════ */}
      {isDetailed && (
        <div className="space-y-6">
          <section>
            <h2 className={sectionLabel}>Informations personnelles</h2>
            <div className={`${cardBase} p-5`}>
              <InfoRow label="Âge" value={`${a.age} ans`} icon="calendar" />
              <InfoRow label="Genre" value={a.gender === "M" ? "Masculin" : a.gender === "F" ? "Féminin" : "Autre"} icon="user" />
              <InfoRow label="Ville" value={a.city} icon="mapPin" />
              <InfoRow label="Région" value={a.region} icon="map" />
              <InfoRow label="École" value={a.schoolName} icon="building" />
              <InfoRow label="Graduation" value={a.graduationYear} icon="gradCap" />
            </div>
          </section>

          <section>
            <h2 className={sectionLabel}>Mesures physiques</h2>
            <div className={`${cardBase} overflow-hidden`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 divide-x divide-y divide-[#2D3748]/40">
                {[
                  { label: "Taille", value: a.heightDisplay },
                  { label: "Poids", value: a.weightDisplay },
                  { label: "Envergure", value: a.wingspan },
                  { label: "Main", value: a.handSize },
                  { label: "Main dom.", value: a.dominantHand },
                  { label: "Pied dom.", value: a.dominantFoot },
                ].filter(m => m.value).map((m) => (
                  <div key={m.label} className="p-4 text-center">
                    <p className="text-[22px] font-head font-black text-white leading-none">{m.value}</p>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Media */}
          {(a.highlightVideoUrl || a.hudlUrl || a.youtubeUrl) && (
            <section>
              <h2 className={sectionLabel}>Médias &amp; liens</h2>
              <div className={`${cardBase} p-5`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { url: a.highlightVideoUrl, label: "Faits saillants", color: "#E63946" },
                    { url: a.hudlUrl, label: "Hudl", color: "#F59E0B" },
                    { url: a.youtubeUrl, label: "YouTube", color: "#EF4444" },
                    { url: a.instagramUrl, label: "Instagram", color: "#E63946" },
                    { url: a.fullGameUrl, label: "Match complet", color: "#6B7280" },
                    { url: a.practiceVideoUrl, label: "Entraînement", color: "#6B7280" },
                  ].filter(m => m.url).map((m) => (
                    <a key={m.label} href={m.url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-[#111317] border border-white/5 hover:border-[#E63946]/30 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      <span className="text-[13px] text-[#9CA3AF]">{m.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Invite Modal ──────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">Inviter {a.firstName} {a.lastName}</h3>
            <p className="text-[13px] text-[#9CA3AF] mt-2">L&apos;athlète pourra voir son profil et proposer des modifications.</p>
            <div className="mt-4">
              <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1.5">Courriel de l&apos;athlète</label>
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="athlete@ecole.qc.ca" className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none" />
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button type="button" onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
              <button type="button" onClick={() => { setShowInviteModal(false); setInviteEmail(""); showToast("Invitation envoyée (POC)"); }} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors">Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
