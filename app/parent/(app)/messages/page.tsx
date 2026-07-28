"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useParentConversations, type ParentThreadData } from "@/lib/queries/parent/useParentConversations";
import ParentThread from "./[id]/page";

/* ═══════════════════════════════════════════════════════════════
   Parent Messages — thread list (PARENT_COACH). Universal
   conversation-list law: every thread the parent participates in.
   Counterparty = coach/director ; each row names the child it is
   about. Web-only (the parent portal is mobile-excluded).
═══════════════════════════════════════════════════════════════ */

function relativeTime(isoStr: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return d.toLocaleDateString("fr-CA", { weekday: "long" });
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

function ThreadRow({ t }: { t: ParentThreadData }) {
  const unread = t.unreadCount > 0;
  return (
    <Link
      href={`/parent/messages?id=${t.id}`}
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#252D3A] ${
        unread ? "bg-[#1E2430] border-l-[3px] border-l-[#E63946]" : "bg-[#1A1D24] border-l-[3px] border-l-transparent"
      }`}
    >
      {t.coachPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.coachPhotoUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
          <span className="text-[13px] font-bold text-[#9CA3AF]">{t.coachInitials}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-[15px] truncate ${unread ? "font-bold text-white" : "font-semibold text-[#e0e0e0]"}`}>{t.coachName}</p>
          <span className="text-[11px] text-[#6b7280] shrink-0 hidden sm:inline">{t.coachRole}</span>
        </div>
        <p className="text-[12px] text-[#E63946]/80 truncate">À propos de {t.childName}</p>
        <p className="text-[13px] text-[#6b7280] truncate mt-0.5">{t.lastMessage || "Nouvelle conversation"}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[12px] ${unread ? "text-white font-semibold" : "text-[#6b7280]"}`}>{relativeTime(t.lastMessageAt)}</span>
        {unread && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#E63946] text-white text-[10px] font-black inline-flex items-center justify-center">{t.unreadCount}</span>}
      </div>
    </Link>
  );
}

export default function ParentMessagesPage() {
  return (
    <Suspense fallback={null}>
      <ParentMessagesRouter />
    </Suspense>
  );
}

// STRATÉGIE A — query-param routing : ?id=<uuid> → le fil, sinon l'inbox.
function ParentMessagesRouter() {
  const threadId = useSearchParams().get("id");
  if (threadId) return <ParentThread />;
  return <ParentMessagesInbox />;
}

function ParentMessagesInbox() {
  const { data: threads = [], isLoading } = useParentConversations();
  const unreadCount = threads.filter((t) => t.unreadCount > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Messages</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center bg-[#E63946] text-white text-[12px] font-bold px-3 py-1 rounded-full">
              {unreadCount} nouveau{unreadCount > 1 ? "x" : ""}
            </span>
          )}
        </div>
        <Link
          href="/parent/messages/nouveau"
          className="inline-flex items-center gap-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold px-4 py-2 rounded-lg transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
          Nouveau
        </Link>
      </div>
      <p className="text-[13px] text-[#9CA3AF] -mt-3">Vos échanges avec les entraîneurs et directeurs de l&apos;école de votre enfant.</p>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" /></div>
      ) : threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-5">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
          </div>
          <h3 className="font-head text-lg font-black text-white uppercase tracking-wide mb-2">Aucune conversation</h3>
          <p className="text-[14px] text-[#9CA3AF] max-w-sm mb-5 leading-relaxed">Écrivez à un entraîneur ou au directeur sportif de l&apos;école de votre enfant.</p>
          <Link href="/parent/messages/nouveau" className="inline-flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-5 py-2.5 font-head font-bold text-[13px] uppercase tracking-widest hover:bg-[#D42B22] transition-colors">
            Nouveau message
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      ) : (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden divide-y divide-[#2D3748]/50">
          {threads.map((t) => <ThreadRow key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}
