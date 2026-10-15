/* Prospects partenaires côté ADMIN (W4d) — fonctions W4a en prod :
   admin_prospects_partenaires (cartes + issues), admin_prospects_rapprochements
   (candidats calculés + décisions), admin_prospect_proposer / _ecarter / _annuler.
   Toutes exigent is_admin() côté serveur. */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface LigneProspectAdmin {
  /** id de la carte (active) ou de l'issue (terminée) — c'est lui qu'on passe à « Annuler ». */
  id: string;
  carteId: string;
  partenaire: string | null;
  prenom: string | null;
  nom: string | null;
  sport: string | null;
  statut: string;
  source: string | null;
  creeLe: string;
  expireLe: string | null;
  termineeLe: string | null;
  annulable: boolean;
}

export interface RapprochementAdmin {
  carteId: string;
  athleteId: string;
  athletePrenom: string | null;
  athleteNom: string | null;
  critere: string;
  force: string;
  promotionConcorde: boolean | null;
  visiblePartenaire: boolean;
  statut: string;
  origine: string | null;
  decideLe: string | null;
}

export const LIBELLE_STATUT_ADMIN: Record<string, string> = {
  A_ENVOYER: "À envoyer",
  ENVOYEE: "Lien envoyé",
  RESERVEE: "Réservée (en attente du jeune)",
  CONFIRMEE_ATTENTE_OPTIN: "Confirmée — attend l'opt-in",
  RECLAMEE: "Réclamée",
  REFUSEE: "Refusée par le jeune",
  EXPIREE: "Expirée",
  RETIREE: "Retirée par le partenaire",
  SUPPRIMEE_ADMIN: "Supprimée par Nexus",
  RECLAMATION_ANNULEE: "Réclamation annulée",
};

export const LIBELLE_SOURCE: Record<string, string> = {
  LIEN: "Par le lien",
  ADMIN: "Proposée par Nexus",
  AUTO: "Proposition automatique",
};

export const LIBELLE_DECISION: Record<string, string> = {
  PROPOSE: "Proposé au jeune",
  ECARTE: "Écarté",
  CONFIRME: "Confirmé par le jeune",
  INFIRME: "Infirmé par le jeune",
  CADUC: "Caduc (carte modifiée ou lien ouvert)",
};

export async function chargerProspectsAdmin(supabase: SupabaseClient): Promise<LigneProspectAdmin[]> {
  const { data, error } = await supabase.rpc("admin_prospects_partenaires");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    carteId: r.carte_id as string,
    partenaire: (r.partenaire as string | null) ?? null,
    prenom: (r.prenom as string | null) ?? null,
    nom: (r.nom as string | null) ?? null,
    sport: (r.sport as string | null) ?? null,
    statut: r.statut as string,
    source: (r.reservation_source as string | null) ?? null,
    creeLe: r.created_at as string,
    expireLe: (r.expire_le as string | null) ?? null,
    termineeLe: (r.terminee_le as string | null) ?? null,
    annulable: r.annulable === true,
  }));
}

export async function chargerRapprochementsAdmin(supabase: SupabaseClient): Promise<RapprochementAdmin[]> {
  const { data, error } = await supabase.rpc("admin_prospects_rapprochements");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    carteId: r.carte_id as string,
    athleteId: r.athlete_id as string,
    athletePrenom: (r.athlete_prenom as string | null) ?? null,
    athleteNom: (r.athlete_nom as string | null) ?? null,
    critere: r.critere as string,
    force: r.force as string,
    promotionConcorde: (r.promotion_concorde as boolean | null) ?? null,
    visiblePartenaire: r.visible_partenaire === true,
    statut: r.statut as string,
    origine: (r.origine as string | null) ?? null,
    decideLe: (r.decide_le as string | null) ?? null,
  }));
}

export async function proposerAuJeune(supabase: SupabaseClient, carteId: string, athleteId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_prospect_proposer", { p_carte: carteId, p_athlete: athleteId });
  if (error) throw error;
}

export async function ecarterRapprochement(supabase: SupabaseClient, carteId: string, athleteId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_prospect_ecarter", { p_carte: carteId, p_athlete: athleteId });
  if (error) throw error;
}

/** Annule une réclamation (moins de 7 jours) : transfert défait, carte restaurée sans lien. */
export async function annulerReclamation(supabase: SupabaseClient, issueId: string): Promise<string> {
  const { data, error } = await supabase.rpc("admin_prospect_annuler", { p_id: issueId });
  if (error) throw error;
  return data as string;
}
