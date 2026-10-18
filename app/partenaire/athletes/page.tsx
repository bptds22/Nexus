"use client";

/* 1.4.5 (B1) — rendu CLIENT (PageChargee) : le portail est dans l'appli, qui est un
   export statique. Le corps est celui de l'ancien composant serveur, inchangé. */
import { createClient } from "@/lib/supabase/client";
import PageChargee, { type ParamsUrl } from "../_components/PageChargee";
import PartnerAthletesSearch from "@/components/partenaire/PartnerAthletesSearch";
import { classesPage } from "@/components/partenaire/kit/KitPartenaire";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/athletes — listing of partner-eligible athletes
   with full filter set. Server component prefetches dropdown
   options (sports / positions / regions / promotions); the
   client component owns filter state and re-queries
   `top_athletes_view` on each change.
═══════════════════════════════════════════════════════════════ */

const PROMOTIONS = [2025, 2026, 2027, 2028, 2029];

async function rendre() {
  const supabase = createClient();

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
    // Appli : l'écran porte ses propres marges natives (en-tête bord à bord).
    <div className={IS_CAPACITOR ? "min-h-screen bg-[#111317]" : classesPage(true)}>
      <PartnerAthletesSearch
        sports={sports}
        positions={positions}
        regions={distinctRegions}
        promotions={PROMOTIONS}
      />
    </div>
  );
}

export default function PartnerAthletesPage() {
  return <PageChargee rendre={rendre} />;
}
