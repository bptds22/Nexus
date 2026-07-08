"use client";

/* ═══════════════════════════════════════════════════════════════
   ConsentBlock — 3 consentements génériques Loi 25 (écran 2).
   Extrait de app/auth/page.tsx (parité stricte de style + wording).
   Contrôlé : valeurs + setters passés en props. policy + data
   obligatoires, marketing optionnel. Ouvre les docs légaux via
   openLegalDocument (même helper que le reste de /auth).
═══════════════════════════════════════════════════════════════ */

import { openLegalDocument } from "@/lib/legal";

interface ConsentBlockProps {
  consentPolicy: boolean; setConsentPolicy: (v: boolean) => void;
  consentData: boolean; setConsentData: (v: boolean) => void;
  consentMarketing: boolean; setConsentMarketing: (v: boolean) => void;
  /** true après une tentative de submit → surligne les cases requises manquantes. */
  submitted?: boolean;
}

function Box({ checked, invalid }: { checked: boolean; invalid: boolean }) {
  return (
    <div
      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
        checked
          ? "bg-[#E63946] border-[#E63946]"
          : invalid
            ? "border-[#EF4444]"
            : "border-[#6B7280] group-hover:border-white/30"
      }`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </div>
  );
}

export function ConsentBlock(p: ConsentBlockProps) {
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <div className="space-y-2 mt-1">
      {/* Politique + Conditions (obligatoire) */}
      <label className={`flex items-start gap-2 cursor-pointer group ${p.submitted && !p.consentPolicy ? "animate-shake" : ""}`}>
        <input type="checkbox" checked={p.consentPolicy} onChange={(e) => p.setConsentPolicy(e.target.checked)} className="sr-only" />
        <Box checked={p.consentPolicy} invalid={!!p.submitted && !p.consentPolicy} />
        <span className="text-[10px] text-[#6B7280] leading-snug">
          J&apos;ai lu et j&apos;accepte la{" "}
          <button type="button" onClick={(e) => { stop(e); openLegalDocument("confidentialite"); }} className="text-[#E63946] hover:underline">Politique de confidentialité</button>
          {" "}et les{" "}
          <button type="button" onClick={(e) => { stop(e); openLegalDocument("conditions"); }} className="text-[#E63946] hover:underline">Conditions d&apos;utilisation</button>. <span className="text-[#EF4444]">*</span>
        </span>
      </label>

      {/* Loi 25 collecte + traitement (obligatoire) */}
      <label className={`flex items-start gap-2 cursor-pointer group ${p.submitted && !p.consentData ? "animate-shake" : ""}`}>
        <input type="checkbox" checked={p.consentData} onChange={(e) => p.setConsentData(e.target.checked)} className="sr-only" />
        <Box checked={p.consentData} invalid={!!p.submitted && !p.consentData} />
        <span className="text-[10px] text-[#6B7280] leading-snug">
          J&apos;accepte la{" "}
          <button type="button" onClick={(e) => { stop(e); openLegalDocument("collecteDonnees"); }} className="text-[#E63946] hover:underline">collecte et le traitement de mes données</button>
          {" "}par Nexus aux fins décrites. <span className="text-[#EF4444]">*</span>
        </span>
      </label>

      {/* Marketing (optionnel) */}
      <label className="flex items-start gap-2 cursor-pointer group">
        <input type="checkbox" checked={p.consentMarketing} onChange={(e) => p.setConsentMarketing(e.target.checked)} className="sr-only" />
        <Box checked={p.consentMarketing} invalid={false} />
        <span className="text-[10px] text-[#6B7280] leading-snug">
          J&apos;accepte de recevoir des communications marketing de Nexus (max 2 courriels/mois). <span className="text-[#4a4d56]">(optionnel)</span>
        </span>
      </label>

      {p.submitted && (!p.consentPolicy || !p.consentData) && (
        <p className="text-[10px] text-[#EF4444]">Tu dois accepter la politique de confidentialité et la collecte de données pour continuer.</p>
      )}
    </div>
  );
}
