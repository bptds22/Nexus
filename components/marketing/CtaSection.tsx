import Link from "next/link";

interface CtaSectionProps {
  eyebrow?: string;
  title: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  subtext?: string;
}

export default function CtaSection({
  eyebrow = "PRÊT À COMMENCER ?",
  title,
  ctaPrimary,
  ctaSecondary,
  subtext,
}: CtaSectionProps) {
  return (
    <section className="py-24 bg-gradient-to-b from-[#111317] to-[#1A1D24] text-center">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-[14px] font-head font-bold uppercase tracking-[0.2em] text-[#E63946] mb-4">
          {eyebrow}
        </p>
        <h2 className="nx-display text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mb-8">
          {title}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href={ctaPrimary.href}
            className="inline-flex items-center bg-[#E63946] hover:bg-[#FF5C58] text-white font-head font-bold text-[14px] uppercase tracking-[0.12em] rounded-md px-10 py-4 transition-colors"
          >
            {ctaPrimary.label}
          </Link>
          {ctaSecondary && (
            <Link
              href={ctaSecondary.href}
              className="nx-ghost-btn inline-flex items-center h-12 px-6 border font-head font-bold text-xs uppercase tracking-widest"
            >
              {ctaSecondary.label}
            </Link>
          )}
        </div>
        {subtext && (
          <p className="text-[13px] text-[#6B7280] mt-4">{subtext}</p>
        )}
      </div>
    </section>
  );
}
