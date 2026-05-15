"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   PreMaintenanceBanner
   Shown above the main content when app_settings.pre_maintenance_warning
   is 'true'. Dismissible per-user via localStorage (keyed by message
   so a new message re-surfaces the banner).
───────────────────────────────────────────────────────────────── */

export default function PreMaintenanceBanner() {
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["pre_maintenance_warning", "pre_maintenance_message"]);

      if (error) {
        console.error("[PreMaintenanceBanner] load error:", error.message);
        return;
      }
      const map = new Map<string, string>(
        (data || []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? ""]),
      );
      const active = map.get("pre_maintenance_warning") === "true";
      const msg = map.get("pre_maintenance_message") || "";

      if (cancelled) return;
      if (!active || !msg) {
        setMessage(null);
        return;
      }
      setMessage(msg);
      try {
        const storedKey = localStorage.getItem("nx_premaint_dismissed_key");
        if (storedKey === msg) setDismissed(true);
      } catch { /* localStorage unavailable — ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!message || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem("nx_premaint_dismissed_key", message!); } catch { /* ignore */ }
  }

  return (
    <div className="w-full bg-[#F59E0B]/15 border-b border-[#F59E0B]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="flex-1 text-[12px] sm:text-[13px] font-semibold text-[#F59E0B] leading-snug">
          {message}
        </p>
        <button
          type="button"
          onClick={dismiss}
          title="Fermer"
          aria-label="Fermer"
          className="shrink-0 text-[#F59E0B]/80 hover:text-[#F59E0B] p-1 rounded transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
