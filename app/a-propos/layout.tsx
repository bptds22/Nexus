import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "À propos de Nexus — Notre mission québécoise",
  description:
    "Nexus, c'est la plateforme québécoise du recrutement sportif. Pensée pour les athlètes, coachs et recruteurs du RSEQ et des CÉGEP. Hébergée au Québec, conforme Loi 25.",
  alternates: {
    canonical: "https://nexussports.ca/a-propos",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
