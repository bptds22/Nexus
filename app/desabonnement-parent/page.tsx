/* ═══════════════════════════════════════════════════════════════
   /desabonnement-parent — « Ne plus recevoir ces courriels », pour un
   PARENT (relance visibilité partenaires, 2026-09-29).

   Jumeau de /desabonnement, qui vise un COMPTE (jeton sur user_id). Un parent
   n'a en général pas de compte : le jeton porte l'athlete_id sous un préfixe
   distinct (signerJetonDesabonnementParent) et le registre est tenu par
   empreinte du courriel (parent_courriel_desabonnements).

   Elle CONFIRME, elle n'écrit pas : l'écriture est un POST sur
   /api/desabonnement-parent. Aucune donnée affichée.

   WEB SEULEMENT (HIDE_PATTERNS, mobile-excluded-routes, notFound()).
═══════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import { verifierJetonDesabonnementParent } from "@/lib/courriel/jetonDesabonnement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Désabonnement — Nexus" },
  robots: { index: false, follow: false },
};

const SUPPORT = "info@nexussports.ca";

async function jetonValide(t: string | undefined): Promise<boolean> {
  try {
    return !!(await verifierJetonDesabonnementParent(t, process.env.DESABONNEMENT_SECRET ?? ""));
  } catch {
    return false;
  }
}

export default async function DesabonnementParentPage({
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
          Vous ne recevrez plus ces courriels de Nexus.
        </p>
      </>
    );
  } else if (etat !== "erreur" && (await jetonValide(t))) {
    contenu = (
      <>
        <h1 className="font-head text-[22px] font-bold uppercase tracking-tight text-white">Ne plus recevoir ces courriels</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/60">
          Confirmez, et Nexus ne vous écrira plus à ce sujet.
        </p>
        <form method="post" action="/api/desabonnement-parent" className="mt-6">
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
          Écrivez-nous à{" "}
          <a href={`mailto:${SUPPORT}?subject=D%C3%A9sabonnement`} className="text-[#E63946] underline underline-offset-2">
            {SUPPORT}
          </a>{" "}
          et nous vous retirerons de la liste.
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
