import NexusLogo from "@/components/ui/NexusLogo";
import Link from "next/link";
import PlaybookBackground from "../components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Comment ça marche
   Matches landing page design: dark navy · playbook · OVR aesthetic
───────────────────────────────────────────────────────────────────*/

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

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

const ROLES = [
  {
    tag: "ENTRAÎNEUR",
    color: "#3B82F6",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    steps: [
      { n: "01", title: "Crée ton compte", body: "Inscris-toi comme entraîneur et ton école secondaire. Commence à utiliser Nexus pour mettre en valeur les athlètes de ton programme." },
      { n: "02", title: "Ajoute tes athlètes", body: "Crée facilement les profils de tes joueurs : statistiques, vidéos, faits saillants et parcours académique. Tout est centralisé dans une fiche claire pour les recruteurs." },
      { n: "03", title: "Crée des opportunités", body: "Les recruteurs de programmes collégiaux découvrent et peuvent contacter directement les entraîneurs. Une connexion rapide, directe et transparente." },
      { n: "04", title: "Bâtis ta réputation", body: "Développe ta notoriété auprès des recruteurs. Reçois des notes et commentaires sur la qualité de ton scouting et de tes recommandations." },
    ],
  },
  {
    tag: "ÉTUDIANT-ATHLÈTE",
    color: "#22C55E",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="10 8 16 12 10 16 10 8"/>
      </svg>
    ),
    steps: [
      { n: "01", title: "Crée ton profil", body: "Ton entraîneur t'ajoute sur Nexus et crée ton profil d'étudiant-athlète. Tu reçois ensuite un accès pour compléter ton profil et ajouter tes informations." },
      { n: "02", title: "Présente-toi", body: "Ajoute ta position, ton parcours académique et tes objectifs sportifs. Montre aux recruteurs qui tu es comme athlète et comme étudiant." },
      { n: "03", title: "Partage tes vidéos", body: "Télécharge tes meilleurs highlights : jeux clés, actions importantes et moments forts. Les recruteurs peuvent évaluer ton talent directement en situation de jeu." },
      { n: "04", title: "Fais-toi repérer", body: "Ton profil devient visible pour les programmes CÉGEP partenaires. Une seule plateforme pour augmenter ta visibilité auprès des recruteurs." },
    ],
  },
  {
    tag: "DIRECTEUR",
    color: "#F59E0B",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ),
    steps: [
      { n: "01", title: "Crée ton organisation", body: "Inscris ton école secondaire ou ton programme CÉGEP sur Nexus. Configure ton organisation et prépare l'accès pour ton équipe." },
      { n: "02", title: "Invite tes entraîneurs", body: "Ajoute les entraîneurs de ton école à la plateforme. Gère les accès et les permissions pour chaque membre de ton personnel sportif." },
      { n: "03", title: "Supervise les profils", body: "Consulte l'ensemble des profils d'athlètes soumis par tes entraîneurs. Assure la qualité et la conformité des informations avant publication." },
      { n: "04", title: "Vue d'ensemble", body: "Accède à un tableau de bord complet : nombre d'athlètes, profils actifs, demandes de contact et activité de ton organisation." },
    ],
  },
  {
    tag: "RECRUTEUR",
    color: "#E63946",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    steps: [
      { n: "01", title: "Accès recruteur", body: "Crée ton compte CÉGEP et obtiens un accès vérifié à la base de données d'étudiants-athlètes du secondaire à travers le Québec." },
      { n: "02", title: "Filtre les prospects", body: "Recherche les athlètes par sport, région, position ou année de graduation. Trouve rapidement les profils qui correspondent aux besoins de ton programme." },
      { n: "03", title: "Identifie les talents clés", body: "Repère les étudiants-athlètes qui peuvent apporter une réelle valeur à ton équipe. Bâtis ta prochaine cohorte et planifie l'avenir de ton programme." },
      { n: "04", title: "Contacte directement", body: "Envoie un message à l'entraîneur directement. Aucun intermédiaire. Communication rapide. Recrutement simplifié." },
    ],
  },
];

const FAQ = [
  { q: "Est-ce que Nexus est gratuit?", a: "L'accès à Nexus est gratuit pour les étudiants-athlètes. Les écoles secondaires et les programmes CÉGEP disposent d'un accès institutionnel leur permettant de gérer les profils, rechercher des prospects et communiquer via la plateforme." },
  { q: "Mes données sont-elles sécurisées?", a: "Oui. Toutes les données sont hébergées au Québec et conformes aux lois québécoises sur la protection des renseignements personnels. Les profils mineurs nécessitent un consentement parental." },
  { q: "Comment sont vérifiés les profils?", a: "Chaque entraîneur est vérifié via son école secondaire avant d'obtenir accès à la plateforme. Les comptes vérifiés reçoivent un badge bleu indiquant que le profil est authentique. Les statistiques sont liées aux dossiers officiels des fédérations sportives afin d'assurer l'exactitude des informations. Zéro profil fictif." },
  { q: "Quels sports sont supportés?", a: "Tous les sports sont supportés sur la plateforme. Les entraîneurs peuvent ajouter leurs athlètes peu importe la discipline sportive. Nexus s'adapte aux besoins des programmes CÉGEP afin de faciliter la découverte de talents dans tous les sports." },
  { q: "Je ne vois pas mon sport ou ma division. Que faire?", a: "Si ton sport ou ta division n'apparaît pas sur Nexus, contacte-nous via le formulaire ou envoie un courriel à infos@nexus.ai. Notre équipe peut ajouter de nouveaux programmes et divisions selon les besoins." },
];

export default function CommentCaMarche() {
  return (
    <div className="hero-playbook bg-[#060A14] min-h-screen">
      <PlaybookBackground />

      {/* ══════════════════════════════════════════
          NAV
      ══════════════════════════════════════════ */}
      <MarketingNav />

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-transparent">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-20 text-center">

          <div className="inline-flex items-center gap-3 mb-8">
            <span className="w-6 h-px bg-wl-red"/>
            <span className={`${label} text-wl-red`}>Guide · Nexus 2025</span>
            <span className="w-6 h-px bg-wl-red"/>
          </div>

          <h1 className="nx-display text-6xl xl:text-7xl font-black text-white uppercase leading-[0.92] tracking-tight mb-6">
            Comment<br />
            <span className="text-wl-red">ça marche</span>
          </h1>

          <p className="font-sans text-base text-[#9AA3B2] leading-relaxed max-w-[520px] mx-auto mb-10">
            Nexus simplifie le recrutement sportif au secondaire. Voici comment la plateforme fonctionne selon ton rôle — entraîneur, athlète ou recruteur CÉGEP.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <a href="#entraineur" className="nx-ghost-btn h-11 px-7 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center">
              Je suis un Entraîneur
            </a>
            <a href="#athlete" className="nx-ghost-btn h-11 px-7 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center">
              Je suis un Étudiant-Athlète
            </a>
            <a href="#directeur" className="nx-ghost-btn h-11 px-7 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center">
              Je suis un Directeur
            </a>
            <a href="#recruteur" className="nx-ghost-btn h-11 px-7 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center">
              Je suis un Recruteur
            </a>
          </div>

        </div>
      </section>

      {/* Separator */}
      <div className="nx-sep relative h-14 bg-[#060A14]/60 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#0A1020]/60" style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }}/>
      </div>

      {/* ══════════════════════════════════════════
          ROLE SECTIONS
      ══════════════════════════════════════════ */}
      {ROLES.map((role, ri) => (
        <section
          key={role.tag}
          id={role.tag === "ENTRAÎNEUR" ? "entraineur" : role.tag === "ÉTUDIANT-ATHLÈTE" ? "athlete" : role.tag === "DIRECTEUR" ? "directeur" : "recruteur"}
          className="bg-[#060A14]/75"
        >
          <div className="max-w-6xl mx-auto px-6 py-20">

            {/* Role header */}
            <div className="flex items-center gap-5 mb-14">
              <div
                className="w-14 h-14 flex items-center justify-center border flex-shrink-0"
                style={{ borderColor: role.color, color: role.color }}
              >
                {role.icon}
              </div>
              <div>
                <div className={`${label} mb-1`} style={{ color: role.color }}>
                  {role.tag}
                </div>
                <h2 className="nx-display text-3xl font-black text-white uppercase tracking-tight leading-tight">
                  {role.tag === "ENTRAÎNEUR" && "Pour les entraîneurs du secondaire"}
                  {role.tag === "ÉTUDIANT-ATHLÈTE" && <>Pour les étudiants-athlètes <span className="text-[#9AA3B2] font-normal text-xl normal-case tracking-normal">(à venir)</span></>}
                  {role.tag === "DIRECTEUR"  && "Pour les directeurs d'organisation"}
                  {role.tag === "RECRUTEUR"  && "Pour les recruteurs CÉGEP"}
                </h2>
              </div>
            </div>

            {/* Steps grid */}
            <div className="nx-steps-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#1E2D4A]">
              {role.steps.map((step) => (
                <div key={step.n} className="nx-step-card group relative p-8 transition-colors overflow-hidden">

                  {/* Top accent line on hover */}
                  <div
                    className="absolute top-0 left-0 w-full h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
                    style={{ background: role.color }}
                  />

                  {/* Ghost step number */}
                  <div className="nx-step-num nx-display text-8xl font-black text-white/30 leading-none mb-4 select-none" aria-hidden>
                    {step.n}
                  </div>

                  <div className={`${label} mb-3`} style={{ color: role.color }}>
                    Étape {step.n}
                  </div>

                  <h3 className="nx-display text-lg font-black text-white uppercase tracking-tight leading-tight mb-3">
                    {step.title}
                  </h3>

                  <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed">
                    {step.body}
                  </p>

                </div>
              ))}
            </div>

          </div>
        </section>
      ))}

      {/* Separator reverse */}
      <div className="nx-sep relative h-14 bg-[#0A1020]/60 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#060A14]/60" style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}/>
      </div>

      {/* ══════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════ */}
      <section className="bg-[#060A14]/75">
        <div className="max-w-3xl mx-auto px-6 py-20">

          <div className="text-center mb-14">
            <div className={`${label} text-wl-red mb-4`}>Foire aux questions</div>
            <h2 className="nx-display text-4xl font-black text-white uppercase leading-tight">
              Tes questions,<br />nos réponses
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            {FAQ.map((item) => (
              <div key={item.q} className="py-6 group">
                <div className="flex items-start gap-4">
                  <span className="w-5 h-px bg-wl-red mt-3 flex-shrink-0"/>
                  <div>
                    <h3 className="nx-display font-black text-white uppercase tracking-tight text-base mb-2 group-hover:text-wl-red transition-colors">
                      {item.q}
                    </h3>
                    <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          FINAL CTA STRIP
      ══════════════════════════════════════════ */}
      <section className="bg-[#060A14]/75">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className={`${label} text-wl-red mb-3`}>Prêt à jouer?</div>
            <h2 className="nx-display text-4xl font-black text-white uppercase leading-tight">
              Commence à recruter aujourd&apos;hui
            </h2>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button className="h-12 px-8 bg-wl-red text-white font-head font-black text-xs uppercase tracking-widest hover:bg-wl-red-hover transition-colors hover:shadow-[0_8px_28px_rgba(232,72,72,0.38)] hover:-translate-y-0.5">
              S&apos;inscrire gratuitement →
            </button>
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
              <NexusLogo variant="white" height={22} href="/" className="opacity-80" />
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

          <p className={`${label} text-[#2E3D55] text-center pt-5`}>© 2026 Nexus — Propulsé par <img src="/brand/White%20red@4x.png" alt="WeLead" style={{height:16}} /></p>

        </div>
      </footer>

    </div>
  );
}
