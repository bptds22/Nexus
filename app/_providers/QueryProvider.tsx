"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV !== "production" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
