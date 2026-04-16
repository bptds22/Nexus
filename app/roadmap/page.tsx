"use client";

import { useEffect } from "react";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ═══════════════════════════════════════════════════════════════
   Roadmap — phased timeline, dots + text only (no cards)
═══════════════════════════════════════════════════════════════ */

type PhaseTone = "amber" | "blue" | "red" | "white";

interface Feature { title: string; body: string }

interface Phase {
  code: string;           // e.g. "Release 2"
  label: string;          // e.g. "Croissance commerciale"
  tone: PhaseTone;
  items: Feature[];
}

const PHASES: Phase[] = [
  {
    code: "Release 2",
    label: "Croissance commerciale",
    tone: "amber",
    items: [
      { title: "Page CÉGEP détaillée", body: "Chaque CÉGEP a sa propre page — sports offerts, programmes d'études, contacts, et présentation." },
      { title: "Recherche d'écoles interactive", body: "Trouve les CÉGEPs par localisation, sport, programme d'études. Carte interactive incluse." },
      { title: "Comparaison d'athlètes", body: "Compare deux athlètes côte à côte — stats, évaluations, distinctions, profil académique." },
      { title: "Historique des évaluations", body: "Voir les évaluations passées d'un athlète pour montrer sa progression d'une saison à l'autre." },
      { title: "Blog Nexus", body: "Articles, conseils, et analyses sur le recrutement sportif au Québec." },
      { title: "Webinaires CÉGEP", body: "Les CÉGEPs présentent leurs programmes sport-études directement aux coachs du secondaire." },
      { title: "Guide de recrutement avancé", body: "Version interactive et personnalisée du guide — timeline adaptée à ta situation et ton sport." },
      { title: "Calendrier de showcases et événements", body: "Camps, showcases, portes ouvertes, combines — tous les événements de recrutement au Québec au même endroit." },
      { title: "Tableau d'engagements public", body: "Qui a signé où? Un tableau en temps réel des lettres d'intention et des engagements confirmés par sport et par année." },
    ],
  },
  {
    code: "Release 3",
    label: "Valeur CÉGEP",
    tone: "blue",
    items: [
      { title: "Gestion des effectifs CÉGEP", body: "Tableau des besoins par sport et position vs joueurs actuels. Le directeur voit les trous dans son roster." },
      { title: "Blog CÉGEP", body: "Chaque CÉGEP publie sur sa page — résultats, témoignages, journées portes ouvertes. Visibilité et contenu." },
      { title: "Suivi des anciens (Alumni)", body: "Suivre où sont les athlètes recrutés après 1, 2, 3 ans. Preuve sociale pour le CÉGEP et le coach." },
      { title: "Portail de transfert", body: "Athlètes qui changent de CÉGEP en cours de parcours. Visibilité pour les programmes qui ont des places à combler." },
    ],
  },
  {
    code: "Release 4",
    label: "Intelligence",
    tone: "red",
    items: [
      { title: "Analyse des besoins par IA", body: "Analyse du roster actuel, des finissants, et des gaps de position. Suggestions automatiques de prospects." },
      { title: "Optimisation de tournée de recrutement", body: "Planification intelligente : quels prospects visiter, dans quel ordre, optimisé par distance et priorité." },
      { title: "Score de préparation au recrutement", body: "Le coach voit quels athlètes sont « prêts à être présentés » aux recruteurs — basé sur la complétion, la vidéo et les évaluations." },
      { title: "Notifications intelligentes", body: "« 3 nouveaux athlètes correspondent à tes critères cette semaine » — « Ce QB est consulté par 5 CÉGEPs, agis vite »." },
      { title: "Carte thermique régionale", body: "Carte du Québec montrant la densité d'athlètes par région et par sport. Outil stratégique pour recruteurs." },
    ],
  },
  {
    code: "Release 5",
    label: "Expansion",
    tone: "white",
    items: [
      { title: "Passerelle universités → CÉGEP", body: "Les universités canadiennes recrutent depuis les CÉGEPs. Même modèle, un niveau au-dessus. Nouveau segment payant." },
      { title: "Expansion pan-canadienne", body: "Adapter Nexus pour les provinces anglophones : high school → college/university. Traduction bilingue. Marché 10x plus grand." },
      { title: "Application native (iOS/Android)", body: "Réécriture mobile complète pour une expérience optimale sur téléphone." },
      { title: "API publique", body: "Permettre aux écoles et CÉGEPs d'intégrer les données Nexus dans leurs systèmes (Clara, Omnivox)." },
    ],
  },
];

/* ── Tone → classes ────────────────────────────────────────── */

const TONE_HEADER: Record<PhaseTone, { dot: string; label: string }> = {
  amber: { dot: "bg-[#F59E0B]",       label: "text-[#F59E0B]" },
  blue:  { dot: "bg-[#3B82F6]",       label: "text-[#3B82F6]" },
  red:   { dot: "bg-[#E63946]",       label: "text-[#E63946]" },
  white: { dot: "bg-white",           label: "text-white" },
};

const TONE_FEATURE_DOT: Record<PhaseTone, string> = {
  amber: "bg-[#F59E0B]/60",
  blue:  "bg-[#3B82F6]/60",
  red:   "bg-[#E63946]/60",
  white: "bg-white/60",
};

/* ── Atoms ──────────────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] sm:text-[14px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function RoadmapPage() {
  useEffect(() => {
    console.log("Roadmap page loaded");
  }, []);

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── HERO ──────────────────────────────────────────── */}
        <section>
          <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-12 text-center">
            <RedLabel>Roadmap</RedLabel>
            <h1 className="font-head text-[40px] sm:text-[48px] font-black text-white leading-[1.05] tracking-tight mt-4">
              Ce qui s&apos;en vient.
            </h1>
            <p className="text-[16px] text-white/60 leading-[1.7] mt-5 max-w-[640px] mx-auto">
              On construit Nexus en continu. Pas de dates promises — juste la direction et les priorités.
            </p>
          </div>
        </section>

        {/* ─── TIMELINE ──────────────────────────────────────── */}
        <section className="pb-16">
          <div className="max-w-[800px] mx-auto px-6">
            <div className="relative border-l-2 border-white/10 ml-[7px]">
              {PHASES.map((phase, pi) => {
                const header = TONE_HEADER[phase.tone];
                const featureDot = TONE_FEATURE_DOT[phase.tone];
                return (
                  <div key={phase.code} className={pi > 0 ? "pt-[60px]" : ""}>
                    {/* Phase header */}
                    <div className="relative pl-10 pb-2">
                      <span
                        aria-hidden="true"
                        className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ring-4 ring-[#111317] ${header.dot}`}
                      />
                      <p className={`text-[12px] sm:text-[13px] font-bold tracking-[0.25em] uppercase ${header.label}`}>
                        {phase.code} · {phase.label}
                      </p>
                    </div>

                    {/* Features */}
                    <ul className="list-none space-y-[32px] mt-6">
                      {phase.items.map((f) => (
                        <li
                          key={f.title}
                          className="relative pl-10 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors"
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute -left-[5px] top-[10px] w-2 h-2 rounded-full ring-4 ring-[#111317] ${featureDot}`}
                          />
                          <p className="text-[16px] sm:text-[17px] font-bold text-white leading-snug">
                            {f.title}
                          </p>
                          <p className="text-[14px] sm:text-[15px] text-white/60 leading-relaxed mt-1.5">
                            {f.body}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── BOTTOM — Suggestion ───────────────────────────── */}
        <section className="bg-[#0d0f12] border-t border-white/[0.06]">
          <div className="max-w-[600px] mx-auto px-6 py-16 sm:py-20 text-center">
            <h3 className="font-head text-[24px] sm:text-[28px] font-black text-white tracking-tight">
              Une idée?
            </h3>
            <p className="text-[15px] text-white/65 leading-relaxed mt-4">
              On construit Nexus pour toi. Si une fonctionnalité te manque, on veut le savoir.
            </p>
            <Link
              href="/a-propos"
              className="inline-block mt-6 text-[14px] font-bold uppercase tracking-wider text-[#E63946] hover:text-[#FF5C58] transition-colors"
            >
              Nous écrire →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
