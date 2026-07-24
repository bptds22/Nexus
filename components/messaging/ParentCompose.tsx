"use client";

/* ═══════════════════════════════════════════════════════════════
   ParentCompose — coach/director → the linked parent of one of MY
   athletes. Step 1 pick an athlete from my roster → step 2 pick that
   athlete's linked parent (list_athlete_parents, DEFINER-gated by
   coach_reaches_athlete) → find-or-create PARENT_COACH → route in.
   coach_id = self ; RLS coach_initiate_parent_coach.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { findOrCreateParentCoachConversation } from "@/lib/queries/messaging/createParentCoachConversation";

interface Ath { id: string; name: string; photoUrl: string | null; }
interface Parent { id: string; name: string; }

function initials(n: string) { return (n || "?").split(" ").map((p) => p[0] || "").join("").slice(0, 2).toUpperCase() || "?"; }

export default function ParentCompose({
  selfId,
  onCreated,
}: {
  selfId: string;
  onCreated: (conversationId: string) => void;
}) {
  const [athletes, setAthletes] = useState<Ath[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Ath | null>(null);
  const [parents, setParents] = useState<Parent[]>([]);
  const [parentsLoading, setParentsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.from("athletes")
        .select("id, first_name, last_name, photo_url")
        .eq("coach_id", selfId).eq("status", "ACTIF").order("last_name");
      const mine: Ath[] = (data ?? []).map((a) => ({
        id: (a as { id: string }).id,
        name: `${(a as { first_name?: string }).first_name || ""} ${(a as { last_name?: string }).last_name || ""}`.trim() || "Athlète",
        photoUrl: ((a as { photo_url?: string }).photo_url) || null,
      }));
      if (!cancelled) { setAthletes(mine); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selfId]);

  async function pickAthlete(a: Ath) {
    setPicked(a); setError(null); setParents([]); setParentsLoading(true);
    const { data, error: err } = await createClient().rpc("list_athlete_parents", { p_athlete_id: a.id });
    if (err) { setError("Impossible de charger les parents."); setParentsLoading(false); return; }
    const rows = (data ?? []) as { parent_user_id: string; first_name: string | null; last_name: string | null }[];
    setParents(rows.map((r) => ({ id: r.parent_user_id, name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Parent" })));
    setParentsLoading(false);
  }

  async function pickParent(parent: Parent) {
    if (busy || !picked) return;
    setBusy(parent.id); setError(null);
    const { conversationId, error: err } = await findOrCreateParentCoachConversation(createClient(), {
      parentId: parent.id, coachId: selfId, athleteId: picked.id,
    });
    if (err || !conversationId) {
      const code = (err as { code?: string } | undefined)?.code;
      const isRls = code === "42501" || /permission denied|row-level security|policy/i.test((err as { message?: string } | undefined)?.message ?? "");
      setError(isRls ? "Tu ne peux écrire qu'au parent lié à un de tes athlètes." : ((err as { message?: string } | undefined)?.message || "Impossible d'ouvrir la conversation."));
      setBusy(null); return;
    }
    onCreated(conversationId);
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" /></div>;

  // Step 2 — pick the athlete's parent.
  if (picked) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => { setPicked(null); setParents([]); }} className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Changer d&apos;athlète
        </button>
        <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">Parent de {picked.name}</p>
        {error && <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">{error}</div>}
        {parentsLoading ? (
          <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" /></div>
        ) : parents.length === 0 ? (
          <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5"><p className="text-[14px] text-[#9CA3AF]">Aucun parent lié à cet athlète.</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {parents.map((p) => (
              <button key={p.id} type="button" disabled={!!busy} onClick={() => pickParent(p)} className="text-left rounded-xl p-4 flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] hover:border-[#E63946]/60 transition-colors disabled:opacity-50">
                <div className="w-11 h-11 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center shrink-0"><span className="text-[12px] font-bold text-[#E63946]">{initials(p.name)}</span></div>
                <div className="min-w-0 flex-1"><p className="text-[14px] font-bold text-white truncate">{p.name}</p><p className="text-[12px] text-[#6b7280]">Parent</p></div>
                {busy === p.id && <div className="w-4 h-4 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 1 — pick one of my athletes.
  const shown = q.trim() ? athletes.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())) : athletes;
  return (
    <div className="space-y-3">
      <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">Écris au parent d&apos;un de tes athlètes</p>
      {athletes.length === 0 ? (
        <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5"><p className="text-[14px] text-[#9CA3AF]">Tu n&apos;as pas encore d&apos;athlète dans ton roster.</p></div>
      ) : (
        <>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un athlète…" className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none" />
          </div>
          <div className="max-h-[360px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shown.map((a) => (
              <button key={a.id} type="button" onClick={() => pickAthlete(a)} className="text-left rounded-xl p-4 flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] hover:border-[#E63946]/60 transition-colors">
                {a.photoUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={a.photoUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />) : (<div className="w-11 h-11 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0"><span className="text-[12px] font-bold text-white">{initials(a.name)}</span></div>)}
                <div className="min-w-0 flex-1"><p className="text-[14px] font-bold text-white truncate">{a.name}</p><p className="text-[12px] text-[#6b7280]">Voir le parent →</p></div>
              </button>
            ))}
            {shown.length === 0 && <p className="text-[13px] text-[#6b7280] px-1 py-2">Aucun athlète.</p>}
          </div>
        </>
      )}
    </div>
  );
}
