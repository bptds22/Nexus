"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteParametresMobile — Paramètres mobile athlete (Sprint Param-B1).

   Composes the shared iOS-Settings vocabulary
   (components/shared/settings/*) with ATHLETE content. Mirrors the
   recruiter + coach mobile companions in format (single vertical
   scroll, sticky header + safe-area-inset-top, Group/SectionLabel/
   NavRow/DangerRow/TierCard + PasswordChangeSheet + ConfirmSheet).

   Locked B1 decisions :
     • Mon coach READ-ONLY (display name only) — change flow stays
       on desktop for now.
     • Profil NavRow routes to /athlete/profil (no /edit sub-route ;
       the existing page IS the edit page — gates AthleteEditWizardMobile
       on IS_CAPACITOR).
     • Back goes to /athlete/dashboard (athlete dashboard route name,
       NOT /tableau-de-bord which is coach + recruiter convention).
     • Notifications + Confidentialité stubbed with "À venir" rows —
       Sprint Param-B2 wires their JSONB persistence + partner opt-in.
     • Compte > Langue rendered as read-only ("Français") for v1 ;
       English ships later (matches desktop's `English — disponible
       prochainement` note).
     • Zone danger > Supprimer mon compte reuses the SAME RPC the
       desktop deactivateAccount() uses — supabase.rpc(
       "deactivate_my_account", { p_revoke_consent: false }).

   No FeatureGate ; athlete baseline is free with Pro upgrade CTA.
═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { isMinor } from "@/lib/utils/age";
import { PARTNER_MEDIA_COPY, partnerResponsibilityText } from "@/lib/legal/partnerMediaCopy";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  triggerHaptic, tierStatus,
  SectionLabel, Group, ToggleRow, NavRow, DangerRow,
  TierCard, PasswordChangeSheet, ConfirmSheet,
} from "@/components/shared/settings";
import { startMobilePortal, fmtSubDate, subStatusLabel } from "@/components/shared/settings/utils";
import { deleteMyAccount } from "@/lib/auth/deleteAccount";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ── Athlete notification rows — additive keys on users.notification_preferences JSONB.
   Consentement marketing seulement — les bascules de notification ont été
   through the master "Recevoir aussi par courriel" toggle. The 7 athlete keys live in
   the SAME JSONB as the coach/recruiter keys — no migration needed, additive only. */

interface NotifPrefs { [k: string]: boolean | string }

interface AthleteProfile {
  email: string;
  context: string | null;
  schoolName: string;
  leagueTeamName: string;
  leagueName: string;
  coachName: string;
  /* B2 — Confidentialité fields (mirror desktop page.tsx L168-184). */
  dateOfBirth: string | null;
  partnerOptIn: boolean;
  partnerOptInDate: string | null;
  partnerParentalConsent: boolean;
  parentalConsentDate: string | null;
}

export function AthleteParametresMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const { tier, isStripeManaged, refresh, periodEnd, billing, status, cancelAtPeriodEnd } = useSubscription();

  // Athlete only has Free / Pro per business rules ; any legacy
  // "all_star" DB value collapses to Pro for display.
  const displayTier: "free" | "pro" = tier === "free" ? "free" : "pro";

  /* ── State (hooks BEFORE any early return — Rules of Hooks 7.8d) */
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signupDate, setSignupDate] = useState<string>("");

  /* B2 — Notifications state (load → mutate → save back as whole JSONB).
     Seed mirrors coach pattern : app_X = true unless explicit false ; email_X = false unless explicit true.
     `origNotifs` snapshot drives the dirty-CTA. */
  // Consentement marketing — registre DATÉ (privacy_preferences.consent_marketing).
  const [marketingOn, setMarketingOn] = useState(false);
  const [origMarketingOn, setOrigMarketingOn] = useState(false);
  const [savingMarketing, setSavingMarketing] = useState(false);

  // Amorce du consentement marketing depuis le registre daté. Effet dédié
  // plutôt qu'un branchement dans le chargeur de chaque écran : la source est
  // la même partout (privacy_preferences.consent_marketing), la logique aussi.
  const [marketingDate, setMarketingDate] = useState<string | null>(null);
  useEffect(() => {
    let annule = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || annule) return;
      const { data } = await supabase
        .from("users").select("privacy_preferences").eq("id", user.id).maybeSingle();
      if (annule) return;
      const iso = (data?.privacy_preferences as Record<string, unknown> | null)?.consent_marketing as string | null | undefined;
      setMarketingOn(!!iso);
      setOrigMarketingOn(!!iso);
      setMarketingDate(iso ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : null);
    })();
    return () => { annule = true; };
  }, []);

  const [portalBusy, setPortalBusy] = useState(false);

  /* ── Portail Stripe mobile (Lot 2 — handler partagé startMobilePortal :
        Bearer + Browser.open). Erreur visible, jamais avalée. ── */
  async function handlePortal() {
    if (portalBusy) return;
    if (IS_CAPACITOR) return; // iOS (3.1.1) : pas de portail de paiement in-app.
    triggerHaptic("Light");
    setPortalBusy(true);
    try {
      await startMobilePortal();
    } catch (e) {
      toast.error({ message: "Portail indisponible", detail: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setPortalBusy(false);
    }
  }

  /* Refresh le tier au montage + au retour de l'in-app browser (parité
     coach/recruteur). Plugins absents sur web → no-op. */
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    let bl: { remove: () => void } | null = null;
    let al: { remove: () => void } | null = null;
    (async () => {
      try { const { Browser } = await import("@capacitor/browser"); bl = await Browser.addListener("browserFinished", () => { refresh(); }); } catch { /* web */ }
      try { const { App } = await import("@capacitor/app"); al = await App.addListener("appStateChange", ({ isActive }) => { if (isActive) refresh(); }); } catch { /* web */ }
    })();
    return () => { bl?.remove(); al?.remove(); };
  }, [refresh]);

  /* B2 — Confidentialité partner-opt-in saving flag (gates the toggle while in flight). */
  const [savingPartnerOptIn, setSavingPartnerOptIn] = useState(false);

  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [revokeConsentSheetOpen, setRevokeConsentSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);

  /* B3 — Confidentialité collapsible explainer (partner media). Default
     collapsed so the toggle stays clean ; details on demand. */
  const [explainerOpen, setExplainerOpen] = useState(false);

  /* ── Load athlete affiliation + consent state + notification prefs ─
     Mirrors the desktop page.tsx loadProfile() shape (the join graph :
     schools!school_id, team_athletes → teams → schools, users!coach_id_fkey).
     B2 expansion : pulls partner_visibility_* + consentement_parental*
     + date_naissance + users.notification_preferences (desktop L131-186). */
  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: row } = await supabase
      .from("athletes")
      .select(`
        school_id,
        coach_id,
        date_naissance,
        consentement_parental,
        consentement_parental_date,
        partner_visibility_opt_in,
        partner_visibility_opted_in_at,
        partner_visibility_parental_consent,
        schools!school_id(name),
        team_athletes(team_id, teams!team_id(name, schools!school_id(name, type))),
        users!athletes_coach_id_fkey(first_name, last_name)
      `)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: userRow } = await supabase
      .from("users")
      .select("context, notification_preferences")
      .eq("id", user.id)
      .maybeSingle();

    if (!row) { setLoading(false); return; }

    const schoolRel = Array.isArray(row.schools) ? row.schools[0] : row.schools;
    const taRel = Array.isArray(row.team_athletes) ? row.team_athletes[0] : row.team_athletes;
    const taRow = taRel as { team_id?: string; teams?: unknown } | null;
    const teamRelRaw = taRow?.teams;
    const teamRel = (Array.isArray(teamRelRaw) ? teamRelRaw[0] : teamRelRaw) as { name?: string; schools?: unknown } | null;
    const leagueRelRaw = teamRel?.schools;
    const leagueRel = (Array.isArray(leagueRelRaw) ? leagueRelRaw[0] : leagueRelRaw) as { name?: string } | null;
    const coachRel = Array.isArray(row.users) ? row.users[0] : row.users;

    setProfile({
      email: user.email ?? "",
      context: (userRow?.context as string | null) ?? null,
      schoolName: (schoolRel as { name?: string } | null)?.name ?? "",
      leagueTeamName: teamRel?.name ?? "",
      leagueName: leagueRel?.name ?? "",
      coachName: coachRel
        ? `${(coachRel as { first_name?: string }).first_name ?? ""} ${(coachRel as { last_name?: string }).last_name ?? ""}`.trim()
        : "",
      dateOfBirth: (row.date_naissance as string | null) ?? null,
      partnerOptIn: row.partner_visibility_opt_in === true,
      partnerOptInDate: (row.partner_visibility_opted_in_at as string | null) ?? null,
      partnerParentalConsent: row.partner_visibility_parental_consent === true,
      parentalConsentDate: (row.consentement_parental_date as string | null) ?? null,
    });

    /* Seed notification state — preserve the WHOLE existing JSONB so other roles'
       keys survive the eventual write-back (merge-write discipline, mirrors the
       parcours_readiness pattern). Then overlay defaults for the 7 athlete keys. */
    const n = (userRow?.notification_preferences as NotifPrefs) || {};

    if (user.created_at) {
      setSignupDate(new Date(user.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }));
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  /* ── Notifications : dirty + save (mirrors recruiter L162-202 / coach L209-244) ── */

  /* Le consentement marketing s'écrit par FUSION, jamais par remplacement :
     privacy_preferences porte aussi les consentements parentaux
     (consent_parental_profile, _visibility, _partner_visibility) et les dates
     de politique. Écraser l'objet entier détruirait des preuves légales. On
     relit donc la valeur courante et on n'y change qu'une clé. */
  async function saveMarketing() {
    if (marketingOn === origMarketingOn || savingMarketing) return;
    triggerHaptic("Medium");
    setSavingMarketing(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: courant } = await supabase
        .from("users").select("privacy_preferences").eq("id", user.id).maybeSingle();
      const base = (courant?.privacy_preferences as Record<string, unknown>) || {};
      const { error } = await supabase
        .from("users")
        .update({ privacy_preferences: { ...base, consent_marketing: marketingOn ? new Date().toISOString() : null } })
        .eq("id", user.id);
      if (error) { toast.error({ message: "Échec sauvegarde", detail: error.message }); return; }
      setOrigMarketingOn(marketingOn);
      toast.success({ message: marketingOn ? "Consentement enregistré" : "Consentement retiré" });
    } finally {
      setSavingMarketing(false);
    }
  }



  /* ── Confidentialité : partner opt-in + parental consent (atomic).
        Mirrors desktop page.tsx L571-661 — the minor-gating logic :
          const minor = isMinor(profile.dateOfBirth);
          const consentReady = !minor || profile.partnerParentalConsent;
          const toggleEnabled = consentReady && !savingPartnerOptIn;
        A minor CANNOT enable opt-in without parental consent given first. ── */

  async function togglePartnerParentalConsent(checked: boolean) {
    if (!profile) return;
    triggerHaptic("Light");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    /* Mirror desktop L578-582 : if parent UNCHECKS while opt-in is on,
       also turn opt-in off (atomic — parental consent is the gate). */
    const updates: Record<string, unknown> = { partner_visibility_parental_consent: checked };
    if (!checked && profile.partnerOptIn) {
      updates.partner_visibility_opt_in = false;
      updates.partner_visibility_opted_in_at = null;
    }

    const { error } = await supabase
      .from("athletes")
      .update(updates)
      .eq("user_id", user.id);

    if (error) {
      toast.error({ message: "Échec sauvegarde", detail: error.message });
      return;
    }
    toast.success({ message: checked ? "Consentement parental enregistré" : "Consentement retiré" });
    await loadProfile();
  }

  async function togglePartnerOptIn(next: boolean) {
    if (!profile) return;
    const minor = isMinor(profile.dateOfBirth);
    const consentReady = !minor || profile.partnerParentalConsent;
    if (!consentReady || savingPartnerOptIn) return;  /* gating mirrors desktop L562-563 */

    triggerHaptic("Light");
    setSavingPartnerOptIn(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingPartnerOptIn(false); return; }

    /* Mirror desktop L621-631 : atomic opt-in update.
         ON  ⇒ set opt-in true + stamp opted_in_at + force parental consent
               (defensive : minor opt-in requires consent which we just verified). */
    const updates: Record<string, unknown> = next
      ? {
          partner_visibility_opt_in: true,
          partner_visibility_opted_in_at: new Date().toISOString(),
          partner_visibility_parental_consent: minor ? true : profile.partnerParentalConsent,
        }
      : {
          partner_visibility_opt_in: false,
          partner_visibility_opted_in_at: null,
        };

    const { error } = await supabase
      .from("athletes")
      .update(updates)
      .eq("user_id", user.id);

    if (error) {
      toast.error({ message: "Échec sauvegarde", detail: error.message });
      setSavingPartnerOptIn(false);
      return;
    }
    toast.success({ message: next ? "Visibilité partenaire activée" : "Visibilité partenaire désactivée" });
    setSavingPartnerOptIn(false);
    await loadProfile();
  }

  /* ── Retirer le consentement (Loi 25 revocation) — desktop page.tsx L113-120.
        Same RPC as handleDelete but with p_revoke_consent=true. The RPC is
        SECURITY DEFINER ; sets users.status='DESACTIVE' + records the revocation.
        Middleware doesn't kill live sessions → sign out explicitly + redirect. */
  async function handleRevokeConsent() {
    triggerHaptic("Heavy");
    const supabase = createClient();
    const { error } = await supabase.rpc("deactivate_my_account", { p_revoke_consent: true });
    if (error) {
      toast.error({ message: "Échec du retrait", detail: error.message });
      return;
    }
    try { localStorage.removeItem("nexus_user"); } catch { /* no-op */ }
    await supabase.auth.signOut();
    setRevokeConsentSheetOpen(false);
    router.push("/auth");
  }

  /* ── Suppression DÉFINITIVE — RPC delete_my_account via le helper
        partagé (signOut + redirection gérés dedans). À NE PAS confondre
        avec handleRevokeConsent (retrait de consentement, réversible). ── */

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
    router.push("/athlete/dashboard");
  }

  const tierLabel = displayTier === "pro" ? "Pro" : "Gratuit";
  const isCivil = profile?.context === "ligue_civile";

  /* ── Loading early return (AFTER all hooks) ──────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
        {/* Sticky header shell (matches loaded layout) */}
        <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="h-11 flex items-center px-4">
            <Skeleton className="w-24 h-5 rounded-full mx-auto" />
          </div>
        </div>
        {/* Subscription bandeau placeholder */}
        <div className="px-4 pt-6 pb-2">
          <Skeleton className="w-full h-16 rounded-2xl" />
        </div>
        {/* Section groups (label + card) ×4 */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-4 pt-5">
            <Skeleton className="w-28 h-3 rounded-full mb-3" />
            <Skeleton className="w-full h-14 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Header — verbatim from RecruteurParametresMobile L270-286 */}
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

      {/* PROFIL — drill-down to existing /athlete/profil (no /edit) */}
      <SectionLabel>Profil</SectionLabel>
      <Group>
        <NavRow
          label="Modifier mon profil"
          sublabel="Photo, infos, sport, position…"
          isFirst
          onTap={() => { triggerHaptic("Light"); router.push("/athlete/profil"); }}
        />
      </Group>

      {/* MON ÉCOLE / MON ÉQUIPE — read-only display */}
      <SectionLabel>{isCivil ? "Mon équipe" : "Mon école"}</SectionLabel>
      {isCivil ? (
        profile?.leagueTeamName ? (
          <Group>
            <NavRow label="Équipe" value={profile.leagueTeamName} isFirst rightChevron="none" />
            {profile.leagueName && (
              <NavRow label="Ligue" value={profile.leagueName} isFirst={false} rightChevron="none" />
            )}
          </Group>
        ) : (
          <Group>
            <NavRow
              label="Aucune équipe"
              sublabel="Rejoins une équipe depuis ton profil."
              isFirst
              rightChevron="none"
            />
          </Group>
        )
      ) : profile?.schoolName ? (
        <Group>
          <NavRow label="École" value={profile.schoolName} isFirst rightChevron="none" />
        </Group>
      ) : (
        <Group>
          <NavRow
            label="Aucune école"
            sublabel="Complète ton profil pour rejoindre une école."
            isFirst
            rightChevron="none"
          />
        </Group>
      )}

      {/* MON COACH — read-only (no change affordance per B1 decision) */}
      <SectionLabel>Mon coach</SectionLabel>
      <Group>
        {profile?.coachName ? (
          <NavRow label="Coach" value={profile.coachName} isFirst rightChevron="none" />
        ) : (
          <NavRow
            label="Aucun coach assigné"
            sublabel="Tu peux sélectionner un coach depuis le web."
            isFirst
            rightChevron="none"
          />
        )}
      </Group>

      {/* NOTIFICATIONS — 7 athlete ToggleRows + master email + marketing */}
      {/* COMMUNICATIONS — voir RecruteurParametresMobile pour le raisonnement
          complet. En résumé : les six bascules de notification et le maître
          « recevoir aussi par courriel » écrivaient dans
          users.notification_preferences, qu'AUCUN émetteur ne lit. Retirées.
          Le consentement marketing reste et pointe désormais sur le registre
          daté, privacy_preferences.consent_marketing : accorder écrit la date,
          retirer écrit null — le retrait doit être aussi simple que le
          consentement (Loi 25). */}
      <SectionLabel>Communications</SectionLabel>
      <Group>
        <ToggleRow
          label="Emails marketing"
          sublabel={marketingDate
            ? `Consenti le ${marketingDate} — désactive pour retirer`
            : "Annonces produit et infolettre"}
          isFirst
          checked={marketingOn}
          onChange={setMarketingOn}
        />
      </Group>
      {marketingOn !== origMarketingOn && (
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={saveMarketing}
            disabled={savingMarketing}
            className="w-full h-11 rounded-2xl bg-[#E63946] text-white text-[14px] font-semibold active:bg-[#D42B22] disabled:opacity-60"
          >
            {savingMarketing ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      )}

      {/* CONFIDENTIALITÉ — partner media opt-in + minor-consent gating + read-only dates */}
      <SectionLabel>Confidentialité</SectionLabel>
      {(() => {
        if (!profile) return null;
        const minor = isMinor(profile.dateOfBirth);
        const consentReady = !minor || profile.partnerParentalConsent;
        return (
          <>
            <Group>
              {minor && (
                <ToggleRow
                  label="Consentement parental"
                  sublabel="Requis avant d'activer la visibilité partenaire (mineur)."
                  isFirst
                  checked={profile.partnerParentalConsent}
                  onChange={togglePartnerParentalConsent}
                />
              )}
              {consentReady ? (
                <ToggleRow
                  label="Visibilité partenaires médias"
                  sublabel="Permet aux partenaires médias approuvés de télécharger ta carte Nexus."
                  isFirst={!minor}
                  checked={profile.partnerOptIn}
                  onChange={togglePartnerOptIn}
                />
              ) : (
                /* Minor without parental consent — show muted read-only row
                   instead of a disabled toggle (clearer than an unresponsive switch). */
                <NavRow
                  label="Visibilité partenaires médias"
                  sublabel="Active le consentement parental ci-dessus pour autoriser cette option."
                  isFirst={false}
                  rightChevron="none"
                />
              )}
              {/* "En savoir plus" disclosure — collapsed by default.
                  Visual matches NavRow (52px min-height + 0.5px top divider)
                  but with a custom chevron that rotates 180° on open. */}
              <button
                type="button"
                onClick={() => { triggerHaptic("Light"); setExplainerOpen((v) => !v); }}
                aria-expanded={explainerOpen ? "true" : "false"}
                className="w-full flex items-center px-4 active:bg-white/[0.04] text-left"
                style={{ minHeight: 52, borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex-1 min-w-0 py-3">
                  <p className="text-[15px] text-white">En savoir plus</p>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-2 shrink-0"
                  style={{
                    transform: explainerOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 200ms ease-out",
                  }}
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {explainerOpen && (
                <div
                  className="px-4 py-3 text-[12px] text-[#9CA3AF] leading-relaxed space-y-3"
                  style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
                >
                  <p>{PARTNER_MEDIA_COPY.intro}</p>
                  <p>
                    <span className="font-bold text-white">Ce qui apparaît sur la carte :</span>{" "}
                    {PARTNER_MEDIA_COPY.whatAppears}
                  </p>
                  <p className="font-bold text-white">Ce que cela signifie concrètement :</p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    {PARTNER_MEDIA_COPY.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <p className="pt-1">{partnerResponsibilityText("self")}</p>
                </div>
              )}
            </Group>
            {/* Read-only consent dates footer (mirrors recruiter L402-407) */}
            <div className="px-6 pt-3 text-[11px] text-[#6b7280] leading-5">
              {signupDate && <p>Inscription : {signupDate}</p>}
              {profile.parentalConsentDate && (
                <p>
                  Consentement parental :{" "}
                  {new Date(profile.parentalConsentDate).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
              {profile.partnerOptIn && profile.partnerOptInDate && (
                <p className="text-[#22C55E]">
                  Visibilité partenaire activée le{" "}
                  {new Date(profile.partnerOptInDate).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          </>
        );
      })()}

      {/* ABONNEMENT — Plan actuel + portail/notice + TierCards */}
      <SectionLabel>Abonnement</SectionLabel>
      {/* Plan actuel (déplacé ici, sous le label Abonnement) */}
      <div className="px-4 pt-1 pb-2">
        <div className="rounded-2xl bg-[#1A1D24] border border-white/[0.06] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
              <span className="text-[13px] text-[#9CA3AF]">Plan actuel</span>
            </div>
            <span className="text-[14px] font-semibold text-white uppercase tracking-wider">{tierLabel}</span>
          </div>
          {displayTier === "free" && (
            <p className="text-[12px] text-[#6b7280] mt-2">Voir qui consulte ton profil — réservé aux membres Pro.</p>
          )}
          {/* Payant + vrai abo Stripe → résumé + portail (in-app browser). */}
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
      <div className="px-4 space-y-2">
        <TierCard
          name="Gratuit"
          price="0 $"
          period=""
          features={[
            "Profil athlète + carte de joueur",
            "Évaluations + cote globale",
            "Vérification par ton coach",
          ]}
          status={tierStatus(displayTier, "free")}
        />
        <TierCard
          name="Pro"
          price="9,99 $"
          period="/mois"
          features={[
            "Voir quels CÉGEPs consultent ton profil",
            "Intérêt mutuel des CÉGEPs",
            "Alertes recruteurs en temps réel",
            "Graphique de vues hebdomadaire",
            "Badge Pro affiché aux recruteurs",
            "Vidéo de commitment personnalisée",
          ]}
          status={tierStatus(displayTier, "pro")}
          accentDot="#F59E0B"
          onUpgrade={() => router.push("/tarifs")}
          upgradeLabel="Passer à Pro"
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
        <NavRow
          label="Courriel"
          value={profile?.email || "—"}
          isFirst={false}
          rightChevron="none"
        />
        <NavRow
          label="Langue"
          value="Français"
          isFirst={false}
          rightChevron="none"
        />
      </Group>

      {/* ZONE DANGER */}
      <SectionLabel>Zone danger</SectionLabel>
      <Group>
        <DangerRow
          label="Retirer le consentement"
          isFirst
          onTap={() => { triggerHaptic("Light"); setRevokeConsentSheetOpen(true); }}
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
        open={revokeConsentSheetOpen}
        onClose={() => setRevokeConsentSheetOpen(false)}
        title="Retirer le consentement ?"
        message="Ton profil sera immédiatement désactivé et invisible pour les recruteurs. Ton coach et le responsable de sports seront notifiés."
        confirmLabel="Retirer le consentement"
        onConfirm={handleRevokeConsent}
        variant="danger"
      />

      <ConfirmSheet
        open={deleteSheetOpen}
        onClose={() => setDeleteSheetOpen(false)}
        title="Supprimer mon compte ?"
        message="Ton compte et tes données personnelles seront supprimés immédiatement et définitivement. Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        onConfirm={handleDelete}
        variant="danger"
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
