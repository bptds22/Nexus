"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurMessagesThreadMobile — Thread detail mobile (iter 7.8b)
   Feel iOS Messages :
     - Header sticky : back gauche + coach centré (photo + nom + chevron
       vers Détails) + barre contexte athlète épinglée (photo + nom +
       position + "Voir le profil ›")
     - Bubbles : recruteur droite rouge, coach gauche gris, groupage par
       jour avec séparateur "Aujourd'hui"/"Hier"/date
     - Composer sticky bottom (input + envoi avion)
     - Auto-scroll au dernier message au mount
     - Realtime channel : INSERT messages live (cleanup au unmount)
     - Optimistic send + status sending/sent/error

   Référence design : docs/mobile-design-system.md.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useThreadContext } from "@/lib/queries/recruiter/useThreadContext";
import { useMessages, type MessageRow } from "@/lib/queries/recruiter/useMessages";
import { useSendMessage } from "@/lib/queries/recruiter/useSendMessage";
import { useMarkConversationRead } from "@/lib/queries/recruiter/useMarkConversationRead";
import { useCoachReputation } from "@/lib/hooks/useCoachReputation";
import { useMyCoachReview, type MyCoachReview } from "@/lib/queries/recruiter/useMyCoachReview";
import { useAthleteThreadSummary } from "@/lib/queries/recruiter/useAthleteThreadSummary";
import { getStatusConfig, type RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { useSubmitCoachReview } from "@/lib/queries/recruiter/useSubmitCoachReview";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useQueryClient } from "@tanstack/react-query";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

/* ── Date helpers ─────────────────────────────────────────────── */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const that = startOfDay(d);
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) {
    const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    return days[d.getDay()];
  }
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function timeOfDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/* ── MessageBubble ────────────────────────────────────────────── */

function MessageBubble({ msg, isMe }: { msg: MessageRow; isMe: boolean }) {
  // Iter 7.8c-UI Section C — couleurs iOS dark mode (volume rouge fatiguait).
  // Recruteur = bleu iOS #0A84FF, coach = gris iOS dark #262628.
  // Rouge Nexus gardé partout ailleurs (action/marque), exception thread only.
  const isSending = msg.status === "sending";
  const isError = msg.status === "error";
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} px-4`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
          isMe
            ? `bg-[#0A84FF] rounded-br-md ${isSending ? "opacity-70" : ""} ${isError ? "ring-2 ring-[#EF4444]/60" : ""}`
            : "bg-[#262628] rounded-bl-md"
        }`}
      >
        <p className="text-[16px] text-white leading-relaxed whitespace-pre-wrap break-words">
          {msg.content}
        </p>
      </div>
      <div className={`flex items-center gap-1.5 mt-1 ${isMe ? "pr-1" : "pl-1"}`}>
        <span className="text-[10px] text-white/35">{timeOfDay(msg.created_at)}</span>
        {isMe && isSending && (
          <span className="text-[10px] text-white/35 italic">envoi…</span>
        )}
        {isMe && isError && (
          <span className="text-[10px] text-[#EF4444] font-semibold">échec</span>
        )}
      </div>
    </div>
  );
}

/* ── DaySeparator ─────────────────────────────────────────────── */

function DaySeparator({ iso }: { iso: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold px-3 py-1 rounded-full bg-white/[0.04]">
        {dayLabel(iso)}
      </span>
    </div>
  );
}

/* ── CoachDetailsSheet (Section E) ────────────────────────────── */

const CRITERIA_LABELS: { key: "qualite_profils" | "reactivite" | "honnetete_evaluations" | "professionnalisme"; label: string }[] = [
  { key: "qualite_profils",       label: "Qualité des profils" },
  { key: "reactivite",            label: "Réactivité" },
  { key: "honnetete_evaluations", label: "Honnêteté des évaluations" },
  { key: "professionnalisme",     label: "Professionnalisme" },
];

function StarBar({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i + 1 <= value ? "#F59E0B" : "#4a4d56"} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

function CriterionBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 5) * 100;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] text-white/80">{label}</span>
        <span className="text-[13px] font-bold text-white tabular-nums">{value.toFixed(1)} /5</span>
      </div>
      <div className="h-[5px] rounded-full overflow-hidden bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: "#E63946" }}
        />
      </div>
    </div>
  );
}

function ClickableStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 5 }, (_, i) => {
        const star = i + 1;
        return (
          <button
            key={i}
            type="button"
            onClick={() => { triggerHaptic("Light"); onChange(star); }}
            aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
            className="active:scale-110 transition-transform"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill={star <= value ? "#F59E0B" : "#4a4d56"} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

/* Iter 7.8f Section 5 — ReviewEditSheet retiré : lecture + édition fusionnées
   inline dans CoachDetailsSheet (panneau iOS Settings, plus de 2e sheet).
   Hooks/states/handlers d'édition ont migré dans CoachDetailsSheet. Pour
   l'historique du composant, voir git log -p sur ce fichier avant 7.8f. */

function CoachDetailsSheet({
  open, onClose, coachId, coachName, coachPhotoUrl, athleteId, athleteName,
}: {
  open: boolean;
  onClose: () => void;
  coachId: string;
  coachName: string;
  coachPhotoUrl: string | null;
  athleteId: string;
  athleteName: string;
}) {
  const { reputation, badges, placedCount, verifiedCount, avgResponseHours, loading: repLoading } = useCoachReputation(open ? coachId : null);
  // Iter 7.8e — modèle A restauré : 1 review par (recruteur, coach), athlete_id n'entre plus dans la clé.
  const { data: myReview, isLoading: myReviewLoading } = useMyCoachReview(open ? coachId : null);
  const toast = useMobileToast();
  const submitMut = useSubmitCoachReview();
  const [mounted, setMounted] = useState(false);
  // Iter 7.8f Section 5 — édition INLINE (plus de 2e sheet ReviewEditSheet).
  const [editing, setEditing] = useState(false);
  const [editRatings, setEditRatings] = useState<Record<string, number>>({
    qualite_profils: 0, reactivite: 0, honnetete_evaluations: 0, professionnalisme: 0,
  });
  const [editRecommande, setEditRecommande] = useState<boolean | null>(null);
  const [editCommentaire, setEditCommentaire] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Seed les champs d'édition à partir de myReview quand on entre en mode éditing.
  useEffect(() => {
    if (!editing) return;
    if (myReview) {
      setEditRatings({
        qualite_profils: myReview.qualite_profils ?? 0,
        reactivite: myReview.reactivite ?? 0,
        honnetete_evaluations: myReview.honnetete_evaluations ?? 0,
        professionnalisme: myReview.professionnalisme ?? 0,
      });
      setEditRecommande(myReview.recommande);
      setEditCommentaire(myReview.commentaire ?? "");
    } else {
      setEditRatings({ qualite_profils: 0, reactivite: 0, honnetete_evaluations: 0, professionnalisme: 0 });
      setEditRecommande(null);
      setEditCommentaire("");
    }
    setEditError(null);
  }, [editing, myReview]);

  // Reset mode édition quand le sheet ferme.
  useEffect(() => {
    if (!open) { setEditing(false); setEditError(null); }
  }, [open]);

  // useMemo AVANT early return (Rules of Hooks — cf. fix 7.8d).
  const editNoteGlobale = useMemo(() => {
    const vals = Object.values(editRatings).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [editRatings]);

  if (!mounted) return null;

  const editAllRated = Object.values(editRatings).every((v) => v > 0);
  const canSave = editAllRated && editRecommande !== null && !submitMut.isPending;

  const valueByKey = (key: "qualite_profils" | "reactivite" | "honnetete_evaluations" | "professionnalisme"): number => {
    if (!reputation) return 0;
    switch (key) {
      case "qualite_profils":       return reputation.avgQualite;
      case "reactivite":            return reputation.avgReactivite;
      case "honnetete_evaluations": return reputation.avgHonnetete;
      case "professionnalisme":     return reputation.avgProf;
    }
  };

  const handleStartEdit = () => { triggerHaptic("Light"); setEditing(true); };
  const handleCancelEdit = () => { triggerHaptic("Light"); setEditing(false); setEditError(null); };
  const handleSave = async () => {
    if (!canSave) return;
    setEditError(null);
    try {
      await submitMut.mutateAsync({
        coachId, athleteId,
        qualite_profils: editRatings.qualite_profils,
        reactivite: editRatings.reactivite,
        honnetete_evaluations: editRatings.honnetete_evaluations,
        professionnalisme: editRatings.professionnalisme,
        recommande: editRecommande as boolean,
        commentaire: editCommentaire,
        existingId: myReview?.id ?? null,
      });
      triggerHaptic("Medium");
      toast.success({ message: myReview ? "Avis mis à jour" : "Avis envoyé" });
      setEditing(false);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setEditError(err.code === "23505" ? "Recharge et réessaie." : err.message || "Erreur lors de l'enregistrement.");
    }
  };

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60"
              onClick={onClose}
            />
            {/* Iter 7.8e-UI Section E — Sheet coach descend du HAUT (top-down).
                Signal spatial : le coach "à qui je parle" vient d'en haut comme
                le header. Handle iOS placé EN BAS du sheet (côté qui s'ouvre
                vers le bas, donc bord libre côté contenu). */}
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
              className="fixed inset-x-0 top-0 z-[65] bg-[#111317] rounded-b-3xl flex flex-col"
              style={{ maxHeight: "92vh", paddingTop: "env(safe-area-inset-top)" }}
            >
              {/* Iter 7.9 Section 5 — barre titre sheet coach contient désormais
                  le bouton Modifier/Évaluer (lecture) ou Annuler/Enregistrer
                  (édition) à droite, pattern iOS. Le bloc "Mon évaluation"
                  garde ses étoiles éditables en place, sans bouton interne. */}
              <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => { triggerHaptic("Light"); onClose(); }}
                  aria-label="Fermer"
                  className="w-9 h-9 rounded-full bg-white/[0.06] active:bg-white/[0.10] flex items-center justify-center flex-shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                  </svg>
                </button>
                <span className="text-[15px] font-bold text-white">Détails coach</span>
                <div className="min-w-[72px] flex justify-end">
                  {!myReviewLoading && (
                    editing ? (
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={handleCancelEdit} className="text-[14px] text-white/55 font-medium">
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={!canSave}
                          className={`text-[14px] font-bold ${canSave ? "text-[#E63946]" : "text-white/30"}`}
                        >
                          {submitMut.isPending ? "..." : "Enregistrer"}
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={handleStartEdit} className="text-[14px] text-[#E63946] font-semibold">
                        {myReview ? "Modifier" : "Évaluer"}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                {/* Header sheet : photo + nom coach */}
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
                    <AthletePhoto
                      photoUrl={coachPhotoUrl}
                      firstName={coachName.split(" ")[0] ?? "C"}
                      lastName={coachName.split(" ").slice(1).join(" ")}
                      size={56}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-head text-[20px] font-black text-white uppercase tracking-tight truncate">
                      Coach {coachName}
                    </p>
                  </div>
                </div>

                {/* Niveau 1 — Réputation globale */}
                <section>
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-bold mb-3">
                    Réputation
                  </h3>
                  {repLoading ? (
                    <div className="space-y-3">
                      <div className="h-12 rounded-xl nx-pulse-thread" />
                      <div className="h-5 rounded nx-pulse-thread" />
                      <div className="h-5 rounded nx-pulse-thread" />
                      <div className="h-5 rounded nx-pulse-thread" />
                      <div className="h-5 rounded nx-pulse-thread" />
                    </div>
                  ) : reputation ? (
                    <>
                      <div className="flex items-baseline gap-3 mb-3">
                        <p className="font-head text-[40px] font-black text-white tabular-nums leading-none">
                          {reputation.avgNote.toFixed(1)}
                        </p>
                        <span className="text-[14px] text-white/50">/5</span>
                        <div className="ml-2"><StarBar value={Math.round(reputation.avgNote)} /></div>
                      </div>
                      <p className="text-[12px] text-white/55 mb-4">
                        Basée sur {reputation.count} avis de recruteur{reputation.count > 1 ? "s" : ""}
                      </p>
                      <div className="space-y-1">
                        {CRITERIA_LABELS.map((c) => (
                          <CriterionBar key={c.key} label={c.label} value={valueByKey(c.key)} />
                        ))}
                      </div>
                      <p className="text-[13px] text-[#22C55E] font-semibold mt-4">
                        {reputation.recommendCount} recruteur{reputation.recommendCount > 1 ? "s" : ""} recommande{reputation.recommendCount > 1 ? "nt" : ""} ce coach
                      </p>
                      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-white/60">
                        <span>{placedCount} athlète{placedCount > 1 ? "s" : ""} placé{placedCount > 1 ? "s" : ""}</span>
                        <span className="text-white/30">·</span>
                        <span>{verifiedCount} vérifié{verifiedCount > 1 ? "s" : ""}</span>
                        {avgResponseHours !== null && (
                          <>
                            <span className="text-white/30">·</span>
                            <span>{avgResponseHours < 1 ? `<1` : Math.round(avgResponseHours)}h rép. moyenne</span>
                          </>
                        )}
                      </div>
                      {badges.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {badges.map((b) => (
                            <span key={b.badge} className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[11px] text-[#E63946] font-bold uppercase tracking-wider">
                              {b.badge.replace(/_/g, " ").toLowerCase()}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[13px] text-white/55 italic">Aucun avis pour ce coach pour le moment.</p>
                  )}
                </section>

                {/* Iter 7.9 Section 5 — Niveau 2 Mon évaluation : édition INLINE
                    conservée (étoiles éditables en place), boutons Modifier/
                    Annuler/Enregistrer MIGRÉS dans la barre titre du sheet. */}
                <section>
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-bold mb-3">
                    Mon évaluation
                  </h3>

                  {myReviewLoading ? (
                    <div className="h-24 rounded-xl nx-pulse-thread" />
                  ) : editing ? (
                    <div className="space-y-5">
                      {/* 4 critères ClickableStars éditables */}
                      <div className="space-y-3">
                        {CRITERIA_LABELS.map((c) => (
                          <div key={c.key} className="flex items-center justify-between gap-3">
                            <span className="text-[13px] text-white/85 font-medium">{c.label}</span>
                            <ClickableStars
                              value={editRatings[c.key]}
                              onChange={(v) => setEditRatings((prev) => ({ ...prev, [c.key]: v }))}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Note globale calculée */}
                      <div className="flex items-center justify-between bg-white/[0.04] rounded-xl px-4 py-3">
                        <span className="text-[12px] uppercase tracking-wider text-white/55 font-semibold">Note globale</span>
                        <span className="text-[18px] font-bold text-white tabular-nums">
                          {editNoteGlobale.toFixed(1)} <span className="text-[12px] text-white/45">/5</span>
                        </span>
                      </div>

                      {/* Recommande Oui/Non */}
                      <div>
                        <p className="text-[13px] text-white/85 font-medium mb-2">Tu recommandes ce coach ?</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { triggerHaptic("Light"); setEditRecommande(true); }}
                            className={`flex-1 py-3 rounded-xl text-[14px] font-bold transition-colors ${
                              editRecommande === true ? "bg-[#22C55E] text-white" : "bg-white/[0.06] text-white/70 active:bg-white/[0.10]"
                            }`}
                          >
                            Oui
                          </button>
                          <button
                            type="button"
                            onClick={() => { triggerHaptic("Light"); setEditRecommande(false); }}
                            className={`flex-1 py-3 rounded-xl text-[14px] font-bold transition-colors ${
                              editRecommande === false ? "bg-[#E63946] text-white" : "bg-white/[0.06] text-white/70 active:bg-white/[0.10]"
                            }`}
                          >
                            Non
                          </button>
                        </div>
                      </div>

                      {/* Commentaire */}
                      <div>
                        <p className="text-[13px] text-white/85 font-medium mb-2">Commentaire (optionnel)</p>
                        <textarea
                          value={editCommentaire}
                          onChange={(e) => setEditCommentaire(e.target.value)}
                          placeholder="Détaille ton expérience…"
                          rows={3}
                          className="w-full bg-white/[0.06] rounded-xl px-3 py-2.5 text-[16px] text-white placeholder:text-white/40 outline-none resize-none"
                        />
                      </div>

                      {/* Bandeau anonymat */}
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                        <p className="text-[12px] text-white/55 leading-relaxed">
                          Ton évaluation est anonyme. Le coach voit la note et le commentaire, jamais ton identité.
                        </p>
                      </div>

                      {editError && (
                        <div className="px-3 py-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30">
                          <p className="text-[13px] text-[#EF4444] font-medium">{editError}</p>
                        </div>
                      )}
                    </div>
                  ) : myReview ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <StarBar value={Math.round(myReview.note_globale ?? 0)} />
                        <span className="text-[14px] font-bold text-white tabular-nums">{(myReview.note_globale ?? 0).toFixed(1)} /5</span>
                      </div>
                      <div className="space-y-1">
                        {CRITERIA_LABELS.map((c) => (
                          <div key={c.key} className="flex items-center justify-between py-1">
                            <span className="text-[13px] text-white/70">{c.label}</span>
                            <StarBar value={myReview[c.key] ?? 0} />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[12px] uppercase tracking-wider text-white/45 font-semibold">Recommande</span>
                        <span className={`text-[13px] font-bold ${myReview.recommande ? "text-[#22C55E]" : "text-[#E63946]"}`}>
                          {myReview.recommande ? "Oui" : "Non"}
                        </span>
                      </div>
                      {myReview.commentaire && (
                        <p className="text-[13px] text-white/80 leading-relaxed bg-white/[0.04] rounded-xl px-3 py-2.5">
                          &laquo; {myReview.commentaire} &raquo;
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[13px] text-white/55 leading-relaxed">
                      Tu n&apos;as pas encore évalué ce coach. Tap « Évaluer » en haut à droite pour donner ton avis.
                    </p>
                  )}
                </section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Iter 7.8f Section 5 — ReviewEditSheet retiré : édition désormais
          INLINE dans le Niveau 2 de CoachDetailsSheet (panneau iOS Settings). */}
    </>,
    document.body,
  );
}

/* ── AthleteThreadSheet (Section E partie 2 — bottom-up READ-ONLY) ─
   Sheet allégé : photo + nom + position + école + promotion + status
   recrutement + cote coach + profil complété % + "Voir le profil complet".
   Pas de Prio/Notes/Stage pour cet iter (cf. STEP 0 E — éviter le
   side-effect "tap = insert recruiter_pipeline row"). Si BP valide
   l'auto-insert pipeline, on bascule en option β au prochain iter. */

function AthleteThreadSheet({
  open, onClose, athleteId,
}: {
  open: boolean;
  onClose: () => void;
  athleteId: string;
}) {
  const router = useRouter();
  const { data: summary, isLoading } = useAthleteThreadSummary(open ? athleteId : null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const statusConfig = summary?.recruitmentStatus
    ? getStatusConfig(summary.recruitmentStatus as RecruitmentStatus)
    : null;
  const cote = summary?.coteGlobaleEntraineur ?? 0;
  const completion = Math.max(0, Math.min(100, summary?.profileCompletion ?? 0));

  const goToProfile = () => {
    triggerHaptic("Light");
    router.push(`/recruteur/athletes/${athleteId}`);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[65] bg-[#111317] rounded-t-3xl flex flex-col"
            style={{ maxHeight: "85vh", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            {/* Iter 7.8f Section 4 — header sheet : bouton X icon (au lieu du
                mot "Fermer") cohérent avec le pattern sheets app. */}
            <div className="px-5 pb-3 flex items-center justify-between border-b border-white/[0.06]">
              <button
                type="button"
                onClick={() => { triggerHaptic("Light"); onClose(); }}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full bg-white/[0.06] active:bg-white/[0.10] flex items-center justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
              <span className="text-[15px] font-bold text-white">Détails athlète</span>
              <div className="w-9" />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
              {isLoading || !summary ? (
                <div className="space-y-4">
                  <div className="h-24 rounded-xl nx-pulse-thread" />
                  <div className="h-14 rounded-xl nx-pulse-thread" />
                  <div className="h-14 rounded-xl nx-pulse-thread" />
                  <div className="h-12 rounded-xl nx-pulse-thread" />
                </div>
              ) : (
                <>
                  {/* Iter 7.8f Section 4 — Header lisible : photo 72px, nom 22px,
                      check bleu vérifié INLINE à côté du nom (retire la ligne
                      séparée "Profil vérifié par le coach"). Position en
                      ACRONYME (ex "ILB") au lieu du libellé long. */}
                  <div className="flex items-center gap-4">
                    <div className="w-[72px] h-[72px] rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
                      <AthletePhoto
                        photoUrl={summary.photoUrl}
                        firstName={summary.firstName}
                        lastName={summary.lastName}
                        size={72}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-head text-[22px] font-black text-white uppercase tracking-tight truncate">
                          {summary.firstName} {summary.lastName}
                        </p>
                        {/* Iter 7.9 Section 4 — verified = CHECK ✓ dans cercle
                            bleu #3B82F6 (canon), plus l'étoile (réservée à la cote). */}
                        {summary.verified && (
                          <span aria-label="Vérifié" className="flex-shrink-0 inline-flex items-center justify-center w-[20px] h-[20px] rounded-full" style={{ backgroundColor: "#3B82F6" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                      </div>
                      {(summary.positionAbbr || summary.sportName) && (
                        <p className="text-[14px] text-white/75 mt-1 truncate">
                          {summary.sportName ?? ""}{summary.sportName && summary.positionAbbr ? " · " : ""}{summary.positionAbbr ?? ""}
                        </p>
                      )}
                      <p className="text-[13px] text-white/50 mt-0.5 truncate">
                        {summary.schoolName ?? "—"}{summary.promotion ? ` · Promo ${summary.promotion}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Pill statut recrutement */}
                  {statusConfig && (
                    <div className="flex items-center justify-between bg-white/[0.04] rounded-xl px-4 py-3">
                      <span className="text-[13px] uppercase tracking-wider text-white/55 font-semibold">Statut</span>
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold"
                        style={{
                          backgroundColor: `${statusConfig.color}22`,
                          color: statusConfig.color,
                          borderWidth: 1,
                          borderStyle: "solid",
                          borderColor: `${statusConfig.color}55`,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusConfig.color }} />
                        {statusConfig.shortLabel ?? statusConfig.label}
                      </span>
                    </div>
                  )}

                  {/* Cote globale entraîneur */}
                  <div className="flex items-center justify-between bg-white/[0.04] rounded-xl px-4 py-3">
                    <span className="text-[13px] uppercase tracking-wider text-white/55 font-semibold">Cote coach</span>
                    <div className="flex items-center gap-2.5">
                      <StarBar value={Math.round(cote)} />
                      <span className="text-[15px] font-bold text-white tabular-nums">{cote.toFixed(1)} <span className="text-[12px] text-white/45">/5</span></span>
                    </div>
                  </div>

                  {/* Profil complété */}
                  <div className="bg-white/[0.04] rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] uppercase tracking-wider text-white/55 font-semibold">Profil complété</span>
                      <span className="text-[15px] font-bold text-white tabular-nums">{completion}%</span>
                    </div>
                    <div className="h-[6px] rounded-full overflow-hidden bg-white/[0.06]">
                      <div className="h-full rounded-full" style={{ width: `${completion}%`, backgroundColor: "#E63946" }} />
                    </div>
                  </div>

                  {/* CTA Voir profil complet */}
                  <button
                    type="button"
                    onClick={goToProfile}
                    className="w-full mt-3 py-3.5 rounded-xl bg-[#E63946] active:bg-[#D42B22] text-white font-bold text-[15px] transition-colors"
                  >
                    Voir le profil complet
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── Skeleton bubbles ─────────────────────────────────────────── */

function ThreadSkeleton() {
  return (
    <div className="px-4 space-y-4 py-6">
      {[true, false, false, true, false].map((isMe, i) => (
        <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
          <div
            className={`rounded-2xl h-9 nx-pulse-thread`}
            style={{ width: `${40 + (i % 3) * 15}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function RecruteurMessagesThreadMobile() {
  const router = useRouter();
  const conversationId = useDynamicParam("id");
  const toast = useMobileToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const { data: ctx, isLoading: ctxLoading } = useThreadContext(conversationId);
  const { data: messages = [], isLoading: msgsLoading } = useMessages(conversationId);
  const sendMut = useSendMessage();
  const markRead = useMarkConversationRead();

  const [reply, setReply] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [athleteSheetOpen, setAthleteSheetOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mark as read au mount (1 fois)
  const markedRef = useRef(false);
  useEffect(() => {
    if (!conversationId || markedRef.current) return;
    markedRef.current = true;
    markRead.mutate({ conversationId });
  }, [conversationId, markRead]);

  // Auto-scroll au dernier message au mount + à chaque nouveau message
  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [messages.length]);

  // Realtime subscription : INSERT messages live
  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          const queryKey = ["messages", conversationId];
          queryClient.setQueryData<MessageRow[]>(queryKey, (old) => {
            if (!old) return [newMsg];
            // Dédup par id (évite doublon avec l'optimistic déjà settled)
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });
          // Si c'est un message du coach, re-marquer comme lu
          if (newMsg.sender_id !== userId) {
            markRead.mutate({ conversationId });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, queryClient, markRead]);

  // Groupage messages par jour (séparateurs)
  const groupedMessages = useMemo(() => {
    const groups: { type: "day"; iso: string } | { type: "msg"; msg: MessageRow }[] = [];
    type Item = { type: "day"; iso: string } | { type: "msg"; msg: MessageRow };
    const out: Item[] = [];
    let lastDayKey: string | null = null;
    for (const m of messages) {
      const d = new Date(m.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (key !== lastDayKey) {
        out.push({ type: "day", iso: m.created_at });
        lastDayKey = key;
      }
      out.push({ type: "msg", msg: m });
    }
    return out;
  }, [messages]);

  const handleSend = () => {
    if (!reply.trim() || !conversationId) return;
    const content = reply;
    setReply("");
    triggerHaptic("Light");
    sendMut.mutate(
      { conversationId, content },
      {
        onError: () => {
          toast.error({ message: "Erreur d'envoi", detail: "Vérifie ta connexion" });
        },
      }
    );
  };

  const handleBack = () => {
    triggerHaptic("Light");
    router.push("/recruteur/messages");
  };

  // Iter 7.9 Section 6 — re-tap ferme (toggle iOS).
  const handleCoachDetails = () => {
    triggerHaptic("Light");
    setDetailsOpen((v) => !v);
  };
  const handleAthleteDetails = () => {
    triggerHaptic("Light");
    setAthleteSheetOpen((v) => !v);
  };

  const loading = ctxLoading || msgsLoading;
  const isEmpty = !loading && messages.length === 0;

  return (
    <div className="min-h-screen bg-[#111317] text-white flex flex-col">
      {/* Iter 7.8c-UI Section D — Header épuré iOS : back + bloc central
          (photo coach 36 + nom + chevron, sous-titre "À propos de {athlète}"
          sans photo athlète). Tout le bloc central tappable → ouvre sheet
          Détails coach (Section E). Plus de barre athlète séparée. */}
      <div
        className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center px-3 py-2 gap-2 min-h-[64px]">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Retour"
            className="w-9 h-9 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {/* Iter 7.8e-UI Section E — header thread désormais deux zones tappables
              distinctes : photo+nom+chevron (coach) → sheet coach top-down ;
              sous-titre "À propos de {athlète}" → sheet athlète bottom-up. */}
          <div className="flex-1 flex flex-col items-center gap-0.5 min-w-0 py-1">
            <button
              type="button"
              onClick={handleCoachDetails}
              className="flex flex-col items-center gap-0.5 active:opacity-70 transition-opacity min-w-0 max-w-full"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
                <AthletePhoto
                  photoUrl={ctx?.coachPhotoUrl ?? null}
                  firstName={ctx?.coachInitials?.[0] ?? "C"}
                  lastName={ctx?.coachInitials?.[1] ?? ""}
                  size={36}
                />
              </div>
              {/* Iter 7.8f Section 3 — nom coach bumpé à 16px font-bold (interlocuteur principal, doit être lisible). */}
              <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                <span className="text-[16px] font-bold text-white truncate">
                  Coach {ctx?.coachName ?? "—"}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
            {/* Iter 7.9 Section 7 — sous-titre lisible + affordance tap : 14px,
                couleur white/75 (au lieu de /55), chevron › discret à droite. */}
            {ctx?.athleteName && (
              <button
                type="button"
                onClick={handleAthleteDetails}
                className="inline-flex items-center gap-1 text-[14px] text-white/75 truncate max-w-full active:opacity-70 transition-opacity"
              >
                <span className="truncate">À propos de {ctx.athleteName}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
          <div className="w-9 h-9 flex-shrink-0" />
        </div>
      </div>

      {/* Body : messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {loading ? (
          <ThreadSkeleton />
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1A1D24] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight mb-1">
              Démarre la conversation
            </h3>
            <p className="text-[13px] text-white/55 max-w-sm">
              Tu n&apos;as pas encore échangé avec {ctx?.coachName ?? "le coach"}. Pose une question pour commencer.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedMessages.map((item, idx) =>
              item.type === "day" ? (
                <DaySeparator key={`day-${idx}-${item.iso}`} iso={item.iso} />
              ) : (
                <MessageBubble
                  key={item.msg.id}
                  msg={item.msg}
                  isMe={item.msg.sender_id === userId}
                />
              )
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer sticky bottom */}
      <div
        className="sticky bottom-0 z-20 bg-[#111317]/95 backdrop-blur-md border-t border-white/[0.06]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="px-3 py-2 flex items-end gap-2">
          <div className="flex-1 bg-white/[0.06] rounded-2xl px-3 py-2 min-h-[40px] flex items-center">
            <textarea
              ref={inputRef}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Message…"
              rows={1}
              className="flex-1 bg-transparent text-[16px] text-white placeholder:text-white/40 outline-none resize-none max-h-[120px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!reply.trim()}
            aria-label="Envoyer"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
              reply.trim()
                ? "bg-[#E63946] active:bg-[#D42B22]"
                : "bg-white/[0.06]"
            }`}
          >
            {/* Iter 7.8e-UI Section D — chevron iOS ↑ (style iMessage) au lieu
                de l'icône avion. Trait épaissi (3px) pour la lisibilité dans
                le petit cercle. */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={reply.trim() ? "#FFFFFF" : "#4a4d56"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Iter 7.8c-UI Section E — Sheet Détails coach (Bottom Sheet Portal) */}
      {ctx && (
        <CoachDetailsSheet
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          coachId={ctx.coachId}
          coachName={ctx.coachName}
          coachPhotoUrl={ctx.coachPhotoUrl}
          athleteId={ctx.athleteId}
          athleteName={ctx.athleteName}
        />
      )}

      {/* Iter 7.8e-UI Section E partie 2 — Sheet athlète bottom-up (allégé). */}
      {ctx && (
        <AthleteThreadSheet
          open={athleteSheetOpen}
          onClose={() => setAthleteSheetOpen(false)}
          athleteId={ctx.athleteId}
        />
      )}

      <style jsx>{`
        @keyframes nx-pulse-thread-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        :global(.nx-pulse-thread) { background: #1A1D24; animation: nx-pulse-thread-kf 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
