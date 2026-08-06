"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { relativeTimeFr } from "@/lib/utils/relativeTime";
import { formatTeamLabel } from "@/lib/teams/teamLabel";
import { attachmentSentinel } from "@/lib/queries/shared/attachmentErrors";

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
  ageGroup: string | null;
  division: string | null;
  gender: string | null;
  schoolName: string | null;
  coachFirstName: string;
  coachLastName: string;
  createdAt: string;
}

/** L'équipe que l'athlète quitterait en acceptant. null = il n'en a aucune. */
interface EquipeActuelle {
  label: string;
  schoolName: string | null;
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
  const [actuelle, setActuelle] = useState<EquipeActuelle | null>(null);
  /* Erreur PAR invitation : un refus <14 concerne cette ligne, pas la liste.
     La ligne reste affichée et l'invitation reste PENDING — l'écriture a
     échoué, donc rien n'a bougé côté serveur. */
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("team_invitations")
        .select(`
          id,
          team_id,
          created_at,
          teams!team_id(
            name, age_group, division, gender,
            sports!sport_id(nom),
            schools!school_id(name)
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
        const teamRel = r.teams as Record<string, unknown> | Record<string, unknown>[] | null;
        const team = (Array.isArray(teamRel) ? teamRel[0] : teamRel) ?? {};
        const sportRel = (team as Record<string, unknown>).sports as { nom?: string } | { nom?: string }[] | null;
        const sport = Array.isArray(sportRel) ? sportRel[0] : sportRel;
        const coachRel = r.invited_by_coach as Record<string, unknown> | Record<string, unknown>[] | null;
        const coach = (Array.isArray(coachRel) ? coachRel[0] : coachRel) ?? {};

        const schoolRel = (team as Record<string, unknown>).schools as { name?: string } | { name?: string }[] | null;
        const school = Array.isArray(schoolRel) ? schoolRel[0] : schoolRel;

        return {
          id: r.id as string,
          teamId: r.team_id as string,
          teamName: ((team as { name?: string }).name) || "",
          sportName: sport?.nom || "",
          ageGroup: ((team as { age_group?: string }).age_group) ?? null,
          division: ((team as { division?: string }).division) ?? null,
          gender: ((team as { gender?: string }).gender) ?? null,
          schoolName: school?.name ?? null,
          coachFirstName: ((coach as { first_name?: string }).first_name) || "",
          coachLastName: ((coach as { last_name?: string }).last_name) || "",
          createdAt: r.created_at as string,
        };
      });
      setInvitations(mapped);

      /* L'ÉQUIPE ACTUELLE — sans elle, l'athlète accepte à l'aveugle.
         Le rattachement est EXCLUSIF : accepter détache de l'équipe courante,
         change son école et son entraîneur, et archive le passage dans son
         parcours. Rien à l'écran ne le disait. */
      if (mapped.length > 0) {
        const { data: ta } = await supabase
          .from("team_athletes")
          .select("teams!team_id(name, age_group, division, gender, sports!sport_id(nom), schools!school_id(name))")
          .eq("athlete_id", athleteId)
          .maybeSingle();
        if (!cancelled && ta) {
          const rel = (ta as Record<string, unknown>).teams as Record<string, unknown> | Record<string, unknown>[] | null;
          const t = (Array.isArray(rel) ? rel[0] : rel) ?? null;
          if (t) {
            const sp = (t as Record<string, unknown>).sports as { nom?: string } | { nom?: string }[] | null;
            const sc = (t as Record<string, unknown>).schools as { name?: string } | { name?: string }[] | null;
            const spo = Array.isArray(sp) ? sp[0] : sp;
            const sch = Array.isArray(sc) ? sc[0] : sc;
            setActuelle({
              label: formatTeamLabel(
                spo?.nom ?? null,
                (t as { age_group?: string }).age_group ?? null,
                (t as { division?: string }).division ?? null,
                (t as { gender?: string }).gender ?? null,
                (t as { name?: string }).name ?? null,
              ),
              schoolName: sch?.name ?? null,
            });
          }
        }
      }

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
      /* Le message brut de Postgres ne doit JAMAIS atteindre l'athlète : un
         refus <14 remontait littéralement « ATHLETE_UNDER_14 ». Le gate vit
         dans _apply_team_attachment_core, donc il se déclenche À L'ACCEPTATION.
         L'écriture ayant échoué, l'invitation reste PENDING et la ligne reste
         affichée — on pose l'erreur SUR elle, sans la retirer. */
      setErreurs((prev) => ({ ...prev, [invitationId]: attachmentSentinel(error.message) }));
      return;
    }
    setErreurs((prev) => {
      const n = { ...prev };
      delete n[invitationId];
      return n;
    });

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
      {/* AVERTISSEMENT DE DÉPART — le point le plus important de l'écran.
          Accepter n'ajoute pas une équipe : ça REMPLACE la sienne, et ça change
          aussi son école et son entraîneur. L'écran ne le disait pas. */}
      {actuelle && (
        <div className="rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] p-4">
          <p className="text-[12px] font-bold text-[#F59E0B] uppercase tracking-wider">
            Tu fais déjà partie d&apos;une équipe
          </p>
          <p className="text-[14px] font-bold text-white mt-2">{actuelle.label}</p>
          {actuelle.schoolName && (
            <p className="text-[12px] text-[#9CA3AF]">{actuelle.schoolName}</p>
          )}
          <p className="text-[13px] text-[#FCD34D] mt-3 leading-relaxed">
            Accepter une invitation ci-dessous te fera <strong>quitter cette équipe</strong>.
            Ton école et ton entraîneur changeront aussi. Ton passage sera conservé
            dans ton parcours.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {invitations.map((inv) => {
          const isBusy = busy === inv.id;
          const coachName = `${inv.coachFirstName} ${inv.coachLastName}`.trim();
          const cible = formatTeamLabel(inv.sportName, inv.ageGroup, inv.division, inv.gender, inv.teamName);
          const erreur = erreurs[inv.id];
          return (
            <div
              key={inv.id}
              className="bg-[#1A1D24] rounded-lg border border-[#E63946]/30 p-4 flex flex-wrap items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center text-xl shrink-0">
                {sportEmoji(inv.sportName)}
              </div>
              <div className="flex-1 min-w-0">
                {/* Libellé complet via formatTeamLabel — même source que les
                    sélecteurs d'onboarding, donc les deux surfaces ne peuvent
                    pas diverger. */}
                <p className="text-[14px] font-bold text-white truncate">{cible || "Équipe"}</p>
                {inv.schoolName && (
                  <p className="text-[12px] text-[#9CA3AF] truncate">{inv.schoolName}</p>
                )}
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
                  {isBusy ? "..." : actuelle ? "Changer d'équipe" : "Accepter"}
                </button>
              </div>
              {erreur && (
                <p className="w-full text-[12px] font-semibold text-[#EF4444]">{erreur}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
