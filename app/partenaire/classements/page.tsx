import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClassementsFilterBar from "../_components/ClassementsFilterBar";
import AthletePhoto from "@/components/shared/AthletePhoto";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/classements — Top 25 leaderboard
   Reads top_athletes_view (RLS-gated to partner-eligible
   athletes via the eligibility helper inside the view).

   Server component for the table; ClassementsFilterBar is a
   small client component that pushes filter changes to the URL
   and the server re-renders.

   URL params:
     ?sport=<sport_id>
     ?position=<position_id>
     ?region=<region text>
     ?year=<annee_diplomation>

   Falls back gracefully when fewer than 25 match — header
   reads "<n> athlètes" instead of "Top 25".
═══════════════════════════════════════════════════════════════ */

const GRADUATION_YEARS = [2025, 2026, 2027, 2028, 2029];

type AthleteRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  cote_globale_entraineur: number | null;
  annee_diplomation: number | null;
  region: string | null;
  sport_id: string | null;
  position_id: string | null;
  school_id: string | null;
  photo_url: string | null;
  sport_name: string | null;
  position_name: string | null;
  school_name: string | null;
};

type FilterParams = {
  sport?: string;
  position?: string;
  region?: string;
  year?: string;
};

/* ABSENCE ≠ ZÉRO.
   `(rating ?? 0).toFixed(1)` rendait un athlète JAMAIS ÉVALUÉ comme « 0.0 »,
   à côté de son nom. Un partenaire média y lit une évaluation faible, alors
   qu'aucun entraîneur ne s'est prononcé — huit des neuf athlètes actuellement
   classés sont dans ce cas, sans une seule ligne dans `evaluations`.
   Le null se dit maintenant, il ne se convertit plus. */
function StarRow({ rating }: { rating: number | null }) {
  if (rating == null) {
    return (
      <div className="flex items-center gap-0.5" title="Aucune évaluation d'entraîneur">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="#374151" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
        <span className="text-[11px] font-semibold text-[#6b7280] ml-1 whitespace-nowrap">Non évalué</span>
      </div>
    );
  }
  const r = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= r ? "#F59E0B" : "#374151"} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className="text-[11px] font-bold text-[#F59E0B] ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export default async function PartnerClassementsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Pre-fetch dropdown options
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

  // Apply filters to top_athletes_view query
  let query = supabase.from("top_athletes_view").select("*").limit(25);
  if (params.sport) query = query.eq("sport_id", params.sport);
  if (params.position) query = query.eq("position_id", params.position);
  if (params.region) query = query.eq("region", params.region);
  if (params.year) query = query.eq("annee_diplomation", parseInt(params.year, 10));

  const { data, error } = await query;
  const athletes: AthleteRow[] = error ? [] : ((data ?? []) as unknown as AthleteRow[]);

  /* Le titre de section s'adaptait déjà au nombre réel ; le sous-titre de
     page, lui, annonçait « Top 25 » même avec neuf lignes. Les deux se
     dérivent maintenant du MÊME test, pour qu'ils ne puissent plus diverger. */
  const auPlafond = athletes.length === 25;
  const heading = auPlafond ? "Top 25" : `${athletes.length} athlète${athletes.length === 1 ? "" : "s"}`;
  const sousTitre = auPlafond
    ? "Top 25 par sport, position, région et promotion"
    : "Classement par sport, position, région et promotion";

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Classements</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">{sousTitre}</p>
      </div>

      <ClassementsFilterBar
        sports={sports}
        positions={positions}
        regions={distinctRegions}
        graduationYears={GRADUATION_YEARS}
      />

      {/* Results header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{heading}</h2>
      </div>

      {athletes.length === 0 ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1A1D24] border border-[#2D3748] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <p className="text-[13px] text-[#9CA3AF] font-semibold">Aucun athlète ne correspond à ces filtres.</p>
          <p className="text-[12px] text-[#6b7280] mt-1.5">Essaie de relâcher un ou plusieurs filtres ci-dessus.</p>
        </div>
      ) : (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl overflow-hidden">
          <div className="divide-y divide-[#2D3748]/40">
            {athletes.map((a, i) => {
              const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
              const rank = i + 1;

              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                  <span className="font-head text-[18px] font-black text-[#6b7280] w-8 text-center shrink-0 tabular-nums">
                    {rank}
                  </span>

                  <AthletePhoto
                    photoUrl={a.photo_url}
                    firstName={a.first_name}
                    lastName={a.last_name}
                    size={44}
                    alt={name}
                  />

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/partenaire/athletes/${a.id}`}
                      className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate block"
                    >
                      {name || "—"}
                    </Link>
                    <p className="text-[11px] text-[#6b7280] truncate">
                      {[a.sport_name, a.position_name, a.school_name].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>

                  <div className="hidden md:flex flex-col items-end shrink-0 mr-2 text-right">
                    {a.region && <span className="text-[11px] text-[#9CA3AF]">{a.region}</span>}
                    {a.annee_diplomation && <span className="text-[11px] text-[#6b7280]">Promotion {a.annee_diplomation}</span>}
                  </div>

                  <div className="shrink-0">
                    <StarRow rating={a.cote_globale_entraineur} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
