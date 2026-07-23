"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { RecruiterProfile } from "../_data/mockThreadsData";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { createCoachConversation } from "@/lib/queries/messaging/createCoachConversation";
import { CoachDemandesNouveauMobile } from "@/components/shared/CoachDemandesNouveauMobile";
import AudienceTiles, { type CoachAudience } from "@/components/messaging/AudienceTiles";
import CoachStaffCompose from "@/components/messaging/CoachStaffCompose";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Nouveau Message — Compose Page (Coach)
   Select an athlete, then a recruiter, write a message.

   Phase B : send path repointed at lib/queries/messaging/
   createCoachConversation (shared with the mobile composer). The
   old inline INSERT had three bugs : status "envoye" violated the
   conversations_status_check, convError was destructured but never
   read, and a success toast fired unconditionally — so a RLS deny
   reported success and showed an empty list. Coach RLS INSERT was
   also missing in DB ; covered by the companion migration
   20260614100000_coach_conversations_insert.sql.

   Recruiter picker : ANY recruiter from the directory, not just
   recruiters with whom the coach already has a conversation
   (the legacy query left brand-new coaches with an empty combobox).

   Recruiter is notified automatically via the existing log_coach_reply
   trigger that fires on the first message INSERT — no app code.
═══════════════════════════════════════════════════════════════ */

interface RosterAthlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  gradYear: number;
  profilePercent: number;
  isVerified: boolean;
}

interface CegepOption {
  id: string;
  name: string;
}

/* ── Athlete Combobox ────────────────────────────────────────── */

function AthleteCombobox({
  selected,
  onSelect,
  onClear,
  availableAthletes,
}: {
  selected: RosterAthlete | null;
  onSelect: (a: RosterAthlete) => void;
  onClear: () => void;
  availableAthletes: RosterAthlete[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (query.trim().length < 1) return availableAthletes;
    const q = query.toLowerCase();
    return availableAthletes.filter(
      (a) =>
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        a.position.toLowerCase().includes(q)
    );
  }, [query, availableAthletes]);

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
                <svg width="12" height="12" viewBox="0 0 24 24" fill={a.isVerified ? "#3B82F6" : "#6B7280"} stroke="none" className="shrink-0" aria-label={a.isVerified ? "Profil vérifié" : "Profil non vérifié"}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── CÉGEP Combobox ──────────────────────────────────────────── */

function CegepCombobox({
  selected,
  onSelect,
  onClear,
  cegeps,
}: {
  selected: CegepOption | null;
  onSelect: (c: CegepOption) => void;
  onClear: () => void;
  cegeps: CegepOption[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (query.trim().length < 1) return cegeps;
    const q = query.toLowerCase();
    return cegeps.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, cegeps]);

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
        <div className="w-9 h-9 rounded-lg bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-white truncate">{selected.name}</p>
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
          placeholder="Rechercher un CÉGEP..."
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
              Aucun CÉGEP avec un recruteur inscrit
            </div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onSelect(c); setQuery(""); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252D3A] transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-white truncate flex-1">{c.name}</p>
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
  knownRecruiters,
}: {
  selected: RecruiterProfile | null;
  onSelect: (r: RecruiterProfile) => void;
  onClear: () => void;
  knownRecruiters: RecruiterProfile[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (query.trim().length < 1) return knownRecruiters;
    const q = query.toLowerCase();
    return knownRecruiters.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        r.cegep.toLowerCase().includes(q)
    );
  }, [query, knownRecruiters]);

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
                    {r.cegep} &middot; {r.division}
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
  // Phase C — mobile early return. Native composer reuses the same
  // shared createCoachConversation under the hood (single source of
  // truth for the create logic).
  if (IS_CAPACITOR) return <CoachDemandesNouveauMobile />;
  return (
    <Suspense fallback={<div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>}>
      <CoachNouveauMessageContent />
    </Suspense>
  );
}

function CoachNouveauMessageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [audience, setAudience] = useState<CoachAudience | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<RosterAthlete | null>(null);
  const [selectedCegep, setSelectedCegep] = useState<CegepOption | null>(null);
  const [selectedRecruiter, setSelectedRecruiter] = useState<RecruiterProfile | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingRecruiters, setLoadingRecruiters] = useState(false);

  // Loaded data
  const [coachProfile, setCoachProfile] = useState<{ firstName: string; lastName: string; school: string }>({ firstName: "", lastName: "", school: "" });
  const [availableAthletes, setAvailableAthletes] = useState<RosterAthlete[]>([]);
  const [cegeps, setCegeps] = useState<CegepOption[]>([]);
  const [recruitersAtCegep, setRecruitersAtCegep] = useState<RecruiterProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load data from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setCurrentUserId(user.id);

        // Coach profile
        const { data: coachData, error: coachError } = await supabase
          .from("users")
          .select("first_name, last_name, schools!school_id(name)")
          .eq("id", user.id)
          .single();

        if (coachData) {
          const school = (coachData as any).schools;
          setCoachProfile({
            firstName: coachData.first_name || "",
            lastName: coachData.last_name || "",
            school: school?.name || "",
          });
        }

        // Available athletes (verified, belonging to this coach)
        const { data: athletes, error: athError } = await supabase
          .from("athletes")
          .select("id, first_name, last_name, verified, profile_completion, annee_diplomation, positions!position_id(nom, abreviation)")
          .eq("coach_id", user.id)
          .eq("verified", true);

        if (athletes) {
          const mapped: RosterAthlete[] = athletes.map((a: any) => ({
            id: a.id,
            firstName: a.first_name || "",
            lastName: a.last_name || "",
            position: a.positions?.abreviation || a.positions?.nom || "",
            gradYear: a.annee_diplomation ?? 0,
            profilePercent: a.profile_completion ?? 0,
            isVerified: a.verified ?? false,
          }));
          setAvailableAthletes(mapped);
        }

        // CÉGEPs that HAVE at least one registered recruiter — keeps the
        // picker free of dead-ends. PII-minimal : fetches only school_id
        // (+ the joined school name), no first_name/last_name/email here.
        // Recruiters at the chosen CÉGEP are fetched lazily once a CÉGEP
        // is picked (see the dedicated useEffect on selectedCegep).
        const { data: recForCegep } = await supabase
          .from("users")
          .select("school_id, schools!school_id(id, name)")
          .eq("role", "RECRUTEUR")
          .not("school_id", "is", null);

        if (recForCegep) {
          const seen = new Set<string>();
          const list: CegepOption[] = [];
          for (const row of recForCegep as any[]) {
            const sid = row.school_id as string | null;
            if (!sid || seen.has(sid)) continue;
            seen.add(sid);
            const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
            list.push({ id: sid, name: (school?.name as string) || "" });
          }
          list.sort((a, b) => a.name.localeCompare(b.name));
          setCegeps(list);
        }
      } catch (err) {
        console.error("[Nouveau] Error loading data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function generateTemplate(athlete: RosterAthlete, recruiter: RecruiterProfile): string {
    return `Bonjour ${recruiter.firstName} ${recruiter.lastName},

Je suis Coach ${coachProfile.firstName} ${coachProfile.lastName} de ${coachProfile.school}.

Je souhaitais vous écrire au sujet de ${athlete.firstName} ${athlete.lastName} (${athlete.position}), un athlète de notre programme que je crois pourrait intéresser votre équipe${recruiter.cegepTeamName ? ` les ${recruiter.cegepTeamName}` : ""}.

[Votre message personnalisé ici]

Cordialement,
Coach ${coachProfile.firstName} ${coachProfile.lastName}
${coachProfile.school}`;
  }

  // Pre-select athlete from ?athlete=xxx (recruiter pre-select is dropped
  // — under the CÉGEP-first flow the coach picks the school before the
  // recruiter, so a bare ?recruiter= would race the CÉGEP fetch).
  useEffect(() => {
    if (loading || availableAthletes.length === 0) return;
    const athleteId = searchParams.get("athlete");
    if (athleteId) {
      const found = availableAthletes.find((a) => a.id === athleteId);
      if (found) setSelectedAthlete(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, availableAthletes]);

  // Lazy-load recruiters for the chosen CÉGEP. Refetches whenever the
  // coach swaps the CÉGEP. Clears the in-flight selection if any.
  useEffect(() => {
    if (!selectedCegep) {
      setRecruitersAtCegep([]);
      return;
    }
    let cancelled = false;
    setLoadingRecruiters(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, schools!school_id(name)")
        .eq("role", "RECRUTEUR")
        .eq("school_id", selectedCegep.id)
        .order("last_name", { ascending: true });
      if (cancelled) return;
      const mapped: RecruiterProfile[] = (data || []).map((r: any) => {
        const school = r.schools;
        const schoolName = Array.isArray(school) ? (school[0]?.name ?? "") : (school?.name ?? "");
        return {
          id: r.id,
          firstName: r.first_name || "",
          lastName: r.last_name || "",
          title: "",
          cegep: schoolName || selectedCegep.name,
          cegepTeamName: "",
          division: "Div. 1" as const,
          sport: "",
          region: "",
          email: "",
          phone: "",
        };
      });
      setRecruitersAtCegep(mapped);
      setLoadingRecruiters(false);
    })();
    return () => { cancelled = true; };
  }, [selectedCegep]);

  // Auto-generate template when both are selected
  useEffect(() => {
    if (selectedAthlete && selectedRecruiter) {
      setMessageBody(generateTemplate(selectedAthlete, selectedRecruiter));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAthlete, selectedRecruiter]);

  const handleSelectAthlete = useCallback((a: RosterAthlete) => {
    setSelectedAthlete(a);
  }, []);

  const handleClearAthlete = useCallback(() => {
    setSelectedAthlete(null);
    setMessageBody("");
  }, []);

  const handleSelectCegep = useCallback((c: CegepOption) => {
    setSelectedCegep(c);
    setSelectedRecruiter(null);
    setMessageBody("");
  }, []);

  const handleClearCegep = useCallback(() => {
    setSelectedCegep(null);
    setSelectedRecruiter(null);
    setMessageBody("");
  }, []);

  const handleSelectRecruiter = useCallback((r: RecruiterProfile) => {
    setSelectedRecruiter(r);
  }, []);

  const handleClearRecruiter = useCallback(() => {
    setSelectedRecruiter(null);
    setMessageBody("");
  }, []);

  const handleSend = useCallback(async () => {
    if (!selectedAthlete || !selectedRecruiter || !messageBody.trim() || sending || !currentUserId) return;
    setSending(true);
    setSendError(null);

    const supabase = createClient();
    const { conversationId, error } = await createCoachConversation(supabase, {
      coachUserId: currentUserId,
      recruiterId: selectedRecruiter.id,
      athleteId: selectedAthlete.id,
      message: messageBody,
    });

    if (error || !conversationId) {
      // Real error : do NOT fire success toast, do NOT navigate. Surface
      // the error inline so the coach can fix the input or retry.
      const code = (error as { code?: string } | undefined)?.code;
      const isRlsDeny =
        code === "42501" ||
        /permission denied|row-level security|policy/i.test((error as { message?: string } | undefined)?.message ?? "");
      setSendError(
        isRlsDeny
          ? "Tu n'as pas la permission d'écrire à ce recruteur au sujet de cet athlète."
          : ((error as { message?: string } | undefined)?.message || "Envoi impossible. Réessaie."),
      );
      setSending(false);
      return;
    }

    // Refresh the coach's thread list cache (CoachDemandesMobile reads
    // ["conversations","coach",userId] which the "conversations" prefix
    // invalidation catches).
    queryClient.invalidateQueries({ queryKey: ["conversations"] });

    setShowToast(true);
    setTimeout(() => {
      router.push(`/coach/demandes/${conversationId}`);
    }, 800);
  }, [selectedAthlete, selectedRecruiter, messageBody, sending, currentUserId, router, queryClient]);

  const canSend = selectedAthlete && selectedRecruiter && messageBody.trim().length > 10 && !sending;

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

        {/* Step 1 — "À qui veux-tu écrire ?" audience selector */}
        {audience === null && <AudienceTiles onPick={setAudience} />}

        {/* Coach ↔ coach / directeur / école (P4) — staff compose */}
        {audience && audience !== "recruteur" && currentUserId && (
          <div className="space-y-4">
            <button type="button" onClick={() => setAudience(null)} className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Changer de destinataire
            </button>
            <CoachStaffCompose
              selfId={currentUserId}
              audience={audience}
              onCreated={(id) => { queryClient.invalidateQueries({ queryKey: ["conversations"] }); router.push(`/coach/demandes/${id}`); }}
            />
          </div>
        )}

        {/* Recruteur CÉGEP flow (existing, unchanged) */}
        {audience === "recruteur" && (
        <>
        <button type="button" onClick={() => setAudience(null)} className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors mb-1">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Changer de destinataire
        </button>
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
                availableAthletes={availableAthletes}
              />
            </div>

            {/* CÉGEP selector — only CÉGEPs that already have at least one
                registered recruiter are listed (no dead-ends). */}
            <div>
              <label className="block text-[12px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">
                CÉGEP destinataire
              </label>
              <CegepCombobox
                selected={selectedCegep}
                onSelect={handleSelectCegep}
                onClear={handleClearCegep}
                cegeps={cegeps}
              />
            </div>

            {/* Recruiter selector — scoped to the chosen CÉGEP. Disabled
                placeholder until a CÉGEP is picked. */}
            <div>
              <label className="block text-[12px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">
                Recruteur au {selectedCegep ? selectedCegep.name : "CÉGEP"}
              </label>
              {!selectedCegep ? (
                <div className="bg-[#13151a] border border-dashed border-[#2D3748] rounded-lg px-4 py-3 text-[14px] text-[#6b7280]">
                  Choisis d&apos;abord un CÉGEP pour voir ses recruteurs.
                </div>
              ) : loadingRecruiters ? (
                <div className="bg-[#13151a] border border-[#2D3748] rounded-lg px-4 py-3 text-[14px] text-[#6b7280] flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
                  Chargement des recruteurs…
                </div>
              ) : (
                <RecruiterCombobox
                  selected={selectedRecruiter}
                  onSelect={handleSelectRecruiter}
                  onClear={handleClearRecruiter}
                  knownRecruiters={recruitersAtCegep}
                />
              )}
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

            {sendError && (
              <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">
                {sendError}
              </div>
            )}

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

          {/* ── RIGHT: Athlete Preview + Recruiter ────────────────── */}
          <div className="space-y-5">
            {selectedAthlete ? (
              <>
                {/* Player name */}
                <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">
                  {selectedAthlete.firstName} {selectedAthlete.lastName}
                </h2>

                {/* Simple athlete preview card */}
                <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#E63946]/15 border-2 border-[#E63946]/30 flex items-center justify-center">
                      <span className="text-[14px] font-bold text-[#E63946]">
                        {selectedAthlete.firstName[0]}{selectedAthlete.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-white">
                        {selectedAthlete.firstName} {selectedAthlete.lastName}
                      </p>
                      <p className="text-[12px] text-[#9CA3AF]">{selectedAthlete.position} &middot; {selectedAthlete.gradYear}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-[#6b7280]">Profil {selectedAthlete.profilePercent}%</span>
                        {selectedAthlete.isVerified && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

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
                        <p className="text-[11px] text-[#4a4d56]">{selectedRecruiter.division}</p>
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
        </>
        )}
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
