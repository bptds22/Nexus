"use client";

/* ═══════════════════════════════════════════════════════════════
   InterestedRecruiterCompose — step-3 "Recruteurs intéressés" panel.
   Favoris-symmetric ONLY : lists recruiters who favorited one of the
   coach's athletes → pick recruiter → pick which favorited athlete the
   message concerns (❤ marker) → find-or-create RECRUTEUR_COACH → route
   into the thread (first message written there, like the other flows).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadInterestedRecruiters, type InterestedRecruiter } from "@/lib/queries/messaging/loadInterestedRecruiters";
import { findOrCreateRecruiterCoachConversation } from "@/lib/queries/messaging/createRecruiterCoachConversation";
import AthleteSelectCard from "@/components/messaging/AthleteSelectCard";

function initials(name: string): string {
  return (name || "?").split(" ").map((p) => p[0] || "").join("").slice(0, 2).toUpperCase() || "?";
}

export default function InterestedRecruiterCompose({
  selfId,
  onCreated,
}: {
  selfId: string;
  onCreated: (conversationId: string) => void;
}) {
  const [list, setList] = useState<InterestedRecruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<InterestedRecruiter | null>(null);
  const [busyAthlete, setBusyAthlete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await loadInterestedRecruiters(createClient());
      if (!cancelled) { setList(rows); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function pickAthlete(athleteId: string) {
    if (!picked || busyAthlete) return;
    setBusyAthlete(athleteId);
    setError(null);
    const { conversationId, error: err } = await findOrCreateRecruiterCoachConversation(createClient(), {
      selfId, recruiterId: picked.recruiterId, athleteId,
    });
    if (err || !conversationId) {
      const code = (err as { code?: string } | undefined)?.code;
      const isRls = code === "42501" || /permission denied|row-level security|policy/i.test((err as { message?: string } | undefined)?.message ?? "");
      setError(isRls ? "Ce recruteur n'a pas (ou plus) cet athlète en favori." : ((err as { message?: string } | undefined)?.message || "Impossible d'ouvrir la conversation."));
      setBusyAthlete(null);
      return;
    }
    onCreated(conversationId);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (list.length === 0) {
    return (
      <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5">
        <p className="text-[14px] text-[#9CA3AF]">Aucun recruteur n&apos;a encore mis un de tes athlètes en favori.</p>
        <p className="text-[12px] text-[#6b7280] mt-1">Dès qu&apos;un recruteur CÉGEP favorise un de tes athlètes, il apparaîtra ici et tu pourras le contacter.</p>
      </div>
    );
  }

  /* Step 2 — a recruiter is picked : choose which favorited athlete. */
  if (picked) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setPicked(null)} className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Changer de recruteur
        </button>
        <div>
          <p className="text-[14px] font-bold text-white">{picked.name}</p>
          <p className="text-[12px] text-[#6b7280]">{picked.cegep}</p>
        </div>
        <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">À propos de quel athlète&nbsp;?</p>
        {error && <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {picked.athletes.map((a) => (
            <AthleteSelectCard
              key={a.id}
              name={a.name}
              disabled={!!busyAthlete}
              busy={busyAthlete === a.id}
              onClick={() => pickAthlete(a.id)}
              meta={
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E63946] mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#E63946" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                  En favori chez ce recruteur
                </span>
              }
            />
          ))}
        </div>
      </div>
    );
  }

  /* Step 1 — pick a recruiter. */
  return (
    <div className="space-y-3">
      <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">{list.length} recruteur{list.length > 1 ? "s" : ""} intéressé{list.length > 1 ? "s" : ""}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {list.map((r) => (
          <button key={r.recruiterId} type="button" onClick={() => { setPicked(r); setError(null); }}
            className="text-left rounded-xl p-4 flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] hover:border-[#E63946]/60 transition-colors">
            {r.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photoUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0"><span className="text-[12px] font-bold text-white">{initials(r.name)}</span></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-white truncate">{r.name}</p>
              <p className="text-[12px] text-[#6b7280] truncate">{r.cegep}</p>
              <p className="text-[11px] text-[#E63946] mt-0.5">{r.athletes.length} athlète{r.athletes.length > 1 ? "s" : ""} en favori</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
