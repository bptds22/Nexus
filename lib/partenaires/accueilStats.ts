/* ═══════════════════════════════════════════════════════════════
   accueilStats — les 3 statistiques de l'Accueil partenaire (BP 2026-10-18, 6.4).

   Calculées SEULEMENT sur les données DE CE PARTENAIRE (règle C2 : jamais un
   total de la plateforme). Toutes viennent des fonctions déjà lues par
   « Mes athlètes », qui ne rendent que ses lignes à lui :
     - « En attente »  : ses cartes au statut « Lien envoyé » (toujours sans
       profil Nexus — une carte réclamée n'est plus une carte active) ;
     - « À confirmer » : ses propositions de correspondance à accepter ou refuser ;
     - « Réclamées »   : ses cartes devenues de vrais profils CE MOIS-CI, avec
       en petit le nombre de ses évaluations au total.
   Lecture groupée par pages (lireTout dans les chargeurs) : aucun plafond de 1 000.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { chargerCartesTerminees, chargerMesCartes, type CartePartenaire, type CarteTerminee } from "@/lib/partenaires/prospects";
import { chargerRapprochements, type RapprochementPartenaire } from "@/lib/partenaires/rapprochements";
import { chargerMesAthletes, type MonAthlete } from "@/lib/partenaires/mesAthletes";

export interface StatsAccueilPartenaire {
  enAttente: number;
  aConfirmer: number;
  reclameesCeMois: number;
  evaluationsTotal: number;
}

export const STATS_VIDES: StatsAccueilPartenaire = { enAttente: 0, aConfirmer: 0, reclameesCeMois: 0, evaluationsTotal: 0 };

/** Même mois civil, heure locale. */
function memeMois(iso: string, maintenant: Date): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth();
}

/** Logique pure : rien d'autre que les listes du partenaire. */
export function calculerStatsAccueil(d: {
  cartes: readonly Pick<CartePartenaire, "statut">[];
  rapprochements: readonly Pick<RapprochementPartenaire, "carteId">[];
  terminees: readonly Pick<CarteTerminee, "issue" | "termineeLe">[];
  mesAthletes: readonly Pick<MonAthlete, "evaluationId" | "coteGlobale">[];
}, maintenant = new Date()): StatsAccueilPartenaire {
  return {
    enAttente: d.cartes.filter((c) => c.statut === "ENVOYEE").length,
    aConfirmer: d.rapprochements.length,
    reclameesCeMois: d.terminees.filter((t) => t.issue === "RECLAMEE" && memeMois(t.termineeLe, maintenant)).length,
    evaluationsTotal: d.mesAthletes.filter((a) => a.evaluationId != null || a.coteGlobale != null).length,
  };
}

/** Lit les 4 listes du partenaire ; une lecture en échec compte pour 0 (l'Accueil ne casse jamais). */
export async function chargerStatsAccueil(supabase: SupabaseClient): Promise<StatsAccueilPartenaire> {
  const sur = <T,>(p: Promise<T[]>) => p.catch((e) => {
    console.error("[accueil partenaire] statistique :", (e as { message?: string })?.message ?? e);
    return [] as T[];
  });
  const [cartes, rapprochements, terminees, mesAthletes] = await Promise.all([
    sur(chargerMesCartes(supabase)),
    sur(chargerRapprochements(supabase)),
    sur(chargerCartesTerminees(supabase)),
    sur(chargerMesAthletes(supabase)),
  ]);
  return calculerStatsAccueil({ cartes, rapprochements, terminees, mesAthletes });
}

/** Destinations des statistiques (Mes athlètes fusionné, 6.1). */
export const LIEN_STAT = {
  enAttente: "/partenaire/mes-athletes?vue=attente",
  aConfirmer: "/partenaire/mes-athletes?vue=attente&filtre=propositions",
  reclamees: "/partenaire/mes-athletes?vue=evaluations",
} as const;
