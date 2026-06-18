/**
 * Routing dynamique mobile (Capacitor static export).
 *
 * En output:'export', les routes [id] n'ont qu'un shell "placeholder"
 * pré-généré. Naviguer vers /segment/<uuid> échoue (pas de fichier RSC).
 * Solution : rediriger vers le shell placeholder + stocker le vrai id
 * dans sessionStorage, que le PageClient relit via useDynamicParam.
 */

interface DynamicRoute {
  // Regex qui matche le pathname et capture le ou les params dynamiques
  pattern: RegExp;
  // Nom du param dynamique (id, teamId, coachId)
  paramKey: string;
  // Fonction qui construit le path du shell placeholder à partir du match
  toPlaceholder: (match: RegExpMatchArray) => string;
}

// IMPORTANT : ordre des routes — les plus spécifiques (sous-routes comme
// /apercu, /modifier) AVANT les routes parentes, sinon la route parente
// matche en premier.
const DYNAMIC_ROUTES: DynamicRoute[] = [
  // coach/athletes/[id]/apercu
  {
    pattern: /^\/coach\/athletes\/([^/]+)\/apercu\/?$/,
    paramKey: 'id',
    toPlaceholder: () => '/coach/athletes/placeholder/apercu/',
  },
  // coach/athletes/[id]/modifier
  {
    pattern: /^\/coach\/athletes\/([^/]+)\/modifier\/?$/,
    paramKey: 'id',
    toPlaceholder: () => '/coach/athletes/placeholder/modifier/',
  },
  // coach/athletes/[id]
  {
    pattern: /^\/coach\/athletes\/([^/]+)\/?$/,
    paramKey: 'id',
    toPlaceholder: () => '/coach/athletes/placeholder/',
  },
  // coach/demandes/[id]
  {
    pattern: /^\/coach\/demandes\/([^/]+)\/?$/,
    paramKey: 'id',
    toPlaceholder: () => '/coach/demandes/placeholder/',
  },
  // coach/equipes/[teamId]
  {
    pattern: /^\/coach\/equipes\/([^/]+)\/?$/,
    paramKey: 'teamId',
    toPlaceholder: () => '/coach/equipes/placeholder/',
  },
  // coach/ecole/coachs/[coachId]
  {
    pattern: /^\/coach\/ecole\/coachs\/([^/]+)\/?$/,
    paramKey: 'coachId',
    toPlaceholder: () => '/coach/ecole/coachs/placeholder/',
  },
  // recruteur/athletes/[id]
  {
    pattern: /^\/recruteur\/athletes\/([^/]+)\/?$/,
    paramKey: 'id',
    toPlaceholder: () => '/recruteur/athletes/placeholder/',
  },
  // recruteur/messages/[id]
  {
    pattern: /^\/recruteur\/messages\/([^/]+)\/?$/,
    paramKey: 'id',
    toPlaceholder: () => '/recruteur/messages/placeholder/',
  },
  // recruteur/cegep/entraineurs/[id]
  {
    pattern: /^\/recruteur\/cegep\/entraineurs\/([^/]+)\/?$/,
    paramKey: 'id',
    toPlaceholder: () => '/recruteur/cegep/entraineurs/placeholder/',
  },
  // recruteur/listes/[id] (iter 7.19 — manquait au Sprint 2, cause du "retour login")
  {
    pattern: /^\/recruteur\/listes\/([^/]+)\/?$/,
    paramKey: 'id',
    toPlaceholder: () => '/recruteur/listes/placeholder/',
  },
];

export interface MatchedDynamicRoute {
  paramKey: string;
  realId: string;
  placeholderPath: string;
}

/**
 * Si le pathname correspond à une route [id] dynamique, retourne les infos
 * nécessaires pour rediriger vers le shell placeholder. Sinon null.
 * Ignore les pathnames qui contiennent déjà 'placeholder' (évite les boucles).
 */
export function matchDynamicRoute(pathname: string): MatchedDynamicRoute | null {
  if (pathname.includes('/placeholder')) return null;

  for (const route of DYNAMIC_ROUTES) {
    const match = pathname.match(route.pattern);
    if (match) {
      const realId = match[1];
      // Ne pas matcher si l'id capturé est vide ou déjà 'placeholder'
      if (!realId || realId === 'placeholder') continue;
      return {
        paramKey: route.paramKey,
        realId,
        placeholderPath: route.toPlaceholder(match),
      };
    }
  }
  return null;
}

export const SESSION_KEY_PREFIX = '__cap_dyn_';
