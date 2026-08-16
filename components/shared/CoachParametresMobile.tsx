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
   6. (retiré) Abonnement — l'entraîneur est entièrement gratuit :
                  plus de bandeau de plan, plus de TierCards, plus
                  d'accès au portail de facturation.
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
  triggerHaptic, openExternal,
  SectionLabel, Group, ToggleRow, NavRow, DangerRow,
  PasswordChangeSheet, ConfirmSheet,
} from "@/components/shared/settings";
import { deleteMyAccount } from "@/lib/auth/deleteAccount";
import { openLegalDocument } from "@/lib/legal";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ── Coach notification rows (DB JSONB — desktop NotificationsSection) ── */


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
  // L'entraîneur n'a plus de palier payant : aucune lecture de tier ici.
  // `refresh` reste appelé au montage/reprise — l'abonnement gouverne
  // encore d'autres surfaces (recruteur), et le contexte est partagé.
  const { refresh } = useSubscription();

  /* State (hooks BEFORE any early return — Rules of Hooks). */
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


  const [consentDates, setConsentDates] = useState<{ privacy?: string; data?: string; marketing?: string | null }>({});
  const [signupDate, setSignupDate] = useState<string>("");

  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [isCivilCoach, setIsCivilCoach] = useState(false);
  const [school, setSchool] = useState<SchoolInfo | null>(null);

  const [loading, setLoading] = useState(true);

  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);

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

  /* ── Save handlers ────────────────────────────────────────── */

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



  async function handleLogout() {
    triggerHaptic("Medium");
    const supabase = createClient();
    try { localStorage.removeItem("nexus_user"); } catch { /* no-op */ }
    await supabase.auth.signOut();
    setLogoutSheetOpen(false);
    router.push("/auth");
  }

  async function handleDelete() {
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
                rightChevron={IS_CAPACITOR ? "none" : "external"}
                onTap={() => {
                  if (IS_CAPACITOR) {
                    toast.info({ message: "Disponible sur la version web", detail: "Cette section se gère sur nexussports.ca." });
                    return;
                  }
                  openExternal("https://nexussports.ca/coach/settings");
                }}
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
              rightChevron={IS_CAPACITOR ? "none" : "external"}
              onTap={() => {
                if (IS_CAPACITOR) {
                  toast.info({ message: "Disponible sur la version web", detail: "Cette section se gère sur nexussports.ca." });
                  return;
                }
                openExternal("https://nexussports.ca/coach/settings");
              }}
            />
          </Group>
        </>
      )}

      {/* NOTIFICATIONS */}
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
            onClick={() => { void triggerHaptic("Light"); saveMarketing(); }}
            disabled={savingMarketing}
            className="w-full h-11 rounded-2xl bg-[#E63946] text-white text-[14px] font-semibold active:bg-[#D42B22] disabled:opacity-60"
          >
            {savingMarketing ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      )}

      {/* CONFIDENTIALITÉ — slim (no discoverability toggles) */}
      <SectionLabel>Confidentialité</SectionLabel>
      <Group>
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
            openExternal("https://nexussports.ca/coach/settings?section=confidentialite");
          }}
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
