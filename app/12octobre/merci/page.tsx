"use client";

/* /12octobre/merci — après une demande d'accès à l'enregistrement.
   · Première demande pour ce courriel : la route a rendu le jeton, passé
     par sessionStorage (jamais l'URL) → lien personnel + bouton « Regarder
     la démo maintenant » ; il est aussi parti par courriel.
   · Courriel déjà connu (approuvé ou révoqué) : pas de jeton → « votre
     lien vient de partir par courriel », sans afficher de lien.
   Rappel du 1:1 dans les deux cas s'il a été demandé. */

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import PlaybookBackground from "../../components/PlaybookBackground";
import { DEMO_12_OCTOBRE as D } from "@/lib/demo/demo12Octobre";
import { CLE_JETON_MERCI, cheminVideo, estUuid } from "@/lib/demo/demoAcces";

function Contenu() {
  const unAUn = useSearchParams().get("un_a_un") === "1";
  const [jeton, setJeton] = useState<string | null>(null);
  useEffect(() => {
    try {
      const j = sessionStorage.getItem(CLE_JETON_MERCI);
      if (estUuid(j)) setJeton(j);
    } catch { /* rien : on retombe sur « parti par courriel » */ }
  }, []);

  return (
    <div className="max-w-2xl mx-auto nx-auth-card bg-[#1A1D24] border border-white/[0.08] p-6 sm:p-10 font-sans text-[15px] text-[#D1D5DB] leading-relaxed space-y-4">
      <h1 className="nx-display text-3xl font-black text-white uppercase tracking-tight">Merci !</h1>
      {jeton ? (
        <div className="space-y-3">
          <p>Votre accès personnel à l&apos;enregistrement de la démo est prêt.</p>
          <a href={cheminVideo(jeton)}
            className="inline-flex items-center justify-center w-full sm:w-auto h-12 px-6 bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-black text-xs uppercase tracking-widest">
            Regarder la démo maintenant
          </a>
          <p>On vous l&apos;a aussi envoyé par courriel. Ce lien vous est réservé ; merci de ne pas le partager.</p>
        </div>
      ) : (
        <p>Votre lien personnel vers l&apos;enregistrement de la démo vient de partir par courriel. S&apos;il n&apos;arrive pas d&apos;ici quelques minutes, regardez dans vos courriels indésirables.</p>
      )}
      {unAUn && (
        <div className="space-y-3">
          <p>Vous avez aussi demandé une présentation 1:1 avec Nexus. Choisissez votre moment.</p>
          <a href={D.reservation} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center h-11 px-6 text-white font-head font-black text-xs uppercase tracking-widest ${jeton ? "border border-[#2D3F5E] hover:border-[#9AA3B2]" : "bg-[#E63946] hover:bg-[#D42B22]"}`}>
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
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex flex-col">
      <PlaybookBackground />
      <MarketingNav />
      <section className="flex-1 relative z-10 px-4 sm:px-6 py-16">
        <Suspense fallback={null}><Contenu /></Suspense>
      </section>
      <Footer />
    </div>
  );
}
