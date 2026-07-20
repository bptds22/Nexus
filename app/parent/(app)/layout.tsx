"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NexusLogo from "@/components/ui/NexusLogo";

/* Portail parent gardé (Lot 1a) — rôle PARENT requis, sinon redirect /auth.
   /parent/claim est HORS de ce groupe (pas de garde : le parent n'est pas
   encore PARENT au moment du claim). Le mobile est exclu par app/parent/layout.tsx. */
export default function ParentPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok">("checking");

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
      else router.replace("/auth");
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
        <NexusLogo variant="white" height={28} />
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">Espace parent</span>
      </header>
      <main className="max-w-[720px] mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
