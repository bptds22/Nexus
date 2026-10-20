"use client";

import { notFound } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import SectionsCoach from "@/components/marketing/coachs/SectionsCoach";

/* ═══════════════════════════════════════════════════════════════
   Pour les coachs — page vitrine publique (v2, BP 2026-10-20) :
   héros, 4 étapes, évaluation, outils, contact, appel final.
═══════════════════════════════════════════════════════════════ */

export default function PourLesCoachsPage() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />
        <SectionsCoach />
      </div>
    </div>
  );
}
