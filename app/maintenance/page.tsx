import { createClient } from "@/lib/supabase/server";
import NexusLogo from "@/components/ui/NexusLogo";
import PlaybookBackground from "@/app/components/PlaybookBackground";

export const dynamic = "force-dynamic";
export const metadata = { title: "Maintenance — Nexus" };

/* ─────────────────────────────────────────────────────────────────
   Public maintenance page — no auth required.
   Fetches message + ETA from app_settings at request time.
───────────────────────────────────────────────────────────────── */

const DEFAULT_MESSAGE =
  "Nous effectuons des améliorations pour mieux servir les étudiants-athlètes du Québec. La plateforme sera de retour sous peu.";

async function loadSettings() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["maintenance_message", "maintenance_eta"]);
    const map = new Map<string, string>((data || []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? ""]));
    return {
      message: map.get("maintenance_message") || DEFAULT_MESSAGE,
      eta: map.get("maintenance_eta") || "",
    };
  } catch (err) {
    return { message: DEFAULT_MESSAGE, eta: "" };
  }
}

export default async function MaintenancePage() {
  const { message, eta } = await loadSettings();

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex items-center justify-center relative font-sans">
      <PlaybookBackground />

      <div className="relative z-10 flex flex-col items-center text-center px-6 py-16 max-w-[520px] mx-auto">
        <div className="mb-10">
          <NexusLogo variant="white" height={40} priority />
        </div>

        <div className="mb-8">
          <svg
            width={64}
            height={64}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#E63946"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="10" x2="14" y1="2" y2="2" />
            <circle cx="12" cy="14" r="8" />
            <line x1="12" y1="14" x2="12" y2="8" className="nx-timer-hand" />
          </svg>
        </div>
        <style>{`
          .nx-timer-hand {
            transform-origin: 12px 14px;
            animation: nx-timer-spin 6s linear infinite;
          }
          @keyframes nx-timer-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        <h1 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight leading-tight">
          Temps d&apos;arrêt
        </h1>

        <p className="text-[15px] text-[#9CA3AF] leading-relaxed mt-5 max-w-[440px]">
          {message}
        </p>

        {eta && (
          <div className="mt-7">
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#1A1D24] border border-white/10 text-[13px] text-[#E0E0E0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E63946] animate-pulse" />
              <span className="text-[#6b7280]">Retour estimé :</span>
              <span className="font-bold text-white">{eta}</span>
            </span>
          </div>
        )}

        <p className="text-[13px] text-[#9CA3AF] mt-10">
          Suivez-nous sur{" "}
          <a
            href="https://instagram.com/nexus.sports.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#E63946] hover:underline"
          >
            Instagram
          </a>{" "}
          et{" "}
          <a
            href="https://facebook.com/nexussports"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#E63946] hover:underline"
          >
            Facebook
          </a>{" "}
          pour les mises à jour
        </p>
      </div>
    </div>
  );
}
