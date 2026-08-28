import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Les conditions d'utilisation de Nexus : droits et obligations des athlètes, coachs et recruteurs, règles de compte et de contenu. Alignées sur la Loi 25 du Québec.",
  alternates: {
    canonical: "https://nexussports.ca/conditions",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
