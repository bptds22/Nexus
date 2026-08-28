import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Une question sur Nexus ? Écris à l'équipe québécoise derrière la plateforme de recrutement sportif qui relie les athlètes du secondaire aux programmes des CÉGEP.",
  alternates: {
    canonical: "https://nexussports.ca/contact",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
