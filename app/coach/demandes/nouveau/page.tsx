"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ROSTER_ATHLETES, type RosterAthlete } from "../../athletes/_data/mockRosterData";
import { ALL_PROFILES, type AthleteProfile } from "../../athletes/_data/mockAthleteProfiles";
import { MOCK_THREADS } from "../_data/mockThreadsData";
import type { RecruiterProfile } from "../_data/mockThreadsData";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";

/* ═══════════════════════════════════════════════════════════════
   Nouveau Message — Compose Page (Coach)
   Select an athlete, then a recruiter, write a message.
═══════════════════════════════════════════════════════════════ */

const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_NAME_MAP).map(([display, key]) => [key, display])
);

const COACH_PROFILE = {
  firstName: "Michel",
  lastName: "Bergeron",
  school: "É.S. Saint-Jean-Eudes",
  sport: "Football",
};

/** Only verified athletes can be messaged about */
const AVAILABLE_ATHLETES = ROSTER_ATHLETES.filter((a) => a.isVerified);

/** All known recruiters from existing threads */
const KNOWN_RECRUITERS: RecruiterProfile[] = (() => {
  const seen = new Set<string>();
  const list: RecruiterProfile[] = [];
  for (const t of MOCK_THREADS) {
    if (!seen.has(t.recruiter.id)) {
      seen.add(t.recruiter.id);
      list.push(t.recruiter);
    }
  }
  return list;
})();

function generateTemplate(athlete: RosterAthlete, recruiter: RecruiterProfile): string {
  return `Bonjour ${recruiter.firstName} ${recruiter.lastName},

Je suis Coach ${COACH_PROFILE.firstName} ${COACH_PROFILE.lastName} de ${COACH_PROFILE.school}.

Je souhaitais vous écrire au sujet de ${athlete.firstName} ${athlete.lastName} (${athlete.position}), un athlète de notre programme que je crois pourrait intéresser votre équipe${recruiter.cegepTeamName ? ` les ${recruiter.cegepTeamName}` : ""}.

[Votre message personnalisé ici]

Cordialement,
Coach ${COACH_PROFILE.firstName} ${COACH_PROFILE.lastName}
${COACH_PROFILE.school}`;
}

/* ── Mini Player Card (V30-inspired) ─────────────────────────── */

function MiniPlayerCard({ a }: { a: AthleteProfile }) {
  const stars = Math.round(a.stars);
  const posAbbr = a.position.length > 4 ? a.position.slice(0, 3).toUpperCase() : a.position.toUpperCase();
  const sportDisplay = SPORT_DISPLAY[a.sport] || a.sport;

  return (
    <div className="relative" style={{ width: 220, paddingBottom: 8 }}>
      {a.profilePercent >= 50 && (
        <div className="absolute z-30" style={{ top: 6, right: -10 }}>
          <div className="rounded-full" style={{ border: "2px solid #1A1D24" }}>
            <svg width="32" height="32" viewBox="0 0 54 54" fill="none">
              <defs>
                <radialGradient id="cc_bg" cx="38%" cy="28%" r="68%">
                  <stop offset="0%" stopColor="#29AAFF" />
                  <stop offset="55%" stopColor="#0094F0" />
                  <stop offset="100%" stopColor="#0060C0" />
                </radialGradient>
              </defs>
              <circle cx="27" cy="27" r="24" fill="url(#cc_bg)" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
      )}

      <div className="relative overflow-visible" style={{ width: 220, borderRadius: 8 }}>
        <div className="relative overflow-hidden" style={{ width: 220, height: 270, borderRadius: 8, background: "#2F3440" }}>
          {a.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.photo} alt={`${a.firstName} ${a.lastName}`} className="absolute inset-0 w-full h-full object-cover z-[1]" />
          ) : (
            <div className="absolute inset-0 z-[1] flex items-center justify-center">
              <span style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 72, color: "rgba(255,255,255,0.06)", letterSpacing: "0.05em", lineHeight: 1 }}>
                {a.firstName[0]}{a.lastName[0]}
              </span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: "linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)" }} />
          <div className="absolute bottom-3 left-3 z-[3]">
            <p style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 20, color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>
              {a.firstName}
            </p>
            <p style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 20, color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>
              {a.lastName}
            </p>
          </div>
        </div>

        <div className="absolute z-[999] overflow-hidden" style={{ bottom: -8, right: -14, borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex" style={{ width: 234 }}>
            <div className="flex flex-col justify-between" style={{ background: "#1E2128", padding: "6px 8px 6px 10px", minWidth: 64, gap: 2 }}>
              {[
                { lbl: "Sport", val: sportDisplay },
                { lbl: "Pos", val: posAbbr },
                { lbl: "No.", val: a.jerseyNumber ? `#${a.jerseyNumber}` : "—" },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: "var(--font-barlow-cond), sans-serif", fontSize: 5, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.38)", marginBottom: 1 }}>
                    {r.lbl}
                  </div>
                  <div style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 12, color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>
                    {r.val}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center" style={{ width: 8, background: "#E6E6E6", borderLeft: "1px dashed rgba(11,18,32,0.2)", borderRight: "1px dashed rgba(11,18,32,0.2)", gap: 2 }}>
              {[...Array(5)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(11,18,32,0.2)" }} />
              ))}
            </div>
            <div className="flex-1 flex flex-col justify-center" style={{ background: "#FFFFFF", padding: "6px 10px" }}>
              <div style={{ display: "inline-flex", background: "#1E2128", borderRadius: 3, padding: "2px 5px", marginBottom: 3 }}>
                <svg width="75" height="12" viewBox="0 0 75 12" fill="none" style={{ display: "block" }}>
                  {[0, 15, 30, 45, 60].map((x, i) => (
                    <path key={x} d="M6,0L7.3,4.3L12,4.3L8.4,7L9.7,11.3L6,8.7L2.3,11.3L3.6,7L0,4.3L4.7,4.3Z"
                      fill={i < stars ? "#F5C518" : "#3D4452"} transform={`translate(${x},0)`} />
                  ))}
                </svg>
              </div>
              <div style={{ fontFamily: "var(--font-barlow-cond), sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#1E2128" }}>
                {a.school}
              </div>
              <div style={{ fontFamily: "var(--font-barlow-cond), sans-serif", fontWeight: 700, fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#E63946", marginTop: 1 }}>
                Promotion {a.graduationYear}
              </div>
            </div>
            <div className="flex items-center justify-center flex-shrink-0" style={{ background: "#E63946", width: 16, writingMode: "vertical-rl" as const, fontFamily: "var(--font-bebas), sans-serif", fontSize: 7, letterSpacing: "0.22em", color: "rgba(255,255,255,0.7)" }}>
              NEXUS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Athlete Combobox ────────────────────────────────────────── */

function AthleteCombobox({
  selected,
  onSelect,
  onClear,
}: {
  selected: RosterAthlete | null;
  onSelect: (a: RosterAthlete) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (query.trim().length < 1) return AVAILABLE_ATHLETES;
    const q = query.toLowerCase();
    return AVAILABLE_ATHLETES.filter(
      (a) =>
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        a.position.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-3 bg-[#13151a] border border-[#2D3748] rounded-lg px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-[#E63946]/20 border border-[#E63946]/40 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-[#E63946]">
            {selected.firstName[0]}{selected.lastName[0]}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-white truncate">
            {selected.firstName} {selected.lastName}
          </p>
          <p className="text-[12px] text-[#6b7280] truncate">
            {selected.position} &middot; {selected.gradYear}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="w-7 h-7 rounded-full bg-[#2D3748] hover:bg-[#374151] flex items-center justify-center transition-colors shrink-0"
          aria-label="Retirer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher un athlète par nom ou position..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
        />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1A1D24] border border-[#2D3748] rounded-lg shadow-xl max-h-[280px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[14px] text-[#6b7280]">
              Aucun athlète trouvé
            </div>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { onSelect(a); setQuery(""); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252D3A] transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-[#9CA3AF]">
                    {a.firstName[0]}{a.lastName[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-white truncate">
                    {a.firstName} {a.lastName}
                  </p>
                  <p className="text-[11px] text-[#6b7280] truncate">
                    {a.position} &middot; {a.gradYear} &middot; Profil {a.profilePercent}%
                  </p>
                </div>
                {a.isVerified && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#3B82F6" stroke="none" className="shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Recruiter Combobox ──────────────────────────────────────── */

function RecruiterCombobox({
  selected,
  onSelect,
  onClear,
}: {
  selected: RecruiterProfile | null;
  onSelect: (r: RecruiterProfile) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (query.trim().length < 1) return KNOWN_RECRUITERS;
    const q = query.toLowerCase();
    return KNOWN_RECRUITERS.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        r.cegep.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-3 bg-[#13151a] border border-[#2D3748] rounded-lg px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-[#9CA3AF]">
            {selected.firstName[0]}{selected.lastName[0]}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-white truncate">
            {selected.firstName} {selected.lastName}
          </p>
          <p className="text-[12px] text-[#6b7280] truncate">
            {selected.cegep} &middot; {selected.division}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="w-7 h-7 rounded-full bg-[#2D3748] hover:bg-[#374151] flex items-center justify-center transition-colors shrink-0"
          aria-label="Retirer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher un recruteur par nom ou CÉGEP..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
        />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1A1D24] border border-[#2D3748] rounded-lg shadow-xl max-h-[280px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[14px] text-[#6b7280]">
              Aucun recruteur trouvé
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onSelect(r); setQuery(""); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252D3A] transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-[#9CA3AF]">
                    {r.firstName[0]}{r.lastName[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-white truncate">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-[11px] text-[#6b7280] truncate">
                    {r.title} &middot; {r.cegep} &middot; {r.division}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Success Toast ─────────────────────────────────────────── */

function SuccessToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-[slideDown_0.3s_ease-out]">
      <div className="flex items-center gap-3 bg-[#16A34A] text-white px-6 py-3.5 rounded-xl shadow-2xl">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span className="text-[14px] font-bold">Message envoyé avec succès!</span>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function CoachNouveauMessagePage() {
  return (
    <Suspense fallback={<div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>}>
      <CoachNouveauMessageContent />
    </Suspense>
  );
}

function CoachNouveauMessageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedAthlete, setSelectedAthlete] = useState<RosterAthlete | null>(null);
  const [selectedRecruiter, setSelectedRecruiter] = useState<RecruiterProfile | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [sending, setSending] = useState(false);

  // Pre-select from query params ?athlete=xxx&recruiter=yyy
  useEffect(() => {
    const athleteId = searchParams.get("athlete");
    if (athleteId) {
      const found = AVAILABLE_ATHLETES.find((a) => a.id === athleteId);
      if (found) setSelectedAthlete(found);
    }
    const recruiterId = searchParams.get("recruiter");
    if (recruiterId) {
      const found = KNOWN_RECRUITERS.find((r) => r.id === recruiterId);
      if (found) setSelectedRecruiter(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate template when both are selected
  useEffect(() => {
    if (selectedAthlete && selectedRecruiter) {
      setMessageBody(generateTemplate(selectedAthlete, selectedRecruiter));
    }
  }, [selectedAthlete, selectedRecruiter]);

  const handleSelectAthlete = useCallback((a: RosterAthlete) => {
    setSelectedAthlete(a);
  }, []);

  const handleClearAthlete = useCallback(() => {
    setSelectedAthlete(null);
    setMessageBody("");
  }, []);

  const handleSelectRecruiter = useCallback((r: RecruiterProfile) => {
    setSelectedRecruiter(r);
  }, []);

  const handleClearRecruiter = useCallback(() => {
    setSelectedRecruiter(null);
    setMessageBody("");
  }, []);

  const handleSend = useCallback(() => {
    if (!selectedAthlete || !selectedRecruiter || !messageBody.trim() || sending) return;
    setSending(true);
    setShowToast(true);
    setTimeout(() => {
      router.push("/coach/demandes");
    }, 1500);
  }, [selectedAthlete, selectedRecruiter, messageBody, sending, router]);

  const canSend = selectedAthlete && selectedRecruiter && messageBody.trim().length > 10 && !sending;

  return (
    <>
      <SuccessToast visible={showToast} />

      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/coach/demandes"
            className="inline-flex items-center gap-1.5 text-[14px] text-[#9CA3AF] hover:text-white transition-colors mb-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Retour aux demandes
          </Link>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Nouveau message
          </h1>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* ── LEFT: Compose form ──────────────────────────────── */}
          <div className="space-y-5">
            {/* Athlete selector */}
            <div>
              <label className="block text-[12px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">
                Sélectionner un athlète
              </label>
              <AthleteCombobox
                selected={selectedAthlete}
                onSelect={handleSelectAthlete}
                onClear={handleClearAthlete}
              />
            </div>

            {/* Recruiter selector */}
            <div>
              <label className="block text-[12px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">
                Destinataire (Recruteur)
              </label>
              <RecruiterCombobox
                selected={selectedRecruiter}
                onSelect={handleSelectRecruiter}
                onClear={handleClearRecruiter}
              />
            </div>

            {/* Message body */}
            <div>
              <label className="block text-[12px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">
                Message
              </label>
              <textarea
                rows={12}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={selectedAthlete && selectedRecruiter ? "" : "Sélectionne un athlète et un recruteur pour générer un gabarit..."}
                className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Send button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-[14px] font-bold transition-all ${
                  canSend
                    ? "bg-[#E63946] hover:bg-[#D42B22] text-white cursor-pointer shadow-lg shadow-[#E63946]/20"
                    : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"
                }`}
              >
                {sending ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    Envoyer le message
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
              <Link
                href="/coach/demandes"
                className="text-[14px] text-[#6b7280] hover:text-white transition-colors"
              >
                Annuler
              </Link>
            </div>
          </div>

          {/* ── RIGHT: Player Card + Recruiter ────────────────── */}
          <div className="space-y-5">
            {selectedAthlete ? (
              <>
                {/* Player name */}
                <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">
                  {selectedAthlete.firstName} {selectedAthlete.lastName}
                </h2>

                {/* V30 Player Card */}
                {(() => {
                  const profile = ALL_PROFILES[selectedAthlete.id];
                  if (profile) {
                    return (
                      <div className="flex justify-center">
                        <MiniPlayerCard a={profile} />
                      </div>
                    );
                  }
                  // Fallback
                  return (
                    <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#E63946]/15 border-2 border-[#E63946]/30 flex items-center justify-center">
                          <span className="text-[14px] font-bold text-[#E63946]">
                            {selectedAthlete.firstName[0]}{selectedAthlete.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-[14px] text-[#9CA3AF]">{selectedAthlete.position} &middot; {selectedAthlete.gradYear}</p>
                          <p className="text-[12px] text-[#6b7280]">Profil {selectedAthlete.profilePercent}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Recruiter preview */}
                {selectedRecruiter && (
                  <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 space-y-3">
                    <p className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">
                      Recruteur destinataire
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-[#9CA3AF]">
                          {selectedRecruiter.firstName[0]}{selectedRecruiter.lastName[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-white">
                          {selectedRecruiter.firstName} {selectedRecruiter.lastName}
                        </p>
                        <p className="text-[12px] text-[#6b7280]">{selectedRecruiter.cegep}</p>
                        <p className="text-[11px] text-[#4a4d56]">{selectedRecruiter.title} &middot; {selectedRecruiter.division}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-[#1A1D24] border border-[#2D3748] border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <p className="text-[14px] text-[#6b7280] leading-relaxed max-w-[200px]">
                  Sélectionne un athlète pour voir sa carte et choisir un recruteur destinataire
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
}
