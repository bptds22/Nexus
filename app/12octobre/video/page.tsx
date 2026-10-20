import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import PlaybookBackground from "../../components/PlaybookBackground";
import { createServiceClient } from "@/lib/supabase/service";
import { DEMO_12_OCTOBRE as D } from "@/lib/demo/demo12Octobre";
import { DUREE_MINUTES, estUuid } from "@/lib/demo/demoAcces";
import LecteurChapitres from "./LecteurChapitres";

/* ═══════════════════════════════════════════════════════════════
   /12octobre/video?t=<jeton> — l'enregistrement de la démo, par lien
   personnel (courriel A). Rendu SERVEUR à chaque requête :
   · jeton absent, inconnu ou révoqué → « Accès non disponible » ;
   · valide → demo_access_consulter compte la vue (view_count + 1,
     last_viewed_at) et la page rend le lecteur YouTube non répertorié.
   L'ID YouTube vient de DEMO_YOUTUBE_ID (variable serveur), jamais du code.
   Ni pixel ni événement Meta ; aucune donnée personnelle dans l'URL hors
   le jeton. Page non indexée.
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Nexus — La démo recruteurs" },
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  referrer: "strict-origin-when-cross-origin",
};

async function accesValide(t: string | undefined, idVideo: string): Promise<boolean> {
  if (!estUuid(t) || !idVideo) return false;
  const { data, error } = await createServiceClient().rpc("demo_access_consulter", { p_token: t } as never);
  if (error) console.error("[demo-video] consulter :", error.message);
  return data === true;
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex flex-col">
      <PlaybookBackground />
      <MarketingNav />
      <section className="flex-1 relative z-10 px-4 sm:px-6 pt-10 sm:pt-14 pb-16">
        <div className="max-w-[1100px] mx-auto">{children}</div>
      </section>
      <Footer />
    </div>
  );
}

export default async function DemoVideoPage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const { t } = await searchParams;
  const idVideo = process.env.DEMO_YOUTUBE_ID?.trim() ?? "";
  const ok = await accesValide(Array.isArray(t) ? t[0] : t, idVideo);

  if (!ok) {
    return (
      <Cadre>
        <div className="max-w-2xl mx-auto nx-auth-card bg-[#1A1D24] border border-white/[0.08] p-6 sm:p-10 font-sans text-[15px] text-[#D1D5DB] leading-relaxed space-y-4">
          <h1 className="nx-display text-3xl font-black text-white uppercase tracking-tight">Accès non disponible</h1>
          <p>
            Ce lien n&apos;est pas valide ou n&apos;est plus actif. Écrivez-nous à{" "}
            <a href={`mailto:${D.courriel}`} className="text-white font-semibold hover:text-wl-red">{D.courriel}</a>.
          </p>
        </div>
      </Cadre>
    );
  }

  return (
    <Cadre>
      <h1 className="nx-display text-4xl sm:text-5xl lg:text-6xl font-black text-white uppercase leading-[0.95] tracking-tight">
        La démo Nexus, en {DUREE_MINUTES} minutes.
      </h1>
      <p className="mt-4 mb-8 font-sans text-[17px] text-[#9AA3B2]">Ce lien vous est réservé.</p>
      <LecteurChapitres idVideo={idVideo} />
      <p className="mt-10 font-sans text-[17px] sm:text-[18px] text-[#E5E7EB] leading-relaxed">
        Vous avez déjà une liste de recrutement? Écrivez à{" "}
        <a href={`mailto:${D.courriel}`} className="text-white font-semibold hover:text-wl-red">{D.courriel}</a>, je la migre avec vous.
      </p>
    </Cadre>
  );
}
