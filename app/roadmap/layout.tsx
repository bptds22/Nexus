import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roadmap Nexus — Ce qui s'en vient sur la plateforme",
  description:
    "Découvre les prochaines fonctionnalités de Nexus : nouveaux portails, intégrations RSEQ, outils de recrutement avancés et améliorations en continu.",
  alternates: {
    canonical: "https://nexussports.ca/roadmap",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
