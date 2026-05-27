import type { NextConfig } from "next";

const isCapacitorBuild = process.env.CAPACITOR_BUILD === "true";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Make CAPACITOR_BUILD readable from client components (NEXT_PUBLIC_ prefix
  // inlines it into the client bundle at build time).
  env: {
    NEXT_PUBLIC_CAPACITOR_BUILD: isCapacitorBuild ? "true" : "false",
  },
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

export default nextConfig;
