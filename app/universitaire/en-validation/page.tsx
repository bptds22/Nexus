"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/supabase/auth.actions";

/* ─────────────────────────────────────────────────────────────────
   Recruteur universitaire — compte en validation (lot D2b cégep).
   Son portail arrive au lot D3 ; d'ici là, un recruteur universitaire inscrit atterrit ici (fin du
   formulaire, et garde du portail recruteur). Tout autre compte est renvoyé à l'accueil.
───────────────────────────────────────────────────────────────── */

export default function RecruteurUniversitaireEnValidationPage() {
  const router = useRouter();
  const [pret, setPret] = useState(false);
  const [universite, setUniversite] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth"); return; }
      const { data } = await supabase
        .from("users")
        .select("role, context, onboarding_complete, school_id")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!data || data.role !== "RECRUTEUR" || data.context !== "universitaire") { router.replace("/"); return; }
      if (data.onboarding_complete !== true) { router.replace("/onboarding"); return; }
      // Sa propre université lui est lisible (policy universites_masquees, lot D2a).
      if (data.school_id) {
        const { data: ecole } = await supabase.from("schools").select("name").eq("id", data.school_id).maybeSingle();
        setUniversite((ecole?.name as string | undefined) ?? null);
      }
      setPret(true);
    })();
  }, [router]);

  const seDeconnecter = async () => {
    await signOut();
    router.replace("/auth");
  };

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex flex-col">
      <PlaybookBackground />
      <div className="relative z-10 pt-8 pb-4 flex justify-center">
        <NexusLogo variant="white" height={36} href="/" priority />
      </div>
      <section className="flex-1 flex items-start justify-center relative px-4 py-8">
        <div className="relative z-10 w-full max-w-[520px]">
          {pret ? (
            <div className="bg-[#1A1D24] border border-white/5 rounded-xl p-6 sm:p-8 space-y-4">
              <h1 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Ton compte est créé</h1>
              <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
                Ton compte de recruteur universitaire{universite ? <> pour <span className="text-white font-bold">{universite}</span></> : null} est
                en validation par l&apos;équipe Nexus.
              </p>
              <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
                Le portail du recruteur universitaire ouvre bientôt : tu y trouveras les athlètes collégiaux.
              </p>
              <button type="button" onClick={seDeconnecter}
                className="h-11 px-5 rounded-lg border border-white/10 text-xs font-bold text-white hover:border-white/20 transition-colors">
                Se déconnecter
              </button>
            </div>
          ) : (
            <div className="flex justify-center pt-12">
              <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
