import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient as createSbClient } from "@supabase/supabase-js";
import PlaybookBackground from "../../components/PlaybookBackground";

// Anon-role client (no cookies — public RLS handles row scoping). Required
// because importing the cookies-based server client would prevent static
// export of this page.
const supabase = createSbClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Static export needs at least one param to generate; we use a sentinel
// placeholder id. Mobile build is gated by the notFound() guard below,
// so even the sentinel page renders as 404.
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [{ id: "placeholder" }];
}

/* ═══════════════════════════════════════════════════════════════
   /partenaires/[id] — PUBLIC partner promo page (anon-readable).

   Read-only display. Editing is the partner portal (chunk 3).
   RLS "Public read approved partners" only returns status='APPROVED'
   rows, so a non-existent OR non-approved id both resolve to null →
   the same "introuvable" state (no leak of pending partners).

   Only the public-safe columns are selected — never "*", which would
   expose contact_email / contact_name to anonymous visitors.
═══════════════════════════════════════════════════════════════ */

type PartnerPublic = {
  id: string;
  organization_name: string;
  logo_url: string | null;
  description: string | null;
  about_text: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  facebook_url: string | null;
  x_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getPartner(id: string): Promise<PartnerPublic | null> {
  if (!UUID_RE.test(id)) return null;
  const { data } = await supabase
    .from("media_partners")
    .select(
      "id, organization_name, logo_url, description, about_text, website_url, instagram_handle, tiktok_handle, facebook_url, x_url, youtube_url, linkedin_url",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as PartnerPublic | null) ?? null;
}

// generateMetadata temporarily disabled to isolate Turbopack gSP detection bug.
// TODO restore once build:mobile passes.
// export async function generateMetadata(
//   { params }: { params: Promise<{ id: string }> },
// ): Promise<Metadata> { ... }

/* ── Brand SVG icons (currentColor — color set by the wrapper) ── */

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005.8 20.1a6.34 6.34 0 0010.86-4.43V8.51a8.16 8.16 0 004.77 1.52V6.69h-1.84z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.42 29 29 0 001 11.75a29 29 0 00.46 5.33 2.78 2.78 0 001.95 1.96C5.12 19.5 12 19.5 12 19.5s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96 29 29 0 00.46-5.33 29 29 0 00-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

/* ── not-found state (shared by missing + non-approved ids) ── */
function NotFound() {
  return (
    <main className="min-h-screen bg-[#111317] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-white/5 flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8.5" y1="11" x2="13.5" y2="11" />
          </svg>
        </div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Partenaire introuvable
        </h1>
        <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
          Ce partenaire n&apos;existe pas ou n&apos;est plus disponible.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-[#E63946] hover:text-[#D93C3C] transition-colors mt-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}

export default async function PartnerPublicPage(
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.CAPACITOR_BUILD === "true") notFound();
  const { id } = await params;
  const partner = await getPartner(id);

  if (!partner) return <NotFound />;

  const cleanHandle = (h: string) => h.trim().replace(/^@+/, "");

  const socials: { key: string; label: string; color: string; href: string | null; icon: React.ReactNode }[] = [
    {
      key: "instagram",
      label: "Instagram",
      color: "#E4405F",
      href: partner.instagram_handle ? `https://instagram.com/${cleanHandle(partner.instagram_handle)}` : null,
      icon: <InstagramIcon />,
    },
    {
      key: "tiktok",
      label: "TikTok",
      color: "#25F4EE",
      href: partner.tiktok_handle ? `https://tiktok.com/@${cleanHandle(partner.tiktok_handle)}` : null,
      icon: <TikTokIcon />,
    },
    {
      key: "facebook",
      label: "Facebook",
      color: "#1877F2",
      href: partner.facebook_url || null,
      icon: <FacebookIcon />,
    },
    {
      key: "x",
      label: "X",
      color: "#FFFFFF",
      href: partner.x_url || null,
      icon: <XIcon />,
    },
    {
      key: "youtube",
      label: "YouTube",
      color: "#FF0000",
      href: partner.youtube_url || null,
      icon: <YouTubeIcon />,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      color: "#0A66C2",
      href: partner.linkedin_url || null,
      icon: <LinkedInIcon />,
    },
  ];

  const initials = partner.organization_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <main className="hero-playbook bg-[#111317] min-h-screen relative overflow-hidden">
      <PlaybookBackground />

      {/* ── Hero band ── */}
      <section className="relative overflow-hidden">
        <div className="nx-hero-glow" aria-hidden />
        <div className="relative z-10 max-w-3xl mx-auto px-6 pt-20 sm:pt-28 pb-16 flex flex-col items-center text-center">
          {/* Eyebrow — Nexus section-label motif */}
          <div className="inline-flex items-center gap-3 mb-8">
            <span className="w-10 h-px bg-[#E63946]" />
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
              Partenaire officiel
            </span>
            <span className="w-10 h-px bg-[#E63946]" />
          </div>

          {/* Logo — layered tile over a red halo */}
          <div className="relative mb-7">
            <div className="absolute -inset-5 bg-[#E63946]/20 blur-3xl rounded-full" aria-hidden />
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl bg-gradient-to-b from-[#1E222B] to-[#13151a] border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.55)] flex items-center justify-center overflow-hidden">
              {partner.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={partner.logo_url}
                  alt={`Logo ${partner.organization_name}`}
                  className="w-full h-full object-contain p-3"
                />
              ) : (
                <span className="font-head text-4xl font-black text-[#6B7280]">{initials}</span>
              )}
            </div>
          </div>

          {/* Name */}
          <h1 className="nx-display text-4xl sm:text-5xl lg:text-6xl font-black uppercase text-white leading-[0.95] tracking-tight break-words max-w-2xl">
            {partner.organization_name}
          </h1>

          {/* Short description */}
          {partner.description && (
            <p className="font-sans text-[15px] sm:text-base text-[#9CA3AF] leading-relaxed mt-5 max-w-lg">
              {partner.description}
            </p>
          )}

          {/* Social row — all 6 always render; colored+clickable if set, gray+inert if not */}
          <div className="flex items-center justify-center gap-2.5 mt-8">
            {socials.map((s) =>
              s.href ? (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="w-11 h-11 rounded-full bg-[#13151a] border border-white/10 flex items-center justify-center transition-transform hover:scale-110"
                  style={{ color: s.color }}
                >
                  {s.icon}
                </a>
              ) : (
                <span
                  key={s.key}
                  aria-label={`${s.label} — non disponible`}
                  title={`${s.label} — non disponible`}
                  className="w-11 h-11 rounded-full bg-[#13151a] border border-white/[0.04] flex items-center justify-center text-[#4a4d56] pointer-events-none"
                >
                  {s.icon}
                </span>
              ),
            )}
          </div>

          {/* Website CTA */}
          {partner.website_url && (
            <a
              href={partner.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-9 inline-flex items-center gap-2.5 h-12 px-7 rounded bg-[#E63946] text-white font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(230,57,70,0.4)] transition-all"
            >
              Visiter le site
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
        </div>
      </section>

      {/* ── About section — editorial card floating over the playbook ── */}
      {partner.about_text && (
        <section className="relative z-10 max-w-3xl mx-auto px-6 pb-6">
          <div className="editorial-grain bg-[#1A1D24] border border-[#2D3748] rounded-2xl p-7 sm:p-10 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="inline-flex items-center gap-3 mb-5">
              <span className="w-8 h-px bg-[#E63946]" />
              <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
                À propos
              </span>
            </div>
            <p className="font-sans text-[15px] sm:text-base text-[#D1D5DB] leading-relaxed whitespace-pre-line">
              {partner.about_text}
            </p>
          </div>
        </section>
      )}

      {/* ── Back link ── */}
      <div className="relative z-10 text-center pt-6 pb-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[#6B7280] hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Retour à Nexus
        </Link>
      </div>
    </main>
  );
}
