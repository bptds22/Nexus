// lib/cibles/visibiliteBouton.ts
//
// Qui VOIT le bouton « Ajouter à mes cibles » (pages école et équipe, web et
// appli). Seul un athlète peut cibler (RLS « Athletes manage own targets ») ;
// pour les autres le bouton est un no-op. Un PARTENAIRE ne doit pas le voir :
// le portail partenaire monte ces pages (barre partenaire sur /college depuis
// la 1.4.5) et un appel « Montre ton intérêt » n'y a aucun sens.
// Visiteur déconnecté et autres rôles : inchangé (le bouton reste affiché).
//
// `resolu` : tant que la session n'est pas lue, on ne montre rien — sinon un
// partenaire verrait le bouton le temps de la requête.

export function boutonCiblesVisible(resolu: boolean, role: string | null): boolean {
  if (!resolu) return false;
  return role !== "PARTNER";
}
