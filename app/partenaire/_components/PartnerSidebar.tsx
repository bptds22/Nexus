"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import { createClient } from "@/lib/supabase/client";
import type { MediaPartner, PartnerStatus } from "@/lib/types/models";

const NAV_ITEMS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Tableau de bord",
    href: "/partenaire",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  },
  {
    label: "Newsroom",
    href: "/partenaire/newsroom",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8z" /></svg>,
  },
  {
    label: "Athlètes",
    href: "/partenaire/athletes",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></svg>,
  },
  {
    label: "Téléchargements",
    href: "/partenaire/telechargements",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  },
  {
    label: "Mon profil",
    href: "/partenaire/profil",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  },
];

const STATUS_PILL: Record<PartnerStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-[#F59E0B]/15", text: "text-[#F59E0B]", label: "En attente" },
  APPROVED: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Approuvé" },
  SUSPENDED: { bg: "bg-[#6B7280]/15", text: "text-[#9CA3AF]", label: "Suspendu" },
  REVOKED: { bg: "bg-[#EF4444]/15", text: "text-[#EF4444]", label: "Révoqué" },
};

export default function PartnerSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [partner, setPartner] = useState<MediaPartner | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("media_partners")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPartner(data as MediaPartner);
    })();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const navContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6 border-b border-[#1e2128]">
        <NexusLogo variant="white" height={34} href="/partenaire" priority />
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mt-2">Espace partenaire</p>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/partenaire" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-[13px] font-bold uppercase tracking-[0.12em] transition-all ${
                isActive ? "bg-[#E63946]/12 text-[#E63946]" : "text-[#8a8d96] hover:text-white hover:bg-white/5"
              }`}
            >
              <span className={isActive ? "text-[#E63946]" : "text-[#6b7280]"}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-5 border-t border-[#1e2128]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2F3440] border border-[#2D3748] flex items-center justify-center overflow-hidden shrink-0">
            {partner?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partner.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[12px] font-bold text-white/30">
                {(partner?.organization_name || "?").slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate">{partner?.organization_name || "—"}</p>
            {partner && (
              <span className={`inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${STATUS_PILL[partner.status].bg} ${STATUS_PILL[partner.status].text}`}>
                {STATUS_PILL[partner.status].label}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={handleLogout} className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] hover:text-[#E63946] transition-colors">
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-[260px] bg-[#111317]/80 backdrop-blur-sm border-r border-[#1e2128] shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 z-50 w-[260px] bg-[#111317]/80 backdrop-blur-sm border-r border-[#1e2128] lg:hidden">
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}
