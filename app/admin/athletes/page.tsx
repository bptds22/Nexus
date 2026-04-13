"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AdminTable, { AdminColumn } from "../_components/AdminTable";

interface AthleteRow {
  id: string;
  first_name: string;
  last_name: string;
  sport_id: string | null;
  school_id: string | null;
  coach_id: string | null;
  annee_diplomation: number | null;
  verified: boolean;
  cote_globale_entraineur: number | null;
  statut_recrutement_override: string | null;
  created_at: string;
  // computed
  sport_name?: string | null;
  school_name?: string | null;
  coach_name?: string | null;
  created_at_fmt?: string;
}

interface Sport {
  id: string;
  nom: string;
}

interface School {
  id: string;
  name: string;
}

const RECRUITMENT_OPTIONS = [
  { value: "", label: "—" },
  { value: "IDENTIFIE", label: "Identifié" },
  { value: "CONTACTE", label: "Contacté" },
  { value: "EN_DISCUSSION", label: "En discussion" },
  { value: "VISITE_PLANIFIEE", label: "Visite planifiée" },
  { value: "ENGAGE", label: "Engagé" },
  { value: "LETTRE_SIGNEE", label: "Lettre signée" },
];

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminAthletesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<AthleteRow[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "yes" | "no">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [aRes, spRes, schRes] = await Promise.all([
        supabase
          .from("athletes")
          .select(
            "id,first_name,last_name,sport_id,school_id,coach_id,annee_diplomation,verified,cote_globale_entraineur,statut_recrutement_override,created_at, sports:sport_id(nom), schools:school_id(name), coach:coach_id(first_name,last_name)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("sports").select("id,nom").order("nom"),
        supabase.from("schools").select("id,name").order("name"),
      ]);

      const mapped: AthleteRow[] = (aRes.data || []).map((a: Record<string, unknown>) => {
        const coach = a.coach as { first_name?: string; last_name?: string } | null;
        const sportRel = a.sports as { nom?: string } | null;
        const schoolRel = a.schools as { name?: string } | null;
        return {
          id: a.id as string,
          first_name: (a.first_name as string) ?? "",
          last_name: (a.last_name as string) ?? "",
          sport_id: (a.sport_id as string) ?? null,
          school_id: (a.school_id as string) ?? null,
          coach_id: (a.coach_id as string) ?? null,
          annee_diplomation: (a.annee_diplomation as number) ?? null,
          verified: (a.verified as boolean) ?? false,
          cote_globale_entraineur: (a.cote_globale_entraineur as number) ?? null,
          statut_recrutement_override: (a.statut_recrutement_override as string) ?? null,
          created_at: a.created_at as string,
          sport_name: sportRel?.nom ?? null,
          school_name: schoolRel?.name ?? null,
          coach_name: coach ? `${coach.first_name ?? ""} ${coach.last_name ?? ""}`.trim() : null,
          created_at_fmt: formatDate(a.created_at as string),
        };
      });

      setRows(mapped);
      setSports((spRes.data as Sport[]) || []);
      setSchools((schRes.data as School[]) || []);
      setLoading(false);
    })();
  }, [supabase]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (sportFilter !== "all" && r.sport_id !== sportFilter) return false;
      if (schoolFilter !== "all" && r.school_id !== schoolFilter) return false;
      if (verifiedFilter === "yes" && !r.verified) return false;
      if (verifiedFilter === "no" && r.verified) return false;
      return true;
    });
  }, [rows, sportFilter, schoolFilter, verifiedFilter]);

  const sportOptions = useMemo(
    () => [{ value: "", label: "—" }, ...sports.map((s) => ({ value: s.id, label: s.nom }))],
    [sports],
  );

  const columns: AdminColumn<AthleteRow>[] = [
    {
      key: "first_name",
      label: "Prénom",
      type: "text",
      render: (r) => (
        <Link
          href={`/admin/athletes/${r.id}`}
          className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {r.first_name}
        </Link>
      ),
    },
    {
      key: "last_name",
      label: "Nom",
      type: "text",
      render: (r) => (
        <Link
          href={`/admin/athletes/${r.id}`}
          className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {r.last_name}
        </Link>
      ),
    },
    {
      key: "sport_id",
      label: "Sport",
      type: "select",
      options: sportOptions,
      render: (r) =>
        r.sport_name ? (
          <span className="text-[13px] text-[#9CA3AF]">{r.sport_name}</span>
        ) : (
          <span className="text-[#4a4d56]">—</span>
        ),
    },
    {
      key: "school_name",
      label: "École",
      readonly: true,
      render: (r) =>
        r.school_name ? (
          <span className="text-[13px] text-[#9CA3AF]">{r.school_name}</span>
        ) : (
          <span className="text-[#4a4d56]">—</span>
        ),
    },
    { key: "annee_diplomation", label: "Promotion", type: "number", align: "center" },
    { key: "verified", label: "Vérifié", type: "boolean", align: "center" },
    {
      key: "coach_name",
      label: "Coach",
      readonly: true,
      render: (r) =>
        r.coach_name ? (
          <span className="text-[13px] text-[#9CA3AF]">{r.coach_name}</span>
        ) : (
          <span className="text-[#4a4d56]">—</span>
        ),
    },
    { key: "cote_globale_entraineur", label: "Cote globale", type: "number", align: "center" },
    {
      key: "statut_recrutement_override",
      label: "Statut recrutement",
      type: "select",
      options: RECRUITMENT_OPTIONS,
      render: (r) => {
        if (!r.statut_recrutement_override) return <span className="text-[#4a4d56]">—</span>;
        const opt = RECRUITMENT_OPTIONS.find((o) => o.value === r.statut_recrutement_override);
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] text-[11px] font-bold">
            {opt?.label ?? r.statut_recrutement_override}
          </span>
        );
      },
    },
    { key: "created_at_fmt", label: "Créé le", type: "readonly" },
  ];

  const selectBase =
    "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Gestion des athlètes
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">{rows.length} profils au total</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          title="Sport"
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className={selectBase}
        >
          <option value="all">Tous les sports</option>
          {sports.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom}
            </option>
          ))}
        </select>
        <select
          title="École"
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className={selectBase}
        >
          <option value="all">Toutes les écoles</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          title="Vérifié"
          value={verifiedFilter}
          onChange={(e) => setVerifiedFilter(e.target.value as "all" | "yes" | "no")}
          className={selectBase}
        >
          <option value="all">Tous</option>
          <option value="yes">Vérifiés</option>
          <option value="no">Non vérifiés</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-[#6b7280]">Aucun athlète</div>
      ) : (
        <AdminTable<AthleteRow>
          rows={filteredRows}
          columns={columns}
          table="athletes"
          searchFields={["first_name", "last_name"]}
          searchPlaceholder="Rechercher un athlète..."
          onSaved={(id, patch) => {
            setRows((prev) =>
              prev.map((r) => {
                if (r.id !== id) return r;
                const updated = { ...r, ...patch };
                if (patch.sport_id !== undefined) {
                  updated.sport_name = sports.find((s) => s.id === patch.sport_id)?.nom ?? null;
                }
                return updated;
              }),
            );
          }}
        />
      )}
    </div>
  );
}
