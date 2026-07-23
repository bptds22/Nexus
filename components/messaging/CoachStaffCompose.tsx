"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachStaffCompose — COACH_COACH (P4) compose panel. Pick a same-
   school staff recipient (filtered by audience), optionally attach an
   athlete ("À propos d'un athlète (optionnel)"), find-or-create the
   thread, then hand the id back (the first message is written in the
   thread view, like the athlete↔coach flow).

   audience : "coach" → non-directors · "directeur" → directors ·
   "ecole" → all staff.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadSchoolStaff, type StaffMember } from "@/lib/queries/messaging/loadSchoolStaff";
import { findOrCreateCoachCoachConversation } from "@/lib/queries/messaging/createCoachCoachConversation";

interface AthleteOpt { id: string; name: string; position: string; photoUrl: string | null; }

function initials(name: string): string {
  return (name || "?").split(" ").map((p) => p[0] || "").join("").slice(0, 2).toUpperCase() || "?";
}

export default function CoachStaffCompose({
  selfId,
  audience,
  onCreated,
}: {
  selfId: string;
  audience: "coach" | "directeur" | "ecole";
  onCreated: (conversationId: string) => void;
}) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [athletes, setAthletes] = useState<AthleteOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachOn, setAttachOn] = useState(false);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const list = await loadSchoolStaff(supabase, selfId);
      // Athletes at my school (RLS "coaches read own athletes" allows school-wide).
      const { data: me } = await supabase.from("users").select("school_id").eq("id", selfId).maybeSingle();
      let athOpts: AthleteOpt[] = [];
      const schoolId = (me as { school_id?: string } | null)?.school_id;
      if (schoolId) {
        const { data: aths } = await supabase
          .from("athletes")
          .select("id, first_name, last_name, photo_url, positions!position_id(abreviation, nom)")
          .eq("school_id", schoolId)
          .eq("status", "ACTIF")
          .order("last_name", { ascending: true });
        athOpts = (aths ?? []).map((a) => {
          const posRaw = (a as { positions?: unknown }).positions;
          const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string; nom?: string } | null;
          const af = (a as { first_name?: string }).first_name || "";
          const al = (a as { last_name?: string }).last_name || "";
          return {
            id: (a as { id: string }).id,
            name: `${af} ${al}`.trim() || "Athlète",
            position: pos?.abreviation || pos?.nom || "",
            photoUrl: (a as { photo_url?: string }).photo_url ?? null,
          };
        });
      }
      if (!cancelled) { setStaff(list); setAthletes(athOpts); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selfId]);

  const filtered = useMemo(() => {
    if (audience === "directeur") return staff.filter((s) => s.isDirector);
    if (audience === "coach") return staff.filter((s) => !s.isDirector);
    return staff;
  }, [staff, audience]);

  async function pick(s: StaffMember) {
    if (busyId) return;
    setBusyId(s.id);
    setError(null);
    const supabase = createClient();
    const { conversationId, error: err } = await findOrCreateCoachCoachConversation(supabase, {
      selfId,
      otherCoachId: s.id,
      athleteId: attachOn ? athleteId : null,
    });
    if (err || !conversationId) {
      const code = (err as { code?: string } | undefined)?.code;
      const isRls = code === "42501" || /permission denied|row-level security|policy/i.test((err as { message?: string } | undefined)?.message ?? "");
      setError(isRls ? "Tu ne peux écrire qu'au personnel de ton école." : ((err as { message?: string } | undefined)?.message || "Impossible d'ouvrir la conversation."));
      setBusyId(null);
      return;
    }
    onCreated(conversationId);
  }

  const emptyCopy =
    audience === "directeur" ? "Aucun directeur sportif rattaché à ton école." :
    audience === "coach" ? "Aucun autre entraîneur rattaché à ton école." :
    "Aucun autre membre du personnel à ton école.";

  return (
    <div className="space-y-5">
      {/* Optional athlete attach */}
      <div className="rounded-xl border border-[#2D3748] bg-[#13151a] p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={attachOn} onChange={(e) => { setAttachOn(e.target.checked); if (!e.target.checked) setAthleteId(null); }} className="sr-only" />
          <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${attachOn ? "bg-[#14B8A6]" : "border-2 border-[#4a4d56]"}`}>
            {attachOn && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
          </span>
          <span className="text-[14px] font-semibold text-white">À propos d&apos;un athlète <span className="text-[#6b7280] font-normal">(optionnel)</span></span>
        </label>
        {attachOn && (
          <select
            value={athleteId ?? ""}
            onChange={(e) => setAthleteId(e.target.value || null)}
            className="mt-3 w-full bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[14px] text-white focus:border-[#14B8A6] outline-none"
          >
            <option value="">Aucun athlète précis</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.position ? ` · ${a.position}` : ""}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5"><p className="text-[14px] text-[#9CA3AF]">{emptyCopy}</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={!!busyId}
              onClick={() => pick(s)}
              className="text-left rounded-xl p-4 flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] hover:border-[#14B8A6]/60 transition-colors disabled:opacity-50"
            >
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photoUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0"><span className="text-[12px] font-bold text-white">{initials(s.name)}</span></div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-white truncate">{s.name}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.isDirector ? "bg-[#14B8A6]/12 border-[#14B8A6]/30 text-[#14B8A6]" : "bg-[#2D3748] border-transparent text-[#9CA3AF]"}`}>{s.roleLabel}</span>
                {s.context && <p className="text-[11px] text-[#6b7280] truncate mt-1">{s.context}</p>}
              </div>
              {busyId === s.id && <div className="w-4 h-4 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
