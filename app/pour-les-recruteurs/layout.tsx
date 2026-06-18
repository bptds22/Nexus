import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pour les recruteurs CÉGEP — Trouve les athlètes du Québec",
  description:
    "La plateforme officielle pour les recruteurs CÉGEP du Québec. Recherche avancée, pipeline, messagerie directe avec les coachs.",
  alternates: {
    canonical: "https://nexussports.ca/pour-les-recruteurs",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
