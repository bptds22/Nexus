import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewsroomDropdownFilters from "../_components/NewsroomDropdownFilters";
import NewsroomEventCard, { type NewsroomEventType } from "@/components/partner/NewsroomEventCard";

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

type EventRow = {
  id: string;
  event_type: NewsroomEventType;
  athlete_id: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  athletes: {
    id: string | null;
    photo_url: string | null;
    first_name: string | null;
    last_name: string | null;
    schools: { name: string | null } | null;
    sports: { nom: string | null } | null;
    positions: { abreviation: string | null } | null;
  } | null;
};

type FilterParams = {
  type?: string;
  range?: string;
  sport?: string;
  position?: string;
};

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider transition-colors border shrink-0 whitespace-nowrap ${
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
  // Embed pulls schools/sports/positions for the editorial card
  // metadata row ("FOOTBALL · QB · COLLÈGE ...").
  const athletesProjection = "id, photo_url, first_name, last_name, schools!school_id(name), sports!sport_id(nom), positions!position_id(abreviation)";
  const athletesEmbed = positionFilter
    ? `athletes!inner(${athletesProjection})`
    : `athletes(${athletesProjection})`;

  let query = supabase
    .from("newsroom_events")
    .select(`id, event_type, athlete_id, metadata, occurred_at, ${athletesEmbed}`)
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

      {/* Filters — type → sport → position → date range, single
          row with horizontal scroll on narrow viewports. */}
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mr-1 shrink-0">Type</span>
        <FilterChip label="Tout" href={buildHref({ type: null })} active={typeFilter === null} />
        <FilterChip label="Engagements" href={buildHref({ type: "COMMITMENT" })} active={typeFilter === "COMMITMENT"} />
        <FilterChip label="5 étoiles" href={buildHref({ type: "FIVE_STAR_SIGNUP" })} active={typeFilter === "FIVE_STAR_SIGNUP"} />
        <span className="w-px h-5 bg-[#2D3748] mx-2 shrink-0" />
        <NewsroomDropdownFilters sports={sports} positions={positions} />
        <span className="w-px h-5 bg-[#2D3748] mx-2 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mr-1 shrink-0">Période</span>
        <FilterChip label="7 jours" href={buildHref({ range: "7d" })} active={rangeFilter === "7d"} />
        <FilterChip label="30 jours" href={buildHref({ range: "30d" })} active={rangeFilter === "30d"} />
        <FilterChip label="Tout" href={buildHref({ range: "all" })} active={rangeFilter === "all"} />
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
              <Link
                href="/partenaire/newsroom"
                className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold uppercase tracking-wider rounded-lg transition-colors"
              >
                Réinitialiser les filtres
              </Link>
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
            const athleteId = e.athletes?.id ?? e.athlete_id;
            // Skip rows where the athlete record is missing — the
            // card needs an id to construct the profile link.
            if (!athleteId) return null;

            const meta = (e.metadata ?? {}) as Record<string, unknown>;
            const committedSchoolName = e.event_type === "COMMITMENT"
              ? (typeof meta.school_name === "string" ? meta.school_name : null)
              : null;

            const cardEvent = {
              id: e.id,
              event_type: e.event_type,
              occurred_at: e.occurred_at,
              athlete: {
                id: athleteId,
                first_name: e.athletes?.first_name ?? null,
                last_name: e.athletes?.last_name ?? null,
                photo_url: e.athletes?.photo_url ?? null,
                sport_name: e.athletes?.sports?.nom ?? null,
                position_abbreviation: e.athletes?.positions?.abreviation ?? null,
                school_name: e.athletes?.schools?.name ?? null,
              },
              committed_school_name: committedSchoolName,
            };

            return <NewsroomEventCard key={e.id} event={cardEvent} />;
          })}
        </div>
      )}
    </div>
  );
}
