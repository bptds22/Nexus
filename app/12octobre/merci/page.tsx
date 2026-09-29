"use client";

/* /12octobre/merci — la page de remerciement, selon le choix ; rappel du
   1:1 s'il a été demandé ; « Ouvrir mon compte Nexus » (le clic pose
   l'intérêt sur l'inscription, RPC demo_clic_compte). */

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import PlaybookBackground from "../../components/PlaybookBackground";
import { createClient } from "@/lib/supabase/client";
import { DEMO_12_OCTOBRE as D, estParticipation, lienOuvrirCompte } from "@/lib/demo/demo12Octobre";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Contenu() {
  const params = useSearchParams();
  const choix = params.get("choix");
  const c = estParticipation(choix) ? choix : null;
  const unAUn = params.get("un_a_un") === "1";
  const id = params.get("id") ?? "";
  const [courriel, setCourriel] = useState("");
  useEffect(() => {
    try { setCourriel(sessionStorage.getItem("demo12-courriel") ?? ""); } catch { /* rien */ }
  }, []);

  const clicCompte = () => {
    // .then() : un constructeur supabase-js ne part qu'une fois consommé.
    if (UUID_RE.test(id)) void createClient().rpc("demo_clic_compte", { p_id: id }).then(() => undefined);
  };

  return (
    <div className="max-w-2xl mx-auto nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-6 sm:p-10 font-sans text-[15px] text-[#D1D5DB] leading-relaxed space-y-4">
      <h1 className="nx-display text-3xl font-black text-white uppercase tracking-tight">Merci !</h1>
      {c === "DIRECT" && (
        <>
          <p>Votre place est réservée pour le <strong className="text-white">{D.libelle}</strong>.</p>
          <p>Un courriel de confirmation vient de partir, avec le lien de la rencontre et l&apos;invitation à ajouter à votre agenda.</p>
          <p>Lien de la rencontre : <a href={D.meet} target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-wl-red">{D.meet}</a></p>
        </>
      )}
      {c === "ENREGISTREMENT" && (
        <p>C&apos;est noté : vous recevrez l&apos;enregistrement de la démo par courriel après le 12 octobre.</p>
      )}
      {!c && <p>Votre inscription est reçue. Un courriel de confirmation vient de partir.</p>}
      {unAUn && (
        <div className="space-y-3">
          <p>Vous avez aussi demandé une présentation 1:1 avec Nexus. Si ce n&apos;est pas déjà fait, choisissez votre moment.</p>
          <a href={D.reservation} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center h-11 px-6 bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-black text-xs uppercase tracking-widest">
            Choisir un moment
          </a>
        </div>
      )}
      <p>Ensuite : un accès complet et gratuit à Nexus pendant deux semaines, pour tester avant la période intensive de recrutement.</p>
      <a href={lienOuvrirCompte(courriel)} target="_blank" rel="noopener noreferrer" onClick={clicCompte}
        className="inline-flex items-center h-11 px-6 border border-[#1E2D4A] text-[#D1D5DB] hover:text-white hover:border-[#9AA3B2] font-head font-black text-xs uppercase tracking-widest">
        Ouvrir mon compte Nexus
      </a>
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
