interface FeatureItem {
  title: string;
  description: string;
}

interface FeatureGridProps {
  title: string;
  features: FeatureItem[];
  id?: string;
}

export default function FeatureGrid({ title, features, id }: FeatureGridProps) {
  return (
    <section id={id} className="py-20 bg-transparent">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="font-head text-3xl font-black text-white uppercase tracking-tight mb-12 text-center">
          {title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6 hover:bg-[#22262E] hover:border-[#E63946]/20 transition-all duration-300 relative overflow-hidden"
            >
              {/* Red top accent on hover */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#E63946] mb-3" />
              <h3 className="text-[14px] font-bold text-white mb-1.5">
                {feature.title}
              </h3>
              <p className="text-[13px] text-[#6B7280] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
