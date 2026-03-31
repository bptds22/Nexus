"use client";

import { useState, useEffect } from "react";
import { mockRecruiterSettings } from "@/lib/mock/recruiterSettings";
import type { RecruiterSettings } from "@/lib/types/models";
import RecruiterSettingsNav, { type SectionKey } from "./_components/RecruiterSettingsNav";
import CompteSection from "./_components/CompteSection";
import EtablissementSection from "./_components/EtablissementSection";
import RecrutementSection from "./_components/RecrutementSection";
import NotificationsSection from "./_components/NotificationsSection";
import ConfidentialiteSection from "./_components/ConfidentialiteSection";
import DangerSection from "./_components/DangerSection";
import ConfirmModal from "./_components/ConfirmModal";
import SaveToast from "./_components/SaveToast";
import SubscriptionSection from "@/components/subscription/SubscriptionSection";
import AmbassadorDashboard from "@/components/ambassador/AmbassadorDashboard";
import CegepGate from "@/components/subscription/CegepGate";

/* ═══════════════════════════════════════════════════════════════
   Recruiter Settings — /recruteur/parametres
   Left nav (click-to-switch) + content panel, 6 sections.
═══════════════════════════════════════════════════════════════ */

/* ── Admin CÉGEP section ──────────────────────────────────── */

function AdminCegepSection() {
  const [sToast, setSToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setSToast(msg); setTimeout(() => setSToast(null), 3000); };

  return (
    <CegepGate>
      <div className="space-y-8">
        <div>
          <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Directeurs du CÉGEP</h2>
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2D3748]">
                  {["Nom", "Rôle", "Courriel", "Depuis", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#2D3748]/40 bg-[#111317]/40">
                  <td className="px-4 py-3 text-[13px] font-bold text-white flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#DAB65A" stroke="none"><path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" /><circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" /></svg>
                    François Simard
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DAB65A]/15 text-[#DAB65A]">Propriétaire</span></td>
                  <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">f.simard@cegep-garneau.qc.ca</td>
                  <td className="px-4 py-3 text-[12px] text-[#6b7280]">Jan. 2025</td>
                  <td className="px-4 py-3"></td>
                </tr>
                <tr className="border-b border-[#2D3748]/40">
                  <td className="px-4 py-3 text-[13px] text-white">Sylvie Côté</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6B7280]/15 text-[#6B7280]">Collaborateur</span></td>
                  <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">s.cote@cegep-garneau.qc.ca</td>
                  <td className="px-4 py-3 text-[12px] text-[#6b7280]">Oct. 2025</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => showToast("Directeur retiré (POC)")} className="text-[11px] text-[#E63946] hover:text-[#D42B22] transition-colors font-bold">Retirer</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-[#2D3748]/40 pt-6">
          <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Inviter un directeur sportif</h2>
          <div className="max-w-md space-y-4">
            <div>
              <label className="block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5">Courriel du directeur</label>
              <input type="email" placeholder="directeur@cegep.qc.ca" className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors" />
            </div>
            <button type="button" onClick={() => showToast("Invitation envoyée (POC)")} className="h-10 px-5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
              Envoyer l&apos;invitation
            </button>
            <p className="text-[11px] text-[#4a4d56]">Le directeur invité aura accès gratuit à toutes les fonctionnalités de gestion de CÉGEP.</p>
          </div>
        </div>

        <div className="border-t border-[#2D3748]/40 pt-6">
          <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">Transfert d&apos;administration</h2>
          <p className="text-[13px] text-[#9CA3AF] mb-4">Transfère le rôle de propriétaire à un autre directeur. Cette demande sera traitée par l&apos;administration Nexus.</p>
          <button type="button" onClick={() => showToast("Demande de transfert envoyée (POC)")} className="h-10 px-5 rounded-lg border border-[#E63946]/30 text-[#E63946] font-bold text-[12px] uppercase tracking-wider hover:bg-[#E63946]/5 transition-colors">
            Demander un transfert
          </button>
        </div>

        {sToast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
            {sToast}
          </div>
        )}
      </div>
    </CegepGate>
  );
}

/* ── Demo access toggle ───────────────────────────────────── */

function DemoRecruiterAccessToggle() {
  const [current, setCurrent] = useState("free");

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("nexus_user") || "{}");
      if (user.subscription?.tier === "recruteur_pro") setCurrent("pro");
      else if (user.is_cegep_admin) setCurrent("admin");
      else setCurrent("free");
    } catch { /* noop */ }
  }, []);

  const setAccess = (mode: string) => {
    const raw = localStorage.getItem("nexus_user");
    const user = raw ? JSON.parse(raw) : {};
    if (mode === "free") {
      user.subscription = { tier: "free", status: "active", billing_cycle: null, current_period_end: null, trial_days_remaining: null, cancel_at_period_end: false };
      user.tier = "free";
      user.is_cegep_admin = false;
      user.is_also_recruiter = true;
    } else if (mode === "pro") {
      user.subscription = { tier: "recruteur_pro", status: "active", billing_cycle: "monthly", current_period_end: "2026-04-15", trial_days_remaining: null, cancel_at_period_end: false };
      user.tier = "recruteur_pro";
      user.is_cegep_admin = false;
      user.is_also_recruiter = true;
    } else {
      user.subscription = { tier: "free", status: "active", billing_cycle: null, current_period_end: null, trial_days_remaining: null, cancel_at_period_end: false };
      user.tier = "free";
      user.is_cegep_admin = true;
      user.is_also_recruiter = true;
      user.cegep_admin_type = "owner";
    }
    localStorage.setItem("nexus_user", JSON.stringify(user));
    window.location.reload();
  };

  return (
    <div className="mt-8 pt-4 border-t border-[#2D3748]/20">
      <p className="text-[10px] text-[#4a4d56]/60 mb-2">DÉMO : Changer d&apos;accès</p>
      <div className="flex gap-2">
        {[
          { key: "free", label: "Recruteur Gratuit" },
          { key: "pro", label: "Recruteur Pro" },
          { key: "admin", label: "Admin CÉGEP" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setAccess(t.key)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors ${
              current === t.key ? "bg-[#E63946]/15 text-[#E63946]" : "text-[#4a4d56] hover:text-[#6b7280]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RecruiterSettingsPage() {
  /* ── Form state ─────────────────────────────────────────────── */
  const [form, setForm] = useState<RecruiterSettings>(() => JSON.parse(JSON.stringify(mockRecruiterSettings)));
  const [original] = useState<RecruiterSettings>(() => JSON.parse(JSON.stringify(mockRecruiterSettings)));

  /* ── UI state ───────────────────────────────────────────────── */
  const [section, setSection] = useState<SectionKey>("compte");
  const [toast, setToast] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [cegepModal, setCegepModal] = useState<string | null>(null);
  const [deactivateModal, setDeactivateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [exportToast, setExportToast] = useState(false);

  /* ── Helpers ────────────────────────────────────────────────── */
  function handleSave() {
    setToast(true);
  }

  function updateField<K extends keyof RecruiterSettings>(key: K, value: RecruiterSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Paramètres
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Gérez votre compte et vos préférences de recrutement
        </p>
      </div>

      {/* Layout: nav + content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left nav */}
        <div className="lg:w-[240px] shrink-0">
          <RecruiterSettingsNav active={section} onChange={setSection} />
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#111317]/60 backdrop-blur-sm rounded-xl border border-[#1e2128] p-6 sm:p-8">
            {section === "compte" && (
              <CompteSection
                form={form}
                original={original}
                onUpdate={updateField}
                onSave={handleSave}
                onPasswordModal={() => setPasswordModal(true)}
              />
            )}
            {section === "etablissement" && (
              <EtablissementSection
                form={form}
                original={original}
                onUpdate={updateField}
                onSave={handleSave}
                onCegepChange={(id) => setCegepModal(id)}
              />
            )}
            {section === "recrutement" && (
              <RecrutementSection
                form={form}
                original={original}
                onUpdate={updateField}
                onSave={handleSave}
              />
            )}
            {section === "abonnement" && <SubscriptionSection portal="recruteur" />}
            {section === "admin_cegep" && <AdminCegepSection />}
            {section === "ambassadeur" && <AmbassadorDashboard isAmbassador={false} />}
            {section === "notifications" && (
              <NotificationsSection
                form={form}
                original={original}
                onUpdateNotifications={(notifs) => setForm((prev) => ({ ...prev, notifications: notifs }))}
                onSave={handleSave}
              />
            )}
            {section === "confidentialite" && (
              <ConfidentialiteSection
                form={form}
                original={original}
                onUpdateVisibility={(vis) => setForm((prev) => ({ ...prev, visibility: vis }))}
                onSave={handleSave}
              />
            )}
            {section === "danger" && (
              <DangerSection
                onDeactivate={() => setDeactivateModal(true)}
                onExport={() => setExportToast(true)}
                onDelete={() => setDeleteModal(true)}
              />
            )}
          </div>

          {/* Demo access toggle */}
          <DemoRecruiterAccessToggle />
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      <ConfirmModal
        open={passwordModal}
        onClose={() => setPasswordModal(false)}
        onConfirm={() => {/* mock */}}
        title="Modifier le mot de passe"
        message="Cette fonctionnalité sera disponible prochainement."
        confirmLabel="Compris"
        variant="default"
      />

      <ConfirmModal
        open={!!cegepModal}
        onClose={() => setCegepModal(null)}
        onConfirm={() => { if (cegepModal) { updateField("cegepId", cegepModal); updateField("campusId", undefined); } setCegepModal(null); }}
        title="Changer de CÉGEP"
        message="Changer de CÉGEP réinitialisera certaines de vos préférences. Continuer ?"
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        variant="warning"
      />

      <ConfirmModal
        open={deactivateModal}
        onClose={() => setDeactivateModal(false)}
        onConfirm={() => {/* mock */}}
        title="Désactiver votre compte"
        message="Êtes-vous sûr de vouloir désactiver votre compte ? Vous pourrez le réactiver plus tard."
        confirmLabel="Désactiver"
        variant="warning"
      />

      <ConfirmModal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={() => {/* mock */}}
        title="Suppression définitive"
        message="Cette action est irréversible. Toutes vos données seront effacées après un délai de grâce de 30 jours."
        confirmLabel="Supprimer mon compte"
        variant="danger"
        requireTyped="SUPPRIMER"
      />

      {/* ── Toasts ─────────────────────────────────────────────── */}
      <SaveToast show={toast} onHide={() => setToast(false)} />
      <SaveToast show={exportToast} onHide={() => setExportToast(false)} message="Export en cours..." />
    </div>
  );
}
