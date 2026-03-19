"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ImpactSummaryCard from "@/components/shared/ImpactSummaryCard";
import { mockCoachOverviews, mockTrainerOverviews, mockDeactivationEvents } from "@/lib/mock";

/* ══════════════════════════════════════════════════════════════
   PAGE 1 — Confirmation de désactivation
   Route: /directeur/equipe/[coachId]/supprimer
══════════════════════════════════════════════════════════════ */

export default function DeactivateCoachPage() {
  const { coachId } = useParams<{ coachId: string }>();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  /* Find the coach/recruiter */
  const coach = useMemo(() => {
    const c = mockCoachOverviews.find((x) => x.id === coachId);
    if (c) return { type: "coach" as const, name: `${c.firstName} ${c.lastName}`, sport: c.sport, athleteCount: c.athleteCount, id: c.id };
    const t = mockTrainerOverviews.find((x) => x.id === coachId);
    if (t) return { type: "trainer" as const, name: `${t.firstName} ${t.lastName}`, sport: t.sports.join(", "), athleteCount: 0, id: t.id };
    return null;
  }, [coachId]);

  /* Mock impact data */
  const existingEvent = mockDeactivationEvents.find((e) => e.coachId === coachId);
  const orphanCount = existingEvent?.orphanedAthletes.length ?? (coach?.type === "coach" ? coach.athleteCount : 0);
  const pipelineCount = existingEvent?.frozenPipelines.length ?? (coach?.type === "trainer" ? 2 : 0);
  const conversationCount = existingEvent?.frozenConversations.length ?? 2;

  /* Check if this is the last active coach/recruiter */
  const activeCoaches = mockCoachOverviews.filter((c) => c.accountStatus === "ACTIF" && c.id !== coachId);
  const activeTrainers = mockTrainerOverviews.filter((t) => t.accountStatus === "ACTIF" && t.id !== coachId);
  const isLastActive = coach?.type === "coach" ? activeCoaches.length === 0 : activeTrainers.length === 0;

  const impactItems = [
    { label: "Athlètes orphelins", count: orphanCount, href: "/directeur/reassignation" },
    { label: "Pipelines gelés", count: pipelineCount, href: "/directeur/transfert-pipeline" },
    { label: "Conversations", count: conversationCount },
    { label: "Demandes en cours", count: 1 },
  ];

  function handleConfirm() {
    setConfirming(true);
    // Mock: simulate deactivation then redirect to reassignment
    setTimeout(() => {
      router.push("/directeur/reassignation");
    }, 800);
  }

  if (!coach) {
    return (
      <div className="px-6 sm:px-10 py-16 max-w-[700px] mx-auto text-center">
        <p className="text-[#6B7280] text-[14px]">Entraîneur introuvable.</p>
        <Link href="/directeur-ecole/coachs" className="text-[13px] text-[#E63946] hover:underline mt-4 inline-block">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[700px] mx-auto space-y-6">
      {/* Back link */}
      <Link
        href={coach.type === "coach" ? `/directeur-ecole/coachs/${coachId}` : `/directeur-cegep/entraineurs/${coachId}`}
        className="text-[13px] text-[#6B7280] hover:text-white transition-colors inline-flex items-center gap-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Retour au profil
      </Link>

      {/* Header */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#E63946]/15 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <div>
            <h1 className="text-[20px] font-head font-bold text-white">
              Désactiver {coach.name}
            </h1>
            <p className="text-[13px] text-[#6B7280]">
              {coach.type === "coach" ? "Entraîneur" : "Recruteur"} · {coach.sport}
            </p>
          </div>
        </div>

        <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-6">
          La désactivation est un retrait temporaire. Le compte sera suspendu, les données conservées,
          et les athlètes/pipelines associés devront être réassignés. Cette action peut être annulée.
        </p>

        {/* Impact summary */}
        <ImpactSummaryCard items={impactItems} className="mb-6" />

        {/* Last active warning */}
        {isLastActive && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-[#E63946]/30 bg-[rgba(230,57,70,0.06)] mb-6">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-[13px] text-[#E63946] font-medium leading-snug">
              Attention : aucun {coach.type === "coach" ? "entraîneur" : "recruteur"} actif ne sera disponible
              pour la réassignation. Ajoutez un nouvel {coach.type === "coach" ? "entraîneur" : "recruteur"} avant de procéder.
            </p>
          </div>
        )}

        {/* Reason textarea */}
        <div className="mb-6">
          <label className="block text-[12px] font-bold tracking-[0.15em] uppercase text-[#6B7280] mb-2">
            Raison de la désactivation (optionnel)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Fin de contrat, inactivité prolongée..."
            rows={3}
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="nx-ghost-btn px-5 py-2.5 rounded-lg text-[13px] font-bold border border-[rgba(255,255,255,0.15)] text-[#9CA3AF] hover:text-white transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="px-5 py-2.5 rounded-lg text-[13px] font-bold bg-[#E63946] text-white hover:bg-[#D93C3C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? "Désactivation en cours..." : "Confirmer la désactivation"}
          </button>
        </div>
      </div>
    </div>
  );
}
