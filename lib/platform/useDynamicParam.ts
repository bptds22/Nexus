"use client";

import { useParams } from 'next/navigation';
import { SESSION_KEY_PREFIX } from './mobileRoutes';

/**
 * Lit un param de route dynamique. En mobile (Capacitor static export),
 * useParams() retourne 'placeholder' parce que la page est le shell
 * pré-généré. Dans ce cas, on récupère le vrai id depuis sessionStorage
 * (déposé par app/page.tsx lors de la redirection fallback).
 *
 * Sur le web, useParams() retourne directement le vrai id → no-op.
 */
export function useDynamicParam(key: string): string {
  const params = useParams<Record<string, string>>();
  const raw = params?.[key] ?? '';

  if (raw === 'placeholder' && typeof window !== 'undefined') {
    const stashed = sessionStorage.getItem(`${SESSION_KEY_PREFIX}${key}`);
    if (stashed) {
      return stashed;
    }
  }
  return raw;
}
