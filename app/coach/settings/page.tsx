"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import SettingsNav from "./_components/SettingsNav";
import ProfileSection from "./_components/ProfileSection";
import SchoolSection from "./_components/SchoolSection";
import NotificationsSection from "./_components/NotificationsSection";
import AccountSection from "./_components/AccountSection";
import type { SettingsSection } from "./_components/SettingsNav";
import SubscriptionSection from "@/components/subscription/SubscriptionSection";
import SchoolGate from "@/components/subscription/SchoolGate";
import { useSubscription } from "@/lib/hooks/useSubscription";

/* ═══════════════════════════════════════════════════════════════
   Coach Settings — Paramètres
   Left nav + content panel, 6 sections.
═══════════════════════════════════════════════════════════════ */

/* ── Coach Pricing Section ────────────────────────────────── */

function CoachPricingSection() {
  const [annual, setAnnual] = useState(false);
  // Coach has only 2 tiers: free / pro.
  // Any legacy DB value that reads as "all_star" is collapsed to "pro".
  const { tier: hookTier } = useSubscription();
  const currentTier: "free" | "pro" = hookTier === "free" ? "free" : "pro";

  const tiers = [
    {
      id: "free",
      name: "Gratuit",
      monthly: 0,
      yearly: 0,
      border: "border-[#2D3748]",
      glow: "",
      badge: null,
      ctaBg: "",
      ctaText: "",
      features: [
        { label: "Profil coach de base", included: true },
        { label: "Création d'athlètes", included: true },
        { label: "Évaluations de base", included: true },
        { label: "Vérification d'athlètes", included: true },
        { label: "Mon École", included: false },
        { label: "Stats École", included: false },
        { label: "Placements & suivi", included: false },
        { label: "Ma Réputation", included: false },
        { label: "Analytics avancés", included: false },
      ],
    },
    {
      id: "pro",
      name: "Pro",
      monthly: 4.99,
      yearly: 39,
      border: "border-[#F59E0B]",
      glow: "shadow-[0_0_20px_rgba(245,158,11,0.1)]",
      badge: { label: "POPULAIRE", color: "bg-[#F59E0B] text-black" },
      ctaBg: "bg-[#F59E0B] hover:bg-[#D97706] text-black",
      ctaText: "Passer à Pro",
      features: [
        { label: "Tout du plan Gratuit +", included: true, header: true },
        { label: "Mon École complète", included: true },
        { label: "Stats École & rapports", included: true },
        { label: "Placements & suivi", included: true },
        { label: "Ma Réputation", included: true },
        { label: "Analytics de profils", included: true },
        { label: "Alertes recruteurs", included: true },
        { label: "Évaluations détaillées", included: true },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Abonnement</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Gère ton plan et ta facturation</p>
      </div>

      <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-xl px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
          <span className="text-[14px] font-bold text-white">Tu es actuellement sur le plan <span className="uppercase">{currentTier === "free" ? "Gratuit" : "Pro"}</span></span>
        </div>
        {currentTier === "free" && <p className="text-[13px] text-[#9CA3AF] mt-1 ml-[18px]">Passe à Pro pour maximiser la visibilité de tes athlètes</p>}
      </div>

      <div className="flex justify-center">
        <div className="flex items-center gap-1 bg-[#13151a] rounded-xl p-1.5">
          <button type="button" onClick={() => setAnnual(false)} className={`px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${!annual ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]" : "text-[#6b7280] hover:text-white"}`}>Mensuel</button>
          <button type="button" onClick={() => setAnnual(true)} className={`px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${annual ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]" : "text-[#6b7280] hover:text-white"}`}>
            Annuel <span className="text-[10px] font-normal ml-1 opacity-80">(économise 34%)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[680px] mx-auto">
        {tiers.map(tier => {
          const isCurrent = currentTier === tier.id;
          const price = annual ? tier.yearly : tier.monthly;
          const period = annual ? "/an" : "/mois";

          return (
            <div key={tier.id} className={`bg-[#1A1D24] rounded-xl border ${tier.border} ${tier.glow} p-6 flex flex-col relative`}>
              {tier.badge && (
                <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${tier.badge.color}`}>
                  {tier.badge.label}
                </span>
              )}
              <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight mt-1">
                {tier.id !== "free" && <span className="text-[#F59E0B] mr-1">{tier.id === "pro" ? "★" : "★★"}</span>}
                {tier.name}
              </h3>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-[32px] font-black text-white leading-none">{price === 0 ? "0" : `${price}`}$</span>
                  {price > 0 && <span className="text-[14px] text-[#6b7280]">{period}</span>}
                </div>
                {price > 0 && annual && <p className="text-[12px] text-[#22C55E] mt-1 font-bold">Économise 58%</p>}
                {price > 0 && !annual && tier.yearly > 0 && <p className="text-[11px] text-[#6b7280] mt-1">ou {tier.yearly}$/an</p>}
              </div>
              <div className="h-px bg-[#2D3748] my-4" />
              <div className="space-y-2.5 flex-1">
                {tier.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {(f as { header?: boolean }).header ? (
                      <span className="text-[12px] font-bold text-[#F59E0B] uppercase tracking-wider">{f.label}</span>
                    ) : f.included ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                        <span className="text-[13px] text-[#e0e0e0]">{f.label}</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                        <span className="text-[13px] text-[#4a4d56] line-through">{f.label}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-5">
                {isCurrent ? (
                  <button type="button" disabled className="w-full py-2.5 rounded-lg text-[13px] font-bold bg-[#2D3748] text-[#6b7280] cursor-not-allowed">Plan actuel</button>
                ) : (
                  <button type="button" className={`w-full py-2.5 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${tier.ctaBg}`}>
                    {tier.ctaText}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

function AdminEcoleSection() {
  const [toast, setToast] = useState<string | null>(null);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
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
    showToast("Directeur retiré avec succès.");
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setInviting(false); showToast("Non authentifié."); return; }

    const { data: userRow } = await supabase
      .from("users")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!userRow?.school_id) { setInviting(false); showToast("École introuvable."); return; }

    const { error } = await supabase
      .from("director_invitations")
      .insert({
        school_id: userRow.school_id,
        invited_by: user.id,
        email: inviteEmail.trim(),
        status: "pending",
      });

    setInviting(false);
    if (error) { showToast("Erreur lors de l'envoi de l'invitation."); return; }
    setInviteEmail("");
    showToast("Invitation envoyée avec succès.");
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

    if (!userRow?.school_id) { setTransferring(false); showToast("École introuvable."); return; }

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
          <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Directeurs de l&apos;école</h2>
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
                    <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-[#6b7280]">Aucun directeur trouvé.</td>
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

        {/* Invite director */}
        <div className="border-t border-[#2D3748]/40 pt-6">
          <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Inviter un directeur sportif</h2>
          <div className="max-w-md space-y-4">
            <div>
              <label className="block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5">Courriel du directeur</label>
              <input
                type="email"
                title="Courriel du directeur"
                placeholder="directeur@ecole.qc.ca"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviting}
              className="h-10 px-5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-50"
            >
              {inviting ? "Envoi..." : "Envoyer l\u2019invitation"}
            </button>
            <p className="text-[11px] text-[#4a4d56]">Le directeur invité aura accès gratuit à toutes les fonctionnalités de gestion d&apos;école.</p>
          </div>
        </div>

        {/* Transfer */}
        <div className="border-t border-[#2D3748]/40 pt-6">
          <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">Transfert d&apos;administration</h2>
          <p className="text-[13px] text-[#9CA3AF] mb-4">Transfère le rôle de propriétaire à un autre directeur. Cette demande sera traitée par l&apos;administration Nexus.</p>

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
            <p className="text-[11px] text-[#4a4d56] mt-2">Aucun collaborateur disponible pour le transfert. Invite d&apos;abord un directeur.</p>
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
  const [section, setSection] = useState<SettingsSection>("profil");
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("is_school_admin")
        .eq("id", user.id)
        .single();
      if (data?.is_school_admin) setIsSchoolAdmin(true);
    }
    checkAdmin();
  }, []);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Paramètres
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Gère ton profil, ton école et tes préférences.
        </p>
      </div>

      {/* Layout: nav + content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left nav */}
        <div className="lg:w-[240px] shrink-0">
          <SettingsNav active={section} onChange={setSection} isSchoolAdmin={isSchoolAdmin} />
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#111317]/60 backdrop-blur-sm rounded-xl border border-[#1e2128] p-6 sm:p-8">
            {section === "profil" && <ProfileSection />}
            {section === "ecole" && <SchoolSection />}
            {section === "abonnement" && <CoachPricingSection />}
            {section === "admin_ecole" && <AdminEcoleSection />}
            {section === "notifications" && <NotificationsSection />}
            {section === "compte" && <AccountSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
