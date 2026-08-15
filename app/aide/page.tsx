"use client";

/* ═══════════════════════════════════════════════════════════════
   app/aide — Centre d'aide PUBLIC (chantier 5)

   Publique au sens strict : aucune garde de rôle, aucune
   redirection de login. Un parent non connecté, un entraîneur, un
   athlète ou un robot d'indexation voient la même page.

   PAGE UNIQUE avec une ancre par article (/aide#secu-04) plutôt
   que /aide/[section] : la recherche a besoin du corpus entier en
   mémoire de toute façon, donc éclater en 14 pages ne ferait
   qu'ajouter des HTML sans rien économiser — tout en réduisant la
   recherche à la section courante, c'est-à-dire à rien pour
   quelqu'un qui ignore où regarder.

   Les métadonnées vivent dans layout.tsx : cette page est cliente
   (état de recherche) et ne peut donc pas exporter `metadata`.
   C'est le piège dans lequel app/guide-recrutement/page.tsx est
   tombé — cette page-là n'a aujourd'hui aucune balise propre.

   Le garde CAPACITOR est la moitié RUNTIME de l'exclusion mobile ;
   la moitié BUILD est le motif dans scripts/build-mobile.mjs. Les
   deux listes vont ensemble, c'est écrit en tête de ce script.
═══════════════════════════════════════════════════════════════ */

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import PlaybookBackground from "../components/PlaybookBackground";
import { SECTIONS_AIDE } from "@/content/aide/sections";
import { buildAideIndex, searchAide, visibleSections } from "@/lib/aide/search";
import AideArticleCard from "@/components/aide/AideArticleCard";
import AideBlocks from "@/components/aide/AideBlocks";

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

// TOUT passe par visibleSections — sommaire, sections, index de
// recherche et compteur. Les articles `draft` sont ainsi retirés en
// production par un seul filtre, qu'aucune surface ne peut oublier.
const SECTIONS = visibleSections(SECTIONS_AIDE);

const TOTAL_ARTICLES = SECTIONS.reduce((n, s) => n + s.articles.length, 0);

export default function AidePage() {
  // Build mobile (Capacitor) : page exclue — l'aide y arrivera par
  // un sheet natif qui relit le même content/aide/*, sur le modèle
  // de components/legal/LegalSheetMobile.tsx.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();

  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState(SECTIONS[0]?.id ?? "");

  // Le contenu est statique : l'index se construit une fois, pas à
  // chaque frappe.
  const index = useMemo(() => buildAideIndex(SECTIONS_AIDE), []);

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;
  const results = useMemo(
    () => (isSearching ? searchAide(index, trimmed) : []),
    [index, trimmed, isSearching],
  );

  /* ── Sommaire : suivi de la section visible ──────────────────
     Même mécanique que app/confidentialite/page.tsx. Inerte
     pendant une recherche, où l'affichage est une liste à plat. */
  const entries = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  useEffect(() => {
    if (isSearching) return;

    const observer = new IntersectionObserver(
      (obs) => {
        obs.forEach((e) => entries.current.set(e.target.id, e));

        let top = "";
        let topY = Infinity;
        entries.current.forEach((e, id) => {
          if (e.isIntersecting && e.boundingClientRect.top < topY) {
            topY = e.boundingClientRect.top;
            top = id;
          }
        });
        if (top) setActiveSection(top);
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 },
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isSearching]);

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans flex flex-col relative">
      <PlaybookBackground />

      <div className="relative z-10 flex flex-col flex-1">
        <MarketingNav />

        {/* ══ HERO ══════════════════════════════════════════ */}
        <section className="border-b border-[#2D3748]">
          <div className="max-w-[900px] mx-auto px-6 pt-16 pb-12 sm:pt-20 sm:pb-14">
            <div className="inline-flex items-center gap-3 mb-6">
              <span className="w-6 h-px bg-[#E63946]" />
              <span className={`${label} text-[#E63946]`}>Centre d&apos;aide</span>
            </div>

            <h1 className="nx-display text-[38px] sm:text-[52px] font-extrabold leading-[1.05] tracking-tight">
              Comment pouvons-nous aider ?
            </h1>
            <p className="text-[16px] sm:text-[17px] text-white/70 leading-relaxed mt-5 max-w-[640px]">
              Les réponses aux questions les plus fréquentes des entraîneurs, des
              athlètes et des parents. Aucun compte n&apos;est nécessaire pour
              consulter cette page.
            </p>

            {/* ── Recherche ── */}
            <div role="search" className="mt-8 max-w-[640px]">
              <div className="relative">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280] pointer-events-none"
                  width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>

                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Chercher une réponse, ou un code (SECU-04)…"
                  aria-label="Chercher dans le centre d'aide"
                  // `appearance-none` sur la croix native : Chrome dessine son
                  // propre bouton d'effacement sur les input[type=search], qui
                  // doublonnait avec le nôtre (deux croix côte à côte).
                  className="w-full h-14 pl-12 pr-12 rounded-xl bg-[#1A1D24] border border-[#2D3748] text-[15px] text-white placeholder:text-[#6b7280] outline-none focus:border-[#E63946]/60 transition-colors [&::-webkit-search-cancel-button]:appearance-none"
                />

                {isSearching && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Effacer la recherche"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-[#6b7280] hover:text-white transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              <p className="text-[12px] text-[#6b7280] mt-3">
                {isSearching
                  ? `${results.length} résultat${results.length > 1 ? "s" : ""}`
                  : `${TOTAL_ARTICLES} articles · ${SECTIONS.length} sections`}
              </p>
            </div>
          </div>
        </section>

        {/* ══ CORPS ═════════════════════════════════════════ */}
        <section className="flex-1">
          <div className="max-w-[1200px] mx-auto px-6 py-12 lg:py-16">
            {isSearching ? (
              /* ── Résultats : liste à plat, pleine largeur ── */
              <div className="max-w-[820px] mx-auto">
                {results.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {results.map((r) => (
                      <AideArticleCard
                        key={r.article.id}
                        article={r.article}
                        sectionTitle={r.sectionTitle}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-8 text-center">
                    <p className="font-head text-[18px] font-bold text-white">
                      Aucun résultat pour « {trimmed} »
                    </p>
                    <p className="text-[15px] text-white/60 leading-relaxed mt-3 max-w-[440px] mx-auto">
                      Essaie un mot plus court, ou écris-nous directement — on
                      répond à tout le monde.
                    </p>
                    <Link
                      href="/contact"
                      className="inline-flex items-center h-11 px-6 mt-6 rounded-lg bg-[#E63946] text-white font-head font-bold text-[12px] uppercase tracking-widest hover:bg-[#D42B22] transition-colors"
                    >
                      Nous écrire
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              /* ── Consultation : sommaire + sections ── */
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10 lg:gap-14">
                {/* Sommaire desktop */}
                <aside className="hidden lg:block">
                  <div className="sticky top-24">
                    <div className={`${label} text-[#E63946] mb-5`}>Sommaire</div>
                    <nav className="flex flex-col gap-1">
                      {SECTIONS.map((s, i) => (
                        <a
                          key={s.id}
                          href={`#${s.id}`}
                          className={`group flex items-start gap-3 py-2 pl-3 -ml-3 border-l-2 transition-colors ${
                            activeSection === s.id
                              ? "text-[#E63946] border-[#E63946]"
                              : "text-[#9CA3AF] hover:text-white border-transparent"
                          }`}
                        >
                          <span
                            className={`${label} w-6 flex-shrink-0 pt-0.5 ${
                              activeSection === s.id ? "text-[#E63946]" : "text-[#6b7280]"
                            }`}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="font-sans text-[13px] leading-tight">{s.title}</span>
                        </a>
                      ))}
                    </nav>
                  </div>
                </aside>

                {/* Sommaire mobile */}
                <div className="lg:hidden bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5">
                  <div className={`${label} text-[#E63946] mb-4`}>Sommaire</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    {SECTIONS.map((s, i) => (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className="flex items-start gap-3 py-2 text-[#9CA3AF] hover:text-white transition-colors"
                      >
                        <span className={`${label} text-[#6b7280] w-5 flex-shrink-0 pt-0.5`}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-sans text-[14px] leading-snug">{s.title}</span>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Sections */}
                <main className="min-w-0 flex flex-col gap-14">
                  {SECTIONS.map((section, i) => (
                    <section key={section.id} id={section.id} className="scroll-mt-24">
                      <div className="flex items-center gap-4 mb-2">
                        <span
                          className="nx-display text-4xl font-black text-white/[0.08] leading-none select-none"
                          aria-hidden
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h2 className="nx-display text-[22px] sm:text-2xl font-black text-white uppercase tracking-tight leading-tight">
                          {section.title}
                        </h2>
                      </div>

                      {/* Introduction de section — c'est une LISTE DE
                          BLOCS, pas une phrase : deux d'entre elles
                          (CONS et VOIR) sont des tableaux. Pas de
                          max-w sur le conteneur pour cette raison :
                          ces tableaux ont besoin de toute la colonne
                          avant de devoir défiler. */}
                      {section.intro && section.intro.length > 0 && (
                        <div className="mb-7">
                          <AideBlocks blocks={section.intro} />
                        </div>
                      )}

                      <div className="flex flex-col gap-4">
                        {section.articles.map((article) => (
                          <AideArticleCard key={article.id} article={article} />
                        ))}
                      </div>
                    </section>
                  ))}
                </main>
              </div>
            )}
          </div>
        </section>

        {/* ══ CTA ═══════════════════════════════════════════ */}
        <section className="border-t border-[#2D3748] bg-[#0d0f12]">
          <div className="max-w-[900px] mx-auto px-6 py-14 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div>
              <div className={`${label} text-[#E63946] mb-2`}>Toujours bloqué ?</div>
              <h2 className="nx-display text-[26px] sm:text-[32px] font-black text-white uppercase leading-tight">
                Écris-nous
              </h2>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center h-12 px-8 rounded-lg bg-[#E63946] text-white font-head font-black text-[12px] uppercase tracking-widest hover:bg-[#D42B22] transition-colors flex-shrink-0"
            >
              Nous contacter
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
