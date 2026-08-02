// app/(dev)/team-test/page.tsx
//
// Dev route to eyeball <TeamPage> (niveau-2). Comme une vraie page équipe, la
// démo affiche UNE équipe (Football masculin D1 par défaut). Les autres fixtures
// restent accessibles via ?team=<id> (ex. ?team=grasset-basket-m). Fonts scopées.

import { notFound } from "next/navigation";
import TeamPage from "@/components/team-page/TeamPage";
import { teamPages } from "@/lib/mock/teamPages";
import { loadTeamPageForRender } from "@/lib/queries/teamPage/loadForRender";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export const metadata = {
  title: "Page équipe — dev test",
  robots: { index: false, follow: false },
};

// Web : `await searchParams` (?team=) opte déjà la route en rendu dynamique —
// pas besoin de `export const dynamic` (qui doit être un littéral statique et
// casserait de toute façon le static-export mobile). Mobile : le guard
// notFound() ci-dessous s'exécute AVANT tout accès à searchParams, donc la
// route s'exporte proprement en 404.
export default async function TeamTest({
  searchParams,
}: {
  searchParams?: Promise<{ team?: string }>;
}) {
  // URL-only web (dev/test) — jamais dans le bundle mobile (cf.
  // lib/build/mobile-excluded-routes.ts).
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
  // Next 16 : searchParams est une Promise → à await.
  const sp = await searchParams;

  // ── mode DB : ?team=<uuid> → l'équipe réelle. Équipe jamais configurée (ou
  // introuvable) → FALLBACK fixture : la page ne casse JAMAIS.
  if (sp?.team && UUID.test(sp.team)) {
    const res = await loadTeamPageForRender(sp.team);
    if (res.configured) {
      return (
        <>
          {FONTS}
          <main style={{ background: "#111317", minHeight: "100vh" }}>
            <TeamPage team={res.team} />
          </main>
        </>
      );
    }
  }

  // ── mode fixture (sans paramètre, ou ?team=<slug>) — INCHANGÉ ──
  // Démo par défaut = Flag féminin (photo réelle Grasset). Autres via ?team=<id>.
  const team =
    teamPages.find((t) => t.id === sp?.team) ??
    teamPages.find((t) => t.id === "grasset-flag-f") ??
    teamPages[0];

  return (
    <>
      {FONTS}
      {/* fond aligné sur la coquille Nexus (#111317) — sinon bande visible sous .tp */}
      <main style={{ background: "#111317", minHeight: "100vh" }}>
        <TeamPage team={team} />
      </main>
    </>
  );
}
