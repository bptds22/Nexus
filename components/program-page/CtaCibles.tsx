"use client";

// components/program-page/CtaCibles.tsx
// CTA band — "Ajouter à mes cibles". Shares ProgramPage's single targets state
// (= S1 follow button) via props — no local state, no second backend.
//
// LE « NOTIFIÉ » A ÉTÉ RETIRÉ (lot 0, 2026-09-22). Cette bande affichait
// « {nom} a été notifié » / « {nom} sera notifié de ton intérêt ». C'était
// FAUX en production : rien n'écoute `athlete_targets`, aucune notification
// n'est émise, et aucun recruteur ne pouvait même LIRE la ligne (la table
// n'a qu'une policy, « Athletes manage own targets »). Le `TODO(bloc2): …
// notification …` qui vivait ici n'a jamais été levé — la promesse, elle,
// était partie en prod.
//
// La phrase la remplace par ce qui va RÉELLEMENT se produire, depuis la
// source unique `lib/cibles/divulgation.ts` (six surfaces, une phrase).
// La prop `notifyName` a disparu avec la promesse : elle ne servait qu'à
// elle. `content.ctaNotifyName` reste dans le type de contenu (l'éditeur
// de page l'écrit encore) mais plus personne ne le lit ici.

import * as React from "react";
import { GhostWords } from "@/components/shared/dna";
import { divulgationCible } from "@/lib/cibles/divulgation";

export default function CtaCibles({
  ctaTitle,
  inTargets,
  onToggleTargets,
}: {
  ctaTitle: string;
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
        {divulgationCible(inTargets)}
        {inTargets ? (
          <>
            {" "}· le programme est dans{" "}
            <b style={{ color: "var(--p-soft)" }}>Mon parcours → Mes cibles</b>
          </>
        ) : (
          <>
            {" "}· retrouve tes cibles dans{" "}
            <b style={{ color: "var(--p-soft)" }}>Mon parcours</b>
          </>
        )}
      </div>
    </section>
  );
}
