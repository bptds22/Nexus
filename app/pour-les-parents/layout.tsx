import type { Metadata } from "next";

/* Le layout racine applique le gabarit `%s | Nexus`. Le suffixe demandé au
   brief est donc AJOUTÉ automatiquement : l'écrire ici produirait
   « … | Nexus | Nexus ». Le titre RENDU est bien celui du brief. */
export const metadata: Metadata = {
  title: "Pour les parents — Suivez son parcours de recrutement",
  description:
    "Suivez le parcours de recrutement de votre enfant : activité, recruteurs, consentements. Gratuit pour les parents.",
  alternates: {
    canonical: "https://nexussports.ca/pour-les-parents",
  },
  openGraph: {
    title: "Pour les parents — Suivez son parcours de recrutement | Nexus",
    description:
      "Suivez le parcours de recrutement de votre enfant : activité, recruteurs, consentements. Gratuit pour les parents.",
    url: "https://nexussports.ca/pour-les-parents",
    siteName: "Nexus",
    locale: "fr_CA",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
