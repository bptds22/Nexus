"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   /athlete/mon-parcours — "L'été où tout se joue"

   Chunk 2: page scaffold, hero, and the season timeline spine.
   Modules (card, Mes Cibles, readiness) land in chunks 3-5.

   Athlete voice throughout — tutoiement, never a counsellor tone.
   The timeline uses a season label ("2026-2027"), no date ranges.
═══════════════════════════════════════════════════════════════ */

const STEPS = [
  { label: "Entraînement d'été" },
  { label: "Camps & essais" },
  { label: "Saison Sec 5" },
  { label: "Fenêtre de signature" },
];

// v1: the current step is static — the page ships for the summer
// prep window, so the athlete is at "Camps & essais".
const CURRENT_STEP = 1;

function readinessColor(pct: number): string {
  if (pct < 40) return "#EF4444";
  if (pct < 70) return "#F59E0B";
  return "#22C55E";
}

export default function MonParcoursPage() {
  const [firstName, setFirstName] = useState("");
  const [profileCompletion, setProfileCompletion] = useState(0);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("athletes")
        .select("first_name, profile_completion")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setFirstName((data.first_name as string) || "");
        setProfileCompletion((data.profile_completion as number) || 0);
      }
    })();
  }, []);

  const pctColor = readinessColor(profileCompletion);
  // Track spans node-0 centre → node-3 centre (left/right inset 12.5%).
  // Fill reaches the current node: one 25%-of-container segment per step.
  const fillWidth = (CURRENT_STEP * 75) / (STEPS.length - 1);

  const steps = STEPS.map((s, i) => ({
    ...s,
    state: i < CURRENT_STEP ? "done" : i === CURRENT_STEP ? "current" : "upcoming",
  }));

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-8">
      {/* ── Hero ── */}
      <div>
        <div className="inline-flex items-center gap-2.5 mb-4">
          <span className="w-8 h-px bg-[#E63946]" />
          <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.22em] uppercase text-[#E63946]">
            Saison 2026–2027 · ta dernière au secondaire
          </span>
        </div>
        <h1 className="font-head text-4xl sm:text-5xl font-black text-white uppercase tracking-tight leading-[0.95]">
          Mon Parcours
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[#9CA3AF] leading-relaxed mt-4 max-w-2xl">
          {firstName ? `${firstName}, l'été` : "L'été"} où tout se joue. Prépare ta saison,
          construis ta vitrine et sois prêt quand le CÉGEP cogne à ta porte.
        </p>
      </div>

      {/* ── Timeline spine ── */}
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 sm:p-8">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-9">
          <h2 className="font-head text-lg sm:text-xl font-black text-white uppercase tracking-tight">
            Ta ligne du temps vers le CÉGEP
          </h2>
          <div className="flex items-baseline gap-1.5">
            <span className="font-head text-3xl font-black leading-none" style={{ color: pctColor }}>
              {profileCompletion}%
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">
              prêt
            </span>
          </div>
        </div>

        {/* Spine — 3 stacked rows: markers · track+nodes · labels */}
        <div className="space-y-2.5">
          {/* Row 1 — "Tu es ici" marker */}
          <div className="flex">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 flex justify-center">
                {step.state === "current" && (
                  <span className="px-2 py-0.5 rounded-full bg-[#E63946] text-white text-[9px] font-black uppercase tracking-[0.12em] whitespace-nowrap">
                    Tu es ici
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Row 2 — track + nodes */}
          <div className="relative h-7">
            <div className="absolute left-[12.5%] right-[12.5%] top-1/2 -translate-y-1/2 h-[3px] bg-[#2D3748] rounded-full" />
            <div
              className="absolute left-[12.5%] top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-gradient-to-r from-[#E63946]/60 to-[#E63946]"
              style={{ width: `${fillWidth}%` }}
            />
            <div className="relative h-full flex">
              {steps.map((step, i) => (
                <div key={i} className="flex-1 flex items-center justify-center">
                  <span
                    className={
                      step.state === "done"
                        ? "w-7 h-7 rounded-full bg-[#E63946] flex items-center justify-center"
                        : step.state === "current"
                          ? "w-7 h-7 rounded-full bg-[#E63946] ring-4 ring-[#E63946]/25 flex items-center justify-center"
                          : "w-7 h-7 rounded-full bg-[#13151a] border-2 border-[#2D3748]"
                    }
                  >
                    {step.state === "done" && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                    {step.state === "current" && (
                      <span className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3 — labels */}
          <div className="flex">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 px-1 text-center">
                <p
                  className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.06em] leading-tight ${
                    step.state === "upcoming" ? "text-[#6b7280]" : "text-white"
                  }`}
                >
                  {step.label}
                </p>
                {step.state === "current" && (
                  <p className="mt-1 text-[10px] text-[#6b7280]">Saison 2026-2027</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
