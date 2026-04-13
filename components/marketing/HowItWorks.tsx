interface StepItem {
  number: string;
  title: string;
  description: string;
}

interface HowItWorksProps {
  eyebrow?: string;
  steps: StepItem[];
}

export default function HowItWorks({
  eyebrow = "COMMENT ÇA MARCHE",
  steps,
}: HowItWorksProps) {
  return (
    <section className="py-20 bg-transparent">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-[14px] font-head font-bold uppercase tracking-[0.2em] text-[#E63946] mb-12">
          {eyebrow}
        </p>

        <div className="nx-steps-grid grid grid-cols-1 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="nx-step-card group px-8 py-10 first:pl-0 last:pr-0 hover:bg-white/[0.06] transition-colors relative"
            >
              {/* Hover accent line */}
              <div
                className="absolute top-0 left-8 right-8 md:left-0 md:right-auto md:top-0 md:bottom-0 md:w-px md:h-full h-px bg-[#E63946] scale-0 group-hover:scale-100 transition-transform origin-top-left"
                aria-hidden
              />

              {/* Giant watermark step number */}
              <div
                className="nx-step-num nx-display text-[112px] font-black text-white/30 leading-none mb-3 select-none"
                aria-hidden
              >
                {step.number}
              </div>

              <h3 className="nx-display text-2xl font-black text-white uppercase leading-tight mb-3">
                {step.title}
              </h3>
              <p className="font-sans text-sm text-[#9CA3AF] leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
