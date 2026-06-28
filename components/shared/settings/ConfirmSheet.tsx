"use client";

/* ═══════════════════════════════════════════════════════════════
   ConfirmSheet — iOS slide-up two-button confirm dialog.

   Variants : "danger" (red action) | "warning" (amber action).
   Optional "extra" content slot rendered between message + action :
   coach delete-account flow uses it for the SUPPRIMER typed-confirm
   field + reason textarea.

   Extracted from RecruteurParametresMobile, with the optional
   `extra` slot added for the coach delete-account use case.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useKeyboardHeight } from "@/lib/hooks/useKeyboardHeight";

export function ConfirmSheet({
  open, onClose, title, message, confirmLabel, onConfirm, variant = "danger",
  confirmDisabled, extra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: "danger" | "warning";
  /** Gates the confirm action (e.g. "SUPPRIMER" typed gate). */
  confirmDisabled?: boolean;
  /** Optional content rendered between message and confirm button. */
  extra?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // Clavier (KeyboardResize.None : la WKWebView ne se redimensionne pas → la
  // sheet bottom-0 serait recouverte). On remonte la carte au-dessus du clavier
  // via paddingBottom, même idiome que le composer messages (MessageThreadShell).
  // Hook AVANT tout return conditionnel (Rules of Hooks). kbdH=0 sur web/sans
  // clavier → comportement inchangé.
  const kbdH = useKeyboardHeight();
  if (!mounted || !open) return null;

  const actionColor = variant === "danger" ? "#E63946" : "#F59E0B";
  const disabled = !!confirmDisabled;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60"
        style={{ animation: "nx-modal-fade 200ms ease-out forwards" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] px-3 pb-3"
        style={{
          paddingBottom: kbdH > 0
            ? `${kbdH + 12}px`
            : "calc(env(safe-area-inset-bottom) + 12px)",
          animation: "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <div className="bg-[#1A1D24] rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4 text-center border-b border-white/[0.06]">
            <p className="text-[14px] font-semibold text-white">{title}</p>
            <p className="text-[12px] text-[#9CA3AF] mt-1.5 leading-relaxed">{message}</p>
          </div>
          {extra && (
            <div className="px-5 py-3 border-b border-white/[0.06]">
              {extra}
            </div>
          )}
          <button
            type="button"
            onClick={disabled ? undefined : onConfirm}
            disabled={disabled}
            className={`w-full h-12 text-[15px] font-semibold ${disabled ? "opacity-40 cursor-not-allowed" : "active:bg-white/[0.04]"}`}
            style={{ color: actionColor }}
          >
            {confirmLabel}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 mt-2 rounded-2xl bg-[#1A1D24] text-[#E0E0E0] text-[15px] font-semibold active:bg-white/[0.04]"
        >
          Annuler
        </button>
      </div>
      <style jsx global>{`
        @keyframes nx-modal-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes nx-modal-slideup { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
      `}</style>
    </>,
    document.body,
  );
}
