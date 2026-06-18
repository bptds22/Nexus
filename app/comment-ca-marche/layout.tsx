import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comment fonctionne Nexus — Guide étape par étape",
  description:
    "Le parcours complet du recrutement sportif au Québec : du profil athlète à la signature CÉGEP. Découvre comment Nexus connecte coachs, athlètes et recruteurs.",
  alternates: {
    canonical: "https://nexussports.ca/comment-ca-marche",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
