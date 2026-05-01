import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewsroomDropdownFilters from "../_components/NewsroomDropdownFilters";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/newsroom — async server component
   Reads from newsroom_events (RLS auto-restricts to events for
   partner-eligible athletes, gated by is_approved_partner).

   URL params drive filters:
     ?type=COMMITMENT | FIVE_STAR_SIGNUP   (default: ALL)
     ?range=7d | 30d | all                 (default: 30d)
     ?sport=<sport_id>                     (default: ALL)
     ?position=<position_id>               (default: ALL)

   Type/range use chip-style <Link> nav. Sport/position are
   <select> dropdowns inside a small client component
   (NewsroomDropdownFilters) that pushes URL changes via
   useRouter — same pattern as ClassementsFilterBar.
═══════════════════════════════════════════════════════════════ */

type EventType = "COMMITMENT" | "FIVE_STAR_SIGNUP";
type EventRow = {
  id: string;
  event_type: EventType;
  athlete_id: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  athletes: { photo_url: string | null; first_name: string | null; last_name: string | null } | null;
};

type FilterParams = {
  type?: string;
  range?: string;
  sport?: string;
  position?: string;
};

const TYPE_LABEL: Record<EventType, string> = {
  COMMITMENT: "Engagement",
  FIVE_STAR_SIGNUP: "5 étoiles",
};

function formatRelativeFrench(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} semaine${Math.floor(days / 7) > 1 ? "s" : ""}`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

function CommitmentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function FiveStarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider transition-colors border ${
        active
          ? "bg-[#E63946]/15 border-[#E63946]/30 text-[#E63946]"
          : "bg-[#13151a] border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56]"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function PartnerNewsroomPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const params = await searchParams;
  const typeFilter = params.type === "COMMITMENT" || params.type === "FIVE_STAR_SIGNUP" ? params.type : null;
  const rangeFilter = params.range === "7d" ? "7d" : params.range === "all" ? "all" : "30d";
  const sportFilter = params.sport || null;
  const positionFilter = params.position || null;

  const supabase = await createClient();

  // Pre-fetch dropdown options for the sport + position filters.
  // Sports list is small (16) and positions cap at ~50 across all
  // sports — single query each, passed into the client filter
  // component as props.
  const [sportsRes, positionsRes] = await Promise.all([
    supabase.from("sports").select("id, nom").order("nom"),
    supabase.from("positions").select("id, nom, abreviation, sport_id").order("nom"),
  ]);
  const sports = (sportsRes.data ?? []) as { id: string; nom: string }[];
  const positions = (positionsRes.data ?? []) as { id: string; nom: string; abreviation: string | null; sport_id: string }[];

  // Position filter requires inner join to athletes (filter on
  // joined column). Sport filter goes on newsroom_events.sport_id
  // directly (set by the trigger), no inner join needed for that.
  const athletesEmbed = positionFilter
    ? "athletes!inner(id, photo_url, first_name, last_name, position_id)"
    : "athletes(photo_url, first_name, last_name)";

  let query = supabase
    .from("newsroom_events")
    .select(`id, event_type, athlete_id, title, description, metadata, occurred_at, ${athletesEmbed}`)
    .order("occurred_at", { ascending: false })
    .limit(100);

  if (typeFilter) {
    query = query.eq("event_type", typeFilter);
  }
  if (rangeFilter === "7d") {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    query = query.gte("occurred_at", cutoff);
  } else if (rangeFilter === "30d") {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    query = query.gte("occurred_at", cutoff);
  }
  if (sportFilter) {
    query = query.eq("sport_id", sportFilter);
  }
  if (positionFilter) {
    query = query.eq("athletes.position_id", positionFilter);
  }

  const { data, error } = await query;
  const events: EventRow[] = error ? [] : ((data ?? []) as unknown as EventRow[]);

  function buildHref(overrides: { type?: string | null; range?: string }): string {
    const next = new URLSearchParams();
    const t = overrides.type !== undefined ? overrides.type : typeFilter;
    const r = overrides.range !== undefined ? overrides.range : rangeFilter;
    if (t) next.set("type", t);
    if (r && r !== "30d") next.set("range", r);
    // Preserve sport + position across chip-driven nav so a partner
    // changing the type chip doesn't lose their sport/position
    // selection.
    if (sportFilter) next.set("sport", sportFilter);
    if (positionFilter) next.set("position", positionFilter);
    const qs = next.toString();
    return qs ? `/partenaire/newsroom?${qs}` : "/partenaire/newsroom";
  }

  const hasActiveFilters = !!(typeFilter || rangeFilter !== "30d" || sportFilter || positionFilter);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Newsroom</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Engagements et nouvelles 5 étoiles</p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mr-1">Type</span>
          <FilterChip label="Tout" href={buildHref({ type: null })} active={typeFilter === null} />
          <FilterChip label="Engagements" href={buildHref({ type: "COMMITMENT" })} active={typeFilter === "COMMITMENT"} />
          <FilterChip label="5 étoiles" href={buildHref({ type: "FIVE_STAR_SIGNUP" })} active={typeFilter === "FIVE_STAR_SIGNUP"} />
          <span className="w-px h-5 bg-[#2D3748] mx-2" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mr-1">Période</span>
          <FilterChip label="7 derniers jours" href={buildHref({ range: "7d" })} active={rangeFilter === "7d"} />
          <FilterChip label="30 derniers jours" href={buildHref({ range: "30d" })} active={rangeFilter === "30d"} />
          <FilterChip label="Tout" href={buildHref({ range: "all" })} active={rangeFilter === "all"} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NewsroomDropdownFilters sports={sports} positions={positions} />
        </div>
      </div>

      {/* Feed */}
      {events.length === 0 ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1A1D24] border border-[#2D3748] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          {hasActiveFilters ? (
            <>
              <p className="text-[13px] text-[#9CA3AF] font-semibold">Aucun événement ne correspond à ces filtres.</p>
              <p className="text-[12px] text-[#6b7280] mt-1.5">Essayez d&apos;élargir votre recherche.</p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-[#9CA3AF] font-semibold">Aucun événement récent.</p>
              <p className="text-[12px] text-[#6b7280] mt-1.5">Revenez bientôt — les événements apparaissent ici dès qu&apos;un athlète admissible signe ou atteint 5 étoiles.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const athleteName = e.athletes
              ? `${e.athletes.first_name ?? ""} ${e.athletes.last_name ?? ""}`.trim()
              : null;
            const photo = e.athletes?.photo_url || null;
            const initials = athleteName ? athleteName.split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase() : "?";

            return (
              <div
                key={e.id}
                className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 flex items-start gap-4 hover:border-[#E63946]/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#13151a] flex items-center justify-center shrink-0">
                  {e.event_type === "COMMITMENT" ? <CommitmentIcon /> : <FiveStarIcon />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[10px] font-bold uppercase tracking-wider">
                      {TYPE_LABEL[e.event_type]}
                    </span>
                    <span className="text-[11px] text-[#6b7280]">{formatRelativeFrench(e.occurred_at)}</span>
                  </div>
                  <h3 className="text-[15px] font-bold text-white mt-1.5 leading-snug">{e.title}</h3>
                  {e.description && (
                    <p className="text-[13px] text-[#9CA3AF] mt-1 leading-relaxed">{e.description}</p>
                  )}
                  {e.athlete_id && athleteName && (
                    <Link
                      href={`/partenaire/athletes/${e.athlete_id}`}
                      className="inline-block text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors mt-2"
                    >
                      Voir {athleteName} →
                    </Link>
                  )}
                </div>

                {/* Athlete thumbnail (right side) */}
                {e.athlete_id && (
                  <Link href={`/partenaire/athletes/${e.athlete_id}`} className="shrink-0 block">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={athleteName ?? ""} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#2D3748] flex items-center justify-center text-[12px] font-bold text-white/60">
                        {initials}
                      </div>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
