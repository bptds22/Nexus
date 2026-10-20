"use client";

import { notFound } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import Footer from "@/components/marketing/Footer";
import SectionsCommentCaMarche from "@/components/marketing/comment-ca-marche/SectionsCommentCaMarche";

/* ═══════════════════════════════════════════════════════════════
   Comment ça marche — manifeste + fonctionnement (v2, BP 2026-10-20).
   Public, sans auth, sans Supabase, contenu statique.
═══════════════════════════════════════════════════════════════ */

export default function CommentCaMarche() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />
        <SectionsCommentCaMarche />
        <Footer />
      </div>
    </div>
  );
}
