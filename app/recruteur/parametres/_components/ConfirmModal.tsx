"use client";

import { useState, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────────
   ConfirmModal — reusable confirmation dialog
   Supports optional typed-confirmation (e.g. type "SUPPRIMER")
───────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  requireTyped?: string; // e.g. "SUPPRIMER"
}

const VARIANT_COLORS = {
  danger: { btn: "bg-[#E63946] hover:bg-[#D42B22]", icon: "#E63946" },
  warning: { btn: "bg-[#F59E0B] hover:bg-[#D97706] text-black", icon: "#F59E0B" },
  default: { btn: "bg-[#E63946] hover:bg-[#D42B22]", icon: "#6B7280" },
};

export default function ConfirmModal({
  open, onClose, onConfirm, title, message, confirmLabel,
  cancelLabel = "Annuler", variant = "default", requireTyped,
}: Props) {
  const [typed, setTyped] = useState("");
  const colors = VARIANT_COLORS[variant];
  const canConfirm = requireTyped ? typed === requireTyped : true;

  useEffect(() => { if (!open) setTyped(""); }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-[#1A1D24] border border-[#2a2d36] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] w-full max-w-md p-6 animate-[nxDropIn_0.2s_ease-out]">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#E63946]/10 mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h3 className="font-head text-lg font-bold text-white text-center mb-2">{title}</h3>
        <p className="text-[14px] text-[#9CA3AF] text-center leading-relaxed mb-5">{message}</p>

        {requireTyped && (
          <div className="mb-5">
            <p className="text-[12px] text-[#6B7280] mb-2 text-center">
              Tapez <strong className="text-white">{requireTyped}</strong> pour confirmer
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireTyped}
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none text-center tracking-widest"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#2a2d36] text-[14px] font-bold text-[#9CA3AF] hover:text-white hover:border-[#4a4d56] transition-colors">
            {cancelLabel}
          </button>
          <button type="button" onClick={() => { if (canConfirm) { onConfirm(); onClose(); } }}
            disabled={!canConfirm}
            className={`flex-1 px-4 py-2.5 rounded-lg text-[14px] font-bold text-white transition-all ${colors.btn} ${!canConfirm ? "opacity-40 cursor-not-allowed" : ""}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
