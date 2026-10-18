"use client";

/* ═══════════════════════════════════════════════════════════════
   ReseauxSociaux — la rangée « Réseaux sociaux » de la fiche d'un athlète
   (décision BP 2026-10-18) : Instagram, Facebook, TikTok, LinkedIn, en
   logos ronds cliquables, séparés des vidéos.

   Les href passent par profilsSociaux() : une ancienne saisie qui n'est pas
   une URL (« nicho_hebert ») devient le profil, et rien d'autre qu'un lien
   https:// n'arrive dans un href. Dans l'appli, le lien s'ouvre dans le
   navigateur intégré (comme les autres liens externes) ; au web, un nouvel
   onglet.
═══════════════════════════════════════════════════════════════ */

import PlateformeIcone from "@/components/shared/PlateformeIcone";
import { ouvrirDansLApp } from "@/components/shared/SourceMatchLigne";
import { profilsSociaux, type Reseau } from "@/lib/liensSociaux";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export type LiensReseaux = Partial<Record<Reseau["colonne"], string | null | undefined>>;

/** Vrai si au moins un profil est affichable. */
export function aDesReseaux(liens: LiensReseaux): boolean {
  return profilsSociaux(liens).length > 0;
}

export default function ReseauxSociaux({ liens, taille = 44, className = "" }: {
  liens: LiensReseaux;
  /** Diamètre des pastilles (px) ; 44 = cible tactile confortable. */
  taille?: number;
  className?: string;
}) {
  const profils = profilsSociaux(liens);
  if (profils.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-3 ${className}`} data-testid="reseaux-sociaux">
      {profils.map((p) => (
        <a
          key={p.cle}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={IS_CAPACITOR ? (e) => { void ouvrirDansLApp(e, p.url); } : undefined}
          aria-label={`${p.libelle} — ouvrir le profil`}
          title={p.libelle}
          className="flex items-center justify-center rounded-full border border-[#2D3748] bg-white/[0.04] transition-colors hover:border-white/30 hover:bg-white/[0.08] active:bg-white/10"
          style={{ width: taille, height: taille }}
        >
          <PlateformeIcone cle={p.cle} size={Math.round(taille * 0.46)} />
        </a>
      ))}
    </div>
  );
}
