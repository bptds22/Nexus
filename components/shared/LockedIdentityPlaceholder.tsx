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

   L'asset définitif (silhouette dessinée par Cody) remplacera le
   SVG ci-dessous. Il est isolé ici pour que le swap soit local à
   ce fichier et ne touche aucun appelant.
═══════════════════════════════════════════════════════════════ */

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

/** Silhouette + cadenas, dimensionnés par le conteneur. */
function LockedMark({ px }: { px: number }) {
  // Le cadenas est un badge sur l'épaule droite de la silhouette :
  // il porte le sens (« verrouillé »), la silhouette porte la forme.
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: px, height: px }}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <svg
        width={Math.max(10, Math.round(px * 0.34))}
        height={Math.max(10, Math.round(px * 0.34))}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6b7280"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="absolute"
        style={{ right: -1, bottom: -1 }}
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
      <div
        className={`absolute inset-0 z-[1] flex items-center justify-center bg-[#2F3440] ${className}`}
        aria-label="Identité réservée"
        title="Identité réservée"
      >
        <LockedMark px={64} />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full bg-[#2F3440] flex items-center justify-center shrink-0 ${className}`}
      aria-label="Identité réservée"
      title="Identité réservée"
    >
      <LockedMark px={Math.max(14, Math.round(size * 0.55))} />
    </div>
  );
}
