"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RosterAthlete } from "../_data/mockRosterData";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { orgNounPossessif, type SchoolType } from "@/lib/utils/orgLabel";

/* ═══════════════════════════════════════════════════════════════
   ReclamerSection — la file « À réclamer », et les deux gestes
   qu'on y pose.

   RÉCLAMER (tout entraîneur de l'école) : multi-sélection puis
   `claim_school_athletes`. L'UPDATE direct est parti — non pour la
   sécurité (la policy tient toujours, en défense en profondeur) mais
   parce que la RPC est le seul endroit où la notification à l'athlète
   peut être liée au GESTE. Depuis la vague 2, `athletes.coach_id` est
   un pointeur DÉRIVÉ que des triggers posent tout seuls : une
   notification branchée sur le champ partirait aussi sur un simple
   attachement d'équipe.

   REJETER (directeur / directeur intérimaire SEULEMENT) :
   `reject_school_athlete`. Le bouton est ABSENT pour les autres, pas
   grisé — ce droit ne se débloque pas en ajoutant un entraîneur, et une
   option grisée mentirait sur la nature du droit (décision BP).

   Les deux gestes passent par un dialogue qui nomme la conséquence. Le
   rejet porte sur le profil d'un mineur : il ne peut pas être un clic.
═══════════════════════════════════════════════════════════════ */

interface ReclamerSectionProps {
  unclaimedAthletes: RosterAthlete[];
  /* `currentUserId` a disparu des props : la RPC lit `auth.uid()` elle-même.
     Le passer serait offrir au client de désigner le bénéficiaire du claim. */
  /** Type d'org du coach courant → vocabulaire type-aware (club vs école). */
  orgType?: SchoolType | null;
  /** Directeur ou directeur intérimaire de CETTE école. Gouverne l'existence
   *  du bouton « Rejeter », pas seulement son état. */
  isDirector?: boolean;
  /** athlete_id → date ISO du rejet ACTIF, quand l'athlète est revenu dans la
   *  file après avoir été rejeté (un attachement d'équipe réancre l'école).
   *  La trace est un garde-fou, pas un verrou : on informe, on ne bloque pas. */
  rejections?: Record<string, string>;
  onClaimSuccess: () => void;
  onRejectSuccess?: () => void;
}

const dateFr = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
};

export default function ReclamerSection({
  unclaimedAthletes,
  orgType = null,
  isDirector = false,
  rejections = {},
  onClaimSuccess,
  onRejectSuccess,
}: ReclamerSectionProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<RosterAthlete | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  function flash(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 5000);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleClaim() {
    if (selectedIds.size === 0 || submitting) return;
    setSubmitting(true);
    const ids = Array.from(selectedIds);
    const supabase = createClient();

    /* La RPC rend le nombre RÉELLEMENT réclamé : un athlète qu'un collègue
       vient de prendre entre-temps n'y est pas. On annonce ce chiffre-là, pas
       celui de la sélection — promettre 5 quand 4 sont passés, c'est le bug de
       compteur qu'on vient de payer ailleurs. */
    const { data, error } = await supabase.rpc("claim_school_athletes", { p_athlete_ids: ids });

    setSubmitting(false);
    setShowConfirm(false);

    if (error) {
      console.error("[claim_school_athletes]", error);
      flash("error", error.message?.replace(/^NEXUS:\s*/, "") || "Impossible de réclamer ces athlètes.");
      return;
    }

    const n = typeof data === "number" ? data : ids.length;
    flash(
      "success",
      n === 0
        ? "Aucun athlète réclamé — ils viennent d'être pris par un autre entraîneur."
        : `${n} athlète${n > 1 ? "s ajoutés" : " ajouté"} à ton roster. ${n > 1 ? "Ils en sont informés" : "Il en est informé"}.`,
    );
    setSelectedIds(new Set());
    onClaimSuccess();
  }

  async function handleReject() {
    if (!rejectTarget || submitting) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("reject_school_athlete", { p_athlete_id: rejectTarget.id });

    setSubmitting(false);
    const nom = `${rejectTarget.firstName} ${rejectTarget.lastName}`.trim();
    setRejectTarget(null);

    if (error) {
      console.error("[reject_school_athlete]", error);
      flash("error", error.message?.replace(/^NEXUS:\s*/, "") || "Impossible de rejeter ce rattachement.");
      return;
    }

    flash("success", `${nom} n'est plus rattaché à ${orgNounPossessif(orgType)}. L'athlète en est informé.`);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(rejectTarget.id);
      return next;
    });
    (onRejectSuccess ?? onClaimSuccess)();
  }

  if (unclaimedAthletes.length === 0) {
    return (
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-[#22C55E]/10 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight">
          Aucun athlète non réclamé
        </h3>
        <p className="text-[13px] text-[#9CA3AF] mt-2 max-w-sm mx-auto">
          Aucun athlète non réclamé à {orgNounPossessif(orgType)} pour l&apos;instant.
        </p>
      </div>
    );
  }

  const count = selectedIds.size;

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
            Athlètes non réclamés à {orgNounPossessif(orgType)}
            <span className="text-[#F59E0B] ml-2">({unclaimedAthletes.length})</span>
          </h3>
          <p className="text-[13px] text-[#9CA3AF] mt-1">
            Sélectionne les athlètes dont tu veux devenir le coach principal.
            {isDirector && " Un athlète qui n'est pas d'ici peut être rejeté."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
          {unclaimedAthletes.map((a) => {
            const selected = selectedIds.has(a.id);
            const dejaRejete = rejections[a.id];
            return (
              /* Le bouton « Rejeter » est un FRÈRE de la carte, pas un enfant :
                 un bouton dans un bouton n'est pas du HTML valide, et le clic
                 de sélection avalerait le sien. */
              <div key={a.id} className="relative">
                <button
                  type="button"
                  onClick={() => toggleSelected(a.id)}
                  className={`w-full text-left bg-[#1A1D24] rounded-xl overflow-hidden transition-all duration-200 group ${
                    selected
                      ? "border-2 border-[#E63946] shadow-[0_0_24px_rgba(230,57,70,0.18)]"
                      : "border border-[#2D3748] hover:border-[#E63946]/30"
                  }`}
                >
                  {/* Checkbox top-left */}
                  <div className="absolute top-3 left-3 z-10">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        selected
                          ? "bg-[#E63946] border-2 border-[#E63946]"
                          : "bg-[#111317]/80 border-2 border-[#4a4d56] group-hover:border-[#E63946]/60"
                      }`}
                    >
                      {selected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Photo banner */}
                  <div className="relative h-[140px] bg-[#2F3440] overflow-hidden">
                    <AthletePhotoFill
                      photoUrl={a.photo}
                      firstName={a.firstName}
                      lastName={a.lastName}
                      initialsFontSize={48}
                      className="object-[center_15%]"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: "linear-gradient(to top, rgba(26,29,36,0.95), transparent)" }} />
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-bold text-white">
                        {a.firstName} {a.lastName}
                      </span>
                      {a.position && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">
                          {a.position}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#6b7280] mt-1">
                      {a.gradYear ? `Promotion ${a.gradYear}` : "—"}
                    </p>

                    {/* Il a déjà été rejeté, et il est revenu — un attachement
                        d'équipe réancre l'école. On le DIT, on ne bloque pas. */}
                    {dejaRejete && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/25 rounded px-2 py-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        Déjà rejeté le {dateFr(dejaRejete)}
                      </p>
                    )}
                  </div>
                </button>

                {/* REJETER — directeur seulement. Absent, pas grisé. */}
                {isDirector && (
                  <button
                    type="button"
                    onClick={() => setRejectTarget(a)}
                    title="Cet athlète n'est pas de notre établissement"
                    className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-md bg-[#111317]/85 border border-[#4a4d56] text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white hover:border-[#EF4444]/60 hover:bg-[#EF4444]/15 transition-colors"
                  >
                    Rejeter
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky action bar */}
        {count > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1A1D24] border border-[#E63946]/30 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4">
            <span className="text-[13px] text-white">
              <span className="font-bold">{count}</span> athlète{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold uppercase tracking-wider rounded-lg transition-colors"
            >
              Réclamer {count} athlète{count > 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>

      {/* ── Confirmation RÉCLAMER ────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setShowConfirm(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
              Réclamer {count} athlète{count > 1 ? "s" : ""}?
            </h3>
            <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">
              Tu vas devenir le coach principal de {count} athlète{count > 1 ? "s" : ""}.
              {count > 1 ? " Ils en seront informés" : " Il en sera informé"} — nom, établissement,
              et ce que ça change pour {count > 1 ? "eux" : "lui"}.
            </p>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleClaim}
                disabled={submitting}
                className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-40"
              >
                {submitting ? "..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation REJETER ─────────────────────────────────────
          Le dialogue nomme la conséquence EXACTE, dans l'ordre où elle
          compte : ce que ça retire, qui le voit, ce que ça ne touche pas.
          Un directeur qui clique doit savoir qu'il écrit à un mineur. */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setRejectTarget(null)} />
          <div className="relative bg-[#1A1D24] border border-[#EF4444]/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
              Rejeter le rattachement de {rejectTarget.firstName} {rejectTarget.lastName}?
            </h3>
            <div className="text-[13px] text-[#9CA3AF] mt-3 space-y-2 leading-relaxed">
              <p>
                Tu déclares que cet athlète n&apos;est pas de {orgNounPossessif(orgType)}. Son
                rattachement est effacé et il disparaît de la file « À réclamer »
                <span className="text-white font-bold"> pour toute l&apos;école</span>.
              </p>
              <p>
                <span className="text-white font-bold">Il en sera informé</span>, avec l&apos;invitation
                à vérifier son école.
              </p>
              <p>
                Son compte, son profil et ses données restent intacts, et il reste visible aux
                recruteurs. Ce rejet peut être annulé.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                disabled={submitting}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="px-5 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-40"
              >
                {submitting ? "..." : "Rejeter le rattachement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 max-w-[92vw]">
          <div className={`rounded-lg px-5 py-3 shadow-lg flex items-center gap-3 border ${
            toast.kind === "success"
              ? "bg-[#1A1D24] border-[#22C55E]/30"
              : "bg-[#1A1D24] border-[#EF4444]/30"
          }`}>
            {toast.kind === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            )}
            <span className="text-[13px] font-bold text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}
