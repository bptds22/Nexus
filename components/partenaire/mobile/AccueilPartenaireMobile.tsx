"use client";

/* ═══════════════════════════════════════════════════════════════
   AccueilPartenaireMobile — l'Accueil partenaire NATIF de l'appli
   (1.4.5, demande BP : « un feeling natif, pas web »). Calqué sur le
   canon recruteur (components/shared/RecruteurDashboardMobile.tsx) :
     - salutation flottante sur la lueur rouge (organisation, date,
       pastille de statut PENDING / APPROVED / …) ;
     - carte héros avec 3 STATISTIQUES cliquables (BP 2026-10-18, 6.4) :
       En attente · À confirmer · Réclamées ce mois — calculées sur les
       données DE CE PARTENAIRE seulement (règle C2 : jamais un total de la
       plateforme ; lib/partenaires/accueilStats). Sans permission d'évaluer,
       les encarts restent des raccourcis « Voir » ;
     - accès rapides en listes groupées natives (états actifs, haptique)
       vers les MÊMES routes que les tuiles du web (app/partenaire/page.tsx).
   Les entrées d'évaluation (Mes évaluations, Mes athlètes) suivent la
   règle partagée entreeVisible (lib/partenaires/navigation.ts), lue sur
   `peut_evaluer` de la ligne media_partners déjà chargée — aucune
   requête de plus que le web.
   La lueur est en `absolute` (pas en `fixed`) : AnimatedRoute pose un
   transform qui piégerait un `fixed`.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { triggerHaptic } from "@/lib/haptics";
import { entreeVisible } from "@/lib/partenaires/navigation";
import type { MediaPartner, PartnerStatus } from "@/lib/types/models";
import { DashboardGreeting } from "@/components/shared/dashboard/DashboardGreeting";
import { DashboardHero } from "@/components/shared/dashboard/DashboardHero";
import { SectionDivider } from "@/components/shared/dashboard/SectionDivider";
import { frenchDateUppercase } from "@/components/shared/dashboard/utils";
import { chargerStatsAccueil, LIEN_STAT, type StatsAccueilPartenaire } from "@/lib/partenaires/accueilStats";

/* ── Statut (mêmes libellés que le web) ───────────────────────── */

const STATUT: Record<PartnerStatus, { label: string; point: string }> = {
  PENDING: { label: "En attente", point: "#F59E0B" },
  APPROVED: { label: "Approuvé", point: "#22C55E" },
  SUSPENDED: { label: "Suspendu", point: "#9CA3AF" },
  REVOKED: { label: "Révoqué", point: "#EF4444" },
};

/* ── Icônes (traits du web, 20 px) ────────────────────────────── */

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ICONES = {
  recherche: <Icone><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></Icone>,
  evaluations: <Icone><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Icone>,
  athletes: <Icone><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></Icone>,
  newsroom: <Icone><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8z" /></Icone>,
  classements: <Icone><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></Icone>,
  tendances: <Icone><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></Icone>,
  telechargements: <Icone><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Icone>,
  profil: <Icone><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></Icone>,
};

/* ── Accès rapides : mêmes routes que les tuiles du web, plus les deux
   onglets d'évaluation (masqués sans permission). ─────────────── */

interface Entree { titre: string; href: string; description: string; icone: ReactNode }

const GROUPES: { titre: string; entrees: Entree[] }[] = [
  {
    titre: "Ton espace",
    entrees: [
      { titre: "Recherche", href: "/partenaire/athletes", description: "Les athlètes qui ont consenti à la diffusion partenaire", icone: ICONES.recherche },
      // Fusion du 2026-10-18 (6.1) : En attente + Mes évaluations dans un seul écran.
      { titre: "Mes athlètes", href: "/partenaire/mes-athletes", description: "Tes cartes en attente et tes évaluations", icone: ICONES.athletes },
    ],
  },
  {
    titre: "Explorer",
    entrees: [
      { titre: "Newsroom", href: "/partenaire/newsroom", description: "Engagements et nouvelles 5 étoiles en temps réel", icone: ICONES.newsroom },
      { titre: "Classements", href: "/partenaire/classements", description: "Top 25 par sport, position, région et promotion", icone: ICONES.classements },
      { titre: "Tendances", href: "/partenaire/tendances", description: "Les athlètes en pleine ascension cette semaine", icone: ICONES.tendances },
      { titre: "Téléchargements", href: "/partenaire/telechargements", description: "L'historique des cartes téléchargées", icone: ICONES.telechargements },
    ],
  },
  {
    titre: "Compte",
    entrees: [
      { titre: "Mon profil", href: "/partenaire/profil", description: "Tes informations enregistrées dans Nexus", icone: ICONES.profil },
    ],
  },
];

/* ── Ligne native (liste groupée) ─────────────────────────────── */

function LigneAcces({ entree, derniere, onTap }: { entree: Entree; derniere: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center gap-3 pl-4 text-left active:bg-white/[0.05] transition-colors"
    >
      <span className="w-9 h-9 rounded-full bg-[#E63946]/10 flex items-center justify-center shrink-0">
        {entree.icone}
      </span>
      <span className={`flex-1 min-w-0 flex items-center gap-2 py-3.5 pr-4 ${derniere ? "" : "border-b border-white/[0.06]"}`}>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-semibold text-white truncate">{entree.titre}</span>
          <span className="block text-[13px] text-white/45 mt-0.5 truncate">{entree.description}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </button>
  );
}

/* ── Squelette (même silhouette que l'écran chargé) ───────────── */

function SqueletteAccueil() {
  return (
    <div className="px-4 space-y-6 animate-pulse" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}>
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-white/[0.08]" />
        <div className="h-4 w-20 rounded bg-white/[0.08]" />
        <div className="h-8 w-56 rounded bg-white/[0.08]" />
      </div>
      <div className="h-[190px] rounded-[20px] bg-white/[0.06]" />
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-white/[0.06]" />
        <div className="h-[200px] rounded-2xl bg-white/[0.05]" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export default function AccueilPartenaireMobile() {
  const router = useRouter();
  const [partner, setPartner] = useState<MediaPartner | null>(null);
  const [loading, setLoading] = useState(true);
  // Date posée côté client après la lecture (pas de décalage d'hydratation).
  const [dateDuJour, setDateDuJour] = useState<Date | null>(null);
  // Statistiques DU partenaire (null tant que non lues, ou sans permission d'évaluer).
  const [stats, setStats] = useState<StatsAccueilPartenaire | null>(null);

  useEffect(() => {
    let vivant = true;
    // Même lecture que la page web : la ligne media_partners du connecté.
    async function charger() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      let ligne: MediaPartner | null = null;
      if (user) {
        const { data } = await supabase
          .from("media_partners")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        ligne = (data as MediaPartner | null) ?? null;
      }
      if (!vivant) return;
      setPartner(ligne);
      setDateDuJour(new Date());
      setLoading(false);
      if (ligne?.peut_evaluer) {
        const s = await chargerStatsAccueil(supabase);
        if (vivant) setStats(s);
      }
    }
    void charger();
    return () => { vivant = false; };
  }, []);

  const ouvrir = (href: string) => {
    triggerHaptic("Light");
    router.push(href);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111317] text-white">
        <SqueletteAccueil />
      </div>
    );
  }

  const peutEvaluer = partner?.peut_evaluer;
  const statut = partner ? STATUT[partner.status] : null;

  /* Encarts du héros : 3 statistiques du partenaire (6.4) ; sans permission
     d'évaluer, des raccourcis « Voir » (Recherche, Tendances, Classements). */
  const encartsStats = peutEvaluer ? [
    { label: "En attente", value: stats?.enAttente ?? "–", subtitle: "lien envoyé", onTap: () => router.push(LIEN_STAT.enAttente) },
    { label: "À confirmer", value: stats?.aConfirmer ?? "–", subtitle: "propositions", alerte: (stats?.aConfirmer ?? 0) > 0,
      onTap: () => router.push(LIEN_STAT.aConfirmer) },
    { label: "Réclamées ce mois", value: stats?.reclameesCeMois ?? "–",
      subtitle: stats ? `${stats.evaluationsTotal} évaluation${stats.evaluationsTotal > 1 ? "s" : ""} au total` : undefined,
      onTap: () => router.push(LIEN_STAT.reclamees) },
  ] : null;
  const encartsRaccourcis = [
    { label: "Recherche", href: "/partenaire/athletes", subtitle: "le catalogue" },
    { label: "Évaluations", href: "/partenaire/mes-athletes", subtitle: "les tiennes" },
    { label: "Mes athlètes", href: "/partenaire/prospects", subtitle: "à suivre" },
    { label: "Tendances", href: "/partenaire/tendances", subtitle: "cette semaine" },
    { label: "Classements", href: "/partenaire/classements", subtitle: "top 25" },
  ]
    .filter((e) => entreeVisible(e.href, peutEvaluer))
    .slice(0, 3)
    .map((e) => ({ label: e.label, value: "Voir", subtitle: e.subtitle, onTap: () => router.push(e.href) }));
  const encarts = encartsStats ?? encartsRaccourcis;

  const groupes = GROUPES
    .map((g) => ({ ...g, entrees: g.entrees.filter((e) => entreeVisible(e.href, peutEvaluer)) }))
    .filter((g) => g.entrees.length > 0);

  return (
    <div className="relative min-h-screen bg-[#111317] text-white">
      {/* Lueur rouge du canon (DashboardGradientLayout), en absolu. */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: 520,
          background:
            "linear-gradient(180deg, " +
              "rgba(230,57,70,1) 0%, " +
              "rgba(184,40,52,0.85) 18%, " +
              "rgba(127,27,37,0.65) 35%, " +
              "rgba(76,16,22,0.4) 55%, " +
              "rgba(40,10,14,0.18) 75%, " +
              "rgba(17,19,23,0) 100%)",
          zIndex: 0,
        }}
      />

      <div className="relative" style={{ zIndex: 1 }}>
        <DashboardGreeting
          greeting={partner?.organization_name || "Partenaire"}
          dateLabel={dateDuJour ? frenchDateUppercase(dateDuJour) : undefined}
          chip={
            statut
              ? {
                  label: statut.label,
                  icon: <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statut.point }} />,
                }
              : undefined
          }
        />

        <DashboardHero
          eyebrow="Espace partenaire"
          headline={
            <button
              type="button"
              onClick={() => ouvrir("/partenaire/athletes")}
              className="text-left active:opacity-80"
            >
              <h2 className="text-[24px] font-extrabold text-white leading-tight tracking-tight">
                Trouve ta<br /><span className="text-[#E63946]">prochaine histoire</span>
              </h2>
            </button>
          }
          insets={encarts}
        />

        {partner && partner.status !== "APPROVED" && (
          <p className="px-5 pt-4 text-[13px] text-white/55 leading-relaxed">
            {partner.status === "PENDING"
              ? "Ton accès partenaire est en attente d'approbation par l'équipe Nexus."
              : "Ton accès partenaire n'est pas actif. Écris à l'équipe Nexus pour en savoir plus."}
          </p>
        )}

        <div className="py-6">
          <p className="px-4 text-[14px] text-white/55 leading-relaxed">
            Parcours les athlètes, télécharge leurs cartes officielles et publie avec attribution Nexus.
          </p>
        </div>

        <SectionDivider />

        {/* Marge du bas : le dernier groupe n'est jamais caché derrière la barre d'onglets. */}
        <div className="pt-6 space-y-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }} data-accueil-groupes>
          {groupes.map((g) => (
            <section key={g.titre}>
              <h2 className="px-4 mb-2 text-xs uppercase tracking-[0.18em] text-white/50 font-semibold">
                {g.titre}
              </h2>
              <div className="mx-4 rounded-2xl overflow-hidden bg-[#1A1D24] border border-white/[0.05]">
                {g.entrees.map((e, i) => (
                  <LigneAcces
                    key={e.href}
                    entree={e}
                    derniere={i === g.entrees.length - 1}
                    onTap={() => ouvrir(e.href)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
