"use client";

/* ═══════════════════════════════════════════════════════════════
   BandeauNomAConfirmer — « Est-ce bien toi : X Y ? » (D1b, web et appli).

   - nom recopié de Google, pas encore confirmé → Oui / Corriger ;
   - fiche sans prénom ou sans nom → les deux champs, pré-remplis par
     la proposition de la base (nom du compte, sinon nom complet Google
     DU compte connecté).
   Tant que le nom n'est pas confirmé, la fiche est retirée de la
   recherche recruteur et des listes du coach : le bandeau le dit.
   Rien s'il n'y a rien. Masqué pendant l'inscription (elle a ses champs).
   RPC et textes : lib/athlete/nomAConfirmer.ts (partagés avec l'appli).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmerMonNom, lireEtatNom, TEXTES_NOM, type EtatNom } from "@/lib/athlete/nomAConfirmer";

export default function BandeauNomAConfirmer({ className = "mx-4 sm:mx-8 mt-4" }: { className?: string }) {
  const pathname = usePathname();
  const [etat, setEtat] = useState<EtatNom | null>(null);
  const [edition, setEdition] = useState(false);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enInscription = pathname.startsWith("/athlete/onboarding");

  useEffect(() => {
    if (enInscription) return;
    void lireEtatNom(createClient()).then((ligne) => {
      setEtat(ligne);
      if (ligne) {
        setPrenom(ligne.prenom ?? "");
        setNom(ligne.nom ?? "");
        setEdition(ligne.etat === "MANQUANT");
      }
    });
  }, [pathname, enInscription]);

  if (enInscription || !etat) return null;

  async function confirmer(p: string, n: string) {
    setEnvoi(true);
    setErreur(null);
    const echec = await confirmerMonNom(createClient(), p, n);
    setEnvoi(false);
    if (echec) { setErreur(echec); return; }
    setEtat(null);
    window.location.reload(); // le nom s'affiche partout (barre latérale, profil)
  }

  const champ = "w-full sm:w-44 h-10 px-3 bg-[#111317] border border-white/15 rounded-lg text-white text-[14px] focus:border-[#F59E0B] focus:outline-none";

  return (
    <div className={`relative z-20 ${className} rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-3`} data-bandeau-nom={etat.etat}>
      {!edition ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <p className="flex-1 text-[13px] text-[#F5C46B]">
            {TEXTES_NOM.question} <strong className="text-white">{etat.prenom} {etat.nom}</strong> ?
            <span className="block text-[12px] text-[#D1A35A] mt-0.5">{TEXTES_NOM.pourquoi}</span>
          </p>
          <div className="flex gap-2 shrink-0">
            <button type="button" disabled={envoi} onClick={() => void confirmer(etat.prenom ?? "", etat.nom ?? "")}
              className="min-h-[40px] px-4 py-2 bg-[#F59E0B] hover:bg-[#E08E06] text-[#111317] text-[12px] font-bold rounded-lg disabled:opacity-50">
              Oui
            </button>
            <button type="button" disabled={envoi} onClick={() => setEdition(true)}
              className="min-h-[40px] px-4 py-2 border border-[#F59E0B]/60 text-[#F5C46B] text-[12px] font-bold rounded-lg hover:bg-[#F59E0B]/10">
              Corriger
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-[#F5C46B]">
            {etat.etat === "MANQUANT" ? TEXTES_NOM.ajouter : TEXTES_NOM.corriger}
            <span className="block text-[12px] text-[#D1A35A] mt-0.5">{TEXTES_NOM.pourquoi}</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input aria-label="Prénom" placeholder="Prénom" autoComplete="given-name" value={prenom} onChange={(e) => setPrenom(e.target.value)} className={champ} />
            <input aria-label="Nom" placeholder="Nom" autoComplete="family-name" value={nom} onChange={(e) => setNom(e.target.value)} className={champ} />
            <button type="button" disabled={envoi} onClick={() => void confirmer(prenom, nom)}
              className="min-h-[40px] px-4 py-2 bg-[#F59E0B] hover:bg-[#E08E06] text-[#111317] text-[12px] font-bold rounded-lg disabled:opacity-50">
              {envoi ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
      {erreur && <p className="mt-2 text-[12px] text-[#EF4444]">{erreur}</p>}
    </div>
  );
}
