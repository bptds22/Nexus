"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   CivilCoachPicker — single-select grid of coaches assigned to a
   given civil team. Mirrors the school-side CoachPicker but reads
   from team_coaches instead of users.school_id.

   Post-Phase 6.1 : civil coaches are stored in the unified
   team_coaches table (legacy league_coaches table is empty + slated
   for drop in Phase 6.3). The prop name `leagueTeamId` is preserved
   for caller compatibility — semantically it's now a team_id
   pointing at a row in `teams` whose parent school has
   type='LIGUE_CIVILE'. P3 rename logged.

   Pure: receives leagueTeamId + selectedCoachId, emits onChange.
   No toast, modal, or persistence side effects baked in.

   RLS: depends on team_coaches read policies (anyone authenticated
   can read for picker UX). Filters role IN ('ADMIN', 'COACH',
   'head_coach', 'assistant', 'coordinator') so PENDING coaches
   don't appear as selectable.

   Tech debt: duplicates the layout + interaction pattern of
   components/coach/CoachPicker.tsx. P3 logged for consolidation
   into a single CoachPicker that accepts schoolId OR teamId.
═══════════════════════════════════════════════════════════════ */

interface CoachOption {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  role: string;
}

export interface CivilCoachPickerProps {
  leagueTeamId: string;
  selectedCoachId: string | null;
  onChange: (coachId: string | null) => void;
  className?: string;
}

function initialsFor(firstName: string, lastName: string): string {
  const f = firstName?.trim()[0] ?? "";
  const l = lastName?.trim()[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

export default function CivilCoachPicker({
  leagueTeamId,
  selectedCoachId,
  onChange,
  className = "",
}: CivilCoachPickerProps) {
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!leagueTeamId) {
      setCoaches([]);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      const { data: rows, error: rowsErr } = await supabase
        .from("team_coaches")
        .select("coach_id, role, users!coach_id(first_name, last_name, photo_url)")
        .eq("team_id", leagueTeamId)
        .in("role", ["head_coach", "assistant", "coordinator"]);

      if (rowsErr) {
        console.error("[CivilCoachPicker] load failed:", rowsErr);
        if (!cancelled) {
          setError("Impossible de charger les coaches");
          setLoading(false);
        }
        return;
      }

      const result: CoachOption[] = (rows ?? []).map((r) => {
        const u = Array.isArray(r.users) ? r.users[0] : r.users;
        return {
          id: r.coach_id as string,
          firstName: (u?.first_name as string) ?? "",
          lastName: (u?.last_name as string) ?? "",
          photoUrl: (u?.photo_url as string | null) ?? null,
          role: (r.role as string) ?? "assistant",
        };
      });

      if (!cancelled) {
        setCoaches(result);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leagueTeamId]);

  if (loading) {
    return (
      <div className={`text-[13px] text-[#9CA3AF] ${className}`}>
        Chargement des coaches...
      </div>
    );
  }

  if (error) {
    return <div className={`text-[13px] text-[#EF4444] ${className}`}>{error}</div>;
  }

  if (coaches.length === 0) {
    return (
      <div className={`bg-[#13151a] border border-[#2D3748] rounded-lg p-4 ${className}`}>
        <p className="text-[13px] text-[#9CA3AF]">
          Aucun coach inscrit à cette équipe pour l&apos;instant. Tu pourras en
          sélectionner un plus tard.
        </p>
      </div>
    );
  }

  const cardBase =
    "relative text-left rounded-xl p-4 transition-all duration-150 flex items-center gap-4 min-h-[110px]";
  const cardSelected =
    "bg-[#1A1D24] border-2 border-[#E63946] shadow-[0_0_0_1px_rgba(230,57,70,0.2)]";
  const cardUnselected =
    "bg-[#1A1D24] border border-[#2D3748] hover:border-[#4a4d56]";

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${className}`}>
      {coaches.map((coach) => {
        const selected = coach.id === selectedCoachId;
        return (
          <button
            key={coach.id}
            type="button"
            onClick={() => onChange(coach.id)}
            className={`${cardBase} ${selected ? cardSelected : cardUnselected}`}
          >
            <div className="relative shrink-0">
              {coach.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coach.photoUrl}
                  alt={`${coach.firstName} ${coach.lastName}`}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#2D3748] flex items-center justify-center text-[13px] font-bold text-white">
                  {initialsFor(coach.firstName, coach.lastName)}
                </div>
              )}
              <div
                className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors bg-[#1A1D24] ${
                  selected ? "border-[#E63946]" : "border-[#4a4d56]"
                }`}
              >
                {selected && <div className="w-2 h-2 rounded-full bg-[#E63946]" />}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-white leading-tight line-clamp-2">
                {coach.firstName} {coach.lastName}
              </p>
              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-[#2D3748] text-[#9CA3AF] text-[11px] font-semibold whitespace-nowrap">
                {coach.role === "head_coach"
                  ? "Entraîneur-chef"
                  : coach.role === "coordinator"
                    ? "Coordinateur"
                    : "Coach"}
              </span>
            </div>
          </button>
        );
      })}

      {/* Aucun coach card — always rendered last */}
      <button
        key="__none__"
        type="button"
        onClick={() => onChange(null)}
        className={`${cardBase} ${selectedCoachId === null ? cardSelected : cardUnselected}`}
      >
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full bg-[#13151a] border border-dashed border-[#4a4d56] flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6b7280"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <div
            className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors bg-[#1A1D24] ${
              selectedCoachId === null ? "border-[#E63946]" : "border-[#4a4d56]"
            }`}
          >
            {selectedCoachId === null && <div className="w-2 h-2 rounded-full bg-[#E63946]" />}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-white leading-tight whitespace-nowrap">
            Aucun coach
          </p>
          <p className="text-[11px] text-[#6b7280] mt-1 leading-snug">
            Tu pourras en sélectionner un plus tard
          </p>
        </div>
      </button>
    </div>
  );
}
