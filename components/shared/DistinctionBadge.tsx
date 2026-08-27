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
  /** Taille EXPLICITE. Omise, le badge est toujours `lg` — la taille ne
   *  dépend plus du nombre de badges (voir effectiveSize plus bas).
   *  `xs` = rangée compacte 28 px : ni reflet ni onde (illisibles à cette taille). */
  size?: "xs" | "sm" | "lg";
  /**
   * @deprecated N'A PLUS AUCUN EFFET.
   *
   * Il pilotait la taille (`count >= 6 → sm`) ; la taille est désormais
   * constante. Le décalage de la frappe de déblocage suit `index` seul, pas
   * `count` — vérifié : `(index ?? 0) * 80ms`.
   *
   * La prop est CONSERVÉE, et acceptée sans rien faire, pour ne pas casser
   * les deux appelants qui la passent encore (/athlete/profil et la fiche
   * partenaire). À retirer quand ils auront été nettoyés — pas avant, un
   * changement de signature pour une prop inerte ne vaut pas un build cassé.
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
  badge, detail, size, index, attribueLe, unlock, libelle,
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

  /* ── LA TAILLE NE DÉPEND PLUS DU NOMBRE ───────────────────────
     Il y avait ici un seuil : `count >= 6 → sm`, sinon `lg`. Combiné au
     `n === 1 ? "lg" : "sm"` d'AdaptiveBadgesRow, un même badge changeait de
     taille selon le nombre de ses voisins — un athlète qui en gagnait un
     second voyait le premier rapetisser.

     Décision : la taille du badge SEUL devient LA taille. `lg` par défaut,
     toujours. Les deux surfaces qui passaient `count` (/athlete/profil et la
     fiche partenaire) sont en conteneur `flex-wrap` : elles enroulent
     naturellement au lieu de déborder, il n'y a donc rien à compenser.

     `count` reste ACCEPTÉ en prop mais n a plus aucun effet (voir sa doc) :
     le décalage de la frappe de déblocage suit `index` seul.
     Une taille EXPLICITE gagne toujours : `xs` (rangée compacte 28 px) et
     `sm` restent disponibles pour les appelants qui les demandent. */
  const effectiveSize: "xs" | "sm" | "lg" = size ?? "lg";

  // Uniform outer tile + icon box so every badge occupies the same footprint
  // regardless of the SVG's natural aspect ratio.
  /* La CELLULE reste etroite meme si la boite grandit. Elle ne sert qu'a
     borner le retour a la ligne du libelle ; c'est elle, pas le picto, qui
     decide si les 5 badges tiennent sur UNE ligne. La rangee de la fiche fait
     852 px avec gap-9 : 5 x 152 + 4 x 36 = 904 px et le cinquieme tombait a la
     ligne. A 136 : 5 x 136 + 4 x 36 = 824 px. La regle des 5 sur une ligne est
     la raison d'etre du plafond (voir badge_plafond) — elle prime sur le
     confort du libelle. */
  const outerW = effectiveSize === "xs" ? "w-[28px]" : effectiveSize === "sm" ? "w-[96px]" : "w-[136px]";
  /* `lg` passe de 88 à 104 px. Le PICTO n'en occupe que 57,7 % : les SVG
     « biseau » dessinent le glyphe sur ~150 unités d'un viewBox de 260, le
     reste étant la marge où le halo déborde. À 104 px le picto visible fait
     donc ~60 px — l'agrandissement du conteneur ne rend qu'une partie du
     gain, et le vrai levier est la proportion dans le fichier. */
  const iconBox = effectiveSize === "xs" ? "w-7 h-7" : effectiveSize === "sm" ? "w-16 h-16" : "w-[104px] h-[104px]";
  const labelCls = effectiveSize === "sm" ? "text-[10px] max-w-[96px]" : "text-[11px] max-w-[136px]";

  /* 80 ms. Les etoiles de la carte sont CONTIGUES : un seul reflet les
     traverse toutes, la vague est dans le mouvement. Les badges sont separes
     par 32 px de vide — sans decalage, cinq bandes apparaissent et
     disparaissent ensemble, ce qui se lit comme un clignotement et non comme
     un balayage. UNE SEULE valeur pour les trois animations (reflet, frappe,
     onde) : deux cadences differentes sur la meme rangee se verraient. */
  const decalage = `${(index ?? 0) * 80}ms`;
  /* Le cycle du régime permanent se répartit sur ses 6 s, pas sur les 80 ms du
     montage : décalés de 80 ms, cinq badges balaieraient quasi ensemble une
     fois par cycle. 1100 ms par rang -> il y a toujours un balayage quelque
     part dans la rangée. */
  const decalageCycle = `${(index ?? 0) * 1100}ms`;
  // Le survol N'EST PAS posé sur .nx-badge : `is-fresh` y anime déjà
  // `transform`, et une animation CSS l'emporte sur une transition portant la
  // même propriété — le badge frais aurait cessé de réagir au survol. Le
  // zoom vit donc sur l'enveloppe, l'animation sur le badge.
  const classes = [
    "nx-badge", iconBox,
    effectiveSize === "xs" ? "nx-badge--xs" : "",
    /* `is-metal` sans condition : ce composant ne rend QUE des badges
       attribués. Un badge affiché ici est, par construction, obtenu. */
    effectiveSize !== "xs" ? "is-metal" : "",
    estFrais && effectiveSize !== "xs" ? "is-fresh" : "",
    unlock ? "is-unlocking" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={`flex flex-col items-center ${effectiveSize === "xs" ? "" : "gap-[10px]"} cursor-pointer group shrink-0 ${outerW}`}>
      <div className="relative transition-transform duration-300 group-hover:scale-[1.18] group-hover:-translate-y-[3px]">
        {/* La lueur CSS est RETIRÉE : les SVG portent de nouveau leur halo,
            mais À L'INTÉRIEUR — il suit la forme du picto au lieu d'être un
            cercle derrière, ce qu'un radial-gradient ne sait pas faire. Le
            viewBox passe de 200 à 260 pour lui laisser la marge de débord.
            Garder .nx-badge__glow en superposerait deux. */}
        <div
          className={classes}
          // --nx-mask confine le reflet à la SILHOUETTE du badge : sans lui,
          // la bande balaierait le carré entier, coins transparents compris.
          // Même URL que le <img>, donc aucun aller-retour réseau en plus.
          style={{
            "--nx-mask": `url("${svg}")`,
            "--nx-delay": decalage,
            "--nx-cycle-delay": decalageCycle,
          } as React.CSSProperties}
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
