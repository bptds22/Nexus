/* ═══════════════════════════════════════════════════════════════
   detecterCegep — le texte « Mon école n'est pas listée » désigne-t-il
   un cégep ? (paquet A de la 1.4.4, décision BP 2026-10-02)

   Nexus s'adresse au secondaire ; le chantier cégep n'est PAS dans la
   1.4.4 (registre §68). L'athlète de cégep qui ne trouve pas son école
   l'écrit en clair — ce module le reconnaît pour :
     · lui dire honnêtement, à l'onboarding, ce qui se passera ;
     · signaler la ligne dans la carte « Écoles non listées » de l'admin.
   Il ne bloque RIEN : l'inscription continue comme avant.

   LA RÈGLE, et pourquoi elle n'est pas plus large :
     1. un mot qui ne désigne QUE le collégial (« cégep », « collégial »,
        « DEC ») suffit ;
     2. « collège » / « college » / « campus » NE suffit PAS : quantité
        d'écoles SECONDAIRES privées s'appellent « Collège … »
        (Collège Notre-Dame, Collège Jean-Eudes…). Il faut alors qu'un
        nom de cégep connu (schools type CEGEP) s'y retrouve aussi ;
     3. un nom de ville seul ne suffit jamais : « Polyvalente de
        Sherbrooke » ne doit pas passer pour le Cégep de Sherbrooke.
   Fonction PURE : les noms de cégeps sont passés par l'appelant.
═══════════════════════════════════════════════════════════════ */

/** Minuscules, sans accents, ponctuation → espace, espaces réduits. */
export function normaliserNomEcole(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mots qui ne désignent que l'ordre collégial. */
const MOTS_COLLEGIAL = new Set(["cegep", "cegeps", "collegial", "collegiale", "collegiales", "dec"]);

/** Mots qui accompagnent un nom de cégep sans le désigner seuls. */
const MOTS_ETABLISSEMENT = new Set(["college", "campus"]);

/** Mots génériques retirés d'un nom de cégep avant comparaison. */
const MOTS_GENERIQUES = new Set([
  ...MOTS_COLLEGIAL, ...MOTS_ETABLISSEMENT,
  "de", "du", "des", "la", "le", "les", "l", "d", "et", "a", "au", "aux",
  "the", "of", "centre", "etudes", "regional", "prive", "international",
]);

function mots(texte: string): string[] {
  const n = normaliserNomEcole(texte);
  return n ? n.split(" ") : [];
}

/** Mots significatifs d'un nom de cégep (« Cégep de Sainte-Foy » → sainte, foy). */
function motsSignificatifs(nom: string): string[] {
  return mots(nom).filter((m) => !MOTS_GENERIQUES.has(m));
}

/** Vrai si le texte saisi désigne vraisemblablement un cégep. */
export function ressembleACegep(texte: string, nomsCegeps: readonly string[] = []): boolean {
  const ms = mots(texte);
  if (ms.length === 0) return false;
  if (ms.some((m) => MOTS_COLLEGIAL.has(m))) return true;
  if (!ms.some((m) => MOTS_ETABLISSEMENT.has(m))) return false;
  const presents = new Set(ms);
  return nomsCegeps.some((nom) => {
    const sig = motsSignificatifs(nom);
    return sig.length > 0 && sig.every((m) => presents.has(m));
  });
}
