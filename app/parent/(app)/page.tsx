"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* Home parent minimale (Lot 1a) — identité de l'enfant lié via le RPC
   colonne-restreint get_my_children() (Option B : PAS tout le profil).
   Navigation Consentements / Activité = placeholders inertes (Lots 1b/1c). */

interface Child {
  athlete_id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  sport: string | null;
  school: string | null;
}

export default function ParentHome() {
  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("get_my_children");
      if (cancelled) return;
      const rows = (data as Child[] | null) ?? [];
      setChild(rows[0] ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-sm text-[#6B7280]">Chargement…</p>;
  if (!child) return <p className="text-sm text-[#9CA3AF]">Aucun enfant associé à ce compte.</p>;

  const name = [child.first_name, child.last_name].filter(Boolean).join(" ") || "—";
  const meta = [child.sport, child.school].filter(Boolean).join(" · ");
  const initial = ((child.first_name || "?").trim().charAt(0) || "?").toUpperCase();

  return (
    <div className="space-y-6">
      <div className="bg-[#1A1D24] border border-white/5 rounded-xl p-5 flex items-center gap-4">
        {child.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={child.photo_url} alt="" className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#E63946] flex items-center justify-center text-xl font-bold text-white">{initial}</div>
        )}
        <div className="min-w-0">
          <h1 className="font-head text-xl font-bold text-white truncate">{name}</h1>
          {meta && <p className="text-[13px] text-[#6B7280] mt-0.5 truncate">{meta}</p>}
        </div>
      </div>

      <nav className="grid gap-3">
        <Link href="/parent/consentements" className="bg-[#1A1D24] border border-white/5 rounded-xl px-5 py-4 flex items-center justify-between gap-4 hover:border-[#E63946]/40 transition-colors group">
          <div className="min-w-0">
            <p className="font-semibold text-white">Consentements</p>
            <p className="text-[12px] text-[#6B7280] mt-0.5">Gérer les autorisations liées au profil de votre enfant</p>
          </div>
          <svg className="shrink-0 text-[#6B7280] group-hover:text-[#E63946] transition-colors" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
        <div aria-disabled className="bg-[#1A1D24] border border-white/5 rounded-xl px-5 py-4 opacity-60 cursor-not-allowed">
          <p className="font-semibold text-white">Activité</p>
          <p className="text-[12px] text-[#6B7280] mt-0.5">Vues du profil et activité recruteur — à venir (Lot 1c)</p>
        </div>
      </nav>
    </div>
  );
}
