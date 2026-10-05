/* ═══════════════════════════════════════════════════════════════
   triDecouverte — l'ordre par défaut de la recherche recruteur.

   Un mélange STABLE pour la journée, propre à chaque recruteur : la graine
   combine son id et la date du jour. Donc : fige pendant toute la session
   (filtrer, revenir d'une fiche, scroller ne rebrasse rien), change chaque
   jour, et deux recruteurs qui regardent la même liste aujourd'hui la voient
   dans un ordre différent. Purement client — aucune migration, aucun appel
   réseau : web et mobile l'appellent identiquement sur le jeu déjà chargé.
═══════════════════════════════════════════════════════════════ */

/** Hash déterministe (FNV-1a, 32 bits) d'une chaîne — pas cryptographique,
 *  juste un point de départ stable pour le PRNG ci-dessous. */
function hashChaine(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG déterministe (mulberry32) : même graine → même suite, toujours. */
function mulberry32(graine: number): () => number {
  let a = graine;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** AAAA-MM-JJ en heure LOCALE (pas UTC) : la journée du recruteur, pas celle
 *  du serveur — un recruteur sur la côte ouest ne doit pas rebrasser à 21h. */
function dateDuJour(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const jj = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${jj}`;
}

/** La graine du jour pour ce recruteur — exposée pour les tests. */
export function graineDecouverte(recruiterId: string, jour = dateDuJour()): number {
  return hashChaine(`${recruiterId}:${jour}`);
}

/** Fisher-Yates avec un PRNG déterministe : même graine → même permutation.
 *  Ne mute pas `liste`. */
export function melangeDeterministe<T>(liste: readonly T[], graine: number): T[] {
  const copie = [...liste];
  const alea = mulberry32(graine);
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/** Le tri "Découverte" : mélange stable du jour, propre au recruteur. */
export function trierDecouverte<T>(liste: readonly T[], recruiterId: string): T[] {
  return melangeDeterministe(liste, graineDecouverte(recruiterId));
}
