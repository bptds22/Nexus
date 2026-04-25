"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import StarRating from "@/components/ui/StarRating";
import ErrorToast from "@/components/ui/ErrorToast";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   Nouveau Message — Compose Page (Recruiter)
   Wired to Supabase: recruiter_pipeline + athletes + conversations
═══════════════════════════════════════════════════════════════ */

interface SelectableAthlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  school: string;
  jersey: string;
  recruitmentStatus: string;
  stars: number;
  isVerified: boolean;
  coachId: string;
  coachFirstName: string;
  coachLastName: string;
}

/* ── Success Toast ─────────────────────────────────────────── */

function SuccessToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-[toastSlideDown_0.3s_ease-out]">
      <div className="flex items-center gap-3 bg-[#22C55E] text-white px-6 py-3.5 rounded-xl shadow-2xl">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span className="text-[14px] font-bold">Message envoyé avec succès!</span>
      </div>
    </div>
  );
}

/* ── Athlete Combobox ──────────────────────────────────────── */

function AthleteCombobox({
  selected, onSelect, onClear, athletes,
}: {
  selected: SelectableAthlete | null;
  onSelect: (a: SelectableAthlete) => void;
  onClear: () => void;
  athletes: SelectableAthlete[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (query.trim().length < 1) return athletes;
    const q = query.toLowerCase();
    return athletes.filter(a =>
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
      a.position.toLowerCase().includes(q) ||
      a.school.toLowerCase().includes(q)
    );
  }, [query, athletes]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-3 bg-[#13151a] border border-[#2D3748] rounded-lg px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-[#E63946]/20 border border-[#E63946]/40 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-[#E63946]">{selected.firstName[0]}{selected.lastName[0]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-white truncate">{selected.firstName} {selected.lastName}</p>
          <p className="text-[12px] text-[#6b7280] truncate">{selected.position} · {selected.school}</p>
        </div>
        <button type="button" onClick={onClear} className="w-7 h-7 rounded-full bg-[#2D3748] hover:bg-[#374151] flex items-center justify-center transition-colors shrink-0" aria-label="Retirer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        <input type="text" placeholder="Rechercher un athlète par nom, position ou école..." value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors" />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1A1D24] border border-[#2D3748] rounded-lg shadow-xl max-h-[280px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-[#6b7280]">Aucun athlète trouvé</div>
          ) : results.map(a => (
            <button key={a.id} type="button" onClick={() => { onSelect(a); setQuery(""); setOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252D3A] transition-colors text-left">
              <div className="w-8 h-8 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[#9CA3AF]">{a.firstName[0]}{a.lastName[0]}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-semibold text-white truncate">{a.firstName} {a.lastName}</p>
                  {a.jersey && <span className="text-[11px] font-black text-[#E63946]">#{a.jersey}</span>}
                  {a.position && <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#2D3748] text-[#c0c4cc] text-[10px] font-bold uppercase">{a.position}</span>}
                </div>
                <p className="text-[11px] text-[#6b7280] truncate">{a.school}</p>
              </div>
              <RecruitmentStatusBadge status={a.recruitmentStatus as GlobalRecruitmentStatus} size="sm" />
            </button>
          ))}
        </div>
      )}
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

  const [athletes, setAthletes] = useState<SelectableAthlete[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<SelectableAthlete | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [errorToast, setErrorToast] = useState<{
    message: string;
    showUpgrade: boolean;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [recruiterName, setRecruiterName] = useState({ first: "", last: "", school: "" });

  // Load favorited athletes + recruiter profile
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Recruiter profile
      const { data: profile } = await supabase.from("users").select("first_name, last_name, schools!school_id(name)").eq("id", user.id).single();
      if (profile) {
        const schoolRel = profile.schools;
        const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string } | null;
        setRecruiterName({ first: (profile.first_name as string) || "", last: (profile.last_name as string) || "", school: school?.name || "" });
      }

      // Load pipeline athletes with coach info
      const { data: pipeData } = await supabase
        .from("recruiter_pipeline")
        .select(`
          athlete_id,
          athletes!athlete_id(
            id, first_name, last_name, verified, coach_id,
            numero_jersey, recruitment_status, cote_globale_entraineur,
            positions!position_id(abreviation),
            schools!school_id(name),
            users!coach_id(id, first_name, last_name)
          )
        `)
        .eq("recruiter_id", user.id);

      console.log("[Nouveau - pipeline athletes]", pipeData?.length);

      if (pipeData) {
        const mapped: SelectableAthlete[] = pipeData.map((f: Record<string, unknown>) => {
          const aRaw = f.athletes;
          const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as Record<string, unknown> | null;
          if (!a) return null;
          const posRel = a.positions;
          const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
          const schoolRel = a.schools;
          const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string } | null;
          const coachRel = a.users;
          const coach = (Array.isArray(coachRel) ? coachRel[0] : coachRel) as { id?: string; first_name?: string; last_name?: string } | null;
          return {
            id: a.id as string,
            firstName: (a.first_name as string) || "",
            lastName: (a.last_name as string) || "",
            position: pos?.abreviation || "",
            school: school?.name || "",
            jersey: a.numero_jersey != null && a.numero_jersey !== "" ? String(a.numero_jersey) : "",
            recruitmentStatus: (a.recruitment_status as string) || "OUVERT",
            stars: (a.cote_globale_entraineur as number) || 0,
            isVerified: !!(a.verified),
            coachId: (coach?.id as string) || (a.coach_id as string) || "",
            coachFirstName: (coach?.first_name as string) || "",
            coachLastName: (coach?.last_name as string) || "",
          };
        }).filter(Boolean) as SelectableAthlete[];
        setAthletes(mapped);

        // Pre-select from URL
        const athleteId = searchParams.get("athlete");
        if (athleteId) {
          let found = mapped.find(a => a.id === athleteId);
          // If not in pipeline, load directly from athletes table
          if (!found) {
            const { data: directAthlete } = await supabase
              .from("athletes")
              .select("id, first_name, last_name, verified, coach_id, numero_jersey, recruitment_status, cote_globale_entraineur, positions!position_id(abreviation), schools!school_id(name), users!coach_id(id, first_name, last_name)")
              .eq("id", athleteId)
              .single();
            if (directAthlete) {
              const posRel = (directAthlete as any).positions;
              const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
              const schoolRel = (directAthlete as any).schools;
              const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string } | null;
              const coachRel = (directAthlete as any).users;
              const coach = (Array.isArray(coachRel) ? coachRel[0] : coachRel) as { id?: string; first_name?: string; last_name?: string } | null;
              found = {
                id: directAthlete.id as string,
                firstName: (directAthlete.first_name as string) || "",
                lastName: (directAthlete.last_name as string) || "",
                position: pos?.abreviation || "",
                school: school?.name || "",
                jersey: directAthlete.numero_jersey != null ? String(directAthlete.numero_jersey) : "",
                recruitmentStatus: (directAthlete.recruitment_status as string) || "OUVERT",
                stars: (directAthlete.cote_globale_entraineur as number) || 0,
                isVerified: !!(directAthlete.verified),
                coachId: (coach?.id as string) || (directAthlete.coach_id as string) || "",
                coachFirstName: (coach?.first_name as string) || "",
                coachLastName: (coach?.last_name as string) || "",
              };
              setAthletes(prev => [found!, ...prev]);
            }
          }
          if (found) {
            setSelectedAthlete(found);
            setMessageBody(genTemplate(found, profile));
          }
        }
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function genTemplate(a: SelectableAthlete, profile: Record<string, unknown> | null) {
    const schoolRel = profile?.schools;
    const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string } | null;
    return `Bonjour Coach ${a.coachLastName},

Je suis ${recruiterName.first || (profile?.first_name as string) || ""} ${recruiterName.last || (profile?.last_name as string) || ""}, recruteur au ${school?.name || recruiterName.school || ""}.

J'ai consulté le profil de ${a.firstName} ${a.lastName} (${a.position}) et j'aimerais discuter de son avenir sportif au niveau collégial.

[Votre message personnalisé ici]

Cordialement,
${recruiterName.first || (profile?.first_name as string) || ""} ${recruiterName.last || (profile?.last_name as string) || ""}`;
  }

  const handleSelectAthlete = useCallback((a: SelectableAthlete) => {
    setSelectedAthlete(a);
    setMessageBody(genTemplate(a, null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recruiterName]);

  const handleClearAthlete = useCallback(() => {
    setSelectedAthlete(null);
    setMessageBody("");
  }, []);

  const handleSend = useCallback(async () => {
    if (!selectedAthlete || !messageBody.trim() || sending) return;
    setSending(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    // Create or find conversation
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("recruiter_id", user.id)
      .eq("coach_id", selectedAthlete.coachId)
      .eq("athlete_id", selectedAthlete.id)
      .maybeSingle();

    console.log("[NEW CONV] user.id:", user.id);
    console.log("[NEW CONV] coach_id:", selectedAthlete.coachId);
    console.log("[NEW CONV] athlete_id:", selectedAthlete.id);

    let convId: string;
    if (existingConv) {
      convId = existingConv.id;
      console.log("[NEW CONV] existing conversation found:", convId);
    } else {
      const payload = {
        recruiter_id: user.id,
        coach_id: selectedAthlete.coachId,
        athlete_id: selectedAthlete.id,
        status: "ACTIVE",
        last_message_at: new Date().toISOString(),
      };
      console.log("[NEW CONV] insert payload:", payload);
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert(payload)
        .select("id")
        .single();
      console.log("[NEW CONV] result:", { newConv, error: convErr });

      if (convErr || !newConv) {
        // Detect tier-related denials from RLS. PostgREST surfaces these
        // as code 42501 (insufficient_privilege) or with "permission denied"
        // / "new row violates row-level security" in the message.
        const isTierDenial =
          convErr?.code === "42501" ||
          /permission denied|row-level security|policy/i.test(convErr?.message ?? "");

        setErrorToast({
          message: isTierDenial
            ? "L'envoi de messages nécessite un abonnement Pro."
            : "Impossible de créer la conversation. Réessaie dans un instant.",
          showUpgrade: isTierDenial,
        });
        setSending(false);
        return;
      }
      convId = newConv.id;
    }

    // Insert message
    const { data: sentMsg, error: sendErr } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: user.id,
      content: messageBody.trim(),
    }).select("id").single();
    console.log("[Message sent]", { newMsg: sentMsg, error: sendErr });

    if (sendErr || !sentMsg) {
      const isTierDenial =
        sendErr?.code === "42501" ||
        /permission denied|row-level security|policy/i.test(sendErr?.message ?? "");

      setErrorToast({
        message: isTierDenial
          ? "L'envoi de messages nécessite un abonnement Pro."
          : "Impossible d'envoyer le message. Réessaie dans un instant.",
        showUpgrade: isTierDenial,
      });
      setSending(false);
      return;
    }

    // Update conversation
    await supabase.from("conversations").update({
      last_message_at: new Date().toISOString(),
      status: "ACTIVE",
    }).eq("id", convId);

    setShowToast(true);
    setTimeout(() => router.push("/recruteur/messages"), 1500);
  }, [selectedAthlete, messageBody, sending, router]);

  const canSend = selectedAthlete && messageBody.trim().length > 10 && !sending;

  return (
    <>
      <SuccessToast visible={showToast} />
      <ErrorToast data={errorToast} onDismiss={() => setErrorToast(null)} />

      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href="/recruteur/messages" className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Retour aux messages
          </Link>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Nouveau message</h1>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* LEFT: Compose form */}
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">Sélectionner un athlète</label>
              <AthleteCombobox selected={selectedAthlete} onSelect={handleSelectAthlete} onClear={handleClearAthlete} athletes={athletes} />
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">Destinataire (Coach)</label>
              {selectedAthlete ? (
                <div className="flex items-center gap-3 bg-[#13151a] border border-[#2D3748] rounded-lg px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-white">{selectedAthlete.coachFirstName} {selectedAthlete.coachLastName}</p>
                    <p className="text-[12px] text-[#6b7280]">{selectedAthlete.school}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-[#13151a] border border-[#2D3748] border-dashed rounded-lg px-4 py-3 text-[13px] text-[#4a4d56]">
                  Sélectionne un athlète pour identifier le coach destinataire
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">Message</label>
              <textarea rows={12} value={messageBody} onChange={(e) => setMessageBody(e.target.value)} placeholder={selectedAthlete ? "" : "Sélectionne un athlète pour générer un gabarit de message..."} className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none leading-relaxed" />
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={handleSend} disabled={!canSend} className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-[14px] font-bold transition-all ${canSend ? "bg-[#E63946] hover:bg-[#D42B22] text-white cursor-pointer shadow-lg shadow-[#E63946]/20" : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"}`}>
                {sending ? (
                  <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>Envoi en cours...</>
                ) : (
                  <>Envoyer le message <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg></>
                )}
              </button>
              <Link href="/recruteur/messages" className="text-[13px] text-[#6b7280] hover:text-white transition-colors">Annuler</Link>
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-5">
            {selectedAthlete ? (
              <>
                <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5">
                  <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-4">Athlète sélectionné</p>

                  {/* Athlete header */}
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0" style={{ overflow: "visible" }}>
                      <div className="w-11 h-11 rounded-full bg-[#E63946]/15 border-2 border-[#E63946]/30 flex items-center justify-center">
                        <span className="text-[13px] font-bold text-[#E63946]">{selectedAthlete.firstName[0]}{selectedAthlete.lastName[0]}</span>
                      </div>
                      {selectedAthlete.isVerified && (
                        <div className="absolute -top-0.5 -right-0.5 z-10">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#3B82F6" stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-bold text-white">{selectedAthlete.firstName} {selectedAthlete.lastName}</span>
                        {selectedAthlete.jersey && <span className="text-[12px] font-black text-[#E63946]">#{selectedAthlete.jersey}</span>}
                      </div>
                      <p className="text-[12px] text-[#6b7280] mt-0.5">{selectedAthlete.school}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {selectedAthlete.position && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">{selectedAthlete.position}</span>}
                        <StarRating rating={selectedAthlete.stars} size="sm" />
                      </div>
                      <div className="mt-2">
                        <RecruitmentStatusBadge status={selectedAthlete.recruitmentStatus as GlobalRecruitmentStatus} size="sm" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#2D3748]">
                    <Link href={`/recruteur/athletes/${selectedAthlete.id}`} className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">Voir le profil →</Link>
                  </div>
                </div>

                {/* Coach card */}
                <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5">
                  <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-4">Coach destinataire</p>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-bold text-[#9CA3AF]">{selectedAthlete.coachFirstName[0] || ""}{selectedAthlete.coachLastName[0] || ""}</span>
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-white">{selectedAthlete.coachFirstName} {selectedAthlete.coachLastName}</p>
                      <p className="text-[12px] text-[#9CA3AF]">Entraîneur</p>
                      <p className="text-[12px] text-[#6b7280]">{selectedAthlete.school}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-[#1A1D24] border border-[#2D3748] border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </div>
                <p className="text-[13px] text-[#6b7280] leading-relaxed max-w-[200px]">Sélectionne un athlète pour voir sa carte et identifier le coach destinataire</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
