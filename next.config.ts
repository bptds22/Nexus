import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const isCapacitorBuild = process.env.CAPACITOR_BUILD === "true";
// Iter 7.44 — Dev loop : `npm run dev:mobile` pose NEXT_PUBLIC_CAPACITOR_BUILD
// directement sur process.env pour faire surface IS_CAPACITOR=true côté
// client SANS déclencher le pipeline static-export (réservé au vrai
// `next build` mobile). isCapacitorRuntime gouverne UNIQUEMENT l'inline de
// la flag — output:'export' / trailingSlash / distDir restent gated sur
// isCapacitorBuild (= CAPACITOR_BUILD=true).
const isCapacitorRuntime =
  isCapacitorBuild || process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // TODO HOTFIX: retirer ces 2 blocs après résolution du bug Next 16 Turbopack
  // (validator.ts auto-généré qui référence des modules .js inexistants)
  // Ajouté pour débloquer le build mobile pendant iter 6.0b.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Make CAPACITOR_BUILD readable from client components (NEXT_PUBLIC_ prefix
  // inlines it into the client bundle at build time). isCapacitorRuntime
  // permet aussi le dev:mobile (NEXT_PUBLIC_ direct sans CAPACITOR_BUILD).
  env: {
    NEXT_PUBLIC_CAPACITOR_BUILD: isCapacitorRuntime ? "true" : "false",
  },
  // Allow each dev script to use its own build dir so dev:web (port 3000)
  // and dev:mobile (port 3001) can run simultaneously without fighting
  // over .next/dev/lock. Defaults to ".next" when unset — i.e. the plain
  // `dev` / `build` scripts behave exactly like before. Overridden to
  // "out" below when isCapacitorBuild (static export pipeline).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/**",
      },
    ],
    ...(isCapacitorBuild && { unoptimized: true }),
  },
  ...(isCapacitorBuild && {
    output: "export",
    trailingSlash: true,
    distDir: "out",
  }),
  ...(!isCapacitorBuild && {
    // `/inscription` doesn't exist as a route but 22 marketing CTAs link
    // to it (landing, tarifs, pour-les-*). Forward to /auth?mode=signup.
    // Next.js merges source query params into the destination when the
    // destination has a different query string, so ?role=X and ?ref=X
    // arrive at /auth intact.
    //
    // Capacitor static export doesn't support rewrites/redirects → this
    // block is web-build-only. On mobile, /inscription is unreachable
    // anyway since there's no nav to it.
    redirects: async () => [
      {
        source: "/inscription",
        destination: "/auth?mode=signup",
        permanent: false,
      },
    ],
  }),
};

// The Sentry plugin runs on BOTH builds — the mobile bundle needs its source
// maps uploaded too, or Android stack traces come back minified.
export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "nexus-4z",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent
  // ad-blockers. Web-only: the tunnel needs a server to rewrite /monitoring →
  // Sentry ingest, and the Capacitor build is a static export (output:'export'),
  // which has no rewrites or route handlers. Mobile talks to ingest directly —
  // no ad-blockers in a native WebView anyway.
  //
  // Note (July 2026): Turbopack does not honor tunnelRoute — verified on Next
  // 16.1.6, no /monitoring in routes-manifest.json and the client chunk points
  // straight at ingest. So this is currently inert on web too; the gate is here
  // so the mobile build stays correct if/when Sentry ships Turbopack support.
  //
  // middleware.ts matches only /partenaire/:path* — no collision with /monitoring.
  ...(isCapacitorBuild ? {} : { tunnelRoute: "/monitoring" }),

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
