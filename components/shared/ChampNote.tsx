"use client";

/* ═══════════════════════════════════════════════════════════════
   ChampNote — LE champ de saisie d'une note (1.4.5, option C du R6).

   Les coachs et recruteurs prenaient leurs notes ailleurs (OneNote) parce que
   le champ était petit, sans brouillon. Un seul composant, partout
   où l'on écrit une note (fil d'un joueur dans Mon processus, dans une liste,
   sur sa fiche ; note de liste), web et appli :
     · champ PLUS GRAND, qui grandit avec le texte ;
     · BROUILLON sauvegardé tout seul dans l'appareil (lib/notes/brouillon) ;
     · AUCUN bouton de saisie vocale (BP 2026-10-28, lot E0 : retiré partout) ;
     · GABARITS courts, optionnels (lib/notes/gabarits).
   Le composant ne poste rien : le parent garde « Poster » et sa logique.
   Après un envoi réussi, le parent met le texte à "" — le brouillon s'efface.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { ecrireBrouillon, lireBrouillon } from "@/lib/notes/brouillon";
import { GABARITS_NOTE, insererGabarit } from "@/lib/notes/gabarits";

export default function ChampNote({
  value,
  onChange,
  sujet,
  placeholder = "Ajouter une note…",
  ariaLabel = "Ajouter une note",
  onEnvoyer,
  envoyerAvecEntree = true,
  mobile = false,
  disabled = false,
  id,
  className = "",
  sansGabarits = false,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Clé du brouillon : le SUJET de la note (ex. « athlete:<id> », « liste:<id> »). */
  sujet: string;
  placeholder?: string;
  ariaLabel?: string;
  /** Entrée (sans Maj) envoie, comme avant sur le web. */
  onEnvoyer?: () => void;
  envoyerAvecEntree?: boolean;
  mobile?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Game On (BP 2026-10-18) : garder ça simple, sans bouton Gabarits. */
  sansGabarits?: boolean;
}) {
  const zone = useRef<HTMLTextAreaElement>(null);
  const [gabaritsOuverts, setGabaritsOuverts] = useState(false);
  const [etatBrouillon, setEtatBrouillon] = useState<"" | "retabli" | "enregistre">("");
  const premiereFois = useRef(true);

  /* Brouillon : rétabli à l'ouverture (si le champ est vide), puis sauvegardé à chaque frappe (500 ms). */
  useEffect(() => {
    if (value.trim()) return;
    const b = lireBrouillon(sujet);
    if (b) { onChange(b); setEtatBrouillon("retabli"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sujet]);

  useEffect(() => {
    if (premiereFois.current) { premiereFois.current = false; return; }
    const t = setTimeout(() => {
      ecrireBrouillon(sujet, value);
      setEtatBrouillon(value.trim() ? "enregistre" : "");
    }, 500);
    return () => clearTimeout(t);
  }, [value, sujet]);

  /* Le champ grandit avec le texte (jusqu'à 240 px). */
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  const ajouterGabarit = (g: string) => {
    onChange(insererGabarit(value, g));
    zone.current?.focus();
  };

  const taille = mobile
    ? "min-h-[120px] text-[16px] rounded-2xl bg-white/[0.06] border border-white/[0.06] focus:border-[#E63946]/40 px-3 py-2.5 text-white placeholder:text-white/40"
    : "min-h-[96px] text-[13px] rounded-lg bg-[#13151a] border border-[#2a2d36] focus:border-[#E63946] px-3 py-2 text-[#e0e0e0] placeholder:text-[#4a4d56]";
  const bouton = mobile
    ? "min-h-[44px] px-3 rounded-full text-[12px]"
    : "min-h-[32px] px-2.5 rounded-md text-[11px]";

  return (
    <div className={className} data-testid="champ-note">
      <textarea
        ref={zone}
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={mobile ? 4 : 3}
        className={`w-full resize-none outline-none transition-colors ${taille}`}
        onKeyDown={(e) => {
          if (envoyerAvecEntree && onEnvoyer && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnvoyer(); }
        }}
      />
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {!sansGabarits && (
        <button
          type="button"
          onClick={() => setGabaritsOuverts((o) => !o)}
          aria-expanded={gabaritsOuverts}
          data-testid="champ-note-gabarits"
          className={`inline-flex items-center font-bold uppercase tracking-wider border border-white/10 text-[#9CA3AF] hover:text-white transition-colors ${bouton}`}
        >
          Gabarits
        </button>
        )}
        <span className="ml-auto text-[11px] text-[#6b7280]" aria-live="polite" data-testid="champ-note-brouillon">
          {etatBrouillon === "retabli" ? "Brouillon rétabli" : etatBrouillon === "enregistre" ? "Brouillon enregistré" : ""}
        </span>
      </div>
      {gabaritsOuverts && (
        <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Gabarits de note">
          {GABARITS_NOTE.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => ajouterGabarit(g)}
              className={`border border-white/10 bg-white/[0.04] text-[#e0e0e0] hover:bg-white/10 active:bg-white/15 transition-colors ${mobile ? "min-h-[44px] px-3 rounded-full text-[13px]" : "px-2.5 py-1 rounded-md text-[12px]"}`}
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
