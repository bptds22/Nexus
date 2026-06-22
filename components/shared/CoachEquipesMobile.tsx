"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachEquipesMobile — mobile dispatch of /coach/equipes.

   Pattern : sticky scroll-blur header + "+" CTA → TeamPickerSheet
   (pick-first) → onCreateNew → bottom-sheet modal with
   TeamCreateFormBlock → createTeam(). Team cards mirror the
   desktop card semantics (name + season chip + sport/age/division/
   league sub-line + athlete count + coach role pills) restyled for
   mobile (rounded-2xl + active:bg). Migration banner (0 teams +
   rosterCount>0) + EmptyState (0/0).

   Shared with desktop : data flow via useCoachTeams ;
   create/join via createTeam/joinTeam (lib/queries/coach).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCoachTeams } from "@/lib/queries/coach/useCoachTeams";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { createTeam, joinTeam } from "@/lib/queries/coach/createTeam";
import {
  TeamCreateFormBlock,
  type TeamFormValues,
  resolveTeamFinalValues,
} from "@/components/shared/teams/TeamCreateFormBlock";
import { TeamPickerSheet, type TeamPickerItem } from "@/components/shared/teams/TeamPickerSheet";
import { getCurrentSeason } from "@/lib/utils/season";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { triggerHaptic } from "@/components/shared/settings";

const ROLE_LABEL: Record<string, string> = {
  head_coach: "Chef",
  assistant: "Assistant",
  coordinator: "Coordo",
};
const ROLE_PILL: Record<string, string> = {
  head_coach: "bg-[#E63946]/15 text-[#E63946] border-[#E63946]/30",
  assistant: "bg-white/[0.06] text-[#9CA3AF] border-white/10",
  coordinator: "bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30",
};

export default function CoachEquipesMobile() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useMobileToast();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const { data, isLoading } = useCoachTeams();
  const teams = data?.teams ?? [];
  const schoolId = data?.schoolId ?? null;
  const isCivil = data?.isCivil ?? false;
  const rosterCount = data?.rosterCount ?? 0;

  const [scrolled, setScrolled] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [sports, setSports] = useState<{ id: string; nom: string }[]>([]);
  const [formValues, setFormValues] = useState<TeamFormValues | null>(null);
  const [formValid, setFormValid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Sports loaded once (cheap, ~16 rows) — only when create form needs them.
  useEffect(() => {
    if (!showCreate || sports.length > 0) return;
    (async () => {
      const supabase = createClient();
      const { data: sportsData } = await supabase.from("sports").select("id, nom").order("nom");
      if (sportsData) setSports(sportsData as { id: string; nom: string }[]);
    })();
  }, [showCreate, sports.length]);

  // Drag handle for the create sheet
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartRef = useRef(0);

  const handleCreate = useCallback(async () => {
    if (!formValues || !formValid || saving || !schoolId || !userId) return;
    setSaving(true);
    setCreateError(null);
    const supabase = createClient();
    const { finalAge, finalDivision } = resolveTeamFinalValues(formValues);
    const { teamId, error } = await createTeam(supabase, {
      coachUserId: userId,
      schoolId,
      sportId: formValues.sportId,
      name: formValues.name,
      ageGroup: finalAge,
      division: finalDivision,
      gender: formValues.gender,
      league: formValues.league,
      season: formValues.season,
    });
    if (error || !teamId) {
      setCreateError((error as { message?: string } | undefined)?.message || "Création échouée.");
      setSaving(false);
      return;
    }
    triggerHaptic("Medium");
    toast.success({ message: "Équipe créée" });
    qc.invalidateQueries({ queryKey: ["coach-teams"] });
    setShowCreate(false);
    setFormValues(null);
    setFormValid(false);
    setSaving(false);
    router.push(`/coach/equipes/${teamId}`);
  }, [formValues, formValid, saving, schoolId, userId, qc, router, toast]);

  const handlePickExisting = useCallback(async (team: TeamPickerItem) => {
    if (!userId) return;
    const supabase = createClient();
    const { error } = await joinTeam(supabase, { coachUserId: userId, teamId: team.id });
    if (error) {
      toast.error({ message: (error as { message?: string }).message || "Impossible de rejoindre." });
      return;
    }
    triggerHaptic("Medium");
    toast.success({ message: "Équipe rejointe" });
    qc.invalidateQueries({ queryKey: ["coach-teams"] });
    setShowPicker(false);
    router.push(`/coach/equipes/${team.id}`);
  }, [userId, qc, router, toast]);

  return (
    <div
      className="min-h-screen bg-[#111317]"
      onScroll={(e) => setScrolled((e.target as HTMLDivElement).scrollTop > 4)}
      style={{ overflowY: "auto", height: "100dvh" }}
    >
      {/* Sticky scroll-blur header */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between gap-3"
        style={{
          backgroundColor: scrolled ? "rgba(17,19,23,0.85)" : "#111317",
          backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          borderBottom: scrolled ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid transparent",
          transition: "background-color 200ms ease-out, backdrop-filter 200ms ease-out, border-bottom-color 200ms ease-out",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
        }}
      >
        <h1 className="font-head text-[20px] font-black text-white uppercase tracking-tight">
          Mes équipes
        </h1>
        <button
          type="button"
          onClick={() => { triggerHaptic("Light"); setShowPicker(true); }}
          disabled={!schoolId}
          aria-label="Ajouter une équipe"
          className="w-11 h-11 rounded-full bg-[#E63946] flex items-center justify-center active:bg-[#D42B22] transition-colors disabled:opacity-40"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="px-4 pt-2 pb-24 space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] rounded-2xl bg-[#1A1D24] animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && teams.length === 0 && rosterCount > 0 && (
          <div className="bg-[#F59E0B]/[0.06] border border-[#F59E0B]/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#F59E0B]/20 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-white">
                {rosterCount} athlète{rosterCount > 1 ? "s" : ""} dans ton roster
              </p>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                Crée une équipe pour les organiser par sport et division.
              </p>
            </div>
          </div>
        )}

        {!isLoading && teams.length === 0 && rosterCount === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3 className="font-head text-[17px] font-black text-white uppercase mb-1">Aucune équipe</h3>
            <p className="text-[13px] text-[#9CA3AF] max-w-xs">
              Crée ta première équipe pour commencer à organiser tes athlètes.
            </p>
          </div>
        )}

        {!isLoading && teams.length > 0 && teams.map((t) => {
          const sub = [t.sportName, t.ageGroup, t.division, t.league].filter(Boolean).join(" · ");
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { triggerHaptic("Light"); router.push(`/coach/equipes/${t.id}`); }}
              className="w-full text-left bg-[#1A1D24] rounded-2xl border-l-[3px] border-l-[#E63946] active:bg-[#22262e] transition-colors"
              style={{ padding: "14px 16px" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[17px] font-bold text-white truncate">{t.name}</h3>
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-[#2D3748] text-[#9CA3AF] shrink-0">
                      {t.season}
                    </span>
                  </div>
                  {sub && <p className="text-[12px] text-[#6b7280] mt-0.5 truncate">{sub}</p>}
                  {t.coaches.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {t.coaches.slice(0, 3).map((c, i) => (
                        <span
                          key={i}
                          className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${ROLE_PILL[c.role] || ROLE_PILL.assistant}`}
                        >
                          {ROLE_LABEL[c.role] || c.role}
                        </span>
                      ))}
                      {t.coaches.length > 3 && (
                        <span className="text-[10px] text-[#6b7280]">+{t.coaches.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center shrink-0 ml-1">
                  <p className="text-[20px] font-head font-black text-white leading-none">{t.athleteCount}</p>
                  <p className="text-[9px] text-[#6b7280] uppercase tracking-wider mt-0.5">
                    athlète{t.athleteCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Picker sheet — pick-existing first (dedup) */}
      <TeamPickerSheet
        open={showPicker}
        onClose={() => setShowPicker(false)}
        schoolId={schoolId || null}
        season={getCurrentSeason()}
        onPicked={(team) => handlePickExisting(team)}
        onCreateNew={() => { setShowPicker(false); setShowCreate(true); }}
        title="Ajouter une équipe"
      />

      {/* Create form sheet — full structured TeamCreateFormBlock */}
      {showCreate && (() => {
        return (
          <>
            <div
              className="fixed inset-0 z-[70]"
              style={{
                background: `rgba(0,0,0,${Math.max(0.2, 0.6 - dragOffset / 300)})`,
                animation: "nx-modal-fade 200ms ease-out forwards",
              }}
              onClick={() => !saving && setShowCreate(false)}
              aria-hidden
            />
            <div
              className="fixed left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl flex flex-col shadow-[0_-12px_32px_rgba(0,0,0,0.5)]"
              style={{
                // Lifted above the tab bar (z-40, ~64px + safe-area) so
                // the sticky "Créer l'équipe" action bar is never hidden.
                // Mirrors the wizard's ENREGISTRER pattern.
                bottom: "calc(64px + env(safe-area-inset-bottom))",
                maxHeight: "min(82dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 64px))",
                transform: `translateY(${dragOffset}px)`,
                transition: dragOffset === 0 ? "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
              }}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab"
                onTouchStart={(e) => { touchStartRef.current = e.touches[0].clientY; }}
                onTouchMove={(e) => {
                  const dy = Math.max(0, e.touches[0].clientY - touchStartRef.current);
                  setDragOffset(dy);
                }}
                onTouchEnd={() => {
                  if (dragOffset > 100 && !saving) setShowCreate(false);
                  setDragOffset(0);
                }}
              >
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="px-5 pb-3 shrink-0">
                <h2 className="font-head text-[17px] font-black text-white uppercase tracking-tight text-center">
                  Nouvelle équipe
                </h2>
              </div>

              {/* Scrollable form area — pb leaves clear room so the last
                  field is never hidden behind the sticky action bar. */}
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                <TeamCreateFormBlock
                  sports={sports}
                  variant="mobile"
                  initialValues={{
                    season: getCurrentSeason(),
                    // Civil coaches : empty league (let them type their
                    // own — RSEQ is the école-sport governing body and
                    // wrong for civil leagues like LHEQ/LFMM/LBQ).
                    league: isCivil ? "" : "RSEQ",
                  }}
                  onChange={(v, valid) => { setFormValues(v); setFormValid(valid); }}
                />
                {createError && (
                  <p className="mt-3 text-[13px] text-[#EF4444] text-center">{createError}</p>
                )}
              </div>

              {/* Sticky bottom action bar — always visible at the bottom of
                  the lifted sheet. Annuler (secondary) + Créer l'équipe
                  (red, disabled until form is valid). */}
              <div className="px-4 pt-3 pb-3 shrink-0 border-t border-white/[0.06] bg-[#1A1D24] flex gap-2">
                <button
                  type="button"
                  onClick={() => !saving && setShowCreate(false)}
                  className="h-14 px-5 rounded-2xl bg-[#111317] border border-white/10 text-[13px] font-bold uppercase tracking-wider text-[#9CA3AF] active:bg-white/[0.04] transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!formValid || saving}
                  className="flex-1 h-14 rounded-2xl bg-[#E63946] text-white text-[14px] font-black uppercase tracking-widest active:bg-[#D42B22] active:scale-[0.97] transition-all shadow-[0_8px_24px_rgba(230,57,70,0.35)] disabled:opacity-40 disabled:shadow-none disabled:active:scale-100"
                >
                  {saving ? "Création…" : "Créer l'équipe"}
                </button>
              </div>
            </div>
            <style jsx global>{`
              @keyframes nx-modal-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
            `}</style>
          </>
        );
      })()}
    </div>
  );
}
