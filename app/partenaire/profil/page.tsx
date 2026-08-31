"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload/uploadImage";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/profil — partner self-edit form.

   Partners edit their own public promo page content: logo,
   organization_name, description, about_text, website_url and the
   6 social fields. status + show_on_homepage are NOT editable here
   — they are pinned by the "Partners update own profile" RLS policy
   (admin-controlled). status is shown read-only for context.

   Le logo va dans le bucket partner-logos, sous {media_partners.id}/ —
   PAS sous {auth.uid()}, et PAS dans avatars. Deux raisons, toutes
   deux bloquantes : la policy « partner logos insert » attend l'id de
   la LIGNE en premier segment de chemin, et la contrainte
   media_partners_logo_url_interne rejette toute URL qui ne contient
   pas /partner-logos/. L'ancien chemin avatars/{auth.uid()} echouait
   donc deux fois. All writes use .select() so an RLS-filtered 0-row
   update surfaces as a real error, not a false success toast.
═══════════════════════════════════════════════════════════════ */

type PartnerStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "REVOKED";

type PartnerRow = {
  id: string;
  organization_name: string | null;
  contact_email: string | null;
  logo_url: string | null;
  description: string | null;
  about_text: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  facebook_url: string | null;
  x_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  status: PartnerStatus;
};

type FormState = {
  organization_name: string;
  description: string;
  about_text: string;
  website_url: string;
  instagram_handle: string;
  tiktok_handle: string;
  facebook_url: string;
  x_url: string;
  youtube_url: string;
  linkedin_url: string;
};

const EMPTY_FORM: FormState = {
  organization_name: "",
  description: "",
  about_text: "",
  website_url: "",
  instagram_handle: "",
  tiktok_handle: "",
  facebook_url: "",
  x_url: "",
  youtube_url: "",
  linkedin_url: "",
};

const STATUS_BADGE: Record<PartnerStatus, { className: string; label: string }> = {
  APPROVED: { className: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30", label: "Approuvé" },
  PENDING: { className: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30", label: "En attente" },
  SUSPENDED: { className: "bg-[#6B7280]/15 text-[#9CA3AF] border-[#6B7280]/30", label: "Suspendu" },
  REVOKED: { className: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30", label: "Révoqué" },
};

const inputCls =
  "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "block text-[12px] font-bold tracking-[0.18em] uppercase text-[#6B7280] mb-1.5";
const hintCls = "text-[12px] text-[#6B7280] mt-1";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  );
}

export default function PartnerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<PartnerRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("media_partners")
        .select(
          "id, organization_name, contact_email, logo_url, description, about_text, website_url, instagram_handle, tiktok_handle, facebook_url, x_url, youtube_url, linkedin_url, status",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const p = data as PartnerRow;
        setPartner(p);
        setLogoUrl(p.logo_url);
        setForm({
          organization_name: p.organization_name ?? "",
          description: p.description ?? "",
          about_text: p.about_text ?? "",
          website_url: p.website_url ?? "",
          instagram_handle: p.instagram_handle ?? "",
          tiktok_handle: p.tiktok_handle ?? "",
          facebook_url: p.facebook_url ?? "",
          x_url: p.x_url ?? "",
          youtube_url: p.youtube_url ?? "",
          linkedin_url: p.linkedin_url ?? "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", "Session expirée. Reconnecte-toi.");
        return;
      }
      if (!partner) {
        showToast("error", "Profil introuvable — recharge la page.");
        return;
      }
      /* pathBase SANS extension : uploadImage pose .png lui-meme.
         Chemin stable (pas d'horodatage) + upsert : un nouveau logo
         remplace l'ancien au lieu d'empiler des orphelins dans le
         bucket. */
      const res = await uploadImage(file, {
        bucket: "partner-logos",
        pathBase: `${partner.id}/logo`,
        preserveTransparency: true,
        maxDimension: 512,
        maxBytes: 500_000,
      });
      if (!res.ok) {
        showToast("error", `Erreur logo : ${res.message}`);
        return;
      }
      const publicUrl = res.publicUrl;
      const { data, error } = await supabase
        .from("media_partners")
        .update({ logo_url: publicUrl })
        .eq("user_id", user.id)
        .select();
      if (error) {
        console.error("[partner logo save]", error);
        showToast("error", `Erreur : ${error.message}`);
        return;
      }
      // 0 rows + no error = RLS silently filtered the update.
      if (!data || data.length === 0) {
        showToast("error", "Action refusée — vérifie tes permissions.");
        return;
      }
      setLogoUrl(publicUrl);
      showToast("success", "Logo mis à jour !");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSave() {
    if (!form.organization_name.trim()) {
      showToast("error", "Le nom de l'organisation est requis.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", "Session expirée. Reconnecte-toi.");
        return;
      }
      const norm = (s: string) => {
        const t = s.trim();
        return t === "" ? null : t;
      };
      const { data, error } = await supabase
        .from("media_partners")
        .update({
          organization_name: form.organization_name.trim(),
          description: norm(form.description),
          about_text: norm(form.about_text),
          website_url: norm(form.website_url),
          instagram_handle: norm(form.instagram_handle),
          tiktok_handle: norm(form.tiktok_handle),
          facebook_url: norm(form.facebook_url),
          x_url: norm(form.x_url),
          youtube_url: norm(form.youtube_url),
          linkedin_url: norm(form.linkedin_url),
        })
        .eq("user_id", user.id)
        .select();
      if (error) {
        console.error("[partner profile save]", error);
        showToast("error", `Erreur : ${error.message}`);
        return;
      }
      // 0 rows + no error = RLS silently filtered the update.
      if (!data || data.length === 0) {
        showToast("error", "Action refusée — vérifie tes permissions.");
        return;
      }
      showToast("success", "Profil mis à jour !");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[800px] mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[800px] mx-auto">
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Mon profil partenaire
        </h1>
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 mt-6">
          <p className="text-[14px] text-[#EF4444]">
            Profil introuvable. Contactez l&apos;équipe Nexus.
          </p>
        </div>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[partner.status];

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[800px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Mon profil partenaire
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Ces informations alimentent ta page publique sur Nexus.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
          {partner.status === "APPROVED" ? (
            <Link
              href={`/partenaires/${partner.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#E63946] hover:text-[#D93C3C] transition-colors"
            >
              Voir ma page publique
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </Link>
          ) : (
            <span className="text-[12px] text-[#6B7280] italic">
              Ta page publique sera accessible une fois ton compte approuvé.
            </span>
          )}
        </div>
        {partner.contact_email && (
          <p className="text-[12px] text-[#6B7280] mt-2">
            Compte : {partner.contact_email}
          </p>
        )}
      </div>

      {/* Section — Logo */}
      <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6">
        <h2 className="font-head text-[18px] font-bold text-white tracking-tight mb-4">Logo</h2>
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 rounded-xl bg-[#13151a] border border-[#2a2d36] flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
            ) : (
              <span className="text-[11px] text-[#4a4d56] text-center px-2">Aucun logo</span>
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label="Téléverser un logo"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingLogo}
              className="h-10 px-5 rounded-lg bg-[#13151a] border border-[#2a2d36] text-[13px] font-bold text-white hover:border-[#E63946] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingLogo ? "Téléversement…" : "Téléverser un logo"}
            </button>
            <p className={hintCls}>PNG ou JPG. Format carré recommandé.</p>
          </div>
        </div>
      </section>

      {/* Section — Identité & présentation */}
      <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-5">
        <h2 className="font-head text-[18px] font-bold text-white tracking-tight">
          Identité &amp; présentation
        </h2>
        <Field label="Nom de l'organisation">
          <input
            type="text"
            className={inputCls}
            value={form.organization_name}
            onChange={set("organization_name")}
            placeholder="Nom de ton organisation"
          />
        </Field>
        <Field label="Description courte" hint="Une phrase sur ce que fait ton organisation.">
          <input
            type="text"
            className={inputCls}
            value={form.description}
            onChange={set("description")}
            placeholder="Ex : Média sportif dédié au sport étudiant québécois"
          />
        </Field>
        <Field label="À propos" hint="Texte libre — présente ton organisation plus en détail.">
          <textarea
            rows={5}
            className={`${inputCls} resize-y`}
            value={form.about_text}
            onChange={set("about_text")}
            placeholder="Parle de ta mission, ton histoire, ce que tu offres…"
          />
        </Field>
        <Field label="Site web" hint="Lien complet (https://…).">
          <input
            type="url"
            className={inputCls}
            value={form.website_url}
            onChange={set("website_url")}
            placeholder="https://"
          />
        </Field>
      </section>

      {/* Section — Réseaux sociaux */}
      <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-5">
        <h2 className="font-head text-[18px] font-bold text-white tracking-tight">Réseaux sociaux</h2>
        <p className="text-[13px] text-[#9CA3AF] -mt-2">
          Chaque réseau renseigné devient une icône cliquable sur ta page publique.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Instagram" hint="Ton identifiant, sans @ (ex : nexus.sport)">
            <input type="text" className={inputCls} value={form.instagram_handle} onChange={set("instagram_handle")} placeholder="nexus.sport" />
          </Field>
          <Field label="TikTok" hint="Ton identifiant, sans @ (ex : nexus.sport)">
            <input type="text" className={inputCls} value={form.tiktok_handle} onChange={set("tiktok_handle")} placeholder="nexus.sport" />
          </Field>
          <Field label="Facebook" hint="Lien complet (https://facebook.com/…)">
            <input type="url" className={inputCls} value={form.facebook_url} onChange={set("facebook_url")} placeholder="https://facebook.com/" />
          </Field>
          <Field label="X (Twitter)" hint="Lien complet (https://x.com/…)">
            <input type="url" className={inputCls} value={form.x_url} onChange={set("x_url")} placeholder="https://x.com/" />
          </Field>
          <Field label="YouTube" hint="Lien complet (https://youtube.com/…)">
            <input type="url" className={inputCls} value={form.youtube_url} onChange={set("youtube_url")} placeholder="https://youtube.com/" />
          </Field>
          <Field label="LinkedIn" hint="Lien complet (https://linkedin.com/…)">
            <input type="url" className={inputCls} value={form.linkedin_url} onChange={set("linkedin_url")} placeholder="https://linkedin.com/" />
          </Field>
        </div>
      </section>

      {/* Save bar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-8 rounded-lg bg-[#E63946] text-[14px] font-bold text-white hover:bg-[#D42B22] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg text-[14px] font-bold shadow-lg border ${
            toast.kind === "success"
              ? "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30"
              : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
