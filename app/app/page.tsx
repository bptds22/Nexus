/* ═══════════════════════════════════════════════════════════════
   /app — le lien de la bio Instagram (nexussports.ca/app?s=ig).

   Le SERVEUR décide, sur le seul User-Agent (lib/app-redirect/agent.ts) :
     • iPhone / Android, navigateur ordinaire → 307 immédiat vers le store,
       avant tout rendu.
     • Robot d'aperçu (Facebook, iMessage, WhatsApp…) → la page, JAMAIS de
       redirection : sinon l'aperçu montrerait la fiche App Store au lieu de
       notre carte Open Graph.
     • Navigateur INTÉGRÉ Instagram / Facebook → la page, qui TENTE
       l'ouverture au montage et garde les boutons si elle échoue. Une 30x
       vers un store y ouvre souvent la fiche web DANS la vue d'Instagram.
       Comportement à confirmer sur vrais téléphones (BP, avant publication).
     • Tout le reste (ordinateur, iPad) → la page aux deux boutons ; l'iPad,
       qui se déclare Mac, est rattrapé au montage (detectDevice).

   Pourquoi pas le middleware : il est réservé à /partenaire et paie un
   getUser() Supabase par requête — hors de question sur un lien public.

   Chaque visite humaine incrémente app_redirect_counts (service_role, aucune
   donnée personnelle). Le compteur ne bloque JAMAIS la redirection : échec
   ou lenteur → journal, et on continue.

   WEB SEULEMENT : headers() rend la page dynamique, incompatible avec
   l'export statique Capacitor. Masquée par HIDE_PATTERNS
   (scripts/build-mobile.mjs) et listée dans lib/build/mobile-excluded-routes.ts.
   ═══════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { classerVisite, sourceDepuisParam, type Plateforme, type Source } from "@/lib/app-redirect/agent";
import { intentionPlayStore, lienAppStore, lienPlayStore } from "@/lib/config/appStores";
import { OG_APP } from "@/lib/config/og";
import { createServiceClient } from "@/lib/supabase/service";
import PlaybookStatique from "@/app/components/PlaybookStatique";
import AppLanding from "./AppLanding";

export const dynamic = "force-dynamic";

const TITRE = "Télécharge l'app Nexus";
const DESCRIPTION =
  "Fais-toi voir, fais-toi recruter. L'app Nexus sur iPhone et Android — le recrutement sportif au Québec.";

export const metadata: Metadata = {
  title: { absolute: TITRE },
  description: DESCRIPTION,
  alternates: { canonical: "https://nexussports.ca/app" },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    url: "https://nexussports.ca/app",
    siteName: "Nexus",
    title: TITRE,
    description: DESCRIPTION,
    images: [OG_APP],
  },
  twitter: {
    card: "summary_large_image",
    title: TITRE,
    description: DESCRIPTION,
    images: [OG_APP.url],
  },
};

/** Au-delà, on redirige sans attendre le compteur : une visite perdue vaut
 *  mieux qu'un visiteur qui patiente devant un écran blanc. */
const DELAI_COMPTEUR_MS = 800;

async function compter(plateforme: Plateforme, source: Source): Promise<void> {
  try {
    // `as never` : createServiceClient() n'est pas typé avec le schéma
    // (lib/supabase/service.ts), ses paramètres rpc sont donc `undefined` —
    // même cause que les erreurs tsc des routes Stripe.
    const appel = createServiceClient()
      .rpc("app_redirect_incrementer", { p_plateforme: plateforme, p_source: source } as never)
      .then(({ error }) => {
        if (error) console.error("NEXUS /app: compteur en echec —", error.message);
      });
    await Promise.race([appel, new Promise((r) => setTimeout(r, DELAI_COMPTEUR_MS))]);
  } catch (e) {
    console.error("NEXUS /app: compteur en echec —", e instanceof Error ? e.message : String(e));
  }
}

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string | string[] }>;
}) {
  if (process.env.CAPACITOR_BUILD === "true") notFound();

  const ua = (await headers()).get("user-agent");
  const { s } = await searchParams;
  const visite = classerVisite(ua);
  const source = sourceDepuisParam(s);

  if (!visite.robot) await compter(visite.plateforme, source);

  // redirect() lève : hors de tout try/catch.
  if (!visite.robot && !visite.integre) {
    if (visite.plateforme === "ios") redirect(lienAppStore(source));
    if (visite.plateforme === "android") redirect(lienPlayStore(source));
  }

  // Habillage de l'accueil : fond #111317, playbook FIGÉ rendu ici par le
  // serveur (aucun JavaScript), halo rouge via .hero-playbook::after.
  // nx-app-landing : masque les textes manuscrits du fond (globals.css).
  return (
    <div className="nx-app-landing hero-playbook min-h-[100dvh] bg-[#111317]">
      <PlaybookStatique prefixe="app-" />
      <AppLanding
        appStoreUrl={lienAppStore(source)}
        playStoreUrl={lienPlayStore(source)}
        intentionAndroid={intentionPlayStore(source)}
        integre={visite.integre}
      />
    </div>
  );
}
