"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal/policyVersion";

/* ═══════════════════════════════════════════════════════════════
   Portal parental — Lot 1b. Page consentements (web only).

   Lecture consolidée via get_child_consents(athlete_id) :
   - 4 consentements informatifs en LECTURE SEULE (politique, collecte,
     profil parental, visibilité recruteurs) + leur date.
   - 2 toggles ACTIFS : Marketing, Image/visibilité partenaires
     → set_child_consent(athlete_id, clé, granted). Optimiste + revert.
     Confirmation avant tout RETRAIT.
   - Section attestation coach en lecture seule si une parental_consents
     est liée (« géré par le coach »).

   L'écriture couvre 3 emplacements pour image_partenaire côté serveur ;
   la page ne fait qu'appeler le RPC (source de vérité serveur).
   ═══════════════════════════════════════════════════════════════ */

type ConsentKey =
  | "consent_privacy_policy"
  | "consent_data_collection"
  | "consent_marketing"
  | "consent_parental_profile"
  | "consent_parental_visibility"
  | "consent_parental_partner_visibility";

interface Consents {
  privacy_preferences: Record<ConsentKey, string | null>;
  partner_visibility: { opt_in: boolean | null; opted_in_at: string | null; parental_consent: boolean | null };
  coach_attestation: {
    status: string | null;
    consent_profile_public: boolean | null;
    consent_photo: boolean | null;
    consent_stats: boolean | null;
    consent_contact: boolean | null;
    attested_at: string | null;
    school_year: string | null;
  } | null;
  error?: string;
}

const READ_ROWS: { key: ConsentKey; label: string; hint: string }[] = [
  { key: "consent_privacy_policy", label: "Politique de confidentialité", hint: "Acceptation de la politique de confidentialité de Nexus." },
  { key: "consent_data_collection", label: "Collecte de données", hint: "Autorisation de collecte des données du profil athlète." },
  { key: "consent_parental_profile", label: "Création du profil (autorisation parentale)", hint: "Consentement à la création du profil de votre enfant." },
  { key: "consent_parental_visibility", label: "Visibilité aux recruteurs", hint: "Le profil peut être consulté par les recruteurs CÉGEP vérifiés." },
];

function fmtDate(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
}

const card = "bg-[#1A1D24] border border-white/5 rounded-xl";
const sectionLabel = "text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280]";

export default function ParentConsentsPage() {
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [data, setData] = useState<Consents | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Par clé de toggle : en cours d'enregistrement + erreur + retrait à confirmer.
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string | null>>({});
  const [confirmKey, setConfirmKey] = useState<"marketing" | "image_partenaire" | null>(null);

  const fetchConsents = useCallback(async (aid: string) => {
    const supabase = createClient();
    const { data: res, error } = await supabase.rpc("get_child_consents", { p_athlete_id: aid });
    if (error) { setLoadError("Impossible de charger les consentements."); return; }
    const c = res as Consents;
    if (c?.error) { setLoadError(c.error === "not_parent" ? "Accès refusé." : "Profil introuvable."); return; }
    setData(c);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: kids } = await supabase.rpc("get_my_children");
      if (cancelled) return;
      const aid = ((kids as Array<{ athlete_id: string }> | null) ?? [])[0]?.athlete_id ?? null;
      if (!aid) { setLoadError("Aucun enfant associé à ce compte."); setLoading(false); return; }
      setAthleteId(aid);
      await fetchConsents(aid);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchConsents]);

  // État actuel des 2 toggles (source de vérité serveur).
  const marketingOn = !!data?.privacy_preferences?.consent_marketing;
  const partnerOn = data?.partner_visibility?.opt_in === true;

  async function applyChange(key: "marketing" | "image_partenaire", granted: boolean) {
    if (!athleteId || !data) return;
    setConfirmKey(null);
    setRowError((e) => ({ ...e, [key]: null }));
    setSaving((s) => ({ ...s, [key]: true }));

    // Snapshot pour revert.
    const prev = data;

    // Patch optimiste local.
    const next: Consents = JSON.parse(JSON.stringify(data));
    if (key === "marketing") {
      next.privacy_preferences.consent_marketing = granted ? new Date().toISOString() : null;
    } else {
      next.partner_visibility.opt_in = granted;
      next.privacy_preferences.consent_parental_partner_visibility = granted ? new Date().toISOString() : null;
      if (next.coach_attestation) next.coach_attestation.consent_photo = granted;
    }
    setData(next);

    const supabase = createClient();
    const { data: res, error } = await supabase.rpc("set_child_consent", {
      p_athlete_id: athleteId,
      p_consent_key: key,
      p_granted: granted,
      p_policy_version: PRIVACY_POLICY_VERSION,
    });
    const ok = !error && (res as { ok?: boolean } | null)?.ok === true;
    if (!ok) {
      setData(prev); // revert
      setRowError((e) => ({ ...e, [key]: "Échec de l'enregistrement. Réessayez." }));
      setSaving((s) => ({ ...s, [key]: false }));
      return;
    }
    // Recharger l'état serveur canonique (dates + attestation).
    await fetchConsents(athleteId);
    setSaving((s) => ({ ...s, [key]: false }));
  }

  function onToggle(key: "marketing" | "image_partenaire", currentlyOn: boolean) {
    if (saving[key]) return;
    if (currentlyOn) setConfirmKey(key);   // retrait → confirmer
    else applyChange(key, true);           // octroi → direct
  }

  if (loading) return <p className="text-sm text-[#6B7280]">Chargement…</p>;
  if (loadError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className={`${card} p-5`}><p className="text-sm text-[#9CA3AF]">{loadError}</p></div>
      </div>
    );
  }
  if (!data) return null;

  const att = data.coach_attestation;
  const partnerDate = fmtDate(data.partner_visibility.opted_in_at);
  const marketingDate = fmtDate(data.privacy_preferences.consent_marketing);

  return (
    <div className="space-y-6">
      <BackLink />

      <div>
        <h1 className="font-head text-2xl font-bold text-white uppercase tracking-tight">Consentements</h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">Autorisations liées au profil de votre enfant. Vous pouvez modifier les deux consentements ci-dessous à tout moment.</p>
      </div>

      {/* ── Toggles actifs ── */}
      <section className="space-y-3">
        <p className={sectionLabel}>Gérer les consentements</p>

        <ToggleRow
          label="Communications marketing"
          hint="Recevoir les infolettres et annonces de Nexus. N'affecte pas le fonctionnement du profil."
          on={marketingOn}
          date={marketingOn ? marketingDate : null}
          saving={!!saving.marketing}
          error={rowError.marketing ?? null}
          onToggle={() => onToggle("marketing", marketingOn)}
        />

        <ToggleRow
          label="Image et visibilité auprès des partenaires"
          hint="Autoriser les partenaires média approuvés de Nexus à voir le profil (photo incluse). Le retrait masque immédiatement le profil aux partenaires."
          on={partnerOn}
          date={partnerOn ? partnerDate : null}
          saving={!!saving.image_partenaire}
          error={rowError.image_partenaire ?? null}
          onToggle={() => onToggle("image_partenaire", partnerOn)}
        />
      </section>

      {/* ── Lecture seule : consentements informatifs ── */}
      <section className="space-y-3">
        <p className={sectionLabel}>État des consentements</p>
        <div className={`${card} divide-y divide-white/5`}>
          {READ_ROWS.map((r) => {
            const granted = !!data.privacy_preferences[r.key];
            const date = fmtDate(data.privacy_preferences[r.key]);
            return (
              <div key={r.key} className="px-5 py-3.5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-white">{r.label}</p>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">{r.hint}</p>
                </div>
                <div className="shrink-0 text-right">
                  {granted ? (
                    <>
                      <span className="text-[12px] font-semibold text-[#22C55E]">Accordé</span>
                      {date && <p className="text-[11px] text-[#6B7280] mt-0.5">{date}</p>}
                    </>
                  ) : (
                    <span className="text-[12px] font-semibold text-[#6B7280]">Non accordé</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Attestation coach (lecture seule, si liée) ── */}
      {att && (
        <section className="space-y-3">
          <p className={sectionLabel}>Attestation du coach</p>
          <div className={`${card} p-5 space-y-3`}>
            <p className="text-[12px] text-[#9CA3AF]">
              Ces consentements ont été attestés par le coach de votre enfant et sont gérés par le coach.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
              {att.attested_at && <span className="text-[#6B7280]">Attesté le <span className="text-white">{fmtDate(att.attested_at)}</span></span>}
              {att.school_year && <span className="text-[#6B7280]">Année <span className="text-white">{att.school_year}</span></span>}
              {att.status && <span className="text-[#6B7280]">Statut <span className="text-white">{att.status}</span></span>}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <AttFlag label="Profil public" on={att.consent_profile_public} />
              <AttFlag label="Photo" on={att.consent_photo} />
              <AttFlag label="Statistiques" on={att.consent_stats} />
              <AttFlag label="Contact" on={att.consent_contact} />
            </div>
          </div>
        </section>
      )}

      {/* ── Confirmation de retrait ── */}
      {confirmKey && (
        <ConfirmWithdraw
          keyName={confirmKey}
          onCancel={() => setConfirmKey(null)}
          onConfirm={() => applyChange(confirmKey, false)}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/parent" className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF] hover:text-white transition-colors">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      Retour
    </Link>
  );
}

function ToggleRow({
  label, hint, on, date, saving, error, onToggle,
}: {
  label: string; hint: string; on: boolean; date: string | null;
  saving: boolean; error: string | null; onToggle: () => void;
}) {
  return (
    <div className="bg-[#1A1D24] border border-white/5 rounded-xl px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-white">{label}</p>
          <p className="text-[12px] text-[#6B7280] mt-1 leading-snug">{hint}</p>
          {on && date && <p className="text-[11px] text-[#22C55E] mt-1.5">Accordé le {date}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={saving}
          onClick={onToggle}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-[#22C55E]" : "bg-[#3a3d46]"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>
      {error && <p className="text-[12px] text-[#EF4444] font-semibold mt-2">{error}</p>}
    </div>
  );
}

function AttFlag({ label, on }: { label: string; on: boolean | null }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className={`inline-block w-2 h-2 rounded-full ${on ? "bg-[#22C55E]" : "bg-[#4a4d56]"}`} />
      <span className="text-[#9CA3AF]">{label}</span>
      <span className={on ? "text-[#22C55E]" : "text-[#6B7280]"}>{on ? "oui" : "non"}</span>
    </div>
  );
}

function ConfirmWithdraw({
  keyName, onCancel, onConfirm,
}: {
  keyName: "marketing" | "image_partenaire"; onCancel: () => void; onConfirm: () => void;
}) {
  const msg =
    keyName === "image_partenaire"
      ? "Le profil de votre enfant ne sera plus visible par les partenaires média approuvés. Vous pourrez le réactiver à tout moment."
      : "Votre enfant ne recevra plus les communications marketing de Nexus. Vous pourrez le réactiver à tout moment.";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-[420px] bg-[#1A1D24] border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="font-head text-lg font-bold text-white">Confirmer le retrait</h2>
        <p className="text-[13px] text-[#9CA3AF] leading-relaxed">{msg}</p>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 h-11 rounded-lg border border-white/10 text-[13px] font-semibold text-[#9CA3AF] hover:text-white hover:border-white/20 transition-colors">
            Annuler
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 h-11 rounded-lg bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-bold text-[12px] uppercase tracking-widest transition-colors">
            Retirer
          </button>
        </div>
      </div>
    </div>
  );
}
