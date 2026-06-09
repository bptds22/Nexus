"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../components/PlaybookBackground";
import Footer from "@/components/marketing/Footer";

import { notFound } from "next/navigation";
import { SECTIONS_CONDITIONS as SECTIONS } from "@/content/legal/conditions";
import SectionRenderer, { LegalTocDesktop, LegalTocMobile } from "@/components/legal/SectionRenderer";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Conditions d'utilisation (Loi 25 aligned, v2.0)

   Iter 7.50-a-bis (legal-1) — refactor : le contenu (SECTIONS) +
   les renderers ont été extraits dans content/legal/ +
   components/legal/. Le rendu HTML/CSS de cette page reste
   byte-identique pour préserver les PDFs générés par
   scripts/generate-legal-pdfs.mjs.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

export default function ConditionsPage() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const sectionRefs = useRef<Map<string, IntersectionObserverEntry>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          sectionRefs.current.set(entry.target.id, entry);
        });

        let topSection = "";
        let topY = Infinity;
        sectionRefs.current.forEach((entry, id) => {
          if (entry.isIntersecting && entry.boundingClientRect.top < topY) {
            topY = entry.boundingClientRect.top;
            topSection = id;
          }
        });

        if (topSection) setActiveSection(topSection);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />

      <MarketingNav />

      {/* ══════════════════════════════════════════
          HERO HEADER
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-transparent">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">

          <div className="inline-flex items-center gap-3 mb-8">
            <span className="w-6 h-px bg-wl-red" />
            <span className={`${label} text-wl-red`}>Document juridique</span>
            <span className="w-6 h-px bg-wl-red" />
          </div>

          <h1 className="nx-display text-5xl xl:text-6xl font-black text-white uppercase leading-[0.92] tracking-tight mb-6">
            Conditions<br />
            <span className="text-wl-red">d&apos;utilisation</span>
          </h1>

          <p className="font-sans text-base text-[#9AA3B2] leading-relaxed max-w-[560px] mx-auto mb-4">
            Règles d&apos;utilisation et d&apos;accès à la plateforme Nexus
          </p>

          <p className={`${label} text-[#475569] mt-4`}>
            Dernière mise à jour : Mars 2026 · Version 2.0
          </p>

        </div>
      </section>

      {/* Separator */}
      <div className="nx-sep relative h-14 bg-[#060A14]/60 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#0A1020]/60" style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }} />
      </div>

      {/* ══════════════════════════════════════════
          CONTENT — sidebar TOC + main body
      ══════════════════════════════════════════ */}
      <section className="bg-[#060A14]/75 flex-1">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">

            <LegalTocDesktop sections={SECTIONS} activeId={activeSection} />

            <LegalTocMobile sections={SECTIONS} />

            <SectionRenderer sections={SECTIONS} />

          </div>
        </div>
      </section>

      {/* Separator reverse */}
      <div className="nx-sep relative h-14 bg-[#0A1020]/60 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#060A14]/60" style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }} />
      </div>

      {/* ══════════════════════════════════════════
          CTA STRIP
      ══════════════════════════════════════════ */}
      <section className="bg-[#060A14]/75">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className={`${label} text-wl-red mb-3`}>Des questions?</div>
            <h2 className="nx-display text-4xl font-black text-white uppercase leading-tight">
              Contactez-nous
            </h2>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a href="mailto:confidentialite@nexussports.ca" className="h-12 px-8 bg-wl-red text-white font-head font-black text-xs uppercase tracking-widest hover:bg-wl-red-hover transition-colors hover:shadow-[0_8px_28px_rgba(232,72,72,0.38)] hover:-translate-y-0.5 inline-flex items-center">
              confidentialite@nexussports.ca
            </a>
            <Link
              href="/"
              className="nx-ghost-btn h-12 px-8 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </section>

      <Footer />

    </div>
  );
}
