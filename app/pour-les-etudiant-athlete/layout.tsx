import type { Metadata } from "next";

/* Server Component wrapper pour exporter metadata (la page est "use client"). */

const TITLE = "Pour les athlètes — Deviens impossible à ignorer";
const DESCRIPTION =
  "Ton profil, tes stats, ta vidéo — vus par les recruteurs des 70 CÉGEPs du RSEQ, partout au Québec. Gratuit pour les athlètes, ton coach valide ton profil.";
const PAGE_URL = "https://nexussports.ca/pour-les-etudiant-athlete";

export const metadata: Metadata = {
  metadataBase: new URL("https://nexussports.ca"),
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/pour-les-etudiant-athlete",
  },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    url: PAGE_URL,
    siteName: "Nexus",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/brand/logo-white-red.png", alt: "Nexus" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/brand/logo-white-red.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
