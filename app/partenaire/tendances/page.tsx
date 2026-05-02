import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AthletePhoto from "@/components/shared/AthletePhoto";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/tendances — async server component
   Reads trending_athletes_view (RLS-gated to partner-eligible
   athletes via the eligibility helper inside the view).

   Two side-by-side panels:
     • "Plus de vues cette semaine"   — top 10 by views_delta DESC
     • "Plus de favoris cette semaine" — top 10 by favs_delta  DESC

   Each row: photo, name, sport, school, weekly delta, link to
   /partenaire/athletes/[id].
═══════════════════════════════════════════════════════════════ */

type TrendingRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  cote_globale_entraineur: number | null;
  region: string | null;
  school_name: string | null;
  annee_diplomation: number | null;
  sport_name: string | null;
  views_7d: number;
  views_prior_7d: number;
  views_delta: number;
  favs_7d: number;
  favs_prior_7d: number;
  favs_delta: number;
};

function formatDelta(d: number): string {
  if (d > 0) return `+${d}`;
  return String(d);
}

function deltaColor(d: number): string {
  if (d > 0) return "#22C55E";
  if (d < 0) return "#EF4444";
  return "#6B7280";
}

function ArrowUp() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function AthleteRow({ row, mode }: { row: TrendingRow; mode: "views" | "favs" }) {
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  const delta = mode === "views" ? row.views_delta : row.favs_delta;
  const current = mode === "views" ? row.views_7d : row.favs_7d;
  const color = deltaColor(delta);

  const subtitleParts = [row.sport_name, row.school_name].filter(Boolean) as string[];
  const subtitle = subtitleParts.join(" · ") || "—";

  return (
    <Link
      href={`/partenaire/athletes/${row.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group"
    >
      <AthletePhoto
        photoUrl={row.photo_url}
        firstName={row.first_name}
        lastName={row.last_name}
        size={44}
        alt={name}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-white truncate group-hover:text-[#E63946] transition-colors">{name}</p>
        <p className="text-[11px] text-[#6b7280] truncate">{subtitle}</p>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="font-head text-[18px] font-black leading-none" style={{ color }}>
          <span className="inline-flex items-center gap-1">
            {delta > 0 && <ArrowUp />}
            {delta < 0 && <ArrowDown />}
            {formatDelta(delta)}
          </span>
        </span>
        <span className="text-[10px] text-[#6b7280] mt-0.5">{current} cette sem.</span>
      </div>
    </Link>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
        <path d="M3 3v18h18" />
        <path d="M18.7 8L13 13.7l-3-3-5 5" />
      </svg>
      <p className="text-[12px] text-[#9CA3AF]">{message}</p>
    </div>
  );
}

export default async function PartnerTendancesPage() {
  const supabase = await createClient();

  // Top 10 by views_delta — only positive movers (delta > 0)
  const viewsRes = await supabase
    .from("trending_athletes_view")
    .select("*")
    .gt("views_delta", 0)
    .order("views_delta", { ascending: false })
    .limit(10);

  // Top 10 by favs_delta — only positive movers
  const favsRes = await supabase
    .from("trending_athletes_view")
    .select("*")
    .gt("favs_delta", 0)
    .order("favs_delta", { ascending: false })
    .limit(10);

  const viewsTop: TrendingRow[] = (viewsRes.data ?? []) as unknown as TrendingRow[];
  const favsTop: TrendingRow[] = (favsRes.data ?? []) as unknown as TrendingRow[];

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Tendances</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Athlètes en pleine ascension cette semaine</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Views panel */}
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2D3748] flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#3B82F6]/15 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-white uppercase tracking-tight">Plus de vues cette semaine</h2>
              <p className="text-[11px] text-[#6b7280]">Variation vs. 7 jours précédents</p>
            </div>
          </div>
          {viewsTop.length === 0 ? (
            <EmptyPanel message="Aucune tendance détectée cette semaine." />
          ) : (
            <div className="divide-y divide-[#2D3748]/40">
              {viewsTop.map((r) => <AthleteRow key={r.id} row={r} mode="views" />)}
            </div>
          )}
        </div>

        {/* Favs panel */}
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2D3748] flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#E63946]/15 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#E63946" stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-white uppercase tracking-tight">Plus de favoris cette semaine</h2>
              <p className="text-[11px] text-[#6b7280]">Variation vs. 7 jours précédents</p>
            </div>
          </div>
          {favsTop.length === 0 ? (
            <EmptyPanel message="Aucune tendance détectée cette semaine." />
          ) : (
            <div className="divide-y divide-[#2D3748]/40">
              {favsTop.map((r) => <AthleteRow key={r.id} row={r} mode="favs" />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
