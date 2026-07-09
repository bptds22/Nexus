/* ═══════════════════════════════════════════════════════════════
   teamInvite — helpers partagés pour l'invitation d'équipe (athlète AVEC
   compte) : charge les équipes du coach + INSERT team_invitations.

   Un athlète qui a DÉJÀ un compte ne "réclame" rien (pas de claim/email) — le
   coach l'invite à une équipe (in-app). Consommé par le wizard create ET le CTA
   roster "Inviter par courriel" → un seul chemin team_invitations.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CoachTeamOption {
  id: string;
  name: string;
}

/**
 * Équipes du coach appelant — union des deux sources : équipes de son école
 * (scolaire, par school_id) + équipes civiles (via la jonction team_coaches).
 * Déduplique par id. Colonnes minimales (id + name) pour un sélecteur.
 */
export async function loadCoachTeams(supabase: SupabaseClient): Promise<CoachTeamOption[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const teams = new Map<string, string>();

  const { data: profile } = await supabase
    .from("users").select("school_id").eq("id", user.id).maybeSingle();

  // Équipes scolaires (école du coach).
  if (profile?.school_id) {
    const { data } = await supabase
      .from("teams").select("id, name")
      .eq("school_id", profile.school_id).eq("is_active", true);
    (data ?? []).forEach((t) => { if (t?.id) teams.set(t.id as string, (t.name as string) || ""); });
  }

  // Équipes civiles (jonction team_coaches).
  const { data: tc } = await supabase
    .from("team_coaches").select("teams!team_id(id, name)").eq("coach_id", user.id);
  (tc ?? []).forEach((r) => {
    const rel = (r as { teams?: unknown }).teams;
    const t = (Array.isArray(rel) ? rel[0] : rel) as { id?: string; name?: string } | null;
    if (t?.id) teams.set(t.id, t.name || "");
  });

  return Array.from(teams, ([id, name]) => ({ id, name }));
}

/**
 * Invite un athlète AVEC compte à une équipe → INSERT team_invitations PENDING.
 * Même mécanisme que le wizard (l'athlète connecté voit/accepte l'invitation
 * in-app ; le trigger apply_team_invitation_acceptance l'applique au ACCEPTED).
 */
export async function inviteAthleteToTeam(
  supabase: SupabaseClient,
  athleteId: string,
  teamId: string,
): Promise<{ error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Session expirée — reconnecte-toi." };

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("team_invitations").insert({
    team_id: teamId,
    athlete_id: athleteId,
    invited_by_coach_id: auth.user.id,
    status: "PENDING",
    expires_at: expiresAt,
  });
  if (error) return { error: `Erreur lors de l'envoi : ${error.message}` };
  return {};
}
