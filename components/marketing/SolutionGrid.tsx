interface SolutionItem {
  icon: string;
  title: string;
  description: string;
}

interface SolutionGridProps {
  eyebrow?: string;
  title: string;
  solutions: SolutionItem[];
}

export default function SolutionGrid({
  eyebrow = "LA SOLUTION",
  title,
  solutions,
}: SolutionGridProps) {
  return (
    <section className="py-20 bg-transparent">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-[14px] font-head font-bold uppercase tracking-[0.2em] text-[#E63946] mb-4">
          {eyebrow}
        </p>
        <h2 className="nx-display text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mb-12">
          {title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {solutions.map((solution, index) => (
            <div
              key={index}
              className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6 sm:p-7 group transition-all hover:border-l-[3px] hover:border-l-[#E63946] hover:bg-[#22262E]"
            >
              <div className="w-12 h-12 bg-[rgba(230,57,70,0.1)] rounded-full flex items-center justify-center">
                <span className="text-[24px]">{solution.icon}</span>
              </div>
              <h3 className="nx-display text-[16px] font-bold text-white mt-4 mb-2">
                {solution.title}
              </h3>
              <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
                {solution.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
