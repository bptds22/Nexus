import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Communications marketing",
  description:
    "Infolettres, promotions et annonces de Nexus : ce que tu reçois, à quelle fréquence, et comment retirer ton consentement à tout moment.",
  alternates: {
    canonical: "https://nexussports.ca/communications-marketing",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
