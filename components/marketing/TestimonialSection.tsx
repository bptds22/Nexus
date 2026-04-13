interface Testimonial {
  name: string;
  role: string;
  quote: string;
}

interface TestimonialSectionProps {
  title?: string;
  testimonials: Testimonial[];
  stats?: { value: string; label: string }[];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function TestimonialSection({
  title = "ILS UTILISENT NEXUS",
  testimonials,
  stats,
}: TestimonialSectionProps) {
  return (
    <section className="py-20 bg-transparent">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="nx-display text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mb-12 text-center">
          {title}
        </h2>
        <div className={`grid grid-cols-1 gap-6 mb-12 ${testimonials.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-[#22262E] rounded-xl p-6 sm:p-7 relative"
            >
              {/* Giant guillemet */}
              <span className="absolute top-4 left-6 text-[56px] text-[#E63946] opacity-15 nx-display leading-none select-none pointer-events-none">
                &laquo;
              </span>
              <p className="text-[14px] text-[#D1D5DB] italic leading-relaxed mt-8 mb-6">
                {testimonial.quote}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#2A2D35] flex items-center justify-center flex-shrink-0">
                  <span className="text-[13px] text-[#6B7280]">
                    {getInitials(testimonial.name)}
                  </span>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">
                    {testimonial.name}
                  </p>
                  <p className="text-[12px] text-[#6B7280]">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {stats && stats.length > 0 && (
          <div className="flex justify-center gap-12 mt-12 pt-8 border-t border-[#1e2128]">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="nx-display text-3xl font-black text-white">
                  {stat.value}
                </p>
                <p className="text-[12px] text-[#6B7280] uppercase tracking-wide mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
