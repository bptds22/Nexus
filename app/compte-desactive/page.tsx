import NexusLogo from "@/components/ui/NexusLogo";

export const metadata = {
  title: "Compte désactivé — Nexus",
};

/* ══════════════════════════════════════════════════════════════
   Route: /compte-desactive
   Public page shown when a deactivated account hits any portal.
   No sidebar, no auth required, no login link.
══════════════════════════════════════════════════════════════ */

export default function CompteDesactivePage() {
  return (
    <div className="min-h-screen bg-[#111317] flex items-center justify-center px-6 font-sans">
      <div className="w-full max-w-[480px] text-center space-y-8">
        <div className="flex justify-center">
          <NexusLogo variant="white" height={40} priority />
        </div>

        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2A2D35] flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
        </div>

        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Compte désactivé
        </h1>

        <p className="text-[14px] leading-relaxed text-[#9CA3AF]">
          Votre compte a été désactivé par un administrateur. Si vous pensez
          qu&apos;il s&apos;agit d&apos;une erreur, contactez-nous à{" "}
          <a
            href="mailto:support@nexus-sports.ca"
            className="text-[#E63946] font-bold hover:underline"
          >
            support@nexus-sports.ca
          </a>
          .
        </p>
      </div>
    </div>
  );
}
