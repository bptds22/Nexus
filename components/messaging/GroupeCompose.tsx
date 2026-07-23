"use client";

/* ═══════════════════════════════════════════════════════════════
   GroupeCompose — step-4 "Groupe" broadcast (option a). Pick an
   audience → write a message → send_broadcast creates N individual
   1-on-1 threads (gated per-recipient server-side). Shows "Envoyé à N".

   Coach/director sender : plusieurs entraîneurs · tous les entraîneurs ·
   plusieurs athlètes · tous les athlètes · une équipe.
   Recruiter sender      : coachs des athlètes favoris (favorited_coaches).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadSchoolStaff, type StaffMember } from "@/lib/queries/messaging/loadSchoolStaff";
import { sendBroadcast, type BroadcastAudience } from "@/lib/queries/messaging/sendBroadcast";

const HUE = "#8B5CF6"; // Groupe = violet (distinct from teal/red/green/blue)

type Mode = "coaches" | "all_coaches" | "athletes" | "all_athletes" | "team" | "favorited_coaches";
interface Opt { id: string; name: string; sub?: string; }

export default function GroupeCompose({
  selfId,
  role,
  onSent,
}: {
  selfId: string;
  role: "COACH" | "RECRUTEUR";
  onSent: (sent: number) => void;
}) {
  const isRecruiter = role === "RECRUTEUR";
  const [mode, setMode] = useState<Mode>(isRecruiter ? "favorited_coaches" : "all_athletes");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [athletes, setAthletes] = useState<Opt[]>([]);
  const [teams, setTeams] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(!isRecruiter);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [teamId, setTeamId] = useState<string>("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isRecruiter) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const st = await loadSchoolStaff(supabase, selfId);
      const { data: me } = await supabase.from("users").select("school_id").eq("id", selfId).maybeSingle();
      const schoolId = (me as { school_id?: string } | null)?.school_id;
      let aths: Opt[] = []; let tms: Opt[] = [];
      if (schoolId) {
        const { data: a } = await supabase.from("athletes")
          .select("id, first_name, last_name, positions!position_id(abreviation)")
          .eq("school_id", schoolId).eq("status", "ACTIF").order("last_name");
        aths = (a ?? []).map((r) => {
          const posRaw = (r as { positions?: unknown }).positions;
          const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string } | null;
          return { id: (r as { id: string }).id, name: `${(r as { first_name?: string }).first_name || ""} ${(r as { last_name?: string }).last_name || ""}`.trim() || "Athlète", sub: pos?.abreviation || "" };
        });
        const { data: t } = await supabase.from("teams")
          .select("id, name").eq("school_id", schoolId).eq("is_active", true).order("name");
        tms = (t ?? []).map((r) => ({ id: (r as { id: string }).id, name: (r as { name?: string }).name || "Équipe" }));
      }
      if (!cancelled) { setStaff(st); setAthletes(aths); setTeams(tms); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selfId, isRecruiter]);

  function toggle(id: string) {
    setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const MODES: { key: Mode; label: string }[] = isRecruiter
    ? [{ key: "favorited_coaches", label: "Coachs des athlètes favoris" }]
    : [
        { key: "all_athletes", label: "Tous les athlètes" },
        { key: "athletes", label: "Athlètes (sélection)" },
        { key: "all_coaches", label: "Tous les entraîneurs" },
        { key: "coaches", label: "Entraîneurs (sélection)" },
        { key: "team", label: "Une équipe" },
      ];

  const audience: BroadcastAudience | null = useMemo(() => {
    switch (mode) {
      case "all_athletes": return { kind: "all_athletes" };
      case "all_coaches": return { kind: "all_coaches" };
      case "favorited_coaches": return { kind: "favorited_coaches" };
      case "athletes": return checked.size ? { kind: "athletes", ids: [...checked] } : null;
      case "coaches": return checked.size ? { kind: "coaches", ids: [...checked] } : null;
      case "team": return teamId ? { kind: "team", team_id: teamId } : null;
      default: return null;
    }
  }, [mode, checked, teamId]);

  const canSend = !!audience && content.trim().length > 0 && !sending;

  async function handleSend() {
    if (!audience || !canSend) return;
    setSending(true); setError(null);
    const { sent, error: err } = await sendBroadcast(createClient(), audience, content.trim());
    if (err) {
      setError((err as { message?: string }).message || "Diffusion impossible.");
      setSending(false);
      return;
    }
    onSent(sent ?? 0);
  }

  function setModeReset(m: Mode) { setMode(m); setChecked(new Set()); setTeamId(""); }

  return (
    <div className="space-y-5" style={{ "--hue": HUE } as React.CSSProperties}>
      {/* Mode chips */}
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button key={m.key} type="button" onClick={() => setModeReset(m.key)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors border ${
              mode === m.key ? "bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#A78BFA]" : "bg-[#13151a] border-[#2D3748] text-[#9CA3AF] hover:text-white"}`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Sub-picker per mode */}
      {loading ? (
        <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" /></div>
      ) : mode === "all_athletes" ? (
        <p className="text-[13px] text-[#9CA3AF]">Le message ira à <b className="text-white">tous les athlètes actifs de ton école</b> (un fil individuel chacun).</p>
      ) : mode === "all_coaches" ? (
        <p className="text-[13px] text-[#9CA3AF]">Le message ira à <b className="text-white">tous les entraîneurs de ton école</b>.</p>
      ) : mode === "favorited_coaches" ? (
        <p className="text-[13px] text-[#9CA3AF]">Le message ira aux <b className="text-white">coachs des athlètes que tu as mis en favori</b>.</p>
      ) : mode === "team" ? (
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
          className="w-full bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[14px] text-white focus:border-[#8B5CF6] outline-none">
          <option value="">Choisir une équipe…</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      ) : (
        <div className="max-h-[240px] overflow-y-auto rounded-lg border border-[#2D3748] divide-y divide-[#2D3748]/60">
          {(mode === "coaches" ? staff.map((s) => ({ id: s.id, name: s.name, sub: s.roleLabel })) : athletes).map((o) => (
            <label key={o.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/5">
              <input type="checkbox" checked={checked.has(o.id)} onChange={() => toggle(o.id)} className="sr-only" />
              <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${checked.has(o.id) ? "bg-[#8B5CF6]" : "border-2 border-[#4a4d56]"}`}>
                {checked.has(o.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </span>
              <span className="min-w-0 flex-1"><span className="text-[14px] text-white">{o.name}</span>{o.sub ? <span className="text-[12px] text-[#6b7280]"> · {o.sub}</span> : null}</span>
            </label>
          ))}
          {(mode === "coaches" ? staff.length : athletes.length) === 0 && <p className="px-4 py-4 text-[13px] text-[#6b7280]">Aucun destinataire disponible.</p>}
        </div>
      )}

      {/* Message */}
      <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)}
        placeholder="Ton message de diffusion…"
        className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#8B5CF6] outline-none resize-none leading-relaxed" />

      {error && <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">{error}</div>}

      <button type="button" onClick={handleSend} disabled={!canSend}
        className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-[14px] font-bold transition-all ${canSend ? "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white" : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"}`}>
        {sending ? "Envoi…" : "Envoyer la diffusion"}
      </button>
    </div>
  );
}
