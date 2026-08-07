"use client";

// components/shared/pages/PagesTab.tsx
//
// « Pages » — la page publique du collège, puis une entrée par équipe. Cliquer
// ouvre l'éditeur correspondant en PLEINE TOILE.
//
// ── DEUX APPELANTS, UN SEUL COMPOSANT ───────────────────────────────────────
//   · ADMIN — onglet « Pages » de la fiche CÉGEP (/admin/schools/[id]) : le
//     collège est celui de la fiche ouverte, passé en prop.
//   · RECRUTEUR — /recruteur/ma-page : le collège est le SIEN, résolu depuis
//     users.school_id par l'appelant.
// Ce composant ne sait pas lequel des deux l'affiche, et ne doit pas le savoir :
// il reçoit un collège et une liste d'équipes, il rend des liens. Toute règle
// de périmètre ou de forfait appartient à l'appelant — voir plus bas.
//
// ⚠ CE COMPOSANT N'EST PAS UNE BARRIÈRE. Il ouvre ce qu'on lui donne. Le
// contrôle réel est la RLS (can_edit_school_page / can_edit_team_page), et le
// choix du collège appartient à l'appelant. Ne pas y ajouter de garde : elle
// donnerait l'illusion d'une protection que ce fichier ne peut pas tenir.
//
// ── PLEINE TOILE, PAS UNE SOUS-ROUTE ────────────────────────────────────────
// Superposition `position: fixed` plutôt qu'une route enfant : les éditeurs ont
// une topbar collante et des aperçus en colonne, ils veulent toute la fenêtre —
// pas la place qui reste sous l'en-tête et la barre de stats. Et le retour
// ramène à l'onglet TEL QU'IL ÉTAIT, sans rechargement ni onglet réinitialisé
// sur « Coachs », ce qu'une navigation aurait imposé.
//
// ── CHARGEMENT À LA DEMANDE ─────────────────────────────────────────────────
// Les deux éditeurs pèsent lourd (CSS scopés, aperçus, sections). `dynamic` +
// `ssr:false` les tient hors du bundle de la fiche : rien n'est téléchargé tant
// qu'on n'a pas cliqué. Ils sont déjà "use client", le rendu serveur ne leur
// manque pas.

import * as React from "react";
import dynamic from "next/dynamic";

const PageEditor = dynamic(() => import("@/components/page-editor/PageEditor"), { ssr: false });
const TeamEditor = dynamic(() => import("@/components/team-editor/TeamEditor"), { ssr: false });

const card = "bg-[#1A1D24] border border-[#2D3748] rounded-xl";

export interface PagesTabTeam {
  id: string;
  nom: string;
  sport_name: string | null;
  division: string | null;
  gender: string | null;
}

/** Cible ouverte en pleine toile. `null` = on est dans la liste. */
type Cible = { kind: "ecole" } | { kind: "equipe"; teamId: string; label: string } | null;

/* ═══ LA PLEINE TOILE ═══════════════════════════════════════════════════════
   Le bouton de retour FLOTTE au-dessus au lieu d'occuper une barre à lui : une
   barre pousserait la topbar collante de l'éditeur vers le bas et casserait son
   `position: sticky`. Ici l'éditeur garde exactement la mise en page pour
   laquelle il a été dessiné.                                                  */
function PleineToile({ titre, onClose, children }: {
  titre: string; onClose: () => void; children: React.ReactNode;
}) {
  React.useEffect(() => {
    const auClavier = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", auClavier);
    // Le fond ne doit pas défiler derrière la toile.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = avant;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={titre}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "#111317", overflowY: "auto",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        title="Retour à l'onglet Pages (Échap)"
        style={{
          position: "fixed", top: 12, left: 12, zIndex: 9100,
          background: "#1A1D24", color: "#EDEFF3",
          border: "1px solid #2D3748", borderRadius: 8,
          padding: "7px 13px", fontSize: 12, fontWeight: 700,
          fontFamily: "Outfit, system-ui, sans-serif", textAlign: "left",
          letterSpacing: ".06em", textTransform: "uppercase", cursor: "pointer",
          boxShadow: "0 8px 22px -10px rgba(0,0,0,.9)",
        }}
      >
        ← Retour
      </button>
      {children}
    </div>
  );
}

/* ═══ UNE LIGNE DE LA LISTE ════════════════════════════════════════════════ */
function Ligne({ titre, meta, onClick }: { titre: string; meta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left border-b border-[#2D3748] last:border-b-0 hover:bg-[#13151a] transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-bold text-[#E0E0E0] truncate">{titre}</span>
        <span className="block text-[12px] text-[#9CA3AF] truncate">{meta}</span>
      </span>
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[#E63946]">
        Modifier →
      </span>
    </button>
  );
}

export default function PagesTab({
  schoolId, schoolName, teams,
}: { schoolId: string; schoolName: string; teams: PagesTabTeam[] }) {
  const [cible, setCible] = React.useState<Cible>(null);

  if (cible?.kind === "ecole") {
    return (
      <PleineToile titre={`Page publique — ${schoolName}`} onClose={() => setCible(null)}>
        {/* schoolIdParam : le collège de CETTE fiche. Le provider ne l'honore
            que pour un admin plateforme — le portail admin en garantit un. */}
        <PageEditor schoolIdParam={schoolId} />
      </PleineToile>
    );
  }
  if (cible?.kind === "equipe") {
    return (
      <PleineToile titre={`Page équipe — ${cible.label}`} onClose={() => setCible(null)}>
        <TeamEditor teamId={cible.teamId} />
      </PleineToile>
    );
  }

  return (
    <section className={`${card} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-[#2D3748] bg-[#13151a]">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">
          Pages publiques
        </h3>
      </div>

      <Ligne
        titre={schoolName || "Page du collège"}
        meta="Page du CÉGEP — identité, campus, programmes, parcours, actualités"
        onClick={() => setCible({ kind: "ecole" })}
      />

      {teams.length === 0 ? (
        <div className="px-4 py-6 text-[13px] text-[#6b7280]">
          Aucune équipe — seule la page du collège est modifiable.
        </div>
      ) : (
        teams.map((t) => (
          <Ligne
            key={t.id}
            titre={t.nom}
            meta={[t.sport_name, t.division, t.gender].filter(Boolean).join(" · ") || "Équipe"}
            onClick={() => setCible({ kind: "equipe", teamId: t.id, label: t.nom })}
          />
        ))
      )}
    </section>
  );
}
