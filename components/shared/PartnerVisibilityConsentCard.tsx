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
   - audience="adult" (self-signup, athlète MAJEUR — 2026-09-28) → même
     explication mot pour mot que "athlete" (même source partnerMediaCopy) ;
     seule la case change : le majeur consent LUI-MÊME, il n'atteste pas
     d'une autorisation parentale. Décochée par défaut, comme partout.
     Depuis le 2026-10-02 (décision BP), c'est la case de TOUT athlète de
     14 ans et plus : à 14 ans le jeune consent seul. "athlete" (« Mes
     parents autorisent… ») ne sert plus qu'à une inscription commencée avant.
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

   C5 (1.4.5, décision BP) : à l'inscription de l'athlète, le choix est
   OBLIGATOIRE mais LIBRE (Loi 25 : un consentement ne s'impose pas) —
   `obligatoire` remplace la case par deux boutons « Oui, j'autorise » /
   « Non, pas maintenant », sans défaut ; l'appelant bloque la suite tant
   que `checked` vaut null.

   Wording note: le texte de responsabilité partagée (Loi 25) provient
   de partnerResponsibilityText() dans lib/legal/partnerMediaCopy.ts —
   SOURCE UNIQUE, pronom adapté selon l'audience (self / athlete).
═══════════════════════════════════════════════════════════════ */

import { PARTNER_MEDIA_COPY, PARTNER_MEDIA_COPY_V1, partnerResponsibilityText } from "@/lib/legal/partnerMediaCopy";

interface PartnerVisibilityConsentCardProps {
  /** null = pas encore répondu (mode `obligatoire`) ; ailleurs, null vaut non. */
  checked: boolean | null;
  onChange: (next: boolean) => void;
  /** C5 : choix Oui / Non obligatoire, sans défaut, au lieu de la case optionnelle. */
  obligatoire?: boolean;
  /**
   * Whose perspective the copy addresses. Defaults to "athlete"
   * for backwards compatibility with the self-signup call site.
   */
  audience?: "athlete" | "adult" | "coach";
}

interface Copy {
  intro: string;
  whatAppears: string;
  /** Consentement v2 (2026-10-19) : vidéos et réseaux sociaux, nommés. Absent = texte v1 (la carte seulement). */
  videosEtReseaux?: string;
  /** Texte de responsabilité, quand il diffère de partnerResponsibilityText(). */
  responsabilite?: string;
  bullets: string[];
  checkboxLabel: string;
  helper: string;
}

const COPY: Record<"athlete" | "adult" | "coach", Copy> = {
  athlete: {
    /* Explainer fields (intro / whatAppears / bullets) are sourced from
       lib/legal/partnerMediaCopy.ts so the onboarding card + the
       AthleteParametresMobile "En savoir plus" disclosure stay byte-identical.
       The shared-responsibility paragraph comes from partnerResponsibilityText()
       (same source). checkboxLabel + helper are flow-specific and stay inline. */
    /* Case parentale HÉRITÉE (inscription commencée avant le 2026-10-02) : elle écrit
       la fiche directement, sans journal → l'accord est v1. Son texte reste donc le v1. */
    intro: PARTNER_MEDIA_COPY_V1.intro,
    whatAppears: PARTNER_MEDIA_COPY_V1.whatAppears,
    bullets: [...PARTNER_MEDIA_COPY_V1.bullets],
    responsabilite: PARTNER_MEDIA_COPY_V1.responsabiliteSelf,
    checkboxLabel:
      "Mes parents autorisent l’utilisation de ma carte Nexus par les partenaires Nexus.",
    helper:
      "Tu peux compléter ton inscription sans cocher cette case. Ce choix peut être ajusté plus tard dans tes paramètres.",
  },
  adult: {
    // v2 : la réponse part à la base avec la politique v2 (transmettreChoixInscription).
    intro: PARTNER_MEDIA_COPY.intro,
    whatAppears: PARTNER_MEDIA_COPY.whatAppears,
    videosEtReseaux: PARTNER_MEDIA_COPY.videosEtReseaux,
    bullets: [...PARTNER_MEDIA_COPY.bullets],
    checkboxLabel:
      "J’autorise l’utilisation de ma carte Nexus, de mes vidéos et de mes réseaux sociaux par les partenaires Nexus.",
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
    checkboxLabel:
      "Le parent ou tuteur de l’athlète autorise l’utilisation de sa carte Nexus par les partenaires Nexus.",
    helper:
      "Tu peux compléter la création du profil sans cocher cette case. Ce choix peut être ajusté plus tard depuis le profil de l’athlète.",
  },
};

export default function PartnerVisibilityConsentCard({
  checked,
  onChange,
  obligatoire = false,
  audience = "athlete",
}: PartnerVisibilityConsentCardProps) {
  const copy = COPY[audience];
  const coche = checked === true;

  return (
    <div data-choix-partenaires={obligatoire ? String(checked) : undefined}
      className={`bg-[#1A1D24] border rounded-xl p-5 mt-6 ${obligatoire && checked === null ? "border-[#E63946]/50" : "border-[#2D3748]"}`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-head text-[15px] font-black text-white uppercase tracking-tight">
          Visibilité auprès des partenaires Nexus
        </h3>
        {obligatoire ? (
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF6B76] bg-[#E63946]/10 border border-[#E63946]/40 rounded-full px-2 py-0.5">
            Ton choix
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] bg-[#13151a] border border-[#2D3748] rounded-full px-2 py-0.5">
            Optionnel
          </span>
        )}
      </div>

      <p className="text-[13px] text-[#9CA3AF] leading-relaxed">{copy.intro}</p>

      <p className="text-[13px] text-[#9CA3AF] leading-relaxed mt-3">
        <span className="font-bold text-white">Ce qui apparaît sur la carte :</span>{" "}
        {copy.whatAppears}
      </p>

      {copy.videosEtReseaux && (
        <p className="text-[13px] text-[#9CA3AF] leading-relaxed mt-3">
          <span className="font-bold text-white">Ce que les partenaires voient aussi :</span>{" "}
          {copy.videosEtReseaux}
        </p>
      )}

      <p className="text-[13px] font-bold text-white leading-relaxed mt-3">
        Ce que cela signifie concrètement :
      </p>
      <ul className="list-disc pl-5 mt-1.5 space-y-1.5 text-[13px] text-[#9CA3AF] leading-relaxed">
        {copy.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <p className="text-[12px] text-[#9CA3AF] leading-relaxed mt-3 pt-3 border-t border-[#2D3748]">
        {copy.responsabilite ?? partnerResponsibilityText(audience === "coach" ? "athlete" : "self")}
      </p>

      {obligatoire ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5" role="radiogroup" aria-label="Visibilité auprès des partenaires Nexus">
            <button type="button" role="radio" aria-checked={checked === true} onClick={() => onChange(true)} data-choix-partenaires-oui
              className={`min-h-[48px] px-4 rounded-xl border text-[14px] font-bold transition-colors ${checked === true ? "bg-[#E63946] border-[#E63946] text-white" : "border-[#2D3748] text-white hover:border-[#E63946]/60"}`}>
              Oui, j’autorise
            </button>
            <button type="button" role="radio" aria-checked={checked === false} onClick={() => onChange(false)} data-choix-partenaires-non
              className={`min-h-[48px] px-4 rounded-xl border text-[14px] font-bold transition-colors ${checked === false ? "bg-white/[0.10] border-white/40 text-white" : "border-[#2D3748] text-white hover:border-white/40"}`}>
              Non, pas maintenant
            </button>
          </div>
          <p className="text-[11px] italic text-[#6b7280] leading-relaxed mt-3">
            Choisis Oui ou Non pour continuer. Tu pourras changer d’avis en tout temps dans tes paramètres.
          </p>
        </>
      ) : (
      <>
      <label className="flex items-start gap-3 cursor-pointer group mt-5">
        <input
          type="checkbox"
          checked={coche}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${coche ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56] group-hover:border-[#6b7280]"}`}>
          {coche && (
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
      </>
      )}
    </div>
  );
}

