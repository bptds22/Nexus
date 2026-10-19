"use client";

/* Filet de sécurité sous la mise en page racine (web et appli) : jamais
   d'écran noir, un message clair et « Recharger ». Voir EcranErreur. */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import EcranErreur, { useJournalErreur } from "@/components/shared/EcranErreur";

export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useJournalErreur(error, "page");
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return <EcranErreur onReessayer={reset} />;
}
