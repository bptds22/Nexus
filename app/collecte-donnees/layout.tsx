import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collecte et traitement des données",
  description:
    "Le détail des données recueillies par Nexus, leur finalité, leur durée de conservation et les tiers impliqués. Transparence exigée par la Loi 25 du Québec.",
  alternates: {
    canonical: "https://nexussports.ca/collecte-donnees",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
