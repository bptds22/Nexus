import MarketingHero from "@/components/marketing/MarketingHero";
import ProblemSection from "@/components/marketing/ProblemSection";
import SolutionGrid from "@/components/marketing/SolutionGrid";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import TestimonialSection from "@/components/marketing/TestimonialSection";
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
        ctaPrimary={{ label: "PARLE À TON COACH →", href: "/comment-ca-marche" }}
        ctaSecondary={{ label: "COMMENT ÇA MARCHE", href: "/comment-ca-marche" }}
      />

      <ProblemSection
        title="T'ES PRÊT. MAIS QUI LE SAIT ?"
        problems={[
          {
            icon: "🤷",
            title: "Invisible",
            description:
              "T'es peut-être le meilleur QB de ta ligue, mais les CÉGEPs hors de ta région ne le savent pas.",
          },
          {
            icon: "📱",
            title: "Pas de vitrine",
            description:
              "Ton highlight reel est sur TikTok entre des vidéos de chats. Aucun endroit professionnel pour te présenter.",
          },
          {
            icon: "🎓",
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
            icon: "🏆",
            title: "Profil étudiant-athlète complet",
            description:
              "Stats, position, highlight vidéo, parcours académique, moyenne générale — tout sur une page.",
          },
          {
            icon: "👁️",
            title: "Vu par 54 CÉGEPs",
            description:
              "Les recruteurs de tous les CÉGEPs RSEQ peuvent te découvrir et contacter ton coach.",
          },
          {
            icon: "⭐",
            title: "Évaluation de ton coach",
            description:
              "Ton coach te note sur 11 critères reconnus. C'est ta lettre de recommandation intégrée.",
          },
          {
            icon: "🔵",
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
            title: "Parle à ton coach",
            description:
              "Demande à ton entraîneur de s'inscrire sur Nexus et de créer ton profil.",
          },
          {
            number: "02",
            title: "Ton profil est créé",
            description:
              "Ton coach entre tes stats, ta vidéo et tes infos académiques. Toi, tu joues.",
          },
          {
            number: "03",
            title: "Les recruteurs te trouvent",
            description:
              "Ton profil apparaît dans les recherches des recruteurs CÉGEP. Ils contactent ton coach s'ils sont intéressés.",
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

      <TestimonialSection
        testimonials={[
          {
            name: "Marc-Antoine Tremblay",
            role: "QB, École De Rochebelle — recruté par CÉGEP Garneau",
            quote:
              "Mon coach a créé mon profil un mardi. Le jeudi, un recruteur de Garneau l'avait déjà contacté.",
          },
          {
            name: "Jérémy Lavoie",
            role: "Meneur, Polyvalente Deux-Montagnes — recruté par Montmorency",
            quote:
              "Sans Nexus, j'aurais jamais été vu par Montmorency. Ils recrutent pas dans ma région d'habitude.",
          },
          {
            name: "Alexis Bouchard",
            role: "WR, Collège Saint-Bernard",
            quote:
              "Le badge vérifié m'a démarqué. Les recruteurs m'ont dit qu'ils regardent les vérifiés en premier.",
          },
        ]}
        stats={[
          { value: "200+", label: "Étudiants-athlètes inscrits" },
          { value: "54", label: "CÉGEPs connectés" },
          { value: "4h", label: "Temps de réponse moyen" },
        ]}
      />

      <CtaSection
        title="TON FUTUR CÉGEP TE CHERCHE PEUT-ÊTRE EN CE MOMENT"
        ctaPrimary={{ label: "PARLE À TON COACH →", href: "/comment-ca-marche" }}
        subtext="Demande à ton entraîneur de te créer un profil Nexus."
      />
    </div>
  );
}
