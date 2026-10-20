import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "À propos de Nexus — Notre mission québécoise",
  description:
    "Nexus, la plateforme québécoise du recrutement sportif, fondée par un ancien athlète et un ancien coach. Données hébergées à Montréal, conforme à la Loi 25.",
  alternates: {
    canonical: "https://nexussports.ca/a-propos",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
