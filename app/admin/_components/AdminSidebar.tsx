"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import NexusLogo from "@/components/ui/NexusLogo";
import { createClient } from "@/lib/supabase/client";
import { UserCheck, ShieldCheck } from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Tableau de bord", href: "/admin/dashboard",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  },
  {
    label: "Utilisateurs", href: "/admin/users",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  },
  {
    label: "Athlètes", href: "/admin/athletes",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>,
  },
  {
    label: "Entraîneurs", href: "/admin/entraineurs",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><path d="M9 12h6M9 16h4" /></svg>,
  },
  {
    label: "Recruteurs", href: "/admin/recruteurs",
    icon: <UserCheck size={18} strokeWidth={2} />,
  },
  {
    label: "Partenaires", href: "/admin/partenaires",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>,
  },
  {
    label: "Établissements", href: "/admin/schools",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22V12h6v10" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" /></svg>,
  },
  {
    label: "Sports", href: "/admin/sports",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2" /><path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" /><path d="M6 3h12v6a6 6 0 01-12 0V3z" /><path d="M12 15v3M8 21h8" /></svg>,
  },
  {
    label: "Analytique", href: "/admin/analytics",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
  },
  {
    label: "Pipeline", href: "/admin/pipeline",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 009 9" /></svg>,
  },
  {
    label: "Modération", href: "/admin/moderation",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  },
  {
    label: "Approbations", href: "/admin/approvals",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>,
  },
  {
    label: "Abonnements", href: "/admin/subscriptions",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><path d="M1 10h22" /></svg>,
  },
  {
    label: "Désactivations", href: "/admin/desactivations",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>,
  },
  {
    label: "Loi 25", href: "/admin/loi25",
    icon: <ShieldCheck size={18} strokeWidth={2} />,
  },
  {
    label: "Paramètres", href: "/admin/settings",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  },
];

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ mobileOpen, onClose }: Props) {
  const pathname = usePathname();
  const [pendingReports, setPendingReports] = useState<number>(0);
  const [newRecruiters, setNewRecruiters] = useState<number>(0);
  const [pendingClaims, setPendingClaims] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { count, error } = await supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "EN_ATTENTE");
      if (error) {
        console.error("[AdminSidebar] reports count error:", error.message);
      } else {
        if (!cancelled) setPendingReports(count ?? 0);
      }

      // New recruiters (last 7 days)
      const sevenAgo = new Date();
      sevenAgo.setDate(sevenAgo.getDate() - 7);
      const { count: recCount, error: recErr } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "RECRUTEUR")
        .gte("created_at", sevenAgo.toISOString());
      if (recErr) {
        console.error("[AdminSidebar] new recruiters count error:", recErr.message);
      } else {
        if (!cancelled) setNewRecruiters(recCount ?? 0);
      }

      // Item 11-Security: PENDING admin_claims awaiting review.
      const { count: claimCount, error: claimErr } = await supabase
        .from("admin_claims")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING");
      if (claimErr) {
        console.error("[AdminSidebar] pending claims count error:", claimErr.message);
      } else {
        if (!cancelled) setPendingClaims(claimCount ?? 0);
      }
    })();
    return () => { cancelled = true; };
    // Re-count on every navigation — was a mount-only snapshot that went
    // stale (e.g. approving a claim left a phantom badge until full reload).
  }, [pathname]);

  const badges: Record<string, number> = {
    "/admin/moderation": pendingReports,
    "/admin/recruteurs": newRecruiters,
    "/admin/approvals": pendingClaims,
  };

  const nav = (
    <div className="flex flex-col h-full">
      {/* Logo + label */}
      <div className="px-5 pt-6 pb-4 flex flex-col gap-1">
        <NexusLogo variant="white" height={26} href="/admin" priority />
        <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-white">Portail Admin</span>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-[#1e2128] mb-2" />

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-bold transition-colors relative ${
                active
                  ? "bg-[#E63946]/[0.12] text-[#E63946]"
                  : "text-[#6b7280] hover:text-white hover:bg-white/5"
              }`}
            >
              {/* Active left border */}
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#E63946]" />
              )}
              <span className="shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {badges[item.href] > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#E63946] text-white text-[11px] font-bold flex items-center justify-center">
                  {badges[item.href]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom user card */}
      <div className="mx-3 mb-4 mt-2 p-3 rounded-lg bg-white/[0.03] border border-[#1e2128] flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#E63946]/20 flex items-center justify-center shrink-0">
          <span className="text-[12px] font-bold text-[#E63946]">AD</span>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-white truncate">Admin Nexus</p>
          <p className="text-[10px] text-[#6b7280] uppercase tracking-wider">Administrateur</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] shrink-0 bg-[#1A1D24] border-r border-[#1e2128] sticky top-0 h-screen overflow-y-auto z-20">
        {nav}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-[#1A1D24] shadow-2xl">
            <div className="flex justify-end p-3">
              <button type="button" onClick={onClose} className="text-[#6b7280] hover:text-white p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
