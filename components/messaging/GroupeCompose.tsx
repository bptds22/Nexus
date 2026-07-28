"use client";

/* ═══════════════════════════════════════════════════════════════
   GroupeCompose — step-4 "Groupe" panel.

   Coach/directeur → VRAI groupe (chat de groupe) via createGroup :
     • Équipe               → { kind:'team', team_id }  (hybride staff+athlètes ;
                               réponses athlètes visibles staff seulement)
     • Tous les entraîneurs → { kind:'all_coaches' }    (groupe staff de l'école)
   Le RPC create_group seed les participants côté serveur (autorité légale,
   mineur-safety). On envoie le 1er message via l'insert `messages` normal
   (un trigger DB estampille l'audience, la RLS autorise si participant),
   puis on navigue vers le fil groupe (onCreated → /coach/demandes?id=…).

   Recruteur → pas de groupe : conserve la diffusion send_broadcast vers les
   coachs des athlètes favoris (favorited_coaches) — N fils individuels.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createGroup, type GroupAudience } from "@/lib/queries/messaging/createGroup";
import { sendBroadcast } from "@/lib/queries/messaging/sendBroadcast";

const HUE = "#8B5CF6"; // Groupe = violet (distinct from teal/red/green/blue)

type Mode = "team" | "all_coaches" | "favorited_coaches";
interface Opt { id: string; name: string; }

export default function GroupeCompose({
  selfId,
  role,
  onSent,
  onCreated,
}: {
  selfId: string;
  role: "COACH" | "RECRUTEUR";
  onSent: (sent: number) => void;
  onCreated?: (conversationId: string) => void;
}) {
  const isRecruiter = role === "RECRUTEUR";
  const [mode, setMode] = useState<Mode>(isRecruiter ? "favorited_coaches" : "team");
  const [teams, setTeams] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(!isRecruiter);
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
      const { data: me } = await supabase.from("users").select("school_id").eq("id", selfId).maybeSingle();
      const schoolId = (me as { school_id?: string } | null)?.school_id;
      let tms: Opt[] = [];
      if (schoolId) {
        const { data: t } = await supabase.from("teams")
          .select("id, name").eq("school_id", schoolId).eq("is_active", true).order("name");
        tms = (t ?? []).map((r) => ({ id: (r as { id: string }).id, name: (r as { name?: string }).name || "Équipe" }));
      }
      if (!cancelled) { setTeams(tms); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selfId, isRecruiter]);

  const MODES: { key: Mode; label: string }[] = isRecruiter
    ? [{ key: "favorited_coaches", label: "Coachs des athlètes favoris" }]
    : [
        { key: "team", label: "Équipe" },
        { key: "all_coaches", label: "Tous les entraîneurs" },
      ];

  // Coach/director → real group audience (createGroup). Null until a team is picked.
  const groupAudience: GroupAudience | null = useMemo(() => {
    if (isRecruiter) return null;
    if (mode === "all_coaches") return { kind: "all_coaches" };
    if (mode === "team") return teamId ? { kind: "team", team_id: teamId } : null;
    return null;
  }, [isRecruiter, mode, teamId]);

  const ready = isRecruiter ? true : groupAudience !== null;
  const canSend = ready && content.trim().length > 0 && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true); setError(null);
    const supabase = createClient();

    // Recruteur → diffusion héritée (pas de groupe pour les recruteurs).
    if (isRecruiter) {
      const { sent, error: err } = await sendBroadcast(supabase, { kind: "favorited_coaches" }, content.trim());
      if (err) { setError((err as { message?: string }).message || "Diffusion impossible."); setSending(false); return; }
      onSent(sent ?? 0);
      return;
    }

    // Coach/directeur → vrai groupe : create_group seed les participants serveur.
    if (!groupAudience) { setSending(false); return; }
    const { conversationId, error: gErr } = await createGroup(supabase, groupAudience);
    if (gErr || !conversationId) {
      setError((gErr as { message?: string } | undefined)?.message || "Création du groupe impossible.");
      setSending(false);
      return;
    }

    // 1er message via l'insert normal — un trigger estampille l'audience, la RLS
    // autorise l'insert puisqu'on est participant (seed par le RPC).
    const { error: mErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: selfId,
      content: content.trim(),
    });
    if (mErr) {
      setError((mErr as { message?: string }).message || "Envoi du message impossible.");
      setSending(false);
      return;
    }

    if (onCreated) onCreated(conversationId);
  }

  function setModeReset(m: Mode) { setMode(m); setTeamId(""); }

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
      ) : mode === "all_coaches" ? (
        <p className="text-[13px] text-[#9CA3AF]">Un groupe avec <b className="text-white">tous les entraîneurs de ton école</b> — un seul fil partagé.</p>
      ) : mode === "favorited_coaches" ? (
        <p className="text-[13px] text-[#9CA3AF]">Le message ira aux <b className="text-white">coachs des athlètes que tu as mis en favori</b> (un fil individuel chacun).</p>
      ) : (
        <div className="space-y-2">
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
            className="w-full bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[14px] text-white focus:border-[#8B5CF6] outline-none">
            <option value="">Choisir une équipe…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <p className="text-[13px] text-[#9CA3AF]">Un groupe avec <b className="text-white">le staff et les athlètes de l&apos;équipe</b> — un seul fil partagé.</p>
        </div>
      )}

      {/* Message */}
      <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)}
        placeholder={isRecruiter ? "Ton message de diffusion…" : "Ton premier message au groupe…"}
        className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#8B5CF6] outline-none resize-none leading-relaxed" />

      {error && <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">{error}</div>}

      <button type="button" onClick={handleSend} disabled={!canSend}
        className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-[14px] font-bold transition-all ${canSend ? "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white" : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"}`}>
        {sending ? (isRecruiter ? "Envoi…" : "Création…") : (isRecruiter ? "Envoyer la diffusion" : "Créer le groupe")}
      </button>
    </div>
  );
}
