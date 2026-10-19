"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurListeDetailMobile — iter 7.17 Sprint 2
   Détail d'une liste : header + stats bar + cartes athlètes
   (visuel Pipeline-style canon 14.1, horizontal photo-gauche) +
   swipe-gauche pour retirer + tap-profil. Deux niveaux de notes (1.4.5) :
   onglet « Notes » = la liste ; bulle de la carte = le fil du joueur.
   Gating PRO via FeatureGate (canon 14.x).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import FeatureGate from "@/components/subscription/FeatureGate";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { EmptyState as SharedEmptyState } from "@/components/mobile/EmptyState";
import LockedIdentityPlaceholder from "@/components/shared/LockedIdentityPlaceholder";
import { useListAthletes, type ListAthlete, type ListMetadata } from "@/lib/queries/recruiter/useListAthletes";
import { useRemoveListMember } from "@/lib/queries/recruiter/useRemoveListMember";
import { useDeleteList } from "@/lib/queries/recruiter/useDeleteList";
import { getStatusConfig, type RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { AddAthleteToListSheet } from "@/components/shared/AddAthleteToListSheet";
import { triggerHaptic } from "@/lib/haptics";
import { formatRelativeDate } from "@/lib/utils/formatRelativeDate";
import FilNotesSuiviMobile from "@/components/shared/FilNotesSuiviMobile";
import { useSheetKeyboardGeometry } from "@/lib/hooks/useSheetKeyboardGeometry";
import { useSubscription } from "@/lib/hooks/useSubscription";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { CotesEvaluationsAthlete } from "@/components/shared/CotesEvaluations";
import CarteBadges from "@/components/shared/CarteBadges";
import PartenaireCartesProvider from "@/components/shared/PartenaireCartesProvider";
import ChampNote from "@/components/shared/ChampNote";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useNotesListeUnite } from "@/lib/queries/recruiter/useListesUnite";
import { useAuteursUnite, nomAuteur } from "@/lib/queries/recruiter/useProcessusUnite";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";


/* ── ListAthleteCardMobile ─────────────────────────────────────
   Réplique le visuel PipelineCardMobile (canon 14.1 photo-gauche
   bleed + gradient fade single-surface to-right finissant #1A1D24).
   Wrappé dans framer-motion drag="x" — swipe gauche révèle action
   "Retirer". Sans swipe-stage (différence avec Pipeline). */

const REMOVE_THRESHOLD = 110;

function ListAthleteCardMobile({
  athlete,
  onTap,
  onRemove,
  onTapNotes,
}: {
  athlete: ListAthlete;
  onTap: () => void;
  onRemove: () => void;
  onTapNotes: () => void;
}) {
  const x = useMotionValue(0);
  // Action "Retirer" révélée à droite quand l'utilisateur swipe vers la gauche
  // (x devient négatif). On affiche le bouton dans l'overlay et on l'opacifie
  // proportionnellement au déplacement.
  const removeOpacity = useTransform(x, [-REMOVE_THRESHOLD, -40, 0], [1, 0.5, 0]);
  // Résolu par displayFullName() dans le hook. L'interpolation manuelle
  // rendait une chaîne vide sous identité réservée, rattrapée par un faux
  // « Athlète » — un nom inventé pour cacher un nom absent.
  const fullName = athlete.fullName;
  const locked = !athlete.identityVisible;
  const [first, ...rest] = `${athlete.firstName} ${athlete.lastName}`.trim().split(/\s+/);
  const statusConfig = athlete.recruitmentStatus
    ? getStatusConfig(athlete.recruitmentStatus as RecruitmentStatus)
    : null;

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Overlay action "Retirer" — derrière la carte, révélé au swipe gauche */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 bg-[#E63946]"
        style={{ opacity: removeOpacity, width: "100%" }}
      >
        <div className="flex items-center gap-2 text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
          <span className="text-[14px] font-bold uppercase tracking-wider">Retirer</span>
        </div>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -REMOVE_THRESHOLD - 40, right: 0 }}
        dragElastic={0.15}
        style={{ x }}
        onDragEnd={(_e, info) => {
          if (info.offset.x < -REMOVE_THRESHOLD) {
            triggerHaptic("Medium");
            onRemove();
          }
          // La carte revient toujours en place : le retrait passe par une
          // confirmation (lot 2 de la 1.4.4) ; s'il est confirmé, la carte
          // sort par l'animation de la liste.
          x.set(0);
        }}
      >
        <button
          type="button"
          onClick={() => { triggerHaptic("Light"); onTap(); }}
          className="w-full relative overflow-hidden active:opacity-80 transition-opacity text-left bg-[#1A1D24]"
          style={{ height: 156 }}
        >
          {/* Photo bleed gauche 150px (canon 14.1) */}
          {locked ? (
            /* Sous identité réservée, PAS d'initiales : deux lettres
               recoupées à l'école et à la position réidentifient. Le
               placeholder partagé porte déjà la bonne sémantique. */
            <div className="absolute left-0 top-0 bottom-0 w-[150px] z-0 pointer-events-none">
              <LockedIdentityPlaceholder variant="fill" />
            </div>
          ) : athlete.photoUrl ? (
            <div className="absolute left-0 top-0 bottom-0 w-[150px] z-0 pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={athlete.photoUrl}
                alt=""
                crossOrigin="anonymous"
                className="w-full h-full object-cover object-[center_top]"
              />
            </div>
          ) : (
            <div className="absolute left-0 top-0 bottom-0 w-[150px] z-0 flex items-center justify-center pointer-events-none">
              <span
                style={{
                  fontFamily: "var(--font-outfit), sans-serif",
                  fontSize: 32, fontWeight: 900,
                  color: "rgba(255,255,255,0.06)",
                  letterSpacing: "0.05em", lineHeight: 1,
                }}
              >
                {(first[0] ?? "")}{(rest[0]?.[0] ?? "")}
              </span>
            </div>
          )}
          {/* Gradient overlay finissant #1A1D24 OPAQUE (single-surface, canon 14.1) */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[150px] z-[1] pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, transparent 0%, transparent 38%, rgba(26,29,36,0.9) 80%, #1A1D24 100%)",
            }}
          />

          {/* Iter 7.28 Section 2 — carte épurée : école+promotion retirées
              (dispo dans le profil athlète, redondance levée). Espace libéré
              utilisé pour agrandir nom (16→18) et position·# (13→14), carte
              légèrement plus haute (120→132) pour aérer. */}
          <div className="absolute inset-y-0 left-[150px] right-0 z-10 flex flex-col justify-center px-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-white font-bold text-[18px] leading-tight truncate">{fullName}</p>
              {athlete.isVerified && (
                <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3B82F6]">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </div>

            <p className="text-[14px] text-[#9CA3AF] mt-1.5 truncate">
              {[athlete.positionAbbr || athlete.sportName, athlete.jersey ? `#${athlete.jersey}` : null]
                .filter(Boolean).join(" · ") || "—"}
            </p>

            {/* Les deux évaluations, chacune avec son libellé : coach ET partenaire (1.4.5). */}
            {!athlete.isProspect && !locked && (
              <CotesEvaluationsAthlete athleteId={athlete.athleteId} coteCoach={athlete.coachRating} taille="sm" vide="Non évalué" libelleCoach="Coach" className="mt-1.5 pr-10" />
            )}

            {statusConfig && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusConfig.color }} />
                <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: statusConfig.color }}>
                  {statusConfig.shortLabel ?? statusConfig.label}
                </span>
              </div>
            )}

            {/* Badges du partenaire : 5 au plus, puis « +N » (rangée rognée). */}
            {!athlete.isProspect && !locked && (
              <CarteBadges athleteId={athlete.athleteId} variante="ligne" className="mt-1.5 max-h-[20px] pr-10" />
            )}
          </div>
        </button>

        {/* Iter 7.18 Sprint 3 — bouton Notes (icône bulle) coin bas-droit.
            stopPropagation + onPointerDown stop pour ne pas déclencher le
            tap-carte ni initier le drag framer. */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); triggerHaptic("Light"); onTapNotes(); }}
          aria-label="Notes"
          className="absolute right-2 bottom-2 z-20 w-8 h-8 rounded-full bg-white/[0.10] active:bg-white/[0.18] flex items-center justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </motion.div>
    </div>
  );
}

/* ── formatRelativeDate promu vers lib/utils/formatRelativeDate (iter 7.30b)
   pour réutilisation par RecruteurActivitesMobile. Import en tête du fichier. */

/* ── AthleteNotesSheet — LE fil de suivi du joueur (lot 2 de la 1.4.4) ───
   Un seul fil par joueur (décision BP, lot C) : recruiter_notes, signées,
   celles de l'unité pour un Pro (FilNotesSuiviMobile). Le même fil que dans
   Mon processus. Le sheet porte un champ : useSheetKeyboardGeometry. */

function AthleteNotesSheet({
  open, onClose, athlete, modeUnite,
}: {
  open: boolean;
  onClose: () => void;
  athlete: ListAthlete | null;
  modeUnite: boolean;
}) {
  const toast = useMobileToast();
  const kbdStyle = useSheetKeyboardGeometry();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  // Déjà résolu par le hook — vide sous masquage si on l'interpolait ici.
  const fullName = athlete?.fullName ?? "";

  return createPortal(
    <AnimatePresence>
      {open && athlete && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[75] bg-[#111317] rounded-t-2xl flex flex-col"
            style={kbdStyle}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-4 pb-3 flex items-center justify-between border-b border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-11 h-11 rounded-full bg-white/[0.06] active:bg-white/[0.10] flex items-center justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
              <span className="text-[15px] font-bold text-white truncate px-3">Notes</span>
              <div className="w-9" />
            </div>

            <div className="px-4 py-4 border-b border-white/[0.06]">
              <p className="font-head text-[18px] font-black text-white uppercase tracking-tight truncate">
                {fullName}
              </p>
              <p className="text-[12px] text-white/55 mt-1 leading-relaxed">
                {modeUnite
                  ? "Le fil de suivi du joueur — le même que dans Mon processus, partagé avec ton unité."
                  : "Le fil de suivi du joueur — le même que dans Mon processus."}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <FilNotesSuiviMobile
                athleteId={athlete.athleteId}
                carteId={athlete.isProspect ? athlete.athleteId : null}
                modeUnite={modeUnite}
                titre="Notes de suivi"
                replie={false}
                onTease={() => toast.warning({ message: "Les notes sont réservées aux membres Pro" })}
                onErreur={(m) => toast.error({ message: m })}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── Notes de LISTE (recruiter_list_notes) — RÉTABLIES en 1.4.5 ───────────
   Retirées par e131d05d (et 8f108751 côté web) au profit du seul fil par
   joueur. Deux niveaux, comme avant : la note GÉNÉRALE de la liste (ici, onglet
   « Notes ») et les notes PAR JOUEUR (AthleteNotesSheet → recruiter_notes, le fil
   de Mon processus, sans doublon). Même table, même RLS qu'avant : aucune
   migration. Signées ; les siennes se suppriment, celles des collègues se lisent. */

function ListNotesPanel({ listId, modeUnite }: { listId: string; modeUnite: boolean }) {
  const toast = useMobileToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  const { data: notes = [], isLoading, isError, refetch } = useNotesListeUnite(listId);
  const { data: auteurs = {} } = useAuteursUnite(modeUnite);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);

  const poster = async () => {
    const contenu = texte.trim();
    if (!contenu || !moi || envoi) return;
    setEnvoi(true);
    const { error } = await createClient().from("recruiter_list_notes").insert({ list_id: listId, recruiter_id: moi, content: contenu });
    setEnvoi(false);
    if (error) { void triggerHaptic("Error"); toast.error({ message: "Note non enregistrée" }); return; }
    void triggerHaptic("Light");
    setTexte("");
    void invaliderTableauBlanc(queryClient);
  };

  const supprimer = async (id: string) => {
    setASupprimer(null);
    const { error } = await createClient().from("recruiter_list_notes").delete().eq("id", id);
    if (error) toast.error({ message: "Note non supprimée" });
    void invaliderTableauBlanc(queryClient);
  };

  const peut = !!texte.trim() && !envoi && !!moi;
  return (
    <div className="flex flex-col" data-testid="notes-de-liste">
      <div className="px-4 pt-3 pb-3 space-y-3">
        <p className="text-[12px] text-white/55 leading-relaxed">
          Une note sur la liste elle-même. Les notes d&apos;un joueur se prennent sur sa carte (bulle).
        </p>
        {isError && (
          <ErreurChargement message="Les notes de cette liste n'ont pas pu être chargées. Vérifie ta connexion, puis réessaie." onReessayer={() => { void refetch(); }} />
        )}
        {isLoading ? (
          <div className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />
        ) : notes.length === 0 && !isError ? (
          <p className="text-[14px] text-white/55 italic text-center py-10">Aucune note sur cette liste.</p>
        ) : (
          notes.map((n) => {
            const aMoi = !!moi && n.recruiter_id === moi;
            return (
              <div key={n.id} className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11px] font-bold text-white/60 truncate">
                    <span className="text-white">{aMoi ? "Moi" : nomAuteur(auteurs[n.recruiter_id])}</span> · {formatRelativeDate(n.created_at)}
                  </p>
                  {aMoi && aSupprimer !== n.id && (
                    <button type="button" onClick={() => setASupprimer(n.id)} className="nx-mobile-touch-min text-[11px] font-bold text-white/45 active:text-[#EF4444]" aria-label="Supprimer cette note">Supprimer</button>
                  )}
                </div>
                <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap break-words mt-1">{n.content}</p>
                {aSupprimer === n.id && (
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[12px] text-white/60">Supprimer cette note ?</span>
                    <button type="button" onClick={() => void supprimer(n.id)} className="nx-mobile-touch-min text-[12px] font-bold text-[#EF4444]">Supprimer</button>
                    <button type="button" onClick={() => setASupprimer(null)} className="nx-mobile-touch-min text-[12px] font-bold text-white/60">Annuler</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Composer collé au bas, au-dessus de la barre d'onglets ; --kbd-h le garde au-dessus du clavier. */}
      <div
        className="sticky bottom-0 bg-[#111317] border-t border-white/[0.06] px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)", bottom: "calc(64px + env(safe-area-inset-bottom) + var(--kbd-h, 0px))" }}
      >
        <div className="flex items-end gap-2">
          <ChampNote
            mobile
            className="flex-1 min-w-0"
            value={texte}
            onChange={(v) => setTexte(v.slice(0, 500))}
            sujet={`liste:${listId}`}
            placeholder="Note pour cette liste…"
            ariaLabel="Note pour cette liste"
            envoyerAvecEntree={false}
          />
          <button
            type="button"
            onClick={() => { void triggerHaptic("Light"); void poster(); }}
            disabled={!peut}
            aria-label="Ajouter"
            className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${peut ? "bg-[#E63946] active:bg-[#D42B22]" : "bg-white/[0.06]"}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={peut ? "#FFFFFF" : "#4a4d56"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Contrôle segmenté « Athlètes | Notes » ─── */
function SegmentsListe({ vue, onChange, nbNotes }: { vue: "athletes" | "notes"; onChange: (v: "athletes" | "notes") => void; nbNotes: number }) {
  const items: { value: "athletes" | "notes"; label: string; badge?: number }[] = [
    { value: "athletes", label: "Athlètes" },
    { value: "notes", label: "Notes", badge: nbNotes },
  ];
  return (
    <div className="flex items-center gap-1 bg-[#13151a] rounded-full p-1 w-full" role="tablist">
      {items.map((it) => {
        const actif = it.value === vue;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={actif}
            onClick={() => { triggerHaptic("Light"); onChange(it.value); }}
            className={`nx-mobile-touch-min inline-flex items-center justify-center flex-1 px-4 rounded-full text-[13px] font-bold uppercase tracking-[0.08em] transition-all ${actif ? "bg-[#E63946] text-white" : "text-[#9CA3AF] active:text-white"}`}
          >
            {it.label}
            {typeof it.badge === "number" && it.badge > 0 && (
              <span className={`ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] tabular-nums ${actif ? "bg-white/25 text-white" : "bg-white/[0.10] text-white/70"}`}>{it.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface SheetAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

function ListActionSheet({
  open, onClose, actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: SheetAction[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-3 bottom-3 z-[75] flex flex-col gap-2"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="rounded-2xl bg-[#1A1D24] overflow-hidden">
              {actions.map((a, idx) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={a.disabled}
                  onClick={a.disabled ? undefined : () => { triggerHaptic("Light"); a.onClick(); }}
                  className={`w-full flex items-center gap-3 px-4 h-14 text-left transition-colors ${
                    idx > 0 ? "border-t border-white/[0.06]" : ""
                  } ${
                    a.disabled ? "opacity-40" : "active:bg-white/[0.04]"
                  }`}
                >
                  <span className="flex-shrink-0">{a.icon}</span>
                  <span className={`text-[15px] font-medium ${a.destructive ? "text-[#E63946]" : "text-white"}`}>
                    {a.label}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-[#1A1D24] h-14 text-[15px] font-bold text-white active:bg-white/[0.04] transition-colors"
            >
              Annuler
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── ConfirmDeleteListSheet (réutilisé Sprint 1 pattern) ─────── */

function ConfirmDeleteListSheet({
  open, onClose, list, onConfirm, modeUnite = false,
}: {
  /** Tableau blanc : la liste est supprimée pour toute l'unité. */
  modeUnite?: boolean;
  open: boolean;
  onClose: () => void;
  list: ListMetadata | null;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  // Iter 7.20 Section A — guard "&& list" retiré (cf. ListNotesSheet) :
  // le sheet s'ouvre même si la metadata list n'est pas encore chargée.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[75] bg-[#111317] rounded-t-2xl flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-4 py-5 space-y-3">
              <p className="font-head text-[18px] font-black text-white uppercase tracking-tight">
                Supprimer cette liste ?
              </p>
              <p className="text-[14px] text-white/70 leading-relaxed">
                {list?.name
                  ? <><span className="text-white font-semibold">« {list.name} »</span> sera supprimée{modeUnite ? " pour toute l'unité — cette action est irréversible" : ""}. </>
                  : modeUnite ? "Cette liste sera supprimée pour toute l'unité — cette action est irréversible. " : "Cette liste sera supprimée. "}
                {modeUnite
                  ? "Les athlètes resteront dans les favoris."
                  : "Les athlètes ne seront pas supprimés de tes favoris, juste retirés de cette liste."}
              </p>
            </div>
            <div className="px-4 pb-5 space-y-2">
              <button
                type="button"
                onClick={onConfirm}
                className="w-full py-3 rounded-2xl bg-[#E63946] active:bg-[#D42B22] text-white font-bold text-[15px] transition-colors"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-white/[0.06] active:bg-white/[0.10] text-white font-semibold text-[15px] transition-colors"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── ConfirmRetraitMembreSheet — retirer un athlète de la liste (lot 2) ───
   Même phrase que le web : en mode unité, le retrait vaut pour toute
   l'unité ; l'athlète reste dans les favoris. */

function ConfirmRetraitMembreSheet({
  cible, nomListe, modeUnite, onClose, onConfirm,
}: {
  cible: ListAthlete | null;
  nomListe: string;
  modeUnite: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {cible && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[75] bg-[#111317] rounded-t-2xl flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-4 py-5 space-y-3">
              <p className="font-head text-[18px] font-black text-white uppercase tracking-tight">
                Retirer de la liste ?
              </p>
              <p className="text-[14px] text-white/70 leading-relaxed">
                {cible.fullName ? <span className="text-white font-semibold">{cible.fullName}</span> : "Cet athlète"} sera retiré de
                {nomListe ? <> « {nomListe} »</> : " cette liste"}
                {modeUnite ? " pour toute l'unité" : ""}. Il restera dans les favoris.
              </p>
            </div>
            <div className="px-4 pb-5 space-y-2">
              <button
                type="button"
                onClick={() => { triggerHaptic("Medium"); onConfirm(); }}
                className="w-full py-3 rounded-2xl bg-[#E63946] active:bg-[#D42B22] text-white font-bold text-[15px] transition-colors"
              >
                Retirer
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-white/[0.06] active:bg-white/[0.10] text-white font-semibold text-[15px] transition-colors"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── StatsBar ──────────────────────────────────────────────── */

function StatsBar({
  dominantSport, avgRating,
}: {
  dominantSport: string | null;
  avgRating: number;
}) {
  // Iter 7.28 Section 1 — étoile cote rendue séparément en doré canon (#F59E0B)
  // pour cohérence avec les étoiles des cartes athlètes. Le `rating` slot porte
  // un flag dédié pour appliquer la couleur or à l'étoile, le chiffre reste blanc.
  // C2 (1.4.5) : aucun compte de joueurs — « N athlètes » et « N vérifiés »
  // retirés ; restent le sport dominant et la cote moyenne.
  const items: { label: string; value: string; rating?: boolean }[] = [];
  if (dominantSport) items.push({ label: dominantSport, value: "" });
  if (avgRating > 0) items.push({ label: "cote moy.", value: avgRating.toFixed(1), rating: true });
  if (items.length === 0) return null;

  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-white/70">
      {items.map((it, idx) => (
        <span key={it.label + idx} className="flex items-center gap-1">
          {idx > 0 && <span className="text-white/30">·</span>}
          {it.rating && (
            <span className="text-[#F59E0B] font-semibold leading-none">★</span>
          )}
          {it.value && <span className="text-white font-semibold tabular-nums">{it.value}</span>}
          <span>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

/* ── Inner (PRO-gated) ─────────────────────────────────────── */

function DetailInner({ listId }: { listId: string }) {
  const router = useRouter();
  const toast = useMobileToast();
  const { list, athletes, isLoading, stats, error: erreurListe, reessayer } = useListAthletes(listId);
  const removeMut = useRemoveListMember();
  const deleteMut = useDeleteList();

  // Iter 7.18 Sprint 3 — états des sheets.
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [athleteNotesTarget, setAthleteNotesTarget] = useState<ListAthlete | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Iter 7.24 Sprint 4b — état du sheet "Ajouter un athlète".
  const [addAthleteOpen, setAddAthleteOpen] = useState(false);
  /* Tableau blanc (lot 2 de la 1.4.4) : pour un Pro, la liste est celle de
     l'UNITÉ — retirer un athlète ou supprimer la liste vaut pour toute
     l'unité, après confirmation (mêmes phrases que le web). */
  const { tier, loading: tierLoading } = useSubscription();
  const modeUnite = !tierLoading && (tier === "pro" || tier === "all_star");
  const [retraitCible, setRetraitCible] = useState<ListAthlete | null>(null);
  /* Deux niveaux de notes : « Athlètes » (une bulle par joueur → son fil) et « Notes » (la liste). */
  const [vue, setVue] = useState<"athletes" | "notes">("athletes");
  const { data: notesDeListe = [] } = useNotesListeUnite(listId);

  // Iter 7.24 — Set des athleteId déjà dans la liste, calculé depuis useListAthletes.
  // Passé au sheet pour masquer ces athlètes de la liste de favoris proposés.
  // Lot C mobile : les cartes prospect vivent dans un id-space séparé (cartes_prospect),
  // donc un Set distinct pour ne pas les mélanger aux vrais athlètes.
  const existingIds = useMemo(
    () => new Set(athletes.filter((a) => !a.isProspect).map((a) => a.athleteId)),
    [athletes],
  );
  const existingCarteIds = useMemo(
    () => new Set(athletes.filter((a) => a.isProspect).map((a) => a.athleteId)),
    [athletes],
  );

  const handleBack = useCallback(() => {
    triggerHaptic("Light");
    // Iter 7.20 Section A — router.push explicit vers l'Index au lieu de
    // router.back(). router.back() avec historique pollué (deep-link refresh,
    // matchDynamicRoute replaces) peut retomber sur "/" → fallback /auth (login).
    // push garantit le retour à l'Index peu importe l'état history.
    router.push("/recruteur/listes");
  }, [router]);

  const handleTapAthlete = useCallback((a: ListAthlete) => {
    triggerHaptic("Light");
    // Iter 7.18 Sprint 3 — back-nav précis : on encode l'id de la liste pour
    // que le back du profil revienne au DÉTAIL spécifique (pas l'Index).
    try { sessionStorage.setItem("lastRecruiterTab", `list-detail:${listId}`); } catch { /* no-op */ }
    // Carte prospect (lot C) : pas de fiche /athletes/[id] — s'ouvre dans Mon
    // processus, comme sur le web (?athlete= accepte déjà un carte_id là-bas).
    router.push(a.isProspect ? `/recruteur/pipeline?athlete=${a.athleteId}` : `/recruteur/athletes/${a.athleteId}`);
  }, [router, listId]);

  const handleRemove = useCallback(async (a: ListAthlete) => {
    try {
      await removeMut.mutateAsync({
        listId,
        athleteId: a.athleteId,
        memberId: a.memberId,
        isProspect: a.isProspect,
      });
      toast.success({
        message: modeUnite ? "Retiré de la liste de l'unité" : "Retiré de la liste",
        detail: a.fullName ? `${a.fullName} reste dans les favoris.` : "L'athlète reste dans les favoris.",
      });
    } catch (e) {
      const err = e as { message?: string };
      toast.error({ message: "Échec", detail: err.message || "Impossible de retirer l'athlète." });
    }
  }, [listId, removeMut, toast, modeUnite]);

  const handleConfirmDelete = useCallback(async () => {
    // Iter 7.21 Section D — ne PAS fermer le sheet avant le succès. Avant :
    // si la mutation échouait (RLS, auth, réseau), le sheet était déjà fermé →
    // utilisateur ne voyait que le toast d'erreur sans contexte. Le sheet ferme
    // SEULEMENT après le succès confirmé.
    try {
      await deleteMut.mutateAsync(listId);
      toast.success({ message: "Liste supprimée", detail: list?.name });
      setConfirmDeleteOpen(false);
      router.push("/recruteur/listes");
    } catch (e) {
      const err = e as { message?: string; code?: string };
      // Surface l'erreur exacte (code + message Postgres si dispo) pour
      // diagnostiquer en cas d'échec récurrent (RLS, FK, etc.).
      const detail = err.code ? `[${err.code}] ${err.message ?? ""}` : err.message;
      toast.error({ message: "Échec suppression", detail: detail || "Erreur inconnue." });
      // eslint-disable-next-line no-console
      console.error("[handleConfirmDelete]", e);
    }
  }, [deleteMut, listId, list?.name, router, toast]);

  return (
    <div className="min-h-screen bg-[#111317] text-white pb-[calc(64px+env(safe-area-inset-bottom))]">
      {/* Header sticky opaque (canon 14.11) */}
      <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="px-4 pt-2 pb-2 flex items-center gap-2 min-h-[52px]">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Retour"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] flex-shrink-0"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {/* Iter 7.20 Section A — placeholder "…" Unicode supprimé : il était
              perçu comme un "•••" parasite à côté du back-arrow. Skeleton bar
              opaque pendant le fetch, vrai nom + dot couleur après chargement. */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {list ? (
              <>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: list.color }} />
                <h1 className="font-head text-[18px] font-black text-white uppercase tracking-tight truncate">
                  {list.name}
                </h1>
              </>
            ) : (
              <div className="h-4 w-32 rounded bg-white/[0.08] animate-pulse" />
            )}
          </div>
          {/* Iter 7.24 Sprint 4b — bouton "+ Ajouter un athlète" dans le header,
              à gauche du menu ⋮. 1 tap → ouvre AddAthleteToListSheet (sélecteur
              de favoris filtré côté client, exclut les membres déjà présents).
              (L'ancienne condition « segment Athlètes » est tombée avec l'onglet
              Notes, lot 2 de la 1.4.4 : il est toujours visible.) */}
          {(
          <button
            type="button"
            aria-label="Ajouter un athlète"
            onClick={() => { triggerHaptic("Light"); setAddAthleteOpen(true); }}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] flex-shrink-0 text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
          </button>
          )}
          <button
            type="button"
            aria-label="Plus d'options"
            onClick={() => { triggerHaptic("Light"); setActionSheetOpen(true); }}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] flex-shrink-0 text-white/70"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>

        {/* Stats bar */}
        {!isLoading && athletes.length > 0 && (
          <StatsBar
            dominantSport={stats.dominantSport}
            avgRating={stats.avgRating}
          />
        )}
        <div className="px-4 pt-2 pb-2">
          <SegmentsListe vue={vue} onChange={setVue} nbNotes={notesDeListe.length} />
        </div>
      </div>

      {vue === "notes" ? (
        <ListNotesPanel listId={listId} modeUnite={modeUnite} />
      ) : (
      <div className="px-4 pt-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[132px] rounded-2xl bg-[#1A1D24] animate-pulse" />
              ))}
            </div>
          ) : erreurListe ? (
            /* Plus jamais une liste « vide » quand la lecture a échoué
               (correctif 2026-10-16) : on le dit, avec « Réessayer ». */
            <ErreurChargement
              className="mt-4"
              message="Cette liste n'a pas pu être chargée. Vérifie ta connexion, puis réessaie."
              onReessayer={() => { triggerHaptic("Light"); reessayer(); }}
            />
          ) : athletes.length === 0 ? (
            <EmptyState onAdd={() => { triggerHaptic("Light"); setAddAthleteOpen(true); }} />
          ) : (
            <PartenaireCartesProvider>
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {athletes.map((a) => (
                  <motion.div
                    key={a.athleteId}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85, x: -60 }}
                    transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <ListAthleteCardMobile
                      athlete={a}
                      onTap={() => handleTapAthlete(a)}
                      onRemove={() => setRetraitCible(a)}
                      onTapNotes={() => setAthleteNotesTarget(a)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            </PartenaireCartesProvider>
          )}
        </div>
      )}

      {/* Iter 7.18 Sprint 3 — sheets */}
      <AthleteNotesSheet
        open={!!athleteNotesTarget}
        onClose={() => setAthleteNotesTarget(null)}
        athlete={athleteNotesTarget}
        modeUnite={modeUnite}
      />
      <ConfirmRetraitMembreSheet
        cible={retraitCible}
        nomListe={list?.name ?? ""}
        modeUnite={modeUnite}
        onClose={() => setRetraitCible(null)}
        onConfirm={() => { const a = retraitCible; setRetraitCible(null); if (a) void handleRemove(a); }}
      />
      {/* Iter 7.28 Section 3 — ListNotesSheet retiré : les notes sont
          maintenant accessibles via le segmented control (vue inline). */}
      <ListActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        actions={[
          {
            label: "Renommer",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <polygon points="18.5 2.5 21.5 5.5 12 15 8 16 9 12 18.5 2.5" />
              </svg>
            ),
            onClick: () => {},
            disabled: true,
          },
          {
            label: "Supprimer la liste",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            ),
            onClick: () => { setActionSheetOpen(false); setConfirmDeleteOpen(true); },
            destructive: true,
          },
        ]}
      />
      <ConfirmDeleteListSheet
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        list={list}
        onConfirm={handleConfirmDelete}
        modeUnite={modeUnite}
      />

      {/* Iter 7.24 Sprint 4b — sheet sélecteur d'athlètes (source = favoris). */}
      <AddAthleteToListSheet
        open={addAthleteOpen}
        onClose={() => setAddAthleteOpen(false)}
        listId={listId}
        listName={list?.name ?? null}
        existingIds={existingIds}
        existingCarteIds={existingCarteIds}
        uniteCegepId={list?.uniteCegepId ?? null}
        uniteSportId={list?.uniteSportId ?? null}
      />

      <style jsx>{`
        @keyframes nx-pulse-notes-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        :global(.nx-pulse-notes) { background: #1A1D24; animation: nx-pulse-notes-kf 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <SharedEmptyState
      image="/empty/nexus-empty-shortlist.png"
      title="Aucun athlète dans cette liste"
      description="Ajoute des athlètes depuis tes favoris pour commencer à les organiser ici."
      action={{ label: "Ajouter un athlète", onClick: onAdd }}
    />
  );
}

/* ── Outer (PRO gate) ─────────────────────────────────────── */

export function RecruteurListeDetailMobile({ listId }: { listId: string }) {
  return (
    <FeatureGate feature="custom_lists" requiredTier="pro">
      <DetailInner listId={listId} />
    </FeatureGate>
  );
}
