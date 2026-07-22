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

function initialsFor(name: string): string {
  return (name || "?").split(" ").map((p) => p[0] || "").join("").slice(0, 2).toUpperCase() || "?";
}

export default function SchoolStaffPicker({ athleteId, onSelect, busyId }: SchoolStaffPickerProps) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      // Source UNIQUE : RPC SECURITY DEFINER list_messageable_staff
      // (migration 20260722100500) — miroir exact de la garde RLS
      // athlete_messageable_coach. Contourne l'absence de SELECT RLS athlète sur
      // school_coaches → le picker ne peut PAS revenir vide alors que l'INSERT
      // serait autorisé (prouvé via un JWT athlète réel).
      const { data, error: rpcErr } = await supabase.rpc("list_messageable_staff");
      if (cancelled) return;
      if (rpcErr) {
        setError("Impossible de charger le personnel");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as {
        coach_id: string;
        first_name: string | null;
        last_name: string | null;
        photo_url: string | null;
        role_label: string | null;
      }[];

      const result: StaffOption[] = rows.map((r) => {
        const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
        return {
          id: r.coach_id,
          name: name || "Membre du personnel",
          photoUrl: r.photo_url ?? null,
          roleLabel: r.role_label === "Directeur sportif" ? "Directeur sportif" : "Entraîneur",
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
