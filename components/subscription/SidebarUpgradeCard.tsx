"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   SidebarUpgradeCard — Subtle "Passe à Pro" card for portal sidebars
   Only visible for free-tier users. Dismissible per session.
═══════════════════════════════════════════════════════════════ */

export default function SidebarUpgradeCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem("nexus_sidebar_upgrade_dismissed");
      if (dismissed) return;
      const raw = localStorage.getItem("nexus_user");
      if (raw) {
        const user = JSON.parse(raw);
        const tier = user.subscription?.tier || user.tier || "free";
        if (tier === "free") setVisible(true);
      } else {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="mx-3 mb-2">
      <Link
        href="/tarifs"
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#DAB65A]/5 hover:bg-[#DAB65A]/10 transition-colors group"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span className="text-[11px] font-bold text-[#DAB65A] group-hover:text-[#e8c84e] transition-colors">Passe à Pro</span>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVisible(false); sessionStorage.setItem("nexus_sidebar_upgrade_dismissed", "true"); }}
          className="ml-auto shrink-0 text-[#DAB65A]/40 hover:text-[#DAB65A] transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </Link>
    </div>
  );
}
