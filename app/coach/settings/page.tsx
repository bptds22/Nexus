"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import SettingsNav from "./_components/SettingsNav";
import ProfileSection from "./_components/ProfileSection";
import SchoolSection from "./_components/SchoolSection";
import NotificationsSection from "./_components/NotificationsSection";
import AccountSection from "./_components/AccountSection";
import type { SettingsSection } from "./_components/SettingsNav";
import SubscriptionManager from "@/components/subscription/SubscriptionManager";
import SchoolGate from "@/components/subscription/SchoolGate";
import { CoachParametresMobile } from "@/components/shared/CoachParametresMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Coach Settings — Paramètres
   Left nav + content panel, 6 sections.
═══════════════════════════════════════════════════════════════ */

/* ── Admin École section ──────────────────────────────────── */

interface Director {
  id: string;
  user_id: string;
  role: string;
  added_at: string;
  first_name: string;
  last_name: string;
  email: string;
}

function AdminEcoleSection({ isCivilCoach = false }: { isCivilCoach?: boolean }) {
  const [toast, setToast] = useState<string | null>(null);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    async function loadDirectors() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: userRow } = await supabase
        .from("users")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (!userRow?.school_id) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("school_directors")
        .select("id, user_id, role, added_at, users!inner(first_name, last_name, email)")
        .eq("school_id", userRow.school_id);

      if (data) {
        const mapped: Director[] = data.map((d: Record<string, unknown>) => {
          const u = d.users as Record<string, unknown>;
          return {
            id: d.id as string,
            user_id: d.user_id as string,
            role: d.role as string,
            added_at: d.added_at as string,
            first_name: (u?.first_name as string) || "",
            last_name: (u?.last_name as string) || "",
            email: (u?.email as string) || "",
          };
        });
        setDirectors(mapped);
      }
      setLoading(false);
    }
    loadDirectors();
  }, []);

  async function handleRemove(directorId: string, role: string) {
    if (role === "proprietaire") { showToast("Impossible de retirer le propriétaire."); return; }
    const supabase = createClient();
    const { error } = await supabase
      .from("school_directors")
      .delete()
      .eq("id", directorId)
      .eq("role", "collaborateur");

    if (error) { showToast("Erreur lors du retrait."); return; }
    setDirectors((prev) => prev.filter((d) => d.id !== directorId));
    showToast(isCivilCoach ? "Coordinateur retiré avec succès." : "Directeur retiré avec succès.");
  }

  async function handleTransfer() {
    if (!transferTarget) return;
    setTransferring(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTransferring(false); showToast("Non authentifié."); return; }

    const { data: userRow } = await supabase
      .from("users")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!userRow?.school_id) { setTransferring(false); showToast(isCivilCoach ? "Ligue introuvable." : "École introuvable."); return; }

    const { error } = await supabase
      .from("admin_transfer_requests")
      .insert({
        school_id: userRow.school_id,
        from_user_id: user.id,
        to_user_id: transferTarget,
        status: "pending",
      });

    setTransferring(false);
    setShowTransferModal(false);
    if (error) { showToast("Erreur lors de la demande de transfert."); return; }
    showToast("Demande de transfert envoyée.");
  }

  function formatMonth(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    const months = ["Jan.", "Fév.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sep.", "Oct.", "Nov.", "Déc."];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  const collaborators = directors.filter((d) => d.role === "collaborateur");

  if (loading) {
    return (
      <SchoolGate>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      </SchoolGate>
    );
  }

  return (
    <SchoolGate>
      <div className="space-y-8">
        {/* Directors table */}
        <div>
          <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">
            {isCivilCoach ? "Coordinateurs de la ligue" : "Directeurs de l’école"}
          </h2>
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
                {directors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-[#6b7280]">
                      {isCivilCoach ? "Aucun coordinateur trouvé." : "Aucun directeur trouvé."}
                    </td>
                  </tr>
                )}
                {directors.map((d) => (
                  <tr key={d.id} className="border-b border-[#2D3748]/40">
                    <td className="px-4 py-3 text-[13px] font-bold text-white flex items-center gap-1.5">
                      {d.role === "proprietaire" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#DAB65A" stroke="none"><path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" /><circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" /></svg>
                      )}
                      {d.first_name} {d.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.role === "proprietaire"
                          ? "bg-[#DAB65A]/15 text-[#DAB65A]"
                          : "bg-[#6B7280]/15 text-[#6B7280]"
                      }`}>
                        {d.role === "proprietaire" ? "Propriétaire" : "Collaborateur"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{d.email}</td>
                    <td className="px-4 py-3 text-[12px] text-[#6b7280]">{formatMonth(d.added_at)}</td>
                    <td className="px-4 py-3">
                      {d.role === "collaborateur" && (
                        <button type="button" onClick={() => handleRemove(d.id, d.role)} className="text-[11px] text-[#E63946] hover:text-[#D42B22] transition-colors font-bold">Retirer</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transfer */}
        <div className="border-t border-[#2D3748]/40 pt-6">
          <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">Transfert d&apos;administration</h2>
          <p className="text-[13px] text-[#9CA3AF] mb-4">
            {isCivilCoach
              ? "Transfère le rôle de propriétaire à un autre coordinateur. Cette demande sera traitée par l’administration Nexus."
              : "Transfère le rôle de propriétaire à un autre directeur. Cette demande sera traitée par l’administration Nexus."}
          </p>

          {!showTransferModal ? (
            <button
              type="button"
              onClick={() => setShowTransferModal(true)}
              disabled={collaborators.length === 0}
              className="h-10 px-5 rounded-lg border border-[#E63946]/30 text-[#E63946] font-bold text-[12px] uppercase tracking-wider hover:bg-[#E63946]/5 transition-colors disabled:opacity-40"
            >
              Demander un transfert
            </button>
          ) : (
            <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 max-w-md space-y-4">
              <div>
                <label className="block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5">Transférer à</label>
                <select
                  title="Sélectionner un collaborateur"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors"
                >
                  <option value="">— Sélectionner —</option>
                  {collaborators.map((c) => (
                    <option key={c.user_id} value={c.user_id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={transferring || !transferTarget}
                  className="h-10 px-5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-50"
                >
                  {transferring ? "Envoi..." : "Confirmer le transfert"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowTransferModal(false); setTransferTarget(""); }}
                  className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {collaborators.length === 0 && !showTransferModal && (
            <p className="text-[11px] text-[#4a4d56] mt-2">
              {isCivilCoach
                ? "Aucun collaborateur disponible pour le transfert. Invite d’abord un coordinateur."
                : "Aucun collaborateur disponible pour le transfert. Invite d’abord un directeur."}
            </p>
          )}
        </div>

        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </SchoolGate>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */

export default function CoachSettingsPage() {
  // Phase 2 — mobile early return BEFORE any other hooks/data fetch.
  // Mobile composer owns its own data layer + composition.
  if (IS_CAPACITOR) return <CoachParametresMobile />;
  return <CoachSettingsDesktop />;
}

function CoachSettingsDesktop() {
  const [section, setSection] = useState<SettingsSection>("profil");
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [isCivilCoach, setIsCivilCoach] = useState(false);

  useEffect(() => {
    async function checkUserContext() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("is_school_admin, context")
        .eq("id", user.id)
        .single();
      if (data?.is_school_admin) setIsSchoolAdmin(true);
      if (data?.context === "ligue_civile") setIsCivilCoach(true);
    }
    checkUserContext();
  }, []);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Paramètres
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          {isCivilCoach
            ? "Gère ton profil, ta ligue et tes préférences."
            : "Gère ton profil, ton école et tes préférences."}
        </p>
      </div>

      {/* Layout: nav + content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left nav */}
        <div className="lg:w-[240px] shrink-0">
          <SettingsNav active={section} onChange={setSection} isSchoolAdmin={isSchoolAdmin} isCivilCoach={isCivilCoach} />
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#111317]/60 backdrop-blur-sm rounded-xl border border-[#1e2128] p-6 sm:p-8">
            {section === "profil" && <ProfileSection />}
            {section === "ecole" && <SchoolSection isCivilCoach={isCivilCoach} />}
            {section === "abonnement" && <SubscriptionManager role="COACH" isCivilCoach={isCivilCoach} />}
            {section === "admin_ecole" && <AdminEcoleSection isCivilCoach={isCivilCoach} />}
            {section === "notifications" && <NotificationsSection />}
            {section === "compte" && <AccountSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
