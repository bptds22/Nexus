import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import MaStoryClient from "./MaStoryClient";

/* ═══════════════════════════════════════════════════════════════
   /ma-story — générateur de stories Instagram, 100 % côté client.

   Port 1:1 de la référence validée ma-story.html
   (sha256 01506397aa66855fd8d2bf823c02f63e41883c7c770ddd2e230e5f85d97062cd,
   752 lignes, 8 gabarits).

   La photo ne quitte jamais le navigateur : lecture via
   URL.createObjectURL, composition au canvas, export toBlob, URL
   révoquée après le téléchargement. Aucun fetch, aucun upload,
   aucune persistance — rien à effacer parce que rien n'est écrit.

   ── POURQUOI OUTFIT EST CHARGÉE ICI, ET PAS DANS LE LAYOUT ─────
   La référence peint en Outfit 800 (les « VS », l'adversaire, la
   ligne du gabarit « post »). L'instance globale du layout racine
   porte 400/500/600/700 — pas le 800. Plutôt que de modifier une
   config partagée par toute l'application pour une seule route, la
   route charge sa propre instance : même motif que
   app/carte/page.tsx, aucune écriture hors du dossier.

   Anton, elle, vient du layout racine (--font-anton). Elle n'a
   qu'une seule graisse — l'appeler « Anton 800 » n'a pas de sens,
   la référence l'appelle d'ailleurs sans graisse.
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
    "Crée et télécharge ta story Instagram d'athlète : jour de match, résultat, stats, équipe, jaquette de jeu. Ta photo reste sur ton appareil.",
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
