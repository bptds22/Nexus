import Link from "next/link";
import type { ActionBarData } from "../_data/mockDashboardData";

/* ─────────────────────────────────────────────────────────────────
   Zone 1 — ACTION BAR
   Only shows banners when there is something actionable.
   Hidden entirely when everything is clear.
───────────────────────────────────────────────────────────────── */

export default function ActionBar({ data }: { data: ActionBarData }) {
  const hasAnything = data.unreadMessages > 0 || data.incompleteProfiles > 0 || data.newAthletes > 0 || data.pendingSuggestions > 0;

  if (!hasAnything) return null;

  return (
    <div className="space-y-3">
      {/* ── Recruiter messages ────────────────────────────────── */}
      {data.unreadMessages > 0 && (
        <Link
          href="/coach/demandes"
          className="group flex items-center gap-4 rounded-xl px-6 py-5 transition-all border-l-4 bg-[#E63946]/[0.08] border-l-[#E63946] hover:bg-[#E63946]/[0.14]"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-[#E63946]/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white">
              {data.unreadMessages} nouvelle{data.unreadMessages > 1 ? "s" : ""} demande{data.unreadMessages > 1 ? "s" : ""} de recruteurs
            </p>
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">Cliquez pour consulter les messages</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[#E63946] text-white text-[13px] font-black">
              {data.unreadMessages}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
              className="opacity-0 group-hover:opacity-100 transition-opacity">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* ── Non-verified profiles ──────────────────────────────── */}
      {data.incompleteProfiles > 0 && (
        <Link
          href="/coach/athletes?tab=traiter"
          className="group flex items-center gap-4 rounded-xl px-6 py-5 transition-all border-l-4 bg-[#3B82F6]/[0.06] border-l-[#3B82F6] hover:bg-[#3B82F6]/[0.10]"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-[#3B82F6]/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white">
              {data.incompleteProfiles} profil{data.incompleteProfiles > 1 ? "s" : ""} non vérifié{data.incompleteProfiles > 1 ? "s" : ""}
            </p>
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">Des informations manquantes réduisent la visibilité</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[#3B82F6] text-white text-[13px] font-black">
              {data.incompleteProfiles}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
              className="opacity-0 group-hover:opacity-100 transition-opacity">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* ── Pending athlete suggestions ────────────────────────── */}
      {data.pendingSuggestions > 0 && (
        <Link
          href="/coach/athletes?tab=traiter"
          className="group flex items-center gap-4 rounded-xl px-6 py-5 transition-all border-l-4 bg-[#F59E0B]/[0.06] border-l-[#F59E0B] hover:bg-[#F59E0B]/[0.10]"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-[#F59E0B]/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white">
              {data.pendingSuggestions} suggestion{data.pendingSuggestions > 1 ? "s" : ""} d&apos;athlète{data.pendingSuggestions > 1 ? "s" : ""} à réviser
            </p>
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">Des athlètes ont proposé des modifications à leur profil</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[#F59E0B] text-[#111317] text-[13px] font-black">
              {data.pendingSuggestions}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
              className="opacity-0 group-hover:opacity-100 transition-opacity">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* ── New athletes added ────────────────────────────────── */}
      {data.newAthletes > 0 && (
        <Link
          href="/coach/athletes"
          className="group flex items-center gap-4 rounded-xl px-6 py-5 transition-all border-l-4 bg-[#22C55E]/[0.06] border-l-[#22C55E] hover:bg-[#22C55E]/[0.12]"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-[#22C55E]/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <path d="M20 8v6" />
              <path d="M23 11h-6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white">
              {data.newAthletes} nouveau{data.newAthletes > 1 ? "x" : ""} athlète{data.newAthletes > 1 ? "s" : ""} ajouté{data.newAthletes > 1 ? "s" : ""} à ton roster
            </p>
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">Cliquez pour consulter le roster</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[#22C55E] text-white text-[13px] font-black">
              {data.newAthletes}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
              className="opacity-0 group-hover:opacity-100 transition-opacity">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}
    </div>
  );
}
