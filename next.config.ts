import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/**",
      },
    ],
  },
  // `/inscription` doesn't exist as a route but 22 marketing CTAs link
  // to it (landing, tarifs, pour-les-*). Forward to /auth?mode=signup.
  // Next.js merges source query params into the destination when the
  // destination has a different query string, so ?role=X and ?ref=X
  // arrive at /auth intact.
  redirects: async () => [
    {
      source: "/inscription",
      destination: "/auth?mode=signup",
      permanent: false,
    },
  ],
};

export default nextConfig;
