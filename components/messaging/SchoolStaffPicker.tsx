"use client";

/* ═══════════════════════════════════════════════════════════════
   SchoolStaffPicker — recipient picker for an athlete starting a
   thread. Lists the coaches/directors the athlete may message.

   The query MIRRORS the athlete_messageable_coach() RLS helper
   (migration 20260722100100) so the UI never offers a target RLS
   would reject :
     school_coaches WHERE school_id = COALESCE(athlete.school_id,
       club-school-of-league_team) AND role IN (COACH, DIRECTEUR,
       DIRECTEUR_INTERIM)   -- excludes PENDING
     ∪ team_coaches WHERE team_id = athlete.league_team_id
   Deduped by coach_id.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface StaffOption {
  id: string;
  name: string;
  photoUrl: string | null;
  roleLabel: string; // "Entraîneur" | "Directeur sportif"
}

export interface SchoolStaffPickerProps {
  athleteId: string;
  onSelect: (staff: StaffOption) => void;
  busyId?: string | null;
}

function roleLabel(scRole: string | undefined): string {
  if (scRole === "DIRECTEUR" || scRole === "DIRECTEUR_INTERIM") return "Directeur sportif";
  return "Entraîneur";
}

function initialsFor(name: string): string {
  return (name || "?").split(" ").map((p) => p[0] || "").join("").slice(0, 2).toUpperCase() || "?";
}

export default function SchoolStaffPicker({ athleteId, onSelect, busyId }: SchoolStaffPickerProps) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!athleteId) { setLoading(false); return; }

    (async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      // 1. Athlete anchor : school_id (scolaire) or league_team_id (civil).
      const { data: ath, error: athErr } = await supabase
        .from("athletes")
        .select("school_id, league_team_id")
        .eq("id", athleteId)
        .maybeSingle();
      if (athErr || !ath) {
        if (!cancelled) { setError("Profil introuvable"); setLoading(false); }
        return;
      }

      // Effective school = scolaire school OR the club (LIGUE_CIVILE) school
      // of the athlete's team.
      let effectiveSchoolId = (ath.school_id as string | null) ?? null;
      const leagueTeamId = (ath.league_team_id as string | null) ?? null;
      if (!effectiveSchoolId && leagueTeamId) {
        const { data: team } = await supabase
          .from("teams")
          .select("school_id")
          .eq("id", leagueTeamId)
          .maybeSingle();
        effectiveSchoolId = (team?.school_id as string | null) ?? null;
      }

      const roleByCoach = new Map<string, string>();

      // 2. school_coaches at the effective school (excludes PENDING).
      if (effectiveSchoolId) {
        const { data: scRows } = await supabase
          .from("school_coaches")
          .select("coach_id, role")
          .eq("school_id", effectiveSchoolId)
          .in("role", ["COACH", "DIRECTEUR", "DIRECTEUR_INTERIM"]);
        for (const r of (scRows ?? []) as { coach_id: string; role: string }[]) {
          const cur = roleByCoach.get(r.coach_id);
          if (!cur || r.role.startsWith("DIRECTEUR")) roleByCoach.set(r.coach_id, r.role);
        }
      }

      // 3. team_coaches on the athlete's civil team (fallback union).
      if (leagueTeamId) {
        const { data: tcRows } = await supabase
          .from("team_coaches")
          .select("coach_id")
          .eq("team_id", leagueTeamId);
        for (const r of (tcRows ?? []) as { coach_id: string }[]) {
          if (!roleByCoach.has(r.coach_id)) roleByCoach.set(r.coach_id, "COACH");
        }
      }

      const coachIds = [...roleByCoach.keys()];
      if (coachIds.length === 0) {
        if (!cancelled) { setStaff([]); setLoading(false); }
        return;
      }

      // 4. Hydrate identities.
      const { data: users } = await supabase
        .from("users")
        .select("id, first_name, last_name, photo_url")
        .in("id", coachIds);

      const result: StaffOption[] = (users ?? []).map((u) => {
        const f = (u.first_name as string) || "";
        const l = (u.last_name as string) || "";
        return {
          id: u.id as string,
          name: `${f} ${l}`.trim() || "Membre du personnel",
          photoUrl: (u.photo_url as string | null) ?? null,
          roleLabel: roleLabel(roleByCoach.get(u.id as string)),
        };
      });
      // Directors first, then alphabetical.
      result.sort((a, b) => {
        const da = a.roleLabel === "Directeur sportif" ? 0 : 1;
        const db = b.roleLabel === "Directeur sportif" ? 0 : 1;
        if (da !== db) return da - db;
        return a.name.localeCompare(b.name);
      });

      if (!cancelled) { setStaff(result); setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [athleteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-7 h-7 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-[13px] text-[#EF4444]">{error}</div>;
  }

  if (staff.length === 0) {
    return (
      <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5">
        <p className="text-[14px] text-[#9CA3AF]">Aucun entraîneur rattaché à ton école pour l&apos;instant.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {staff.map((s) => {
        const busy = busyId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            disabled={!!busyId}
            onClick={() => onSelect(s)}
            className="text-left rounded-xl p-4 flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] hover:border-[#22C55E]/60 transition-colors disabled:opacity-50"
          >
            {s.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photoUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                <span className="text-[12px] font-bold text-white">{initialsFor(s.name)}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-white truncate">{s.name}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                s.roleLabel === "Directeur sportif"
                  ? "bg-[#22C55E]/12 border-[#22C55E]/30 text-[#22C55E]"
                  : "bg-[#2D3748] border-transparent text-[#9CA3AF]"
              }`}>
                {s.roleLabel}
              </span>
            </div>
            {busy && <div className="w-4 h-4 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
