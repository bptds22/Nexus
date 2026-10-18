"use client";

/* ═══════════════════════════════════════════════════════════════
   EnvoyerLien — le lien d'une carte prospect, affiché UNE SEULE FOIS (W4b).

   Le serveur ne garde que l'empreinte du jeton : fermé, ce panneau ne peut
   plus le réafficher. Un nouveau lien remplace l'ancien (qui cesse de
   fonctionner) — c'est le seul moyen de le « revoir ».

   Le partenaire envoie le lien LUI-MÊME, depuis son téléphone (Nexus n'a
   aucune coordonnée du jeune) :
   - « Envoyer par texto » : sms: avec le message pré-rempli (appareil
     tactile seulement — sur un ordinateur sans écran tactile, sms: n'ouvre
     rien d'utile) ;
   - « Partager » : le partage natif, s'il existe ;
   - « Copier » : toujours.
   Le message est court, signé de l'organisation, sans nom ni évaluation.

   P4 (1.4.5, option a) : « Envoyer par texto » ouvre MESSAGES avec le message
   et le lien, SANS numéro (sms:&body= sur iOS, sms:?body= sur Android) — au
   web sur un appareil tactile, et dans l'appli comme le texto du recruteur
   (window.location.href). Rien n'est saisi ni stocké. Dans l'appli, la
   feuille de partage native reste offerte en second (« Partager… »). Le lien
   du message est bâti sur NEXT_PUBLIC_APP_URL (lib/partage/adressePublique.ts),
   jamais sur l'adresse locale de la WebView.
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { createPortal } from "react-dom";
import { lienSms, messageTexto } from "@/lib/partenaires/prospects";
import { partagerTexte } from "@/lib/partage/partagerLien";
import { Capacitor } from "@capacitor/core";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** Lu une fois à l'ouverture : la feuille n'est rendue que dans le navigateur (portail dans
 *  <body>, après un geste), jamais au serveur. Téléphone ou tablette : écran tactile ou pointeur
 *  grossier — un portable à écran tactile verra aussi le bouton ; la copie reste offerte à tous. */
function lireAppareil() {
  const tactile = (navigator.maxTouchPoints ?? 0) > 0 || !!window.matchMedia?.("(pointer: coarse)").matches;
  const ios = IS_CAPACITOR
    ? Capacitor.getPlatform() === "ios"
    : /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 1);
  return { tactile, ios, partage: typeof navigator.share === "function" };
}

export default function EnvoyerLien({
  organisation,
  adresse,
  evalue,
  onClose,
}: {
  organisation: string;
  adresse: string;
  /** La carte porte une évaluation (cote globale) : sinon, le texto invite sans « t'a évalué ». */
  evalue: boolean;
  onClose: () => void;
}) {
  const message = messageTexto(organisation, adresse, evalue);
  const [{ tactile, ios, partage }] = useState(lireAppareil);
  const [copie, setCopie] = useState<"lien" | "message" | null>(null);

  const copier = async (quoi: "lien" | "message") => {
    try {
      await navigator.clipboard.writeText(quoi === "lien" ? adresse : message);
      setCopie(quoi);
      setTimeout(() => setCopie(null), 2000);
    } catch { /* presse-papiers refusé : le champ reste sélectionnable */ }
  };

  const partager = async () => {
    try { await navigator.share({ text: message }); } catch { /* annulé */ }
  };

  // Appli : Messages, comme le texto du recruteur (CreerProspectMobile).
  const envoyerAppli = () => { window.location.href = lienSms(message, ios); };

  // Appli, en second : la feuille de partage native ; repli sur la copie du message.
  const partagerAppli = async () => {
    const issue = await partagerTexte({ texte: message, titre: "Envoyer le lien" });
    if (issue === "copie") { setCopie("message"); setTimeout(() => setCopie(null), 2000); }
  };

  // Rendu dans <body>, comme FormulaireCarte (barre du haut mobile).
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="titre-lien" data-envoyer-lien>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 sm:p-6 max-w-lg w-full shadow-2xl">
        <h3 id="titre-lien" className="font-head text-[18px] font-black text-white uppercase tracking-tight">Envoyer le lien</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Envoie-le au jeune toi-même, par texto. Le premier compte athlète qui l&apos;ouvre réserve la carte.
        </p>

        <div className="mt-4 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2.5 text-[12px] text-[#F5C46B]">
          Ce lien ne s&apos;affichera qu&apos;une fois. Si tu le perds, crée un nouveau lien : l&apos;ancien cessera de fonctionner.
        </div>

        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">Message</p>
        <p className="mt-1 whitespace-pre-line break-all rounded-lg border border-[#2a2d36] bg-[#13151a] px-3 py-2.5 text-[13px] text-[#e0e0e0]" data-message-texto>
          {message}
        </p>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          {IS_CAPACITOR && (
            <button type="button" onClick={envoyerAppli} data-envoyer-texto-appli
              className="flex-1 min-h-[44px] text-center px-4 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
              Envoyer par texto
            </button>
          )}
          {IS_CAPACITOR && (
            <button type="button" onClick={() => void partagerAppli()} data-partager-appli
              className="flex-1 min-h-[44px] px-4 py-2.5 border border-[#2D3748] text-white hover:bg-white/5 text-[13px] font-bold rounded-lg">
              Partager…
            </button>
          )}
          {!IS_CAPACITOR && tactile && (
            <a href={lienSms(message, ios)} data-envoyer-texto className="flex-1 text-center px-4 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
              Envoyer par texto
            </a>
          )}
          {!IS_CAPACITOR && partage && (
            <button type="button" onClick={() => void partager()} className="flex-1 px-4 py-2.5 border border-[#2D3748] text-white hover:bg-white/5 text-[13px] font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
              Partager…
            </button>
          )}
          <button type="button" onClick={() => void copier("message")}
            className={`flex-1 min-h-[44px] px-4 py-2.5 text-[13px] font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${tactile || IS_CAPACITOR ? "border border-[#2D3748] text-white hover:bg-white/5" : "bg-[#E63946] hover:bg-[#D42B22] text-white"}`}>
            {copie === "message" ? "Message copié" : "Copier le message"}
          </button>
          <button type="button" onClick={() => void copier("lien")} className="flex-1 min-h-[44px] px-4 py-2.5 border border-[#2D3748] text-white hover:bg-white/5 text-[13px] font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            {copie === "lien" ? "Lien copié" : "Copier le lien seul"}
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white">
            J&apos;ai envoyé le lien
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
