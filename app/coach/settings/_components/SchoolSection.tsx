"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SchoolInfo } from "../_data/mockSettingsData";

/* ─────────────────────────────────────────────────────────────────
   SchoolSection — School & program info
───────────────────────────────────────────────────────────────── */

const label = "text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-1.5";
const inputClass = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const readOnlyClass = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] opacity-60 cursor-not-allowed";

export default function SchoolSection() {
  const [form, setForm] = useState<SchoolInfo>({
    name: "", city: "", region: "", division: "",
    ageGroup: "", conference: "", teamName: "", website: "",
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get user record for school_id and is_school_admin
      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("school_id, is_school_admin")
        .eq("id", user.id)
        .single();

      if (!userRow?.school_id) { setLoading(false); return; }

      setSchoolId(userRow.school_id);
      setIsAdmin(!!userRow.is_school_admin);

      // Get school data
      const { data: school, error: schoolErr } = await supabase
        .from("schools")
        .select("name, city, region, division, age_category, conference, team_name, website")
        .eq("id", userRow.school_id)
        .single();

      if (school) {
        setForm({
          name: school.name || "",
          city: school.city || "",
          region: school.region || "",
          division: school.division || "",
          ageGroup: school.age_category || "",
          conference: school.conference || "",
          teamName: school.team_name || "",
          website: school.website || "",
        });
      }
      setLoading(false);
    }
    loadData();
  }, []);

  function update(field: keyof SchoolInfo, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    if (!schoolId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: saveErr } = await supabase
      .from("schools")
      .update({
        name: form.name,
        city: form.city,
        region: form.region,
        conference: form.conference,
        division: form.division,
        age_category: form.ageGroup,
        team_name: form.teamName,
        website: form.website,
      })
      .eq("id", schoolId);

    if (saveErr) { setSaving(false); setError("Erreur lors de la sauvegarde."); return; }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">École & programme</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Informations sur ton école et ton programme sportif.</p>
      </div>

      <div className="space-y-5 max-w-2xl">
        {/* School info - read only for non-admins */}
        {!isAdmin && (
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">
                Géré par le directeur
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className={label}>Nom de l&apos;école</p>
                <input type="text" title="Nom de l'école" value={form.name} readOnly className={readOnlyClass} />
              </div>
              <div>
                <p className={label}>Ville</p>
                <input type="text" title="Ville" value={form.city} readOnly className={readOnlyClass} />
              </div>
              <div>
                <p className={label}>Région</p>
                <input type="text" title="Région" value={form.region} readOnly className={readOnlyClass} />
              </div>
              <div>
                <p className={label}>Conférence</p>
                <input type="text" title="Conférence" value={form.conference} readOnly className={readOnlyClass} />
              </div>
              <div>
                <p className={label}>Division</p>
                <input type="text" title="Division" value={form.division} readOnly className={readOnlyClass} />
              </div>
              <div>
                <p className={label}>Catégorie d&apos;âge</p>
                <input type="text" title="Catégorie d'âge" value={form.ageGroup} readOnly className={readOnlyClass} />
              </div>
              <div>
                <p className={label}>Nom de l&apos;équipe</p>
                <input type="text" title="Nom de l'équipe" value={form.teamName} readOnly className={readOnlyClass} />
              </div>
              <div>
                <p className={label}>Site web</p>
                <input type="url" title="Site web" value={form.website} readOnly className={readOnlyClass} />
              </div>
            </div>
          </div>
        )}

        {/* Editable fields for admin */}
        {isAdmin && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className={label}>Nom de l&apos;école</p>
                <input type="text" title="Nom de l'école" value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} />
              </div>
              <div>
                <p className={label}>Ville</p>
                <input type="text" title="Ville" value={form.city} onChange={(e) => update("city", e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className={label}>Région</p>
                <input type="text" title="Région" value={form.region} onChange={(e) => update("region", e.target.value)} className={inputClass} />
              </div>
              <div>
                <p className={label}>Conférence</p>
                <input type="text" title="Conférence" value={form.conference} onChange={(e) => update("conference", e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className={label}>Division</p>
                <input type="text" title="Division" value={form.division} onChange={(e) => update("division", e.target.value)} className={inputClass} />
              </div>
              <div>
                <p className={label}>Catégorie d&apos;âge</p>
                <input type="text" title="Catégorie d'âge" value={form.ageGroup} onChange={(e) => update("ageGroup", e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className={label}>Nom de l&apos;équipe</p>
                <input type="text" title="Nom de l'équipe" value={form.teamName} onChange={(e) => update("teamName", e.target.value)} className={inputClass} />
              </div>
              <div>
                <p className={label}>Site web</p>
                <input type="url" title="Site web" value={form.website} onChange={(e) => update("website", e.target.value)} className={inputClass} placeholder="https://..." />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
              {saved && (
                <span className="text-[14px] font-semibold text-[#22C55E] animate-pulse">
                  Modifications enregistrées
                </span>
              )}
              {error && (
                <span className="text-[14px] font-semibold text-[#EF4444]">
                  {error}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
