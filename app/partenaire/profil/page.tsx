"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MediaPartner } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   Mon profil — partner-side editor for organization fields.
   Status, approved_at, approved_by, homepage flag remain
   admin-only (RLS on UPDATE will reject those if attempted).
═══════════════════════════════════════════════════════════════ */

const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";

export default function PartnerProfilePage() {
  const [partner, setPartner] = useState<MediaPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const showToast = (kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3000);
  };

  const [form, setForm] = useState({
    organization_name: "",
    contact_name: "",
    logo_url: "",
    website_url: "",
    instagram_handle: "",
    facebook_url: "",
    tiktok_handle: "",
    description: "",
  });

  const loadPartner = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("media_partners").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      const p = data as MediaPartner;
      setPartner(p);
      setForm({
        organization_name: p.organization_name ?? "",
        contact_name: p.contact_name ?? "",
        logo_url: p.logo_url ?? "",
        website_url: p.website_url ?? "",
        instagram_handle: p.instagram_handle ?? "",
        facebook_url: p.facebook_url ?? "",
        tiktok_handle: p.tiktok_handle ?? "",
        description: p.description ?? "",
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPartner(); }, [loadPartner]);

  async function handleSave() {
    if (!partner) return;
    if (!form.organization_name.trim() || !form.contact_name.trim()) {
      showToast("error", "Nom de l'organisation et personne-contact sont requis");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const updates = {
      organization_name: form.organization_name.trim(),
      contact_name: form.contact_name.trim(),
      logo_url: form.logo_url.trim() || null,
      website_url: form.website_url.trim() || null,
      instagram_handle: form.instagram_handle.trim().replace(/^@/, "") || null,
      facebook_url: form.facebook_url.trim() || null,
      tiktok_handle: form.tiktok_handle.trim().replace(/^@/, "") || null,
      description: form.description.trim() || null,
    };
    const { error } = await supabase.from("media_partners").update(updates).eq("id", partner.id);
    if (error) {
      console.error("[partenaire/profil] save:", error);
      showToast("error", `Erreur : ${error.message}`);
    } else {
      showToast("success", "Profil mis à jour");
      await loadPartner();
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="px-6 sm:px-10 py-8 max-w-[800px] mx-auto"><p className="text-[13px] text-[#6B7280]">Chargement…</p></div>;
  }

  if (!partner) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[800px] mx-auto">
        <p className="text-[13px] text-[#EF4444]">Aucun profil partenaire trouvé pour ce compte.</p>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[800px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Mon profil</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">{partner.contact_email} · Compte créé le {new Date(partner.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nom de l&apos;organisation <span className="text-[#EF4444]">*</span></label>
            <input type="text" value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Personne-contact <span className="text-[#EF4444]">*</span></label>
            <input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Logo URL</label>
          <input type="url" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…" className={inputCls} />
          {form.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo_url} alt="Aperçu" className="mt-2 h-12 rounded-md object-contain bg-[#13151a] border border-[#2a2d36] p-1" />
          )}
        </div>

        <div>
          <label className={labelCls}>Site web</label>
          <input type="url" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://…" className={inputCls} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Instagram</label>
            <input type="text" value={form.instagram_handle} onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })} placeholder="handle" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Facebook</label>
            <input type="url" value={form.facebook_url} onChange={(e) => setForm({ ...form, facebook_url: e.target.value })} placeholder="https://…" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>TikTok</label>
            <input type="text" value={form.tiktok_handle} onChange={(e) => setForm({ ...form, tiktok_handle: e.target.value })} placeholder="handle" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Quelques mots sur ton organisation…"
            className={`${inputCls} h-auto resize-none`}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2D3748]/40">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50 uppercase tracking-wider"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className={`bg-[#1A1D24] border rounded-lg px-5 py-3 shadow-lg flex items-center gap-3 ${toast.kind === "success" ? "border-[#22C55E]/30" : "border-[#EF4444]/30"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={toast.kind === "success" ? "#22C55E" : "#EF4444"} strokeWidth="2.5" strokeLinecap="round">
              {toast.kind === "success" ? <path d="M20 6L9 17l-5-5" /> : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /></>}
            </svg>
            <span className="text-[13px] font-bold text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
