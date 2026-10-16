"use client";

/* ═══════════════════════════════════════════════════════════════
   PageChargee — rendu CLIENT d'une page du portail qui était un
   composant serveur (1.4.5, B1 : le portail entre dans l'appli).

   Un export statique (l'appli) refuse un composant serveur qui lit
   searchParams ou les cookies. Le corps de chaque page est resté tel
   quel, devenu une fonction `rendre(params)` : mêmes requêtes, mêmes
   filtres d'URL, avec le client navigateur — donc la MÊME identité et
   la même RLS que le client serveur, qui lisait la session des cookies.
   Elle est relancée à chaque changement de l'URL (filtres en <Link>
   ou poussés par router), comme une navigation serveur l'était.
═══════════════════════════════════════════════════════════════ */

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export type ParamsUrl = Record<string, string | undefined>;

function Chargeur({ rendre }: { rendre: (params: ParamsUrl) => Promise<ReactNode> }) {
  const searchParams = useSearchParams();
  const cle = searchParams?.toString() ?? "";
  const [vue, setVue] = useState<ReactNode | null>(null);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    let vivant = true;
    const params = Object.fromEntries(new URLSearchParams(cle)) as ParamsUrl;
    rendre(params)
      .then((v) => { if (vivant) { setVue(v); setEchec(false); } })
      .catch((e: unknown) => {
        console.error(`[partenaire] chargement : ${(e as { message?: string } | null)?.message ?? String(e)}`);
        if (vivant) setEchec(true);
      });
    return () => { vivant = false; };
  }, [cle, rendre]);

  if (echec && vue === null) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[800px] mx-auto">
        <p role="alert" className="text-[13px] text-[#EF4444]">Le chargement a échoué. Réessaie dans un instant.</p>
      </div>
    );
  }
  if (vue === null) {
    return (
      <div className="flex items-center justify-center py-24" aria-busy="true">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{vue}</>;
}

/** `rendre` doit être une fonction de module (stable) : elle est une dépendance de l'effet. */
export default function PageChargee({ rendre }: { rendre: (params: ParamsUrl) => Promise<ReactNode> }) {
  return (
    <Suspense fallback={null}>
      <Chargeur rendre={rendre} />
    </Suspense>
  );
}
