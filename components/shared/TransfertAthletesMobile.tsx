"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { triggerHaptic } from "@/lib/haptics";
import {
  loadSchoolTeams,
  loadAthletesForTeam,
  moveAthletesToTeam,
  loadTransferContext,
  pickInitialTeam,
  destinationBlockReason,
  NO_TEAM_ID,
  REMOVE_FROM_TEAM_ID,
  type TeamOption,
  type TransferAthlete,
  type TransferContext,
} from "@/lib/coach/transferAthletes";

/* ═══════════════════════════════════════════════════════════════
   TransfertAthletesMobile — Capacitor variant of GESTION DES
   ATHLÈTES. Stacked top-to-bottom: source picker → athlete list →
   sticky destination picker + CTA.

   PIVOTÉ PAR ÉQUIPE (Lot E) : déplace l'appartenance d'équipe
   (team_athletes), plus la propriété (athletes.coach_id) — qui ne
   décrivait que 9 des 53 athlètes en équipe. coach_id n'est PLUS écrit
   ici : il est dérivé, maintenu par les triggers de la vague 2.
   Parité stricte avec le web ; toute la logique vit dans
   lib/coach/transferAthletes.
═══════════════════════════════════════════════════════════════ */

export default function TransfertAthletesMobile() {
  const router = useRouter();
  const toast = useMobileToast();

  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [ctx, setCtx] = useState<TransferContext>({ myTeamIds: new Set(), isDirector: false });

  const [sourceId, setSourceId] = useState<string>("");
  const [destId, setDestId] = useState<string>("");
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [destPickerOpen, setDestPickerOpen] = useState(false);

  const [sourceAthletes, setSourceAthletes] = useState<TransferAthlete[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refreshTeams = useCallback(async (sid: string, c: TransferContext) => {
    const supabase = createClient();
    setTeams(await loadSchoolTeams(supabase, sid, c));
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth"); return; }
      const { data: me } = await supabase
        .from("users").select("school_id").eq("id", session.user.id).maybeSingle();
      const sid = me?.school_id ?? null;
      setSchoolId(sid);
      if (sid) {
        /* Le contexte de droits (mes équipes + statut directeur) borne les
           destinations proposées — il doit être lu AVANT la liste. */
        const c = await loadTransferContext(supabase, sid);
        setCtx(c);
        const list = await loadSchoolTeams(supabase, sid, c);
        setTeams(list);
        const auto = pickInitialTeam(list);
        if (auto) {
          setSourceId(auto);
          setLoadingAthletes(true);
          setSourceAthletes(await loadAthletesForTeam(supabase, sid, auto));
          setLoadingAthletes(false);
        }
      }
      setLoading(false);
    })();
  }, [router]);

  const loadSource = useCallback(async (sid: string, coachId: string) => {
    if (!coachId) { setSourceAthletes([]); return; }
    setLoadingAthletes(true);
    const supabase = createClient();
    setSourceAthletes(await loadAthletesForTeam(supabase, sid, coachId));
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

  const sourceTeam = useMemo(() => teams.find((t) => t.id === sourceId) ?? null, [teams, sourceId]);
  const sourceOptions: PickerOption[] = useMemo(
    () => teams.map((t) => ({ value: t.id, label: `${t.name} (${t.athleteCount})` })),
    [teams],
  );
  /* Destinations : équipes + « Retirer de l'équipe » quand la source EST une
     équipe. Une destination interdite reste VISIBLE, suffixée de son motif —
     la MobilePicker n'a pas d'état désactivé, donc le motif porte l'info. */
  const destTeams = useMemo<TeamOption[]>(() => {
    const base = teams.filter((t) => t.id !== sourceId && t.id !== NO_TEAM_ID);
    if (sourceId && sourceId !== NO_TEAM_ID) {
      base.push({ id: REMOVE_FROM_TEAM_ID, name: "Retirer de l'équipe", sub: "Plus aucun alignement", athleteCount: 0, canManage: true });
    }
    return base;
  }, [teams, sourceId]);
  const destOptions: PickerOption[] = useMemo(
    () => destTeams.map((t) => {
      const motif = destinationBlockReason(t, sourceTeam);
      return {
        value: t.id,
        label: `${t.name}${t.id === REMOVE_FROM_TEAM_ID ? "" : ` (${t.athleteCount})`}${motif ? " — réservé au directeur" : ""}`,
      };
    }),
    [destTeams, sourceTeam],
  );

  const count = selectedIds.size;
  const isAssign = sourceId === NO_TEAM_ID;
  const isRemoval = destId === REMOVE_FROM_TEAM_ID;
  const actionVerb = isRemoval ? "Retirer" : isAssign ? "Assigner" : "Déplacer";
  const destCoach = useMemo(() => destTeams.find((t) => t.id === destId) ?? null, [destTeams, destId]);
  const destBlocked = useMemo(() => {
    const d = destTeams.find((t) => t.id === destId);
    return d ? destinationBlockReason(d, sourceTeam) : null;
  }, [destTeams, destId, sourceTeam]);
  const canSubmit = count > 0 && !!destId && destId !== sourceId;

  async function handleTransfer() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const ids = Array.from(selectedIds);
    const supabase = createClient();
    const res = await moveAthletesToTeam(supabase, sourceAthletes.filter((a) => selectedIds.has(a.id)), destId);

    if (!res.success) {
      console.error("[Transfert] failed", res.error);
      toast.error({ message: "Échec", detail: res.error || "Impossible de déplacer ces athlètes." });
      setSubmitting(false);
      setShowConfirm(false);
      return;
    }

    const verbPast = isRemoval ? "retiré" : isAssign ? "assigné" : "déplacé";
    toast.success({
      message: `${ids.length} athlète${ids.length > 1 ? "s" : ""} ${verbPast}${ids.length > 1 ? "s" : ""}`,
      detail: isRemoval ? "Retirés de leur alignement." : `Vers ${destCoach?.name ?? ""}.`,
    });

    setSelectedIds(new Set());
    setShowConfirm(false);
    setSubmitting(false);
    setDestId("");
    if (schoolId) {
      await refreshTeams(schoolId, ctx);
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
      {/* Header + source picker.
          nx-safe-top (globals.css) = env(safe-area-inset-top) + 12px. Le layout
          coach ne réserve RIEN en haut — c'est écrit dans app/coach/layout.tsx :
          « Pas de padding-top : les headers sticky portent déjà
          env(safe-area-inset-top) ». Cet écran ne le portait pas, d'où le titre
          sous l'heure système. */}
      <div className="px-5 pb-3 shrink-0 nx-safe-top">
        <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">Gestion des athlètes</h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">Assigne des athlètes à une équipe de ton école.</p>

        <label className="block text-[11px] font-bold tracking-wider uppercase text-[#6b7280] mt-4 mb-1.5">Source</label>
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); setSourcePickerOpen(true); }}
          className="w-full flex items-center justify-between bg-[#1A1D24] border border-[#2D3748] rounded-lg px-4 py-3 text-left"
        >
          <span className={`text-[15px] ${sourceTeam ? "text-white font-semibold" : "text-[#6b7280]"}`}>
            {sourceTeam ? `${sourceTeam.name} (${sourceTeam.athleteCount})` : "Sélectionner une équipe"}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>

        {sourceId && sourceAthletes.length > 0 && (
          <div className="flex items-center justify-between mt-3">
            <button type="button" onClick={() => { void triggerHaptic("Light"); toggleSelectAll(); }} className="text-[12px] font-bold text-[#9CA3AF]">
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
        {/* États vides CENTRÉS dans la bande (h-full), plus collés en haut avec
            py-16. C'est ce qui donnait l'impression d'un contenu tassé sous
            l'en-tête suivi d'un grand vide : la bande faisait toute la hauteur,
            mais son seul contenu était posé à son sommet. */}
        {!sourceId && (
          <div className="h-full flex items-center justify-center text-center text-[13px] text-[#6b7280]">
            Sélectionne une équipe
          </div>
        )}
        {sourceId && loadingAthletes && (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {sourceId && !loadingAthletes && sourceAthletes.length === 0 && (
          <div className="h-full flex items-center justify-center text-center text-[13px] text-[#6b7280]">
            Aucun athlète
          </div>
        )}
        {sourceId && !loadingAthletes && sourceAthletes.map((a) => {
          const selected = selectedIds.has(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => { void triggerHaptic("Light"); toggleSelected(a.id); }}
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

      {/* Sticky destination + CTA */}
      {/* Pied collant — RÉSERVE DE LA TAB BAR.
          app/coach/layout.tsx pose bien paddingBottom 88px + safe-area sur
          <main>, mais AnimatedRoute enveloppe la page dans un motion.div en
          `position:absolute; inset:0`. Un absolu se cale sur la PADDING-BOX de
          l'ancêtre positionné : il fait donc 100dvh pleins et IGNORE cette
          réserve. Le pied atterrissait sous la tab bar. Les autres écrans y
          échappent parce qu'ils défilent en flux normal ; celui-ci est le seul
          en colonne pleine hauteur avec un pied ancré.
          var(--tabzone, …) : --tabzone n'existe que sous le layout collège ;
          ailleurs on retombe sur la valeur littérale du layout coach. */}
      <div
        className="shrink-0 border-t border-[#2D3748] bg-[#1A1D24] px-5 pt-3"
        style={{ paddingBottom: "calc(var(--tabzone, calc(env(safe-area-inset-bottom) + 88px)) + 12px)" }}
      >
        <label className="block text-[11px] font-bold tracking-wider uppercase text-[#6b7280] mb-1.5">Destination</label>
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); count > 0 && setDestPickerOpen(true); }}
          disabled={count === 0}
          className="w-full flex items-center justify-between bg-[#111317] border border-[#2D3748] rounded-lg px-4 py-3 text-left disabled:opacity-40"
        >
          <span className={`text-[15px] ${destCoach ? "text-white font-semibold" : "text-[#6b7280]"}`}>
            {destCoach ? `${destCoach.name} (${destCoach.athleteCount})` : isAssign ? "Assigner à…" : "Déplacer vers…"}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        {destBlocked && (
          <p className="text-[12px] text-[#F59E0B] mt-2 leading-snug">{destBlocked}</p>
        )}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => { void triggerHaptic("Light"); setShowConfirm(true); }}
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { void triggerHaptic("Light"); !submitting && setShowConfirm(false); }} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
              {actionVerb} {count} athlète{count > 1 ? "s" : ""}?
            </h3>
            <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">
              {actionVerb} {count} athlète{count > 1 ? "s" : ""}
              {sourceTeam && !isAssign ? ` de ${sourceTeam.name}` : ""} vers{" "}
              <span className="font-bold text-white">{destCoach.name}</span>?
            </p>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button type="button" onClick={() => { void triggerHaptic("Light"); setShowConfirm(false); }} disabled={submitting}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] disabled:opacity-40">Annuler</button>
              <button type="button" onClick={() => { void triggerHaptic("Light"); handleTransfer(); }} disabled={submitting}
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
