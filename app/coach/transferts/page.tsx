"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import TransfertAthletesMobile from "@/components/shared/TransfertAthletesMobile";
import {
  loadSchoolCoaches,
  loadAthletesForCoach,
  transferAthletes,
  pickInitialSource,
  UNASSIGNED_COACH_ID,
  type SchoolCoachOption,
  type TransferAthlete,
} from "@/lib/coach/transferAthletes";
import { orgNounPossessif, type SchoolType } from "@/lib/utils/orgLabel";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   GESTION DES ATHLÈTES — coach-to-coach ownership reassignment.

   Two-panel "bank transfer": pick a source coach → select athletes →
   pick a destination coach → confirm. Moves athletes.coach_id only
   (never team_athletes). Access = any COACH (coach layout already
   gates role === 'COACH'); RLS scopes writes to the caller's school.

   Web layout here; Capacitor renders <TransfertAthletesMobile/>.
═══════════════════════════════════════════════════════════════ */

function ArrowRight() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function coachSubLabel(c: SchoolCoachOption): string {
  const n = `${c.athleteCount} athlète${c.athleteCount > 1 ? "s" : ""}`;
  return c.id === UNASSIGNED_COACH_ID ? n : `${c.sport} · ${n}`;
}

function MesTransfertsContent() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [orgType, setOrgType] = useState<SchoolType | null>(null);
  const [coaches, setCoaches] = useState<SchoolCoachOption[]>([]);

  const [sourceId, setSourceId] = useState<string>("");
  const [destId, setDestId] = useState<string>("");

  const [sourceAthletes, setSourceAthletes] = useState<TransferAthlete[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  function flashToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  const refreshCoaches = useCallback(async (sid: string) => {
    const supabase = createClient();
    setCoaches(await loadSchoolCoaches(supabase, sid));
  }, []);

  // Initial load: resolve the coach's school + coach list.
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth"); return; }

      const uid = session.user.id;
      const { data: me } = await supabase
        .from("users")
        .select("school_id, schools!school_id(type)")
        .eq("id", uid)
        .maybeSingle();

      const sid = me?.school_id ?? null;
      const schoolRel = (me as { schools?: unknown } | null)?.schools;
      setOrgType(((Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { type?: SchoolType } | null)?.type ?? null);
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

  // Load the selected source coach's athletes.
  const loadSource = useCallback(async (sid: string, coachId: string) => {
    if (!coachId) { setSourceAthletes([]); return; }
    setLoadingAthletes(true);
    const supabase = createClient();
    const list = await loadAthletesForCoach(supabase, sid, coachId);
    setSourceAthletes(list);
    setLoadingAthletes(false);
  }, []);

  function onSourceChange(value: string) {
    setSourceId(value);
    setSelectedIds(new Set());
    // Destination can't equal the (new) source.
    if (value && value === destId) setDestId("");
    if (schoolId) loadSource(schoolId, value);
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
  const destOptions = useMemo(() => coaches.filter((c) => c.id !== sourceId), [coaches, sourceId]);

  const count = selectedIds.size;
  const isAssign = sourceId === UNASSIGNED_COACH_ID; // source is the pool → "Assigner"
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
      flashToast("error", res.error || "Impossible de déplacer ces athlètes.");
      setSubmitting(false);
      setShowConfirm(false);
      return;
    }

    const verbPast = isAssign ? "assigné" : "transféré";
    flashToast(
      "success",
      `${ids.length} athlète${ids.length > 1 ? "s" : ""} ${verbPast}${ids.length > 1 ? "s" : ""} vers ${destCoach?.name ?? ""}.`,
    );

    // Refresh both panels: counts + current source list, reset selection/destination.
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
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-8 text-center">
          <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight">
            Aucune organisation rattachée
          </h3>
          <p className="text-[13px] text-[#9CA3AF] mt-2">
            Rejoins une organisation pour gérer l&apos;assignation des athlètes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">
          Gestion des athlètes
        </h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Assigne des athlètes à un entraîneur de {orgNounPossessif(orgType)}.
        </p>
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 items-start">
        {/* SOURCE */}
        <section className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
          <label className="block text-[12px] font-bold tracking-wider uppercase text-[#6b7280] mb-2">
            Source
          </label>
          <select
            value={sourceId}
            onChange={(e) => onSourceChange(e.target.value)}
            className="w-full bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[14px] text-white focus:outline-none focus:border-[#E63946]/50"
          >
            <option value="">Sélectionner un coach</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.athleteCount})
              </option>
            ))}
          </select>

          {/* Select all + count */}
          {sourceId && sourceAthletes.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
              >
                {selectedIds.size === sourceAthletes.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
              <span className="text-[12px] text-[#6b7280]">
                <span className="font-bold text-white">{count}</span> sélectionné{count > 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Athlete cards */}
          <div className="mt-3 space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {!sourceId && (
              <div className="py-14 text-center text-[13px] text-[#6b7280]">
                Sélectionne un entraîneur
              </div>
            )}
            {sourceId && loadingAthletes && (
              <div className="py-14 flex justify-center">
                <div className="w-6 h-6 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {sourceId && !loadingAthletes && sourceAthletes.length === 0 && (
              <div className="py-14 text-center text-[13px] text-[#6b7280]">Aucun athlète</div>
            )}
            {sourceId && !loadingAthletes && sourceAthletes.map((a) => {
              const selected = selectedIds.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleSelected(a.id)}
                  className={`w-full flex items-center gap-3 text-left rounded-lg p-2.5 transition-all ${
                    selected
                      ? "bg-[#E63946]/10 border border-[#E63946]"
                      : "bg-[#111317] border border-[#2D3748] hover:border-[#E63946]/30"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                    selected ? "bg-[#E63946]" : "border-2 border-[#4a4d56]"
                  }`}>
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2F3440] shrink-0 relative">
                    <AthletePhotoFill photoUrl={a.photo ?? undefined} firstName={a.firstName} lastName={a.lastName} initialsFontSize={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14px] font-bold text-white truncate">{a.firstName} {a.lastName}</p>
                      {a.isPending && <span className="shrink-0 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F59E0B]">En attente</span>}
                    </div>
                    <p className="text-[12px] text-[#6b7280] truncate">
                      {[a.sport, a.position].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ARROW */}
        <div className="hidden lg:flex items-center justify-center pt-16">
          <ArrowRight />
        </div>

        {/* DESTINATION */}
        <section className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
          <label className="block text-[12px] font-bold tracking-wider uppercase text-[#6b7280] mb-2">
            Destination
          </label>
          <select
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            disabled={count === 0}
            className="w-full bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[14px] text-white focus:outline-none focus:border-[#E63946]/50 disabled:opacity-40"
          >
            <option value="">{isAssign ? "Assigner à…" : "Transférer vers…"}</option>
            {destOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.athleteCount})
              </option>
            ))}
          </select>

          {count === 0 && (
            <p className="text-[12px] text-[#6b7280] mt-3">
              Sélectionne au moins un athlète à gauche.
            </p>
          )}
          {destCoach && (
            <div className="mt-4 rounded-lg bg-[#111317] border border-[#2D3748] p-3">
              <p className="text-[12px] text-[#6b7280]">{destCoach.id === UNASSIGNED_COACH_ID ? "Retour au pool" : "Nouvel entraîneur"}</p>
              <p className="text-[15px] font-bold text-white mt-0.5">{destCoach.name}</p>
              <p className="text-[12px] text-[#6b7280]">{coachSubLabel(destCoach)}</p>
            </div>
          )}
        </section>
      </div>

      {/* CTA */}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => setShowConfirm(true)}
          className="px-6 py-3 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-semibold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {actionVerb} {count > 0 ? `${count} athlète${count > 1 ? "s" : ""}` : "athlètes"}
        </button>
      </div>

      {/* Confirmation modal */}
      {showConfirm && destCoach && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setShowConfirm(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
              {actionVerb} {count} athlète{count > 1 ? "s" : ""}?
            </h3>
            <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">
              {isAssign ? "Assigner" : "Transférer"}{" "}
              {count} athlète{count > 1 ? "s" : ""}
              {sourceCoach && !isAssign ? ` de ${sourceCoach.name}` : ""} vers{" "}
              <span className="font-bold text-white">{destCoach.name}</span>?
            </p>
            <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-[#111317] border border-[#2D3748] p-3 space-y-1">
              {sourceAthletes.filter((a) => selectedIds.has(a.id)).map((a) => (
                <p key={a.id} className="text-[12px] text-[#c0c4cc]">{a.firstName} {a.lastName}</p>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={submitting}
                className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-40"
              >
                {submitting ? "..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className={`rounded-lg px-5 py-3 shadow-lg flex items-center gap-3 border bg-[#1A1D24] ${
            toast.kind === "success" ? "border-[#22C55E]/30" : "border-[#EF4444]/30"
          }`}>
            {toast.kind === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            )}
            <span className="text-[13px] font-bold text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransfertsPage() {
  if (IS_CAPACITOR) return <TransfertAthletesMobile />;
  return <MesTransfertsContent />;
}
