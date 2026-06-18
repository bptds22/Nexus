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

   The Loi 25 responsibility-transfer bullet phrasing is flagged v1
   in docs/post-launch-bugs.md — Quebec privacy counsel review
   pending before the production launch. Treat this file as the
   single edit point for that revision.
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
  responsibilityBullet:
    "Une fois la carte téléchargée par un partenaire, celui-ci devient responsable de l’usage qu’il en fait dans ses publications, conformément à la Loi 25",
} as const;
