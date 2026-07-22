"use client";

/* ═══════════════════════════════════════════════════════════════
   MessageBubble — single chat bubble.

   Extracted verbatim from RecruteurMessagesThreadMobile. Colors
   default to the iOS-style palette already used by recruiter
   threads (blue #0A84FF for me, gray #262628 for the other party)
   and can be overridden via props in case a role wants different
   accents in the future.

   Status indicators (sending / sent / error) are rendered as small
   text under the bubble — same shape as today.
═══════════════════════════════════════════════════════════════ */

import { timeOfDay } from "./utils";

export interface MessageBubbleProps {
  content: string;
  createdAt: string;
  isMe: boolean;
  status?: "sending" | "sent" | "error";
  /** Bubble color when the message is from the current user. */
  meColor?: string;
  /** Bubble color when the message is from the other party. */
  otherColor?: string;
  /** Message rétracté par l'admin → rendu comme une ligne système centrée
      (italique #6B7280, pas de bulle). Le contenu est déjà le marqueur. */
  retracted?: boolean;
}

export function MessageBubble({
  content, createdAt, isMe, status,
  meColor = "#0A84FF",
  otherColor = "#262628",
  retracted = false,
}: MessageBubbleProps) {
  if (retracted) {
    return (
      <div className="flex justify-center px-4 py-1">
        <span className="text-[12px] italic text-[#6B7280]">
          {content || "Message retiré par Nexus"}
        </span>
      </div>
    );
  }
  const isSending = status === "sending";
  const isError = status === "error";
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} px-4`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
          isMe
            ? `rounded-br-md ${isSending ? "opacity-70" : ""} ${isError ? "ring-2 ring-[#EF4444]/60" : ""}`
            : "rounded-bl-md"
        }`}
        style={{ backgroundColor: isMe ? meColor : otherColor }}
      >
        <p className="text-[16px] text-white leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </p>
      </div>
      <div className={`flex items-center gap-1.5 mt-1 ${isMe ? "pr-1" : "pl-1"}`}>
        <span className="text-[10px] text-white/35">{timeOfDay(createdAt)}</span>
        {isMe && isSending && (
          <span className="text-[10px] text-white/35 italic">envoi…</span>
        )}
        {isMe && isError && (
          <span className="text-[10px] text-[#EF4444] font-semibold">échec</span>
        )}
      </div>
    </div>
  );
}
