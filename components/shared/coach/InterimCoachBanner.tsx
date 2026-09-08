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

   COMPACT MAIS PÉDAGOGIQUE (v2) : titre, une ligne de situation, puis les
   deux sections qui répondent aux seules questions que se pose un
   intérimaire — ce qu'il peut faire, et ce qui se passera quand
   l'entraîneur-chef arrivera. Sans elles, « intérimaire » est une étiquette
   sans mode d'emploi, et l'alerte inquiète sans informer.

   PAS de liste d'équipes, PAS de repli « masquer le détail » : la liste
   double Mes équipes, et un contenu qu'on replie est un contenu qu'on ne
   lit jamais. Les deux liens en bas mènent aux deux endroits où l'on AGIT.

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

          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-[#E63946]">
                Ce que tu peux faire
              </p>
              <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">
                Gérer l&apos;alignement, évaluer, répondre aux recruteurs, inviter d&apos;autres
                entraîneurs — exactement comme un entraîneur-chef.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-[#E63946]">
                Ce qui change quand l&apos;entraîneur-chef arrive
              </p>
              <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">
                Dès qu&apos;un entraîneur-chef est désigné, il devient le responsable et tu
                redeviens assistant. Tu gardes ton accès à l&apos;équipe, tes évaluations et
                tes conversations — rien n&apos;est transféré à ta place.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/coach/equipes"
              className="text-[12.5px] font-bold text-[#E63946] hover:underline">
              Va dans Mes équipes →
            </Link>
            <Link href="/coach/transferts"
              className="text-[12.5px] font-bold text-[#E63946] hover:underline">
              Ouvrir le portail de gestion →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
