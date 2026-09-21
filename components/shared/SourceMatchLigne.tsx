"use client";

/* ── Provenance d'un match ─────────────────────────────────────
   Décision BP du 2026-09-17 : d'où vient l'information, et quand elle a été
   relevée — par match, parce que les deux varient d'une ligne à l'autre.

   LE LIBELLÉ NE PROMET PAS PLUS QUE CE QU'IL TIENT. Côté RSEQ le lien
   télécharge le calendrier Excel de la LIGUE : il n'existe aucune page par
   match (site sans route, vérifié le 2026-09-17). Écrire « voir ce match »
   ferait rouler un recruteur sur une garantie qu'on n'a pas.
   Sans URL connue, on affiche la source seule plutôt qu'un lien générique.

   PARTAGÉ web + app (1.4.3) : `app/recruteur/calendrier` et
   `RecruteurCalendrierMobile` rendent ce même composant. Seul le padding
   diffère (`className`).

   DANS L'APP, le lien passe par @capacitor/browser (même chemin que
   lib/legal) : une navigation de la WebView vers un site tiers ne doit pas
   sortir l'usager de l'app, et un `target="_blank"` n'y ouvre rien de
   fiable. Le téléchargement RSEQ se fait alors dans le navigateur intégré. */

import type { MouseEvent } from "react";
import { formatCollecte, type SourceMatch } from "@/lib/calendar/sourceMatch";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

async function ouvrirDansLApp(e: MouseEvent<HTMLAnchorElement>, url: string) {
  e.preventDefault();
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, presentationStyle: "popover" });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export default function SourceMatchLigne({
  source,
  className = "px-[22px] py-[9px]",
}: {
  source: SourceMatch;
  /** Padding de la ligne — celui de la carte qui la porte. */
  className?: string;
}) {
  if (!source.nom) return null;
  const releve = formatCollecte(source.collecteLe);
  const url = source.url;

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#1E2129] text-[12.5px] text-[#5C6575] ${className}`}>
      <span>
        Source&nbsp;: <span className="font-semibold text-[#8A909C]">{source.nom}</span>
      </span>
      {url && source.libelle && (
        <>
          <span aria-hidden>·</span>
          {/* Web — RSEQ : la réponse est un `Content-Disposition: attachment`,
              donc le clic télécharge SANS quitter le calendrier — pas de
              target, qui laisserait un onglet vide (Safari). Civil : vraie
              page, donc nouvel onglet. `download` serait ignoré : cross-origin.
              App : voir l'en-tête. */}
          <a
            href={url}
            {...(IS_CAPACITOR
              ? { onClick: (e: MouseEvent<HTMLAnchorElement>) => { void ouvrirDansLApp(e, url); } }
              : source.telecharge ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            className="font-semibold text-[#8A909C] underline decoration-[#333B4A] underline-offset-2 transition-colors hover:text-[#EDEFF3]"
          >
            {source.libelle}
          </a>
        </>
      )}
      {releve && (
        <>
          <span aria-hidden>·</span>
          <span>relevé le {releve}</span>
        </>
      )}
    </div>
  );
}
