"use client";

/* 1.4.5 (B1) — rendu CLIENT (PageChargee) : le portail est dans l'appli, qui est un
   export statique. Le corps est celui de l'ancien composant serveur, inchangé. */
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageChargee, { type ParamsUrl } from "../_components/PageChargee";
import ListeTelechargements from "@/components/partenaire/ListeTelechargements";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/telechargements — partner's own download history
   Reads partner_card_downloads (RLS auto-restricts to current
   partner via 'Partners read own download history' policy from
   Phase 1). Most recent 50 downloads, reverse chronological.

   Chaque ligne : l'athlète, le format (Publication 1080×1350 ou
   Story 1080×1920, vignette à la bonne proportion) et la date.
   6.6 (BP 2026-10-18) : toucher une ligne ouvre l'APERÇU de la vraie
   carte en plein écran (Enregistrer, Partager, Voir le profil) —
   components/partenaire/ListeTelechargements + ApercuCarte.
═══════════════════════════════════════════════════════════════ */

/** Ligne PLATE rendue par public.partner_card_downloads_list. Les champs
    d'identité sont NULL quand l'athlète n'est plus partenaire-éligible : la
    trace du téléchargement survit, le profil ne se redivulgue pas. */
type PartnerDownloadRow = {
  id: string;
  format: string;
  downloaded_at: string;
  athlete_id: string | null;
  athlete_first_name: string | null;
  athlete_last_name: string | null;
  athlete_photo_url: string | null;
  athlete_sport_nom: string | null;
};

type DownloadRow = {
  id: string;
  format: "publication" | "story";
  downloaded_at: string;
  athletes: {
    id: string | null;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
    sport_id: string | null;
    sports: { nom: string | null } | null;
  } | null;
};

function formatRelativeFrench(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} semaine${Math.floor(days / 7) > 1 ? "s" : ""}`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

async function rendre() {
  const supabase = createClient();
  /* LECTURE PAR RPC — depuis le 2026-08-19 (point 5b du chantier RLS
     partenaire). Cette page embarquait `athletes(...)` dans sa requête sur
     partner_card_downloads. Cet embed dépendait de la policy « Approved
     partners read opted-in athletes », supprimée : il rendrait désormais NULL.
     La liste aurait continué de s'afficher, mais SANS nom, SANS photo, SANS
     sport — une panne muette, l'historique réduit à des cartes vides. Ce
     n'était pas un `!inner` : les lignes restaient, seul l'embed se vidait.

     public.partner_card_downloads_list porte son propre gate et filtre sur
     partner_id = auth.uid(). L'identité de l'athlète n'y est projetée que
     s'il est TOUJOURS éligible ; sinon la ligne subsiste avec des champs à
     NULL — la trace du téléchargement est préservée sans divulguer un profil
     redevenu invisible. */
  const { data, error } = await supabase.rpc("partner_card_downloads_list", {
    p_limit: 50,
  });

  if (error) {
    console.error("[partenaire/telechargements] load:", error);
  }
  /* La RPC rend des colonnes plates ; le rendu attend la forme imbriquée de
     l'ancien embed. On la reconstitue sans rien ajouter. */
  const downloads: DownloadRow[] = ((data ?? []) as PartnerDownloadRow[]).map((r) => ({
    id: r.id,
    format: r.format as DownloadRow["format"],
    downloaded_at: r.downloaded_at,
    athletes: r.athlete_id
      ? {
          id: r.athlete_id,
          first_name: r.athlete_first_name,
          last_name: r.athlete_last_name,
          photo_url: r.athlete_photo_url,
          sport_id: null,
          sports: r.athlete_sport_nom ? { nom: r.athlete_sport_nom } : null,
        }
      : null,
  }));
  const loadFailed = !!error;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Téléchargements</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Historique des cartes téléchargées. Touche une carte pour la revoir, l&apos;enregistrer ou la partager.</p>
      </div>

      {loadFailed ? (
        <div className="bg-[#1A1D24] border border-[#EF4444]/30 rounded-xl p-6 flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="text-[14px] font-bold text-[#EF4444]">Erreur lors du chargement des téléchargements</p>
            <p className="text-[13px] text-[#9CA3AF] mt-1">
              Réessaie de charger la page. Si le problème persiste, contacte l&apos;équipe Nexus.
            </p>
          </div>
        </div>
      ) : downloads.length === 0 ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1A1D24] border border-[#2D3748] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <p className="text-[14px] text-white font-bold">Aucun téléchargement pour le moment</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1.5 max-w-md mx-auto">
            Téléchargez la carte officielle d&apos;un athlète pour la publier dans vos contenus.
          </p>
          <Link
            href="/partenaire/athletes"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold uppercase tracking-wider rounded-lg transition-colors"
          >
            Parcourir le catalogue d&apos;athlètes
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2D3748]">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
              {downloads.length} téléchargement{downloads.length === 1 ? "" : "s"}
              {downloads.length === 50 && <span className="ml-2 text-[10px] text-[#6b7280] normal-case tracking-normal">(50 plus récents)</span>}
            </h2>
          </div>
          <ListeTelechargements lignes={downloads.map((d) => ({
            id: d.id,
            format: d.format,
            le: d.downloaded_at,
            libelleDate: formatRelativeFrench(d.downloaded_at),
            athleteId: d.athletes?.id ?? null,
            prenom: d.athletes?.first_name ?? null,
            nom: d.athletes?.last_name ?? null,
            photo: d.athletes?.photo_url ?? null,
            sport: d.athletes?.sports?.nom ?? null,
          }))} />
        </div>
      )}
    </div>
  );
}

export default function PartnerTelechargementsPage() {
  return <PageChargee rendre={rendre} />;
}
