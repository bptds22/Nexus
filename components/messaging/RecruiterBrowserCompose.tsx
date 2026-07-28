"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruiterBrowserCompose — coach/director → recruiter (OPEN, no favoris).
   Browse a CÉGEP → its recruiters → pick which of MY athletes the message
   concerns → find-or-create RECRUTEUR_COACH → route into the thread.
   Anchor = the coach's own athlete (RLS coach_initiate_recruteur_coach).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { findOrCreateRecruiterCoachConversation } from "@/lib/queries/messaging/createRecruiterCoachConversation";
import AthleteSelectCard from "@/components/messaging/AthleteSelectCard";

interface Cegep { id: string; name: string; }
interface Recruiter { id: string; name: string; photoUrl: string | null; }
interface Ath { id: string; firstName: string; lastName: string; name: string; sport: string; position: string; photoUrl: string | null; stars: number; }

function initials(n: string) { return (n || "?").split(" ").map((p) => p[0] || "").join("").slice(0, 2).toUpperCase() || "?"; }

export default function RecruiterBrowserCompose({
  selfId,
  onCreated,
}: {
  selfId: string;
  onCreated: (conversationId: string) => void;
}) {
  const [cegeps, setCegeps] = useState<Cegep[]>([]);
  const [myAthletes, setMyAthletes] = useState<Ath[]>([]);
  const [loading, setLoading] = useState(true);
  const [cegep, setCegep] = useState<Cegep | null>(null);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loadingRec, setLoadingRec] = useState(false);
  const [recruiter, setRecruiter] = useState<Recruiter | null>(null);
  const [busyAthlete, setBusyAthlete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      // CÉGEPs that have ≥1 registered recruiter (PII-minimal: school only).
      const { data: rec } = await supabase.from("users").select("school_id, schools!school_id(id, name)").eq("role", "RECRUTEUR").not("school_id", "is", null);
      const seen = new Set<string>(); const list: Cegep[] = [];
      for (const row of (rec ?? []) as Record<string, unknown>[]) {
        const sid = row.school_id as string | null; if (!sid || seen.has(sid)) continue; seen.add(sid);
        const s = (Array.isArray(row.schools) ? row.schools[0] : row.schools) as { name?: string } | null;
        list.push({ id: sid, name: s?.name || "" });
      }
      list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      // My athletes (own roster).
      const { data: aths } = await supabase.from("athletes").select("id, first_name, last_name, photo_url, cote_globale_entraineur, sports!sport_id(nom), positions!position_id(abreviation)").eq("coach_id", selfId).eq("status", "ACTIF").order("last_name");
      const mine: Ath[] = (aths ?? []).map((a) => {
        const p = (Array.isArray((a as { positions?: unknown }).positions) ? (a as { positions: unknown[] }).positions[0] : (a as { positions?: unknown }).positions) as { abreviation?: string } | null;
        const s = (Array.isArray((a as { sports?: unknown }).sports) ? (a as { sports: unknown[] }).sports[0] : (a as { sports?: unknown }).sports) as { nom?: string } | null;
        const af = (a as { first_name?: string }).first_name || "";
        const al = (a as { last_name?: string }).last_name || "";
        return { id: (a as { id: string }).id, firstName: af, lastName: al, name: `${af} ${al}`.trim() || "Athlète", sport: s?.nom || "", position: p?.abreviation || "", photoUrl: (a as { photo_url?: string }).photo_url ?? null, stars: Number((a as { cote_globale_entraineur?: number }).cote_globale_entraineur) || 0 };
      });
      if (!cancelled) { setCegeps(list); setMyAthletes(mine); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selfId]);

  async function pickCegep(c: Cegep) {
    setCegep(c); setRecruiter(null); setRecruiters([]); setLoadingRec(true); setError(null);
    const supabase = createClient();
    const { data } = await supabase.from("users").select("id, first_name, last_name, photo_url, avatar_url").eq("role", "RECRUTEUR").eq("school_id", c.id).order("last_name");
    setRecruiters((data ?? []).map((r) => ({ id: (r as { id: string }).id, name: `${(r as { first_name?: string }).first_name || ""} ${(r as { last_name?: string }).last_name || ""}`.trim() || "Recruteur", photoUrl: ((r as { photo_url?: string }).photo_url) || ((r as { avatar_url?: string }).avatar_url) || null })));
    setLoadingRec(false);
  }

  async function pickAthlete(athleteId: string) {
    if (!recruiter || busyAthlete) return;
    setBusyAthlete(athleteId); setError(null);
    const { conversationId, error: err } = await findOrCreateRecruiterCoachConversation(createClient(), { selfId, recruiterId: recruiter.id, athleteId });
    if (err || !conversationId) {
      const code = (err as { code?: string } | undefined)?.code;
      const isRls = code === "42501" || /permission denied|row-level security|policy/i.test((err as { message?: string } | undefined)?.message ?? "");
      setError(isRls ? "Tu ne peux écrire qu'au sujet d'un de tes athlètes." : ((err as { message?: string } | undefined)?.message || "Impossible d'ouvrir la conversation."));
      setBusyAthlete(null); return;
    }
    onCreated(conversationId);
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" /></div>;

  /* Step 3 — pick which of MY athletes. */
  if (recruiter) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setRecruiter(null)} className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>Changer de recruteur</button>
        <div><p className="text-[14px] font-bold text-white">{recruiter.name}</p><p className="text-[12px] text-[#6b7280]">{cegep?.name}</p></div>
        <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">À propos de quel athlète&nbsp;?</p>
        {error && <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">{error}</div>}
        {myAthletes.length === 0 ? (
          <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5"><p className="text-[14px] text-[#9CA3AF]">Tu n&apos;as pas encore d&apos;athlète dans ton roster.</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myAthletes.map((a) => (
              <AthleteSelectCard
                key={a.id}
                firstName={a.firstName}
                lastName={a.lastName}
                name={a.name}
                photoUrl={a.photoUrl}
                sport={a.sport}
                position={a.position}
                stars={a.stars}
                disabled={!!busyAthlete}
                busy={busyAthlete === a.id}
                onClick={() => pickAthlete(a.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* Step 2 — pick a recruiter at the chosen CÉGEP. */
  if (cegep) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => { setCegep(null); setRecruiters([]); }} className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>Changer de CÉGEP</button>
        <p className="text-[14px] font-bold text-white">{cegep.name}</p>
        {loadingRec ? <div className="flex items-center gap-2 text-[13px] text-[#6b7280] py-4"><span className="w-3 h-3 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />Chargement des recruteurs…</div>
        : recruiters.length === 0 ? <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5"><p className="text-[14px] text-[#9CA3AF]">Aucun recruteur inscrit à ce CÉGEP.</p></div>
        : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recruiters.map((r) => (
              <button key={r.id} type="button" onClick={() => setRecruiter(r)} className="text-left rounded-xl p-4 flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] hover:border-[#E63946]/60 transition-colors">
                {r.photoUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={r.photoUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />) : (<div className="w-11 h-11 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0"><span className="text-[12px] font-bold text-white">{initials(r.name)}</span></div>)}
                <p className="text-[14px] font-bold text-white truncate flex-1">{r.name}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* Step 1 — pick a CÉGEP. */
  const shown = q.trim() ? cegeps.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : cegeps;
  return (
    <div className="space-y-3">
      <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">Choisis un CÉGEP</p>
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un CÉGEP…" className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none" />
      </div>
      <div className="max-h-[360px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
        {shown.map((c) => (
          <button key={c.id} type="button" onClick={() => pickCegep(c)} className="text-left rounded-lg px-4 py-3 flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] hover:border-[#E63946]/60 transition-colors">
            <span className="w-9 h-9 rounded-lg bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /></svg></span>
            <span className="text-[14px] font-semibold text-white truncate">{c.name}</span>
          </button>
        ))}
        {shown.length === 0 && <p className="text-[13px] text-[#6b7280] px-1 py-2">Aucun CÉGEP avec un recruteur inscrit.</p>}
      </div>
    </div>
  );
}
