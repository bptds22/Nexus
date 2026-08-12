"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import SchoolStaffPicker, { type StaffOption } from "@/components/messaging/SchoolStaffPicker";
import { findOrCreateAthleteCoachConversation } from "@/lib/queries/messaging/createAthleteCoachConversation";
import { AthleteMessageNouveauMobile } from "@/components/shared/AthleteMessageNouveauMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Athlete — Nouveau message. Pick a coach/director at my school/club
   (SchoolStaffPicker mirrors the RLS), find-or-create the thread,
   route into it.
═══════════════════════════════════════════════════════════════ */

export default function AthleteNouveauMessagePage() {
  if (IS_CAPACITOR) return <AthleteMessageNouveauMobile />;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aud, setAud] = useState<"all" | "coach" | "directeur">("all");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data: ath } = await supabase.from("athletes").select("id").eq("user_id", user.id).maybeSingle();
        setAthleteId((ath?.id as string) ?? null);
      } catch (err) {
        console.error("[AthleteNouveau] load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSelect(staff: StaffOption) {
    if (!athleteId || busyId) return;
    setBusyId(staff.id);
    setError(null);
    const supabase = createClient();
    const { conversationId, error: err } = await findOrCreateAthleteCoachConversation(supabase, {
      athleteId,
      coachId: staff.id,
    });
    if (err || !conversationId) {
      const code = (err as { code?: string } | undefined)?.code;
      const isRls = code === "42501" || /permission denied|row-level security|policy/i.test((err as { message?: string } | undefined)?.message ?? "");
      setError(isRls ? "Tu ne peux écrire qu'aux membres du personnel de ton école." : ((err as { message?: string } | undefined)?.message || "Impossible d'ouvrir la conversation."));
      setBusyId(null);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    router.push(`/athlete/messages?id=${conversationId}`);
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[720px] mx-auto space-y-6">
      <div>
        <Link href="/athlete/messages" className="inline-flex items-center gap-1.5 text-[14px] text-[#9CA3AF] hover:text-white transition-colors mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Retour aux messages
        </Link>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Nouveau message</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Choisis un entraîneur ou le directeur sportif de ton école.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" /></div>
      ) : !athleteId ? (
        <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5"><p className="text-[14px] text-[#9CA3AF]">Profil athlète introuvable.</p></div>
      ) : (
        <div className="space-y-4">
          {/* "À qui veux-tu écrire ?" — athlete audiences are staff only
              (Coach / Directeur), both write ATHLETE_COACH. */}
          <div>
            <h2 className="text-[13px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-2">À qui veux-tu écrire&nbsp;?</h2>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "all", label: "Tous" },
                { key: "coach", label: "Entraîneur" },
                { key: "directeur", label: "Directeur sportif" },
              ] as const).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setAud(o.key)}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition-colors ${
                    aud === o.key ? "bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]" : "bg-[#13151a] border-[#2D3748] text-[#9CA3AF] hover:text-white"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <SchoolStaffPicker athleteId={athleteId} onSelect={handleSelect} busyId={busyId} roleFilter={aud} />
        </div>
      )}
    </div>
  );
}
