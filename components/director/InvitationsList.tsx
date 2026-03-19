"use client";

import type { Invitation } from "@/lib/types/models";

interface InvitationsListProps {
  invitations: Invitation[];
}

/* ── helpers ── */
const FRENCH_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatDateFR(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${FRENCH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_MAP: Record<
  Invitation["status"],
  { label: string; color: string }
> = {
  pending:  { label: "En attente", color: "#F59E0B" },
  accepted: { label: "Acceptée",   color: "#22C55E" },
  expired:  { label: "Expirée",    color: "#6B7280" },
};

export default function InvitationsList({ invitations }: InvitationsListProps) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
      {/* Title */}
      <div className="px-5 py-4">
        <h3 className="font-head text-[15px] font-bold text-white">
          Invitations envoyées
        </h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="bg-[#13151a]">
              {["Email", "Sport(s)", "Date envoyée", "Statut"].map((h) => (
                <th
                  key={h}
                  className="text-left text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] px-5 py-2.5"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {invitations.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="text-center text-[13px] text-[#6B7280] py-8"
                >
                  Aucune invitation envoyée
                </td>
              </tr>
            )}

            {invitations.map((inv) => {
              const st = STATUS_MAP[inv.status];
              return (
                <tr
                  key={inv.id}
                  className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors"
                >
                  {/* Email */}
                  <td className="px-5 py-3 text-[13px] text-[#e0e0e0]">
                    {inv.email}
                  </td>

                  {/* Sports */}
                  <td className="px-5 py-3 text-[13px] text-[#9CA3AF]">
                    {inv.sports.join(", ")}
                  </td>

                  {/* Date */}
                  <td className="px-5 py-3 text-[13px] text-[#9CA3AF]">
                    {formatDateFR(inv.sentAt)}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                      style={{ color: st.color }}
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: st.color }}
                      />
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
