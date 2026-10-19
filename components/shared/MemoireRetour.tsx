"use client";

/* Note la page visitée (hors fiche d'athlète) pour la flèche de retour des fiches :
   lib/navigation/retourFiche. Rien à l'écran. */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { noterPage } from "@/lib/navigation/retourFiche";

export default function MemoireRetour() {
  const chemin = usePathname();
  useEffect(() => {
    if (typeof window === "undefined") return;
    noterPage(window.location.pathname + window.location.search);
  }, [chemin]);
  return null;
}
