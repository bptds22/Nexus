"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";
import SocialIcons, { type SocialLink } from "./SocialIcons";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Marketing footer (shared)
   Canonical footer extracted from the homepage. Consumed by every
   public-facing page (marketing, legal, auth, 404). Portal layouts
   (coach / recruteur / admin / athlete / partenaire) do NOT render
   this — those are authenticated dashboards.

   Per-platform social hover colors are passed through the
   --hover-color CSS variable, read by `.nx-social-icon:hover` in
   globals.css. Tailwind JIT can't see dynamic hex literals in
   className, so the variable indirection is intentional.
─────────────────────────────────────────────────────────────────*/

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

// Corporate social links — icon paths + hover colours live in SocialIcons.
const SOCIAL_LINKS: SocialLink[] = [
  { platform: "instagram", href: "https://www.instagram.com/nexussportsteam/" },
  { platform: "facebook", href: "https://www.facebook.com/nexussportsca" },
  { platform: "youtube", href: "https://www.youtube.com/@NexusSportsca" },
  { platform: "tiktok", href: "https://www.tiktok.com/@nexussports.ca" },
];

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-[#030609]/80 border-t border-[#1E2D4A]">
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#1E2D4A]">

          <div className="flex items-center gap-3">
            {/* White X icon — muted to match the gray of the
                adjacent footer text (text-[#475569]). opacity-40
                on pure white over the near-black footer surface
                reads as roughly the same visual weight. */}
            <Link href="/" aria-label="Nexus" className="inline-flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-white.svg" alt="" className="h-[22px] w-auto opacity-40" />
            </Link>
            <span className={`${label} text-[#475569]`}>
              {t.footer.tagline}
            </span>
          </div>

          <nav className="flex items-center gap-8">
            <Link href="/confidentialite" className={`${label} text-[#475569] hover:text-[#9CA3AF] transition-colors`}>{t.footer.privacy}</Link>
            <Link href="/conditions" className={`${label} text-[#475569] hover:text-[#9CA3AF] transition-colors`}>{t.footer.terms}</Link>
            <Link href="/contact" className={`${label} text-[#475569] hover:text-[#9CA3AF] transition-colors`}>{t.footer.contact}</Link>
          </nav>

          <div className="flex items-center gap-5">
            <SocialIcons links={SOCIAL_LINKS} />
          </div>

        </div>

        <p className={`${label} text-[#2E3D55] text-center pt-5`}>
          {t.footer.copyright}
        </p>

      </div>
    </footer>
  );
}
