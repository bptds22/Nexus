// send-parent-retrait-partenaires/email.ts — « [Prénom] a retiré le
// consentement partenaires. Vous pouvez le réactiver ici. » (décision BP
// 2026-09-29, registre §55). Séparé de index.ts pour être importable sans
// démarrer Deno.serve.
//
// ⚠ Ce courriel NOMME l'enfant (décision BP), contrairement à
// send-parent-notice qui ne le nomme jamais : le parent doit savoir lequel de
// ses enfants a retiré. Vouvoiement, comme tous les courriels aux parents.
//
// Lien selon le parent :
//   'parent'  → /parent/consentements (il a un espace parent)
//   'claim'   → /parent/claim?token=… (invitation en attente : il crée son
//               espace, puis réactive)
//   'accueil' → la page d'accueil (ni espace ni invitation : jamais d'URL cassée)

import { renderEmail, APP_URL } from "../_shared/emailLayout.ts";

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export type Lien = "parent" | "claim" | "accueil";

export function sujet(prenomAthlete: string | null): string {
  const p = prenomAthlete?.trim();
  return p ? `${p} a retiré le consentement partenaires` : "Le consentement partenaires a été retiré";
}

export function lienReactivation(lien: Lien, claimToken: string | null): string {
  if (lien === "parent") return `${APP_URL}/parent/consentements`;
  if (lien === "claim" && claimToken) return `${APP_URL}/parent/claim?token=${encodeURIComponent(claimToken)}`;
  return APP_URL;
}

export function buildBody(d: {
  prenomParent: string | null;
  prenomAthlete: string | null;
  lien: Lien;
  claimToken: string | null;
}): { html: string; text: string } {
  const enfant = d.prenomAthlete?.trim() || "Votre enfant";
  const parent = d.prenomParent?.trim();
  const salut = parent ? `Bonjour ${echapper(parent)},` : "Bonjour,";
  const p = (s: string, dernier = false) => `<p style="margin:0${dernier ? "" : " 0 12px"};">${s}</p>`;

  const l1 = (e: string) => `${e} a retiré le consentement partenaires. Vous pouvez le réactiver ici.`;
  const l2 = "Tant qu'il est retiré, la carte Nexus de votre enfant n'est plus communiquée à nos " +
    "partenaires médias. Seul un parent peut réactiver ce consentement.";
  const l3 = d.lien === "claim"
    ? "Le lien ci-dessous crée d'abord votre espace parent ; vous pourrez ensuite réactiver le consentement."
    : null;

  return renderEmail({
    preheader: l1(echapper(enfant)),
    heading: salut,
    bodyHtml: p(l1(echapper(enfant))) + p(l2, !l3) + (l3 ? p(l3, true) : ""),
    ctaLabel: "Réactiver le consentement",
    ctaUrl: lienReactivation(d.lien, d.claimToken),
    footerNote:
      "Ce courriel vous est envoyé conformément à la Loi 25 (protection des renseignements personnels). Pour toute question : confidentialite@nexussports.ca",
    bodyText: [l1(enfant), "", l2, ...(l3 ? ["", l3] : [])].join("\n"),
  });
}
