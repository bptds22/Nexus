/* ═══════════════════════════════════════════════════════════════
   « + Créer » depuis la page d'une équipe (C4, 1.4.5) : la création
   d'athlète s'ouvre avec CETTE équipe déjà choisie. Avant, le lien menait
   à un formulaire vierge et l'athlète créé n'était pas dans l'équipe.

   Passage par sessionStorage (même patron que le reste de l'appli : pas de
   paramètre d'URL sur les routes exportées de Capacitor). Lu une seule fois.
═══════════════════════════════════════════════════════════════ */

const CLE = "nexus.creation.equipe";

export function poserEquipeACreer(teamId: string): void {
  try { sessionStorage.setItem(CLE, teamId); } catch { /* stockage indisponible : formulaire vierge */ }
}

/** L'équipe à présélectionner, si elle fait partie des équipes du coach (alors consommée).
 *  Équipes pas encore chargées (liste vide) : on garde la demande pour le prochain appel. */
export function prendreEquipeACreer(idsEquipes: readonly string[]): string | null {
  if (idsEquipes.length === 0) return null;
  let id: string | null = null;
  try { id = sessionStorage.getItem(CLE); } catch { return null; }
  if (!id) return null;
  try { sessionStorage.removeItem(CLE); } catch { /* sans effet */ }
  return idsEquipes.includes(id) ? id : null;
}
