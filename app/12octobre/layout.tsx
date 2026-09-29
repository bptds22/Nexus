import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Nexus — Démo recruteurs, 12 octobre" },
  description:
    "Le lundi 12 octobre à midi, on vous montre Nexus en direct : les outils, le processus, la recherche. Inscrivez-vous, recevez l'enregistrement ou réservez une présentation 1:1.",
  alternates: { canonical: "https://nexussports.ca/12octobre" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
