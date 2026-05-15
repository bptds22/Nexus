"use client";

import { useState } from "react";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ═══════════════════════════════════════════════════════════════
   Guide du recrutement CÉGEP — public educational page
   Static content. No Supabase. Playbook background.
═══════════════════════════════════════════════════════════════ */

const TOC = [
  { href: "#chapitre-1", label: "Comment fonctionne le recrutement CÉGEP" },
  { href: "#chapitre-2", label: "Construire ta présence en ligne" },
  { href: "#chapitre-3", label: "Communiquer avec les recruteurs" },
  { href: "#chapitre-4", label: "Préparer ton dossier académique" },
  { href: "#chapitre-5", label: "Le calendrier du recrutement" },
  { href: "#chapitre-6", label: "Foire aux questions" },
];

const CH1_BLOCKS = [
  {
    title: "Le RSEQ",
    body:
      "Le Réseau du sport étudiant du Québec gouverne tous les sports collégiaux au Québec. Il est divisé en divisions (D1, D2, D3 selon le sport). Chaque CÉGEP a des équipes qui compétitionnent dans les ligues du RSEQ. Ce n'est PAS comme la NCAA — il n'y a pas de bourses sportives au Québec, mais il existe des programmes sport-études et l'Alliance Sport-Études.",
  },
  {
    title: "Sport-études vs sport étudiant",
    body:
      "Sport-études = programme officiel reconnu par le ministère de l'Éducation où ton horaire est adapté pour l'entraînement. Sport étudiant = jouer pour l'équipe de ton CÉGEP sans la structure du programme. Les deux existent, les deux sont valables — mais sport-études te donne la flexibilité d'horaire et les services de soutien.",
  },
  {
    title: "L'Alliance Sport-Études",
    body:
      "OSBL qui supporte les étudiants-athlètes dans les CÉGEPs du Québec. Les membres profitent d'horaires adaptés, de tutorat, et d'éligibilité aux bourses via la Fondation Sport-Études. Tous les CÉGEPs ne sont pas membres — mais la plupart des grands le sont.",
  },
  {
    title: "Les divisions",
    body:
      "D1 est le top level (le plus compétitif, ligues provinciales). D2 et D3 sont régionales ou de développement. Pas tous les sports ont les 3 divisions. Football : D1 et D3. Hockey : D1 et D2. Basketball : D1, D2, D3.",
  },
  {
    title: "Pas de bourses sportives",
    body:
      "Différence critique avec les États-Unis. Au Québec, il est ILLÉGAL pour un CÉGEP d'offrir une aide financière directe pour recruter un athlète. Pas de bourse, pas d'exemption de frais. Les seules exceptions : prêts et bourses du gouvernement, bourses de l'Alliance Sport-Études, et bourses de mérite académique ouvertes à tous. C'est important à comprendre pour éviter les fausses promesses.",
  },
];

const PROFILE_ESSENTIALS = [
  "Photo de qualité (action de match de préférence)",
  "Mesures physiques à jour (taille, poids, tests de performance)",
  "Vidéos de jeu (faits saillants 2-3 min, match complet)",
  "Dossier académique (moyenne, programme visé, mentions)",
  "Informations de contact (toi et tes parents)",
  "Préférences (régions, ouvert au privé, ouvert anglophone)",
];

const CH2_INTRO = {
  title: "Pourquoi un profil en ligne?",
  body:
    "Les recruteurs CÉGEP cherchent en ligne. Si tu n'existes pas numériquement, tu n'existes pas pour eux. Un profil Nexus complet rassemble en un seul endroit tout ce qu'un recruteur doit voir : stats, vidéo, dossier académique, évaluation du coach.",
};

const CH2_VERIF = {
  title: "La vérification de ton coach",
  body:
    "N'importe quel athlète peut écrire qu'il est exceptionnel. Quand ton coach vérifie ton profil ET ajoute son évaluation écrite avec des cotes spécifiques sur 8 critères, les recruteurs font 10x plus confiance à ton profil. 77% des athlètes vérifiés sur Nexus sont contactés par un recruteur.",
};

const CH2_VIDEO_TIPS = [
  "Faits saillants : 2-3 minutes max, les meilleurs jeux seulement, inclut nom/numéro/position en overlay au début",
  "Match complet : film de match non édité — les recruteurs veulent te voir quand ça va mal, pas juste tes highlights",
  "Qualité avant quantité — un bon highlight reel vaut mieux que cinq clips flous au téléphone",
  "Dépose sur Hudl ou YouTube et mets le lien dans ton profil",
];

const CH3_BLOCKS = [
  {
    title: "Qui sont les recruteurs?",
    body:
      "Au Québec, les recruteurs CÉGEP sont habituellement le head coach ou un coach adjoint. Ils n'ont pas de staff dédié au recrutement comme la NCAA. Ils coachent, enseignent et recrutent en même temps. Respecte leur temps.",
  },
  {
    title: "Quand les contacter",
    body:
      "Le RSEQ a des périodes officielles de recrutement qui varient selon le sport. Généralement : le recrutement ouvre le 1er octobre pour la plupart des sports, les lettres d'intention commencent le 1er novembre. Pour le football, il y a un calendrier structuré spécifique. Clé : ne pas attendre qu'ils te trouvent — sois proactif, mais respecte les périodes officielles.",
  },
];

const CH3_TIPS = [
  "Sur Nexus, ton coach peut communiquer directement avec les recruteurs via la messagerie",
  "Premier contact : garde-le court. Qui tu es, ta position, ton école, ton année de graduation, lien vers ton profil Nexus",
  "Suivi : si pas de réponse après 2 semaines, relance une fois. Après ça, passe à autre chose",
  "Portes ouvertes : assiste aux portes ouvertes des CÉGEPs — c'est la meilleure façon de rencontrer les coachs en personne",
];

const CH3_LETTRE = {
  title: "La lettre d'intention",
  body:
    "C'est une lettre signée par l'athlète qui s'engage à fréquenter un CÉGEP et à jouer pour son équipe. En retour, le CÉGEP garantit une place dans le roster. Pas légalement contraignante mais la briser vient avec un « congé sportif » (suspension) si tu changes de CÉGEP. Important : la lettre d'intention existe surtout en hockey D1 et en football — pas tous les sports l'utilisent.",
};

const CH4_BLOCKS = [
  {
    title: "Les critères académiques",
    body:
      "Pour être admissible au sport-études collégial, il te faut : un diplôme d'études secondaires (DES), l'admission à un programme académique du CÉGEP, et respecter les règles d'admissibilité académique du RSEQ (statut temps plein, charge de cours minimale, moyenne à maintenir chaque session).",
  },
  {
    title: "Maintenir ton admissibilité",
    body:
      "Une fois admis, tu dois réussir tes cours pour continuer à jouer. Le RSEQ vérifie le statut académique à chaque session. Si tu échoues trop de cours, tu deviens inéligible jusqu'à ce que tu te reprennes. Sport et académique ne sont pas séparés — c'est le même package.",
  },
  {
    title: "Les programmes populaires",
    body:
      "Sciences de la nature, Sciences humaines, Techniques (variées) sont des programmes courants pour les étudiants-athlètes. Les CÉGEPs sport-études offrent des horaires adaptés peu importe ton programme.",
  },
  {
    title: "Conseil : commence tôt",
    body:
      "Tes notes de secondaire 4 et 5 comptent. Les recruteurs regardent ton dossier académique en parallèle de ton dossier athlétique. Un étudiant-athlète fort avec 80%+ de moyenne est plus attirant qu'un athlète pur avec des notes qui traînent.",
  },
];

const TIMELINE = [
  {
    period: "Secondaire 3-4 (printemps)",
    body:
      "Commence à créer ton profil Nexus. Tes stats et vidéos d'aujourd'hui construisent ta visibilité pour demain. Pas de pression — mais le plus tôt tu es visible, le mieux c'est.",
  },
  {
    period: "Secondaire 4 (automne)",
    body:
      "Les recruteurs commencent à regarder. Ils suivent les ligues secondaires, assistent aux matchs. Assure-toi que ton profil est complet et que ton coach t'a vérifié.",
  },
  {
    period: "Secondaire 5 (octobre-décembre)",
    body:
      "Période de recrutement active pour la plupart des sports. Les recruteurs te contactent, planifient des visites, t'invitent aux portes ouvertes. Ton statut sur Nexus passe à « En processus ».",
  },
  {
    period: "Secondaire 5 (janvier-mars)",
    body:
      "Demandes d'admission au CÉGEP (via le SRAM, date limite 1er mars). Lettres d'intention signées dans certains sports. C'est la période critique — les décisions se prennent ici.",
  },
  {
    period: "Secondaire 5 (avril-juin)",
    body:
      "Réponses d'admission. Confirmation de ta place dans l'équipe. Ton statut passe à « Recruté » sur Nexus.",
  },
];

const FAQS = [
  {
    q: "Est-ce que je peux être recruté si mon coach n'est pas sur Nexus?",
    a: "Oui, tu peux créer ton propre profil. Mais un profil vérifié par ton coach a beaucoup plus de crédibilité auprès des recruteurs.",
  },
  {
    q: "Est-ce qu'il y a des bourses sportives au CÉGEP?",
    a: "Non. Au Québec, il est interdit pour les CÉGEPs d'offrir une aide financière directe pour recruter un athlète. Par contre, tu as accès aux prêts et bourses du gouvernement, aux bourses de la Fondation de l'athlète d'excellence, et aux bourses de mérite académique.",
  },
  {
    q: "C'est quoi la différence entre D1, D2 et D3?",
    a: "D1 est le plus haut niveau (ligues provinciales). D2 et D3 sont des niveaux régionaux ou de développement. Le niveau d'un CÉGEP varie selon le sport.",
  },
  {
    q: "Est-ce que je peux changer de CÉGEP après avoir commencé?",
    a: "Oui, mais des règles de transfert s'appliquent. Tu dois obtenir une libération de ton ancienne équipe, et tu pourrais devoir purger un « congé sportif » (période d'inéligibilité) selon les règlements de la ligue.",
  },
  {
    q: "Nexus coûte combien?",
    a: "C'est 100% gratuit pour les athlètes. Les recruteurs paient pour utiliser la plateforme — pas toi.",
  },
  {
    q: "Quand est-ce que je devrais commencer à m'inscrire?",
    a: "Le plus tôt possible. Même en secondaire 3, tu peux commencer à bâtir ton profil. Plus ton profil est complet tôt, plus tu accumules de visibilité.",
  },
];

/* ── Atoms ──────────────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="nx-display text-[28px] sm:text-[34px] font-extrabold text-white leading-tight tracking-tight mt-3">
      {children}
    </h2>
  );
}

function ChapterBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-6 sm:p-7">
      <h3 className="font-head text-[18px] font-black text-white leading-tight">{title}</h3>
      <p className="text-[15px] text-white/75 leading-relaxed mt-3">{body}</p>
    </div>
  );
}

function ChecklistCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-6 sm:p-7">
      <h3 className="font-head text-[18px] font-black text-white leading-tight">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-[14px] text-white/75 leading-relaxed">
            <span className="shrink-0 mt-1 w-4 h-4 rounded-full bg-[#22C55E]/15 flex items-center justify-center text-[#22C55E]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-white/[0.06] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={open ? "true" : "false"}
      >
        <span className="font-head text-[15px] sm:text-[16px] font-bold text-white leading-snug">{q}</span>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-[#9CA3AF] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-1">
          <p className="text-[14px] text-white/75 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function GuideRecrutementPage() {
  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── HERO ─────────────────────────────────────────── */}
        <section id="hero" className="border-b border-white/[0.06]">
          <div className="max-w-[900px] mx-auto px-6 py-20 lg:py-28">
            <RedLabel>Guide · Nexus 2025</RedLabel>
            <h1 className="nx-display text-[42px] sm:text-[56px] font-extrabold leading-[1.05] tracking-tight mt-4">
              Comment se faire recruter au CÉGEP
            </h1>
            <p className="text-[18px] text-white/75 leading-relaxed mt-6 max-w-[700px]">
              Le guide complet pour les étudiants-athlètes du secondaire qui veulent jouer dans un programme sport-études au CÉGEP.
            </p>
            <p className="text-[15px] text-white/55 leading-relaxed mt-5 max-w-[700px]">
              Ce guide t&apos;explique le processus de recrutement collégial au Québec — du secondaire 3 jusqu&apos;à la lettre d&apos;engagement. Que tu sois en football, hockey, basketball, soccer ou tout autre sport, les principes sont les mêmes.
            </p>
          </div>
        </section>

        {/* ─── LAYOUT: TOC + CONTENT ───────────────────────── */}
        <div className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12 lg:gap-16">
          {/* Sticky TOC */}
          <aside className="lg:sticky lg:top-[100px] lg:self-start">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-white/55 mb-4">
              Sommaire
            </p>
            <ol className="space-y-2">
              {TOC.map((t, i) => (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    className="flex items-start gap-2 text-[13px] text-white/75 hover:text-[#E63946] transition-colors leading-snug"
                  >
                    <span className="shrink-0 font-head font-black text-white/35 w-6">0{i + 1}</span>
                    <span>{t.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </aside>

          {/* Content column */}
          <main className="min-w-0 max-w-[800px] space-y-24">
            {/* Chapter 1 */}
            <section id="chapitre-1" className="scroll-mt-24">
              <RedLabel>Chapitre 01</RedLabel>
              <H2>Le système de recrutement collégial au Québec</H2>
              <div className="mt-8 space-y-4">
                {CH1_BLOCKS.map((b) => (
                  <ChapterBlock key={b.title} title={b.title} body={b.body} />
                ))}
              </div>
            </section>

            {/* Chapter 2 */}
            <section id="chapitre-2" className="scroll-mt-24">
              <RedLabel>Chapitre 02</RedLabel>
              <H2>Crée un profil qui te démarque</H2>
              <div className="mt-8 space-y-4">
                <ChapterBlock title={CH2_INTRO.title} body={CH2_INTRO.body} />
                <ChecklistCard title="Les éléments essentiels de ton profil" items={PROFILE_ESSENTIALS} />
                <ChapterBlock title={CH2_VERIF.title} body={CH2_VERIF.body} />
                <ChecklistCard title="Ta vidéo — ce que les recruteurs veulent voir" items={CH2_VIDEO_TIPS} />
              </div>
            </section>

            {/* Chapter 3 */}
            <section id="chapitre-3" className="scroll-mt-24">
              <RedLabel>Chapitre 03</RedLabel>
              <H2>Comment approcher un recruteur CÉGEP</H2>
              <div className="mt-8 space-y-4">
                {CH3_BLOCKS.map((b) => (
                  <ChapterBlock key={b.title} title={b.title} body={b.body} />
                ))}
                <ChecklistCard title="Comment les contacter" items={CH3_TIPS} />
                <ChapterBlock title={CH3_LETTRE.title} body={CH3_LETTRE.body} />
              </div>
            </section>

            {/* Chapter 4 */}
            <section id="chapitre-4" className="scroll-mt-24">
              <RedLabel>Chapitre 04</RedLabel>
              <H2>Tu es un étudiant-athlète. Pas juste un athlète.</H2>
              <div className="mt-8 space-y-4">
                {CH4_BLOCKS.map((b) => (
                  <ChapterBlock key={b.title} title={b.title} body={b.body} />
                ))}
              </div>
            </section>

            {/* Chapter 5 — timeline */}
            <section id="chapitre-5" className="scroll-mt-24">
              <RedLabel>Chapitre 05</RedLabel>
              <H2>Quand tout se passe</H2>
              <ol className="mt-8 relative border-l-2 border-[#E63946]/30 pl-6 sm:pl-8 space-y-6">
                {TIMELINE.map((t, i) => (
                  <li key={t.period} className="relative">
                    <span className="absolute -left-[34px] sm:-left-[42px] top-1 flex items-center justify-center w-7 h-7 rounded-full bg-[#E63946] text-white font-head text-[11px] font-black tracking-wider">
                      0{i + 1}
                    </span>
                    <div className="bg-[#1A1D24] rounded-xl border border-white/[0.06] p-5 sm:p-6">
                      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#E63946]">
                        {t.period}
                      </p>
                      <p className="text-[15px] text-white/75 leading-relaxed mt-2.5">{t.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* Chapter 6 — FAQ */}
            <section id="chapitre-6" className="scroll-mt-24">
              <RedLabel>Chapitre 06</RedLabel>
              <H2>Questions fréquentes</H2>
              <div className="mt-8 space-y-3">
                {FAQS.map((f) => (
                  <FAQItem key={f.q} q={f.q} a={f.a} />
                ))}
              </div>
            </section>
          </main>
        </div>

        {/* ─── BOTTOM CTA ───────────────────────────────────── */}
        <section className="bg-[#0d0f12] border-t border-white/[0.06]">
          <div className="max-w-[900px] mx-auto px-6 py-24 text-center">
            <h2 className="nx-display text-[32px] sm:text-[40px] font-extrabold text-white leading-tight tracking-tight">
              Prêt à commencer?
            </h2>
            <div className="mt-9">
              <Link
                href="/inscription"
                className="inline-flex items-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                style={{ fontSize: 16, padding: "14px 32px" }}
              >
                Sois le Nex
              </Link>
            </div>
            <p className="text-[13px] text-white/55 mt-6">
              <Link href="/pour-les-etudiant-athlete" className="text-[#E63946] hover:underline">
                Retour à la page athlètes →
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
