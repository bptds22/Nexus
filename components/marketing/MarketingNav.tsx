import Link from "next/link";
import ThemeToggle from "@/app/components/ThemeToggle";
import NexusLogo from "@/components/ui/NexusLogo";

const DROPDOWN_ITEMS = [
  { label: "Pour les coachs", href: "/pour-les-coachs" },
  { label: "Pour les recruteurs", href: "/pour-les-recruteurs" },
  { label: "Pour les étudiants-athlètes", href: "/pour-les-athletes" },
];

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

export default function MarketingNav() {
  return (
    <nav className="sticky top-0 z-50 bg-[#111317] border-b border-[#1E2D4A]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        <Link href="/" aria-label="Nexus" className="flex items-center">
          <NexusLogo variant="white" height={28} className="nx-logo-dark" priority />
          <NexusLogo variant="black-red" height={28} className="nx-logo-light" priority />
        </Link>

        <ul className="hidden md:flex items-center gap-8 list-none">
          {/* Dropdown — Coaches & Recruteurs */}
          <li className="relative group">
            <span className={`${label} text-[#9AA3B2] group-hover:text-white transition-colors cursor-default flex items-center gap-1`}>
              Découvrir Nexus
              <svg width="14" height="14" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-px opacity-70 group-hover:opacity-100 transition-opacity">
                <path d="M2.5 4 5 6.5 7.5 4" />
              </svg>
            </span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-300 ease-out">
              <ul className="bg-[#0A0E18]/95 backdrop-blur-md border border-[#1E2D4A] rounded-lg py-2 min-w-[240px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] list-none overflow-hidden">
                {DROPDOWN_ITEMS.map((d, i) => (
                  <li key={d.href} style={{ animationDelay: `${i * 50}ms` }} className="group/item">
                    <Link href={d.href} className="flex items-center gap-3 px-5 py-3 text-[11px] font-bold tracking-[0.2em] uppercase text-[#9AA3B2] hover:text-white transition-all duration-200 relative overflow-hidden">
                      {/* Red accent line on hover */}
                      <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#E63946] scale-y-0 group-hover/item:scale-y-100 transition-transform duration-200 origin-top" />
                      {/* Hover background */}
                      <span className="absolute inset-0 bg-[#E63946]/[0.06] opacity-0 group-hover/item:opacity-100 transition-opacity duration-200" />
                      {/* Arrow that slides in */}
                      <span className="relative -translate-x-2 opacity-0 group-hover/item:translate-x-0 group-hover/item:opacity-100 transition-all duration-200 text-[#E63946]">
                        &rsaquo;
                      </span>
                      <span className="relative">{d.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>

          <li>
            <Link href="/comment-ca-marche" className={`${label} text-[#9AA3B2] hover:text-white transition-colors`}>
              Comment ça marche
            </Link>
          </li>

          <li>
            <Link href="/tarifs" className={`${label} text-[#E63946] hover:text-white transition-colors`}>
              Tarifs
            </Link>
          </li>

          <li>
            <Link href="/roadmap" className={`${label} text-[#9AA3B2] hover:text-white transition-colors`}>
              Roadmap
            </Link>
          </li>

          <li>
            <Link href="/a-propos" className={`${label} text-[#9AA3B2] hover:text-white transition-colors`}>
              À propos
            </Link>
          </li>
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => { console.log("[MarketingNav] Language toggle clicked — no-op until translations ready"); }}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/20 text-sm font-medium"
          >
            <span className="text-white font-semibold">FR</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-500">EN</span>
          </button>
          <Link href="/auth" className={`hidden sm:block ${label} text-wl-red transition-colors px-4 h-9 leading-9 hover:drop-shadow-[0_0_8px_rgba(232,72,72,0.6)]`}>
            Connexion
          </Link>
          <Link href="/auth?mode=signup" className="nx-ghost-btn h-9 px-5 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center">
            S&apos;inscrire
          </Link>
        </div>

      </div>
    </nav>
  );
}
