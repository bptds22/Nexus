/* ═══════════════════════════════════════════════════════════════
   regleVisite — LA règle qui lie la date de visite (visit_at) à l'étape
   du pipeline. Décision BP du 2026-09-23 ; remplace « visit_at n'est
   porté QUE par VISITE_PLANIFIEE ».

   1. Une visite place l'athlète AU MOINS à « Visite planifiée ». Saisir
      une date sur une étape antérieure fait avancer l'étape ; sur une
      étape postérieure (Engagé, Lettre signée), l'étape ne recule JAMAIS.
   2. La date survit à « Engagé » et « Lettre signée » (une visite après
      l'engagement est normale : visite officielle, signature). Elle n'est
      effacée que si l'étape redescend SOUS « Visite planifiée ».
   3. Effacer la date ne change pas l'étape.

   Fonctions pures, sans Supabase : la page pipeline, la fiche (via
   persistPipelineStage) et le filtre « Visites à venir » les partagent.
   ⚠ Le pipeline MOBILE (useUpdatePipelineStage) applique encore l'ancienne
   règle jusqu'au lot mobile (protocole web-d'abord).
═══════════════════════════════════════════════════════════════ */

/** Rang des étapes, en statut UI (minuscules). `retire` et `none` : 0. */
export const ORDRE_ETAPE: Record<string, number> = {
  identifie: 1,
  contacte: 2,
  en_discussion: 3,
  visite_planifiee: 4,
  engage: 5,
  lettre_signee: 6,
};

const RANG_VISITE = ORDRE_ETAPE.visite_planifiee;

function rang(etape: string): number {
  return ORDRE_ETAPE[etape.toLowerCase()] ?? 0;
}

/** L'étape porte-t-elle une date de visite ? Vrai de « Visite planifiée »
 *  à « Lettre signée ». Accepte minuscules (UI) ou majuscules (base). */
export function etapePorteVisite(etape: string): boolean {
  return rang(etape) >= RANG_VISITE;
}

/** Étape après la saisie d'une date de visite (règle 1) : avance jusqu'à
 *  « visite_planifiee » si besoin, ne recule jamais. Statut UI en sortie. */
export function etapeApresSaisieVisite(etape: string): string {
  return etapePorteVisite(etape) ? etape.toLowerCase() : "visite_planifiee";
}

/** Champ `visit_at` à écrire quand l'étape devient `nouvelle` (règle 2).
 *  - sous « Visite planifiée » → `{ visit_at: null }` (effacée) ;
 *  - à partir de « Visite planifiée », avec une date saisie → cette date ;
 *  - à partir de « Visite planifiée », sans date saisie → `{}` : la colonne
 *    n'est PAS touchée, la date existante survit. */
export function champVisitePourEtape(
  nouvelle: string,
  saisie?: string | null,
): { visit_at?: string | null } {
  if (!etapePorteVisite(nouvelle)) return { visit_at: null };
  if (saisie) return { visit_at: saisie };
  return {};
}

/** Même règle, pour un état local : la date à afficher après le
 *  changement d'étape, connaissant la date actuelle. */
export function visiteApresChangementEtape(
  nouvelle: string,
  saisie: string | null | undefined,
  actuelle: string | null,
): string | null {
  const champ = champVisitePourEtape(nouvelle, saisie);
  return "visit_at" in champ ? (champ.visit_at ?? null) : actuelle;
}
