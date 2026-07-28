"use client";

import { useParams, useSearchParams } from 'next/navigation';
import { SESSION_KEY_PREFIX } from './mobileRoutes';

/**
 * Lit un param de route dynamique.
 *
 * STRATÉGIE A — query-param (2026-07, décidée BP) : un `?<key>=<uuid>` a la
 * PRIORITÉ. Les routes messagerie/annonces passent en `/route?id=<uuid>`
 * (aucun segment dynamique) → le static export résout toujours le shell, et
 * ce hook lit le vrai id depuis la query string, réactif à la navigation.
 * NEXUS-QP-ROUTING (signature de custody du nouveau routing).
 *
 * Fallbacks historiques (routes [id] encore en place) :
 * - Mobile : useParams() = 'placeholder' → on relit depuis sessionStorage
 *   (déposé par app/page.tsx via matchDynamicRoute).
 * - Web : useParams() retourne directement le vrai id.
 */
export function useDynamicParam(key: string): string {
  const searchParams = useSearchParams();
  const params = useParams<Record<string, string>>();

  // Query-param d'abord (Stratégie A).
  const fromQuery = searchParams?.get(key);
  if (fromQuery) return fromQuery;

  const raw = params?.[key] ?? '';
  if (raw === 'placeholder' && typeof window !== 'undefined') {
    const stashed = sessionStorage.getItem(`${SESSION_KEY_PREFIX}${key}`);
    if (stashed) {
      return stashed;
    }
  }
  return raw;
}
