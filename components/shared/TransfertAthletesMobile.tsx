"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { useMobileToast } from "@/components/mobile/MobileToast";
import {
  loadSchoolCoaches,
  loadAthletesForCoach,
  transferAthletes,
  pickInitialSource,
  UNASSIGNED_COACH_ID,
  type SchoolCoachOption,
  type TransferAthlete,
} from "@/lib/coach/transferAthletes";

/* ═══════════════════════════════════════════════════════════════
   TransfertAthletesMobile — Capacitor variant of GESTION DES
   ATHLÈTES. Stacked top-to-bottom: source picker → athlete list →
   sticky destination picker + CTA. Ownership only (coach_id); never
   touches team_athletes. RLS scopes writes to the caller's school.
═══════════════════════════════════════════════════════════════ */

export default function TransfertAthletesMobile() {
  const router = useRouter();
  const toast = useMobileToast();

  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<SchoolCoachOption[]>([]);

  const [sourceId, setSourceId] = useState<string>("");
  const [destId, setDestId] = useState<string>("");
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [destPickerOpen, setDestPickerOpen] = useState(false);

  const [sourceAthletes, setSourceAthletes] = useState<TransferAthlete[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refreshCoaches = useCallback(async (sid: string) => {
    const supabase = createClient();
    setCoaches(await loadSchoolCoaches(supabase, sid));
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth"); return; }
      const uid = session.user.id;
      const { data: me } = await supabase
        .from("users").select("school_id").eq("id", uid).maybeSingle();
      const sid = me?.school_id ?? null;
      setSchoolId(sid);
      if (sid) {
        const list = await loadSchoolCoaches(supabase, sid);
        setCoaches(list);
        // Auto-select a non-empty source so the panel isn't empty on load.
        const auto = pickInitialSource(list, uid);
        if (auto) {
          setSourceId(auto);
          setLoadingAthletes(true);
          setSourceAthletes(await loadAthletesForCoach(supabase, sid, auto));
          setLoadingAthletes(false);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadSource = useCallback(async (sid: string, coachId: string) => {
    if (!coachId) { setSourceAthletes([]); return; }
    setLoadingAthletes(true);
    const supabase = createClient();
    setSourceAthletes(await loadAthletesForCoach(supabase, sid, coachId));
    setLoadingAthletes(false);
  }, []);

  function onSourceChange(value: string | number | null) {
    const v = value == null ? "" : String(value);
    setSourceId(v);
    setSelectedIds(new Set());
    if (v && v === destId) setDestId("");
    if (schoolId) loadSource(schoolId, v);
    else setSourceAthletes([]);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === sourceAthletes.length ? new Set() : new Set(sourceAthletes.map((a) => a.id)),
    );
  }

  const sourceCoach = useMemo(() => coaches.find((c) => c.id === sourceId) ?? null, [coaches, sourceId]);
  const destCoach = useMemo(() => coaches.find((c) => c.id === destId) ?? null, [coaches, destId]);

  const sourceOptions: PickerOption[] = useMemo(
    () => coaches.map((c) => ({ value: c.id, label: `${c.name} (${c.athleteCount})` })),
    [coaches],
  );
  const destOptions: PickerOption[] = useMemo(
    () => coaches.filter((c) => c.id !== sourceId).map((c) => ({ value: c.id, label: `${c.name} (${c.athleteCount})` })),
    [coaches, sourceId],
  );

  const count = selectedIds.size;
  const isAssign = sourceId === UNASSIGNED_COACH_ID;
  const actionVerb = isAssign ? "Assigner" : "Transférer";
  const canSubmit = count > 0 && !!destId && destId !== sourceId;

  async function handleTransfer() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const ids = Array.from(selectedIds);
    const supabase = createClient();
    const res = await transferAthletes(supabase, ids, destId);

    if (!res.success) {
      console.error("[Transfert] failed", res.error);
      toast.error({ message: "Échec du transfert", detail: res.error || "Impossible de déplacer ces athlètes." });
      setSubmitting(false);
      setShowConfirm(false);
      return;
    }

    const verbPast = isAssign ? "assigné" : "transféré";
    toast.success({
      message: `${ids.length} athlète${ids.length > 1 ? "s" : ""} ${verbPast}${ids.length > 1 ? "s" : ""}`,
      detail: `Vers ${destCoach?.name ?? ""}.`,
    });

    setSelectedIds(new Set());
    setShowConfirm(false);
    setSubmitting(false);
    setDestId("");
    if (schoolId) {
      await refreshCoaches(schoolId);
      await loadSource(schoolId, sourceId);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="px-5 py-10 text-center">
        <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight">Aucune école rattachée</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-2">Rejoins une école pour gérer l&apos;assignation des athlètes.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header + source picker — top safe-area so the title clears the iOS clock */}
      <div className="px-5 pb-3 shrink-0" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Gestion des athlètes</h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">Assigne des athlètes à un entraîneur de ton école.</p>

        <label className="block text-[11px] font-bold tracking-wider uppercase text-[#6b7280] mt-4 mb-1.5">Source</label>
        <button
          type="button"
          onClick={() => setSourcePickerOpen(true)}
          className="w-full flex items-center justify-between bg-[#1A1D24] border border-[#2D3748] rounded-lg px-4 py-3 text-left"
        >
          <span className={`text-[15px] ${sourceCoach ? "text-white font-semibold" : "text-[#6b7280]"}`}>
            {sourceCoach ? `${sourceCoach.name} (${sourceCoach.athleteCount})` : "Sélectionner un coach"}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>

        {sourceId && sourceAthletes.length > 0 && (
          <div className="flex items-center justify-between mt-3">
            <button type="button" onClick={toggleSelectAll} className="text-[12px] font-bold text-[#9CA3AF]">
              {selectedIds.size === sourceAthletes.length ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
            {count > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[11px] font-bold">
                {count} sélectionné{count > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Athlete list (scrollable) */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
        {!sourceId && <div className="py-16 text-center text-[13px] text-[#6b7280]">Sélectionne un entraîneur</div>}
        {sourceId && loadingAthletes && (
          <div className="py-16 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {sourceId && !loadingAthletes && sourceAthletes.length === 0 && (
          <div className="py-16 text-center text-[13px] text-[#6b7280]">Aucun athlète</div>
        )}
        {sourceId && !loadingAthletes && sourceAthletes.map((a) => {
          const selected = selectedIds.has(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleSelected(a.id)}
              className={`w-full flex items-center gap-3 text-left rounded-xl p-3 transition-all ${
                selected ? "bg-[#E63946]/10 border border-[#E63946]" : "bg-[#1A1D24] border border-[#2D3748]"
              }`}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${selected ? "bg-[#E63946]" : "border-2 border-[#4a4d56]"}`}>
                {selected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <div className="w-11 h-11 rounded-full overflow-hidden bg-[#2F3440] shrink-0 relative">
                <AthletePhotoFill photoUrl={a.photo ?? undefined} firstName={a.firstName} lastName={a.lastName} initialsFontSize={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-white truncate">{a.firstName} {a.lastName}</p>
                <p className="text-[12px] text-[#6b7280] truncate">{[a.sport, a.position].filter(Boolean).join(" · ") || "—"}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sticky destination + CTA — bottom safe-area so the button clears the tab bar */}
      <div className="shrink-0 border-t border-[#2D3748] bg-[#1A1D24] px-5 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
        <label className="block text-[11px] font-bold tracking-wider uppercase text-[#6b7280] mb-1.5">Destination</label>
        <button
          type="button"
          onClick={() => count > 0 && setDestPickerOpen(true)}
          disabled={count === 0}
          className="w-full flex items-center justify-between bg-[#111317] border border-[#2D3748] rounded-lg px-4 py-3 text-left disabled:opacity-40"
        >
          <span className={`text-[15px] ${destCoach ? "text-white font-semibold" : "text-[#6b7280]"}`}>
            {destCoach ? `${destCoach.name} (${destCoach.athleteCount})` : isAssign ? "Assigner à…" : "Transférer vers…"}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => setShowConfirm(true)}
          className="w-full mt-3 py-3.5 bg-[#E63946] text-white text-[14px] font-semibold uppercase tracking-wider rounded-lg disabled:opacity-40"
        >
          {actionVerb} {count > 0 ? `${count} athlète${count > 1 ? "s" : ""}` : "athlètes"}
        </button>
      </div>

      {/* Pickers */}
      <MobilePicker
        open={sourcePickerOpen}
        onClose={() => setSourcePickerOpen(false)}
        title="Source"
        options={sourceOptions}
        value={sourceId || null}
        onChange={onSourceChange}
      />
      <MobilePicker
        open={destPickerOpen}
        onClose={() => setDestPickerOpen(false)}
        title="Destination"
        options={destOptions}
        value={destId || null}
        onChange={(v) => setDestId(v == null ? "" : String(v))}
      />

      {/* Confirmation modal */}
      {showConfirm && destCoach && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setShowConfirm(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
              {actionVerb} {count} athlète{count > 1 ? "s" : ""}?
            </h3>
            <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">
              {isAssign ? "Assigner" : "Transférer"} {count} athlète{count > 1 ? "s" : ""}
              {sourceCoach && !isAssign ? ` de ${sourceCoach.name}` : ""} vers{" "}
              <span className="font-bold text-white">{destCoach.name}</span>?
            </p>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button type="button" onClick={() => setShowConfirm(false)} disabled={submitting}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] disabled:opacity-40">Annuler</button>
              <button type="button" onClick={handleTransfer} disabled={submitting}
                className="px-5 py-2 bg-[#E63946] text-white text-[13px] font-bold rounded-lg disabled:opacity-40">
                {submitting ? "..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
