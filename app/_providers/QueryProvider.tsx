"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
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
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
      key: "nx-rq-cache",
    }),
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 30 * 60 * 1000,
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
        dehydrateOptions: {
          shouldDehydrateQuery: (q) =>
            q.state.status === "success"
            && q.queryKey?.[0] !== "currentUser"
            && q.queryKey?.[0] !== "athlete-blackout",
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
