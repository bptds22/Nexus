import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pour les coachs — Outils de recrutement et visibilité",
  description:
    "Crée ton équipe, vérifie et évalue tes athlètes, et reste dans la boucle avec les recruteurs des cégeps. Gratuit pour les coachs.",
  alternates: {
    canonical: "https://nexussports.ca/pour-les-coachs",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
