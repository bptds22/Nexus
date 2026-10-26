// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  beforeBreadcrumb,
  beforeSend,
  beforeSendSpan,
  beforeSendTransaction,
  COLLECTE_SANS_DONNEES_PERSONNELLES,
} from "@/lib/sentry/nettoyage";

Sentry.init({
  dsn: "https://ff9b0574720f3e4da653798546367a53@o4511733766619136.ingest.de.sentry.io/4511733773238352",

  /* RIEN N'EST ENVOYÉ DEPUIS LE DÉVELOPPEMENT (2026-09-17).
     Les sessions locales (`next dev`, `dev:mobile`) arrivaient dans le même
     projet Sentry que la production, sous `environment: development`, et
     noyaient les vraies erreurs.

     `NODE_ENV` est le bon discriminant ici, et PAS un test sur
     l'environnement Sentry : sur Vercel, `NODE_ENV` vaut `production` en
     Preview comme en Production. Les erreurs de Preview continuent donc
     d'arriver, rangées sous `environment: preview` — c'est ce qu'on veut
     lire avant un Promote. Le build mobile (Capacitor) est lui aussi un
     build de production : les binaires rapportent toujours.

     L'étiquette `environment` reste calculée par le SDK, pas par nous :
     `options.environment || SENTRY_ENVIRONMENT || getVercelEnv() || NODE_ENV`.

     Le SDK s'initialise quand même — une erreur de configuration resterait
     donc visible en local ; seul l'ENVOI est coupé. */
  enabled: process.env.NODE_ENV === "production",

  /* BRUIT DE SCANNER CONNU (2026-10-26, issue JAVASCRIPT-NEXTJS-1V).
     « Object Not Found Matching Id:N, MethodName:update, ParamCount:4 » est
     un rejet non-Error levé par un Chromium piloté depuis .NET (CefSharp) —
     typiquement le scanner de liens d'Outlook qui ouvre le courriel de
     réclamation parent. Aucune pile, 0 utilisateur réel, chaîne absente de
     notre code. Le filtre par défaut du SDK ne couvre que
     `MethodName:simulateEvent` ; celui-ci couvre toutes les méthodes. */
  ignoreErrors: [/Object Not Found Matching Id:\d+, MethodName:\w+, ParamCount:\d+/],

  /* Session Replay RETIRÉ (décision BP, 2026-10-22) : même masqué, un
     replay enregistre la session d'un athlète, souvent mineur. */

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.2,
  // Log ingestion off by default: it burns quota fast, and log strings could
  // carry athlete data (minors — Loi 25). Turn on deliberately, scoped.
  enableLogs: false,

  /* AUCUNE DONNÉE PERSONNELLE NE PART (décision BP, 2026-10-22, Loi 25).
     Seul l'UUID Supabase est permis. Le détail de ce qui est retiré, et
     pourquoi les défauts du SDK ne suffisent pas : `lib/sentry/nettoyage.ts`. */
  sendDefaultPii: false,
  dataCollection: COLLECTE_SANS_DONNEES_PERSONNELLES,
  beforeSend,
  beforeBreadcrumb,
  beforeSendTransaction,
  beforeSendSpan,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
