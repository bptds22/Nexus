"use client";

import Link from "next/link";
import { useState } from "react";
import type { InterimTeam } from "@/lib/queries/coach/interimTeams";
import { interimBannerTitle } from "@/lib/queries/coach/interimTeams";

/* ═══════════════════════════════════════════════════════════════
   InterimCoachBanner — bandeau persistant « tu es coach intérimaire ».

   Persistant, pas fermable définitivement : l'intérim est un état à
   résoudre, pas une notification à balayer. Le repli (« Masquer ») est
   local à la session et n'écrit rien — au prochain chargement le bandeau
   revient tant que l'état dure.

   Il DISPARAÎT tout seul quand un head coach titulaire est nommé, parce
   qu'il ne porte aucun état : `teams` vient directement de
   team_coaches.role = 'head_coach_interim'.

   Rendu identique web et mobile (Lot C, train 1.4.1) — une seule
   implémentation, deux points de montage.
   ═══════════════════════════════════════════════════════════════ */

export default function InterimCoachBanner({ teams }: { teams: InterimTeam[] }) {
  const [replie, setReplie] = useState(false);

  if (teams.length === 0) return null;

  const total = teams.reduce((s, t) => s + t.athleteCount, 0);

  return (
    <div className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.07] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#F59E0B]/20 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 8v5" /><path d="M12 16.5v.01" />
            <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-head text-[14px] font-black text-white uppercase tracking-tight">
            {interimBannerTitle(teams)}
          </p>

          <p className="text-[13px] text-[#D1D5DB] mt-1">
            {total > 0
              ? `Tu réponds pour ${total > 1 ? `les ${total} athlètes` : "l'athlète"} de ${teams.length > 1 ? "ces équipes" : "cette équipe"} : les recruteurs te contactent, les demandes te reviennent.`
              : `Tu es le point de contact ${teams.length > 1 ? "de ces équipes" : "de cette équipe"}. Aucun athlète n'y est encore inscrit.`}
          </p>

          {!replie && (
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-[11px] font-bold tracking-wider uppercase text-[#F59E0B]">
                  Ce que tu peux faire
                </p>
                <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">
                  Gérer l&apos;alignement, évaluer, répondre aux recruteurs, inviter d&apos;autres
                  entraîneurs — exactement comme un entraîneur-chef.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-wider uppercase text-[#F59E0B]">
                  Ce qui change quand le head coach arrive
                </p>
                <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">
                  Dès qu&apos;un entraîneur-chef est désigné, il devient le responsable et tu
                  redeviens assistant. Tu gardes ton accès à l&apos;équipe, tes évaluations et
                  tes conversations — rien n&apos;est transféré à ta place.
                </p>
              </div>

              {teams.length > 1 && (
                <ul className="pt-1 space-y-1">
                  {teams.map((t) => (
                    <li key={t.teamId}>
                      <Link
                        href={`/coach/equipes/${t.teamId}`}
                        className="text-[12.5px] font-bold text-[#F59E0B] hover:underline"
                      >
                        {t.teamName}
                      </Link>
                      <span className="text-[12px] text-[#6b7280]">
                        {" "}· {t.athleteCount} athlète{t.athleteCount > 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-4">
            {teams.length === 1 && (
              <Link
                href={`/coach/equipes/${teams[0].teamId}`}
                className="text-[12px] font-bold text-[#F59E0B] hover:underline"
              >
                Voir l&apos;équipe →
              </Link>
            )}
            <button
              type="button"
              onClick={() => setReplie((v) => !v)}
              className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
            >
              {replie ? "En savoir plus" : "Masquer le détail"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
