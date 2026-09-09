"use client";

import Link from "next/link";
import { useChildActivity } from "@/lib/queries/parent/useChildActivity";
import { useParentSummary, notifLabel } from "@/lib/queries/parent/useParentSummary";

/* ═══════════════════════════════════════════════════════════════
   ParentSummaryCard — le mock de la vitrine, devenu l'écran réel.

   Trois zones, chacune CLIQUABLE vers sa page :
     Activité du profil   → /parent/activite
     Consentements        → /parent/consentements
     Nouveau              → /parent/notifications

   RÈGLES DE CONTENU, non négociables :

   · ANONYMAT. Aucune identité de recruteur n'apparaît, jamais. Le libellé
     vient du TYPE de notification (notifLabel), pas des champs title/message
     de la ligne — ceux-là sont écrits par des triggers et pourraient
     contenir autre chose demain. La page Activité pose déjà la règle :
     « Aucune identité de recruteur / collège n'est jamais exposée. »

   · ÉTATS VIDES HONNÊTES. Aucune barre inventée : si la semaine est vide,
     on l'écrit. Un graphe décoratif sur des données absentes ferait croire
     à une activité qui n'existe pas — exactement ce qu'un parent ne doit
     pas déduire.

   · LA ZONE « NOUVEAU » N'EXISTE QUE S'IL Y A DU NOUVEAU. Rien de non lu →
     la carte vit à deux zones. Pas de « aucune notification » : une zone
     d'alerte permanente cesse d'alerter.

   Aucune écriture, aucune nouvelle RPC — les trois lectures sont celles des
   pages correspondantes, factorisées en hooks.
   ═══════════════════════════════════════════════════════════════ */

const ZONE = "rounded-xl border border-white/[0.06] bg-[#111317] p-5 block transition-colors";

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function ParentSummaryCard() {
  const { data, loading: actLoading, athleteId } = useChildActivity();
  const { consentCount, latestUnread } = useParentSummary(athleteId);

  // La carte ne s'affiche pas tant que l'activité n'est pas résolue : un
  // squelette vaut mieux qu'un graphe à zéro qui se remplit ensuite.
  if (actLoading) {
    return <div className="bg-[#1A1D24] border border-white/5 rounded-xl h-[220px] animate-pulse" />;
  }

  const weekly = data?.weekly ?? [];
  const maxCount = Math.max(1, ...weekly.map((w) => w.count));
  const aucuneActivite = weekly.length === 0 || weekly.every((w) => w.count === 0);

  return (
    <section className="bg-[#1A1D24] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <p className="text-[11px] font-bold text-[#6b7280] uppercase tracking-[0.2em]">Résumé</p>
      </div>

      <div className="p-4 grid gap-3 sm:grid-cols-2">
        {/* ── Activité ──────────────────────────────────────── */}
        <Link href="/parent/activite" className={`${ZONE} sm:col-span-2 hover:border-[#E63946]/40`}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-bold text-white">Activité du profil</p>
            <p className="text-[11px] text-[#6b7280] uppercase tracking-wider">12 dernières semaines</p>
          </div>

          {aucuneActivite ? (
            <p className="text-[13px] text-[#6B7280] mt-3">Aucune activité cette semaine.</p>
          ) : (
            <div className="mt-4 flex items-end gap-[6px] h-[86px]" aria-hidden="true">
              {weekly.map((w) => (
                <div
                  key={w.week_start}
                  className="flex-1 rounded-t-[3px] bg-[#E63946]/70"
                  style={{
                    height: `${Math.round((w.count / maxCount) * 100)}%`,
                    minHeight: w.count > 0 ? "4px" : "2px",
                  }}
                />
              ))}
            </div>
          )}
        </Link>

        {/* ── Consentements ─────────────────────────────────── */}
        <Link href="/parent/consentements" className={`${ZONE} hover:border-[#22C55E]/40`}>
          <p className="text-[11px] font-bold text-[#6b7280] uppercase tracking-[0.18em]">Consentements</p>
          <div className="flex items-center gap-2 mt-2.5">
            <CheckIcon />
            <p className="text-[15px] font-bold text-white">
              {consentCount === null
                ? "—"
                : `${consentCount} autorisation${consentCount > 1 ? "s" : ""} active${consentCount > 1 ? "s" : ""}`}
            </p>
          </div>
        </Link>

        {/* ── Nouveau — présent SEULEMENT s'il y a du non-lu ── */}
        {latestUnread && (
          <Link
            href="/parent/notifications"
            className="rounded-xl border border-[#E63946]/25 bg-[#E63946]/[0.06] p-5 block transition-colors hover:border-[#E63946]/60"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E63946]" aria-hidden="true" />
              <p className="text-[11px] font-bold text-[#E63946] uppercase tracking-[0.18em]">Nouveau</p>
            </div>
            <p className="text-[14px] text-white/80 mt-2 leading-snug">
              {notifLabel(latestUnread.type)}
            </p>
          </Link>
        )}
      </div>
    </section>
  );
}
