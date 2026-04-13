"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type KPI = {
  label: string;
  value: number | null;
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([
    { label: "Athlètes totaux", value: null },
    { label: "Entraîneurs", value: null },
    { label: "Recruteurs", value: null },
    { label: "Écoles", value: null },
    { label: "Profils vérifiés", value: null },
    { label: "Inscriptions cette semaine", value: null },
  ]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      const [athletes, coaches, recruiters, schools, verified, newUsers] = await Promise.all([
        supabase.from("athletes").select("*", { count: "exact", head: true }),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "COACH"),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "RECRUTEUR"),
        supabase.from("schools").select("*", { count: "exact", head: true }),
        supabase.from("athletes").select("*", { count: "exact", head: true }).eq("verified", true),
        supabase.from("users").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
      ]);

      setKpis([
        { label: "Athlètes totaux", value: athletes.count ?? 0 },
        { label: "Entraîneurs", value: coaches.count ?? 0 },
        { label: "Recruteurs", value: recruiters.count ?? 0 },
        { label: "Écoles", value: schools.count ?? 0 },
        { label: "Profils vérifiés", value: verified.count ?? 0 },
        { label: "Inscriptions cette semaine", value: newUsers.count ?? 0 },
      ]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">Vue d&apos;ensemble de la plateforme Nexus</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5"
          >
            <p className="font-head text-4xl font-black text-white leading-none">
              {loading ? (
                <span className="text-[#4a4d56]">—</span>
              ) : (
                k.value?.toLocaleString("fr-CA") ?? "0"
              )}
            </p>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-3">
              {k.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
