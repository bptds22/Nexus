"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MediaPartner, PartnerStatus } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   /admin/partenaires — Phase 1 closed-beta admin panel
   - List all partners (status, homepage flag, created date)
   - Create new partner via /api/admin/partners/create
     (returns one-time temp password — copy and email manually)
   - Approve / Suspend / Revoke status changes
   - Toggle homepage display

   Gating: API route checks is_platform_admin = true on the
   requester. UI is implicitly gated — non-admins will see the
   list (RLS limits what they see) but mutations will 403.
═══════════════════════════════════════════════════════════════ */

const STATUS_COLORS: Record<PartnerStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-[#F59E0B]/15", text: "text-[#F59E0B]", label: "En attente" },
  APPROVED: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Approuvé" },
  SUSPENDED: { bg: "bg-[#6B7280]/15", text: "text-[#9CA3AF]", label: "Suspendu" },
  REVOKED: { bg: "bg-[#EF4444]/15", text: "text-[#EF4444]", label: "Révoqué" },
};

/* Activation state — derived from media_partners columns, not stored.
   Partners are created APPROVED with a temp password; this tracks
   whether they've actually onboarded. Priority order matters. */
type ActivationState = "pending" | "terms" | "active";
function getActivationState(p: MediaPartner): ActivationState {
  if (!p.password_reset_completed_at) return "pending";
  if (!p.terms_accepted_at) return "terms";
  return "active";
}
const ACTIVATION_META: Record<ActivationState, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-[#F59E0B]/15", text: "text-[#F59E0B]", label: "En attente d'activation" },
  terms:   { bg: "bg-[#FB923C]/15", text: "text-[#FB923C]", label: "Conditions non acceptées" },
  active:  { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Actif" },
};

const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";

export default function AdminPartenairesPage() {
  const [partners, setPartners] = useState<MediaPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [activationFilter, setActivationFilter] = useState<"all" | "inactive">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const showToast = (kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Create form state
  const [form, setForm] = useState({
    email: "",
    organization_name: "",
    contact_name: "",
    logo_url: "",
    instagram_handle: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("media_partners")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/partenaires] load:", error);
      showToast("error", "Impossible de charger la liste");
    } else {
      setPartners((data || []) as MediaPartner[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  async function handleCreate() {
    if (!form.email || !form.organization_name || !form.contact_name) {
      showToast("error", "Email, nom de l'organisation et personne-contact sont requis");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/partners/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast("error", json.error || `Erreur ${res.status}`);
        setSubmitting(false);
        return;
      }
      setTempPassword({ email: json.email, password: json.temp_password });
      setForm({ email: "", organization_name: "", contact_name: "", logo_url: "", instagram_handle: "", description: "" });
      setShowCreate(false);
      await loadPartners();
    } catch (e) {
      console.error("[admin/partenaires] create:", e);
      showToast("error", "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(partnerId: string, status: PartnerStatus) {
    const supabase = createClient();
    const updates: Record<string, unknown> = { status };
    if (status === "APPROVED") {
      updates.approved_at = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) updates.approved_by = user.id;
    }
    const { data, error } = await supabase.from("media_partners").update(updates).eq("id", partnerId).select();
    if (error) {
      console.error("[admin/partenaires] status update:", error);
      showToast("error", `Erreur : ${error.message}`);
      return;
    }
    // 0 rows + no error = RLS silently filtered the update. Without
    // .select() this returns {data:null,error:null} and looks like success.
    if (!data || data.length === 0) {
      showToast("error", "Action refusée — vérifie tes permissions.");
      return;
    }
    showToast("success", `Statut mis à jour : ${STATUS_COLORS[status].label}`);
    await loadPartners();
  }

  async function toggleHomepage(partnerId: string, current: boolean) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("media_partners")
      .update({ show_on_homepage: !current })
      .eq("id", partnerId)
      .select();
    if (error) {
      console.error("[admin/partenaires] homepage toggle:", error);
      showToast("error", `Erreur : ${error.message}`);
      return;
    }
    // 0 rows + no error = RLS silently filtered the update. Without
    // .select() this returns {data:null,error:null} and looks like success.
    if (!data || data.length === 0) {
      showToast("error", "Action refusée — vérifie tes permissions.");
      return;
    }
    showToast("success", !current ? "Affiché en page d'accueil" : "Retiré de la page d'accueil");
    await loadPartners();
  }

  const filteredPartners = activationFilter === "all"
    ? partners
    : partners.filter((p) => getActivationState(p) !== "active");

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Partenaires médias</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">Gestion des partenaires en bêta fermée</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors uppercase tracking-wider"
        >
          + Créer un partenaire
        </button>
      </div>

      {/* Temp password reveal banner — one-time */}
      {tempPassword && (
        <div className="bg-[#22C55E]/10 border-2 border-[#22C55E]/40 rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold text-[#22C55E]">Compte créé — mot de passe temporaire</p>
              <p className="text-[12px] text-[#9CA3AF] mt-1">Copie ces informations maintenant — elles ne seront pas affichées à nouveau. Envoie-les manuellement par courriel.</p>
            </div>
            <button type="button" onClick={() => setTempPassword(null)} className="text-[#9CA3AF] hover:text-white text-[18px] leading-none">×</button>
          </div>
          <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-3 font-mono text-[13px] space-y-1">
            <p><span className="text-[#6B7280]">Courriel :</span> <span className="text-white">{tempPassword.email}</span></p>
            <p><span className="text-[#6B7280]">Mot de passe :</span> <span className="text-white select-all">{tempPassword.password}</span></p>
          </div>
        </div>
      )}

      {/* Partner list */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2D3748] flex items-center justify-between">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Liste des partenaires ({filteredPartners.length})</h2>
          <div className="flex items-center bg-[#13151a] border border-[#2a2d36] rounded-lg overflow-hidden">
            <button type="button" onClick={() => setActivationFilter("all")}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${activationFilter === "all" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}>
              Tous
            </button>
            <button type="button" onClick={() => setActivationFilter("inactive")}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${activationFilter === "inactive" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}>
              Non activés
            </button>
          </div>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-[13px] text-[#6B7280]">Chargement…</p>
        ) : filteredPartners.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-[#6B7280] text-center">
            {activationFilter === "inactive"
              ? "Tous les partenaires sont activés."
              : "Aucun partenaire pour l'instant. Crée le premier ci-dessus."}
          </p>
        ) : (
          <div className="divide-y divide-[#2D3748]/40">
            {filteredPartners.map((p) => {
              const cfg = STATUS_COLORS[p.status];
              const act = ACTIVATION_META[getActivationState(p)];
              return (
                <div key={p.id} className="px-5 py-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[15px] font-bold text-white">{p.organization_name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${act.bg} ${act.text}`}>
                        {act.label}
                      </span>
                      {p.show_on_homepage && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#3B82F6]/15 text-[#3B82F6]">
                          Page d&apos;accueil
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                      {p.contact_name} · {p.contact_email}
                      {p.instagram_handle && <span> · @{p.instagram_handle}</span>}
                    </p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">
                      Créé le {new Date(p.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleHomepage(p.id, p.show_on_homepage)}
                      className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#3B82F6]/30 text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                    >
                      {p.show_on_homepage ? "Retirer du site" : "Afficher au site"}
                    </button>
                    {p.status !== "APPROVED" && (
                      <button
                        type="button"
                        onClick={() => changeStatus(p.id, "APPROVED")}
                        className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg transition-colors"
                      >
                        Approuver
                      </button>
                    )}
                    {p.status === "APPROVED" && (
                      <button
                        type="button"
                        onClick={() => changeStatus(p.id, "SUSPENDED")}
                        className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10 rounded-lg transition-colors"
                      >
                        Suspendre
                      </button>
                    )}
                    {p.status !== "REVOKED" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Révoquer ${p.organization_name} ? Cette action coupe l'accès du partenaire.`)) {
                            changeStatus(p.id, "REVOKED");
                          }
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#EF4444]/40 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors"
                      >
                        Révoquer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setShowCreate(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">Créer un partenaire</h3>
            <p className="text-[13px] text-[#9CA3AF] mb-5">
              Le partenaire est créé avec le statut <span className="font-bold text-[#22C55E]">APPROUVÉ</span>. Un mot de passe temporaire est généré et affiché une seule fois — copie-le et envoie-le manuellement.
            </p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Courriel <span className="text-[#EF4444]">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contact@partenaire.ca"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nom de l&apos;organisation <span className="text-[#EF4444]">*</span></label>
                <input
                  type="text"
                  value={form.organization_name}
                  onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                  placeholder="Ex: Sport Québec Média"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Personne-contact <span className="text-[#EF4444]">*</span></label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  placeholder="Prénom Nom"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Logo URL</label>
                <input
                  type="url"
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://…"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Instagram</label>
                <input
                  type="text"
                  value={form.instagram_handle}
                  onChange={(e) => setForm({ ...form, instagram_handle: e.target.value.replace(/^@/, "") })}
                  placeholder="nomdupartenaire (sans @)"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Quelques mots sur le partenaire…"
                  className={`${inputCls} h-auto resize-none`}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#2D3748]/40">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={submitting}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? "Création…" : "Créer le compte"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className={`bg-[#1A1D24] border rounded-lg px-5 py-3 shadow-lg flex items-center gap-3 ${toast.kind === "success" ? "border-[#22C55E]/30" : "border-[#EF4444]/30"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={toast.kind === "success" ? "#22C55E" : "#EF4444"} strokeWidth="2.5" strokeLinecap="round">
              {toast.kind === "success" ? <path d="M20 6L9 17l-5-5" /> : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>}
            </svg>
            <span className="text-[13px] font-bold text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
