"use client";

/* ═══════════════════════════════════════════════════════════════
   ParentStaffPicker — recipient picker for a PARENT starting a
   thread about ONE of their children. Lists the coaches/directors
   of that child's school/club.

   Source : RPC list_messageable_staff_for_child(childId) — DEFINER,
   gated by is_parent_of, mirrors coach_reaches_athlete (the RLS the
   PARENT_COACH insert enforces) so the picker never offers a target
   the insert would reject, and never leaks another child's staff.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StaffOption } from "@/components/messaging/SchoolStaffPicker";

export interface ParentStaffPickerProps {
  childId: string;
  onSelect: (staff: StaffOption) => void;
  busyId?: string | null;
}

function initialsFor(name: string): string {
  return (name || "?").split(" ").map((p) => p[0] || "").join("").slice(0, 2).toUpperCase() || "?";
}

export default function ParentStaffPicker({ childId, onSelect, busyId }: ParentStaffPickerProps) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { data, error: rpcErr } = await supabase.rpc("list_messageable_staff_for_child", { p_athlete_id: childId });
      if (cancelled) return;
      if (rpcErr) {
        setError("Impossible de charger le personnel");
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as {
        coach_id: string; first_name: string | null; last_name: string | null;
        photo_url: string | null; role_label: string | null;
      }[];
      const result: StaffOption[] = rows.map((r) => ({
        id: r.coach_id,
        name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Membre du personnel",
        photoUrl: r.photo_url ?? null,
        roleLabel: r.role_label === "Directeur sportif" ? "Directeur sportif" : "Entraîneur",
      }));
      result.sort((a, b) => {
        const da = a.roleLabel === "Directeur sportif" ? 0 : 1;
        const db = b.roleLabel === "Directeur sportif" ? 0 : 1;
        if (da !== db) return da - db;
        return a.name.localeCompare(b.name);
      });
      if (!cancelled) { setStaff(result); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [childId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-7 h-7 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error) return <div className="text-[13px] text-[#EF4444]">{error}</div>;
  if (staff.length === 0) {
    return (
      <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5">
        <p className="text-[14px] text-[#9CA3AF]">Aucun membre du personnel rattaché à l&apos;école de votre enfant pour l&apos;instant.</p>
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
            className="text-left rounded-xl p-4 flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] hover:border-[#E63946]/60 transition-colors disabled:opacity-50"
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
                  ? "bg-[#E63946]/12 border-[#E63946]/30 text-[#E63946]"
                  : "bg-[#2D3748] border-transparent text-[#9CA3AF]"
              }`}>
                {s.roleLabel}
              </span>
            </div>
            {busy && <div className="w-4 h-4 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
