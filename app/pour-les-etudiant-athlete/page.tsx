"use client";

import MarketingHero from "@/components/marketing/MarketingHero";
import ProblemSection from "@/components/marketing/ProblemSection";
import SolutionGrid from "@/components/marketing/SolutionGrid";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import CtaSection from "@/components/marketing/CtaSection";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import { useTranslation } from "@/lib/i18n/useTranslation";

// Icon keys + image-related metadata stay in code; only the text content
// flows from the dictionary. Icons are referenced by string name into
// the NxIcon component, so the dictionary stays purely textual.
const PROBLEM_ICONS = ["eyeOff", "monitor", "gradCap"] as const;
const SOLUTION_ICONS = ["trophy", "search", "allstar", "shield"] as const;

export default function PourLesEtudiantAthletePage() {
  const { t } = useTranslation();
  const T = t.athleteLanding;

  return (
    <div className="hero-playbook bg-[#060A14] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      <MarketingHero
        eyebrow={T.hero.eyebrow}
        title={T.hero.title}
        subtitle={T.hero.subtitle}
        ctaPrimary={{ label: T.hero.ctaPrimary, href: "/inscription?role=ATHLETE" }}
        ctaSecondary={{ label: T.hero.ctaSecondary, href: "/comment-ca-marche" }}
      />

      <ProblemSection
        title={T.problem.title}
        problems={T.problem.items.map((p, i) => ({
          icon: PROBLEM_ICONS[i],
          title: p.title,
          description: p.description,
        }))}
      />

      <SolutionGrid
        title={T.solution.title}
        solutions={T.solution.items.map((s, i) => ({
          icon: SOLUTION_ICONS[i],
          title: s.title,
          description: s.description,
        }))}
      />

      <HowItWorks
        steps={T.steps.items.map((step) => ({
          number: step.number,
          title: step.title,
          description: step.description,
        }))}
      />

      <FeatureGrid
        title={T.features.title}
        features={T.features.items.map((f) => ({
          title: f.title,
          description: f.description,
        }))}
      />

      <CtaSection
        title={T.cta.title}
        ctaPrimary={{ label: T.cta.button, href: "/inscription?role=ATHLETE" }}
        subtext={T.cta.subtext}
      />
    </div>
  );
}
