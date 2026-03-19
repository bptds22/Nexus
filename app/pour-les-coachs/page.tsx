import MarketingHero from "@/components/marketing/MarketingHero";
import ProblemSection from "@/components/marketing/ProblemSection";
import PreviewSplit from "@/components/marketing/PreviewSplit";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import TestimonialSection from "@/components/marketing/TestimonialSection";
import CtaSection from "@/components/marketing/CtaSection";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";

export default function PourLesCoachs() {
  return (
    <div className="hero-playbook bg-[#060A14] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      <MarketingHero
        eyebrow="POUR LES ENTRAÎNEURS"
        title="METS TES ATHLÈTES SUR LA MAP"
        subtitle="Crée des profils complets pour tes joueurs et donne-leur une visibilité directe auprès des recruteurs CÉGEP du Québec."
        ctaPrimary={{ label: "CRÉER MON COMPTE COACH", href: "/auth?mode=signup&role=coach" }}
        ctaSecondary={{ label: "VOIR COMMENT ÇA MARCHE", href: "/comment-ca-marche" }}
      />

      <ProblemSection
        title="TES JOUEURS MÉRITENT D'ÊTRE VUS"
        problems={[
          {
            icon: "mail",
            title: "Courriel et téléphone",
            description:
              "Tu envoies des emails aux recruteurs un par un. Pas de réponse garantie. Temps perdu.",
          },
          {
            icon: "eyeOff",
            title: "Invisibilité",
            description:
              "Tes meilleurs athlètes ne sont vus que par les 2-3 recruteurs de ta région. Le reste du Québec ne sait pas qu'ils existent.",
          },
          {
            icon: "fileScatter",
            title: "Données éparpillées",
            description:
              "Stats dans un Excel, vidéos sur YouTube, notes académiques dans un autre fichier. Rien de centralisé.",
          },
        ]}
      />

      {/* Athlete profile preview */}
      <PreviewSplit
        eyebrow="PROFIL ATHLÈTE"
        title="Arrêtez de vendre vos joueurs par téléphone"
        body="Chaque appel à un recruteur, c'est les mêmes questions : taille, poids, notes, position. Avec Nexus, tout est déjà là. Un profil vérifié que le recruteur consulte à son rythme."
        bullets={[
          "Badge vérifié dès 60% du profil complété",
          "Visible par tous les recruteurs CÉGEP du RSEQ",
          "Votre rapport d'entraîneur, dans leurs mains",
        ]}
        imageSrc="/preview-profil-athlete.png"
        fakeUrl="nexus.app/athlete/marc-antoine-tremblay"
        imageAlt="Profil complet d'un étudiant-athlète vérifié sur Nexus"
      />

      {/* Coach roster preview (flipped) */}
      <PreviewSplit
        eyebrow="GESTION DU ROSTER"
        title="Sachez qui regarde vos joueurs"
        body="Vous passez des heures à bâtir des profils. Mais est-ce que quelqu'un les consulte? Nexus vous montre exactement quels recruteurs regardent, combien de fois, et qui est prêt à passer à l'action."
        bullets={[
          "Vues recruteurs par athlète, en temps réel",
          "Filtrez par statut de vérification ou année",
          "Un clic pour évaluer, modifier ou publier",
        ]}
        imageSrc="/preview-coach-roster.png"
        fakeUrl="nexus.app/coach/mes-athletes"
        imageAlt="Vue du roster Mes Athlètes dans le portail coach Nexus"
        reversed
      />

      <HowItWorks
        steps={[
          {
            number: "01",
            title: "Inscris-toi",
            description:
              "Crée ton compte coach en 2 minutes. Associe ton école et ton sport.",
          },
          {
            number: "02",
            title: "Crée les profils",
            description:
              "Ajoute tes athlètes : stats, vidéo, académique. Le profil se complète en 5 minutes par joueur.",
          },
          {
            number: "03",
            title: "Reçois des demandes",
            description:
              "Les recruteurs CÉGEP consultent tes athlètes et te contactent directement.",
          },
        ]}
      />

      <FeatureGrid
        title="TOUT CE DONT T'AS BESOIN"
        features={[
          {
            title: "Dashboard KPIs",
            description:
              "Vois combien de recruteurs consultent tes joueurs en temps réel.",
          },
          {
            title: "Vidéos highlights",
            description:
              "Lien YouTube/Vimeo intégré directement dans le profil.",
          },
          {
            title: "Évaluation 11 critères",
            description:
              "Note tes athlètes sur une grille standardisée reconnue par tous les recruteurs.",
          },
          {
            title: "Badge vérifié",
            description:
              "Les profils complétés à 60%+ obtiennent le badge vérifié (coche bleue).",
          },
          {
            title: "Messagerie intégrée",
            description:
              "Échange directement avec les recruteurs sans quitter la plateforme.",
          },
          {
            title: "Réputation coach",
            description:
              "Construis ta crédibilité grâce aux évaluations des recruteurs après chaque échange.",
          },
        ]}
      />

      <TestimonialSection
        title="ILS UTILISENT NEXUS"
        testimonials={[
          {
            name: "Marc-André Pelletier",
            role: "Coach Football, École De Rochebelle",
            quote:
              "En 3 semaines, 4 de mes joueurs ont été contactés par des CÉGEPs que j'aurais jamais rejoints seul.",
          },
          {
            name: "Sophie Tremblay",
            role: "Coach Basketball, Polyvalente Deux-Montagnes",
            quote:
              "La grille d'évaluation à 11 critères donne une crédibilité que les recruteurs respectent.",
          },
          {
            name: "Jean-François Roy",
            role: "Coach Hockey, Collège Saint-Bernard",
            quote:
              "Avant Nexus, je passais 10h/mois à envoyer des emails. Maintenant les recruteurs viennent à moi.",
          },
        ]}
        stats={[
          { value: "200+", label: "Athlètes inscrits" },
          { value: "54", label: "CÉGEPs connectés" },
          { value: "12", label: "Sports couverts" },
        ]}
      />

      <CtaSection
        eyebrow="PRÊT À COMMENCER ?"
        title="TES ATHLÈTES ATTENDENT D'ÊTRE DÉCOUVERTS"
        ctaPrimary={{ label: "CRÉER MON COMPTE COACH →", href: "/auth?mode=signup&role=coach" }}
        subtext="C'est gratuit. Inscription en 2 minutes."
      />
    </div>
  );
}
