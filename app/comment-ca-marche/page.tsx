"use client";

import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import Footer from "@/components/marketing/Footer";

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
  { key: "team_leader", name: "Meneur d'équipe", detail: "Catégorie au choix", desc: "Chef de file statistique de son équipe. Le coach choisit la catégorie qui s'applique au sport (points, plaqués, buts, passes, interceptions, etc.)." },
  { key: "league_leader", name: "Meneur de la ligue", detail: "Catégorie au choix", desc: "Chef de file statistique dans sa ligue. Le coach choisit la catégorie dominante — toute stat mesurable de son sport." },
  { key: "mvp", name: "Joueur par excellence", desc: "Reconnu comme joueur clé par son entraîneur pour sa saison ou sa carrière." },
  { key: "custom", name: "Distinction personnalisée", detail: "Texte personnalisé", desc: "Accomplissement spécifique reconnu par le coach — le texte est libre et reflète la réalité de l'athlète (ex. titre régional, record d'équipe, distinction du tournoi)." },
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
              <div className="bg-[#1A1D24] rounded-2xl border border-[#3B82F6]/40 p-8">
                <div className="w-12 h-12 rounded-full bg-[#3B82F6] flex items-center justify-center mb-5">
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

        <Footer />
      </div>
    </div>
  );
}
