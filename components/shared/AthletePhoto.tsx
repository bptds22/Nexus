"use client";

import { useState } from "react";

import LockedIdentityPlaceholder from "@/components/shared/LockedIdentityPlaceholder";

/* ═══════════════════════════════════════════════════════════════
   AthletePhoto — circular athlete photo with graceful fallback.

   Renders an <img> when photoUrl is provided AND the image
   actually loads. Falls back to a circular initials placeholder
   when:
     - photoUrl is null/empty
     - the <img> fires onError (broken URL, expired signed token,
       network failure, etc.)

   Drop-in replacement for the inline `{photoUrl ? <img /> :
   <div>{initials}</div>}` pattern that previously lived in every
   athlete-listing surface. Centralizing it means every page
   degrades to initials when a photo URL goes bad — no more
   broken-image artifacts leaking alt text.

   Pure client component because onError is browser-state.
   Server-rendered HTML can pass photoUrl through and hydration
   wires up the error handler. No data fetching here.

   Sizing is parametric (default 40px). Pass className for any
   layout-specific tweaks (margin, ring, etc.) that aren't part
   of the core circle/photo concern.
═══════════════════════════════════════════════════════════════ */

interface AthletePhotoProps {
  photoUrl: string | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  size?: number;
  className?: string;
  /** alt text override — defaults to "FirstName LastName" */
  alt?: string;
  /**
   * Projection serveur (RPC recruteur) : false = identité masquée.
   *
   * Laisser `undefined` sur toute surface non-recruteur — le
   * comportement historique (photo, sinon initiales) est conservé
   * tel quel. Seul un `false` EXPLICITE verrouille.
   */
  identityVisible?: boolean;
}

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? "").trim()[0] ?? "";
  const l = (lastName ?? "").trim()[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

export default function AthletePhoto({
  photoUrl,
  firstName,
  lastName,
  size = 40,
  className = "",
  alt,
  identityVisible,
}: AthletePhotoProps) {
  const [hasError, setHasError] = useState(false);
  const showImage = !!photoUrl && !hasError;
  const initials = getInitials(firstName, lastName);
  const altText = alt ?? `${firstName ?? ""} ${lastName ?? ""}`.trim();

  // Initials font size scales with circle size — 12px at 40,
  // gives proportional sizing for both small avatars (32) and
  // larger thumbnails (80).
  const fontSize = Math.max(10, Math.round(size * 0.3));

  /* Identité verrouillée — AVANT la photo comme avant les initiales.
     Avant la photo : si un appelant tient encore une photo en cache
     alors que le serveur vient de masquer, on ne la rend pas.
     Avant les initiales : « G. M. » recoupé à l'école + la position
     + la promotion réidentifie. Voir LockedIdentityPlaceholder. */
  if (identityVisible === false) {
    return <LockedIdentityPlaceholder variant="circle" size={size} className={className} />;
  }

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl as string}
        alt={altText}
        onError={() => setHasError(true)}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize }}
      className={`rounded-full bg-[#2D3748] flex items-center justify-center font-bold text-white/60 shrink-0 ${className}`}
      aria-label={altText || "Athlète"}
    >
      {initials}
    </div>
  );
}
