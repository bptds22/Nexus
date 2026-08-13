"use client";

import { useState } from "react";

import LockedIdentityPlaceholder from "@/components/shared/LockedIdentityPlaceholder";

/* ═══════════════════════════════════════════════════════════════
   AthletePhotoFill — full-bleed athlete photo for cards/heroes.

   Sister to AthletePhoto (which handles fixed-size circular
   avatars). This one renders a photo that fills its parent
   container via absolute positioning + object-cover, falling
   back to a large translucent watermark-style initials display
   when the photo is missing or fails to load.

   Visual treatment of the no-photo branch mirrors what
   AthletePlayerCard.tsx already uses for empty hero photos —
   centered Outfit Black initials at low opacity (rgba 0.06)
   over the parent's background.

   Caller is responsible for:
     - Wrapping in a container with `relative` + a defined
       height so absolute children have a frame to fill
     - Background color on the wrapper (so the translucent
       initials sit on something visible)
     - Any decorative overlays (gradients, position chips,
       favorite hearts) — those go in sibling absolute elements

   Pure client component because onError is browser-state.
   onError swaps to the initials fallback automatically when
   the <img> fails to load (broken URL, expired signed token,
   network failure).

   initialsFontSize prop scales the watermark for different
   card heights:
     ~140px tall card  → 48
     ~180-280px card   → 72
     400px+ hero       → 120 (default)
═══════════════════════════════════════════════════════════════ */

interface AthletePhotoFillProps {
  photoUrl: string | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  /** Tailwind/className applied to the rendered <img> or fallback wrapper. */
  className?: string;
  /** Pixel font size for the watermark initials. Default 120. */
  initialsFontSize?: number;
  /**
   * Projection serveur (RPC recruteur) : false = identité masquée.
   *
   * Laisser `undefined` sur toute surface non-recruteur — le
   * comportement historique (photo, sinon initiales) est conservé
   * tel quel. Seul un `false` EXPLICITE verrouille.
   */
  identityVisible?: boolean;
}

export default function AthletePhotoFill({
  photoUrl,
  firstName,
  lastName,
  className = "",
  initialsFontSize = 120,
  identityVisible,
}: AthletePhotoFillProps) {
  const [hasError, setHasError] = useState(false);
  const showImage = !!photoUrl && !hasError;
  const f = (firstName ?? "").trim()[0] ?? "";
  const l = (lastName ?? "").trim()[0] ?? "";

  /* Identité verrouillée — AVANT la photo comme avant les initiales.
     Avant la photo : si un appelant tient encore une photo en cache
     alors que le serveur vient de masquer, on ne la rend pas.
     Avant les initiales : « G. M. » recoupé à l'école + la position
     + la promotion réidentifie. Voir LockedIdentityPlaceholder. */
  if (identityVisible === false) {
    return <LockedIdentityPlaceholder variant="fill" className={className} />;
  }

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl as string}
        alt={`${firstName ?? ""} ${lastName ?? ""}`.trim()}
        crossOrigin="anonymous"
        onError={() => setHasError(true)}
        className={`absolute inset-0 w-full h-full object-cover z-[1] ${className}`}
      />
    );
  }

  return (
    <div className={`absolute inset-0 z-[1] flex items-center justify-center ${className}`}>
      <span
        style={{
          fontFamily: "var(--font-outfit), sans-serif",
          fontSize: initialsFontSize,
          fontWeight: 900,
          color: "rgba(255,255,255,0.06)",
          letterSpacing: "0.05em",
          lineHeight: 1,
        }}
      >
        {f}
        {l}
      </span>
    </div>
  );
}
