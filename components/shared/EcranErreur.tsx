"use client";

/* ═══════════════════════════════════════════════════════════════
   EcranErreur — le filet de sécurité (BP 2026-10-18).

   Plus jamais d'écran noir « Application error: a client-side exception
   has occurred » : app/error.tsx (sous la mise en page racine) et
   app/global-error.tsx (si la mise en page elle-même tombe) rendent cet
   écran, web et appli. Styles EN LIGNE : global-error remplace la mise en
   page racine, la feuille globale n'y est pas garantie.
═══════════════════════════════════════════════════════════════ */

import { useEffect } from "react";

export const TITRE_ERREUR = "Oups, cet écran a planté";
export const TEXTE_ERREUR = "Une erreur inattendue est survenue. Recharge l'appli pour reprendre ; tes données ne sont pas perdues.";

/** Journalise l'erreur dans la console, une fois par erreur. */
export function useJournalErreur(error: Error & { digest?: string }, ou: string) {
  useEffect(() => {
    console.error(`[nexus] erreur client (${ou})`, error?.message ?? error, error?.digest ?? "", error?.stack ?? "");
  }, [error, ou]);
}

export function recharger() {
  if (typeof window !== "undefined") window.location.reload();
}

export default function EcranErreur({ onReessayer }: { onReessayer?: () => void }) {
  return (
    <div
      role="alert"
      style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "calc(env(safe-area-inset-top) + 24px) 20px calc(env(safe-area-inset-bottom) + 24px)",
        background: "#111317", color: "#FFFFFF", fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 380, width: "100%", textAlign: "center", background: "#1A1D24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24 }}>
        <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{TITRE_ERREUR}</p>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.65)", margin: "10px 0 20px" }}>{TEXTE_ERREUR}</p>
        <button
          type="button"
          onClick={recharger}
          style={{ width: "100%", minHeight: 48, borderRadius: 12, border: "none", background: "#E63946", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >
          Recharger
        </button>
        {onReessayer && (
          <button
            type="button"
            onClick={onReessayer}
            style={{ width: "100%", minHeight: 44, marginTop: 8, borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Réessayer sans recharger
          </button>
        )}
      </div>
    </div>
  );
}
