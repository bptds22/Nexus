"use client";

/* ═══════════════════════════════════════════════════════════════
   JoinCodeField — « Tu as un code d'équipe ? »

   Champ de saisie + résolution + confirmation VISUELLE de l'équipe avant tout
   rattachement. L'athlète doit voir le nom de l'équipe et de l'école avant de
   valider : un code mal recopié qui pointerait la mauvaise équipe se voit ici,
   pas après coup dans son profil.

   Le champ ne rattache RIEN lui-même. Il remonte l'équipe résolue et le code
   normalisé au parent, qui décide quand appeler apply_team_attachment (à
   l'étape équipe de l'onboarding, c'est au submit final).
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  resolveTeamJoinToken,
  normalizeJoinCode,
  isPlausibleJoinCode,
  type ResolvedJoinTeam,
} from "@/lib/queries/athlete/teamAttachment";

interface Props {
  /** Code pré-rempli (arrivée depuis /join). */
  initialCode?: string;
  /** Appelé quand l'athlète valide une équipe résolue, ou l'efface (null). */
  onResolved: (v: { code: string; team: ResolvedJoinTeam } | null) => void;
}

export default function JoinCodeField({ initialCode = "", onResolved }: Props) {
  const [open, setOpen] = useState(!!initialCode);
  const [code, setCode] = useState(normalizeJoinCode(initialCode));
  const [team, setTeam] = useState<ResolvedJoinTeam | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function check() {
    setError("");
    setTeam(null);
    onResolved(null);

    const clean = normalizeJoinCode(code);
    if (!isPlausibleJoinCode(clean)) {
      setError("Un code fait 6 à 8 caractères. Il ne contient ni 0, ni O, ni 1, ni I, ni L.");
      return;
    }

    setBusy(true);
    const resolved = await resolveTeamJoinToken(createClient(), clean);
    setBusy(false);

    // Code inexistant (null) et code invalide (isValid false) reçoivent la
    // MÊME copie : le serveur masque déjà les détails d'un code révoqué ou
    // expiré, l'UI ne doit pas rétablir la distinction.
    if (!resolved || !resolved.isValid) {
      setError("Ce code n'est pas valide. Vérifie-le auprès de ton entraîneur.");
      return;
    }
    setTeam(resolved);
    onResolved({ code: clean, team: resolved });
  }

  function clear() {
    setTeam(null);
    setCode("");
    setError("");
    onResolved(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-semibold text-[#E63946] underline underline-offset-2"
      >
        Tu as un code d&apos;équipe ?
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-4">
      <label htmlFor="join-code" className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">
        Code d&apos;équipe
      </label>

      {team ? (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-3">
          {team.schoolLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.schoolLogoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-white">{team.teamName}</div>
            <div className="truncate text-[12px] text-[#9CA3AF]">
              {[team.schoolName, team.sportName, team.season].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button
            type="button"
            onClick={clear}
            className="shrink-0 text-[12px] font-semibold text-[#9CA3AF] underline"
          >
            Changer
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2 flex gap-2">
            <input
              id="join-code"
              value={code}
              onChange={(e) => setCode(normalizeJoinCode(e.target.value))}
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="Ex. V9A9B7HM"
              className="min-w-0 flex-1 rounded-xl border border-[#2D3748] bg-[#111317] px-3 py-2.5 font-mono text-[16px] tracking-[0.2em] text-white placeholder:tracking-normal placeholder:font-sans placeholder:text-[#4a4d56]"
            />
            <button
              type="button"
              onClick={check}
              disabled={busy || !code}
              className="shrink-0 rounded-xl bg-[#E63946] px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "…" : "Vérifier"}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-[#6b7280]">
            Ton entraîneur te l&apos;a donné à l&apos;oral ou par message.
          </p>
        </>
      )}

      {error ? <p className="mt-2 text-[12px] text-[#EF4444]">{error}</p> : null}
    </div>
  );
}
