"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { CoachDemandesNouveauMobile } from "@/components/shared/CoachDemandesNouveauMobile";
import AudienceTiles, { type CoachAudience } from "@/components/messaging/AudienceTiles";
import CoachStaffCompose from "@/components/messaging/CoachStaffCompose";
import RecruiterBrowserCompose from "@/components/messaging/RecruiterBrowserCompose";
import AthleteRosterCompose from "@/components/messaging/AthleteRosterCompose";
import ParentCompose from "@/components/messaging/ParentCompose";
import GroupeCompose from "@/components/messaging/GroupeCompose";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Nouveau Message — Compose Page (Coach / Director)
   Step 1 "À qui veux-tu écrire?" → the matching compose panel :
     Entraîneur / Directeur sportif → CoachStaffCompose (COACH_COACH)
     Recruteurs intéressés          → InterestedRecruiterCompose (favoris)
     Groupe                         → GroupeCompose (diffusion)
   The old CÉGEP-browsing recruiter flow was removed : coach→recruiter is
   now favoris-symmetric only (RLS coach_initiate_recruteur_coach), so
   browsing arbitrary recruiters would be denied anyway.
═══════════════════════════════════════════════════════════════ */

export default function CoachNouveauMessagePage() {
  if (IS_CAPACITOR) return <CoachDemandesNouveauMobile />;
  return (
    <Suspense fallback={<div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>}>
      <CoachNouveauMessageContent />
    </Suspense>
  );
}

function CoachNouveauMessageContent() {
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
    router.push(`/coach/demandes?id=${id}`);
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/coach/demandes" className="inline-flex items-center gap-1.5 text-[14px] text-[#9CA3AF] hover:text-white transition-colors mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Retour aux demandes
        </Link>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Nouveau message</h1>
      </div>

      {/* Step 1 — audience */}
      {audience === null && <AudienceTiles onPick={setAudience} />}

      {/* Step 2 — the matching compose panel */}
      {audience !== null && userId && (
        <div className="space-y-4">
          <button type="button" onClick={() => { setAudience(null); setSentCount(null); }} className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Changer de destinataire
          </button>

          {(audience === "coach" || audience === "directeur") && (
            <CoachStaffCompose selfId={userId} audience={audience} onCreated={routeToThread} />
          )}

          {audience === "athlete" && (
            <AthleteRosterCompose selfId={userId} onCreated={routeToThread} />
          )}

          {audience === "parent" && (
            <ParentCompose selfId={userId} onCreated={routeToThread} />
          )}

          {audience === "recruteurs" && (
            <RecruiterBrowserCompose selfId={userId} onCreated={routeToThread} />
          )}

          {audience === "groupe" && (
            sentCount !== null ? (
              <div className="rounded-xl border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 px-5 py-4">
                <p className="text-[15px] font-bold text-white">Envoyé à {sentCount} destinataire{sentCount > 1 ? "s" : ""}.</p>
                <p className="text-[13px] text-[#9CA3AF] mt-1">Chacun a reçu un fil individuel. <Link href="/coach/demandes" className="text-[#A78BFA] hover:underline">Voir mes messages</Link></p>
              </div>
            ) : (
              <GroupeCompose selfId={userId} role={role} onSent={(n) => setSentCount(n)} onCreated={routeToThread} />
            )
          )}
        </div>
      )}
    </div>
  );
}
