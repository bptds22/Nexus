import Link from "next/link";
import type { ActionBarData } from "../_data/mockDashboardData";

/* ─────────────────────────────────────────────────────────────────
   Zone 1 — ACTION BAR
   Urgent alerts: unread recruiter messages + incomplete profiles.
   This is the MOST VISUALLY PROMINENT element on the dashboard.
───────────────────────────────────────────────────────────────── */

export default function ActionBar({ data }: { data: ActionBarData }) {
  return (
    <div className="space-y-3">
      {/* ── Recruiter messages ────────────────────────────────── */}
      <Link
        href="/coach/demandes?filtre=nouveau"
        className={`group flex items-center gap-4 rounded-xl px-6 py-5 transition-all border-l-4 ${
          data.unreadMessages > 0
            ? "bg-[#E63946]/[0.08] border-l-[#E63946] hover:bg-[#E63946]/[0.14]"
            : "bg-[#1A1D24] border-l-[#2D3748] hover:bg-[#22252c]"
        }`}
      >
        {/* Icon */}
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
          data.unreadMessages > 0 ? "bg-[#E63946]/20" : "bg-[#2D3748]/50"
        }`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={data.unreadMessages > 0 ? "#E63946" : "#6b7280"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] font-bold ${data.unreadMessages > 0 ? "text-white" : "text-[#6b7280]"}`}>
            {data.unreadMessages > 0
              ? `${data.unreadMessages} nouvelle${data.unreadMessages > 1 ? "s" : ""} demande${data.unreadMessages > 1 ? "s" : ""} de recruteurs`
              : "Aucune nouvelle demande"
            }
          </p>
          {data.unreadMessages > 0 && (
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">Cliquez pour consulter les messages</p>
          )}
        </div>

        {/* Count badge + arrow */}
        {data.unreadMessages > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[#E63946] text-white text-[13px] font-black">
              {data.unreadMessages}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
              className="opacity-0 group-hover:opacity-100 transition-opacity">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </Link>

      {/* ── Non-verified profiles ──────────────────────────────── */}
      <Link
        href="/coach/athletes?filtre=non_verifies"
        className={`group flex items-center gap-4 rounded-xl px-6 py-5 transition-all border-l-4 ${
          data.incompleteProfiles > 0
            ? "bg-[#6B7280]/[0.06] border-l-[#6B7280] hover:bg-[#6B7280]/[0.12]"
            : "bg-[#3B82F6]/[0.06] border-l-[#3B82F6]"
        }`}
      >
        {/* Icon */}
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
          data.incompleteProfiles > 0 ? "bg-[#6B7280]/20" : "bg-[#3B82F6]/20"
        }`}>
          {data.incompleteProfiles > 0 ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] font-bold ${data.incompleteProfiles > 0 ? "text-white" : "text-[#3B82F6]"}`}>
            {data.incompleteProfiles > 0
              ? `${data.incompleteProfiles} profil${data.incompleteProfiles > 1 ? "s" : ""} non vérifié${data.incompleteProfiles > 1 ? "s" : ""}`
              : "Tous les profils sont vérifiés"
            }
          </p>
          {data.incompleteProfiles > 0 && (
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">Des informations manquantes réduisent la visibilité</p>
          )}
        </div>

        {/* Count badge + arrow */}
        {data.incompleteProfiles > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[#6B7280] text-white text-[13px] font-black">
              {data.incompleteProfiles}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
              className="opacity-0 group-hover:opacity-100 transition-opacity">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </Link>
    </div>
  );
}
