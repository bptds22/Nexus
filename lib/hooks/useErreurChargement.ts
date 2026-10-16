"use client";

/* ═══════════════════════════════════════════════════════════════
   useErreurChargement — pour les écrans qui chargent dans un effet
   (correctif 2026-10-16, décision BP : plus aucune erreur de chargement
   en silence — un message clair et « Réessayer »).

     const chargement = useErreurChargement();
     useEffect(() => {
       void (async () => {
         try { … } catch (e) { chargement.signaler(e, "coach/ecole"); }
         finally { setLoading(false); }
       })();
     }, [chargement.essai]);                       // « Réessayer » relance l'effet
     …
     {chargement.erreur && <ErreurChargement message={…} onReessayer={chargement.reessayer} />}
═══════════════════════════════════════════════════════════════ */

import { useCallback, useState } from "react";

export function useErreurChargement() {
  const [erreur, setErreur] = useState(false);
  const [essai, setEssai] = useState(0);

  /** Note l'échec (journal + état « en erreur ») ; l'écran affiche le bandeau. */
  const signaler = useCallback((e: unknown, contexte: string) => {
    const message = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
    console.error(`[${contexte}] chargement :`, message);
    setErreur(true);
  }, []);

  /** Efface l'erreur et relance l'effet (mettre `essai` dans ses dépendances). */
  const reessayer = useCallback(() => {
    setErreur(false);
    setEssai((n) => n + 1);
  }, []);

  return { erreur, essai, signaler, reessayer };
}
