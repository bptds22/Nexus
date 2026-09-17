// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ff9b0574720f3e4da653798546367a53@o4511733766619136.ingest.de.sentry.io/4511733773238352",

  /* RIEN N'EST ENVOYÉ DEPUIS LE DÉVELOPPEMENT (2026-09-17).
     Les sessions locales (`next dev`, `dev:mobile`) arrivaient dans le même
     projet Sentry que la production, sous `environment: development`, et
     noyaient les vraies erreurs — replays compris, qui brûlent le quota.

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

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.2,
  // Log ingestion off by default: it burns quota fast, and log strings could
  // carry athlete data (minors — Loi 25). Turn on deliberately, scoped.
  enableLogs: false,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 5%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.05,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
