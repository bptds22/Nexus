"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachAthleteThreadMobile — côté coach d'un fil ATHLETE_COACH (mobile).
   Contrepartie = l'athlète. Réutilise MessageThreadShell + la MÊME carte
   "Athlète concerné" (AthleteInfoCard) que le fil recruteur↔coach — SANS
   panneau réputation coach (un coach ne s'évalue pas). Au mobile la carte
   vit dans une bottom-sheet (pleine largeur, ouverte depuis l'en-tête via
   le children slot du shell — le "stacked" équivalent mobile). CTA →
   /coach/athletes/[id].

   Mark-read via mark_conversation_read (RPC, participant-safe). Bulles :
   coach = vert #14532D (moi), athlète = gris #262628. Rétraction → ligne
   système (getRetracted).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import AthletePhoto from "@/components/shared/AthletePhoto";
import AthleteInfoCard from "@/components/recruteur/AthleteInfoCard";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useMessages, type MessageRow } from "@/lib/queries/recruiter/useMessages";
import { useSendMessage } from "@/lib/queries/recruiter/useSendMessage";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useQueryClient } from "@tanstack/react-query";
import { parseDistinctions } from "@/lib/config/badges";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { MessageThreadShell } from "@/components/shared/messaging/MessageThreadShell";
import { triggerHaptic } from "@/components/shared/messaging/utils";

interface AthleteCard {
  id: string; name: string; initials: string; photoUrl: string | null;
  jersey: string; sport: string; position: string; gradYear: number;
  verified: boolean; stars: number; school: string; region: string;
  recruitmentStatus: string; committedSchool: string; openToOffers: boolean | null;
  gpa: number; programmes: string[]; openRelocate: boolean; openPrivate: boolean;
  openAnglophone: boolean; distinctions: string[];
}

export function CoachAthleteThreadMobile() {
  const router = useRouter();
  const conversationId = useDynamicParam("id");
  const toast = useMobileToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const { data: messages = [], isLoading: msgsLoading } = useMessages(conversationId);
  const sendMut = useSendMessage();

  const [athlete, setAthlete] = useState<AthleteCard | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: conv } = await supabase
          .from("conversations")
          .select(`
            id, athlete_id,
            athletes!athlete_id(
              id, first_name, last_name, photo_url, verified, cote_globale_entraineur,
              annee_diplomation, numero_jersey, recruitment_status, committed_school_id, open_to_offers,
              moyenne_generale, programme_cegep_vise, pret_changer_region, ouvert_cegep_prive, ouvert_cegep_anglophone,
              sports!sport_id(nom),
              positions!position_id(nom, abreviation),
              schools!school_id(name, region),
              committed_school:schools!committed_school_id(name),
              evaluations(distinctions, updated_at)
            )
          `)
          .eq("id", conversationId)
          .maybeSingle();
        if (!conv) { if (!cancelled) setCtxLoading(false); return; }
        const aRaw = (conv as Record<string, unknown>).athletes;
        const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as Record<string, unknown> | null;
        const posRaw = a?.positions;
        const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string; nom?: string } | null;
        const schRaw = a?.schools;
        const sch = (Array.isArray(schRaw) ? schRaw[0] : schRaw) as { name?: string; region?: string } | null;
        const sportRaw = a?.sports;
        const sport = (Array.isArray(sportRaw) ? sportRaw[0] : sportRaw) as { nom?: string } | null;
        const committedRaw = a?.committed_school;
        const committed = (Array.isArray(committedRaw) ? committedRaw[0] : committedRaw) as { name?: string } | null;
        const evalRaw = a?.evaluations;
        const eval0 = selectBestEvaluation(Array.isArray(evalRaw) ? evalRaw : evalRaw ? [evalRaw] : []) as { distinctions?: unknown } | null;
        const distinctions: string[] = parseDistinctions(eval0?.distinctions).map((d) => d.badge);
        const rawProg: unknown = a?.programme_cegep_vise;
        const programmes: string[] = Array.isArray(rawProg)
          ? (rawProg as unknown[]).filter((p): p is string => typeof p === "string" && p !== "")
          : (typeof rawProg === "string" && rawProg !== "" ? [rawProg] : []);
        const af = (a?.first_name as string) || "";
        const al = (a?.last_name as string) || "";
        if (!cancelled) {
          setAthlete({
            id: (a?.id as string) || (conv.athlete_id as string) || "",
            name: `${af} ${al}`.trim() || "Athlète",
            initials: `${af[0] || ""}${al[0] || ""}`.toUpperCase() || "?",
            photoUrl: (a?.photo_url as string | null) ?? null,
            jersey: a?.numero_jersey ? String(a.numero_jersey) : "",
            sport: sport?.nom || "",
            position: pos?.abreviation || pos?.nom || "",
            gradYear: (a?.annee_diplomation as number) || 0,
            verified: !!(a?.verified),
            stars: (a?.cote_globale_entraineur as number) || 0,
            school: sch?.name || "",
            region: sch?.region || "",
            recruitmentStatus: (a?.recruitment_status as string) || "OUVERT",
            committedSchool: committed?.name || "",
            openToOffers: (a?.open_to_offers as boolean | null) ?? null,
            gpa: (a?.moyenne_generale as number) || 0,
            programmes,
            openRelocate: !!(a?.pret_changer_region),
            openPrivate: !!(a?.ouvert_cegep_prive),
            openAnglophone: !!(a?.ouvert_cegep_anglophone),
            distinctions,
          });
        }
      } catch (err) {
        console.error("[CoachAthleteThreadMobile] ctx load failed:", err);
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  const markedRef = useRef(false);
  useEffect(() => {
    if (!conversationId || markedRef.current) return;
    markedRef.current = true;
    (async () => {
      try {
        const supabase = createClient();
        await supabase.rpc("mark_conversation_read", { p_conv: conversationId });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } catch { /* best-effort */ }
    })();
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const newMsg = payload.new as MessageRow;
        const queryKey = ["messages", conversationId];
        queryClient.setQueryData<MessageRow[]>(queryKey, (old) => {
          if (!old) return [newMsg];
          if (old.some((m) => m.id === newMsg.id)) return old;
          return [...old, newMsg];
        });
        if (newMsg.sender_id !== userId) supabase.rpc("mark_conversation_read", { p_conv: conversationId }).then(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, userId, queryClient]);

  const handleSend = (content: string) => {
    if (!conversationId) return;
    sendMut.mutate({ conversationId, content }, {
      onError: () => toast.error({ message: "Erreur d'envoi", detail: "Vérifie ta connexion" }),
    });
  };

  const headerCenter = (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); setSheetOpen(true); }}
      className="flex flex-col items-center gap-0.5 min-w-0 max-w-full active:opacity-70 transition-opacity"
    >
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
        <AthletePhoto photoUrl={athlete?.photoUrl ?? null} firstName={athlete?.initials?.[0] ?? "A"} lastName={athlete?.initials?.[1] ?? ""} size={36} />
      </div>
      <div className="flex items-center gap-1 min-w-0 max-w-full">
        <span className="text-[16px] font-bold text-white truncate">{athlete?.name ?? "—"}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="9 18 15 12 9 6" /></svg>
      </div>
      <span className="inline-flex items-center px-1.5 h-[16px] rounded-full text-[9px] font-black uppercase tracking-wider border bg-[#22C55E]/15 border-[#22C55E]/30 text-[#22C55E]">Athlète</span>
    </button>
  );

  return (
    <MessageThreadShell<MessageRow>
      messages={messages}
      isLoading={ctxLoading || msgsLoading}
      currentUserId={userId}
      getId={(m) => m.id}
      getContent={(m) => m.content}
      getCreatedAt={(m) => m.created_at}
      getSenderId={(m) => m.sender_id}
      getStatus={(m) => m.status}
      getRetracted={(m) => !!m.retracted_at}
      meColor="#14532D"
      otherColor="#262628"
      headerCenter={headerCenter}
      onBack={() => router.push("/coach/demandes")}
      onSend={handleSend}
      composerPlaceholder="Message…"
      emptyTitle="Démarre la conversation"
      emptyDescription={`Écris à ${athlete?.name ?? "ton athlète"}.`}
    >
      {/* Bottom sheet — carte "Athlète concerné" pleine largeur (mobile). */}
      {athlete && (
        <>
          <div
            onClick={() => setSheetOpen(false)}
            className={`fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm transition-opacity ${sheetOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            aria-hidden
          />
          <div
            className={`fixed bottom-0 inset-x-0 z-[70] bg-[#1A1D24] border-t border-[#2D3748] rounded-t-2xl flex flex-col ${sheetOpen ? "translate-y-0" : "translate-y-full"}`}
            style={{ maxHeight: "min(88vh, calc(100dvh - env(safe-area-inset-top, 0px)))", paddingBottom: "env(safe-area-inset-bottom)", transition: "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            role="dialog" aria-modal="true" aria-label="Fiche athlète"
          >
            <div className="flex justify-center pt-3 pb-2 shrink-0"><div className="w-10 h-1 rounded-full bg-[#4a4d56]" /></div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
              <AthleteInfoCard
                athleteId={athlete.id}
                athleteName={athlete.name}
                athleteInitials={athlete.initials}
                athletePhotoUrl={athlete.photoUrl || undefined}
                athleteJersey={athlete.jersey}
                athleteSport={athlete.sport}
                athletePosition={athlete.position}
                athleteGradYear={athlete.gradYear}
                athleteVerified={athlete.verified}
                athleteStars={athlete.stars}
                athleteSchool={athlete.school}
                athleteRegion={athlete.region}
                athleteRecruitmentStatus={athlete.recruitmentStatus}
                athleteCommittedSchool={athlete.committedSchool}
                athleteOpenToOffers={athlete.openToOffers}
                athleteGpa={athlete.gpa}
                athleteProgrammes={athlete.programmes}
                athleteOpenRelocate={athlete.openRelocate}
                athleteOpenPrivate={athlete.openPrivate}
                athleteOpenAnglophone={athlete.openAnglophone}
                athleteDistinctions={athlete.distinctions}
                profileHref={`/coach/athletes/${athlete.id}`}
              />
            </div>
          </div>
        </>
      )}
    </MessageThreadShell>
  );
}
