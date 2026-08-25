"use client";
import React, { useEffect, useState } from "react";
import { BADGE_CONFIG, badgeSvgPath } from "@/lib/config/badges";
import "@/components/badges/distinction-badges.css";

/* ═══════════════════════════════════════════════════════════════
   Les 7 SVG en dur (164 lignes) ont été remplacés par les 22 fichiers
   de public/badges/, chargés en <img>.

   POURQUOI <img> ET NON DE L'INLINE : chaque <img> charge le SVG dans un
   DOCUMENT ISOLÉ. Les 132 identifiants internes des 22 fichiers n'y sont
   visibles que d'eux-mêmes. Deux badges différents côte à côte, ou vingt
   fois le même : aucune collision possible, par construction et non par
   convention de nommage. En inline, le suffixage par code règle le premier
   cas mais PAS le second — deux instances du même badge dupliqueraient
   leurs ids dans le document, et `url(#…)` se résoudrait vers la première.
   Bénéfice annexe : les fichiers sortent du bundle JS et sont mis en cache.
═══════════════════════════════════════════════════════════════ */

interface Props {
  badge: string;
  detail?: string;
  /** Explicit size — if omitted, auto-derives from `count` (sm when count >= 4, else lg).
   *  `xs` = rangée compacte 28 px : ni reflet ni onde (illisibles à cette taille). */
  size?: "xs" | "sm" | "lg";
  /**
   * Total distinctions in the same row. When provided and `size`
   * is not explicit, badges auto-shrink to "sm" at 4+ distinctions
   * so they stay on a single row at typical container widths.
   * Both /athlete/profil and the partner profile pass count.
   */
  count?: number;
  index?: number;
  /** Date d'attribution ISO. Dans les 48 h, le badge respire et reflète. */
  attribueLe?: string | null;
  /** Joue la frappe de déblocage. Le décalage entre badges suit `index`. */
  unlock?: boolean;
  /**
   * VOIE 2 — le libellé, fourni par l'appelant.
   *
   * Passé, il fait autorité. Absent, on retombe sur BADGE_CONFIG, qui ne
   * connaît que les 7 codes hérités : c'est ce qui laisse les surfaces
   * basculer une par une sans rien casser au passage.
   *
   * POURQUOI EN PROP ET PAS UN HOOK
   * Un hook sur le catalogue rendrait ce composant dépendant du réseau. Il
   * est rendu dans des LISTES : le temps que le catalogue arrive, chaque
   * badge rendrait null, et une fiche se peuplerait par à-coups. Il reste
   * donc pur et synchrone, et la charge va aux appelants — qui, pour la
   * plupart, ont déjà le catalogue en main.
   */
  libelle?: string;
}

const FENETRE_FRAICHEUR_MS = 48 * 60 * 60 * 1000;

/** Une alerte par code et par session — sinon chaque rendu la répète. */
const dejaSignales = new Set<string>();
function signalerUneFois(cle: string, message: string) {
  if (dejaSignales.has(cle)) return;
  dejaSignales.add(cle);
  console.warn(message);
}

function getBadgeLabel(
  badge: string,
  detail: string | undefined,
  config: { label: string; hasDetail: boolean } | undefined,
  libelle: string | undefined,
) {
  // `custom` (aujourd'hui) = `nexus-x` (catalogue) : le CONTEXTE saisi par le
  // coach tient lieu de libellé et s'affiche SEUL — « Joueur défensif de la
  // ligue », sans préfixe. Le libellé du catalogue (« Custom ») ne sert qu'au
  // picker.
  //
  // ⚠ LE JOUR DE LA VOIE 2 — quand les appelants liront athlete_badges au lieu
  // de evaluations.distinctions — les codes reçus ici seront ceux du
  // catalogue. Cette condition devra alors devenir `badge === "nexus-x"`,
  // SINON « Custom » s'affichera à la place du contexte du coach, et personne
  // ne se souviendra pourquoi. La condition ci-dessous accepte déjà les deux
  // pour que la bascule ne dépende pas d'un oubli.
  if (badge === "custom" || badge === "nexus-x") return detail || "Distinction";

  /* Le libellé de l'appelant l'emporte. Le contexte s'y accole s'il existe :
     au catalogue, « a un contexte » n'est plus une propriété du LIBELLÉ
     (config.hasDetail) mais du badge (requiertContexte), et un contexte
     présent mérite d'être montré quel que soit le drapeau. */
  if (libelle) return detail ? `${libelle} — ${detail}` : libelle;

  if (!config) return detail || "Distinction";
  if (config.hasDetail && detail) return `${config.label} — ${detail}`;
  return config.label;
}

export default function DistinctionBadge({
  badge, detail, size, count, index, attribueLe, unlock, libelle,
}: Props) {
  // La fraîcheur est calculée APRÈS montage, jamais au rendu serveur : le
  // build mobile est un export statique, un `Date.now()` évalué à la
  // compilation serait figé au jour du build. Le passer en état évite aussi
  // toute divergence d'hydratation.
  const [estFrais, setEstFrais] = useState(false);
  useEffect(() => {
    if (!attribueLe) return;
    const t = new Date(attribueLe).getTime();
    if (Number.isNaN(t)) return;
    setEstFrais(Date.now() - t < FENETRE_FRAICHEUR_MS);
  }, [attribueLe]);

  const config = BADGE_CONFIG[badge];
  const svg = badgeSvgPath(badge);

  // `progression` tombe ici : aucun équivalent au catalogue des 22. On ne rend
  // RIEN plutôt qu'un badge faux — mais on le dit, sinon la disparition est
  // silencieuse et personne ne la remarque.
  if (!svg) {
    signalerUneFois(`svg:${badge}`,
      `NEXUS: badge « ${badge} » sans équivalent au catalogue des 22 — non affiché. ` +
      `Voir LEGACY_BADGE_TO_CATALOGUE dans lib/config/badges.ts.`);
    return null;
  }
  /* Le refus ne porte plus que sur le cas VRAIMENT insoluble : ni libellé
     fourni, ni entrée héritée. Un code de catalogue accompagné de son
     libellé passe désormais — c'est toute la bascule voie 2. */
  if (!config && !libelle) {
    signalerUneFois(`config:${badge}`,
      `NEXUS: badge « ${badge} » sans libellé et absent de BADGE_CONFIG — non affiché. ` +
      `Un code de catalogue est arrivé sans sa prop \`libelle\` : l'appelant a ` +
      `basculé voie 2 à moitié.`);
    return null;
  }

  const label = getBadgeLabel(badge, detail, config, libelle);

  // Auto-derive size from count when no explicit size is passed.
  // Explicit size always wins (back-compat).
  /* Seuil de bascule remonté de 4 à 6. À 4, presque tous les athlètes
     tombaient en `sm` : un porteur typique en a 4 à 7, donc la « grande »
     taille ne servait quasiment jamais. 6 laisse respirer le cas courant et
     ne compacte que les fiches réellement chargées. */
  const effectiveSize: "xs" | "sm" | "lg" = size ?? (count !== undefined && count >= 6 ? "sm" : "lg");

  // Uniform outer tile + icon box so every badge occupies the same footprint
  // regardless of the SVG's natural aspect ratio.
  const outerW = effectiveSize === "xs" ? "w-[28px]" : effectiveSize === "sm" ? "w-[96px]" : "w-[128px]";
  const iconBox = effectiveSize === "xs" ? "w-7 h-7" : effectiveSize === "sm" ? "w-16 h-16" : "w-[88px] h-[88px]";
  const labelCls = effectiveSize === "sm" ? "text-[10px] max-w-[96px]" : "text-[11px] max-w-[128px]";

  const decalage = `${(index ?? 0) * 90}ms`;
  // Le survol N'EST PAS posé sur .nx-badge : `is-fresh` y anime déjà
  // `transform`, et une animation CSS l'emporte sur une transition portant la
  // même propriété — le badge frais aurait cessé de réagir au survol. Le
  // zoom vit donc sur l'enveloppe, l'animation sur le badge.
  const classes = [
    "nx-badge", iconBox,
    effectiveSize === "xs" ? "nx-badge--xs" : "",
    estFrais && effectiveSize !== "xs" ? "is-fresh" : "",
    unlock ? "is-unlocking" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={`flex flex-col items-center ${effectiveSize === "xs" ? "" : "gap-[10px]"} cursor-pointer group shrink-0 ${outerW}`}>
      <div className="relative transition-transform duration-300 group-hover:scale-[1.18] group-hover:-translate-y-[3px]">
        {/* La lueur est SŒUR du badge, pas son enfant : .nx-badge porte
            overflow:hidden pour le reflet, ce qui rognerait le halo au carré
            du conteneur. Ici rien ne la rogne. */}
        <span className="nx-badge__glow" aria-hidden="true" />
        <div
          className={classes}
          // --nx-mask confine le reflet à la SILHOUETTE du badge : sans lui,
          // la bande balaierait le carré entier, coins transparents compris.
          // Même URL que le <img>, donc aucun aller-retour réseau en plus.
          style={{ "--nx-mask": `url("${svg}")`, "--nx-delay": decalage } as React.CSSProperties}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svg} alt="" className="nx-badge__img" draggable={false} />
        </div>
        {unlock && effectiveSize !== "xs" && (
          <span className="nx-badge-wave" aria-hidden="true" style={{ "--nx-delay": decalage } as React.CSSProperties} />
        )}
      </div>
      {effectiveSize !== "xs" && (
        <span className={`${labelCls} font-bold tracking-[0.1em] uppercase text-center text-[#E0E0E0] leading-tight block`}>
          {label}
        </span>
      )}
    </div>
  );
}
