"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CoachReputation {
  count: number;
  avgNote: number;
  recommendCount: number;
  avgQualite: number;
  avgReactivite: number;
  avgHonnetete: number;
  avgProf: number;
}

export interface CoachBadgeRow {
  badge: string;
}

export interface UseCoachReputationResult {
  loading: boolean;
  reputation: CoachReputation | null;
  badges: CoachBadgeRow[];
  placedCount: number;
  verifiedCount: number;
  avgResponseHours: number | null;
  hasMyReview: boolean;
  /** Re-run all queries (e.g. after the recruiter submits a review) */
  refresh: () => Promise<void>;
}

/**
 * Loads everything needed to render a coach's reputation card:
 *  - Reviews aggregation (averages, recommend count, hasMyReview flag)
 *  - Badge rows
 *  - Placement stats (placed count, verified count from athletes table)
 *  - Average response time, calculated client-side from conversations+messages
 *
 * Returns loading=true while initial fetch is in flight. Subsequent
 * refresh() calls don't toggle loading back to true — the hook
 * assumes a refresh is a background re-fetch, not a fresh load.
 */
export function useCoachReputation(coachId: string | null | undefined): UseCoachReputationResult {
  const [loading, setLoading] = useState(true);
  const [reputation, setReputation] = useState<CoachReputation | null>(null);
  const [badges, setBadges] = useState<CoachBadgeRow[]>([]);
  const [placedCount, setPlacedCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [avgResponseHours, setAvgResponseHours] = useState<number | null>(null);
  const [hasMyReview, setHasMyReview] = useState(false);

  async function loadAll(coachIdVal: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Reviews
    const { data: reviews } = await supabase
      .from("coach_reviews")
      .select("note_globale, recommande, qualite_profils, reactivite, honnetete_evaluations, professionnalisme, recruiter_id")
      .eq("coach_id", coachIdVal);

    if (reviews && reviews.length > 0) {
      const rows = reviews as Array<Record<string, unknown>>;
      const n = rows.length;
      const avgOf = (key: string) =>
        rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / n;
      setReputation({
        count: n,
        avgNote: Math.round(avgOf("note_globale") * 10) / 10,
        recommendCount: rows.filter((r) => r.recommande === true).length,
        avgQualite: Math.round(avgOf("qualite_profils") * 10) / 10,
        avgReactivite: Math.round(avgOf("reactivite") * 10) / 10,
        avgHonnetete: Math.round(avgOf("honnetete_evaluations") * 10) / 10,
        avgProf: Math.round(avgOf("professionnalisme") * 10) / 10,
      });
      setHasMyReview(user ? rows.some((r) => (r.recruiter_id as string) === user.id) : false);
    } else {
      setReputation(null);
      setHasMyReview(false);
    }

    // Badges
    const { data: badgeRows } = await supabase
      .from("coach_badges")
      .select("badge")
      .eq("coach_id", coachIdVal);
    setBadges((badgeRows || []).map((b) => ({ badge: b.badge as string })));

    // Placement stats
    const { data: coachAthletes } = await supabase
      .from("athletes")
      .select("verified, recruitment_status")
      .eq("coach_id", coachIdVal);
    setPlacedCount((coachAthletes || []).filter((a) => a.recruitment_status === "RECRUTE").length);
    setVerifiedCount((coachAthletes || []).filter((a) => a.verified === true).length);

    // Average response time (client-side from coach's conversations)
    const { data: coachConvs } = await supabase
      .from("conversations")
      .select("id")
      .eq("coach_id", coachIdVal);

    let avgHours: number | null = null;
    if (coachConvs && coachConvs.length > 0) {
      const convIds = coachConvs.map((c) => c.id as string);
      const { data: allMsgs } = await supabase
        .from("messages")
        .select("conversation_id, sender_id, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: true });

      if (allMsgs && allMsgs.length > 0) {
        const byConv = new Map<string, typeof allMsgs>();
        allMsgs.forEach((m) => {
          const cid = m.conversation_id as string;
          if (!byConv.has(cid)) byConv.set(cid, []);
          byConv.get(cid)!.push(m);
        });
        const diffs: number[] = [];
        byConv.forEach((msgs) => {
          for (let i = 1; i < msgs.length; i++) {
            const cur = msgs[i];
            const prev = msgs[i - 1];
            if ((cur.sender_id as string) === coachIdVal && (prev.sender_id as string) !== coachIdVal) {
              const diffMs = new Date(cur.created_at as string).getTime() - new Date(prev.created_at as string).getTime();
              diffs.push(diffMs / (1000 * 60 * 60));
            }
          }
        });
        if (diffs.length > 0) {
          avgHours = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        }
      }
    }
    setAvgResponseHours(avgHours);
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!coachId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await loadAll(coachId);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [coachId]);

  async function refresh() {
    if (!coachId) return;
    await loadAll(coachId);
  }

  return {
    loading,
    reputation,
    badges,
    placedCount,
    verifiedCount,
    avgResponseHours,
    hasMyReview,
    refresh,
  };
}
