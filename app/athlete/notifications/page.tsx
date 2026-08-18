"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { relativeTimeFr } from "@/lib/utils/relativeTime";
import PendingInvitations from "./_components/PendingInvitations";

/* ═══════════════════════════════════════════════════════════════
   Notifications — Athlete activity alerts (wired to Supabase)
═══════════════════════════════════════════════════════════════ */

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

type NotifType = "PROFILE_VIEWED" | "ADDED_TO_FAVORITES" | "SUGGESTION_APPROVED" | "SUGGESTION_REJECTED" | "COACH_REPORT_UPDATED" | "COACH_VERIFIED" | "COACH_MODIFIED_PROFILE" | "COACH_DISTINCTION_ADDED" | "COACH_EVALUATION_UPDATED" | "PROFILE_MILESTONE" | "PROFILE_TIP"
  // TEAM_INVITATION existe en base depuis Flow A mais manquait ici : la requête
  // étant un select("*") sans filtre de type, ces lignes s'affichaient SANS
  // pastille ni icône (les deux maps rendaient `undefined`) et dans aucun
  // onglet. Le geste d'acceptation vit dans la carte <PendingInvitations>
  // en haut de cette même page.
  | "TEAM_INVITATION";

interface AthleteNotif {
  id: string;
  type: NotifType;
  title: string;
  message: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

const DOT_COLOR: Record<NotifType, string> = {
  PROFILE_VIEWED: "#9CA3AF",
  ADDED_TO_FAVORITES: "#E63946",
  SUGGESTION_APPROVED: "#22C55E",
  SUGGESTION_REJECTED: "#E63946",
  COACH_REPORT_UPDATED: "#3B82F6",
  COACH_VERIFIED: "#3B82F6",
  COACH_MODIFIED_PROFILE: "#EAB308",
  COACH_DISTINCTION_ADDED: "#F59E0B",
  COACH_EVALUATION_UPDATED: "#22C55E",
  PROFILE_MILESTONE: "#F59E0B",
  PROFILE_TIP: "#EAB308",
  // Ambre = action attendue de l'athlète, même hue que le badge « En attente ».
  TEAM_INVITATION: "#F59E0B",
};

const TYPE_ICON: Record<NotifType, React.ReactNode> = {
  PROFILE_VIEWED: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  ADDED_TO_FAVORITES: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>,
  SUGGESTION_APPROVED: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>,
  SUGGESTION_REJECTED: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>,
  COACH_REPORT_UPDATED: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>,
  COACH_VERIFIED: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></svg>,
  COACH_MODIFIED_PROFILE: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  COACH_DISTINCTION_ADDED: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  COACH_EVALUATION_UPDATED: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>,
  PROFILE_MILESTONE: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 010-5C7 4 7 7 7 7" /><path d="M18 9h1.5a2.5 2.5 0 000-5C17 4 17 7 17 7" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" /><path d="M18 2H6v7a6 6 0 0012 0V2Z" /></svg>,
  PROFILE_TIP: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
  TEAM_INVITATION: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
};

type FilterKey = "all" | "unread" | "profile" | "suggestions" | "coach";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<AthleteNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);

  // Load notifications from Supabase
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: athlete } = await supabase
        .from("athletes")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!athlete) { setLoading(false); return; }

      setAthleteId(athlete.id);

      const { data } = await supabase
        .from("athlete_notifications")
        .select("*")
        .eq("athlete_id", athlete.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setNotifs((data || []) as AthleteNotif[]);
      setLoading(false);
    };
    load();
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    switch (filter) {
      case "unread": return notifs.filter((n) => !n.read);
      case "profile": return notifs.filter((n) => ["PROFILE_VIEWED", "ADDED_TO_FAVORITES", "PROFILE_MILESTONE", "PROFILE_TIP"].includes(n.type));
      case "suggestions": return notifs.filter((n) => ["SUGGESTION_APPROVED", "SUGGESTION_REJECTED"].includes(n.type));
      case "coach": return notifs.filter((n) => ["COACH_REPORT_UPDATED", "COACH_VERIFIED", "COACH_MODIFIED_PROFILE", "COACH_DISTINCTION_ADDED", "COACH_EVALUATION_UPDATED", "TEAM_INVITATION"].includes(n.type));
      default: return notifs;
    }
  }, [notifs, filter]);

  const markRead = async (id: string) => {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    const supabase = createClient();
    supabase.from("athlete_notifications").update({ read: true }).eq("id", id).then(() => {
      window.dispatchEvent(new Event("notifications-updated"));
    });
  };

  const markAllRead = async () => {
    if (!athleteId) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast("Tout marqué comme lu");
    const supabase = createClient();
    supabase.from("athlete_notifications").update({ read: true }).eq("athlete_id", athleteId).eq("read", false).then(() => {
      window.dispatchEvent(new Event("notifications-updated"));
    });
  };

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  const FILTERS: { key: FilterKey; label: string; count?: number; color?: string }[] = [
    { key: "all", label: "Toutes", count: notifs.length },
    { key: "unread", label: "Non lues", count: unreadCount, color: "#E63946" },
    { key: "profile", label: "Profil" },
    { key: "suggestions", label: "Suggestions" },
    { key: "coach", label: "Coach" },
  ];

  if (loading) {
    return (
      <div className="px-6 sm:px-10 pb-8 max-w-[900px] mx-auto nx-safe-top">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#1A1D24] rounded w-48" />
          <div className="h-10 bg-[#1A1D24] rounded w-full" />
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-[#1A1D24] rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 pb-8 max-w-[900px] mx-auto space-y-5">

      {/* Header — nx-safe-top : padding haut = env(safe-area-inset-top) + 0.75rem
          (canon globals.css). Conteneur passé en pb-8 pour ne pas empiler ce
          padding sur l'ancien py-8 top. */}
      <div className="flex items-center justify-between nx-safe-top">
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Notifications</h1>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllRead} className="text-[12px] font-bold text-[#6b7280] hover:text-white transition-colors">Tout marquer comme lu</button>
        )}
      </div>

      {/* Flow A invitations — 5.5e-iv-b. Self-hides when 0 PENDING. */}
      {athleteId && <PendingInvitations athleteId={athleteId} showToast={showToast} />}

      {/* Filter tabs */}
      <div className="w-full min-w-0 flex items-center gap-2.5 py-1 overflow-x-auto nx-no-scrollbar">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`px-4 py-2.5 rounded-xl text-[13px] font-bold uppercase tracking-[0.04em] whitespace-nowrap transition-colors ${
                active ? "bg-[#E63946] text-white border border-[#E63946]" : "text-[#9CA3AF] border border-transparent hover:text-white"
              }`}>
              {f.label}
              {f.count !== undefined && f.count > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black"
                  style={
                    active
                      ? { backgroundColor: "rgba(255,255,255,0.25)", color: "#fff" }
                      : f.color
                        ? { backgroundColor: f.color, color: "#fff" }
                        : { backgroundColor: "#2D3748", color: "#9CA3AF" }
                  }>
                  {f.count}
                </span>
              )}
            </button>
          );
        })}
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
          <h3 className="font-head text-lg font-black text-white uppercase mb-1">
            {filter === "unread" ? "Aucune notification non lue" : "Aucune notification"}
          </h3>
          <p className="text-[13px] text-[#9CA3AF]">Tu es à jour! Reviens bientôt pour voir l&apos;activité sur ton profil.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const color = DOT_COLOR[n.type] || "#9CA3AF";
              /* Une notification de re-validation MENE quelque part : c'est la
                 seule dont l'utilite depend d'une action. Les autres restent
                 informatives — le clic les marque lues, sans navigation. */
              /* MOBILE : /athlete/profil sort tot sur <AthleteEditWizardMobile>
                 (app/athlete/profil/page.tsx) — le bloc de reconfirmation n'y
                 est jamais rendu, la notification menait donc a un cul-de-sac.
                 Le tableau de bord mobile porte la banniere qui, elle, appelle
                 confirmValidation(). */
              const target = n.metadata?.kind === "monthly_validation_expired"
                ? (IS_CAPACITOR ? "/athlete/dashboard" : "/athlete/profil")
                : null;
              return (
              <button key={n.id} type="button"
                onClick={() => { markRead(n.id); if (target) router.push(target); }}
                className={`w-full text-left rounded-lg border p-4 transition-all hover:border-[#2D3748] ${
                  n.read ? "bg-[#1A1D24] border-white/5" : "bg-[#1A1D24] border-[#2D3748]"
                }`}>
                <div className="flex items-start gap-3">
                  {!n.read && <span className="w-2 h-2 rounded-full bg-[#E63946] shrink-0 mt-2" />}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                    <span style={{ color }}>{TYPE_ICON[n.type]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] leading-relaxed ${n.read ? "text-[#9CA3AF]" : "text-white font-semibold"}`}>{n.title}</p>
                    {n.message && <p className="text-[12px] text-[#6b7280] mt-0.5">{n.message}</p>}
                    <p className="text-[11px] text-[#4a4d56] mt-1" title={new Date(n.created_at).toLocaleString("fr-CA")}>{relativeTimeFr(n.created_at)}</p>
                  </div>
                </div>
              </button>
            );
          })}
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
