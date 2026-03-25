"use client";

import { useState } from "react";
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

/* ═══════════════════════════════════════════════════════════════
   Recruiter Settings — /recruteur/parametres
   Left nav (click-to-switch) + content panel, 6 sections.
═══════════════════════════════════════════════════════════════ */

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
