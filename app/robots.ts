import type { MetadataRoute } from "next";

/* ═══════════════════════════════════════════════════════════════
   Nexus — robots.txt dynamique
   Autorise l'indexation des pages publiques marketing/légal,
   bloque les routes auth, app interne (dashboards), API.
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/auth/",
          "/api/",
          "/admin/",
          "/onboarding",
          "/coach/",
          "/athlete/",
          "/recruteur/",
          "/partenaire/",
          "/partenaires/",
          "/compte-desactive",
          "/maintenance",
          "/mot-de-passe-oublie",
        ],
      },
    ],
    sitemap: "https://nexussports.ca/sitemap.xml",
  };
}
