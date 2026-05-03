"use client";

/* ═══════════════════════════════════════════════════════════════
   PartnerVisibilityConsentCard — optional consent block rendered
   alongside the required parental consent during athlete
   onboarding (both self-signup and coach-creates flows).

   When the checkbox is checked, the calling submit handler is
   responsible for writing partner_visibility_parental_consent +
   partner_visibility_opt_in + partner_visibility_opted_in_at.
   When unchecked, those columns should NOT be written (preserve
   existing values for repeat onboarding flows).

   Wording note: the responsibility-transfer bullet contains
   approximate Loi 25 phrasing flagged as v1 in
   docs/post-launch-bugs.md — Quebec privacy counsel review
   pending before the production launch.
═══════════════════════════════════════════════════════════════ */

interface PartnerVisibilityConsentCardProps {
  checked: boolean;
  onChange: (next: boolean) => void;
}

export default function PartnerVisibilityConsentCard({ checked, onChange }: PartnerVisibilityConsentCardProps) {
  return (
    <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-head text-[15px] font-black text-white uppercase tracking-tight">
          Visibilité auprès des partenaires Nexus
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] bg-[#13151a] border border-[#2D3748] rounded-full px-2 py-0.5">
          Optionnel
        </span>
      </div>

      <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
        Nexus collabore avec des partenaires approuvés — journalistes sportifs, pages de contenu sportif, podcasts, camps de sport spécialisés, et autres organisations qui apportent de la valeur aux athlètes québécois. Ces partenaires peuvent télécharger la carte officielle Nexus de votre enfant pour la publier dans leurs articles, publications sur les réseaux sociaux, blogs ou autres contenus.
      </p>

      <p className="text-[13px] text-[#9CA3AF] leading-relaxed mt-3">
        <span className="font-bold text-white">Ce qui apparaît sur la carte :</span>{" "}
        le nom de votre enfant, son école, sa cote, sa position et sa photo.
      </p>

      <p className="text-[13px] font-bold text-white leading-relaxed mt-3">
        Ce que cela signifie concrètement :
      </p>
      <ul className="list-disc pl-5 mt-1.5 space-y-1.5 text-[13px] text-[#9CA3AF] leading-relaxed">
        <li>La carte de votre enfant peut apparaître dans des publications de partenaires approuvés</li>
        <li>Aucun partenaire ne peut contacter directement votre enfant</li>
        <li>Les partenaires sont vérifiés par l&apos;équipe Nexus et s&apos;engagent par contrat à un usage éditorial responsable</li>
        <li>
          <span className="font-bold text-white">
            Une fois la carte téléchargée par un partenaire, celui-ci devient responsable de l&apos;usage qu&apos;il en fait dans ses publications, conformément à la Loi 25
          </span>
        </li>
        <li>Vous pouvez modifier ce choix à tout moment dans les paramètres</li>
      </ul>

      <label className="flex items-start gap-3 cursor-pointer group mt-5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${checked ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56] group-hover:border-[#6b7280]"}`}>
          {checked && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </div>
        <span className="text-[13px] text-white font-semibold leading-snug">
          J&apos;autorise l&apos;utilisation de la carte Nexus de mon enfant par les partenaires Nexus.
        </span>
      </label>

      <p className="text-[11px] italic text-[#6b7280] leading-relaxed mt-3 pl-8">
        Vous pouvez compléter l&apos;inscription sans cocher cette case. Ce choix peut être ajouté ou retiré plus tard.
      </p>
    </div>
  );
}
