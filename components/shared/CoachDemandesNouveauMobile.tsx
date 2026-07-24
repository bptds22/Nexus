"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachDemandesNouveauMobile — Compose Page (Coach/Director, Capacitor).
   Same audience-first flow as the web /coach/demandes/nouveau, reusing
   the shared compose panels :
     Entraîneur / Directeur sportif → CoachStaffCompose (COACH_COACH)
     Recruteurs intéressés          → InterestedRecruiterCompose (favoris)
     Groupe                         → GroupeCompose (diffusion)
   École tile removed ; coach→recruteur is favoris-symmetric only.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import AudienceTiles, { type CoachAudience } from "@/components/messaging/AudienceTiles";
import CoachStaffCompose from "@/components/messaging/CoachStaffCompose";
import RecruiterBrowserCompose from "@/components/messaging/RecruiterBrowserCompose";
import AthleteRosterCompose from "@/components/messaging/AthleteRosterCompose";
import ParentCompose from "@/components/messaging/ParentCompose";
import GroupeCompose from "@/components/messaging/GroupeCompose";

export function CoachDemandesNouveauMobile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [audience, setAudience] = useState<CoachAudience | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<"COACH" | "RECRUTEUR">("COACH");
  const [sentCount, setSentCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
      if ((data as { role?: string } | null)?.role === "RECRUTEUR") setRole("RECRUTEUR");
    })();
  }, []);

  function routeToThread(id: string) {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    router.replace(`/coach/demandes/${id}`);
  }

  function back() {
    if (audience) { setAudience(null); setSentCount(null); }
    else router.push("/coach/demandes");
  }

  return (
    <div className="min-h-[100dvh] bg-[#111317] text-white flex flex-col">
      <div className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center px-4 py-2 gap-2 min-h-[64px]">
          <button type="button" onClick={back} aria-label="Retour" className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h1 className="font-head text-[20px] font-black text-white uppercase tracking-tight flex-1 truncate">Nouveau message</h1>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 nx-mobile-pb-tabbar overflow-y-auto">
        {audience === null && <AudienceTiles onPick={setAudience} />}

        {audience !== null && userId && (audience === "coach" || audience === "directeur") && (
          <CoachStaffCompose selfId={userId} audience={audience} onCreated={routeToThread} />
        )}

        {audience === "athlete" && userId && (
          <AthleteRosterCompose selfId={userId} onCreated={routeToThread} />
        )}

        {audience === "parent" && userId && (
          <ParentCompose selfId={userId} onCreated={routeToThread} />
        )}

        {audience === "recruteurs" && userId && (
          <RecruiterBrowserCompose selfId={userId} onCreated={routeToThread} />
        )}

        {audience === "groupe" && userId && (
          sentCount !== null ? (
            <div className="rounded-xl border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 px-5 py-4">
              <p className="text-[15px] font-bold text-white">Envoyé à {sentCount} destinataire{sentCount > 1 ? "s" : ""}.</p>
              <p className="text-[13px] text-[#9CA3AF] mt-1">Chacun a reçu un fil individuel.</p>
              <button type="button" onClick={() => router.replace("/coach/demandes")} className="mt-3 text-[13px] font-bold text-[#A78BFA]">Voir mes messages</button>
            </div>
          ) : (
            <GroupeCompose selfId={userId} role={role} onSent={(n) => setSentCount(n)} />
          )
        )}
      </div>
    </div>
  );
}
