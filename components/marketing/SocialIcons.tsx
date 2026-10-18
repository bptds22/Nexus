"use client";

import * as React from "react";
import { LOGO_MARQUE } from "@/lib/brand/logosMarques";

/* ─────────────────────────────────────────────────────────────────
   SocialIcons — homepage social-icon system, extracted from Footer.tsx
   so it can be reused verbatim (naked icon, no circle, per-platform
   brand colour on hover via --hover-color read by the global
   `.nx-social-icon` rule in globals.css). Consumed by the marketing
   Footer AND the team-page hero. Icon paths = the exact homepage set.
   (No X/Twitter — not part of the homepage set.)
───────────────────────────────────────────────────────────────────*/

// x + website ajoutés pour l'éditeur « Page équipe » (liste de liens libre) :
// additif, aucun consommateur existant ne les émet.
export type SocialPlatform = "instagram" | "facebook" | "youtube" | "tiktok" | "x" | "website";

export const SOCIAL_ICON_DATA: Record<SocialPlatform, { hoverColor: string; d: string }> = {
  instagram: {
    hoverColor: "#E1306C",
    d: LOGO_MARQUE.instagram,
  },
  facebook: {
    hoverColor: "#1877F2",
    d: LOGO_MARQUE.facebook,
  },
  youtube: {
    hoverColor: "#FF0000",
    d: LOGO_MARQUE.youtube,
  },
  tiktok: {
    hoverColor: "#25F4EE",
    d: LOGO_MARQUE.tiktok,
  },
  x: {
    hoverColor: "#FFFFFF",
    d: "M18.9 1.153h3.682l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.153h7.594l5.243 6.932zm-1.292 19.482h2.04L6.486 3.24H4.298z",
  },
  website: {
    hoverColor: "#8A909C",
    d: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm7.938 7h-3.06a15.6 15.6 0 0 0-1.66-4.14A10.03 10.03 0 0 1 19.938 7zM12 2.04c.83 1.2 1.48 2.79 1.87 4.96h-3.74c.39-2.17 1.04-3.76 1.87-4.96zM2.06 14a9.9 9.9 0 0 1 0-4h3.5a20 20 0 0 0 0 4zm.82 2h3.06c.37 1.5.92 2.9 1.66 4.14A10.03 10.03 0 0 1 2.88 16zm3.06-9H2.88a10.03 10.03 0 0 1 4.72-4.14A15.6 15.6 0 0 0 5.94 7zM12 21.96c-.83-1.2-1.48-2.79-1.87-4.96h3.74c-.39 2.17-1.04 3.76-1.87 4.96zM14.28 15H9.72a17.9 17.9 0 0 1 0-6h4.56a17.9 17.9 0 0 1 0 6zm.12 5.14c.74-1.24 1.29-2.64 1.66-4.14h3.06a10.03 10.03 0 0 1-4.72 4.14zM18.44 14a20 20 0 0 0 0-4h3.5a9.9 9.9 0 0 1 0 4z",
  },
};

export interface SocialLink {
  platform: SocialPlatform;
  href: string;
}

export default function SocialIcons({ links, size = 20 }: { links: SocialLink[]; size?: number }) {
  return (
    <>
      {links
        .filter((l) => SOCIAL_ICON_DATA[l.platform])
        // clé par index : l'éditeur équipe autorise 2 liens de même type
        .map((l, i) => {
          const ic = SOCIAL_ICON_DATA[l.platform];
          return (
            <a
              key={l.platform + i}
              href={l.href}
              aria-label={l.platform}
              target="_blank"
              rel="noopener noreferrer"
              className="nx-social-icon"
              style={{ "--hover-color": ic.hoverColor } as React.CSSProperties}
            >
              <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d={ic.d} />
              </svg>
            </a>
          );
        })}
    </>
  );
}
