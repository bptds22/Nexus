// app/college/[schoolId]/[teamId]/page.tsx
//
// Page équipe PUBLIQUE, enfant de la page école. Destination des rangées et des
// chips de « L'affiche » (SportsGrid).
//
// PUBLIQUE au sens strict : aucune garde de rôle, aucune redirection de login.
//
// DEUX rendus, un seul composant <TeamPage> :
//   • WEB  → SSR service-role (SEO public). Corps inchangé ci-dessous.
//   • MOBILE (bundle Capacitor, output:export) → rendu NATIF client
//     <TeamPageMobile> : lecture Supabase clé anon + RLS, generateStaticParams
//     sentinelle « placeholder » remplie par useParams au runtime. La page vit
//     DANS l'app (plus de navigateur in-app). Le widget « match parfait » se
//     réveille si un athlète est connecté (loadViewer côté loader), sinon absent.
//
// Différence avec /team-test : aucun décor de démonstration, et l'équipe vient
// du chemin, pas d'un `?team=`.
//
// Trois cas (WEB) :
//   1. équipe configurée   → rendu depuis la DB
//   2. équipe existante, page jamais configurée → page DÉGRADÉE de CETTE équipe
//   3. équipe introuvable  → notFound()

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import TeamPage from "@/components/team-page/TeamPage";
import TeamPageMobile from "@/components/team-page/TeamPageMobile";
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

// Sentinelle static-export (build mobile uniquement). Segment parent [schoolId]
// inclus : une route dynamique imbriquée doit fournir tous ses params. Web → [].
export function generateStaticParams() {
  return IS_CAPACITOR ? [{ schoolId: "placeholder", teamId: "placeholder" }] : [];
}

export async function generateMetadata(
  { params }: { params: Promise<{ teamId: string }> },
): Promise<Metadata> {
  if (IS_CAPACITOR) return { title: "Équipe | Nexus" };
  const { teamId } = await params;
  const res = await loadTeamPageForRender(teamId);
  return res.teamName ? { title: `${res.teamName} | Nexus` } : { title: "Équipe | Nexus" };
}

export default async function CollegeTeamPage(
  { params }: { params: Promise<{ teamId: string }> },
) {
  // MOBILE (bundle Capacitor) : rendu natif, lecture anon + RLS côté client.
  if (IS_CAPACITOR) {
    return (
      <Suspense fallback={null}>
        <TeamPageMobile />
      </Suspense>
    );
  }

  // WEB : SSR service-role (inchangé — SEO public).
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
