"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MediaPartner, PartnerStatus } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   Partner Tableau de bord — Phase 1 landing.
   Welcome message + status badge + four "Bientôt disponible"
   tiles previewing the upcoming sections.
═══════════════════════════════════════════════════════════════ */

const STATUS_PILL: Record<PartnerStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-[#F59E0B]/15", text: "text-[#F59E0B]", label: "En attente" },
  APPROVED: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Approuvé" },
  SUSPENDED: { bg: "bg-[#6B7280]/15", text: "text-[#9CA3AF]", label: "Suspendu" },
  REVOKED: { bg: "bg-[#EF4444]/15", text: "text-[#EF4444]", label: "Révoqué" },
};

const TILES = [
  {
    title: "Newsroom",
    href: "/partenaire/newsroom",
    description: "Athlètes vedettes de la semaine, montants à publier, contenu prêt-à-utiliser.",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8z" /></svg>,
  },
  {
    title: "Athlètes",
    href: "/partenaire/athletes",
    description: "Catalogue des athlètes ayant consenti à la diffusion publique.",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></svg>,
  },
  {
    title: "Téléchargements",
    href: "/partenaire/telechargements",
    description: "Historique des cartes téléchargées + métriques d'usage.",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  },
  {
    title: "Mon profil",
    href: "/partenaire/profil",
    description: "Logo, réseaux sociaux, description de l'organisation.",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  },
];

export default function PartenaireDashboardPage() {
  const [partner, setPartner] = useState<MediaPartner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("media_partners")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPartner(data as MediaPartner);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto"><p className="text-[13px] text-[#6B7280]">Chargement…</p></div>;
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-8">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Bienvenue{partner?.organization_name ? `, ${partner.organization_name}` : ""}
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Espace partenaire Nexus — bêta fermée Phase 1</p>
        {partner && (
          <span className={`inline-flex items-center mt-3 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${STATUS_PILL[partner.status].bg} ${STATUS_PILL[partner.status].text}`}>
            {STATUS_PILL[partner.status].label}
          </span>
        )}
      </div>

      {/* Phase intro */}
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5">
        <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
          Ton espace est en train d&apos;être bâti. Les sections ci-dessous arriveront bientôt — tu pourras parcourir les athlètes, télécharger leurs cartes Nexus, et publier sur tes réseaux. En attendant, complète ton profil pour qu&apos;on puisse te mettre en avant.
        </p>
      </div>

      {/* Coming-soon tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/30 p-5 transition-all duration-300 hover:-translate-y-0.5 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E63946]/10 flex items-center justify-center shrink-0">
                {tile.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-head text-[15px] font-black text-white uppercase tracking-tight">{tile.title}</h3>
                  {tile.href !== "/partenaire/profil" && (
                    <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[9px] font-bold uppercase tracking-wider">
                      Bientôt
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[#9CA3AF] mt-1.5 leading-relaxed">{tile.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
