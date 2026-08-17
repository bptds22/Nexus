import NexusLogo from "@/components/ui/NexusLogo";
import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";
import PlaybookBackground from "./components/PlaybookBackground";
import Footer from "@/components/marketing/Footer";

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

const NAV_LINKS = [
  { label: "Comment ça marche", href: "/comment-ca-marche" },
  { label: "Coaches & Recruteurs", href: "/#roles" },
  { label: "Athlètes", href: "/#athletes" },
  { label: "Aide", href: "/aide" },
];

export default function NotFound() {
  return (
    <div className="hero-playbook bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />

      {/* ══════════════════════════════════════════
          NAV
      ══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-[#060A14]/92 backdrop-blur-md border-b border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          <Link href="/" aria-label="Nexus" className="flex items-center">
            <NexusLogo variant="white" height={28} className="nx-logo-dark" priority />
            <NexusLogo variant="black-red" height={28} className="nx-logo-light" priority />
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
          404 CONTENT
      ══════════════════════════════════════════ */}
      <section className="flex-1 flex items-center justify-center relative py-24 px-6">

        {/* Ghost watermark */}
        <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none" aria-hidden>
          <span className="nx-display font-black leading-none text-wl-red opacity-[0.20]"
            style={{ fontSize: "clamp(188px, 38vw, 484px)" }}>
            404
          </span>
        </div>

        <div className="relative z-10 text-center max-w-lg mx-auto">
          <div className={`${label} text-wl-red mb-6`}>Erreur 404</div>

          <h1 className="nx-display font-black text-white uppercase leading-none mb-5"
            style={{ fontSize: "clamp(52px, 10vw, 90px)" }}>
            Hors Jeu
          </h1>

          <p className="font-sans text-base text-[#9AA3B2] leading-relaxed max-w-sm mx-auto mb-10">
            Cette page n&apos;existe pas ou a été déplacée.
          </p>

          <Link href="/" className="nx-ghost-btn inline-flex items-center h-12 px-8 border font-head font-black text-sm uppercase tracking-widest">
            Retour à l&apos;accueil →
          </Link>
        </div>

      </section>

      <Footer />

    </div>
  );
}
