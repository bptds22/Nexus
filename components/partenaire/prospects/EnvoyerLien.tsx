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
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { lienSms, messageTexto } from "@/lib/partenaires/prospects";

export default function EnvoyerLien({
  organisation,
  adresse,
  onClose,
}: {
  organisation: string;
  adresse: string;
  onClose: () => void;
}) {
  const message = messageTexto(organisation, adresse);
  const [tactile, setTactile] = useState(false);
  const [partage, setPartage] = useState(false);
  const [copie, setCopie] = useState<"lien" | "message" | null>(null);

  useEffect(() => {
    // Téléphone ou tablette : écran tactile, ou pointeur grossier. Un portable à
    // écran tactile verra aussi le bouton ; la copie reste offerte à tous.
    setTactile(typeof window !== "undefined"
      && ((navigator.maxTouchPoints ?? 0) > 0 || !!window.matchMedia?.("(pointer: coarse)").matches));
    setPartage(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

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
          {tactile && (
            <a href={lienSms(message)} className="flex-1 text-center px-4 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg">
              Envoyer par texto
            </a>
          )}
          {partage && (
            <button type="button" onClick={() => void partager()} className="flex-1 px-4 py-2.5 border border-[#2D3748] text-white hover:bg-white/5 text-[13px] font-bold rounded-lg">
              Partager…
            </button>
          )}
          <button type="button" onClick={() => void copier("message")}
            className={`flex-1 px-4 py-2.5 text-[13px] font-bold rounded-lg ${tactile ? "border border-[#2D3748] text-white hover:bg-white/5" : "bg-[#E63946] hover:bg-[#D42B22] text-white"}`}>
            {copie === "message" ? "Message copié" : "Copier le message"}
          </button>
          <button type="button" onClick={() => void copier("lien")} className="flex-1 px-4 py-2.5 border border-[#2D3748] text-white hover:bg-white/5 text-[13px] font-bold rounded-lg">
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
