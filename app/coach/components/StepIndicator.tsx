"use client";

/* ─────────────────────────────────────────────────────────────────
   StepIndicator — horizontal stepper
   Clean dots connected by lines, current step name shown centered
   above the bar. Fits 8 steps without scrolling.
───────────────────────────────────────────────────────────────── */

interface Step {
  number: number;
  name: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
}

export default function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  const currentStepData = steps.find((s) => s.number === currentStep);

  return (
    <div className="w-full px-3 py-5">
      {/* Current step label — centered above the dots */}
      <div className="text-center mb-4">
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">
          Étape {currentStep}
        </span>
        <span className="mx-2 text-[#2a2d36]">—</span>
        <span className="text-[13px] font-bold tracking-[0.1em] uppercase text-white">
          {currentStepData?.name}
        </span>
      </div>

      {/* Dot bar */}
      <div className="flex items-center">
        {steps.map((step, idx) => {
          const isCurrent = step.number === currentStep;
          const isCompleted = completedSteps.has(step.number);
          const isPast = step.number < currentStep;

          return (
            <div key={step.number} className="flex items-center flex-1 last:flex-none">
              {/* Dot */}
              <button
                type="button"
                onClick={() => onStepClick(step.number)}
                title={step.name}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center shrink-0
                  text-[12px] font-bold cursor-pointer transition-all duration-200
                  ${isCurrent
                    ? "bg-[#E63946] text-white shadow-[0_0_12px_rgba(230,57,70,0.45)] scale-110"
                    : isCompleted || isPast
                      ? "bg-[#10b981] text-white hover:brightness-110"
                      : "bg-[#1A1D24] border border-[#2a2d36] text-[#6b7280] hover:border-[#4a4d56] hover:text-[#8a8d96]"
                  }
                `}
              >
                {isCompleted || (isPast && !isCurrent) ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  step.number
                )}
              </button>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-[2px] mx-1.5 transition-colors duration-200
                    ${isPast || isCompleted ? "bg-[#10b981]" : "bg-[#2a2d36]"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
