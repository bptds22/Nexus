import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Nexus — La démo recruteurs, en 35 minutes" },
  description:
    "L'enregistrement de la démo recruteurs Nexus du 12 octobre : Mon processus, le calendrier des matchs, le profil complet, les listes et la messagerie encadrée. Recevez votre lien.",
  alternates: { canonical: "https://nexussports.ca/12octobre" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
