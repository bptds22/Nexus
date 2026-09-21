/* ═══════════════════════════════════════════════════════════════
   /i/[jeton] — le lien d'invitation personnel d'un athlète (L2).

   Décisions BP 2026-09-21 : web seulement, mène à l'INSCRIPTION WEB (pas de
   store, pas de lien universel) ; la page n'affiche que le PRÉNOM du parrain.

   LE SERVEUR résout le jeton (ambassadeur_resoudre_lien, ouverte à anon) et
   compte le clic. Rien n'est écrit sur le visiteur : un entier par parrain
   et par jour, côté base.

   ROBOTS D'APERÇU (WhatsApp, iMessage, Messenger…) : AUCUN appel. Ni clic
   compté, ni prénom livré — l'aperçu d'un lien partagé entre ados ne doit
   pas afficher le prénom d'un mineur à qui ne l'a pas ouvert. Les
   métadonnées Open Graph sont génériques pour la même raison.

   JETON INVALIDE (inconnu, régénéré, parrain masqué ou désactivé) : une
   seule copie générique, sans dire lequel — et l'inscription reste
   proposée, sans parrain.

   Le jeton n'est JAMAIS affiché. Il est mémorisé côté navigateur par
   <MemoriserInvitation> (lib/ambassadeur/invitation.ts), lu au consentement.

   WEB SEULEMENT : headers() rend la page dynamique, incompatible avec
   l'export Capacitor. Masquée par HIDE_PATTERNS (scripts/build-mobile.mjs),
   listée dans lib/build/mobile-excluded-routes.ts, gardée par notFound().
═══════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import NexusLogo from "@/components/ui/NexusLogo";
import { classerVisite } from "@/lib/app-redirect/agent";
import { jetonPlausible } from "@/lib/ambassadeur/invitation";
import MemoriserInvitation from "./MemoriserInvitation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Invitation — Nexus" },
  description: "Un ami t'invite sur Nexus, la plateforme de recrutement sportif au Québec.",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    siteName: "Nexus",
    title: "Un ami t'invite sur Nexus",
    description: "Fais-toi voir des recruteurs des cégeps. Crée ton profil d'athlète.",
  },
};

type Resolution = { valide: true; prenom: string | null } | { valide: false };

async function resoudre(jeton: string, compter: boolean): Promise<Resolution> {
  if (!jetonPlausible(jeton)) return { valide: false };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return { valide: false };
  // Clé ANON, sans session : la fonction est la seule du chantier ouverte à
  // anon, et c'est tout ce dont cette page a besoin. Pas de service_role ici.
  const supabase = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("ambassadeur_resoudre_lien", { p_jeton: jeton, p_compter: compter });
  if (error) {
    console.error("NEXUS /i : resolution en echec —", error.message);
    return { valide: false };
  }
  const r = data as { valide?: boolean; prenom?: string | null } | null;
  return r?.valide ? { valide: true, prenom: r.prenom?.trim() || null } : { valide: false };
}

export default async function InvitationPage({ params }: { params: Promise<{ jeton: string }> }) {
  if (process.env.CAPACITOR_BUILD === "true") notFound();
  const { jeton: brut } = await params;
  const jeton = decodeURIComponent(brut ?? "").toLowerCase();

  const visite = classerVisite((await headers()).get("user-agent"));
  // Robot d'aperçu : ni résolution, ni clic, ni prénom.
  const r: Resolution | null = visite.robot ? null : await resoudre(jeton, true);

  return (
    <main className="min-h-screen bg-[#111317] px-5 py-10 flex flex-col items-center">
      <NexusLogo variant="white" height={32} priority />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-6 text-center">
        {r?.valide ? (
          <>
            <MemoriserInvitation jeton={jeton} />
            <p className="text-[12px] font-bold uppercase tracking-wider text-white/40">Invitation</p>
            <h1 className="font-head mt-2 text-[24px] font-bold uppercase leading-tight tracking-tight text-white">
              {r.prenom ? `${r.prenom} t'invite sur Nexus` : "Un ami t'invite sur Nexus"}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-white/60">
              Crée ton profil d&apos;athlète et fais-toi voir des recruteurs des cégeps.
              C&apos;est gratuit.
            </p>
            <Link
              href="/auth?mode=signup"
              className="mt-6 block w-full rounded-2xl bg-[#E63946] px-4 py-4 font-head text-[13px] font-bold uppercase tracking-widest text-white"
            >
              Créer mon compte
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-head text-[22px] font-bold uppercase tracking-tight text-white">
              {r === null ? "Un ami t'invite sur Nexus" : "Ce lien d'invitation n'est plus valide"}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-white/60">
              Tu peux quand même créer ton profil d&apos;athlète et te faire voir des recruteurs des cégeps.
            </p>
            <Link
              href="/auth?mode=signup"
              className="mt-6 block w-full rounded-2xl bg-[#E63946] px-4 py-4 font-head text-[13px] font-bold uppercase tracking-widest text-white"
            >
              Créer mon compte
            </Link>
          </>
        )}
        <p className="mt-5 text-[12px] leading-relaxed text-white/35">
          Tu as déjà un compte ?{" "}
          <Link href="/auth" className="text-[#E63946] underline underline-offset-2">Connecte-toi</Link>
        </p>
      </div>
    </main>
  );
}
