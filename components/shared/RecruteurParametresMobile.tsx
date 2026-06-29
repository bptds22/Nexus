"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurParametresMobile — Paramètres mobile (iter 7.39).

   Pattern Réglages iPhone : rows iOS groupées, sections collapsées,
   toggles rouge. Colonnes DB exactes (DIAG 7.38 §B.2) :

   - users.notification_preferences (JSONB : app_*, email_*, marketing_emails)
   - users.recruitment_preferences (JSONB : regions, graduation_years,
     positions, min_gpa, min_cote, alerts_enabled)
   - users.privacy_preferences (JSONB : profile_visible, show_consultations,
     show_full_name, consent_*)

   Sections :
   - Notifications (6 toggles app + master email — desktop NotificationsSection)
   - Confidentialité (3 toggles + dates consentement + openExternal vers web)
   - Abonnement (Pro/All Star lancent le checkout Stripe via in-app browser)
   - Compte (changer mot de passe via sheet)
   - Zone danger (désactiver via RPC + déconnexion réelle)

   PAS de Gestion CÉGEP ni Transfert (BP confirme — desktop only).

   Phase 1 unification — la vocabulary iOS Settings (SectionLabel,
   Group, ToggleRow, NavRow, DangerRow, Toggle, TierCard, tierStatus,
   PasswordChangeSheet, ConfirmSheet, openExternal, triggerHaptic) a
   été extraite dans components/shared/settings/. Ce fichier compose
   les blocs partagés autour des sections SPÉCIFIQUES RECRUTEUR :
   NOTIF_ROWS, recruteur-targeted copies, recruteur features dans les
   TierCards. Le rendu reste byte-identical au pré-extraction.

   ⚠️ Rules of Hooks : tous les hooks AVANT early return (canon 7.8d/7.25).
═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useSubscription } from "@/lib/hooks/useSubscription";
import {
  triggerHaptic, openExternal, tierStatus,
  SectionLabel, Group, ToggleRow, NavRow, DangerRow,
  TierCard, PasswordChangeSheet, ConfirmSheet,
} from "@/components/shared/settings";
import { deleteMyAccount } from "@/lib/auth/deleteAccount";
// startMobileCheckout lives in the same shared settings module but isn't
// re-exported by the barrel (yet), so import it from the file directly.
import { startMobileCheckout, startMobilePortal, fmtSubDate, subStatusLabel } from "@/components/shared/settings/utils";
import { openLegalDocument } from "@/lib/legal";
import { hapticTap } from "@/lib/haptics";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ── Shape des prefs notifications côté DB (DIAG 7.38) ────────── */

const NOTIF_ROWS: { key: string; appKey: string; emailKey: string; label: string; sublabel: string }[] = [
  { key: "newAthlete", appKey: "app_new_athlete", emailKey: "email_new_athlete",
    label: "Nouvel athlète dans mon sport", sublabel: "Matche vos critères de recrutement" },
  { key: "favoriteUpdate", appKey: "app_favorite_update", emailKey: "email_favorite_update",
    label: "Mise à jour d'un favori", sublabel: "Profil, stats ou vidéo modifié" },
  { key: "scoutingReport", appKey: "app_scouting_report", emailKey: "email_scouting_report",
    label: "Rapport d'évaluation disponible", sublabel: "Nouvelle évaluation coach" },
  { key: "profileVerified", appKey: "app_profile_verified", emailKey: "email_profile_verified",
    label: "Profil vérifié", sublabel: "Un favori obtient le statut vérifié" },
  { key: "coachReply", appKey: "app_coach_reply", emailKey: "email_coach_reply",
    label: "Réponse d'un coach", sublabel: "À un de vos messages" },
  { key: "lettreIntention", appKey: "app_lettre_intention", emailKey: "email_lettre_intention",
    label: "Lettre d'intention signée", sublabel: "Un favori s'engage avec un CÉGEP" },
];

interface NotifPrefs { [k: string]: boolean | string }
interface PrivacyPrefs {
  profile_visible: boolean;
  show_consultations: boolean;
  show_full_name: boolean;
  consent_privacy_policy?: string | null;
  consent_data_collection?: string | null;
  consent_marketing?: string | null;
}

/* ── Main page ───────────────────────────────────────────────── */

export function RecruteurParametresMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const { tier, refresh, isStripeManaged, periodEnd, billing, status, cancelAtPeriodEnd } = useSubscription();

  // Hooks AVANT toute condition (canon 7.8d).
  const [notifs, setNotifs] = useState<NotifPrefs>({});
  const [origNotifs, setOrigNotifs] = useState<NotifPrefs>({});
  // Iter 7.41 §2 — master courriel UX. ON ⇒ chaque email_X = app_X.
  // OFF ⇒ tous email_* = false. Marketing_emails reste indépendant.
  const [masterEmail, setMasterEmail] = useState(false);
  const [origMasterEmail, setOrigMasterEmail] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacyPrefs>({
    profile_visible: true, show_consultations: true, show_full_name: true,
  });
  const [origPrivacy, setOrigPrivacy] = useState<PrivacyPrefs>({
    profile_visible: true, show_consultations: true, show_full_name: true,
  });
  const [consentDates, setConsentDates] = useState<{ privacy?: string; data?: string; marketing?: string | null }>({});
  const [signupDate, setSignupDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [deactivateSheetOpen, setDeactivateSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  // Which tier is mid-checkout — drives the CTA label + blocks double-tap.
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  // Load notification + privacy preferences
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("users")
        .select("notification_preferences, privacy_preferences")
        .eq("id", user.id)
        .single();
      if (cancelled) return;

      const n = (data?.notification_preferences as NotifPrefs) || {};
      // Defaults : app=true, email=false sauf coach_reply+lettre_intention (canon desktop NotifSection.tsx)
      const seedNotif: NotifPrefs = {};
      for (const row of NOTIF_ROWS) {
        seedNotif[row.appKey] = n[row.appKey] !== false;
        const emailDefaultTrue = row.key === "coachReply" || row.key === "lettreIntention";
        seedNotif[row.emailKey] = emailDefaultTrue ? n[row.emailKey] !== false : !!n[row.emailKey];
      }
      seedNotif.marketing_emails = !!n.marketing_emails;
      setNotifs(seedNotif);
      setOrigNotifs(seedNotif);

      // Iter 7.41 §2 — master email ON si AU MOINS UN email_* est true.
      // Marketing exclu (toggle séparé).
      const anyEmailOn = NOTIF_ROWS.some((r) => !!seedNotif[r.emailKey]);
      setMasterEmail(anyEmailOn);
      setOrigMasterEmail(anyEmailOn);

      const p = (data?.privacy_preferences as PrivacyPrefs) || {};
      const seedPriv: PrivacyPrefs = {
        profile_visible: p.profile_visible !== false,
        show_consultations: p.show_consultations !== false,
        show_full_name: p.show_full_name !== false,
        consent_privacy_policy: p.consent_privacy_policy ?? null,
        consent_data_collection: p.consent_data_collection ?? null,
        consent_marketing: p.consent_marketing ?? null,
      };
      setPrivacy(seedPriv);
      setOrigPrivacy(seedPriv);
      const fmt = (iso?: string | null) => iso
        ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })
        : "";
      setConsentDates({
        privacy: fmt(p.consent_privacy_policy),
        data: fmt(p.consent_data_collection),
        marketing: p.consent_marketing ? fmt(p.consent_marketing) : null,
      });

      if (user.created_at) setSignupDate(new Date(user.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }));

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Refresh the displayed tier when the user comes back from the Stripe
  // in-app browser — the webhook may have updated the subscription row,
  // so we re-run the EXISTING useSubscription fetch (refresh) rather than
  // a parallel query. browserFinished fires when the in-app browser closes;
  // appStateChange (isActive) covers the user swiping back to the app.
  // Both plugins absent on web → caught → no-op. Listeners removed on unmount.
  useEffect(() => {
    let browserListener: { remove: () => void } | null = null;
    let appListener: { remove: () => void } | null = null;
    (async () => {
      try {
        const { Browser } = await import("@capacitor/browser");
        browserListener = await Browser.addListener("browserFinished", () => { refresh(); });
      } catch { /* no-op (web) */ }
      try {
        const { App } = await import("@capacitor/app");
        appListener = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) refresh();
        });
      } catch { /* no-op (web) */ }
    })();
    return () => {
      browserListener?.remove();
      appListener?.remove();
    };
  }, [refresh]);

  // Lot 0 — re-pull du tier au montage de la page paramètres. Le Provider
  // peut avoir fetché un tier périmé au lancement (un payant/all_star
  // s'afficherait "Gratuit" → jamais de bouton "Gérer"). refresh est stable
  // (useCallback sur userId) ; l'appel est idempotent.
  useEffect(() => { refresh(); }, [refresh]);

  // Iter 7.41 §2 — dirty inclut le master courriel.
  const notifsDirty = useMemo(
    () => JSON.stringify(notifs) !== JSON.stringify(origNotifs) || masterEmail !== origMasterEmail,
    [notifs, origNotifs, masterEmail, origMasterEmail],
  );
  const privacyDirty = useMemo(() => {
    return privacy.profile_visible !== origPrivacy.profile_visible
        || privacy.show_consultations !== origPrivacy.show_consultations
        || privacy.show_full_name !== origPrivacy.show_full_name;
  }, [privacy, origPrivacy]);

  async function saveNotifs() {
    if (!notifsDirty || savingNotifs) return;
    triggerHaptic("Medium");
    setSavingNotifs(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Iter 7.41 §2 — dérive email_X à partir de master + app_X.
      // master ON  ⇒ email_X = app_X (mirroring)
      // master OFF ⇒ email_X = false (silence email global)
      // marketing_emails reste indépendant.
      const payload: NotifPrefs = { ...notifs };
      for (const row of NOTIF_ROWS) {
        payload[row.emailKey] = masterEmail ? !!notifs[row.appKey] : false;
      }

      const { error } = await supabase
        .from("users")
        .update({ notification_preferences: payload })
        .eq("id", user.id);
      if (error) { toast.error({ message: "Échec sauvegarde", detail: error.message }); return; }
      setNotifs(payload);
      setOrigNotifs(payload);
      setOrigMasterEmail(masterEmail);
      toast.success({ message: "Notifications mises à jour" });
    } finally {
      setSavingNotifs(false);
    }
  }

  async function savePrivacy() {
    if (!privacyDirty || savingPrivacy) return;
    triggerHaptic("Medium");
    setSavingPrivacy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payload = {
        profile_visible: privacy.profile_visible,
        show_consultations: privacy.show_consultations,
        show_full_name: privacy.show_full_name,
        consent_privacy_policy: privacy.consent_privacy_policy || new Date().toISOString(),
        consent_data_collection: privacy.consent_data_collection || new Date().toISOString(),
        consent_marketing: privacy.consent_marketing || null,
      };
      const { error } = await supabase
        .from("users")
        .update({ privacy_preferences: payload })
        .eq("id", user.id);
      if (error) { toast.error({ message: "Échec sauvegarde", detail: error.message }); return; }
      setOrigPrivacy(privacy);
      toast.success({ message: "Confidentialité mise à jour" });
    } finally {
      setSavingPrivacy(false);
    }
  }

  // Mobile portal: open the Stripe billing portal in the in-app browser.
  // Tier refresh on return is handled by the browserFinished/appStateChange
  // effect (same as checkout). Errors surface via toast — never swallowed.
  async function handlePortal() {
    if (portalBusy) return;
    if (IS_CAPACITOR) return; // iOS (3.1.1) : pas de portail de paiement in-app.
    triggerHaptic("Light");
    setPortalBusy(true);
    try {
      await startMobilePortal();
    } catch (e) {
      toast.error({
        message: "Portail indisponible",
        detail: e instanceof Error ? e.message : "Erreur inconnue",
      });
    } finally {
      setPortalBusy(false);
    }
  }

  // Mobile checkout: launch Stripe via the in-app browser. Loading state
  // (upgradingTier) blocks a double-tap; any throw surfaces via the toast
  // already used elsewhere in this screen (never swallowed). The displayed
  // tier refreshes on return via the browserFinished/appStateChange effect.
  async function handleUpgrade(targetTier: "pro" | "all_star", cycle: "monthly" | "annual") {
    if (upgradingTier) return;
    if (IS_CAPACITOR) return; // iOS (3.1.1) : aucun checkout in-app, défense en profondeur.
    hapticTap(); // CTA checkout primaire — feedback tactile au tap

    // Already on a paid plan → NEVER stack a second checkout (double-bill).
    // Plan changes go through Stripe; the mobile portal isn't wired yet, so
    // point the user to the web instead of starting a fresh checkout.
    if (tier !== "free") {
      // Déjà payant : jamais de 2e checkout. Vrai abo Stripe → portail
      // (changement de plan + proration côté Stripe). Accès offert
      // (admin_grant) → message dédié, pas de portail.
      if (isStripeManaged) { void handlePortal(); return; }
      toast.info({
        message: "Accès accordé par Nexus",
        detail: "Ton plan t'a été offert — aucune facturation à gérer.",
      });
      return;
    }
    setUpgradingTier(targetTier);
    try {
      await startMobileCheckout(targetTier, cycle);
    } catch (e) {
      toast.error({
        message: "Paiement indisponible",
        detail: e instanceof Error ? e.message : "Erreur inconnue",
      });
    } finally {
      setUpgradingTier(null);
    }
  }

  // Désactivation RÉVERSIBLE (conservation des données) — inchangée.
  async function handleDeactivate() {
    triggerHaptic("Heavy");
    const supabase = createClient();
    const { error } = await supabase.rpc("deactivate_my_account", { p_revoke_consent: false });
    if (error) { toast.error({ message: "Échec désactivation", detail: error.message }); return; }
    try { localStorage.removeItem("nexus_user"); } catch { /* no-op */ }
    await supabase.auth.signOut();
    setDeactivateSheetOpen(false);
    router.push("/auth");
  }

  // Suppression DÉFINITIVE — RPC delete_my_account via le helper partagé.
  async function handleDelete() {
    triggerHaptic("Heavy");
    setDeleteSheetOpen(false);
    await deleteMyAccount({
      onError: (detail) => toast.error({ message: "Échec de la suppression", detail }),
    });
  }

  async function handleLogout() {
    triggerHaptic("Medium");
    const supabase = createClient();
    try { localStorage.removeItem("nexus_user"); } catch { /* no-op */ }
    await supabase.auth.signOut();
    setLogoutSheetOpen(false);
    router.push("/auth");
  }

  function handleBack() {
    triggerHaptic("Light");
    router.push("/recruteur/tableau-de-bord");
  }

  const tierLabel = tier === "all_star" ? "All Star" : tier === "pro" ? "Pro" : "Gratuit";

  if (loading) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
        <div className="px-4 pt-10 pb-3 text-[#6b7280] text-[14px]">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="h-11 flex items-center px-4">
          <button
            type="button"
            aria-label="Retour"
            onClick={handleBack}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] text-[#8a8d96]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="flex-1 text-center font-head text-[17px] font-black text-white uppercase tracking-tight pr-9">
            Paramètres
          </h1>
        </div>
      </div>

      {/* Subscription info — readonly bandeau */}
      <div className="px-4 pt-6 pb-2">
        <div className="rounded-2xl bg-[#1A1D24] border border-white/[0.06] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
              <span className="text-[13px] text-[#9CA3AF]">Plan actuel</span>
            </div>
            <span className="text-[14px] font-semibold text-white uppercase tracking-wider">{tierLabel}</span>
          </div>
          {tier === "free" && (
            <p className="text-[12px] text-[#6b7280] mt-2">Passe à Pro pour débloquer le processus, la messagerie et plus.</p>
          )}
          {/* Payant + vrai abo Stripe → résumé (statut/cycle/renouvellement)
              + portail (in-app browser). */}
          {tier !== "free" && isStripeManaged && (
            <div className="mt-3 space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#9CA3AF]">Statut</span>
                  <span className="text-white font-semibold">{subStatusLabel(status)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#9CA3AF]">Cycle</span>
                  <span className="text-white font-semibold">{billing === "annual" ? "Annuel" : "Mensuel"}</span>
                </div>
                {cancelAtPeriodEnd ? (
                  <p className="text-[12px] text-[#E63946]">Ton abonnement se termine le {fmtSubDate(periodEnd)}.</p>
                ) : (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#9CA3AF]">Renouvellement</span>
                    <span className="text-white font-semibold">{fmtSubDate(periodEnd)}</span>
                  </div>
                )}
              </div>
              {IS_CAPACITOR ? (
                // iOS (3.1.1) : pas de gestion de paiement in-app.
                // Texte descriptif PUR — aucun lien ni bouton cliquable.
                <p className="text-[12px] text-[#9CA3AF] leading-snug">
                  Pour gérer ou modifier ton abonnement, rends-toi sur la version web de Nexus.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handlePortal}
                  disabled={portalBusy}
                  className="w-full h-11 rounded-xl border border-white/15 text-white font-bold text-[12px] uppercase tracking-wider active:bg-white/5 disabled:opacity-60"
                >
                  {portalBusy ? "Ouverture…" : "Gérer mon abonnement"}
                </button>
              )}
            </div>
          )}
          {/* Payant SANS abo Stripe (accès offert) → pas de portail. */}
          {tier !== "free" && !isStripeManaged && (
            <div className="mt-3">
              <p className="text-[13px] font-bold text-white">Accès accordé par l&apos;équipe Nexus</p>
              <p className="text-[12px] text-[#6b7280] mt-1">
                Ton plan t&apos;a été offert par Nexus — aucune facturation à gérer.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* NOTIFICATIONS — iter 7.41 §2 : 1 toggle par ligne pilotant app_*.
          Le mirror courriel est régi par le master "Recevoir aussi par
          courriel" en bas du groupe. Les clés JSONB (app_*, email_*) restent
          IDENTIQUES — desktop intact. */}
      <SectionLabel>Notifications</SectionLabel>
      <Group>
        {NOTIF_ROWS.map((row, idx) => (
          <ToggleRow
            key={row.key}
            isFirst={idx === 0}
            label={row.label}
            sublabel={row.sublabel}
            checked={!!notifs[row.appKey]}
            onChange={(v) => setNotifs((n) => ({ ...n, [row.appKey]: v }))}
          />
        ))}
      </Group>
      <Group className="mt-2">
        <ToggleRow
          label="Recevoir aussi par courriel"
          sublabel="Les mêmes notifications, par courriel"
          isFirst
          checked={masterEmail}
          onChange={setMasterEmail}
        />
        <ToggleRow
          label="Emails marketing"
          sublabel="Annonces produit et infolettre"
          isFirst={false}
          checked={!!notifs.marketing_emails}
          onChange={(v) => setNotifs((n) => ({ ...n, marketing_emails: v }))}
        />
      </Group>
      {notifsDirty && (
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={saveNotifs}
            disabled={savingNotifs}
            className="w-full h-11 rounded-2xl bg-[#E63946] text-white text-[14px] font-semibold active:bg-[#D42B22] disabled:opacity-60"
          >
            {savingNotifs ? "Sauvegarde…" : "Enregistrer les notifications"}
          </button>
        </div>
      )}

      {/* CONFIDENTIALITÉ */}
      <SectionLabel>Confidentialité</SectionLabel>
      <Group>
        <ToggleRow
          label="Profil visible"
          sublabel="Vous apparaissez dans la liste des recruteurs aux coachs"
          isFirst
          checked={privacy.profile_visible}
          onChange={(v) => setPrivacy((p) => ({ ...p, profile_visible: v }))}
        />
        <ToggleRow
          label="Historique de consultations visible"
          sublabel="Les athlètes voient quand vous consultez leur profil"
          isFirst={false}
          checked={privacy.show_consultations}
          onChange={(v) => setPrivacy((p) => ({ ...p, show_consultations: v }))}
        />
        <ToggleRow
          label="Afficher mon nom complet"
          sublabel="Coachs voient prénom + nom (sinon initiales)"
          isFirst={false}
          checked={privacy.show_full_name}
          onChange={(v) => setPrivacy((p) => ({ ...p, show_full_name: v }))}
        />
      </Group>
      {privacyDirty && (
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={savePrivacy}
            disabled={savingPrivacy}
            className="w-full h-11 rounded-2xl bg-[#E63946] text-white text-[14px] font-semibold active:bg-[#D42B22] disabled:opacity-60"
          >
            {savingPrivacy ? "Sauvegarde…" : "Enregistrer la confidentialité"}
          </button>
        </div>
      )}
      <Group className="mt-3">
        <NavRow
          label="Politique de confidentialité"
          isFirst
          rightChevron="external"
          onTap={() => {
            if (IS_CAPACITOR) { openLegalDocument("confidentialite"); return; }
            openExternal("https://nexussports.ca/confidentialite");
          }}
        />
        <NavRow
          label="Exporter mes données (Loi 25)"
          isFirst={false}
          rightChevron={IS_CAPACITOR ? "none" : "external"}
          onTap={() => {
            if (IS_CAPACITOR) {
              toast.info({ message: "Disponible sur la version web", detail: "L'export de tes données se fait sur nexussports.ca." });
              return;
            }
            openExternal("https://nexussports.ca/recruteur/parametres?section=confidentialite");
          }}
        />
      </Group>
      {/* Dates consentement read-only */}
      <div className="px-6 pt-3 text-[11px] text-[#6b7280] leading-5">
        {signupDate && <p>Inscription : {signupDate}</p>}
        {consentDates.privacy && <p>Consentement politique : {consentDates.privacy}</p>}
        {consentDates.data && <p>Consentement données : {consentDates.data}</p>}
        {consentDates.marketing && <p>Consentement marketing : {consentDates.marketing}</p>}
      </div>

      {/* ABONNEMENT — iter 7.40 §3 : cards premium. Tiers SUPÉRIEURS au
          tier courant = CTA rouge actif (Pro/All Star) qui lance le
          checkout Stripe via in-app browser. Tier actuel = bordure rouge +
          glow + badge "Actuel" vert. Tiers inférieurs = compacts en
          sourdine (aucun CTA — l'utilisateur a déjà mieux). */}
      <SectionLabel>Abonnement</SectionLabel>
      <div className="px-4 space-y-2">
        <TierCard
          name="Gratuit"
          price="0 $"
          period=""
          features={[
            "10 résultats par recherche",
            "Étoiles, cote globale, vérification",
            "Stats école visibles",
          ]}
          status={tierStatus(tier, "free")}
        />
        <TierCard
          name="Pro"
          price="19,99 $"
          period="/mois"
          features={[
            "Processus complet + messagerie",
            "Filtres avancés (taille, poids, cote)",
            "Coordonnées du coach révélées",
          ]}
          status={tierStatus(tier, "pro")}
          accentDot="#F59E0B"
          onUpgrade={() => handleUpgrade("pro", "monthly")}
          upgradeLabel={tier !== "free" ? "Changer de plan" : upgradingTier === "pro" ? "Redirection…" : "Passer à Pro"}
        />
        <TierCard
          name="All Star"
          price="29,99 $"
          period="/mois"
          features={[
            "Processus illimité + analytics",
            "Voir qui a consulté un athlète",
            "Listes de prospects personnalisées",
          ]}
          status={tierStatus(tier, "all_star")}
          accentDot="#E63946"
          onUpgrade={() => handleUpgrade("all_star", "monthly")}
          upgradeLabel={tier !== "free" ? "Changer de plan" : upgradingTier === "all_star" ? "Redirection…" : "Passer à All Star"}
        />
      </div>

      {/* COMPTE */}
      <SectionLabel>Compte</SectionLabel>
      <Group>
        <NavRow
          label="Changer le mot de passe"
          isFirst
          onTap={() => { triggerHaptic("Light"); setPasswordSheetOpen(true); }}
        />
      </Group>

      {/* ZONE DANGER */}
      <SectionLabel>Zone danger</SectionLabel>
      <Group>
        <DangerRow
          label="Désactiver mon compte"
          isFirst
          onTap={() => { triggerHaptic("Light"); setDeactivateSheetOpen(true); }}
        />
        <DangerRow
          label="Supprimer mon compte"
          isFirst={false}
          onTap={() => { triggerHaptic("Light"); setDeleteSheetOpen(true); }}
        />
        <DangerRow
          label="Déconnexion"
          isFirst={false}
          onTap={() => { triggerHaptic("Light"); setLogoutSheetOpen(true); }}
        />
      </Group>

      <div className="h-8" />

      {/* Sheets */}
      <PasswordChangeSheet open={passwordSheetOpen} onClose={() => setPasswordSheetOpen(false)} />
      <ConfirmSheet
        open={deactivateSheetOpen}
        onClose={() => setDeactivateSheetOpen(false)}
        title="Désactiver le compte ?"
        message="Votre profil deviendra invisible, alertes stoppées. Vos données seront conservées. Vous pourrez réactiver en contactant le support."
        confirmLabel="Désactiver"
        onConfirm={handleDeactivate}
        variant="danger"
      />
      <ConfirmSheet
        open={deleteSheetOpen}
        onClose={() => setDeleteSheetOpen(false)}
        title="Supprimer mon compte ?"
        message="Votre compte et vos données personnelles seront supprimés immédiatement et définitivement. Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        onConfirm={handleDelete}
        variant="danger"
      />
      <ConfirmSheet
        open={logoutSheetOpen}
        onClose={() => setLogoutSheetOpen(false)}
        title="Se déconnecter ?"
        message="Vous serez ramené à l'écran de connexion."
        confirmLabel="Déconnexion"
        onConfirm={handleLogout}
        variant="danger"
      />
    </div>
  );
}
