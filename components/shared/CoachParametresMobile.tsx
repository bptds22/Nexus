"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachParametresMobile — Paramètres mobile coach (Phase 2).

   Composes the shared iOS-Settings vocabulary
   (components/shared/settings/*) with COACH content :

   1. Subscription bandeau (Gratuit / Pro — 2 tiers only)
   2. Profil    — NavRow → CoachProfilEditMobile drill-down
   3. École / Ligue affiliation
                — read-only Group of school/team fields ; label
                  follows users.context (école vs ligue civile) ;
                  "Modifier" NavRow shown only to school admins
                  (points at the existing desktop edit screen until
                  a mobile edit screen is built — TODO Phase 3)
   4. Admin école / Admin ligue (CONDITIONAL on users.is_school_admin)
                — NavRow → drill-down (deferred to desktop for now)
   5. Notifications — 6 ToggleRows (one per coach pref, piloting
                  the `inApp` flag) + master "Recevoir aussi par
                  courriel" toggle at the bottom (computed from
                  email_* flags, mirror on flip). Per-group save bar.
   6. Abonnement — 2 TierCards (Free / Pro) at coach pricing
                  ($4.99/mo, $39/yr). Civil variant relabels Mon
                  École → Ma Ligue in the feature lists.
   7. Confidentialité (slim) — 2 external NavRows + read-only
                  consent dates. NO discoverability toggles.
   8. Compte    — Changer le mot de passe
   9. Zone danger — Supprimer mon compte (typed SUPPRIMER) +
                  Déconnexion

   PII layer : users.notification_preferences (JSONB),
   users.privacy_preferences (consent dates only — coach has no
   discoverability toggles), school_coaches.sport, school_directors,
   users.is_school_admin, users.context.

   No FeatureGate — coach baseline is free.
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
import { startMobilePortal, fmtSubDate, subStatusLabel } from "@/components/shared/settings/utils";

/* ── Coach notification rows (DB JSONB — desktop NotificationsSection) ── */

const NOTIF_ROWS: {
  key: string;
  appKey: string;
  emailKey: string;
  label: string;
  sublabel: string;
}[] = [
  { key: "newContactRequest",  appKey: "app_new_contact_request",  emailKey: "email_new_contact_request",
    label: "Nouvelle demande de contact", sublabel: "Un recruteur veut contacter un de tes athlètes" },
  { key: "athleteFavorited",   appKey: "app_athlete_favorited",    emailKey: "email_athlete_favorited",
    label: "Athlète ajouté en favori",     sublabel: "Un recruteur a ajouté un de tes athlètes en favori" },
  { key: "pipelineMovement",   appKey: "app_pipeline_movement",    emailKey: "email_pipeline_movement",
    label: "Mouvement dans un processus",   sublabel: "Un athlète a changé d'étape côté recruteur" },
  { key: "profileIncomplete",  appKey: "app_profile_incomplete",   emailKey: "email_profile_incomplete",
    label: "Profil athlète incomplet",     sublabel: "Un athlète a un profil sous 60 %" },
  { key: "newMessage",         appKey: "app_new_message",          emailKey: "email_new_message",
    label: "Nouveau message reçu",         sublabel: "Un recruteur t'a écrit" },
  { key: "evaluationRequested",appKey: "app_evaluation_requested", emailKey: "email_evaluation_requested",
    label: "Évaluation demandée",          sublabel: "Un recruteur demande ton évaluation d'un athlète" },
];

interface NotifPrefs { [k: string]: boolean | string }
interface PrivacyDates {
  consent_privacy_policy?: string | null;
  consent_data_collection?: string | null;
  consent_marketing?: string | null;
}

interface SchoolInfo {
  name: string;
  city: string;
  region: string;
  conference: string;
  division: string;
  ageGroup: string;
  teamName: string;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function CoachParametresMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const { tier, isStripeManaged, refresh, periodEnd, billing, status, cancelAtPeriodEnd } = useSubscription();

  // Coach only has Free/Pro per business rules ; an "all_star" DB
  // value collapses to Pro for display.
  const displayTier: "free" | "pro" = tier === "free" ? "free" : "pro";

  /* State (hooks BEFORE any early return — Rules of Hooks). */
  const [notifs, setNotifs] = useState<NotifPrefs>({});
  const [origNotifs, setOrigNotifs] = useState<NotifPrefs>({});
  const [masterEmail, setMasterEmail] = useState(false);
  const [origMasterEmail, setOrigMasterEmail] = useState(false);

  const [consentDates, setConsentDates] = useState<{ privacy?: string; data?: string; marketing?: string | null }>({});
  const [signupDate, setSignupDate] = useState<string>("");

  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [isCivilCoach, setIsCivilCoach] = useState(false);
  const [school, setSchool] = useState<SchoolInfo | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);

  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  /* ── Portail Stripe mobile : fetch /api/stripe/portal (Bearer) +
        in-app browser. Erreur visible (toast). ── */
  async function handlePortal() {
    if (portalBusy) return;
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

  /* Refresh le tier au retour de l'in-app browser (portail). Plugins
     absents sur web → no-op. Parité avec RecruteurParametresMobile. */
  useEffect(() => {
    let bl: { remove: () => void } | null = null;
    let al: { remove: () => void } | null = null;
    (async () => {
      try {
        const { Browser } = await import("@capacitor/browser");
        bl = await Browser.addListener("browserFinished", () => { refresh(); });
      } catch { /* web */ }
      try {
        const { App } = await import("@capacitor/app");
        al = await App.addListener("appStateChange", ({ isActive }) => { if (isActive) refresh(); });
      } catch { /* web */ }
    })();
    return () => { bl?.remove(); al?.remove(); };
  }, [refresh]);

  // Lot 0 — re-pull du tier au montage (le Provider peut être périmé au
  // lancement → un payant s'afficherait "Gratuit" → jamais de bouton "Gérer").
  useEffect(() => { refresh(); }, [refresh]);

  /* ── Load user prefs + school context ─────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: u } = await supabase
        .from("users")
        .select("notification_preferences, privacy_preferences, is_school_admin, context, school_id")
        .eq("id", user.id)
        .single();
      if (cancelled) return;

      // Notification prefs
      const n = (u?.notification_preferences as NotifPrefs) || {};
      const seedNotif: NotifPrefs = {};
      for (const row of NOTIF_ROWS) {
        seedNotif[row.appKey] = n[row.appKey] !== false;
        seedNotif[row.emailKey] = !!n[row.emailKey];
      }
      seedNotif.marketing_emails = !!n.marketing_emails;
      setNotifs(seedNotif);
      setOrigNotifs(seedNotif);
      const anyEmailOn = NOTIF_ROWS.some((r) => !!seedNotif[r.emailKey]);
      setMasterEmail(anyEmailOn);
      setOrigMasterEmail(anyEmailOn);

      // Consent dates (no privacy toggles for coach)
      const p = (u?.privacy_preferences as PrivacyDates) || {};
      const fmt = (iso?: string | null) => iso
        ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })
        : "";
      setConsentDates({
        privacy: fmt(p.consent_privacy_policy),
        data: fmt(p.consent_data_collection),
        marketing: p.consent_marketing ? fmt(p.consent_marketing) : null,
      });
      if (user.created_at) {
        setSignupDate(new Date(user.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }));
      }

      // Context flags
      const civilCoach = u?.context === "ligue_civile";
      setIsCivilCoach(civilCoach);
      setIsSchoolAdmin(!!u?.is_school_admin);

      // School/team affiliation (read-only display). The coach's
      // primary team is via school_coaches → teams + schools.
      const schoolId = u?.school_id as string | null | undefined;
      if (schoolId) {
        const { data: s } = await supabase
          .from("schools")
          .select("name, city, region, conference, division, age_group")
          .eq("id", schoolId)
          .single();
        const { data: tc } = await supabase
          .from("school_coaches")
          .select("teams(name)")
          .eq("user_id", user.id)
          .eq("school_id", schoolId)
          .limit(1);
        const teamRel = (tc?.[0] as Record<string, unknown> | undefined)?.teams;
        const team = (Array.isArray(teamRel) ? teamRel[0] : teamRel) as { name?: string } | null;
        if (!cancelled) {
          setSchool({
            name: (s?.name as string) || "",
            city: (s?.city as string) || "",
            region: (s?.region as string) || "",
            conference: (s?.conference as string) || "",
            division: (s?.division as string) || "",
            ageGroup: (s?.age_group as string) || "",
            teamName: team?.name || "",
          });
        }
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const notifsDirty = useMemo(
    () => JSON.stringify(notifs) !== JSON.stringify(origNotifs) || masterEmail !== origMasterEmail,
    [notifs, origNotifs, masterEmail, origMasterEmail],
  );

  /* ── Save handlers ────────────────────────────────────────── */

  async function saveNotifs() {
    if (!notifsDirty || savingNotifs) return;
    triggerHaptic("Medium");
    setSavingNotifs(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // master ON  ⇒ email_X = app_X (mirror) ; master OFF ⇒ all email_X = false.
      // marketing_emails stays independent.
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

  async function handleLogout() {
    triggerHaptic("Medium");
    const supabase = createClient();
    try { localStorage.removeItem("nexus_user"); } catch { /* no-op */ }
    await supabase.auth.signOut();
    setLogoutSheetOpen(false);
    router.push("/auth");
  }

  async function handleDelete() {
    if (deleteConfirmText !== "SUPPRIMER") return;
    triggerHaptic("Heavy");
    setDeleteSheetOpen(false);
    // Suppression DÉFINITIVE via la RPC delete_my_account (helper partagé :
    // signOut + redirection dedans). Remplace l'ancien request_account_deletion
    // (RPC inexistante → l'appel échouait systématiquement).
    await deleteMyAccount({
      onError: (detail) => toast.error({ message: "Échec de la suppression", detail }),
    });
  }

  function handleBack() {
    triggerHaptic("Light");
    router.push("/coach/tableau-de-bord");
  }

  /* ── Tier display ─────────────────────────────────────────── */

  const tierLabel = displayTier === "pro" ? "Pro" : "Gratuit";
  const ecoleLabel = isCivilCoach ? "Ma Ligue" : "Mon École";
  const ecoleStatsLabel = isCivilCoach ? "Stats Ligue" : "Stats École";
  const sectionEcoleLabel = isCivilCoach ? "Ligue & équipe" : "École & programme";
  const sectionAdminLabel = isCivilCoach ? "Admin ligue" : "Admin école";

  /* ─────────────────────────────────────────────────────────── */

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

      {/* Subscription bandeau */}
      <div className="px-4 pt-6 pb-2">
        <div className="rounded-2xl bg-[#1A1D24] border border-white/[0.06] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
              <span className="text-[13px] text-[#9CA3AF]">Plan actuel</span>
            </div>
            <span className="text-[14px] font-semibold text-white uppercase tracking-wider">{tierLabel}</span>
          </div>
          {displayTier === "free" && (
            <p className="text-[12px] text-[#6b7280] mt-2">Passe à Pro pour {ecoleLabel.toLowerCase()}, {ecoleStatsLabel.toLowerCase()} et plus.</p>
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
              <button
                type="button"
                onClick={handlePortal}
                disabled={portalBusy}
                className="w-full h-11 rounded-xl border border-white/15 text-white font-bold text-[12px] uppercase tracking-wider active:bg-white/5 disabled:opacity-60"
              >
                {portalBusy ? "Ouverture…" : "Gérer mon abonnement"}
              </button>
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

      {/* PROFIL — drill-down */}
      <SectionLabel>Profil</SectionLabel>
      <Group>
        <NavRow
          label="Modifier mon profil"
          sublabel="Photo, nom, sport, langue, téléphone"
          isFirst
          onTap={() => { triggerHaptic("Light"); router.push("/coach/parametres/profil"); }}
        />
      </Group>

      {/* ÉCOLE / LIGUE — read-only Group + (admin) édition desktop */}
      <SectionLabel>{sectionEcoleLabel}</SectionLabel>
      {school ? (
        <>
          <Group>
            <NavRow label={isCivilCoach ? "Nom de la ligue" : "Nom de l'école"} value={school.name || "—"} isFirst rightChevron="none" />
            {school.teamName && <NavRow label="Équipe" value={school.teamName} isFirst={false} rightChevron="none" />}
            {school.city && <NavRow label="Ville" value={school.city} isFirst={false} rightChevron="none" />}
            {school.region && <NavRow label="Région" value={school.region} isFirst={false} rightChevron="none" />}
            {school.division && <NavRow label="Division" value={school.division} isFirst={false} rightChevron="none" />}
            {school.ageGroup && <NavRow label="Catégorie d'âge" value={school.ageGroup} isFirst={false} rightChevron="none" />}
          </Group>
          {isSchoolAdmin && (
            <Group className="mt-2">
              <NavRow
                label={isCivilCoach ? "Modifier la ligue" : "Modifier l'école"}
                sublabel="Disponible sur l'écran de bureau"
                isFirst
                rightChevron="external"
                onTap={() => openExternal("https://nexussports.ca/coach/settings")}
              />
            </Group>
          )}
        </>
      ) : (
        <Group>
          <NavRow label="Aucune affiliation" sublabel="Rejoins une école ou une ligue depuis ton profil." isFirst rightChevron="none" />
        </Group>
      )}

      {/* ADMIN ÉCOLE / LIGUE — conditional on is_school_admin */}
      {isSchoolAdmin && (
        <>
          <SectionLabel>{sectionAdminLabel}</SectionLabel>
          <Group>
            <NavRow
              label={isCivilCoach ? "Administration de la ligue" : "Administration de l'école"}
              sublabel="Gestion des directeurs (écran de bureau)"
              isFirst
              rightChevron="external"
              onTap={() => openExternal("https://nexussports.ca/coach/settings")}
            />
          </Group>
        </>
      )}

      {/* NOTIFICATIONS */}
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

      {/* ABONNEMENT — 2 TierCards (Free / Pro), coach pricing */}
      <SectionLabel>Abonnement</SectionLabel>
      <div className="px-4 space-y-2">
        <TierCard
          name="Gratuit"
          price="0 $"
          period=""
          features={[
            "Profil coach + création d'athlètes",
            "Évaluations + vérification",
            "Messagerie avec recruteurs",
          ]}
          status={tierStatus(displayTier, "free")}
        />
        <TierCard
          name="Pro"
          price="4,99 $"
          period="/mois"
          features={[
            `${ecoleLabel} complète + ${ecoleStatsLabel}`,
            "Placements & suivi",
            "Ma Réputation + analytics profils",
            "Alertes recruteurs en temps réel",
          ]}
          status={tierStatus(displayTier, "pro")}
          accentDot="#F59E0B"
          onUpgrade={() => router.push("/tarifs")}
          upgradeLabel="Passer à Pro"
        />
      </div>

      {/* CONFIDENTIALITÉ — slim (no discoverability toggles) */}
      <SectionLabel>Confidentialité</SectionLabel>
      <Group>
        <NavRow
          label="Politique de confidentialité"
          isFirst
          rightChevron="external"
          onTap={() => openExternal("https://nexussports.ca/confidentialite")}
        />
        <NavRow
          label="Exporter mes données (Loi 25)"
          isFirst={false}
          rightChevron="external"
          onTap={() => openExternal("https://nexussports.ca/coach/settings?section=confidentialite")}
        />
      </Group>
      <div className="px-6 pt-3 text-[11px] text-[#6b7280] leading-5">
        {signupDate && <p>Inscription : {signupDate}</p>}
        {consentDates.privacy && <p>Consentement politique : {consentDates.privacy}</p>}
        {consentDates.data && <p>Consentement données : {consentDates.data}</p>}
        {consentDates.marketing && <p>Consentement marketing : {consentDates.marketing}</p>}
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
          label="Supprimer mon compte"
          isFirst
          onTap={() => {
            triggerHaptic("Light");
            setDeleteConfirmText("");
            setDeleteReason("");
            setDeleteSheetOpen(true);
          }}
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
        open={deleteSheetOpen}
        onClose={() => setDeleteSheetOpen(false)}
        title="Supprimer mon compte ?"
        message="Ton compte et tes données personnelles seront supprimés immédiatement et définitivement. Cette action est irréversible. Tape SUPPRIMER pour confirmer."
        confirmLabel={deleteConfirmText === "SUPPRIMER" ? "Supprimer définitivement" : "Tape SUPPRIMER"}
        onConfirm={handleDelete}
        variant="danger"
        confirmDisabled={deleteConfirmText !== "SUPPRIMER"}
        extra={
          <div className="space-y-3">
            <input
              type="text"
              autoCapitalize="characters"
              autoCorrect="off"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
              placeholder="SUPPRIMER"
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-2xl px-4 py-3 text-[16px] text-white placeholder:text-[#4a4d56] focus:outline-none focus:border-[#E63946]/50 tracking-widest text-center font-bold"
            />
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Optionnel : Pourquoi pars-tu ?"
              rows={2}
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-2xl px-4 py-2.5 text-[14px] text-white placeholder:text-[#4a4d56] focus:outline-none focus:border-[#E63946]/50 resize-none"
            />
          </div>
        }
      />

      <ConfirmSheet
        open={logoutSheetOpen}
        onClose={() => setLogoutSheetOpen(false)}
        title="Se déconnecter ?"
        message="Tu seras ramené à l'écran de connexion."
        confirmLabel="Déconnexion"
        onConfirm={handleLogout}
        variant="danger"
      />
    </div>
  );
}
