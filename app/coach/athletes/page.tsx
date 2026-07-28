"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type RosterAthlete } from "./_data/mockRosterData";
import ReclamerSection from "./_components/ReclamerSection";
import NxIcon from "@/components/ui/NxIcon";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import { parseDistinctions } from "@/lib/config/badges";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { calculateCompletion, type AthleteLike, type EvalLike } from "@/lib/utils/profileCompletion";
import { isValidationExpired } from "@/lib/utils/profileValidation";
import { getCurrentSeason } from "@/lib/utils/season";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import CoachAthleteRow from "@/components/coach/CoachAthleteRow";
import { CoachAthletesMobile } from "@/components/shared/CoachAthletesMobile";
import InviteByEmailModal from "./_components/InviteByEmailModal";
import { loadSchoolDirectorStatus } from "@/lib/queries/coach/useSchoolDirector";
import { AthleteSectionHeader } from "@/components/shared/coach/AthleteSectionHeader";

import { TEAM_GENDER_FILTER_OPTIONS, firstTeamGender } from "@/lib/config/gender";
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

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

/* ── Recruitment status config ─────────────────────────────────── */


/* ── Coach Athlete Card (grid view) ─────────────────────────── */
function CoachAthleteCard({ a }: { a: RosterAthlete }) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 ease-out group flex flex-col">
      {/* Photo area */}
      <Link href={`/coach/athletes/${a.id}`} className="relative block h-[180px] bg-[#2F3440] overflow-hidden cursor-pointer">
        <AthletePhotoFill
          photoUrl={a.photo}
          firstName={a.firstName}
          lastName={a.lastName}
          initialsFontSize={72}
          className="object-[center_15%]"
        />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: "linear-gradient(to top, rgba(26,29,36,0.95), transparent)" }} />

        {/* Top left — verified check + favorites */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          {(() => {
            const active = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null });
            return (
              <svg width="28" height="28" viewBox="0 0 24 24" fill={active ? "#3B82F6" : "#4a4d56"} stroke="none" aria-label={active ? "Profil vérifié" : a.isVerified ? "Badge désactivé" : "Profil non vérifié"}>
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" stroke={active ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            );
          })()}
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
      </Link>

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
          <RecruitmentStatusBadge
            status={(a.recruitmentStatus || "OUVERT") as GlobalRecruitmentStatus}
            committedSchoolName={a.committedSchoolName || undefined}
            openToOffers={a.openToOffers}
            size="sm"
          />
        </div>

        {/* Height/Weight */}
        {a.heightWeight && (
          <p className="text-[13px] text-[#9CA3AF] mt-0.5">{a.heightWeight}</p>
        )}

        {/* Attribution — note évaluée par un autre coach (ex. directeur) */}
        {a.evaluatedByName && (
          <p className="text-[11px] text-[#6b7280] mt-0.5">Évalué par <span className="font-semibold text-[#9CA3AF]">{a.evaluatedByName}</span></p>
        )}

        {/* Footer — school · year left, actions right */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-[#2D3748]/60">
          <span className="text-[12px] text-[#6b7280] truncate">{a.school} <span className="text-[#4a4d56]">·</span> {a.gradYear}</span>
          <div className="flex items-center gap-3 shrink-0">
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
  // Iter coach-athletes-mobile : Capacitor → composant mobile-native
  // (Roster + À réclamer). Web (non-Capacitor) garde son layout existant.
  if (IS_CAPACITOR) return <CoachAthletesMobile />;

  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filtre");

  const [realAthletes, setRealAthletes] = useState<RosterAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [position, setPosition] = useState("");
  const [region, setRegion] = useState("");
  const [promotion, setPromotion] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(urlFilter === "non_verifies" || urlFilter === "incomplets" ? false : false);
  const [withVideoOnly, setWithVideoOnly] = useState(false);
  const [minRating, setMinRating] = useState("");
  const [withSportBadge, setWithSportBadge] = useState(false);
  const [withAcademicBadge, setWithAcademicBadge] = useState(false);
  const [sortBy, setSortBy] = useState("rating_desc");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minGpa, setMinGpa] = useState("");
  const [orgType, setOrgType] = useState("");
  const [filterOuvertDemenager, setFilterOuvertDemenager] = useState(false);
  const [filterOuvertPrive, setFilterOuvertPrive] = useState(false);
  const [filterOuvertAnglophone, setFilterOuvertAnglophone] = useState(false);
  const [filterNewOnly, setFilterNewOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"roster" | "reclamer" | "traiter">("roster");
  const [unverifiedAthletes, setUnverifiedAthletes] = useState<{ id: string; firstName: string; lastName: string; sport: string; position: string; gradYear: number; createdAt: string }[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<{ id: string; athleteName: string; champ: string; valeurActuelle: string; valeurProposee: string; message: string; createdAt: string }[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [dynamicPositions, setDynamicPositions] = useState<{ abbr: string; label: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isDirector, setIsDirector] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

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

      setCurrentUserId(session.user.id);

      // Director oversight (school_coaches.role ∈ DIRECTEUR) unlocks the
      // second "Athlètes de l'école" section — mirror of the teams page.
      const dir = await loadSchoolDirectorStatus(supabase, session.user.id);
      setIsDirector(dir.isDirector);

      // Look up the coach's school_id — needed for the À réclamer
      // tab which shows unclaimed athletes at the school. The
      // Roster tab and À traiter tab filter down to coach_id =
      // me in memory.
      const { data: coachRow, error: coachError } = await supabase
        .from("users")
        .select("school_id")
        .eq("id", session.user.id)
        .single();

      if (coachError || !coachRow?.school_id) {
        console.error("[Coach roster] Coach has no school_id assigned", coachError);
        setLoading(false);
        return;
      }

      const coachSchoolId = coachRow.school_id;

      const { data, error } = await supabase
        .from("athletes")
        .select(`
          id,
          photo_url,
          first_name,
          last_name,
          verified,
          profile_completion,
          last_profile_validation,
          verification_method,
          verified_at,
          verified_by,
          video_faits_saillants_url,
          hudl_url,
          youtube_url,
          instagram_url,
          annee_diplomation,
          cote_globale_entraineur,
          date_naissance,
          genre,
          telephone,
          bio,
          school_id,
          coach_id,
          taille_pieds,
          taille_pouces,
          poids_lbs,
          numero_jersey,
          status,
          statut_recrutement_override,
          recrutement_override_at,
          recruitment_status, committed_school_id, open_to_offers,
          sport_id,
          position_id,
          mentions_academiques,
          matieres_fortes,
          programme_cegep_vise,
          moyenne_generale,
          pret_changer_region,
          ouvert_cegep_prive,
          ouvert_cegep_anglophone,
          created_at,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          schools!school_id(name, region),
          committed_school:schools!committed_school_id(name),
          team_athletes(team_id, teams!team_id(gender)),
          evaluations(cote_globale, rapport_entraineur, distinctions, updated_at, coach_id,
            evaluator:users!evaluations_coach_id_fkey(first_name, last_name))
        `)
        .eq("school_id", coachSchoolId)
        .eq("status", "ACTIF");


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

        const committedSchoolRaw = a.committed_school;
        const committedSchool = (Array.isArray(committedSchoolRaw) ? committedSchoolRaw[0] : committedSchoolRaw) as { name?: string } | null;

        const evalsRaw = a.evaluations;
        const evals = Array.isArray(evalsRaw) ? evalsRaw : [];
        const eval0 = selectBestEvaluation(evals) as { cote_globale?: number; distinctions?: unknown; coach_id?: string; evaluator?: unknown } | undefined;
        // Note = LA PLUS RÉCENTE. cote_globale_entraineur (colonne last-write,
        // maintenue par le trigger, toujours lisible) d'abord ; eval0 en repli.
        // Sans ça, la RLL evaluations ne renvoyant au coach que SA ligne, il
        // voyait sa vieille note au lieu de la dernière (ex. celle du directeur).
        const stars = (a.cote_globale_entraineur as number) || eval0?.cote_globale || 0;
        const distinctions = parseDistinctions(eval0?.distinctions);
        // Attribution : auteur de l'éval choisie (join users). Affichée sur la
        // carte quand la note vient d'un autre évaluateur que le coach connecté.
        const evalCoachId = (eval0?.coach_id as string | null) ?? null;
        const evaluatedByName = (() => {
          const ev = eval0?.evaluator as { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }> | null | undefined;
          const evObj = Array.isArray(ev) ? ev[0] : ev;
          const name = evObj ? `${evObj.first_name || ""} ${evObj.last_name || ""}`.trim() : "";
          return name && evalCoachId && evalCoachId !== session.user.id ? name : "";
        })();

        const position = posObj?.abreviation || posObj?.nom || "";
        const gradYear = (a.annee_diplomation as number) || 0;
        const profilePct = calculateCompletion(a as AthleteLike, (eval0 as EvalLike) || null, null).percentage;
        const isVerified = !!(a.verified);
        const lastValidation = (a.last_profile_validation as string) || null;
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
          lastValidation,
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
          badges: distinctions,
          academicBadges: (a.mentions_academiques as string[]) || [],
          recruitmentStatus: (a.recruitment_status as string) || "OUVERT",
          committedSchoolName: committedSchool?.name || "",
          openToOffers: (a.open_to_offers as boolean | null) ?? null,
          gpa: (a.moyenne_generale as number) || 0,
          ouvertDemenager: a.pret_changer_region === true,
          ouvertPrive: a.ouvert_cegep_prive === true,
          ouvertAnglophone: a.ouvert_cegep_anglophone === true,
          createdAt: (a.created_at as string) || "",
          // Genre de l'ÉQUIPE (teams.gender via team_athletes), PAS athletes.genre.
          // null quand l'athlète n'a aucune équipe → exclu si un genre est filtré.
          teamGender: firstTeamGender(a.team_athletes),
          coach_id: (a.coach_id as string | null) ?? null,
          evaluatedByName,
        };

        return athlete;
      });

      setRealAthletes(mapped);

      // Derive unique regions
      const uniqueRegions = Array.from(new Set(mapped.map((a) => a.region).filter(Boolean))).sort() as string[];
      setRegions(uniqueRegions);

      // Load "À traiter" data
      // Unverified athletes — only this coach's claimed athletes
      const unverified = mapped.filter((a) => !a.isVerified && a.coach_id === session.user.id);
      setUnverifiedAthletes(unverified.map((a) => ({
        id: a.id, firstName: a.firstName, lastName: a.lastName,
        sport: a.sport || "", position: a.position || "",
        gradYear: a.gradYear, createdAt: "",
      })));

      // Pending suggestions — only for MY claimed athletes
      const myAthleteIds = mapped
        .filter((a) => a.coach_id === session.user.id)
        .map((a) => a.id);
      if (myAthleteIds.length > 0) {
        const { data: sugs } = await supabase
          .from("athlete_suggestions")
          .select("id, champ, valeur_actuelle, valeur_proposee, message, created_at, athlete_id, athletes!athlete_id(first_name, last_name)")
          .in("athlete_id", myAthleteIds)
          .eq("status", "EN_ATTENTE")
          .order("created_at", { ascending: false });
        if (sugs) {
          setPendingSuggestions(sugs.map((s) => {
            const ath = (Array.isArray(s.athletes) ? s.athletes[0] : s.athletes) as { first_name?: string; last_name?: string } | null;
            return {
              id: s.id,
              athleteName: ath ? `${ath.first_name || ""} ${ath.last_name || ""}`.trim() : "",
              champ: s.champ || "",
              valeurActuelle: (s.valeur_actuelle as string) || "",
              valeurProposee: (s.valeur_proposee as string) || "",
              message: (s.message as string) || "",
              createdAt: s.created_at || "",
            };
          }));
        }
      }

      setLoading(false);
    };

    loadAthletes();
  }, [refreshVersion]);

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

  const myRoster = useMemo(
    () => realAthletes.filter((a) => a.coach_id === currentUserId),
    [realAthletes, currentUserId]
  );

  const unclaimedAthletes = useMemo(
    () => realAthletes.filter((a) => a.coach_id == null),
    [realAthletes]
  );

  // Director oversight: school athletes owned by OTHER coaches. Unclaimed
  // (coach_id == null) stay in the "À réclamer" tab — not double-listed here.
  const schoolAthletes = useMemo(
    () => realAthletes.filter((a) => a.coach_id !== currentUserId && a.coach_id != null),
    [realAthletes, currentUserId]
  );

  // Shared search/filter/sort pipeline — applied to BOTH the director's
  // "Mes athlètes" and "Athlètes de l'école" sections (single source).
  const filterAndSort = useCallback((source: RosterAthlete[]) => {
    let list = [...source];

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
    // Genre d'ÉQUIPE (teams.gender), PAS athletes.genre. Sans équipe => exclu.
    if (genderFilter) list = list.filter((a) => a.teamGender === genderFilter);
    if (region) list = list.filter((a) => a.region === region);
    if (promotion) list = list.filter((a) => a.gradYear === parseInt(promotion));
    if (verifiedOnly) list = list.filter((a) => a.isVerified);
    if (withVideoOnly) list = list.filter((a) => a.hasVideo);
    if (minRating) list = list.filter((a) => a.stars >= parseFloat(minRating));
    if (withSportBadge) list = list.filter((a) => a.badges && a.badges.length > 0);
    if (withAcademicBadge) list = list.filter((a) => a.academicBadges && a.academicBadges.length > 0);
    if (minGpa) list = list.filter((a) => (a.gpa || 0) >= parseFloat(minGpa));
    if (filterOuvertDemenager) list = list.filter((a) => a.ouvertDemenager);
    if (filterOuvertPrive) list = list.filter((a) => a.ouvertPrive);
    if (filterOuvertAnglophone) list = list.filter((a) => a.ouvertAnglophone);
    if (filterNewOnly) {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      list = list.filter((a) => (a.createdAt || "") >= tenDaysAgo);
    }

    // Sort
    switch (sortBy) {
      case "rating_desc": list.sort((a, b) => b.stars - a.stars); break;
      case "rating_asc": list.sort((a, b) => a.stars - b.stars); break;
      case "favorites_desc": list.sort((a, b) => b.favorites - a.favorites); break;
      case "grad_asc": list.sort((a, b) => a.gradYear - b.gradYear); break;
      case "grad_desc": list.sort((a, b) => b.gradYear - a.gradYear); break;
      case "name_asc": list.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)); break;
    }

    return list;
  }, [search, sport, genderFilter, position, region, promotion, verifiedOnly, withVideoOnly, minRating, withSportBadge, withAcademicBadge, minGpa, filterOuvertDemenager, filterOuvertPrive, filterOuvertAnglophone, filterNewOnly, sortBy, urlFilter]);

  const filtered = useMemo(() => filterAndSort(myRoster), [filterAndSort, myRoster]);
  const filteredSchool = useMemo(() => filterAndSort(schoolAthletes), [filterAndSort, schoolAthletes]);

  const hasFilters = sport || position || region || promotion || verifiedOnly || withVideoOnly || minRating || withSportBadge || withAcademicBadge || minGpa || filterOuvertDemenager || filterOuvertPrive || filterOuvertAnglophone || filterNewOnly || sortBy !== "rating_desc";

  const resetFilters = () => {
    setSport(""); setGenderFilter(""); setPosition(""); setRegion(""); setPromotion(""); setVerifiedOnly(false); setWithVideoOnly(false); setMinRating(""); setWithSportBadge(false); setWithAcademicBadge(false); setMinGpa(""); setOrgType(""); setFilterOuvertDemenager(false); setFilterOuvertPrive(false); setFilterOuvertAnglophone(false); setFilterNewOnly(false); setSortBy("rating_desc");
  };

  const totalPending = unverifiedAthletes.length + pendingSuggestions.length;

  async function verifyAthlete(athleteId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("athletes").update({
      verified: true,
      verification_method: "manuel_coach",
      verified_at: nowIso,
      verified_by: user.id,
      last_profile_validation: nowIso,
    }).eq("id", athleteId);
    if (error) { console.error("[Verify]", error); return; }
    setUnverifiedAthletes((prev) => prev.filter((a) => a.id !== athleteId));
    setRealAthletes((prev) => prev.map((a) => a.id === athleteId ? {
      ...a,
      isVerified: true,
      lastValidation: nowIso,
    } : a));
  }

  async function approveSuggestion(suggestionId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("athlete_suggestions").update({ status: "APPROUVEE" }).eq("id", suggestionId);
    if (error) { console.error("[Approve]", error); return; }
    setPendingSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
  }

  async function rejectSuggestion(suggestionId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("athlete_suggestions").update({ status: "REJETEE", raison_rejet: rejectReason || null }).eq("id", suggestionId);
    if (error) { console.error("[Reject]", error); return; }
    setPendingSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    setRejectingId(null);
    setRejectReason("");
  }

  // Shared list renderer — reused by the single (non-director) roster and by
  // both director sections ("Mes athlètes" + "Athlètes de l'école").
  const renderAthletes = (list: RosterAthlete[]) =>
    viewMode === "grid" ? (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {list.map((a) => (
          <CoachAthleteCard key={a.id} a={a} />
        ))}
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        {list.map((a) => (
          <CoachAthleteRow
            key={a.id}
            athleteId={a.id}
            firstName={a.firstName}
            lastName={a.lastName}
            photoUrl={a.photo}
            isVerified={a.isVerified}
            lastValidation={a.lastValidation ?? null}
            school={a.school}
            position={a.position}
            recruitmentStatus={(a.recruitmentStatus || null) as GlobalRecruitmentStatus | null}
            committedSchoolName={a.committedSchoolName}
            openToOffers={a.openToOffers}
            region={a.region}
            heightWeight={a.heightWeight}
            gradYear={a.gradYear}
            stars={a.stars}
          >
            <div className="flex-1 min-w-0" />
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-[30px] shrink-0">
                {a.favorites > 0 ? (
                  <div className="flex items-center gap-0.5" title={`${a.favorites} favori${a.favorites > 1 ? "s" : ""}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#E63946" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                    <span className="text-[10px] font-bold text-[#E63946]">{a.favorites}</span>
                  </div>
                ) : <span />}
              </div>
              <Link href={`/coach/athletes/${a.id}/modifier`} className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors shrink-0">Modifier</Link>
              <Link href={`/coach/athletes/${a.id}`} className="text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1 shrink-0">
                Voir <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </CoachAthleteRow>
        ))}
      </div>
    );

  // Loading state
  if (loading) return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto flex items-center justify-center">
      <p className="text-[#6B7280] text-sm py-20">Chargement du roster...</p>
    </div>
  );

  // Empty roster
  if (!loading && realAthletes.length === 0) {
    return (
      <>
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
          <div className="flex flex-col sm:flex-row items-center gap-3">
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
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 border border-[#2D3748] text-white rounded-lg px-5 py-3 font-head font-bold text-[13px] uppercase tracking-widest
                transition-all duration-150 hover:border-[#E63946] hover:text-[#E63946] active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></svg>
              Inviter par courriel
            </button>
          </div>
        </div>
      </div>
      <InviteByEmailModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      </>
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
            Roster — Saison {getCurrentSeason()}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start">
          {(() => { const n = isDirector ? filtered.length + filteredSchool.length : filtered.length; return (
            <span className="text-[13px] font-bold text-[#6b7280]">{n} athlète{n !== 1 ? "s" : ""}</span>
          ); })()}

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

          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 border border-[#2D3748] text-white rounded-lg px-5 py-3 font-head font-bold text-[13px] uppercase tracking-widest
              transition-all duration-150 hover:border-[#E63946] hover:text-[#E63946] active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></svg>
            Inviter par courriel
          </button>

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

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-[#13151a] rounded-xl p-1.5 w-fit">
        <button type="button" onClick={() => setActiveTab("roster")}
          className={`px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${activeTab === "roster" ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]" : "text-[#6b7280] hover:text-white"}`}>
          Roster
        </button>
        <button type="button" onClick={() => setActiveTab("reclamer")}
          className={`px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all flex items-center gap-2 ${activeTab === "reclamer" ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]" : "text-[#6b7280] hover:text-white"}`}>
          À réclamer
          {unclaimedAthletes.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[11px] font-bold">{unclaimedAthletes.length}</span>
          )}
        </button>
        <button type="button" onClick={() => setActiveTab("traiter")}
          className={`px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all flex items-center gap-2 ${activeTab === "traiter" ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]" : "text-[#6b7280] hover:text-white"}`}>
          À traiter
          {totalPending > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#EAB308] text-[#111317] text-[10px] font-black">{totalPending}</span>
          )}
        </button>
      </div>

      {/* ══════════ À RÉCLAMER TAB ══════════ */}
      {activeTab === "reclamer" && (
        <ReclamerSection
          unclaimedAthletes={unclaimedAthletes}
          currentUserId={currentUserId}
          onClaimSuccess={() => setRefreshVersion((v) => v + 1)}
        />
      )}

      {/* ══════════ À TRAITER TAB ══════════ */}
      {activeTab === "traiter" && (
        <div className="space-y-6">
          {/* Section A: Profils à vérifier */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              Profils à vérifier ({unverifiedAthletes.length})
            </h3>
            {unverifiedAthletes.length === 0 ? (
              <p className="text-[13px] text-[#22C55E] font-bold flex items-center gap-2 py-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                Tous les profils sont vérifiés
              </p>
            ) : (
              <div className="space-y-2">
                {unverifiedAthletes.map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-[#13151a] rounded-lg border border-[#2D3748] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#2F3440] flex items-center justify-center text-[11px] font-bold text-white/30 shrink-0">
                        {a.firstName[0]}{a.lastName[0]}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-white">{a.firstName} {a.lastName}</p>
                        <p className="text-[11px] text-[#6b7280]">{a.sport} · {a.position} · Promotion {a.gradYear}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/coach/athletes/${a.id}`} className="text-[10px] font-bold text-[#9CA3AF] hover:text-white transition-colors uppercase tracking-wider">Voir</Link>
                      <button type="button" onClick={() => verifyAthlete(a.id)} className="px-3 py-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors">Vérifier</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Suggestions en attente */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Suggestions en attente ({pendingSuggestions.length})
            </h3>
            {pendingSuggestions.length === 0 ? (
              <p className="text-[13px] text-[#4a4d56] italic py-4">Aucune suggestion en attente</p>
            ) : (
              <div className="space-y-2">
                {pendingSuggestions.map((s) => {
                  const diffMs = Date.now() - new Date(s.createdAt).getTime();
                  const diffMin = Math.floor(diffMs / 60000);
                  const relTime = diffMin < 60 ? `Il y a ${diffMin} min` : diffMin < 1440 ? `Il y a ${Math.floor(diffMin / 60)}h` : `Il y a ${Math.floor(diffMin / 1440)}j`;

                  return (
                    <div key={s.id} className="bg-[#13151a] rounded-lg border border-[#EAB308]/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px] font-bold text-white">{s.athleteName}</span>
                            <span className="text-[11px] text-[#6b7280]">·</span>
                            <span className="text-[12px] font-bold text-[#EAB308]">{s.champ}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.valeurActuelle && <span className="text-[12px] text-[#6b7280] line-through">{s.valeurActuelle}</span>}
                            <span className="text-[12px] text-[#6b7280]">→</span>
                            <span className="text-[13px] font-bold text-white">{s.valeurProposee}</span>
                          </div>
                          {s.message && <p className="text-[11px] text-[#6b7280] italic mt-1">&ldquo;{s.message}&rdquo;</p>}
                          <p className="text-[10px] text-[#4a4d56] mt-1">{relTime}</p>
                        </div>
                        {rejectingId === s.id ? (
                          <div className="flex flex-col gap-2 shrink-0">
                            <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Raison (optionnel)" className="bg-[#111317] border border-[#2D3748] rounded px-2 py-1 text-[11px] text-white w-40 focus:border-[#E63946] outline-none" />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => rejectSuggestion(s.id)} className="px-3 py-1 bg-[#E63946] text-white text-[10px] font-bold rounded hover:bg-[#D42B22] transition-colors">Confirmer</button>
                              <button type="button" onClick={() => { setRejectingId(null); setRejectReason(""); }} className="text-[10px] text-[#6b7280] hover:text-white transition-colors">Annuler</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => approveSuggestion(s.id)} className="px-3 py-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors">Approuver</button>
                            <button type="button" onClick={() => setRejectingId(s.id)} className="px-3 py-1.5 border border-[#E63946]/30 text-[#E63946] text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#E63946]/10 transition-colors">Rejeter</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ ROSTER TAB ══════════ */}
      {activeTab === "roster" && <>

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

      {/* ── Primary filters — always visible ─────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select title="Sport" value={sport} onChange={(e) => { setSport(e.target.value); setPosition(""); }} className={`nx-filter-select${sport ? " nx-filter-active" : ""}`}>
          {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Genre d'ÉQUIPE (teams.gender) — sport → genre → position. */}
        <select title="Genre d&apos;équipe" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className={`nx-filter-select${genderFilter ? " nx-filter-active" : ""}`}>
          {TEAM_GENDER_FILTER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>

        <select title="Position" value={position} onChange={(e) => setPosition(e.target.value)} className={`nx-filter-select${position ? " nx-filter-active" : ""}`} disabled={!sport}>
          <option value="">{sport ? "Toutes les positions" : "Sélectionner un sport d\u0027abord"}</option>
          {dynamicPositions.map((p) => <option key={p.abbr} value={p.abbr}>{p.abbr} — {p.label}</option>)}
        </select>

        <select title="Promotion" value={promotion} onChange={(e) => setPromotion(e.target.value)} className={`nx-filter-select${promotion ? " nx-filter-active" : ""}`}>
          <option value="">Toutes les promotions</option>
          {PROMOTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

        <select title="Trier" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="nx-filter-select">
          <option value="rating_desc">Trier: Meilleure cote</option>
          <option value="rating_asc">Trier: Cote croissante</option>
          <option value="favorites_desc">Trier: Plus favorisés</option>
          <option value="grad_asc">Trier: Graduation proche</option>
          <option value="grad_desc">Trier: Graduation éloignée</option>
          <option value="name_asc">Trier: Nom A-Z</option>
        </select>

        <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
            showAdvanced ? "bg-[#E63946]/10 text-[#E63946] border border-[#E63946]/30" : "text-[#9CA3AF] hover:text-white border border-[#2D3748]"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          Filtres avancés
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {hasFilters && (
          <button type="button" onClick={resetFilters} className="nx-filter-reset flex items-center gap-1.5 text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors ml-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* Quick preset chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMinRating(minRating === "4" ? "" : "4")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${minRating === "4" ? "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={minRating === "4" ? "#F59E0B" : "#6b7280"} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          4+ étoiles
        </button>
        <button type="button" onClick={() => setVerifiedOnly(!verifiedOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${verifiedOnly ? "bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={verifiedOnly ? "#3B82F6" : "none"} stroke={verifiedOnly ? "#3B82F6" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
          Vérifié
        </button>
        <button type="button" onClick={() => setWithVideoOnly(!withVideoOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${withVideoOnly ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={withVideoOnly ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
          Avec vidéo
        </button>
        <button type="button" onClick={() => setWithSportBadge(!withSportBadge)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${withSportBadge ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={withSportBadge ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" /></svg>
          Avec distinction
        </button>
      </div>

      {/* Advanced filters — collapsible */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-2.5 bg-[#13151a] border border-[#2a2d36] rounded-lg p-3">
          <select title="Région" value={region} onChange={(e) => setRegion(e.target.value)} className={`nx-filter-select${region ? " nx-filter-active" : ""}`}>
            <option value="">Toutes les régions</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          <select title="Cote" value={minRating} onChange={(e) => setMinRating(e.target.value)} className={`nx-filter-select${minRating ? " nx-filter-active" : ""}`}>
            <option value="">Toutes les cotes</option>
            <option value="1">★ 1+</option>
            <option value="2">★★ 2+</option>
            <option value="3">★★★ 3+</option>
            <option value="4">★★★★ 4+</option>
            <option value="5">★★★★★ 5</option>
          </select>

          <select title="Moyenne" value={minGpa} onChange={(e) => setMinGpa(e.target.value)} className={`nx-filter-select${minGpa ? " nx-filter-active" : ""}`}>
            <option value="">Toutes les moyennes</option>
            <option value="60">60%+</option>
            <option value="70">70%+</option>
            <option value="80">80%+</option>
            <option value="85">85%+</option>
            <option value="90">90%+</option>
          </select>

          <div className="w-px h-6 bg-[#2D3748] mx-1" />

          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={withAcademicBadge} onChange={(e) => setWithAcademicBadge(e.target.checked)} className="sr-only" />
            <div className={`nx-filter-checkbox${withAcademicBadge ? " checked" : ""}`}>
              {withAcademicBadge && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
            <span className={`text-[13px] font-semibold transition-colors ${withAcademicBadge ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Mention académique</span>
          </label>

          <div className="w-px h-6 bg-[#2D3748] mx-1" />
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Préférences</span>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={filterOuvertDemenager} onChange={(e) => setFilterOuvertDemenager(e.target.checked)} className="sr-only" />
            <div className={`nx-filter-checkbox${filterOuvertDemenager ? " checked" : ""}`}>
              {filterOuvertDemenager && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
            <span className={`text-[13px] font-semibold transition-colors ${filterOuvertDemenager ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Ouvert à déménager</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={filterOuvertPrive} onChange={(e) => setFilterOuvertPrive(e.target.checked)} className="sr-only" />
            <div className={`nx-filter-checkbox${filterOuvertPrive ? " checked" : ""}`}>
              {filterOuvertPrive && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
            <span className={`text-[13px] font-semibold transition-colors ${filterOuvertPrive ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Ouvert au privé</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={filterOuvertAnglophone} onChange={(e) => setFilterOuvertAnglophone(e.target.checked)} className="sr-only" />
            <div className={`nx-filter-checkbox${filterOuvertAnglophone ? " checked" : ""}`}>
              {filterOuvertAnglophone && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
            <span className={`text-[13px] font-semibold transition-colors ${filterOuvertAnglophone ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Ouvert anglophone</span>
          </label>

          <div className="w-px h-6 bg-[#2D3748] mx-1" />
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Nouveautés</span>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={filterNewOnly} onChange={(e) => setFilterNewOnly(e.target.checked)} className="sr-only" />
            <div className={`nx-filter-checkbox${filterNewOnly ? " checked" : ""}`}>
              {filterNewOnly && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
            <span className={`text-[13px] font-semibold transition-colors ${filterNewOnly ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Nouveaux profils (10 derniers jours)</span>
          </label>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────── */}
      {isDirector ? (
        /* Director oversight — two sections (mirror /coach/equipes). */
        <div className="space-y-6">
          <div className="space-y-4">
            <AthleteSectionHeader title="Mes athlètes" count={filtered.length} />
            {filtered.length === 0 ? (
              <p className="text-[13px] text-[#6b7280] py-2">
                {myRoster.length === 0
                  ? "Tu n'as pas encore d'athlètes dans ton roster."
                  : "Aucun de tes athlètes ne correspond aux filtres."}
              </p>
            ) : renderAthletes(filtered)}
          </div>

          {schoolAthletes.length > 0 && (
            <div className="space-y-4 pt-5 border-t border-[#2D3748]/60">
              <AthleteSectionHeader title="Athlètes de l&apos;école" count={filteredSchool.length} director />
              {filteredSchool.length === 0 ? (
                <p className="text-[13px] text-[#6b7280] py-2">Aucun athlète de l&apos;école ne correspond aux filtres.</p>
              ) : renderAthletes(filteredSchool)}
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          {myRoster.length === 0 && unclaimedAthletes.length > 0 ? (
            <>
              <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Tu n&apos;as pas encore réclamé d&apos;athlètes</h3>
              <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed mb-4">
                Réclame des athlètes parmi ceux disponibles à ton école pour bâtir ton roster.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("reclamer")}
                className="inline-flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-5 py-2.5 font-head font-bold text-[13px] uppercase tracking-widest hover:bg-[#D42B22] transition-colors"
              >
                Voir les athlètes à réclamer ({unclaimedAthletes.length})
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Aucun athlète trouvé</h3>
              <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed">
                Essayez de modifier vos filtres ou votre recherche.
              </p>
            </>
          )}
        </div>
      ) : (
        renderAthletes(filtered)
      )}

      </>}
      <InviteByEmailModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
