"use client";

/* ═══════════════════════════════════════════════════════════════
   ChampNote — LE champ de saisie d'une note (1.4.5, option C du R6).

   Les coachs et recruteurs prenaient leurs notes ailleurs (OneNote) parce que
   le champ était petit, sans brouillon, sans voix. Un seul composant, partout
   où l'on écrit une note (fil d'un joueur dans Mon processus, dans une liste,
   sur sa fiche ; note de liste), web et appli :
     · champ PLUS GRAND, qui grandit avec le texte ;
     · BROUILLON sauvegardé tout seul dans l'appareil (lib/notes/brouillon) ;
     · bouton DICTER bien visible : voix du navigateur quand elle existe ;
       sinon on met le curseur dans le champ et on dit comment utiliser le micro
       du clavier (la dictée native iOS / Android marche partout) ;
     · GABARITS courts, optionnels (lib/notes/gabarits).
   Le composant ne poste rien : le parent garde « Poster » et sa logique.
   Après un envoi réussi, le parent met le texte à "" — le brouillon s'efface.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { ecrireBrouillon, lireBrouillon } from "@/lib/notes/brouillon";
import { GABARITS_NOTE, insererGabarit, ajouterDictee } from "@/lib/notes/gabarits";

interface ReconnaissanceVocale {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start(): void; stop(): void;
}
type FabriqueReconnaissance = new () => ReconnaissanceVocale;

function fabriqueDictee(): FabriqueReconnaissance | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: FabriqueReconnaissance; webkitSpeechRecognition?: FabriqueReconnaissance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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
  const [enEcoute, setEnEcoute] = useState(false);
  const [aide, setAide] = useState<string | null>(null);
  const [etatBrouillon, setEtatBrouillon] = useState<"" | "retabli" | "enregistre">("");
  const reco = useRef<ReconnaissanceVocale | null>(null);
  const premiereFois = useRef(true);
  const valeur = useRef(value);
  valeur.current = value;

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

  useEffect(() => () => { reco.current?.stop(); }, []);

  const arreterDictee = useCallback(() => { reco.current?.stop(); setEnEcoute(false); }, []);

  const dicter = () => {
    if (enEcoute) { arreterDictee(); return; }
    const Fabrique = fabriqueDictee();
    if (!Fabrique) {
      /* Pas de voix du navigateur (cas fréquent dans l'appli iOS) : le micro du clavier dicte partout. */
      zone.current?.focus();
      setAide("Touche le micro de ton clavier pour dicter ta note.");
      return;
    }
    try {
      const r = new Fabrique();
      r.lang = "fr-CA";
      r.continuous = true;
      r.interimResults = false;
      r.onresult = (e) => {
        let phrase = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) phrase += e.results[i][0].transcript;
        }
        if (phrase) onChange(ajouterDictee(valeur.current, phrase));
      };
      r.onend = () => setEnEcoute(false);
      r.onerror = (e) => {
        setEnEcoute(false);
        setAide(e.error === "not-allowed" ? "Autorise le micro pour dicter, ou utilise le micro du clavier." : "La dictée s'est arrêtée. Réessaie, ou utilise le micro du clavier.");
      };
      reco.current = r;
      setAide(null);
      r.start();
      setEnEcoute(true);
    } catch {
      setEnEcoute(false);
      zone.current?.focus();
      setAide("Touche le micro de ton clavier pour dicter ta note.");
    }
  };

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
        <button
          type="button"
          onClick={dicter}
          disabled={disabled}
          aria-pressed={enEcoute}
          data-testid="champ-note-dicter"
          className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider transition-colors ${bouton} ${
            enEcoute ? "bg-[#E63946] text-white animate-pulse" : "bg-[#E63946]/12 text-[#E63946] border border-[#E63946]/40 hover:bg-[#E63946]/20"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0014 0" /><line x1="12" y1="18" x2="12" y2="22" />
          </svg>
          {enEcoute ? "Arrêter" : "Dicter"}
        </button>
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
      {aide && <p className="text-[12px] text-[#9CA3AF] mt-1.5" role="status">{aide}</p>}
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
