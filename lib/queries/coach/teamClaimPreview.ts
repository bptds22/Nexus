/* ═══════════════════════════════════════════════════════════════
   teamClaimPreview — ce que le coach va obtenir AVANT d'écrire.

   Rejoindre une équipe orpheline ne fait pas qu'ajouter une ligne : ça
   désigne le responsable de tous les athlètes déjà dessus. Le coach doit
   voir le nombre AVANT de cliquer, pas le découvrir après.

   Lecture seule, aucune écriture. Consommé par les deux surfaces de prise
   d'équipe (web `app/coach/equipes/page.tsx`, mobile
   `components/shared/CoachEquipesMobile.tsx`) — même chiffre des deux côtés.
   ═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { REFERENT_ROLES, coachDisplayName } from "@/lib/coach/teamRoles";

export interface TeamClaimPreview {
  /** Athlètes déjà sur l'équipe — ceux dont le coach devient responsable. */
  athleteCount: number;
  /** true = l'équipe a déjà un responsable → le coach arrivera en assistant. */
  hasReferent: boolean;
  /** Nom du responsable en place, pour l'annoncer. null si aucun. */
  referentName: string | null;
  /** Rôle que l'arrivant obtiendra. Miroir exact de la règle de joinTeam. */
  incomingRole: "head_coach_interim" | "assistant";
}

/**
 * Toujours résolue : en cas d'erreur de lecture on retombe sur le scénario
 * PRUDENT (« il y a déjà un responsable, tu seras assistant »), jamais sur
 * une promesse de responsabilité qu'on ne pourrait pas tenir.
 */
export async function loadTeamClaimPreview(
  supabase: SupabaseClient,
  teamId: string,
): Promise<TeamClaimPreview> {
  const prudent: TeamClaimPreview = {
    athleteCount: 0,
    hasReferent: true,
    referentName: null,
    incomingRole: "assistant",
  };
  if (!teamId) return prudent;

  const [{ count: athCount, error: athErr }, { data: refRows, error: refErr }] =
    await Promise.all([
      supabase
        .from("team_athletes")
        .select("athlete_id", { count: "exact", head: true })
        .eq("team_id", teamId),
      supabase
        .from("team_coaches")
        .select("coach_id, role, users!coach_id(first_name, last_name)")
        .eq("team_id", teamId)
        .in("role", REFERENT_ROLES),
    ]);

  if (refErr) return { ...prudent, athleteCount: athErr ? 0 : (athCount ?? 0) };

  const rows = (refRows ?? []) as Record<string, unknown>[];
  const referent = rows[0];
  const hasReferent = rows.length > 0;

  let referentName: string | null = null;
  if (referent) {
    const uRel = referent.users as
      | { first_name?: string; last_name?: string }
      | { first_name?: string; last_name?: string }[]
      | null;
    const u = Array.isArray(uRel) ? uRel[0] : uRel;
    referentName = coachDisplayName(u?.first_name, u?.last_name);
  }

  return {
    athleteCount: athErr ? 0 : (athCount ?? 0),
    hasReferent,
    referentName,
    incomingRole: hasReferent ? "assistant" : "head_coach_interim",
  };
}

/** Phrase d'annonce, partagée web + mobile pour que le libellé ne dérive pas. */
export function claimPreviewMessage(p: TeamClaimPreview, teamName: string): string {
  if (p.hasReferent) {
    const qui = p.referentName ? `${p.referentName} en est` : "Cette équipe a déjà un";
    return `${qui} le responsable — tu rejoindras ${teamName} comme entraîneur adjoint.`;
  }
  if (p.athleteCount === 0) {
    return `Cette équipe n'a pas de responsable : tu deviens coach intérimaire de ${teamName}. Elle ne compte aucun athlète pour l'instant.`;
  }
  const n = p.athleteCount;
  return `Cette équipe n'a pas de responsable : tu deviens coach intérimaire de ${teamName} — responsable ${
    n > 1 ? `des ${n} athlètes` : `de l'athlète`
  } déjà inscrit${n > 1 ? "s" : ""}.`;
}
