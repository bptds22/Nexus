"use client";

import FeatureGate from "@/components/subscription/FeatureGate";
import { RecruteurListesMobile } from "@/components/shared/RecruteurListesMobile";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import StarRating from "@/components/ui/StarRating";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import type { ProspectList, ProspectListAthlete } from "./_data/mockListsData";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useListesUnite, useNotesListeUnite } from "@/lib/queries/recruiter/useListesUnite";
import FilNotesSuivi from "@/components/recruteur/notes/FilNotesSuivi";
import { lireCartes, versMembreListe, ajouterCarteAListe, retirerCarteDeListe } from "@/lib/cartes/carteProspect";
import { LegendeProspect, SURFACE_PROSPECT } from "@/components/recruteur/cartes/PanneauCarte";
import { useFavorisUnite } from "@/lib/queries/recruiter/useFavorisUnite";
import { useAuteursUnite, nomAuteur } from "@/lib/queries/recruiter/useProcessusUnite";

/* ═══════════════════════════════════════════════════════════════
   Mes Listes de Prospects — Organized folders for pipeline athletes
   Grid overview → expanded list view with athlete table

   LISTES DE L'UNITÉ (lot B2, étape 2 — décisions BP 2026-09-24). La page
   est réservée au Pro (FeatureGate) : elle montre les listes de l'UNITÉ
   (cégep × sport), que tous les Pro de l'unité voient et modifient.
   - chaque liste porte son auteur, chaque membre qui l'a ajouté, chaque
     note son auteur ;
   - les notes des collègues se lisent sans se modifier (décision BP 2) ;
   - toutes les lectures passent par les clés du tableau blanc
     (lib/queries/tableauBlanc.ts : jamais persistées), toutes les
     écritures les invalident — un geste d'un collègue apparaît au prochain
     affichage ou au retour sur l'onglet.
═══════════════════════════════════════════════════════════════ */

const GOLD = "#F59E0B";
const BLUE = "#3B82F6";

/* ── Toast ────────────────────────────────────────────────────── */

function Toast({ message, erreur, onDone }: { message: string; erreur?: boolean; onDone: () => void }) {
  return (
    <div role={erreur ? "alert" : undefined} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-[fadeInUp_0.3s_ease-out]">
      <div className={`bg-[#1A1D24] border rounded-lg px-5 py-3 shadow-lg flex items-center gap-3 ${erreur ? "border-[#EF4444]/40" : "border-[#2D3748]"}`}>
        {erreur
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
        <span className="text-[13px] font-bold text-white">{message}</span>
        <button type="button" onClick={onDone} className="text-[#6b7280] hover:text-white ml-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ── Confirm Modal ────────────────────────────────────────────── */

function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-[modalIn_0.2s_ease-out]">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">{title}</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3 mt-5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 text-[13px] font-bold rounded-lg transition-colors text-white ${danger ? "bg-[#EF4444] hover:bg-[#DC2626]" : "bg-[#E63946] hover:bg-[#D42B22]"}`}
          >
            {confirmLabel || "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Stars: use shared StarRating component */

/* ── Sport breakdown pills ────────────────────────────────────── */

function SportBreakdown({ athletes }: { athletes: ProspectListAthlete[] }) {
  const breakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of athletes) m.set(a.sport, (m.get(a.sport) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [athletes]);

  return (
    <span className="text-[11px] text-[#6b7280]">
      {breakdown.map(([sport, count], i) => (
        <span key={sport}>
          {i > 0 && " · "}{sport} ×{count}
        </span>
      ))}
    </span>
  );
}

/* ── Relative time helper ─────────────────────────────────────── */

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "aujourd'hui";
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "il y a 1 jour";
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  return months === 1 ? "il y a 1 mois" : `il y a ${months} mois`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── 3-Dot Menu ───────────────────────────────────────────────── */

function ListMenu({
  onRename,
  onEditDesc,
  onShare,
  onExport,
  onDelete,
}: {
  onRename: () => void;
  onEditDesc: () => void;
  onShare: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const items = [
    { label: "Renommer", action: onRename },
    { label: "Modifier la description", action: onEditDesc },
    { label: "Partager", action: onShare },
    { label: "Exporter PDF", action: onExport },
    { label: "Supprimer", action: onDelete, danger: true },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[40]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-[50] w-52 bg-[#1A1D24] border border-[#2D3748] rounded-lg shadow-xl overflow-hidden">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); item.action(); }}
                className={`w-full text-left px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  item.danger
                    ? "text-[#EF4444] hover:bg-[#EF4444]/10"
                    : "text-[#9CA3AF] hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Create List Modal ────────────────────────────────────────── */

function CreateListModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim());
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-[modalIn_0.2s_ease-out]">
        <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight">Nouvelle liste</h3>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1.5">
              Nom de la liste <span className="text-[#E63946]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: QB prioritaires 2026"
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1.5">
              Description <span className="text-[#4a4d56]">(optionnel)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder="Décrivez l'objectif de cette liste..."
              rows={3}
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
            />
            <p className="text-[10px] text-[#4a4d56] mt-1 text-right">{description.length}/200</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] border border-[#2D3748] rounded-lg hover:text-white hover:border-[#4a4d56] transition-colors">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-bold rounded-lg transition-colors"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Athlete Modal ────────────────────────────────────────── */

function AddAthleteModal({
  listName,
  uniteSportId,
  existingIds,
  onClose,
  onAdd,
}: {
  listName: string;
  /** Sport de l'unité de la liste — null : liste personnelle, sans cartes. */
  uniteSportId: string | null;
  existingIds: Set<string>;
  onClose: () => void;
  onAdd: (athlete: ProspectListAthlete, note: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [available, setAvailable] = useState<ProspectListAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  // Les favoris de l'UNITÉ (lot B2, étape 2) : on ajoute à une liste d'unité
  // depuis les cœurs de toute l'unité, pas seulement les siens.
  const favoris = useFavorisUnite();
  const idsFavoris = useMemo(() => [...favoris.ids].sort().join(","), [favoris.ids]);
  const { data: currentUser } = useCurrentUser();
  const monCegep = currentUser?.profile.school_id ?? null;

  /* Les CARTES PROSPECT de l'unité (lot C, retour BP) : une carte s'ajoute
     à une liste d'unité comme un athlète. La base refuse toute autre liste. */
  const [cartesDispo, setCartesDispo] = useState<ProspectListAthlete[]>([]);
  useEffect(() => {
    // Liste personnelle (sans unité) : aucune carte proposée — dérivé au rendu.
    if (!uniteSportId || !monCegep) return;
    let annule = false;
    void (async () => {
      const supabase = createClient();
      try {
        const lignes = await lireCartes(supabase, { cegepId: monCegep, sportId: uniteSportId });
        if (annule) return;
        // Le sport DE L'ATHLÈTE (décision BP 2026-10-05) — par carte, pas
        // celui de l'unité : deux cartes de la même unité peuvent désormais
        // être de sports différents.
        const sportIds = [...new Set(lignes.map((l) => l.sport_athlete_id))];
        const nomsSports = new Map<string, string>();
        if (sportIds.length > 0) {
          const { data: sports } = await supabase.from("sports").select("id, nom").in("id", sportIds);
          for (const s of (sports ?? []) as { id: string; nom: string }[]) nomsSports.set(s.id, s.nom);
        }
        if (annule) return;
        setCartesDispo(lignes.map((l) => versMembreListe(l, nomsSports.get(l.sport_athlete_id) ?? "")).filter((c) => !existingIds.has(c.id)));
      } catch (e) {
        console.error("[listes] cartes prospect :", e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { annule = true; };
  }, [uniteSportId, monCegep, existingIds]);

  useEffect(() => {
    if (favoris.isLoading) return;
    let annule = false;
    async function loadFavs() {
      const supabase = createClient();
      const ids = idsFavoris ? idsFavoris.split(",") : [];
      {
        /* Les cartes projetées, résolues par lot. */
        const cardMap = await fetchRecruiterAthleteCards(supabase, ids);
        if (annule) return;

        const mapped: ProspectListAthlete[] = [...cardMap.values()].map((card) => ({
          id: card.id,
          identity_visible: card.identity_visible,
          full_name: displayFullName(card),
          photo_url: card.photo_url ?? "",
          jersey: card.numero_jersey != null && card.numero_jersey !== "" ? String(card.numero_jersey) : "",
          sport: card.sport_nom ?? "",
          position: card.position_abbr ?? "",
          school: card.school_name ?? "",
          division: "D1" as const,
          graduation_year: card.annee_diplomation ?? 0,
          coach_rating: card.cote_globale ?? 0,
          is_verified: !!card.verified,
          pipeline_status: "identifie" as RecruitmentStatus,
          added_at: "",
          recruiter_note: "",
          priority: false,
        }));
        setAvailable(mapped.filter(a => !existingIds.has(a.id)));
      }
      setLoading(false);
    }
    loadFavs();
    return () => { annule = true; };
  }, [existingIds, idsFavoris, favoris.isLoading]);

  const filtered = useMemo(() => {
    const tous = [...available, ...(uniteSportId && monCegep ? cartesDispo : [])];
    if (search.trim().length < 2) return tous;
    const q = search.toLowerCase();
    return tous.filter(a => a.full_name.toLowerCase().includes(q) || a.sport.toLowerCase().includes(q));
  }, [search, available, cartesDispo, uniteSportId, monCegep]);

  const handleAdd = (athlete: ProspectListAthlete) => {
    onAdd(athlete, "");
    setAvailable(prev => prev.filter(a => a.id !== athlete.id));
    setCartesDispo(prev => prev.filter(a => a.id !== athlete.id));
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl animate-[modalIn_0.2s_ease-out] max-h-[80vh] flex flex-col">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
          Ajouter à « {listName} »
        </h3>

        {/* Search */}
        <div className="relative mt-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un athlète..."
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-9 pr-4 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors"
            autoFocus
          />
        </div>

        {/* Athletes list */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-1 min-h-0">
          {loading ? (
            <p className="text-[13px] text-[#4a4d56] text-center py-8">Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-[#4a4d56] text-center py-8">
              {search ? "Aucun athlète trouvé" : "Tous les favoris et cartes prospect de l'unité sont déjà dans cette liste"}
            </p>
          ) : (
            filtered.map((a) => (
              <div key={a.id} className="bg-[#13151a] rounded-lg border border-[#2a2d36] p-3"
                style={a.prospect ? { backgroundColor: SURFACE_PROSPECT } : undefined} data-prospect={a.prospect ? "1" : undefined}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {(() => {
                      // full_name vaut « Identité réservée » sous masquage —
                      // le découper donnerait « IR » en initiales. C'est
                      // identityVisible qui décide, pas le nom.
                      const [first, ...rest] = (a.full_name || "").split(/\s+/);
                      return (
                        <div className="relative w-8 h-8 shrink-0">
                          <AthletePhoto
                            photoUrl={a.photo_url}
                            firstName={first}
                            lastName={rest.join(" ")}
                            identityVisible={a.identity_visible}
                            size={32}
                          />
                        </div>
                      );
                    })()}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-bold text-white truncate">{a.full_name}</p>
                        {a.jersey && <span className="text-[12px] font-black text-[#E63946]">#{a.jersey}</span>}
                      </div>
                      <p className="text-[11px] text-[#6b7280]">{a.position && <>{a.position} · </>}{a.school}</p>
                      {!a.prospect && <div className="flex items-center gap-0.5 mt-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={a.coach_rating >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        ))}
                      </div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(a)}
                    className="px-3 py-1.5 border border-[#E63946] text-[#E63946] text-[11px] font-bold rounded-lg hover:bg-[#E63946]/10 transition-colors shrink-0"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {uniteSportId && monCegep && cartesDispo.length > 0 && <div className="mt-3"><LegendeProspect /></div>}

        <button type="button" onClick={onClose} className="mt-4 w-full px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] border border-[#2D3748] rounded-lg hover:text-white hover:border-[#4a4d56] transition-colors text-center">
          Fermer
        </button>
      </div>
    </div>
  );
}

/* ── List Card (Grid View) ────────────────────────────────────── */

function ListCard({
  list,
  onClick,
  onMenuAction,
}: {
  list: ProspectList;
  onClick: () => void;
  onMenuAction: (action: string) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 cursor-pointer hover:border-white/20 hover:shadow-[0_0_24px_rgba(230,57,70,0.08)] hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col"
    >
      {/* Top: name + menu */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight leading-tight flex-1 min-w-0 truncate">
          {list.name}
        </h3>
        <ListMenu
          onRename={() => onMenuAction("rename")}
          onEditDesc={() => onMenuAction("editDesc")}
          onShare={() => onMenuAction("share")}
          onExport={() => onMenuAction("export")}
          onDelete={() => onMenuAction("delete")}
        />
      </div>

      {/* Auteur (lot B2, étape 2 : la liste appartient à l'unité, pas à lui) */}
      {list.auteur && <p className="text-[11px] text-[#6b7280] mt-1">Par {list.auteur}</p>}

      {/* Description */}
      <p className="text-[13px] text-[#9CA3AF] mt-1.5 line-clamp-1">{list.description}</p>

      {/* Athlete count */}
      <div className="flex items-center gap-1.5 mt-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        <span className="text-[13px] font-bold text-white">{list.athletes.length} athlète{list.athletes.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Sport breakdown */}
      <div className="mt-2">
        <SportBreakdown athletes={list.athletes} />
      </div>

      {/* Dates */}
      <div className="mt-auto pt-3 border-t border-[#2D3748]/30 mt-4 space-y-0.5">
        <p className="text-[11px] text-[#4a4d56]">Créée le {formatDate(list.created_at)}</p>
        <p className="text-[11px] text-[#4a4d56]">Modifiée {relativeTime(list.updated_at)}</p>
      </div>
    </div>
  );
}

/* ── Expanded List View ───────────────────────────────────────── */

/* Notes d'un joueur de la liste : LE fil de suivi (FilNotesSuivi), le même
   que dans Mon processus — recruiter_notes de l'unité pour un athlète, le fil
   de la carte pour une carte prospect (retour BP : un seul fil par joueur). */
function AthleteNotesPanel({ athleteId, prospect, onErreur }: {
  athleteId: string;
  prospect?: boolean;
  onErreur: (msg: string) => void;
}) {
  return (
    <div className="px-5 py-4">
      <FilNotesSuivi sujet={{ type: prospect ? "carte" : "athlete", id: athleteId }} onErreur={onErreur} />
    </div>
  );
}

function ExpandedListView({
  list,
  auteurs,
  onBack,
  onRemoveAthlete,
  onAddAthlete,
  onErreur,
}: {
  list: ProspectList;
  auteurs: Record<string, { id: string; first_name: string | null; last_name: string | null; sport_id: string | null }>;
  onBack: () => void;
  onRemoveAthlete: (listId: string, athleteId: string) => void;
  onAddAthlete: (listId: string, athlete: ProspectListAthlete) => void;
  onErreur: (msg: string) => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);

  /* Notes de LISTE (recruiter_list_notes) : le web n'en écrit plus (retour
     BP — un seul fil de notes, celui du joueur). L'app 1.4.3 en écrit encore :
     les siennes restent LISIBLES ici, marquées « depuis l'app », jusqu'à la
     1.4.4 (registre §38). */
  const { data: listNotes = [] } = useNotesListeUnite(list.id);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const verifiedCount = list.athletes.filter((a) => a.is_verified).length;
  const avgRating = list.athletes.length > 0
    ? (list.athletes.reduce((s, a) => s + a.coach_rating, 0) / list.athletes.length).toFixed(1)
    : "0.0";

  const sportSummary = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of list.athletes) m.set(a.sport, (m.get(a.sport) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([s, c]) => `${c} ${s}`).join(", ");
  }, [list.athletes]);

  const existingIds = useMemo(() => new Set(list.athletes.map((a) => a.id)), [list.athletes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} className="mt-1 w-9 h-9 rounded-lg bg-[#13151a] border border-[#2D3748] flex items-center justify-center text-[#6b7280] hover:text-white hover:border-[#4a4d56] transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">{list.name}</h1>
            {list.auteur && <p className="text-[12px] text-[#6b7280] mt-1">Créée par {list.auteur}</p>}
            <p className="text-[14px] text-[#9CA3AF] mt-1">{list.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#E63946] text-[#E63946] rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-[#E63946]/10 transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          Ajouter un athlète
        </button>
      </div>

      {/* Stats bar */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="text-[13px] font-bold text-white">{list.athletes.length} athlète{list.athletes.length !== 1 ? "s" : ""}</span>
        <span className="text-[#2D3748]">·</span>
        <span className="text-[13px] text-[#9CA3AF]">{verifiedCount} vérifié{verifiedCount !== 1 ? "s" : ""}</span>
        <span className="text-[#2D3748]">·</span>
        <span className="text-[13px] text-[#9CA3AF]">{sportSummary}</span>
        <span className="text-[#2D3748]">·</span>
        <span className="text-[13px] text-[#9CA3AF] flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill={GOLD} stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {avgRating} moyenne
        </span>
        {/* Légende des cartes prospect : en haut (retour BP). */}
        {list.athletes.some((a) => a.prospect) && <span className="ml-auto"><LegendeProspect /></span>}
      </div>

      {/* Athletes */}
      {list.athletes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3 className="font-head text-lg font-black text-white uppercase tracking-wide mb-1">Liste vide</h3>
          <p className="text-[13px] text-[#9CA3AF] max-w-sm mb-4">Ajoutez des athlètes depuis vos favoris pour commencer.</p>
          <button type="button" onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-5 py-2.5 font-head font-bold text-[12px] uppercase tracking-widest hover:bg-[#D42B22] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            Ajouter un athlète
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.athletes.map((a) => (
            <React.Fragment key={a.id}>
              <div className={`bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] transition-all duration-300 ease-out ${expandedNotes === a.id ? "border-[#E63946]/20" : ""}`}
                style={a.prospect ? { backgroundColor: SURFACE_PROSPECT } : undefined} data-prospect={a.prospect ? "1" : undefined}>
                <div className="flex items-center px-4 py-3 gap-3">
                  {/* Avatar + check */}
                  {(() => {
                    const [first, ...rest] = (a.full_name || "").split(/\s+/);
                    return (
                  <div className="relative w-10 h-10 shrink-0" style={{ overflow: "visible" }}>
                    <AthletePhoto
                      photoUrl={a.photo_url}
                      firstName={first}
                      lastName={rest.join(" ")}
                      identityVisible={a.identity_visible}
                      size={40}
                    />
                    {!a.prospect && <div className="absolute -top-0.5 -right-0.5 z-10">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={a.is_verified ? "#3B82F6" : "#4a4d56"} stroke="none">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9 12l2 2 4-4" stroke={a.is_verified ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </div>}
                  </div>
                    );
                  })()}

                  {/* Name + jersey + school — fixed width */}
                  <div className="w-[200px] shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Link href={a.prospect ? `/recruteur/pipeline?athlete=${a.id}` : `/recruteur/athletes/${a.id}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate">
                        {a.full_name}
                      </Link>
                      {a.jersey && <span className="text-[13px] font-black text-[#E63946]">#{a.jersey}</span>}
                      {a.priority && <span className="w-2 h-2 rounded-full bg-[#E63946] shrink-0" title="Prioritaire" />}
                    </div>
                    <p className="text-[12px] text-[#6b7280] truncate">{a.school} · {a.graduation_year}</p>
                  </div>

                  {/* Position pill — fixed width */}
                  <div className="w-[50px] shrink-0">
                    {a.position ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">{a.position}</span>
                    ) : <span />}
                  </div>

                  {/* Recruitment status — fixed width */}
                  <div className="w-[140px] shrink-0">
                    <RecruitmentStatusBadge status={(a.pipeline_status || "ouvert").toUpperCase() as GlobalRecruitmentStatus} size="sm" />
                  </div>

                  {/* Stars — fixed width */}
                  <div className="w-[120px] shrink-0">
                    {!a.prospect && <StarRating rating={a.coach_rating} size="sm" />}
                  </div>

                  {/* Added date + who added it — fixed width */}
                  <div className="w-[130px] shrink-0 min-w-0">
                    <span className="block text-[12px] text-[#6b7280] whitespace-nowrap">{a.added_at ? formatDate(a.added_at) : ""}</span>
                    {a.ajoute_par && (
                      <span className="block text-[11px] text-[#4a4d56] truncate" title={`Ajouté par ${a.ajoute_par}`}>par {a.ajoute_par}</span>
                    )}
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Notes + Actions — une carte ouvre SON fil (cartes_prospect_notes). */}
                  <button type="button" onClick={() => setExpandedNotes(expandedNotes === a.id ? null : a.id)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shrink-0 ${expandedNotes === a.id ? "bg-[#E63946]/15 text-[#E63946]" : "text-[#6b7280] hover:text-white hover:bg-white/5"}`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                    Notes
                  </button>
                  <Link href={a.prospect ? `/recruteur/pipeline?athlete=${a.id}` : `/recruteur/athletes/${a.id}`} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors shrink-0" title={a.prospect ? "Ouvrir la carte" : "Voir le profil"}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  </Link>
                  <button type="button" onClick={() => setRemoveTarget(a.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-[#EF4444] hover:bg-[#EF4444]/5 transition-colors shrink-0" title="Retirer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Expandable notes panel */}
                {expandedNotes === a.id && (
                  <div className="border-t border-[#2D3748]">
                    <AthleteNotesPanel athleteId={a.id} prospect={a.prospect} onErreur={onErreur} />
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Notes écrites depuis l'app 1.4.3 (notes de LISTE) — lecture seule. */}
      {listNotes.length > 0 && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] px-5 py-4" data-testid="notes-liste-app">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Notes de la liste — depuis l&apos;app</p>
          {listNotes.map((note) => {
            const nom = nomAuteur(auteurs[note.recruiter_id]);
            return (
              <div key={note.id} className="mb-3 last:mb-0">
                <p className="text-[11px] font-bold text-[#9CA3AF]">
                  <span className="text-white">{nom}</span> · {new Date(note.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                  <span className="ml-2 inline-flex items-center rounded-full border border-[#2D3748] px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">depuis l&apos;app</span>
                </p>
                <p className="text-[13px] text-[#e0e0e0] whitespace-pre-wrap mt-1">{note.content}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Athlete Modal */}
      {showAddModal && (
        <AddAthleteModal
          listName={list.name}
          uniteSportId={list.unite_sport_id ?? null}
          existingIds={existingIds}
          onClose={() => setShowAddModal(false)}
          onAdd={(athlete, note) => {
            // Le toast (succès ou échec) vient de l'écriture elle-même.
            onAddAthlete(list.id, { ...athlete, added_at: new Date().toISOString(), recruiter_note: note });
          }}
        />
      )}

      {/* Remove confirmation */}
      {removeTarget && (
        <ConfirmModal
          title="Retirer de la liste"
          message={`Retirer cet athlète de « ${list.name} » ? Il sera retiré pour toute l'unité ; il restera dans les favoris.`}
          confirmLabel="Retirer"
          danger
          onConfirm={() => { onRemoveAthlete(list.id, removeTarget); setRemoveTarget(null); }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────────────── */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-24 h-24 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </div>
      <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Aucune liste créée</h3>
      <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed mb-6">
        Organisez vos prospects en listes pour mieux planifier vos tournées de recrutement et suivre vos priorités.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-6 py-3 font-head font-bold text-[13px] uppercase tracking-widest transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 active:scale-95"
      >
        Créer ma première liste
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function Page() {
  // Iter 7.15 Sprint 1 — dispatch IS_CAPACITOR vers la version mobile.
  // Le composant mobile gère lui-même le FeatureGate PRO.
  if (IS_CAPACITOR) return <RecruteurListesMobile />;
  return (
    <FeatureGate feature="custom_lists" requiredTier="pro">
      <ListesPageContent />
    </FeatureGate>
  );
}

function ListesPageContent() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  const { data: lists = [], isLoading: loading } = useListesUnite();
  const { data: auteurs = {} } = useAuteursUnite();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; erreur: boolean } | null>(null);

  const selectedList = useMemo(() => lists.find((l) => l.id === selectedListId) || null, [lists, selectedListId]);
  const deleteList = useMemo(() => lists.find((l) => l.id === deleteTarget) || null, [lists, deleteTarget]);

  const showToast = useCallback((msg: string) => {
    setToast({ message: msg, erreur: false });
    setTimeout(() => setToast(null), 3000);
  }, []);
  const showErreur = useCallback((msg: string) => {
    setToast({ message: msg, erreur: true });
    setTimeout(() => setToast(null), 5000);
  }, []);

  /* Toute écriture relit le tableau blanc (listes, membres, notes, journal,
     processus) : un geste se voit chez l'auteur tout de suite, chez ses
     collègues au prochain affichage ou au retour sur l'onglet. */
  const relire = useCallback(() => { void invaliderTableauBlanc(queryClient); }, [queryClient]);

  /* Create list */
  const handleCreateList = useCallback(async (name: string, description: string) => {
    if (!moi) return;
    const { data, error } = await createClient()
      .from("recruiter_lists")
      .insert({ recruiter_id: moi, name, description })
      .select("id")
      .single();
    setShowCreateModal(false);
    if (error || !data) { showErreur("Liste non créée"); return; }
    relire();
    setSelectedListId(data.id);
    showToast("Liste créée");
  }, [moi, relire, showToast, showErreur]);

  /* Delete list — pour toute l'unité (unite_delete, B2-0). */
  const handleDeleteList = useCallback(async (listId: string) => {
    const { error } = await createClient().from("recruiter_lists").delete().eq("id", listId);
    setDeleteTarget(null);
    relire();
    if (error) { showErreur("Liste non supprimée"); return; }
    if (selectedListId === listId) setSelectedListId(null);
    showToast("Liste supprimée");
  }, [selectedListId, relire, showToast, showErreur]);

  /* Menu actions */
  const handleMenuAction = useCallback((listId: string, action: string) => {
    if (action === "delete") {
      setDeleteTarget(listId);
    } else if (action === "share") {
      showToast("Partage — Phase 2");
    } else {
      showToast("À venir");
    }
  }, [showToast]);

  /* Remove athlete from list — journal signé par qui retire (B2-0). */
  const handleRemoveAthlete = useCallback(async (listId: string, athleteId: string) => {
    const carte = !!lists.find((l) => l.id === listId)?.athletes.find((a) => a.id === athleteId)?.prospect;
    const { error } = carte
      ? { error: await retirerCarteDeListe(createClient(), listId, athleteId) }
      : await createClient().from("recruiter_list_members").delete().eq("list_id", listId).eq("athlete_id", athleteId);
    relire();
    if (error) { showErreur("Athlète non retiré de la liste"); return; }
    showToast("Athlète retiré de la liste");
  }, [lists, relire, showToast, showErreur]);

  /* Add athlete to list — added_by posé par trigger (B1) : c'est soi.
     Une carte prospect passe par sa propre liaison (ajoute_par, idem). */
  const handleAddAthlete = useCallback(async (listId: string, athlete: ProspectListAthlete) => {
    const { error } = athlete.prospect
      ? { error: await ajouterCarteAListe(createClient(), listId, athlete.id) }
      : await createClient().from("recruiter_list_members").insert({ list_id: listId, athlete_id: athlete.id });
    relire();
    if (error && error.code !== "23505") { showErreur("Athlète non ajouté à la liste"); return; }
    showToast(`${athlete.full_name} ajouté à la liste`);
  }, [relire, showToast, showErreur]);

  /* Les notes vivent dans le fil d'activité d'ExpandedListView, qui écrit
     réellement dans recruiter_notes (insert + delete + relecture). Un second
     éditeur inline avait survécu à côté : états jamais lus, handlers jamais
     appelés, et un toast « Note sauvegardée (POC) » qu'aucun clic ne pouvait
     déclencher. Retiré — deux chemins pour une même donnée, dont un mort. */

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {selectedList ? (
        /* ── Expanded List View ─────────────────────────────── */
        <ExpandedListView
          key={selectedList.id}
          list={selectedList}
          auteurs={auteurs}
          onBack={() => setSelectedListId(null)}
          onRemoveAthlete={handleRemoveAthlete}
          onAddAthlete={handleAddAthlete}
          onErreur={showErreur}
        />
      ) : (
        /* ── Grid Overview ─────────────────────────────────── */
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                Mes listes de prospects
              </h1>
              <p className="text-[14px] text-[#9CA3AF] mt-1">
                Les listes de ton unité — visibles et modifiables par tes collègues Pro
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 border border-[#E63946] text-[#E63946] rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-[#E63946]/10 transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
              Créer une liste
            </button>
          </div>

          {loading ? (
            <p className="text-[13px] text-[#6b7280] py-8">Chargement...</p>
          ) : lists.length === 0 ? (
            <EmptyState onCreate={() => setShowCreateModal(true)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {lists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  onClick={() => setSelectedListId(list.id)}
                  onMenuAction={(action) => handleMenuAction(list.id, action)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create List Modal */}
      {showCreateModal && (
        <CreateListModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateList}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmModal
          title="Supprimer cette liste"
          message={
            deleteList?.recruiter_id && deleteList.recruiter_id !== moi
              ? `Liste créée par ${deleteList.auteur}. Elle sera supprimée pour toute l'unité — cette action est irréversible. Les athlètes resteront dans les favoris.`
              : "Elle sera supprimée pour toute l'unité — cette action est irréversible. Les athlètes resteront dans les favoris."
          }
          confirmLabel="Supprimer"
          danger
          onConfirm={() => handleDeleteList(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} erreur={toast.erreur} onDone={() => setToast(null)} />}

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
