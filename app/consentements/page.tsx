"use client";

/* ═══════════════════════════════════════════════════════════════
   /consentements — Interstitiel post-auth / pré-onboarding (BLOC 3A)

   Collecte rôle (+context), date de naissance + age-gate parental, et
   les 3 consentements Loi 25 (+ 2 parentaux si mineur). Au submit :
     1. RPC set_initial_role_and_context (role+context en DB)
     2. updateUser(metadata) — consents + parent PII + date_naissance + role/context
     3. refreshSession() — le JWT prend le nouveau role (guard athlète)
     4. persistInitialConsents — users.privacy_preferences
     5. postLoginDispatch — redirect par rôle

   ⚠️ BLOC 3A : écran NON branché dans les flux (pas de gate). Accessible
   en visitant /consentements directement pour test isolé. Le gate vient
   au bloc 3B.

   Copie consentements répliquée de SignupMobile (écrans 2 + 3).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isAdult } from "@/lib/legal/ageGate";
import { openLegalDocument } from "@/lib/legal";
import {
  buildConsentMetadata,
  persistInitialConsents,
  type InitialConsentFlags,
  type ParentPII,
} from "@/lib/legal/persistInitialConsents";
import { postLoginDispatch } from "@/lib/auth/postLoginDispatch";

type Role = "ATHLETE" | "COACH" | "RECRUTEUR";
type Ctx = "scolaire" | "ligue_civile" | "collegial";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RELATIONS = ["Père", "Mère", "Tuteur légal", "Autre"];

/** RAISE EXCEPTION de la RPC → message FR lisible. */
function rpcErrorToFr(msg: string): string {
  if (msg.includes("INVALID_ROLE")) return "Rôle invalide.";
  if (msg.includes("INVALID_CONTEXT")) return "Contexte invalide.";
  if (msg.includes("INCOHERENT_ROLE_CONTEXT")) return "Le contexte ne correspond pas au rôle choisi.";
  if (msg.includes("ROLE_ALREADY_SET")) return "Ton rôle a déjà été défini — impossible de le changer.";
  if (msg.includes("CONTEXT_ALREADY_SET")) return "Tes informations ont déjà été enregistrées.";
  if (msg.includes("ALREADY_ONBOARDED")) return "Ton inscription est déjà complétée.";
  if (msg.includes("NOT_AUTHENTICATED")) return "Session expirée — reconnecte-toi.";
  if (msg.includes("NO_PROFILE")) return "Profil introuvable.";
  return msg || "Une erreur est survenue.";
}

/* ── Styles charte ───────────────────────────────────────────── */
const card = "bg-[#1A1D24] border border-white/[0.06] rounded-2xl";
const labelCls = "block text-[12px] font-bold tracking-wider uppercase text-[#6b7280] mb-1";
const inputCls = "w-full bg-[#111317] border border-white/10 rounded-xl px-4 py-3 text-[16px] text-white placeholder:text-white/35 outline-none focus:border-[#E63946]/50";
const sectionH = "font-head text-[13px] font-black uppercase tracking-tight text-white/70 mt-7 mb-3 flex items-center gap-2";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className={sectionH}>
      <span className="w-0.5 h-3 bg-[#E63946] rounded-full" />
      {children}
    </h2>
  );
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer min-h-[44px] py-1.5">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border transition-colors ${checked ? "bg-[#E63946] border-[#E63946]" : "bg-transparent border-white/25"}`}
        aria-checked={checked}
        role="checkbox"
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        )}
      </button>
      <span className="text-[13px] text-white/80 leading-snug">{children}</span>
    </label>
  );
}

function RoleCard({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${card} w-full text-left px-4 py-3 transition-colors ${active ? "border-[#E63946] bg-[#E63946]/10" : "active:bg-[#22262e]"}`}
    >
      <div className="font-head font-black uppercase tracking-tight text-white text-[15px]">{title}</div>
      <div className="text-[12px] text-white/50 mt-0.5">{sub}</div>
    </button>
  );
}

export default function ConsentementsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form state
  const [role, setRole] = useState<Role | null>(null);
  const [context, setContext] = useState<Ctx | null>(null);
  const [birthdate, setBirthdate] = useState("");

  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentRelationship, setParentRelationship] = useState("");

  const [consentPolicy, setConsentPolicy] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentProfile, setConsentProfile] = useState(false);
  const [consentVisibility, setConsentVisibility] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await createClient().auth.getUser();
      setUser(u);
      setAuthLoading(false);
    })();
  }, []);

  // Recruteur → context collegial auto ; coach/athlète → choix manuel.
  useEffect(() => {
    if (role === "RECRUTEUR") setContext("collegial");
    else setContext((c) => (c === "collegial" ? null : c));
  }, [role]);

  const isMinor = birthdate.length > 0 && !isAdult(birthdate);
  const parentEmailValid = EMAIL_RE.test(parentEmail.trim());

  const canSubmit = useMemo(() => {
    if (!role || !context || !birthdate) return false;
    if (!consentPolicy || !consentData) return false;
    if (isMinor) {
      if (!parentFirstName.trim() || !parentLastName.trim() || !parentEmailValid) return false;
      if (!consentProfile || !consentVisibility) return false;
    }
    return true;
  }, [role, context, birthdate, consentPolicy, consentData, isMinor, parentFirstName, parentLastName, parentEmailValid, consentProfile, consentVisibility]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting || !user || !role || !context) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    try {
      // 1. RPC role+context (revalide côté serveur)
      const { error: rpcErr } = await supabase.rpc("set_initial_role_and_context", {
        p_role: role,
        p_context: context,
      });
      if (rpcErr) {
        setError(rpcErrorToFr(rpcErr.message));
        setSubmitting(false);
        return;
      }

      // 2. metadata (consents + parent PII si mineur + date_naissance + role/context)
      const flags: InitialConsentFlags = {
        policy: consentPolicy,
        data: consentData,
        marketing: consentMarketing,
        ...(isMinor
          ? { parentalProfile: consentProfile, parentalVisibility: consentVisibility }
          : {}),
      };
      const parent: ParentPII | undefined = isMinor
        ? {
            firstName: parentFirstName.trim(),
            lastName: parentLastName.trim(),
            email: parentEmail.trim(),
            relationship: parentRelationship || undefined,
          }
        : undefined;

      await supabase.auth.updateUser({
        data: {
          ...buildConsentMetadata(flags, parent),
          date_naissance: birthdate,
          role,
          context,
        },
      });

      // 3. refreshSession — le JWT prend le nouveau role (guard athlète lit le JWT)
      await supabase.auth.refreshSession();

      // 4. privacy_preferences — INVARIANT ANTI-BOUCLE : si l'écriture échoue,
      // le consent reste absent en base → le gate (postLoginDispatch / onboarding)
      // re-pousserait /consentements → boucle. On bloque le dispatch et on
      // demande de réessayer plutôt que de risquer le ping-pong.
      const persisted = await persistInitialConsents(user.id, flags);
      if (!persisted.ok) {
        setError("Échec d'enregistrement, réessaie.");
        setSubmitting(false);
        return;
      }

      // 5. redirect par rôle (source unique)
      await postLoginDispatch(supabase, user, router);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue.");
      setSubmitting(false);
    }
  }, [canSubmit, submitting, user, role, context, consentPolicy, consentData, consentMarketing, isMinor, consentProfile, consentVisibility, parentFirstName, parentLastName, parentEmail, parentRelationship, birthdate, router]);

  /* ── Render ──────────────────────────────────────────────── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#111317] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#111317] flex items-center justify-center px-6 text-center">
        <p className="text-[15px] text-white/70">Tu dois être connecté pour accéder à cette page.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#111317] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
      }}
    >
      <div className="max-w-md mx-auto px-6 pt-6">
        <h1 className="font-head font-black uppercase tracking-tight text-white" style={{ fontSize: 26, lineHeight: 0.95 }}>
          Quelques infos.
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-2 leading-snug">
          On confirme ton profil et tes consentements avant de continuer.
        </p>

        {/* 1. Rôle */}
        <SectionTitle>Je suis</SectionTitle>
        <div className="space-y-2">
          <RoleCard active={role === "ATHLETE"} onClick={() => setRole("ATHLETE")} title="Athlète" sub="Je crée mon profil pour être recruté" />
          <RoleCard active={role === "COACH"} onClick={() => setRole("COACH")} title="Entraîneur" sub="Je gère et j'évalue mes athlètes" />
          <RoleCard active={role === "RECRUTEUR"} onClick={() => setRole("RECRUTEUR")} title="Recruteur CÉGEP" sub="Je recrute des athlètes" />
        </div>

        {/* 2. Context conditionnel */}
        {(role === "ATHLETE" || role === "COACH") && (
          <>
            <SectionTitle>Mon milieu</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <RoleCard active={context === "scolaire"} onClick={() => setContext("scolaire")} title="École" sub="Réseau scolaire (RSEQ)" />
              <RoleCard active={context === "ligue_civile"} onClick={() => setContext("ligue_civile")} title="Ligue / club" sub="Ligue civile" />
            </div>
          </>
        )}
        {role === "RECRUTEUR" && (
          <p className="text-[12px] text-white/40 mt-3">Contexte : collégial (CÉGEP).</p>
        )}

        {/* 3. Date de naissance */}
        <SectionTitle>Date de naissance</SectionTitle>
        <input
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          className={inputCls}
        />
        {isMinor && (
          <p className="text-[12px] text-[#F59E0B] mt-2 px-1">
            Tu as moins de 18 ans : l&apos;accord d&apos;un parent ou tuteur est requis (Loi 25).
          </p>
        )}

        {/* 4. Bloc parental (mineur) */}
        {isMinor && (
          <>
            <SectionTitle>Tes parents</SectionTitle>
            <div className="space-y-3">
              <div>
                <label htmlFor="c-parent-first" className={labelCls}>Prénom du parent</label>
                <input id="c-parent-first" value={parentFirstName} onChange={(e) => setParentFirstName(e.target.value)} className={inputCls} placeholder="Prénom" />
              </div>
              <div>
                <label htmlFor="c-parent-last" className={labelCls}>Nom du parent</label>
                <input id="c-parent-last" value={parentLastName} onChange={(e) => setParentLastName(e.target.value)} className={inputCls} placeholder="Nom" />
              </div>
              <div>
                <label htmlFor="c-parent-email" className={labelCls}>Courriel du parent</label>
                <input id="c-parent-email" type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className={inputCls} placeholder="parent@exemple.ca" />
                {parentEmail && !parentEmailValid && (
                  <p className="text-[12px] text-[#EF4444] mt-1 px-1">Format de courriel invalide.</p>
                )}
              </div>
              <div>
                <label htmlFor="c-parent-rel" className={labelCls}>Lien de parenté (optionnel)</label>
                <select
                  id="c-parent-rel"
                  value={parentRelationship}
                  onChange={(e) => setParentRelationship(e.target.value)}
                  className={`${inputCls} appearance-none`}
                >
                  <option value="">Sélectionner…</option>
                  {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <SectionTitle>Consentement parental</SectionTitle>
            <div className={`${card} px-4 py-3 space-y-1`}>
              <Checkbox checked={consentProfile} onChange={setConsentProfile}>
                Je confirme que mon parent ou tuteur légal autorise la création de mon profil athlète sur Nexus.
              </Checkbox>
              <Checkbox checked={consentVisibility} onChange={setConsentVisibility}>
                Mon parent ou tuteur légal consent à ce que mes informations sportives et académiques soient visibles par les recruteurs des CÉGEP.
              </Checkbox>
            </div>
          </>
        )}

        {/* 5. Consentements Loi 25 */}
        <SectionTitle>Consentements</SectionTitle>
        <div className={`${card} px-4 py-3 space-y-1`}>
          <Checkbox checked={consentPolicy} onChange={setConsentPolicy}>
            J&apos;ai lu et j&apos;accepte la{" "}
            <button type="button" onClick={() => openLegalDocument("confidentialite")} className="text-[#E63946] underline underline-offset-2">Politique de confidentialité</button>
            {" "}et les{" "}
            <button type="button" onClick={() => openLegalDocument("conditions")} className="text-[#E63946] underline underline-offset-2">Conditions d&apos;utilisation</button>
            {" "}de Nexus.
          </Checkbox>
          <Checkbox checked={consentData} onChange={setConsentData}>
            J&apos;accepte la{" "}
            <button type="button" onClick={() => openLegalDocument("collecteDonnees")} className="text-[#E63946] underline underline-offset-2">collecte et le traitement de mes données</button>
            {" "}par Nexus aux fins décrites.
          </Checkbox>
          <Checkbox checked={consentMarketing} onChange={setConsentMarketing}>
            J&apos;accepte de recevoir des communications marketing de Nexus (max 2 courriels par mois).{" "}
            <span className="text-white/40">(optionnel)</span>
          </Checkbox>
        </div>

        {error && (
          <p className="text-[13px] text-[#EF4444] mt-4 text-center">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full mt-6 h-14 rounded-2xl bg-[#E63946] text-white font-head font-black text-[14px] uppercase tracking-widest active:scale-[0.97] active:bg-[#D42B22] transition-all disabled:opacity-40 disabled:active:scale-100"
        >
          {submitting ? "Enregistrement…" : "Continuer"}
        </button>
      </div>
    </div>
  );
}
