"use client";

/* ═══════════════════════════════════════════════════════════════
   Badges PARTENAIRE (lot W3) — ajoutés À LA FIN de la rangée
   « Distinctions », avec leur propre icône.

   Même gabarit que DistinctionBadge en `lg` (cellule 110 px, picto
   96 px, libellé 11 px en capitales) pour que la rangée reste une
   seule rangée. Le nom de l'ORGANISATION est dit sous le libellé :
   un badge partenaire ne doit jamais passer pour un badge du coach.

   DEUX SORTES DE BADGE, UN SEUL REFLET (W3b) :
   - badge du catalogue Nexus posé par le partenaire (`estNexus`) : c'est
     le VRAI badge — DistinctionBadge, son icône, son libellé, son reflet —
     signé dessous « par <organisation> » ;
   - badge propre au partenaire : son icône dans le MÊME conteneur
     `.nx-badge is-metal`, l'icône servant aussi de `--nx-mask` pour que le
     reflet suive sa silhouette (le stockage partner-badges répond
     `Access-Control-Allow-Origin: *`, condition d'un masque CSS venu d'une
     autre origine — vérifié le 2026-10-14). Le masque suit le canal ALPHA :
     une icône détourée reflète sa forme, une icône à fond opaque son carré.

   Actions, selon ce que le serveur autorise (badges_partenaires_athlete) :
   - `actions="coach"` : Masquer / Réafficher (peut_masquer). Un badge
     masqué reste posé ; seuls le coach, l'admin et le partenaire auteur
     le voient encore, grisé ;
   - `actions="partenaire"` : « Retirer le badge » sur les siens
     (est_le_mien), avec confirmation en deux temps — pas de boîte native,
     qui bloquerait la WebView.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import "@/components/badges/distinction-badges.css";
import {
  chargerBadgesPartenaires,
  masquerBadgePartenaire,
  retirerBadgePartenaire,
  signalerBadgesPartenaire,
  EVENEMENT_BADGE_PARTENAIRE,
  type BadgePartenaire,
} from "@/lib/badges/partenaire";

export function useBadgesPartenaires(athleteId: string | null | undefined): BadgePartenaire[] {
  const [badges, setBadges] = useState<BadgePartenaire[]>([]);
  useEffect(() => {
    if (!athleteId) return;
    let vivant = true;
    const charger = () => {
      chargerBadgesPartenaires(createClient(), athleteId)
        .then((r) => { if (vivant) setBadges(r); })
        .catch((e) => console.warn("[badges-partenaire] lecture :", e?.message ?? e));
    };
    charger();
    const surChangement = (e: Event) => {
      if ((e as CustomEvent<{ athleteId?: string }>).detail?.athleteId === athleteId) charger();
    };
    window.addEventListener(EVENEMENT_BADGE_PARTENAIRE, surChangement);
    return () => { vivant = false; window.removeEventListener(EVENEMENT_BADGE_PARTENAIRE, surChangement); };
  }, [athleteId]);
  return badges;
}

export function BadgePartenaireVignette({
  badge,
  athleteId,
  actions = null,
}: {
  badge: BadgePartenaire;
  athleteId: string;
  actions?: "coach" | "partenaire" | null;
}) {
  const [confirmer, setConfirmer] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const agir = async (fn: () => Promise<void>) => {
    setOccupe(true);
    setErreur(null);
    try {
      await fn();
      signalerBadgesPartenaire(athleteId);
    } catch (e) {
      setErreur((e as { message?: string })?.message?.replace(/^NEXUS:\s*/, "") ?? "Action impossible.");
    } finally {
      setOccupe(false);
      setConfirmer(false);
    }
  };

  const peutRetirer = actions === "partenaire" && badge.estLeMien;
  const peutMasquer = actions === "coach" && badge.peutMasquer;

  return (
    <div
      className="flex flex-col items-center gap-[10px] shrink-0 w-[110px]"
      data-badge-partenaire
      title={`Badge ${badge.organisation}${badge.estMasque ? " — masqué par le coach" : ""}`}
    >
      {badge.estNexus && badge.codeNexus ? (
        /* Badge Nexus : le composant des Distinctions, tel quel (icône,
           libellé, reflet). Seule la signature dessous dit qui l'a posé. */
        <div className={badge.estMasque ? "opacity-35 grayscale" : ""}>
          <DistinctionBadge badge={badge.codeNexus} libelle={badge.libelle} />
        </div>
      ) : (
        <>
          <div className={`group w-[96px] h-[96px] flex items-center justify-center ${badge.estMasque ? "opacity-35 grayscale" : ""}`}>
            {badge.iconeUrl ? (
              /* Même conteneur que DistinctionBadge : `.nx-badge is-metal`,
                 l'icône en `--nx-mask` pour confiner le reflet à sa forme. */
              <div
                className="nx-badge w-[96px] h-[96px] is-metal"
                style={{ "--nx-mask": `url("${badge.iconeUrl}")` } as CSSProperties}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={badge.iconeUrl} alt="" className="nx-badge__img" draggable={false} />
              </div>
            ) : (
              <span className="w-[72px] h-[72px] rounded-full border border-[#2D3748] bg-[#13151a] flex items-center justify-center text-[22px] font-head font-black text-[#9CA3AF]">
                {badge.libelle.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <span className={`text-[11px] max-w-[110px] font-bold tracking-[0.1em] uppercase text-center leading-tight block ${badge.estMasque ? "text-[#6B7280]" : "text-[#E0E0E0]"}`}>
            {badge.libelle}
          </span>
        </>
      )}
      <span className="text-[10px] text-[#6B7280] text-center leading-tight -mt-[6px] max-w-[110px]">
        {badge.estMasque ? "Masqué" : badge.estNexus ? `par ${badge.organisation}` : badge.organisation}
      </span>

      {peutMasquer && (
        <button
          type="button"
          disabled={occupe}
          onClick={() => agir(() => masquerBadgePartenaire(createClient(), badge.id, !badge.estMasque))}
          className="text-[11px] font-semibold text-[#9CA3AF] hover:text-white underline underline-offset-2 disabled:opacity-50"
        >
          {badge.estMasque ? "Réafficher" : "Masquer"}
        </button>
      )}

      {peutRetirer && !confirmer && (
        <button
          type="button"
          disabled={occupe}
          onClick={() => setConfirmer(true)}
          className="text-[11px] font-semibold text-[#E63946] hover:underline underline-offset-2 disabled:opacity-50"
        >
          Retirer le badge
        </button>
      )}
      {peutRetirer && confirmer && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-[#c8c8cc] text-center">Retirer ce badge ?</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={occupe}
              onClick={() => agir(() => retirerBadgePartenaire(createClient(), badge.id))}
              className="text-[11px] font-bold text-white bg-[#E63946] rounded px-2 py-0.5 disabled:opacity-50"
            >
              Confirmer
            </button>
            <button
              type="button"
              disabled={occupe}
              onClick={() => setConfirmer(false)}
              className="text-[11px] font-semibold text-[#9CA3AF] hover:text-white"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      {erreur && <span className="text-[10px] text-[#EF4444] text-center max-w-[110px]">{erreur}</span>}
    </div>
  );
}
