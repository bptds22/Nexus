"use client";

/* ═══════════════════════════════════════════════════════════════
   BandeauCartesPartenaires — rappel en haut de l'espace athlète (W4c, web).

   - une carte confirmée attend la visibilité partenaire → rappel avec
     l'échéance (après, la carte s'efface et rien n'est transféré) ;
   - une carte attend une réponse (lien ouvert, ou proposée par Nexus) →
     invitation à répondre.
   Rien s'il n'y a rien. Masqué sur la page de réponse elle-même.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { chargerCartesJeune, type CarteJeune } from "@/lib/partenaires/prospects";

export const PAGE_CARTES_PARTENAIRES = "/athlete/cartes-partenaires";

export default function BandeauCartesPartenaires() {
  const pathname = usePathname();
  const [cartes, setCartes] = useState<CarteJeune[]>([]);

  useEffect(() => {
    chargerCartesJeune(createClient())
      .then(setCartes)
      .catch((e) => console.warn("[cartes partenaires] bandeau :", e?.message ?? e));
  }, [pathname]);

  if ((pathname.replace(/\/+$/, "") || "/") === PAGE_CARTES_PARTENAIRES || cartes.length === 0) return null;

  const attente = cartes.filter((c) => c.statut === "CONFIRMEE_ATTENTE_OPTIN");
  const premiere = attente[0] ?? cartes[0];
  const partenaire = premiere.partenaire ?? "Un partenaire";
  const echeance = new Date(premiere.expireLe).toLocaleDateString("fr-CA", { day: "numeric", month: "long" });

  return (
    <div className="relative z-20 mx-4 sm:mx-8 mt-4 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4" data-bandeau-cartes-partenaires>
      <p className="flex-1 text-[13px] text-[#F5C46B]">
        {attente.length > 0
          ? <>Une étape avant de recevoir l&apos;évaluation de <strong className="text-white">{partenaire}</strong> : active la visibilité partenaire avant le {echeance}.</>
          : <><strong className="text-white">{partenaire}</strong> t&apos;a évalué. Dis-nous si c&apos;est bien toi.</>}
      </p>
      <Link href={PAGE_CARTES_PARTENAIRES} className="shrink-0 px-4 py-2 bg-[#F59E0B] hover:bg-[#E08E06] text-[#111317] text-[12px] font-bold rounded-lg text-center">
        {attente.length > 0 ? "Terminer" : "Répondre"}
      </Link>
    </div>
  );
}
