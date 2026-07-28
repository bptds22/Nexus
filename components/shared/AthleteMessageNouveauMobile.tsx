"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteMessageNouveauMobile — Nouveau message mobile (Phase C).
   Réutilise SchoolStaffPicker (qui appelle le RPC list_messageable_staff
   — même source que le web) + findOrCreateAthleteCoachConversation.
   Chrome mobile : header sticky retour + titre.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import SchoolStaffPicker, { type StaffOption } from "@/components/messaging/SchoolStaffPicker";
import { findOrCreateAthleteCoachConversation } from "@/lib/queries/messaging/createAthleteCoachConversation";
import { triggerHaptic } from "@/components/shared/messaging/utils";

export function AthleteMessageNouveauMobile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data: ath } = await supabase.from("athletes").select("id").eq("user_id", user.id).maybeSingle();
        setAthleteId((ath?.id as string) ?? null);
      } catch (err) {
        console.error("[AthleteNouveauMobile] load failed:", err);
      } finally { setLoading(false); }
    })();
  }, []);

  async function handleSelect(staff: StaffOption) {
    if (!athleteId || busyId) return;
    triggerHaptic("Light");
    setBusyId(staff.id);
    setError(null);
    const supabase = createClient();
    const { conversationId, error: err } = await findOrCreateAthleteCoachConversation(supabase, { athleteId, coachId: staff.id });
    if (err || !conversationId) {
      const code = (err as { code?: string } | undefined)?.code;
      const isRls = code === "42501" || /permission denied|row-level security|policy/i.test((err as { message?: string } | undefined)?.message ?? "");
      setError(isRls ? "Tu ne peux écrire qu'aux membres du personnel de ton école." : ((err as { message?: string } | undefined)?.message || "Impossible d'ouvrir la conversation."));
      setBusyId(null);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    router.replace(`/athlete/messages?id=${conversationId}`);
  }

  return (
    <div className="min-h-screen bg-[#111317] text-white">
      <div
        className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)" }}
      >
        <div className="flex items-center px-4 py-2 gap-2 min-h-[56px]">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Retour"
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h1 className="font-head text-[20px] font-black text-white uppercase tracking-tight">Nouveau message</h1>
        </div>
      </div>

      <div className="px-4 py-5 nx-mobile-pb-tabbar">
        <p className="text-[14px] text-[#9CA3AF] mb-4">Choisis un entraîneur ou le directeur sportif de ton école.</p>
        {error && (
          <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5] mb-4">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" /></div>
        ) : !athleteId ? (
          <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5"><p className="text-[14px] text-[#9CA3AF]">Profil athlète introuvable.</p></div>
        ) : (
          <SchoolStaffPicker athleteId={athleteId} onSelect={handleSelect} busyId={busyId} />
        )}
      </div>
    </div>
  );
}
