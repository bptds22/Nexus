import Image from "next/image";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Maintenance Page
   Shown to all non-admin users when maintenance mode is active.
   Phase 2: middleware will redirect here when maintenance_mode = true.
───────────────────────────────────────────────────────────────── */

export default function MaintenancePage() {
  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex items-center justify-center relative">
      <PlaybookBackground />

      <div className="relative z-10 flex flex-col items-center text-center px-6 py-16 max-w-[500px] mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <Image
            src="/brand/White%20red%20logo%20@4x.png"
            alt="Nexus"
            width={36}
            height={36}
            className="object-contain"
          />
          <span className="font-head text-[18px] font-black text-white uppercase tracking-[0.06em]">
            Nexus
          </span>
        </div>

        {/* Spinning gear icon */}
        <div className="mb-8">
          <div className="w-[80px] h-[80px] rounded-full bg-[#E63946]/10 flex items-center justify-center animate-[spin_8s_linear_infinite]">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E63946"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight leading-tight">
          Nexus est en maintenance
        </h1>

        {/* Body */}
        <p className="text-[15px] text-[#9CA3AF] leading-relaxed mt-5 max-w-[400px]">
          Nous effectuons des améliorations pour mieux servir les étudiants-athlètes du Québec. La plateforme sera de retour sous peu.
        </p>

        {/* Estimated time pill */}
        <div className="mt-6">
          <span className="inline-block px-5 py-2 rounded-full bg-[#1A1D24] border border-white/10 text-[13px] text-[#6b7280]">
            Retour prévu dans quelques minutes
          </span>
        </div>

        {/* Contact */}
        <p className="text-[13px] text-[#6b7280] mt-8">
          Des questions? Contactez-nous à{" "}
          <a
            href="mailto:support@nexus-sport.ca"
            className="text-[#E63946] hover:text-[#FF5C58] transition-colors font-bold"
          >
            support@nexus-sport.ca
          </a>
        </p>

        {/* Pulsing dots */}
        <div className="flex items-center gap-2 mt-10">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-[#E63946]"
              style={{
                animation: "pulse-dot 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
