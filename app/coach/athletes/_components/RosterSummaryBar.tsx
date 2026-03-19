import type { RosterAthlete } from "../_data/mockRosterData";
import VerificationBadge from "./VerificationBadge";

/* ─────────────────────────────────────────────────────────────────
   Summary Bar — compact roster health strip with verification breakdown
───────────────────────────────────────────────────────────────── */

export default function RosterSummaryBar({ athletes }: { athletes: RosterAthlete[] }) {
  const total = athletes.length;
  const verified = athletes.filter((a) => a.isVerified).length;
  const autoVerified = athletes.filter((a) => a.verification.method === "auto").length;
  const manualVerified = athletes.filter((a) => a.verification.method === "manual_coach" || a.verification.method === "manual_director").length;
  const nonVerified = total - verified;
  const totalViews = athletes.reduce((sum, a) => sum + a.views, 0);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-[#1E2430] rounded-xl border border-[#2D3748] px-6 py-5">
      {/* Total */}
      <div className="flex items-baseline gap-2">
        <span className="text-[26px] font-head font-black text-white">{total}</span>
        <span className="text-[13px] text-[#9CA3AF] font-medium">athlètes</span>
      </div>

      <div className="w-px h-6 bg-[#2D3748] hidden sm:block" />

      {/* Verified */}
      <div className="flex items-center gap-2">
        <VerificationBadge isVerified={true} iconOnly size="md" />
        <span className="text-[26px] font-head font-black text-white">{verified}</span>
        <span className="text-[13px] text-[#3B82F6] font-medium">vérifiés</span>
        {(autoVerified > 0 || manualVerified > 0) && (
          <span className="text-[11px] text-[#6b7280] font-medium">
            ({autoVerified} auto · {manualVerified} manuel)
          </span>
        )}
      </div>

      <div className="w-px h-6 bg-[#2D3748] hidden sm:block" />

      {/* Non-verified */}
      <div className="flex items-center gap-2">
        <VerificationBadge isVerified={false} iconOnly size="md" />
        <span className="text-[26px] font-head font-black text-white">{nonVerified}</span>
        <span className="text-[13px] text-[#6B7280] font-medium">non vérifiés</span>
      </div>

      <div className="w-px h-6 bg-[#2D3748] hidden sm:block" />

      {/* Views */}
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span className="text-[26px] font-head font-black text-white">{totalViews}</span>
        <span className="text-[13px] text-[#9CA3AF] font-medium">vues ce mois</span>
      </div>
    </div>
  );
}
