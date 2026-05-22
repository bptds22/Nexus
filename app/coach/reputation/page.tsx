// NOTE: This page doubles as the coach's public profile.
// When a recruiter views a coach, they see this same layout.
// See: app/recruteur/coach/[id]/page.tsx (to be created)

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ReputationScoreCard from "@/components/reputation/ReputationScoreCard";
import BadgeGrid from "@/components/reputation/BadgeGrid";
import QuickStatsPills from "@/components/reputation/QuickStatsPills";
import CriteriaBreakdown from "@/components/reputation/CriteriaBreakdown";
import ReviewFeed from "@/components/reputation/ReviewFeed";
import CareerToggle from "@/components/reputation/CareerToggle";
import type { CoachReview } from "@/lib/types/models";
import type { CoachBadge } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   Coach Reputation — /coach/reputation
   Score, badges, évaluations recruteurs, opportunités CÉGEP
═══════════════════════════════════════════════════════════════ */

const QC_REGIONS = [
  "Bas-Saint-Laurent", "Saguenay–Lac-Saint-Jean", "Capitale-Nationale",
  "Mauricie", "Estrie", "Montréal", "Outaouais", "Abitibi-Témiscamingue",
  "Côte-Nord", "Nord-du-Québec", "Gaspésie–Îles-de-la-Madeleine",
  "Chaudière-Appalaches", "Laval", "Lanaudière", "Laurentides",
  "Montérégie", "Centre-du-Québec",
];

export default function CoachReputationPage() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<CoachReview[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [recommendRate, setRecommendRate] = useState(0);
  const [badge, setBadge] = useState<CoachBadge>("none");
  const [hasPlaceurBadge, setHasPlaceurBadge] = useState(false);
  const [totalPlacements, setTotalPlacements] = useState(0);
  const [avgResponseTimeHours, setAvgResponseTimeHours] = useState(0);
  const [profileCompletionRate, setProfileCompletionRate] = useState(0);
  const [profileQualityAvg, setProfileQualityAvg] = useState(0);
  const [responsivenessAvg, setResponsivenessAvg] = useState(0);
  const [honestyAvg, setHonestyAvg] = useState(0);
  const [professionalismAvg, setProfessionalismAvg] = useState(0);
  const [sportsList, setSportsList] = useState<string[]>([]);
  const [careerOpen, setCareerOpen] = useState(false);
  const [careerSports, setCareerSports] = useState<string[]>([]);
  const [careerRegions, setCareerRegions] = useState<string[]>([]);
  const [careerRole, setCareerRole] = useState<"head" | "assistant" | "both" | undefined>(undefined);
  const [careerBio, setCareerBio] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // 1. Reviews
      const { data: reviewRows } = await supabase
        .from("coach_reviews")
        .select("*, athletes(first_name, last_name, position_id, positions!position_id(nom, abreviation))")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false });

      const mappedReviews: CoachReview[] = (reviewRows || []).map((r: Record<string, unknown>) => {
        const ath = r.athletes as Record<string, unknown> | null;
        const posRaw = ath?.positions;
        const pos = Array.isArray(posRaw) ? posRaw[0] : posRaw;
        const posObj = pos as { abreviation?: string; nom?: string } | null;
        return {
          id: r.id as string,
          coachId: r.coach_id as string,
          recruiterId: r.recruiter_id as string,
          conversationId: "",
          athleteId: (r.athlete_id as string) || "",
          athleteName: ath ? `${(ath.first_name as string) || ""} ${(ath.last_name as string) || ""}`.trim() : "",
          athletePosition: posObj?.abreviation || posObj?.nom || "",
          profileQuality: (r.qualite_profils as 1|2|3|4|5) || 3,
          responsiveness: (r.reactivite as 1|2|3|4|5) || 3,
          evaluationHonesty: (r.honnetete_evaluations as 1|2|3|4|5) || 3,
          professionalism: (r.professionnalisme as 1|2|3|4|5) || 3,
          overallScore: (r.note_globale as number) || 0,
          wouldRecommend: !!(r.recommande),
          comment: (r.commentaire as string) || undefined,
          coachReply: (r.reponse_coach as string) || undefined,
          createdAt: (r.created_at as string) || "",
          status: "active" as const,
        };
      });
      setReviews(mappedReviews);
      setTotalReviews(mappedReviews.length);

      // Calculate averages
      if (mappedReviews.length > 0) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const scores = mappedReviews.map((r) => r.overallScore);
        const overall = parseFloat(avg(scores).toFixed(1));
        setOverallScore(overall);
        setProfileQualityAvg(parseFloat(avg(mappedReviews.map((r) => r.profileQuality)).toFixed(1)));
        setResponsivenessAvg(parseFloat(avg(mappedReviews.map((r) => r.responsiveness)).toFixed(1)));
        setHonestyAvg(parseFloat(avg(mappedReviews.map((r) => r.evaluationHonesty)).toFixed(1)));
        setProfessionalismAvg(parseFloat(avg(mappedReviews.map((r) => r.professionalism)).toFixed(1)));

        const recCount = mappedReviews.filter((r) => r.wouldRecommend).length;
        const recRate = Math.round((recCount / mappedReviews.length) * 100);
        setRecommendRate(recRate);

        // Badge logic: evaluated ≥3, recommended ≥5, elite ≥15
        if (mappedReviews.length >= 15) setBadge("elite");
        else if (mappedReviews.length >= 5) setBadge("recommended");
        else if (mappedReviews.length >= 3) setBadge("evaluated");
      }

      // 2. Athletes for stats
      const { data: athleteRows } = await supabase
        .from("athletes")
        .select("id, profile_completion, verified")
        .eq("coach_id", user.id);

      const athleteIds = (athleteRows || []).map((a: { id: string }) => a.id);
      if (athleteRows && athleteRows.length > 0) {
        const completions = athleteRows.map((a: { profile_completion: number }) => a.profile_completion || 0);
        setProfileCompletionRate(Math.round(completions.reduce((a: number, b: number) => a + b, 0) / completions.length));
      }

      // 3. Placed athletes
      if (athleteIds.length > 0) {
        const { count } = await supabase
          .from("recruiter_pipeline")
          .select("athlete_id", { count: "exact", head: true })
          .in("athlete_id", athleteIds)
          .eq("stage", "LETTRE_SIGNEE");
        const placements = count || 0;
        setTotalPlacements(placements);
        if (placements >= 5) setHasPlaceurBadge(true);
      }

      // 4. Average response time from conversations
      const { data: convRows } = await supabase
        .from("conversations")
        .select("created_at, last_message_at")
        .eq("coach_id", user.id);

      if (convRows && convRows.length > 0) {
        let totalHours = 0;
        let validCount = 0;
        for (const c of convRows) {
          const created = c.created_at as string;
          const lastMsg = c.last_message_at as string;
          if (created && lastMsg) {
            const diff = new Date(lastMsg).getTime() - new Date(created).getTime();
            if (diff > 0) {
              totalHours += diff / (1000 * 60 * 60);
              validCount++;
            }
          }
        }
        if (validCount > 0) setAvgResponseTimeHours(Math.round(totalHours / validCount));
      }

      // 5. Sports list
      const { data: sportsData } = await supabase.from("sports").select("nom").order("nom");
      if (sportsData) setSportsList(sportsData.map((s: { nom: string }) => s.nom));

      // 6. Career toggle state from users table
      const { data: userProfile } = await supabase
        .from("users")
        .select("ouvert_entraineur_cegep, career_sports, career_regions, career_role, career_bio")
        .eq("id", user.id)
        .single();
      if (userProfile) {
        setCareerOpen(!!(userProfile.ouvert_entraineur_cegep));
        setCareerSports((userProfile.career_sports as string[]) || []);
        setCareerRegions((userProfile.career_regions as string[]) || []);
        setCareerRole((userProfile.career_role as "head" | "assistant" | "both") || undefined);
        setCareerBio((userProfile.career_bio as string) || "");
      }

      setLoading(false);
    }
    load();
  }, []);

  const isPublic = totalReviews >= 3 && overallScore >= 3.0;

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto flex items-center justify-center">
        <p className="text-[#6B7280] text-sm py-20">Chargement de votre réputation...</p>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
          Ma réputation
        </h1>
        <p className="text-[13px] text-[#6B7280] mt-1">
          Votre score est basé sur les évaluations des recruteurs CÉGEP après
          chaque échange.
        </p>
      </div>

      {/* ── Section 1 — Score global + Badges ───────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          <div className="flex-1">
            {totalReviews >= 3 ? (
              <ReputationScoreCard
                overallScore={overallScore}
                totalReviews={totalReviews}
                totalReviewers={totalReviews}
                recommendRate={recommendRate}
                isPublic={isPublic}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#2D3748]/30 flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <p className="text-[15px] font-bold text-white mb-1">Votre score sera visible après 3 évaluations</p>
                <p className="text-[13px] text-[#6B7280]">Vous en avez <span className="text-white font-bold">{totalReviews}/3</span></p>
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-4">
              Badges gagnés
            </p>
            <BadgeGrid
              currentBadge={badge}
              hasPlaceurBadge={hasPlaceurBadge}
              totalReviews={totalReviews}
              overallScore={overallScore}
              recommendRate={recommendRate}
              totalPlacements={totalPlacements}
            />
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-[#1e2128]">
          <QuickStatsPills
            avgResponseTimeHours={avgResponseTimeHours}
            totalPlacements={totalPlacements}
            profileCompletionRate={profileCompletionRate}
          />
        </div>
      </div>

      {/* ── Section 2 — Détail par critère (only after 3 reviews) ── */}
      {totalReviews >= 3 && (
        <CriteriaBreakdown
          profileQuality={profileQualityAvg}
          responsiveness={responsivenessAvg}
          honesty={honestyAvg}
          professionalism={professionalismAvg}
        />
      )}

      {/* ── Section 3 — Évaluations reçues ──────────────────── */}
      <ReviewFeed reviews={reviews} />

      {/* ── Section 4 — Opportunités CÉGEP ──────────────────── */}
      <CareerToggle
        initialOpen={careerOpen}
        initialSports={careerSports}
        initialRegions={careerRegions}
        initialRole={careerRole}
        initialBio={careerBio}
        allSports={sportsList}
        allRegions={QC_REGIONS}
      />
    </div>
  );
}
