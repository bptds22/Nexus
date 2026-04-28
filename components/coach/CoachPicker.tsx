"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   CoachPicker — single-select grid of coaches at a given school.
   Reused by athlete onboarding step 1 and athlete settings.
   Pure: receives schoolId + selectedCoachId, emits onChange.
   No toast, modal, or persistence side effects baked in.
═══════════════════════════════════════════════════════════════ */

interface CoachOption {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  athleteCount: number;
}

export interface CoachPickerProps {
  schoolId: string;
  selectedCoachId: string | null;
  onChange: (coachId: string | null) => void;
  className?: string;
}

function initialsFor(firstName: string, lastName: string): string {
  const f = firstName?.trim()[0] ?? "";
  const l = lastName?.trim()[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

export default function CoachPicker({
  schoolId,
  selectedCoachId,
  onChange,
  className = "",
}: CoachPickerProps) {
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!schoolId) {
      setCoaches([]);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      // 1. Coaches at this school
      const { data: coachRows, error: coachErr } = await supabase
        .from("users")
        .select("id, first_name, last_name, photo_url")
        .eq("school_id", schoolId)
        .eq("role", "COACH");

      if (coachErr) {
        console.error("[CoachPicker] coach load failed:", coachErr);
        if (!cancelled) {
          setError("Impossible de charger les coaches");
          setLoading(false);
        }
        return;
      }

      // 2. Athlete counts — single query, group client-side
      const { data: athleteRows } = await supabase
        .from("athletes")
        .select("coach_id")
        .eq("school_id", schoolId)
        .not("coach_id", "is", null);

      const counts = new Map<string, number>();
      for (const row of athleteRows ?? []) {
        const cid = (row as { coach_id: string }).coach_id;
        counts.set(cid, (counts.get(cid) ?? 0) + 1);
      }

      const result: CoachOption[] = (coachRows ?? []).map((c) => ({
        id: c.id as string,
        firstName: (c.first_name as string) ?? "",
        lastName: (c.last_name as string) ?? "",
        photoUrl: (c.photo_url as string | null) ?? null,
        athleteCount: counts.get(c.id as string) ?? 0,
      }));

      if (!cancelled) {
        setCoaches(result);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  if (loading) {
    return (
      <div className={`text-[13px] text-[#9CA3AF] ${className}`}>
        Chargement des coaches...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-[13px] text-[#EF4444] ${className}`}>{error}</div>
    );
  }

  if (coaches.length === 0) {
    return (
      <div
        className={`bg-[#13151a] border border-[#2D3748] rounded-lg p-4 ${className}`}
      >
        <p className="text-[13px] text-[#9CA3AF]">
          Aucun coach inscrit à cette école pour l&apos;instant. Tu pourras en
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
    <div
      className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${className}`}
    >
      {coaches.map((coach) => {
        const selected = coach.id === selectedCoachId;
        return (
          <button
            key={coach.id}
            type="button"
            onClick={() => onChange(coach.id)}
            className={`${cardBase} ${selected ? cardSelected : cardUnselected}`}
          >
            {/* Avatar with radio overlay */}
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
                {selected && (
                  <div className="w-2 h-2 rounded-full bg-[#E63946]" />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-white leading-tight line-clamp-2">
                {coach.firstName} {coach.lastName}
              </p>
              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-[#2D3748] text-[#9CA3AF] text-[11px] font-semibold whitespace-nowrap">
                {coach.athleteCount} athlète{coach.athleteCount === 1 ? "" : "s"}
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
        {/* Icon with radio overlay */}
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
            {selectedCoachId === null && (
              <div className="w-2 h-2 rounded-full bg-[#E63946]" />
            )}
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
