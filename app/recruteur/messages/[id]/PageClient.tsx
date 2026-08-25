"use client";

import {  useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";
import { parseDistinctions } from "@/lib/config/badges";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import CoachInfoCard from "@/components/recruteur/CoachInfoCard";
import AthleteInfoCard from "@/components/recruteur/AthleteInfoCard";
import FeatureGate from "@/components/subscription/FeatureGate";
import { RecruteurMessagesThreadMobile } from "@/components/shared/RecruteurMessagesThreadMobile";
import RetractedMessageRow from "@/components/messaging/RetractedMessageRow";
import { useQueryClient } from "@tanstack/react-query";
import { useAthleteContactable, blackoutMessageFil } from "@/lib/queries/recruiter/useAthleteContactable";
import { findOrCreateRecruiterConversation } from "@/lib/utils/findOrCreateRecruiterConversation";
import NexusThreadView, { NexusThreadMobile } from "@/components/messaging/NexusThreadView";
import { resolveProgrammesVisesAsync } from "@/lib/queries/shared/useCegepPrograms";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Thread Detail — Recruiter side
   Wired to Supabase: conversations + messages
═══════════════════════════════════════════════════════════════ */

interface MessageData {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  retracted?: boolean;
}

interface ThreadContext {
  conversationId: string;
  /** RECRUTEUR_ATHLETE = direct thread (no coach, no about-athlete panels). */
  isDirect: boolean;
  coachId: string;
  coachName: string;
  coachInitials: string;
  coachAvatarUrl: string;
  coachSchool: string;
  coachRegion: string;
  coachEmail: string;
  coachPhone: string;
  athleteId: string;
  /** Entraineur de l'ATHLETE — distinct de coachId, qui est le coach de la
   *  CONVERSATION et vaut "" dans un fil direct (la policy impose
   *  coach_id IS NULL sur RECRUTEUR_ATHLETE). Sert la porte de sortie. */
  athleteCoachId: string;
  athleteName: string;
  /** VIDE sous identité réservée — voir le contrat de ThreadData. Ne pas
   *  redériver depuis athleteName, qui vaut « Identité réservée ». */
  athleteInitials: string;
  /** Décision SERVEUR (identity_visible de la RPC). */
  athleteIdentityVisible: boolean;
  athletePhotoUrl: string;
  athletePosition: string;
  athleteSport: string;
  athleteVerified: boolean;
  athleteStars: number;
  athleteSchool: string;
  athleteRegion: string;
  athleteGradYear: number;
  athleteJersey: string;
  athleteRecruitmentStatus: string;
  athleteCommittedSchool: string;
  athleteOpenToOffers: boolean | null;
  athleteGpa: number;
  athleteProgrammes: string[];
  athleteOpenRelocate: boolean;
  athleteOpenPrivate: boolean;
  athleteOpenAnglophone: boolean;
  athleteDistinctions: string[];
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; textColor: string }> = {
  ACTIVE: { label: "Actif", bg: "bg-[#22C55E]/15", textColor: "text-[#22C55E]" },
  ARCHIVE: { label: "Archivé", bg: "bg-[#374151]/30", textColor: "text-[#6B7280]" } };

function relativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) {
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return dayNames[d.getDay()];
  }
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

function formatDay(isoStr: string): string {
  const d = new Date(isoStr);
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ACTIVE;
  return <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${cfg.bg} ${cfg.textColor}`}>{cfg.label}</span>;
}

function MessageBubble({ msg, isMe, coachName }: { msg: MessageData; isMe: boolean; coachName: string }) {
  if (msg.retracted) return <RetractedMessageRow text={msg.content} />;
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
      <p className="text-[11px] text-[#6b7280] mb-1.5">{isMe ? "Vous" : coachName} · {relativeTime(msg.createdAt)}</p>
      <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${isMe ? "bg-[#0A84FF] rounded-br-md" : "bg-[#262628] rounded-bl-md"}`}>
        <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
}

function DaySeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-[#2D3748]/50" />
      <span className="text-[11px] text-[#6b7280] font-medium capitalize">{formatDay(date)}</span>
      <div className="flex-1 h-px bg-[#2D3748]/50" />
    </div>
  );
}

export default function Page() {
  return <RecruiterThreadRouter />;
}

/* Route par conversation_type. ADMIN_USER → fil de service en lecture seule,
   et il passe DEVANT le FeatureGate, délibérément : un message de service
   (maintenance, information, support) doit atteindre un recruteur Free. Le
   verrou Pro protège la messagerie de recrutement, pas la communication de la
   plateforme — c'est la même frontière que l'exemption de black-out écrite
   dans enforce_messaging_blackout (CLAUDE.md, checklist migrations règle 11).
   Rien n'est ouvert au passage : la RLS `recruiter_conversations_select` est
   `recruiter_id = auth.uid()`, sans palier — le gate n'était qu'une couche
   d'UI, jamais le contrôle d'accès. */
function RecruiterThreadRouter() {
  const id = useDynamicParam("id");
  const [convType, setConvType] = useState<"loading" | "ADMIN_USER" | "OTHER">("loading");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from("conversations").select("conversation_type").eq("id", id).maybeSingle();
        if (!cancelled) setConvType(data?.conversation_type === "ADMIN_USER" ? "ADMIN_USER" : "OTHER");
      } catch {
        if (!cancelled) setConvType("OTHER");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (convType === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (convType === "ADMIN_USER") {
    return IS_CAPACITOR
      ? <NexusThreadMobile id={id} backHref="/recruteur/messages" />
      : <NexusThreadView id={id} backHref="/recruteur/messages" />;
  }

  // Iter 7.8b — mobile early return wrappé dans FeatureGate (ceinture+bretelles).
  if (IS_CAPACITOR) {
    return (
      <FeatureGate feature="messaging" requiredTier="pro">
        <RecruteurMessagesThreadMobile />
      </FeatureGate>
    );
  }
  return (
    <FeatureGate feature="messaging" requiredTier="pro">
      <RecruiterThreadPage />
    </FeatureGate>
  );
}

function RecruiterThreadPage() {
  const id = useDynamicParam("id");
  const [ctx, setCtx] = useState<ThreadContext | null>(null);
  /* Le verrou est PAR ATHLETE : la RPC applique sport et bornes de promotion
     cote serveur. Une periode visant le basketball ne ferme rien pour un
     joueur de football. Et il ne concerne QUE les fils directs — parler a
     l'entraineur reste permis pendant le silence. */
  const { blackout } = useAthleteContactable(ctx?.isDirect ? ctx.athleteId : null);
  const locked = Boolean(ctx?.isDirect && blackout);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [openingCoach, setOpeningCoach] = useState(false);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  /* Échec de chargement — distinct de « rien à afficher ».
     Avant, load() n'avait NI try/catch NI .catch() et setLoading(false)
     était sa toute dernière instruction : n'importe quel throw en cours de
     route (le temps 2 en lève un sur erreur RPC) laissait la page sur
     « Chargement… » pour toujours, avec un rejet de promesse non géré que
     personne ne voit. Un échec doit se dire, pas se figer. */
  const [loadError, setLoadError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      // Load conversation with joins
      const { data: conv, error } = await supabase
        .from("conversations")
        .select(`
          id, conversation_type, status, recruiter_id, coach_id, athlete_id, created_at,
          coach:users!coach_id(id, first_name, last_name, avatar_url, email, phone, schools!school_id(name, region)),
          athlete:athletes!athlete_id(
            id, verified, cote_globale_entraineur, coach_id,
            annee_diplomation, recruitment_status, committed_school_id, open_to_offers,
            moyenne_generale, programme_cegep_vise, programmes_vises, pret_changer_region, ouvert_cegep_prive, ouvert_cegep_anglophone,
            sports!sport_id(nom),
            positions!position_id(nom, abreviation),
            schools!school_id(name, region),
            committed_school:schools!committed_school_id(name),
            evaluations(distinctions, updated_at)
          )
        `)
        .eq("id", id)
        .single();

      if (conv) {
        const coachRaw = conv.coach;
        const coach = (Array.isArray(coachRaw) ? coachRaw[0] : coachRaw) as Record<string, unknown> | null;
        const coachSchoolRaw = coach?.schools;
        const coachSchool = (Array.isArray(coachSchoolRaw) ? coachSchoolRaw[0] : coachSchoolRaw) as { name?: string; region?: string } | null;
        const athleteRaw = conv.athlete;
        const athlete = (Array.isArray(athleteRaw) ? athleteRaw[0] : athleteRaw) as Record<string, unknown> | null;
        const posRaw = athlete?.positions;
        const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string } | null;
        const athSchoolRaw = athlete?.schools;
        const athSchool = (Array.isArray(athSchoolRaw) ? athSchoolRaw[0] : athSchoolRaw) as { name?: string; region?: string } | null;
        const sportRaw = athlete?.sports;
        const sport = (Array.isArray(sportRaw) ? sportRaw[0] : sportRaw) as { nom?: string } | null;
        const committedSchoolRaw = athlete?.committed_school;
        const committedSchool = (Array.isArray(committedSchoolRaw) ? committedSchoolRaw[0] : committedSchoolRaw) as { name?: string } | null;
        const evalRaw = athlete?.evaluations;
        const eval0 = selectBestEvaluation(Array.isArray(evalRaw) ? evalRaw : evalRaw ? [evalRaw] : []) as { distinctions?: unknown } | null;
        // #56 — parseDistinctions gère string[] + {badge,detail} (objet) et
        // filtre les badges inconnus ; on garde le contrat string[] (clés badge)
        // attendu en aval (athleteDistinctions). L'ancienne extraction d.code||d.id
        // droppait silencieusement le format objet.
        const distinctions: string[] = parseDistinctions(eval0?.distinctions).map((d) => d.badge);

        /* Temps 2 — l'identité, projetée par le serveur.
           Le reste de l'athlète (GPA, programmes, ouvert_*) RESTE dans
           l'embed : la RPC ne projette pas ces colonnes, elle ne les expose
           que comme filtres. Même partage qu'au profil (surface 1).
           Le coach reste en embed `users` : ce n'est pas `athletes`, la
           projection Loi 25 ne le concerne pas. */
        const athleteId = (conv.athlete_id as string) || "";
        const card = athleteId
          ? (await fetchRecruiterAthleteCards(supabase, [athleteId])).get(athleteId) ?? null
          : null;
        const identityVisible = card?.identity_visible ?? false;

        const cf = (coach?.first_name as string) || "";
        const cl = (coach?.last_name as string) || "";
        // Vides sous masquage — d'où des initiales vides, volontairement.
        const af = card?.first_name ?? "";
        const al = card?.last_name ?? "";

        // Normalize programme_cegep_vise JSONB: accept array of strings or legacy scalar
        // T2 — la nouvelle colonne d'abord, l'ancienne en repli jusqu'a T3.
        const programmes: string[] = await resolveProgrammesVisesAsync(
          supabase, (athlete as Record<string, unknown> | null)?.programmes_vises, athlete?.programme_cegep_vise);

        const athleteData = {
          conversationId: conv.id,
          isDirect: (conv.conversation_type as string) === "RECRUTEUR_ATHLETE",
          coachId: (coach?.id as string) || "",
          coachName: `${cf} ${cl}`.trim(),
          coachInitials: `${cf[0] || ""}${cl[0] || ""}`.toUpperCase(),
          coachAvatarUrl: (coach?.avatar_url as string) || "",
          coachSchool: coachSchool?.name || "",
          coachRegion: coachSchool?.region || "",
          coachEmail: (coach?.email as string) || "",
          coachPhone: (coach?.phone as string) || "",
          athleteId,
          athleteCoachId: (athlete?.coach_id as string) || "",
          // displayFullName porte les trois cas (carte absente, masquée, nom
          // partiel) — jamais d'interpolation qui donnerait "null null".
          athleteName: displayFullName(card),
          athleteInitials: `${af[0] || ""}${al[0] || ""}`.toUpperCase(),
          athleteIdentityVisible: identityVisible,
          athletePhotoUrl: card?.photo_url ?? "",
          athletePosition: pos?.abreviation || "",
          athleteSport: sport?.nom || "",
          athleteVerified: !!(athlete?.verified),
          athleteStars: (athlete?.cote_globale_entraineur as number) || 0,
          athleteSchool: athSchool?.name || "",
          athleteRegion: athSchool?.region || "",
          athleteGradYear: (athlete?.annee_diplomation as number) || 0,
          athleteJersey: card?.numero_jersey ? String(card.numero_jersey) : "",
          athleteRecruitmentStatus: (athlete?.recruitment_status as string) || "OUVERT",
          athleteCommittedSchool: committedSchool?.name || "",
          athleteOpenToOffers: (athlete?.open_to_offers as boolean | null) ?? null,
          athleteGpa: (athlete?.moyenne_generale as number) || 0,
          athleteProgrammes: programmes,
          athleteOpenRelocate: !!(athlete?.pret_changer_region),
          athleteOpenPrivate: !!(athlete?.ouvert_cegep_prive),
          athleteOpenAnglophone: !!(athlete?.ouvert_cegep_anglophone),
          athleteDistinctions: distinctions,
          status: (conv.status as string) || "ACTIVE",
        };
        setCtx(athleteData);
      }

      // Load messages
      const { data: msgData } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at, retracted_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      if (msgData) {
        setMessages(msgData.map(m => ({
          id: m.id,
          senderId: m.sender_id,
          content: m.content,
          createdAt: m.created_at,
          retracted: !!m.retracted_at,
        })));
      }

      // Mark as read
      await supabase.from("conversations").update({ unread_count: 0 }).eq("id", id);
    }
    load()
      .catch((e: unknown) => {
        console.error("[messages/[id]] chargement du fil échoué", e);
        setLoadError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!reply.trim() || !ctx) return;
    /* Garde cote code, pas seulement `disabled` sur le bouton : le composeur
       envoie aussi sur Ctrl+Entree, et un attribut disabled ne protege pas
       d'un raccourci clavier. */
    if (locked) return;
    setSendError(null);

    const supabase = createClient();
    /* `error` est enfin recupere. Sans lui, un refus laissait `newMsg` a null,
       le bloc suivant etait saute — mais `setReply("")` s'executait quand
       meme, hors du bloc : le message tape disparaissait sans un mot. */
    const { data: newMsg, error } = await supabase
      .from("messages")
      .insert({ conversation_id: ctx.conversationId, sender_id: userId, content: reply.trim() })
      .select("id, sender_id, content, created_at")
      .single();

    if (error || !newMsg) {
      /* 23514 = check_violation, le code que leve enforce_messaging_blackout.
         On teste aussi le libelle : un futur garde pourrait lever autrement. */
      const isBlackout = error?.code === "23514" || /black-?out/i.test(error?.message ?? "");
      /* Le refus du serveur est le signal le PLUS FRAIS qui existe : il vient
         de trancher a l'instant. On invalide donc la requete plutot que
         d'attendre l'expiration du staleTime — l'ecran ne peut plus rester
         faux APRES un envoi rate, il se corrige de lui-meme. */
      if (isBlackout && ctx?.athleteId) {
        void queryClient.invalidateQueries({ queryKey: ["athlete-blackout", ctx.athleteId] });
      }
      setSendError(
        isBlackout
          ? "Ce message n'a pas pu etre envoye : la periode de silence est en cours."
          : "Envoi impossible. Ton message est conserve — reessaie dans un instant.",
      );
      // On NE VIDE PAS le champ : le texte reste, l'utilisateur peut renvoyer.
      return;
    }

    setMessages(prev => [...prev, { id: newMsg.id, senderId: newMsg.sender_id, content: newMsg.content, createdAt: newMsg.created_at }]);
    await supabase.from("conversations").update({ last_message_at: newMsg.created_at, updated_at: new Date().toISOString() }).eq("id", ctx.conversationId);
    setReply("");
  }

  /* Ouvre (ou retrouve) le fil avec l'entraineur de l'athlete. RECRUTEUR_COACH
     n'est PAS bloque par le silence RSEQ : c'est la porte de sortie legitime.
     La fonction existait deja et n'etait cablee que sur mobile. */
  async function openCoachThread() {
    if (!ctx?.athleteCoachId || openingCoach) return;
    setOpeningCoach(true);
    const res = await findOrCreateRecruiterConversation({
      coachId: ctx.athleteCoachId,
      athleteId: ctx.athleteId,
    });
    setOpeningCoach(false);
    /* Union discriminée : on teste `ok` seul. `res.conversationId` dans la
       même condition empêcherait TypeScript de rétrécir la branche d'échec. */
    if (res.ok) { router.push(`/recruteur/messages/${res.conversationId}`); return; }
    setSendError(res.error || "Impossible d'ouvrir la conversation avec l'entraineur.");
  }

  if (loading) return <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>;

  /* Un échec technique n'est PAS « conversation introuvable ». Les
     confondre envoyait le recruteur chercher une conversation supprimée
     alors que c'est la requête qui a cassé. */
  if (loadError) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto">
        <p className="text-[14px] text-[#EF4444] font-semibold">Impossible de charger cette conversation.</p>
        <p className="text-[13px] text-[#6b7280] mt-1">Réessaie dans un instant. Si ça persiste, signale-le.</p>
        <Link href="/recruteur/messages" className="text-[13px] text-[#22C55E] hover:underline mt-3 inline-block">Retour aux messages</Link>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto">
        <p className="text-[14px] text-[#9CA3AF]">Conversation introuvable.</p>
        <Link href="/recruteur/messages" className="text-[13px] text-[#22C55E] hover:underline mt-2 inline-block">Retour aux messages</Link>
      </div>
    );
  }

  // Group messages by day
  const messageGroups: { date: string; msgs: MessageData[] }[] = [];
  messages.forEach(msg => {
    const dk = new Date(msg.createdAt).toISOString().split("T")[0];
    const last = messageGroups[messageGroups.length - 1];
    if (last && new Date(last.date).toISOString().split("T")[0] === dk) {
      last.msgs.push(msg);
    } else {
      messageGroups.push({ date: msg.createdAt, msgs: [msg] });
    }
  });

  return (
    <div className="min-h-screen bg-[#111317] flex flex-col">
      {/* Header */}
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/recruteur/messages" className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
              Retour
            </Link>
            {ctx.isDirect ? (
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-[14px] font-bold text-white truncate">{ctx.athleteName || "Athlète"}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] shrink-0">Athlète</span>
              </span>
            ) : (
              <p className="text-[14px] font-bold text-white truncate">
                {ctx.coachName} — à propos de {ctx.athleteName}
              </p>
            )}
          </div>
          <StatusBadge status={ctx.status} />
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="flex-1 max-w-[1280px] mx-auto w-full flex flex-col xl:flex-row gap-0 xl:gap-6 px-6 py-6">

        {/* Messages Column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
            {/* ÉTAT VIDE — il manquait, et son absence a été lue comme une
                panne à la passe preview : trois des neuf conversations du
                jeu de test n'ont aucun message, et le fil ne rendait alors
                qu'un header et un composeur séparés par un trou noir. Rien
                ne distinguait « conversation neuve » de « chargement
                cassé ». */}
            {messageGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-[#9CA3AF]">Aucun message pour l&apos;instant</p>
                <p className="text-[13px] text-[#6b7280] mt-1">
                  {ctx.isDirect
                    ? "Écris le premier message pour lancer la conversation."
                    : `Écris le premier message à ${ctx.coachName || "ce coach"} pour lancer la conversation.`}
                </p>
              </div>
            )}
            {messageGroups.map((group, gi) => (
              <div key={gi}>
                <DaySeparator date={group.date} />
                <div className="space-y-4">
                  {group.msgs.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} isMe={msg.senderId === userId} coachName={ctx.isDirect ? (ctx.athleteName || "Athlète") : ctx.coachName} />
                  ))}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Reply composer — remplace par l'explication quand le silence est
              en cours. On retire le champ plutot que de le griser : un champ
              grise invite quand meme a taper, puis perd le texte. */}
          {locked ? (
          <div className="bg-[#1A1D24] border-t border-[#2D3748] p-4 rounded-b-xl">
            <div className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3">
              <p className="text-[13px] font-semibold text-[#F59E0B]">
                Aucun message ne peut etre envoye pendant cette periode
              </p>
              <p className="text-[13px] text-[#9CA3AF] leading-relaxed mt-1.5">
                {blackoutMessageFil(blackout)} Nexus suit les regles de recrutement du RSEQ.
              </p>
              {ctx.athleteCoachId ? (
                <button type="button" onClick={() => { void openCoachThread(); }} disabled={openingCoach}
                  className="mt-3 inline-flex items-center h-9 px-4 rounded-lg border border-[#F59E0B] text-[#F59E0B] text-[12px] font-bold uppercase tracking-wider hover:bg-[#F59E0B]/10 disabled:opacity-50 transition-colors">
                  {openingCoach ? "Ouverture…" : "Ecrire a son entraineur"}
                </button>
              ) : (
                /* Pas d'entraineur rattache : on ne propose rien plutot qu'un
                   lien mort. Le silence est preferable a une fausse piste. */
                <p className="text-[12px] text-[#6b7280] mt-2">
                  Cet athlete n&apos;a pas d&apos;entraineur rattache sur Nexus.
                </p>
              )}
              {sendError && (
                <p className="text-[12px] text-[#EF4444] mt-3">{sendError}</p>
              )}
            </div>
          </div>
          ) : (
          <div className="bg-[#1A1D24] border-t border-[#2D3748] p-4 rounded-b-xl">
            {sendError && (
              <p className="text-[12px] text-[#EF4444] mb-2">{sendError}</p>
            )}
            <div className="flex items-end gap-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Écrire une réponse..."
                rows={2}
                className="flex-1 bg-[#111317] border border-[#2D3748] rounded-xl px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#22C55E] outline-none transition-colors resize-none"
              />
              <button type="button" onClick={handleSend} disabled={!reply.trim()} aria-label="Envoyer" className="shrink-0 w-11 h-11 rounded-xl bg-[#22C55E] flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-40">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            </div>
            <p className="text-[10px] text-[#4a4d56] mt-2">Ctrl + Entrée pour envoyer</p>
          </div>
          )}
        </div>

        {/* Barre latérale — TOUJOURS rendue, quel que soit le type de fil.
            Elle était réservée aux fils RECRUTEUR_COACH, sur le raisonnement
            que dans un fil direct « l'athlète est l'interlocuteur, pas un
            sujet ». En pratique ça privait le recruteur de tout contexte
            exactement là où il en a le plus besoin : il écrit à l'athlète
            sans voir sa position, sa cote, son école ni son profil. Le
            panneau coach, lui, reste propre aux fils coach — un fil direct
            n'a pas de coach à décrire. */}
        <div className="xl:w-[340px] shrink-0 space-y-4 mt-6 xl:mt-0">
          {!ctx.isDirect && (
          <>
          {/* ── Coach card ─────────────────────────────── */}
          <CoachInfoCard
            coachId={ctx.coachId}
            coachName={ctx.coachName}
            coachInitials={ctx.coachInitials}
            coachAvatarUrl={ctx.coachAvatarUrl || undefined}
            coachSchool={ctx.coachSchool || undefined}
            coachRegion={ctx.coachRegion || undefined}
            coachEmail={ctx.coachEmail || undefined}
            coachPhone={ctx.coachPhone || undefined}
            athleteId={ctx.athleteId}
            athleteName={ctx.athleteName}
          />
          </>
          )}

          {/* ── Athlete card ──────────────────────────────── */}
          {/* Gardé sur athleteId : sans lui le CTA pointerait sur
              /recruteur/athletes/ tout court. */}
          {ctx.athleteId && (
          <AthleteInfoCard
            /* Dans un fil direct l'athlète EST l'interlocuteur : le libellé
               « Athlète concerné » y désignerait un tiers qui n'existe pas. */
            title={ctx.isDirect ? "Interlocuteur" : undefined}
            athleteId={ctx.athleteId}
            athleteName={ctx.athleteName}
            athleteInitials={ctx.athleteInitials}
            athleteIdentityVisible={ctx.athleteIdentityVisible}
            athletePhotoUrl={ctx.athletePhotoUrl || undefined}
            athleteJersey={ctx.athleteJersey || undefined}
            athleteSport={ctx.athleteSport || undefined}
            athletePosition={ctx.athletePosition || undefined}
            athleteGradYear={ctx.athleteGradYear}
            athleteVerified={ctx.athleteVerified}
            athleteStars={ctx.athleteStars}
            athleteSchool={ctx.athleteSchool || undefined}
            athleteRegion={ctx.athleteRegion || undefined}
            athleteRecruitmentStatus={ctx.athleteRecruitmentStatus}
            athleteCommittedSchool={ctx.athleteCommittedSchool || undefined}
            athleteOpenToOffers={ctx.athleteOpenToOffers}
            athleteGpa={ctx.athleteGpa}
            athleteProgrammes={ctx.athleteProgrammes}
            athleteOpenRelocate={ctx.athleteOpenRelocate}
            athleteOpenPrivate={ctx.athleteOpenPrivate}
            athleteOpenAnglophone={ctx.athleteOpenAnglophone}
            athleteDistinctions={ctx.athleteDistinctions}
          />
          )}
        </div>
      </div>

    </div>
  );
}
