/**
 * Pagination au-delà du plafond de lignes de PostgREST.
 *
 * PostgREST tronque toute requête à sa limite `db-max-rows` (1000 chez
 * nous) SANS erreur : on reçoit 1000 lignes et un succès. Un select de
 * table entière sur une table plus grande rend donc un résultat partiel
 * qui a l'air complet — c'est ce qui faisait disparaître 199 des 1199
 * établissements, et avec eux le rattachement d'entraîneurs pourtant
 * valides.
 *
 * Promu depuis app/admin/schools/page.tsx, où il vivait en local. Même
 * implémentation, même contrat : on boucle sur `.range(from, to)`
 * jusqu'à recevoir une page incomplète.
 *
 * QUAND L'UTILISER — seulement s'il faut VRAIMENT toute la table :
 * liste de sélection, agrégat, recherche côté client. Pour afficher
 * l'établissement d'une ligne, préférer une JOINTURE
 * (`schools!school_id(name,type)`) : c'est une requête au lieu de deux
 * et rien à tronquer. Voir lib/config/schoolTypes.ts.
 *
 * @param build   construit la requête pour une tranche donnée
 * @param label   préfixe de log, pour situer l'appelant en cas d'erreur
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  label = "fetchAllRows",
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) { console.error(`[${label}]`, error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}
