interface ComparisonColumn {
  icon: string;
  title: string;
  description: string;
  bullets: string[];
}

interface SplitComparisonProps {
  eyebrow?: string;
  title: string;
  left: ComparisonColumn;
  right: ComparisonColumn;
}

export default function SplitComparison({
  eyebrow,
  title,
  left,
  right,
}: SplitComparisonProps) {
  return (
    <section className="py-20 bg-transparent">
      <div className="max-w-6xl mx-auto px-6">
        {eyebrow && (
          <p className="text-[14px] font-head font-bold uppercase tracking-[0.2em] text-[#E63946] mb-4 text-center">
            {eyebrow}
          </p>
        )}
        <h2 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mb-12 text-center">
          {title}
        </h2>
        <div className="relative grid grid-cols-1 md:grid-cols-2">
          {/* Vertical divider (desktop only) */}
          <div className="hidden md:block absolute left-1/2 top-8 bottom-8 w-px bg-[#2A2D35] z-10" />

          {/* Left column */}
          <div className="bg-[#1A1D24] rounded-t-xl md:rounded-l-xl md:rounded-tr-none border border-[#1e2128] p-8">
            <span className="text-[32px] block mb-4">{left.icon}</span>
            <h3 className="font-head text-[20px] font-bold text-[#E63946] uppercase mb-2">
              {left.title}
            </h3>
            <p className="text-[14px] text-[#9CA3AF] mb-6">
              {left.description}
            </p>
            <ul className="space-y-3">
              {left.bullets.map((bullet, index) => (
                <li key={index} className="flex items-start text-[14px]">
                  <span className="text-[#E63946] mr-2 flex-shrink-0">
                    &mdash;
                  </span>
                  <span className="text-[#D1D5DB]">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right column */}
          <div className="bg-[#1A1D24] rounded-b-xl md:rounded-r-xl md:rounded-bl-none border border-[#1e2128] md:border-l-0 p-8">
            <span className="text-[32px] block mb-4">{right.icon}</span>
            <h3 className="font-head text-[20px] font-bold text-[#E63946] uppercase mb-2">
              {right.title}
            </h3>
            <p className="text-[14px] text-[#9CA3AF] mb-6">
              {right.description}
            </p>
            <ul className="space-y-3">
              {right.bullets.map((bullet, index) => (
                <li key={index} className="flex items-start text-[14px]">
                  <span className="text-[#E63946] mr-2 flex-shrink-0">
                    &mdash;
                  </span>
                  <span className="text-[#D1D5DB]">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
