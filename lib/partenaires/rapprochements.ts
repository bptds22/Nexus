/* ═══════════════════════════════════════════════════════════════
   Rapprochements du PARTENAIRE (P2/P3, 1.4.5) — « comme le recruteur » :
   ses cartes prospect qui semblent correspondre à un athlète déjà inscrit,
   et sa décision (Accepter / Refuser). Migration 20261018100000.

   La base ne rend QUE des athlètes déjà visibles du partenaire. Accepter =
   le même transfert que « C'est moi » du jeune (évaluation et badges sur le
   profil, carte terminée, annulable 7 jours par l'admin).
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { lireTout } from "@/lib/supabase/lireTout";

export interface RapprochementPartenaire {
  carteId: string;
  athleteId: string;
  prenom: string;
  nom: string;
  ecole: string | null;
  sport: string | null;
  promotion: number | null;
  photoUrl: string | null;
  critere: string;
  force: "MOYENNE" | "FAIBLE";
  /** Proposition automatique déjà envoyée au jeune (il peut encore répondre lui-même). */
  dejaPropose: boolean;
}

export async function chargerRapprochements(supabase: SupabaseClient): Promise<RapprochementPartenaire[]> {
  const data = await lireTout<Record<string, unknown>>((de, a) => supabase
    .rpc("partenaire_rapprochements", {}, { count: "exact" }).select("*").order("carte_id").order("athlete_id").range(de, a));
  return data.map((r) => ({
    carteId: r.carte_id as string,
    athleteId: r.athlete_id as string,
    prenom: (r.prenom as string | null) ?? "",
    nom: (r.nom as string | null) ?? "",
    ecole: (r.ecole as string | null) ?? null,
    sport: (r.sport as string | null) ?? null,
    promotion: (r.promotion as number | null) ?? null,
    photoUrl: (r.photo_url as string | null) ?? null,
    critere: r.critere as string,
    force: r.force === "MOYENNE" ? "MOYENNE" : "FAIBLE",
    dejaPropose: r.deja_propose === true,
  }));
}

export async function accepterRapprochement(supabase: SupabaseClient, r: Pick<RapprochementPartenaire, "carteId" | "athleteId">): Promise<void> {
  const { error } = await supabase.rpc("partenaire_rapprochement_accepter", { p_carte: r.carteId, p_athlete: r.athleteId });
  if (error) throw error;
}

export async function refuserRapprochement(supabase: SupabaseClient, r: Pick<RapprochementPartenaire, "carteId" | "athleteId">): Promise<void> {
  const { error } = await supabase.rpc("partenaire_rapprochement_refuser", { p_carte: r.carteId, p_athlete: r.athleteId });
  if (error) throw error;
}

/** Le niveau, dans les mots du recruteur (lib/cartes/niveauRapprochement) : même nom et même
 *  équipe / établissement, sinon « possiblement le même athlète ». */
export function libelleNiveauPartenaire(critere: string): { texte: string; fort: boolean } {
  switch (critere) {
    case "EQUIPE": return { texte: "Correspondance : même nom, même équipe", fort: true };
    case "ETABLISSEMENT": return { texte: "Correspondance : même nom, même établissement", fort: true };
    default: return { texte: "Possiblement le même athlète", fort: false };
  }
}

/** Nombre de propositions par carte (lien « Un profil semble correspondre » sur la carte). */
export function parCarte(liste: readonly RapprochementPartenaire[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of liste) m.set(r.carteId, (m.get(r.carteId) ?? 0) + 1);
  return m;
}
