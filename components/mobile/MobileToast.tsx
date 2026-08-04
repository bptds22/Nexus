"use client";

/* ═══════════════════════════════════════════════════════════════
   Nexus — MobileToast
   Dynamic Island-style toast system for mobile (iOS-first via
   Capacitor + Android Chrome WebView).

   Single-toast-at-a-time (no stacking). New toast crossfades the
   previous via animation states `entering` / `visible` / `exiting`.

   Architecture :
   - Module-level mutable timer ref
   - Context provider exposes 4 helpers (success / error / warning / info)
     + dismiss()
   - Hook useMobileToast() returns the helpers
   - Rendered via createPortal to document.body so it escapes any
     ancestor with transform / will-change (containing-block trap)

   Reference design : docs/mobile-design-system.md (palette, animations,
   z-index hiérarchie [100]).
═══════════════════════════════════════════════════════════════ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { triggerHaptic } from "@/lib/haptics";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  message: string;
  detail?: string;
  duration?: number; // default 1800ms, 3000ms si expanded
  haptic?: boolean; // default true
  // Iter 6.1b — Action button optionnel (pattern Apple Mail Undo).
  // Si fourni, le toast affiche un bouton à droite. Tap exécute onClick
  // puis dismiss immédiat. Conseillé : duration 5000ms pour laisser le
  // temps de tap.
  action?: { label: string; onClick: () => void };
}

interface ToastState extends ToastOptions {
  id: number;
  variant: ToastVariant;
}

interface MobileToastContextValue {
  success: (opts: ToastOptions) => void;
  error: (opts: ToastOptions) => void;
  warning: (opts: ToastOptions) => void;
  info: (opts: ToastOptions) => void;
  dismiss: () => void;
}

const MobileToastContext = createContext<MobileToastContextValue | null>(null);

const DEFAULT_DURATION = 1800;
const EXPANDED_DURATION = 3000;
const EXIT_DURATION = 220;
const ENTER_DURATION = 350;

async function triggerToastHaptic(variant: ToastVariant) {
  try {
    const { Haptics, NotificationType, ImpactStyle } = await import("@capacitor/haptics");
    if (variant === "info") {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else {
      const type =
        variant === "success" ? NotificationType.Success :
        variant === "error" ? NotificationType.Error :
        NotificationType.Warning;
      await Haptics.notification({ type });
    }
  } catch { /* haptics non disponible (web / plugin absent) */ }
}

/* ── Variant style maps ────────────────────────────────────────── */

const VARIANT_COLORS: Record<ToastVariant, { fg: string; bg: string }> = {
  success: { fg: "#22C55E", bg: "rgba(34,197,94,0.25)" },
  error:   { fg: "#E63946", bg: "rgba(230,57,70,0.25)" },
  warning: { fg: "#F59E0B", bg: "rgba(245,158,11,0.25)" },
  info:    { fg: "#FFFFFF", bg: "rgba(255,255,255,0.15)" },
};

function VariantIcon({ variant }: { variant: ToastVariant }) {
  const { fg } = VARIANT_COLORS[variant];
  switch (variant) {
    case "success":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "error":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "warning":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "info":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

/* ── Toast renderer ────────────────────────────────────────────── */

interface ToastRendererProps {
  toast: ToastState | null;
  phase: "entering" | "visible" | "exiting";
  expanded: boolean;
  onToggleExpand: () => void;
  onActionTap: () => void;
}

function ToastRenderer({ toast, phase, expanded, onToggleExpand, onActionTap }: ToastRendererProps) {
  if (!toast) return null;
  const colors = VARIANT_COLORS[toast.variant];
  const animation =
    phase === "entering" ? `nx-toast-enter ${ENTER_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards` :
    phase === "exiting" ? `nx-toast-exit ${EXIT_DURATION}ms ease-in forwards` :
    undefined;
  const hasDetail = !!toast.detail;
  const hasAction = !!toast.action;

  return (
    <div
      className="fixed z-[100]"
      style={{
        top: "calc(env(safe-area-inset-top) + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        animation,
      }}
    >
      <button
        type="button"
        onClick={hasDetail ? onToggleExpand : undefined}
        className="flex items-center gap-2 text-left"
        style={{
          minWidth: 200,
          maxWidth: expanded ? "min(360px, 90vw)" : "90vw",
          width: expanded ? "min(360px, 90vw)" : "auto",
          padding: expanded ? "12px 16px" : "8px 16px",
          borderRadius: expanded ? 16 : 9999,
          backgroundColor: "rgba(26,29,36,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          color: "#FFFFFF",
          cursor: hasDetail ? "pointer" : "default",
          transition: "max-width 300ms cubic-bezier(0.34, 1.56, 0.64, 1), width 300ms cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 300ms cubic-bezier(0.34, 1.56, 0.64, 1), padding 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Icône colorée 22×22 rounded-full */}
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 22,
            height: 22,
            borderRadius: 9999,
            background: colors.bg,
          }}
        >
          <VariantIcon variant={toast.variant} />
        </span>

        {/* Message + detail (en mode expanded) */}
        <span className="flex-1 min-w-0">
          <span
            className="block"
            style={{
              fontFamily: "var(--font-outfit), sans-serif",
              fontWeight: 600,
              fontSize: 14,
              lineHeight: 1.3,
              color: "#FFFFFF",
              whiteSpace: expanded ? "normal" : "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
            }}
          >
            {toast.message}
          </span>
          {expanded && toast.detail && (
            <span
              className="block"
              style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontWeight: 500,
                fontSize: 12,
                lineHeight: 1.4,
                color: "#9CA3AF",
                marginTop: 4,
              }}
            >
              {toast.detail}
            </span>
          )}
        </span>

        {/* Action button (iter 6.1b — pattern Apple Mail Undo) */}
        {hasAction && toast.action && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { void triggerHaptic("Light"); e.stopPropagation();
              e.preventDefault();
              toast.action!.onClick();
              onActionTap();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toast.action!.onClick();
                onActionTap();
              }
            }}
            className="flex-shrink-0 ml-1"
            style={{
              padding: "4px 10px",
              borderRadius: 9999,
              fontFamily: "var(--font-outfit), sans-serif",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              color: colors.fg,
              background: colors.bg,
              cursor: "pointer",
            }}
          >
            {toast.action.label}
          </span>
        )}

        {/* Chevron expand (si detail) */}
        {hasDetail && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 220ms ease",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      <style jsx global>{`
        @keyframes nx-toast-enter {
          0% { transform: translateX(-50%) translateY(-20px) scale(0.9); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        }
        @keyframes nx-toast-exit {
          0% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          100% { transform: translateX(-50%) translateY(-20px) scale(0.95); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Provider ──────────────────────────────────────────────────── */

export function MobileToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting">("visible");
  const [expanded, setExpanded] = useState(false);
  const dismissTimer = useRef<number | null>(null);
  const exitTimer = useRef<number | null>(null);
  const idCounter = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const clearTimers = useCallback(() => {
    if (dismissTimer.current) { window.clearTimeout(dismissTimer.current); dismissTimer.current = null; }
    if (exitTimer.current) { window.clearTimeout(exitTimer.current); exitTimer.current = null; }
  }, []);

  const scheduleAutoDismiss = useCallback((duration: number) => {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    dismissTimer.current = window.setTimeout(() => {
      setPhase("exiting");
      exitTimer.current = window.setTimeout(() => {
        setToast(null);
        setExpanded(false);
        setPhase("visible");
      }, EXIT_DURATION);
    }, duration);
  }, []);

  const showToast = useCallback((variant: ToastVariant, opts: ToastOptions) => {
    clearTimers();
    const id = ++idCounter.current;
    const newToast: ToastState = { ...opts, variant, id };
    // Si un toast est déjà visible : crossfade rapide. Sinon : enter direct.
    setExpanded(false);
    if (toast) {
      setPhase("exiting");
      // Overlap : 100ms après le début du exit, on remonte le nouveau
      window.setTimeout(() => {
        setToast(newToast);
        setPhase("entering");
        if (opts.haptic !== false) void triggerToastHaptic(variant);
        window.setTimeout(() => setPhase("visible"), ENTER_DURATION);
        scheduleAutoDismiss(opts.duration ?? DEFAULT_DURATION);
      }, EXIT_DURATION - 100);
    } else {
      setToast(newToast);
      setPhase("entering");
      if (opts.haptic !== false) void triggerToastHaptic(variant);
      window.setTimeout(() => setPhase("visible"), ENTER_DURATION);
      scheduleAutoDismiss(opts.duration ?? DEFAULT_DURATION);
    }
  }, [toast, clearTimers, scheduleAutoDismiss]);

  const dismiss = useCallback(() => {
    clearTimers();
    setPhase("exiting");
    exitTimer.current = window.setTimeout(() => {
      setToast(null);
      setExpanded(false);
      setPhase("visible");
    }, EXIT_DURATION);
  }, [clearTimers]);

  const onToggleExpand = useCallback(() => {
    setExpanded((wasExpanded) => {
      const nowExpanded = !wasExpanded;
      // En s'expandant, reset le timer à 3000ms pour laisser lire le detail
      scheduleAutoDismiss(nowExpanded ? EXPANDED_DURATION : DEFAULT_DURATION);
      return nowExpanded;
    });
  }, [scheduleAutoDismiss]);

  // Cleanup timers au unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  const value: MobileToastContextValue = {
    success: (opts) => showToast("success", opts),
    error: (opts) => showToast("error", opts),
    warning: (opts) => showToast("warning", opts),
    info: (opts) => showToast("info", opts),
    dismiss,
  };

  return (
    <MobileToastContext.Provider value={value}>
      {children}
      {mounted && createPortal(
        <ToastRenderer toast={toast} phase={phase} expanded={expanded} onToggleExpand={onToggleExpand} onActionTap={dismiss} />,
        document.body
      )}
    </MobileToastContext.Provider>
  );
}

/* ── Hook ──────────────────────────────────────────────────────── */

export function useMobileToast(): MobileToastContextValue {
  const ctx = useContext(MobileToastContext);
  if (!ctx) {
    // No-op fallback si utilisé hors provider — évite de crasher en dev
    return {
      success: () => {}, error: () => {}, warning: () => {}, info: () => {}, dismiss: () => {},
    };
  }
  return ctx;
}
