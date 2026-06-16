"use client";

/* ═══════════════════════════════════════════════════════════════
   PartnerVisibilityConsentCard — optional consent block rendered
   alongside the required parental consent during athlete
   onboarding (both self-signup and coach-creates flows).

   Audience-aware copy : the same block is used in two flows whose
   AUDIENCE is different.
   - audience="athlete" (self-signup) → addresses the athlete with
     "tu / ta / ton / mes parents" — Quebec FR tutoiement, the
     athlete is filling in their own profile.
   - audience="coach" (coach creates a profile on behalf of an
     athlete) → addresses the COACH with "tu" but refers to the
     ATHLETE in the third person ("l'athlète / sa carte"). The
     consent affirms what the athlete's parent/guardian has
     authorized — the coach is recording that authorization, not
     giving it themselves.

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

import { PARTNER_MEDIA_COPY } from "@/lib/legal/partnerMediaCopy";

interface PartnerVisibilityConsentCardProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /**
   * Whose perspective the copy addresses. Defaults to "athlete"
   * for backwards compatibility with the self-signup call site.
   */
  audience?: "athlete" | "coach";
}

interface Copy {
  intro: string;
  whatAppears: string;
  bullets: string[];
  responsibilityBullet: string;
  checkboxLabel: string;
  helper: string;
}

const COPY: Record<"athlete" | "coach", Copy> = {
  athlete: {
    /* Explainer fields (intro / whatAppears / bullets / responsibilityBullet)
       are sourced from lib/legal/partnerMediaCopy.ts so the onboarding card
       + the AthleteParametresMobile "En savoir plus" disclosure stay
       byte-identical. checkboxLabel + helper are flow-specific (consent
       phrasing + onboarding nudge) and stay inline. */
    intro: PARTNER_MEDIA_COPY.intro,
    whatAppears: PARTNER_MEDIA_COPY.whatAppears,
    bullets: [...PARTNER_MEDIA_COPY.bullets],
    responsibilityBullet: PARTNER_MEDIA_COPY.responsibilityBullet,
    checkboxLabel:
      "Mes parents autorisent l’utilisation de ma carte Nexus par les partenaires Nexus.",
    helper:
      "Tu peux compléter ton inscription sans cocher cette case. Ce choix peut être ajusté plus tard dans tes paramètres.",
  },
  coach: {
    intro:
      "Nexus collabore avec des partenaires approuvés — journalistes sportifs, pages de contenu sportif, podcasts, camps de sport spécialisés, et autres organisations qui apportent de la valeur aux athlètes québécois. Ces partenaires peuvent télécharger la carte officielle Nexus de l’athlète pour la publier dans leurs articles, publications sur les réseaux sociaux, blogs ou autres contenus.",
    whatAppears: "son nom, son école, sa cote, sa position et sa photo.",
    bullets: [
      "Sa carte peut apparaître dans des publications de partenaires approuvés",
      "Aucun partenaire ne peut contacter l’athlète directement",
      "Les partenaires sont vérifiés par l’équipe Nexus et s’engagent par contrat à un usage éditorial responsable",
    ],
    responsibilityBullet:
      "Une fois la carte téléchargée par un partenaire, celui-ci devient responsable de l’usage qu’il en fait dans ses publications, conformément à la Loi 25",
    checkboxLabel:
      "Le parent ou tuteur de l’athlète autorise l’utilisation de sa carte Nexus par les partenaires Nexus.",
    helper:
      "Tu peux compléter la création du profil sans cocher cette case. Ce choix peut être ajusté plus tard depuis le profil de l’athlète.",
  },
};

export default function PartnerVisibilityConsentCard({
  checked,
  onChange,
  audience = "athlete",
}: PartnerVisibilityConsentCardProps) {
  const copy = COPY[audience];

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

      <p className="text-[13px] text-[#9CA3AF] leading-relaxed">{copy.intro}</p>

      <p className="text-[13px] text-[#9CA3AF] leading-relaxed mt-3">
        <span className="font-bold text-white">Ce qui apparaît sur la carte :</span>{" "}
        {copy.whatAppears}
      </p>

      <p className="text-[13px] font-bold text-white leading-relaxed mt-3">
        Ce que cela signifie concrètement :
      </p>
      <ul className="list-disc pl-5 mt-1.5 space-y-1.5 text-[13px] text-[#9CA3AF] leading-relaxed">
        {copy.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
        <li>
          <span className="font-bold text-white">{copy.responsibilityBullet}</span>
        </li>
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
          {copy.checkboxLabel}
        </span>
      </label>

      <p className="text-[11px] italic text-[#6b7280] leading-relaxed mt-3 pl-8">
        {copy.helper}
      </p>
    </div>
  );
}
