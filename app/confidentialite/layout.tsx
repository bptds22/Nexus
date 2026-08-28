import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment Nexus recueille, utilise et protège tes renseignements personnels. Droits d'accès, de rectification et de retrait, conformément à la Loi 25 du Québec.",
  alternates: {
    canonical: "https://nexussports.ca/confidentialite",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
