"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { loadAthleteRaw, mapToRecruiterView } from "../_data/loadAthleteFromSupabase";
import type { AthleteProfileRecruiterView, AthleteTraitRatings } from "@/lib/types/models";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import NxIcon from "@/components/ui/NxIcon";
import StarRating from "@/components/ui/StarRating";
import { createClient } from "@/lib/supabase/client";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import { parseDistinctions, type DistinctionEntry } from "@/lib/config/badges";
import VideoEmbed from "@/components/ui/VideoEmbed";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import { isValidationExpired } from "@/lib/utils/profileValidation";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";

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

const TRAIT_GROUPS: { title: string; traits: { key: keyof AthleteTraitRatings; label: string }[] }[] = [
  { title: "Capacités athlétiques", traits: [
    { key: "speed",     label: "Vitesse / Explosivité" },
    { key: "power",     label: "Force / Puissance" },
    { key: "endurance", label: "Endurance / Cardio" },
    { key: "agility",   label: "Agilité / Coordination" },
  ]},
  { title: "Intelligence sportive", traits: [
    { key: "gameVision", label: "Vision du jeu" },
    { key: "tactics",    label: "Sens tactique" },
  ]},
  { title: "Caractère", traits: [
    { key: "leadership",      label: "Leadership" },
    { key: "discipline",      label: "Discipline / Éthique de travail" },
    { key: "coachability",    label: "Coachabilité" },
    { key: "gameIQ",          label: "Intelligence de jeu" },
    { key: "competitiveness", label: "Compétitivité" },
    { key: "teamwork",        label: "Esprit d'équipe" },
    { key: "resilience",      label: "Résilience" },
    { key: "attitude",        label: "Attitude / Mentalité" },
  ]},
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

/** Calculate profile completion from raw Supabase data */

function CompletenessBar({ percent }: { percent: number }) {
  const color = percent >= 90 ? "#3B82F6" : percent >= 60 ? "#22C55E" : percent >= 40 ? "#EAB308" : "#EF4444";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-[#2D3748] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <span className="text-[13px] font-bold" style={{ color }}>{percent}%</span>
    </div>
  );
}

function VerifiedBadge({ isVerified, onClick }: { isVerified: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-full border transition-colors ${
        isVerified
          ? "border-[#3B82F6]/30 text-[#3B82F6] bg-[#3B82F6]/10"
          : "border-[#6B7280]/30 text-[#6B7280] bg-[#6B7280]/10 hover:border-[#3B82F6]/50 hover:text-[#3B82F6] cursor-pointer"
      }`}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isVerified ? "#3B82F6" : "#6B7280" }} />
      {isVerified ? "Vérifié" : "Non vérifié"}
    </button>
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
  const secPosAbbr = a.secondaryPosition ? positionAbbr(a.secondaryPosition) : "";
  const posDisplay = secPosAbbr ? `${posAbbr} / ${secPosAbbr}` : (posAbbr || "—");
  const sportKey = SPORT_NAME_MAP[a.primarySport];
  const sportDisplay = sportKey ? (SPORT_DISPLAY[sportKey] || a.primarySport) : a.primarySport;

  return (
    <div className="nx-v30-wrap relative" style={{ width: 300, paddingTop: 6, paddingBottom: 10 }}>
      <div className="nx-v30-badge absolute z-30" style={{ top: 10, right: -12 }} title={a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null }) ? "Profil vérifié" : a.isVerified ? "Badge désactivé — confirmation requise" : "Profil non vérifié"}>
        <div className="rounded-full" style={{ border: '3px solid #111317' }}>
          {a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null }) ? (
            <svg width="48" height="48" viewBox="0 0 54 54" fill="none">
              <defs>
                <radialGradient id="cc_bg" cx="38%" cy="28%" r="68%"><stop offset="0%" stopColor="#29AAFF" /><stop offset="55%" stopColor="#0094F0" /><stop offset="100%" stopColor="#0060C0" /></radialGradient>
              </defs>
              <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35" />
              <circle cx="27" cy="27" r="24" fill="url(#cc_bg)" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 54 54" fill="none">
              <circle cx="27" cy="27" r="26" fill="#4B5563" opacity="0.35" />
              <circle cx="27" cy="27" r="24" fill="#6B7280" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </div>
      </div>

      <div className="nx-v30-card relative overflow-visible" style={{ width: 300, borderRadius: 10 }}>
        <div className="relative overflow-hidden" style={{ width: 300, height: 420, borderRadius: 10, background: '#2F3440' }}>
          <AthletePhotoFill
            photoUrl={a.photoUrl}
            firstName={a.firstName}
            lastName={a.lastName}
          />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }} />
          <div className="absolute bottom-4 left-4 z-[3]">
            <p style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 28, color: '#fff', letterSpacing: '0.04em', lineHeight: 1 }}>{a.firstName}</p>
            <p style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 28, color: '#fff', letterSpacing: '0.04em', lineHeight: 1 }}>{a.lastName}</p>
          </div>
        </div>

        {/* Ticket */}
        <div className="nx-v30-ticket absolute z-[999] overflow-hidden" style={{ bottom: -14, right: -22, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <div className="flex" style={{ width: 322 }}>
            <div className="flex flex-col justify-between" style={{ background: '#1E2128', padding: '12px 14px 12px 16px', minWidth: 96, gap: 4 }}>
              {[
                { lbl: "Sport", val: sportDisplay },
                { lbl: "Pos", val: posDisplay },
                { lbl: "No.", val: a.jerseyNumber ? `#${a.jerseyNumber}` : "—" },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)', marginBottom: 1 }}>{r.lbl}</div>
                  <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 16, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>{r.val}</div>
                </div>
              ))}
            </div>
            <div className="nx-v30-perf flex flex-col items-center justify-center" style={{ width: 12, background: '#E6E6E6', borderLeft: '1.5px dashed rgba(11,18,32,0.2)', borderRight: '1.5px dashed rgba(11,18,32,0.2)', gap: 3 }}>
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(11,18,32,0.2)' }} />
              ))}
            </div>
            <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '12px 16px' }}>
              <div className="relative overflow-hidden" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginBottom: 6 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <svg key={i} width="28" height="28" viewBox="0 0 24 24" fill={ratingValue >= i + 1 ? "#F59E0B" : ratingValue >= i + 0.5 ? "#F59E0B" : "#D1D5DB"} stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
                <div className="card-star-shimmer absolute inset-0 pointer-events-none" />
              </div>
              <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#1E2128', marginBottom: 2, lineHeight: 1.2 }}>{a.isCivil ? (a.teamName || a.leagueName || "") : a.schoolName}</div>
              <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#9CA3AF', lineHeight: 1.2 }}>{a.region}</div>
              <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#E63946', marginTop: 4 }}>Promotion {a.graduationYear}</div>
            </div>
            <div className="flex items-center justify-center flex-shrink-0" style={{ background: '#E63946', width: 24, writingMode: 'vertical-rl' as const, fontFamily: 'var(--font-heading), sans-serif', fontSize: 10, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.7)' }}>NEXUS</div>
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
  const router = useRouter();
  const id = params.id as string;

  const [a, setA] = useState<AthleteProfileRecruiterView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await loadAthleteRaw(id);
      if (error) {
        console.error("Supabase query error:", error);
        setLoading(false);
        return;
      }
      if (!data) {
        console.error("No data returned for athlete:", id);
        setLoading(false);
        return;
      }
      const raw = data as Record<string, unknown>;

      const mapped = mapToRecruiterView(raw);
      setA(mapped);
      setAthleteHasAccount(!!raw.user_id);
      setAthleteEmail((raw.email as string | null) ?? null);
      setLoading(false);

      // Load pipeline data (how many recruiters are interested)
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: pipeRows } = await supabase
        .from("pipeline")
        .select("status, updated_at")
        .eq("athlete_id", id);
      if (pipeRows && pipeRows.length > 0) {
        const counts: Record<string, number> = {};
        let maxAt = "";
        pipeRows.forEach((r: { status: string; updated_at: string }) => {
          counts[r.status] = (counts[r.status] || 0) + 1;
          if (r.updated_at && r.updated_at > maxAt) maxAt = r.updated_at;
        });
        setPipelineData(Object.entries(counts).map(([status, count]) => ({ status, count })));
        setPipelineMaxAt(maxAt);
      }
      // Store coach override from raw athlete data
      const overrideVal = raw.statut_recrutement_override as string | null;
      const overrideAt = raw.recrutement_override_at as string | null;
      if (overrideVal && overrideAt) {
        setRecruitOverride({ value: overrideVal, at: overrideAt });
      }

      // Load full evaluation from evaluations table
      const { data: evalRow } = await supabase
        .from("evaluations")
        .select("*")
        .eq("athlete_id", id)
        .limit(1)
        .maybeSingle();
      if (evalRow?.distinctions) {
        let d = evalRow.distinctions;
        if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = []; } }
        const parsed = parseDistinctions(d);
        setDbDistinctions(parsed);
      }

      // Engagement metrics
      const [{ count: vc }, { count: fc }] = await Promise.all([
        supabase.from("recruiter_athlete_views").select("*", { count: "exact", head: true }).eq("athlete_id", id),
        supabase.from("recruiter_favorites").select("*", { count: "exact", head: true }).eq("athlete_id", id),
      ]);

      const totalViews = vc || 0;
      setViewCount(totalViews);
      setFavoriteCount(fc || 0);

      // Global recruitment status
      setGlobalRecruitmentStatus((raw.recruitment_status as string) || "OUVERT");
      const committedSchoolRel = raw.committed_school;
      const cs = (Array.isArray(committedSchoolRel) ? committedSchoolRel[0] : committedSchoolRel) as { name?: string } | null;
      setCommittedSchoolName(cs?.name || "");
      setOpenToOffers((raw.open_to_offers as boolean | null) ?? null);
    };
    load();

    // Load pending suggestions
    const loadSuggestions = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("athlete_suggestions")
        .select("id, champ, valeur_actuelle, valeur_proposee, message, created_at")
        .eq("athlete_id", id)
        .eq("status", "EN_ATTENTE")
        .order("created_at", { ascending: false });
      if (data) setPendingSuggestions(data.map((s) => ({ ...s, valeur_actuelle: s.valeur_actuelle || "", valeur_proposee: s.valeur_proposee || "", message: s.message || "" })));
    };
    loadSuggestions();
  }, [id]);

  async function approveSuggestion(suggestionId: string) {
    const supabase = createClient();

    // First verify we can see the row
    const { data: check } = await supabase.from("athlete_suggestions").select("id, status").eq("id", suggestionId).single();

    if (!check) {
      console.error("[Approve] cannot find suggestion — RLS SELECT blocking");
      showToast("Erreur: suggestion introuvable");
      return;
    }

    // Use RPC or direct update without .select() to avoid double-RLS issue
    const { error } = await supabase
      .from("athlete_suggestions")
      .update({ status: "APPROUVEE" })
      .eq("id", suggestionId);

    if (error) {
      console.error("[Suggestion approve] error:", JSON.stringify(error));
      showToast("Erreur: " + (error.message || "Impossible d'approuver"));
      return;
    }

    // Verify it actually changed
    const { data: verify } = await supabase.from("athlete_suggestions").select("id, status, reviewed_at").eq("id", suggestionId).single();

    if (verify?.status !== "APPROUVEE") {
      console.error("[Approve] status not changed:", verify?.status);
      showToast("Erreur: la mise à jour n'a pas fonctionné");
      return;
    }

    setPendingSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    // Re-fetch athlete data so the profile updates with the approved value
    const { data: refreshed } = await loadAthleteRaw(id);
    if (refreshed) setA(mapToRecruiterView(refreshed as Record<string, unknown>));
    showToast("Suggestion approuvée — valeur mise à jour");
  }

  async function rejectSuggestion(suggestionId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("athlete_suggestions").update({ status: "REJETEE", raison_rejet: rejectReason || null }).eq("id", suggestionId);
    if (error) { console.error("[Suggestion reject]", error); return; }
    setPendingSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    setRejectingId(null);
    setRejectReason("");
    showToast("Suggestion rejetée");
  }

  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const [consentGiven, setConsentGiven] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [athleteHasAccount, setAthleteHasAccount] = useState(false);
  const [athleteEmail, setAthleteEmail] = useState<string | null>(null);
  const [claimLinkCopied, setClaimLinkCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";
  const [recruiterView, setRecruiterView] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [pipelineData, setPipelineData] = useState<{ status: string; count: number }[]>([]);
  const [pipelineMaxAt, setPipelineMaxAt] = useState("");
  const [recruitOverride, setRecruitOverride] = useState<{ value: string; at: string } | null>(null);
  const [dbDistinctions, setDbDistinctions] = useState<DistinctionEntry[]>([]);
  const [viewCount, setViewCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [globalRecruitmentStatus, setGlobalRecruitmentStatus] = useState<string>("OUVERT");
  const [committedSchoolName, setCommittedSchoolName] = useState("");
  const [openToOffers, setOpenToOffers] = useState<boolean | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<{ id: string; champ: string; valeur_actuelle: string; valeur_proposee: string; message: string; created_at: string }[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const isDetailed = mode === "detailed";
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  if (loading || !a) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#6B7280] text-sm">{loading ? "Chargement du profil..." : "Athlète introuvable"}</p>
      </div>
    );
  }

  // Trait calculations — only average non-zero (rated) traits
  const traitEntries = a.traitRatings ? Object.entries(a.traitRatings) as [keyof AthleteTraitRatings, number][] : [];
  const ratedTraits = traitEntries.filter(([, v]) => v > 0);
  const traitAvg = ratedTraits.length > 0 ? ratedTraits.reduce((s, [, v]) => s + v, 0) / ratedTraits.length : null;
  const coteGlobale = traitAvg ?? a.overallRating;

  // FIX 4 — age calculation
  const age = a.dateOfBirth ? Math.floor((new Date().getTime() - new Date(a.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;

  // Stat strip cells — taille + poids + distinction badges from DB
  const statCells: { top?: string; mid: string; sub?: string; iconName?: string; isBadge?: boolean; badgeChar?: string }[] = [
    { top: a.heightDisplay, mid: "Taille" },
    { top: a.weightDisplay, mid: "Poids" },
  ];

  return (
    <div className="px-5 md:px-8 lg:px-10 py-6 max-w-7xl mx-auto space-y-6">

      {/* ── Breadcrumb ────────────────────────────────────────── */}
      {isPreview ? (
        <div className="flex items-center gap-2 text-[12px] text-[#6b7280]">
          <Link href="/athlete/profil" className="hover:text-white transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Retour à mon profil
          </Link>
          <span>/</span>
          <span className="text-white font-semibold">{a.firstName} {a.lastName}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[12px] text-[#6b7280]">
          <Link href="/coach" className="hover:text-white transition-colors">Nexus</Link>
          <span>/</span>
          <Link href="/coach" className="hover:text-white transition-colors">Coach</Link>
          <span>/</span>
          <Link href="/coach/athletes" className="hover:text-white transition-colors">Mes Athlètes</Link>
          <span>/</span>
          <span className="text-white font-semibold">{a.firstName} {a.lastName}</span>
        </div>
      )}

      {/* ── Coach Action Bar ──────────────────────────────────── */}
      {!recruiterView && !isPreview && (
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
            {!athleteHasAccount && (
              <button type="button" onClick={() => consentGiven ? setShowInviteModal(true) : null}
                disabled={!consentGiven}
                title={!consentGiven ? "Confirme le consentement parental d'abord" : undefined}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  consentGiven ? "border-[#E63946] text-[#E63946] hover:bg-[#E63946]/10" : "border-[#2D3748] text-[#4a4d56] cursor-not-allowed"
                }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                Inviter l&apos;athlète
              </button>
            )}

            {/* Edit */}
            <Link href={`/coach/athletes/${id}/modifier`} className="flex items-center gap-2 px-4 py-2 border border-[#E63946] text-[#E63946] rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Modifier
            </Link>

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

      {/* Phase 2 athlete claim: orphan profile not yet claimed by an
          athlete signup. Coach copies the prefill link and shares it
          via their own channels (email, SMS, in-person). The athlete
          lands on /auth?email=…, signs up, and the wizard's claim
          modal links the orphan row at submit. Hidden once
          athletes.user_id is populated. */}
      {!recruiterView && !isPreview && !athleteHasAccount && athleteEmail && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="text-[13px] font-bold text-[#F59E0B]">Compte non réclamé</p>
              <p className="text-[12px] text-[#FCD34D] mt-1 leading-snug">
                {a.firstName ?? "L'athlète"} n&apos;a pas encore activé son compte. Envoie-lui le lien d&apos;inscription par tes propres canaux — la réclamation pré-remplit son wizard avec les infos déjà saisies.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!athleteEmail) return;
              const link = `${window.location.origin}/auth?email=${encodeURIComponent(athleteEmail)}`;
              navigator.clipboard.writeText(link).then(() => {
                setClaimLinkCopied(true);
                setTimeout(() => setClaimLinkCopied(false), 2500);
              }).catch((err) => {
                console.error("[Claim link copy] clipboard error:", err);
                showToast("Erreur copie. Copie l'URL manuellement.");
              });
            }}
            className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-black font-bold text-[12px] uppercase tracking-wider transition-colors whitespace-nowrap"
          >
            {claimLinkCopied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                Lien copié
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                Copier le lien
              </>
            )}
          </button>
        </div>
      )}

      {/* Recruiter view banner */}
      {recruiterView && (
        <div className="bg-[#3B82F6]/8 border border-[#3B82F6]/20 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#3B82F6]">Mode aperçu recruteur — c&apos;est ce que les recruteurs voient</span>
          <button type="button" onClick={() => setRecruiterView(false)} className="px-4 py-2 bg-[#3B82F6] text-white text-[12px] font-bold rounded-lg hover:bg-[#2563EB] transition-colors">Retour coach</button>
        </div>
      )}

      {/* Unverified warning banner */}
      {!recruiterView && !isPreview && !a.isVerified && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-[13px] font-bold text-[#F59E0B]">Profil non vérifié</p>
              <p className="text-[12px] text-[#9CA3AF]">Ce profil n&apos;est pas visible par les recruteurs tant qu&apos;il n&apos;est pas vérifié.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowVerifyModal(true)}
            className="shrink-0 px-5 py-2.5 rounded-lg bg-[#3B82F6] text-white font-bold text-[12px] uppercase tracking-[0.1em] hover:bg-[#2563EB] transition-colors cursor-pointer"
          >
            Vérifier maintenant
          </button>
        </div>
      )}

      {/* ── Pending Suggestions ──────────────────────────────── */}
      {!recruiterView && !isPreview && pendingSuggestions.length > 0 && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#EAB308]/20 p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#EAB308]">
              {pendingSuggestions.length} suggestion{pendingSuggestions.length > 1 ? "s" : ""} en attente
            </h3>
          </div>
          <div className="space-y-3">
            {pendingSuggestions.map((s) => {
              const diffMs = Date.now() - new Date(s.created_at).getTime();
              const diffMin = Math.floor(diffMs / 60000);
              const relTime = diffMin < 60 ? `Il y a ${diffMin} min` : diffMin < 1440 ? `Il y a ${Math.floor(diffMin / 60)}h` : `Il y a ${Math.floor(diffMin / 1440)}j`;

              return (
                <div key={s.id} className="bg-[#13151a] rounded-lg border border-[#EAB308]/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white">{s.champ}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {s.valeur_actuelle && <span className="text-[12px] text-[#6b7280] line-through">{s.valeur_actuelle}</span>}
                        <span className="text-[12px] text-[#6b7280]">→</span>
                        <span className="text-[13px] font-bold text-[#EAB308]">{s.valeur_proposee}</span>
                      </div>
                      {s.message && <p className="text-[11px] text-[#6b7280] italic mt-1">&ldquo;{s.message}&rdquo;</p>}
                      <p className="text-[10px] text-[#4a4d56] mt-1">{relTime}</p>
                    </div>
                    {rejectingId === s.id ? (
                      <div className="flex flex-col gap-2 shrink-0">
                        <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Raison (optionnel)" className="bg-[#111317] border border-[#2D3748] rounded px-2 py-1 text-[11px] text-white w-40 focus:border-[#E63946] outline-none" />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => rejectSuggestion(s.id)} className="px-3 py-1 bg-[#E63946] text-white text-[10px] font-bold rounded hover:bg-[#D42B22] transition-colors">Confirmer</button>
                          <button type="button" onClick={() => { setRejectingId(null); setRejectReason(""); }} className="text-[10px] text-[#6b7280] hover:text-white transition-colors">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => approveSuggestion(s.id)} className="px-3 py-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors">
                          Approuver
                        </button>
                        <button type="button" onClick={() => setRejectingId(s.id)} className="px-3 py-1.5 border border-[#E63946]/30 text-[#E63946] text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#E63946]/10 transition-colors">
                          Rejeter
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
      <section className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch">
        <div className="shrink-0 flex justify-center lg:justify-start">
          <PlayerCard a={a} />
        </div>

        <div className="flex-1 min-w-0 lg:pt-2 space-y-5">
          <h1 className="font-head text-[36px] sm:text-[46px] font-black text-white uppercase tracking-tight leading-[0.92]">
            {a.firstName}<br />{a.lastName}
            {a.jerseyNumber && <span className="text-[#E63946] ml-3">#{a.jerseyNumber}</span>}
          </h1>

          {/* Engagement metrics + global status */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-[#111317] rounded-lg px-4 py-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              <span className="text-[16px] font-bold text-white">{viewCount}</span>
              <span className="text-[11px] text-[#6b7280]">{viewCount === 1 ? "vue totale" : "vues totales"}</span>
            </div>
            <div className="bg-[#111317] rounded-lg px-4 py-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#E63946" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
              <span className="text-[16px] font-bold text-white">{favoriteCount}</span>
              <span className="text-[11px] text-[#6b7280]">favoris</span>
            </div>
            <div className="bg-[#111317] rounded-lg px-4 py-2">
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1">Statut recrutement</span>
              <RecruitmentStatusBadge
                status={globalRecruitmentStatus as GlobalRecruitmentStatus}
                committedSchoolName={committedSchoolName || undefined}
                size="sm"
              />
            </div>
            {globalRecruitmentStatus === "RECRUTE" && openToOffers !== null && (
              <div className="bg-[#111317] rounded-lg px-4 py-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${openToOffers ? "bg-[#22C55E]" : "bg-[#6B7280]"}`} />
                <span className={`text-[13px] font-bold ${openToOffers ? "text-[#22C55E]" : "text-[#6B7280]"}`}>
                  {openToOffers ? "Ouvert aux offres" : "Fermé aux offres"}
                </span>
              </div>
            )}

          </div>

          {/* Profil Athlète */}
          <div>
            <h3 className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mb-6">Profil athlète</h3>

            <div className="flex items-center gap-12 mb-8">
              {a.heightDisplay && (
                <div className="text-center">
                  <p className="text-[40px] font-head font-[800] text-white leading-none">{a.heightDisplay}</p>
                  <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mt-1.5">Taille</p>
                </div>
              )}
              {a.heightDisplay && a.weightDisplay && (
                <div className="w-px h-12 bg-[#555]" />
              )}
              {a.weightDisplay && (
                <div className="text-center">
                  <p className="text-[40px] font-head font-[800] text-white leading-none">
                    {a.weightDisplay.replace(" lbs", "")}<span className="text-[20px] font-semibold text-[#555]"> lbs</span>
                  </p>
                  <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mt-1.5">Poids</p>
                </div>
              )}
            </div>

            {dbDistinctions.length > 0 && (
              <div className="flex items-start gap-9 flex-wrap">
                {dbDistinctions.map((d, i) => (
                  <DistinctionBadge key={`${d.badge}-${i}`} badge={d.badge} detail={d.detail} size="lg" />
                ))}
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ══════════ COACH REPORT ══════════ */}
      {(a.coachReport || coteGlobale >= 0) && (
        <section>
          <h2 className={sectionLabel}>Rapport de l&apos;entraîneur</h2>
          <div className={`relative ${cardBase} p-6 sm:p-8 pl-8 sm:pl-10 overflow-hidden`}>
            {a.coachReport && (
              <>
                <span className="absolute top-3 left-3 text-[60px] font-serif text-[#E63946]/10 leading-none select-none">&ldquo;</span>
                <div className="relative">
                  <p className="text-[18px] sm:text-[20px] text-white italic leading-relaxed pl-5" style={{ borderLeft: "3px solid #E63946" }}>
                    &ldquo;{a.coachReport}&rdquo;
                  </p>
                  <p className="text-[14px] font-bold text-[#9CA3AF] mt-4 pl-5">-- {a.coachName}{a.coachSchool ? `, ${a.coachSchool}` : ""}</p>
                </div>
              </>
            )}
            <div className={a.coachReport ? "mt-3" : ""}>

              {!isDetailed && (
                <div className="mt-3 pl-5 flex items-center gap-3">
                  <StarRating rating={coteGlobale} size="md" showNumber={false} />
                  <span className="text-[18px] font-head font-black text-white">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
                  <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote Globale</span>
                </div>
              )}

              {isDetailed && (
                <div className="mt-5 pl-5">
                  {/* (1) Cote globale prominent — matches modifier card */}
                  <div className="bg-[#13151a] border border-[#2a2d36] rounded-xl p-4 flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">Cote globale (moyenne auto)</p>
                      <p className="text-[28px] font-head font-black text-[#F59E0B] leading-none mt-1">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6b7280] font-normal ml-1">/ 5</span></p>
                    </div>
                    <StarRating rating={coteGlobale} size="md" showNumber={false} />
                  </div>

                  {/* (2-4) Capacités athlétiques / Intelligence sportive / Caractère */}
                  <div className="space-y-4">
                    {TRAIT_GROUPS.map((group) => (
                      <div key={group.title} className="bg-[#13151a] border border-[#2a2d36] rounded-xl p-5">
                        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">{group.title}</p>
                        <div className="space-y-1">
                          {group.traits.map((trait) => {
                            const val = a.traitRatings ? a.traitRatings[trait.key] : 0;
                            return (
                              <div key={trait.key} className="flex items-center justify-between py-2 px-2 rounded-lg">
                                <span className="text-[13px] text-[#c8c8cc]">{trait.label}</span>
                                <div className="flex items-center gap-2">
                                  <StarRating rating={val} size="sm" />
                                  <span className="text-[12px] font-bold text-[#6b7280] w-10 text-right">{val}/5</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {dbDistinctions.length > 0 && (
                    <div className="border-t border-[#2D3748]/50 pt-4 mt-4">
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">Distinctions</p>
                      <div className="flex flex-wrap gap-3">
                        {dbDistinctions.map((d, i) => (
                          <DistinctionBadge key={`${d.badge}-${i}`} badge={d.badge} detail={d.detail} size="sm" />
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

      {/* ══════════ FAITS SAILLANTS (VIDEO) ══════════ */}
      <section>
        <h2 className={sectionLabel}>Faits saillants</h2>
        {a.highlightVideoUrl || a.fullGameUrl ? (
          <div className="flex flex-col gap-4">
            {a.highlightVideoUrl && (
              <VideoEmbed url={a.highlightVideoUrl} title="Faits saillants" />
            )}
            {a.fullGameUrl && (
              <div>
                <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mb-3">Match complet</p>
                <VideoEmbed url={a.fullGameUrl} title="Match complet" />
              </div>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-[#555]">Aucune vidéo ajoutée</p>
        )}
      </section>

      {/* ══════════ ACADEMIC PROFILE ══════════ */}
      <section>
        <h2 className={sectionLabel}>Profil académique</h2>
        <div className={`${cardBase} overflow-hidden`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#2D3748]/50">
            <div className="p-5 text-center">
              <p className="text-[28px] font-head font-black text-white leading-none">{a.gpa ? `${a.gpa}%` : "—"}</p>
              <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Moyenne générale</p>
            </div>
            <div className="p-5 text-center">
              {(() => {
                let display = "—";
                // Try a.program first (string)
                if (a.program && typeof a.program === "string" && a.program.length > 0) {
                  display = a.program;
                } else {
                  // Try a.targetCegepProgram (may be array or JSON string)
                  let arr = a.targetCegepProgram;
                  if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { arr = []; } }
                  if (Array.isArray(arr) && arr.length > 0) display = arr.join(", ");
                }
                return <p className="text-[18px] font-bold text-white leading-none mt-1">{display}</p>;
              })()}
              <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Programme visé</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-[18px] font-bold text-white leading-none mt-1">Juin {a.graduationYear}</p>
              <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Graduation</p>
            </div>
          </div>
          <div className="border-t border-[#2D3748]/50 px-5 py-3.5 flex flex-wrap gap-2">
            <PreferencePill active={a.openToRelocate} label="Ouvert à déménager" />
            <PreferencePill active={a.openToPrivate} label="Ouvert au privé" />
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
              <InfoRow label="Âge" value={age > 0 ? `${age} ans` : "—"} icon="calendar" />
              <InfoRow label="Genre" value={a.gender === "M" ? "Masculin" : a.gender === "F" ? "Féminin" : "Autre"} icon="user" />
              <InfoRow label="Ville" value={a.city} icon="mapPin" />
              <InfoRow label="Région" value={a.region} icon="map" />
              <InfoRow label={a.isCivil ? "Équipe civile" : "École"} value={a.isCivil ? (a.teamName || a.leagueName || "—") : (a.schoolName || "—")} icon="building" />
              <InfoRow label="Graduation" value={a.graduationYear} icon="gradCap" />
            </div>
          </section>

          {/* ── MESURES PHYSIQUES (expanded) ── */}
          <section>
            <h2 className={sectionLabel}>Mesures physiques</h2>
            <div className={`${cardBase} overflow-hidden`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-[#2D3748]/40">
                {[
                  { label: "Taille", value: a.heightDisplay || "—" },
                  { label: "Poids", value: a.weightDisplay || "—" },
                  { label: "Envergure", value: a.wingspan || "—" },
                  { label: "Taille mains", value: a.handSize || "—" },
                  { label: "Main dom.", value: a.dominantHand || "—" },
                  { label: "Pied dom.", value: a.dominantFoot || "—" },
                ].map((m) => (
                  <div key={m.label} className="p-4 text-center">
                    <p className={`text-[20px] font-head font-black leading-none ${m.value === "—" ? "text-[#4a4d56]" : "text-white"}`}>{m.value}</p>
                    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── TESTS ATHLÉTIQUES ── */}
          {(() => {
            const tests = [
              { label: "40 verges", value: a.fortyYard },
              { label: "Saut vertical", value: a.verticalJump },
              { label: "Saut en longueur", value: a.broadJump },
              { label: "Développé couché", value: a.benchPress },
              { label: "Navette agilité", value: a.shuttleAgility },
              { label: "Sprint 100m", value: a.sprint100m },
            ];
            const hasAny = tests.some((t) => t.value);
            if (!hasAny) return null;
            return (
              <section>
                <h2 className={sectionLabel}>Tests athlétiques</h2>
                <div className={`${cardBase} overflow-hidden`}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-[#2D3748]/40">
                    {tests.map((t) => (
                      <div key={t.label} className="p-4 text-center">
                        <p className={`text-[20px] font-head font-black leading-none ${t.value ? "text-white" : "text-[#4a4d56]"}`}>{t.value || "—"}</p>
                        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">{t.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })()}

          {/* ── INFORMATIONS SPORTIVES DÉTAILLÉES ── */}
          {a.primarySport && (
            <section>
              <h2 className={sectionLabel}>Informations sportives</h2>
              <div className={`${cardBase} p-5`}>
                <InfoRow label="Sport principal" value={a.primarySport} icon="activity" />
                <InfoRow label="Position" value={a.primaryPosition} icon="target" />
                <InfoRow label="Numéro" value={a.jerseyNumber ? `#${a.jerseyNumber}` : undefined} icon="hash" />
                {a.secondarySport && <InfoRow label="Sport secondaire" value={a.secondarySport} icon="activity" />}
                {a.secondaryPosition && <InfoRow label="Position secondaire" value={a.secondaryPosition} icon="target" />}
                {a.teamName && <InfoRow label="Équipe" value={a.teamName} icon="flag" />}
                {a.leagueName && <InfoRow label="Ligue" value={a.leagueName} icon="trophy" />}
                {a.teamLevel && <InfoRow label="Niveau" value={a.teamLevel} icon="layers" />}
              </div>
            </section>
          )}

          {/* ── DÉTAILS ACADÉMIQUES (matières, mentions, régions) ── */}
          {(a.strongSubjects?.length > 0 || a.academicHonors?.length > 0 || a.preferredRegions?.length > 0 || (Array.isArray(a.targetCegepProgram) && a.targetCegepProgram.length > 0)) && (
            <section>
              <h2 className={sectionLabel}>Détails académiques</h2>
              <div className={`${cardBase} p-5 space-y-4`}>
                {(() => {
                  let prog = a.targetCegepProgram;
                  if (typeof prog === "string") { try { prog = JSON.parse(prog as unknown as string); } catch { prog = []; } }
                  if (Array.isArray(prog) && prog.length > 0) {
                    return (
                      <div>
                        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Programme CÉGEP visé</p>
                        <div className="flex flex-wrap gap-2">
                          {prog.map((p: string) => (
                            <span key={p} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">{p}</span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                {a.strongSubjects?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Matières fortes</p>
                    <div className="flex flex-wrap gap-2">
                      {a.strongSubjects.map((s) => (
                        <span key={s} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white/5 text-white border border-[#2D3748]">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {a.academicHonors?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Mentions académiques</p>
                    <div className="flex flex-wrap gap-2">
                      {a.academicHonors.map((h) => (
                        <span key={h} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">{h}</span>
                      ))}
                    </div>
                  </div>
                )}
                {a.preferredRegions?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Régions CÉGEP préférées</p>
                    <div className="flex flex-wrap gap-2">
                      {a.preferredRegions.map((r) => (
                        <span key={r} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white/5 text-[#c8c8cc] border border-[#2D3748]">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

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

          {/* ── RÉPUTATION DU COACH ── */}
          {a.coachName && (
            <section>
              <h2 className={sectionLabel}>Réputation du coach</h2>
              <div className={`${cardBase} p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[14px] text-[#9CA3AF]">{a.coachName}</p>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#6B7280]/15 text-[#6B7280] border border-[#6B7280]/30">
                    À venir
                  </span>
                </div>
                <p className="text-[13px] text-[#4a4d56] italic">
                  La réputation du coach sera calculée automatiquement lorsque les recruteurs commenceront à évaluer les coachs sur la plateforme.
                </p>
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

      {/* Verification modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-head text-[16px] font-bold text-white mb-2">Vérifier cet athlète ?</h3>
            <p className="text-[13px] text-[#9CA3AF] mb-5">
              En vérifiant ce profil, tu confirmes que les informations sont exactes. Le profil recevra le badge vérifié visible par les recruteurs.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;

                  const nowIso = new Date().toISOString();
                  const { error } = await supabase
                    .from("athletes")
                    .update({
                      verified: true,
                      verification_method: "manuel_coach",
                      verified_at: nowIso,
                      verified_by: user.id,
                      last_profile_validation: nowIso,
                    })
                    .eq("id", id);

                  if (error) {
                    alert("Erreur lors de la vérification: " + error.message);
                    return;
                  }

                  setA((prev) => prev ? { ...prev, isVerified: true, lastValidation: nowIso } : prev);
                  setShowVerifyModal(false);
                  showToast("Profil vérifié avec succès ✓");
                }}
                className="flex-1 bg-[#3B82F6] text-white font-bold text-[13px] py-2.5 rounded-lg hover:bg-[#2563EB] transition-colors cursor-pointer"
              >
                Vérifier
              </button>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="flex-1 border border-[#2D3748] text-[#9CA3AF] font-bold text-[13px] py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
