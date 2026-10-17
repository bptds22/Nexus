/* Registre §97 — badges partenaire sur la fiche mobile (aperçu de l'athlète,
   fiche recruteur et fiche coach en build Capacitor), aux règles du web :
   badge PROPRE au partenaire en 120 px sans nom dessous, badge Nexus posé par
   un partenaire en 96 px avec « par {partenaire} ». */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { actionsBadgePartenaireFiche } from "@/lib/badges/actionsFiche";
import { FICHE_BOITE, FICHE_CELLULE, zoneImageRangee, FICHE_ZONE_IMAGE } from "@/components/shared/athlete/tailleBadgeFiche";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("actions sous un badge partenaire : coach seulement (comme le web)", () => {
  assert.equal(actionsBadgePartenaireFiche("coach"), "coach");
  for (const v of ["recruiter", "self-preview", undefined, null, "partner"]) {
    assert.equal(actionsBadgePartenaireFiche(v), null, String(v));
  }
});

test("tailles mobiles (< 640 px) : boîte 120 px pour un badge propre, cellule 140 px", () => {
  assert.match(FICHE_BOITE, /^w-\[120px\] h-\[120px\] /);
  assert.match(FICHE_CELLULE, /^w-\[140px\] /);
  // Deux badges propres tiennent côte à côte sur 343 px utiles (375 − 2 × 16).
  assert.ok(2 * 140 + 6 <= 343);
});

test("zone d'image : alignée sur 120 px seulement si la rangée contient un badge propre", () => {
  assert.equal(zoneImageRangee([{ estNexus: true }]), undefined);
  assert.equal(zoneImageRangee([{ estNexus: true }, { estNexus: false }]), FICHE_ZONE_IMAGE);
});

test("vignette partagée : pas de nom sous un badge propre, « par {organisation} » sous un badge Nexus (96 px, lg)", () => {
  const src = lire("components/shared/athlete/BadgesPartenaire.tsx");
  assert.match(src, /\(badge\.estMasque \|\| badge\.estNexus\) &&/);
  assert.match(src, /`par \$\{badge\.organisation\}`/);
  assert.match(src, /badge\.estNexus \? "w-\[110px\]" : FICHE_CELLULE/);
  // Le badge Nexus passe par DistinctionBadge sans `size` → gabarit lg (picto 96 px).
  assert.match(src, /<DistinctionBadge badge=\{badge\.codeNexus\} libelle=\{badge\.libelle\} zoneImage=\{zoneImage\} \/>/);
});

test("corps mobile : badges partenaire branchés par le hook et la vignette du web, actions selon le lecteur", () => {
  const src = lire("components/shared/AthleteRecruiterProfileBodyMobile.tsx");
  // Avant le retour anticipé du composant (sinon hook conditionnel).
  // (La lecture des évaluations partenaires, 1.4.5, se place au même endroit.)
  assert.match(src, /const badgesPartenaire = useBadgesPartenaires\(viewerMode === "recruiter" \? athleteId : null\);[\s\S]{0,300}?const evaluationsPartenaires = useEvaluationsPartenaires\(viewerMode === "recruiter" \? athleteId : null\);\s*\n\s*if \(viewerMode !== "recruiter"\) return null;/);
  assert.match(src, /actionsBadgePartenaireFiche\(viewer\)/);
  assert.match(src, /<BadgePartenaireVignette key=\{b\.id\} badge=\{b\} athleteId=\{id\} actions=\{actionsBadgePartenaire\} zoneImage=\{zoneImageRangee\(badgesPartenaire\)\} \/>/);
});
