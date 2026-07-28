"use client";

/* ═══════════════════════════════════════════════════════════════
   MessageThreadShell — identity-agnostic chrome for the thread
   detail screen. Extracted from RecruteurMessagesThreadMobile.

   What it owns :
   - Sticky header (back button + role-specific center slot)
   - Scrollable message list grouped by calendar day with
     DaySeparator pills between clusters
   - Bubble rendering via MessageBubble (colors prop-driven)
   - Auto-scroll to the latest message on mount + on new messages
   - Sticky composer (textarea + send button)
   - Optional empty state ("Démarre la conversation")
   - Loading skeleton placeholder

   What it DOESN'T own (parent provides) :
   - Messages array + accessors
   - currentUserId (to compute isMe)
   - Header center content (role-specific avatar + name + chevron)
   - Realtime subscription + mark-as-read (parent owns the queries)
   - The send mutation (parent passes onSend)
   - Bottom sheets (CoachDetailsSheet etc. — recruiter-specific,
     mounted by the parent as siblings)
═══════════════════════════════════════════════════════════════ */

import {
  useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { MessageBubble } from "./MessageBubble";
import { DaySeparator } from "./DaySeparator";
import { triggerHaptic } from "./utils";
import { useKeyboardHeight } from "@/lib/hooks/useKeyboardHeight";

function ThreadSkeleton() {
  return (
    <div className="px-4 space-y-3 py-6">
      {[60, 80, 40, 65, 50].map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
          <div
            className="rounded-2xl h-10 nx-pulse-thread"
            style={{ width: `${w}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export interface MessageThreadShellProps<M> {
  messages: M[];
  isLoading: boolean;

  /** Current user id — drives the `isMe` test on every bubble. */
  currentUserId: string | undefined;

  /* Accessors on each message. */
  getId: (m: M) => string;
  getContent: (m: M) => string;
  getCreatedAt: (m: M) => string;
  getSenderId: (m: M) => string | undefined;
  getStatus?: (m: M) => "sending" | "sent" | "error" | undefined;
  /** Optionnel : message rétracté → ligne système (tous types). Défaut false. */
  getRetracted?: (m: M) => boolean;

  /** Bubble color when the message is from the current user. */
  meColor?: string;
  /** Bubble color when the message is from the other party. */
  otherColor?: string;

  /** Center column of the sticky header (between back and right
   *  spacer). The parent renders its role-specific block here
   *  (e.g. coach photo + name + chevron + "À propos de … subtitle). */
  headerCenter: ReactNode;
  onBack: () => void;

  /** Send a message. */
  onSend: (content: string) => void;
  composerPlaceholder?: string;

  /** Optionnel : override du rendu d'un message (fils MULTI-parties — groupe).
   *  Quand fourni, remplace la MessageBubble par défaut : le parent gère
   *  lui-même l'identité de l'expéditeur + les étiquettes d'audience. Les
   *  fils 1-on-1 existants ne le passent pas → comportement inchangé. */
  renderMessage?: (m: M, isMe: boolean) => ReactNode;
  /** Optionnel : petite mention affichée sous le champ de saisie (ex. athlète
   *  en groupe : « Ta réponse ne sera visible que par les entraîneurs »). */
  composerNote?: ReactNode;

  /** Empty-state copy (when there are no messages yet). */
  emptyTitle?: string;
  emptyDescription?: string;

  /** Optional sibling sheets / portals mounted under the composer
   *  (recruiter uses this for CoachDetailsSheet + AthleteThreadSheet). */
  children?: ReactNode;
}

export function MessageThreadShell<M>({
  messages, isLoading,
  currentUserId,
  getId, getContent, getCreatedAt, getSenderId, getStatus, getRetracted,
  meColor = "#0A84FF",
  otherColor = "#262628",
  headerCenter, onBack,
  onSend, composerPlaceholder = "Message…",
  renderMessage, composerNote,
  emptyTitle = "Démarre la conversation",
  emptyDescription = "Pose une question pour commencer.",
  children,
}: MessageThreadShellProps<M>) {
  const [reply, setReply] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── Clavier (Option B — events natifs, KeyboardResize.None). Le resize
        natif iOS étant cassé sur iOS 26 (innerH/visualViewport ne bougent
        pas), on lit `keyboardHeight` via keyboardWillShow/Hide et on padde le
        bas du shell de cette hauteur → le composer (dernier enfant du flex
        column) remonte au-dessus du clavier. Web → no-op (plugin absent).
        Logique factorisée dans useKeyboardHeight (source de vérité unique,
        partagée avec DistinctionDetailSheet). ── */
  const kbdH = useKeyboardHeight();

  /* Auto-scroll to the latest message on mount + on each new message
     count change. RAF defer so layout settles first. */
  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [messages.length]);

  /* Group messages by calendar day → flat list of [day, msg, msg, …,
     day, msg, …] items so the renderer can interleave separators. */
  const items = useMemo(() => {
    type Item = { type: "day"; iso: string } | { type: "msg"; msg: M };
    const out: Item[] = [];
    let lastDayKey: string | null = null;
    for (const m of messages) {
      const iso = getCreatedAt(m);
      const d = new Date(iso);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (key !== lastDayKey) {
        out.push({ type: "day", iso });
        lastDayKey = key;
      }
      out.push({ type: "msg", msg: m });
    }
    return out;
  }, [messages, getCreatedAt]);

  const handleSend = () => {
    if (!reply.trim()) return;
    const content = reply;
    setReply("");
    triggerHaptic("Light");
    onSend(content);
  };

  const handleBack = () => {
    triggerHaptic("Light");
    onBack();
  };

  const isEmpty = !isLoading && messages.length === 0;

  return (
    // h-full = épouse le <main> app-shell (100dvh) et rétrécit avec le frame
    // sous KeyboardResize.Native (contrairement à min-h-screen/100vh qui
    // laissait le composer sticky flotter au milieu). Un seul scroll : la
    // liste de messages (flex-1 min-h-0 overflow-y-auto), composer collé en bas.
    <div
      className="h-full bg-[#111317] text-white flex flex-col"
      style={{
        // Clavier OUVERT : composer pile au-dessus du clavier (bottom = --kbd-h
        // exact, aucun padding additionnel → zéro gap, façon iMessage).
        // Clavier FERMÉ : la tab bar flottante est visible (cf. MobileTabBar) →
        // on réserve sa hauteur (safe + 88px) pour que le composer s'asseye
        // au-dessus d'elle.
        paddingBottom: kbdH > 0 ? `${kbdH}px` : "calc(env(safe-area-inset-bottom) + 88px)",
      }}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center px-4 py-2 gap-2 min-h-[64px]">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Retour"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex-1 flex flex-col items-center gap-0.5 min-w-0 py-1">
            {headerCenter}
          </div>
          <div className="w-9 h-9 flex-shrink-0" />
        </div>
      </div>

      {/* Body : messages — UNIQUE conteneur scroll (min-h-0 indispensable pour
          qu'un flex item scrolle au lieu de pousser le composer hors écran). */}
      <div className="flex-1 min-h-0 overflow-y-auto py-4">
        {isLoading ? (
          <ThreadSkeleton />
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1A1D24] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight mb-1">
              {emptyTitle}
            </h3>
            <p className="text-[13px] text-white/55 max-w-sm">
              {emptyDescription}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) =>
              item.type === "day" ? (
                <DaySeparator key={`day-${idx}-${item.iso}`} iso={item.iso} />
              ) : renderMessage ? (
                <div key={getId(item.msg)}>
                  {renderMessage(item.msg, getSenderId(item.msg) === currentUserId)}
                </div>
              ) : (
                <MessageBubble
                  key={getId(item.msg)}
                  content={getContent(item.msg)}
                  createdAt={getCreatedAt(item.msg)}
                  isMe={getSenderId(item.msg) === currentUserId}
                  status={getStatus?.(item.msg)}
                  meColor={meColor}
                  otherColor={otherColor}
                  retracted={getRetracted?.(item.msg) ?? false}
                />
              )
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Sticky composer — l'offset bas (clavier OU espace tab bar) est géré
          par le padding-bottom du shell ci-dessus ; pas de padding ici, sinon
          ça recrée un gap au-dessus du clavier. */}
      <div
        className="sticky bottom-0 z-20 bg-[#111317]/95 backdrop-blur-md border-t border-white/[0.06]"
      >
        <div className="px-4 py-2 flex items-end gap-2">
          <div className="flex-1 bg-white/[0.06] rounded-2xl px-3 py-2 min-h-[40px] flex items-center">
            <textarea
              ref={inputRef}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={composerPlaceholder}
              rows={1}
              className="flex-1 bg-transparent text-[16px] text-white placeholder:text-white/40 outline-none resize-none max-h-[120px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!reply.trim()}
            aria-label="Envoyer"
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
              reply.trim()
                ? "bg-[#E63946] active:bg-[#D42B22]"
                : "bg-white/[0.06]"
            }`}
          >
            {/* iMessage-style up-chevron — thick stroke for legibility
                inside the small circular button. */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={reply.trim() ? "#FFFFFF" : "#4a4d56"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
        {composerNote && (
          <div className="px-4 pb-2 -mt-1">
            {composerNote}
          </div>
        )}
      </div>

      {/* Optional siblings — portaled bottom sheets etc. */}
      {children}

      <style jsx>{`
        @keyframes nx-pulse-thread-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        :global(.nx-pulse-thread) { background: #1A1D24; animation: nx-pulse-thread-kf 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
