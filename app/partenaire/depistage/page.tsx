"use client";

/* /partenaire/depistage — le Dépistage du PARTENAIRE (BP 2026-10-19) : le même mode match que le
   recruteur, ses notes liées à SES cartes « En attente ». Réservé au partenaire qui peut évaluer
   (même règle que Mes athlètes) ; la base refuse d'elle-même les autres. Entrées : le menu Plus
   de l'appli, la barre latérale web, et « Dépister ce match » sur la carte des matchs. */

import { Suspense } from "react";
import Link from "next/link";
import GameOn from "@/components/game-on/GameOn";
import { usePeutEvaluer } from "@/lib/partenaires/navigation";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function DepistagePartenairePage() {
  const peut = usePeutEvaluer();
  if (peut === null) return <div className="min-h-[40vh]" />;
  if (!peut) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <p className="text-[17px] font-bold text-white">Le mode En direct est offert aux partenaires qui évaluent.</p>
        <p className="mt-2 text-[14px] text-[#9CA3AF]">Écris à Nexus pour l&apos;activer sur ton compte.</p>
        <Link href="/partenaire" className="mt-6 inline-block text-[14px] font-bold text-[#E63946]">Retour à l&apos;accueil</Link>
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <GameOn mobile={IS_CAPACITOR} mode="partenaire" />
    </Suspense>
  );
}
