"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";
import PlaybookBackground from "../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Conditions d'utilisation
   Same visual language as confidentialite page:
   dark navy, playbook bg, Montserrat headings, red accents,
   sidebar TOC with scroll-spy.
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

/* ── Terms sections ──────────────────────────────────────────── */

const SECTIONS = [
  {
    id: "acceptation",
    title: "Acceptation des conditions",
    content: [
      "En accédant à la plateforme Nexus (ci-après « la plateforme », « nous », « notre »), vous acceptez d'être lié par les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser la plateforme.",
      "Ces conditions constituent un accord juridique entre vous et Nexus. Votre utilisation continue de la plateforme après la publication de modifications constitue votre acceptation des conditions mises à jour.",
    ],
  },
  {
    id: "admissibilite",
    title: "Admissibilité",
    content: [
      "Pour créer un compte sur Nexus, vous devez :",
    ],
    bullets: [
      "Être âgé d'au moins 18 ans ou avoir le consentement d'un parent ou tuteur légal",
      "Être affilié à une école secondaire ou un programme CÉGEP du Québec en tant qu'entraîneur, directeur ou recruteur",
      "Fournir des renseignements exacts et complets lors de l'inscription",
      "Disposer de l'autorité nécessaire pour agir au nom de votre organisation, le cas échéant",
    ],
    after: [
      "Les profils d'étudiants-athlètes sont créés et gérés par des entraîneurs autorisés. Les athlètes mineurs ne disposent pas de compte individuel dans la version actuelle de la plateforme.",
    ],
  },
  {
    id: "comptes",
    title: "Comptes utilisateurs",
    content: [
      "Vous êtes responsable de maintenir la confidentialité de vos identifiants de connexion et de toute activité effectuée sous votre compte.",
    ],
    bullets: [
      "Ne partagez pas vos identifiants de connexion avec des tiers",
      "Informez-nous immédiatement de toute utilisation non autorisée de votre compte",
      "Vous êtes responsable de la véracité des informations associées à votre compte",
      "Nexus se réserve le droit de suspendre ou de supprimer tout compte en cas de violation des présentes conditions",
    ],
  },
  {
    id: "utilisation",
    title: "Utilisation acceptable",
    content: [
      "En utilisant Nexus, vous vous engagez à respecter les règles suivantes :",
    ],
    bullets: [
      "Utiliser la plateforme uniquement à des fins de recrutement sportif légitime",
      "Ne pas publier de contenu faux, trompeur, diffamatoire ou offensant",
      "Ne pas tenter d'accéder à des données ou fonctionnalités auxquelles vous n'avez pas droit",
      "Ne pas utiliser de robots, scripts ou outils automatisés pour extraire des données de la plateforme",
      "Ne pas contourner les mesures de sécurité ou les restrictions d'accès",
      "Respecter la vie privée des athlètes, en particulier celle des mineurs",
      "Ne pas utiliser les coordonnées obtenues via la plateforme à des fins commerciales ou publicitaires non sollicitées",
    ],
    after: [
      "Toute violation de ces règles peut entraîner la suspension ou la suppression de votre compte, sans préavis.",
    ],
  },
  {
    id: "contenu",
    title: "Contenu et soumissions",
    content: [
      "En soumettant du contenu sur Nexus (profils d'athlètes, statistiques, liens vidéo, commentaires), vous déclarez que :",
    ],
    bullets: [
      "Vous disposez des droits nécessaires pour publier ce contenu",
      "Le contenu est exact et ne viole aucun droit de tiers",
      "Vous accordez à Nexus une licence non exclusive pour afficher et distribuer ce contenu dans le cadre du fonctionnement de la plateforme",
      "Les profils d'athlètes mineurs sont soumis avec le consentement approprié de l'école et des parents ou tuteurs",
    ],
    after: [
      "Nexus se réserve le droit de retirer tout contenu qui viole les présentes conditions ou qui est jugé inapproprié, sans préavis ni obligation de justification.",
    ],
  },
  {
    id: "disponibilite",
    title: "Disponibilité de la plateforme",
    content: [
      "Nexus s'efforce de maintenir la plateforme accessible en tout temps. Cependant, nous ne garantissons pas une disponibilité ininterrompue.",
    ],
    bullets: [
      "La plateforme peut être temporairement indisponible pour maintenance, mises à jour ou améliorations",
      "Des interruptions imprévues peuvent survenir en raison de problèmes techniques, de serveurs ou de réseau",
      "Nexus n'est pas responsable des pertes ou inconvénients résultant d'une indisponibilité temporaire",
    ],
  },
  {
    id: "propriete",
    title: "Propriété intellectuelle",
    content: [
      "La plateforme Nexus, incluant son design, son code source, ses logos, sa marque et son contenu original, est protégée par les lois sur la propriété intellectuelle.",
    ],
    bullets: [
      "Vous ne pouvez pas copier, reproduire, distribuer ou créer des oeuvres dérivées à partir du contenu de la plateforme sans autorisation écrite",
      "Les marques de commerce « Nexus » et « WeLead » sont la propriété exclusive de leurs détenteurs respectifs",
      "Le contenu soumis par les utilisateurs reste la propriété de ses auteurs, sous réserve de la licence accordée à Nexus",
    ],
  },
  {
    id: "tiers",
    title: "Liens et services tiers",
    content: [
      "La plateforme peut contenir des liens vers des sites ou services tiers (Hudl, YouTube, réseaux sociaux, etc.).",
    ],
    bullets: [
      "Nexus n'est pas responsable du contenu, des pratiques de confidentialité ou de la disponibilité des sites tiers",
      "L'inclusion d'un lien ne constitue pas une approbation du site ou service tiers",
      "Votre utilisation de services tiers est soumise à leurs propres conditions d'utilisation",
    ],
  },
  {
    id: "avertissements",
    title: "Avertissements et exclusions",
    content: [
      "La plateforme est fournie « telle quelle » et « selon disponibilité ». Nexus ne fait aucune déclaration ou garantie, expresse ou implicite, concernant :",
    ],
    bullets: [
      "L'exactitude, la fiabilité ou l'exhaustivité des profils d'athlètes ou des statistiques",
      "L'adéquation de la plateforme à vos besoins spécifiques de recrutement",
      "L'absence d'erreurs, de virus ou de composants nuisibles",
      "Les résultats que vous pourriez obtenir en utilisant la plateforme",
    ],
    after: [
      "Les décisions de recrutement restent entièrement sous votre responsabilité. Nexus agit uniquement comme outil de mise en relation et ne garantit aucun résultat.",
    ],
  },
  {
    id: "responsabilite",
    title: "Limitation de responsabilité",
    content: [
      "Dans les limites permises par la loi applicable, Nexus et ses dirigeants, employés, partenaires et fournisseurs ne seront en aucun cas responsables de :",
    ],
    bullets: [
      "Tout dommage indirect, accessoire, spécial, consécutif ou punitif",
      "Toute perte de données, de revenus, de profits ou d'opportunités",
      "Tout dommage résultant de l'utilisation ou de l'impossibilité d'utiliser la plateforme",
      "Tout dommage résultant d'un accès non autorisé à vos données ou transmissions",
    ],
    after: [
      "La responsabilité totale de Nexus envers vous ne dépassera en aucun cas le montant que vous avez payé pour l'utilisation de la plateforme au cours des douze (12) mois précédant la réclamation.",
    ],
  },
  {
    id: "resiliation",
    title: "Résiliation",
    content: [
      "Vous pouvez résilier votre compte à tout moment en nous contactant directement. Nexus se réserve également le droit de résilier ou de suspendre votre accès dans les cas suivants :",
    ],
    bullets: [
      "Violation des présentes conditions d'utilisation",
      "Activité frauduleuse ou comportement abusif sur la plateforme",
      "Inactivité prolongée du compte (plus de 24 mois)",
      "Demande d'une autorité compétente",
    ],
    after: [
      "En cas de résiliation, vos données seront traitées conformément à notre politique de confidentialité. Les profils d'athlètes associés à votre compte pourront être transférés à un autre entraîneur autorisé de votre organisation.",
    ],
  },
  {
    id: "modifications",
    title: "Modifications des conditions",
    content: [
      "Nexus se réserve le droit de modifier les présentes conditions d'utilisation à tout moment.",
      "En cas de modification substantielle, nous vous en informerons par courriel ou par un avis visible sur la plateforme au moins 30 jours avant l'entrée en vigueur des nouvelles conditions.",
      "La date de dernière mise à jour sera indiquée en haut de cette page. Votre utilisation continue de la plateforme après l'entrée en vigueur des modifications constitue votre acceptation des nouvelles conditions.",
    ],
  },
  {
    id: "loi",
    title: "Loi applicable",
    content: [
      "Les présentes conditions sont régies par les lois de la province de Québec et les lois fédérales du Canada qui s'y appliquent.",
      "Tout litige découlant des présentes conditions ou de l'utilisation de la plateforme sera soumis à la compétence exclusive des tribunaux de la province de Québec, district de Montréal.",
      "Si une disposition des présentes conditions est jugée invalide ou inapplicable, les autres dispositions demeureront pleinement en vigueur.",
    ],
  },
  {
    id: "contact",
    title: "Nous contacter",
    content: [
      "Pour toute question concernant les présentes conditions d'utilisation, vous pouvez nous contacter :",
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

/* ── Component ───────────────────────────────────────────────── */

export default function ConditionsPage() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const sectionRefs = useRef<Map<string, IntersectionObserverEntry>>(new Map());

  /* Track which section is currently in view via IntersectionObserver */
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

      {/* ══════════════════════════════════════════
          NAV
      ══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-[#060A14]/92 backdrop-blur-md border-b border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/White%20red%20logo%20@4x.png"
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
            Conditions<br />
            <span className="text-wl-red">d&apos;utilisation</span>
          </h1>

          <p className="font-sans text-base text-[#9AA3B2] leading-relaxed max-w-[520px] mx-auto mb-4">
            Les présentes conditions régissent votre utilisation de la plateforme Nexus. En créant un compte ou en utilisant nos services, vous acceptez ces conditions.
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

            {/* ── Mobile TOC ── */}
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

            {/* ── Main terms content ── */}
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
                src="/brand/White%20red%20logo%20@4x.png"
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

          <p className={`${label} text-[#2E3D55] text-center pt-5`}>&copy; 2026 Nexus — Propulsé par <img src="/brand/White%20red@4x.png" alt="WeLead" style={{height:16}} /></p>

        </div>
      </footer>

    </div>
  );
}
