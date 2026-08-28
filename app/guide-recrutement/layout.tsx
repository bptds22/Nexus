import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guide du recrutement CÉGEP",
  description:
    "Comment fonctionne le recrutement CÉGEP au Québec : bâtir ta présence en ligne, communiquer avec les recruteurs et te faire remarquer. Guide gratuit pour athlètes.",
  alternates: {
    canonical: "https://nexussports.ca/guide-recrutement",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
