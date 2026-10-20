import type { Metadata } from "next";

/* Server Component wrapper pour exporter metadata (la page est "use client"). */

export const metadata: Metadata = {
  title: "Pour les athlètes — Fais-toi voir, fais-toi recruter",
  description:
    "Découvre comment Nexus aide les athlètes du secondaire au Québec à se faire voir par les recruteurs des cégeps. Crée ton profil, ton coach le vérifie, les recruteurs te trouvent.",
  alternates: {
    canonical: "https://nexussports.ca/pour-les-etudiant-athlete",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
