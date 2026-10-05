"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PlateformeIcone from "@/components/shared/PlateformeIcone";
import { chargerApercuHudl, estLisible, type ApercuHudl as Apercu } from "@/lib/video/apercuHudl";
import { Capacitor } from "@capacitor/core";

/* ═══════════════════════════════════════════════════════════════
   ApercuHudl — un lien Hudl sur la fiche, web ET app (recette 1.4.4).

   Vidéo publique confirmée → le lecteur officiel `/embed/video/…` en
   ligne, comme YouTube (Hudl déclare `frame-ancestors *` ; l'iframe ne
   dépend pas de l'origine, elle joue aussi sous capacitor://).
   Tout le reste → une carte « Voir sur Hudl » : logo, vignette quand Hudl
   en publie une (photo du profil, image de la vidéo), titre.

   Jamais un lecteur vide : tant que la fonction n'a pas confirmé la vidéo
   — chargement compris — c'est la carte qui s'affiche. Voir
   lib/video/apercuHudl.ts.
═══════════════════════════════════════════════════════════════ */

export default function ApercuHudl({ url, title }: { url: string; title?: string }) {
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [vignetteKo, setVignetteKo] = useState(false);

  useEffect(() => {
    let vivant = true;
    setApercu(null);
    setVignetteKo(false);
    chargerApercuHudl(createClient(), url).then((a) => { if (vivant) setApercu(a); });
    return () => { vivant = false; };
  }, [url]);

  if (estLisible(apercu)) {
    return (
      <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ paddingBottom: "56.25%" }} data-testid="hudl-lecteur">
        <iframe
          src={apercu.embedUrl}
          title={apercu.titre || title || "Vidéo Hudl"}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    );
  }

  const profil = apercu?.genre === "profil";
  const vignette = !vignetteKo && apercu && "vignette" in apercu ? apercu.vignette : null;
  const titre = (apercu && "titre" in apercu && apercu.titre) || title || "Hudl";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="hudl-carte"
      data-genre={apercu?.genre ?? "chargement"}
      /* Dans l'app : le navigateur intégré, comme la vignette YouTube — une
         navigation de la WebView quitterait l'app. */
      onClick={(e) => {
        if (!Capacitor.isNativePlatform()) return;
        e.preventDefault();
        void import("@capacitor/browser").then(({ Browser }) => Browser.open({ url }));
      }}
      className="flex items-center gap-3 bg-[#111317] border border-[#2D3748] rounded-lg p-3 hover:border-[#FF6300]/50 transition-colors group"
    >
      <div
        className={`relative shrink-0 overflow-hidden bg-[#1A1D24] flex items-center justify-center ${profil ? "w-14 h-14 rounded-full" : "w-24 h-[54px] rounded-md"}`}
      >
        {vignette ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vignette} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setVignetteKo(true)} />
        ) : (
          <PlateformeIcone cle="hudl" size={24} />
        )}
        {vignette && (
          <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center">
            <PlateformeIcone cle="hudl" size={13} />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-white truncate">{titre}</p>
        <p className="text-[12px] font-semibold text-[#FF6300]">Voir sur Hudl</p>
      </div>
      <svg className="ml-auto shrink-0 text-[#6b7280] group-hover:text-[#FF6300]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
    </a>
  );
}
