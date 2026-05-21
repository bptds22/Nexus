"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   Homepage partner carousel — live media_partners data.

   Shows the CURATED set: status='APPROVED' AND show_on_homepage=true
   (public pages exist for every approved partner, but only the
   show_on_homepage ones surface in this strip). Each logo links to
   the partner's public promo page /partenaires/[id].

   Anon-safe: the homepage is public, this fetches with the browser
   client (anon key) and selects only public columns — never *.
   If no partner is featured, the whole section renders nothing
   (no empty marquee).
═══════════════════════════════════════════════════════════════ */

type FeaturedPartner = {
  id: string;
  organization_name: string;
  logo_url: string | null;
};

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/* Per-slot logo with a graceful fallback: null logo_url OR a broken
   image both fall back to the organization name as muted text. */
function PartnerLogo({ partner }: { partner: FeaturedPartner }) {
  const [errored, setErrored] = useState(false);
  if (!partner.logo_url || errored) {
    return (
      <span className="nx-display text-xl text-white/40 hover:text-white/70 transition-colors tracking-wider">
        {partner.organization_name}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={partner.logo_url}
      alt={partner.organization_name}
      onError={() => setErrored(true)}
      className="max-h-[44px] max-w-[150px] object-contain opacity-70 hover:opacity-100 transition-opacity"
    />
  );
}

export default function PartnerCarousel() {
  const [partners, setPartners] = useState<FeaturedPartner[] | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("media_partners")
        .select("id, organization_name, logo_url")
        .eq("status", "APPROVED")
        .eq("show_on_homepage", true)
        .order("homepage_order", { ascending: true, nullsFirst: false });
      setPartners((data as FeaturedPartner[] | null) ?? []);
    })();
  }, []);

  // Loading (null) or no featured partners → render nothing, no empty marquee.
  if (!partners || partners.length === 0) return null;

  // Duplicate the list so the marquee loops seamlessly (the track
  // animates translateX(-50%); the second half fills the wrap-around).
  const loop = [...partners, ...partners];

  return (
    <section className="relative bg-transparent py-20 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-12 text-center">
        <div className="inline-flex items-center gap-3">
          <span className="w-10 h-px bg-[#E63946]" />
          <span className={`${label} text-[#E63946]`}>Ils nous font confiance</span>
          <span className="w-10 h-px bg-[#E63946]" />
        </div>
      </div>

      <div className="nx-marquee" aria-label="Partenaires Nexus">
        <div className="nx-marquee-track">
          {loop.map((p, i) => {
            const isDuplicate = i >= partners.length;
            return (
              <Link
                key={`${p.id}-${i}`}
                href={`/partenaires/${p.id}`}
                className="nx-partner-slot flex items-center justify-center"
                aria-hidden={isDuplicate ? "true" : "false"}
                tabIndex={isDuplicate ? -1 : undefined}
                aria-label={isDuplicate ? undefined : p.organization_name}
              >
                <PartnerLogo partner={p} />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
