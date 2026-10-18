/* ═══════════════════════════════════════════════════════════════
   Badges PARTENAIRE (lot W3) — lecture, pose, retrait, masquage, admin.

   Ce ne sont PAS des badges du catalogue (`badges` / `athlete_badges`) :
   - table à part (partner_athlete_badges) — hors plafond de 5, hors M10 ;
   - jamais proposés au coach ni à l'athlète (aucun picker ne les lit) ;
   - signés par l'ORGANISATION, icône propre (bucket partner-badges) ;
   - ajoutés À LA FIN de la rangée « Distinctions ».

   W3b : un partenaire peut AUSSI poser un badge du catalogue Nexus
   (universel ou de sport, sans contexte, jamais honneur ; un badge de sport
   seulement pour le sport de l'athlète). Même table, mêmes lecteurs, même
   retrait et même masquage — `estNexus` / `codeNexus` les distinguent, et
   la vignette rend alors le VRAI badge Nexus (DistinctionBadge), signé
   « par <organisation> ».

   Tout passe par des RPC (aucun accès direct aux tables) :
   - badges_partenaires_athlete  : lecture arbitrée serveur (un badge
     masqué n'est rendu qu'au coach, à l'admin et au partenaire auteur) ;
   - partenaire_mes_badges       : le catalogue du partenaire connecté ;
   - partenaire_attribuer_badge  : pose, garde W2 (partenaire_peut_evaluer
     + athlète admissible et ACTIF) ;
   - partenaire_badges_nexus_admissibles / partenaire_attribuer_badge_nexus :
     les badges Nexus proposables à cet athlète, et leur pose (W3b) ;
   - retirer_badge_partenaire    : partenaire auteur ou admin ;
   - coach_masquer_badge_partenaire : coach de l'athlète ou admin ;
   - admin_badges_partenaire / admin_enregistrer_badge_partenaire.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { idsUniques, lireTout } from "@/lib/supabase/lireTout";

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
  /** W3b : badge du catalogue Nexus posé par le partenaire (sinon, badge propre). */
  estNexus: boolean;
  /** W3b : code du badge Nexus (`vitesse`, `capitaine`…) ; null pour un badge propre. */
  codeNexus: string | null;
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
    badge_code: string | null; est_nexus: boolean | null;
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
    estNexus: !!r.est_nexus,
    codeNexus: r.badge_code ?? null,
  }));
}

type LigneBadgeLot = {
  athlete_id: string; id: string; badge_id: string; libelle: string; icone_path: string | null; organisation: string;
  created_at: string; est_masque: boolean; est_le_mien: boolean; peut_masquer: boolean;
  badge_code: string | null; est_nexus: boolean | null;
};

/** Les badges partenaire d'un LOT d'athlètes (cartes : recherche, favoris, listes, processus),
 *  groupés par athlète. UN appel groupé, toutes les pages (lireTout) : ni requête par carte,
 *  ni plafond de 1 000. Lecture arbitrée serveur athlète par athlète (badges_partenaires_athlete) :
 *  Loi 25 — sans opt-in partenaire actif, rien. Un badge MASQUÉ n'est jamais montré sur une carte. */
export async function chargerBadgesPartenairesLot(
  supabase: SupabaseClient,
  athleteIds: Iterable<string | null | undefined>,
): Promise<Map<string, BadgePartenaire[]>> {
  const ids = idsUniques(athleteIds).sort();
  const parAthlete = new Map<string, BadgePartenaire[]>();
  if (ids.length === 0) return parAthlete;
  const lignes = await lireTout<LigneBadgeLot>((de, a) => supabase
    .rpc("badges_partenaires_athletes", { p_athlete_ids: ids }, { count: "exact" })
    .select("athlete_id, id, badge_id, libelle, icone_path, organisation, created_at, est_masque, est_le_mien, peut_masquer, badge_code, est_nexus")
    .order("id")
    .range(de, a));
  for (const r of lignes) {
    if (r.est_masque) continue;
    const b: BadgePartenaire = {
      id: r.id,
      badgeId: r.badge_id,
      libelle: r.libelle,
      organisation: r.organisation,
      iconeUrl: iconeBadgeUrl(supabase, r.icone_path),
      poseLe: r.created_at,
      estMasque: false,
      estLeMien: !!r.est_le_mien,
      peutMasquer: !!r.peut_masquer,
      estNexus: !!r.est_nexus,
      codeNexus: r.badge_code ?? null,
    };
    const l = parAthlete.get(r.athlete_id);
    if (l) l.push(b); else parAthlete.set(r.athlete_id, [b]);
  }
  for (const l of parAthlete.values()) l.sort((x, y) => (x.poseLe < y.poseLe ? -1 : x.poseLe > y.poseLe ? 1 : x.id < y.id ? -1 : 1));
  return parAthlete;
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

/* ── W3b : badges du catalogue Nexus ───────────────────────────── */

export interface BadgeNexusAdmissible {
  id: string;
  code: string;
  libelle: string;
  famille: "universel" | "sport";
  /** Qui porte déjà ce badge sur l'athlète : « son coach », une organisation, ou null. */
  dejaPar: string | null;
}

/** Les badges Nexus que le partenaire connecté peut proposer pour CET athlète
 *  (le serveur filtre famille, contexte et sport). */
export async function chargerBadgesNexusAdmissibles(supabase: SupabaseClient, athleteId: string): Promise<BadgeNexusAdmissible[]> {
  const { data, error } = await supabase.rpc("partenaire_badges_nexus_admissibles", { p_athlete_id: athleteId });
  if (error) throw error;
  return ((data ?? []) as { badge_id: string; code: string; libelle: string; famille: "universel" | "sport"; deja_par: string | null }[])
    .map((r) => ({ id: r.badge_id, code: r.code, libelle: r.libelle, famille: r.famille, dejaPar: r.deja_par }));
}

/** Pose un badge Nexus. `partnerId` : seulement l'admin, pour le compte d'un partenaire. */
export async function attribuerBadgeNexus(
  supabase: SupabaseClient, athleteId: string, badgeId: string, partnerId: string | null = null,
): Promise<void> {
  const { error } = await supabase.rpc("partenaire_attribuer_badge_nexus", {
    p_athlete_id: athleteId, p_badge_id: badgeId, p_partner_id: partnerId,
  });
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
