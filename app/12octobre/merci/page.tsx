"use client";

/* /12octobre/merci — après une demande d'accès à l'enregistrement : le lien
   personnel est parti par courriel (il n'est jamais affiché ici) ; rappel
   du 1:1 s'il a été demandé. */

import { Suspense } from "react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import PlaybookBackground from "../../components/PlaybookBackground";
import { DEMO_12_OCTOBRE as D } from "@/lib/demo/demo12Octobre";

function Contenu() {
  const unAUn = useSearchParams().get("un_a_un") === "1";

  return (
    <div className="max-w-2xl mx-auto nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-6 sm:p-10 font-sans text-[15px] text-[#D1D5DB] leading-relaxed space-y-4">
      <h1 className="nx-display text-3xl font-black text-white uppercase tracking-tight">Merci !</h1>
      <p>Votre lien personnel vers l&apos;enregistrement de la démo vient de partir par courriel. S&apos;il n&apos;arrive pas d&apos;ici quelques minutes, regardez dans vos courriels indésirables.</p>
      {unAUn && (
        <div className="space-y-3">
          <p>Vous avez aussi demandé une présentation 1:1 avec Nexus. Choisissez votre moment.</p>
          <a href={D.reservation} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center h-11 px-6 bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-black text-xs uppercase tracking-widest">
            Choisir un moment
          </a>
        </div>
      )}
      <p>Accès complet gratuit jusqu&apos;au 31 octobre. On migre votre fichier de suivi pour vous.</p>
      <p className="text-[#9AA3B2]">
        Questions : <a href={`mailto:${D.courriel}`} className="text-white hover:text-wl-red">{D.courriel}</a>
        {" · "}<a href="tel:4384980494" className="text-white hover:text-wl-red">{D.telephone}</a>
      </p>
      <p><Link href="/12octobre" className="text-[13px] text-[#9AA3B2] underline hover:text-white">Retour à la page de la démo</Link></p>
    </div>
  );
}

export default function MerciPage() {
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />
      <MarketingNav />
      <section className="flex-1 relative z-10 px-4 sm:px-6 py-16">
        <Suspense fallback={null}><Contenu /></Suspense>
      </section>
      <Footer />
    </div>
  );
}
