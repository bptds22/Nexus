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

/* ── VERSION 2 (2026-10-19, politique 2026-10-v2) ─────────────────────────────
   Nomme explicitement les VIDÉOS et les RÉSEAUX SOCIAUX (décision BP). C'est le texte
   de toute surface athlète à partir de la 1.4.5. La version 1 reste plus bas, pour
   l'historique : ce que les athlètes ont lu avant le 2026-10-19. */
export const PARTNER_MEDIA_COPY = {
  intro:
    "Nexus collabore avec des partenaires approuvés — journalistes sportifs, pages de contenu sportif, podcasts, camps de sport spécialisés, et autres organisations qui apportent de la valeur aux athlètes québécois. Ces partenaires peuvent consulter ta fiche Nexus et télécharger ta carte officielle pour la publier dans leurs articles, publications sur les réseaux sociaux, blogs ou autres contenus.",
  whatAppears: "ton nom, ton école, ta cote, ta position et ta photo.",
  videosEtReseaux:
    "tes vidéos (faits saillants, Hudl, YouTube, match complet, entraînement) et tes profils de réseaux sociaux (Instagram, Facebook, TikTok, LinkedIn), si tu les as ajoutés à ta fiche.",
  bullets: [
    "Ta carte peut apparaître dans des publications de partenaires approuvés",
    "Les partenaires peuvent regarder tes vidéos, visiter tes réseaux sociaux et y renvoyer dans leurs contenus",
    "Nexus ne donne jamais ton courriel ni ton numéro de téléphone. Tes réseaux sociaux sont publics : un partenaire pourrait t’y écrire, comme n’importe qui",
    "Les partenaires sont vérifiés par l’équipe Nexus et s’engagent par contrat à un usage éditorial responsable",
  ],
} as const;

/* ── VERSION 1 (2026-08 → 2026-10-19) — HISTORIQUE, n'est plus affichée ────────
   Texte lu par les athlètes dont l'accord est journalisé avec une politique
   antérieure à 2026-10-v2. Ne couvre que la carte. */
export const PARTNER_MEDIA_COPY_V1 = {
  intro:
    "Nexus collabore avec des partenaires approuvés — journalistes sportifs, pages de contenu sportif, podcasts, camps de sport spécialisés, et autres organisations qui apportent de la valeur aux athlètes québécois. Ces partenaires peuvent télécharger ta carte officielle Nexus pour la publier dans leurs articles, publications sur les réseaux sociaux, blogs ou autres contenus.",
  whatAppears: "ton nom, ton école, ta cote, ta position et ta photo.",
  bullets: [
    "Ta carte peut apparaître dans des publications de partenaires approuvés",
    "Aucun partenaire ne peut te contacter directement",
    "Les partenaires sont vérifiés par l’équipe Nexus et s’engagent par contrat à un usage éditorial responsable",
  ],
  responsabiliteSelf:
    "En activant cette option, tu autorises Nexus à communiquer ta carte (nom, position, établissement, cote, photo) à ses partenaires média approuvés, qui l’utilisent dans leurs publications. Chaque partenaire est responsable de la protection des renseignements qu’il reçoit ; Nexus demeure responsable de cette communication et du consentement. Tu peux retirer ce consentement en tout temps.",
  responsabiliteChild:
    "En activant cette option, vous autorisez Nexus à communiquer la carte de votre enfant (nom, position, établissement, cote, photo) à ses partenaires média approuvés, qui l’utilisent dans leurs publications. Chaque partenaire est responsable de la protection des renseignements qu’il reçoit ; Nexus demeure responsable de cette communication et du consentement. Vous pouvez retirer ce consentement en tout temps.",
} as const;

/* Texte canonique de RESPONSABILITÉ PARTAGÉE (Loi 25) du consentement de
   communication aux partenaires média. Pronom adapté selon la surface :
   - "self"    : l'athlète (14 ans et plus) gère son propre consentement → « ta carte »,
     au TUTOIEMENT comme le reste de la carte (C5, 1.4.5 : la carte passait du « tu » au « vous »)
   - "child"   : le parent gère celui de son enfant          → « la carte de votre enfant »
   - "athlete" : le coach enregistre l'autorisation parentale → « la carte de l'athlète »
   Nexus reste responsable de la communication + du consentement ; le partenaire
   de la protection des renseignements reçus. */
export function partnerResponsibilityText(subject: "self" | "child" | "athlete"): string {
  // v2 (2026-10-19) : la carte, les vidéos et les réseaux sociaux, nommés.
  const carte = "(nom, position, établissement, cote, photo)";
  if (subject === "self") {
    return (
      `En donnant ton accord, tu autorises Nexus à communiquer ta carte ${carte}, tes vidéos ` +
      "et les liens de tes réseaux sociaux à ses partenaires média approuvés, qui peuvent les utiliser " +
      "dans leurs publications. Chaque partenaire est responsable de la protection des renseignements " +
      "qu’il reçoit ; Nexus demeure responsable de cette communication et du consentement. Tu peux " +
      "retirer ce consentement en tout temps : ta carte, tes vidéos et tes réseaux disparaissent alors " +
      "pour les partenaires."
    );
  }
  if (subject === "child") {
    return (
      `En donnant votre accord, vous autorisez Nexus à communiquer la carte de votre enfant ${carte}, ` +
      "ses vidéos et les liens de ses réseaux sociaux à ses partenaires média approuvés, qui peuvent " +
      "les utiliser dans leurs publications. Chaque partenaire est responsable de la protection des " +
      "renseignements qu’il reçoit ; Nexus demeure responsable de cette communication et du consentement. " +
      "Vous pouvez retirer ce consentement en tout temps : tout disparaît alors pour les partenaires."
    );
  }
  // Coach qui crée un profil : l'autorisation qu'il enregistre reste celle de la CARTE (v1).
  // Les vidéos et les réseaux se demandent ensuite à l'athlète lui-même (carte v2).
  return (
    `En activant cette option, vous autorisez Nexus à communiquer la carte de l’athlète ${carte} ` +
    "à ses partenaires média approuvés, qui l’utilisent dans leurs publications. Chaque partenaire est " +
    "responsable de la protection des renseignements qu’il reçoit ; Nexus demeure responsable de cette " +
    "communication et du consentement. Vous pouvez retirer ce consentement en tout temps."
  );
}
