import MarketingHero from "@/components/marketing/MarketingHero";
import ProblemSection from "@/components/marketing/ProblemSection";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import TestimonialSection from "@/components/marketing/TestimonialSection";
import CtaSection from "@/components/marketing/CtaSection";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import BrowserMockup from "@/components/ui/BrowserMockup";

export default function PourLesDirecteursPage() {
  return (
    <div className="hero-playbook bg-[#060A14] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      <MarketingHero
        eyebrow="POUR LES DIRECTEURS SPORTIFS"
        title="SUPERVISEZ VOTRE PROGRAMME SPORTIF — GRATUITEMENT"
        subtitle="Vos entraîneurs vous invitent sur Nexus. Accédez au tableau de bord de votre école sans frais. Aucun abonnement requis."
        ctaPrimary={{ label: "DEMANDER UNE INVITATION →", href: "#demander" }}
        ctaSecondary={{ label: "VOIR LES FONCTIONNALITÉS", href: "#features" }}
      />

      <ProblemSection
        title="PILOTER SANS DONNÉES, C'EST PILOTER À L'AVEUGLE"
        problems={[
          {
            icon: "chart",
            title: "Zéro données",
            description:
              "Vous demandez des rapports Excel en fin de saison. Aucune visibilité en temps réel sur le recrutement.",
          },
          {
            icon: "megaphoneOff",
            title: "Bouche-à-oreille",
            description:
              "Vous apprenez les placements par hasard. Aucun tracking centralisé des athlètes recrutés.",
          },
          {
            icon: "wallet",
            title: "Budget à justifier",
            description:
              "Vous devez prouver la valeur du programme sportif à votre direction. Avec quelles données ?",
          },
        ]}
      />

      {/* Full-width centered athlete profile preview */}
      <section className="py-20 bg-transparent">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="font-head text-[12px] font-bold uppercase tracking-[2px] text-[#E63946] mb-3">
              VITRINE ATHLÈTE
            </p>
            <h2 className="font-head text-2xl md:text-3xl font-black text-white leading-tight mb-4">
              Votre programme sportif mérite mieux qu&apos;un PDF
            </h2>
            <p className="text-base text-[#9CA3AF] leading-relaxed max-w-[600px] mx-auto">
              Chaque athlète de votre établissement est présenté avec un profil vérifié : stats,
              académique, rapport d&apos;entraîneur. Les recruteurs voient la qualité de votre
              programme avant même de décrocher le téléphone.
            </p>
          </div>
          <div className="max-w-[900px] mx-auto">
            <BrowserMockup
              imageSrc="/preview-profil-athlete.png"
              fakeUrl="nexus.app/directeur/athlete/marc-antoine-tremblay"
              alt="Profil étudiant-athlète vu par le directeur sportif"
            />
          </div>
        </div>
      </section>

      {/* Side-by-side: École vs CÉGEP */}
      <section className="py-20 bg-transparent">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left card — École secondaire */}
            <div className="bg-[#1A1D24] rounded-xl border border-[#2A2D35] p-6 md:p-8">
              <p className="font-head text-[12px] font-bold uppercase tracking-[2px] text-[#E63946] mb-3">
                DIRECTEUR — ÉCOLE
              </p>
              <h3 className="font-head text-xl md:text-2xl font-black text-white leading-tight mb-2">
                Supervisez sans microgérer
              </h3>
              <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6">
                Voyez combien d&apos;athlètes sont inscrits, lesquels attirent l&apos;attention des
                recruteurs, et quels sports performent — sans déranger vos coachs.
              </p>
              <div className="relative">
                <div className="absolute -inset-4 bg-[#E63946]/15 blur-[50px] rounded-3xl pointer-events-none" />
                <BrowserMockup
                  imageSrc="/preview-directeur-ecole-dashboard.png"
                  fakeUrl="nexus.app/directeur/tableau-de-bord"
                  alt="Tableau de bord directeur sportif école secondaire"
                  flat
                />
              </div>
            </div>

            {/* Right card — CÉGEP */}
            <div className="bg-[#1A1D24] rounded-xl border border-[#2A2D35] p-6 md:p-8">
              <p className="font-head text-[12px] font-bold uppercase tracking-[2px] text-[#E63946] mb-3">
                DIRECTEUR — CÉGEP
              </p>
              <h3 className="font-head text-xl md:text-2xl font-black text-white leading-tight mb-2">
                Mesurez votre entonnoir de recrutement
              </h3>
              <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6">
                Combien d&apos;athlètes identifiés deviennent des contacts? Des visites?
                Des lettres signées? Voyez où votre recrutement décroche et où il performe.
              </p>
              <div className="relative">
                <div className="absolute -inset-4 bg-[#E63946]/15 blur-[50px] rounded-3xl pointer-events-none" />
                <BrowserMockup
                  imageSrc="/preview-directeur-cegep-stats.png"
                  fakeUrl="nexus.app/directeur-cegep/stats-recrutement"
                  alt="Statistiques de recrutement directeur CÉGEP"
                  flat
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks
        steps={[
          {
            number: "01",
            title: "Un coach vous invite",
            description:
              "Un entraîneur de votre école vous envoie un lien d'invitation par courriel.",
          },
          {
            number: "02",
            title: "Créez votre compte",
            description:
              "Activez votre accès en 30 secondes. Aucun abonnement, aucune carte de crédit.",
          },
          {
            number: "03",
            title: "Supervisez",
            description:
              "Dashboard complet, stats de recrutement, gestion des coachs — tout est inclus gratuitement.",
          },
        ]}
      />

      <FeatureGrid
        id="features"
        title="VOS OUTILS DE PILOTAGE"
        features={[
          {
            title: "Tableau de bord temps réel",
            description:
              "KPIs clés en un coup d'œil : athlètes, vues, placements. Tendances mensuelles.",
          },
          {
            title: "Gestion des coachs/entraîneurs",
            description:
              "Invitez, suivez l'activité, relancez les inactifs — le tout depuis un seul écran.",
          },
          {
            title: "Stats par sport",
            description:
              "Comparez la performance de recrutement entre vos différents programmes sportifs.",
          },
          {
            title: "Entonnoir de conversion",
            description:
              "Profils → Vus → Contactés → Placés. Identifiez où le funnel bloque.",
          },
          {
            title: "Rapport PDF",
            description:
              "Exportez un rapport professionnel avec votre logo pour les réunions de direction.",
          },
          {
            title: "Alerte coach inactif",
            description:
              "Notification automatique quand un coach ne s'est pas connecté depuis 14 jours.",
          },
        ]}
      />

      <TestimonialSection
        testimonials={[
          {
            name: "Nathalie Gagnon",
            role: "Dir. sportive, École De Rochebelle",
            quote:
              "Pour la première fois, j'ai des données concrètes à présenter au conseil. Le programme sportif n'est plus un coût, c'est un investissement mesurable.",
          },
          {
            name: "François Simard",
            role: "Dir. sportif, CÉGEP Garneau",
            quote:
              "Je vois en temps réel quels entraîneurs recrutent activement et lesquels attendent. Ça a changé ma façon de gérer.",
          },
        ]}
      />

      <CtaSection
        eyebrow="PRÊT À PILOTER ?"
        title="PILOTEZ VOS PROGRAMMES AVEC DES DONNÉES"
        ctaPrimary={{ label: "DEMANDER UNE INVITATION →", href: "#demander" }}
        ctaSecondary={{ label: "VOUS ÊTES AUSSI ENTRAÎNEUR ?", href: "/auth?mode=signup" }}
        subtext="L'accès Directeur sportif est 100% gratuit. Demandez à un entraîneur de votre école de vous inviter."
      />
    </div>
  );
}
