"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachDashboardMobile — Page Dashboard coach mobile-native (iter coach-1)
   Calqué sur RecruteurDashboardMobile (template validé) — même tokens,
   même Outfit weights, mêmes patterns (hero gradient + KPI bento +
   horizontal-scroll strip + activity feed).

   Architecture : Option B — useEffect inline porté de la page web
   coach actuelle (app/coach/tableau-de-bord/page.tsx). Pas de hooks
   TanStack pour ce sprint.

   Source intérim : feat/capacitor-setup branch — is_school_admin +
   profile_data.admin_type === 'interim' (PAS la query legacy
   school_coaches.role='DIRECTEUR_INTERIM' qui ne couvrait que APPROVED
   et était dépréciée au sprint coach-responsable-2c).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ActivityEvent } from "@/lib/types/activityEvents";

/* ── Helpers (verbatim recruteur dashboard) ──────────────────── */

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

function frenchDateUppercase(d: Date): string {
  const days = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
  const months = [
    "JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN",
    "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getInitials(name?: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  const f = parts[0]?.[0] ?? "";
  const l = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (f + l).toUpperCase() || "—";
}

/* Verbe activité — adapté au mapping coach (la page web actuelle traduit
   recruiter_activity_log → ActivityEvent.type avec un mapping spécifique
   coach, on reprend les mêmes types ici). */
function activityVerb(activity: ActivityEvent): string {
  switch (activity.type) {
    case "competitor_favorited":   return activity.iconColor === "#6B7280" ? "Retiré des favoris" : "Ajouté aux favoris";
    case "status_engage":          return "Mouvement dans un pipeline";
    case "profile_verified":       return "Profil vérifié";
    case "video_added":            return "Vidéo ajoutée";
    case "profile_updated_bulk":   return "Profil consulté";
    case "scouting_report_updated":return "Profil mis à jour";
    default:                       return "Activité";
  }
}

/* ── Types data (locaux — alignés sur les états de la web page) ─ */

interface ActionBarData {
  unreadMessages: number;
  incompleteProfiles: number;
  newAthletes: number;
  pendingSuggestions: number;
}

interface KpiData {
  totalAthletes: number;
  verifiedCount: number;
  completePct: number;
  recruiterViews: number;
  viewsTrend: number;
}

interface HotAthleteRow {
  id: string;
  rank: number; // 1..5
  name: string;
  position: string;
  stars: number;
  photoUrl: string | null;
  viewsThisWeek: number;
  uniqueRecruiters: number;
}

interface DemotionNotif {
  id: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
}

/* ═══════════════════════════════════════════════════════════════
   DashboardHero — rouge gradient + X mark BG (parité recruteur)
═══════════════════════════════════════════════════════════════ */

function DashboardHero({
  greeting, schoolName, currentDate,
  unreadMessages, viewsTrend, recruiterViews, pendingSuggestions,
  onTapMessages, onTapTrend, onTapSuggestions,
}: {
  greeting: string;
  schoolName: string;
  currentDate: Date;
  unreadMessages: number;
  viewsTrend: number;
  recruiterViews: number;
  pendingSuggestions: number;
  onTapMessages: () => void;
  onTapTrend: () => void;
  onTapSuggestions: () => void;
}) {
  // Headline ranking : unreadMessages > 0 → viewsTrend > 0 → fallback
  // Wording "recruteurs intéressés" (la source est recruiter_pipeline
  // stage='CONTACTE' — c'est l'intérêt recruteur, PAS une inbox).
  const hasInterest = unreadMessages > 0;
  const hasTrend = viewsTrend > 0 && recruiterViews > 0;

  return (
    <div className="px-4 pt-5">
      <div
        className="relative overflow-hidden w-full rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, #E63946 0%, #B82834 60%, #7F1B25 100%)",
          minHeight: 260,
        }}
      >
        {/* Trio marque arrière (parité recruteur — blanc derrière, noir devant) */}
        <div
          className="absolute z-0 pointer-events-none"
          style={{ top: 50, right: -60, width: 300, height: 300, opacity: 1 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-white.svg" alt="" className="w-full h-full object-contain" />
        </div>
        {/* Front layer : recoloré au token bg page (#111317) pour donner
            l'illusion que la page transparaît à travers le dégradé rouge.
            <img src=svg> ne se recolore pas en CSS → on utilise l'asset
            comme mask-image (stencil) et background-color porte la couleur. */}
        <div
          className="absolute z-0 pointer-events-none"
          style={{ top: 48, right: -58, width: 300, height: 300, opacity: 1 }}
        >
          <div
            className="w-full h-full"
            style={{
              backgroundColor: "#111317",
              WebkitMaskImage: "url(/brand/icon-black.svg)",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              WebkitMaskSize: "contain",
              maskImage: "url(/brand/icon-black.svg)",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              maskSize: "contain",
            }}
          />
        </div>

        <div className="relative z-10">
          {/* Eyebrow : date + chip école */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wider text-white/75 font-semibold truncate">
              {frenchDateUppercase(currentDate)}
            </p>
            {schoolName && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.16] px-2.5 py-1 flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <span className="text-[13px] text-white truncate max-w-[180px]">{schoolName}</span>
              </span>
            )}
          </div>

          {/* Greeting + headline punchy (contraint à gauche pour ne pas mordre le X) */}
          <div className="max-w-[62%]">
            <p className="text-[20px] font-medium text-white/85 mt-3">
              Bonjour{greeting ? `, ${greeting}` : ""}
            </p>

            {hasInterest ? (
              <button
                type="button"
                onClick={() => { triggerHaptic("Light"); onTapMessages(); }}
                className="block w-full text-left active:opacity-80 transition-opacity mt-2"
              >
                <h1 className="text-[30px] font-extrabold text-white leading-tight tracking-tight">
                  {unreadMessages} recruteur{unreadMessages > 1 ? "s" : ""} intéressé{unreadMessages > 1 ? "s" : ""}
                </h1>
              </button>
            ) : hasTrend ? (
              <button
                type="button"
                onClick={() => { triggerHaptic("Light"); onTapTrend(); }}
                className="block w-full text-left active:opacity-80 transition-opacity mt-2"
              >
                <h1 className="text-[30px] font-extrabold text-white leading-tight tracking-tight">
                  +{viewsTrend}% de vues ce mois
                </h1>
              </button>
            ) : (
              <h1 className="text-[30px] font-extrabold text-white leading-tight tracking-tight mt-2">
                Suis tes athlètes
              </h1>
            )}
          </div>

          {/* Badge pulse : suggestions en attente */}
          {pendingSuggestions > 0 && (
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); onTapSuggestions(); }}
              className="inline-flex items-center gap-2 mt-4 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1.5 active:bg-white/[0.28] transition-colors"
            >
              <span className="relative flex w-2 h-2 flex-shrink-0">
                <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-60" />
                <span className="relative w-2 h-2 rounded-full bg-white" />
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              <span className="text-[14px] text-white font-semibold">
                {pendingSuggestions} suggestion{pendingSuggestions > 1 ? "s" : ""} à examiner
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   InterimBanner — gris neutre, persistant (source = is_school_admin
   + profile_data.admin_type === 'interim')
═══════════════════════════════════════════════════════════════ */

function InterimBanner({ schoolName }: { schoolName: string }) {
  return (
    <div className="mx-4 mt-4 rounded-2xl border border-white/[0.06] bg-[#1A1D24] px-4 py-3.5 flex items-start gap-3">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-white">
          Tu es directeur sportif intérimaire{schoolName ? ` de ${schoolName}` : ""}
        </p>
        <p className="text-[13px] text-white/55 mt-0.5 leading-relaxed">
          Tu as les pleins pouvoirs administratifs jusqu&apos;à l&apos;arrivée d&apos;un directeur permanent.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DemotionNotificationCard — gold amber, dismissible
═══════════════════════════════════════════════════════════════ */

function DemotionNotificationCard({
  notif, onDismiss,
}: {
  notif: DemotionNotif;
  onDismiss: () => void;
}) {
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-[#F59E0B]/25 bg-[#F59E0B]/[0.06] px-4 py-3.5 flex items-start gap-3">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-[#F59E0B]">{notif.title}</p>
        {notif.message && (
          <p className="text-[13px] text-white/55 mt-0.5 leading-relaxed">{notif.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => { triggerHaptic("Light"); onDismiss(); }}
        aria-label="Fermer"
        className="shrink-0 text-white/55 active:text-white transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KpiTrio — 3 cards bento (Athlètes / Profils vérifiés / Vues)
═══════════════════════════════════════════════════════════════ */

function KpiTrio({ data }: { data: KpiData }) {
  return (
    <div className="px-4">
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-3">
        Santé du programme
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {/* Athlètes roster — full width row 1 */}
        <div className="col-span-2 bg-[#1A1D24] rounded-2xl border border-white/[0.05] p-[18px]">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                Athlètes au roster
              </p>
              <p className="text-[32px] font-extrabold text-white leading-none mt-2 tabular-nums">
                {data.totalAthletes}
              </p>
              <p className="text-[13px] text-white/45 mt-1">inscrits cette saison</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#E63946]/15 flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
          </div>
        </div>

        {/* Profils vérifiés (badge blue = verified semantic) */}
        <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.05] p-[18px]">
          <p className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
            Vérifiés
          </p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <p className="text-[28px] font-extrabold text-white leading-none tabular-nums">
              {data.completePct}%
            </p>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-auto">
              <path d="M12 2L4 7v6c0 5 4 9 8 9s8-4 8-9V7l-8-5z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <p className="text-[13px] text-white/45 mt-1">
            {data.verifiedCount} / {data.totalAthletes}
          </p>
        </div>

        {/* Vues recruteurs + trend chip */}
        <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.05] p-[18px]">
          <p className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
            Vues ce mois
          </p>
          <div className="flex items-baseline justify-between gap-2 mt-2">
            <p className="text-[28px] font-extrabold text-white leading-none tabular-nums">
              {data.recruiterViews}
            </p>
            {data.viewsTrend !== 0 && (
              <span
                className={`text-[12px] font-bold px-1.5 py-0.5 rounded ${
                  data.viewsTrend > 0
                    ? "text-[#22C55E] bg-[#22C55E]/10"
                    : "text-[#E63946] bg-[#E63946]/10"
                }`}
              >
                {data.viewsTrend > 0 ? "+" : ""}{data.viewsTrend}%
              </span>
            )}
          </div>
          <p className="text-[13px] text-white/45 mt-1">par les recruteurs</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CoachActionBar — 4 banner cards (rouge / amber / coach-only)
═══════════════════════════════════════════════════════════════ */

function CoachActionBar({
  data, onTapMessages, onTapIncomplete, onTapNewAthletes, onTapSuggestions,
}: {
  data: ActionBarData;
  onTapMessages: () => void;
  onTapIncomplete: () => void;
  onTapNewAthletes: () => void;
  onTapSuggestions: () => void;
}) {
  const hasAny =
    data.unreadMessages > 0 || data.incompleteProfiles > 0 ||
    data.newAthletes > 0 || data.pendingSuggestions > 0;

  if (!hasAny) return null;

  return (
    <div className="px-4">
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-3">
        À traiter
      </h2>
      <div className="space-y-2.5">
        {/* Intérêt recruteur (vert #22C55E — sémantique messaging /
            contact-request, source recruiter_pipeline stage CONTACTE) */}
        {data.unreadMessages > 0 && (
          <ActionRow
            accent="#22C55E"
            iconBg="#22C55E"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            }
            title={`${data.unreadMessages} recruteur${data.unreadMessages > 1 ? "s" : ""} intéressé${data.unreadMessages > 1 ? "s" : ""}`}
            subtitle="Consulte les demandes de contact"
            badge={data.unreadMessages}
            badgeBg="#22C55E"
            onTap={onTapMessages}
          />
        )}

        {/* Profils non vérifiés (gris #4a4d56 — canon non-verified state) */}
        {data.incompleteProfiles > 0 && (
          <ActionRow
            accent="#4a4d56"
            iconBg="#4a4d56"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L4 7v6c0 5 4 9 8 9s8-4 8-9V7l-8-5z" />
              </svg>
            }
            title={`${data.incompleteProfiles} profil${data.incompleteProfiles > 1 ? "s" : ""} non vérifié${data.incompleteProfiles > 1 ? "s" : ""}`}
            subtitle="Évalue et valide pour booster leur visibilité"
            badge={data.incompleteProfiles}
            badgeBg="#4a4d56"
            onTap={onTapIncomplete}
          />
        )}

        {/* Nouveaux athlètes (gris neutre — info récente) */}
        {data.newAthletes > 0 && (
          <ActionRow
            accent="#6B7280"
            iconBg="#3B82F6"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            }
            title={`${data.newAthletes} nouvel athlète${data.newAthletes > 1 ? "s" : ""} ajouté${data.newAthletes > 1 ? "s" : ""}`}
            subtitle="Voir le détail dans tes activités"
            badge={data.newAthletes}
            badgeBg="#3B82F6"
            onTap={onTapNewAthletes}
          />
        )}

        {/* Suggestions athlètes en attente (rouge — bloque l'athlète) */}
        {data.pendingSuggestions > 0 && (
          <ActionRow
            accent="#E63946"
            iconBg="#1A1D24"
            iconBorder="#E63946"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
            }
            title={`${data.pendingSuggestions} suggestion${data.pendingSuggestions > 1 ? "s" : ""} en attente`}
            subtitle="Approuve les modifications proposées par tes athlètes"
            badge={data.pendingSuggestions}
            badgeBg="#E63946"
            onTap={onTapSuggestions}
          />
        )}
      </div>
    </div>
  );
}

function ActionRow({
  accent, icon, iconBg, iconBorder, title, subtitle, badge, badgeBg, onTap,
}: {
  accent: string;
  icon: React.ReactNode;
  iconBg: string;
  iconBorder?: string;
  title: string;
  subtitle: string;
  badge: number;
  badgeBg: string;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className="w-full flex items-center gap-3 rounded-2xl bg-[#1A1D24] border border-white/[0.05] px-4 py-3.5 active:bg-white/[0.04] transition-colors text-left relative overflow-hidden"
    >
      {/* Accent bar */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: accent }}
      />
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ml-1"
        style={{
          backgroundColor: iconBg,
          border: iconBorder ? `1.5px solid ${iconBorder}` : undefined,
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white truncate">{title}</p>
        <p className="text-[13px] text-white/55 mt-0.5 truncate">{subtitle}</p>
      </div>
      <span
        className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-white text-[13px] font-bold tabular-nums flex-shrink-0"
        style={{ backgroundColor: badgeBg }}
      >
        {badge}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HotAthletesStrip — horizontal-scroll 4:5 (parité TrendingAthletes
   recruteur, mais avec RANK badge à la place du heart top-left)
═══════════════════════════════════════════════════════════════ */

function HotAthleteCard({ athlete, onTap }: {
  athlete: HotAthleteRow;
  onTap: () => void;
}) {
  // Rank badge : #1 = rouge plein (#E63946), #2-5 = blanc/gris sur inset
  // (#0C0E12). PAS de bleu (réservé verified semantic).
  const isTopRank = athlete.rank === 1;
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className="relative flex-shrink-0 w-[168px] aspect-[4/5] rounded-2xl overflow-hidden bg-[#1A1D24] active:opacity-80 transition-opacity text-left"
    >
      {/* Photo / fallback initiales (pas de composant partagé léger sans
          dep externe → on inline). */}
      {athlete.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={athlete.photoUrl}
          alt={athlete.name}
          className="absolute inset-0 w-full h-full object-cover object-[center_15%]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0C0E12]">
          <span className="text-[48px] font-extrabold text-white/40">
            {getInitials(athlete.name)}
          </span>
        </div>
      )}

      {/* Gradient bottom 2/3 fondu vers card color (#1A1D24) */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 z-[2] pointer-events-none"
        style={{ background: "linear-gradient(to top, #1A1D24 0%, rgba(26,29,36,0.85) 35%, transparent 70%)" }}
      />

      {/* Rank badge top-left — #1 rouge, #2-5 inset */}
      <div className="absolute top-2 left-2 z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-extrabold tabular-nums ${
            isTopRank
              ? "bg-[#E63946] text-white"
              : "bg-[#0C0E12] text-white/85 border border-white/[0.12]"
          }`}
        >
          {athlete.rank}
        </span>
      </div>

      {/* Stars top-right pill (gold uniquement — semantic ratings) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 z-10">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span className="text-[14px] font-bold text-white leading-none">{athlete.stars.toFixed(1)}</span>
      </div>

      {/* Bottom info overlay : nom + position */}
      <div className="absolute inset-x-0 bottom-0 px-3 pt-3 pb-4 z-10">
        <p className="text-white font-bold text-base truncate leading-tight">
          {athlete.name || "—"}
        </p>
        <p className="text-[15px] text-white/55 mt-0.5 truncate">
          {athlete.position || "—"}
        </p>
      </div>
    </button>
  );
}

function HotAthletesStrip({ athletes, onAthleteTap }: {
  athletes: HotAthleteRow[];
  onAthleteTap: (id: string) => void;
}) {
  return (
    <div>
      <div className="px-4 mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold">
          Athlètes en demande
        </h2>
        <p className="text-[13px] text-white/45 mt-1">
          Les plus consultés cette semaine
        </p>
      </div>
      {athletes.length === 0 ? (
        <p className="px-4 text-[14px] text-white/40 italic">
          Pas encore d&apos;athlètes consultés cette semaine.
        </p>
      ) : (
        <div className="overflow-x-auto nx-no-scrollbar pl-4">
          <div className="flex gap-3 pr-4">
            {athletes.slice(0, 5).map((a) => (
              <HotAthleteCard
                key={a.id}
                athlete={a}
                onTap={() => onAthleteTap(a.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ActivityFeedItem + ActivityFeedList (verbatim recruteur)
═══════════════════════════════════════════════════════════════ */

function ActivityFeedItem({ activity, isLast, onTap }: {
  activity: ActivityEvent;
  isLast: boolean;
  onTap: () => void;
}) {
  const initials = getInitials(activity.athleteName);
  const accent = activity.iconColor || "#6B7280";
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className={`w-full text-left py-4 active:opacity-60 transition-opacity ${isLast ? "" : "border-b border-white/[0.06]"}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white/[0.06]"
          style={{ boxShadow: `inset 0 0 0 1.5px ${accent}` }}
        >
          <span className="text-[12px] font-bold text-white/80 tracking-wide">{initials}</span>
        </div>
        <div className="flex-1 flex items-baseline justify-between gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-white truncate">
              {activity.athleteName || "Athlète"}
            </p>
            <p className="text-[15px] text-white/55 mt-0.5 truncate">{activityVerb(activity)}</p>
          </div>
          <span className="text-sm text-white/40 flex-shrink-0 whitespace-nowrap">
            {activity.relativeTime}
          </span>
        </div>
      </div>
    </button>
  );
}

function ActivityFeedList({ activities, onItemTap }: {
  activities: ActivityEvent[];
  onItemTap: (athleteId: string | undefined) => void;
}) {
  const visible = activities.slice(0, 5);
  return (
    <div className="px-4">
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-5">
        Activité récente
      </h2>
      {visible.length === 0 ? (
        <p className="text-sm text-white/40 italic">Aucune activité récente.</p>
      ) : (
        <div>
          {visible.map((a, idx) => (
            <ActivityFeedItem
              key={a.id}
              activity={a}
              isLast={idx === visible.length - 1}
              onTap={() => onItemTap(a.athleteId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── SectionDivider + Skeleton (verbatim recruteur) ─────────── */

function SectionDivider() {
  return <div className="mx-4 border-t border-white/[0.06]" />;
}

function DashboardSkeleton() {
  return (
    <div className="px-4 pt-6 space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded nx-pulse-dash" />
        <div className="h-8 w-56 rounded nx-pulse-dash" />
        <div className="h-4 w-40 rounded nx-pulse-dash" />
      </div>
      <div className="space-y-3">
        <div className="h-16 rounded-2xl nx-pulse-dash" />
        <div className="h-16 rounded-2xl nx-pulse-dash" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-20 h-16 rounded-2xl nx-pulse-dash" />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */

export function CoachDashboardMobile() {
  const router = useRouter();

  // Auth + data
  const [coachName, setCoachName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [actionBar, setActionBar] = useState<ActionBarData>({
    unreadMessages: 0, incompleteProfiles: 0, newAthletes: 0, pendingSuggestions: 0,
  });
  const [kpi, setKpi] = useState<KpiData>({
    totalAthletes: 0, verifiedCount: 0, completePct: 0, recruiterViews: 0, viewsTrend: 0,
  });
  const [hotAthletes, setHotAthletes] = useState<HotAthleteRow[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isInterimDirector, setIsInterimDirector] = useState(false);
  const [interimSchoolName, setInterimSchoolName] = useState("");
  const [demotionNotifications, setDemotionNotifications] = useState<DemotionNotif[]>([]);
  const [loading, setLoading] = useState(true);

  // Date stable client (évite hydration mismatch SSG)
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  useEffect(() => { setCurrentDate(new Date()); }, []);

  // Pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const PULL_THRESHOLD = 80;

  useEffect(() => {
    let startY = 0; let current = 0;
    const onTouchStart = (e: TouchEvent) => {
      if ((window.scrollY || 0) === 0) startY = e.touches[0].clientY; else startY = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if ((window.scrollY || 0) !== 0 || startY === 0) return;
      current = Math.max(0, Math.min(e.touches[0].clientY - startY, 120));
      setPullDistance(current);
      setIsPulling(current > 0);
    };
    const onTouchEnd = async () => {
      if (current >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        triggerHaptic("Medium");
        setReloadKey((k) => k + 1);
        window.setTimeout(() => { setIsRefreshing(false); setPullDistance(0); setIsPulling(false); }, 600);
      } else {
        setPullDistance(0); setIsPulling(false);
      }
      startY = 0; current = 0;
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isRefreshing]);

  /* ── Data load — porté verbatim de la web page coach actuelle ─ */
  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Profil coach + intérim source (is_school_admin + admin_type)
      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, school_id, is_school_admin, profile_data, schools!school_id(name)")
        .eq("id", user.id)
        .single();

      let resolvedSchoolName = "";
      if (profile) {
        const firstName = (profile.first_name as string) || "";
        const lastName = (profile.last_name as string) || "";
        setCoachName(`${firstName} ${lastName}`.trim() || "Coach");

        const schoolRaw = profile.schools;
        const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;
        const schoolObj = school as { name?: string } | null;
        resolvedSchoolName = schoolObj?.name || "";
        setSchoolName(resolvedSchoolName);

        const adminType = (profile.profile_data as { admin_type?: string } | null)?.admin_type;
        if (profile.is_school_admin === true && adminType === "interim") {
          setIsInterimDirector(true);
          setInterimSchoolName(resolvedSchoolName);
        }
      }

      const coachSchoolId = (profile?.school_id as string) || null;
      if (!coachSchoolId) { setLoading(false); return; }

      // Demotion notifications
      const { data: demotions } = await supabase
        .from("coach_notifications")
        .select("id, title, message, metadata")
        .eq("coach_id", user.id)
        .eq("type", "INTERIM_DEMOTED")
        .eq("read", false)
        .order("created_at", { ascending: false });

      if (demotions && demotions.length > 0) {
        setDemotionNotifications(demotions.map((d) => ({
          id: d.id as string,
          title: d.title as string,
          message: (d.message as string) || null,
          metadata: (d.metadata as Record<string, unknown>) || null,
        })));
      }

      // Athletes claimed by this coach
      const { data: athleteRows } = await supabase
        .from("athletes")
        .select("id, verified")
        .eq("coach_id", user.id)
        .eq("status", "ACTIF");

      const athletes = athleteRows || [];
      const coachAthleteIds = athletes.map((a: { id: string }) => a.id);
      const totalAthletes = athletes.length;
      const verifiedCount = athletes.filter((a: { verified: boolean }) => a.verified).length;

      // ActionBar #1: unread recruiter contacts (recruiter_pipeline stage CONTACTE)
      let unreadMessages = 0;
      if (coachAthleteIds.length > 0) {
        const { count } = await supabase
          .from("recruiter_pipeline")
          .select("id", { count: "exact", head: true })
          .eq("stage", "CONTACTE")
          .in("athlete_id", coachAthleteIds);
        unreadMessages = count || 0;
      }

      // ActionBar #2: non-verified profiles
      const unverifiedCount = totalAthletes - verifiedCount;

      // ActionBar #3: new athletes added (unread)
      const { count: newAthletesCount } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", user.id)
        .eq("type", "ATHLETE_ADDED")
        .eq("read", false);

      // ActionBar #4: pending athlete suggestions
      let pendingSuggestions = 0;
      if (coachAthleteIds.length > 0) {
        const { count: sugCount } = await supabase
          .from("athlete_suggestions")
          .select("id", { count: "exact", head: true })
          .in("athlete_id", coachAthleteIds)
          .eq("status", "EN_ATTENTE");
        pendingSuggestions = sugCount || 0;
      }

      setActionBar({
        unreadMessages,
        incompleteProfiles: unverifiedCount,
        newAthletes: newAthletesCount || 0,
        pendingSuggestions,
      });

      // KPI: recruiter views ce mois vs mois dernier
      const now = new Date();
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      let viewsThisMonth = 0;
      let viewsLastMonth = 0;
      if (coachAthleteIds.length > 0) {
        const [{ count: thisCount }, { count: lastCount }] = await Promise.all([
          supabase.from("recruiter_athlete_views").select("id", { count: "exact", head: true }).in("athlete_id", coachAthleteIds).gte("viewed_at", firstOfThisMonth).lt("viewed_at", firstOfNextMonth),
          supabase.from("recruiter_athlete_views").select("id", { count: "exact", head: true }).in("athlete_id", coachAthleteIds).gte("viewed_at", firstOfLastMonth).lt("viewed_at", firstOfThisMonth),
        ]);
        viewsThisMonth = thisCount || 0;
        viewsLastMonth = lastCount || 0;
      }

      let viewsTrend = 0;
      if (viewsLastMonth === 0 && viewsThisMonth > 0) viewsTrend = 100;
      else if (viewsLastMonth > 0 && viewsThisMonth === 0) viewsTrend = -100;
      else if (viewsLastMonth > 0) {
        viewsTrend = Math.round(((viewsThisMonth - viewsLastMonth) / viewsLastMonth) * 100);
      }

      setKpi({
        totalAthletes,
        verifiedCount,
        completePct: totalAthletes > 0 ? Math.round((verifiedCount / totalAthletes) * 100) : 0,
        recruiterViews: viewsThisMonth,
        viewsTrend,
      });

      // HotAthletes: top 5 most-viewed this week
      if (coachAthleteIds.length > 0) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - mondayOffset);
        monday.setHours(0, 0, 0, 0);
        const startOfWeek = monday.toISOString();

        const { data: viewRows } = await supabase
          .from("recruiter_athlete_views")
          .select("athlete_id")
          .in("athlete_id", coachAthleteIds)
          .gte("viewed_at", startOfWeek);

        const viewCounts = new Map<string, number>();
        for (const r of (viewRows || [])) {
          viewCounts.set(r.athlete_id, (viewCounts.get(r.athlete_id) || 0) + 1);
        }

        const { data: favRows } = await supabase
          .from("recruiter_favorites")
          .select("athlete_id")
          .in("athlete_id", coachAthleteIds);

        const favCounts = new Map<string, number>();
        if (favRows) {
          for (const r of favRows) {
            favCounts.set(r.athlete_id, (favCounts.get(r.athlete_id) || 0) + 1);
          }
        }

        const sorted = [...viewCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        if (sorted.length > 0) {
          const topIds = sorted.map(([id]) => id);
          const { data: topProfiles } = await supabase
            .from("athletes")
            .select("id, first_name, last_name, photo_url, cote_globale_entraineur, positions!position_id(abreviation, nom)")
            .in("id", topIds);

          const profileMap = new Map<string, Record<string, unknown>>();
          if (topProfiles) {
            for (const p of topProfiles) profileMap.set(p.id as string, p);
          }

          const hotList: HotAthleteRow[] = sorted.map(([aid, views], i) => {
            const p = profileMap.get(aid);
            const posRaw = p?.positions;
            const pos = Array.isArray(posRaw) ? posRaw[0] : posRaw;
            const posObj = pos as { abreviation?: string; nom?: string } | null;
            return {
              id: aid,
              rank: i + 1,
              name: `${(p?.first_name as string) || ""} ${(p?.last_name as string) || ""}`.trim(),
              position: posObj?.abreviation || posObj?.nom || "",
              stars: Math.round((p?.cote_globale_entraineur as number) || 0),
              photoUrl: (p?.photo_url as string) || null,
              viewsThisWeek: views,
              uniqueRecruiters: favCounts.get(aid) || 0,
            };
          });
          setHotAthletes(hotList);
        }
      }

      // Activities feed
      let activityRows: Record<string, unknown>[] | null = null;
      if (coachAthleteIds.length > 0) {
        const { data } = await supabase
          .from("recruiter_activity_log")
          .select("id, action_type, details, created_at, athlete_id")
          .in("athlete_id", coachAthleteIds)
          .order("created_at", { ascending: false })
          .limit(20);
        activityRows = data;
      }

      if (activityRows && activityRows.length > 0) {
        const TYPE_CONFIG: Record<string, { iconColor: string; priority: 1 | 2 }> = {
          PROFILE_VIEWED:    { iconColor: "#6B7280", priority: 2 },
          FAVORITED:         { iconColor: "#E63946", priority: 1 },
          PIPELINE_CHANGED:  { iconColor: "#F59E0B", priority: 1 },
          ATHLETE_VERIFIED:  { iconColor: "#3B82F6", priority: 2 },
          VIDEO_ADDED:       { iconColor: "#8B5CF6", priority: 2 },
          PROFILE_UPDATED:   { iconColor: "#6B7280", priority: 2 },
          UNFAVORITED:       { iconColor: "#6B7280", priority: 2 },
        };

        const mapped: ActivityEvent[] = activityRows.map((row) => {
          const actionType = (row.action_type as string) || "";
          const details = (row.details as Record<string, unknown>) || {};
          const cfg = TYPE_CONFIG[actionType] || { iconColor: "#6B7280", priority: 2 as const };
          const athleteName = `${(details.first_name as string) || ""} ${(details.last_name as string) || ""}`.trim();
          const createdAt = new Date(row.created_at as string);

          const now2 = new Date();
          const diffMs = now2.getTime() - createdAt.getTime();
          const diffDays = Math.floor(diffMs / 86400000);
          let timeGroup: ActivityEvent["timeGroup"] = "Semaine dernière";
          if (diffDays === 0) timeGroup = "Aujourd'hui";
          else if (diffDays === 1) timeGroup = "Hier";
          else if (diffDays < 7) timeGroup = "Cette semaine";

          const diffMin = Math.floor(diffMs / 60000);
          let relativeTime = "À l'instant";
          if (diffMin >= 1 && diffMin < 60) relativeTime = `Il y a ${diffMin} min`;
          else if (diffMin >= 60 && diffDays === 0) relativeTime = `Il y a ${Math.floor(diffMin / 60)}h`;
          else if (diffDays === 1) relativeTime = "Hier";
          else if (diffDays > 1 && diffDays < 7) relativeTime = `Il y a ${diffDays}j`;
          else if (diffDays >= 7) relativeTime = `Il y a ${Math.floor(diffDays / 7)} sem.`;

          return {
            id: row.id as string,
            type: (actionType === "FAVORITED" ? "competitor_favorited"
              : actionType === "PIPELINE_CHANGED" ? "status_engage"
              : actionType === "ATHLETE_VERIFIED" ? "profile_verified"
              : actionType === "VIDEO_ADDED" ? "video_added"
              : actionType === "PROFILE_VIEWED" ? "profile_updated_bulk"
              : "scouting_report_updated") as ActivityEvent["type"],
            priority: cfg.priority,
            direction: "inbound" as const,
            athleteId: (row.athlete_id as string) || undefined,
            athleteName: athleteName || undefined,
            message: athleteName ? `${athleteName}` : "Activité",
            icon: "circle",
            iconColor: cfg.iconColor,
            actionLabel: "Voir",
            actionUrl: row.athlete_id ? `/coach/athletes/${row.athlete_id as string}` : undefined,
            timestamp: row.created_at as string,
            relativeTime,
            timeGroup,
          };
        });

        setActivities(mapped);
      }

      setLoading(false);
    }

    load();
  }, [reloadKey]);

  async function dismissDemotion(notificationId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("coach_notifications")
      .update({ read: true })
      .eq("id", notificationId);
    if (error) {
      console.error("[CoachDashboardMobile] dismiss failed:", error);
      return;
    }
    setDemotionNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }

  /* ── Nav helpers ───────────────────────────────────────────── */

  const navAthlete = (id: string | undefined) => {
    if (!id) return;
    router.push(`/coach/athletes/${id}`);
  };

  /* ── Render ────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111317] text-white">
        <DashboardSkeleton />
        <style jsx>{`
          @keyframes nx-pulse-dash-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
          :global(.nx-pulse-dash) { background: #1A1D24; animation: nx-pulse-dash-kf 1.4s ease-in-out infinite; }
          :global(.nx-no-scrollbar) { scrollbar-width: none; -ms-overflow-style: none; }
          :global(.nx-no-scrollbar::-webkit-scrollbar) { display: none; }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#111317] text-white"
      style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom) + 32px)" }}
    >
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div
          className="fixed left-0 right-0 z-[55] flex justify-center items-center pointer-events-none"
          style={{ top: 0, height: Math.max(pullDistance, isRefreshing ? 60 : 0) }}
        >
          <div
            className="rounded-full p-2"
            style={{
              background: "rgba(230, 57, 70, 0.1)",
              transform: isRefreshing ? "rotate(0deg)" : `rotate(${pullDistance * 4}deg)`,
              opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: isRefreshing ? "nx-rotate-dash 1s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </div>
        </div>
      )}

      {/* Zone 1 : Hero */}
      <DashboardHero
        greeting={coachName.split(/\s+/)[0] || ""}
        schoolName={schoolName}
        currentDate={currentDate ?? new Date()}
        unreadMessages={actionBar.unreadMessages}
        viewsTrend={kpi.viewsTrend}
        recruiterViews={kpi.recruiterViews}
        pendingSuggestions={actionBar.pendingSuggestions}
        onTapMessages={() => router.push("/coach/demandes")}
        onTapTrend={() => router.push("/coach/athletes")}
        onTapSuggestions={() => router.push("/coach/suggestions")}
      />

      {/* Zone 2 : Intérim (si applicable) */}
      {isInterimDirector && <InterimBanner schoolName={interimSchoolName} />}

      {/* Zone 3 : Demotion notifs (si applicable) */}
      {demotionNotifications.map((n) => (
        <DemotionNotificationCard
          key={n.id}
          notif={n}
          onDismiss={() => dismissDemotion(n.id)}
        />
      ))}

      <SectionDivider />

      {/* Zone 4 : KPI Trio */}
      <div className="py-6">
        <KpiTrio data={kpi} />
      </div>

      <SectionDivider />

      {/* Zone 5 : ActionBar (après KPIs — alert-system, pas todo) */}
      <div className="py-6">
        <CoachActionBar
          data={actionBar}
          onTapMessages={() => router.push("/coach/demandes")}
          onTapIncomplete={() => router.push("/coach/athletes?filtre=non_verifies")}
          onTapNewAthletes={() => router.push("/coach/activites")}
          onTapSuggestions={() => router.push("/coach/suggestions")}
        />
      </div>

      <SectionDivider />

      {/* Zone 6 : HotAthletes strip */}
      <div className="py-6">
        <HotAthletesStrip athletes={hotAthletes} onAthleteTap={navAthlete} />
      </div>

      <SectionDivider />

      {/* Zone 7 : Activity feed */}
      <div className="py-6">
        <ActivityFeedList
          activities={activities}
          onItemTap={navAthlete}
        />
        {activities.length > 5 && (
          <div className="px-4 mt-4">
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); router.push("/coach/activites"); }}
              className="w-full py-3 rounded-2xl bg-white/[0.03] active:bg-white/[0.06] text-[#E63946] font-semibold text-base transition-colors"
            >
              Voir toutes les activités
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes nx-pulse-dash-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        :global(.nx-pulse-dash) { background: #1A1D24; animation: nx-pulse-dash-kf 1.4s ease-in-out infinite; }
        :global(.nx-no-scrollbar) { scrollbar-width: none; -ms-overflow-style: none; }
        :global(.nx-no-scrollbar::-webkit-scrollbar) { display: none; }
        @keyframes nx-rotate-dash { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
