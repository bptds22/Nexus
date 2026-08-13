/* ═══════════════════════════════════════════════════════════════
   LockedIdentityPlaceholder — visuel « identité verrouillée ».

   Rendu quand la projection serveur a masqué l'identité d'un
   athlète (RPC recruteur : identity_visible = false). Les deux
   critères qui mènent ici sont indépendants et ne se rachètent
   pas l'un l'autre :
     - Loi 25 — athlete_identity_ok() est faux (mineur sans
       consentement parental) ;
     - tier — le recruteur est FREE.

   POURQUOI JAMAIS D'INITIALES ICI
   Les initiales sont une divulgation partielle : « G. M. » sur
   une carte qui porte déjà l'école, la position, la promotion et
   la cote réduit l'ensemble des candidats à une poignée. C'est
   une réidentification par recoupement, exactement ce que le
   masquage serveur cherche à empêcher. La branche placeholder
   doit donc passer AVANT la branche initiales chez tous les
   appelants — jamais après.

   L'ASSET
   /images/placeholders/placeholder-athlete.svg (Cody) : carré
   512×512, fond #1A1D24 opaque, filigrane de flammes Nexus et
   buste centré. Il porte son propre fond — d'où l'absence de
   couleur de conteneur ici, contrairement à la version SVG inline
   qu'il remplace.

   Le sujet est centré en x (256/512) et le buste occupe la bande
   y 122→420, ce qui laisse le recadrage `object-cover` propre aux
   deux échelles utilisées : pastille ~40px et héros ~120px+.

   Une variante `-transparent.svg` existe pour un futur besoin de
   pose sur fond de conteneur ; elle n'est pas utilisée ici.
═══════════════════════════════════════════════════════════════ */

/** Chemin unique de l'asset — le seul endroit à toucher pour un futur swap. */
const PLACEHOLDER_SRC = "/images/placeholders/placeholder-athlete.svg";

const LABEL = "Identité réservée";

interface LockedIdentityPlaceholderProps {
  /**
   * "fill"   — remplit un parent `relative` (cartes, héros), pour AthletePhotoFill.
   * "circle" — pastille de taille fixe, pour AthletePhoto.
   */
  variant: "fill" | "circle";
  /** Côté du cercle en px. Ignoré en variant "fill". Défaut 40. */
  size?: number;
  className?: string;
}

export default function LockedIdentityPlaceholder({
  variant,
  size = 40,
  className = "",
}: LockedIdentityPlaceholderProps) {
  if (variant === "fill") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={PLACEHOLDER_SRC}
        alt={LABEL}
        title={LABEL}
        className={`absolute inset-0 w-full h-full object-cover z-[1] ${className}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PLACEHOLDER_SRC}
      alt={LABEL}
      title={LABEL}
      style={{ width: size, height: size }}
      className={`rounded-full object-cover shrink-0 ${className}`}
    />
  );
}
