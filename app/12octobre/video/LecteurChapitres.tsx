"use client";

/* Lecteur YouTube + chapitres cliquables. Un clic recharge l'iframe au
   temps du chapitre (paramètre start, lecture auto) : pas d'API player à
   charger. L'ID vient du serveur (DEMO_YOUTUBE_ID), jamais du code. */

import { useState } from "react";
import { CHAPITRES, urlLecteur } from "@/lib/demo/demoAcces";

export default function LecteurChapitres({ idVideo }: { idVideo: string }) {
  const [depart, setDepart] = useState<{ s: number; n: number } | null>(null);

  return (
    <>
      <div className="nx-auth-card bg-[#0A1428] border border-[#1E2D4A] overflow-hidden">
        <iframe
          key={depart?.n ?? 0}
          src={urlLecteur(idVideo, depart?.s ?? 0, depart !== null)}
          title="La démo Nexus"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="block w-full aspect-video bg-black"
        />
      </div>

      <h2 className="text-[12px] font-bold tracking-[0.16em] uppercase text-[#B4BCC8] mt-9 mb-3">Chapitres</h2>
      <ol className="nx-auth-card bg-[#0A1428] border border-[#1E2D4A] divide-y divide-[#1E2D4A]">
        {CHAPITRES.map((c) => (
          <li key={c.temps}>
            <button
              type="button"
              onClick={() => {
                setDepart((d) => ({ s: c.secondes, n: (d?.n ?? 0) + 1 }));
                if (typeof window !== "undefined" && window.scrollY > 200) window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-full flex items-baseline gap-4 px-4 sm:px-5 py-3 text-left font-sans text-[16px] text-[#E5E7EB] hover:bg-[#E63946]/[0.06] hover:text-white transition-colors"
            >
              <span className="w-12 shrink-0 text-wl-red font-bold tabular-nums">{c.temps}</span>
              <span>{c.titre}</span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
