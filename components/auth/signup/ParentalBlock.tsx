"use client";

/* ═══════════════════════════════════════════════════════════════
   ParentalBlock — écran 3 (athlète mineur uniquement).
   Port web de SignupMobile Step3Parent : parent PII + 2 consentements
   parentaux obligatoires + PartnerVisibilityConsentCard (optionnel,
   jamais bloquant — Loi 25). Contrôlé via props.
═══════════════════════════════════════════════════════════════ */

import PartnerVisibilityConsentCard from "@/components/shared/PartnerVisibilityConsentCard";

const inputClass =
  "w-full h-11 px-4 bg-[#111317] border border-white/10 rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-[#E63946] focus:outline-none transition-colors";
const label = "text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-1.5 block";

const RELATIONS = ["Père", "Mère", "Tuteur légal", "Autre"];

interface ParentalBlockProps {
  parentFirstName: string; setParentFirstName: (v: string) => void;
  parentLastName: string; setParentLastName: (v: string) => void;
  parentEmail: string; setParentEmail: (v: string) => void;
  parentEmailValid: boolean;
  parentRelationship: string; setParentRelationship: (v: string) => void;
  consentProfile: boolean; setConsentProfile: (v: boolean) => void;
  consentVisibility: boolean; setConsentVisibility: (v: boolean) => void;
  consentPartnerVisibility: boolean; setConsentPartnerVisibility: (v: boolean) => void;
  submitted?: boolean;
}

function ParentalCheckbox({
  checked, onChange, invalid, children,
}: {
  checked: boolean; onChange: (v: boolean) => void; invalid: boolean; children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
        checked ? "bg-[#E63946] border-[#E63946]" : invalid ? "border-[#EF4444]" : "border-[#4a4d56]"
      }`}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        )}
      </div>
      <span className="text-[13px] text-white/85 leading-snug flex-1">
        {children}<span className="text-[#EF4444] ml-0.5">*</span>
      </span>
    </label>
  );
}

export function ParentalBlock(p: ParentalBlockProps) {
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
        Tu as moins de 18 ans : on a besoin de l&apos;accord d&apos;un parent ou d&apos;un tuteur (Loi 25).
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Prénom du parent <span className="text-[#EF4444]">*</span></label>
          <input type="text" value={p.parentFirstName} onChange={(e) => p.setParentFirstName(e.target.value)} placeholder="Prénom" className={inputClass} />
        </div>
        <div>
          <label className={label}>Nom du parent <span className="text-[#EF4444]">*</span></label>
          <input type="text" value={p.parentLastName} onChange={(e) => p.setParentLastName(e.target.value)} placeholder="Nom" className={inputClass} />
        </div>
      </div>

      <div>
        <label className={label}>Courriel du parent <span className="text-[#EF4444]">*</span></label>
        <input type="email" value={p.parentEmail} onChange={(e) => p.setParentEmail(e.target.value)} placeholder="parent@exemple.ca" className={inputClass} />
        {p.parentEmail && !p.parentEmailValid && (
          <p className="text-[10px] text-[#EF4444] mt-1">Format de courriel invalide.</p>
        )}
      </div>

      <div>
        <label className={label}>Lien de parenté (optionnel)</label>
        <select value={p.parentRelationship} onChange={(e) => p.setParentRelationship(e.target.value)} className={inputClass}>
          <option value="">Sélectionner…</option>
          {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div>
        <h2 className="font-head text-[12px] font-black uppercase tracking-tight text-white/70 mb-2 flex items-center gap-2">
          <span className="w-0.5 h-3 bg-[#E63946] rounded-full" /> Consentement parental
        </h2>
        <div className="bg-[#1A1D24] border border-white/[0.06] rounded-lg px-4 py-3 space-y-1">
          <ParentalCheckbox checked={p.consentProfile} onChange={p.setConsentProfile} invalid={!!p.submitted && !p.consentProfile}>
            Je confirme que mon parent ou tuteur légal autorise la création de mon profil athlète sur Nexus.
          </ParentalCheckbox>
          <ParentalCheckbox checked={p.consentVisibility} onChange={p.setConsentVisibility} invalid={!!p.submitted && !p.consentVisibility}>
            Mon parent ou tuteur légal consent à ce que mes informations sportives et académiques soient visibles par les recruteurs des CÉGEP.
          </ParentalCheckbox>
        </div>
      </div>

      <PartnerVisibilityConsentCard
        checked={p.consentPartnerVisibility}
        onChange={p.setConsentPartnerVisibility}
        audience="athlete"
      />
    </div>
  );
}
