import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs Nexus — Plans recruteurs, coachs et athlètes",
  description:
    "Nexus est gratuit pour les athlètes et les coachs. Pour les recruteurs des cégeps : forfaits Gratuit, Pro et All Star. Tarification claire, sans frais cachés.",
  alternates: {
    canonical: "https://nexussports.ca/tarifs",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
