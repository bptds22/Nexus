"use client";

/* ═══════════════════════════════════════════════════════════════
   NexusThreadView — le fil de service (conversation_type='ADMIN_USER'),
   côté DESTINATAIRE. Un seul composant pour les trois rôles qui peuvent
   en recevoir un (athlète, entraîneur, recruteur), web et mobile.

   LECTURE SEULE — et c'est écrit à trois endroits, pas un
   ────────────────────────────────────────────────────────
   1. En base : trg_admin_thread_readonly refuse tout INSERT dont
      l'expéditeur n'est pas l'identité de service.
   2. Ici : il n'y a PAS de zone de saisie. Une zone inerte inviterait
      à taper puis perdrait le texte — même raisonnement que le verrou
      de black-out du fil recruteur.
   3. Dans la copie : « Ce fil ne reçoit pas de réponse », dit une fois,
      calmement, plutôt qu'une erreur après coup.
   v2 (ouverture de la réponse) : la condition à élargir est celle du
   trigger ; ce composant suivra, pas l'inverse.

   L'EXPÉDITEUR AFFICHÉ est l'identité de service, jamais l'admin humain
   qui a rédigé — voir lib/messaging/serviceIdentity.ts pour le pourquoi
   du fetch séparé (ambiguïté de FK PostgREST sur les multiples FK de
   `conversations` vers `users`).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMessages, type MessageRow } from "@/lib/queries/recruiter/useMessages";
import { useSendMessage } from "@/lib/queries/recruiter/useSendMessage";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import RetractedMessageRow from "@/components/messaging/RetractedMessageRow";
import { MessageThreadShell } from "@/components/shared/messaging/MessageThreadShell";
import {
  useServiceIdentity,
  SERVICE_IDENTITY_FALLBACK,
  SERVICE_IDENTITY_ROLE_LABEL,
  type ServiceIdentity,
} from "@/lib/messaging/serviceIdentity";

const NEXUS_ACCENT = "#E63946";

/* ── Formatage (aligné sur les autres fils, volontairement dupliqué :
      ces helpers vivent déjà en cinq exemplaires dans la messagerie et
      les factoriser dépasse le périmètre de ce lot). ────────────── */

function relativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) {
    const n = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return n[d.getDay()];
  }
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

function formatDay(isoStr: string): string {
  const d = new Date(isoStr);
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getDateKey(isoStr: string): string {
  return new Date(isoStr).toISOString().split("T")[0];
}

/* ── Marque-lu : la RPC, jamais un UPDATE direct (contenu immuable).
      is_conversation_participant couvre ADMIN_USER depuis la migration
      de structure — sans ça la RPC lèverait « Non autorisé ». ───── */

function useMarkAdminThreadRead(conversationId: string, ready: boolean) {
  const queryClient = useQueryClient();
  const doneRef = useRef(false);
  useEffect(() => {
    if (!conversationId || !ready || doneRef.current) return;
    doneRef.current = true;
    (async () => {
      try {
        await createClient().rpc("mark_conversation_read", { p_conv: conversationId });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } catch (err) {
        console.error("[NexusThread] mark-read failed:", err);
      }
    })();
  }, [conversationId, ready, queryClient]);
}

/* ── L'INTERRUPTEUR SERVEUR ───────────────────────────────────────
   Le composeur de ces fils est piloté par la BASE, pas par le binaire.

   Aujourd'hui `trg_admin_thread_readonly` refuse toute insertion dont
   l'expéditeur n'est pas l'identité de service : les fils ADMIN_USER sont
   en lecture seule, et 148 messages sur 148 viennent du service. La
   migration qui ouvrira la réponse (élargir CE trigger + une policy INSERT
   ADMIN_USER pour les trois rôles) posera `admin_reply_open = true` dans le
   MÊME apply. Les binaires déjà installés s'allumeront alors seuls, sans
   nouvelle livraison.

   `app_settings` est lisible par tout le monde (policy « anyone can read
   settings », qual `true`) — même précédent que lib/config/versionGate.ts.

   Défaut FERMÉ : toute erreur, toute absence de clé, tout chargement en
   cours laissent le verrou en place. Tant que le drapeau n'est pas posé, ce
   composant se comporte EXACTEMENT comme le build précédent. */
function useAdminReplyOpen(): boolean {
  const { data } = useQuery({
    queryKey: ["app_settings", "admin_reply_open"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("app_settings").select("value").eq("key", "admin_reply_open").maybeSingle();
      if (error) return false;
      return String(data?.value ?? "").trim().toLowerCase() === "true";
    },
  });
  return data === true;
}

/** Refus du trigger admin, à NE PAS confondre avec un black-out RSEQ.
 *  Les deux lèvent `check_violation` (23514) — `isBlackoutError` teste ce
 *  code SEUL et classerait donc ce refus en black-out, annonçant « Envoi
 *  impossible » et un silence RSEQ qui n'existe pas. On discrimine par le
 *  message que la fonction lève, le seul élément qui les sépare. */
function estRefusReponseAdmin(err: unknown): boolean {
  const e = err as { message?: string } | null;
  return /ne peut pas recevoir de r[eé]ponse/i.test(e?.message ?? "");
}

/* ── Bandeau « ça ouvre bientôt » ─────────────────────────────────
   Chemin défensif : le drapeau dit ouvert mais la base refuse encore
   (drapeau posé avant la migration, apply partiel). On reverrouille et on
   le dit doucement.

   Le brouillon est RENDU, pas jeté. MessageThreadShell vide son champ AVANT
   d'appeler onSend : sans ça, le texte disparaîtrait sans être parti, ce qui
   se lit comme un envoi réussi. On ne prétend jamais avoir transmis quoi que
   ce soit. */
function BientotNotice({ brouillon }: { brouillon: string }) {
  return (
    <div className="rounded-xl border border-[#2D3748] bg-[#111317] px-3.5 py-2.5">
      <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
        Les réponses ouvrent bientôt. Ton message n&apos;a pas été envoyé.
      </p>
      {brouillon.trim() !== "" && (
        <p className="mt-2 text-[12px] text-[#e0e0e0] leading-relaxed whitespace-pre-wrap border-l-2 border-[#2D3748] pl-2.5">
          {brouillon}
        </p>
      )}
    </div>
  );
}

/* ── Bandeau de lecture seule (partagé web/mobile) ────────────── */

function ReadOnlyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border border-[#2D3748] bg-[#111317] ${
        compact ? "px-3.5 py-2.5" : "px-4 py-3.5"
      }`}
    >
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0 mt-0.5"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
        Ce fil ne reçoit pas de réponse. Pour joindre l&apos;équipe Nexus, écris à{" "}
        <a href="mailto:support@nexussports.ca" className="font-semibold text-[#e0e0e0] hover:text-white underline underline-offset-2">
          support@nexussports.ca
        </a>
        .
      </p>
    </div>
  );
}

/* ── Logique de composeur, partagée par les deux variantes ────── */

function useNexusComposer(conversationId: string) {
  const replyOpen = useAdminReplyOpen();
  const sendMut = useSendMessage();
  const toast = useMobileToast();
  const [refuse, setRefuse] = useState(false);
  const [brouillon, setBrouillon] = useState("");

  // Ouvert SEULEMENT si la base l'a dit ET qu'elle n'a pas déjà refusé.
  const ouvert = replyOpen && !refuse;

  const envoyer = (content: string) => {
    if (!ouvert) return;
    setBrouillon(content);
    sendMut.mutate(
      { conversationId, content },
      {
        onSuccess: () => setBrouillon(""),
        onError: (error: unknown) => {
          if (estRefusReponseAdmin(error)) {
            setRefuse(true);
            toast.info({ message: "Les réponses ouvrent bientôt" });
            return;
          }
          toast.error({ message: "Erreur d'envoi", detail: "Vérifie ta connexion" });
        },
      },
    );
  };

  /* Le verrou À AFFICHER, ou `undefined` quand le composeur doit vivre.
     `undefined` est ce que MessageThreadShell attend pour rendre sa zone de
     saisie normale — c'est le prop qui sert déjà au verrou de black-out. */
  const verrou = ouvert
    ? undefined
    : refuse
      ? <BientotNotice brouillon={brouillon} />
      : <ReadOnlyNotice compact />;

  return { ouvert, envoyer, verrou, refuse, brouillon };
}

/* ── Avatar de l'identité de service ──────────────────────────── */

function ServiceAvatar({ identity, size }: { identity: ServiceIdentity; size: number }) {
  if (identity.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={identity.photoUrl}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 border"
      style={{
        width: size,
        height: size,
        backgroundColor: `${NEXUS_ACCENT}26`,
        borderColor: `${NEXUS_ACCENT}4D`,
      }}
    >
      <span className="text-[12px] font-black" style={{ color: NEXUS_ACCENT }}>
        {identity.initials}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Variante WEB — chrome identique aux autres fils web (en-tête
   sticky + retour), composeur REMPLACÉ par le bandeau.
═══════════════════════════════════════════════════════════════ */

export default function NexusThreadView({ id, backHref }: { id: string; backHref: string }) {
  const { data: identityRow, isLoading: identityLoading } = useServiceIdentity();
  const { data: messages = [], isLoading: msgsLoading } = useMessages(id);
  const { ouvert, envoyer, verrou } = useNexusComposer(id);
  const [saisie, setSaisie] = useState("");
  const identity = identityRow ?? SERVICE_IDENTITY_FALLBACK;

  useMarkAdminThreadRead(id, !msgsLoading);

  const groups = useMemo(() => {
    const out: { date: string; msgs: MessageRow[] }[] = [];
    for (const m of messages) {
      const dk = getDateKey(m.created_at);
      const last = out[out.length - 1];
      if (last && getDateKey(last.date) === dk) last.msgs.push(m);
      else out.push({ date: m.created_at, msgs: [m] });
    }
    return out;
  }, [messages]);

  if (identityLoading || msgsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* En-tête */}
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-[900px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href={backHref} className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Retour
          </Link>
          <ServiceAvatar identity={identity} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-bold text-white truncate">{identity.name}</p>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border"
                style={{ color: NEXUS_ACCENT, backgroundColor: `${NEXUS_ACCENT}26`, borderColor: `${NEXUS_ACCENT}4D` }}
              >
                Nexus
              </span>
            </div>
            <p className="text-[12px] text-[#6b7280] truncate">{SERVICE_IDENTITY_ROLE_LABEL}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-[900px] mx-auto w-full flex flex-col px-6 py-6">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {messages.length === 0 ? (
            <p className="text-center text-[13px] text-[#6b7280] py-10">Aucun message pour l&apos;instant.</p>
          ) : (
            groups.map((g, gi) => (
              <div key={gi}>
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-[#2D3748]/50" />
                  <span className="text-[11px] text-[#6b7280] font-medium capitalize">{formatDay(g.date)}</span>
                  <div className="flex-1 h-px bg-[#2D3748]/50" />
                </div>
                <div className="space-y-4">
                  {g.msgs.map((m) =>
                    m.retracted_at ? (
                      <RetractedMessageRow key={m.id} text={m.content} />
                    ) : (
                      /* Tous les messages viennent de l'identité de service :
                         aucune bulle « Vous » possible ici, par construction. */
                      <div key={m.id} className="flex flex-col items-start">
                        <p className="text-[11px] text-[#6b7280] mb-1.5">
                          {identity.name} · {relativeTime(m.created_at)}
                        </p>
                        <div className="max-w-[80%] sm:max-w-[70%] rounded-2xl rounded-bl-md bg-[#262628] px-4 py-3">
                          <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Composeur piloté par la base. Fermé → le bandeau prend sa place,
            exactement comme avant. La variante web n'utilise pas
            MessageThreadShell : elle porte sa propre saisie, donc c'est ICI
            qu'on garde le texte tant qu'il n'est pas parti. */}
        <div className="pt-2">
          {ouvert ? (
            <div className="flex items-end gap-2">
              <textarea
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (saisie.trim()) { envoyer(saisie); setSaisie(""); }
                  }
                }}
                rows={1}
                placeholder="Écris à l'équipe Nexus…"
                className="flex-1 resize-none rounded-xl border border-[#2D3748] bg-[#111317] px-3.5 py-2.5 text-[14px] text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#4a4d56]"
              />
              <button
                type="button"
                onClick={() => { if (saisie.trim()) { envoyer(saisie); setSaisie(""); } }}
                disabled={!saisie.trim()}
                className="shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: NEXUS_ACCENT }}
              >
                Envoyer
              </button>
            </div>
          ) : (
            verrou ?? <ReadOnlyNotice />
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Variante MOBILE — MessageThreadShell, composeur remplacé par
   `composerLocked` (le prop existe déjà pour le verrou de black-out).
═══════════════════════════════════════════════════════════════ */

export function NexusThreadMobile({ id, backHref }: { id: string; backHref: string }) {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const { data: identityRow } = useServiceIdentity();
  const { data: messages = [], isLoading } = useMessages(id);
  const identity = identityRow ?? SERVICE_IDENTITY_FALLBACK;
  const { envoyer, verrou } = useNexusComposer(id);

  useMarkAdminThreadRead(id, !isLoading);

  return (
    <MessageThreadShell<MessageRow>
      messages={messages}
      isLoading={isLoading}
      currentUserId={currentUser?.authUser.id}
      getId={(m) => m.id}
      getContent={(m) => m.content}
      getCreatedAt={(m) => m.created_at}
      getSenderId={(m) => m.sender_id}
      getRetracted={(m) => !!m.retracted_at}
      onBack={() => router.push(backHref)}
      /* Piloté par la base — voir useAdminReplyOpen. Tant que le drapeau
         `admin_reply_open` n'est pas posé, `verrou` vaut le bandeau de
         lecture seule et `envoyer` ne fait rien : comportement identique au
         build précédent, au pixel près. */
      onSend={envoyer}
      composerLocked={verrou}
      composerPlaceholder="Écris à l'équipe Nexus…"
      emptyTitle="Aucun message"
      emptyDescription="L'équipe Nexus n'a rien publié pour l'instant."
      headerCenter={
        <div className="flex items-center gap-2.5 min-w-0">
          <ServiceAvatar identity={identity} size={32} />
          <div className="min-w-0 text-left">
            <p className="text-[14px] font-bold text-white truncate">{identity.name}</p>
            <p className="text-[11px] text-[#6b7280] truncate">{SERVICE_IDENTITY_ROLE_LABEL}</p>
          </div>
        </div>
      }
    />
  );
}
