"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";
import PlaybookBackground from "../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Politique de confidentialité
   Same visual language as landing / auth / comment-ca-marche:
   dark navy, playbook bg, Montserrat headings, red accents.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

const NAV_LINKS = [
  { label: "Comment ça marche", href: "/comment-ca-marche" },
  { label: "Coaches & Recruteurs", href: "/#roles" },
  { label: "Athlètes", href: "/#athletes" },
  { label: "Roadmap", href: "/roadmap" },
];

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
    name: "Twitter / X",
    href: "#",
    d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    name: "LinkedIn",
    href: "#",
    d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
];

/* ── Policy sections ─────────────────────────────────────────── */

const SECTIONS = [
  {
    id: "introduction",
    title: "Introduction",
    content: [
      "Nexus (ci-après « nous », « notre » ou « la plateforme ») est une plateforme de recrutement sportif dédiée aux étudiants-athlètes du secondaire et aux programmes collégiaux (CÉGEP) du Québec.",
      "La présente politique de confidentialité décrit comment nous recueillons, utilisons, partageons et protégeons vos renseignements personnels lorsque vous utilisez notre plateforme, nos services et notre site web.",
      "En utilisant Nexus, vous acceptez les pratiques décrites dans la présente politique. Si vous n'êtes pas d'accord avec ces pratiques, veuillez ne pas utiliser la plateforme.",
    ],
  },
  {
    id: "collecte",
    title: "Renseignements que nous recueillons",
    content: [
      "Nous recueillons différents types de renseignements selon votre rôle sur la plateforme :",
    ],
    bullets: [
      "Renseignements d'inscription : nom, prénom, adresse courriel, mot de passe, rôle (entraîneur, directeur, recruteur)",
      "Renseignements d'organisation : nom de l'école secondaire ou du CÉGEP, ville, région",
      "Profils d'athlètes : nom, prénom, année de graduation, taille, poids, position, ville d'origine, région, statistiques sportives",
      "Liens externes : URLs vers des vidéos Hudl, YouTube ou autres plateformes de faits saillants",
      "Données d'utilisation : pages consultées, fonctionnalités utilisées, horodatages de connexion",
      "Données techniques : adresse IP, type de navigateur, système d'exploitation, résolution d'écran",
    ],
    after: [
      "Nous ne recueillons pas la date de naissance des athlètes. Les profils d'athlètes mineurs sont créés et gérés par les entraîneurs autorisés.",
    ],
  },
  {
    id: "utilisation",
    title: "Utilisation des renseignements",
    content: [
      "Nous utilisons les renseignements recueillis aux fins suivantes :",
    ],
    bullets: [
      "Fournir, maintenir et améliorer les services de la plateforme",
      "Permettre aux entraîneurs de créer et gérer les profils d'athlètes",
      "Permettre aux recruteurs de rechercher, filtrer et consulter les profils approuvés",
      "Faciliter les demandes de contact entre recruteurs et entraîneurs",
      "Gérer les comptes utilisateurs et les rôles au sein des organisations",
      "Assurer la sécurité de la plateforme et prévenir les utilisations frauduleuses",
      "Envoyer des communications liées au service (confirmations, notifications, mises à jour)",
      "Analyser l'utilisation de la plateforme pour améliorer l'expérience utilisateur",
    ],
  },
  {
    id: "partage",
    title: "Partage des renseignements",
    content: [
      "Nous ne vendons pas vos renseignements personnels. Nous pouvons partager vos données dans les cas suivants :",
    ],
    bullets: [
      "Avec les utilisateurs autorisés : les profils d'athlètes approuvés sont visibles par les recruteurs vérifiés de programmes CÉGEP",
      "Avec votre organisation : les directeurs peuvent consulter les données des entraîneurs et athlètes de leur école",
      "Avec nos fournisseurs de services : hébergement, authentification et outils d'analyse, sous contrat de confidentialité",
      "Pour respecter la loi : si requis par une ordonnance judiciaire, une loi applicable ou une autorité réglementaire",
      "Pour protéger nos droits : en cas de violation des conditions d'utilisation ou de menace à la sécurité de la plateforme",
    ],
  },
  {
    id: "conservation",
    title: "Conservation des données",
    content: [
      "Nous conservons vos renseignements personnels aussi longtemps que votre compte est actif ou que nécessaire pour fournir nos services.",
      "Les profils d'athlètes archivés sont conservés pendant une période maximale de 3 ans après leur archivage, puis supprimés de façon permanente.",
      "Vous pouvez demander la suppression de votre compte et de vos données à tout moment en nous contactant directement.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies et technologies de suivi",
    content: [
      "Nexus utilise des cookies et technologies similaires pour :",
    ],
    bullets: [
      "Maintenir votre session de connexion active",
      "Mémoriser vos préférences (thème, langue, filtres)",
      "Analyser l'utilisation de la plateforme de manière agrégée",
      "Améliorer les performances et la stabilité du service",
    ],
    after: [
      "Vous pouvez configurer votre navigateur pour refuser les cookies. Cependant, certaines fonctionnalités de la plateforme pourraient ne pas fonctionner correctement sans cookies.",
    ],
  },
  {
    id: "droits",
    title: "Vos droits",
    content: [
      "Conformément aux lois québécoises et canadiennes sur la protection des renseignements personnels, vous disposez des droits suivants :",
    ],
    bullets: [
      "Droit d'accès : consulter les renseignements personnels que nous détenons à votre sujet",
      "Droit de rectification : demander la correction de renseignements inexacts ou incomplets",
      "Droit de suppression : demander la suppression de vos renseignements personnels",
      "Droit de retrait du consentement : retirer votre consentement à tout moment",
      "Droit de portabilité : obtenir une copie de vos données dans un format structuré",
    ],
    after: [
      "Pour exercer ces droits, contactez-nous à l'adresse indiquée dans la section « Nous contacter » ci-dessous.",
    ],
  },
  {
    id: "securite",
    title: "Sécurité des données",
    content: [
      "Nous mettons en place des mesures techniques et organisationnelles appropriées pour protéger vos renseignements personnels :",
    ],
    bullets: [
      "Chiffrement des données en transit (HTTPS/TLS) et au repos",
      "Contrôle d'accès basé sur les rôles (RBAC) pour limiter l'accès aux données",
      "Authentification sécurisée avec hachage des mots de passe",
      "Hébergement des données au Canada, conforme aux exigences de résidence des données",
      "Surveillance continue et journaux d'audit des accès",
    ],
    after: [
      "Aucune méthode de transmission ou de stockage électronique n'est totalement sécurisée. Bien que nous nous efforcions de protéger vos données, nous ne pouvons garantir une sécurité absolue.",
    ],
  },
  {
    id: "tiers",
    title: "Services tiers",
    content: [
      "Nexus peut intégrer ou faire appel à des services tiers pour le fonctionnement de la plateforme. Ces services incluent, sans s'y limiter :",
    ],
    bullets: [
      "Supabase : authentification et base de données",
      "Vercel : hébergement et déploiement de l'application",
      "Google Analytics : analyse de l'utilisation (données agrégées uniquement)",
    ],
    after: [
      "Chaque service tiers dispose de sa propre politique de confidentialité. Nous vous encourageons à les consulter. Nous sélectionnons nos partenaires en fonction de leurs engagements en matière de protection des données.",
    ],
  },
  {
    id: "mineurs",
    title: "Protection des mineurs",
    content: [
      "Nexus est conçu pour faciliter le recrutement d'étudiants-athlètes, dont certains sont mineurs. Nous prenons la protection de leurs données très au sérieux :",
    ],
    bullets: [
      "Les profils d'athlètes mineurs sont créés et gérés exclusivement par des entraîneurs autorisés et vérifiés",
      "Aucune donnée de naissance n'est recueillie dans la version actuelle de la plateforme",
      "Les coordonnées personnelles des athlètes ne sont pas accessibles directement aux recruteurs",
      "Un système de demandes de contact encadre toute communication entre recruteurs et entraîneurs",
      "Les profils doivent être approuvés par un administrateur avant d'être visibles aux recruteurs",
    ],
  },
  {
    id: "modifications",
    title: "Modifications de la politique",
    content: [
      "Nous pouvons mettre à jour cette politique de confidentialité de temps à autre pour refléter les changements apportés à nos pratiques ou aux exigences légales.",
      "En cas de modification substantielle, nous vous en informerons par courriel ou par un avis visible sur la plateforme. La date de dernière mise à jour sera indiquée en haut de cette page.",
      "Votre utilisation continue de la plateforme après la publication des modifications constitue votre acceptation de la politique mise à jour.",
    ],
  },
  {
    id: "contact",
    title: "Nous contacter",
    content: [
      "Pour toute question ou demande concernant cette politique de confidentialité ou le traitement de vos renseignements personnels, vous pouvez nous contacter :",
    ],
    bullets: [
      "Par courriel : info@welead.ca",
      "Par la page de contact de la plateforme",
    ],
    after: [
      "Nous nous engageons à répondre à toute demande dans un délai de 30 jours ouvrables.",
    ],
  },
];

/* ── Table of contents (built from sections) ─────────────────── */

export default function ConfidentialitePage() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const sectionRefs = useRef<Map<string, IntersectionObserverEntry>>(new Map());

  /* Track which section is currently in view via IntersectionObserver */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          sectionRefs.current.set(entry.target.id, entry);
        });

        /* Find the topmost visible section */
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

    /* Observe all section elements */
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />

      {/* ══════════════════════════════════════════
          NAV
      ══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-[#060A14]/92 backdrop-blur-md border-b border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/Profile%20white%20trans@4x.png"
              alt="Nexus"
              width={32}
              height={32}
              className="object-contain nx-logo-dark"
            />
            <Image
              src="/brand/Profile%20trans@4x.png"
              alt="Nexus"
              width={32}
              height={32}
              className="object-contain nx-logo-light"
            />
            <span className="font-head font-black text-white text-base tracking-[0.06em] uppercase hidden sm:block">
              Nexus
            </span>
          </Link>

          <ul className="hidden md:flex items-center gap-8 list-none">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={`${label} text-[#9AA3B2] hover:text-white transition-colors`}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/auth" className={`hidden sm:block ${label} text-wl-red transition-colors px-4 h-9 leading-9 hover:drop-shadow-[0_0_8px_rgba(232,72,72,0.6)]`}>
              Connexion
            </Link>
            <Link href="/auth?mode=signup" className="nx-ghost-btn h-9 px-5 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center">
              S&apos;inscrire
            </Link>
          </div>

        </div>
      </nav>

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

          <h1 className="font-head text-5xl xl:text-6xl font-black text-white uppercase leading-[0.92] tracking-tight mb-6">
            Politique de<br />
            <span className="text-wl-red">confidentialité</span>
          </h1>

          <p className="font-sans text-base text-[#9AA3B2] leading-relaxed max-w-[520px] mx-auto mb-4">
            La protection de vos renseignements personnels est une priorité pour Nexus. Cette politique explique comment nous recueillons, utilisons et protégeons vos données.
          </p>

          <p className={`${label} text-[#475569] mt-4`}>
            Dernière mise à jour : 6 mars 2026
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

            {/* ── Sidebar: Table of Contents ── */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <div className={`${label} text-wl-red mb-5`}>Table des matières</div>
                <nav className="flex flex-col gap-1">
                  {SECTIONS.map((s, i) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className={`group flex items-center gap-3 py-2 transition-colors duration-300 ${
                        activeSection === s.id
                          ? "text-wl-red"
                          : "text-[#9AA3B2] hover:text-white"
                      }`}
                    >
                      <span className={`${label} w-6 flex-shrink-0 ${
                        activeSection === s.id ? "text-wl-red" : "text-[#475569] group-hover:text-[#9AA3B2]"
                      } transition-colors`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-sans text-sm leading-tight">
                        {s.title}
                      </span>
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* ── Mobile TOC (accordion) ── */}
            <div className="lg:hidden nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-6 mb-4">
              <div className={`${label} text-wl-red mb-4`}>Table des matières</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {SECTIONS.map((s, i) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-3 py-1.5 text-[#9AA3B2] hover:text-white transition-colors"
                  >
                    <span className={`${label} text-[#475569] w-5 flex-shrink-0`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-sans text-sm">{s.title}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* ── Main policy content ── */}
            <div className="flex flex-col gap-0">
              {SECTIONS.map((section, i) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="nx-policy-section scroll-mt-24 pb-12 mb-12 border-b border-[#1E2D4A] last:border-b-0 last:mb-0 last:pb-0"
                >
                  {/* Section number + title */}
                  <div className="flex items-center gap-4 mb-6">
                    <span className="nx-step-num font-head text-5xl font-black text-white/[0.08] leading-none select-none" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="font-head text-2xl font-black text-white uppercase tracking-tight leading-tight">
                      {section.title}
                    </h2>
                  </div>

                  {/* Paragraphs */}
                  {section.content.map((p, pi) => (
                    <p key={pi} className="font-sans text-sm text-[#C4CDD8] leading-relaxed mb-4">
                      {p}
                    </p>
                  ))}

                  {/* Bullet list */}
                  {section.bullets && (
                    <ul className="flex flex-col gap-3 my-5 pl-1">
                      {section.bullets.map((b, bi) => (
                        <li key={bi} className="flex items-start gap-3">
                          <span className="w-5 h-px bg-wl-red mt-2.5 flex-shrink-0" />
                          <span className="font-sans text-sm text-[#9AA3B2] leading-relaxed">
                            {b}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* After-bullets paragraphs */}
                  {section.after?.map((p, pi) => (
                    <p key={pi} className="font-sans text-sm text-[#C4CDD8] leading-relaxed mt-4">
                      {p}
                    </p>
                  ))}
                </article>
              ))}
            </div>

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
            <h2 className="font-head text-4xl font-black text-white uppercase leading-tight">
              Contacte-nous
            </h2>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a href="mailto:info@welead.ca" className="h-12 px-8 bg-wl-red text-white font-head font-black text-xs uppercase tracking-widest hover:bg-wl-red-hover transition-colors hover:shadow-[0_8px_28px_rgba(232,72,72,0.38)] hover:-translate-y-0.5 inline-flex items-center">
              info@welead.ca
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

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="bg-[#030609]/80 border-t border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#1E2D4A]">

            <div className="flex items-center gap-3">
              <Image
                src="/brand/Profile%20white%20trans@4x.png"
                alt="Nexus"
                width={24}
                height={24}
                className="object-contain opacity-60"
              />
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

          <p className={`${label} text-[#2E3D55] text-center pt-5`}>&copy; 2025 Nexus</p>

        </div>
      </footer>

    </div>
  );
}
