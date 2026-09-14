/* ═══════════════════════════════════════════════════════════════
   athleteReferent — qui répond pour cet athlète, côté recruteur.

   LOT I (2026-09-09) : le miroir client de `fn_resolve_team_referent` est
   PARTI. La vague 2 est appliquée ; `athletes.coach_id` est désormais un
   POINTEUR DÉRIVÉ, maintenu par les triggers dans les deux sens (arrivée et
   départ). Ce module le LIT, il ne le recalcule pas — une seule cascade
   vivante, celle de la base.

   Ce qui reste ici n'est pas de la résolution : c'est de l'ÉTIQUETTE. Savoir
   si le référent tient son rôle de l'équipe ou de la direction ne change pas
   QUI répond, seulement comment on le présente au recruteur. Cette lecture ne
   décide de rien et ne peut pas diverger de la base.

   Le cas « personne » reste DOMINANT et nominal : au 2026-09-09, 43 des 54
   athlètes ACTIF en équipe n'ont aucun membre du staff inscrit. C'est ce que
   coach_id NULL dit maintenant, et c'est vrai — aucune règle de résolution ne
   crée du staff. D'où le message F2 plus bas.
   ═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { REFERENT_ROLES, coachDisplayName } from "@/lib/coach/teamRoles";

export interface AthleteReferent {
  coachId: string | null;
  name: string | null;
  /** D'où vient le référent — sert à nuancer le libellé côté UI. */
  source: "team" | "director" | "owner" | "none";
  /** Nom de l'équipe qui a fourni le référent, si c'est cette voie. */
  teamName: string | null;
}

const AUCUN: AthleteReferent = { coachId: null, name: null, source: "none", teamName: null };

/** Ne throw jamais : un nom d'entraîneur absent ne casse pas une fiche. */
export async function loadAthleteReferent(
  supabase: SupabaseClient,
  athleteId: string,
): Promise<AthleteReferent> {
  if (!athleteId) return AUCUN;

  /* L'équipe sert au libellé et au message F2 — jamais à choisir le référent. */
  const { data: taRows } = await supabase
    .from("team_athletes")
    .select("team_id, teams!team_id(name)")
    .eq("athlete_id", athleteId)
    .limit(1);

  const ta = ((taRows ?? []) as Record<string, unknown>[])[0];
  const tRel = ta?.teams as { name?: string } | { name?: string }[] | null | undefined;
  const team = Array.isArray(tRel) ? tRel[0] : tRel;
  const teamId = (ta?.team_id as string | undefined) ?? null;
  const teamName = team?.name ?? null;

  /* LA source : le pointeur dérivé, maintenu par les triggers de la vague 2. */
  const { data: aRows } = await supabase
    .from("athletes")
    .select("coach_id, users!athletes_coach_id_fkey(first_name, last_name)")
    .eq("id", athleteId)
    .limit(1);

  const a = ((aRows ?? []) as Record<string, unknown>[])[0];
  const coachId = (a?.coach_id as string | undefined) ?? null;

  /* Personne ne répond — état nominal, pas une erreur. On garde le nom de
     l'équipe : le message F2 est bien plus clair avec (« l'encadrement de
     Wildcats D2 » plutôt que « l'encadrement »). */
  if (!coachId) return { ...AUCUN, teamName };

  const uRel = a.users as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
  const u = Array.isArray(uRel) ? uRel[0] : uRel;
  const name = coachDisplayName(u?.first_name, u?.last_name);

  /* Étiquette seulement : ce référent porte-t-il un rôle SUR cette équipe ?
     Sinon il vient de la direction de l'organisation. Sans équipe, il ne peut
     venir que du champ lui-même. */
  if (!teamId) return { coachId, name, source: "owner", teamName: null };

  const { data: tcRows } = await supabase
    .from("team_coaches")
    .select("coach_id")
    .eq("team_id", teamId)
    .eq("coach_id", coachId)
    .in("role", REFERENT_ROLES)
    .limit(1);

  const surLEquipe = ((tcRows ?? []) as unknown[]).length > 0;
  return { coachId, name, source: surLEquipe ? "team" : "director", teamName };
}

/* ── F2 — ce qu'on dit au recruteur quand personne ne répond ────────
   État NOMINAL de pré-saison, pas une erreur : au 2026-09-09, 43 des 53
   athlètes en équipe n'ont aucun membre du staff inscrit. Le message doit
   informer sans accuser la plateforme ni l'athlète — et surtout remplacer
   le silence actuel, où le message partait sans que personne ne soit
   notifié.                                                              */
export const AUCUN_STAFF_TITRE = "Le staff de cette équipe n'est pas encore sur Nexus";

export function aucunStaffMessage(teamName: string | null): string {
  return (
    `Personne de l'encadrement ${teamName ? `de ${teamName} ` : ""}n'a encore rejoint la plateforme : ` +
    "ton message partira, mais aucun entraîneur ne sera notifié pour l'instant. " +
    "Le parent de l'athlète, lui, reçoit l'avis de premier contact quand son courriel est renseigné."
  );
}

/** Libellé de la carte « entraîneur » selon la voie de résolution. */
export function referentRoleLabel(r: AthleteReferent): string {
  switch (r.source) {
    case "team":     return r.teamName ? `Responsable — ${r.teamName}` : "Responsable de l'équipe";
    case "director": return "Directeur de l'organisation";
    case "owner":    return "Entraîneur référent";
    default:         return "";
  }
}
