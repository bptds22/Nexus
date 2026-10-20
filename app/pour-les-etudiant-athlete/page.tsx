"use client";

import { notFound } from "next/navigation";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import SectionsAthlete from "@/components/marketing/athletes/SectionsAthlete";

/* Page athlète v2 (BP 2026-10-20) : héros, une section par fonction avec
   capture (données fictives), étapes, gratuité, appel final. */

export default function PourLesEtudiantAthletePage() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen text-white font-sans">
      <PlaybookBackground />
      <MarketingNav />
      <SectionsAthlete />
    </div>
  );
}
