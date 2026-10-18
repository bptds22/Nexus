/* C5 (1.4.5) — inscription athlète : la visibilité partenaires est un choix OBLIGATOIRE et LIBRE (Oui / Non,
   aucun défaut), sur les trois surfaces d'inscription ; texte au tutoiement. (Pas de rappel « descends » : BP.) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { partnerResponsibilityText } from "@/lib/legal/partnerMediaCopy";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("C5 : le texte de l'athlète est au tutoiement et nomme la cote, comme la carte", () => {
  const soi = partnerResponsibilityText("self");
  assert.ok(soi.startsWith("En activant cette option, tu autorises Nexus à communiquer ta carte (nom, position, établissement, cote, photo)"));
  assert.ok(soi.endsWith("Tu peux retirer ce consentement en tout temps."));
  assert.ok(!/\bvous\b|\bvotre\b/.test(soi));
  assert.ok(partnerResponsibilityText("child").includes("la carte de votre enfant (nom, position, établissement, cote, photo)"));
});

test("C5 : la carte, en mode obligatoire, propose Oui / Non sans défaut", () => {
  const carte = lire("components/shared/PartnerVisibilityConsentCard.tsx");
  assert.ok(carte.includes("onClick={() => onChange(true)} data-choix-partenaires-oui"));
  assert.ok(carte.includes("onClick={() => onChange(false)} data-choix-partenaires-non"));
  assert.ok(carte.includes("Choisis Oui ou Non pour continuer."));
  assert.ok(!carte.includes("RappelChoixPartenaires"), "pas de rappel de défilement (BP)");
});

test("C5 : web, appli et /consentements bloquent la suite tant qu'il n'y a pas de réponse (Oui ET Non passent)", () => {
  const web = lire("components/auth/signup/usePartialSignup.ts");
  assert.ok(web.includes("useState<boolean | null>(null)"));
  assert.ok(web.includes("const choixPartenairesFait = !showsAdultPartnerConsent || consentAdultPartnerVisibility !== null;"));
  assert.ok(web.includes("    choixPartenairesFait;\n"));
  assert.ok(web.includes("partnerVisibility: consentAdultPartnerVisibility === true"));
  const appli = lire("components/mobile/auth/SignupMobile.tsx");
  assert.ok(appli.includes("const choixPartenairesFait = !montreChoixPartenaires || consentAdultPartnerVisibility !== null;"));
  assert.ok(appli.includes("    && choixPartenairesFait;\n"));
  assert.ok(appli.includes("partnerVisibility: consentAdultPartnerVisibility === true,"));
  const oauth = lire("app/consentements/page.tsx");
  assert.ok(oauth.includes("if (!choixPartenairesFait) return false;"));
  assert.ok(oauth.includes("partnerVisibility: consentPartnerAdult === true"));
  for (const src of [lire("app/auth/page.tsx"), appli, oauth]) {
    assert.ok(src.includes("obligatoire\n"));
    assert.ok(!src.includes("RappelChoixPartenaires"));
  }
});
