"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { mockDeactivationEvents, mockCoachOverviews } from "@/lib/mock";

/* ══════════════════════════════════════════════════════════════
   PAGE 3 — Réassigner un athlète (detail)
   Route: /directeur/reassignation/[athleteId]
══════════════════════════════════════════════════════════════ */

export default function ReassignAthletePage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const router = useRouter();
  const [selectedCoach, setSelectedCoach] = useState("");
  const [confirming, setConfirming] = useState(false);

  /* Find athlete across deactivation events */
  const athleteInfo = useMemo(() => {
    for (const e of mockDeactivationEvents) {
      const a = e.orphanedAthletes.find((x) => x.id === athleteId);
      if (a) return { ...a, previousCoach: e.coachName, previousCoachId: e.coachId };
    }
    return null;
  }, [athleteId]);

  /* Active coaches for reassignment */
  const activeCoaches = mockCoachOverviews.filter((c) => c.accountStatus === "ACTIF");

  function handleConfirm() {
    setConfirming(true);
    setTimeout(() => {
      router.push("/directeur/reassignation");
    }, 600);
  }

  if (!athleteInfo) {
    return (
      <div className="px-6 sm:px-10 py-16 max-w-[700px] mx-auto text-center">
        <p className="text-[#6B7280] text-[14px]">Athlète introuvable.</p>
        <Link href="/directeur/reassignation" className="text-[13px] text-[#E63946] hover:underline mt-4 inline-block">
          ← Retour à la réassignation
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[900px] mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/directeur/reassignation"
        className="text-[13px] text-[#6B7280] hover:text-white transition-colors inline-flex items-center gap-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Retour à la réassignation
      </Link>

      <h1 className="text-[22px] font-head font-bold text-white">
        Réassigner {athleteInfo.name}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — Athlete summary */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5">
          <h2 className="text-[14px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-4">
            Profil athlète
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-[#2A2D35] flex items-center justify-center shrink-0">
              <span className="text-[16px] font-bold text-[#6B7280]">
                {athleteInfo.name.split(" ").map((n) => n[0]).join("")}
              </span>
            </div>
            <div>
              <p className="text-[16px] font-bold text-white">{athleteInfo.name}</p>
              <p className="text-[13px] text-[#9CA3AF]">{athleteInfo.sport}</p>
            </div>
          </div>

          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between py-2 border-b border-[#2A2D35]">
              <span className="text-[#6B7280]">Ancien entraîneur</span>
              <span className="text-[#9CA3AF] font-medium">{athleteInfo.previousCoach}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#2A2D35]">
              <span className="text-[#6B7280]">Statut actuel</span>
              <span className="inline-flex items-center gap-1.5 text-[#F59E0B] font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Orphelin
              </span>
            </div>
          </div>
        </div>

        {/* Right — Coach selection */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5">
          <h2 className="text-[14px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-4">
            Choisir un entraîneur
          </h2>
          <div className="space-y-2">
            {activeCoaches.map((c) => {
              const isSelected = selectedCoach === c.id;
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-[#E63946]/50 bg-[rgba(230,57,70,0.06)]"
                      : "border-[#2A2D35] hover:border-[#4a4d56]"
                  }`}
                >
                  <input
                    type="radio"
                    name="coach"
                    value={c.id}
                    checked={isSelected}
                    onChange={() => setSelectedCoach(c.id)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "border-[#E63946]" : "border-[#4a4d56]"
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-[#E63946]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-white">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-[11px] text-[#6B7280]">
                      {c.sport} · {c.athleteCount} athlètes
                    </p>
                  </div>
                  <span className="text-[12px] text-[#6B7280] shrink-0">
                    {c.athleteCount} athl.
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg text-[13px] font-bold border border-[rgba(255,255,255,0.15)] text-[#9CA3AF] hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedCoach || confirming}
              className="px-4 py-2 rounded-lg text-[13px] font-bold bg-[#E63946] text-white hover:bg-[#D93C3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {confirming ? "Réassignation..." : "Confirmer la réassignation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
