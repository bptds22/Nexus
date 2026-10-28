// app/universite/[schoolId]/[teamId]/page.tsx
//
// Page PUBLIQUE d'une équipe universitaire (chantier cégep, lot E4 — retour du test de bout en bout de BP, A2 :
// les pages d'équipes universitaires maintenant, même modèle que les cégeps). Même gabarit que /college/[école]/[équipe]
// (<TeamPageWithViewer>), lu par la clé service : fanions, calendrier et camps, besoins par poste, présentation.
//
// FERMÉE tant que lancement_universitaire est OFF : loadTeamPageForRender(…, { universite: true }) ne rend alors
// rien → 404. Une équipe non universitaire n'a pas de page ici (elle vit sous /college).
// MOBILE (bundle Capacitor) : renvoi vers le web dans la 1.4.5 ; la page native viendra avec la 1.4.6 (D4).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TeamPageWithViewer from "@/components/team-page/TeamPageWithViewer";
import { loadTeamPageForRender } from "@/lib/queries/teamPage/loadForRender";

const IS_CAPACITOR = process.env.CAPACITOR_BUILD === "true";

const FONTS = (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap"
    />
  </>
);

export function generateStaticParams() {
  return IS_CAPACITOR ? [{ schoolId: "placeholder", teamId: "placeholder" }] : [];
}

export async function generateMetadata(
  { params }: { params: Promise<{ teamId: string }> },
): Promise<Metadata> {
  if (IS_CAPACITOR) return { title: "Équipe | Nexus" };
  const { teamId } = await params;
  const res = await loadTeamPageForRender(teamId, { universite: true });
  return res.teamName ? { title: `${res.teamName} | Nexus` } : { title: "Équipe | Nexus" };
}

export default async function UniversiteTeamPage(
  { params }: { params: Promise<{ teamId: string }> },
) {
  if (IS_CAPACITOR) {
    return (
      <main style={{ background: "#111317", minHeight: "100vh", color: "#9CA3AF", padding: 24, fontSize: 14 }}>
        La page de l&apos;équipe s&apos;ouvre sur le web, sur nexussports.ca.
      </main>
    );
  }

  const { teamId } = await params;
  const res = await loadTeamPageForRender(teamId, { universite: true });
  // Interrupteur OFF, équipe absente ou non universitaire → 404.
  if (!res.configured && !res.degraded) notFound();

  const team = res.configured ? res.team : res.degraded!;

  return (
    <>
      {FONTS}
      <main style={{ background: "#111317", minHeight: "100vh" }}>
        <TeamPageWithViewer team={team} />
      </main>
    </>
  );
}
