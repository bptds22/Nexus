/* ═══════════════════════════════════════════════════════════════
   /p/[jeton] — le lien d'une carte prospect PARTENAIRE (W4c).

   Le partenaire l'envoie lui-même par texto au jeune qu'il a évalué.

   SANS CONNEXION : seulement « <partenaire> t'invite sur Nexus » et les
   boutons S'inscrire / Se connecter. Jamais le nom du jeune ni l'évaluation :
   le lien peut être vu par d'autres que lui. Le serveur ne livre d'ailleurs
   que le nom du partenaire (prospect_partenaire_resoudre, ouverte à anon).

   ROBOTS D'APERÇU (iMessage, WhatsApp, Messenger…) : AUCUN appel, page
   générique — comme /i/[jeton]. Métadonnées Open Graph génériques.

   CONNECTÉ (compte athlète, onboarding terminé) : la carte, via
   prospect_partenaire_ouvrir, avec « C'est moi » / « Ce n'est pas moi »
   (ClientCarte). Le jeton est mémorisé dans le navigateur et survit à
   l'inscription et à l'onboarding (lib/partenaires/prospects.ts) : à la fin,
   le layout athlète ramène ici.

   WEB SEULEMENT (décision BP : jamais l'App Store) — headers() rend la page
   dynamique, incompatible avec l'export Capacitor. Masquée par HIDE_PATTERNS
   (scripts/build-mobile.mjs), listée dans lib/build/mobile-excluded-routes.ts,
   gardée par notFound().
═══════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { classerVisite } from "@/lib/app-redirect/agent";
import { jetonCartePlausible } from "@/lib/partenaires/prospects";
import ClientCarte from "./ClientCarte";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Invitation — Nexus" },
  description: "Une invitation sur Nexus, la plateforme de recrutement sportif au Québec.",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    siteName: "Nexus",
    title: "Une invitation sur Nexus",
    description: "Crée ton profil d'athlète et fais-toi voir des recruteurs des cégeps.",
  },
};

async function resoudre(jeton: string): Promise<{ valide: boolean; partenaire: string | null }> {
  if (!jetonCartePlausible(jeton)) return { valide: false, partenaire: null };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return { valide: false, partenaire: null };
  // Clé ANON, sans session : la seule fonction W4 ouverte à anon. Pas de service_role ici.
  const supabase = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("prospect_partenaire_resoudre", { p_jeton: jeton });
  if (error) {
    console.error("NEXUS /p : resolution en echec —", error.message);
    return { valide: false, partenaire: null };
  }
  const r = (data as { valide: boolean; partenaire: string | null }[] | null)?.[0];
  return r?.valide ? { valide: true, partenaire: r.partenaire?.trim() || null } : { valide: false, partenaire: null };
}

export default async function CartePartenairePage({ params }: { params: Promise<{ jeton: string }> }) {
  if (process.env.CAPACITOR_BUILD === "true") notFound();
  const { jeton: brut } = await params;
  const jeton = decodeURIComponent(brut ?? "").toLowerCase();

  const visite = classerVisite((await headers()).get("user-agent"));
  // Robot d'aperçu : ni résolution, ni nom du partenaire.
  const r = visite.robot ? null : await resoudre(jeton);

  return <ClientCarte jeton={jeton} robot={r === null} valide={!!r?.valide} partenaire={r?.partenaire ?? null} />;
}
