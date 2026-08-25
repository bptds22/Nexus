"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AthleteInfoCard from "@/components/recruteur/AthleteInfoCard";
import RetractedMessageRow from "@/components/messaging/RetractedMessageRow";
import { parseDistinctions } from "@/lib/config/badges";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { resolveProgrammesVisesAsync } from "@/lib/queries/shared/useCegepPrograms";

/* ═══════════════════════════════════════════════════════════════
   CoachAthleteThreadView — coach side of an ATHLETE_COACH thread.
   2-party ; the athlete is the counterparty (not a recruiter subject).
   Sidebar reuses the SAME "Athlète concerné" card (AthleteInfoCard) as the
   recruiter↔coach thread — WITHOUT the coach-reputation panel (a coach doesn't
   review themselves) — and its CTA routes to the coach athlete page.
   Rendered by the coach thread router when conversation_type is
   'ATHLETE_COACH'. Recruiter threads keep the original view untouched.
═══════════════════════════════════════════════════════════════ */

interface MessageData { id: string; senderId: string; content: string; createdAt: string; retracted: boolean; }
interface AthleteInfo {
  id: string; name: string; initials: string; photoUrl: string | null;
  jersey: string; sport: string; position: string; gradYear: number;
  verified: boolean; stars: number; school: string; region: string;
  recruitmentStatus: string; committedSchool: string; openToOffers: boolean | null;
  gpa: number; programmes: string[]; openRelocate: boolean; openPrivate: boolean;
  openAnglophone: boolean; distinctions: string[];
}

function relativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) { const n = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]; return n[d.getDay()]; }
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}
function formatDay(isoStr: string): string {
  const d = new Date(isoStr);
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function getDateKey(isoStr: string): string { return new Date(isoStr).toISOString().split("T")[0]; }

function DaySeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-[#2D3748]/50" />
      <span className="text-[11px] text-[#6b7280] font-medium capitalize">{formatDay(date)}</span>
      <div className="flex-1 h-px bg-[#2D3748]/50" />
    </div>
  );
}
function MessageBubble({ msg, isMe, otherName }: { msg: MessageData; isMe: boolean; otherName: string }) {
  if (msg.retracted) return <RetractedMessageRow text={msg.content} />;
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
      <p className="text-[11px] text-[#6b7280] mb-1.5">{isMe ? "Vous" : otherName} · {relativeTime(msg.createdAt)}</p>
      <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${isMe ? "bg-[#0A84FF] rounded-br-md" : "bg-[#262628] rounded-bl-md"}`}>
        <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
}

export default function CoachAthleteThreadView({ id }: { id: string }) {
  const [athlete, setAthlete] = useState<AthleteInfo | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setMeId(user.id);

        const { data: conv } = await supabase
          .from("conversations")
          .select(`
            id, athlete_id,
            athletes!athlete_id(
              id, first_name, last_name, photo_url, verified, cote_globale_entraineur,
              annee_diplomation, numero_jersey, recruitment_status, committed_school_id, open_to_offers,
              moyenne_generale, programme_cegep_vise, programmes_vises, pret_changer_region, ouvert_cegep_prive, ouvert_cegep_anglophone,
              sports!sport_id(nom),
              positions!position_id(nom, abreviation),
              schools!school_id(name, region),
              committed_school:schools!committed_school_id(name),
              evaluations(distinctions, updated_at)
            )
          `)
          .eq("id", id)
          .maybeSingle();
        if (!conv) { setLoading(false); return; }

        const aRaw = (conv as Record<string, unknown>).athletes;
        const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as Record<string, unknown> | null;
        const posRaw = a?.positions;
        const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string; nom?: string } | null;
        const schRaw = a?.schools;
        const sch = (Array.isArray(schRaw) ? schRaw[0] : schRaw) as { name?: string; region?: string } | null;
        const sportRaw = a?.sports;
        const sport = (Array.isArray(sportRaw) ? sportRaw[0] : sportRaw) as { nom?: string } | null;
        const committedRaw = a?.committed_school;
        const committed = (Array.isArray(committedRaw) ? committedRaw[0] : committedRaw) as { name?: string } | null;
        const evalRaw = a?.evaluations;
        const eval0 = selectBestEvaluation(Array.isArray(evalRaw) ? evalRaw : evalRaw ? [evalRaw] : []) as { distinctions?: unknown } | null;
        const distinctions: string[] = parseDistinctions(eval0?.distinctions).map((d) => d.badge);
        // T2 — la nouvelle colonne d'abord, l'ancienne en repli jusqu'a T3.
        const programmes: string[] = await resolveProgrammesVisesAsync(
          supabase, (a as Record<string, unknown> | null)?.programmes_vises, a?.programme_cegep_vise);
        const af = (a?.first_name as string) || "";
        const al = (a?.last_name as string) || "";
        setAthlete({
          id: (a?.id as string) || (conv.athlete_id as string) || "",
          name: `${af} ${al}`.trim() || "Athlète",
          initials: `${af[0] || ""}${al[0] || ""}`.toUpperCase() || "?",
          photoUrl: (a?.photo_url as string | null) ?? null,
          jersey: a?.numero_jersey ? String(a.numero_jersey) : "",
          sport: sport?.nom || "",
          position: pos?.abreviation || pos?.nom || "",
          gradYear: (a?.annee_diplomation as number) || 0,
          verified: !!(a?.verified),
          stars: (a?.cote_globale_entraineur as number) || 0,
          school: sch?.name || "",
          region: sch?.region || "",
          recruitmentStatus: (a?.recruitment_status as string) || "OUVERT",
          committedSchool: committed?.name || "",
          openToOffers: (a?.open_to_offers as boolean | null) ?? null,
          gpa: (a?.moyenne_generale as number) || 0,
          programmes,
          openRelocate: !!(a?.pret_changer_region),
          openPrivate: !!(a?.ouvert_cegep_prive),
          openAnglophone: !!(a?.ouvert_cegep_anglophone),
          distinctions,
        });

        const { data: msgs } = await supabase
          .from("messages")
          .select("id, sender_id, content, created_at, retracted_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });
        setMessages((msgs ?? []).map((m) => ({
          id: m.id as string, senderId: m.sender_id as string, content: (m.content as string) || "", createdAt: m.created_at as string, retracted: !!m.retracted_at,
        })));

        await supabase.rpc("mark_conversation_read", { p_conv: id });
      } catch (err) {
        console.error("[CoachAthleteThread] load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSend() {
    if (!reply.trim() || !meId) return;
    const body = reply.trim();
    setReply("");
    const optimistic: MessageData = { id: `tmp-${Date.now()}`, senderId: meId, content: body, createdAt: new Date().toISOString(), retracted: false };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const supabase = createClient();
      const { data: inserted } = await supabase
        .from("messages")
        .insert({ conversation_id: id, sender_id: meId, content: body })
        .select("id, sender_id, content, created_at, retracted_at")
        .single();
      if (inserted) {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? { id: inserted.id as string, senderId: inserted.sender_id as string, content: inserted.content as string, createdAt: inserted.created_at as string, retracted: false } : m));
      }
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);
    } catch (err) {
      console.error("[CoachAthleteThread] send failed:", err);
    }
  }

  const groups: { date: string; msgs: MessageData[] }[] = [];
  messages.forEach((m) => {
    const dk = getDateKey(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && getDateKey(last.date) === dk) last.msgs.push(m);
    else groups.push({ date: m.createdAt, msgs: [m] });
  });

  if (loading) {
    return <div className="min-h-screen bg-[#111317] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!athlete) {
    return (
      <div className="min-h-screen bg-[#111317] flex flex-col items-center justify-center gap-4">
        <p className="text-[#9CA3AF] text-[14px]">Conversation introuvable</p>
        <Link href="/coach/demandes" className="text-[#E63946] text-[14px] font-bold hover:text-[#ff4d5a]">Retour aux messages</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111317] flex flex-col">
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/coach/demandes" className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Retour
          </Link>
          <p className="text-[14px] font-bold text-white truncate">Conversation avec {athlete.name}</p>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E]">Athlète</span>
        </div>
      </div>

      <div className="flex-1 max-w-[1280px] mx-auto w-full flex flex-col xl:flex-row gap-0 xl:gap-6 px-6 py-6">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
            {messages.length === 0 ? (
              <p className="text-center text-[13px] text-[#6b7280] py-10">Aucun message pour l&apos;instant.</p>
            ) : (
              groups.map((g, gi) => (
                <div key={gi}>
                  <DaySeparator date={g.date} />
                  <div className="space-y-4">
                    {g.msgs.map((m) => <MessageBubble key={m.id} msg={m} isMe={m.senderId === meId} otherName={athlete.name} />)}
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          <div className="bg-[#1A1D24] border-t border-[#2D3748] p-4 rounded-b-xl">
            <div className="flex items-end gap-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Écrire un message..."
                rows={2}
                className="flex-1 bg-[#111317] border border-[#2D3748] rounded-xl px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#22C55E] outline-none transition-colors resize-none"
              />
              <button type="button" onClick={handleSend} disabled={!reply.trim()} className="shrink-0 w-11 h-11 rounded-xl bg-[#E63946] flex items-center justify-center text-white transition-all hover:bg-[#D42B22] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#E63946]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            </div>
            <p className="text-[10px] text-[#4a4d56] mt-2">Ctrl + Entrée pour envoyer</p>
          </div>
        </div>

        <div className="xl:w-[320px] shrink-0 space-y-4 mt-6 xl:mt-0">
          {/* Même carte "Athlète concerné" que le fil recruteur↔coach. PAS de
              panneau réputation coach ici (un coach ne s'évalue pas lui-même).
              Le CTA route vers la page athlète du portail coach. */}
          <AthleteInfoCard
            athleteId={athlete.id}
            athleteName={athlete.name}
            athleteInitials={athlete.initials}
            athletePhotoUrl={athlete.photoUrl || undefined}
            athleteJersey={athlete.jersey}
            athleteSport={athlete.sport}
            athletePosition={athlete.position}
            athleteGradYear={athlete.gradYear}
            athleteVerified={athlete.verified}
            athleteStars={athlete.stars}
            athleteSchool={athlete.school}
            athleteRegion={athlete.region}
            athleteRecruitmentStatus={athlete.recruitmentStatus}
            athleteCommittedSchool={athlete.committedSchool}
            athleteOpenToOffers={athlete.openToOffers}
            athleteGpa={athlete.gpa}
            athleteProgrammes={athlete.programmes}
            athleteOpenRelocate={athlete.openRelocate}
            athleteOpenPrivate={athlete.openPrivate}
            athleteOpenAnglophone={athlete.openAnglophone}
            athleteDistinctions={athlete.distinctions}
            profileHref={`/coach/athletes/${athlete.id}`}
          />
        </div>
      </div>
    </div>
  );
}
