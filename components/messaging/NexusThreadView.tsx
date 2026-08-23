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

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMessages, type MessageRow } from "@/lib/queries/recruiter/useMessages";
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

        {/* Pas de composeur — le bandeau prend sa place. */}
        <div className="pt-2">
          <ReadOnlyNotice />
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
      /* Jamais appelé : composerLocked remplace la zone de saisie. */
      onSend={() => {}}
      composerLocked={<ReadOnlyNotice compact />}
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
