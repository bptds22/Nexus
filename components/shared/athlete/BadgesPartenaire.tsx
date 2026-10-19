"use client";

/* ═══════════════════════════════════════════════════════════════
   Badges PARTENAIRE (lot W3) — ajoutés À LA FIN de la rangée
   « Distinctions », avec leur propre icône.

   TAILLE (décision BP du 2026-10-15, corrigée le même jour) :
   - badge Nexus posé par un partenaire (W3b) : gabarit des Distinctions
     (`lg`, cellule 110 px, picto 96 px), comme tous les badges Nexus ;
   - badge PROPRE au partenaire : ~40 % plus grand (tailleBadgeFiche.ts :
     boîte carrée 134 px bureau, 120 px mobile, image centrée en contain).

   LA LIGNE DU PARTENAIRE (décision BP du 2026-10-15) :
   - badge Nexus posé par un partenaire (W3b) : « par <organisation> » reste
     dessous — sans elle, on croirait que c'est le coach qui l'a donné ;
   - badge PROPRE au partenaire (son image) : plus de nom dessous, l'image
     le dit déjà. Le nom reste dans l'infobulle.

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
import { FICHE_BOITE, FICHE_CELLULE, FICHE_LIBELLE } from "@/components/shared/athlete/tailleBadgeFiche";
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
  zoneImage,
}: {
  badge: BadgePartenaire;
  athleteId: string;
  actions?: "coach" | "partenaire" | null;
  /** Badge Nexus : zone d'image de la rangée (zoneImageRangee), pour aligner son libellé. */
  zoneImage?: string;
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
      className={`flex flex-col items-center gap-[10px] shrink-0 ${badge.estNexus ? "w-[110px]" : FICHE_CELLULE}`}
      data-badge-partenaire
      title={`Badge ${badge.organisation}${badge.estMasque ? " — masqué par le coach" : ""}`}
    >
      {badge.estNexus && badge.codeNexus ? (
        /* Badge Nexus : le composant des Distinctions, tel quel (icône,
           libellé, reflet). Seule la signature dessous dit qui l'a posé. */
        <div className={badge.estMasque ? "opacity-35 grayscale" : ""}>
          <DistinctionBadge badge={badge.codeNexus} libelle={badge.libelle} zoneImage={zoneImage} />
        </div>
      ) : (
        <>
          <div className={`group ${FICHE_BOITE} flex items-center justify-center ${badge.estMasque ? "opacity-35 grayscale" : ""}`}>
            {badge.iconeUrl ? (
              /* Même conteneur que DistinctionBadge : `.nx-badge is-metal`,
                 l'icône en `--nx-mask` pour confiner le reflet à sa forme. */
              <div
                className={`nx-badge ${FICHE_BOITE} is-metal`}
                style={{ "--nx-mask": `url("${badge.iconeUrl}")` } as CSSProperties}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={badge.iconeUrl} alt="" className="nx-badge__img" draggable={false} />
              </div>
            ) : (
              <span className="w-[90px] h-[90px] sm:w-[100px] sm:h-[100px] rounded-full border border-[#2D3748] bg-[#13151a] flex items-center justify-center text-[22px] font-head font-black text-[#9CA3AF]">
                {badge.libelle.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <span className={`${FICHE_LIBELLE} font-bold tracking-[0.1em] uppercase text-center leading-tight block ${badge.estMasque ? "text-[#6B7280]" : "text-[#E0E0E0]"}`}>
            {badge.libelle}
          </span>
        </>
      )}
      {/* Badge Nexus posé par un partenaire : « par <organisation> » (sinon on croit au coach).
          Badge propre au partenaire : aucune ligne — son image le dit. « Masqué » reste dit. */}
      {(badge.estMasque || badge.estNexus) && (
        <span className={`text-[10px] text-[#6B7280] text-center leading-tight -mt-[6px] ${badge.estNexus ? "max-w-[110px]" : "max-w-[140px] sm:max-w-[154px]"}`} data-ligne-partenaire>
          {badge.estMasque ? "Masqué" : `par ${badge.organisation}`}
        </span>
      )}

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

      {/* BP 2026-10-19 : pas de confirmation, un badge se réattribue facilement. */}
      {peutRetirer && !confirmer && (
        <button
          type="button"
          disabled={occupe}
          onClick={() => agir(() => retirerBadgePartenaire(createClient(), badge.id))}
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
      {erreur && <span className="text-[10px] text-[#EF4444] text-center max-w-[140px] sm:max-w-[154px]">{erreur}</span>}
    </div>
  );
}
