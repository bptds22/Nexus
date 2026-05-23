"use client";

import { useState, useEffect, useRef } from "react";
import NexusLogo from "@/components/ui/NexusLogo";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Collecte et traitement des données
   Same visual language as /confidentialite.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

const SOCIALS = [
  { name: "Instagram", href: "#", d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
  { name: "Facebook", href: "#", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
  { name: "YouTube", href: "#", d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
  { name: "TikTok", href: "#", d: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" },
];

const SECTIONS = [
  {
    id: "renseignements-collectes",
    title: "Renseignements collectés",
    content: [
      "Nexus recueille différentes catégories de renseignements personnels selon votre rôle sur la plateforme (athlète, entraîneur, recruteur, directeur). Voici le détail complet des données collectées :",
    ],
    bullets: [
      "Identité : prénom, nom de famille, adresse courriel, mot de passe (haché), numéro de téléphone",
      "Profil athlète : date de naissance, genre, photo, année de diplomation, école secondaire, sport principal et secondaire, position, numéro de jersey",
      "Données académiques : moyenne générale, matières fortes, mentions académiques, programme CÉGEP visé, ouverture CÉGEP privé/anglophone, régions préférées",
      "Données physiques : taille, poids, envergure, taille des mains, main dominante, pied dominant",
      "Tests athlétiques : 40 verges, saut vertical, saut en longueur, développé couché, navette d'agilité, sprint 100m",
      "Médias : vidéos de faits saillants, liens Hudl/YouTube/Instagram, vidéo d'entraînement, vidéo de match complet",
      "Évaluations d'entraîneur : leadership, discipline, coachabilité, intelligence de jeu, compétitivité, esprit d'équipe, résilience, attitude/mentalité, cote globale, distinctions, rapport d'entraîneur",
      "Données de recrutement : statut de recrutement, favoris, notes de pipeline, étapes de recrutement, lettres d'intention",
      "Données parentales (mineurs) : nom du parent/tuteur, téléphone du parent, consentement parental et date",
      "Données d'utilisation : pages consultées, profils vus, messages envoyés, connexions, horodatages",
      "Données techniques : adresse IP, type de navigateur, système d'exploitation, résolution d'écran",
    ],
  },
  {
    id: "finalite",
    title: "Finalités du traitement",
    content: [
      "Chaque donnée collectée répond à une finalité précise et légitime :",
    ],
    bullets: [
      "Mise en relation : connecter les athlètes du secondaire avec les recruteurs CÉGEP via le réseau RSEQ",
      "Profils athlètes : permettre aux entraîneurs de créer des profils complets pour maximiser la visibilité des athlètes",
      "Recherche et filtrage : permettre aux recruteurs de trouver des athlètes selon leurs critères sportifs, académiques et physiques",
      "Évaluations : fournir aux recruteurs des évaluations d'entraîneurs fiables et vérifiées",
      "Communication : faciliter les échanges entre recruteurs et entraîneurs concernant les athlètes",
      "Pipeline de recrutement : permettre aux recruteurs de suivre l'avancement du recrutement de chaque athlète",
      "Vérification : assurer la fiabilité des profils via la vérification par les entraîneurs",
      "Statistiques : fournir aux entraîneurs et recruteurs des données analytiques sur l'engagement",
      "Sécurité : protéger la plateforme contre les utilisations frauduleuses et non autorisées",
      "Amélioration : analyser l'utilisation pour améliorer l'expérience utilisateur",
    ],
  },
  {
    id: "base-juridique",
    title: "Base juridique du traitement",
    content: [
      "Conformément à la Loi 25 sur la protection des renseignements personnels du Québec, le traitement de vos données repose sur les bases juridiques suivantes :",
    ],
    bullets: [
      "Consentement explicite : vous acceptez la collecte et le traitement de vos données lors de l'inscription. Ce consentement est libre, éclairé et spécifique",
      "Exécution du contrat : certaines données sont nécessaires pour fournir le service de recrutement sportif",
      "Intérêt légitime : les données d'utilisation et techniques sont collectées pour assurer la sécurité et améliorer le service",
      "Obligation légale : certaines données peuvent être conservées pour répondre à des exigences réglementaires",
    ],
    after: [
      "Le consentement parental est requis pour tout athlète mineur (14-17 ans). Un processus de notification parentale avec délai de réponse de 7 à 14 jours est en place.",
    ],
  },
  {
    id: "roles",
    title: "Données par rôle",
    content: [
      "Le niveau de données collectées varie selon votre rôle sur la plateforme :",
    ],
    bullets: [
      "Athlète : profil complet (identité, académique, physique, sportif, médias). L'athlète peut s'inscrire directement avec données auto-déclarées, marquées « Non vérifié » jusqu'à validation par un entraîneur",
      "Entraîneur : identité, école/ligue, sport, évaluations d'athlètes. Les entraîneurs sont le canal de distribution principal et créent/gèrent les profils d'athlètes",
      "Recruteur : identité, CÉGEP, sport recruté, favoris, pipeline, notes, messages. Les recruteurs accèdent aux profils d'athlètes actifs uniquement",
      "Directeur : identité, institution (école ou CÉGEP), rôle administratif. Les directeurs sont des entraîneurs ou recruteurs avec des permissions d'administration supplémentaires",
    ],
  },
  {
    id: "visibilite",
    title: "Visibilité des données",
    content: [
      "Nexus applique un contrôle strict sur qui peut voir quoi :",
    ],
    bullets: [
      "Entraîneurs : voient et gèrent uniquement les athlètes de leur propre école ou équipe",
      "Recruteurs (gratuit) : voient les profils anonymisés — statistiques, école, sport et cote visibles, mais le nom, la photo, la position et le numéro de jersey sont masqués",
      "Recruteurs (payant) : accès complet aux profils d'athlètes actifs, incluant nom, photo, coordonnées de l'entraîneur pour contact",
      "Favoris, notes et pipeline : strictement privés à chaque recruteur. Aucun recruteur ne peut voir les listes d'un autre",
      "Directeurs : accès administratif aux données de leur propre institution uniquement",
      "Athlètes : ne voient pas qui les a consultés ni ajoutés en favoris (données privées recruteur)",
    ],
    after: [
      "Les politiques de sécurité au niveau des lignes (RLS) de la base de données garantissent techniquement ces restrictions d'accès.",
    ],
  },
  {
    id: "conservation",
    title: "Durée de conservation",
    content: [
      "Vos données personnelles sont conservées selon les règles suivantes :",
    ],
    bullets: [
      "Compte actif : tant que votre compte est actif et que vous utilisez la plateforme",
      "Compte inactif : 24 mois après la dernière connexion, un avis de suppression est envoyé",
      "Profils archivés : conservés 3 ans maximum après archivage, puis supprimés définitivement",
      "Athlètes diplômés : profils conservés 2 ans après l'année de graduation prévue",
      "Données de recrutement : favoris, notes et pipeline supprimés avec le compte recruteur",
      "Logs techniques : conservés 12 mois pour la sécurité et le diagnostic",
      "Suppression volontaire : délai de grâce de 30 jours, puis suppression irréversible de toutes les données",
    ],
  },
  {
    id: "hebergement",
    title: "Hébergement et résidence des données",
    content: [
      "Conformément aux exigences de la Loi 25, toutes les données personnelles sont hébergées au Québec :",
    ],
    bullets: [
      "Serveur principal : OVHcloud, centre de données de Beauharnois, Québec, Canada",
      "Base de données : Supabase (PostgreSQL) hébergé sur infrastructure OVHcloud Québec",
      "Fichiers et médias : stockage Supabase Storage sur la même infrastructure",
      "Aucun transfert transfrontalier : vos données ne quittent pas le territoire canadien",
      "Sauvegardes : chiffrées et stockées dans le même centre de données québécois",
    ],
    after: [
      "L'infrastructure est gérée via Coolify (auto-hébergé) pour un contrôle complet sur l'environnement de déploiement.",
    ],
  },
  {
    id: "securite",
    title: "Mesures de sécurité",
    content: [
      "Nexus applique des mesures techniques et organisationnelles robustes pour protéger vos données :",
    ],
    bullets: [
      "Chiffrement en transit : toutes les communications utilisent HTTPS/TLS",
      "Chiffrement au repos : les données sont chiffrées dans la base de données",
      "Hachage des mots de passe : algorithme bcrypt avec salt unique par utilisateur",
      "Contrôle d'accès par rôle (RBAC) : chaque utilisateur n'accède qu'aux données autorisées pour son rôle",
      "Politiques RLS (Row-Level Security) : filtrage au niveau de la base de données, pas seulement de l'application",
      "Journaux d'audit : toutes les actions sensibles sont journalisées (consultations de profils, modifications, connexions)",
      "Authentification sécurisée : tokens JWT avec expiration, refresh tokens",
      "Validation côté serveur : toutes les entrées utilisateur sont validées et assainies",
    ],
  },
  {
    id: "droits",
    title: "Exercer vos droits",
    content: [
      "Conformément à la Loi 25, vous disposez de droits sur vos données personnelles. Pour les exercer, contactez notre RPRP :",
    ],
    bullets: [
      "Accès : demandez une copie complète de vos données à confidentialite@nexussports.ca",
      "Rectification : corrigez vos informations directement dans votre profil ou contactez-nous",
      "Suppression : demandez la suppression de votre compte via les paramètres ou par courriel",
      "Portabilité : demandez l'export de vos données en format JSON ou CSV",
      "Retrait du consentement : retirez votre consentement à tout moment (sauf consentements requis pour le service)",
    ],
    after: [
      "Responsable de la protection des renseignements personnels (RPRP) : Bruno-Philippe Desfossés Simard — confidentialite@nexussports.ca — 856 Basile-Routhier, Repentigny, Québec.",
      "Délai de réponse : 30 jours ouvrables maximum.",
    ],
  },
];

export default function CollecteDonneesPage() {
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
          <h1 className="nx-display text-5xl xl:text-6xl font-black text-white uppercase leading-[0.92] tracking-tight mb-6">
            Collecte et traitement<br />
            <span className="text-wl-red">des données</span>
          </h1>
          <p className="font-sans text-base text-[#9AA3B2] leading-relaxed max-w-[560px] mx-auto mb-4">
            Ce document détaille quelles données personnelles Nexus collecte, pourquoi nous les collectons, comment elles sont traitées et protégées, conformément à la Loi 25 du Québec.
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
                    <span className="nx-step-num nx-display text-5xl font-black text-white/[0.08] leading-none select-none" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="nx-display text-2xl font-black text-white uppercase tracking-tight leading-tight">
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
            <h2 className="nx-display text-4xl font-black text-white uppercase leading-tight">Contacte-nous</h2>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a href="mailto:confidentialite@nexussports.ca" className="h-12 px-8 bg-wl-red text-white font-head font-black text-xs uppercase tracking-widest hover:bg-wl-red-hover transition-colors hover:shadow-[0_8px_28px_rgba(232,72,72,0.38)] hover:-translate-y-0.5 inline-flex items-center">
              confidentialite@nexussports.ca
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
              <NexusLogo variant="white" height={22} href="/" className="opacity-80" />
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
          <p className={`${label} text-[#2E3D55] text-center pt-5`}>&copy; 2026 Nexus — Propuls&eacute; par <img src="/brand/logo-white-red.png" alt="WeLead" style={{height:16}} /></p>
        </div>
      </footer>
    </div>
  );
}
