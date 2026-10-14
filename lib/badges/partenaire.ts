/* ═══════════════════════════════════════════════════════════════
   Badges PARTENAIRE (lot W3) — lecture, pose, retrait, masquage, admin.

   Ce ne sont PAS des badges du catalogue (`badges` / `athlete_badges`) :
   - table à part (partner_athlete_badges) — hors plafond de 5, hors M10 ;
   - jamais proposés au coach ni à l'athlète (aucun picker ne les lit) ;
   - signés par l'ORGANISATION, icône propre (bucket partner-badges) ;
   - ajoutés À LA FIN de la rangée « Distinctions ».

   Tout passe par des RPC (aucun accès direct aux tables) :
   - badges_partenaires_athlete  : lecture arbitrée serveur (un badge
     masqué n'est rendu qu'au coach, à l'admin et au partenaire auteur) ;
   - partenaire_mes_badges       : le catalogue du partenaire connecté ;
   - partenaire_attribuer_badge  : pose, garde W2 (partenaire_peut_evaluer
     + athlète admissible et ACTIF) ;
   - retirer_badge_partenaire    : partenaire auteur ou admin ;
   - coach_masquer_badge_partenaire : coach de l'athlète ou admin ;
   - admin_badges_partenaire / admin_enregistrer_badge_partenaire.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_BADGES_PARTENAIRE = "partner-badges";

/** Diffusé après une pose, un retrait ou un masquage : les rangées se rechargent. */
export const EVENEMENT_BADGE_PARTENAIRE = "nx-badge-partenaire";

export function signalerBadgesPartenaire(athleteId: string): void {
  window.dispatchEvent(new CustomEvent(EVENEMENT_BADGE_PARTENAIRE, { detail: { athleteId } }));
}

export interface BadgePartenaire {
  /** Id de la POSE (partner_athlete_badges.id) — c'est lui qu'on retire / masque. */
  id: string;
  badgeId: string;
  libelle: string;
  organisation: string;
  iconeUrl: string | null;
  poseLe: string;
  estMasque: boolean;
  estLeMien: boolean;
  peutMasquer: boolean;
}

export function iconeBadgeUrl(supabase: SupabaseClient, path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET_BADGES_PARTENAIRE).getPublicUrl(path).data.publicUrl;
}

export async function chargerBadgesPartenaires(
  supabase: SupabaseClient,
  athleteId: string,
): Promise<BadgePartenaire[]> {
  const { data, error } = await supabase.rpc("badges_partenaires_athlete", { p_athlete_id: athleteId });
  if (error) throw error;
  return ((data ?? []) as {
    id: string; badge_id: string; libelle: string; icone_path: string | null; organisation: string;
    created_at: string; est_masque: boolean; est_le_mien: boolean; peut_masquer: boolean;
  }[]).map((r) => ({
    id: r.id,
    badgeId: r.badge_id,
    libelle: r.libelle,
    organisation: r.organisation,
    iconeUrl: iconeBadgeUrl(supabase, r.icone_path),
    poseLe: r.created_at,
    estMasque: !!r.est_masque,
    estLeMien: !!r.est_le_mien,
    peutMasquer: !!r.peut_masquer,
  }));
}

export interface BadgeCatalogue {
  id: string;
  libelle: string;
  iconeUrl: string | null;
}

export async function chargerMesBadgesPartenaire(supabase: SupabaseClient): Promise<BadgeCatalogue[]> {
  const { data, error } = await supabase.rpc("partenaire_mes_badges");
  if (error) throw error;
  return ((data ?? []) as { id: string; libelle: string; icone_path: string | null }[])
    .map((r) => ({ id: r.id, libelle: r.libelle, iconeUrl: iconeBadgeUrl(supabase, r.icone_path) }));
}

export async function attribuerBadgePartenaire(supabase: SupabaseClient, athleteId: string, badgeId: string): Promise<void> {
  const { error } = await supabase.rpc("partenaire_attribuer_badge", { p_athlete_id: athleteId, p_badge_id: badgeId });
  if (error) throw error;
}

export async function retirerBadgePartenaire(supabase: SupabaseClient, poseId: string): Promise<void> {
  const { error } = await supabase.rpc("retirer_badge_partenaire", { p_attribution_id: poseId });
  if (error) throw error;
}

export async function masquerBadgePartenaire(supabase: SupabaseClient, poseId: string, masque: boolean): Promise<void> {
  const { error } = await supabase.rpc("coach_masquer_badge_partenaire", { p_attribution_id: poseId, p_masque: masque });
  if (error) throw error;
}

/* ── Admin ─────────────────────────────────────────────────────── */

export interface BadgeAdmin {
  id: string;
  libelle: string;
  iconePath: string | null;
  iconeUrl: string | null;
  actif: boolean;
  ordre: number;
  poses: number;
}

export async function chargerBadgesAdmin(supabase: SupabaseClient, partnerId: string): Promise<BadgeAdmin[]> {
  const { data, error } = await supabase.rpc("admin_badges_partenaire", { p_partner_id: partnerId });
  if (error) throw error;
  return ((data ?? []) as {
    id: string; libelle: string; icone_path: string | null; actif: boolean; ordre: number; poses: number;
  }[]).map((r) => ({
    id: r.id, libelle: r.libelle, iconePath: r.icone_path, iconeUrl: iconeBadgeUrl(supabase, r.icone_path),
    actif: r.actif, ordre: r.ordre, poses: r.poses,
  }));
}

export async function enregistrerBadgeAdmin(
  supabase: SupabaseClient,
  b: { id: string | null; partnerId: string; libelle: string; iconePath: string | null; actif: boolean; ordre: number },
): Promise<string> {
  const { data, error } = await supabase.rpc("admin_enregistrer_badge_partenaire", {
    p_id: b.id, p_partner_id: b.partnerId, p_libelle: b.libelle,
    p_icone_path: b.iconePath, p_actif: b.actif, p_ordre: b.ordre,
  });
  if (error) throw error;
  return data as string;
}
