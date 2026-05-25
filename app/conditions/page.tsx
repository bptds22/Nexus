"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../components/PlaybookBackground";
import Footer from "@/components/marketing/Footer";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Conditions d'utilisation (Loi 25 aligned, v2.0)
   15 sections + subsections, callouts, code-of-conduct lists.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/* ── Block model ─────────────────────────────────────────────── */

type Block =
  | { type: "p"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "callout"; tone: "red" | "yellow" | "green" | "blue"; title?: string; text: string }
  | { type: "contact-card"; rows: { label: string; value: string; href?: string }[] }
  | { type: "subsection"; id: string; title: string; blocks: Block[] };

type Section = { id: string; title: string; emphasized?: boolean; blocks: Block[] };

const RPRP_CONTACT_ROWS: { label: string; value: string; href?: string }[] = [
  { label: "RPRP", value: "Bruno-Philippe Taillon Desfossés Simard" },
  { label: "Courriel", value: "confidentialite@nexussports.ca", href: "mailto:confidentialite@nexussports.ca" },
  { label: "Téléphone", value: "438-498-0494", href: "tel:4384980494" },
  { label: "Adresse", value: "856, rue Basile-Routhier, Repentigny (Québec) J6A 7Y4" },
];

/* ── Terms sections ──────────────────────────────────────────── */

const SECTIONS: Section[] = [
  {
    id: "acceptation",
    title: "Acceptation des conditions",
    blocks: [
      { type: "p", text: "En accédant à la plateforme Nexus, vous acceptez d'être lié par les présentes conditions d'utilisation. Ces conditions constituent un accord juridique entre vous et Nexus. Votre utilisation continue après la publication de modifications constitue votre acceptation des conditions mises à jour." },
      { type: "p", text: "Les présentes conditions sont complétées par notre Politique de confidentialité, qui décrit nos pratiques en matière de protection des renseignements personnels conformément à la Loi 25 du Québec." },
    ],
  },
  {
    id: "admissibilite",
    title: "Admissibilité",
    blocks: [
      { type: "p", text: "Pour créer un compte sur Nexus, vous devez :" },
      {
        type: "bullets",
        items: [
          "Être âgé d'au moins 18 ans ou, si vous êtes un athlète de 14 à 17 ans, avoir obtenu le consentement de votre parent ou tuteur légal",
          "Être affilié à une école secondaire ou un programme CÉGEP du Québec",
          "Fournir des renseignements exacts et complets",
          "Disposer de l'autorité nécessaire pour agir au nom de votre organisation, le cas échéant",
          "Être rattaché à un établissement ayant signé une entente de sous-traitance avec Nexus (Loi 25)",
        ],
      },
      { type: "p", text: "Les profils d'étudiants-athlètes mineurs sont créés et gérés par des entraîneurs autorisés. Un athlète de 14 à 17 ans peut également initier la création de son propre profil, sous réserve du consentement parental." },
    ],
  },
  {
    id: "comptes",
    title: "Comptes utilisateurs",
    blocks: [
      { type: "p", text: "Vous êtes responsable de maintenir la confidentialité de vos identifiants de connexion et de toute activité effectuée sous votre compte." },
      {
        type: "bullets",
        items: [
          "Ne partagez pas vos identifiants avec des tiers",
          "Informez-nous immédiatement de toute utilisation non autorisée de votre compte",
          "Vous êtes responsable de la véracité des informations associées à votre compte",
          "Nexus se réserve le droit de suspendre ou de supprimer tout compte en cas de violation des présentes conditions",
        ],
      },
      {
        type: "callout",
        tone: "blue",
        title: "Contrat institutionnel Loi 25",
        text: "L'accès aux données d'athlètes est conditionnel à la signature d'une entente de sous-traitance par votre établissement. Sans cette entente, votre compte est actif mais les fonctionnalités de consultation des profils d'athlètes sont désactivées.",
      },
    ],
  },
  {
    id: "rseq",
    title: "Alignement RSEQ et sport étudiant",
    emphasized: true,
    blocks: [
      {
        type: "callout",
        tone: "green",
        text: "Nexus s'inscrit dans l'écosystème du sport étudiant québécois et s'engage à respecter les principes de la Politique en matière de protection de l'intégrité du RSEQ (mise à jour juin 2025). Tous les utilisateurs de Nexus sont tenus de se conformer aux codes de conduite applicables du RSEQ.",
      },
      {
        type: "subsection",
        id: "rseq-communication",
        title: "4.1 — Communication avec les mineurs",
        blocks: [
          {
            type: "callout",
            tone: "red",
            title: "Principe coach-as-intermediary",
            text: "Conformément à la Politique d'intégrité du RSEQ, toute communication électronique avec un participant de moins de 18 ans doit inclure les parents. Nexus applique ce principe.",
          },
          {
            type: "bullets",
            items: [
              "Aucun recruteur ne peut communiquer directement avec un athlète mineur. Toute communication passe par l'entraîneur.",
              "L'entraîneur agit comme intermédiaire (modèle coach-as-intermediary du RSEQ).",
              "Les coordonnées personnelles de l'athlète mineur ne sont jamais communiquées aux recruteurs sans consentement parental spécifique additionnel.",
              "Les messages de groupe sont privilégiés par rapport aux messages privés.",
            ],
          },
        ],
      },
      {
        type: "subsection",
        id: "rseq-integrite",
        title: "4.2 — Protection de l'intégrité",
        blocks: [
          { type: "p", text: "Nexus adopte les principes fondamentaux de la Politique d'intégrité du RSEQ. Aucune forme d'abus, de harcèlement, de négligence ou de violence n'est tolérée sur la Plateforme. Tout manquement entraîne la suspension immédiate du compte et le signalement à l'établissement d'attache." },
        ],
      },
      {
        type: "subsection",
        id: "rseq-signalement",
        title: "4.3 — Obligation de signalement",
        blocks: [
          {
            type: "callout",
            tone: "red",
            title: "Loi sur la protection de la jeunesse",
            text: "Conformément à la Loi sur la protection de la jeunesse du Québec, toute personne ayant des motifs raisonnables de soupçonner une situation d'abus sexuel ou physique commis sur un mineur doit le signaler au Directeur de la protection de la jeunesse (DPJ), peu importe l'auteur présumé. DPJ : 1-800-361-5310.",
          },
        ],
      },
    ],
  },
  {
    id: "codes",
    title: "Codes de conduite par rôle",
    blocks: [
      { type: "p", text: "Chaque rôle sur la Plateforme s'engage à respecter le code de conduite suivant, en complément des codes RSEQ et des règles propres à son établissement." },
      {
        type: "subsection",
        id: "codes-entraineurs",
        title: "5.1 — Entraîneurs",
        blocks: [
          {
            type: "bullets",
            items: [
              "S'assurer du consentement parental valide avant d'activer le profil d'un athlète mineur",
              "Saisir des données exactes et à jour, provenant de sources institutionnelles fiables",
              "Ne pas évaluer un athlète sur des critères discriminatoires (origine, religion, orientation, etc.)",
              "Agir comme intermédiaire neutre dans toute communication entre recruteur et athlète mineur",
              "Signaler tout incident, manquement éthique ou violation des droits d'un athlète",
              "Ne pas exploiter sa position pour obtenir des avantages personnels d'un recruteur",
            ],
          },
        ],
      },
      {
        type: "subsection",
        id: "codes-recruteurs",
        title: "5.2 — Recruteurs",
        blocks: [
          {
            type: "bullets",
            items: [
              "Ne consulter les profils d'athlètes qu'aux fins de recrutement pour son CÉGEP d'attache",
              "Ne jamais contacter directement un athlète mineur — toute communication passe par l'entraîneur",
              "Ne pas effectuer d'extraction massive (capture d'écran systématique, export, scraping) des données d'athlètes",
              "Respecter les statuts du pipeline et ne pas faire pression sur un athlète déjà engagé ailleurs",
              "Évaluer les athlètes sur la base de leurs compétences sportives et académiques, sans discrimination",
              "Respecter le droit de l'athlète au retrait à toute étape du processus de recrutement",
            ],
          },
        ],
      },
      {
        type: "subsection",
        id: "codes-directeurs-ecoles",
        title: "5.3 — Directeurs (écoles secondaires)",
        blocks: [
          {
            type: "bullets",
            items: [
              "S'assurer que l'école a signé l'entente de sous-traitance Loi 25 avant toute utilisation",
              "Désigner et soutenir un RPRP d'établissement",
              "Encadrer les entraîneurs de son école dans le respect du consentement parental et du code de conduite",
              "Recevoir et traiter les plaintes ou signalements provenant des parents ou athlètes",
              "Veiller à la révocation des accès des entraîneurs quittant l'établissement",
            ],
          },
        ],
      },
      {
        type: "subsection",
        id: "codes-directeurs-cegeps",
        title: "5.4 — Directeurs (CÉGEPs)",
        blocks: [
          {
            type: "bullets",
            items: [
              "S'assurer que le CÉGEP a signé l'entente de sous-traitance Loi 25 avant toute utilisation",
              "Désigner et soutenir un RPRP d'établissement",
              "Encadrer les recruteurs de son CÉGEP dans le respect du modèle coach-as-intermediary",
              "Vérifier que les communications avec les athlètes mineurs passent toujours par l'entraîneur",
              "Recevoir et traiter les plaintes ou signalements provenant des écoles ou des familles",
            ],
          },
        ],
      },
      {
        type: "subsection",
        id: "codes-athletes",
        title: "5.5 — Athlètes",
        blocks: [
          {
            type: "bullets",
            items: [
              "Fournir des renseignements exacts (résultats scolaires, données physiques, statistiques)",
              "Ne pas créer plusieurs comptes ou se faire passer pour quelqu'un d'autre",
              "Respecter le droit à la vie privée des autres athlètes",
              "Signaler à l'entraîneur ou au RPRP tout comportement inapproprié d'un utilisateur de la Plateforme",
              "Comprendre que le retrait du consentement entraîne la désactivation du profil sans préjudice",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "utilisation",
    title: "Utilisation acceptable",
    blocks: [
      { type: "p", text: "En utilisant Nexus, vous vous engagez à respecter les règles suivantes :" },
      {
        type: "bullets",
        items: [
          "Utiliser la Plateforme uniquement à des fins de recrutement sportif légitime",
          "Ne pas publier de contenu faux, trompeur, diffamatoire ou offensant",
          "Ne pas tenter d'accéder à des données ou fonctionnalités auxquelles vous n'avez pas droit",
          "Ne pas utiliser de robots, scripts ou outils automatisés pour extraire des données de la Plateforme",
          "Ne pas contourner les mesures de sécurité ou les restrictions d'accès",
          "Respecter la vie privée des athlètes, en particulier celle des mineurs",
          "Ne pas utiliser les coordonnées obtenues via la Plateforme à des fins commerciales ou publicitaires non sollicitées",
        ],
      },
      { type: "p", text: "Toute violation de ces règles peut entraîner la suspension ou la suppression de votre compte, sans préavis, ainsi qu'un signalement à votre établissement d'attache." },
    ],
  },
  {
    id: "contenu",
    title: "Contenu et soumissions",
    blocks: [
      { type: "p", text: "En soumettant du contenu sur Nexus (profils d'athlètes, statistiques, liens vidéo, commentaires), vous déclarez que :" },
      {
        type: "bullets",
        items: [
          "Vous disposez des droits nécessaires pour publier ce contenu",
          "Le contenu est exact et ne viole aucun droit de tiers",
          "Vous accordez à Nexus une licence non exclusive pour afficher et distribuer ce contenu dans le cadre du fonctionnement de la Plateforme",
          "Les profils d'athlètes mineurs sont soumis avec le consentement approprié de l'école et des parents ou tuteurs",
        ],
      },
      { type: "p", text: "Nexus se réserve le droit de retirer tout contenu qui viole les présentes conditions ou qui est jugé inapproprié, sans préavis ni obligation de justification." },
    ],
  },
  {
    id: "disponibilite",
    title: "Disponibilité",
    blocks: [
      { type: "p", text: "Nexus s'efforce de maintenir la Plateforme accessible en tout temps. Cependant, nous ne garantissons pas une disponibilité ininterrompue." },
      {
        type: "bullets",
        items: [
          "La Plateforme peut être temporairement indisponible pour maintenance, mises à jour ou améliorations",
          "Des interruptions imprévues peuvent survenir en raison de problèmes techniques, de serveurs ou de réseau",
          "Nexus n'est pas responsable des pertes ou inconvénients résultant d'une indisponibilité temporaire",
        ],
      },
    ],
  },
  {
    id: "propriete",
    title: "Propriété intellectuelle",
    blocks: [
      { type: "p", text: "La Plateforme Nexus, incluant son design, son code source, ses logos, sa marque et son contenu original, est protégée par les lois sur la propriété intellectuelle." },
      {
        type: "bullets",
        items: [
          "Vous ne pouvez pas copier, reproduire, distribuer ou créer des œuvres dérivées à partir du contenu de la Plateforme sans autorisation écrite",
          "La marque de commerce « Nexus » est la propriété exclusive de ses détenteurs",
          "Le contenu soumis par les utilisateurs reste la propriété de ses auteurs, sous réserve de la licence accordée à Nexus pour le fonctionnement de la Plateforme",
        ],
      },
    ],
  },
  {
    id: "avertissements",
    title: "Avertissements et exclusions",
    blocks: [
      { type: "p", text: "La Plateforme est fournie « telle quelle » et « selon disponibilité ». Nexus ne fait aucune déclaration ou garantie, expresse ou implicite, concernant :" },
      {
        type: "bullets",
        items: [
          "L'exactitude, la fiabilité ou l'exhaustivité des profils d'athlètes ou des statistiques",
          "L'adéquation de la Plateforme à vos besoins spécifiques de recrutement",
          "L'absence d'erreurs, de virus ou de composants nuisibles",
          "Les résultats que vous pourriez obtenir en utilisant la Plateforme",
        ],
      },
      { type: "p", text: "Les décisions de recrutement restent entièrement sous votre responsabilité. Nexus agit uniquement comme outil de mise en relation et ne garantit aucun résultat." },
    ],
  },
  {
    id: "responsabilite",
    title: "Limitation de responsabilité",
    blocks: [
      { type: "p", text: "Dans les limites permises par la loi applicable, Nexus et ses dirigeants, employés, partenaires et fournisseurs ne seront en aucun cas responsables de :" },
      {
        type: "bullets",
        items: [
          "Tout dommage indirect, accessoire, spécial, consécutif ou punitif",
          "Toute perte de données, de revenus, de profits ou d'opportunités",
          "Tout dommage résultant de l'utilisation ou de l'impossibilité d'utiliser la Plateforme",
          "Tout dommage résultant d'un accès non autorisé à vos données ou transmissions, sauf en cas de faute prouvée de Nexus",
        ],
      },
      { type: "p", text: "La responsabilité totale de Nexus envers vous ne dépassera en aucun cas le montant que vous avez payé pour l'utilisation de la Plateforme au cours des douze (12) mois précédant la réclamation." },
    ],
  },
  {
    id: "sanctions",
    title: "Sanctions et résiliation",
    blocks: [
      { type: "p", text: "Vous pouvez résilier votre compte à tout moment en nous contactant directement. Nexus se réserve également le droit de résilier ou de suspendre votre accès dans les cas suivants :" },
      {
        type: "bullets",
        items: [
          "Violation des présentes conditions d'utilisation ou du code de conduite applicable",
          "Activité frauduleuse, harcèlement ou comportement abusif sur la Plateforme",
          "Manquement à l'obligation d'obtenir le consentement parental valide",
          "Inactivité prolongée du compte (plus de 24 mois)",
          "Demande d'une autorité compétente",
        ],
      },
      { type: "p", text: "En cas de résiliation, vos données seront traitées conformément à notre Politique de confidentialité. Les profils d'athlètes associés à votre compte pourront être transférés à un autre entraîneur autorisé de votre organisation, sous réserve du consentement parental." },
    ],
  },
  {
    id: "modifications",
    title: "Modifications",
    blocks: [
      { type: "p", text: "Nexus se réserve le droit de modifier les présentes conditions d'utilisation à tout moment." },
      { type: "p", text: "En cas de modification substantielle, nous vous en informerons par courriel ou par un avis visible sur la Plateforme au moins 30 jours avant l'entrée en vigueur des nouvelles conditions." },
      { type: "p", text: "La date de dernière mise à jour figure en haut de cette page. Votre utilisation continue de la Plateforme après l'entrée en vigueur des modifications constitue votre acceptation des nouvelles conditions." },
    ],
  },
  {
    id: "loi",
    title: "Loi applicable",
    blocks: [
      { type: "p", text: "Les présentes conditions sont régies par les lois de la province de Québec et les lois fédérales du Canada qui s'y appliquent." },
      { type: "p", text: "Tout litige découlant des présentes conditions ou de l'utilisation de la Plateforme sera soumis à la compétence exclusive des tribunaux de la province de Québec, district de Montréal." },
      { type: "p", text: "Si une disposition des présentes conditions est jugée invalide ou inapplicable, les autres dispositions demeureront pleinement en vigueur." },
    ],
  },
  {
    id: "contact",
    title: "Nous contacter",
    blocks: [
      { type: "p", text: "Pour toute question concernant les présentes conditions d'utilisation, vous pouvez nous contacter :" },
      { type: "contact-card", rows: RPRP_CONTACT_ROWS },
      { type: "p", text: "Nous nous engageons à répondre à toute demande dans un délai de 30 jours ouvrables." },
    ],
  },
];

/* ── Block renderer ──────────────────────────────────────────── */

function renderBlocks(blocks: Block[]): ReactNode {
  return blocks.map((block, i) => {
    switch (block.type) {
      case "p":
        return (
          <p key={i} className="font-sans text-sm text-[#C4CDD8] leading-relaxed mb-4">
            {block.text}
          </p>
        );

      case "bullets":
        return (
          <ul key={i} className="flex flex-col gap-3 my-5 pl-1">
            {block.items.map((b, bi) => (
              <li key={bi} className="flex items-start gap-3">
                <span className="w-5 h-px bg-wl-red mt-2.5 flex-shrink-0" />
                <span className="font-sans text-sm text-[#9AA3B2] leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        );

      case "callout": {
        const tones = {
          red: { border: "border-l-wl-red", bg: "bg-wl-red/10", text: "text-wl-red" },
          yellow: { border: "border-l-[#F59E0B]", bg: "bg-[#F59E0B]/10", text: "text-[#F59E0B]" },
          green: { border: "border-l-[#22C55E]", bg: "bg-[#22C55E]/10", text: "text-[#22C55E]" },
          blue: { border: "border-l-[#3B82F6]", bg: "bg-[#3B82F6]/10", text: "text-[#3B82F6]" },
        }[block.tone];
        return (
          <div
            key={i}
            className={`my-5 border-l-4 ${tones.border} ${tones.bg} px-5 py-4 rounded-r`}
          >
            {block.title && (
              <div className={`${label} ${tones.text} mb-2`}>{block.title}</div>
            )}
            <p className="font-sans text-sm text-[#E5E7EB] leading-relaxed">
              {block.text}
            </p>
          </div>
        );
      }

      case "contact-card":
        return (
          <div
            key={i}
            className="my-5 bg-[#0A1428] border border-[#1E2D4A] rounded-md p-5"
          >
            <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-3 gap-x-4">
              {block.rows.map((r, ri) => (
                <div key={ri} className="contents">
                  <dt className={`${label} text-[#475569] pt-0.5`}>{r.label}</dt>
                  <dd className="font-sans text-sm text-[#E5E7EB] leading-relaxed">
                    {r.href ? (
                      <a href={r.href} className="hover:text-wl-red transition-colors">
                        {r.value}
                      </a>
                    ) : (
                      r.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );

      case "subsection":
        return (
          <section
            key={i}
            id={block.id}
            className="mt-8 pt-4 border-t border-[#1E2D4A]/60 scroll-mt-24"
          >
            <h3 className="font-head font-black text-base text-white uppercase tracking-tight mb-4">
              {block.title}
            </h3>
            {renderBlocks(block.blocks)}
          </section>
        );

      default:
        return null;
    }
  });
}

/* ── Component ───────────────────────────────────────────────── */

export default function ConditionsPage() {
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

            {/* ── Sidebar: Table of Contents ── */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <div className={`${label} text-wl-red mb-5`}>Table des matières</div>
                <nav className="flex flex-col gap-1">
                  {SECTIONS.map((s, i) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className={`group flex items-center gap-3 py-2 transition-colors duration-300 border-l-2 pl-3 -ml-3 ${
                        activeSection === s.id
                          ? "text-wl-red border-wl-red"
                          : "text-[#9AA3B2] hover:text-white border-transparent"
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
                  className={`nx-policy-section scroll-mt-24 pb-12 mb-12 border-b border-[#1E2D4A] last:border-b-0 last:mb-0 last:pb-0 ${
                    section.emphasized ? "border-l-4 border-l-[#F59E0B] pl-6" : ""
                  }`}
                >
                  {/* Section number + title */}
                  <div className="flex items-center gap-4 mb-6">
                    <span className="nx-step-num nx-display text-5xl font-black text-white/[0.08] leading-none select-none" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="nx-display text-2xl font-black text-white uppercase tracking-tight leading-tight">
                      {section.title}
                    </h2>
                  </div>

                  {renderBlocks(section.blocks)}
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
