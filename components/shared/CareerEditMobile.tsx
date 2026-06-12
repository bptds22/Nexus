"use client";

/* ═══════════════════════════════════════════════════════════════
   CareerEditMobile — full-screen drill-down for the coach career
   preferences (CareerToggle). Reached from MaReputationMobile's
   "Opportunités CÉGEP" NavRow.

   Standard mobile chrome (back chevron + title) wrapping the
   existing components/reputation/CareerToggle component verbatim
   — heavy editor (toggle + sport/region tag pickers + bio textarea)
   that we don't want inlined on the main reputation screen.

   Data : reuses useCoachReputationStats (gives careerOpen, sports,
   regions, role, bio + sportsList). Read on mount ; CareerToggle
   owns its own save flow (writes to users table).
═══════════════════════════════════════════════════════════════ */

import { useRouter } from "next/navigation";
import CareerToggle from "@/components/reputation/CareerToggle";
import { useCoachReputationStats } from "@/lib/queries/coach/useCoachReputationStats";
import { triggerHaptic } from "@/components/shared/settings";

const QC_REGIONS = [
  "Bas-Saint-Laurent", "Saguenay–Lac-Saint-Jean", "Capitale-Nationale",
  "Mauricie", "Estrie", "Montréal", "Outaouais", "Abitibi-Témiscamingue",
  "Côte-Nord", "Nord-du-Québec", "Gaspésie–Îles-de-la-Madeleine",
  "Chaudière-Appalaches", "Laval", "Lanaudière", "Laurentides",
  "Montérégie", "Centre-du-Québec",
];

export function CareerEditMobile() {
  const router = useRouter();
  const { data, isLoading } = useCoachReputationStats();

  function handleBack() {
    triggerHaptic("Light");
    router.push("/coach/reputation");
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="h-11 flex items-center px-4">
          <button
            type="button"
            aria-label="Retour"
            onClick={handleBack}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] text-[#8a8d96]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="flex-1 text-center font-head text-[17px] font-black text-white uppercase tracking-tight pr-9">
            Opportunités CÉGEP
          </h1>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="px-4 pt-10 pb-3 text-[#6b7280] text-[14px]">Chargement…</div>
      ) : (
        <div className="px-4 pt-4">
          <CareerToggle
            initialOpen={data?.careerOpen ?? false}
            initialSports={data?.careerSports ?? []}
            initialRegions={data?.careerRegions ?? []}
            initialRole={data?.careerRole}
            initialBio={data?.careerBio ?? ""}
            allSports={data?.sportsList ?? []}
            allRegions={QC_REGIONS}
          />
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
