import { createClient } from "@/lib/supabase/client";
import type { SchoolType } from "@/lib/utils/orgLabel";

/* ─────────────────────────────────────────────────────────────────
   allSchools — chargement complet de `schools`, paginé et mis en cache.

   IMPLÉMENTATION UNIQUE, web + mobile. Elle vivait en privé dans
   components/ui/SchoolSelect.tsx ; le sheet mobile de MonEquipeSection
   avait donc réécrit sa propre requête — SANS `.range()`. PostgREST
   plafonne à 1000 lignes par défaut et `schools` en compte 1199 : tout
   ce qui suit le rang alphabétique 1000 devenait invisible (le club
   « Wildcats Laurentides-Lanaudière », rang 1198, était introuvable
   dans le sheet alors qu'il existe bien en base).

   Toute nouvelle surface qui liste les organisations DOIT passer par
   `loadSchools()` — ne pas rouvrir une requête `.from("schools")` à la
   main, c'est exactement comme ça que la troncature est revenue.
───────────────────────────────────────────────────────────────── */

/** Une organisation de la table `schools`.
 *
 *  ⚠ `type` porte le type CANONIQUE à trois valeurs (lib/utils/orgLabel).
 *  L'ancienne déclaration locale de SchoolSelect annonçait
 *  `"SECONDAIRE" | "CEGEP"` alors que la requête ne filtre PAS `type` et
 *  ramène donc aussi les clubs civils : le type mentait. Ne pas le
 *  rétrécir — le non-filtrage est délibéré (le transfert athlète et
 *  l'onboarding civil ont besoin des LIGUE_CIVILE). */
export interface SchoolRow {
  id: string;
  name: string;
  city: string | null;
  type: SchoolType;
}

/** Cache au niveau module : toutes les instances partagent un seul fetch. */
let _schoolsCache: SchoolRow[] | null = null;
let _schoolsPromise: Promise<SchoolRow[]> | null = null;

/** Pagination au-delà du plafond de 1000 lignes de PostgREST (même patron
 *  que /admin/schools). Sans elle, seules les 1000 premières par nom
 *  remontent — silencieusement, sans erreur ni indice côté client. */
async function fetchAllSchools(): Promise<SchoolRow[]> {
  const supabase = createClient();
  const PAGE = 1000;
  const all: SchoolRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("schools")
      .select("id,name,city,type")
      .order("name")
      .range(from, from + PAGE - 1);
    if (error) { console.error("[allSchools] fetchAllSchools", error); break; }
    if (!data || data.length === 0) break;
    all.push(...(data as SchoolRow[]));
    if (data.length < PAGE) break;
  }
  return all.filter((s) => s.id && s.name);
}

/** Toutes les organisations, tous types confondus. Résultat mémoïsé ;
 *  les appels concurrents partagent la même promesse en vol. */
export function loadSchools(): Promise<SchoolRow[]> {
  if (_schoolsCache) return Promise.resolve(_schoolsCache);
  if (_schoolsPromise) return _schoolsPromise;
  _schoolsPromise = fetchAllSchools().then((rows) => {
    _schoolsCache = rows;
    return _schoolsCache;
  });
  return _schoolsPromise;
}
