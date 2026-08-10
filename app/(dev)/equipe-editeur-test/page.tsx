// app/(dev)/equipe-editeur-test/page.tsx
//
// Route de test dev pour l'éditeur « Page équipe » CÉGEP — une page d'édition
// PAR équipe : /equipe-editeur-test?team=<uuid>. Desktop only. Le contrôle
// d'accès réel est la RLS (can_edit_team_page → recruteurs + is_school_admin du
// collège) ; l'éditeur refuse en plus les équipes d'un autre collège.

import { notFound } from "next/navigation";
import TeamEditor from "@/components/team-editor/TeamEditor";

export const metadata = {
  title: "Éditeur « Page équipe » CÉGEP — dev test",
  robots: { index: false, follow: false },
};

const FONTS = (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Anton&family=Bebas+Neue&display=swap"
    />
  </>
);

export default async function EquipeEditeurTest({
  searchParams,
}: {
  searchParams?: Promise<{ team?: string }>;
}) {
  // URL-only web (dev/test) — jamais dans le bundle mobile.
  // Décor de développement : jamais dans le bundle mobile, et jamais servi
  // par un déploiement de PRODUCTION. Les prévisualisations restent
  // utilisables — c'est précisément là que ces routes servent.
  //
  // La garde ne teste PAS `VERCEL_ENV === "production"` : la production du
  // projet est Coolify / OVHcloud (cf. CLAUDE.md), où VERCEL_ENV n'existe
  // pas — la garde s'y évaporerait en silence. On bloque donc toute
  // production, et on EXEMPTE explicitement l'aperçu Vercel, qui est le
  // seul environnement de production-au-sens-build à devoir rester ouvert.
  if (
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true" ||
    (process.env.VERCEL_ENV !== "preview" &&
      process.env.NODE_ENV === "production")
  ) {
    notFound();
  }
  const teamId = (await searchParams)?.team ?? "";

  return (
    <>
      {FONTS}
      {teamId ? (
        <TeamEditor teamId={teamId} />
      ) : (
        <div style={{ background: "#111317", color: "#8A909C", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", padding: 40, textAlign: "center" }}>
          Ajoute l&apos;équipe à éditer : <code style={{ color: "#EDEFF3", marginLeft: 6 }}>?team=&lt;uuid&gt;</code>
        </div>
      )}
    </>
  );
}
