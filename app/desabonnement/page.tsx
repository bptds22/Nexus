/* ═══════════════════════════════════════════════════════════════
   /desabonnement — la page du lien « Ne plus recevoir ces courriels ».

   Elle CONFIRME, elle n'écrit pas : l'écriture passe par un POST sur
   /api/desabonnement (voir la route pour le pourquoi — les passerelles de
   sécurité ouvrent les liens des courriels, un GET qui écrit désabonnerait
   des gens qui n'ont rien demandé).

   Trois états :
     ?t=<jeton valide>   → un bouton « Me désabonner »
     ?etat=ok            → c'est fait
     jeton absent/faux   → lien non valide, et une adresse pour écrire

   AUCUNE donnée affichée sur le compte : ni prénom, ni adresse. Un lien
   transféré ne doit rien apprendre à qui le reçoit.

   WEB SEULEMENT : searchParams rend la page dynamique, incompatible avec
   l'export Capacitor. Masquée par HIDE_PATTERNS (scripts/build-mobile.mjs),
   listée dans lib/build/mobile-excluded-routes.ts, gardée par notFound().
═══════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import { verifierJetonDesabonnement } from "@/lib/courriel/jetonDesabonnement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Désabonnement — Nexus" },
  robots: { index: false, follow: false },
};

const SUPPORT = "info@nexussports.ca";

async function jetonValide(t: string | undefined): Promise<boolean> {
  try {
    return !!(await verifierJetonDesabonnement(t, process.env.DESABONNEMENT_SECRET ?? ""));
  } catch {
    return false;
  }
}

export default async function DesabonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; etat?: string }>;
}) {
  if (process.env.CAPACITOR_BUILD === "true") notFound();
  const { t, etat } = await searchParams;

  let contenu: React.ReactNode;
  if (etat === "ok") {
    contenu = (
      <>
        <h1 className="font-head text-[22px] font-bold uppercase tracking-tight text-white">C&apos;est fait</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/60">
          Tu ne recevras plus ces courriels de Nexus. Les messages liés à ton compte
          (sécurité, mot de passe) continueront de t&apos;arriver.
        </p>
      </>
    );
  } else if (etat !== "erreur" && (await jetonValide(t))) {
    contenu = (
      <>
        <h1 className="font-head text-[22px] font-bold uppercase tracking-tight text-white">Ne plus recevoir ces courriels</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/60">
          Confirme, et Nexus ne t&apos;enverra plus de relances ni de nouvelles par courriel.
        </p>
        <form method="post" action="/api/desabonnement" className="mt-6">
          <input type="hidden" name="t" value={t} />
          <button
            type="submit"
            className="w-full rounded-2xl bg-[#E63946] px-4 py-4 font-head text-[13px] font-bold uppercase tracking-widest text-white"
          >
            Me désabonner
          </button>
        </form>
      </>
    );
  } else {
    contenu = (
      <>
        <h1 className="font-head text-[22px] font-bold uppercase tracking-tight text-white">
          {etat === "erreur" ? "Un problème est survenu" : "Ce lien n'est pas valide"}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/60">
          Écris-nous à{" "}
          <a href={`mailto:${SUPPORT}?subject=D%C3%A9sabonnement`} className="text-[#E63946] underline underline-offset-2">
            {SUPPORT}
          </a>{" "}
          et nous te retirerons de la liste.
        </p>
      </>
    );
  }

  return (
    <main className="min-h-screen bg-[#111317] px-5 py-10 flex flex-col items-center">
      <NexusLogo variant="white" height={32} priority />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-6 text-center">
        {contenu}
      </div>
    </main>
  );
}
