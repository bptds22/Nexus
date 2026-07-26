/* ═══════════════════════════════════════════════════════════════
   PARTNER_MEDIA_COPY — single source of truth for the partner-media
   visibility explainer (athlete audience). Consumed by :

   1. components/shared/PartnerVisibilityConsentCard.tsx — the
      onboarding consent block (athlete self-signup + coach-creates).
   2. components/shared/AthleteParametresMobile.tsx — the collapsible
      "En savoir plus" disclosure under the Confidentialité toggle.

   Audience = athlete ("tu / ta / ton"). The coach-audience variant
   (third-person "sa carte / l'athlète") stays inline in
   PartnerVisibilityConsentCard because it's specific to the
   coach-creates-on-behalf flow and not reused elsewhere.

   Le texte de responsabilité partagée (Loi 25) est exposé par la fonction
   partnerResponsibilityText() ci-dessous — SOURCE UNIQUE, pronom adapté par
   paramètre. Consommée par PartnerVisibilityConsentCard (signup athlète/coach),
   AthleteParametresMobile ("En savoir plus") et le portail parent
   (/parent/consentements). Toute révision de ce libellé se fait ICI.
═══════════════════════════════════════════════════════════════ */

export const PARTNER_MEDIA_COPY = {
  intro:
    "Nexus collabore avec des partenaires approuvés — journalistes sportifs, pages de contenu sportif, podcasts, camps de sport spécialisés, et autres organisations qui apportent de la valeur aux athlètes québécois. Ces partenaires peuvent télécharger ta carte officielle Nexus pour la publier dans leurs articles, publications sur les réseaux sociaux, blogs ou autres contenus.",
  whatAppears: "ton nom, ton école, ta cote, ta position et ta photo.",
  bullets: [
    "Ta carte peut apparaître dans des publications de partenaires approuvés",
    "Aucun partenaire ne peut te contacter directement",
    "Les partenaires sont vérifiés par l’équipe Nexus et s’engagent par contrat à un usage éditorial responsable",
  ],
} as const;

/* Texte canonique de RESPONSABILITÉ PARTAGÉE (Loi 25) du consentement de
   communication aux partenaires média. Pronom adapté selon la surface :
   - "self"    : l'athlète 14-17 gère son propre consentement → « votre carte »
   - "child"   : le parent gère celui de son enfant          → « la carte de votre enfant »
   - "athlete" : le coach enregistre l'autorisation parentale → « la carte de l'athlète »
   Nexus reste responsable de la communication + du consentement ; le partenaire
   de la protection des renseignements reçus. */
export function partnerResponsibilityText(subject: "self" | "child" | "athlete"): string {
  const objet =
    subject === "self"
      ? "votre carte"
      : subject === "child"
        ? "la carte de votre enfant"
        : "la carte de l’athlète";
  return (
    `En activant cette option, vous autorisez Nexus à communiquer ${objet} ` +
    "(nom, position, établissement, photo) à ses partenaires média approuvés, " +
    "qui l’utilisent dans leurs publications. Chaque partenaire est responsable " +
    "de la protection des renseignements qu’il reçoit ; Nexus demeure responsable " +
    "de cette communication et du consentement. Vous pouvez retirer ce consentement en tout temps."
  );
}
