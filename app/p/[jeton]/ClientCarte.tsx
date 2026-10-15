"use client";

/* ═══════════════════════════════════════════════════════════════
   ClientCarte — /p/[jeton] côté navigateur (W4c).

   - Pas de session : l'invitation (nom du partenaire seulement) ; le jeton
     est MÉMORISÉ pour survivre à l'inscription et à l'onboarding.
   - Compte athlète dont l'onboarding n'est pas fini : le jeton est mémorisé,
     direction l'onboarding ; le layout athlète ramènera ici à la fin.
   - Compte athlète prêt : prospect_partenaire_ouvrir (réserve la carte à ce
     compte) puis la carte et sa réponse. Le jeton mémorisé est alors oublié.
   - Autre rôle : le lien s'adresse à un athlète.
   Le serveur peut dire « invalide » à un visiteur sans session alors que le
   jeune connecté qui a déjà réservé la carte peut la rouvrir : l'ouverture
   connectée est donc toujours tentée.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import { createClient } from "@/lib/supabase/client";
import CarteProspectReponse from "@/components/athlete/prospects/CarteProspectReponse";
import {
  memoriserJetonCarte,
  oublierJetonCarte,
  ouvrirLien,
  type CarteJeune,
} from "@/lib/partenaires/prospects";

type Etat =
  | { k: "verif" }
  | { k: "invite" }
  | { k: "invalide" }
  | { k: "non-athlete" }
  | { k: "carte"; carte: CarteJeune };

export default function ClientCarte({
  jeton,
  robot,
  valide,
  partenaire,
}: {
  jeton: string;
  robot: boolean;
  valide: boolean;
  partenaire: string | null;
}) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>(robot ? { k: "invite" } : { k: "verif" });

  useEffect(() => {
    if (robot) return;
    void (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (valide) memoriserJetonCarte(jeton);
        setEtat(valide ? { k: "invite" } : { k: "invalide" });
        return;
      }
      const role = (session.user.user_metadata?.role as string | undefined) ?? null;
      if (role && role !== "ATHLETE") { setEtat({ k: "non-athlete" }); return; }

      const { data: u } = await supabase.from("users").select("onboarding_complete").eq("id", session.user.id).maybeSingle();
      if (u && u.onboarding_complete !== true) {
        memoriserJetonCarte(jeton);
        router.replace("/athlete/onboarding");
        return;
      }

      oublierJetonCarte();
      try {
        setEtat({ k: "carte", carte: await ouvrirLien(supabase, jeton) });
      } catch (e) {
        const code = (e as { code?: string })?.code;
        setEtat(code === "42501" ? { k: "non-athlete" } : { k: "invalide" });
      }
    })();
  }, [jeton, robot, valide, router]);

  return (
    <main className="min-h-screen bg-[#111317] px-4 py-8 sm:py-10 flex flex-col items-center">
      <NexusLogo variant="white" height={32} priority />
      <div className="mt-8 w-full max-w-lg">
        {etat.k === "verif" && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {etat.k === "invite" && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-6 text-center" data-invitation-partenaire>
            <p className="text-[12px] font-bold uppercase tracking-wider text-white/40">Invitation</p>
            <h1 className="font-head mt-2 text-[24px] font-bold uppercase leading-tight tracking-tight text-white">
              {!robot && partenaire ? `${partenaire} t'invite sur Nexus` : "Une invitation sur Nexus"}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-white/60">
              Inscris-toi ou connecte-toi pour voir ce qui t&apos;attend. Nexus aide les athlètes du secondaire
              à se faire voir des recruteurs des cégeps. C&apos;est gratuit.
            </p>
            <Link href="/auth?mode=signup"
              className="mt-6 block w-full rounded-2xl bg-[#E63946] px-4 py-4 font-head text-[13px] font-bold uppercase tracking-widest text-white">
              S&apos;inscrire
            </Link>
            <Link href="/auth"
              className="mt-3 block w-full rounded-2xl border border-[#2D3748] px-4 py-4 font-head text-[13px] font-bold uppercase tracking-widest text-white hover:bg-white/5">
              Se connecter
            </Link>
          </div>
        )}

        {etat.k === "invalide" && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-6 text-center" data-lien-invalide>
            <h1 className="font-head text-[22px] font-bold uppercase tracking-tight text-white">Ce lien n&apos;est plus valide</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-white/60">
              Il a peut-être expiré ou été remplacé. Tu peux demander un nouveau lien à la personne qui te l&apos;a envoyé.
            </p>
            <Link href="/auth?mode=signup"
              className="mt-6 block w-full rounded-2xl bg-[#E63946] px-4 py-4 font-head text-[13px] font-bold uppercase tracking-widest text-white">
              Créer mon profil quand même
            </Link>
            <p className="mt-5 text-[12px] text-white/35">
              Tu as déjà un compte ? <Link href="/auth" className="text-[#E63946] underline underline-offset-2">Connecte-toi</Link>
            </p>
          </div>
        )}

        {etat.k === "non-athlete" && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-6 text-center">
            <h1 className="font-head text-[22px] font-bold uppercase tracking-tight text-white">Ce lien s&apos;adresse à un athlète</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-white/60">
              Tu es connecté avec un compte qui n&apos;est pas un compte athlète. Déconnecte-toi, puis rouvre le lien.
            </p>
          </div>
        )}

        {etat.k === "carte" && (
          <>
            <CarteProspectReponse carte={etat.carte} />
            <p className="mt-5 text-center">
              <Link href="/athlete/dashboard" className="text-[13px] font-semibold text-[#9CA3AF] hover:text-white underline underline-offset-2">
                Aller à mon espace athlète
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
