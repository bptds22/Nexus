"use client";

// components/program-page/ProgramPageMobile.tsx
//
// Rendu NATIF (bundle Capacitor) de la page école /college/[schoolId].
// MÊME composant de rendu <ProgramPage> que le web — seule la COUCHE DE
// CHARGEMENT change : ici createClient() côté client (clé anon) → RLS
// appliquée, comme les écrans *Mobile*. La version web (SSR service-role) reste
// dans app/college/[schoolId]/page.tsx et n'est pas touchée.
//
// RLS : toutes les tables lues ici sont en lecture publique/authentifiée pour un
// athlète (diag : schools/school_page_content/school_campus_cards/school_programs/
// school_news = read true ; teams CEGEP readable ; count_* = SECURITY DEFINER).
// La page école ne dépend d'AUCUNE table restreinte → rien à vider.

import * as React from "react";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import ProgramPage from "@/components/program-page/ProgramPage";
import { loadSchoolPage } from "@/lib/queries/schoolPage/schoolPageData";
import {
  dbToProgramPage, degradedProgramPage,
  type SchoolRow, type TeamRowForGrid,
} from "@/lib/queries/schoolPage/dbToProgramPage";
import type { SchoolProgramIdentity } from "@/components/program-wall/slots";
import type { ProgramPageContent } from "@/components/program-page/content";

const FONTS = (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700&family=Permanent+Marker&family=Playfair+Display:ital,wght@1,500;1,700&family=Outfit:wght@600;700;800&display=swap"
    />
  </>
);

type Loaded =
  | { state: "loading" }
  | { state: "error" }
  | { state: "notfound" }
  | { state: "ready"; school: SchoolProgramIdentity; content: ProgramPageContent };

function CenteredMobile({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ background: "#111317", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
      {children}
    </main>
  );
}

export default function ProgramPageMobile() {
  // useDynamicParam : sur mobile, useParams vaut "placeholder" (shell pré-généré)
  // → relit le vrai schoolId depuis sessionStorage (stashé par app/page.tsx lors
  // de la redirection errorPath). Sur web, renvoie directement le vrai id.
  const schoolId = useDynamicParam("schoolId");
  const isPlaceholder = !schoolId || schoolId === "placeholder";
  const [st, setSt] = React.useState<Loaded>({ state: "loading" });

  React.useEffect(() => {
    // Sentinelle static-export : la page pré-rendue porte schoolId="placeholder".
    // On ne charge rien tant que le vrai id n'est pas dans l'URL (runtime).
    if (isPlaceholder) return;
    let cancelled = false;
    setSt({ state: "loading" });
    (async () => {
      try {
        const supabase = createClient();
        const { data: rows } = await supabase
          .from("schools").select("id, name, city, region").eq("id", schoolId!).limit(1);
        const school = (rows ?? [])[0] as SchoolRow | undefined;
        if (!school) { if (!cancelled) setSt({ state: "notfound" }); return; }

        const { content, cards, programs, news } = await loadSchoolPage(supabase, school.id);
        const [{ data: rc }, { data: fc }, { data: teamRows }] = await Promise.all([
          supabase.rpc("count_recruited_by_school", { p_school_id: school.id } as unknown as undefined),
          supabase.rpc("count_followers_by_school", { p_school_id: school.id } as unknown as undefined),
          supabase.from("teams").select("id, division, gender, sports:sport_id(nom)").eq("school_id", school.id),
        ]);
        const teams: TeamRowForGrid[] = ((teamRows ?? []) as unknown as {
          id: string; division: string | null; gender: string | null; sports: { nom: string } | null;
        }[]).map((t) => ({ id: t.id, sport: t.sports?.nom ?? "", division: t.division, gender: t.gender }));

        const assetUrl = (path: string | null | undefined, bucket: "school-logos" | "campus-photos") =>
          path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;

        if (!content) {
          const deg = degradedProgramPage(school, teams);
          if (!cancelled) setSt({ state: "ready", school: deg.school, content: deg.content });
          return;
        }
        const { school: identity, content: pageContent } = dbToProgramPage(
          school, content, cards, programs, news,
          (rc as number | null) ?? 0, (fc as number | null) ?? 0, assetUrl, teams,
        );
        if (!cancelled) setSt({ state: "ready", school: identity, content: pageContent });
      } catch {
        if (!cancelled) setSt({ state: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [schoolId, isPlaceholder]);

  // ÉTATS DE CHARGEMENT (nouveaux vs SSR) — jamais d'écran blanc ni de page
  // à moitié peuplée : squelette pendant le fetch, erreur lisible sinon.
  if (isPlaceholder || st.state === "loading") {
    return (
      <CenteredMobile>
        <div style={{ width: 30, height: 30, border: "3px solid #E63946", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      </CenteredMobile>
    );
  }
  if (st.state === "notfound") {
    return <CenteredMobile><p style={{ color: "#9CA3AF", fontFamily: "Outfit, sans-serif", fontSize: 15 }}>Collège introuvable.</p></CenteredMobile>;
  }
  if (st.state === "error") {
    return <CenteredMobile><p style={{ color: "#9CA3AF", fontFamily: "Outfit, sans-serif", fontSize: 15 }}>Impossible de charger la page. Vérifie ta connexion, puis réessaie.</p></CenteredMobile>;
  }
  return (
    <>
      {FONTS}
      <main style={{ background: "#111317", minHeight: "100vh" }}>
        <ProgramPage school={st.school} content={st.content} />
      </main>
    </>
  );
}
