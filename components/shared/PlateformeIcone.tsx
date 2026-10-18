/* ═══════════════════════════════════════════════════════════════
   PlateformeIcone — la marque derrière un lien externe.

   Les réseaux sociaux et YouTube portent leur LOGO OFFICIEL (chemins
   simple-icons, lib/brand/logosMarques, partagés avec components/marketing/SocialIcons —
   décision BP 2026-10-18 : « utilise les logos de ces compagnies »).
   Vimeo, X et Drive restent des marques simplifiées dessinées ici.
   Aucun appel réseau vers un CDN d'icônes.

   `autre` rend un maillon de chaîne en gris : un domaine inconnu ne
   reçoit ni couleur inventée ni marque empruntée.

   La teinte vient de TEINTE_PLATEFORME (lib/config/plateformesLien),
   pour que le vocabulaire de couleur ne se dédouble pas.
═══════════════════════════════════════════════════════════════ */

import { TEINTE_PLATEFORME, type ClePlateforme } from "@/lib/config/plateformesLien";
import { LOGO_MARQUE } from "@/lib/brand/logosMarques";

export default function PlateformeIcone({
  cle,
  size = 18,
  className,
}: {
  cle: ClePlateforme;
  size?: number;
  className?: string;
}) {
  const teinte = TEINTE_PLATEFORME[cle];
  const commun = {
    width: size, height: size, viewBox: "0 0 24 24",
    className, "aria-hidden": true as const,
  };

  switch (cle) {
    case "youtube":
      return <svg {...commun} fill={teinte}><path d={LOGO_MARQUE.youtube} /></svg>;
    case "hudl":
      /* ⚠️ SEULE icône matricielle du jeu, et c'est PROVISOIRE.
         Le triskèle Hudl n'est pas redessinable de mémoire sans trahir une
         marque tierce ; le fichier officiel fourni était un PNG. Il a été
         ramené de 2814px / 40 Ko à 72px / 2,6 Ko — quatre fois l'usage 18px,
         de quoi tenir les écrans haute densité sans peser.
         Le SVG officiel, dès qu'il arrive, remplace ce bloc et rien d'autre :
         le reste du composant ne change pas. Voir docs/fast-follow-1.4.2.md. */
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brand/platforms/hudl.png"
          alt=""
          width={size}
          height={size}
          className={className}
          aria-hidden
          /* Le PNG porte déjà l'orange de marque : rien à teinter. Cohérent
             avec YouTube et Instagram, qui portent aussi leur couleur. */
          style={{ display: "block" }}
        />
      );
    case "instagram":
      return <svg {...commun} fill={teinte}><path d={LOGO_MARQUE.instagram} /></svg>;
    case "vimeo":
      return (
        <svg {...commun} fill="none" stroke={teinte} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.5c1.5-1.6 3-2.6 4-2.2 1.2.5 1.4 2.6 1.9 5 .6 2.7 1.1 4 2 4 1.4 0 3.6-3.4 3.8-5.6.2-1.9-.6-2.6-1.9-2.1 1-3.2 4.6-4 6.2-2 1.4 1.8.6 5-1.8 8.6C14.7 17.7 12.3 20 10.4 20c-2 0-3-2.5-4-6.3-.7-2.7-1-4-1.7-4-.3 0-.8.4-1.7 1.2z" />
        </svg>
      );
    case "tiktok":
      /* Le noir officiel de TikTok disparaîtrait sur le fond sombre : on garde la teinte cyan. */
      return <svg {...commun} fill={teinte}><path d={LOGO_MARQUE.tiktok} /></svg>;
    case "x":
      return (
        <svg {...commun} fill={teinte}>
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
        </svg>
      );
    case "facebook":
      return <svg {...commun} fill={teinte}><path d={LOGO_MARQUE.facebook} /></svg>;
    case "linkedin":
      return <svg {...commun} fill={teinte}><path d={LOGO_MARQUE.linkedin} /></svg>;
    case "drive":
      return (
        <svg {...commun} fill="none" stroke={teinte} strokeWidth="2" strokeLinejoin="round">
          <path d="M9 3h6l6 10.5-3 5.5H6l-3-5.5z" />
          <path d="M9 3 3 13.5M15 3l6 10.5M6 19l3-5.5h12" />
        </svg>
      );
    default:
      /* Maillon de chaîne — un lien, sans promesse de marque. */
      return (
        <svg {...commun} fill="none" stroke={teinte} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </svg>
      );
  }
}
