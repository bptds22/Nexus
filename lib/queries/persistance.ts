/* ═══════════════════════════════════════════════════════════════
   persistance — ce que le cache TanStack peut mettre en sessionStorage.

   LE PLANTAGE DU 2026-10-18 (iPhone, recruteur ET partenaire) :
   fiche d'un athlète → Recherche → « Application error: a client-side
   exception has occurred ». Le persister sérialise en JSON ; une Map ou
   un Set y devient `{}`. Dans l'appli, ouvrir une fiche recharge la page
   (route dynamique, app/page.tsx) : le cache est réhydraté, et les
   paquets de badges / cotes partenaires (Map, PartenaireCartesProvider)
   reviennent en objets vides, marqués frais pour 5 min. De retour sur la
   Recherche, `for (const [k, v] of m)` sur `{}` lève « not iterable ».

   Règle : une donnée qui contient une Map ou un Set ne se persiste PAS —
   elle se relit au serveur. Vérifiée sur une profondeur bornée (les
   charges sont des tableaux de lignes, une Map n'est jamais plus bas).
═══════════════════════════════════════════════════════════════ */

const PROFONDEUR_MAX = 3;

/** Vrai si `data` survit à JSON.stringify → JSON.parse sans changer de nature. */
export function estPersistable(data: unknown, profondeur = 0): boolean {
  if (data instanceof Map || data instanceof Set) return false;
  if (data === null || typeof data !== "object" || profondeur >= PROFONDEUR_MAX) return true;
  if (Array.isArray(data)) return data.every((v) => estPersistable(v, profondeur + 1));
  for (const v of Object.values(data as Record<string, unknown>)) {
    if (!estPersistable(v, profondeur + 1)) return false;
  }
  return true;
}
