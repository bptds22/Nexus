"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import MessagesThread from "./[id]/PageClient";
import { useAthleteConversations, type AthleteThreadData } from "@/lib/queries/athlete/useAthleteConversations";
import { AthleteMessagesMobile } from "@/components/shared/AthleteMessagesMobile";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { MessagesToolbar } from "@/components/shared/messaging/MessagesToolbar";
import {
  STATUS_SORT_PRIORITY,
  matchesStatusPreset,
  type StatusPreset,
} from "@/lib/messaging/threadStatus";
import { deriveTypeSegments, matchesTypeSegment } from "@/lib/messaging/typeSegments";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Athlete Messages — thread list (ATHLETE_COACH).
   Same layout as the coach inbox : search (Row 1) + type segmented
   filter adjacent + status pills (Row 2). Shared toolbar + shared
   status/type helpers — one implementation, no drift.
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
  if (days < 7) {
    const names = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return names[d.getDay()];
  }
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

function ThreadRow({ t }: { t: AthleteThreadData }) {
  const unread = t.unreadCount > 0;
  // Vrai groupe chat — UNE row : avatar de groupe générique (icône groupe,
  // pas une photo) + groupName + dernier message visible (RLS-filtré) + badge.
  if (t.isGroup) {
    return (
      <Link
        href={`/athlete/messages?id=${t.id}`}
        className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#252D3A] ${
          unread ? "bg-[#1E2430] border-l-[3px] border-l-[#0EA5E9]" : "bg-[#1A1D24] border-l-[3px] border-l-transparent"
        }`}
      >
        <div className="w-11 h-11 rounded-full bg-[#0EA5E9]/15 border border-[#0EA5E9]/30 flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-[15px] truncate ${unread ? "font-bold text-white" : "font-semibold text-[#e0e0e0]"}`}>{t.groupName || "Groupe"}</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#0EA5E9]/15 border border-[#0EA5E9]/30 text-[#38BDF8] shrink-0">Groupe</span>
          </div>
          <p className="text-[13px] text-[#6b7280] truncate mt-0.5">{t.lastMessage || "Nouvelle conversation"}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[12px] ${unread ? "text-white font-semibold" : "text-[#6b7280]"}`}>{relativeTime(t.lastMessageAt)}</span>
          {unread && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#0EA5E9] text-[#0b0d10] text-[10px] font-black inline-flex items-center justify-center">{t.unreadCount}</span>}
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={`/athlete/messages?id=${t.id}`}
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#252D3A] ${
        unread ? "bg-[#1E2430] border-l-[3px] border-l-[#22C55E]" : "bg-[#1A1D24] border-l-[3px] border-l-transparent"
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
          {/* When the coach has no resolved name, coachName already carries
              "{role} — {école}" — skip the redundant role·école subtitle. */}
          {t.hasCoachName && (
            <span className="text-[11px] text-[#6b7280] shrink-0 hidden sm:inline">{t.coachRole}{t.coachSchool ? ` · ${t.coachSchool}` : ""}</span>
          )}
        </div>
        <p className="text-[13px] text-[#6b7280] truncate mt-0.5">{t.lastMessage || "Nouvelle conversation"}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[12px] ${unread ? "text-white font-semibold" : "text-[#6b7280]"}`}>{relativeTime(t.lastMessageAt)}</span>
        {unread && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#22C55E] text-[#0b0d10] text-[10px] font-black inline-flex items-center justify-center">{t.unreadCount}</span>}
      </div>
    </Link>
  );
}

export default function AthleteMessagesPage() {
  return (
    <Suspense fallback={null}>
      <AthleteMessagesRouter />
    </Suspense>
  );
}

// STRATÉGIE A — query-param routing : ?id=<uuid> → le fil, sinon l'inbox.
function AthleteMessagesRouter() {
  const threadId = useSearchParams().get("id");
  if (threadId) return <MessagesThread />;
  if (IS_CAPACITOR) return <AthleteMessagesMobile />;
  return <AthleteMessagesContent />;
}

function AthleteMessagesContent() {
  const { data: threads = [], isLoading } = useAthleteConversations();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [statusFilter, setStatusFilter] = useState<StatusPreset>("tous");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const unreadCount = threads.filter((t) => t.unreadCount > 0).length;

  // Type-driven segments — "Recruteurs" auto-appears when a
  // RECRUTEUR_ATHLETE thread exists (P3-ready), with zero rework here.
  const typeSegments = useMemo(
    () => deriveTypeSegments(threads.map((t) => t.conversationType), "athlete"),
    [threads],
  );

  const filtered = useMemo(() => {
    let list = [...threads];

    list = list.filter((t) => matchesTypeSegment(typeSegments, typeFilter, t.conversationType));

    if (debouncedSearch.trim().length >= 2) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (t) =>
          t.coachName.toLowerCase().includes(q) ||
          t.coachSchool.toLowerCase().includes(q) ||
          t.lastMessage.toLowerCase().includes(q)
      );
    }

    list = list.filter((t) => matchesStatusPreset(statusFilter, { status: t.threadStatus, lastSenderId: t.lastSenderId }, userId));

    list.sort((a, b) => {
      const sp = STATUS_SORT_PRIORITY[a.threadStatus] - STATUS_SORT_PRIORITY[b.threadStatus];
      if (sp !== 0) return sp;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return list;
  }, [threads, typeSegments, typeFilter, debouncedSearch, statusFilter, userId]);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1000px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Messages</h1>
            <p className="text-[14px] text-[#9CA3AF] mt-1">Tes échanges avec les entraîneurs et directeurs de ton école</p>
          </div>
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-[#22C55E] text-[#0b0d10] text-[13px] font-bold px-3.5 py-1.5 rounded-full self-start">
              {unreadCount} nouveau{unreadCount > 1 ? "x" : ""}
            </span>
          )}
        </div>
        <Link
          href="/athlete/messages/nouveau"
          className="inline-flex items-center gap-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-5 py-2.5 rounded-lg transition-colors self-start sm:self-auto"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Nouveau message
        </Link>
      </div>

      {/* ── Toolbar (shared with the coach inbox) ───────────── */}
      <MessagesToolbar
        search={search}
        onSearchChange={setSearch}
        typeSegments={typeSegments}
        typeValue={typeFilter}
        onTypeChange={setTypeFilter}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">
            {threads.length === 0 ? "Aucune conversation" : "Aucun résultat"}
          </h3>
          <p className="text-[14px] text-[#9CA3AF] max-w-md mb-6 leading-relaxed">
            {threads.length === 0
              ? "Écris à un entraîneur ou au directeur sportif de ton école pour poser tes questions."
              : "Essaie d'autres termes de recherche ou un autre filtre."}
          </p>
          {threads.length === 0 && (
            <Link
              href="/athlete/messages/nouveau"
              className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-6 py-3 font-head font-bold text-[13px] uppercase tracking-widest transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 active:scale-95"
            >
              Nouveau message
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden divide-y divide-[#2D3748]/50">
          {filtered.map((t) => <ThreadRow key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}
