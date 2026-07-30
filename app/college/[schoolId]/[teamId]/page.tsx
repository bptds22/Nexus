// app/college/[schoolId]/[teamId]/page.tsx
//
// Page équipe PUBLIQUE, enfant de la page école. Destination des rangées et des
// chips de « L'affiche » (SportsGrid).
//
// PUBLIQUE au sens strict : aucune garde de rôle, aucune redirection de login,
// aucun guard Capacitor, absente de MOBILE_EXCLUDED_PAGES. Le widget « match
// parfait » se réveille tout seul si un athlète est connecté (loadViewer côté
// loader), et reste absent sinon — la page ne casse pas.
//
// Différence avec /team-test : aucun décor de démonstration, et l'équipe vient
// du chemin, pas d'un `?team=`.
//
// Trois cas :
//   1. équipe configurée   → rendu depuis la DB
//   2. équipe existante, page jamais configurée → page DÉGRADÉE de CETTE équipe
//      (son sport, sa division, son genre, son école, son calendrier réel)
//   3. équipe introuvable  → notFound()
//
// AUCUN fixture ici : une équipe non configurée s'affichait sous l'identité de
// « Flag football féminin » de Grasset. Le fixture reste le repli de /team-test.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TeamPage from "@/components/team-page/TeamPage";
import { loadTeamPageForRender } from "@/lib/queries/teamPage/loadForRender";

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

export async function generateMetadata(
  { params }: { params: Promise<{ teamId: string }> },
): Promise<Metadata> {
  const { teamId } = await params;
  const res = await loadTeamPageForRender(teamId);
  return res.teamName ? { title: `${res.teamName} | Nexus` } : { title: "Équipe | Nexus" };
}

export default async function CollegeTeamPage(
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const res = await loadTeamPageForRender(teamId);

  // Aucune équipe derrière cet identifiant (uuid invalide ou ligne absente) :
  // seul cas de 404. Une équipe réelle non configurée rend sa page dégradée.
  if (!res.configured && !res.degraded) notFound();

  const team = res.configured ? res.team : res.degraded!;

  return (
    <>
      {FONTS}
      <main style={{ background: "#111317", minHeight: "100vh" }}>
        <TeamPage team={team} />
      </main>
    </>
  );
}
