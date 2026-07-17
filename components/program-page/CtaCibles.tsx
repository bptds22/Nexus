"use client";

// components/program-page/CtaCibles.tsx
// CTA band — "Ajouter à mes cibles". Shares ProgramPage's single targets state
// (= S1 follow button) via props — no local state, no second backend.
// TODO(bloc2): athlete_targets table + RLS + notification + idempotence.

import * as React from "react";
import { GhostWords } from "@/components/shared/dna";

export default function CtaCibles({
  ctaTitle,
  notifyName,
  inTargets,
  onToggleTargets,
}: {
  ctaTitle: string;
  notifyName: string;
  inTargets: boolean;
  onToggleTargets: () => void;
}) {
  return (
    <section className="cta-band">
      <GhostWords
        items={[{
          variant: "word",
          text: "SOIS LE NEX ★ SOIS LE NEX ★ SOIS LE NEX",
          left: "-2%",
          top: "12%",
          fontSize: "clamp(70px,10vw,150px)",
        }]}
      />
      <h2>
        Montre ton intérêt pour
        <br />
        <em>{ctaTitle}</em>
      </h2>
      <p>
        C&apos;est la première étape de ton recrutement. Sois le{" "}
        <span style={{ color: "var(--nx-red)", fontWeight: 800 }}>NEX</span>.
      </p>
      <button
        className="btn-xl"
        onClick={onToggleTargets}
        style={
          inTargets
            ? { background: "var(--green)", boxShadow: "0 14px 34px rgba(34,197,94,.3)" }
            : undefined
        }
      >
        {inTargets ? "✓ Ajoutée à mes cibles" : "⊕ Ajouter à mes cibles"}
      </button>
      <div
        style={{
          position: "relative",
          zIndex: 2,
          fontFamily: "'Outfit'",
          fontSize: 14.5,
          color: "var(--p-mut)",
          marginTop: 14,
        }}
      >
        {inTargets ? (
          <>
            ✓ {notifyName} a été notifié · le programme est dans{" "}
            <b style={{ color: "var(--p-soft)" }}>Mon parcours → Mes cibles</b>
          </>
        ) : (
          <>
            {notifyName} sera notifié de ton intérêt · retrouve tes cibles dans{" "}
            <b style={{ color: "var(--p-soft)" }}>Mon parcours</b>
          </>
        )}
      </div>
    </section>
  );
}
