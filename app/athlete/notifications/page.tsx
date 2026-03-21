"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { athleteNotifications } from "@/lib/mock/athlete";
import type { AthleteNotification } from "@/lib/mock/athlete";

/* ═══════════════════════════════════════════════════════════════
   Notifications — Athlete activity alerts
═══════════════════════════════════════════════════════════════ */

const DOT_COLOR: Record<AthleteNotification["type"], string> = {
  profile_viewed: "#9CA3AF",
  new_favorite: "#E63946",
  suggestion_approved: "#22C55E",
  suggestion_rejected: "#E63946",
  coach_update: "#3B82F6",
  milestone: "#F59E0B",
  completion_reminder: "#EAB308",
};

const TYPE_ICON: Record<AthleteNotification["type"], React.ReactNode> = {
  profile_viewed: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  new_favorite: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>,
  suggestion_approved: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>,
  suggestion_rejected: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>,
  coach_update: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>,
  milestone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>,
  completion_reminder: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
};

type FilterKey = "all" | "unread" | "profile" | "suggestions" | "coach";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 7) return `Il y a ${d} jours`;
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(athleteNotifications);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [toast, setToast] = useState<string | null>(null);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    switch (filter) {
      case "unread": return notifs.filter((n) => !n.read);
      case "profile": return notifs.filter((n) => n.type === "profile_viewed" || n.type === "new_favorite");
      case "suggestions": return notifs.filter((n) => n.type === "suggestion_approved" || n.type === "suggestion_rejected");
      case "coach": return notifs.filter((n) => n.type === "coach_update");
      default: return notifs;
    }
  }, [notifs, filter]);

  const markRead = (id: string) => setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  const markAllRead = () => { setNotifs((prev) => prev.map((n) => ({ ...n, read: true }))); setToast("Tout marqué comme lu"); setTimeout(() => setToast(null), 2000); };

  const FILTERS: { key: FilterKey; label: string; count?: number; color?: string }[] = [
    { key: "all", label: "Toutes", count: notifs.length },
    { key: "unread", label: "Non lues", count: unreadCount, color: "#E63946" },
    { key: "profile", label: "Profil" },
    { key: "suggestions", label: "Suggestions" },
    { key: "coach", label: "Coach" },
  ];

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[900px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Notifications</h1>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllRead} className="text-[12px] font-bold text-[#6b7280] hover:text-white transition-colors">Tout marquer comme lu</button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              filter === f.key ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "text-[#6b7280] border border-transparent hover:text-[#9CA3AF]"
            }`}>
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black ${
                f.color ? `bg-[${f.color}] text-white` : "bg-[#2D3748] text-[#9CA3AF]"
              }`} style={f.color ? { backgroundColor: f.color } : undefined}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
              <path d="M9 12l2 2 4-4" stroke="#22C55E" strokeWidth="2" />
            </svg>
          </div>
          <h3 className="font-head text-lg font-black text-white uppercase mb-1">Aucune notification non lue</h3>
          <p className="text-[13px] text-[#9CA3AF]">Tu es à jour! Reviens bientôt pour voir l&apos;activité sur ton profil.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <button key={n.id} type="button" onClick={() => markRead(n.id)}
              className={`w-full text-left rounded-lg border p-4 transition-all hover:border-[#2D3748] ${
                n.read ? "bg-[#1A1D24] border-white/5" : "bg-[#1A1D24] border-[#2D3748]"
              }`}>
              <div className="flex items-start gap-3">
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#E63946] shrink-0 mt-2" />}
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${DOT_COLOR[n.type]}15` }}>
                  <span style={{ color: DOT_COLOR[n.type] }}>{TYPE_ICON[n.type]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] leading-relaxed ${n.read ? "text-[#9CA3AF]" : "text-white font-semibold"}`}>{n.message}</p>
                  <p className="text-[11px] text-[#4a4d56] mt-1" title={new Date(n.time).toLocaleString("fr-CA")}>{relativeTime(n.time)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Preferences link */}
      <div className="pt-4 border-t border-[#2D3748]/40">
        <Link href="/athlete/parametres" className="text-[12px] text-[#6b7280] hover:text-white transition-colors">
          Gérer mes préférences de notifications →
        </Link>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg">
            <span className="text-[13px] font-bold text-white">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
