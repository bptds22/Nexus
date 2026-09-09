"use client";

import Link from "next/link";
import { useChildActivity } from "@/lib/queries/parent/useChildActivity";

/* ═══════════════════════════════════════════════════════════════
   Portal parental — Lot 1c. Page Activité (web only).

   Compteurs ANONYMES via get_child_activity(athlete_id) :
   - vues totales du profil
   - nombre de recruteurs l'ayant mis en favori
   - mini-graphe hebdo des vues (12 dernières semaines)
   Aucune identité de recruteur / collège n'est jamais exposée.
   ═══════════════════════════════════════════════════════════════ */

const card = "bg-[#1A1D24] border border-white/5 rounded-xl";

export default function ParentActivitePage() {
  /* Lecture déplacée dans useChildActivity — MÊME RPC, mêmes libellés
     d'erreur, même « premier enfant ». La carte Résumé de l'accueil lit la
     même source : deux copies auraient divergé au premier changement. */
  const { data, loading, loadError } = useChildActivity();

  if (loading) return <p className="text-sm text-[#6B7280]">Chargement…</p>;
  if (loadError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className={`${card} p-5`}><p className="text-sm text-[#9CA3AF]">{loadError}</p></div>
      </div>
    );
  }
  if (!data) return null;

  const weekly = data.weekly ?? [];
  const maxCount = Math.max(1, ...weekly.map((w) => w.count));

  return (
    <div className="space-y-6">
      <BackLink />

      <div>
        <h1 className="font-head text-2xl font-bold text-white uppercase tracking-tight">Activité</h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">Intérêt des recruteurs pour le profil de votre enfant. Ces chiffres sont anonymes — aucune identité n&apos;est révélée.</p>
      </div>

      {/* ── Compteurs ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`${card} p-5`}>
          <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Vues du profil</p>
          <p className="font-head text-4xl font-black text-white mt-2 tabular-nums">{data.views_total}</p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Recruteurs favoris</p>
          <p className="font-head text-4xl font-black text-[#E63946] mt-2 tabular-nums">{data.favorites_total}</p>
        </div>
      </div>

      {/* ── Mini-graphe hebdo ── */}
      <div className={`${card} p-5`}>
        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-4">Vues par semaine</p>
        {weekly.length === 0 ? (
          <p className="text-[13px] text-[#6B7280]">Aucune vue enregistrée pour le moment.</p>
        ) : (
          <div className="flex items-end gap-1.5 h-32">
            {weekly.map((w) => (
              <div key={w.week_start} className="flex-1 flex flex-col items-center gap-1.5 min-w-0" title={`${w.count} vue${w.count > 1 ? "s" : ""} — semaine du ${fmtWeek(w.week_start)}`}>
                <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                  <div
                    className="w-full max-w-[24px] rounded-t bg-[#E63946]/70"
                    style={{ height: `${Math.round((w.count / maxCount) * 100)}%`, minHeight: w.count > 0 ? "4px" : "0" }}
                  />
                </div>
                <span className="text-[9px] text-[#6B7280] tabular-nums whitespace-nowrap">{fmtWeekShort(w.week_start)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtWeek(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}
function fmtWeekShort(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-CA", { day: "2-digit", month: "2-digit" });
}

function BackLink() {
  return (
    <Link href="/parent" className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      Retour
    </Link>
  );
}
