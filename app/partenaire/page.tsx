"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MediaPartner, PartnerStatus } from "@/lib/types/models";
import AccueilPartenaireMobile from "@/components/partenaire/mobile/AccueilPartenaireMobile";
import { frenchDateUppercase } from "@/components/shared/dashboard/utils";
import { chargerStatsAccueil, LIEN_STAT, type StatsAccueilPartenaire } from "@/lib/partenaires/accueilStats";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Accueil partenaire (web) — même modèle que l'appli (BP 2026-10-18, 6.4) :
     - en-tête : la date, « Bonjour, [organisation] », la pastille de statut ;
     - bloc « Espace partenaire / Trouve ta prochaine histoire » avec 3
       STATISTIQUES cliquables (En attente · À confirmer · Réclamées ce mois),
       calculées sur les données DE CE PARTENAIRE seulement (règle C2 : jamais
       un total de la plateforme). Sans permission d'évaluer : raccourcis ;
     - la phrase d'accueil ; « Ton espace » (Recherche, Mes athlètes) ;
       « Explorer » tel quel ; « Compte ».
═══════════════════════════════════════════════════════════════ */

const STATUS_PILL: Record<PartnerStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-[#F59E0B]/15", text: "text-[#F59E0B]", label: "En attente" },
  APPROVED: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Approuvé" },
  SUSPENDED: { bg: "bg-[#6B7280]/15", text: "text-[#9CA3AF]", label: "Suspendu" },
  REVOKED: { bg: "bg-[#EF4444]/15", text: "text-[#EF4444]", label: "Révoqué" },
};

const icone = (d: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

interface Entree { titre: string; href: string; description: string; icone: ReactNode; evaluation?: boolean }

const GROUPES: { titre: string; entrees: Entree[] }[] = [
  {
    titre: "Ton espace",
    entrees: [
      { titre: "Recherche", href: "/partenaire/athletes", description: "Catalogue des athlètes ayant consenti à la diffusion partenaire",
        icone: icone(<><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></>) },
      { titre: "Mes athlètes", href: "/partenaire/mes-athletes", description: "Tes cartes en attente et tes évaluations", evaluation: true,
        icone: icone(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>) },
    ],
  },
  {
    titre: "Explorer",
    entrees: [
      { titre: "Newsroom", href: "/partenaire/newsroom", description: "Engagements et nouvelles 5 étoiles en temps réel",
        icone: icone(<><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8z" /></>) },
      { titre: "Classements", href: "/partenaire/classements", description: "Top 25 athlètes par sport, position, région et promotion",
        icone: icone(<><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>) },
      { titre: "Tendances", href: "/partenaire/tendances", description: "Athlètes en pleine ascension cette semaine",
        icone: icone(<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>) },
      { titre: "Téléchargements", href: "/partenaire/telechargements", description: "Historique des cartes téléchargées",
        icone: icone(<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>) },
    ],
  },
  {
    titre: "Compte",
    entrees: [
      { titre: "Mon profil", href: "/partenaire/profil", description: "Vos informations enregistrées dans Nexus",
        icone: icone(<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>) },
    ],
  },
];

/* Appli (1.4.5, « natif, pas web ») : Accueil natif.
   Aiguillage sans hook — les hooks vivent dans chaque variante. */
export default function PartenaireDashboardPage() {
  return IS_CAPACITOR ? <AccueilPartenaireMobile /> : <AccueilPartenaireWeb />;
}

function Statistique({ label, valeur, sousTitre, href, alerte = false }: {
  label: string; valeur: number | string; sousTitre?: string; href: string; alerte?: boolean;
}) {
  return (
    <Link href={href} data-stat={label}
      className="group rounded-xl border border-white/[0.06] bg-[#0C0E12] p-4 hover:border-[#E63946]/40 transition-colors">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/55 font-semibold">{label}</p>
      <p className={`mt-1.5 text-[28px] font-extrabold leading-none tabular-nums ${alerte ? "text-[#E63946]" : "text-white"}`}>{valeur}</p>
      {sousTitre && <p className="mt-1.5 text-[12px] text-white/45">{sousTitre}</p>}
    </Link>
  );
}

function AccueilPartenaireWeb() {
  const [partner, setPartner] = useState<MediaPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateDuJour, setDateDuJour] = useState<Date | null>(null);
  const [stats, setStats] = useState<StatsAccueilPartenaire | null>(null);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("media_partners")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!vivant) return;
      const ligne = (data as MediaPartner | null) ?? null;
      setPartner(ligne);
      setDateDuJour(new Date());
      setLoading(false);
      if (ligne?.peut_evaluer) {
        const s = await chargerStatsAccueil(supabase);
        if (vivant) setStats(s);
      }
    })();
    return () => { vivant = false; };
  }, []);

  if (loading) {
    return <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto"><p className="text-[13px] text-[#6B7280]">Chargement…</p></div>;
  }

  const peutEvaluer = partner?.peut_evaluer === true;
  const groupes = GROUPES
    .map((g) => ({ ...g, entrees: g.entrees.filter((e) => !e.evaluation || peutEvaluer) }))
    .filter((g) => g.entrees.length > 0);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-8" data-accueil-partenaire>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {dateDuJour && (
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] font-semibold">{frenchDateUppercase(dateDuJour)}</p>
          )}
          <p className="text-[14px] text-[#c8c8cc] mt-1">Bonjour,</p>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight truncate">
            {partner?.organization_name || "Partenaire"}
          </h1>
        </div>
        {partner && (
          <span className={`inline-flex items-center mt-6 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0 ${STATUS_PILL[partner.status].bg} ${STATUS_PILL[partner.status].text}`}>
            {STATUS_PILL[partner.status].label}
          </span>
        )}
      </div>

      <div className="rounded-[20px] border border-white/[0.08] bg-[#16191F] p-6" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55 font-semibold">Espace partenaire</p>
        <Link href="/partenaire/athletes" className="inline-block mt-2 hover:opacity-90">
          <h2 className="text-[26px] font-extrabold text-white leading-tight tracking-tight">
            Trouve ta <span className="text-[#E63946]">prochaine histoire</span>
          </h2>
        </Link>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5" data-stats-accueil>
          {peutEvaluer ? (
            <>
              <Statistique label="En attente" valeur={stats?.enAttente ?? "–"} sousTitre="lien envoyé, sans profil Nexus" href={LIEN_STAT.enAttente} />
              <Statistique label="À confirmer" valeur={stats?.aConfirmer ?? "–"} sousTitre="propositions à accepter ou refuser"
                href={LIEN_STAT.aConfirmer} alerte={(stats?.aConfirmer ?? 0) > 0} />
              <Statistique label="Réclamées ce mois" valeur={stats?.reclameesCeMois ?? "–"}
                sousTitre={stats ? `${stats.evaluationsTotal} évaluation${stats.evaluationsTotal > 1 ? "s" : ""} au total` : undefined}
                href={LIEN_STAT.reclamees} />
            </>
          ) : (
            <>
              <Statistique label="Recherche" valeur="Voir" sousTitre="le catalogue" href="/partenaire/athletes" />
              <Statistique label="Tendances" valeur="Voir" sousTitre="cette semaine" href="/partenaire/tendances" />
              <Statistique label="Classements" valeur="Voir" sousTitre="top 25" href="/partenaire/classements" />
            </>
          )}
        </div>
      </div>

      <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
        Parcours les athlètes, télécharge leurs cartes officielles et publie avec attribution Nexus.
      </p>

      {groupes.map((g) => (
        <section key={g.titre}>
          <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-white/50 font-semibold">{g.titre}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {g.entrees.map((e) => (
              <Link key={e.href} href={e.href}
                className="group flex items-start gap-3 bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/30 p-4 transition-colors">
                <span className="w-10 h-10 rounded-full bg-[#E63946]/10 flex items-center justify-center shrink-0">{e.icone}</span>
                <span className="min-w-0">
                  <span className="block font-head text-[15px] font-black text-white uppercase tracking-tight">{e.titre}</span>
                  <span className="block text-[12px] text-[#9CA3AF] mt-1 leading-relaxed">{e.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
