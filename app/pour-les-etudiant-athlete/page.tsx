import MarketingHero from "@/components/marketing/MarketingHero";
import ProblemSection from "@/components/marketing/ProblemSection";
import SolutionGrid from "@/components/marketing/SolutionGrid";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import CtaSection from "@/components/marketing/CtaSection";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";

export default function PourLesEtudiantAthletePage() {
  return (
    <div className="hero-playbook bg-[#060A14] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      <MarketingHero
        eyebrow="POUR LES ÉTUDIANTS-ATHLÈTES"
        title="FAIS-TOI REPÉRER PAR LES CÉGEPS"
        subtitle="Ton coach crée ton profil sur Nexus. Les recruteurs CÉGEP de tout le Québec peuvent te découvrir, voir tes stats, ta vidéo et ton parcours académique."
        ctaPrimary={{ label: "SOIS LE NEXT →", href: "/inscription?role=ATHLETE" }}
        ctaSecondary={{ label: "COMMENT ÇA MARCHE", href: "/comment-ca-marche" }}
      />

      <ProblemSection
        title="T'ES PRÊT. MAIS QUI LE SAIT ?"
        problems={[
          {
            icon: "eyeOff",
            title: "Invisible",
            description:
              "T'es peut-être le meilleur QB de ta ligue, mais les CÉGEPs hors de ta région ne le savent pas.",
          },
          {
            icon: "monitor",
            title: "Pas de vitrine",
            description:
              "Ton highlight reel est sur TikTok entre des vidéos de chats. Aucun endroit professionnel pour te présenter.",
          },
          {
            icon: "gradCap",
            title: "Le sport ET l'école",
            description:
              "Les recruteurs veulent voir tes stats ET ta moyenne générale. Aucun outil ne combine les deux.",
          },
        ]}
      />

      <SolutionGrid
        title="TON PROFIL. TA CHANCE."
        solutions={[
          {
            icon: "trophy",
            title: "Profil étudiant-athlète complet",
            description:
              "Stats, position, highlight vidéo, parcours académique, moyenne générale — tout sur une page.",
          },
          {
            icon: "search",
            title: "Vu par 54 CÉGEPs",
            description:
              "Les recruteurs de tous les CÉGEPs RSEQ peuvent te découvrir et contacter ton coach.",
          },
          {
            icon: "allstar",
            title: "Évaluation de ton coach",
            description:
              "Ton coach te note sur 11 critères reconnus. C'est ta lettre de recommandation intégrée.",
          },
          {
            icon: "shield",
            title: "Badge vérifié",
            description:
              "Un profil complet = un badge bleu qui te démarque des profils incomplets.",
          },
        ]}
      />

      <HowItWorks
        steps={[
          {
            number: "01",
            title: "Inscris-toi en quelques minutes",
            description:
              "Crée ton profil tout de suite — pas besoin d'attendre. Stats, position, vidéo, parcours : tu remplis ce que tu peux et tu peaufines plus tard.",
          },
          {
            number: "02",
            title: "Ton coach te vérifie (recommandé)",
            description:
              "Demande-lui d'ajouter son évaluation et de valider tes stats. Le badge bleu fait monter ton profil dans les recherches des recruteurs.",
          },
          {
            number: "03",
            title: "Les recruteurs te trouvent",
            description:
              "Ton profil apparaît dans les recherches des recruteurs CÉGEP. Ils peuvent te contacter (ou contacter ton coach) s'ils sont intéressés.",
          },
        ]}
      />

      <FeatureGrid
        title="TON AVANTAGE COMPÉTITIF"
        features={[
          {
            title: "Vidéo highlights",
            description:
              "Ton meilleur highlight reel, intégré directement dans ton profil. Les recruteurs le voient en premier.",
          },
          {
            title: "Stats complètes",
            description:
              "Toutes tes stats de saison — triées, formatées, comparables. Pas de PDF flou.",
          },
          {
            title: "Moyenne générale visible",
            description:
              "Les recruteurs voient ta moyenne générale. Ça ouvre les portes des programmes contingentés.",
          },
          {
            title: "Évaluation 11 critères",
            description:
              "Force, vitesse, QI sportif, leadership — ton coach te note sur une grille que tous les recruteurs comprennent.",
          },
          {
            title: "Notifications à ton coach",
            description:
              "Quand un recruteur consulte ton profil, ton coach le sait. Plus de silence radio.",
          },
          {
            title: "Multi-sport",
            description:
              "Tu joues football ET basketball ? Ton profil supporte plusieurs sports.",
          },
        ]}
      />

      <CtaSection
        title="TON FUTUR CÉGEP TE CHERCHE PEUT-ÊTRE EN CE MOMENT"
        ctaPrimary={{ label: "SOIS LE NEXT →", href: "/inscription?role=ATHLETE" }}
        subtext="Demande à ton entraîneur de te créer un profil Nexus."
      />
    </div>
  );
}
