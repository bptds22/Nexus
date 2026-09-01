import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import MaStoryClient from "./MaStoryClient";

/* ═══════════════════════════════════════════════════════════════
   /ma-story — générateur de stories Instagram, 100 % côté client.

   Port 1:1 de la référence validée ma-story.html
   (sha256 0fec4119ed19f36db4c7ca0a11c825ceb510c0cd2fd123a59be54fbcfb514fc9).

   La photo ne quitte jamais le navigateur : lecture via
   URL.createObjectURL, composition au canvas, export toBlob.
   Aucun fetch, aucun upload, aucune persistance.

   Outfit est chargée ici, localement à la route, parce que
   l'instance globale (app/layout.tsx) ne porte pas le 800 — requis
   par les titres 96 px des gabarits « match » et « travail ».
   Même motif que app/carte/page.tsx : aucune écriture hors de la route.
═══════════════════════════════════════════════════════════════ */

const outfitStory = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-story",
  display: "swap",
});

export const metadata: Metadata = {
  // `absolute` échappe au template "%s | Nexus" du layout racine, qui
  // produirait sinon « … — Nexus | Nexus ».
  title: { absolute: "Crée ta story d'athlète — Nexus" },
  description:
    "Crée et télécharge ta story Instagram d'athlète : jour de match, résultat, stats, entraînement. Ta photo reste sur ton appareil.",
  alternates: { canonical: "https://nexussports.ca/ma-story" },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    url: "https://nexussports.ca/ma-story",
    siteName: "Nexus",
    title: "Crée ta story d'athlète — Nexus",
    description:
      "Choisis ton format, ajoute ta photo, télécharge. Rien n'est envoyé nulle part.",
  },
};

export default function MaStoryPage() {
  return <MaStoryClient fontVariableClass={outfitStory.variable} />;
}
