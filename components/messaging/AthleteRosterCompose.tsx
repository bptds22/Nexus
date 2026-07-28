"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteRosterCompose — coach/director → one of MY athletes.
   Pick from the coach's own roster → find-or-create ATHLETE_COACH
   (same Q4 path as "Envoyer un message" on an athlete) → route into
   the thread. coach_id = self ; RLS coach_athlete_conversations_insert.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { findOrCreateAthleteCoachConversation } from "@/lib/queries/messaging/createAthleteCoachConversation";
import { loadTeamAthleteIds } from "@/lib/queries/coach/teamAthleteIds";

interface Ath { id: string; name: string; position: string; photoUrl: string | null; }

function initials(n: string) { return (n || "?").split(" ").map((p) => p[0] || "").join("").slice(0, 2).toUpperCase() || "?"; }

export default function AthleteRosterCompose({
  selfId,
  onCreated,
}: {
  selfId: string;
  onCreated: (conversationId: string) => void;
}) {
  const [athletes, setAthletes] = useState<Ath[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      // Owned (coach_id = self) OU rattaché à une équipe que ce coach coache
      // (autorité d'équipe, BP). coach_id reste le lien propriétaire inchangé.
      const teamIds = await loadTeamAthleteIds(supabase, selfId);
      const sel = supabase.from("athletes")
        .select("id, first_name, last_name, photo_url, positions!position_id(abreviation)")
        .eq("status", "ACTIF").order("last_name");
      // `.or` + `.eq("status", …)` se combinent en AND → statut gardé séparé.
      const { data } = await (teamIds.length
        ? sel.or(`coach_id.eq.${selfId},id.in.(${teamIds.join(",")})`)
        : sel.eq("coach_id", selfId));
      const mine: Ath[] = (data ?? []).map((a) => {
        const p = (Array.isArray((a as { positions?: unknown }).positions) ? (a as { positions: unknown[] }).positions[0] : (a as { positions?: unknown }).positions) as { abreviation?: string } | null;
        return {
          id: (a as { id: string }).id,
          name: `${(a as { first_name?: string }).first_name || ""} ${(a as { last_name?: string }).last_name || ""}`.trim() || "Athlète",
          position: p?.abreviation || "",
          photoUrl: ((a as { photo_url?: string }).photo_url) || null,
        };
      });
      if (!cancelled) { setAthletes(mine); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selfId]);

  async function pick(athleteId: string) {
    if (busy) return;
    setBusy(athleteId); setError(null);
    const { conversationId, error: err } = await findOrCreateAthleteCoachConversation(createClient(), { athleteId, coachId: selfId });
    if (err || !conversationId) {
      const code = (err as { code?: string } | undefined)?.code;
      const isRls = code === "42501" || /permission denied|row-level security|policy/i.test((err as { message?: string } | undefined)?.message ?? "");
      setError(isRls ? "Tu ne peux écrire qu'à un de tes athlètes." : ((err as { message?: string } | undefined)?.message || "Impossible d'ouvrir la conversation."));
      setBusy(null); return;
    }
    onCreated(conversationId);
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" /></div>;

  const shown = q.trim() ? athletes.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())) : athletes;

  return (
    <div className="space-y-3">
      <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">Écris à un de tes athlètes</p>
      {error && <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">{error}</div>}
      {athletes.length === 0 ? (
        <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5"><p className="text-[14px] text-[#9CA3AF]">Tu n&apos;as pas encore d&apos;athlète dans ton roster.</p></div>
      ) : (
        <>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un athlète…" className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#22C55E] outline-none" />
          </div>
          <div className="max-h-[360px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shown.map((a) => (
              <button key={a.id} type="button" disabled={!!busy} onClick={() => pick(a.id)} className="text-left rounded-xl p-4 flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] hover:border-[#22C55E]/60 transition-colors disabled:opacity-50">
                {a.photoUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={a.photoUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />) : (<div className="w-11 h-11 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center shrink-0"><span className="text-[12px] font-bold text-[#22C55E]">{initials(a.name)}</span></div>)}
                <div className="min-w-0 flex-1"><p className="text-[14px] font-bold text-white truncate">{a.name}</p>{a.position && <p className="text-[12px] text-[#6b7280]">{a.position}</p>}</div>
                {busy === a.id && <div className="w-4 h-4 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin shrink-0" />}
              </button>
            ))}
            {shown.length === 0 && <p className="text-[13px] text-[#6b7280] px-1 py-2">Aucun athlète.</p>}
          </div>
        </>
      )}
    </div>
  );
}
