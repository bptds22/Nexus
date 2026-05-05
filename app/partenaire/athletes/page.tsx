import { createClient } from "@/lib/supabase/server";
import PartnerAthletesSearch from "@/components/partenaire/PartnerAthletesSearch";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/athletes — listing of partner-eligible athletes
   with full filter set. Server component prefetches dropdown
   options (sports / positions / regions / promotions); the
   client component owns filter state and re-queries
   `top_athletes_view` on each change.
═══════════════════════════════════════════════════════════════ */

const PROMOTIONS = [2025, 2026, 2027, 2028, 2029];

export default async function PartnerAthletesPage() {
  const supabase = await createClient();

  // Prefetch filter dropdown options — same pattern as
  // /partenaire/classements. These rarely change so the round-trip
  // happens once per page load, the client component reuses the
  // arrays for every filter interaction.
  const [sportsRes, positionsRes, regionsRes] = await Promise.all([
    supabase.from("sports").select("id, nom").order("nom"),
    supabase.from("positions").select("id, nom, abreviation, sport_id").order("nom"),
    supabase.from("schools").select("region").not("region", "is", null).order("region"),
  ]);

  const sports = (sportsRes.data ?? []) as { id: string; nom: string }[];
  const positions = (positionsRes.data ?? []) as { id: string; nom: string; abreviation: string | null; sport_id: string }[];
  const distinctRegions = Array.from(
    new Set((regionsRes.data ?? []).map((r) => r.region).filter(Boolean)),
  ).sort() as string[];

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto">
      <PartnerAthletesSearch
        sports={sports}
        positions={positions}
        regions={distinctRegions}
        promotions={PROMOTIONS}
      />
    </div>
  );
}
