"use client";

import Link from "next/link";
import type { InterimTeam } from "@/lib/queries/coach/interimTeams";
import { interimBannerTitle } from "@/lib/queries/coach/interimTeams";

/* ═══════════════════════════════════════════════════════════════
   InterimCoachBanner — alerte « tu es entraîneur-chef par intérim ».

   TRAITEMENT ALERTE, pas notification : rouge Nexus #E63946, bordure
   pleine, fond à faible opacité. Il doit trancher net avec le reste du
   tableau de bord — l'intérim est un état à résoudre, et le premier
   regard doit produire un « qu'est-ce qui se passe ».

   COMPACT, délibérément : titre + une ligne + un lien. Pas de liste
   d'équipes, pas de repli « masquer le détail ». Le détail vit dans
   Mes équipes, où se trouvent aussi les actions ; un bandeau qui
   explique tout devient un bandeau qu'on ne lit plus.

   Sans état propre — il disparaît de lui-même dès qu'un entraîneur-chef
   titulaire est nommé, parce que `teams` est le reflet direct de
   team_coaches.role = 'head_coach_interim'.

   Rendu identique web et mobile (train 1.4.1) : une implémentation,
   deux points de montage.
   ═══════════════════════════════════════════════════════════════ */

export default function InterimCoachBanner({ teams }: { teams: InterimTeam[] }) {
  if (teams.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#E63946] bg-[#E63946]/[0.11] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#E63946]/20 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 8v5" /><path d="M12 16.5v.01" />
            <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-head text-[14px] font-bold text-white uppercase tracking-tight">
            {interimBannerTitle(teams)}
          </p>

          <p className="text-[13px] text-[#D1D5DB] mt-1">
            Tu réponds pour les athlètes de {teams.length > 1 ? "ces équipes" : "cette équipe"} :
            recruteurs et demandes te reviennent.
          </p>

          <Link
            href="/coach/equipes"
            className="inline-block mt-2 text-[12.5px] font-bold text-[#E63946] hover:underline"
          >
            Va dans Mes équipes pour voir tes équipes et modifier ton rôle →
          </Link>
        </div>
      </div>
    </div>
  );
}
