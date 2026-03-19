import Link from "next/link";

interface MarketingHeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };
}

export default function MarketingHero({
  eyebrow,
  title,
  subtitle,
  ctaPrimary,
  ctaSecondary,
}: MarketingHeroProps) {
  return (
    <section className="bg-transparent">
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-24">
        <p className="text-[14px] font-head font-bold uppercase tracking-[0.2em] text-[#E63946] mb-4">
          {eyebrow}
        </p>
        <h1 className="font-head text-4xl sm:text-5xl lg:text-[56px] font-black text-white uppercase leading-[0.95] tracking-tight mb-6 max-w-[700px]">
          {title}
        </h1>
        <p className="text-[18px] text-[#9CA3AF] max-w-[560px] leading-relaxed mb-8">
          {subtitle}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={ctaPrimary.href}
            className="inline-flex items-center bg-[#E63946] hover:bg-[#FF5C58] text-white font-head font-bold text-[14px] uppercase tracking-[0.12em] rounded-md px-8 py-4 transition-colors"
          >
            {ctaPrimary.label}
            <span className="ml-2">&rarr;</span>
          </Link>
          <Link
            href={ctaSecondary.href}
            className="nx-ghost-btn inline-flex items-center h-12 px-6 border font-head font-bold text-xs uppercase tracking-widest"
          >
            {ctaSecondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
