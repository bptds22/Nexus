"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NexusLogo from "@/components/ui/NexusLogo";

/* Portail parent gardé (Lot 1a) — rôle PARENT requis, sinon redirect /auth.
   /parent/claim est HORS de ce groupe (pas de garde : le parent n'est pas
   encore PARENT au moment du claim). Le mobile est exclu par app/parent/layout.tsx. */
export default function ParentPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok">("checking");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (!cancelled) router.replace("/auth"); return; }
      // Rôle depuis la DB (source de vérité ; la metadata JWT peut être en retard).
      const { data: profile } = await supabase.from("users").select("role").eq("id", session.user.id).single();
      if (cancelled) return;
      if (profile?.role === "PARENT") setStatus("ok");
      else { router.replace("/auth"); return; }
      // Compteur non-lu (RLS restreint aux lignes du parent).
      const { count } = await supabase
        .from("parent_notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      if (!cancelled) setUnread(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (status !== "ok") {
    return (
      <div className="min-h-screen bg-[#111317] flex items-center justify-center">
        <p className="text-sm text-[#6B7280]">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111317] text-white">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link href="/parent"><NexusLogo variant="white" height={28} /></Link>
        <div className="flex items-center gap-5">
          <Link href="/parent/notifications" aria-label="Notifications" className="relative text-[#9CA3AF] hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E63946] text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">Espace parent</span>
        </div>
      </header>
      <main className="max-w-[720px] mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
