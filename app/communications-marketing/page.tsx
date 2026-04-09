"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Communications marketing
   Same visual language as /confidentialite.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

const SOCIALS = [
  { name: "Instagram", href: "#", d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
  { name: "Facebook", href: "#", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
  { name: "Twitter / X", href: "#", d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
  { name: "LinkedIn", href: "#", d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
];

const SECTIONS = [
  {
    id: "objet",
    title: "Objet des communications",
    content: [
      "Nexus peut vous envoyer des communications marketing pour vous informer des nouveautés, fonctionnalités, promotions et événements liés à la plateforme de recrutement sportif.",
      "Ces communications sont distinctes des notifications de service (confirmations, alertes de sécurité, mises à jour de profil) qui sont envoyées indépendamment de votre consentement marketing.",
    ],
  },
  {
    id: "types",
    title: "Types de communications",
    content: [
      "Les communications marketing de Nexus peuvent inclure :",
    ],
    bullets: [
      "Infolettres : résumés périodiques des nouveautés de la plateforme, statistiques de recrutement, athlètes vedettes",
      "Promotions : offres spéciales sur les abonnements Pro et All Star, codes promotionnels",
      "Événements : invitations aux webinaires, sessions d'information, événements de recrutement RSEQ",
      "Fonctionnalités : annonces de nouvelles fonctionnalités, améliorations de la plateforme",
      "Programme ambassadeur : informations sur le programme de parrainage et les avantages",
      "Témoignages : histoires de succès de recrutement, parcours d'athlètes recrutés via Nexus",
      "Contenu éducatif : guides pour optimiser un profil athlète, conseils de recrutement, préparation CÉGEP",
    ],
  },
  {
    id: "canaux",
    title: "Canaux de communication",
    content: [
      "Nexus utilise les canaux suivants pour les communications marketing :",
    ],
    bullets: [
      "Courriel : envoyé à l'adresse associée à votre compte Nexus",
      "Notifications in-app : bannières et alertes dans l'interface de la plateforme",
      "Notifications push : si vous avez activé les notifications sur votre appareil (application mobile future)",
    ],
    after: [
      "Nexus ne vous contactera jamais par téléphone, SMS ou messagerie instantanée à des fins marketing sans votre consentement explicite préalable.",
    ],
  },
  {
    id: "consentement",
    title: "Votre consentement",
    content: [
      "Conformément à la Loi 25 sur la protection des renseignements personnels du Québec et à la Loi canadienne anti-pourriel (LCAP) :",
    ],
    bullets: [
      "Le consentement marketing est optionnel : vous pouvez utiliser Nexus sans accepter les communications marketing",
      "Le consentement est distinct : il est séparé de l'acceptation de la politique de confidentialité et de la collecte de données",
      "Le consentement est révocable : vous pouvez le retirer à tout moment, sans affecter votre accès à la plateforme",
      "Opt-in explicite : aucune communication marketing n'est envoyée sans votre accord actif (pas de cases pré-cochées)",
    ],
    after: [
      "Votre choix de consentement marketing est enregistré avec un horodatage pour assurer la traçabilité.",
    ],
  },
  {
    id: "retrait",
    title: "Retrait du consentement",
    content: [
      "Vous pouvez retirer votre consentement aux communications marketing à tout moment par l'un des moyens suivants :",
    ],
    bullets: [
      "Paramètres : dans votre espace Paramètres > Confidentialité, désactivez le toggle « Communications marketing »",
      "Lien de désabonnement : chaque courriel marketing contient un lien « Se désabonner » en pied de page",
      "Courriel direct : envoyez votre demande à confidentialite@nexus-sport.ca",
    ],
    after: [
      "Le retrait prend effet immédiatement. Vous pourriez recevoir des communications déjà programmées dans un délai maximum de 48 heures après le retrait.",
      "Le retrait du consentement marketing n'affecte pas les communications de service essentielles (sécurité, confirmations de compte, notifications de recrutement).",
    ],
  },
  {
    id: "frequence",
    title: "Fréquence et limites",
    content: [
      "Nexus s'engage à respecter votre boîte de réception :",
    ],
    bullets: [
      "Maximum 2 courriels marketing par semaine",
      "Aucun courriel marketing entre 21h et 8h (heure de l'Est)",
      "Pas de campagnes marketing automatisées agressives (drip campaigns de plus de 3 messages)",
      "Possibilité de choisir la fréquence préférée dans vos paramètres (quotidien, hebdomadaire, mensuel)",
    ],
  },
  {
    id: "donnees",
    title: "Données utilisées",
    content: [
      "Pour personnaliser les communications marketing, Nexus peut utiliser les données suivantes :",
    ],
    bullets: [
      "Votre rôle sur la plateforme (athlète, entraîneur, recruteur) pour adapter le contenu",
      "Votre sport principal pour envoyer du contenu pertinent",
      "Votre région pour les événements locaux",
      "Votre niveau d'abonnement pour les offres de mise à niveau appropriées",
      "Vos préférences de notification configurées dans les paramètres",
    ],
    after: [
      "Nexus ne vend, ne loue et ne partage jamais vos données avec des tiers à des fins marketing. Aucune donnée n'est partagée avec des annonceurs ou des plateformes publicitaires.",
    ],
  },
  {
    id: "contact",
    title: "Nous contacter",
    content: [
      "Pour toute question concernant les communications marketing de Nexus :",
    ],
    bullets: [
      "RPRP : Bruno-Philippe Desfossés Simard",
      "Courriel : confidentialite@nexus-sport.ca",
      "Adresse : 856 Basile-Routhier, Repentigny, Québec",
    ],
    after: [
      "Nous répondrons à toute demande dans un délai de 30 jours ouvrables.",
    ],
  },
];

export default function CommunicationsMarketingPage() {
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

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-transparent">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-3 mb-8">
            <span className="w-6 h-px bg-wl-red" />
            <span className={`${label} text-wl-red`}>Document juridique</span>
            <span className="w-6 h-px bg-wl-red" />
          </div>
          <h1 className="font-head text-5xl xl:text-6xl font-black text-white uppercase leading-[0.92] tracking-tight mb-6">
            Communications<br />
            <span className="text-wl-red">marketing</span>
          </h1>
          <p className="font-sans text-base text-[#9AA3B2] leading-relaxed max-w-[560px] mx-auto mb-4">
            Ce document explique quelles communications marketing Nexus peut vous envoyer, comment donner ou retirer votre consentement, et vos droits en vertu de la Loi 25 et de la LCAP.
          </p>
          <p className={`${label} text-[#475569] mt-4`}>
            Dernière mise à jour : 8 avril 2026
          </p>
        </div>
      </section>

      {/* Separator */}
      <div className="nx-sep relative h-14 bg-[#060A14]/60 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#0A1020]/60" style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }} />
      </div>

      {/* ── CONTENT ── */}
      <section className="bg-[#060A14]/75 flex-1">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">

            {/* Sidebar TOC */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <div className={`${label} text-wl-red mb-5`}>Table des matières</div>
                <nav className="flex flex-col gap-1">
                  {SECTIONS.map((s, i) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className={`group flex items-center gap-3 py-2 transition-colors duration-300 ${
                        activeSection === s.id ? "text-wl-red" : "text-[#9AA3B2] hover:text-white"
                      }`}
                    >
                      <span className={`${label} w-6 flex-shrink-0 ${
                        activeSection === s.id ? "text-wl-red" : "text-[#475569] group-hover:text-[#9AA3B2]"
                      } transition-colors`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-sans text-sm leading-tight">{s.title}</span>
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Mobile TOC */}
            <div className="lg:hidden nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-6 mb-4">
              <div className={`${label} text-wl-red mb-4`}>Table des matières</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {SECTIONS.map((s, i) => (
                  <a key={s.id} href={`#${s.id}`} className="flex items-center gap-3 py-1.5 text-[#9AA3B2] hover:text-white transition-colors">
                    <span className={`${label} text-[#475569] w-5 flex-shrink-0`}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-sans text-sm">{s.title}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Main content */}
            <div className="flex flex-col gap-0">
              {SECTIONS.map((section, i) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="nx-policy-section scroll-mt-24 pb-12 mb-12 border-b border-[#1E2D4A] last:border-b-0 last:mb-0 last:pb-0"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <span className="nx-step-num font-head text-5xl font-black text-white/[0.08] leading-none select-none" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="font-head text-2xl font-black text-white uppercase tracking-tight leading-tight">
                      {section.title}
                    </h2>
                  </div>
                  {section.content.map((p, pi) => (
                    <p key={pi} className="font-sans text-sm text-[#C4CDD8] leading-relaxed mb-4">{p}</p>
                  ))}
                  {section.bullets && (
                    <ul className="flex flex-col gap-3 my-5 pl-1">
                      {section.bullets.map((b, bi) => (
                        <li key={bi} className="flex items-start gap-3">
                          <span className="w-5 h-px bg-wl-red mt-2.5 flex-shrink-0" />
                          <span className="font-sans text-sm text-[#9AA3B2] leading-relaxed">{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.after?.map((p, pi) => (
                    <p key={pi} className="font-sans text-sm text-[#C4CDD8] leading-relaxed mt-4">{p}</p>
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

      {/* ── CTA ── */}
      <section className="bg-[#060A14]/75">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className={`${label} text-wl-red mb-3`}>Des questions?</div>
            <h2 className="font-head text-4xl font-black text-white uppercase leading-tight">Contacte-nous</h2>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a href="mailto:confidentialite@nexus-sport.ca" className="h-12 px-8 bg-wl-red text-white font-head font-black text-xs uppercase tracking-widest hover:bg-wl-red-hover transition-colors hover:shadow-[0_8px_28px_rgba(232,72,72,0.38)] hover:-translate-y-0.5 inline-flex items-center">
              confidentialite@nexus-sport.ca
            </a>
            <Link href="/confidentialite" className="nx-ghost-btn h-12 px-8 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center">
              Politique de confidentialit&eacute;
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#030609]/80 border-t border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#1E2D4A]">
            <div className="flex items-center gap-3">
              <Image src="/brand/White%20red%20logo%20@4x.png" alt="Nexus" width={24} height={24} className="object-contain opacity-60" />
              <span className={`${label} text-[#475569]`}>Construit pour les &eacute;tudiants-athl&egrave;tes qu&eacute;b&eacute;cois</span>
            </div>
            <nav className="flex items-center gap-8">
              <Link href="/confidentialite" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Confidentialit&eacute;</Link>
              <Link href="/collecte-donnees" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Collecte</Link>
              <Link href="/conditions" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Conditions</Link>
              <Link href="/contact" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Contact</Link>
            </nav>
            <div className="flex items-center gap-5">
              {SOCIALS.map(({ name, href, d }) => (
                <a key={name} href={href} aria-label={name} target="_blank" rel="noopener noreferrer" className="nx-social-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={d} /></svg>
                </a>
              ))}
            </div>
          </div>
          <p className={`${label} text-[#2E3D55] text-center pt-5`}>&copy; 2026 Nexus — Propuls&eacute; par <img src="/brand/White%20red@4x.png" alt="WeLead" style={{height:16}} /></p>
        </div>
      </footer>
    </div>
  );
}
