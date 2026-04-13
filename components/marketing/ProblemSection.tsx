import NxIcon from "@/components/ui/NxIcon";

interface ProblemItem {
  icon: string;
  title: string;
  description: string;
}

interface ProblemSectionProps {
  eyebrow?: string;
  title: string;
  problems: ProblemItem[];
}

export default function ProblemSection({
  eyebrow = "LE DÉFI",
  title,
  problems,
}: ProblemSectionProps) {
  return (
    <section className="py-20 bg-transparent">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-[14px] font-head font-bold uppercase tracking-[0.2em] text-[#E63946] mb-4">
          {eyebrow}
        </p>
        <h2 className="nx-display text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mb-12">
          {title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="relative group bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6 sm:p-7 hover:bg-[#22262E] hover:border-[#E63946]/20 transition-all duration-300 overflow-hidden"
            >
              {/* Red top accent on hover */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              <div className="w-12 h-12 bg-[rgba(230,57,70,0.1)] rounded-full flex items-center justify-center">
                <NxIcon name={problem.icon} size={22} className="text-[#E63946]" />
              </div>
              <h3 className="nx-display text-[16px] font-bold text-white mt-4 mb-2">
                {problem.title}
              </h3>
              <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
