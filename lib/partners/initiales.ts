/* ═══════════════════════════════════════════════════════════════
   Initiales d'une organisation — repli quand aucune image n'existe.

   Pourquoi une fonction partagée plutôt qu'un `slice(0, 2)` sur place :
   la barre latérale du portail partenaire faisait exactement ça, et
   « L'Esprit Sportif » y rendait « L' » — apostrophe comprise.

   Deux règles, dans cet ordre :
     1. l'élision française initiale est retirée  (« L'Esprit » → « Esprit »)
     2. la ponctuation de tête est retirée        (« (Nexus) » → « Nexus »)

   La première n'est pas une coquetterie : c'est elle qui fait tomber
   « L'Esprit Sportif » sur « ES », le mot-symbole réel du partenaire.
   Sans elle on obtiendrait « LS », qui ne correspond à rien.
═══════════════════════════════════════════════════════════════ */

/** l’, d’, n’, m’, t’, s’, j’, c’ — avec apostrophe droite ou typographique. */
const ELISION = /^[a-z]['’]/i;

export function initialesOrganisation(nom: string | null | undefined): string {
  if (!nom) return "?";
  const mots = nom
    .trim()
    .split(/\s+/)
    .map((m) => m.replace(ELISION, ""))
    .map((m) => m.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);

  const initiales = mots
    .slice(0, 2)
    .map((m) => [...m][0].toUpperCase())
    .join("");

  return initiales || "?";
}
