"use client";

/* ═══════════════════════════════════════════════════════════════
   ApercuCarte — aperçu PLEIN ÉCRAN de la carte officielle d'un athlète,
   ouvert depuis Téléchargements (BP 2026-10-18, 6.6). On ne va plus
   directement sur la fiche.

   L'image montrée est la VRAIE carte : la même AthletePlayerCard que la
   fiche, rendue hors écran puis capturée (html-to-image), à partir de
   partner_athlete_profile (gardes serveur : partenaire approuvé, athlète
   encore admissible ; sinon « plus disponible »).
     - « Enregistrer » : web → téléchargement ; appli → feuille système,
       où « Enregistrer l'image » l'envoie dans Photos ;
     - « Partager »   : feuille système (appli) ou Web Share (web) ;
     - « Voir le profil ».
   Chaque enregistrement ou partage est journalisé AVANT (comme la fiche :
   on ne livre pas une carte qu'on ne peut pas tracer).
   Porté sur <body> : AnimatedRoute (appli) piège les `fixed`.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toPng } from "html-to-image";
import { createClient } from "@/lib/supabase/client";
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import { mapPartnerRpcToRecruiterView, libelleFormat, type PartnerAthleteRow } from "@/lib/partenaires/carteAthlete";
import { journaliserTelechargement, type FormatCarte } from "@/lib/partenaires/journal";
import { OPTIONS_IMAGE_INJOIGNABLE } from "@/lib/partage/imageInjoignable";
import { enregistrerImage, rendusNecessaires } from "@/lib/partage/enregistrerImage";
import { partagerImage } from "@/lib/partage/partagerImage";

/** Clé lue par la fiche partenaire (appli) pour son bouton Retour. */
const CLE_RETOUR_FICHE = "nexus.partenaire.retourFiche";

function nomFichier(a: AthleteProfileRecruiterView, format: FormatCarte): string {
  const propre = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `nexus-${propre(a.firstName)}-${propre(a.lastName)}-${format}.png`;
}

const useMonte = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export default function ApercuCarte({ athleteId, format, onFermer, notifier }: {
  athleteId: string;
  format: FormatCarte;
  onFermer: () => void;
  notifier: (ok: boolean, texte: string) => void;
}) {
  const monte = useMonte();
  const [athlete, setAthlete] = useState<AthleteProfileRecruiterView | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<"enregistrer" | "partager" | null>(null);
  const capture = useRef<HTMLDivElement | null>(null);

  // 1. La ligne de la carte (mêmes gardes que la fiche).
  useEffect(() => {
    let vivant = true;
    void (async () => {
      const { data, error } = await createClient().rpc("partner_athlete_profile", { p_athlete_id: athleteId }).maybeSingle();
      if (!vivant) return;
      if (error || !data) { setErreur("Cet athlète n'est plus disponible pour les partenaires."); return; }
      setAthlete(mapPartnerRpcToRecruiterView(data as PartnerAthleteRow));
    })();
    return () => { vivant = false; };
  }, [athleteId]);

  // 2. La capture de la vraie carte, une fois rendue hors écran.
  useEffect(() => {
    if (!athlete) return;
    let vivant = true;
    void (async () => {
      try {
        if (document.fonts) await document.fonts.ready;
        const node = capture.current;
        if (!node) throw new Error("carte non rendue");
        const options = { ...OPTIONS_IMAGE_INJOIGNABLE, pixelRatio: 1, cacheBust: true };
        if (rendusNecessaires() === 2) await toPng(node, options);
        const url = await toPng(node, options);
        if (vivant) setImage(url);
      } catch (e) {
        console.error("[aperçu carte]", (e as { message?: string })?.message ?? e);
        if (vivant) setErreur("L'aperçu de la carte n'a pas pu être généré.");
      }
    })();
    return () => { vivant = false; };
  }, [athlete]);

  // Échap ferme (web).
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [onFermer]);

  async function livrer(action: "enregistrer" | "partager") {
    if (!athlete || !image) return;
    setOccupe(action);
    try {
      const refus = await journaliserTelechargement(createClient(), athleteId, format);
      if (refus) { notifier(false, refus); return; }
      const opts = { dataUrl: image, nomFichier: nomFichier(athlete, format), titre: "Carte Nexus" };
      const issue = action === "enregistrer"
        ? await enregistrerImage({ ...opts, dialogue: "Enregistrer la carte" })
        : await partagerImage(opts);
      if (issue === "echec") notifier(false, "Impossible d'ouvrir le partage. Réessaie.");
      else if (issue === "enregistre") notifier(true, "Carte téléchargée.");
    } finally {
      setOccupe(null);
    }
  }

  if (!monte) return null;
  const nom = athlete ? `${athlete.firstName} ${athlete.lastName}`.trim() : "";

  return createPortal(
    <div className="fixed inset-0 z-[95] bg-black/90 flex flex-col" role="dialog" aria-modal="true" aria-label="Aperçu de la carte"
      data-apercu-carte style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-between gap-3 px-4 h-14 shrink-0">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-white truncate">{nom || "Carte"}</p>
          <p className="text-[12px] text-white/55 truncate">{libelleFormat(format)}</p>
        </div>
        <button type="button" onClick={onFermer} aria-label="Fermer"
          className="w-10 h-10 shrink-0 rounded-full bg-white/[0.10] hover:bg-white/[0.16] flex items-center justify-center text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-4" onClick={onFermer}>
        {erreur ? (
          <p className="text-[14px] text-white/70 text-center max-w-xs" onClick={(e) => e.stopPropagation()}>{erreur}</p>
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`Carte ${nom}`} onClick={(e) => e.stopPropagation()} data-image-carte
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
        ) : (
          <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" aria-busy="true" />
        )}
      </div>

      <div className="shrink-0 px-4 pt-3 pb-4 flex flex-col gap-2 max-w-md w-full mx-auto">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!image || occupe !== null} onClick={() => void livrer("enregistrer")} data-action="enregistrer"
            className="h-12 rounded-xl bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-50 text-white text-[15px] font-bold">
            {occupe === "enregistrer" ? "…" : "Enregistrer"}
          </button>
          <button type="button" disabled={!image || occupe !== null} onClick={() => void livrer("partager")} data-action="partager"
            className="h-12 rounded-xl bg-white/[0.10] hover:bg-white/[0.16] disabled:opacity-50 text-white text-[15px] font-bold">
            {occupe === "partager" ? "…" : "Partager"}
          </button>
        </div>
        {!erreur && (
          <Link href={`/partenaire/athletes/${athleteId}`} data-voir-profil
            onClick={() => { try { window.sessionStorage.setItem(CLE_RETOUR_FICHE, "/partenaire/telechargements"); } catch { /* sans stockage : retour par défaut */ } }}
            className="h-11 flex items-center justify-center text-[14px] font-semibold text-white/80 hover:text-white underline underline-offset-4">
            Voir le profil
          </Link>
        )}
      </div>

      {/* La vraie carte, rendue hors écran pour la capture. */}
      {athlete && (
        <div aria-hidden="true" className="nx-capture-clean" style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", zIndex: -1 }}>
          <div ref={capture}><AthletePlayerCard a={athlete} format={format} clipOverflow={true} /></div>
        </div>
      )}
    </div>,
    document.body,
  );
}
