"use client";

import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import NexusLogo from "@/components/ui/NexusLogo";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import DistinctionBadge from "@/components/shared/DistinctionBadge";

/* ═══════════════════════════════════════════════════════════════
   Comment ça marche — Manifesto + credibility page
   Public marketing, no auth, no Supabase, static content.
═══════════════════════════════════════════════════════════════ */

/* ── Atoms ──────────────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="nx-display text-[26px] sm:text-[30px] font-extrabold text-white leading-tight tracking-tight mt-3">
      {children}
    </h2>
  );
}

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill={i < count ? "#F59E0B" : "#4a4d56"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

/* ── Data ───────────────────────────────────────────────────── */

const STAR_DEFINITIONS = [
  { count: 5, text: "Prospect D1. Peut démarrer comme partant dans une équipe de Division 1 dès son entrée au CÉGEP." },
  { count: 4, text: "Pourrait éventuellement être partant en D1. Partant certain en D2 dès la première saison." },
  { count: 3, text: "Partant en D3. Pourrait atteindre le niveau D2 avec beaucoup de progression." },
  { count: 2, text: "Pourrait devenir partant en D3 éventuellement, mais nécessite du travail et de la progression." },
  { count: 1, text: "Ouvert à continuer au CÉGEP, mais aura besoin de progression significative avant de pouvoir être partant même en D3." },
];

const BADGE_SHOWCASE = [
  { key: "captain", name: "Capitaine", desc: "Désigné capitaine de son équipe. Leadership officiel reconnu par le coach." },
  { key: "allstar", name: "Étoile provinciale", desc: "Sélectionné parmi les meilleurs de sa catégorie au niveau provincial." },
  { key: "progression", name: "Progression marquée", desc: "A démontré une évolution significative sur une ou plusieurs saisons." },
  { key: "team_leader", name: "Meneur d'équipe", detail: "Points", desc: "Chef de file statistique de son équipe — le coach précise la catégorie (points, plaqués, buts, etc.)." },
  { key: "league_leader", name: "Meneur de la ligue", detail: "Plaqués", desc: "Chef de file statistique dans sa ligue. Accomplissement dominant verrouillé par chiffres." },
  { key: "mvp", name: "Joueur par excellence", desc: "Reconnu comme joueur clé par son entraîneur pour sa saison ou sa carrière." },
  { key: "custom", name: "Distinction personnalisée", detail: "Champion régional", desc: "Accomplissement spécifique reconnu par le coach — le texte est personnalisé pour refléter la réalité de l'athlète." },
];

const REPUTATION_BADGES = [
  { name: "Évalué", threshold: "3 évaluations", border: "border-white/10", iconColor: "text-[#9CA3AF]" },
  { name: "Recommandé", threshold: "5 évaluations", border: "border-white/25", iconColor: "text-white" },
  { name: "Coach Élite", threshold: "15 évaluations", border: "border-[#F59E0B]/40", iconColor: "text-[#F59E0B]" },
  { name: "Placeur", threshold: "5 athlètes avec lettre signée", border: "border-[#E63946]/50", iconColor: "text-[#E63946]" },
];

const PERSONAS = [
  { question: "Tu es un athlète?", line: "Crée ton profil et fais-toi repérer par les recruteurs CÉGEP.", href: "/pour-les-etudiant-athlete", label: "Découvrir →" },
  { question: "Tu es un entraîneur?", line: "Vérifie tes joueurs, ajoute ton évaluation, bâtis ta réputation.", href: "/pour-les-coachs", label: "Découvrir →" },
  { question: "Tu es un recruteur CÉGEP?", line: "Trouve les meilleurs prospects du secondaire à travers le Québec.", href: "/pour-les-recruteurs", label: "Découvrir →" },
];

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function CommentCaMarche() {
  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── SECTION 1 — HERO (manifesto opening) ──────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-16 text-center">
            <RedLabel>Notre mission</RedLabel>
            <h1 className="nx-display text-[42px] sm:text-[52px] font-[800] text-white leading-[1.05] tracking-tight mt-4">
              Le talent n&apos;a pas de code postal.
            </h1>
            <p className="text-[18px] text-white/75 leading-[1.7] mt-8 max-w-[720px] mx-auto">
              Quand j&apos;étais au secondaire, chaque joueur de football de mon école allait au même CÉGEP. C&apos;était juste comme ça. Si je n&apos;avais pas fait des camps et rencontré d&apos;autres personnes, je n&apos;aurais jamais vécu les trois meilleures années de ma vie ailleurs. Nexus existe pour que ce genre de rencontre ne dépende pas de la chance.
            </p>
            <p className="text-[14px] text-white/40 mt-10">Découvre comment ↓</p>
          </div>
        </section>

        {/* ─── SECTION 2 — POURQUOI NEXUS EXISTE ─────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[800px] mx-auto px-6 py-20">
            <RedLabel>Pourquoi</RedLabel>
            <SectionTitle>Le recrutement sportif au Québec roule sur les réseaux.</SectionTitle>

            <div className="mt-8 space-y-6 text-[16px] text-white/75 leading-[1.7]">
              <p>
                Les recruteurs CÉGEP connaissent les entraîneurs des grosses écoles secondaires. Ils assistent aux gros matchs. Ils appellent les mêmes numéros année après année. Ce système fonctionne — mais seulement pour les athlètes qui sont dans le bon cercle.
              </p>
              <p>
                Les écoles connues envoient leurs joueurs aux mêmes CÉGEPs. Les petites écoles se font oublier. Les jeunes en région se font oublier. Ce n&apos;est pas une question de talent — c&apos;est une question de réseau. Et tu ne choisis pas ton école secondaire en fonction de qui elle connaît.
              </p>
              <p>
                Nexus donne à chaque athlète la même visibilité structurée, peu importe son école, sa région ou le cercle d&apos;influence de son entraîneur. Le talent ne change pas de valeur selon le code postal. Nexus non plus.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3 — LA VÉRIFICATION ───────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[1000px] mx-auto px-6 py-20">
            <RedLabel>La vérification</RedLabel>
            <SectionTitle>Pourquoi un profil bleu vaut plus qu&apos;un profil gris.</SectionTitle>
            <p className="text-[16px] text-white/75 leading-[1.7] mt-5 max-w-[800px]">
              Sur Nexus, tout athlète peut créer son profil. Mais pas tous les profils portent le même poids aux yeux des recruteurs. La différence, c&apos;est la vérification.
            </p>

            {/* Two check cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
              {/* Gray check */}
              <div className="bg-[#1A1D24] rounded-2xl border border-white/10 p-8">
                <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center mb-5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="font-head text-[17px] font-black text-white tracking-tight">Check gris — Profil non vérifié</h3>
                <p className="text-[14px] text-white/65 leading-relaxed mt-3">
                  L&apos;athlète a créé son propre profil. Les infos sont là, mais personne ne les a confirmées. Le recruteur les prend avec un grain de sel — et c&apos;est normal.
                </p>
              </div>

              {/* Blue check */}
              <div className="bg-[#1A1D24] rounded-2xl border border-[#2563EB]/40 p-8">
                <div className="w-12 h-12 rounded-full bg-[#2563EB] flex items-center justify-center mb-5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="font-head text-[17px] font-black text-white tracking-tight">Check bleu — Profil vérifié par un coach</h3>
                <p className="text-[14px] text-white/65 leading-relaxed mt-3">
                  L&apos;entraîneur a passé en revue chaque champ du profil — identité, stats, école, position. Il met sa propre réputation en jeu en certifiant que tout est vrai. Le check bleu, c&apos;est la crédibilité du coach transférée à l&apos;athlète.
                </p>
              </div>
            </div>

            {/* Explainer box */}
            <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8 mt-6">
              <h3 className="font-head text-[17px] font-black text-white tracking-tight">La vérification est périssable.</h3>
              <p className="text-[14px] text-white/65 leading-relaxed mt-3">
                Le premier de chaque mois, l&apos;athlète reçoit 14 jours pour confirmer que ses infos sont toujours à jour. Pas de confirmation dans les temps = retour au check gris. Le coach peut toujours re-vérifier après. On empêche les profils zombies — un athlète vérifié il y a 2 ans ne peut pas glisser sur un check périmé.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 4 — LES ÉTOILES ──────────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[900px] mx-auto px-6 py-20">
            <RedLabel>La cote</RedLabel>
            <SectionTitle>Ce que veut vraiment dire chaque étoile.</SectionTitle>
            <p className="text-[16px] text-white/75 leading-[1.7] mt-5 max-w-[800px]">
              Sur Nexus, la cote globale d&apos;un athlète va de 1 à 5 étoiles. Mais une étoile, ça veut dire quoi exactement? On a défini une échelle claire pour que tous les coachs parlent la même langue.
            </p>

            {/* Star rows */}
            <div className="mt-10 space-y-3">
              {STAR_DEFINITIONS.map((s) => (
                <div key={s.count} className="flex items-start gap-5 bg-[#1A1D24] rounded-xl border border-white/[0.06] p-5">
                  <div className="shrink-0 pt-0.5">
                    <Stars count={s.count} />
                  </div>
                  <p className="text-[14px] text-white/75 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>

            <p className="text-[15px] text-white/65 leading-relaxed mt-8 italic">
              Une étoile sur Nexus = la même étoile partout. Un 5 étoiles donné par un coach de Sherbrooke veut dire la même chose qu&apos;un 5 étoiles donné par un coach de Gatineau. C&apos;est ça, la langue commune.
            </p>
          </div>
        </section>

        {/* ─── SECTION 5 — POURQUOI PAS JUSTE DES STATS ─────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[900px] mx-auto px-6 py-20">
            <RedLabel>La philosophie</RedLabel>
            <SectionTitle>Pourquoi les stats brutes ne suffisent pas.</SectionTitle>

            <div className="mt-8 space-y-6 text-[16px] text-white/75 leading-[1.7] max-w-[800px]">
              <p>
                Après avoir parlé avec plusieurs recruteurs CÉGEP, on a compris une chose: les stats ne racontent pas toute l&apos;histoire. 50 plaqués dans une ligue faible, ce n&apos;est pas 30 plaqués dans une ligue forte. Un joueur peut avoir des chiffres gonflés ou sous-évalués — et le recruteur n&apos;a aucun moyen de calibrer.
              </p>
              <p>
                Ce que les recruteurs veulent, c&apos;est comprendre ce qu&apos;un joueur apporte. Son caractère. Sa façon de lire le jeu. Sa capacité à progresser. C&apos;est pour ça qu&apos;on évalue sur 8 critères standardisés: leadership, discipline, coachabilité, intelligence de jeu, compétitivité, esprit d&apos;équipe, résilience, attitude.
              </p>
              <p>
                Les stats physiques — taille, poids, 40 verges, vertical — restent sur le profil. Mais ce qui fait la différence à l&apos;évaluation finale, c&apos;est ce qu&apos;un coach peut dire du joueur. Pas un tableur.
              </p>
            </div>

            <h3 className="nx-display text-[20px] font-extrabold text-white tracking-tight mt-12">
              Les distinctions Nexus — le langage commun des coachs.
            </h3>
            <p className="text-[16px] text-white/75 leading-[1.7] mt-4 max-w-[800px]">
              Les coachs attribuent des badges aux athlètes selon leurs accomplissements et leurs qualités sur le terrain. Chaque badge représente une réalité mesurable — pas une opinion vague. Les recruteurs savent exactement ce qu&apos;ils regardent quand ils voient ces distinctions.
            </p>

            {/* Badge showcase — 4 top, 3 centered below */}
            <div className="mt-10">
              <div className="flex flex-wrap justify-center gap-4">
                {BADGE_SHOWCASE.slice(0, 4).map((b, i) => (
                  <DistinctionBadge key={b.key} badge={b.key} detail={b.detail} size="lg" index={i} />
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {BADGE_SHOWCASE.slice(4).map((b, i) => (
                  <DistinctionBadge key={b.key} badge={b.key} detail={b.detail} size="lg" index={i + 4} />
                ))}
              </div>
            </div>

            <p className="text-[15px] text-white/65 leading-relaxed mt-10">
              Un badge sur Nexus, c&apos;est un accomplissement vérifié par un coach. Pas un autocollant qu&apos;on met sur un CV. C&apos;est ce qui permet à un recruteur d&apos;évaluer un athlète en 30 secondes — et de savoir que ce qu&apos;il voit est réel.
            </p>
          </div>
        </section>

        {/* ─── SECTION 6 — LA RÉPUTATION DES COACHS ──────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[900px] mx-auto px-6 py-20">
            <RedLabel>L&apos;anti-triche</RedLabel>
            <SectionTitle>Qu&apos;est-ce qui empêche un coach de donner 5 étoiles à tout le monde?</SectionTitle>

            <div className="mt-8 space-y-6 text-[16px] text-white/75 leading-[1.7] max-w-[800px]">
              <p>
                Question légitime. La réponse courte: la même chose qui empêche un mauvais avocat de garder ses clients — sa réputation.
              </p>
              <p>
                Sur Nexus, les coachs construisent une réputation à travers leurs actions. Chaque évaluation, chaque athlète vérifié, chaque placement confirmé compte. Les coachs accumulent des badges: Évalué, Recommandé, Coach Élite, Placeur.
              </p>
            </div>

            {/* 4 badge cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
              {REPUTATION_BADGES.map((b) => (
                <div key={b.name} className={`bg-[#1A1D24] rounded-xl border ${b.border} p-5 text-center`}>
                  <p className={`font-head text-[14px] font-black uppercase tracking-wide ${b.iconColor}`}>{b.name}</p>
                  <p className="text-[11px] text-white/45 mt-1">{b.threshold}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 text-[16px] text-white/75 leading-[1.7] max-w-[800px]">
              <p>
                Bientôt, les recruteurs pourront évaluer directement les coachs après avoir recruté leurs athlètes. Un coach qui gonfle ses joueurs verra ses recommandations perdre de leur valeur. Un coach qui sait évaluer correctement deviendra une référence. Le système se corrige lui-même — exactement comme dans la vraie vie.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 7 — LA COMMUNICATION ──────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[800px] mx-auto px-6 py-20">
            <RedLabel>La communication</RedLabel>
            <SectionTitle>Le coach est le point de contact. Toujours.</SectionTitle>

            <div className="mt-8 space-y-6 text-[16px] text-white/75 leading-[1.7]">
              <p>
                Au Québec, les athlètes en voie de recrutement sont souvent mineurs. Les règles du RSEQ et le bon sens s&apos;alignent: la communication entre un recruteur CÉGEP et un athlète mineur passe par l&apos;entraîneur.
              </p>
              <p>
                Sur Nexus, c&apos;est intégré. Quand un recruteur s&apos;intéresse à un athlète, il écrit au coach via la messagerie. Le coach décide quoi partager, comment répondre, et quand impliquer l&apos;athlète. C&apos;est pas une gatekeeping — c&apos;est une protection.
              </p>
              <p>
                Nexus suit les calendriers RSEQ par sport, mais ne les impose pas. Les recruteurs peuvent toujours contacter les coachs en dehors des périodes officielles. Ce que le coach choisit de partager, c&apos;est sa décision. Nexus donne les outils, pas les règles.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 8 — CE QUI EST TOUJOURS GRATUIT ──────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[1000px] mx-auto px-6 py-20">
            <RedLabel>L&apos;engagement</RedLabel>
            <SectionTitle>La visibilité d&apos;un athlète n&apos;est jamais à vendre.</SectionTitle>
            <p className="text-[16px] text-white/75 leading-[1.7] mt-5 max-w-[800px]">
              Sur Nexus, les abonnements existent — mais ils gatent des outils, jamais des athlètes.
            </p>

            {/* 3 principle cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
              <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8">
                <div className="w-10 h-10 rounded-xl bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center mb-5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <h3 className="font-head text-[15px] font-black text-white">L&apos;athlète ne paie jamais</h3>
                <p className="text-[13px] text-white/60 leading-relaxed mt-2">
                  Profil complet, vidéos illimitées, vérification, statut de recrutement — tout est gratuit pour l&apos;athlète. Pour toujours.
                </p>
              </div>

              <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8">
                <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/15 text-[#3B82F6] flex items-center justify-center mb-5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h3 className="font-head text-[15px] font-black text-white">La visibilité n&apos;est pas gatée</h3>
                <p className="text-[13px] text-white/60 leading-relaxed mt-2">
                  Un recruteur gratuit voit le même profil qu&apos;un recruteur payant. Un talent ne peut pas être ignoré parce qu&apos;un recruteur n&apos;a pas payé.
                </p>
              </div>

              <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8">
                <div className="w-10 h-10 rounded-xl bg-[#E63946]/15 text-[#E63946] flex items-center justify-center mb-5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className="font-head text-[15px] font-black text-white">Le coach a toujours l&apos;essentiel gratuit</h3>
                <p className="text-[13px] text-white/60 leading-relaxed mt-2">
                  Créer des profils, évaluer, vérifier, recevoir des messages — c&apos;est gratuit. Les outils d&apos;analyse avancée sont Pro. Jamais l&apos;inverse.
                </p>
              </div>
            </div>

            <p className="text-[15px] text-white/65 leading-relaxed mt-8">
              On facture les outils — pipeline avancé, analytique recruteur, stats d&apos;école. Pas le droit d&apos;être vu. Un jeune athlète qui mérite d&apos;être recruté le sera, peu importe qui paie quoi autour de lui.
            </p>
          </div>
        </section>

        {/* ─── SECTION 9 — POURQUOI LE SPORT ─────────────────── */}
        <section className="bg-[#0d0f12] border-b border-white/[0.06]">
          <div className="max-w-[720px] mx-auto px-6 py-24 text-center">
            <RedLabel>Notre conviction</RedLabel>
            <h2 className="nx-display text-[30px] sm:text-[36px] font-extrabold text-white leading-tight tracking-tight mt-3">
              Le sport, c&apos;est ce qui garde les jeunes à l&apos;école.
            </h2>

            <div className="mt-10 space-y-6 text-[17px] text-white/75 leading-[1.7] text-left">
              <p>
                On croit au sport étudiant. C&apos;est ce qui bâtit le caractère d&apos;un jeune. C&apos;est ce qui crée les amitiés qui durent toute la vie. C&apos;est ce qui te pousse à te dépasser quand personne ne regarde. Ton environnement, quand tu grandis, c&apos;est ce qui te définit — et pour beaucoup, cet environnement, c&apos;est une équipe.
              </p>
              <p>
                Nexus ne réinvente pas le processus de recrutement. Les écoles connues vont continuer à produire des athlètes recrutés. Les grandes équipes vont continuer à exister. Ce qu&apos;on fait, c&apos;est élargir la porte. Donner une chance aux diamants bruts. Ouvrir les possibilités pour ceux qui ne sont pas dans le bon cercle.
              </p>
              <p>
                Parce que quelqu&apos;un a eu la chance — ou la persévérance — de faire des camps, de rencontrer les bonnes personnes, et de finir dans le bon programme. Et cette personne-là a vécu les trois meilleures années de sa vie.
              </p>
              <p>
                On veut ça pour tous les athlètes du Québec.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 10 — TRIPLE CTA ───────────────────────── */}
        <section className="bg-[#0d0f12] border-t border-white/[0.06]">
          <div className="max-w-[1000px] mx-auto px-6 py-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {PERSONAS.map((p) => (
                <div key={p.href} className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8 flex flex-col">
                  <h3 className="font-head text-[18px] font-black text-white">{p.question}</h3>
                  <p className="text-[14px] text-white/60 leading-relaxed mt-3 flex-1">{p.line}</p>
                  <Link href={p.href} className="inline-flex items-center gap-1 mt-6 text-[13px] font-bold text-[#E63946] hover:text-[#FF5C58] transition-colors">
                    {p.label}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FOOTER ────────────────────────────────────────── */}
        <footer className="bg-[#030609]/80 border-t border-[#1E2D4A]">
          <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#1E2D4A]">
              <div className="flex items-center gap-3">
                <NexusLogo variant="white" height={22} href="/" className="opacity-80" />
                <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#475569]">
                  Construit pour les étudiants-athlètes québécois
                </span>
              </div>
              <nav className="flex items-center gap-8">
                <Link href="/confidentialite" className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#475569] hover:text-[#9AA3B2] transition-colors">Confidentialité</Link>
                <Link href="/conditions" className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#475569] hover:text-[#9AA3B2] transition-colors">Conditions</Link>
                <Link href="/contact" className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#475569] hover:text-[#9AA3B2] transition-colors">Contact</Link>
              </nav>
              <div className="flex items-center gap-5">
                {[
                  { name: "Instagram", d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
                  { name: "Facebook", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
                  { name: "YouTube", d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
                  { name: "TikTok", d: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" },
                ].map(({ name, d }) => (
                  <a key={name} href="#" aria-label={name} target="_blank" rel="noopener noreferrer" className="nx-social-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={d} /></svg>
                  </a>
                ))}
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#2E3D55] text-center pt-5">&copy; 2026 Nexus — Propulsé par <img src="/brand/logo-white-red.png" alt="Nexus" style={{height:16, display:"inline"}} /></p>
          </div>
        </footer>
      </div>
    </div>
  );
}
