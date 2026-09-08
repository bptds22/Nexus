"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  loadSchoolTeams,
  loadTransferContext,
  moveAthletesToTeam,
  destinationBlockReason,
  NO_TEAM_ID,
  REMOVE_FROM_TEAM_ID,
  type TeamOption,
  type TransferContext,
} from "@/lib/coach/transferAthletes";

/* ═══════════════════════════════════════════════════════════════
   AthleteTransferSheet — déplacer CE jeune, depuis sa fiche.

   Le portail gère les lots ; la fiche gère l'athlète qu'on a sous les
   yeux. Deux surfaces, UN seul moteur : tout vient de
   lib/coach/transferAthletes — la liste des équipes, les compteurs, les
   droits, les motifs de blocage et l'écriture. Aucune logique de droits
   n'est réécrite ici.

   ⚠️ SI CE PANNEAU ET LE PORTAIL DIVERGENT UN JOUR, C'EST UN BUG.
   Le seul écart admis est la taille du lot : un athlète au lieu de N.

   N'écrit JAMAIS athletes.coach_id — le référent est dérivé (vague 2).
   ═══════════════════════════════════════════════════════════════ */

export interface AthleteTransferState {
  /** null = chargement en cours. */
  ctx: TransferContext | null;
  teams: TeamOption[];
  currentTeamId: string | null;
  currentTeamName: string | null;
  /** id de la ligne team_athletes — absent ⇒ le helper passera par INSERT. */
  rowId: string | undefined;
}

/**
 * Charge tout ce qu'il faut pour proposer un transfert sur un athlète.
 * Résout toujours : sans école ou sans droits, on renvoie un état vide et
 * l'appelant n'affiche simplement pas le bouton.
 */
export async function loadAthleteTransferState(
  athleteId: string,
): Promise<AthleteTransferState> {
  const vide: AthleteTransferState = {
    ctx: null, teams: [], currentTeamId: null, currentTeamName: null, rowId: undefined,
  };
  if (!athleteId) return vide;

  const supabase = createClient();

  const { data: aRow } = await supabase
    .from("athletes").select("school_id").eq("id", athleteId).maybeSingle();
  const schoolId = (aRow as { school_id?: string } | null)?.school_id;
  if (!schoolId) return vide;

  const { data: taRows } = await supabase
    .from("team_athletes")
    .select("id, team_id, teams!team_id(name)")
    .eq("athlete_id", athleteId)
    .limit(1);

  const ta = ((taRows ?? []) as Record<string, unknown>[])[0];
  const tRel = ta?.teams as { name?: string } | { name?: string }[] | null;
  const team = Array.isArray(tRel) ? tRel[0] : tRel;

  const ctx = await loadTransferContext(supabase, schoolId);
  const teams = await loadSchoolTeams(supabase, schoolId, ctx);

  return {
    ctx,
    teams,
    currentTeamId: (ta?.team_id as string) ?? null,
    currentTeamName: team?.name ?? null,
    rowId: (ta?.id as string) ?? undefined,
  };
}

/**
 * Le bouton doit-il exister ? Mêmes droits que le portail, DÉRIVÉS de la
 * RLS, pas réinventés :
 *   · directeur → passe partout dans son organisation ;
 *   · coach de l'équipe ACTUELLE → peut l'en sortir ou la déplacer vers une
 *     de ses autres équipes (l'UPDATE évalue l'ancienne ET la nouvelle) ;
 *   · athlète SANS équipe → il suffit de coacher l'équipe de destination,
 *     l'INSERT ne contrôle que la ligne créée.
 */
export function canTransferAthlete(st: AthleteTransferState): boolean {
  if (!st.ctx) return false;
  if (st.ctx.isDirector) return true;
  if (st.currentTeamId) return st.ctx.myTeamIds.has(st.currentTeamId);
  return st.ctx.myTeamIds.size > 0;
}

export default function AthleteTransferSheet({
  athleteId,
  athleteName,
  state,
  variant = "web",
  onDone,
  onClose,
}: {
  athleteId: string;
  athleteName: string;
  state: AthleteTransferState;
  variant?: "web" | "mobile";
  /** Appelé après un déplacement réussi — l'appelant rafraîchit sa fiche. */
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const [destId, setDestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const source =
    state.teams.find((t) => t.id === state.currentTeamId) ??
    state.teams.find((t) => t.id === NO_TEAM_ID) ??
    null;

  const options: TeamOption[] = [
    ...state.teams.filter((t) => t.id !== NO_TEAM_ID && t.id !== state.currentTeamId),
    // « Retirer » n'a de sens que si le jeune EST sur une équipe.
    ...(state.currentTeamId
      ? [{
          id: REMOVE_FROM_TEAM_ID,
          name: "Retirer de l'équipe",
          sub: "Le jeune ne sera plus sur aucun alignement",
          athleteCount: 0,
          canManage: true,
        } as TeamOption]
      : []),
  ];

  const dest = options.find((t) => t.id === destId) ?? null;
  const motif = dest ? destinationBlockReason(dest, source) : null;

  async function submit() {
    if (!destId || busy || motif) return;
    setBusy(true);
    setErreur(null);
    const supabase = createClient();
    const res = await moveAthletesToTeam(
      supabase,
      [{ id: athleteId, firstName: "", lastName: "", rowId: state.rowId }],
      destId,
    );
    setBusy(false);
    if (!res.success) { setErreur(res.error ?? "Le déplacement a échoué."); return; }
    onDone(
      destId === REMOVE_FROM_TEAM_ID
        ? `${athleteName} a été retiré de son équipe.`
        : `${athleteName} a été déplacé vers ${dest?.name ?? "l'équipe"}.`,
    );
  }

  const wrap =
    variant === "mobile"
      ? "fixed inset-0 z-[95] bg-black/70 flex items-end"
      : "fixed inset-0 z-[95] bg-black/70 flex items-center justify-center p-4";
  const card =
    variant === "mobile"
      ? "w-full bg-[#1A1D24] border-t border-[#2D3748] rounded-t-2xl p-5 pb-8"
      : "bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-lg w-full";

  return (
    <div className={wrap} role="dialog" aria-modal="true" aria-labelledby="tr-title">
      <div className={card}>
        {variant === "mobile" && <div className="w-10 h-1 rounded-full bg-[#2D3748] mx-auto mb-4" />}

        <h3 id="tr-title" className="font-head text-[17px] font-black text-white uppercase tracking-tight">
          Transférer {athleteName}
        </h3>

        <p className="text-[13px] text-[#9CA3AF] mt-2">
          Équipe actuelle :{" "}
          <span className="font-bold text-white">{state.currentTeamName ?? "Sans équipe"}</span>
        </p>

        <label className="block text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mt-5 mb-1.5">
          Destination
        </label>
        <select
          value={destId}
          onChange={(e) => { setDestId(e.target.value); setErreur(null); }}
          className="w-full bg-[#111317] border border-white/[0.10] rounded-xl px-3 py-2.5 text-[14px] text-white outline-none focus:border-[#E63946]/40"
        >
          <option value="">Choisir une équipe…</option>
          {/* Destinations interdites VISIBLES et désactivées, motif au survol —
              même règle que le portail. */}
          {options.map((t) => {
            const m = destinationBlockReason(t, source);
            return (
              <option key={t.id} value={t.id} disabled={!!m} title={m ?? undefined}>
                {t.name}
                {t.id === REMOVE_FROM_TEAM_ID ? "" : ` (${t.athleteCount})`}
                {m ? " — réservé au directeur" : ""}
              </option>
            );
          })}
        </select>

        {motif && <p className="text-[12px] text-[#F59E0B] mt-2 leading-snug">{motif}</p>}
        {erreur && <p className="text-[12.5px] text-[#EF4444] mt-3 leading-snug">{erreur}</p>}

        <div className={`flex ${variant === "mobile" ? "flex-col gap-2" : "items-center justify-end gap-3"} mt-6`}>
          <button
            type="button"
            onClick={submit}
            disabled={!destId || !!motif || busy}
            className={`${variant === "mobile" ? "w-full py-3.5 rounded-xl" : "px-5 py-2 rounded-lg"} bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-bold text-[12px] uppercase tracking-wider transition-colors disabled:opacity-40`}
          >
            {busy ? "..." : "Transférer"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${variant === "mobile" ? "w-full py-3 rounded-xl" : "px-4 py-2 rounded-lg"} text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors disabled:opacity-50`}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
