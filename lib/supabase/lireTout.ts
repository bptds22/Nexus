/* ═══════════════════════════════════════════════════════════════
   lireTout — lire TOUTES les lignes d'une requête PostgREST, jamais
   « les 1000 premières » (correctif 2026-10-16, décision BP : aucun
   plafond, aucune erreur en silence).

   PostgREST coupe chaque réponse à max-rows (1000) SANS le dire. Ce
   module demande le total exact à la première page, puis lit les pages
   suivantes jusqu'à l'avoir en entier. Une erreur, ou une page vide avant
   le total, est LEVÉE : jamais une liste tronquée rendue comme complète.

   Le TRI doit être déterministe (une clé unique, ex. .order("id")) : chaque
   page est une requête à part. Sur le résultat d'une FONCTION (.rpc), PostgREST
   n'accepte de trier que sur une colonne SÉLECTIONNÉE : select("team_id")
   .order("id") est refusé (« column … id does not exist ») — sélectionner id.

   Avec les fonctions « par identifiants » (migration 20261016080000) :
   les identifiants voyagent dans le corps de l'appel, plus dans l'adresse.
     lireTout((de, a) => supabase
       .rpc("athletes_par_ids", { p_ids: ids }, { count: "exact" })
       .select("id, first_name, sports!sport_id(nom)")
       .order("id").range(de, a))
═══════════════════════════════════════════════════════════════ */

/** Le résultat d'une page : celui d'une requête supabase-js (table ou
 *  fonction ; pour une fonction, supabase-js type `data` en ligne OU
 *  tableau — on vérifie le tableau à l'exécution). */
export interface PageResultat {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}

function lignesDe<T>(r: PageResultat): T[] {
  if (r.data == null) return [];
  if (!Array.isArray(r.data)) throw new Error("lireTout : réponse inattendue (pas une liste de lignes)");
  return r.data as T[];
}

/** Taille d'une page : max-rows de PostgREST (supabase/config.toml). */
export const TAILLE_PAGE = 1000;

/**
 * Lit toutes les pages. `page(de, a)` construit la requête de la page
 * [de, a] — avec `{ count: "exact" }` et un tri sur une clé unique.
 */
export async function lireTout<T>(
  page: (de: number, a: number) => PromiseLike<PageResultat>,
  taille = TAILLE_PAGE,
): Promise<T[]> {
  const premiere = await page(0, taille - 1);
  if (premiere.error) throw premiere.error;
  const lignes = [...lignesDe<T>(premiere)];
  const total = premiere.count;
  if (typeof total !== "number") {
    // Sans total, impossible de savoir si la réponse est complète : on refuse
    // plutôt que de rendre peut-être « les 1000 premières ».
    throw new Error("lireTout : total absent (la requête doit demander { count: \"exact\" })");
  }
  while (lignes.length < total) {
    const de = lignes.length;
    const suite = await page(de, de + taille - 1);
    if (suite.error) throw suite.error;
    const recues = lignesDe<T>(suite);
    if (recues.length === 0) {
      throw new Error(`lireTout : ${lignes.length} lignes lues sur ${total} annoncées`);
    }
    lignes.push(...recues);
  }
  return lignes;
}

/** Une liste d'identifiants sans doublon ni vide (corps des fonctions « par identifiants »). */
export function idsUniques(ids: Iterable<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const id of ids) if (id) out.add(id);
  return [...out];
}
