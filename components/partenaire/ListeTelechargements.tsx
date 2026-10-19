"use client";

/* ListeTelechargements — l'historique des cartes téléchargées (BP 2026-10-18, 6.6).
   Toucher une ligne ouvre l'APERÇU de la vraie carte en plein écran
   (ApercuCarte : Enregistrer, Partager, Voir le profil) au lieu d'aller sur la
   fiche. Le format se lit clairement, avec sa taille et une vignette à la
   bonne proportion. */

import { useState } from "react";
import AthletePhoto from "@/components/shared/AthletePhoto";
import ApercuCarte from "@/components/partenaire/ApercuCarte";
import { FORMATS_CARTE } from "@/lib/partenaires/carteAthlete";
import type { FormatCarte } from "@/lib/partenaires/journal";
import { useMobileToast } from "@/components/mobile/MobileToast";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export interface LigneTelechargement {
  id: string;
  format: FormatCarte;
  le: string;
  libelleDate: string;
  athleteId: string | null;
  prenom: string | null;
  nom: string | null;
  photo: string | null;
  sport: string | null;
}

/** La vignette du format, à la proportion réelle de la carte (4:5 ou 9:16). */
function VignetteFormat({ format }: { format: FormatCarte }) {
  const h = 26;
  return (
    <span aria-hidden className={`inline-block rounded-[3px] border ${format === "story" ? "border-purple-400/70 bg-purple-500/20" : "border-sky-400/70 bg-sky-500/20"}`}
      style={{ height: h, width: Math.round(h * FORMATS_CARTE[format].ratio) }} />
  );
}

export default function ListeTelechargements({ lignes }: { lignes: LigneTelechargement[] }) {
  const [apercu, setApercu] = useState<{ athleteId: string; format: FormatCarte } | null>(null);
  const [avis, setAvis] = useState<{ ok: boolean; texte: string } | null>(null);
  const toast = useMobileToast();
  const notifier = (ok: boolean, texte: string) => {
    if (IS_CAPACITOR) { if (ok) toast.success({ message: texte }); else toast.error({ message: texte }); return; }
    setAvis({ ok, texte });
    setTimeout(() => setAvis(null), 3500);
  };

  return (
    <>
      {avis && (
        <p role="status" className={`mb-3 text-[13px] font-semibold ${avis.ok ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{avis.texte}</p>
      )}
      <div className="divide-y divide-[#2D3748]/40">
        {lignes.map((d) => {
          const nom = d.athleteId ? `${d.prenom ?? ""} ${d.nom ?? ""}`.trim() : "Athlète non disponible";
          const meta = FORMATS_CARTE[d.format];
          const contenu = (
            <>
              <AthletePhoto photoUrl={d.photo} firstName={d.prenom} lastName={d.nom} size={40} alt={nom} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-white truncate">{nom}</p>
                {d.sport && <p className="text-[12px] text-[#9CA3AF] truncate">{d.sport}</p>}
              </div>
              <span className="flex items-center gap-2 shrink-0" data-format={d.format}>
                <VignetteFormat format={d.format} />
                <span className="text-left leading-tight">
                  <span className="block text-[12px] font-bold text-white">{meta.nom}</span>
                  <span className="block text-[10px] text-[#9CA3AF] tabular-nums">{meta.taille}</span>
                </span>
              </span>
              <span className="hidden sm:block text-[11px] text-[#6b7280] tabular-nums shrink-0 sm:w-[110px] sm:text-right">{d.libelleDate}</span>
            </>
          );
          return d.athleteId ? (
            <button key={d.id} type="button" data-ligne-telechargement
              onClick={() => setApercu({ athleteId: d.athleteId!, format: d.format })}
              className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-[#2D3748]/40 active:bg-white/[0.04] transition-colors">
              {contenu}
            </button>
          ) : (
            <div key={d.id} className="px-5 py-4 flex items-center gap-4 opacity-70">{contenu}</div>
          );
        })}
      </div>
      {apercu && (
        <ApercuCarte athleteId={apercu.athleteId} format={apercu.format} onFermer={() => setApercu(null)} notifier={notifier} />
      )}
    </>
  );
}
