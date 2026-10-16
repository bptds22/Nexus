/* ═══════════════════════════════════════════════════════════════
   Demande de visibilité partenaire (2026-10-16) — partagé web et appli.

   Un partenaire a évalué ou badgé un jeune qui n'a pas l'opt-in actif
   (carte prospect qui attend, W4a) : le jeune reçoit UNE notification
   PARTENAIRE_VISIBILITE_DEMANDE par partenaire. Le texte ne révèle ni la
   cote ni les badges. « Accepter » passe par accepter_visibilite_partenaire
   (serveur) : set_my_partner_visibility, ou sous 14 ans, la demande part au
   parent lié. La demande se règle aussi toute seule (activation dans les
   paramètres, accord du parent, carte disparue).
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export const TYPE_DEMANDE_VISIBILITE = "PARTENAIRE_VISIBILITE_DEMANDE";
export const TYPE_DEMANDE_PARENT = "CHILD_PARTNER_VISIBILITY_REQUEST";

export type EtatDemande = "EN_ATTENTE" | "ACCEPTEE" | "DEMANDE_PARENT" | "CADUQUE";

export function etatDemande(metadata: Record<string, unknown> | null | undefined): EtatDemande {
  const e = metadata?.etat;
  return e === "ACCEPTEE" || e === "DEMANDE_PARENT" || e === "CADUQUE" ? e : "EN_ATTENTE";
}

/** La ligne d'état sous une demande déjà réglée (null = encore à accepter). */
export function texteEtatDemande(etat: EtatDemande): string | null {
  switch (etat) {
    case "ACCEPTEE": return "Visibilité partenaires activée : ton évaluation s'affiche.";
    case "DEMANDE_PARENT": return "Demande envoyée à ton parent : son accord activera ta visibilité.";
    case "CADUQUE": return "Cette demande n'est plus d'actualité.";
    default: return null;
  }
}

export type ResultatAcceptation =
  | { ok: true; etat: "ACCEPTEE" | "DEMANDE_PARENT" }
  | { ok: false; message: string };

/** Le message d'un refus du serveur, pour un jeune de 14 à 17 ans. */
export function messageRefusAcceptation(reason: string | undefined): string {
  switch (reason) {
    case "parent_absent":
      return "Ton parent doit donner son accord, mais aucun parent n'est relié à ton compte. Demande-lui de créer son accès parent Nexus.";
    case "deja_traitee":
      return "Cette demande a déjà été traitée.";
    case "introuvable":
      return "Cette demande est introuvable.";
    default:
      return "L'activation n'a pas fonctionné. Réessaie dans un instant.";
  }
}

export async function accepterVisibilitePartenaire(
  supabase: SupabaseClient,
  notificationId: string,
  policyVersion: string,
): Promise<ResultatAcceptation> {
  const { data, error } = await supabase.rpc("accepter_visibilite_partenaire", {
    p_notification: notificationId,
    p_policy_version: policyVersion,
  });
  if (error) return { ok: false, message: messageRefusAcceptation(undefined) };
  const r = data as { ok?: boolean; etat?: string; reason?: string } | null;
  if (r?.ok && (r.etat === "ACCEPTEE" || r.etat === "DEMANDE_PARENT")) return { ok: true, etat: r.etat };
  return { ok: false, message: messageRefusAcceptation(r?.reason) };
}

/** La demande de visibilité qui porte cette carte (écran de réponse à une carte), ou null.
 *  Le jeune lit ses propres notifications (RLS) ; une carte n'est que dans UNE demande. */
export async function demandeDeLaCarte(
  supabase: SupabaseClient,
  carteId: string,
): Promise<{ id: string; etat: EtatDemande } | null> {
  const { data, error } = await supabase
    .from("athlete_notifications")
    .select("id, metadata")
    .eq("type", TYPE_DEMANDE_VISIBILITE)
    .contains("metadata", { cartes: [carteId] })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  const n = data[0] as { id: string; metadata: Record<string, unknown> | null };
  return { id: n.id, etat: etatDemande(n.metadata) };
}

/** Sous 14 ans, depuis l'écran d'une carte : la MÊME demande au parent que « Accepter ».
 *  Rend le message à afficher. */
export async function demanderAuParentDepuisCarte(
  supabase: SupabaseClient,
  carteId: string,
  carteConfirmee: boolean,
  policyVersion: string,
): Promise<string> {
  if (!carteConfirmee) return "Confirme d'abord que c'est bien toi : la demande partira ensuite à ton parent.";
  const d = await demandeDeLaCarte(supabase, carteId);
  if (d?.etat === "DEMANDE_PARENT") return texteEtatDemande("DEMANDE_PARENT") as string;
  if (d?.etat === "EN_ATTENTE") {
    const r = await accepterVisibilitePartenaire(supabase, d.id, policyVersion);
    if (r.ok) return texteEtatDemande(r.etat) as string;
    return r.message;
  }
  return "Ton parent doit donner son accord depuis son portail parent Nexus.";
}
