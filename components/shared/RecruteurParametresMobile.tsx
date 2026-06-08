"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurParametresMobile — Paramètres mobile (iter 7.39)

   Pattern Réglages iPhone : rows iOS groupées, sections collapsées,
   toggles rouge. Colonnes DB exactes (DIAG 7.38 §B.2) :

   - users.notification_preferences (JSONB : app_*, email_*, marketing_emails)
   - users.recruitment_preferences (JSONB : regions, graduation_years,
     positions, min_gpa, min_cote, alerts_enabled)
   - users.privacy_preferences (JSONB : profile_visible, show_consultations,
     show_full_name, consent_*)

   Sections :
   - Notifications (6 toggles app/email — desktop NotificationsSection)
   - Recrutement (sous-vue — placeholder pour l'instant, BP confirme scope)
   - Confidentialité (3 toggles + dates consentement + Browser.open vers web)
   - Abonnement (READONLY honnête — CTAs "Bientôt disponible")
   - Compte (changer mot de passe via sheet)
   - Zone danger (désactiver via RPC + déconnexion réelle)

   PAS de Gestion CÉGEP ni Transfert (BP confirme — desktop only).

   ⚠️ Rules of Hooks : tous les hooks AVANT early return (canon 7.8d/7.25).
═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useSubscription } from "@/lib/hooks/useSubscription";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

async function triggerHaptic(intensity: "Light" | "Medium" | "Heavy" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style =
      intensity === "Heavy" ? ImpactStyle.Heavy :
      intensity === "Medium" ? ImpactStyle.Medium :
      ImpactStyle.Light;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

async function openExternal(url: string) {
  try {
    if (IS_CAPACITOR) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

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
  const { tier } = useSubscription();

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
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);

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
            <p className="text-[12px] text-[#6b7280] mt-2">Passe à Pro pour débloquer la pipeline, la messagerie et plus.</p>
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
          onTap={() => openExternal("https://nexussports.ca/confidentialite")}
        />
        <NavRow
          label="Exporter mes données (Loi 25)"
          isFirst={false}
          rightChevron="external"
          onTap={() => openExternal("https://nexussports.ca/recruteur/parametres?section=confidentialite")}
        />
      </Group>
      {/* Dates consentement read-only */}
      <div className="px-6 pt-3 text-[11px] text-[#6b7280] leading-5">
        {signupDate && <p>Inscription : {signupDate}</p>}
        {consentDates.privacy && <p>Consentement politique : {consentDates.privacy}</p>}
        {consentDates.data && <p>Consentement données : {consentDates.data}</p>}
        {consentDates.marketing && <p>Consentement marketing : {consentDates.marketing}</p>}
      </div>

      {/* ABONNEMENT — iter 7.40 §3 : cards premium, "Bientôt" UNIQUEMENT
          sur les tiers SUPÉRIEURS au tier courant. Tier actuel = bordure
          rouge + glow + badge "Actuel" vert. Tiers inférieurs = compacts
          en sourdine (aucun CTA — l'utilisateur a déjà mieux). */}
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
            "Pipeline complet + messagerie",
            "Filtres avancés (taille, poids, cote)",
            "Coordonnées du coach révélées",
          ]}
          status={tierStatus(tier, "pro")}
          accentDot="#F59E0B"
        />
        <TierCard
          name="All Star"
          price="29,99 $"
          period="/mois"
          features={[
            "Pipeline illimité + analytics",
            "Voir qui a consulté un athlète",
            "Listes de prospects personnalisées",
          ]}
          status={tierStatus(tier, "all_star")}
          accentDot="#E63946"
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
        open={logoutSheetOpen}
        onClose={() => setLogoutSheetOpen(false)}
        title="Se déconnecter ?"
        message="Vous serez ramené à l'écran de connexion."
        confirmLabel="Déconnexion"
        onConfirm={handleLogout}
        variant="danger"
      />
      <style jsx global>{`
        @keyframes nx-modal-fade {
          0% { opacity: 0; } 100% { opacity: 1; }
        }
        @keyframes nx-modal-slideup {
          0% { transform: translateY(100%); } 100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Building blocks ─────────────────────────────────────────── */

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-5 pb-2">
      <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#6b7280]">{children}</span>
    </div>
  );
}

function Group({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06] overflow-hidden ${className || ""}`}>
      {children}
    </div>
  );
}

/* Toggle iOS canon (iter 7.40b) — composant unique réutilisé pour tous
   les switches Paramètres (Notif APP/EMAIL, marketing, Confidentialité).

   Math (canon brief 7.40b) :
   - Track 44 × 26, rounded-full
   - Thumb 22 × 22 (= track height − 4) ; margin 2 px à gauche, 2 px à droite
   - Translation ON  = 44 − 22 − 2·2 = 18 px (left:2 → left:20)
   - Translation OFF = 0 px
   → Le thumb reste TOUJOURS à l'intérieur de la pilule.
   - OFF #3A3A3C (gris iOS Settings), ON #E63946
   - Shadow subtle sous le thumb pour relief iOS
   - Transition 200 ms ease sur transform et background-color
   - Touch zone = visuel 44 × 26 (canon iOS UISwitch natif = 51 × 31, le
     touch matche le visuel, pas un wrapper invisible — règle 44 × 44
     est un guide général, pas appliqué strictement aux switches iOS). */

function Toggle({ checked, onChange, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => { triggerHaptic("Light"); onChange(!checked); }}
      className="relative shrink-0 rounded-full"
      style={{
        width: 44,
        height: 26,
        background: checked ? "#E63946" : "#3A3A3C",
        transition: "background-color 200ms ease",
        touchAction: "manipulation",
      }}
    >
      <span
        className="block absolute rounded-full bg-white"
        style={{
          top: 2,
          left: 2,
          width: 22,
          height: 22,
          transform: checked ? "translateX(18px)" : "translateX(0)",
          transition: "transform 200ms ease",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        }}
        aria-hidden
      />
    </button>
  );
}

function ToggleRow({
  label, sublabel, checked, onChange, isFirst,
}: {
  label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void; isFirst: boolean;
}) {
  return (
    <div
      className="flex items-center px-4 py-3"
      style={{ minHeight: 52, borderTop: isFirst ? undefined : "0.5px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-[15px] text-white">{label}</p>
        {sublabel && <p className="text-[11px] text-[#6b7280] mt-0.5">{sublabel}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function NavRow({
  label, sublabel, onTap, rightChevron = "chevron", isFirst,
}: {
  label: string; sublabel?: string; onTap: () => void;
  rightChevron?: "chevron" | "external"; isFirst: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center px-4 text-left active:bg-white/[0.04]"
      style={{ minHeight: 52, borderTop: isFirst ? undefined : "0.5px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex-1 min-w-0 py-3">
        <p className="text-[15px] text-white">{label}</p>
        {sublabel && <p className="text-[11px] text-[#6b7280] mt-0.5">{sublabel}</p>}
      </div>
      {rightChevron === "external" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </button>
  );
}

function DangerRow({ label, onTap, isFirst }: { label: string; onTap: () => void; isFirst: boolean }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center justify-center px-4 active:bg-white/[0.04]"
      style={{ minHeight: 52, borderTop: isFirst ? undefined : "0.5px solid rgba(255,255,255,0.06)" }}
    >
      <span className="text-[15px] font-medium text-[#E63946]">{label}</span>
    </button>
  );
}

/* ── Tier rank helper (iter 7.40 §3) ──────────────────────────
   Renvoie "current" / "upgrade" / "below" pour décider l'UI :
   - current  = bordure rouge + glow + badge Actuel (vert)
   - upgrade  = CTA "Bientôt" subtle (tier supérieur, pas encore Stripe)
   - below    = card en sourdine, AUCUN CTA (l'user a déjà mieux)
─────────────────────────────────────────────────────────────── */

type TierStatus = "current" | "upgrade" | "below";

function tierStatus(userTier: "free" | "pro" | "all_star", cardTier: "free" | "pro" | "all_star"): TierStatus {
  const rank: Record<"free" | "pro" | "all_star", number> = { free: 0, pro: 1, all_star: 2 };
  if (userTier === cardTier) return "current";
  if (rank[cardTier] > rank[userTier]) return "upgrade";
  return "below";
}

function TierCard({
  name, price, period, features, status, accentDot,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  status: TierStatus;
  accentDot?: string;
}) {
  const isCurrent = status === "current";
  const isBelow = status === "below";
  const cardClass = isCurrent
    ? "rounded-2xl border border-[#E63946]/45 bg-[#1A1D24] shadow-[0_0_18px_rgba(230,57,70,0.18)] p-4"
    : isBelow
      ? "rounded-2xl border border-white/[0.04] bg-[#1A1D24]/60 p-4"
      : "rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-4";

  return (
    <div className={cardClass}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {accentDot && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentDot }} aria-hidden />
          )}
          <p className={`text-[16px] font-semibold ${isBelow ? "text-[#9CA3AF]" : "text-white"} truncate`}>{name}</p>
          {isCurrent && (
            <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[9px] font-black uppercase tracking-wider shrink-0">
              Actuel
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className={`text-[16px] font-bold ${isBelow ? "text-[#6b7280]" : "text-white"}`}>{price}</span>
          {period && <span className="text-[12px] text-[#6b7280]">{period}</span>}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isBelow ? "#4a4d56" : "#22C55E"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className={`text-[12.5px] leading-snug ${isBelow ? "text-[#6b7280]" : "text-[#e0e0e0]"}`}>{f}</span>
          </li>
        ))}
      </ul>
      {status === "upgrade" && (
        <div className="mt-3 pt-3 border-t border-white/[0.05]">
          <div className="flex items-center justify-center h-9 rounded-2xl bg-white/[0.04] text-[12px] font-semibold text-[#9CA3AF] italic">
            Bientôt disponible
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Password change sheet (canon : 5 règles, 2 saisies, supabase.auth.updateUser) ── */

function PasswordChangeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useMobileToast();
  const [mounted, setMounted] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setNewPw(""); setConfirmPw(""); } }, [open]);

  const hasMin = newPw.length >= 8;
  const hasUpper = /[A-Z]/.test(newPw);
  const hasLower = /[a-z]/.test(newPw);
  const hasNum = /[0-9]/.test(newPw);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPw);
  const match = newPw === confirmPw && confirmPw.length > 0;
  const valid = hasMin && hasUpper && hasLower && hasNum && hasSpecial && match;

  async function handleSubmit() {
    if (!valid || saving) return;
    triggerHaptic("Medium");
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) { toast.error({ message: "Erreur", detail: error.message }); return; }
      toast.success({ message: "Mot de passe modifié" });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60"
        style={{ animation: "nx-modal-fade 200ms ease-out forwards" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl flex flex-col"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          maxHeight: "90vh",
          animation: "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-5 pb-2 shrink-0">
          <h3 className="text-[17px] font-semibold text-white text-center mb-4">Changer le mot de passe</h3>
        </div>
        <div className="px-5 pb-4 flex-1 overflow-y-auto">
          <input
            type="password"
            autoComplete="new-password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="Nouveau mot de passe"
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-2xl px-4 py-3 text-[16px] text-white placeholder:text-[#4a4d56] focus:outline-none focus:border-[#E63946]/50"
          />
          {newPw.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 mt-3">
              <Rule met={hasMin} label="8 caractères min." />
              <Rule met={hasUpper} label="Une majuscule" />
              <Rule met={hasLower} label="Une minuscule" />
              <Rule met={hasNum} label="Un chiffre" />
              <Rule met={hasSpecial} label="Un caractère spécial" />
            </div>
          )}
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Confirmer le mot de passe"
            className="w-full mt-4 bg-[#13151a] border border-[#2a2d36] rounded-2xl px-4 py-3 text-[16px] text-white placeholder:text-[#4a4d56] focus:outline-none focus:border-[#E63946]/50"
          />
          {confirmPw.length > 0 && !match && (
            <p className="text-[12px] text-[#E63946] mt-2">Les mots de passe ne correspondent pas.</p>
          )}
        </div>
        <div className="px-5 pb-3 pt-2 shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!valid || saving}
            className={`w-full h-12 rounded-2xl text-[15px] font-semibold transition-colors ${
              valid && !saving ? "bg-[#E63946] text-white active:bg-[#D42B22]" : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
            }`}
          >
            {saving ? "Modification…" : "Modifier le mot de passe"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 mt-2 text-[#9CA3AF] text-[15px]"
          >
            Annuler
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function Rule({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /></svg>
      )}
      <span className={`text-[11px] ${met ? "text-[#22C55E]" : "text-[#6b7280]"}`}>{label}</span>
    </div>
  );
}

/* ── Confirm sheet (slide-up iOS, OK/Annuler) ─────────────────── */

function ConfirmSheet({
  open, onClose, title, message, confirmLabel, onConfirm, variant = "danger",
}: {
  open: boolean; onClose: () => void; title: string; message: string;
  confirmLabel: string; onConfirm: () => void; variant?: "danger" | "warning";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60"
        style={{ animation: "nx-modal-fade 200ms ease-out forwards" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] px-3 pb-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
          animation: "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <div className="bg-[#1A1D24] rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4 text-center border-b border-white/[0.06]">
            <p className="text-[14px] font-semibold text-white">{title}</p>
            <p className="text-[12px] text-[#9CA3AF] mt-1.5 leading-relaxed">{message}</p>
          </div>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full h-12 text-[15px] font-semibold active:bg-white/[0.04]"
            style={{ color: variant === "danger" ? "#E63946" : "#F59E0B" }}
          >
            {confirmLabel}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 mt-2 rounded-2xl bg-[#1A1D24] text-[#E0E0E0] text-[15px] font-semibold active:bg-white/[0.04]"
        >
          Annuler
        </button>
      </div>
    </>,
    document.body,
  );
}
