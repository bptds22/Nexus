"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { relativeTimeFr } from "@/lib/utils/relativeTime";

/* ═══════════════════════════════════════════════════════════════
   PendingInvitations — Flow A athlete-side panel.

   Mounts above the existing filter tabs on /athlete/notifications
   (5.5e-iv-b). Self-hides when there are 0 PENDING invitations so
   the regular notification list reads as before.

   Accept → UPDATE status=ACCEPTED + responded_at. The DB trigger
   apply_team_invitation_acceptance (5.5e-iii-a) cascades junction
   insert + anchor update + old-junction cleanup atomically.

   Reject → UPDATE status=REJECTED + responded_at. No trigger fires;
   the row stays as audit trail. RLS WITH CHECK clamps status to
   ACCEPTED/REJECTED so a malicious client can't transition to
   CANCELLED (coach-only) or back to PENDING.

   Sidebar badge wiring (5.5e-iv-c) will listen for the
   notifications-updated window event that respond() dispatches —
   today the badge only counts athlete_notifications, so the event
   is a no-op refresh but ready to extend.
═══════════════════════════════════════════════════════════════ */

interface PendingInvitation {
  id: string;
  teamId: string;
  teamName: string;
  sportName: string;
  coachFirstName: string;
  coachLastName: string;
  createdAt: string;
}

function sportEmoji(sport: string): string {
  switch (sport.toLowerCase()) {
    case "badminton": return "🏸";
    case "football": return "🏈";
    case "hockey": return "🏒";
    case "basketball": return "🏀";
    case "soccer": return "⚽";
    default: return "🏆";
  }
}

export default function PendingInvitations({
  athleteId,
  showToast,
}: {
  athleteId: string;
  showToast: (msg: string) => void;
}) {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("team_invitations")
        .select(`
          id,
          league_team_id,
          created_at,
          league_teams!league_team_id(
            name,
            sports!sport_id(nom)
          ),
          invited_by_coach:users!invited_by_coach_id(
            first_name,
            last_name
          )
        `)
        .eq("athlete_id", athleteId)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      const mapped: PendingInvitation[] = (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const teamRel = r.league_teams as Record<string, unknown> | Record<string, unknown>[] | null;
        const team = (Array.isArray(teamRel) ? teamRel[0] : teamRel) ?? {};
        const sportRel = (team as Record<string, unknown>).sports as { nom?: string } | { nom?: string }[] | null;
        const sport = Array.isArray(sportRel) ? sportRel[0] : sportRel;
        const coachRel = r.invited_by_coach as Record<string, unknown> | Record<string, unknown>[] | null;
        const coach = (Array.isArray(coachRel) ? coachRel[0] : coachRel) ?? {};

        return {
          id: r.id as string,
          teamId: r.league_team_id as string,
          teamName: ((team as { name?: string }).name) || "",
          sportName: sport?.nom || "",
          coachFirstName: ((coach as { first_name?: string }).first_name) || "",
          coachLastName: ((coach as { last_name?: string }).last_name) || "",
          createdAt: r.created_at as string,
        };
      });
      setInvitations(mapped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [athleteId]);

  async function respond(invitationId: string, status: "ACCEPTED" | "REJECTED") {
    if (busy) return;
    setBusy(invitationId);
    const target = invitations.find((i) => i.id === invitationId);
    const supabase = createClient();
    const { error } = await supabase
      .from("team_invitations")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", invitationId);

    setBusy(null);

    if (error) {
      showToast("Erreur : " + error.message);
      return;
    }

    setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    if (status === "ACCEPTED") {
      showToast(target?.teamName ? `Tu as rejoint ${target.teamName}!` : "Invitation acceptée");
    } else {
      showToast("Invitation refusée");
    }
    window.dispatchEvent(new Event("notifications-updated"));
  }

  if (loading || invitations.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-head text-sm font-black text-white uppercase tracking-wider">
        Invitations en attente
      </h2>
      <div className="space-y-2">
        {invitations.map((inv) => {
          const isBusy = busy === inv.id;
          const coachName = `${inv.coachFirstName} ${inv.coachLastName}`.trim();
          return (
            <div
              key={inv.id}
              className="bg-[#1A1D24] rounded-lg border border-[#E63946]/30 p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center text-xl shrink-0">
                {sportEmoji(inv.sportName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-white truncate">
                  {inv.teamName || "Équipe"}
                  {inv.sportName && <span className="text-[#9CA3AF] font-normal"> ({inv.sportName})</span>}
                </p>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5 truncate">
                  Invité par {coachName || "un coach"}
                </p>
                <p className="text-[11px] text-[#4a4d56] mt-0.5">{relativeTimeFr(inv.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => respond(inv.id, "REJECTED")}
                  disabled={isBusy}
                  className="text-[12px] font-bold text-[#9CA3AF] hover:text-white border border-[#2D3748] hover:border-[#4a4d56] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Refuser
                </button>
                <button
                  type="button"
                  onClick={() => respond(inv.id, "ACCEPTED")}
                  disabled={isBusy}
                  className="text-[12px] font-bold text-white bg-[#22C55E] hover:bg-[#16A34A] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isBusy ? "..." : "Accepter"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
