/* ═══════════════════════════════════════════════════════════════
   PlateformeIcone — la marque derrière un lien externe.

   Des marques SIMPLIFIÉES, dessinées ici : pas de logo officiel
   importé, pas d'appel réseau vers un CDN d'icônes. Chacune doit
   rester reconnaissable à 18px, taille à laquelle un logo fidèle
   devient une tache.

   `autre` rend un maillon de chaîne en gris : un domaine inconnu ne
   reçoit ni couleur inventée ni marque empruntée.

   La teinte vient de TEINTE_PLATEFORME (lib/config/plateformesLien),
   pour que le vocabulaire de couleur ne se dédouble pas.
═══════════════════════════════════════════════════════════════ */

import { TEINTE_PLATEFORME, type ClePlateforme } from "@/lib/config/plateformesLien";

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
      return (
        <svg {...commun} fill={teinte}>
          <path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C4.7 19 12 19 12 19s7.3 0 8.8-.5a2.5 2.5 0 0 0 1.8-1.8C23 15.2 23 12 23 12z" />
          <polygon points="10,15.2 15.5,12 10,8.8" fill="#111317" />
        </svg>
      );
    case "hudl":
      /* Le « h » de Hudl, ramené à deux montants et une traverse. */
      return (
        <svg {...commun} fill="none" stroke={teinte} strokeWidth="2.6" strokeLinecap="round">
          <line x1="6" y1="4" x2="6" y2="20" />
          <line x1="18" y1="11" x2="18" y2="20" />
          <path d="M6 12c0-2.2 1.8-4 4-4h4a4 4 0 0 1 4 4" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...commun} fill="none" stroke={teinte} strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1.1" fill={teinte} stroke="none" />
        </svg>
      );
    case "vimeo":
      return (
        <svg {...commun} fill="none" stroke={teinte} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.5c1.5-1.6 3-2.6 4-2.2 1.2.5 1.4 2.6 1.9 5 .6 2.7 1.1 4 2 4 1.4 0 3.6-3.4 3.8-5.6.2-1.9-.6-2.6-1.9-2.1 1-3.2 4.6-4 6.2-2 1.4 1.8.6 5-1.8 8.6C14.7 17.7 12.3 20 10.4 20c-2 0-3-2.5-4-6.3-.7-2.7-1-4-1.7-4-.3 0-.8.4-1.7 1.2z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...commun} fill="none" stroke={teinte} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 4c.4 2.4 2.1 4 4.5 4.2" />
        </svg>
      );
    case "x":
      return (
        <svg {...commun} fill="none" stroke={teinte} strokeWidth="2.2" strokeLinecap="round">
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...commun} fill={teinte}>
          <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
        </svg>
      );
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
