/* Lot E : la fusion et son annulation s'écrivent en PIPELINE_CHANGED (aucun
   type de journal nouveau, pour l'app 1.4.3 qui les lit comme un changement
   d'étape) ; le web les raconte à part. Pur : testé sans React. */

/** La phrase d'Historique d'une ligne de fusion, ou null si ce n'en est pas une.
 *  `etape` : libellé déjà traduit de details.new_stage (vide si aucun). */
export function phraseFusion(details: Record<string, unknown> | null | undefined, etape = ""): string | null {
  const d = details ?? {};
  const fusion = d.fusion as { carte?: string } | undefined;
  if (fusion && typeof fusion === "object") {
    return `a fusionné la carte prospect « ${fusion.carte ?? ""} » avec ce profil${etape ? ` (${etape})` : ""}`;
  }
  const annulee = d.fusion_annulee as { carte?: string; conserves?: unknown } | undefined;
  if (annulee && typeof annulee === "object") {
    const conserves = Array.isArray(annulee.conserves) ? annulee.conserves.filter((c): c is string => typeof c === "string") : [];
    const gardes = conserves.length > 0 ? ` — gardé, car modifié depuis : ${conserves.join(", ")}` : "";
    return `a annulé la fusion de la carte prospect « ${annulee.carte ?? ""} »${gardes}`;
  }
  return null;
}
