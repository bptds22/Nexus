"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { estCleTableauBlanc } from "@/lib/queries/tableauBlanc";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════
   Nexus — QueryProvider
   Wrapper Client Component pour TanStack Query (iter 5.2).

   Defaults choisis pour le contexte Capacitor mobile :
   - staleTime 5min : on évite les refetches inutiles pendant la
     navigation entre tabs (cache instantané la 2e visite)
   - gcTime 30min : on garde les données 30 min après leur dernier
     usage, ce qui couvre une session utilisateur typique sans
     manger de mémoire
   - refetchOnWindowFocus : revalide automatiquement quand l'app
     reprend le foreground (Capacitor déclenche visibilitychange)
   - retry 2 avec backoff exponentiel : couvre les pertes réseau
     mobile passagères
═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   LE BUSTER — le cache persisté ne survit pas à un changement de forme

   Le cache TanStack est réhydraté depuis sessionStorage. Une charge mise en
   boîte par une version PRÉCÉDENTE du code se réhydrate telle quelle dans la
   version d'après : si une ligne a gagné un champ entre-temps, ce champ vaut
   `undefined` sur TOUTES les lignes, et le type ne dit rien — il décrit ce que
   le code écrit, pas ce que le stockage rend.

   C'est exactement ce qui a fait tomber la recherche recruteur le 2026-09-09
   (`organisationOf(undefined)` : la ligne avait gagné `taxonomy`). Les gardes
   posées dans team-taxonomy protègent CE champ-là ; le buster protège le
   MÉCANISME, une fois pour toutes, sans qu'il faille y penser requête par
   requête au prochain champ ajouté.

   L'identifiant entre dans la CLÉ du persister : une clé qui change, c'est un
   stockage vide, pas un stockage à interpréter. `buster` est passé en plus —
   ceinture et bretelles si la clé venait à être réutilisée.

   ⚠️ À BUMPER À CHAQUE RELEASE quand `NEXT_PUBLIC_BUILD_ID` n'est pas fourni
   par l'environnement de build. Le repli constant est le cas normal en dev et
   sur les déploiements qui n'injectent pas la variable.                     */
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "1.4.1";
const CACHE_KEY = `nx-rq-cache-${BUILD_ID}`;

/** Purge les caches des versions précédentes restés dans l'onglet. Sans ça,
 *  chaque changement de forme laisserait sa charge morte derrière lui — sans
 *  danger, mais sessionStorage est petit et une entrée abandonnée peut faire
 *  échouer l'écriture de la suivante. Silencieux : un stockage indisponible
 *  (onglet privé, réglage navigateur) ne doit pas empêcher l'app de démarrer. */
function purgerCachesPerimes() {
  if (typeof window === "undefined") return;
  try {
    const aJeter: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith("nx-rq-cache") && k !== CACHE_KEY) aJeter.push(k);
    }
    aJeter.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* stockage indisponible — rien à purger, rien à signaler */
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  // Persistance du cache en sessionStorage : au reboot WebView (nav MPA en
  // Capacitor), le cache est réhydraté → pas de re-fetch ni de spinner sur les
  // pages déjà visitées dans la session. storage undefined au prerender → le
  // persister est un no-op (aucun accès window côté serveur). sessionStorage
  // (pas localStorage) → repart propre au prochain vrai lancement de l'app.
  const [persister] = useState(() => {
    purgerCachesPerimes();
    return createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
      key: CACHE_KEY,
    });
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 30 * 60 * 1000,
        // Voir l'encadré du BUILD_ID : la clé suffit déjà à repartir vide,
        // `buster` couvre le cas où la même clé reviendrait.
        buster: BUILD_ID,
        // `currentUser` (userId + school_id + role) ne doit JAMAIS être réhydraté
        // depuis sessionStorage : une valeur périmée (ex. school_id d'avant un
        // changement de compte) survivrait à un reload et fausserait tout le
        // scoping (édition « Ma page », RLS storage). On l'EXCLUT de la
        // persistance → toujours re-fetch frais au boot. Les autres queries
        // gardent la persistance (cache instantané en nav MPA). Le reste du
        // filtre reproduit le défaut (persister uniquement les succès).
        // `athlete-blackout` est exclu pour la MÊME raison que `currentUser` :
        // c'est une décision réglementaire, pas un contenu. Réhydratée depuis
        // sessionStorage, une période périmée survivrait jusqu'à 30 min à un
        // reload — l'encart « contact suspendu » disparaîtrait alors que le
        // trigger refuse encore, ou l'inverse. Une règle de ligue se redemande
        // toujours au serveur.
        // Le TABLEAU BLANC (lot B2) non plus : plusieurs recruteurs l'écrivent
        // en même temps, et un F5 servait l'écran d'il y a jusqu'à 30 min
        // (bug du 2026-09-24, lib/queries/tableauBlanc.ts).
        dehydrateOptions: {
          shouldDehydrateQuery: (q) =>
            q.state.status === "success"
            && q.queryKey?.[0] !== "currentUser"
            && q.queryKey?.[0] !== "athlete-blackout"
            && !estCleTableauBlanc(q.queryKey),
        },
      }}
    >
      {children}
      {process.env.NODE_ENV !== "production" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </PersistQueryClientProvider>
  );
}
