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

/* Badge cadenas, coin inférieur droit.
   L'asset seul ne dit pas POURQUOI il n'y a pas de photo : sur une
   pastille de 40px il n'y a ni nom ni libellé à côté, donc rien ne
   distingue « identité verrouillée » de « athlète sans photo ». Le
   cadenas porte cette différence. Il est décoratif au sens ARIA —
   le sens est déjà dans l'alt de l'image. */
function LockBadge({ px }: { px: number }) {
  return (
    <span
      className="absolute rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center"
      style={{ width: px, height: px, right: Math.round(px * 0.12), bottom: Math.round(px * 0.12) }}
      aria-hidden="true"
    >
      <svg
        width={Math.round(px * 0.62)}
        height={Math.round(px * 0.62)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9CA3AF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    </span>
  );
}

export default function LockedIdentityPlaceholder({
  variant,
  size = 40,
  className = "",
}: LockedIdentityPlaceholderProps) {
  if (variant === "fill") {
    return (
      <span className={`absolute inset-0 z-[1] block ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PLACEHOLDER_SRC}
          alt={LABEL}
          title={LABEL}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <LockBadge px={22} />
      </span>
    );
  }

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PLACEHOLDER_SRC}
        alt={LABEL}
        title={LABEL}
        className="w-full h-full rounded-full object-cover"
      />
      {/* En dessous de ~28px le badge mangerait la silhouette. */}
      {size >= 28 && <LockBadge px={Math.max(12, Math.round(size * 0.36))} />}
    </span>
  );
}
