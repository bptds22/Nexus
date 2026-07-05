"use client";

// components/program-page/CtaCibles.tsx
// CTA band — "Ajouter à mes cibles". LOCAL UI state only this ticket.
// TODO(bloc2): athlete_targets table + RLS + notification + idempotence +
// retrait au re-clic. No table / API / notif here.

import * as React from "react";

export default function CtaCibles({
  ctaTitle,
  notifyName,
}: {
  ctaTitle: string;
  notifyName: string;
}) {
  const [added, setAdded] = React.useState(false);

  return (
    <section className="cta-band">
      <div className="gw">SOIS LE NEX ★ SOIS LE NEX ★ SOIS LE NEX</div>
      <h2>
        Montre ton intérêt pour
        <br />
        <em>{ctaTitle}</em>
      </h2>
      <p>
        C&apos;est la première étape de ton recrutement. Sois le{" "}
        <span style={{ color: "#E63946", fontWeight: 800 }}>NEX</span>.
      </p>
      <button
        className="btn-xl"
        onClick={() => setAdded(true)}
        style={
          added
            ? { background: "#22C55E", boxShadow: "0 14px 34px rgba(34,197,94,.3)" }
            : undefined
        }
      >
        {added ? "✓ Ajoutée à mes cibles" : "⊕ Ajouter à mes cibles"}
      </button>
      <div
        style={{
          position: "relative",
          zIndex: 2,
          fontFamily: "'Outfit'",
          fontSize: 12.5,
          color: "#8A909C",
          marginTop: 14,
        }}
      >
        {added ? (
          <>
            ✓ {notifyName} a été notifié · le programme est dans{" "}
            <b style={{ color: "#B9BFC9" }}>Mon parcours → Mes cibles</b>
          </>
        ) : (
          <>
            {notifyName} sera notifié de ton intérêt · retrouve tes cibles dans{" "}
            <b style={{ color: "#B9BFC9" }}>Mon parcours</b>
          </>
        )}
      </div>
    </section>
  );
}
