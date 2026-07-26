"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   Portal parental — Lot 1c. Page Notifications (web only).

   Liste antéchronologique (50 dernières) des parent_notifications du
   parent (RLS restreint aux siennes). Marquer lu au clic + tout marquer lu.
   Tout est ANONYME (title/message générés côté trigger, sans identité).
   ═══════════════════════════════════════════════════════════════ */

interface Notif {
  id: string;
  type: "CHILD_FAVORITED" | "CHILD_PIPELINE_STAGE" | "CHILD_VISIT_PLANNED" | string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

const card = "bg-[#1A1D24] border border-white/5 rounded-xl";

const TYPE_ICON: Record<string, React.ReactNode> = {
  CHILD_FAVORITED: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
  ),
  CHILD_PIPELINE_STAGE: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>
  ),
  CHILD_VISIT_PLANNED: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
  ),
};

export default function ParentNotificationsPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("parent_notifications")
      .select("id, type, title, message, read, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { setLoadError("Impossible de charger les notifications."); return; }
    setItems((data as Notif[]) ?? []);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { await load(); if (!cancelled) setLoading(false); })();
    return () => { cancelled = true; };
  }, [load]);

  const unreadCount = items.filter((n) => !n.read).length;

  async function markRead(id: string) {
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const supabase = createClient();
    const { error } = await supabase.from("parent_notifications").update({ read: true }).eq("id", id);
    if (error) setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n))); // revert
  }

  async function markAllRead() {
    if (unreadCount === 0 || marking) return;
    setMarking(true);
    const snapshot = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    const supabase = createClient();
    const { error } = await supabase.from("parent_notifications").update({ read: true }).eq("read", false);
    if (error) setItems(snapshot); // revert
    setMarking(false);
  }

  return (
    <div className="space-y-6">
      <Link href="/parent" className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Retour
      </Link>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-bold text-white uppercase tracking-tight">Notifications</h1>
          <p className="text-[13px] text-[#9CA3AF] mt-1">Événements récents liés au profil de votre enfant.</p>
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllRead} disabled={marking}
            className="shrink-0 text-[12px] font-semibold text-[#E63946] hover:text-white transition-colors disabled:opacity-50">
            Tout marquer lu
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[#6B7280]">Chargement…</p>
      ) : loadError ? (
        <div className={`${card} p-5`}><p className="text-sm text-[#9CA3AF]">{loadError}</p></div>
      ) : items.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <p className="text-[14px] text-[#9CA3AF]">Aucune notification pour le moment.</p>
          <p className="text-[12px] text-[#6B7280] mt-1">Vous serez informé lorsqu&apos;un recruteur s&apos;intéresse au profil de votre enfant.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button key={n.id} type="button" onClick={() => markRead(n.id)}
              className={`${card} w-full text-left px-4 py-3.5 flex items-start gap-3.5 transition-colors hover:border-white/10 ${n.read ? "opacity-70" : ""}`}>
              <span className={`shrink-0 mt-0.5 ${n.read ? "text-[#6B7280]" : "text-[#E63946]"}`}>
                {TYPE_ICON[n.type] ?? TYPE_ICON.CHILD_PIPELINE_STAGE}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-[14px] truncate ${n.read ? "font-medium text-[#D1D5DB]" : "font-semibold text-white"}`}>{n.title}</p>
                  {!n.read && <span className="shrink-0 w-2 h-2 rounded-full bg-[#E63946]" />}
                </div>
                {n.message && <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 leading-snug">{n.message}</p>}
                <p className="text-[11px] text-[#6B7280] mt-1">{fmtRelative(n.created_at)}</p>
              </div>
            </button>
          ))}
          {items.length === 50 && (
            <p className="text-[11px] text-[#6B7280] text-center pt-2">Les 50 notifications les plus récentes sont affichées.</p>
          )}
        </div>
      )}
    </div>
  );
}

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}
