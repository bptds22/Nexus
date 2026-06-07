import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs Nexus — Plans recruteurs, coachs et athlètes",
  description:
    "Plans Free, Starter et Pro pour les recruteurs CÉGEP. Coachs gratuits avec options Pro et All Star. Tarification claire, sans frais cachés.",
  alternates: {
    canonical: "https://nexussports.ca/tarifs",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
