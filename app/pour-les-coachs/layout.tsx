import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pour les coachs — Outils de recrutement et visibilité",
  description:
    "Les outils dont tu as besoin pour faire briller tes athlètes auprès des recruteurs CÉGEP. Profils complets, évaluations, suivi du recrutement.",
  alternates: {
    canonical: "https://nexussports.ca/pour-les-coachs",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
