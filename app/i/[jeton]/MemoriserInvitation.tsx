"use client";

import { useEffect } from "react";
import { memoriserInvitation } from "@/lib/ambassadeur/invitation";

/** Mémorise le jeton d'un lien RÉSOLU comme valide (voir la page). Rien ne
 *  s'affiche : le jeton ne doit jamais apparaître à l'écran. */
export default function MemoriserInvitation({ jeton }: { jeton: string }) {
  useEffect(() => { memoriserInvitation(jeton); }, [jeton]);
  return null;
}
