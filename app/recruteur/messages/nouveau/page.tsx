"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MOCK_PIPELINE } from "../../_data/mockPipelineData";
import type { PipelineAthlete } from "../../_data/mockPipelineData";
import { RECRUITER_PROFILE } from "../../_data/mockRecruiterProfile";
import { ALL_PROFILES, type AthleteProfile } from "@/app/coach/athletes/_data/mockAthleteProfiles";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import NxIcon from "@/components/ui/NxIcon";

/* ═══════════════════════════════════════════════════════════════
   Nouveau Message — Compose Page (Recruiter)
═══════════════════════════════════════════════════════════════ */

const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_NAME_MAP).map(([display, key]) => [key, display])
);

/* ── Mini Player Card (V30-inspired) ─────────────────────────── */

function MiniPlayerCard({ a }: { a: AthleteProfile }) {
  const stars = Math.round(a.stars);
  const posAbbr = a.position.length > 4 ? a.position.slice(0, 3).toUpperCase() : a.position.toUpperCase();
  const sportDisplay = SPORT_DISPLAY[a.sport] || a.sport;

  return (
    <div className="relative" style={{ width: 240, paddingBottom: 8 }}>
      {/* Verified badge */}
      {a.profilePercent >= 50 && (
        <div className="absolute z-30" style={{ top: 6, right: -10 }}>
          <div className="rounded-full" style={{ border: "2px solid #1A1D24" }}>
            <svg width="36" height="36" viewBox="0 0 54 54" fill="none">
              <defs>
                <radialGradient id="mc_bg" cx="38%" cy="28%" r="68%">
                  <stop offset="0%" stopColor="#29AAFF" />
                  <stop offset="55%" stopColor="#0094F0" />
                  <stop offset="100%" stopColor="#0060C0" />
                </radialGradient>
              </defs>
              <circle cx="27" cy="27" r="24" fill="url(#mc_bg)" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
      )}

      {/* Card body */}
      <div className="relative overflow-visible" style={{ width: 240, borderRadius: 8 }}>
        {/* Photo area */}
        <div className="relative overflow-hidden" style={{ width: 240, height: 300, borderRadius: 8, background: "#2F3440" }}>
          {a.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.photo} alt={`${a.firstName} ${a.lastName}`} className="absolute inset-0 w-full h-full object-cover z-[1]" />
          ) : (
            <div className="absolute inset-0 z-[1] flex items-center justify-center">
              <span style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 80, color: "rgba(255,255,255,0.06)", letterSpacing: "0.05em", lineHeight: 1 }}>
                {a.firstName[0]}{a.lastName[0]}
              </span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: "linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)" }} />
          <div className="absolute bottom-3 left-3 z-[3]">
            <p style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 22, color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>
              {a.firstName}
            </p>
            <p style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 22, color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>
              {a.lastName}
            </p>
          </div>
        </div>

        {/* Ticket strip */}
        <div className="absolute z-[999] overflow-hidden" style={{ bottom: -10, right: -16, borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex" style={{ width: 256 }}>
            <div className="flex flex-col justify-between" style={{ background: "#1E2128", padding: "8px 10px 8px 12px", minWidth: 72, gap: 2 }}>
              {[
                { lbl: "Sport", val: sportDisplay },
                { lbl: "Pos", val: posAbbr },
                { lbl: "No.", val: a.jerseyNumber ? `#${a.jerseyNumber}` : "—" },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: "var(--font-barlow-cond), sans-serif", fontSize: 6, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.38)", marginBottom: 1 }}>
                    {r.lbl}
                  </div>
                  <div style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 13, color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>
                    {r.val}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center" style={{ width: 10, background: "#E6E6E6", borderLeft: "1px dashed rgba(11,18,32,0.2)", borderRight: "1px dashed rgba(11,18,32,0.2)", gap: 2 }}>
              {[...Array(6)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(11,18,32,0.2)" }} />
              ))}
            </div>
            <div className="flex-1 flex flex-col justify-center" style={{ background: "#FFFFFF", padding: "8px 12px" }}>
              <div style={{ display: "inline-flex", background: "#1E2128", borderRadius: 4, padding: "3px 6px", marginBottom: 4 }}>
                <svg width="90" height="14" viewBox="0 0 90 14" fill="none" style={{ display: "block" }}>
                  {[0, 18, 36, 54, 72].map((x, i) => (
                    <path key={x} d="M7,0L8.5,5L14,5L9.8,8.2L11.3,13.2L7,10.2L2.7,13.2L4.2,8.2L0,5L5.5,5Z"
                      fill={i < stars ? "#F59E0B" : "#374151"} transform={`translate(${x},0)`} />
                  ))}
                </svg>
              </div>
              <div style={{ fontFamily: "var(--font-barlow-cond), sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#1E2128" }}>
                {a.school}
              </div>
              <div style={{ fontFamily: "var(--font-barlow-cond), sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#E63946", marginTop: 1 }}>
                Promotion {a.graduationYear}
              </div>
            </div>
            <div className="flex items-center justify-center flex-shrink-0" style={{ background: "#E63946", width: 18, writingMode: "vertical-rl" as const, fontFamily: "var(--font-bebas), sans-serif", fontSize: 8, letterSpacing: "0.22em", color: "rgba(255,255,255,0.7)" }}>
              NEXUS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Only tracked athletes (status != "none") are available to message */
const AVAILABLE_ATHLETES = MOCK_PIPELINE.filter((a) => a.tracking.status !== "none");

function generateTemplate(athlete: PipelineAthlete): string {
  const r = RECRUITER_PROFILE;
  return `Bonjour Coach ${athlete.coachLastName},

Je suis ${r.firstName} ${r.lastName}, ${r.title} chez les ${r.teamName} du ${r.cegep} (${r.division}).

J'ai consulté le profil de ${athlete.firstName} ${athlete.lastName} (${athlete.position}) et j'aimerais discuter de son avenir sportif au niveau collégial.

[Votre message personnalisé ici]

Cordialement,
${r.firstName} ${r.lastName}
${r.title} — ${r.teamName}, ${r.cegep}`;
}

/* ── Athlete Combobox ──────────────────────────────────────── */

function AthleteCombobox({
  selected,
  onSelect,
  onClear,
}: {
  selected: PipelineAthlete | null;
  onSelect: (a: PipelineAthlete) => void;
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
        a.position.toLowerCase().includes(q) ||
        a.school.toLowerCase().includes(q)
    );
  }, [query]);

  // Close dropdown on outside click
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
            {selected.position} &middot; {selected.school}
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
          placeholder="Rechercher un athlète par nom, position ou école..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
        />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1A1D24] border border-[#2D3748] rounded-lg shadow-xl max-h-[280px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-[#6b7280]">
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
                  <p className="text-[13px] font-semibold text-white truncate">
                    {a.firstName} {a.lastName}
                  </p>
                  <p className="text-[11px] text-[#6b7280] truncate">
                    {a.position} &middot; {a.school}
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

/* ── Success Toast ─────────────────────────────────────────── */

function SuccessToast({ visible, statusChanged }: { visible: boolean; statusChanged: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-[slideDown_0.3s_ease-out]">
      <div className="flex flex-col items-center gap-1 bg-[#22C55E] text-white px-6 py-3.5 rounded-xl shadow-2xl">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="text-[14px] font-bold">Message envoyé avec succès!</span>
        </div>
        {statusChanged && (
          <span className="text-[11px] text-white/80">Statut mis à jour → Contacté</span>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function NouveauMessagePage() {
  return (
    <Suspense fallback={<div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>}>
      <NouveauMessageContent />
    </Suspense>
  );
}

function NouveauMessageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedAthlete, setSelectedAthlete] = useState<PipelineAthlete | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [statusChanged, setStatusChanged] = useState(false);
  const [sending, setSending] = useState(false);

  // Pre-select from query param ?athlete=xxx
  useEffect(() => {
    const athleteId = searchParams.get("athlete");
    if (athleteId) {
      const found = AVAILABLE_ATHLETES.find((a) => a.id === athleteId);
      if (found) {
        setSelectedAthlete(found);
        setMessageBody(generateTemplate(found));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectAthlete = useCallback((a: PipelineAthlete) => {
    setSelectedAthlete(a);
    setMessageBody(generateTemplate(a));
  }, []);

  const handleClearAthlete = useCallback(() => {
    setSelectedAthlete(null);
    setMessageBody("");
  }, []);

  const handleSend = useCallback(() => {
    if (!selectedAthlete || !messageBody.trim() || sending) return;
    setSending(true);

    // In production: server action would send the message AND update
    // the athlete's pipeline status to "contacté" if this is the first message.
    // For mock: update the tracking data in-memory so other pages see the change.
    if (selectedAthlete.tracking.status === "identifie" || selectedAthlete.tracking.status === "none") {
      selectedAthlete.tracking.status = "contacte";
      selectedAthlete.tracking.statusChangedAt = new Date().toISOString();
      selectedAthlete.tracking.firstContactedAt = new Date().toISOString();
      setStatusChanged(true);
    }

    setShowToast(true);
    setTimeout(() => {
      router.push("/recruteur/messages");
    }, 1500);
  }, [selectedAthlete, messageBody, sending, router]);

  const canSend = selectedAthlete && messageBody.trim().length > 10 && !sending;

  return (
    <>
      <SuccessToast visible={showToast} statusChanged={statusChanged} />

      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Link
              href="/recruteur/messages"
              className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors mb-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Retour aux messages
            </Link>
            <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Nouveau message
            </h1>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* ── LEFT: Compose form ──────────────────────────────── */}
          <div className="space-y-5">
            {/* Athlete selector */}
            <div>
              <label className="block text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">
                Sélectionner un athlète
              </label>
              <AthleteCombobox
                selected={selectedAthlete}
                onSelect={handleSelectAthlete}
                onClear={handleClearAthlete}
              />
            </div>

            {/* Coach (auto-filled) */}
            <div>
              <label className="block text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">
                Destinataire (Coach)
              </label>
              {selectedAthlete ? (
                <div className="flex items-center gap-3 bg-[#13151a] border border-[#2D3748] rounded-lg px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-white">
                      Coach {selectedAthlete.coachName} {selectedAthlete.coachLastName}
                    </p>
                    <p className="text-[12px] text-[#6b7280]">
                      {selectedAthlete.school}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </div>
              ) : (
                <div className="bg-[#13151a] border border-[#2D3748] border-dashed rounded-lg px-4 py-3 text-[13px] text-[#4a4d56]">
                  Sélectionne un athlète pour identifier le coach destinataire
                </div>
              )}
            </div>

            {/* Message body */}
            <div>
              <label className="block text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">
                Message
              </label>
              <textarea
                rows={12}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={selectedAthlete ? "" : "Sélectionne un athlète pour générer un gabarit de message..."}
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
                href="/recruteur/messages"
                className="text-[13px] text-[#6b7280] hover:text-white transition-colors"
              >
                Annuler
              </Link>
            </div>
          </div>

          {/* ── RIGHT: Sidebar — Player Card + Coach ────────────── */}
          <div className="space-y-5">
            {selectedAthlete ? (
              <>
                {/* Player name header */}
                <div className="flex items-center gap-2">
                  <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">
                    {selectedAthlete.firstName} {selectedAthlete.lastName}
                  </h2>
                  {selectedAthlete.isVerified && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#3B82F6" stroke="none" className="shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  )}
                </div>

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
                  // Fallback for athletes without full profile
                  return (
                    <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#E63946]/15 border-2 border-[#E63946]/30 flex items-center justify-center">
                          <span className="text-[14px] font-bold text-[#E63946]">
                            {selectedAthlete.firstName[0]}{selectedAthlete.lastName[0]}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-[#9CA3AF]">{selectedAthlete.position} &middot; {selectedAthlete.school}</p>
                          <p className="text-[12px] text-[#6b7280]">{selectedAthlete.region} &middot; Promotion {selectedAthlete.graduationYear}</p>
                        </div>
                      </div>
                      {selectedAthlete.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedAthlete.badges.map((b, i) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-[#111317] border border-[#2D3748] rounded-full px-2.5 py-1 text-[11px] text-[#9CA3AF]">
                              <NxIcon name={b.icon} size={12} className="text-[#6B7280]" /> {b.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Coach preview card */}
                <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 space-y-3">
                  <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">
                    Coach destinataire
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-[#9CA3AF]">
                        {selectedAthlete.coachName[0]}{selectedAthlete.coachLastName[0]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-white">
                        {selectedAthlete.coachName} {selectedAthlete.coachLastName}
                      </p>
                      <p className="text-[12px] text-[#6b7280]">{selectedAthlete.school}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-[#1A1D24] border border-[#2D3748] border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <p className="text-[13px] text-[#6b7280] leading-relaxed max-w-[200px]">
                  Sélectionne un athlète pour voir sa carte et identifier le coach destinataire
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-down animation keyframe */}
      <style jsx>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
}
