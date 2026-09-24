"use client";

/* ═══════════════════════════════════════════════════════════════
   OngletInfosPanneau — l'onglet « Infos » du panneau latéral de « Mon
   processus » (lot C1, décision BP 2026-09-24).

   Les informations du joueur, rassemblées : taille, poids et mesures, tests,
   équipes et parcours, faits saillants et liens, profil scolaire, promotion.
   PAS de coordonnées (téléphone, courriel) : décision produit, le contact
   passe par la messagerie — et la fiche n'en affiche aucune non plus.

   RIEN N'EST DUPLIQUÉ (lot C0) :
   · les données viennent de useFicheAthleteDonnees, le chargement même de
     la fiche athlète (même requête, mêmes RPC, mêmes masquages) ;
   · le rendu vient de sectionsFiche, les sections mêmes de la fiche, en
     variante `compact` (grilles à 2 colonnes pour 420 px).
   · les verrous sont ceux de la fiche : `verrouille` = recruteur gratuit
     hors vitrine (lockContent). Faits saillants, médias et liens, parcours
     d'équipes et profil académique restent cadenassés en gratuit.

   Monté SEULEMENT quand l'onglet est ouvert : le chargement n'a lieu qu'à
   la demande, jamais à l'ouverture du panneau. Ce chargement n'écrit
   aucune « vue » (recordView vit dans la fiche, pas dans le hook).
═══════════════════════════════════════════════════════════════ */

import Link from "next/link";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { isShowcaseAthlete } from "@/lib/showcase";
import { useFicheAthleteDonnees } from "@/components/shared/athlete/useFicheAthleteDonnees";
import {
  SectionMesures, SectionTests, SectionParcoursEquipes, SectionInfosSportives,
  SectionFaitsSaillants, SectionMediasLiens, SectionProfilAcademique,
  SectionDetailsAcademiques, SectionInfosPersonnelles,
} from "@/components/shared/athlete/sectionsFiche";

export default function OngletInfosPanneau({ athleteId }: { athleteId: string }) {
  const { tier, loading: tierLoading } = useSubscription();
  const isFreeRecruiter = tier === "free";
  const verrouille = isFreeRecruiter && !isShowcaseAthlete(athleteId);
  const { a, loadingAthlete, teamDetails } = useFicheAthleteDonnees({
    id: athleteId, viewerMode: "recruiter", tierLoading, isFreeRecruiter,
  });

  if (loadingAthlete) {
    return (
      <div className="py-16 flex justify-center" role="status" aria-label="Chargement des informations">
        <div className="w-6 h-6 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!a) {
    return <p className="py-12 text-center text-[13px] text-[#6b7280]">Les informations de cet athlète sont indisponibles.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Ordre de BP : taille, poids, mesures, tests, équipes et parcours,
          faits saillants et liens, profil scolaire, promotion. */}
      <SectionMesures a={a} compact />
      <SectionTests a={a} compact />
      <SectionParcoursEquipes a={a} verrouille={verrouille} compact />
      <SectionInfosSportives a={a} estPartenaire={false} teamDetails={teamDetails} />
      <SectionFaitsSaillants a={a} verrouille={verrouille} />
      <SectionMediasLiens a={a} verrouille={verrouille} compact />
      <SectionProfilAcademique a={a} verrouille={verrouille} estPartenaire={false} compact />
      <SectionDetailsAcademiques a={a} estPartenaire={false} />
      <SectionInfosPersonnelles a={a} />

      <Link
        href={`/recruteur/athletes/${athleteId}`}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#13151a] border border-[#2D3748] rounded-lg text-[13px] font-bold text-white hover:border-[#E63946]/40 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        Voir le profil complet
      </Link>
    </div>
  );
}
