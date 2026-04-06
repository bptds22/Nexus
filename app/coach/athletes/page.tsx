"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type RosterAthlete } from "./_data/mockRosterData";
import NxIcon from "@/components/ui/NxIcon";

/* ═══════════════════════════════════════════════════════════════
   Mes Athlètes — Card/list layout matching recruiter search
═══════════════════════════════════════════════════════════════ */

const SPORTS = [
  { value: "", label: "Tous les sports" },
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "soccer", label: "Soccer" },
  { value: "hockey", label: "Hockey" },
  { value: "volleyball", label: "Volleyball" },
  { value: "athlétisme", label: "Athlétisme" },
  { value: "badminton", label: "Badminton" },
  { value: "baseball", label: "Baseball" },
  { value: "cheerleading", label: "Cheerleading" },
  { value: "cross-country", label: "Cross-country" },
  { value: "flag_football", label: "Flag football" },
  { value: "futsal", label: "Futsal" },
  { value: "natation", label: "Natation" },
  { value: "rugby", label: "Rugby" },
  { value: "ultimate_frisbee", label: "Ultimate frisbee" },
  { value: "autre", label: "Autre" },
];

const PROMOTIONS = ["2026", "2027", "2028"];

const sportLabel = (value: string): string => {
  const found = SPORTS.find((s) => s.value === value);
  return found ? found.label : value;
};

/* ── Recruitment status config ─────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = { IDENTIFIE: "Identifié", CONTACTE: "Contacté", EN_DISCUSSION: "En discussion", VISITE_PLANIFIEE: "Visite planifiée", ENGAGE: "Engagé", LETTRE_SIGNEE: "Lettre signée" };

/* ── Recruitment status pill classes ────────────────────────── */
function recruitmentPillClass(status: string): string {
  switch (status) {
    case "LETTRE_SIGNEE": case "Lettre signée": return "bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30";
    case "ENGAGE": case "Engagé": return "bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30";
    case "VISITE_PLANIFIEE": case "Visite planifiée": return "bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30";
    case "EN_DISCUSSION": case "En discussion": return "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30";
    case "CONTACTE": case "Contacté": return "bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/30";
    default: return "bg-[#9CA3AF]/15 text-[#9CA3AF] border border-[#9CA3AF]/30";
  }
}

function recruitmentPillLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

/* ── Coach Athlete Card (grid view) ─────────────────────────── */
function CoachAthleteCard({ a }: { a: RosterAthlete }) {
  const recruitStatus = a.recruitment?.label || a.recruitment?.status || null;
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 ease-out group flex flex-col">
      {/* Photo area */}
      <div className="relative h-[180px] bg-[#2F3440] overflow-hidden">
        {a.photo ? (
          <img src={a.photo} alt={`${a.firstName} ${a.lastName}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[48px] font-head font-black text-white/5 tracking-wide">
              {a.firstName[0]}{a.lastName[0]}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ background: "linear-gradient(to top, rgba(26,29,36,0.95), transparent)" }} />

        {/* Top left — verified check + favorites */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 24 24" fill={a.isVerified ? "#3B82F6" : "#4a4d56"} stroke="none">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" stroke={a.isVerified ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          {a.favorites > 0 && (
            <div className="flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#E63946" stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              <span className="text-[12px] font-bold text-white">{a.favorites}</span>
            </div>
          )}
        </div>

        {/* Top right — star rating */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 bg-black/70 backdrop-blur-md rounded-full px-2.5 py-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : "#4a4d56"} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1 gap-1">
        {/* Name + position + recruitment status */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/coach/athletes/${a.id}`} className="text-[17px] font-bold text-white hover:text-[#E63946] transition-colors">
            {a.firstName} {a.lastName}
          </Link>
          {a.position && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[12px] font-bold uppercase tracking-wider">
              {a.position}
            </span>
          )}
          {recruitStatus && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${recruitmentPillClass(recruitStatus)}`}>
              {recruitmentPillLabel(recruitStatus)}
            </span>
          )}
        </div>

        {/* School */}
        {a.school && <p className="text-[14px] text-[#c0c4cc]">{a.school}</p>}

        {/* Promotion · Height/Weight */}
        <p className="text-[13px] text-[#9CA3AF]">
          Promotion {a.gradYear}
          {a.heightWeight && <><span className="mx-1 text-[#4a4d56]">·</span> {a.heightWeight}</>}
        </p>

        {/* Badges */}
        {a.badges && a.badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1.5 min-h-[28px]">
            {a.badges.slice(0, 2).map((b) => (
              <span key={b.badgeId} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[13px] font-bold text-[#E63946]">
                <NxIcon name={b.icon} size={14} className="text-[#E63946]" /> {b.label}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-[#2D3748]/60">
          <span className="text-[12px] text-[#6b7280]">{a.region}</span>
          <div className="flex items-center gap-3">
            <Link href={`/coach/athletes/${a.id}/modifier`} className="text-[13px] font-semibold text-[#E63946] hover:text-[#D42B22] transition-colors flex items-center gap-1">
              Modifier
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </Link>
            <Link href={`/coach/athletes/${a.id}`} className="text-[13px] font-semibold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1">
              Voir
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Coach Athlete Row (list view) ──────────────────────────── */
function CoachAthleteRow({ a }: { a: RosterAthlete }) {
  const recruitStatus = a.recruitment?.label || a.recruitment?.status || null;
  return (
    <div className="bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] transition-all duration-300 ease-out flex items-center px-4 py-3 gap-4">

      {/* Avatar + verified badge */}
      <div className="relative w-12 h-12 rounded-full bg-[#2F3440] shrink-0" style={{ overflow: "visible" }}>
        <div className="w-full h-full rounded-full overflow-hidden">
          {a.photo ? (
            <img src={a.photo} alt={`${a.firstName} ${a.lastName}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[14px] font-head font-black text-white/10">{a.firstName[0]}{a.lastName[0]}</span>
            </div>
          )}
        </div>
        <div className="absolute -top-1 -right-1 z-10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill={a.isVerified ? "#3B82F6" : "#4a4d56"} stroke="none">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" stroke={a.isVerified ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
      </div>

      {/* Name + school + stars */}
      <div className="min-w-[180px] max-w-[220px]">
        <Link href={`/coach/athletes/${a.id}`} className="text-[15px] font-bold text-white hover:text-[#E63946] transition-colors truncate block">
          {a.firstName} {a.lastName}
        </Link>
        {a.school && <p className="text-[13px] text-[#9CA3AF] truncate">{a.school}</p>}
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ))}
            <span className="text-[11px] font-bold text-[#F59E0B] ml-0.5">{a.stars.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Sport + Position pills + recruitment status */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E63946] text-white text-[11px] font-bold uppercase tracking-wider">
          {a.sport ? sportLabel(a.sport) : sportLabel(a.teamId)}
        </span>
        {a.position && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">
            {a.position}
          </span>
        )}
        {recruitStatus && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${recruitmentPillClass(recruitStatus)}`}>
            {recruitmentPillLabel(recruitStatus)}
          </span>
        )}
      </div>

      {/* Region */}
      <span className="text-[13px] text-[#9CA3AF] min-w-[140px] shrink-0">
        {a.region || "—"}
        {a.heightWeight && <span className="block text-[11px] text-[#6b7280] mt-0.5">{a.heightWeight}</span>}
      </span>

      {/* Promotion */}
      <span className="text-[13px] text-[#9CA3AF] shrink-0 w-[50px]">{a.gradYear || "—"}</span>

      {/* Badges */}
      <div className="flex gap-1.5 flex-1 min-w-0">
        {a.badges?.slice(0, 2).map((b) => (
          <span key={b.badgeId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[11px] font-bold text-[#E63946] whitespace-nowrap">
            <NxIcon name={b.icon} size={12} className="text-[#E63946]" /> {b.label}
          </span>
        ))}
      </div>

      {/* Favorites count (read-only) */}
      {a.favorites > 0 && (
        <div className="w-8 h-8 rounded-full bg-[#13151a] border border-[#2D3748] flex items-center justify-center shrink-0" title={`${a.favorites} favori${a.favorites > 1 ? "s" : ""} recruteur`}>
          <div className="flex items-center gap-0.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#E63946" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <span className="text-[10px] font-bold text-[#E63946]">{a.favorites}</span>
          </div>
        </div>
      )}

      {/* Action links */}
      <Link href={`/coach/athletes/${a.id}/modifier`} className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors flex items-center gap-1 shrink-0">
        Modifier
      </Link>
      <Link href={`/coach/athletes/${a.id}`} className="text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1 shrink-0">
        Voir
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function MesAthletesPage() {
  return (
    <Suspense>
      <MesAthletesContent />
    </Suspense>
  );
}

function MesAthletesContent() {
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filtre");

  const [realAthletes, setRealAthletes] = useState<RosterAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("");
  const [position, setPosition] = useState("");
  const [region, setRegion] = useState("");
  const [promotion, setPromotion] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(urlFilter === "non_verifies" || urlFilter === "incomplets" ? false : false);
  const [withVideoOnly, setWithVideoOnly] = useState(false);
  const [minRating, setMinRating] = useState("");
  const [withSportBadge, setWithSportBadge] = useState(false);
  const [withAcademicBadge, setWithAcademicBadge] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [regions, setRegions] = useState<string[]>([]);
  const [dynamicPositions, setDynamicPositions] = useState<{ abbr: string; label: string }[]>([]);

  // Apply URL filter presets
  useEffect(() => {
    if (urlFilter === "non_verifies" || urlFilter === "incomplets") {
      setVerifiedOnly(false);
    }
  }, [urlFilter]);

  useEffect(() => {
    const supabase = createClient();

    const loadAthletes = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("athletes")
        .select(`
          id,
          photo_url,
          first_name,
          last_name,
          verified,
          profile_completion,
          verification_method,
          verified_at,
          verified_by,
          video_faits_saillants_url,
          annee_diplomation,
          cote_globale_entraineur,
          taille_pieds,
          taille_pouces,
          poids_lbs,
          numero_jersey,
          status,
          statut_recrutement_override,
          recrutement_override_at,
          sport_id,
          position_id,
          mentions_academiques,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          schools!school_id(name, region),
          evaluations(cote_globale, distinctions)
        `)
        .eq("coach_id", session.user.id)
        .eq("status", "ACTIF");

      console.log("Roster query result:", JSON.stringify(data), "error:", error, "uid:", session.user.id);

      if (!data) { setLoading(false); return; }

      // Load favorite counts from recruiter_favorites
      const athleteIds = data.map((a: Record<string, unknown>) => a.id as string);
      const { data: favRows } = await supabase
        .from("recruiter_favorites")
        .select("athlete_id")
        .in("athlete_id", athleteIds);

      // Build favorite counts per athlete
      const favCounts: Record<string, number> = {};
      if (favRows && Array.isArray(favRows)) {
        favRows.forEach((row: { athlete_id: string }) => {
          favCounts[row.athlete_id] = (favCounts[row.athlete_id] || 0) + 1;
        });
      }

      // Badge map for distinctions
      const badgeMap: Record<string, { label: string; icon: string }> = {
        captain: { label: "Capitaine", icon: "shield" },
        allstar: { label: "Équipe d'étoiles", icon: "star" },
        team_leader: { label: "Leader", icon: "award" },
      };

      const mapped: RosterAthlete[] = data.map((a: Record<string, unknown>) => {
        // Handle FK joins — may be object or array
        const posRaw = a.positions;
        const pos = Array.isArray(posRaw) ? posRaw[0] : posRaw;
        const posObj = pos as { nom?: string; abreviation?: string } | null;

        const sportRaw = a.sports;
        const sportJoin = Array.isArray(sportRaw) ? sportRaw[0] : sportRaw;
        const sportObj = sportJoin as { nom?: string } | null;

        const schoolRaw = a.schools;
        const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;
        const schoolObj = school as { name?: string; region?: string } | null;

        const evalsRaw = a.evaluations;
        const evals = Array.isArray(evalsRaw) ? evalsRaw : [];
        const eval0 = evals[0] as { cote_globale?: number; distinctions?: string[] } | undefined;
        const stars = eval0?.cote_globale || (a.cote_globale_entraineur as number) || 0;
        const distinctions: string[] = eval0?.distinctions || [];

        const position = posObj?.abreviation || posObj?.nom || "";
        const gradYear = (a.annee_diplomation as number) || 0;
        const profilePct = (a.profile_completion as number) || 0;
        const isVerified = !!(a.verified);
        const sportName = (sportObj?.nom || "").toLowerCase().replace(/ /g, "_");

        const athlete: RosterAthlete = {
          id: a.id as string,
          photo: (a.photo_url as string) || "",
          firstName: (a.first_name as string) || "",
          lastName: (a.last_name as string) || "",
          position,
          gradYear,
          teamId: sportObj?.nom || "real",
          profilePercent: profilePct,
          isVerified,
          verification: {
            isVerified,
            method: (a.verification_method as "auto" | "manual_coach" | "manual_director") || null,
            verifiedAt: (a.verified_at as string) || null,
            verifiedBy: (a.verified_by as string) || null,
            verifiedByName: null,
            profilePercentAtVerification: profilePct || null,
            autoEligible: profilePct >= 60,
            manualOverrideActive: false,
          },
          views: 0,
          favorites: favCounts[a.id as string] || 0,
          stars: Math.round(stars),
          heightWeight: (() => {
            const ft = a.taille_pieds as number | null;
            const inches = a.taille_pouces as number | null;
            const lbs = a.poids_lbs as number | null;
            const parts: string[] = [];
            if (ft) parts.push(`${ft}'${inches || 0}"`);
            if (lbs) parts.push(`${lbs} lbs`);
            return parts.join(" · ");
          })(),
          commitmentStatus: "aucun" as const,
          badgeIcons: [],
          recruitment: (a.statut_recrutement_override as string) ? {
            status: a.statut_recrutement_override as string,
            label: a.statut_recrutement_override as string,
            count: favCounts[a.id as string] || 0,
            isOverride: true,
          } : undefined,
          school: schoolObj?.name || "",
          region: schoolObj?.region || "",
          sport: sportName,
          hasVideo: !!a.video_faits_saillants_url,
          badges: distinctions
            .filter((d) => d != null && badgeMap[d])
            .map((d) => ({ badgeId: d, label: badgeMap[d].label, icon: badgeMap[d].icon })),
          academicBadges: (a.mentions_academiques as string[]) || [],
        };

        return athlete;
      });

      setRealAthletes(mapped);

      // Derive unique regions
      const uniqueRegions = Array.from(new Set(mapped.map((a) => a.region).filter(Boolean))).sort() as string[];
      setRegions(uniqueRegions);

      setLoading(false);
    };

    loadAthletes();
  }, []);

  // Load positions dynamically when sport changes
  useEffect(() => {
    if (!sport) { setDynamicPositions([]); setPosition(""); return; }

    const loadPositions = async () => {
      const supabase = createClient();
      const { data: sportRow } = await supabase
        .from("sports")
        .select("id")
        .ilike("nom", sport.replace(/_/g, " "))
        .single();
      if (!sportRow) return;

      const { data: posRows } = await supabase
        .from("positions")
        .select("nom, abreviation")
        .eq("sport_id", sportRow.id)
        .order("nom");

      if (posRows) {
        setDynamicPositions(posRows.map((p: { nom: string; abreviation: string }) => ({
          abbr: p.abreviation,
          label: p.nom,
        })));
      }
    };
    loadPositions();
  }, [sport]);

  const filtered = useMemo(() => {
    let list = [...realAthletes];

    // URL preset filter
    if (urlFilter === "non_verifies" || urlFilter === "incomplets") {
      list = list.filter((a) => !a.isVerified);
    } else if (urlFilter === "favoris") {
      list = list.filter((a) => a.favorites > 0);
    }

    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.firstName.toLowerCase().includes(q) ||
          a.lastName.toLowerCase().includes(q) ||
          `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
          a.position.toLowerCase().includes(q)
      );
    }
    if (sport) list = list.filter((a) => a.sport === sport);
    if (position) list = list.filter((a) => a.position === position);
    if (region) list = list.filter((a) => a.region === region);
    if (promotion) list = list.filter((a) => a.gradYear === parseInt(promotion));
    if (verifiedOnly) list = list.filter((a) => a.isVerified);
    if (withVideoOnly) list = list.filter((a) => a.hasVideo);
    if (minRating) list = list.filter((a) => a.stars >= parseFloat(minRating));
    if (withSportBadge) list = list.filter((a) => a.badges && a.badges.length > 0);
    if (withAcademicBadge) list = list.filter((a) => a.academicBadges && a.academicBadges.length > 0);

    return list;
  }, [realAthletes, search, sport, position, region, promotion, verifiedOnly, withVideoOnly, minRating, withSportBadge, withAcademicBadge, urlFilter]);

  const hasFilters = sport || position || region || promotion || verifiedOnly || withVideoOnly || minRating || withSportBadge || withAcademicBadge;

  const resetFilters = () => {
    setSport(""); setPosition(""); setRegion(""); setPromotion(""); setVerifiedOnly(false); setWithVideoOnly(false); setMinRating(""); setWithSportBadge(false); setWithAcademicBadge(false);
  };

  // Loading state
  if (loading) return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto flex items-center justify-center">
      <p className="text-[#6B7280] text-sm py-20">Chargement du roster...</p>
    </div>
  );

  // Empty roster
  if (!loading && realAthletes.length === 0) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4V7" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" />
            </svg>
          </div>
          <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Aucun athlète</h3>
          <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed mb-6">
            Votre roster est vide. Commencez par ajouter votre premier athlète.
          </p>
          <Link
            href="/coach/athletes/create"
            className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-5 py-3 font-head font-bold text-[13px] uppercase tracking-widest
              transition-all duration-150 hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            Ajouter un athlète
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Mes Athlètes
          </h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">
            Roster — Saison 2025-2026
          </p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <span className="text-[13px] font-bold text-[#6b7280]">{filtered.length} athlète{filtered.length !== 1 ? "s" : ""}</span>

          {/* View toggle */}
          <div className="flex items-center bg-[#13151a] border border-[#2a2d36] rounded-lg overflow-hidden">
            <button
              type="button"
              title="Vue grille"
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              type="button"
              title="Vue liste"
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
              </svg>
            </button>
          </div>

          <Link
            href="/coach/athletes/create"
            className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-5 py-3 font-head font-bold text-[13px] uppercase tracking-widest
              transition-all duration-150 hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_0_16px_rgba(230,57,70,0.35)] active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            Ajouter un athlète
          </Link>
        </div>
      </div>

      {/* ── Search bar ──────────────────────────────────────────── */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher par nom ou position..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
        />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select title="Filtrer par sport" value={sport} onChange={(e) => { setSport(e.target.value); setPosition(""); }} className={`nx-filter-select${sport ? " nx-filter-active" : ""}`}>
          {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select title="Filtrer par position" value={position} onChange={(e) => setPosition(e.target.value)} className={`nx-filter-select${position ? " nx-filter-active" : ""}`} disabled={!sport}>
          <option value="">{sport ? "Toutes les positions" : "Sélectionner un sport d\u0027abord"}</option>
          {dynamicPositions.map((p) => <option key={p.abbr} value={p.abbr}>{p.abbr} — {p.label}</option>)}
        </select>

        <select title="Filtrer par région" value={region} onChange={(e) => setRegion(e.target.value)} className={`nx-filter-select${region ? " nx-filter-active" : ""}`}>
          <option value="">Toutes les régions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <select title="Filtrer par promotion" value={promotion} onChange={(e) => setPromotion(e.target.value)} className={`nx-filter-select${promotion ? " nx-filter-active" : ""}`}>
          <option value="">Toutes les promotions</option>
          {PROMOTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select title="Filtrer par cote" value={minRating} onChange={(e) => setMinRating(e.target.value)} className={`nx-filter-select${minRating ? " nx-filter-active" : ""}`}>
          <option value="">Toutes les cotes</option>
          <option value="1">&#9733; 1+</option>
          <option value="2">&#9733;&#9733; 2+</option>
          <option value="3">&#9733;&#9733;&#9733; 3+</option>
          <option value="4">&#9733;&#9733;&#9733;&#9733; 4+</option>
          <option value="5">&#9733;&#9733;&#9733;&#9733;&#9733; 5</option>
        </select>

        {/* Divider */}
        <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

        {/* Toggle checkboxes */}
        <label className="flex items-center gap-2 cursor-pointer group">
          <input type="checkbox" checked={withSportBadge} onChange={(e) => setWithSportBadge(e.target.checked)} className="sr-only" />
          <div className={`nx-filter-checkbox${withSportBadge ? " checked" : ""}`}>
            {withSportBadge && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            )}
          </div>
          <span className={`text-[13px] font-semibold transition-colors ${withSportBadge ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Avec distinction sportive</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer group">
          <input type="checkbox" checked={withAcademicBadge} onChange={(e) => setWithAcademicBadge(e.target.checked)} className="sr-only" />
          <div className={`nx-filter-checkbox${withAcademicBadge ? " checked" : ""}`}>
            {withAcademicBadge && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            )}
          </div>
          <span className={`text-[13px] font-semibold transition-colors ${withAcademicBadge ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Mention académique</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer group">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="sr-only" />
          <div className={`nx-filter-checkbox${verifiedOnly ? " checked" : ""}`}>
            {verifiedOnly && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            )}
          </div>
          <span className={`text-[13px] font-semibold transition-colors ${verifiedOnly ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Vérifié seulement</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer group">
          <input type="checkbox" checked={withVideoOnly} onChange={(e) => setWithVideoOnly(e.target.checked)} className="sr-only" />
          <div className={`nx-filter-checkbox${withVideoOnly ? " checked" : ""}`}>
            {withVideoOnly && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            )}
          </div>
          <span className={`text-[13px] font-semibold transition-colors ${withVideoOnly ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Avec vidéo</span>
        </label>

        {hasFilters && (
          <button type="button" onClick={resetFilters} className="nx-filter-reset flex items-center gap-1.5 text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors ml-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Results ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Aucun athlète trouvé</h3>
          <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed">
            Essayez de modifier vos filtres ou votre recherche.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((a) => (
            <CoachAthleteCard key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((a) => (
            <CoachAthleteRow key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
