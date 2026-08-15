import type { MetadataRoute } from "next";

/* ═══════════════════════════════════════════════════════════════
   Nexus — sitemap.xml dynamique
   Seules les pages PUBLIQUES (marketing + légal) sont listées.
   Les routes auth, dashboard, et app interne sont exclues via robots.ts.
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-static";

const BASE_URL = "https://nexussports.ca";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastMod = new Date();

  // Pages persona — value haute, contenu marketing principal
  const personaPages: MetadataRoute.Sitemap = [
    "pour-les-etudiant-athlete",
    "pour-les-coachs",
    "pour-les-recruteurs",
  ].map((slug) => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: lastMod,
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  // Pages info — value moyenne, contenu informationnel
  const infoPages: MetadataRoute.Sitemap = [
    "a-propos",
    "aide",
    "comment-ca-marche",
    "guide-recrutement",
    "tarifs",
    "roadmap",
    "contact",
  ].map((slug) => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: lastMod,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // Pages légales — value basse mais nécessaires (compliance Loi 25)
  const legalPages: MetadataRoute.Sitemap = [
    "conditions",
    "confidentialite",
    "collecte-donnees",
    "communications-marketing",
  ].map((slug) => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: lastMod,
    changeFrequency: "yearly" as const,
    priority: 0.4,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: lastMod,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...personaPages,
    ...infoPages,
    ...legalPages,
  ];
}
