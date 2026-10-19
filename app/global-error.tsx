"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import EcranErreur, { useJournalErreur } from "@/components/shared/EcranErreur";

/* La mise en page racine elle-même a planté : on rend notre propre
   <html>, avec le même écran que app/error.tsx (plus d'écran noir). */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useJournalErreur(error, "racine");
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr" data-theme="dark">
      <body style={{ margin: 0, background: "#111317" }}>
        <EcranErreur />
      </body>
    </html>
  );
}
