"use client";

import { useState, useEffect, useRef } from "react";
import NexusLogo from "@/components/ui/NexusLogo";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Product Roadmap
   Same visual language: dark navy, playbook bg, Montserrat headings,
   ghost buttons, red accents. Vertical timeline layout with phase
   cards, status badges, and feature lists.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

const SOCIALS = [
  {
    name: "Instagram",
    href: "#",
    d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    name: "Facebook",
    href: "#",
    d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    name: "YouTube",
    href: "#",
    d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  {
    name: "TikTok",
    href: "#",
    d: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
];

/* ══════════════════════════════════════════════════════════════
   ROADMAP DATA — edit this array to update roadmap content
══════════════════════════════════════════════════════════════ */

type PhaseStatus = "completed" | "in-progress" | "planned";

interface RoadmapPhase {
  id: string;
  phase: string;
  title: string;
  summary: string;
  status: PhaseStatus;
  features: string[];
}

const PHASES: RoadmapPhase[] = [
  {
    id: "foundation",
    phase: "Phase 1",
    title: "Fondation",
    summary:
      "Infrastructure de base, identité de marque et architecture de la plateforme. Les fondations sur lesquelles tout repose.",
    status: "completed",
    features: [
      "Structure de la plateforme",
      "Identité de marque Nexus",
      "Page d'accueil",
      "Flux d'authentification",
      "Architecture de la base de données",
    ],
  },
  {
    id: "athlete-profiles",
    phase: "Phase 2",
    title: "Profils d'athlètes",
    summary:
      "Pages de profils athlètes complètes, cartes de joueur et métadonnées spécifiques par sport.",
    status: "in-progress",
    features: [
      "Pages de profil athlète",
      "Cartes de joueur",
      "Métadonnées spécifiques par sport",
      "Liens de faits saillants et vidéos",
      "Logique de badge de vérification",
    ],
  },
  {
    id: "coach-tools",
    phase: "Phase 3",
    title: "Outils pour entraîneurs",
    summary:
      "Tableau de bord entraîneur complet pour gérer les profils d'athlètes, les équipes et les soumissions.",
    status: "planned",
    features: [
      "Tableau de bord entraîneur",
      "Ajout et modification des athlètes",
      "Filtrage et tri",
      "Outils de favoris et listes courtes",
      "Gestion de base des organisations",
    ],
  },
  {
    id: "recruiter-experience",
    phase: "Phase 4",
    title: "Expérience recruteur",
    summary:
      "Moteur de recherche avancé, filtres intelligents et outils de suivi des prospects pour les recruteurs CÉGEP.",
    status: "planned",
    features: [
      "Expérience de recherche recruteur",
      "Filtres avancés",
      "Recherches sauvegardées",
      "Suivi des prospects",
      "Tableaux de bord recruteur",
    ],
  },
  {
    id: "messaging-expansion",
    phase: "Phase 5",
    title: "Messagerie et expansion",
    summary:
      "Communication directe, notifications et expansion vers plus de sports, divisions et programmes CÉGEP.",
    status: "planned",
    features: [
      "Fonctionnalités de communication directe",
      "Notifications",
      "Plus de sports et divisions",
      "Expansion CÉGEP",
      "Analytique administrateur",
    ],
  },
];

/* ── Status badge config ─────────────────────────────────────── */

const STATUS_CONFIG: Record<
  PhaseStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  completed: {
    label: "Complété",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  "in-progress": {
    label: "En cours",
    bg: "bg-[#E63946]/15",
    text: "text-[#E63946]",
    dot: "bg-[#E63946]",
  },
  planned: {
    label: "Planifié",
    bg: "bg-[#9AA3B2]/15",
    text: "text-[#9AA3B2]",
    dot: "bg-[#9AA3B2]",
  },
};

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */

export default function RoadmapPage() {
  const [activePhase, setActivePhase] = useState("");
  const sectionRefs = useRef(new Map<string, IntersectionObserverEntry>());

  /* ── Scroll-spy: track which phase is currently in view ─── */
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
        if (topSection) setActivePhase(topSection);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    PHASES.forEach((p) => {
      const el = document.getElementById(p.id);
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
      <section className="relative z-10 text-center pt-16 pb-6 px-6">
        {/* Brand eyebrow */}
        <div className="inline-flex items-center gap-3 mb-5">
          <span className="w-6 h-px bg-wl-red" />
          <span className={`${label} text-wl-red`}>Feuille de route</span>
          <span className="w-6 h-px bg-wl-red" />
        </div>

        <h1 className="nx-display text-4xl sm:text-5xl font-black text-white uppercase leading-[0.92] tracking-tight">
          Product Roadmap
        </h1>

        <p className="font-sans text-sm text-[#9AA3B2] mt-3 max-w-lg mx-auto leading-relaxed">
          Découvrez l&apos;évolution de Nexus. Notre feuille de route reflète notre engagement à construire la meilleure plateforme de recrutement sportif au Québec.
        </p>

        {/* "Updated regularly" badge */}
        <div className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 border border-[#1E2D4A] rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className={`${label} text-[#9AA3B2]`}>Mis à jour régulièrement</span>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          QUICK-JUMP ANCHOR NAV (mobile card + desktop pills)
      ══════════════════════════════════════════ */}
      <section className="relative z-10 px-6 pb-10">
        <div className="max-w-4xl mx-auto">

          {/* Desktop: horizontal pill nav */}
          <nav className="hidden sm:flex items-center justify-center gap-3 flex-wrap">
            {PHASES.map((p) => {
              const isActive = activePhase === p.id;
              const sc = STATUS_CONFIG[p.status];
              return (
                <a
                  key={p.id}
                  href={`#${p.id}`}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-head font-bold uppercase tracking-widest transition-all duration-300
                    ${isActive
                      ? "border-wl-red text-white bg-wl-red/10"
                      : "border-[#1E2D4A] text-[#9AA3B2] hover:border-[#3D5578] hover:text-white"
                    }
                  `}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                  {p.phase}
                </a>
              );
            })}
          </nav>

          {/* Mobile: compact card */}
          <div className="sm:hidden nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-4">
            <p className={`${label} text-[#9AA3B2] mb-3`}>Aller à</p>
            <div className="flex flex-wrap gap-2">
              {PHASES.map((p) => {
                const sc = STATUS_CONFIG[p.status];
                return (
                  <a
                    key={p.id}
                    href={`#${p.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#1E2D4A] text-[10px] font-head font-bold uppercase tracking-widest text-[#9AA3B2] hover:border-wl-red hover:text-white transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {p.phase}
                  </a>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          TIMELINE — vertical layout with connector line
      ══════════════════════════════════════════ */}
      <section className="relative z-10 flex-1 px-6 pb-20">
        <div className="max-w-4xl mx-auto relative">

          {/* Vertical connector line (left side on desktop) */}
          <div
            className="hidden md:block absolute left-8 top-0 bottom-0 w-px"
            style={{
              background:
                "linear-gradient(to bottom, transparent, #1E2D4A 5%, #1E2D4A 95%, transparent)",
            }}
          />

          {/* Phase cards */}
          <div className="flex flex-col gap-10">
            {PHASES.map((phase, i) => {
              const sc = STATUS_CONFIG[phase.status];
              return (
                <div
                  key={phase.id}
                  id={phase.id}
                  className="relative md:pl-20 scroll-mt-24"
                >
                  {/* ── Timeline node (desktop only) ── */}
                  <div className="hidden md:flex absolute left-0 top-8 w-16 items-center justify-center">
                    {/* Outer ring */}
                    <div
                      className={`
                        w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center
                        ${phase.status === "completed"
                          ? "border-emerald-400"
                          : phase.status === "in-progress"
                            ? "border-[#E63946]"
                            : "border-[#3D5578]"
                        }
                      `}
                    >
                      {/* Inner dot */}
                      <div
                        className={`
                          w-2 h-2 rounded-full
                          ${phase.status === "completed"
                            ? "bg-emerald-400"
                            : phase.status === "in-progress"
                              ? "bg-[#E63946] animate-pulse"
                              : "bg-[#3D5578]"
                          }
                        `}
                      />
                    </div>
                  </div>

                  {/* ── Phase card ── */}
                  <div className="nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-6 sm:p-8 transition-colors hover:border-[#3D5578]">

                    {/* Card header */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                      {/* Phase number badge */}
                      <span className="font-head font-black text-[11px] uppercase tracking-[0.2em] text-[#475569] shrink-0">
                        {phase.phase}
                      </span>

                      {/* Title */}
                      <h2 className="nx-display text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-tight">
                        {phase.title}
                      </h2>

                      {/* Status badge — pushed right on desktop */}
                      <div className="sm:ml-auto shrink-0">
                        <span
                          className={`
                            inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                            ${sc.bg} ${sc.text}
                            text-[10px] font-bold tracking-[0.15em] uppercase
                          `}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${phase.status === "in-progress" ? "animate-pulse" : ""}`} />
                          {sc.label}
                        </span>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed mb-6">
                      {phase.summary}
                    </p>

                    {/* Feature list */}
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                      {phase.features.map((feat, j) => (
                        <div key={j} className="flex items-start gap-3">
                          {/* Checkmark or circle icon */}
                          {phase.status === "completed" ? (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#22C55E"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mt-0.5 shrink-0"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          ) : phase.status === "in-progress" ? (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#E63946"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mt-0.5 shrink-0"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6l4 2" />
                            </svg>
                          ) : (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#475569"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mt-0.5 shrink-0"
                            >
                              <circle cx="12" cy="12" r="10" />
                            </svg>
                          )}
                          <span className="font-sans text-sm text-[#C4CDD8] leading-snug">
                            {feat}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar for completed / in-progress phases */}
                    {phase.status !== "planned" && (
                      <div className="mt-6 pt-5 border-t border-[#1E2D4A]">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`${label} text-[#475569]`}>Progression</span>
                          <span className={`${label} ${sc.text}`}>
                            {phase.status === "completed" ? "100%" : "40%"}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-[#1E2D4A] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              phase.status === "completed"
                                ? "bg-emerald-400"
                                : "bg-[#E63946]"
                            }`}
                            style={{
                              width: phase.status === "completed" ? "100%" : "40%",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA STRIP — contact / feature request
      ══════════════════════════════════════════ */}
      <section className="relative z-10 px-6 pb-16">
        <div className="max-w-4xl mx-auto nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-8 sm:p-10 text-center">
          <h2 className="nx-display text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-3">
            Une idée? Une suggestion?
          </h2>
          <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed max-w-md mx-auto mb-6">
            Nexus est construit pour la communauté sportive québécoise. Votre opinion est importante pour nous.
          </p>
          <Link
            href="/contact"
            className="nx-ghost-btn h-11 px-8 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center"
          >
            Nous contacter
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER — identical to all pages
      ══════════════════════════════════════════ */}
      <footer className="bg-[#030609]/80 border-t border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#1E2D4A]">

            <div className="flex items-center gap-3">
              <NexusLogo variant="white" height={22} href="/" className="opacity-80" />
              <span className={`${label} text-[#475569]`}>
                Construit pour les étudiants-athlètes québécois
              </span>
            </div>

            <nav className="flex items-center gap-8">
              <Link href="/confidentialite" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Confidentialité</Link>
              <Link href="/conditions" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Conditions</Link>
              <Link href="/contact" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Contact</Link>
            </nav>

            <div className="flex items-center gap-5">
              {SOCIALS.map(({ name, href, d }) => (
                <a key={name} href={href} aria-label={name} target="_blank" rel="noopener noreferrer"
                  className="nx-social-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={d} />
                  </svg>
                </a>
              ))}
            </div>

          </div>

          <p className={`${label} text-[#2E3D55] text-center pt-5`}>&copy; 2026 Nexus — Propulsé par <img src="/brand/logo-white-red.png" alt="WeLead" style={{height:16}} /></p>

        </div>
      </footer>

    </div>
  );
}
