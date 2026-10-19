/* ═══════════════════════════════════════════════════════════════
   vueMesAthletes — « Mes athlètes » partenaire, un seul onglet (BP 2026-10-18, 6.1).

   Deux pastilles en haut :
     - « En attente »     : les cartes pas encore liées à un profil Nexus
       (À envoyer, Lien envoyé, Correspondance possible) et les propositions
       à accepter ou refuser ;
     - « Mes évaluations » : les vrais profils Nexus, y compris les cartes
       réclamées par le jeune (ex-« Terminées »).
   Adresse : /partenaire/mes-athletes?vue=attente|evaluations[&filtre=propositions].
   L'ancienne /partenaire/prospects renvoie vers « En attente ».
═══════════════════════════════════════════════════════════════ */

import type { CarteTerminee } from "@/lib/partenaires/prospects";

export type VueMesAthletes = "attente" | "evaluations";

export const PASTILLES_MES_ATHLETES: readonly { key: VueMesAthletes; label: string }[] = [
  { key: "attente", label: "En attente" },
  { key: "evaluations", label: "Mes évaluations" },
];

export const ROUTE_MES_ATHLETES = "/partenaire/mes-athletes";

/** Lecture des paramètres d'adresse ; « En attente » par défaut (BP 2026-10-19). */
export function lireVue(params: { get(nom: string): string | null } | null | undefined): { vue: VueMesAthletes; propositions: boolean } {
  const v = params?.get("vue");
  const vue: VueMesAthletes = v === "evaluations" ? "evaluations" : "attente";
  return { vue, propositions: vue === "attente" && params?.get("filtre") === "propositions" };
}

export function adresseVue(vue: VueMesAthletes, propositions = false): string {
  return `${ROUTE_MES_ATHLETES}?vue=${vue}${vue === "attente" && propositions ? "&filtre=propositions" : ""}`;
}

/** Une carte réclamée dont le jeune est encore visible : elle appartient à « Mes évaluations ». */
export function estReclameeVisible(t: Pick<CarteTerminee, "issue" | "profilVisible" | "athleteId">): boolean {
  return t.issue === "RECLAMEE" && t.profilVisible && !!t.athleteId;
}

/** Réclamées visibles qui ne sont pas déjà dans la liste des évaluations (évaluation non transférée). */
export function reclameesHorsListe<T extends Pick<CarteTerminee, "issue" | "profilVisible" | "athleteId">>(
  terminees: readonly T[], dejaListes: ReadonlySet<string>,
): T[] {
  const vus = new Set<string>();
  return terminees.filter((t) => {
    if (!estReclameeVisible(t) || dejaListes.has(t.athleteId!) || vus.has(t.athleteId!)) return false;
    vus.add(t.athleteId!);
    return true;
  });
}

/* ── Bandeau unique « visibilité partenaire » (6.2) ─────────────── */

export const TEXTE_BANDEAU_VISIBILITE =
  "Un athlète qui retire sa visibilité partenaire disparaît de cette liste. Ton évaluation et tes badges ne sont pas effacés.";
const CLE_BANDEAU = "nexus.partenaire.bandeau-visibilite-ferme";

export function bandeauFerme(): boolean {
  try { return window.localStorage.getItem(CLE_BANDEAU) === "1"; } catch { return false; }
}
export function fermerBandeau(): void {
  try { window.localStorage.setItem(CLE_BANDEAU, "1"); } catch { /* stockage indisponible : fermé pour la session seulement */ }
}
