import MarketingHero from "@/components/marketing/MarketingHero";
import ProblemSection from "@/components/marketing/ProblemSection";
import PreviewSplit from "@/components/marketing/PreviewSplit";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import TestimonialSection from "@/components/marketing/TestimonialSection";
import CtaSection from "@/components/marketing/CtaSection";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";

export default function PourLesRecruteurs() {
  return (
    <div className="hero-playbook bg-[#060A14] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      <MarketingHero
        eyebrow="POUR LES RECRUTEURS CÉGEP"
        title="TROUVE TA PROCHAINE RECRUE"
        subtitle="Accède à la plus grande base de données d'athlètes secondaires du Québec. Filtre par sport, position, région, académique — et contacte le coach directement."
        ctaPrimary={{ label: "EXPLORER LES ATHLÈTES", href: "/auth?mode=signup&role=recruiter" }}
        ctaSecondary={{ label: "VOIR COMMENT ÇA MARCHE", href: "/comment-ca-marche" }}
      />

      <ProblemSection
        title="RECRUTER NE DEVRAIT PAS ÊTRE AUSSI COMPLIQUÉ"
        problems={[
          {
            icon: "search",
            title: "Recherche artisanale",
            description:
              "Tu dépends du bouche-à-oreille et de ton réseau personnel. Les meilleurs athlètes hors de ta région t'échappent.",
          },
          {
            icon: "phone",
            title: "Contacts froids",
            description:
              "Tu appelles des coachs que tu connais pas. Pas de contexte. Pas de données fiables.",
          },
          {
            icon: "clock",
            title: "Temps perdu",
            description:
              "Tu consultes des profils incomplets, des vidéos périmées, des stats non vérifiées. Chaque mauvaise piste coûte des heures.",
          },
        ]}
      />

      {/* Athlete profile preview */}
      <PreviewSplit
        eyebrow="PROFIL ATHLÈTE"
        title="Fini les 10 courriels pour avoir une taille et un poids"
        body="Chaque profil est rempli par le coach qui connaît l'athlète. Mensurations, académique, rapport d'entraîneur, vidéo — tout est là avant même votre premier contact."
        bullets={[
          "Évaluation du coach sur 8 critères",
          "Profil académique avec moyenne et programme",
          "Préférences de l'athlète : région, CÉGEP privé, programme",
        ]}
        imageSrc="/preview-profil-athlete.png"
        fakeUrl="nexus.app/recruteur/athlete/marc-antoine-tremblay"
        imageAlt="Profil complet d'un étudiant-athlète sur Nexus"
      />

      {/* Recruiter dashboard preview (flipped) */}
      <PreviewSplit
        eyebrow="TABLEAU DE BORD"
        title="Trouvez le bon athlète. Pas le plus visible."
        body="Les meilleurs prospects ne sont pas toujours ceux qui envoient le plus de courriels. Filtrez par sport, position, région ou graduation. Comparez les évaluations coach et académiques côte à côte. Suivez chaque recrue de l'identification jusqu'à la lettre signée."
        bullets={[
          "Un seul outil du premier contact à la signature",
          "Évaluations coach et académiques côte à côte",
          "Pipeline personnalisé par recrue",
        ]}
        imageSrc="/preview-recruteur-dashboard.png"
        fakeUrl="nexus.app/recruteur/tableau-de-bord"
        imageAlt="Tableau de bord recruteur Nexus avec filtres et pipeline"
        reversed
      />

      <HowItWorks
        steps={[
          {
            number: "01",
            title: "Configure tes critères",
            description:
              "Sport, positions, régions, année de diplomation, moyenne générale minimum. Nexus filtre pour toi.",
          },
          {
            number: "02",
            title: "Explore les profils",
            description:
              "Parcours les athlètes en cards ou en liste. Stats, vidéo, évaluation coach — tout est là.",
          },
          {
            number: "03",
            title: "Contacte le coach",
            description:
              "Intéressé ? Écris au coach directement dans Nexus. Il reçoit une notification instantanée.",
          },
        ]}
      />

      <FeatureGrid
        title="TES OUTILS DE RECRUTEMENT"
        features={[
          {
            title: "Recherche avancée",
            description:
              "Filtre par 10+ critères : sport, position, région, moyenne générale, cote globale, taille, poids, année.",
          },
          {
            title: "Favoris et listes",
            description:
              "Sauvegarde tes prospects dans des listes nommées (ex: « QB 2027 »).",
          },
          {
            title: "Profils vérifiés",
            description:
              "Le badge vérifié garantit un profil complété à 60%+ avec données validées.",
          },
          {
            title: "Réputation coach",
            description:
              "Vois le score du coach avant de le contacter. Un coach « Recommandé » = évaluation fiable.",
          },
          {
            title: "Alertes temps réel",
            description:
              "Nouvel athlète, mise à jour de favori, lettre d'intention signée — tu sais tout en premier.",
          },
          {
            title: "Résumé hebdomadaire",
            description:
              "Chaque lundi, un digest de la semaine : nouveaux profils, tendances, opportunités.",
          },
        ]}
      />

      <TestimonialSection
        title="ILS UTILISENT NEXUS"
        testimonials={[
          {
            name: "Pierre Dufour",
            role: "Recruteur Football, CÉGEP Garneau",
            quote:
              "J'ai trouvé 3 recrues que j'aurais jamais repérées sans Nexus. Le gain de temps est énorme.",
          },
          {
            name: "Caroline Bergeron",
            role: "Recruteur Basketball, Collège Montmorency",
            quote:
              "Les évaluations à 11 critères m'évitent les mauvaises surprises. Je sais exactement ce que je recrute.",
          },
          {
            name: "Martin Lapointe",
            role: "Recruteur Hockey, CÉGEP de Jonquière",
            quote:
              "Le contact direct avec les coachs change tout. Avant, je faisais 20 appels pour avoir 2 réponses.",
          },
        ]}
        stats={[
          { value: "200+", label: "Profils vérifiés" },
          { value: "54", label: "CÉGEPs du RSEQ" },
          { value: "4h", label: "Temps de réponse moyen" },
        ]}
      />

      <CtaSection
        title="TA PROCHAINE RECRUE EST DÉJÀ SUR NEXUS"
        ctaPrimary={{ label: "EXPLORER LES ATHLÈTES →", href: "/auth?mode=signup&role=recruiter" }}
        subtext="Accès gratuit. Commence à recruter maintenant."
      />
    </div>
  );
}
