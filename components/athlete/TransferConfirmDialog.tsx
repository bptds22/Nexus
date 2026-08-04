"use client";

/* ═══════════════════════════════════════════════════════════════
   TransferConfirmDialog — l'écran de confirmation de transfert.

   Il n'est JAMAIS ouvert par une décision de l'UI : il s'ouvre parce que le
   serveur a levé TRANSFER_REQUIRES_CONFIRMATION et a joint, dans le champ
   `details` de l'erreur, l'ancienne et la nouvelle équipe. L'UI ne fait
   qu'afficher ce que la base a constaté — un onglet périmé, un state React
   désynchronisé ou un appel direct à la RPC tombent sur le même mur.

   Partagé par l'onboarding (web) et l'onglet Transfert.
═══════════════════════════════════════════════════════════════ */

import { transferConfirmationText, type TransferConfirmation } from "@/lib/queries/shared/attachmentErrors";

interface Props {
  confirmation: TransferConfirmation;
  /** Texte du bouton d'annulation — le sens diffère selon le contexte
   *  (onboarding : « garder mon équipe » ; transfert : « annuler »). */
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function TransferConfirmDialog({
  confirmation, cancelLabel = "Garder mon équipe actuelle", busy = false, onConfirm, onCancel,
}: Props) {
  const from = [confirmation.previous_team_name, confirmation.previous_school_name]
    .filter(Boolean).join(" · ") || "Ton équipe actuelle";
  const to = [confirmation.target_team_name, confirmation.target_school_name]
    .filter(Boolean).join(" · ") || "La nouvelle équipe";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#2D3748] bg-[#1A1D24] p-6">
        <h2
          id="transfer-confirm-title"
          className="font-head text-[20px] font-bold uppercase tracking-tight text-white"
        >
          Confirmer le transfert
        </h2>

        <p className="mt-3 text-[14px] leading-relaxed text-[#9CA3AF]">
          {transferConfirmationText(confirmation)}
        </p>

        <div className="mt-5 space-y-2">
          <Row label="Tu quittes" value={from} tone="leave" />
          <Row label="Tu rejoins" value={to} tone="join" />
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-[#6b7280]">
          Ton ancienne équipe reste visible dans ton parcours — tu ne perds pas
          ton historique.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-[#E63946] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#d12f3c] disabled:opacity-50"
          >
            {busy ? "Transfert en cours…" : "Confirmer le transfert"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-[#2D3748] px-4 py-3 text-[14px] font-semibold text-[#9CA3AF] transition hover:text-white disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: "leave" | "join" }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#111317] px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">{label}</div>
      <div className={`mt-0.5 text-[14px] font-semibold ${tone === "join" ? "text-white" : "text-[#9CA3AF]"}`}>
        {value}
      </div>
    </div>
  );
}
