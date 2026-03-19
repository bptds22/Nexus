"use client";

import { useEffect, useRef } from "react";

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
}

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
}: ConfirmationModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const confirmBg = variant === "danger" ? "bg-[#E63946] hover:bg-[#D42B22]" : "bg-[#2563EB] hover:bg-[#1D4ED8]";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl w-full max-w-[420px] mx-4 p-6 shadow-xl">
        <h3 className="font-head text-[18px] font-bold text-white uppercase tracking-tight mb-2">
          {title}
        </h3>
        <p className="text-[14px] text-[#9CA3AF] leading-relaxed mb-6">
          {description}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-[13px] font-bold text-[#9CA3AF] border border-[#2D3748] hover:text-white hover:border-[#4a4d56] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-5 py-2.5 rounded-lg text-[13px] font-bold text-white ${confirmBg} transition-colors`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
