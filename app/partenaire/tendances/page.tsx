"use client";

/* 1.4.5 (B1) — rendu CLIENT (PageChargee) : le portail est dans l'appli, qui est un
   export statique. Le corps est celui de l'ancien composant serveur, inchangé. */
import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageChargee, { type ParamsUrl } from "../_components/PageChargee";
import AthletePhoto from "@/components/shared/AthletePhoto";
import TendancesDropdownFilters from "../_components/TendancesDropdownFilters";
import EnTeteExploration from "../_components/EnTeteExploration";
import { debutPeriode, libellePeriode, lirePeriode, PASTILLES_PERIODE, type ClePeriode } from "@/lib/partenaires/periodeExploration";
import {
  isOrgType,
  parseCoteMin,
  isPartnerSortKey,
  DEFAULT_PARTNER_SORT,
  sortPartnerRows,
} from "../_components/partnerFilters";

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
  sport_id: string | null;
  position_id: string | null;
};

/** Années de promotion — constante, alignée sur /classements et /athletes.
    Volontairement pas dérivée des données : une liste d'options qui rétrécit
    avec le jeu de données rend le portail imprévisible. */
const GRADUATION_YEARS = [2025, 2026, 2027, 2028, 2029];

type FilterParams = {
  /** 'M' | 'F' | 'X' — valeur BRUTE de athletes.genre, non normalisée. */
  genre?: string;
  sport?: string;
  position?: string;
  region?: string;
  /** `annee_diplomation` — même nom de param que sur /classements. */
  year?: string;
  /** 'scolaire' | 'ligue_civile' */
  org?: string;
  /** Cote minimale, en texte ('3' | '3.5' | '4' | '4.5'). */
  cote?: string;
  /** Clé de tri — ordre d'AFFICHAGE, pas de composition. Cf. sortPartnerRows. */
  sort?: string;
  /** Période de la rangée Engagements (6.5) : 7d (défaut) | 30d | saison. */
  range?: string;
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

/* ── Rangées défilantes gauche-droite (BP 2026-10-18, 6.5) ───────── */

/** Un engagement (newsroom COMMITMENT) dans la rangée « Engagements ». */
type Engagement = {
  id: string; athleteId: string; prenom: string | null; nom: string | null; photo: string | null;
  sport: string | null; ecole: string | null; engageA: string | null; le: string;
};

function Rangee({ titre, sousTitre, vide, children, n }: { titre: string; sousTitre: string; vide: string; children: ReactNode; n: number }) {
  return (
    <section data-rangee-tendance={titre}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-[14px] font-bold text-white uppercase tracking-tight">{titre}</h2>
        <p className="text-[11px] text-[#6b7280] shrink-0">{sousTitre}</p>
      </div>
      {n === 0 ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl"><EmptyPanel message={vide} /></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x" style={{ scrollbarWidth: "thin" }}>{children}</div>
      )}
    </section>
  );
}

function CarteTendance({ href, photo, prenom, nom, ligne, valeur, couleur, detail }: {
  href: string; photo: string | null; prenom: string | null; nom: string | null; ligne: string;
  valeur: ReactNode; couleur?: string; detail?: string;
}) {
  const nomComplet = `${prenom ?? ""} ${nom ?? ""}`.trim();
  return (
    <Link href={href}
      className="snap-start shrink-0 w-[150px] bg-[#1A1D24] border border-[#2D3748] rounded-xl p-3 flex flex-col items-center text-center hover:border-[#E63946]/40 transition-colors">
      <AthletePhoto photoUrl={photo} firstName={prenom} lastName={nom} size={56} alt={nomComplet} />
      <p className="mt-2 w-full text-[13px] font-bold text-white truncate">{nomComplet || "Athlète"}</p>
      <p className="w-full text-[11px] text-[#6b7280] truncate">{ligne || "—"}</p>
      <p className="mt-1.5 font-head text-[16px] font-black leading-none" style={couleur ? { color: couleur } : undefined}>{valeur}</p>
      {detail && <p className="mt-0.5 w-full text-[10px] text-[#6b7280] truncate">{detail}</p>}
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

async function rendre(brut: ParamsUrl) {
  const params = brut as FilterParams;
  const sportFilter = params.sport || null;
  const positionFilter = params.position || null;
  const regionFilter = params.region || null;
  const genreFilter = params.genre || null;
  /* Un `year` malformé dans l'URL donnerait NaN, et `.eq("annee_diplomation",
     NaN)` fait échouer la requête PostgREST — les DEUX palmarès tomberaient à
     vide sans explication. On ne retient l'année que si elle est un entier. */
  const yearParsed = params.year ? parseInt(params.year, 10) : NaN;
  const yearFilter = Number.isFinite(yearParsed) ? yearParsed : null;
  const orgFilter = isOrgType(params.org) ? params.org : null;
  const coteFilter = parseCoteMin(params.cote);
  const sortKey = isPartnerSortKey(params.sort) ? params.sort : DEFAULT_PARTNER_SORT;

  const supabase = createClient();

  // Pre-fetch dropdown options. Sports list is small (16);
  // positions cap at ~50 across all sports — single query each,
  // passed into the client filter component as props.
  const [sportsRes, positionsRes, regionsRes] = await Promise.all([
    supabase.from("sports").select("id, nom").order("nom"),
    supabase.from("positions").select("id, nom, abreviation, sport_id").order("nom"),
    supabase.from("schools").select("region").not("region", "is", null).order("region"),
  ]);
  const sports = (sportsRes.data ?? []) as { id: string; nom: string }[];
  const positions = (positionsRes.data ?? []) as { id: string; nom: string; abreviation: string | null; sport_id: string }[];
  // Mêmes dérivation et tri que sur /classements — `schools.region` n'est pas
  // dédupliquée en base, le Set s'en charge.
  const distinctRegions = Array.from(
    new Set((regionsRes.data ?? []).map((r) => r.region).filter(Boolean)),
  ).sort() as string[];

  // Build the views/favs queries with optional sport + position
  // filters layered on top of the positive-mover gate.
  let viewsQuery = supabase
    .from("trending_athletes_view")
    .select("*")
    .gt("views_delta", 0)
    .order("views_delta", { ascending: false })
    .limit(10);
  /* TOUT filtre posé ici DOIT l'être à l'identique sur favsQuery plus bas.
     La page rend deux palmarès côte à côte alimentés par la même vue ; en
     filtrer un seul afficherait « Vues » restreint aux Laurentides et
     « Favoris » sur tout le Québec, sous une seule et même barre de filtres.
     Les deux blocs se lisent en parallèle, ligne pour ligne. */
  if (sportFilter) viewsQuery = viewsQuery.eq("sport_id", sportFilter);
  if (positionFilter) viewsQuery = viewsQuery.eq("position_id", positionFilter);
  if (regionFilter) viewsQuery = viewsQuery.eq("region", regionFilter);
  if (yearFilter !== null) viewsQuery = viewsQuery.eq("annee_diplomation", yearFilter);
  // Genre — projeté par trending_athletes_view depuis 20260817190100.
  if (genreFilter) viewsQuery = viewsQuery.eq("genre", genreFilter);
  /* ORGANISME — la vue ne projette pas `school_id` : on teste `school_name`,
     substitut exact vérifié (0 désaccord). Détaillé dans la barre de filtres. */
  if (orgFilter === "scolaire") viewsQuery = viewsQuery.not("school_name", "is", null);
  if (orgFilter === "ligue_civile") viewsQuery = viewsQuery.is("school_name", null);
  if (coteFilter !== null) viewsQuery = viewsQuery.gte("cote_globale_entraineur", coteFilter);

  let favsQuery = supabase
    .from("trending_athletes_view")
    .select("*")
    .gt("favs_delta", 0)
    .order("favs_delta", { ascending: false })
    .limit(10);
  // Miroir EXACT du bloc viewsQuery ci-dessus — sept filtres, même ordre.
  if (sportFilter) favsQuery = favsQuery.eq("sport_id", sportFilter);
  if (positionFilter) favsQuery = favsQuery.eq("position_id", positionFilter);
  if (regionFilter) favsQuery = favsQuery.eq("region", regionFilter);
  if (yearFilter !== null) favsQuery = favsQuery.eq("annee_diplomation", yearFilter);
  if (genreFilter) favsQuery = favsQuery.eq("genre", genreFilter);
  if (orgFilter === "scolaire") favsQuery = favsQuery.not("school_name", "is", null);
  if (orgFilter === "ligue_civile") favsQuery = favsQuery.is("school_name", null);
  if (coteFilter !== null) favsQuery = favsQuery.gte("cote_globale_entraineur", coteFilter);

  /* Engagements (6.5) : les mêmes filtres, sur la période choisie (pastilles). La vue des tendances
     ne mesure que 7 jours ; la période s'applique donc à la rangée Engagements. */
  const periode: ClePeriode = lirePeriode(params.range, "7d");
  const engagementsQuery = supabase.rpc("partner_newsroom_events", {
    p_event_type:  "COMMITMENT",
    p_since:       debutPeriode(periode),
    p_sport_id:    sportFilter,
    p_position_id: positionFilter,
    p_genre:       genreFilter,
    p_org:         orgFilter,
    p_cote_min:    coteFilter,
    p_year:        yearFilter,
    p_region:      regionFilter,
    p_limit:       20,
  });

  const [viewsRes, favsRes, engagementsRes] = await Promise.all([viewsQuery, favsQuery, engagementsQuery]);
  const engagements: Engagement[] = engagementsRes.error ? [] : ((engagementsRes.data ?? []) as {
    id: string; athlete_id: string | null; metadata: Record<string, unknown> | null; occurred_at: string;
    athlete_first_name: string | null; athlete_last_name: string | null; athlete_photo_url: string | null;
    athlete_school_name: string | null; athlete_sport_nom: string | null;
  }[]).filter((r) => !!r.athlete_id).map((r) => ({
    id: r.id, athleteId: r.athlete_id as string, prenom: r.athlete_first_name, nom: r.athlete_last_name,
    photo: r.athlete_photo_url, sport: r.athlete_sport_nom, ecole: r.athlete_school_name,
    engageA: typeof r.metadata?.school_name === "string" ? (r.metadata.school_name as string) : null,
    le: r.occurred_at,
  }));

  // Pastilles de période : l'adresse courante, seul `range` change (7d = défaut, omis).
  const hrefPeriode = (cle: string) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => typeof v === "string") as [string, string][]);
    if (cle === "7d") q.delete("range"); else q.set("range", cle);
    const s = q.toString();
    return s ? `/partenaire/tendances?${s}` : "/partenaire/tendances";
  };
  const nbActifs = [sportFilter, positionFilter, regionFilter, genreFilter, orgFilter, coteFilter, yearFilter]
    .filter((v) => v !== null).length + (sortKey !== DEFAULT_PARTNER_SORT ? 1 : 0);

  /* Comme sur /classements, le tri s'applique APRÈS la coupe. Le `.limit(10)`
     ci-dessus, ordonné par delta, DÉFINIT qui sont les dix athlètes en
     ascension — c'est la raison d'être de l'écran. Trier par nom avant la
     coupe rendrait « les dix premiers alphabétiquement parmi ceux qui
     progressent », ce qui n'est plus un palmarès.
     Chaque liste est triée séparément mais avec la MÊME clé : les deux
     panneaux se lisent côte à côte, un ordre différent de part et d'autre
     serait illisible. */
  const viewsTop = sortPartnerRows(
    (viewsRes.data ?? []) as unknown as TrendingRow[], sortKey, (r) => r,
  );
  const favsTop = sortPartnerRows(
    (favsRes.data ?? []) as unknown as TrendingRow[], sortKey, (r) => r,
  );

  // genreFilter EN FAIT PARTIE : sans lui, filtrer un genre sans résultat
  // affichait « Aucune tendance détectée cette semaine » — un constat sur la
  // semaine, alors que la cause est le filtre. Le message mentait.
  // regionFilter et yearFilter y entrent pour la MÊME raison : avec 13 régions
  // pour 25 athlètes éligibles, la plupart des régions ne rendront aucune
  // tendance — c'est le cas le plus fréquent, pas le cas limite.
  const hasActiveFilters = !!(
    sportFilter || positionFilter || regionFilter || yearFilter !== null || genreFilter
    || orgFilter || coteFilter !== null || sortKey !== DEFAULT_PARTNER_SORT
  );
  const emptyMessage = hasActiveFilters
    ? "Aucune tendance ne correspond à ces filtres."
    : "Aucune tendance détectée cette semaine.";

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-6">
      <EnTeteExploration
        titre="Tendances"
        sousTitre="Athlètes en pleine ascension"
        nbActifs={nbActifs}
        reinitialiser="/partenaire/tendances"
        periode={PASTILLES_PERIODE.map((p) => ({ label: p.label, href: hrefPeriode(p.cle), actif: periode === p.cle }))}
      >
        <div className="flex flex-wrap items-center gap-2">
          <TendancesDropdownFilters
            sports={sports}
            positions={positions}
            regions={distinctRegions}
            graduationYears={GRADUATION_YEARS}
          />
        </div>
      </EnTeteExploration>

      {/* Rangées défilantes gauche-droite (6.5). Vues et likes : la vue des tendances compare
          7 jours aux 7 précédents ; la période choisie s'applique aux Engagements. */}
      <Rangee titre="Plus de vues cette semaine" sousTitre="vs 7 jours précédents" vide={emptyMessage} n={viewsTop.length}>
        {viewsTop.map((r) => (
          <CarteTendance key={r.id} href={`/partenaire/athletes/${r.id}`} photo={r.photo_url} prenom={r.first_name} nom={r.last_name}
            ligne={[r.sport_name, r.school_name].filter(Boolean).join(" · ")}
            valeur={<span className="inline-flex items-center gap-1">{r.views_delta > 0 && <ArrowUp />}{formatDelta(r.views_delta)}</span>}
            couleur={deltaColor(r.views_delta)} detail={`${r.views_7d} vues cette sem.`} />
        ))}
      </Rangee>

      <Rangee titre="Plus de likes cette semaine" sousTitre="vs 7 jours précédents" vide={emptyMessage} n={favsTop.length}>
        {favsTop.map((r) => (
          <CarteTendance key={r.id} href={`/partenaire/athletes/${r.id}`} photo={r.photo_url} prenom={r.first_name} nom={r.last_name}
            ligne={[r.sport_name, r.school_name].filter(Boolean).join(" · ")}
            valeur={<span className="inline-flex items-center gap-1">{r.favs_delta > 0 && <ArrowUp />}{formatDelta(r.favs_delta)}</span>}
            couleur={deltaColor(r.favs_delta)} detail={`${r.favs_7d} cette sem.`} />
        ))}
      </Rangee>

      <Rangee titre="Engagements" sousTitre={libellePeriode(periode)}
        vide={hasActiveFilters ? "Aucun engagement ne correspond à ces filtres." : "Aucun engagement sur cette période."} n={engagements.length}>
        {engagements.map((e) => (
          <CarteTendance key={e.id} href={`/partenaire/athletes/${e.athleteId}`} photo={e.photo} prenom={e.prenom} nom={e.nom}
            ligne={[e.sport, e.ecole].filter(Boolean).join(" · ")}
            valeur={<span className="text-[12px] text-[#22C55E]">S&apos;engage</span>}
            detail={[e.engageA, new Date(e.le).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })].filter(Boolean).join(" · ")} />
        ))}
      </Rangee>
    </div>
  );
}

export default function PartnerTendancesPage() {
  return <PageChargee rendre={rendre} />;
}
